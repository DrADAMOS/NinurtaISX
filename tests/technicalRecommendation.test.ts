import test from 'node:test';
import assert from 'node:assert/strict';
import { assessTechnicalRecommendation } from '../src/utils/technicalRecommendation';

const candles = (count: number, start = '2026-10-01') => Array.from({ length: count }, (_, i) => {
  const d = new Date(`${start}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + i);
  const close = 10 + i * 0.02;
  return { date: d.toISOString().slice(0, 10), open: close - 0.01, high: close + 0.02, low: close - 0.02, close, volume: 1000 };
});
const base = {
  quoteStatus: 'published', listingStatus: 'active', currentPrice: 11.2, transactionsCount: 5,
  marketSessionDate: '2026-11-16',
  verifiedHistoricalData: { verified: true, source: 'CSD official', sourceUrl: 'https://csd.gov.iq/reports' },
};

test('computes a technical reading from at least 20 verified official candles', () => {
  const result = assessTechnicalRecommendation({ ...base, verifiedHistoricalPrices: candles(35) });
  assert.equal(result.status, 'available');
  assert.ok(result.rsi !== null);
  assert.ok(result.sma20 !== null);
});

test('reports exact shortage instead of leaving recommendation pending', () => {
  const result = assessTechnicalRecommendation({ ...base, verifiedHistoricalPrices: candles(8) });
  assert.equal(result.status, 'insufficient_data');
  assert.match(result.reason, /8 جلسة/);
});

test('does not use technical history when quote is suspended', () => {
  const result = assessTechnicalRecommendation({ ...base, quoteStatus: 'suspended', verifiedHistoricalPrices: candles(35) });
  assert.equal(result.status, 'inactive');
});

test('rejects stale official history', () => {
  const result = assessTechnicalRecommendation({ ...base, marketSessionDate: '2026-11-16', verifiedHistoricalPrices: candles(35, '2026-08-01') });
  assert.equal(result.status, 'stale_history');
});
