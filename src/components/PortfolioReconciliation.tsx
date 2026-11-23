import React, { useMemo, useState } from 'react';
import { AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react';
import type { PortfolioPosition } from '../types/stock';
import type { RabeeTrade } from '../utils/rabeeStatement';
import { reconcilePortfolio } from '../utils/portfolioReconciliation';

const KEY = 'ninurta_isx_rabee_trades_v1';
const number = (n:number) => new Intl.NumberFormat('en-US',{maximumFractionDigits:3}).format(n);
const labels = { matched:'متطابق', quantity_mismatch:'اختلاف كمية', oversold:'بيع يتجاوز المملوك', review_required:'يتطلب مراجعة', no_broker_trades:'لا توجد عقود وسيط' } as const;
export const PortfolioReconciliation: React.FC<{positions:PortfolioPosition[]}> = ({positions}) => {
 const [refresh,setRefresh] = useState(0);
 const result = useMemo(()=>{ let trades: RabeeTrade[]=[]; try { const raw=localStorage.getItem(KEY); const parsed=raw?JSON.parse(raw):[]; if(Array.isArray(parsed)) trades=parsed; } catch {} return reconcilePortfolio(positions,trades); },[positions,refresh]);
 const issues=result.rows.filter(r=>r.status!=='matched');
 return <section className="space-y-3 rounded-2xl border border-cyan-500/25 bg-[#0A111D] p-4" dir="rtl">
  <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-cyan-300"/><div><h3 className="font-black text-white">مطابقة المحفظة مع سجل الوسيط</h3><p className="text-[11px] text-slate-400">مقارنة قراءة فقط — لا تعدّل الأرصدة أو الصفقات تلقائياً</p></div></div><button onClick={()=>setRefresh(v=>v+1)} className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-2 text-xs text-white"><RefreshCw className="h-3.5 w-3.5"/> تحديث المطابقة</button></div>
  <div className="grid gap-2 sm:grid-cols-4">{[['إجمالي شراء',result.totalBuyGross],['إجمالي بيع',result.totalSellGross],['العمولات',result.totalCommission],['العقود',result.rows.reduce((s,r)=>s+r.contracts,0)]].map(([label,value])=><div key={String(label)} className="rounded-lg bg-slate-900 p-3"><p className="text-[11px] text-slate-400">{label}</p><strong className="text-sm text-white">{typeof value==='number'?number(value):value}</strong></div>)}</div>
  {result.duplicateContracts.length>0&&<p className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-rose-200"><AlertTriangle className="ml-1 inline h-4 w-4"/> عقود مكررة: {result.duplicateContracts.join('، ')}</p>}
  {result.reviewContracts.length>0&&<p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-200">عقود تحتاج مراجعة: {result.reviewContracts.length}</p>}
  {result.rows.length===0?<p className="rounded-lg bg-slate-900 p-4 text-center text-xs text-slate-400">لا توجد مراكز أو عقود وسيط للمطابقة حالياً. احفظ كشف Rabee أولاً.</p>:<div className="overflow-x-auto"><table className="w-full min-w-[700px] text-right text-xs"><thead className="bg-slate-900 text-slate-400"><tr>{['الرمز','كمية سجل الوسيط','كمية المحفظة','الفرق','متوسط شراء الوسيط','نتيجة المطابقة'].map(x=><th key={x} className="px-3 py-2">{x}</th>)}</tr></thead><tbody>{result.rows.map(r=><tr key={r.symbol} className="border-t border-slate-800 text-slate-200"><td className="px-3 py-2 font-bold text-amber-300">{r.symbol}</td><td className="px-3 py-2">{number(r.brokerShares)}</td><td className="px-3 py-2">{number(r.portfolioShares)}</td><td className={`px-3 py-2 ${r.difference===0?'text-emerald-300':'text-amber-300'}`}>{number(r.difference)}</td><td className="px-3 py-2">{r.brokerAverageBuyPrice===null?'—':number(r.brokerAverageBuyPrice)}</td><td className="px-3 py-2">{labels[r.status]}</td></tr>)}</tbody></table></div>}
  <p className="text-[11px] leading-5 text-slate-500">النتيجة تعتمد على العقود المحفوظة في Rabee وعلى المراكز اليدوية الحالية. العقود المكررة وغير المكتملة مستبعدة من حساب الكميات. لا تُجرى أي تسوية تلقائية.</p>
  {issues.length===0&&result.rows.length>0&&<p className="text-xs text-emerald-300">كل الرموز التي تمت مطابقتها متوافقة من حيث الكمية.</p>}
 </section>;
};
