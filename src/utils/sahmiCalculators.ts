export type FairValueResult = { shares: number; eps: number; fairValue: number } | null;
export function calculateFairValue(netProfit: number, capital: number, parValue: number, targetPE: number): FairValueResult {
  if (![netProfit, capital, parValue, targetPE].every(Number.isFinite) || netProfit <= 0 || capital <= 0 || parValue <= 0 || targetPE <= 0) return null;
  const shares = capital / parValue;
  const eps = netProfit / shares;
  return { shares, eps, fairValue: eps * targetPE };
}
export function calculateDistribution(shares: number, cashPercent: number, parValue: number, bonusPercent: number) {
  if (![shares, cashPercent, parValue, bonusPercent].every(Number.isFinite) || shares < 0 || cashPercent < 0 || parValue <= 0 || bonusPercent < 0) return null;
  return { cashPerShare: cashPercent / 100 * parValue, totalCash: shares * cashPercent / 100 * parValue, bonusShares: shares * bonusPercent / 100 };
}
export function calculateAveragePurchase(amount1: number, price1: number, amount2: number, price2: number) {
  if (![amount1, price1, amount2, price2].every(Number.isFinite) || amount1 < 0 || amount2 < 0 || price1 <= 0 || price2 <= 0) return null;
  const shares = amount1 / price1 + amount2 / price2;
  return shares > 0 ? { shares, averagePrice: (amount1 + amount2) / shares } : null;
}
export function calculateAffordableShares(budget: number, price: number, feePercent: number) {
  if (![budget, price, feePercent].every(Number.isFinite) || budget < 0 || price <= 0 || feePercent < 0 || feePercent >= 100) return null;
  const shares = Math.floor(budget / (price * (1 + feePercent / 100)));
  return { shares, usedBudget: shares * price * (1 + feePercent / 100) };
}
export function calculateTradeNet(shares: number, buyPrice: number, sellPrice: number, buyFeePercent: number, sellFeePercent: number) {
  if (![shares, buyPrice, sellPrice, buyFeePercent, sellFeePercent].every(Number.isFinite) || shares < 0 || buyPrice < 0 || sellPrice < 0 || buyFeePercent < 0 || sellFeePercent < 0 || buyFeePercent >= 100 || sellFeePercent >= 100) return null;
  const buyGross = shares * buyPrice, sellGross = shares * sellPrice;
  const buyFee = buyGross * buyFeePercent / 100, sellFee = sellGross * sellFeePercent / 100;
  return { buyGross, sellGross, buyFee, sellFee, totalFees: buyFee + sellFee, net: sellGross - sellFee - buyGross - buyFee };
}
export function calculateIndicativePrice(referencePrice: number, changePercent: number) {
  if (![referencePrice, changePercent].every(Number.isFinite) || referencePrice < 0 || changePercent < -100) return null;
  return referencePrice * (1 + changePercent / 100);
}
export function calculateAGMEntitlement(shares: number, cashPerShare: number, bonusPercent: number) {
  if (![shares, cashPerShare, bonusPercent].every(Number.isFinite) || shares < 0 || cashPerShare < 0 || bonusPercent < 0) return null;
  return { cash: shares * cashPerShare, bonusShares: shares * bonusPercent / 100 };
}
export function calculatePE(price: number, netProfit: number, capital: number, parValue: number) {
  const fv = calculateFairValue(netProfit, capital, parValue, 1);
  if (!fv || !Number.isFinite(price) || price <= 0) return null;
  return price / fv.eps;
}
export function calculateROE(netProfit: number, averageEquity: number) {
  if (![netProfit, averageEquity].every(Number.isFinite) || averageEquity <= 0) return null;
  return netProfit / averageEquity * 100;
}
export function calculateEPS(netProfit: number, capital: number, parValue: number) {
  if (![netProfit, capital, parValue].every(Number.isFinite) || capital <= 0 || parValue <= 0) return null;
  return netProfit / (capital / parValue);
}
export function calculateDividendYield(annualCashPerShare: number, price: number) {
  if (![annualCashPerShare, price].every(Number.isFinite) || annualCashPerShare < 0 || price <= 0) return null;
  return annualCashPerShare / price * 100;
}
