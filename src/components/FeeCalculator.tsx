import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  Percent, 
  DollarSign, 
  Target, 
  ShieldCheck, 
  ArrowRight, 
  Coins, 
  HelpCircle, 
  TrendingUp 
} from 'lucide-react';
import { Stock } from '../types/stock';
import { 
  calculateISXCFees, 
  ISXC_COMMISSION_RATE, 
  formatIqd, 
  formatNumber 
} from '../utils/calculator';

interface FeeCalculatorProps {
  stocks: Stock[];
  initialStock?: Stock | null;
  initialShares?: number;
  initialPrice?: number;
}

export const FeeCalculator: React.FC<FeeCalculatorProps> = ({
  stocks,
  initialStock,
  initialShares = 100000,
  initialPrice
}) => {
  const [selectedSymbol, setSelectedSymbol] = useState<string>(
    initialStock?.symbol || stocks[0]?.symbol || 'BBOB'
  );
  const [shares, setShares] = useState<number>(initialShares);
  const [buyPrice, setBuyPrice] = useState<number>(
    initialPrice || initialStock?.currentPrice || stocks[0]?.currentPrice || 2.58
  );
  const [commissionRate, setCommissionRate] = useState<number>(ISXC_COMMISSION_RATE);
  const [customTargetPercent, setCustomTargetPercent] = useState<number>(12);

  // Sync if initialStock changes
  useEffect(() => {
    if (initialStock) {
      setSelectedSymbol(initialStock.symbol);
      setBuyPrice(initialPrice || initialStock.currentPrice);
      if (initialShares) setShares(initialShares);
    }
  }, [initialStock, initialPrice, initialShares]);

  const calculation = calculateISXCFees(shares, buyPrice, commissionRate);

  // Custom target calculation
  const desiredNetCustom = calculation.totalBuyCost * (1 + customTargetPercent / 100);
  const rawCustomTargetPrice = (desiredNetCustom / calculation.shares) / (1 - commissionRate);
  const customTargetSellPrice = Number((Math.ceil(rawCustomTargetPrice / 0.001 - 1e-10) * 0.001).toFixed(3));
  const customGrossSell = calculation.shares * customTargetSellPrice;
  const customSellFee = customGrossSell * commissionRate;
  const customNetProfit = customGrossSell - customSellFee - calculation.totalBuyCost;

  const currentStockObj = stocks.find(s => s.symbol === selectedSymbol);

  return (
    <div className="space-y-6">
      {/* Title Card */}
      <div className="bg-gradient-to-r from-[#0C1322] via-[#101A2E] to-[#0A0F1D] border border-amber-500/20 rounded-2xl p-5 sm:p-6 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-semibold mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>حاسبة تقديرية — تحقق من تعرفة شركة الوساطة</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              حاسبة تكاليف الصفقة ونقطة التعادل والأهداف الربحية
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mt-1 leading-relaxed">
              تستخدم نسبة افتراضية قابلة للتعديل لكل جانب تداول. أدخل تعرفة وسيطك الفعلية وأصغر وحدة تغير للسعر قبل الاعتماد على النتائج.
            </p>
          </div>

          <div className="bg-[#070B14] border border-slate-800 rounded-xl p-3 text-left font-mono-numbers shrink-0">
            <span className="text-[11px] text-slate-400 block">نسبة العمولة الافتراضية لكل جانب</span>
            <span className="text-xl font-black text-amber-400">0.76%</span>
            <span className="text-[10px] text-slate-500 block">سيناريو افتراضي لكل جانب</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Inputs vs Breakeven summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Inputs Card */}
        <div className="lg:col-span-5 bg-[#0A0F1D] border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Calculator className="w-4 h-4 text-amber-400" />
            بيانات الصفقة والشراء
          </h3>

          <div>
            <label className="text-xs text-slate-300 block mb-1">اختر السهم من القائمة</label>
            <select
              value={selectedSymbol}
              onChange={(e) => {
                setSelectedSymbol(e.target.value);
                const st = stocks.find(s => s.symbol === e.target.value);
                if (st) setBuyPrice(st.currentPrice);
              }}
              className="w-full bg-[#050811] border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
            >
              {stocks.filter(s => s.currentPrice > 0).map(s => (
                <option key={s.symbol} value={s.symbol}>
                  {s.symbol} — {s.nameAr} ({s.currentPrice > 0 ? `${s.currentPrice.toFixed(3)} د.ع` : 'لا يتوفر سعر'})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-300 block mb-1">عدد الأسهم (الكمية)</label>
              <input
                type="number"
                step="1000"
                min="1"
                value={shares}
                onChange={(e) => setShares(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-[#050811] border border-slate-700 rounded-xl p-2.5 text-xs text-white font-mono-numbers focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="text-xs text-slate-300 block mb-1">سعر الشراء (د.ع)</label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                value={buyPrice}
                onChange={(e) => setBuyPrice(Math.max(0.001, parseFloat(e.target.value) || 0.001))}
                className="w-full bg-[#050811] border border-slate-700 rounded-xl p-2.5 text-xs text-white font-mono-numbers focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-300 block mb-1">نسبة العمولة لكل عملية شراء أو بيع (%)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                max="5"
                value={(commissionRate * 100).toFixed(2)}
                onChange={(e) => setCommissionRate(Math.min(5, Math.max(0, parseFloat(e.target.value) || 0)) / 100)}
                className="w-32 bg-[#050811] border border-slate-700 rounded-xl p-2 text-xs text-white font-mono-numbers focus:outline-none focus:border-amber-400"
              />
              <span className="text-xs text-slate-400">% لكل عملية</span>
            </div>
          </div>

          {/* Quick preset buttons for quantity */}
          <div>
            <span className="text-[11px] text-slate-400 block mb-1.5">كميات سريعة:</span>
            <div className="flex items-center gap-2 font-mono-numbers flex-wrap">
              {[50000, 100000, 250000, 500000, 1000000].map((qty) => (
                <button
                  key={qty}
                  onClick={() => setShares(qty)}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                    shares === qty
                      ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {(qty / 1000).toLocaleString()}K
                </button>
              ))}
            </div>
          </div>

          {/* Cost Outlay breakdown */}
          <div className="bg-[#050811] border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs font-mono-numbers">
            <div className="flex justify-between text-slate-400">
              <span>القيمة الاسمية للشراء:</span>
              <span className="text-slate-200">{formatIqd(calculation.grossBuyValue)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>عمولة الشراء ({(commissionRate * 100).toFixed(2)}%):</span>
              <span className="text-amber-400">+{formatIqd(calculation.buyFee)}</span>
            </div>
            <div className="flex justify-between font-bold pt-2 border-t border-slate-800 text-white text-sm">
              <span>إجمالي المبلغ المطلوب دفعه:</span>
              <span className="text-amber-300">{formatIqd(calculation.totalBuyCost)}</span>
            </div>
          </div>
        </div>

        {/* Right Breakeven & Target Results */}
        <div className="lg:col-span-7 space-y-4">
          {/* Breakeven highlight card */}
          <div className="bg-[#0A0F1D] border border-amber-500/30 rounded-2xl p-5 shadow-2xl relative overflow-hidden gold-glow">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-amber-400 block mb-1 flex items-center gap-1.5">
                  <Target className="w-4 h-4" />
                  سعر نقطة التعادل الصارم (Breakeven Price)
                </span>
                <div className="text-3xl font-black text-white font-mono-numbers">
                  {calculation.breakevenSellPrice.toFixed(3)} <span className="text-sm font-normal text-slate-400">د.ع / سهم</span>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  أنت بحاجة لارتفاع السعر بنسبة <b className="text-amber-400 font-mono-numbers">+{calculation.breakevenPercent}%</b> لتغطية عمولتي الشراء والبيع معاً دون أي خسارة.
                </p>
              </div>

              <div className="bg-[#070B14] border border-slate-800 rounded-xl p-3 text-center sm:text-left shrink-0">
                <span className="text-[11px] text-slate-400 block">صافي العائد عند التعادل</span>
                <span className="text-lg font-bold text-slate-200 font-mono-numbers">0.00 د.ع</span>
                <span className="text-[10px] text-emerald-400 block font-semibold">استرداد رأس المال 100%</span>
              </div>
            </div>
          </div>

          {/* Interactive Target Simulator Slider */}
          <div className="bg-[#0A0F1D] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                محاكي الهدف الربحي المخصص
              </h4>
              <span className="text-xs font-mono-numbers font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                ربح صافي +{customTargetPercent}%
              </span>
            </div>

            <input
              type="range"
              min="2"
              max="50"
              step="1"
              value={customTargetPercent}
              onChange={(e) => setCustomTargetPercent(parseInt(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />

            <div className="grid grid-cols-3 gap-2 text-center pt-2 font-mono-numbers text-xs">
              <div className="bg-[#050811] p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block">سعر البيع المطلوب</span>
                <span className="text-base font-black text-amber-400">{customTargetSellPrice.toFixed(3)}</span>
                <span className="text-[9px] text-slate-500 block">د.ع</span>
              </div>

              <div className="bg-[#050811] p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block">عمولة البيع التقديرية</span>
                <span className="text-base font-bold text-rose-400">{formatIqd(customSellFee)}</span>
              </div>

              <div className="bg-[#050811] p-2.5 rounded-xl border border-emerald-500/30">
                <span className="text-[10px] text-emerald-400 block font-semibold">الربح الصافي في جيبك</span>
                <span className="text-base font-black text-emerald-400">+{formatIqd(customNetProfit)}</span>
              </div>
            </div>
          </div>

          {/* Targets Table */}
          <div className="bg-[#0A0F1D] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-3 bg-[#060913] border-b border-slate-800 flex justify-between items-center text-xs text-slate-300 font-bold">
              <span>جدول الأهداف الربحية الصافية (بعد خصم عمولة الوساطة)</span>
              <span className="text-[10px] text-slate-500">ISXC Net Profit Ladder</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs font-mono-numbers">
                <thead className="bg-[#070B14] text-slate-400 border-b border-slate-800/80">
                  <tr>
                    <th className="py-2.5 px-3 font-bold">نسبة الربح الصافي</th>
                    <th className="py-2.5 px-3 font-bold">سعر البيع المطلوب</th>
                    <th className="py-2.5 px-3 font-bold">قيمة البيع الإجمالية</th>
                    <th className="py-2.5 px-3 font-bold">عمولة البيع</th>
                    <th className="py-2.5 px-3 font-bold text-emerald-400">الربح الصافي (د.ع)</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800/60">
                  {calculation.sellTargets.map((t) => (
                    <tr key={t.targetPercent} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-slate-200">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          +{t.targetPercent}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-amber-400 text-sm">
                        {t.sellPrice.toFixed(3)} د.ع
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">
                        {formatIqd(t.grossSellValue)}
                      </td>
                      <td className="py-2.5 px-3 text-rose-400">
                        -{formatIqd(t.sellFee)}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-emerald-400 text-sm">
                        +{formatIqd(t.netProfitIqd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
