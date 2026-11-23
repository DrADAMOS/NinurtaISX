import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Landmark, ShieldCheck, TrendingUp, AlertTriangle, FileCheck2, Info, Search } from 'lucide-react';
import type { Stock } from '../types/stock';
import { BANK_FINANCIAL_SNAPSHOTS } from '../data/bankFinancials';
import { calculateBankAssessment, BANK_SCORE_WEIGHTS, type BankFinancialSnapshot } from '../utils/bankScoring';
import { makeBankImportTemplate, mergeBankFinancialSnapshots, parseBankFinancialImport } from '../utils/bankImport';

interface BankAnalyticsViewProps {
  stocks: Stock[];
  onSelectStock: (stock: Stock) => void;
  onSendToCalculator: (stock: Stock) => void;
}

const fmt = (v:number|null, suffix='') => v===null ? 'غير متاح' : `${v}${suffix}`;

export const BankAnalyticsView: React.FC<BankAnalyticsViewProps> = ({stocks,onSelectStock,onSendToCalculator}) => {
  const [query,setQuery]=useState('');
  const [importedSnapshots,setImportedSnapshots]=useState<BankFinancialSnapshot[]>(()=>{
    try {
      const saved=localStorage.getItem('ninurta.bankFinancialSnapshots.v1');
      return saved ? parseBankFinancialImport(JSON.parse(saved)).snapshots : [];
    } catch { return []; }
  });
  const [importMessage,setImportMessage]=useState('');
  const fileInputRef=useRef<HTMLInputElement>(null);
  useEffect(()=>{
    try { localStorage.setItem('ninurta.bankFinancialSnapshots.v1',JSON.stringify(importedSnapshots)); }
    catch { setImportMessage('تعذر حفظ البيانات محلياً؛ قد تكون مساحة تخزين المتصفح ممتلئة.'); }
  },[importedSnapshots]);
  const handleFinancialImport=async(event:React.ChangeEvent<HTMLInputElement>)=>{
    const file=event.target.files?.[0];
    if(!file) return;
    try {
      const parsed=parseBankFinancialImport(JSON.parse(await file.text()));
      if(parsed.snapshots.length===0) throw new Error('لم نعثر على سجل مصرفي واحد صالح. تأكد من وجود مصادر وتواريخ وروابط HTTPS لكل مؤشر.');
      const merged = mergeBankFinancialSnapshots(importedSnapshots, parsed.snapshots);
      setImportedSnapshots(merged.snapshots);
      setImportMessage(`تم دمج ${parsed.snapshots.length} مصرف. إجمالي السجلات المحفوظة: ${merged.snapshots.length}. تم تجاهل ${parsed.ignoredMetrics} مؤشراً غير موثق أو بتاريخ يتجاوز التقرير، ورفض ${parsed.rejected.length} سجلاً، مع ${merged.conflicts.length} تعارض تاريخي احتُفظ فيه بالبيانات السابقة.`);
    } catch(error) {
      setImportMessage(error instanceof Error ? error.message : 'تعذر قراءة ملف البيانات.');
    } finally { event.target.value=''; }
  };
  const downloadImportTemplate=()=>{
    const template=makeBankImportTemplate(bankDirectory.map(({stock})=>({symbol:stock.symbol,name:stock.nameAr})));
    const blob=new Blob([JSON.stringify(template,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement('a'); anchor.href=url; anchor.download='Ninurta-Bank-Financial-Import-Template.json'; anchor.click();
    URL.revokeObjectURL(url);
  };
  const bankDirectory = useMemo(()=>{
    // The current market dataset labels many companies with sector='عام'.
    // Identify banks from the official Arabic company name as well as sector.
    const source=stocks.filter(s =>
      /مصرف|المصرف|بنك|البنك/.test(`${s.nameAr} ${s.nameEn} ${s.sector}`)
    );
    return source.map(s=>({stock:s,assessment:calculateBankAssessment(importedSnapshots.find(x=>x.symbol===s.symbol) || BANK_FINANCIAL_SNAPSHOTS.find(x=>x.symbol===s.symbol) || {symbol:s.symbol,reportPeriod:'',reportDate:'',audited:false,metrics:{}})}))
      .filter(x=>`${x.stock.symbol} ${x.stock.nameAr}`.toLowerCase().includes(query.toLowerCase()))
      .sort((a,b)=>(b.assessment.fundamentalScore ?? -1)-(a.assessment.fundamentalScore ?? -1));
  },[stocks,query,importedSnapshots]);
  const ranked=bankDirectory.filter(x=>x.assessment.eligible);
  const avgCoverage=bankDirectory.length?Math.round(bankDirectory.reduce((s,x)=>s+x.assessment.coverage,0)/bankDirectory.length):0;
  return <div className="space-y-5" dir="rtl">
    <section className="rounded-2xl border border-amber-500/25 bg-gradient-to-l from-[#101A2E] to-[#080D18] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-300"><Landmark className="h-4 w-4"/> ذكاء القطاع المصرفي</div>
          <h2 className="text-xl sm:text-2xl font-black text-white">تقييم وترتيب المصارف العراقية</h2>
          <p className="mt-2 text-sm leading-7 text-slate-300">محرك مستقل للاستثمار طويل الأجل، يفصل جودة المصرف عن توقيت التداول. لا تُحتسب درجة إلا من مؤشرات مالية موثقة بمصدر وتاريخ لكل رقم.</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-[#070B14] p-3 min-w-36">
          <span className="block text-xs text-slate-400">مصارف اجتازت التحقق</span>
          <strong className="font-mono text-2xl text-emerald-400">{ranked.length} / {bankDirectory.length}</strong>
        </div>
      </div>
    </section>

    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="rounded-xl border border-slate-800 bg-[#0A0F1D] p-4"><span className="text-xs text-slate-400">المصارف في القائمة الحالية</span><div className="mt-1 text-2xl font-black text-white">{bankDirectory.length}</div></div>
      <div className="rounded-xl border border-slate-800 bg-[#0A0F1D] p-4"><span className="text-xs text-slate-400">متوسط اكتمال البيانات</span><div className="mt-1 text-2xl font-black text-amber-300">{avgCoverage}%</div></div>
      <div className="rounded-xl border border-slate-800 bg-[#0A0F1D] p-4"><span className="text-xs text-slate-400">أوزان التقييم</span><div className="mt-1 text-2xl font-black text-sky-300">100 نقطة</div></div>
    </div>

    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-7 text-amber-100">
      <div className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4"/> تنبيه نزاهة البيانات</div>
      <p className="mt-1">لا توجد حالياً بيانات مالية موثقة مستوردة لكل مصرف. قائمة المصارف تُبنى من دليل الأسهم المحلي، وقد لا تطابق عدد المصارف المنشورة لدى الجهات الرقابية ما لم تتم مطابقة الرموز يدوياً. لا تستخدم بيانات القطاع كبديل عن بيانات مصرف بعينه.</p>
    </div>


    <section className="rounded-2xl border border-slate-800 bg-[#0A0F1D] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="font-black text-white">استيراد القوائم المالية الموثقة</h3><p className="mt-1 text-xs leading-6 text-slate-400">استورد ملف JSON موحداً للمصارف. تُحفظ البيانات في هذا المتصفح فقط، ولا تُرفع إلى أي خادم.</p></div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={handleFinancialImport} className="hidden" />
          <button onClick={()=>fileInputRef.current?.click()} className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-500/20">استيراد بيانات JSON</button>
          <button onClick={downloadImportTemplate} className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/20">تنزيل قالب المصارف</button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400"><span>السجلات المحفوظة: <b className="text-amber-300">{importedSnapshots.length}</b></span><span>المصارف الظاهرة: <b className="text-slate-200">{bankDirectory.length}</b></span></div>
      {importMessage && <p role="status" className="mt-3 rounded-lg border border-slate-700 bg-[#070B14] p-3 text-xs leading-6 text-sky-200">{importMessage}</p>}
    </section>

    <section className="rounded-2xl border border-slate-800 bg-[#0A0F1D] p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><h3 className="font-black text-white">أوزان Fundamental Score</h3><p className="text-xs text-slate-500 mt-1">الأوزان المعتمدة في الإصدار الأول</p></div>
        <div className="relative"><Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-500"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ابحث عن مصرف أو رمز..." className="w-full sm:w-64 rounded-lg border border-slate-700 bg-[#070B14] py-2 pr-9 pl-3 text-xs text-slate-200 outline-none focus:border-amber-400"/></div>
      </div>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {BANK_SCORE_WEIGHTS.map(g=><div key={g.key} className="rounded-lg border border-slate-800 bg-[#070B14] p-3"><div className="flex justify-between gap-2 text-xs"><span className="text-slate-300">{g.label}</span><b className="text-amber-300">{g.weight}%</b></div><div className="mt-2 h-1.5 rounded-full bg-slate-800 overflow-hidden"><div className="h-full rounded-full bg-amber-500" style={{width:`${g.weight*4}%`}}/></div></div>)}
      </div>
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0A0F1D]">
      <div className="flex items-center justify-between border-b border-slate-800 p-4"><h3 className="flex items-center gap-2 text-sm font-bold text-white"><FileCheck2 className="h-4 w-4 text-amber-400"/> ترتيب المصارف</h3><span className="text-[11px] text-slate-500">الترتيب لا يظهر إلا بعد التحقق</span></div>
      {bankDirectory.length===0 ? <div className="p-10 text-center text-sm text-slate-400">لا توجد بيانات مصرفية كافية في دليل الشركات الحالي.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-right text-xs"><thead className="bg-[#070B14] text-slate-400"><tr><th className="p-3">المصرف</th><th className="p-3">التقييم الأساسي</th><th className="p-3">المخاطر</th><th className="p-3">اكتمال البيانات</th><th className="p-3">الثقة</th><th className="p-3">الحالة</th><th className="p-3">إجراء</th></tr></thead><tbody className="divide-y divide-slate-800/70">{bankDirectory.map(({stock,assessment})=><tr key={stock.symbol} className="hover:bg-slate-800/30"><td className="p-3"><b className="text-amber-400 font-mono">{stock.symbol}</b><div className="mt-1 text-slate-200">{stock.nameAr}</div></td><td className="p-3 font-mono font-bold text-white">{fmt(assessment.fundamentalScore,' / 100')}</td><td className="p-3 font-mono">{fmt(assessment.riskScore,' / 100')}</td><td className="p-3"><div className="font-mono">{assessment.coverage}%</div><div className="mt-1 h-1 w-24 rounded bg-slate-800"><div className="h-1 rounded bg-sky-500" style={{width:`${assessment.coverage}%`}}/></div></td><td className="p-3 font-mono">{assessment.confidence}%</td><td className="p-3"><span className={`rounded-md border px-2 py-1 ${assessment.eligible?'border-emerald-500/30 bg-emerald-500/10 text-emerald-300':'border-amber-500/30 bg-amber-500/10 text-amber-200'}`}>{assessment.eligible?'مؤهل للتقييم':'بيانات قيد الاستكمال'}</span><div className="mt-1 max-w-56 text-[10px] leading-5 text-slate-500">{assessment.reason}</div></td><td className="p-3"><div className="flex flex-wrap gap-1.5"><button onClick={()=>onSelectStock(stock)} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 hover:border-amber-500">تفاصيل السهم</button><button onClick={()=>onSendToCalculator(stock)} className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 hover:bg-amber-500/20">حاسبة الصفقة</button></div></td></tr>)}</tbody></table></div>}
    </section>
    <section className="rounded-2xl border border-slate-800 bg-[#0A0F1D] p-4">
      <h3 className="flex items-center gap-2 font-bold text-white"><ShieldCheck className="h-4 w-4 text-emerald-400"/> شروط السماح بالترتيب</h3>
      <ul className="mt-2 list-disc space-y-1 pr-5 text-xs leading-6 text-slate-400">
        <li>كل مؤشر مالي يجب أن يحمل قيمة ومصدر URL وتاريخاً.</li>
        <li>تُطلب بيانات جودة الأصول والربحية ورأس المال والتقييم كحد أدنى.</li>
        <li>يجب أن تبلغ تغطية البيانات 80% على الأقل وأن تكون القوائم مدققة.</li>
        <li>غياب المعلومة لا يُفسر على أنه صفر أو نجاح أو مخالفة.</li>
        <li>درجة المخاطر منفصلة عن الدرجة الاستثمارية؛ الدرجة الأعلى للمخاطر تعني مخاطر أكبر.</li>
      </ul>
      <p className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-slate-500"><Info className="mt-0.5 h-4 w-4 shrink-0"/>تُحتسب الدرجات فقط للبيانات المستوردة التي تحمل مصدراً وتاريخاً ورابطاً موثقاً. بيانات الاستيراد محفوظة محلياً في هذا المتصفح، ولا تصدر الصفحة توصية شراء أو بيع.</p>
    </section>
  </div>;
};
