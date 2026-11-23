import React, { lazy, Suspense, useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { TickerBar } from './components/TickerBar';
import { Navigation } from './components/Navigation';

// Load secondary workspaces only when selected.
const RecommendationsView = lazy(() => import('./components/RecommendationsView').then((module) => ({ default: module.RecommendationsView })));
const MarketDirectory = lazy(() => import('./components/MarketDirectory').then((module) => ({ default: module.MarketDirectory })));
const PortfolioView = lazy(() => import('./components/PortfolioView').then((module) => ({ default: module.PortfolioView })));
const FeeCalculator = lazy(() => import('./components/FeeCalculator').then((module) => ({ default: module.FeeCalculator })));
const BankAnalyticsView = lazy(() => import('./components/BankAnalyticsView').then((module) => ({ default: module.BankAnalyticsView })));
const TopMoversView = lazy(() => import('./components/TopMoversView').then((module) => ({ default: module.TopMoversView })));
const MarketIntelligenceView = lazy(() => import('./components/MarketIntelligenceView').then((module) => ({ default: module.MarketIntelligenceView })));
const InvestorIntelligenceView = lazy(() => import('./components/InvestorIntelligenceView').then((module) => ({ default: module.InvestorIntelligenceView })));
const InvestorHubView = lazy(() => import('./components/InvestorHubView').then((module) => ({ default: module.InvestorHubView })));
const AccountStatementView = lazy(() => import('./components/AccountStatementView').then((module) => ({ default: module.AccountStatementView })));
const StockDetailModal = lazy(() => import('./components/StockDetailModal').then((module) => ({ default: module.StockDetailModal })));
const AlertsModal = lazy(() => import('./components/AlertsModal').then((module) => ({ default: module.AlertsModal })));

import { STOCKS_DATA, mapRawStocks } from './data/stocksData';
import { Stock, PortfolioPosition, PriceAlert } from './types/stock';
import type { PortfolioTransaction } from './types/portfolio';
import { calculatePortfolioLedger } from './utils/portfolioLedger';
import { validatePortfolioBackup } from './utils/portfolioBackup';
import { getMarketPulse } from './utils/marketPulse';
import { ShieldCheck, Info, ExternalLink } from 'lucide-react';

export default function App() {
  const [stocks, setStocks] = useState<Stock[]>(STOCKS_DATA);
  const [isManualUpdating, setIsManualUpdating] = useState(false);
  const [lastManualUpdate, setLastManualUpdate] = useState('');
  const [manualUpdateMessage, setManualUpdateMessage] = useState('');
  const [activeView, setActiveView] = useState<string>('recommendations');
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [isAlertsOpen, setIsAlertsOpen] = useState<boolean>(false);
  const [calculatorContext, setCalculatorContext] = useState<{
    stock: Stock | null;
    shares?: number;
    buyPrice?: number;
  }>({
    stock: null,
  });

  // Transaction ledger is the source of truth. Migrate legacy positions once as opening BUY entries.
  const [transactions, setTransactions] = useState<PortfolioTransaction[]>(() => {
    try {
      const savedLedger = localStorage.getItem('ninurta.portfolio.transactions.v1');
      if (savedLedger) {
        const parsed = JSON.parse(savedLedger);
        if (Array.isArray(parsed)) return parsed;
      }
      const legacyRaw = localStorage.getItem('ninurta_isx_positions');
      const legacy = legacyRaw ? JSON.parse(legacyRaw) : [];
      if (!Array.isArray(legacy)) return [];
      return legacy.filter((p:any) => p && !['pos-1','pos-2','pos-3'].includes(p.id) && p.symbol && Number(p.shares)>0 && Number(p.averageBuyPrice)>0).map((p:any) => ({
        id:`migration-${p.id}`, symbol:p.symbol, type:'BUY' as const, quantity:Number(p.shares), price:Number(p.averageBuyPrice), commission:0,
        date:/^\d{4}-\d{2}-\d{2}$/.test(p.buyDate||'')?p.buyDate:new Date().toISOString().slice(0,10), notes:`ترحيل رصيد قديم: ${p.notes||''}`,
        createdAt:`${p.buyDate||'1970-01-01'}T00:00:00.000Z`, source:'legacy-migration' as const
      }));
    } catch { return []; }
  });
  const ledger = useMemo(() => calculatePortfolioLedger(transactions), [transactions]);
  const positions: PortfolioPosition[] = useMemo(() => ledger.positions.map(p => ({
    id:`ledger-${p.symbol}`, symbol:p.symbol, shares:p.shares, averageBuyPrice:p.averageBuyPrice, totalCost:p.totalCost, buyDate:p.firstBuyDate,
    notes:'مركز مشتق تلقائياً من سجل العمليات'
  })), [ledger]);

  useEffect(() => {
    try { localStorage.setItem('ninurta.portfolio.transactions.v1', JSON.stringify(transactions)); } catch {}
  }, [transactions]);

  // Local storage for price alerts
  const [alerts, setAlerts] = useState<PriceAlert[]>(() => {
    try {
      const saved = localStorage.getItem('ninurta_isx_alerts');
      const parsed = saved ? JSON.parse(saved) : [];
      if (!Array.isArray(parsed)) return [];
      // Remove legacy seeded demo alerts from earlier app versions.
      return parsed.filter((item) => !['alert-1', 'alert-2'].includes(item?.id));
    } catch {
      return [];
    }
  });


  // Persist alerts
  useEffect(() => {
    try {
      localStorage.setItem('ninurta_isx_alerts', JSON.stringify(alerts));
    } catch {}
  }, [alerts]);

  // Check alert triggers against stock prices
  useEffect(() => {
    setAlerts(prev => prev.map(a => {
      const stock = stocks.find(s => s.symbol === a.symbol);
      if (!stock || a.triggered || !stock.dataQuality || stock.dataQuality.level === 'insufficient') return a;
      const isTriggered = a.condition === 'ABOVE'
        ? stock.currentPrice >= a.targetPrice
        : stock.currentPrice <= a.targetPrice;
      return isTriggered ? { ...a, triggered: true } : a;
    }));
  }, [stocks]);

  // Manual refresh is handled by the local Vite middleware; no external service or paid API.
  const handleManualUpdate = async () => {
    if (isManualUpdating) return;
    setIsManualUpdating(true);
    setManualUpdateMessage('جارٍ جلب أسعار السوق والتحقق منها...');
    try {
      const response = await fetch('/__ninurta/manual-update', { method: 'POST' });
      const payload = await response.json();
      if (!response.ok || !payload?.ok || !Array.isArray(payload?.stocks)) {
        throw new Error(payload?.error || 'تعذر إكمال تحديث السوق');
      }
      setStocks(mapRawStocks(payload.stocks));
      const stamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Baghdad' });
      setLastManualUpdate(stamp);
      setManualUpdateMessage(payload.message || 'تم تحديث الأسعار بنجاح.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'حدث خطأ غير معروف';
      setManualUpdateMessage(`فشل التحديث: ${message}`);
    } finally {
      setIsManualUpdating(false);
    }
  };

  // Handlers
  const handleAddTransaction = (newTx: Omit<PortfolioTransaction, 'id' | 'createdAt'>): boolean => {
    const tx: PortfolioTransaction = { ...newTx, id:`txn-${Date.now()}-${Math.random().toString(36).slice(2,8)}`, createdAt:new Date().toISOString() };
    const candidate = calculatePortfolioLedger([...transactions, tx]);
    if (candidate.errors.length) return false;
    setTransactions(prev => [...prev, tx]);
    return true;
  };

  const handleUpdateTransaction = (id: string, changes: Omit<PortfolioTransaction, 'id' | 'createdAt'>): boolean => {
    const candidate = transactions.map(tx => tx.id === id ? {...tx, ...changes} : tx);
    if (!transactions.some(tx => tx.id === id) || calculatePortfolioLedger(candidate).errors.length) return false;
    setTransactions(candidate);
    return true;
  };
  const handleDeleteTransaction = (id: string): boolean => {
    const candidate = transactions.filter(tx => tx.id !== id);
    if (candidate.length === transactions.length || calculatePortfolioLedger(candidate).errors.length) return false;
    setTransactions(candidate);
    return true;
  };
  const handleReplaceTransactions = (candidate: PortfolioTransaction[]): boolean => {
    const checked = validatePortfolioBackup({ schema:'ninurta-portfolio-backup', version:1, exportedAt:new Date().toISOString(), transactions:candidate });
    if (!checked.valid) return false;
    setTransactions(checked.transactions);
    return true;
  };

  // Compatibility adapter for existing "add to portfolio" entry points: create a BUY transaction.
  const handleAddPosition = (newPos: Omit<PortfolioPosition, 'id'>) => {
    const gross = newPos.shares * newPos.averageBuyPrice;
    handleAddTransaction({ symbol:newPos.symbol, type:'BUY', quantity:newPos.shares, price:newPos.averageBuyPrice,
      commission:0, date:newPos.buyDate, notes:newPos.notes, source:'manual' });
  };


  const handleAddAlert = (newAlert: Omit<PriceAlert, 'id' | 'createdAt' | 'triggered'>) => {
    const alert: PriceAlert = {
      ...newAlert,
      id: `alert-${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
      triggered: false
    };
    setAlerts(prev => [alert, ...prev]);
  };

  const handleRemoveAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const handleSendToCalculator = (stock: Stock, shares?: number, buyPrice?: number) => {
    setCalculatorContext({ stock, shares, buyPrice });
    setActiveView('calculator');
  };

  const handleAddToPortfolio = (stock: Stock) => {
    handleAddPosition({
      symbol: stock.symbol,
      shares: 100000,
      averageBuyPrice: stock.currentPrice,
      buyDate: new Date().toISOString().split('T')[0],
      notes: `تمت الإضافة من توصية ${stock.signal}`
    });
    setActiveView('portfolio');
  };

  const handleSetAlert = (stock: Stock) => {
    setSelectedStock(stock);
    setIsAlertsOpen(true);
  };

  // Recommendations count summary
  const recommendationsCount = useMemo(() => {
    return {
      buy: stocks.filter(s => getMarketPulse(s).direction === 'positive').length,
      speculate: stocks.filter(s => s.recommendationCategory === 'مضاربة').length,
      wait: stocks.filter(s => s.recommendationCategory === 'انتظار').length,
      sell: stocks.filter(s => s.recommendationCategory === 'بيع').length,
    };
  }, [stocks]);

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top Header */}
      <Header
        stocks={stocks}
        alerts={alerts}
        onOpenAlerts={() => setIsAlertsOpen(true)}
        onSelectStock={(st) => setSelectedStock(st)}
        activeView={activeView}
        onNavigate={(view) => setActiveView(view)}
        onManualUpdate={handleManualUpdate}
        isUpdating={isManualUpdating}
        lastUpdateLabel={lastManualUpdate}
      />

      {manualUpdateMessage && (
        <div role="status" aria-live="polite" className={`px-4 py-2 text-xs text-center border-b ${manualUpdateMessage.startsWith('فشل') ? 'bg-rose-950/40 border-rose-900 text-rose-300' : 'bg-emerald-950/30 border-emerald-900/60 text-emerald-300'}`}>
          {manualUpdateMessage}
        </div>
      )}

      {/* Live Ticker Bar */}
      <TickerBar
        stocks={stocks}
        onSelectStock={(st) => setSelectedStock(st)}
      />

      {/* Secondary Tool Navigation Tabs */}
      <Navigation
        activeView={activeView}
        onNavigate={(view) => setActiveView(view)}
        recommendationsCount={recommendationsCount}
      />

      {/* Main App Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <Suspense fallback={<div role="status" className="min-h-48 flex items-center justify-center text-sm text-slate-400">Loading section...</div>}>
        {activeView === 'recommendations' && (
          <RecommendationsView
            stocks={stocks}
            onSelectStock={(st) => setSelectedStock(st)}
            onSendToCalculator={handleSendToCalculator}
            onAddToPortfolio={handleAddToPortfolio}
            onSetAlert={handleSetAlert}
          />
        )}

        {activeView === 'directory' && (
          <MarketDirectory
            stocks={stocks}
            onSelectStock={(st) => setSelectedStock(st)}
            onSendToCalculator={handleSendToCalculator}
            onAddToPortfolio={handleAddToPortfolio}
          />
        )}

        {activeView === 'portfolio' && (
          <PortfolioView
            stocks={stocks}
            positions={positions}
            transactions={transactions}
            onAddTransaction={handleAddTransaction}
            onSelectStock={(st) => setSelectedStock(st)}
            onSendToCalculator={handleSendToCalculator}
          />
        )}

        {activeView === 'calculator' && (
          <FeeCalculator
            stocks={stocks}
            initialStock={calculatorContext.stock}
            initialShares={calculatorContext.shares}
            initialPrice={calculatorContext.buyPrice}
          />
        )}

        {activeView === 'banks' && (
          <BankAnalyticsView
            stocks={stocks}
            onSelectStock={(st) => setSelectedStock(st)}
            onSendToCalculator={handleSendToCalculator}
          />
        )}

        {activeView === 'investorHub' && <InvestorHubView />}

        {activeView === 'investorIntelligence' && (
          <InvestorIntelligenceView stocks={stocks} positions={positions} transactions={transactions} onAddTransaction={handleAddTransaction} onUpdateTransaction={handleUpdateTransaction} onDeleteTransaction={handleDeleteTransaction} onReplaceTransactions={handleReplaceTransactions} onSelectStock={(st) => setSelectedStock(st)} />
        )}

        {activeView === 'accountStatement' && <AccountStatementView />}

        {activeView === 'marketIntelligence' && (
          <MarketIntelligenceView
            stocks={stocks}
            onSelectStock={(st) => setSelectedStock(st)}
          />
        )}

        {activeView === 'movers' && (
          <TopMoversView
            stocks={stocks}
            onSelectStock={(st) => setSelectedStock(st)}
            onSendToCalculator={handleSendToCalculator}
          />
        )}
        </Suspense>
      </main>

      {/* Load modal code only when a modal is actually opened. */}
      <Suspense fallback={null}>
        {selectedStock && (
          <StockDetailModal
            stock={selectedStock}
            onClose={() => setSelectedStock(null)}
            onSendToCalculator={handleSendToCalculator}
            onAddToPortfolio={handleAddToPortfolio}
            onSetAlert={handleSetAlert}
          />
        )}

        {isAlertsOpen && (
          <AlertsModal
            isOpen={true}
            onClose={() => setIsAlertsOpen(false)}
            alerts={alerts}
            stocks={stocks}
            onAddAlert={handleAddAlert}
            onRemoveAlert={handleRemoveAlert}
            initialStock={selectedStock}
          />
        )}
      </Suspense>

      {/* Financial Terminal Footer */}
      <footer className="mt-auto bg-[#04070E] border-t border-slate-900 py-6 px-4 sm:px-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-right">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center font-black text-amber-400">
              N
            </div>
            <div>
              <div className="text-slate-300 font-bold">
                منصة نينورتا برو للتحليل المالي وسوق العراق (ISX Pro Terminal)
              </div>
              <div className="text-[11px] text-slate-500">
                أداة متخصصة للمستثمر والمضارب لحساب العمولات، استخراج التوصيات ومتابعة المراكز المالية.
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 max-w-xl text-center md:text-left leading-relaxed">
            تنويه: كافة التوصيات والمؤشرات هي أدوات مساعدة لاتخاذ القرار الاستثماري مبنية على بيانات الملف المحمّل، وقد تكون غير مكتملة أو قديمة، ولا تشكل ضماناً للأرباح. تداول بمسؤولية والتزم بوقف الخسارة.
          </div>
        </div>
      </footer>
    </div>
  );
}
