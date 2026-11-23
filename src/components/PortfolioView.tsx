import React, { useState } from 'react';
import { 
  Briefcase, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Trash2, 
  Calculator, 
  Eye, 
  DollarSign, 
  Coins, 
  ShieldAlert, 
  CheckCircle2, 
  Clock 
} from 'lucide-react';
import { Stock, PortfolioPosition } from '../types/stock';
import { ISXC_COMMISSION_RATE, formatIqd, formatNumber } from '../utils/calculator';
import { PortfolioReconciliation } from './PortfolioReconciliation';
import { PortfolioDashboard } from './PortfolioDashboard';

interface PortfolioViewProps {
  stocks: Stock[];
  positions: PortfolioPosition[];
  onAddPosition: (position: Omit<PortfolioPosition, 'id'>) => void;
  onRemovePosition: (id: string) => void;
  onSelectStock: (stock: Stock) => void;
  onSendToCalculator: (stock: Stock, shares?: number, buyPrice?: number) => void;
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({
  stocks,
  positions,
  onAddPosition,
  onRemovePosition,
  onSelectStock,
  onSendToCalculator
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState(stocks[0]?.symbol || 'BBOB');
  const [sharesInput, setSharesInput] = useState('100000');
  const [priceInput, setPriceInput] = useState(stocks[0]?.currentPrice.toString() || '2.58');
  const [notesInput, setNotesInput] = useState('');

  // Find stock object for a symbol
  const getStock = (sym: string) => stocks.find(s => s.symbol === sym);

  // Portfolio aggregates
  let totalCost = 0;
  let totalCurrentValue = 0;
  let totalAnnualDividends = 0;

  const enrichedPositions = positions.map(pos => {
    const stock = getStock(pos.symbol);
    const currentPrice = stock ? stock.currentPrice : pos.averageBuyPrice;
    
    // Purchase cost including broker fee
    const grossCost = pos.shares * pos.averageBuyPrice;
    const buyFee = grossCost * ISXC_COMMISSION_RATE;
    const totalPosCost = grossCost + buyFee;
    
    // Current net value if sold now
    const grossValue = pos.shares * currentPrice;
    const sellFee = grossValue * ISXC_COMMISSION_RATE;
    const netCurrentValue = grossValue - sellFee;
    
    // Net profit / loss
    const profitIqd = netCurrentValue - totalPosCost;
    const profitPercent = (profitIqd / totalPosCost) * 100;

    // Breakeven price
    const breakevenPrice = (totalPosCost / pos.shares) / (1 - ISXC_COMMISSION_RATE);

    // Annual dividend estimate
    const divYield = stock ? stock.dividendYield : 0;
    const estimatedDiv = grossValue * (divYield / 100);

    totalCost += totalPosCost;
    totalCurrentValue += netCurrentValue;
    totalAnnualDividends += estimatedDiv;

    return {
      ...pos,
      stock,
      currentPrice,
      totalPosCost,
      netCurrentValue,
      profitIqd,
      profitPercent,
      breakevenPrice,
      estimatedDiv
    };
  });

  const totalProfitIqd = totalCurrentValue - totalCost;
  const totalProfitPercent = totalCost > 0 ? (totalProfitIqd / totalCost) * 100 : 0;

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const shares = parseFloat(sharesInput);
    const price = parseFloat(priceInput);
    if (isNaN(shares) || shares <= 0 || isNaN(price) || price <= 0) return;

    onAddPosition({
      symbol: selectedSymbol,
      shares,
      averageBuyPrice: price,
      buyDate: new Date().toISOString().split('T')[0],
      notes: notesInput.trim()
    });

    setShowAddModal(false);
    setNotesInput('');
  };

  return (
    <div className="space-y-6">
      <PortfolioDashboard stocks={stocks} positions={positions} />
      <PortfolioReconciliation positions={positions} />
      {/* Portfolio Header Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Value */}
        <div className="bg-[#0A0F1D] border border-slate-800 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>القيمة السوقية الصافية للمحفظة</span>
            <Coins className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-white font-mono-numbers">
            {formatIqd(totalCurrentValue)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            صافية بعد خصم عمولة البيع ISXC
          </div>
        </div>

        {/* Total Profit/Loss */}
        <div className={`bg-[#0A0F1D] border rounded-2xl p-4 shadow-xl ${
          totalProfitIqd >= 0 ? 'border-emerald-500/30 emerald-glow' : 'border-rose-500/30 ruby-glow'
        }`}>
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>الربح / الخسارة الصافية</span>
            {totalProfitIqd >= 0 ? (
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-rose-400" />
            )}
          </div>
          <div className={`text-xl sm:text-2xl font-black font-mono-numbers ${
            totalProfitIqd >= 0 ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            {totalProfitIqd >= 0 ? '+' : ''}{formatIqd(totalProfitIqd)}
          </div>
          <div className={`text-xs font-bold font-mono-numbers mt-1 ${
            totalProfitIqd >= 0 ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            {totalProfitPercent >= 0 ? '+' : ''}{totalProfitPercent.toFixed(2)}% عائد على رأس المال
          </div>
        </div>

        {/* Invested Capital */}
        <div className="bg-[#0A0F1D] border border-slate-800 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>رأس المال المستثمر الفعلي</span>
            <Briefcase className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-200 font-mono-numbers">
            {formatIqd(totalCost)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono-numbers">
            شامل عمولة تقديرية افتراضية 0.76% لكل جانب — تحقق من وسيطك
          </div>
        </div>

        {/* Dividend Income */}
        <div className="bg-[#0A0F1D] border border-slate-800 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>التوزيعات النقدية المتوقعة سنوياً</span>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono-numbers">
            {formatIqd(totalAnnualDividends)}
          </div>
          <div className="text-[11px] text-amber-400/80 mt-1">
            عائد نقدي سنوي تقديري
          </div>
        </div>
      </div>

      {/* Action Row */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-black text-white">المراكز الاستثمارية المفتوحة ({positions.length})</h3>
          <p className="text-xs text-slate-400">متابعة دقيقة لكل سهم مع نقطة التعادل وتوصيات الخروج وإيقاف الخسارة</p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة صفقة جديدة</span>
        </button>
      </div>

      {/* Positions Table */}
      {enrichedPositions.length === 0 ? (
        <div className="bg-[#0A0F1D] border border-slate-800 rounded-2xl p-12 text-center space-y-4">
          <Briefcase className="w-12 h-12 text-slate-600 mx-auto" />
          <h4 className="text-base font-bold text-slate-300">محفظتك الاستثمارية فارغة حالياً</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            أضف صفقاتك الحالية في سوق العراق لحساب الأرباح الصافية بعد العمولة ومتابعة نقاط التعادل وأهداف البيع المحسوبة.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="py-2 px-4 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> إضافة أول سهم
          </button>
        </div>
      ) : (
        <div className="bg-[#0A0F1D] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#060913] border-b border-slate-800 text-slate-400 select-none">
                <tr>
                  <th className="py-3.5 px-4 font-bold">السهم والشركة</th>
                  <th className="py-3.5 px-3 font-bold font-mono-numbers">الكمية المملوكة</th>
                  <th className="py-3.5 px-3 font-bold font-mono-numbers">سعر الشراء</th>
                  <th className="py-3.5 px-3 font-bold font-mono-numbers">السعر الحالي</th>
                  <th className="py-3.5 px-3 font-bold font-mono-numbers">نقطة التعادل (ISXC)</th>
                  <th className="py-3.5 px-3 font-bold font-mono-numbers">القيمة الحالية</th>
                  <th className="py-3.5 px-3 font-bold font-mono-numbers">الربح الصافي</th>
                  <th className="py-3.5 px-3 font-bold">توصية للمركز</th>
                  <th className="py-3.5 px-4 font-bold text-center">إجراءات</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/60 font-mono-numbers">
                {enrichedPositions.map((pos) => {
                  const stock = pos.stock;
                  const isProfit = pos.profitIqd >= 0;

                  // Dynamic guidance for the position
                  let holdingAdvice = 'استمرار الاحتفاظ';
                  let adviceColor = 'text-slate-300 bg-slate-800';

                  if (stock) {
                    if (pos.currentPrice >= stock.targetPrice1) {
                      holdingAdvice = 'حقق الهدف الأول T1 - يُنصح بجني ربح جزئي';
                      adviceColor = 'text-amber-300 bg-amber-500/20 border border-amber-500/30';
                    } else if (pos.currentPrice <= stock.stopLoss) {
                      holdingAdvice = 'كسر وقف الخسارة - تخفيف المخاطر';
                      adviceColor = 'text-rose-300 bg-rose-500/20 border border-rose-500/30';
                    } else if (stock.recommendationCategory === 'شراء') {
                      holdingAdvice = 'اتجاه صاعد - تعزيز التجميع';
                      adviceColor = 'text-emerald-300 bg-emerald-500/20 border border-emerald-500/30';
                    }
                  }

                  return (
                    <tr key={pos.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-amber-400 text-sm">{pos.symbol}</span>
                          <div>
                            <span className="text-white font-medium font-sans block">{stock?.nameAr || pos.symbol}</span>
                            <span className="text-[10px] text-slate-500 font-sans">{pos.buyDate}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 font-bold text-slate-200">
                        {formatNumber(pos.shares, 0)} سهم
                      </td>

                      <td className="py-3.5 px-3 text-slate-300">
                        {pos.averageBuyPrice.toFixed(3)} د.ع
                      </td>

                      <td className="py-3.5 px-3 font-bold text-white text-sm">
                        {pos.currentPrice.toFixed(3)} د.ع
                      </td>

                      <td className="py-3.5 px-3 text-amber-300">
                        {pos.breakevenPrice.toFixed(3)} د.ع
                      </td>

                      <td className="py-3.5 px-3 font-bold text-slate-200">
                        {formatIqd(pos.netCurrentValue)}
                      </td>

                      <td className="py-3.5 px-3">
                        <div className={`font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isProfit ? '+' : ''}{formatIqd(pos.profitIqd)}
                        </div>
                        <div className={`text-[10px] ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isProfit ? '+' : ''}{pos.profitPercent.toFixed(2)}%
                        </div>
                      </td>

                      <td className="py-3.5 px-3 font-sans">
                        <span className={`px-2 py-1 rounded-lg text-[11px] font-bold inline-block ${adviceColor}`}>
                          {holdingAdvice}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {stock && (
                            <>
                              <button
                                onClick={() => onSelectStock(stock)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                                title="تحليل معمق"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onSendToCalculator(stock, pos.shares, pos.averageBuyPrice)}
                                className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400"
                                title="حساب الأهداف ونقطة التعادل"
                              >
                                <Calculator className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => onRemovePosition(pos.id)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
                            title="حذف المركز"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
      )}

      {/* Add Position Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0A0E1A] border border-slate-700 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="text-base font-black text-white flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-amber-400" />
                إضافة صفقة إلى المحفظة
              </h4>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-slate-300 block mb-1">اختر السهم من سوق العراق</label>
                <select
                  value={selectedSymbol}
                  onChange={(e) => {
                    setSelectedSymbol(e.target.value);
                    const st = getStock(e.target.value);
                    if (st) setPriceInput(st.currentPrice.toString());
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
                  <label className="text-xs text-slate-300 block mb-1">عدد الأسهم</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={sharesInput}
                    onChange={(e) => setSharesInput(e.target.value)}
                    className="w-full bg-[#050811] border border-slate-700 rounded-xl p-2.5 text-xs text-white font-mono-numbers focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 block mb-1">سعر الشراء (د.ع)</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    className="w-full bg-[#050811] border border-slate-700 rounded-xl p-2.5 text-xs text-white font-mono-numbers focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">ملاحظات الصفقة (اختياري)</label>
                <input
                  type="text"
                  placeholder="مثال: شراء استثماري لتوزيعات الأرباح"
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  className="w-full bg-[#050811] border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black"
                >
                  حفظ المركز
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
