import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Bell, 
  Search, 
  Activity, 
  ShieldCheck, 
  SlidersHorizontal,
  RefreshCw
} from 'lucide-react';
import { Stock, PriceAlert } from '../types/stock';
import dataStatus from '../data/data-status.json';
import { getMarketPulse } from '../utils/marketPulse';

interface HeaderProps {
  stocks: Stock[];
  alerts: PriceAlert[];
  onOpenAlerts: () => void;
  onSelectStock: (stock: Stock) => void;
  activeView: string;
  onNavigate: (view: string) => void;
  onManualUpdate: () => void;
  isUpdating: boolean;
  lastUpdateLabel?: string;
}

export const Header: React.FC<HeaderProps> = ({
  stocks,
  alerts,
  onOpenAlerts,
  onSelectStock,
  activeView,
  onNavigate,
  onManualUpdate,
  isUpdating,
  lastUpdateLabel
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Stock[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [baghdadTime, setBaghdadTime] = useState('');
  const [isMarketOpen, setIsMarketOpen] = useState(false);

  // Update Baghdad time clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // Baghdad is UTC+3
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Baghdad',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      };
      const timeStr = new Intl.DateTimeFormat('ar-IQ', options).format(now);
      setBaghdadTime(timeStr);

      // ISX trading hours: Sun - Thu, 09:30 to 13:00 Baghdad time
      const baghdadDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Baghdad' }));
      const day = baghdadDate.getDay(); // 0 is Sunday, 4 is Thursday
      const hours = baghdadDate.getHours();
      const minutes = baghdadDate.getMinutes();
      const totalMinutes = hours * 60 + minutes;

      const isTradingDay = day >= 0 && day <= 4; // Sunday to Thursday
      const isTradingHours = totalMinutes >= (9 * 60 + 30) && totalMinutes <= (13 * 60);

      setIsMarketOpen(isTradingDay && isTradingHours);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Search filter
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }
    const q = searchQuery.toLowerCase().trim();
    const filtered = stocks.filter(
      s => s.symbol.toLowerCase().includes(q) ||
           s.nameAr.toLowerCase().includes(q) ||
           s.nameEn.toLowerCase().includes(q)
    ).slice(0, 8);
    setSearchResults(filtered);
    setShowSearchDropdown(true);
  }, [searchQuery, stocks]);

  const activeAlertsCount = alerts.filter(a => !a.triggered).length;

  // Calculate market stats
  const totalVolume = stocks.reduce((acc, s) => acc + s.volume, 0);
  const totalValue = stocks.reduce((acc, s) => acc + s.tradedValue, 0);
  // Use the same verified quote rules as the Recommendations view.
  // This keeps the header totals consistent with the market-pulse filters.
  const marketPulses = stocks.map(stock => getMarketPulse(stock));
  const gainersCount = marketPulses.filter(pulse => pulse.direction === 'positive').length;
  const losersCount = marketPulses.filter(pulse => pulse.direction === 'negative').length;

  return (
    <header className="sticky top-0 z-40 bg-[#070B14]/95 backdrop-blur-md border-b border-slate-800/80 shadow-2xl">
      {/* Top micro status bar */}
      <div className="bg-[#04070E] border-b border-slate-900 px-4 py-1.5 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 font-mono-numbers">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-300">توقيت بغداد:</span>
            <span className="text-amber-300 font-bold tracking-wider">{baghdadTime || '10:45:20'}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isMarketOpen ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
            <span className={`font-medium ${isMarketOpen ? 'text-emerald-400' : 'text-slate-400'}`}>
              {isMarketOpen ? 'جلسة التداول مفتوحة (ISX)' : 'السوق مغلق (جلسة التداول 09:30 - 13:00)'}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2 border-r border-slate-800 pr-3">
            <Activity className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-slate-400">آخر جلسة بيانات:</span>
            <span className="font-mono-numbers text-slate-200 font-semibold">
              {dataStatus.marketSessionDate || 'غير محددة'}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${dataStatus.status === 'updated_quote_snapshot_only' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-300'}`}>
              {dataStatus.status === 'updated_quote_snapshot_only' ? 'مصدر عام' : 'بانتظار التحديث'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-3 text-slate-400">
            <span>الرابحة: <b className="text-emerald-400 font-mono-numbers">{gainersCount}</b></span>
            <span>الخاسرة: <b className="text-rose-400 font-mono-numbers">{losersCount}</b></span>
            <span>السيولة: <b className="text-amber-300 font-mono-numbers">{(totalValue / 1000000).toFixed(1)}M د.ع</b></span>
          </div>
          <div className="flex items-center gap-1 text-slate-400 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-300 font-medium">سوق العراق للأوراق المالية (ISX)</span>
            <a href="https://iraqsm.com/en/market" target="_blank" rel="noreferrer" className="text-sky-400 hover:text-sky-300 underline underline-offset-2">مصدر الأسعار: IQWealth</a>
          </div>
        </div>
      </div>

      {/* Main navigation header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 p-0.5 shadow-lg shadow-amber-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-[#0B101D] rounded-[10px] flex items-center justify-center">
              <span className="text-amber-400 font-black text-xl tracking-tighter">N</span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-white tracking-wide">
                نينورتا <span className="text-amber-400 font-extrabold text-sm px-1.5 py-0.5 rounded bg-amber-400/10 border border-amber-400/30">شخصي</span>
              </h1>
              <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded">
                نسخة محلية
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              منصة التوصيات الاستثمارية والتحليل المالي لأسهم العراق
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative flex-1 max-w-md hidden md:block">
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ابحث برمز السهم أو الاسم (مثال: BNOI، بغداد، آسياسيل)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery.trim() && setShowSearchDropdown(true)}
              className="w-full bg-[#0D1424] border border-slate-700/80 rounded-xl py-2 pr-10 pl-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400/80 focus:ring-1 focus:ring-amber-400/50 transition-all"
            />
          </div>

          {/* Search Dropdown */}
          {showSearchDropdown && searchResults.length > 0 && (
            <div className="absolute top-full mt-2 w-full bg-[#0B1120] border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden z-50">
              <div className="p-2 border-b border-slate-800 text-[11px] text-slate-400 flex justify-between">
                <span>نتائج البحث ({searchResults.length})</span>
                <span className="text-amber-400">انقر لفتح التحليل</span>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/60">
                {searchResults.map((stock) => (
                  <button
                    key={stock.symbol}
                    onClick={() => {
                      onSelectStock(stock);
                      setShowSearchDropdown(false);
                      setSearchQuery('');
                    }}
                    className="w-full p-2.5 hover:bg-slate-800/50 flex items-center justify-between text-right transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-numbers font-bold text-amber-300">{stock.symbol}</span>
                        <span className="text-xs text-slate-200">{stock.nameAr}</span>
                      </div>
                      <span className="text-[11px] text-slate-500">{stock.sector}</span>
                    </div>

                    <div className="text-left font-mono-numbers">
                      <div className="text-sm font-semibold text-white">{stock.currentPrice > 0 ? `${stock.currentPrice.toFixed(3)} د.ع` : '—'}</div>
                      <span className={`text-[11px] ${stock.quoteStatus === 'no_trade' || stock.quoteStatus === 'suspended' ? 'text-slate-400' : stock.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {stock.quoteStatus === 'no_trade' ? 'لم يتداول' : stock.quoteStatus === 'suspended' ? 'موقوف' : `${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent.toFixed(2)}%`}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action icons — existing tools are retained; manual refresh is additive. */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onManualUpdate}
            disabled={isUpdating}
            className={`relative p-2.5 rounded-xl border transition-all ${isUpdating ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 cursor-wait' : 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800 text-slate-300 hover:text-emerald-400'}`}
            title={isUpdating ? 'جارٍ تحديث أسعار السوق...' : `تحديث أسعار السوق يدوياً${lastUpdateLabel ? ` — آخر تحديث: ${lastUpdateLabel}` : ''}`}
            aria-label="تحديث أسعار السوق يدوياً"
          >
            <RefreshCw className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={onOpenAlerts}
            className="relative p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 hover:bg-slate-800 text-slate-300 hover:text-amber-400 transition-all"
            title="تنبيهات الأسعار"
          >
            <Bell className="w-4 h-4" />
            {activeAlertsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-slate-950 rounded-full text-[10px] font-black flex items-center justify-center animate-pulse">
                {activeAlertsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onNavigate('calculator')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
              activeView === 'calculator'
                ? 'bg-amber-400/10 border-amber-400 text-amber-300'
                : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:border-slate-600'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">حاسبة العمولة ISXC</span>
          </button>
        </div>
      </div>
    </header>
  );
};
