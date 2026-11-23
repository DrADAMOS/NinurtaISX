import React, { useState, useMemo } from 'react';
import { formatPrice, formatPercent, formatCompact } from '../utils/numberFormat';
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  TrendingUp, 
  TrendingDown, 
  Calculator, 
  Eye, 
  PlusCircle, 
  Award, 
  CheckCircle2, 
  Zap, 
  Clock, 
  AlertTriangle 
} from 'lucide-react';
import { Stock, RecommendationCategory } from '../types/stock';

interface MarketDirectoryProps {
  stocks: Stock[];
  onSelectStock: (stock: Stock) => void;
  onSendToCalculator: (stock: Stock) => void;
  onAddToPortfolio: (stock: Stock) => void;
}

export const MarketDirectory: React.FC<MarketDirectoryProps> = ({
  stocks,
  onSelectStock,
  onSendToCalculator,
  onAddToPortfolio
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [sortField, setSortField] = useState<keyof Stock>('tradedValue');
  const [sortAsc, setSortAsc] = useState(false);

  const sectors = useMemo(() => {
    return ['ALL', ...Array.from(new Set(stocks.map(s => s.sector))).filter(Boolean)];
  }, [stocks]);

  const handleSort = (field: keyof Stock) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const filteredStocks = useMemo(() => {
    return stocks
      .filter((s) => {
        const matchesSector = selectedSector === 'ALL' || s.sector === selectedSector;
        const matchesCategory = selectedCategory === 'ALL' || s.recommendationCategory === selectedCategory;
        const q = searchQuery.toLowerCase().trim();
        const matchesQuery =
          !q ||
          s.symbol.toLowerCase().includes(q) ||
          s.nameAr.toLowerCase().includes(q) ||
          s.nameEn.toLowerCase().includes(q);

        return matchesSector && matchesCategory && matchesQuery;
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];
        if (typeof valA === 'string') {
          return sortAsc
            ? (valA as string).localeCompare(valB as string)
            : (valB as string).localeCompare(valA as string);
        }
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
        return sortAsc ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
      });
  }, [stocks, selectedSector, selectedCategory, searchQuery, sortField, sortAsc]);

  return (
    <div className="space-y-4">
      {/* Top Filter & Search Bar */}
      <div className="bg-[#0A0F1D] border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          {/* Sector */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5 text-amber-400" />
            <span>القطاع:</span>
          </div>
          <select
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            className="bg-[#050811] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
          >
            <option value="ALL">جميع القطاعات</option>
            {sectors.filter(s => s !== 'ALL').map(sec => (
              <option key={sec} value={sec}>{sec}</option>
            ))}
          </select>

          {/* Recommendation */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mr-2">
            <span>التوصية:</span>
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-[#050811] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
          >
            <option value="ALL">جميع القرارات</option>
            <option value="شراء">شراء استثماري</option>
            <option value="مضاربة">مضاربة سريعة</option>
            <option value="انتظار">انتظار ومراقبة</option>
            <option value="بيع">جني أرباح / بيع</option>
          </select>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="بحث بالرمز أو الاسم..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#050811] border border-slate-700 rounded-xl py-2 pr-10 pl-4 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
          />
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-[#0A0F1D] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-[#060913] border-b border-slate-800 text-slate-400 select-none">
              <tr>
                <th className="py-3 px-4 font-bold cursor-pointer" onClick={() => handleSort('symbol')}>
                  <div className="flex items-center gap-1">
                    <span>الرمز والشركة</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th className="py-3 px-3 font-bold cursor-pointer" onClick={() => handleSort('sector')}>
                  <div className="flex items-center gap-1">
                    <span>القطاع</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th className="py-3 px-3 font-bold cursor-pointer font-mono-numbers" onClick={() => handleSort('currentPrice')}>
                  <div className="flex items-center gap-1">
                    <span>السعر (د.ع)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th className="py-3 px-3 font-bold cursor-pointer font-mono-numbers" onClick={() => handleSort('changePercent')}>
                  <div className="flex items-center gap-1">
                    <span>التغير اليومي</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th className="py-3 px-3 font-bold cursor-pointer" onClick={() => handleSort('recommendationCategory')}>
                  <div className="flex items-center gap-1">
                    <span>قرار المستثمر</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th className="py-3 px-3 font-bold cursor-pointer font-mono-numbers" onClick={() => handleSort('peRatio')}>
                  <div className="flex items-center gap-1">
                    <span>مكرر P/E</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th className="py-3 px-3 font-bold cursor-pointer font-mono-numbers" onClick={() => handleSort('dividendYield')}>
                  <div className="flex items-center gap-1">
                    <span>عائد الأرباح %</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th className="py-3 px-3 font-bold cursor-pointer font-mono-numbers" onClick={() => handleSort('rsi')}>
                  <div className="flex items-center gap-1">
                    <span>RSI (14)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th className="py-3 px-3 font-bold cursor-pointer font-mono-numbers" onClick={() => handleSort('tradedValue')}>
                  <div className="flex items-center gap-1">
                    <span>السيولة (M د.ع)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th className="py-3 px-4 font-bold text-center">
                  <span>إجراءات</span>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60 font-mono-numbers">
              {filteredStocks.map((stock) => {
                const isBuy = stock.recommendationCategory === 'شراء';
                const isSpeculate = stock.recommendationCategory === 'مضاربة';
                const isWait = stock.recommendationCategory === 'انتظار';
                const isSell = stock.recommendationCategory === 'بيع';

                return (
                  <tr
                    key={stock.symbol}
                    className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                    onClick={() => onSelectStock(stock)}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-amber-400 group-hover:text-amber-300">
                          {stock.symbol}
                        </span>
                        <div>
                          <div className="text-white font-medium font-sans">{stock.nameAr}</div>
                          <div className="text-[10px] text-slate-500 font-sans">{stock.nameEn}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3 font-sans text-slate-400 text-[11px]">
                      {stock.sector}
                    </td>

                    <td className="py-3 px-3 font-bold text-white text-sm">
                      {stock.currentPrice > 0 ? formatPrice(stock.currentPrice,3) : '—'}
                    </td>

                    <td className="py-3 px-3">
                      <span dir="ltr" lang="en" className={`numeric-ltr inline-flex items-center gap-1 font-bold ${
                        stock.quoteStatus === 'no_trade' || stock.quoteStatus === 'suspended' ? 'text-slate-400' : stock.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {stock.currentPrice <= 0 ? 'السعر غير متاح' : stock.quoteStatus === 'no_trade' ? 'لم يتداول' : stock.quoteStatus === 'suspended' ? 'موقوف' : formatPercent(stock.changePercent)}
                      </span>
                    </td>

                    <td className="py-3 px-3 font-sans">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                        isBuy ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        isSpeculate ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' :
                        isSell ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                        'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                      }`}>
                        {isBuy && <CheckCircle2 className="w-3 h-3" />}
                        {isSpeculate && <Zap className="w-3 h-3" />}
                        {isSell && <AlertTriangle className="w-3 h-3" />}
                        {isWait && <Clock className="w-3 h-3" />}
                        <span>{stock.signal}</span>
                      </span>
                    </td>

                    <td className="py-3 px-3 text-slate-200">
                      {stock.peRatio > 0 ? formatPrice(stock.peRatio,1) : '—'}
                    </td>

                    <td className="py-3 px-3 font-bold text-emerald-400">
                      %{formatPrice(stock.dividendYield,1)}
                    </td>

                    <td className="py-3 px-3">
                      <span className={`font-semibold ${
                        stock.recommendationGate?.allowed === true
                          ? (stock.rsi > 70 ? 'text-rose-400' : stock.rsi < 35 ? 'text-emerald-400' : 'text-slate-300')
                          : 'text-slate-500'
                      }`}>
                        {stock.recommendationGate?.allowed === true ? formatPrice(stock.rsi,0) : '—'}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-slate-300">
                      {formatCompact(stock.tradedValue)}
                    </td>

                    <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onSelectStock(stock)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                          title="فحص معمق"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onSendToCalculator(stock)}
                          className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400"
                          title="حاسبة العمولة والهدف"
                        >
                          <Calculator className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onAddToPortfolio(stock)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400"
                          title="إضافة للمحفظة"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
