import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBankFinancialImport, mergeBankFinancialSnapshots } from '../src/utils/bankImport';
import { calculateBankAssessment, type BankFinancialSnapshot } from '../src/utils/bankScoring';

const today = new Date().toISOString().slice(0, 10);
const metric = { value: 10, asOf: '2025-12-31', sourceName: 'Test source', sourceUrl: 'https://example.com/report.pdf' };
const snapshot = (symbol: string, reportDate = '2025-12-31'): BankFinancialSnapshot => ({
  symbol, reportPeriod: 'FY2025', reportDate, audited: true,
  metrics: { npl: metric },
});

test('accepts annual and quarterly report periods', () => {
  const result = parseBankFinancialImport({ snapshots: [
    snapshot('BNOI'), { ...snapshot('BIBI'), reportPeriod: 'Q3-2025' },
  ] });
  assert.equal(result.snapshots.length, 2);
  assert.equal(result.rejected.length, 0);
});

test('rejects malformed report period', () => {
  const result = parseBankFinancialImport([{ ...snapshot('BNOI'), reportPeriod: 'FY\\2025' }]);
  assert.equal(result.snapshots.length, 0);
  assert.match(result.rejected[0], /الفترة/);
});

test('rejects metric dated after report date', () => {
  const result = parseBankFinancialImport([{ ...snapshot('BNOI'), metrics: { npl: { ...metric, asOf: '2026-01-02' } } }]);
  assert.equal(result.snapshots.length, 0);
  assert.equal(result.ignoredMetrics, 1);
});

test('rejects malformed HTTPS URLs', () => {
  const result = parseBankFinancialImport([{ ...snapshot('BNOI'), metrics: { npl: { ...metric, sourceUrl: 'https://' } } }]);
  assert.equal(result.snapshots.length, 0);
});

test('merge preserves other banks and rejects same-date overwrite', () => {
  const existing = [snapshot('BNOI'), snapshot('BIBI')];
  const result = mergeBankFinancialSnapshots(existing, [snapshot('BNOI'), snapshot('MANS', '2026-01-01')]);
  assert.deepEqual(result.snapshots.map(x => x.symbol), ['BIBI', 'BNOI', 'MANS']);
  assert.equal(result.conflicts.length, 1);
});

test('does not display provisional scores for unaudited data', () => {
  const result = calculateBankAssessment({ ...snapshot('BNOI'), audited: false });
  assert.equal(result.fundamentalScore, null);
  assert.equal(result.riskScore, null);
  assert.equal(result.eligible, false);
});
