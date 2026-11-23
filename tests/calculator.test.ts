import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateISXCFees, categorizeRecommendation } from '../src/utils/calculator';

test('fee calculator rejects invalid quantities and prices', () => {
  assert.throws(() => calculateISXCFees(0, 2.5), /shares/);
  assert.throws(() => calculateISXCFees(-10, 2.5), /shares/);
  assert.throws(() => calculateISXCFees(10.5, 2.5), /whole number/);
  assert.throws(() => calculateISXCFees(10, 0), /buyPrice/);
  assert.throws(() => calculateISXCFees(10, Number.NaN), /buyPrice/);
});

test('fee calculator rejects invalid commission rates', () => {
  assert.throws(() => calculateISXCFees(1000, 2.5, -0.01), /commissionRate/);
  assert.throws(() => calculateISXCFees(1000, 2.5, 1), /commissionRate/);
  assert.throws(() => calculateISXCFees(1000, 2.5, Number.NaN), /commissionRate/);
});

test('breakeven is rounded to a valid tick and covers total fees', () => {
  const r = calculateISXCFees(100000, 2.58, 0.006, 0.001);
  assert.equal(Math.round(r.breakevenSellPrice / 0.001), r.breakevenSellPrice / 0.001);
  const net = 100000 * r.breakevenSellPrice * (1 - 0.006);
  assert.ok(net >= r.totalBuyCost);
});

test('displayed target prices reproduce or exceed the stated net profit target', () => {
  const r = calculateISXCFees(100000, 2.58, 0.006, 0.001);
  for (const target of r.sellTargets) {
    const actualNet = 100000 * target.sellPrice * (1 - 0.006);
    assert.ok(actualNet >= r.totalBuyCost * (1 + target.targetPercent / 100) - 1);
  }
});

test('neutral and avoid source signals are never promoted to buy by high scores', () => {
  assert.equal(categorizeRecommendation('انتظار', 99, 99, 50, 5, 10).category, 'انتظار');
  assert.equal(categorizeRecommendation('تجنب', 99, 99, 50, 5, 10).category, 'بيع');
  assert.equal(categorizeRecommendation('', 99, 99, 50, 5, 10).category, 'انتظار');
});

test('only explicit source buy signals can produce a buy category', () => {
  assert.equal(categorizeRecommendation('شراء قوي', 80, 20, 50, 20, 0).category, 'شراء');
  assert.equal(categorizeRecommendation('شراء للمستثمر', 70, 20, 50, 20, 0).category, 'شراء');
  assert.equal(categorizeRecommendation('شراء للمضارب', 20, 75, 50, 20, 0).category, 'مضاربة');
});
