import React, { useState } from 'react';
import { 
  Bell, 
  Trash2, 
  Plus, 
  X, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle2 
} from 'lucide-react';
import { Stock, PriceAlert } from '../types/stock';

interface AlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: PriceAlert[];
  stocks: Stock[];
  onAddAlert: (alert: Omit<PriceAlert, 'id' | 'createdAt' | 'triggered'>) => void;
  onRemoveAlert: (id: string) => void;
  initialStock?: Stock | null;
}

export const AlertsModal: React.FC<AlertsModalProps> = ({
  isOpen,
  onClose,
  alerts,
  stocks,
  onAddAlert,
  onRemoveAlert,
  initialStock
}) => {
  const [selectedSymbol, setSelectedSymbol] = useState(
    initialStock?.symbol || stocks[0]?.symbol || 'BBOB'
  );
  const [targetPrice, setTargetPrice] = useState(
    initialStock ? initialStock.targetPrice1.toString() : '2.800'
  );
  const [condition, setCondition] = useState<'ABOVE' | 'BELOW'>('ABOVE');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(targetPrice);
    if (isNaN(price) || price <= 0) return;

    onAddAlert({
      symbol: selectedSymbol,
      targetPrice: price,
      condition,
      notes: notes.trim()
    });

    setNotes('');
  };

  const currentStock = stocks.find(s => s.symbol === selectedSymbol);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div 
        className="bg-[#0A0E1A] border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-[#070B14] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-black text-white">تنبيهات الأسعار (تُفحص عند تحديث بيانات موثوقة)</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Create Alert Form */}
          <form onSubmit={handleSubmit} className="bg-[#070B14] border border-slate-800 rounded-xl p-4 space-y-3">
            <span className="text-xs font-bold text-slate-200 block">إنشاء تنبيه جديد</span>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">اختر السهم</label>
                <select
                  value={selectedSymbol}
                  onChange={(e) => {
                    setSelectedSymbol(e.target.value);
                    const st = stocks.find(s => s.symbol === e.target.value);
                    if (st) setTargetPrice(st.targetPrice1.toString());
                  }}
                  className="w-full bg-[#050811] border border-slate-700 rounded-xl p-2 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  {stocks.map(s => (
                    <option key={s.symbol} value={s.symbol}>
                      {s.symbol} — {s.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">السعر المستهدف (د.ع)</label>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  className="w-full bg-[#050811] border border-slate-700 rounded-xl p-2 text-xs text-white font-mono-numbers focus:outline-none focus:border-amber-400"
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-[11px] text-slate-400">تنبيه عندما يكون السعر:</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCondition('ABOVE')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${
                    condition === 'ABOVE'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" /> أعلى من أو يساوي
                </button>
                <button
                  type="button"
                  onClick={() => setCondition('BELOW')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${
                    condition === 'BELOW'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <TrendingDown className="w-3.5 h-3.5" /> أدنى من أو يساوي
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                placeholder="ملاحظة التنبيه (مثال: وصول الهدف الأول لجني الأرباح)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="flex-1 bg-[#050811] border border-slate-700 rounded-xl p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> إضافة
              </button>
            </div>
          </form>

          {/* Active Alerts List */}
          <div>
            <h4 className="text-xs font-bold text-slate-300 mb-2">
              التنبيهات الحالية ({alerts.length})
            </h4>

            {alerts.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-500">
                لا توجد تنبيهات نشطة حالياً. أضف مستويات سعرية لدخول الصفقات أو جني الأرباح ليتم إشعارك فوراً.
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.map((alert) => {
                  const stock = stocks.find(s => s.symbol === alert.symbol);
                  return (
                    <div
                      key={alert.id}
                      className="p-3 rounded-xl bg-[#070B14] border border-slate-800 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono-numbers font-bold text-amber-400">{alert.symbol}</span>
                          <span className="text-white">{stock?.nameAr || alert.symbol}</span>
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            alert.condition === 'ABOVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                          }`}>
                            {alert.condition === 'ABOVE' ? '≥' : '≤'} {alert.targetPrice.toFixed(3)} د.ع
                          </span>
                        </div>
                        {alert.notes && (
                          <div className="text-[11px] text-slate-400 mt-0.5">{alert.notes}</div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-left font-mono-numbers text-[11px] text-slate-400">
                          حالي: {stock?.currentPrice.toFixed(3) || '—'}
                        </div>
                        <button
                          onClick={() => onRemoveAlert(alert.id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
                          title="حذف التنبيه"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
