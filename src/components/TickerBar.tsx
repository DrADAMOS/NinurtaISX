import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Stock } from '../types/stock';

interface TickerBarProps {
  stocks: Stock[];
  onSelectStock: (stock: Stock) => void;
}

export const TickerBar: React.FC<TickerBarProps> = ({ stocks, onSelectStock }) => {
  // Take the most active 25 stocks for the ticker
  const tickerStocks = stocks.slice(0, 25);
  // Duplicate for seamless infinite loop
  const displayList = [...tickerStocks, ...tickerStocks];

  return (
    <div className="relative bg-[#050912] border-b border-slate-800/80 overflow-hidden py-1.5 select-none">
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#050912] to-transparent z-10 pointer-events-none" />
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#050912] to-transparent z-10 pointer-events-none" />

      <div className="animate-ticker flex items-center gap-6 cursor-pointer">
        {displayList.map((stock, idx) => {
          const isUp = stock.changePercent >= 0;
          return (
            <div
              key={`${stock.symbol}-${idx}`}
              onClick={() => onSelectStock(stock)}
              className="flex items-center gap-2 hover:bg-slate-800/40 px-2 py-0.5 rounded transition-colors group"
            >
              <span className="font-mono-numbers text-xs font-bold text-slate-200 group-hover:text-amber-400">
                {stock.symbol}
              </span>
              <span className="font-mono-numbers text-xs text-slate-100">
                {stock.currentPrice > 0 ? stock.currentPrice.toFixed(3) : '—'}
              </span>
              <span
                className={`flex items-center text-[11px] font-mono-numbers font-medium ${
                  isUp ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isUp ? (
                  <TrendingUp className="w-3 h-3 ml-0.5 inline" />
                ) : (
                  <TrendingDown className="w-3 h-3 ml-0.5 inline" />
                )}
                {stock.currentPrice <= 0 ? 'السعر غير متاح' : stock.quoteStatus === 'no_trade' ? 'لم يتداول' : stock.quoteStatus === 'suspended' ? 'موقوف' : `${isUp ? '+' : ''}${stock.changePercent.toFixed(2)}%`}
              </span>
              <span className="text-[10px] text-slate-600 mr-2">•</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
