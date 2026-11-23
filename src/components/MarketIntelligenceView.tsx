import React, { useMemo } from 'react';
import { Activity, AlertTriangle, BarChart3, Database, TrendingDown, TrendingUp } from 'lucide-react';
import type { Stock } from '../types/stock';
import { getMarketPulse } from '../utils/marketPulse';

export const MarketIntelligenceView: React.FC<{ stocks: Stock[]; onSelectStock: (stock: Stock) => void }> = ({ stocks, onSelectStock }) => {
  const data = useMemo(() => {
    const pulses = stocks.map(stock => ({ stock, pulse: getMarketPulse(stock) }));
    const valid = pulses.filter(x => x.pulse.direction !== 'unavailable');
    const sectors = new Map<string, { count: number; up: number; down: number; flat: number }>();
    for (const { stock, pulse } of pulses) {
      const key = stock.sector || 'غير مصنف';
      const row = sectors.get(key) ?? { count: 0, up: 0, down: 0, flat: 0 };
      row.count++;
      if (pulse.direction === 'positive') row.up++;
      if (pulse.direction === 'negative') row.down++;
      if (pulse.direction === 'flat') row.flat++;
      sectors.set(key, row);
    }
    return { pulses, valid, up: valid.filter(x => x.pulse.direction === 'positive').length, down: valid.filter(x => x.pulse.direction === 'negative').length, flat: valid.filter(x => x.pulse.direction === 'flat').length, unavailable: pulses.length - valid.length, sectors: [...sectors.entries()].sort((a,b) => b[1].count-a[1].count) };
  }, [stocks]);
  return <div dir="rtl" className="space-y-5">
    <section className="rounded-2xl border border-sky-500/20 bg-gradient-to-l from-sky-500/10 to-[#0A1020] p-5"><div className="flex items-center gap-2 text-sky-300 text-xs font-bold"><Activity className="w-5 h-5"/> ذكاء السوق · Market Intelligence</div><h2 className="mt-2 text-2xl font-black text-white">قراءة شاملة لحركة السوق</h2><p className="mt-2 text-sm leading-7 text-slate-300">ملخص وصفي لحالة الأسعار المنشورة في بيانات المنصة، مع فصل الأسهم التي لا تسمح جودة بياناتها باستخلاص إشارة.</p></section>
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3"><Stat title="ارتفاع مسجل" value={data.up} icon={<TrendingUp/>} color="text-emerald-400"/><Stat title="انخفاض مسجل" value={data.down} icon={<TrendingDown/>} color="text-rose-400"/><Stat title="دون تغير" value={data.flat} icon={<BarChart3/>} color="text-slate-200"/><Stat title="بلا إشارة موثوقة" value={data.unavailable} icon={<AlertTriangle/>} color="text-amber-300"/></div>
    <section className="rounded-2xl border border-slate-800 bg-[#0A1020] p-4"><div className="flex items-center gap-2"><Database className="w-4 h-4 text-sky-300"/><h3 className="font-bold text-white">توزيع التغطية حسب القطاع</h3></div><div className="mt-3 space-y-3">{data.sectors.map(([sector, row]) => <div key={sector}><div className="mb-1 flex justify-between text-xs"><b className="text-slate-200">{sector}</b><span className="text-slate-500">{row.count} سهم · ↑ {row.up} · ↓ {row.down} · = {row.flat}</span></div><div className="flex h-2 overflow-hidden rounded-full bg-slate-800"><div className="bg-emerald-500" style={{width: `${row.count ? row.up/row.count*100 : 0}%`}}/><div className="bg-rose-500" style={{width: `${row.count ? row.down/row.count*100 : 0}%`}}/><div className="bg-slate-500" style={{width: `${row.count ? row.flat/row.count*100 : 0}%`}}/></div></div>)}</div></section>
    <section className="rounded-2xl border border-slate-800 bg-[#0A1020] p-4"><h3 className="font-bold text-white">حالة الأسهم ومصدر الإشارة</h3><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead className="text-slate-500"><tr><th className="p-2 text-right">السهم</th><th className="p-2">السعر</th><th className="p-2">التغير</th><th className="p-2">الصفقات</th><th className="p-2">القراءة</th></tr></thead><tbody>{data.pulses.map(({stock,pulse}) => <tr key={stock.symbol} className="border-t border-slate-800 cursor-pointer hover:bg-slate-800/40" onClick={() => onSelectStock(stock)}><td className="p-2"><b className="text-amber-300">{stock.symbol}</b><div className="text-xs text-slate-500">{stock.nameAr}</div></td><td className="p-2 text-center">{stock.currentPrice > 0 ? stock.currentPrice.toLocaleString('en-US') : '—'}</td><td className={`p-2 text-center ${pulse.direction === 'positive' ? 'text-emerald-400' : pulse.direction === 'negative' ? 'text-rose-400' : 'text-slate-400'}`}>{pulse.changePercent === null ? '—' : `${pulse.changePercent.toFixed(2)}%`}</td><td className="p-2 text-center">{pulse.transactionsCount}</td><td className="p-2 text-center text-xs text-slate-300" title={pulse.reason}>{pulse.label}</td></tr>)}</tbody></table></div></section>
    <p className="text-xs leading-6 text-slate-500">هذه قراءة للسجل المنشور وليست توقعاً لاتجاه السوق. لا تُعرض إشارة ارتفاع أو انخفاض عند غياب إثبات المصدر أو الجلسة أو الصفقات أو عند توقف التداول.</p>
  </div>;
};
function Stat({title,value,icon,color}:{title:string;value:number;icon:React.ReactNode;color:string}) { return <div className="rounded-xl border border-slate-800 bg-[#0A1020] p-3"><div className="flex justify-between text-slate-500"><span className="text-xs">{title}</span><span>{icon}</span></div><div className={`mt-2 text-2xl font-black ${color}`}>{value}</div></div>; }
