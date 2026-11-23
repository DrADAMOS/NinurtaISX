import React, { useMemo } from 'react';
import { BrainCircuit, ShieldAlert, TrendingDown, TrendingUp, Wallet, Info } from 'lucide-react';
import type { PortfolioPosition, Stock } from '../types/stock';
import { getMarketPulse } from '../utils/marketPulse';

interface Props { stocks: Stock[]; positions: PortfolioPosition[]; onOpenPortfolio: () => void; onOpenMarket: () => void; }
const money = (v: number) => new Intl.NumberFormat('ar-IQ', { maximumFractionDigits: 2 }).format(v) + ' د.ع';

export const InvestorIntelligenceView: React.FC<Props> = ({ stocks, positions, onOpenPortfolio, onOpenMarket }) => {
  const analysis = useMemo(() => {
    const bySymbol = new Map(stocks.map(s => [s.symbol, s]));
    const rows = positions.map(p => {
      const stock = bySymbol.get(p.symbol);
      const cost = p.shares * p.averageBuyPrice;
      const value = stock && stock.currentPrice > 0 ? p.shares * stock.currentPrice : null;
      const pnl = value === null ? null : value - cost;
      return { ...p, stock, cost, value, pnl, pct: pnl === null || cost <= 0 ? null : pnl / cost * 100 };
    });
    const totalCost = rows.reduce((a, r) => a + r.cost, 0);
    const valued = rows.filter(r => r.value !== null);
    const totalValue = valued.reduce((a, r) => a + (r.value ?? 0), 0);
    const totalPnl = valued.reduce((a, r) => a + (r.pnl ?? 0), 0);
    const missing = rows.length - valued.length;
    const top = [...stocks].filter(s => s.dataQualityStatus === 'verified').sort((a,b) => b.investmentScore-a.investmentScore).slice(0,5);
    const positive = stocks.filter(s => getMarketPulse(s).direction === 'positive').length;
    const negative = stocks.filter(s => getMarketPulse(s).direction === 'negative').length;
    return { rows, totalCost, totalValue, totalPnl, missing, top, positive, negative };
  }, [stocks, positions]);

  return <div dir="rtl" className="space-y-5">
    <section className="rounded-2xl border border-amber-500/25 bg-gradient-to-l from-amber-500/10 via-[#0A1222] to-[#080D1A] p-5">
      <div className="flex items-center gap-2 text-amber-300 text-xs font-bold"><BrainCircuit className="w-5 h-5"/> ذكاء المستثمر · Investor Intelligence</div>
      <h2 className="mt-2 text-2xl font-black text-white">لوحة فهم الاستثمار</h2>
      <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">تحليل وصفي لمحفظتك وبيانات الأسهم المتاحة في المنصة. لا يصدر هذا القسم أوامر شراء أو بيع، ولا يحوّل المؤشرات الحسابية إلى ضمانات أو توقعات.</p>
    </section>
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      <Metric title="تكلفة المراكز المسجلة" value={money(analysis.totalCost)} icon={<Wallet/>}/>
      <Metric title="القيمة السوقية المتاحة" value={money(analysis.totalValue)} icon={<TrendingUp/>}/>
      <Metric title="الربح / الخسارة غير المحققة" value={money(analysis.totalPnl)} tone={analysis.totalPnl >= 0 ? 'up' : 'down'} icon={analysis.totalPnl >= 0 ? <TrendingUp/> : <TrendingDown/>}/>
      <Metric title="مراكز بلا سعر قابل للتقييم" value={String(analysis.missing)} icon={<ShieldAlert/>}/>
    </div>
    <section className="rounded-2xl border border-slate-800 bg-[#0A1020] p-4">
      <h3 className="font-bold text-white">قراءة المحفظة</h3>
      {positions.length === 0 ? <p className="mt-3 text-sm text-slate-400">لا توجد مراكز مسجلة حالياً. أضف مراكزك من صفحة محفظة المستثمر لعرض التكلفة والقيمة والنتيجة غير المحققة.</p> : <>
        <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[650px] text-sm"><thead className="text-slate-500"><tr><th className="p-2 text-right">السهم</th><th className="p-2">الكمية</th><th className="p-2">متوسط الشراء</th><th className="p-2">السعر المتاح</th><th className="p-2">النتيجة</th></tr></thead><tbody>{analysis.rows.map(r => <tr key={r.id} className="border-t border-slate-800"><td className="p-2"><b className="text-amber-300">{r.symbol}</b><div className="text-xs text-slate-500">{r.stock?.nameAr ?? 'السهم غير موجود في الدليل الحالي'}</div></td><td className="p-2 text-center">{r.shares.toLocaleString('en-US')}</td><td className="p-2 text-center">{money(r.averageBuyPrice)}</td><td className="p-2 text-center">{r.stock ? money(r.stock.currentPrice) : 'غير متاح'}</td><td className={`p-2 text-center font-bold ${r.pnl === null ? 'text-slate-500' : r.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{r.pnl === null ? 'غير قابل للحساب' : money(r.pnl)}</td></tr>)}</tbody></table></div>
        <p className="mt-3 text-xs text-slate-500">القيمة والنتيجة تقديريتان قبل العمولات والرسوم والضرائب. المراكز التي لا يتوفر لها سعر حالي مستبعدة من إجمالي القيمة.</p>
      </>}
    </section>
    <section className="rounded-2xl border border-slate-800 bg-[#0A1020] p-4">
      <h3 className="font-bold text-white">أسهم ذات درجات استثمارية أعلى في البيانات المتاحة</h3>
      <p className="mt-1 text-xs text-slate-500">عرض لأعلى الدرجات الرقمية للأسهم الموسومة بأن بياناتها موثقة فقط؛ الدرجة ليست احتمال ربح ولا توصية مستقلة.</p>
      <div className="mt-3 grid sm:grid-cols-2 xl:grid-cols-5 gap-2">{analysis.top.map(s => <div key={s.symbol} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><div className="flex justify-between gap-2"><b className="text-amber-300">{s.symbol}</b><b className="text-white">{s.investmentScore}/100</b></div><div className="mt-1 text-xs text-slate-400">{s.nameAr}</div><div className="mt-2 text-[11px] text-slate-500">{s.riskLevel} · {s.timeHorizon}</div></div>)}</div>
      {analysis.top.length === 0 && <p className="mt-3 text-sm text-slate-400">لا توجد أسهم موثقة كفاية لعرض هذه المقارنة.</p>}
    </section>
    <section className="rounded-2xl border border-amber-500/15 bg-amber-500/5 p-4 flex gap-3"><Info className="w-5 h-5 shrink-0 text-amber-300"/><p className="text-xs leading-6 text-amber-100">ملاحظة منهجية: إشارات ارتفاع وانخفاض السوق تُحسب فقط عندما تتوفر بيانات جلسة ومصدر وسجل صفقات صالح. قد تختلف تغطية الأسعار بين الأسهم؛ راجع تاريخ الجلسة وجودة البيانات قبل اتخاذ أي قرار.</p></section>
    <div className="flex flex-wrap gap-2"><button onClick={onOpenPortfolio} className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950">إدارة المحفظة</button><button onClick={onOpenMarket} className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-bold text-slate-200">تحليل السوق</button></div>
  </div>;
};
function Metric({ title, value, icon, tone }: { title: string; value: string; icon: React.ReactNode; tone?: 'up'|'down' }) { return <div className="rounded-xl border border-slate-800 bg-[#0A1020] p-3"><div className="flex items-center justify-between text-slate-500"> <span className="text-xs">{title}</span><span className="text-amber-300">{icon}</span></div><div className={`mt-2 text-lg font-black ${tone === 'up' ? 'text-emerald-400' : tone === 'down' ? 'text-rose-400' : 'text-white'}`}>{value}</div></div>; }
