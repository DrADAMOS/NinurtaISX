import type { RabeeTrade } from './rabeeStatement';
import type { PortfolioPosition } from '../types/stock';

export interface ReconciliationRow {
  symbol: string;
  brokerShares: number;
  portfolioShares: number;
  difference: number;
  brokerAverageBuyPrice: number | null;
  status: 'matched' | 'quantity_mismatch' | 'oversold' | 'review_required' | 'no_broker_trades';
  contracts: number;
}
export interface ReconciliationResult {
  rows: ReconciliationRow[];
  duplicateContracts: string[];
  reviewContracts: string[];
  unmatchedPortfolioSymbols: string[];
  totalBuyGross: number;
  totalSellGross: number;
  totalCommission: number;
  totalNetBuy: number;
  totalNetSell: number;
}

const validNumber = (n: number) => Number.isFinite(n) && n >= 0;

export function reconcilePortfolio(positions: PortfolioPosition[], trades: RabeeTrade[]): ReconciliationResult {
  const contractCounts = new Map<string, number>();
  for (const trade of trades) contractCounts.set(trade.contractNo, (contractCounts.get(trade.contractNo) || 0) + 1);
  const duplicateContracts = [...contractCounts].filter(([, count]) => count > 1).map(([contract]) => contract);
  const reviewContracts = trades.filter(t => t.side === 'REVIEW' || t.confidence !== 'high' || !t.ticker || !validNumber(t.quantity) || t.quantity <= 0 || !validNumber(t.price) || t.price <= 0).map(t => t.contractNo);

  const symbols = new Set([...positions.map(p => p.symbol), ...trades.filter(t => t.side !== 'REVIEW').map(t => t.ticker).filter(Boolean)]);
  const rows: ReconciliationRow[] = [...symbols].sort().map(symbol => {
    const symbolTrades = trades.filter(t => t.ticker === symbol && t.side !== 'REVIEW' && !duplicateContracts.includes(t.contractNo) && !reviewContracts.includes(t.contractNo)).sort((a,b) => a.date.localeCompare(b.date) || a.contractNo.localeCompare(b.contractNo));
    let shares = 0;
    let buyCost = 0;
    let bought = 0;
    let oversold = false;
    for (const trade of symbolTrades) {
      if (trade.side === 'BUY') { shares += trade.quantity; bought += trade.quantity; buyCost += trade.netValue > 0 ? trade.netValue : trade.grossValue + trade.commission; }
      else if (trade.side === 'SELL') { shares -= trade.quantity; if (shares < -1e-8) oversold = true; }
    }
    const portfolioShares = positions.filter(p => p.symbol === symbol).reduce((sum,p) => sum + p.shares, 0);
    const hasTrades = symbolTrades.length > 0;
    const difference = portfolioShares - Math.max(0, shares);
    const status: ReconciliationRow['status'] = oversold ? 'oversold' : !hasTrades ? 'no_broker_trades' : duplicateContracts.length || reviewContracts.length ? 'review_required' : Math.abs(difference) < 1e-6 ? 'matched' : 'quantity_mismatch';
    return { symbol, brokerShares: Math.max(0, shares), portfolioShares, difference, brokerAverageBuyPrice: bought > 0 ? buyCost / bought : null, status, contracts: symbolTrades.length };
  });
  return {
    rows, duplicateContracts, reviewContracts,
    unmatchedPortfolioSymbols: positions.map(p => p.symbol).filter(s => !trades.some(t => t.ticker === s)),
    totalBuyGross: trades.filter(t=>t.side==='BUY').reduce((s,t)=>s+t.grossValue,0),
    totalSellGross: trades.filter(t=>t.side==='SELL').reduce((s,t)=>s+t.grossValue,0),
    totalCommission: trades.reduce((s,t)=>s+t.commission,0),
    totalNetBuy: trades.filter(t=>t.side==='BUY').reduce((s,t)=>s+t.netValue,0),
    totalNetSell: trades.filter(t=>t.side==='SELL').reduce((s,t)=>s+t.netValue,0),
  };
}
