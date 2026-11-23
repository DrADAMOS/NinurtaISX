import React, { useState, useMemo } from 'react';
import { 
  X, 
  TrendingUp, 
  TrendingDown, 
  ShieldCheck, 
  Zap, 
  Clock, 
  AlertTriangle, 
  BarChart2, 
  Sliders, 
  Calculator, 
  PlusCircle, 
  Bell, 
  FileText, 
  CheckCircle2, 
  ArrowUpRight, 
  ArrowDownRight, 
  Layers, 
  Scale 
} from 'lucide-react';
import { Stock, HistoricalPrice } from '../types/stock';
import { getVerifiedHistoricalPrices } from '../utils/dataQuality';
import { assessTechnicalRecommendation } from '../utils/technicalRecommendation';

interface StockDetailModalProps {
  stock: Stock | null;
  onClose: () => void;
  onSendToCalculator: (stock: Stock) => void;
  onAddToPortfolio: (stock: Stock) => void;
  onSetAlert: (stock: Stock) => void;
}

export const StockDetailModal: React.FC<StockDetailModalProps> = ({
  stock,
  onClose,
  onSendToCalculator,
  onAddToPortfolio,
  onSetAlert
}) => {
  const [chartType, setChartType] = useState<'CANDLE' | 'LINE'>('CANDLE');
  const [timeframe, setTimeframe] = useState<'1M' | '3M' | '6M' | '1Y'>('3M');
  const [showMAs, setShowMAs] = useState<boolean>(true);
  const [hoveredCandle, setHoveredCandle] = useState<HistoricalPrice | null>(null);

  if (!stock) return null;

  // Use the same audited CSD calculation as the recommendation summary.
  // Never display legacy/precomputed stock.rsi/ma20/ma50 as current indicators.
  const technical = assessTechnicalRecommendation(stock);

  // Filter historical prices according to timeframe
  const history = useMemo(() => {
    const all = getVerifiedHistoricalPrices(stock);
    if (all.length === 0) return [];
    const latest = new Date(`${all[all.length - 1].date}T00:00:00`);
    const months = timeframe === '1M' ? 1 : timeframe === '3M' ? 3 : timeframe === '6M' ? 6 : 12;
    const cutoff = new Date(latest);
    cutoff.setMonth(cutoff.getMonth() - months);
    return all.filter(row => new Date(`${row.date}T00:00:00`) >= cutoff);
  }, [stock, timeframe]);

  // Chart calculation metrics
  const chartMetrics = useMemo(() => {
    if (history.length === 0) return null;
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let maxVolume = 0;

    history.forEach((d) => {
      if (d.low < minPrice) minPrice = d.low;
      if (d.high > maxPrice) maxPrice = d.high;
      if (d.volume > maxVolume) maxVolume = d.volume;
    });

    // Add 4% padding
    const padding = (maxPrice - minPrice) * 0.05 || 0.05;
    minPrice = Math.max(0.001, minPrice - padding);
    maxPrice = maxPrice + padding;

    return { minPrice, maxPrice, maxVolume };
  }, [history]);

  const isBuy = stock.recommendationCategory === 'شراء';
  const isSpeculate = stock.recommendationCategory === 'مضاربة';
  const isWait = stock.recommendationCategory === 'انتظار';
  const isSell = stock.recommendationCategory === 'بيع';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div 
        className="bg-[#0A0E1A] border border-slate-700/80 rounded-2xl w-full max-w-5xl my-auto shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-[#070B14] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center">
              <span className="font-mono-numbers font-black text-xl text-amber-400">
                {stock.symbol}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white">{stock.nameAr}</h3>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
                  {stock.sector}
                </span>
                <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                  ({stock.nameEn})
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 font-mono-numbers">
                <span className="text-amber-300">حدود التداول والإغلاق السابق: غير متاحة في المصدر العام لهذا التحديث</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-left font-mono-numbers">
              <div className="text-2xl font-black text-white">{stock.currentPrice > 0 ? `${stock.currentPrice.toFixed(3)} د.ع` : 'لا يتوفر سعر موثوق'}</div>
              <div className={`text-xs font-bold flex items-center justify-end gap-1 ${stock.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {stock.quoteStatus === 'no_trade'
                  ? 'لم يتداول في هذه الجلسة'
                  : stock.quoteStatus === 'suspended'
                    ? 'موقوف — السعر آخر تداول منشور'
                    : <>{stock.changePercent >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}{stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}% حسب المصدر</>}
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* Recommendation Executive Banner */}
          <div className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
            isBuy
              ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
              : isSpeculate
              ? 'bg-cyan-950/20 border-cyan-500/40 text-cyan-200'
              : isSell
              ? 'bg-rose-950/20 border-rose-500/40 text-rose-200'
              : 'bg-amber-950/20 border-amber-500/40 text-amber-200'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`p-2.5 rounded-xl ${
                isBuy ? 'bg-emerald-500/20 text-emerald-400' :
                isSpeculate ? 'bg-cyan-500/20 text-cyan-400' :
                isSell ? 'bg-rose-500/20 text-rose-400' :
                'bg-amber-500/20 text-amber-400'
              }`}>
                {isBuy && <CheckCircle2 className="w-6 h-6" />}
                {isSpeculate && <Zap className="w-6 h-6" />}
                {isSell && <AlertTriangle className="w-6 h-6" />}
                {isWait && <Clock className="w-6 h-6" />}
              </div>

              <div>
                {stock.dataQualityStatus !== 'verified' && (
                  <div className="mb-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                    بيانات السهم قيد المراجعة؛ تم تعطيل التوصية والمؤشرات التاريخية غير الموثوقة.
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-base font-black">حالة الإشارة: {stock.signal}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-900/60 font-mono-numbers">
                    قوة الإشارة: {stock.dataQualityStatus === 'verified' ? `${stock.signalStrength}%` : 'غير متاحة'}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-900/60">
                    مخاطرة {stock.riskLevel}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  {stock.signalReason}
                </p>
              </div>
            </div>

            {/* Target & Stop Loss Pills */}
            <div className="flex items-center gap-2 font-mono-numbers shrink-0">
              <div className="bg-[#070B14] border border-slate-800 rounded-lg p-2 text-center min-w-[85px]">
                <span className="text-[10px] text-slate-400 block">دخول مقترح</span>
                <span className="text-xs font-bold text-amber-400">{stock.dataQualityStatus === 'verified' ? stock.entryTarget.toFixed(3) : '—'}</span>
              </div>
              <div className="bg-[#070B14] border border-slate-800 rounded-lg p-2 text-center min-w-[85px]">
                <span className="text-[10px] text-rose-400 block">وقف الخسارة</span>
                <span className="text-xs font-bold text-rose-400">{stock.dataQualityStatus === 'verified' ? stock.stopLoss.toFixed(3) : '—'}</span>
              </div>
              <div className="bg-[#070B14] border border-slate-800 rounded-lg p-2 text-center min-w-[85px]">
                <span className="text-[10px] text-emerald-400 block">هدف أول (T1)</span>
                <span className="text-xs font-bold text-emerald-400">{stock.dataQualityStatus === 'verified' ? stock.targetPrice1.toFixed(3) : '—'}</span>
              </div>
            </div>
          </div>

          {/* Interactive Chart Container */}
          <div className="bg-[#070B14] border border-slate-800 rounded-2xl p-4 sm:p-5">
            {/* Chart Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <BarChart2 className="w-4 h-4 text-amber-400" />
                  الرسم البياني ومستويات الدعم والمقاومة
                </span>
                {stock.verifiedHistoricalData?.verified && (
                  <span className="text-[10px] text-slate-500">
                    المصدر: نشرات مركز الإيداع الرسمية · آخر جلسة: {stock.verifiedHistoricalData.lastSession}
                  </span>
                )}
                {hoveredCandle && (
                  <div className="hidden sm:flex items-center gap-3 mr-4 text-xs font-mono-numbers text-slate-400">
                    <span>افتتاح: <b className="text-slate-200">{hoveredCandle.open.toFixed(3)}</b></span>
                    <span>أعلى: <b className="text-emerald-400">{hoveredCandle.high.toFixed(3)}</b></span>
                    <span>أدنى: <b className="text-rose-400">{hoveredCandle.low.toFixed(3)}</b></span>
                    <span>إغلاق: <b className="text-white">{hoveredCandle.close.toFixed(3)}</b></span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Candlestick / Line toggle */}
                <div className="bg-slate-900 p-0.5 rounded-lg border border-slate-800 flex items-center">
                  <button
                    onClick={() => setChartType('CANDLE')}
                    className={`px-2.5 py-1 text-xs font-bold rounded ${
                      chartType === 'CANDLE' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    شموع يابانية
                  </button>
                  <button
                    onClick={() => setChartType('LINE')}
                    className={`px-2.5 py-1 text-xs font-bold rounded ${
                      chartType === 'LINE' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    خطي
                  </button>
                </div>

                {/* MA Toggle */}
                <button
                  onClick={() => setShowMAs(!showMAs)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-colors ${
                    showMAs ? 'bg-slate-800 border-amber-400/40 text-amber-300' : 'bg-slate-900 border-slate-800 text-slate-500'
                  }`}
                >
                  المتوسطات (MA20/50)
                </button>

                {/* Timeframes */}
                <div className="bg-slate-900 p-0.5 rounded-lg border border-slate-800 flex items-center">
                  {(['1M', '3M', '6M', '1Y'] as const).map((tf) => (
                    <button
                      key={tf}
                      onClick={() => setTimeframe(tf)}
                      className={`px-2 py-1 text-xs font-mono-numbers font-bold rounded ${
                        timeframe === tf ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* SVG Chart Drawing */}
            {chartMetrics && history.length > 0 ? (
              <div className="relative h-72 sm:h-80 w-full select-none">
                <svg
                  className="w-full h-full overflow-visible"
                  viewBox="0 0 800 300"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Grid Lines */}
                  {[0.2, 0.4, 0.6, 0.8].map((ratio, idx) => {
                    const y = ratio * 240;
                    const priceVal = chartMetrics.maxPrice - ratio * (chartMetrics.maxPrice - chartMetrics.minPrice);
                    return (
                      <g key={idx}>
                        <line x1="0" y1={y} x2="800" y2={y} stroke="#1E293B" strokeDasharray="3 3" />
                        <text x="795" y={y - 4} fill="#64748B" fontSize="10" textAnchor="end" fontFamily="JetBrains Mono">
                          {priceVal.toFixed(3)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Support & Resistance Horizontal Reference Lines */}
                  {/* Resistance 1 */}
                  {stock.dataQualityStatus === 'verified' && stock.resistance1 <= chartMetrics.maxPrice && stock.resistance1 >= chartMetrics.minPrice && (
                    <g>
                      {(() => {
                        const y = 240 - ((stock.resistance1 - chartMetrics.minPrice) / (chartMetrics.maxPrice - chartMetrics.minPrice)) * 240;
                        return (
                          <>
                            <line x1="0" y1={y} x2="800" y2={y} stroke="#F43F5E" strokeDasharray="4 2" strokeWidth="1.2" opacity="0.6" />
                            <text x="10" y={y - 4} fill="#F43F5E" fontSize="9" fontFamily="Cairo">مقاومة 1: {stock.resistance1.toFixed(3)}</text>
                          </>
                        );
                      })()}
                    </g>
                  )}

                  {/* Support 1 */}
                  {stock.dataQualityStatus === 'verified' && stock.support1 <= chartMetrics.maxPrice && stock.support1 >= chartMetrics.minPrice && (
                    <g>
                      {(() => {
                        const y = 240 - ((stock.support1 - chartMetrics.minPrice) / (chartMetrics.maxPrice - chartMetrics.minPrice)) * 240;
                        return (
                          <>
                            <line x1="0" y1={y} x2="800" y2={y} stroke="#10B981" strokeDasharray="4 2" strokeWidth="1.2" opacity="0.6" />
                            <text x="10" y={y - 4} fill="#10B981" fontSize="9" fontFamily="Cairo">دعم 1: {stock.support1.toFixed(3)}</text>
                          </>
                        );
                      })()}
                    </g>
                  )}

                  {/* Volume Bars at Bottom (from y=240 to y=290) */}
                  {history.map((d, i) => {
                    const step = 800 / history.length;
                    const x = i * step + step * 0.15;
                    const barW = Math.max(2, step * 0.7);
                    const volHeight = (d.volume / chartMetrics.maxVolume) * 45;
                    const y = 290 - volHeight;
                    const isUp = d.close >= d.open;
                    return (
                      <rect
                        key={`vol-${i}`}
                        x={x}
                        y={y}
                        width={barW}
                        height={volHeight}
                        fill={isUp ? '#10B981' : '#EF4444'}
                        opacity="0.35"
                      />
                    );
                  })}

                  {/* Candlesticks */}
                  {chartType === 'CANDLE' ? (
                    history.map((d, i) => {
                      const step = 800 / history.length;
                      const x = i * step + step * 0.5;
                      const barW = Math.max(3, step * 0.65);
                      const isUp = d.close >= d.open;
                      const range = chartMetrics.maxPrice - chartMetrics.minPrice;

                      const highY = 240 - ((d.high - chartMetrics.minPrice) / range) * 240;
                      const lowY = 240 - ((d.low - chartMetrics.minPrice) / range) * 240;
                      const openY = 240 - ((d.open - chartMetrics.minPrice) / range) * 240;
                      const closeY = 240 - ((d.close - chartMetrics.minPrice) / range) * 240;

                      const bodyTop = Math.min(openY, closeY);
                      const bodyHeight = Math.max(2, Math.abs(closeY - openY));

                      return (
                        <g 
                          key={`candle-${i}`}
                          className="cursor-pointer transition-opacity hover:opacity-100"
                          onMouseEnter={() => setHoveredCandle(d)}
                        >
                          {/* Wick */}
                          <line
                            x1={x}
                            y1={highY}
                            x2={x}
                            y2={lowY}
                            stroke={isUp ? '#10B981' : '#EF4444'}
                            strokeWidth="1.5"
                          />
                          {/* Candle body */}
                          <rect
                            x={x - barW / 2}
                            y={bodyTop}
                            width={barW}
                            height={bodyHeight}
                            fill={isUp ? '#10B981' : '#EF4444'}
                            rx="1"
                          />
                        </g>
                      );
                    })
                  ) : (
                    /* Line Chart */
                    <>
                      {/* Gradient Fill under line */}
                      {(() => {
                        const step = 800 / history.length;
                        const points = history.map((d, i) => {
                          const x = i * step + step * 0.5;
                          const y = 240 - ((d.close - chartMetrics.minPrice) / (chartMetrics.maxPrice - chartMetrics.minPrice)) * 240;
                          return `${x},${y}`;
                        });
                        const areaPath = `M ${points[0]} L ${points.join(' L ')} L 800,240 L 0,240 Z`;
                        return <path d={areaPath} fill="url(#lineGrad)" />;
                      })()}

                      {/* Main Stroke */}
                      {(() => {
                        const step = 800 / history.length;
                        const points = history.map((d, i) => {
                          const x = i * step + step * 0.5;
                          const y = 240 - ((d.close - chartMetrics.minPrice) / (chartMetrics.maxPrice - chartMetrics.minPrice)) * 240;
                          return `${x},${y}`;
                        }).join(' L ');
                        return (
                          <path
                            d={`M ${points}`}
                            fill="none"
                            stroke="#F59E0B"
                            strokeWidth="2.5"
                          />
                        );
                      })()}
                    </>
                  )}

                  {/* MA20 Overlay */}
                  {showMAs && history.length > 5 && (() => {
                    const step = 800 / history.length;
                    const maPoints: string[] = [];
                    for (let i = 0; i < history.length; i++) {
                      const slice = history.slice(Math.max(0, i - 19), i + 1);
                      const avg = slice.reduce((a, b) => a + b.close, 0) / slice.length;
                      const x = i * step + step * 0.5;
                      const y = 240 - ((avg - chartMetrics.minPrice) / (chartMetrics.maxPrice - chartMetrics.minPrice)) * 240;
                      maPoints.push(`${x},${y}`);
                    }
                    return (
                      <path
                        d={`M ${maPoints.join(' L ')}`}
                        fill="none"
                        stroke="#38BDF8"
                        strokeWidth="1.5"
                        opacity="0.8"
                      />
                    );
                  })()}
                </svg>
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center gap-2 px-5 text-center">
                <span className="text-amber-300 text-sm font-bold">الرسم التاريخي غير متاح للتحليل حالياً</span>
                <span className="text-slate-400 text-xs leading-6 max-w-xl">
                  لا توجد حالياً شموع OHLCV مكتملة ومتحققة المصدر لهذا السهم. تُعرض الشموع فقط بعد استيراد سجل تاريخي موثق واجتياز فحوص التكرار وصحة الأسعار والأحجام.
                </span>
              </div>
            )}

            {/* Technical Indicator Status Bar */}
            {stock.dataQualityStatus === 'verified' && technical.status === 'available' ? (
            <div className="mt-4 pt-3 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-[#050811] p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[11px]">مؤشر القوة RSI (14):</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono-numbers font-bold text-sm text-white">{technical.rsi!.toFixed(1)}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                    technical.rsi! > 70 ? 'bg-rose-500/20 text-rose-400' :
                    technical.rsi! < 35 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-300'
                  }`}>
                    {technical.rsi! > 70 ? 'تشبع شرائي' : technical.rsi! < 35 ? 'تشبع بيعي (فرصة)' : 'منطقة توازن'}
                  </span>
                </div>
              </div>

              <div className="bg-[#050811] p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[11px]">مؤشر الماكد MACD:</span>
                <span className="font-semibold text-emerald-400 text-sm block mt-1">
                  غير محسوب من سجل CSD
                </span>
              </div>

              <div className="bg-[#050811] p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[11px]">متوسط 20 يوم (MA20):</span>
                <span className="font-mono-numbers font-bold text-amber-400 text-sm block mt-1">
                  {technical.sma20!.toFixed(3)} د.ع
                </span>
              </div>

              <div className="bg-[#050811] p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[11px]">متوسط 50 يوم (MA50):</span>
                <span className="font-mono-numbers font-bold text-sky-400 text-sm block mt-1">
                  {technical.sma50 === null ? 'غير متاح' : `${technical.sma50.toFixed(3)} د.ع`}
                </span>
              </div>
            </div>
            ) : (
              <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-amber-200">
                المؤشرات الفنية مخفية لأن السجل الرسمي غير كافٍ أو غير صالح أو قديم؛ لن نعرض القيم القديمة المخزنة كأنها محسوبة حديثاً.
              </div>
            )}
          </div>

          {/* Fundamentals & Valuation Matrix */}
          <div>
            <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Scale className="w-4 h-4 text-amber-400" />
              المؤشرات المالية ومقارنة التقييم العادل
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
              <div className="bg-[#070B14] border border-slate-800 rounded-xl p-3 text-center">
                <span className="text-[11px] text-slate-400 block">مكرر الربحية (P/E)</span>
                <span className="text-base font-black text-amber-400 font-mono-numbers">
                  {stock.peRatio > 0 ? stock.peRatio.toFixed(1) : 'سالب'}
                </span>
                <span className="text-[10px] text-slate-500 block">مرة</span>
              </div>

              <div className="bg-[#070B14] border border-slate-800 rounded-xl p-3 text-center">
                <span className="text-[11px] text-slate-400 block">مكرر القيمة الدفترية (P/B)</span>
                <span className="text-base font-black text-slate-200 font-mono-numbers">
                  {stock.pbRatio.toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-500 block">مرة</span>
              </div>

              <div className="bg-[#070B14] border border-slate-800 rounded-xl p-3 text-center">
                <span className="text-[11px] text-slate-400 block">عائد التوزيعات النقدي</span>
                <span className="text-base font-black text-emerald-400 font-mono-numbers">
                  %{stock.dividendYield.toFixed(1)}
                </span>
                <span className="text-[10px] text-emerald-400/80 block">سنوياً</span>
              </div>

              <div className="bg-[#070B14] border border-slate-800 rounded-xl p-3 text-center">
                <span className="text-[11px] text-slate-400 block">ربحية السهم (EPS)</span>
                <span className="text-base font-black text-slate-200 font-mono-numbers">
                  {stock.eps.toFixed(3)}
                </span>
                <span className="text-[10px] text-slate-500 block">د.ع / سهم</span>
              </div>

              <div className="bg-[#070B14] border border-slate-800 rounded-xl p-3 text-center">
                <span className="text-[11px] text-slate-400 block">القيمة الدفترية (Book)</span>
                <span className="text-base font-black text-slate-200 font-mono-numbers">
                  {stock.bookValue.toFixed(3)}
                </span>
                <span className="text-[10px] text-slate-500 block">د.ع</span>
              </div>

              <div className="bg-[#070B14] border border-amber-500/30 rounded-xl p-3 text-center gold-glow">
                <span className="text-[11px] text-amber-300 block font-bold">تقدير Graham (ليس قيمة عادلة مؤكدة)</span>
                <span className="text-base font-black text-amber-400 font-mono-numbers">
                  {stock.dataQualityStatus === 'verified' && stock.fairValue > 0 ? stock.fairValue.toFixed(3) : '—'}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  {stock.fairValue <= 0 ? (
                    <span className="text-slate-400">لا تتوفر مدخلات كافية</span>
                  ) : stock.fairValue > stock.currentPrice ? (
                    <span className="text-emerald-400">خصم %{(((stock.fairValue - stock.currentPrice) / stock.fairValue) * 100).toFixed(0)}</span>
                  ) : (
                    <span className="text-rose-400">أعلى من العادلة</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Order Book Depth & Official Filings */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Order Book */}
            <div className="bg-[#070B14] border border-slate-800 rounded-2xl p-4">
              <h4 className="text-xs font-bold text-slate-200 mb-3 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-amber-400" />
                  دفتر الأوامر المحمّل (غير متاح دون مصدر وتوقيت موثقين)
                </span>
                <span className="text-[11px] text-slate-500 font-mono">ISX Live Depth</span>
              </h4>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono-numbers">
                {/* Bids */}
                <div>
                  <div className="text-[11px] font-bold text-emerald-400 border-b border-slate-800 pb-1 mb-2 flex justify-between">
                    <span>الطلبات (شراء)</span>
                    <span>الكمية</span>
                  </div>
                  <div className="space-y-1.5">
                    {stock.orderBook?.bids.map((b, i) => (
                      <div key={i} className="flex justify-between items-center p-1.5 rounded bg-emerald-950/20 text-slate-200">
                        <span className="font-bold text-emerald-400">{b.price.toFixed(3)}</span>
                        <span className="text-slate-400">{(b.quantity / 1000).toFixed(0)}K ({b.orders})</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Asks */}
                <div>
                  <div className="text-[11px] font-bold text-rose-400 border-b border-slate-800 pb-1 mb-2 flex justify-between">
                    <span>العروض (بيع)</span>
                    <span>الكمية</span>
                  </div>
                  <div className="space-y-1.5">
                    {stock.orderBook?.asks.map((a, i) => (
                      <div key={i} className="flex justify-between items-center p-1.5 rounded bg-rose-950/20 text-slate-200">
                        <span className="font-bold text-rose-400">{a.price.toFixed(3)}</span>
                        <span className="text-slate-400">{(a.quantity / 1000).toFixed(0)}K ({a.orders})</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Corporate Disclosures */}
            <div className="bg-[#070B14] border border-slate-800 rounded-2xl p-4">
              <h4 className="text-xs font-bold text-slate-200 mb-3 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-amber-400" />
                  الإفصاحات المسجلة في ملف البيانات
                </span>
                <span className="text-[11px] text-slate-500">مركز الإيداع العراقي CSD</span>
              </h4>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {stock.disclosures?.map((disc) => (
                  <div key={disc.id} className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-bold text-amber-300">{disc.title}</span>
                      <span className="text-[10px] text-slate-500 font-mono-numbers">{disc.date}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {disc.summary}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="p-4 bg-[#070B14] border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onSendToCalculator(stock);
                onClose();
              }}
              className="py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20"
            >
              <Calculator className="w-4 h-4" />
              <span>فتح في حاسبة العمولات ونقطة التعادل ISXC</span>
            </button>

            <button
              onClick={() => onAddToPortfolio(stock)}
              className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-2 transition-colors border border-slate-700"
            >
              <PlusCircle className="w-4 h-4 text-emerald-400" />
              <span>إضافة السهم للمحفظة</span>
            </button>
          </div>

          <button
            onClick={() => onSetAlert(stock)}
            className="py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs flex items-center gap-2 transition-colors border border-amber-500/30"
          >
            <Bell className="w-4 h-4" />
            <span>تعيين تنبيه سعري للهدف</span>
          </button>
        </div>
      </div>
    </div>
  );
};
