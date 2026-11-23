import React, { useMemo, useState } from 'react';
import { formatPrice } from '../utils/numberFormat';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Calculator, Eye, PlusCircle, Search, Activity, Minus } from 'lucide-react';
import type { Stock } from '../types/stock';
import { getMarketPulse, type MarketPulseDirection } from '../utils/marketPulse';

interface RecommendationsViewProps {
  stocks: Stock[];
  onSelectStock: (stock: Stock) => void;
  onSendToCalculator: (stock: Stock) => void;
  onAddToPortfolio: (stock: Stock) => void;
  onSetAlert: (stock: Stock) => void;
}

type FilterKey = 'ALL' | MarketPulseDirection;

export const RecommendationsView: React.FC<RecommendationsViewProps> = ({
  stocks, onSelectStock, onSendToCalculator, onAddToPortfolio, onSetAlert
}) => {
  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [sector, setSector] = useState('ALL');
  const [query, setQuery] = useState('');
  const pulses = useMemo(() => stocks.map(stock => ({ stock, pulse: getMarketPulse(stock) })), [stocks]);
  const counts = useMemo(() => ({
    all: pulses.length,
    positive: pulses.filter(x => x.pulse.direction === 'positive').length,
    negative: pulses.filter(x => x.pulse.direction === 'negative').length,
    flat: pulses.filter(x => x.pulse.direction === 'flat').length,
    unavailable: pulses.filter(x => x.pulse.direction === 'unavailable').length
  }), [pulses]);
  const sectors = useMemo(() => ['ALL', ...Array.from(new Set(stocks.map(s => s.sector).filter(Boolean)))], [stocks]);
  const visible = useMemo(() => pulses.filter(({ stock, pulse }) => {
    const q = query.trim().toLowerCase();
    return (filter === 'ALL' || pulse.direction === filter) &&
      (sector === 'ALL' || stock.sector === sector) &&
      (!q || stock.symbol.toLowerCase().includes(q) || stock.nameAr.toLowerCase().includes(q) || stock.nameEn.toLowerCase().includes(q));
  }).sort((a, b) => {
    const rank: Record<MarketPulseDirection, number> = { positive: 0, negative: 1, flat: 2, unavailable: 3 };
    return rank[a.pulse.direction] - rank[b.pulse.direction] || Math.abs(b.pulse.changePercent ?? 0) - Math.abs(a.pulse.changePercent ?? 0) || b.pulse.transactionsCount - a.pulse.transactionsCount;
  }), [pulses, filter, sector, query]);

  const filterButton = (key: FilterKey, label: string, count: number) => (
    <button key={key} onClick={() => setFilter(key)} className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${filter === key ? 'bg-amber-500/15 border-amber-400/50 text-amber-300' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'}`}>
      {label} <span className="font-mono mr-1">{count}</span>
    </button>
  );

  return (
    <div className="space-y-5" dir="rtl">
      <section className="rounded-2xl border border-amber-500/25 bg-gradient-to-l from-[#101A2E] to-[#080D18] p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-300"><Activity className="w-3.5 h-3.5"/> قراءة حركة السوق المنشورة</div>
            <h2 className="mt-3 text-xl sm:text-2xl font-black text-white">إشارات الجلسة — متابعة أولية</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">تعرض هذه الصفحة حركة السعر المنشورة بصورة مستقلة عن التوصية الفنية. ارتفاع السهم لا يعني أن توصيته متاحة؛ فقد تكون معلّقة بسبب مراجعة جودة البيانات. هذه ليست توصيات شراء أو بيع.</p>
            <p className="mt-1 text-xs text-slate-500">تاريخ الجلسة: {stocks.find(s => s.marketSessionDate)?.marketSessionDate ?? 'غير متاح'} · المصدر: {stocks.find(s => s.source)?.source ?? 'غير موثق'}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 min-w-[min(100%,420px)]">
            {[['ارتفاع',counts.positive,'text-emerald-400'],['انخفاض',counts.negative,'text-rose-400'],['دون تغير',counts.flat,'text-slate-200'],['بلا إشارة',counts.unavailable,'text-amber-300']].map(([label,value,color]) => <div key={String(label)} className="rounded-xl border border-slate-800 bg-[#050A13]/80 p-3"><span className="block text-[11px] text-slate-500">{label}</span><strong className={`text-xl font-black ${color}`}>{value}</strong></div>)}
          </div>
        </div>
      </section>

      <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {filterButton('ALL','كل الأسهم',counts.all)}
          {filterButton('positive','ارتفاع',counts.positive)}
          {filterButton('negative','انخفاض',counts.negative)}
          {filterButton('flat','دون تغير',counts.flat)}
          {filterButton('unavailable','لا توجد إشارة',counts.unavailable)}
        </div>
        <div className="flex gap-2">
          <select value={sector} onChange={e => setSector(e.target.value)} className="rounded-lg border border-slate-700 bg-[#080D1A] px-3 py-2 text-xs text-slate-200"><option value="ALL">كل القطاعات</option>{sectors.filter(s => s !== 'ALL').map(s => <option key={s} value={s}>{s}</option>)}</select>
          <div className="relative"><Search className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-slate-500"/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="ابحث عن سهم..." className="w-44 rounded-lg border border-slate-700 bg-[#080D1A] py-2 pr-8 pl-3 text-xs text-slate-200 outline-none focus:border-amber-400"/></div>
        </div>
      </div>

      {visible.length === 0 ? <div className="rounded-2xl border border-slate-800 bg-[#0B101E] p-10 text-center text-sm text-slate-400">لا توجد أسهم تطابق الفلتر الحالي.</div> :
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map(({ stock, pulse }) => {
            const badgeTone = pulse.direction === 'positive' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : pulse.direction === 'negative' ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : pulse.direction === 'flat' ? 'border-slate-700 bg-slate-800/70 text-slate-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-300';
            const border = pulse.direction === 'positive' ? 'border-emerald-500/30' : pulse.direction === 'negative' ? 'border-rose-500/30' : 'border-slate-800';
            const Icon = pulse.direction === 'positive' ? ArrowUpRight : pulse.direction === 'negative' ? ArrowDownRight : pulse.direction === 'flat' ? Minus : AlertTriangle;
            return <article key={stock.symbol} className={`rounded-2xl border ${border} bg-[#0A1020] p-4 shadow-lg`}>
              <div className="flex items-start justify-between gap-3">
                <div><div className="flex items-center gap-2"><b className="font-mono text-lg text-amber-400">{stock.symbol}</b><span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">{stock.sector}</span></div><h3 className="mt-1 text-sm font-bold text-white">{stock.nameAr}</h3><p className="text-[10px] text-slate-500">{stock.nameEn}</p></div>
                <div className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold ${badgeTone}`}><Icon className="h-3.5 w-3.5"/>{pulse.label}</div>
              </div>
              <div className="my-4 grid grid-cols-3 gap-2 rounded-xl border border-slate-800 bg-[#050811] p-3 text-center">
                <div><span className="block text-[10px] text-slate-500">السعر المنشور</span><b className="font-mono text-base text-white">{stock.currentPrice > 0 ? formatPrice(stock.currentPrice,3) : '—'}</b></div>
                <div className="border-x border-slate-800"><span className="block text-[10px] text-slate-500">التغير</span><b className={`font-mono text-base ${pulse.direction === 'positive' ? 'text-emerald-400' : pulse.direction === 'negative' ? 'text-rose-400' : 'text-slate-300'}`}>{pulse.changePercent === null ? '—' : `${pulse.changePercent > 0 ? '+' : ''}${pulse.changePercent.toFixed(2)}%`}</b></div>
                <div><span className="block text-[10px] text-slate-500">عدد الصفقات</span><b className="font-mono text-base text-white">{pulse.transactionsCount || '—'}</b></div>
              </div>
              <div className="min-h-[58px] rounded-lg border border-slate-800/80 bg-slate-900/60 p-3 text-xs leading-6 text-slate-300"><b className="text-amber-300">قراءة البيانات: </b>{pulse.reason}</div>
              {/* MARKET_SIGNAL_SEPARATION_V1: movement, quality and recommendation are independent. */}
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2">
                  <span className="text-slate-500">جودة البيانات: </span>
                  <b className={stock.dataQuality?.level === 'high' ? 'text-emerald-400' : stock.dataQuality?.level === 'partial' ? 'text-amber-300' : 'text-rose-400'}>
                    {stock.dataQuality ? `${stock.dataQuality.levelLabel} (${stock.dataQuality.score}/100)` : 'غير محسوبة'}
                  </b>
                  {stock.dataQuality?.reasons[0] && stock.dataQuality.level !== 'high' && (
                    <span className="mt-1 block text-[10px] text-slate-400">{stock.dataQuality.reasons[0].title}: {stock.dataQuality.reasons[0].detail}</span>
                  )}
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2">
                  <span className="text-slate-500">التوصية الفنية: </span>
                  <b className={stock.recommendationGate?.allowed ? 'text-emerald-400' : 'text-amber-300'}>
                    {stock.recommendationGate?.summary ?? 'غير محسوبة'}
                  </b>
                  {!stock.recommendationGate?.allowed && stock.recommendationGate?.primaryReason && (
                    <span className="mt-1 block text-[10px] text-slate-400">{stock.recommendationGate.primaryReason.detail}{stock.recommendationGate.primaryReason.action ? ` ← ${stock.recommendationGate.primaryReason.action}` : ''}</span>
                  )}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500"><span>المؤشرات الفنية لا تغيّر تصنيف حركة السعر</span><span>لا توجد أهداف سعرية مولدة</span></div>
              <div className="mt-4 flex gap-2 border-t border-slate-800 pt-3">
                <button onClick={() => onSelectStock(stock)} className="flex-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/20"><Eye className="ml-1 inline h-3.5 w-3.5"/>تفاصيل السهم</button>
                <button onClick={() => onSendToCalculator(stock)} title="حاسبة العمولة" className="rounded-lg bg-slate-800 p-2 text-slate-300 hover:text-white"><Calculator className="h-4 w-4"/></button>
                <button onClick={() => onAddToPortfolio(stock)} title="إضافة للمحفظة" className="rounded-lg bg-slate-800 p-2 text-emerald-400"><PlusCircle className="h-4 w-4"/></button>
                <button onClick={() => onSetAlert(stock)} title="تنبيه سعري" className="rounded-lg bg-slate-800 p-2 text-slate-300"><AlertTriangle className="h-4 w-4"/></button>
              </div>
            </article>;
          })}
        </div>
      }
    </div>
  );
};
