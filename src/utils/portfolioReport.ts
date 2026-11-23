import type { PortfolioPosition, Stock } from '../types/stock';
import { ISXC_COMMISSION_RATE } from './calculator';

export interface PortfolioReportRow {
  symbol: string; name: string; shares: number; averageBuyPrice: number;
  currentPrice: number; investedGross: number; estimatedBuyFee: number;
  marketGross: number; estimatedSellFee: number; marketNet: number;
  unrealizedNet: number; returnPercent: number; source: string;
}
export interface PortfolioReport {
  generatedAt: string; rows: PortfolioReportRow[]; invested: number;
  marketValueNet: number; unrealizedNet: number; returnPercent: number;
  missingQuotes: string[];
}
export function buildPortfolioReport(positions: PortfolioPosition[], stocks: Stock[], generatedAt = new Date().toISOString()): PortfolioReport {
  const rows = positions.map((position): PortfolioReportRow => {
    const stock = stocks.find(item => item.symbol === position.symbol);
    const currentPrice = stock?.currentPrice ?? position.averageBuyPrice;
    const investedGross = position.shares * position.averageBuyPrice;
    const estimatedBuyFee = investedGross * ISXC_COMMISSION_RATE;
    const marketGross = position.shares * currentPrice;
    const estimatedSellFee = marketGross * ISXC_COMMISSION_RATE;
    const invested = investedGross + estimatedBuyFee;
    const marketNet = marketGross - estimatedSellFee;
    return {
      symbol: position.symbol, name: stock?.nameAr || position.symbol,
      shares: position.shares, averageBuyPrice: position.averageBuyPrice,
      currentPrice, investedGross, estimatedBuyFee, marketGross, estimatedSellFee,
      marketNet, unrealizedNet: marketNet - invested,
      returnPercent: invested > 0 ? ((marketNet - invested) / invested) * 100 : 0,
      source: stock?.source || (stock ? 'بيانات السهم المحلية' : 'سعر الشراء المستخدم لغياب السعر الحالي'),
    };
  });
  const invested = rows.reduce((sum, row) => sum + row.investedGross + row.estimatedBuyFee, 0);
  const marketValueNet = rows.reduce((sum, row) => sum + row.marketNet, 0);
  const unrealizedNet = marketValueNet - invested;
  return { generatedAt, rows, invested, marketValueNet, unrealizedNet, returnPercent: invested > 0 ? unrealizedNet / invested * 100 : 0, missingQuotes: rows.filter(row => row.source === 'سعر الشراء المستخدم لغياب السعر الحالي').map(row => row.symbol) };
}
