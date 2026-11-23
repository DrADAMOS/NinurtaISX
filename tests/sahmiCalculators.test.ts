import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAGMEntitlement, calculateAffordableShares, calculateAveragePurchase,
  calculateDividendYield, calculateDistribution, calculateEPS, calculateFairValue,
  calculateIndicativePrice, calculatePE, calculateROE, calculateTradeNet,
} from '../src/utils/sahmiCalculators';

test('fair value and EPS use capital/par shares', () => {
  const result = calculateFairValue(100_000_000, 1_000_000_000, 1, 8);
  assert.deepEqual(result, { shares: 1_000_000_000, eps: 0.1, fairValue: 0.8 });
  assert.equal(calculateEPS(100_000_000, 1_000_000_000, 1), 0.1);
  assert.equal(calculatePE(1, 100_000_000, 1_000_000_000, 1), 10);
  assert.equal(calculateFairValue(-1, 100, 1, 8), null);
});

test('distribution and AGM entitlements are calculated independently', () => {
  assert.deepEqual(calculateDistribution(1000, 10, 1, 20), { cashPerShare: 0.1, totalCash: 100, bonusShares: 200 });
  assert.deepEqual(calculateAGMEntitlement(1000, 0.1, 20), { cash: 100, bonusShares: 200 });
});

test('weighted average purchase uses shares bought at each price', () => {
  const result = calculateAveragePurchase(1000, 10, 1000, 20);
  assert.deepEqual(result, { shares: 150, averagePrice: 2000 / 150 });
  assert.equal(calculateAveragePurchase(0, 10, 0, 20), null);
});

test('affordable share count includes the buy-side fee', () => {
  assert.deepEqual(calculateAffordableShares(1000, 10, 0.6), { shares: 99, usedBudget: 995.94 });
  assert.equal(calculateAffordableShares(100, 10, 100), null);
});

test('trade net includes both sides fees', () => {
  const result = calculateTradeNet(100, 10, 11, 0.6, 0.6)!;
  assert.equal(result.buyFee, 6);
  assert.equal(result.sellFee, 6.6);
  assert.ok(Math.abs(result.net - 87.4) < 1e-9);
});

test('indicative price, ROE and dividend yield validate denominators', () => {
  assert.equal(calculateIndicativePrice(10, -10), 9);
  assert.equal(calculateIndicativePrice(10, -101), null);
  assert.equal(calculateROE(-20, 100), -20);
  assert.equal(calculateROE(20, 0), null);
  assert.equal(calculateDividendYield(0.5, 10), 5);
  assert.equal(calculateDividendYield(0.5, 0), null);
});
