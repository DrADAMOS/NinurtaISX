import test from 'node:test';
import assert from 'node:assert/strict';
import { findDuplicateFingerprints, isValidStatementDate, statementFingerprint } from '../src/utils/statementImport';

const row = (overrides: Partial<{date:string;description:string;debit:number;credit:number}> = {}) => ({
  date: '2026-10-25', description: 'سحب نقدي ATM', debit: 25000, credit: 0, ...overrides,
});

test('fingerprint normalizes Arabic letter variants and spacing', () => {
  assert.equal(statementFingerprint(row({ description: 'إيداع   نقدي' })), statementFingerprint(row({ description: 'ايداع نقدي' })));
});

test('detects exact duplicates against saved entries', () => {
  const duplicate = findDuplicateFingerprints([row()], [row()]);
  assert.equal(duplicate.has(statementFingerprint(row())), true);
});

test('detects repeated rows within the same imported file', () => {
  const duplicate = findDuplicateFingerprints([row(), row()]);
  assert.equal(duplicate.has(statementFingerprint(row())), true);
});

test('does not flag transactions with different dates or amounts', () => {
  const duplicate = findDuplicateFingerprints([row({ debit: 26000 })], [row()]);
  assert.equal(duplicate.size, 0);
});

test('validates real ISO dates and rejects impossible calendar dates', () => {
  assert.equal(isValidStatementDate('2024-02-29'), true);
  assert.equal(isValidStatementDate('2026-02-29'), false);
  assert.equal(isValidStatementDate('25/10/2026'), false);
});
