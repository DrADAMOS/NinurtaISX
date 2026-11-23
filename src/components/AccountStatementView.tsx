import React, { useMemo, useRef, useState } from 'react';
import { groupPdfTextItems } from '../utils/pdfText';
import { findDuplicateFingerprints, isValidStatementDate, statementFingerprint } from '../utils/statementImport';
import { FileSpreadsheet, Upload, Plus, Trash2, Download, AlertCircle, ScanLine, FileImage, FileText, Check, X, Loader2 } from 'lucide-react';
import { RabeeStatementPanel } from './RabeeStatementPanel';

export interface StatementEntry {
  id: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number | null;
}
type DraftEntry = StatementEntry & { selected: boolean; sourceLine?: string; confidence: 'high' | 'review'; duplicate?: boolean };

const STORAGE_KEY = 'ninurta_isx_account_statement_v1';
const arabicDigits: Record<string, string> = { '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9' };
const normalizeDigits = (s: string) => s.replace(/[٠-٩]/g, d => arabicDigits[d]).replace(/[٬]/g, ',').replace(/[٫]/g, '.').replace(/[−–]/g, '-');
function parseAmount(value: string): number {
  const normalized = normalizeDigits(value).trim().replace(/[,\s]/g, '').replace(/[^\d.-]/g, '');
  if (!normalized || normalized === '-' || normalized === '.') return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.abs(parsed) : 0;
}
function parseCsvLine(line: string): string[] {
  const result: string[] = []; let current = ''; let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') { if (quoted && line[i + 1] === '"') { current += '"'; i += 1; } else quoted = !quoted; }
    else if (char === ',' && !quoted) { result.push(current.trim()); current = ''; }
    else current += char;
  }
  result.push(current.trim()); return result;
}
function parseDate(value: string): string {
  const v = normalizeDigits(value).trim();
  let m = v.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (!m) m = v.match(/^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})$/);
  if (!m) return v;
  if (m[1].length === 4) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  const year = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${year}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
}
function mapRows(rows: unknown[][]): DraftEntry[] {
  if (rows.length < 2) throw new Error('الملف لا يحتوي على صفوف كافية.');
  const headers = rows[0].map(v => String(v ?? '').toLowerCase().trim());
  const find = (keys: string[]) => headers.findIndex(h => keys.some(k => h === k || h.includes(k)));
  const di = find(['date','التاريخ']); const si = find(['description','details','narration','البيان','التفاصيل','الوصف']);
  const debitI = find(['debit','withdrawal','مدين','السحب']); const creditI = find(['credit','deposit','دائن','الإيداع']);
  const balanceI = find(['balance','الرصيد']);
  if (di < 0 || si < 0 || (debitI < 0 && creditI < 0)) throw new Error('لم أتعرف على الأعمدة. يلزم التاريخ والبيان والمدين/الدائن. راجع ترتيب أعمدة الملف.');
  return rows.slice(1).filter(r => r.some(v => String(v ?? '').trim())).map((r,i) => ({
    id:`draft-${Date.now()}-${i}`, date:parseDate(String(r[di] ?? '')), description:String(r[si] ?? '').trim(),
    debit:debitI < 0 ? 0 : parseAmount(String(r[debitI] ?? '')), credit:creditI < 0 ? 0 : parseAmount(String(r[creditI] ?? '')),
    balance:balanceI < 0 || String(r[balanceI] ?? '').trim()==='' ? null : parseAmount(String(r[balanceI])),
    selected:true, confidence:'high' as const
  })).filter(r => r.date && r.description && (r.debit > 0 || r.credit > 0));
}
function parseOcrLines(text: string): DraftEntry[] {
  const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const out: DraftEntry[] = [];
  const dateRe = /(?:\d{1,4}[\/.-]\d{1,2}[\/.-]\d{1,4})/;
  const amountRe = /-?\d[\d,٬]*(?:[٫.]\d{1,3})?/g;
  for (const [i,line] of lines.entries()) {
    const dm = line.match(dateRe); if (!dm) continue;
    const afterDate = line.replace(dm[0], ' ');
    const amounts = [...afterDate.matchAll(amountRe)].map(m => m[0]);
    if (!amounts.length) continue;
    const nums = amounts.map(parseAmount);
    const desc = afterDate.replace(amountRe, ' ').replace(/[|:؛,]/g,' ').replace(/\s+/g,' ').trim();
    if (!desc) continue;
    const debit = nums.length >= 2 ? nums[nums.length-2] : nums[0];
    const credit = nums.length >= 2 ? nums[nums.length-1] : 0;
    out.push({ id:`ocr-${Date.now()}-${i}`, date:parseDate(dm[0]), description:desc,
      debit, credit, balance:null, selected:true, confidence:'review', sourceLine:line });
  }
  return out;
}
const money = (v:number) => new Intl.NumberFormat('en-US',{maximumFractionDigits:3}).format(v);

export const AccountStatementView: React.FC = () => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [entries,setEntries] = useState<StatementEntry[]>(() => { try { const s=localStorage.getItem(STORAGE_KEY); const p=s?JSON.parse(s):[]; return Array.isArray(p)?p:[]; } catch { return []; } });
  const [drafts,setDrafts] = useState<DraftEntry[]>([]);
  const [date,setDate] = useState(new Date().toISOString().slice(0,10));
  const [description,setDescription] = useState(''); const [debit,setDebit] = useState(''); const [credit,setCredit] = useState(''); const [balance,setBalance] = useState('');
  const [message,setMessage] = useState(''); const [busy,setBusy] = useState(false); const [progress,setProgress] = useState('');
  const persist = (next:StatementEntry[]) => { setEntries(next); try { localStorage.setItem(STORAGE_KEY,JSON.stringify(next)); } catch { setMessage('تعذر الحفظ المحلي؛ مساحة المتصفح قد تكون ممتلئة.'); } };
  const totals = useMemo(()=>entries.reduce((a,r)=>({debit:a.debit+r.debit,credit:a.credit+r.credit}),{debit:0,credit:0}),[entries]);
  const addEntry = (e:React.FormEvent) => { e.preventDefault(); if(!description.trim()||(!debit&&!credit)){setMessage('أدخل البيان ومبلغاً مديناً أو دائناً.');return;} const row={id:`manual-${Date.now()}`,date,description:description.trim(),debit:parseAmount(debit),credit:parseAmount(credit),balance:balance.trim()?parseAmount(balance):null}; persist([row,...entries]);setDescription('');setDebit('');setCredit('');setBalance('');setMessage('تمت إضافة الحركة وحفظها محلياً.'); };
  const importFile = async (file?:File) => {
    if(!file)return; setBusy(true);setDrafts([]);setMessage('');setProgress('');
    try {
      const name=file.name.toLowerCase(); let parsed:DraftEntry[]=[];
      if(name.endsWith('.csv')) {
        parsed=mapRows((await file.text()).replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean).map(parseCsvLine));
      } else if(name.endsWith('.xlsx')||name.endsWith('.xls')) {
        setProgress('قراءة ملف Excel...');
        const XLSX=await import('xlsx'); const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});
        const sheet=wb.Sheets[wb.SheetNames[0]]; parsed=mapRows(XLSX.utils.sheet_to_json(sheet,{header:1,raw:false,defval:''}) as unknown[][]);
      } else if(name.endsWith('.pdf')||file.type.startsWith('image/')) {
        let pdf: any = null;
        let pdfWorkerUrl = '';
        if(name.endsWith('.pdf')) {
          setProgress('فحص النص الأصلي داخل PDF...');
          const pdfjs=await import('pdfjs-dist'); pdfWorkerUrl=(await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
          pdfjs.GlobalWorkerOptions.workerSrc=pdfWorkerUrl;
          pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;
          if(pdf.numPages>20) throw new Error('الملف يتجاوز 20 صفحة. قسّمه إلى ملفات أصغر.');
          let extractedText='';
          for(let n=1;n<=pdf.numPages;n++) {
            setProgress(`استخراج النص من صفحة ${n} من ${pdf.numPages}`);
            const page=await pdf.getPage(n); const content=await page.getTextContent();
            const items = content.items.filter((item: unknown): item is { str: string; transform: number[] } => typeof item === 'object' && item !== null && 'str' in item && typeof item.str === 'string' && 'transform' in item && Array.isArray(item.transform));
            extractedText+=`\n${groupPdfTextItems(items)}`;
            page.cleanup();
          }
          parsed=parseOcrLines(extractedText);
          if(parsed.length) setMessage(`تم استخراج النص مباشرة من PDF دون OCR. عُثر على ${parsed.length} حركة مرشحة؛ راجعها قبل الاعتماد.`);
        }
        if(!parsed.length) {
          setProgress('تحميل محرك OCR عند الحاجة...');
          const { createWorker } = await import('tesseract.js');
          const worker=await createWorker('ara+eng',1,{logger:m=>{if(m.status==='recognizing text')setProgress(`قراءة النص: ${Math.round((m.progress||0)*100)}%`);}});
          try {
            const pageCount=pdf?.numPages ?? 1; let allText='';
            for(let n=1;n<=pageCount;n++) {
              setProgress(`تحضير وقراءة الصفحة ${n} من ${pageCount}`);
              let imageData: string;
              if(pdf) {
                const page=await pdf.getPage(n); const viewport=page.getViewport({scale:2});
                const canvas=document.createElement('canvas'); canvas.width=viewport.width; canvas.height=viewport.height;
                const context=canvas.getContext('2d'); if(!context) throw new Error('تعذر تجهيز مساحة قراءة PDF.');
                await page.render({canvas,canvasContext:context,viewport}).promise;
                imageData=canvas.toDataURL('image/png'); canvas.width=0; canvas.height=0; page.cleanup();
              } else {
                imageData=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(new Error('تعذرت قراءة الصورة'));r.readAsDataURL(file);});
              }
              const result=await worker.recognize(imageData); allText+=`\n${result.data.text}`;
            }
            parsed=parseOcrLines(allText);
            if(!parsed.length) throw new Error('تمت قراءة النص، لكن لم أستطع تمييز حركات مالية. يمكنك استخدام ملف Excel/CSV بأعمدة واضحة.');
            setMessage(`اكتملت قراءة ${pageCount} صفحة عبر OCR. استخرجت ${parsed.length} حركة مرشحة؛ جميعها بانتظار مراجعتك.`);
          } finally { await worker.terminate(); }
        }
        if(pdf) await pdf.destroy();
      } else throw new Error('الصيغ المدعومة: PDF وJPG وPNG وCSV وXLSX وXLS.');
      if(!parsed.length) throw new Error('لم يتم العثور على حركات صالحة.');
      const duplicateKeys = findDuplicateFingerprints(parsed, entries);
      const duplicateCount = parsed.filter(row => duplicateKeys.has(statementFingerprint(row))).length;
      const reviewed = parsed.map(row => { const duplicate = duplicateKeys.has(statementFingerprint(row)); return { ...row, duplicate, selected: !duplicate, confidence: duplicate ? 'review' as const : row.confidence }; });
      setDrafts(reviewed);
      setMessage(`تم استخراج ${parsed.length} حركة مرشحة. ${duplicateCount ? `تم تمييز ${duplicateCount} حركة مكررة ومنع اعتمادها تلقائياً. ` : ''}راجع البيانات قبل الحفظ.`);
    } catch(err) { setMessage(err instanceof Error?err.message:'تعذرت معالجة الملف.'); }
    finally {setBusy(false);setProgress('');if(fileRef.current)fileRef.current.value='';}
  };
  const updateDraft=(id:string,patch:Partial<DraftEntry>)=>setDrafts(old=>old.map(r=>r.id===id?{...r,...patch}:r));
  const approveDrafts=()=>{const chosen=drafts.filter(r=>r.selected&&!r.duplicate);if(!chosen.length){setMessage('لا توجد حركات صالحة للاعتماد. افحص التكرار وحدد الحركات المطلوبة.');return;}const invalid=chosen.filter(r=>!isValidStatementDate(r.date)||!r.description.trim()||!Number.isFinite(r.debit)||!Number.isFinite(r.credit)||r.debit<0||r.credit<0||(r.debit>0&&r.credit>0));if(invalid.length){setMessage(`تعذر الاعتماد: توجد ${invalid.length} حركة بتاريخ أو مبالغ غير صالحة، أو تحتوي مديناً ودائناً معاً. صححها أولاً.`);return;}const rows:StatementEntry[]=chosen.map(({selected,confidence,sourceLine,duplicate,...r})=>r);persist([...rows,...entries]);setDrafts([]);setMessage(`تم اعتماد وحفظ ${rows.length} حركة محلياً.`);};
  const exportCsv=()=>{const rows=[['date','description','debit','credit','balance'],...entries.map(r=>[r.date,`"${r.description.replace(/"/g,'""')}"`,String(r.debit),String(r.credit),r.balance===null?'':String(r.balance)])];const blob=new Blob(['\uFEFF'+rows.map(r=>r.join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='ninurta-account-statement.csv';a.click();URL.revokeObjectURL(url);};
  return <section className="space-y-5" dir="rtl">
    <RabeeStatementPanel />
    <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-l from-[#111B2D] to-[#090F1C] p-5"><div className="flex items-center gap-3"><div className="rounded-xl bg-amber-500/10 p-3 text-amber-400"><FileSpreadsheet className="h-6 w-6"/></div><div><h2 className="text-xl font-black text-white">إضافة كشف حساب</h2><p className="mt-1 text-xs text-slate-400">استيراد ومراجعة الحركات المصرفية — المعالجة والحفظ محلياً</p></div></div></div>
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-3 rounded-2xl border border-slate-800 bg-[#0A0F1D] p-4"><h3 className="flex items-center gap-2 font-bold text-white"><Upload className="h-4 w-4 text-amber-400"/> استيراد كشف أو مسحه ضوئياً</h3>
        <p className="text-xs leading-6 text-slate-400">يدعم CSV وExcel وPDF والصور JPG/PNG. يتعرف OCR على العربية والإنجليزية. لا يتم اعتماد أي حركة تلقائياً؛ ستظهر أولاً للمراجعة.</p>
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.pdf,image/png,image/jpeg" onChange={e=>void importFile(e.target.files?.[0])} className="block w-full text-xs text-slate-300 file:ml-3 file:rounded-lg file:border-0 file:bg-amber-500 file:px-3 file:py-2 file:font-bold file:text-slate-950"/>
        {busy&&<div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200"><Loader2 className="h-4 w-4 animate-spin"/>{progress||'جارٍ تحليل الملف...'}</div>}
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-[11px] leading-6 text-slate-400"><AlertCircle className="ml-1 inline h-3.5 w-3.5 text-amber-400"/> الملفات لا تُرسل إلى خادم نينورتا. محرك OCR وبيانات اللغة قد يحتاجان اتصال إنترنت عند أول تشغيل لتحميلهما.</div>
      </div>
      <form onSubmit={addEntry} className="space-y-3 rounded-2xl border border-slate-800 bg-[#0A0F1D] p-4"><h3 className="flex items-center gap-2 font-bold text-white"><Plus className="h-4 w-4 text-emerald-400"/> إضافة حركة يدوياً</h3>
        <div className="grid grid-cols-2 gap-2"><label className="text-xs text-slate-400">التاريخ<input type="date" value={date} onChange={e=>setDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-[#050811] p-2 text-white"/></label><label className="text-xs text-slate-400">الرصيد بعد الحركة<input type="number" step="0.001" value={balance} onChange={e=>setBalance(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-[#050811] p-2 text-white"/></label></div>
        <label className="block text-xs text-slate-400">البيان<input value={description} onChange={e=>setDescription(e.target.value)} placeholder="مثال: إيداع نقدي" className="mt-1 w-full rounded-lg border border-slate-700 bg-[#050811] p-2 text-white"/></label>
        <div className="grid grid-cols-2 gap-2"><label className="text-xs text-slate-400">مدين / سحب<input type="number" min="0" step="0.001" value={debit} onChange={e=>setDebit(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-[#050811] p-2 text-white"/></label><label className="text-xs text-slate-400">دائن / إيداع<input type="number" min="0" step="0.001" value={credit} onChange={e=>setCredit(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-[#050811] p-2 text-white"/></label></div>
        <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-3 py-2.5 text-xs font-black text-slate-950"><Plus className="h-4 w-4"/> إضافة الحركة</button>
      </form>
    </div>
    {message&&<div role="status" className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-xs text-slate-200">{message}</div>}
    {drafts.length>0&&<div className="overflow-hidden rounded-2xl border border-amber-500/30 bg-[#0A0F1D]"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-4"><div><h3 className="font-bold text-white">مراجعة الحركات المستخرجة ({drafts.length})</h3><p className="mt-1 text-[11px] text-amber-200">راجع التاريخ والبيان والمبالغ؛ قراءة OCR تقريبية وقد تخطئ في الأرقام أو اتجاه المدين والدائن.</p></div><div className="flex gap-2"><button onClick={approveDrafts} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"><Check className="h-4 w-4"/> اعتماد المحدد</button><button onClick={()=>setDrafts([])} className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-200"><X className="h-4 w-4"/> إلغاء</button></div></div>
      <div className="max-h-[430px] overflow-auto"><table className="w-full min-w-[850px] text-right text-xs"><thead className="sticky top-0 bg-[#060913] text-slate-400"><tr>{['اعتماد','الحالة','التاريخ','البيان','مدين','دائن','الرصيد','مقتطف OCR'].map(h=><th key={h} className="px-3 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-800/70">{drafts.map(r=><tr key={r.id} className="text-slate-200"><td className="px-3 py-2"><input type="checkbox" checked={r.selected} disabled={!!r.duplicate} onChange={e=>updateDraft(r.id,{selected:e.target.checked})}/></td><td className="px-2 py-2">{r.duplicate?<span className="rounded bg-rose-500/15 px-2 py-1 text-rose-300">مكرر</span>:<span className="text-emerald-300">جديد</span>}</td><td className="px-2 py-2"><input value={r.date} onChange={e=>updateDraft(r.id,{date:e.target.value})} className="w-28 rounded bg-slate-900 p-2"/></td><td className="px-2 py-2"><input value={r.description} onChange={e=>updateDraft(r.id,{description:e.target.value})} className="w-48 rounded bg-slate-900 p-2"/></td><td className="px-2 py-2"><input type="number" min="0" step="0.001" value={r.debit} onChange={e=>updateDraft(r.id,{debit:Number(e.target.value)})} className="w-24 rounded bg-slate-900 p-2"/></td><td className="px-2 py-2"><input type="number" min="0" step="0.001" value={r.credit} onChange={e=>updateDraft(r.id,{credit:Number(e.target.value)})} className="w-24 rounded bg-slate-900 p-2"/></td><td className="px-2 py-2">—</td><td className="max-w-56 truncate px-3 py-2 text-slate-500" title={r.sourceLine}>{r.sourceLine||'جدول منظم'}</td></tr>)}</tbody></table></div></div>}
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><div className="rounded-xl border border-slate-800 bg-[#0A0F1D] p-4"><div className="text-xs text-slate-400">عدد الحركات</div><div className="mt-1 text-xl font-black text-white">{entries.length}</div></div><div className="rounded-xl border border-rose-500/20 bg-[#0A0F1D] p-4"><div className="text-xs text-slate-400">إجمالي المدين</div><div className="mt-1 text-xl font-black text-rose-400">{money(totals.debit)}</div></div><div className="rounded-xl border border-emerald-500/20 bg-[#0A0F1D] p-4"><div className="text-xs text-slate-400">إجمالي الدائن</div><div className="mt-1 text-xl font-black text-emerald-400">{money(totals.credit)}</div></div></div>
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0A0F1D]"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-4"><h3 className="font-bold text-white">حركات كشف الحساب ({entries.length})</h3><div className="flex gap-2"><button onClick={exportCsv} disabled={!entries.length} className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-slate-200 disabled:opacity-40"><Download className="h-4 w-4"/> تصدير CSV</button><button onClick={()=>{if(window.confirm('هل تريد حذف جميع حركات كشف الحساب؟'))persist([]);}} disabled={!entries.length} className="flex items-center gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-300 disabled:opacity-40"><Trash2 className="h-4 w-4"/> مسح الكشف</button></div></div>
      {entries.length?<div className="overflow-x-auto"><table className="w-full min-w-[650px] text-right text-xs"><thead className="bg-[#060913] text-slate-400"><tr>{['التاريخ','البيان','مدين','دائن','الرصيد','حذف'].map(h=><th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-800/70">{entries.map(r=><tr key={r.id} className="text-slate-200"><td className="px-4 py-3 font-mono">{r.date}</td><td className="px-4 py-3">{r.description}</td><td className="px-4 py-3 text-rose-300">{money(r.debit)}</td><td className="px-4 py-3 text-emerald-300">{money(r.credit)}</td><td className="px-4 py-3">{r.balance===null?'—':money(r.balance)}</td><td className="px-4 py-3"><button onClick={()=>persist(entries.filter(x=>x.id!==r.id))} title="حذف الحركة" className="text-rose-400"><Trash2 className="h-4 w-4"/></button></td></tr>)}</tbody></table></div>:<div className="p-10 text-center text-sm text-slate-500">لا توجد حركات بعد. أضف حركة أو استورد كشفاً.</div>}
    </div>
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-6 text-amber-100/80"><ScanLine className="ml-1 inline h-4 w-4 text-amber-400"/> الماسح يستخرج اقتراحات فقط ولا يعتمد الحركات تلقائياً. يجب تدقيق اتجاه المدين والدائن والأرقام قبل الاعتماد.</div>
  </section>;
};
