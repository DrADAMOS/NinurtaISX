import test from 'node:test';
import assert from 'node:assert/strict';
import { assessStockDataQuality, getVerifiedCurrentSessionBar, getVerifiedHistoricalPrices } from '../src/utils/dataQuality';

const valid = (date: string, close = 10) => ({
  date, open: 9.5, high: 10.5, low: 9, close, volume: 1000,
});
const verifiedQuoteSource = { source: 'Test quote', sourceUrl: 'https://example.test/quote', retrievedAt: '2026-01-03T10:00:00Z', marketSessionDate: '2026-01-03' };
const verifiedHistorySource = {
  historicalDataVerified: true,
  historicalDataSource: 'Test exchange feed',
  historicalDataSourceUrl: 'https://example.test/history',
  historicalDataRetrievedAt: '2026-01-03T10:00:00+03:00',
};

test('duplicate-date history is flagged but does not downgrade a valid current quote', () => {
  const report = assessStockDataQuality({
    currentPrice: 10, high: 11, low: 9,
    ...verifiedQuoteSource, ...verifiedHistorySource,
    historicalPrices: [valid('2026-01-01'), valid('2026-01-01', 10.2), valid('2026-01-02')],
  });
  assert.equal(report.status, 'verified');
  assert.equal(report.usableHistoricalPrices.length, 1);
  assert.ok(report.issues.some(x => x.startsWith('DUPLICATE_DATES:')));
});

test('incomplete and invalid OHLCV rows are excluded without quarantining a valid quote', () => {
  const invalid = { date: '2026-01-02', open: 10, high: 9, low: 8, close: 9.5, volume: 20 };
  const incomplete = { date: '2026-01-03', close: 9.5 };
  const report = assessStockDataQuality({
    currentPrice: 9, high: 10, low: 8,
    ...verifiedQuoteSource, ...verifiedHistorySource,
    historicalPrices: [valid('2026-01-01'), invalid, incomplete],
  });
  assert.equal(report.status, 'verified');
  assert.equal(report.usableHistoricalPrices.length, 1);
  assert.ok(report.issues.some(x => x.startsWith('INCOMPLETE_OHLCV_ROWS:')));
  assert.ok(report.issues.some(x => x.startsWith('INVALID_OHLCV_ROWS:')));
});

test('crossed order book and current quote conflict are flagged', () => {
  const report = assessStockDataQuality({
    currentPrice: 12, high: 11, low: 9, quoteFieldsRefreshed: ['high', 'low'],
    ...verifiedQuoteSource, ...verifiedHistorySource,
    historicalPrices: [valid('2026-01-01')],
    orderBook: { bids: [{ price: 10.5 }], asks: [{ price: 10.4 }] },
  });
  assert.ok(report.issues.includes('CURRENT_PRICE_OUTSIDE_SESSION_RANGE'));
  assert.ok(report.issues.includes('CROSSED_ORDER_BOOK'));
  assert.ok(report.issues.includes('ORDER_BOOK_SOURCE_TIMESTAMP_NOT_VERIFIED'));
});

test('directory reconciliation warnings do not downgrade current quote quality', () => {
  const report = assessStockDataQuality({
    currentPrice: 10, high: 11, low: 9,
    ...verifiedQuoteSource, ...verifiedHistorySource,
    historicalPrices: [valid('2026-01-01')],
    dataQualityStatus: 'review_required',
    dataQualityIssues: ['DIRECTORY_RECONCILIATION_REVIEW_REQUIRED'],
  });
  assert.equal(report.status, 'verified');
  assert.ok(report.issues.includes('DIRECTORY_RECONCILIATION_REVIEW_REQUIRED'));
});


test('historical OHLCV without its own source provenance is not exposed to charts or indicators', () => {
  const report = assessStockDataQuality({
    currentPrice: 10, high: 11, low: 9,
    source: 'Current quote provider',
    sourceUrl: 'https://example.test/quote',
    retrievedAt: '2026-01-03T10:00:00+03:00',
    marketSessionDate: '2026-01-03',
    historicalPrices: [valid('2026-01-01'), valid('2026-01-02')],
  });
  assert.equal(report.usableHistoricalPrices.length, 0);
  assert.ok(report.issues.includes('HISTORICAL_SOURCE_NOT_VERIFIED'));
});

test('historical OHLCV is eligible only when its own source provenance is explicitly verified', () => {
  const report = assessStockDataQuality({
    currentPrice: 10, high: 11, low: 9,
    ...verifiedHistorySource,
    historicalPrices: [valid('2026-01-01')],
  });
  assert.equal(report.usableHistoricalPrices.length, 1);
  assert.ok(!report.issues.includes('HISTORICAL_SOURCE_NOT_VERIFIED'));
});

test('verified history remains chartable while unrelated recommendation quarantine is resolved separately', () => {
  const stock = {
    currentPrice: 17,
    ...verifiedHistorySource,
    historicalPrices: [valid('2026-01-01'), valid('2026-01-02')],
    dataQualityStatus: 'quarantined',
    dataQualityIssues: ['SOURCE_RECORD_QUARANTINED', 'NO_VERIFIED_FINANCIAL_OR_PRICE_DATA', 'TECHNICAL_LEVELS_MISSING_OR_INVALID'],
  };
  assert.equal(getVerifiedHistoricalPrices(stock).length, 2);
  const report = assessStockDataQuality(stock);
  assert.equal(report.status, 'review_required');
  assert.ok(!report.issues.includes('SOURCE_RECORD_QUARANTINED'));
  assert.ok(report.issues.includes('TECHNICAL_LEVELS_NOT_VERIFIED_FOR_CURRENT_SESSION'));
});

test('unverified historical rows stay hidden even when stale quarantine flags are removed', () => {
  const stock = { historicalPrices: [valid('2026-01-01')], dataQualityIssues: [] };
  assert.equal(getVerifiedHistoricalPrices(stock).length, 0);
});


test('separate audited CSD history is chartable without merging legacy duplicate dates', () => {
  const stock = {
    currentPrice: 2.1,
    historicalPrices: [valid('2026-09-30'), valid('2026-09-30', 10.2)],
    verifiedHistoricalData: {
      verified: true,
      source: 'Iraqi Central Securities Depository — Daily Regular Market Bulletins',
      sourceUrl: 'https://csd.gov.iq/en/category/reports-en/',
      retrievedAt: '2026-11-10T06:45:32+03:00',
    },
    verifiedHistoricalPrices: [
      { date: '2026-11-08', open: 2.05, high: 2.05, low: 2.02, close: 2.02, volume: 4162166 },
      { date: '2026-11-09', open: 2.02, high: 2.12, low: 1.95, close: 2.1, volume: 10398967 },
    ],
  };
  assert.deepEqual(getVerifiedHistoricalPrices(stock).map(x => x.date), ['2026-11-08', '2026-11-09']);
  assert.equal(stock.historicalPrices.length, 2, 'legacy rows remain unchanged');
});


test('official CSD series takes precedence over quarantined legacy duplicate rows', () => {
  const stock = {
    source: 'IQWealth quote snapshot',
    sourceUrl: 'https://example.test/quote',
    retrievedAt: '2026-01-03T10:00:00+03:00',
    marketSessionDate: '2026-01-02',
    currentPrice: 10,
    high: 11,
    low: 9,
    historicalPrices: [valid('2026-01-01'), valid('2026-01-01', 10.2), { date: '2026-01-02', close: 10 }],
    verifiedHistoricalData: {
      verified: true,
      source: 'Official CSD test extract',
      sourceUrl: 'https://csd.gov.iq/test',
      retrievedAt: '2026-01-03T10:00:00+03:00',
    },
    verifiedHistoricalPrices: [valid('2026-01-01'), valid('2026-01-02')],
  };
  const report = assessStockDataQuality(stock);
  assert.equal(report.usableHistoricalPrices.length, 2);
  assert.ok(!report.issues.some(x => x.startsWith('DUPLICATE_DATES:')));
  assert.ok(!report.issues.some(x => x.startsWith('INCOMPLETE_OHLCV_ROWS:')));
});

test('official current-session candle is used only when its close matches current quote', () => {
  const stock = {
    marketSessionDate: '2026-01-02',
    currentPrice: 10,
    verifiedHistoricalData: {
      verified: true,
      source: 'Official CSD test extract',
      sourceUrl: 'https://csd.gov.iq/test',
      retrievedAt: '2026-01-03T10:00:00+03:00',
    },
    verifiedHistoricalPrices: [valid('2026-01-02')],
  };
  assert.equal(getVerifiedCurrentSessionBar(stock)?.date, '2026-01-02');
  assert.equal(getVerifiedCurrentSessionBar({ ...stock, currentPrice: 10.2 }), null);
});


test('missing technical levels do not keep a valid published quote under review', () => {
  const report = assessStockDataQuality({
    currentPrice: 10, high: 11, low: 9, source: 'Official quote',
    sourceUrl: 'https://example.test/quote', retrievedAt: '2026-01-03T10:00:00Z',
    marketSessionDate: '2026-01-03', quoteStatus: 'published',
  });
  assert.equal(report.status, 'verified');
  assert.ok(report.issues.includes('TECHNICAL_LEVELS_NOT_VERIFIED_FOR_CURRENT_SESSION'));
});


test('does not compare a current quote with stale high/low fields from an older session', () => {
  const report = assessStockDataQuality({
    currentPrice: 12, high: 11, low: 9, source: 'Current quote',
    sourceUrl: 'https://example.test/quote', retrievedAt: '2026-01-03T10:00:00Z',
    marketSessionDate: '2026-01-03', quoteFieldsRefreshed: ['currentPrice', 'changePercent'],
  });
  assert.equal(report.status, 'verified');
  assert.ok(!report.issues.includes('CURRENT_PRICE_OUTSIDE_SESSION_RANGE'));
});
