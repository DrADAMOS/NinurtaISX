import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  Flame, 
  Activity, 
  BarChart2, 
  ArrowUpRight, 
  ArrowDownRight 
} from 'lucide-react';
import { Stock } from '../types/stock';

interface TopMoversViewProps {
  stocks: Stock[];
  onSelectStock: (stock: Stock) => void;
  onSendToCalculator: (stock: Stock) => void;
}

export const TopMoversView: React.FC<TopMoversViewProps> = ({
  stocks,
  onSelectStock,
  onSendToCalculator
}) => {
  // Top Gainers
  const topGainers = [...stocks]
    .filter(s => s.currentPrice > 0 && s.changePercent > 0)
    .sort((a, b) => b.changePercent - a.changePercent)
    .slice(0, 6);

  // Top Losers
  const topLosers = [...stocks]
    .filter(s => s.currentPrice > 0 && s.changePercent < 0)
    .sort((a, b) => a.changePercent - b.changePercent)
    .slice(0, 6);

  // Top Volume / Traded Value
  const topLiquid = [...stocks]
    .filter(s => s.currentPrice > 0)
    .sort((a, b) => b.tradedValue - a.tradedValue)
    .slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0C1322] via-[#101A2E] to-[#0A0F1D] border border-amber-500/20 rounded-2xl p-5 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-semibold mb-2">
              <Zap className="w-3.5 h-3.5" />
              <span>متابعة تغيرات الجلسة المنشورة</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              الأسهم الأكثر حركة ونشاطاً وسيولة
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl mt-1 leading-relaxed">
              عرض لنسب التغير المنشورة في المصدر العام. لا يمثل بثاً لحظياً أو إشارة تداول.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-[#070B14] border border-emerald-500/30 rounded-xl p-3 text-center min-w-[100px]">
              <span className="text-[10px] text-emerald-400 block">أسهم رابحة</span>
              <span className="text-lg font-black text-emerald-400 font-mono-numbers">
                {stocks.filter(s => s.currentPrice > 0 && s.changePercent > 0).length}
              </span>
            </div>
            <div className="bg-[#070B14] border border-rose-500/30 rounded-xl p-3 text-center min-w-[100px]">
              <span className="text-[10px] text-rose-400 block">أسهم خاسرة</span>
              <span className="text-lg font-black text-rose-400 font-mono-numbers">
                {stocks.filter(s => s.currentPrice > 0 && s.changePercent < 0).length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3 Columns: Gainers, Losers, Liquidity */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Top Gainers */}
        <div className="bg-[#0A0F1D] border border-emerald-500/30 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              الأكثر ارتفاعاً اليوم
            </h3>
            <span className="text-[10px] text-emerald-400 font-mono-numbers bg-emerald-500/10 px-2 py-0.5 rounded">
              Top Gainers
            </span>
          </div>

          <div className="space-y-2">
            {topGainers.map((stock) => (
              <div
                key={stock.symbol}
                onClick={() => onSelectStock(stock)}
                className="p-2.5 rounded-xl bg-[#070B14] border border-slate-800/80 hover:border-emerald-500/40 hover:bg-emerald-950/20 transition-all flex items-center justify-between cursor-pointer group"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono-numbers font-bold text-amber-400 group-hover:text-amber-300">
                      {stock.symbol}
                    </span>
                    <span className="text-xs text-white">{stock.nameAr}</span>
                  </div>
                  <span className="text-[10px] text-slate-500">{stock.sector}</span>
                </div>

                <div className="text-left font-mono-numbers">
                  <div className="text-xs font-bold text-white">{stock.currentPrice > 0 ? stock.currentPrice.toFixed(3) : '—'}</div>
                  <div className="text-xs font-bold text-emerald-400 flex items-center justify-end">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    +{stock.changePercent.toFixed(2)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Losers */}
        <div className="bg-[#0A0F1D] border border-rose-500/30 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-rose-400" />
              الأكثر انخفاضاً (فرص ارتداد)
            </h3>
            <span className="text-[10px] text-rose-400 font-mono-numbers bg-rose-500/10 px-2 py-0.5 rounded">
              Top Losers
            </span>
          </div>

          <div className="space-y-2">
            {topLosers.map((stock) => (
              <div
                key={stock.symbol}
                onClick={() => onSelectStock(stock)}
                className="p-2.5 rounded-xl bg-[#070B14] border border-slate-800/80 hover:border-rose-500/40 hover:bg-rose-950/20 transition-all flex items-center justify-between cursor-pointer group"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono-numbers font-bold text-amber-400 group-hover:text-amber-300">
                      {stock.symbol}
                    </span>
                    <span className="text-xs text-white">{stock.nameAr}</span>
                  </div>
                  <span className="text-[10px] text-slate-500">{stock.sector}</span>
                </div>

                <div className="text-left font-mono-numbers">
                  <div className="text-xs font-bold text-white">{stock.currentPrice > 0 ? stock.currentPrice.toFixed(3) : '—'}</div>
                  <div className="text-xs font-bold text-rose-400 flex items-center justify-end">
                    <ArrowDownRight className="w-3.5 h-3.5" />
                    {stock.changePercent.toFixed(2)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Most Liquid */}
        <div className="bg-[#0A0F1D] border border-amber-500/30 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-400" />
              الأعلى سيولة وقيمة تداول
            </h3>
            <span className="text-[10px] text-amber-400 font-mono-numbers bg-amber-500/10 px-2 py-0.5 rounded">
              Most Active
            </span>
          </div>

          <div className="space-y-2">
            {topLiquid.map((stock) => (
              <div
                key={stock.symbol}
                onClick={() => onSelectStock(stock)}
                className="p-2.5 rounded-xl bg-[#070B14] border border-slate-800/80 hover:border-amber-500/40 hover:bg-amber-950/20 transition-all flex items-center justify-between cursor-pointer group"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono-numbers font-bold text-amber-400 group-hover:text-amber-300">
                      {stock.symbol}
                    </span>
                    <span className="text-xs text-white">{stock.nameAr}</span>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {stock.transactionsCount.toLocaleString('en-US')} صفقة
                  </span>
                </div>

                <div className="text-left font-mono-numbers">
                  <div className="text-xs font-bold text-amber-300">
                    {(stock.tradedValue / 1000000).toFixed(1)}M د.ع
                  </div>
                  <div className={`text-[11px] font-bold ${stock.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
