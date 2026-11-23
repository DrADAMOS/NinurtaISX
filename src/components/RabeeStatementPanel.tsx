import React, { useMemo, useRef, useState } from 'react';
import { FileText, Check, X, Loader2 } from 'lucide-react';
import { findRabeeDuplicateContracts, parseRabeeTradeItems, type RabeeTrade, type RabeeTextItem } from '../utils/rabeeStatement';

const STORAGE_KEY = 'ninurta_isx_rabee_trades_v1';
const money = (value: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(value);

export const RabeeStatementPanel: React.FC = () => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState<RabeeTrade[]>(() => { try { const raw = localStorage.getItem(STORAGE_KEY); const parsed = raw ? JSON.parse(raw) : []; return Array.isArray(parsed) ? parsed : []; } catch { return []; } });
  const [drafts, setDrafts] = useState<RabeeTrade[]>([]);
  const [duplicates, setDuplicates] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState('');
  const totals = useMemo(() => saved.reduce((acc, row) => ({ buy: acc.buy + (row.side === 'BUY' ? row.netValue : 0), sell: acc.sell + (row.side === 'SELL' ? row.netValue : 0) }), { buy: 0, sell: 0 }), [saved]);

  const importPdf = async (file?: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) { setStatus('هذا المستورد مخصص لكشوف PDF من Rabee Securities.'); return; }
    setBusy(true); setDrafts([]); setStatus(''); setProgress('فتح ملف PDF...');
    try {
      const pdfjs = await import('pdfjs-dist');
      const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
      if (pdf.numPages > 20) throw new Error('الملف يتجاوز 20 صفحة. قسّمه إلى ملفات أصغر.');
      const extracted: RabeeTrade[] = [];
      for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
        setProgress(`تحليل صفحة ${pageNo} من ${pdf.numPages}...`);
        const page = await pdf.getPage(pageNo);
        const viewport = page.getViewport({ scale: 1 });
        const content = await page.getTextContent();
        extracted.push(...parseRabeeTradeItems(content.items as RabeeTextItem[], viewport.width, viewport.height));
        page.cleanup();
      }
      if (!extracted.length) throw new Error('لم أتعرف على جدول تداول Rabee. تأكد أن الملف يحتوي نصاً قابلاً للاستخراج؛ OCR للصور غير مفعّل في هذا المستورد بعد.');
      const seen = new Set<string>();
      const unique = extracted.filter(row => { if (seen.has(row.contractNo)) return false; seen.add(row.contractNo); return true; });
      const dup = findRabeeDuplicateContracts(unique, saved);
      setDuplicates(dup);
      setDrafts(unique);
      setStatus(`تم التعرف على ${unique.length} عقد تداول. ${dup.size} مكرر؛ راجع البيانات قبل الحفظ.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'تعذر تحليل ملف PDF.');
    } finally { setBusy(false); setProgress(''); if (fileRef.current) fileRef.current.value = ''; }
  };

  const approve = () => {
    const selected = drafts.filter(row => !duplicates.has(row.contractNo));
    if (!selected.length) { setStatus('لا توجد عقود جديدة صالحة للحفظ.'); return; }
    if (selected.some(row => row.confidence !== 'high')) { setStatus('توجد عقود تحتاج مراجعة؛ صحح بياناتها أو احذفها قبل الحفظ. لا يمكن اعتماد صف غير مكتمل.'); return; }
    const next = [...selected, ...saved];
    setSaved(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { setStatus('تعذر الحفظ المحلي؛ لم يتم تأكيد حفظ العقود.'); return; }
    setDrafts([]); setStatus(`تم حفظ ${selected.length} عقد تداول في سجل الوسيط، بشكل مستقل عن كشف الحساب المصرفي.`);
  };

  return <section className="space-y-4 rounded-2xl border border-cyan-500/25 bg-[#0A111D] p-4" dir="rtl">
    <div className="flex items-center gap-3"><div className="rounded-xl bg-cyan-500/10 p-3 text-cyan-300"><FileText className="h-5 w-5" /></div><div><h3 className="font-black text-white">استيراد كشف تداول</h3><p className="mt-1 text-xs text-slate-400">مستورد مستقل للشراء والبيع والعقود والعمولات؛ لا يخلطها مع حركات البنك.</p></div></div>
    <div className="flex flex-wrap items-center gap-3"><input ref={fileRef} type="file" accept=".pdf,application/pdf" onChange={event => void importPdf(event.target.files?.[0])} className="max-w-full text-xs text-slate-300 file:ml-2 file:rounded-lg file:border-0 file:bg-cyan-500 file:px-3 file:py-2 file:font-bold file:text-slate-950" />{busy && <span className="flex items-center gap-2 text-xs text-cyan-200"><Loader2 className="h-4 w-4 animate-spin"/>{progress}</span>}</div>
    {status && <p role="status" className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-xs leading-6 text-slate-200">{status}</p>}
    {drafts.length > 0 && <div className="overflow-x-auto rounded-xl border border-slate-700"><div className="flex items-center justify-between gap-2 p-3"><strong className="text-sm text-white">مراجعة العقود ({drafts.length})</strong><div className="flex gap-2"><button onClick={approve} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"><Check className="h-4 w-4"/> حفظ العقود الجديدة</button><button onClick={() => setDrafts([])} className="rounded-lg bg-slate-800 px-3 py-2 text-xs text-white"><X className="h-4 w-4"/></button></div></div><table className="w-full min-w-[980px] text-right text-xs"><thead className="bg-slate-900 text-slate-400"><tr>{['حالة العقد','تاريخ التنفيذ','رقم العقد','رمز السهم','اسم الشركة','نوع العملية','الكمية','سعر السهم','إجمالي قيمة الصفقة','العمولة','صافي قيمة الصفقة'].map(label => <th key={label} className="px-2 py-3">{label}</th>)}</tr></thead><tbody>{drafts.map(row => <tr key={row.contractNo} className="border-t border-slate-800 text-slate-200"><td className="px-2 py-2">{duplicates.has(row.contractNo) ? <span className="text-rose-300">مكرر سابقاً</span> : row.confidence === 'high' ? <span className="text-emerald-300">جديد — غير محفوظ</span> : <span className="text-amber-300">قيد المراجعة</span>}</td><td className="px-2 py-2 font-mono">{row.date}</td><td className="px-2 py-2 font-mono">{row.contractNo}</td><td className="px-2 py-2">{row.ticker || '—'}</td><td className="px-2 py-2">{row.company || '—'}</td><td className="px-2 py-2">{row.side === 'BUY' ? 'شراء' : row.side === 'SELL' ? 'بيع' : 'غير محدد'}</td><td className="px-2 py-2">{money(row.quantity)}</td><td className="px-2 py-2">{money(row.price)}</td><td className="px-2 py-2">{money(row.grossValue)}</td><td className="px-2 py-2">{money(row.commission)}</td><td className="px-2 py-2">{money(row.netValue)}</td></tr>)}</tbody></table><p className="p-3 text-[11px] text-amber-200">لن تُحفظ العقود المكررة أو غير المكتملة. راجع الأرقام قبل الحفظ، وطابقها مع ملخص الوسيط.</p></div>}
    <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-900 p-3"><p className="text-xs text-slate-400">عدد العقود المحفوظة</p><strong className="text-xl text-white">{saved.length}</strong></div><div className="rounded-xl bg-slate-900 p-3"><p className="text-xs text-slate-400">صافي قيمة الشراء</p><strong className="text-lg text-rose-300">{money(totals.buy)}</strong></div><div className="rounded-xl bg-slate-900 p-3"><p className="text-xs text-slate-400">صافي قيمة البيع</p><strong className="text-lg text-emerald-300">{money(totals.sell)}</strong></div></div>
    <p className="text-[11px] leading-5 text-slate-500">الحفظ محلي في هذا المتصفح. لا يُرسل الملف إلى خادم. المستورد حالياً مضبوط على جدول Rabee النصّي ذي الأعمدة المعروفة؛ الملفات المصوّرة تحتاج OCR مخصصاً لاحقاً.</p>
  </section>;
};
