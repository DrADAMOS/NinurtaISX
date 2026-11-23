import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateBankAssessment, type BankFinancialSnapshot, type BankMetricKey } from '../src/utils/bankScoring';

const reportDate = '2026-09-30';
const source = (value: number) => ({
  value,
  asOf: reportDate,
  sourceName: 'Audited annual report',
  sourceUrl: 'https://example.com/report.pdf',
});

function completeSnapshot(
  overrides: Partial<BankFinancialSnapshot> = {},
): BankFinancialSnapshot {
  const baseMetrics: Partial<Record<BankMetricKey, ReturnType<typeof source>>> = {
    npl: source(1),
    nplCoverage: source(120),
    roe: source(20),
    roa: source(2),
    car: source(30),
    liquidAssetsToDeposits: source(40),
    pe: source(6),
    pb: source(1),
    profitGrowthYoY: source(20),
    equityGrowthYoY: source(20),
    dividendYield: source(10),
    dividendYears: source(5),
  };

  return {
    symbol: 'BNOI',
    reportPeriod: 'FY2025',
    reportDate,
    audited: true,
    ...overrides,
    // Merge overrides into the fixture; do not accidentally overwrite them.
    metrics: { ...baseMetrics, ...(overrides.metrics ?? {}) },
  };
}

function group(
  assessment: ReturnType<typeof calculateBankAssessment>,
  key: string,
) {
  const result = assessment.groups.find((item) => item.key === key);
  assert.ok(result, `missing group ${key}`);
  return result;
}

test('complete sourced audited snapshot receives a bounded assessment', () => {
  const result = calculateBankAssessment(completeSnapshot());
  assert.equal(result.eligible, true);
  assert.equal(result.fundamentalScore, 100);
  assert.equal(result.riskScore, 0);
  assert.ok(result.fundamentalScore !== null && result.fundamentalScore >= 0 && result.fundamentalScore <= 100);
  assert.equal(result.coverage, 100);
});

test('metrics without source metadata are ignored', () => {
  const result = calculateBankAssessment(completeSnapshot({
    metrics: {
      npl: { value: 1, asOf: reportDate, sourceName: '', sourceUrl: '' },
    },
  }));
  const assetQuality = group(result, 'assetQuality');
  assert.equal(assetQuality.available, 1);
  assert.equal(assetQuality.score, 100);
  assert.equal(result.coverage, 88);
});

test('unaudited reports cannot be eligible even when values are sourced', () => {
  const result = calculateBankAssessment(completeSnapshot({ audited: false }));
  assert.equal(result.eligible, false);
  assert.equal(result.fundamentalScore, null);
});

test('non-positive valuation multiples are not scored', () => {
  const result = calculateBankAssessment(completeSnapshot({
    metrics: { pe: source(0), pb: source(-1) },
  }));
  assert.equal(group(result, 'valuation').available, 0);
  assert.equal(group(result, 'valuation').score, null);
  assert.equal(result.eligible, false);
});

test('stale metrics reduce confidence across the whole snapshot', () => {
  const staleMetrics: Partial<Record<BankMetricKey, ReturnType<typeof source>>> = {};
  for (const key of [
    'npl', 'nplCoverage', 'roe', 'roa', 'car', 'liquidAssetsToDeposits',
    'pe', 'pb', 'profitGrowthYoY', 'equityGrowthYoY', 'dividendYield', 'dividendYears',
  ] as BankMetricKey[]) {
    staleMetrics[key] = { ...source(10), asOf: '2024-01-01' };
  }
  const result = calculateBankAssessment(completeSnapshot({ metrics: staleMetrics }));
  assert.ok(result.confidence < 80);
  assert.equal(result.eligible, false);
  assert.equal(result.fundamentalScore, null);
});

test('future-dated metric is ignored', () => {
  const result = calculateBankAssessment(completeSnapshot({
    metrics: { npl: { ...source(1), asOf: '2026-10-01' } },
  }));
  const assetQuality = group(result, 'assetQuality');
  assert.equal(assetQuality.available, 1);
  assert.equal(assetQuality.score, 100);
  assert.equal(result.coverage, 88);
  // The observation is after the filing date, so it is excluded and the
  // snapshot is not promoted to an eligible ranking entry.
  assert.equal(result.eligible, false);
  assert.equal(result.fundamentalScore, null);
});
