import test from "node:test";
import assert from "node:assert/strict";
import {
  validateBankSnapshot, assessFundamentalReadiness,
  combineAnalysisAvailability, upsertSnapshot, type BankSnapshot,
} from "../src/banks/fundamentalEngine";
import { calculateBankAssessment } from "../src/utils/bankScoring";

const metric = (value: number) => ({
  value, asOf: "2025-12-31", sourceName: "Audited annual report, page 10",
  sourceUrl: "https://example.gov.iq/report.pdf", method: "reported" as const,
});
const base: BankSnapshot = {
  symbol: "BNOI", reportPeriod: "FY2025", reportDate: "2026-02-24",
  audited: true,
  metrics: {
    car: metric(23.9), npl: metric(3.8), nplCoverage: metric(60),
    roe: metric(32.1), roa: metric(4.7), liquidAssetsToDeposits: metric(57.6),
    pe: metric(5.59), pb: metric(1.8), profitGrowthYoY: metric(22.2),
    equityGrowthYoY: metric(36.9),
  },
};

test("shared validation accepts a valid sourced audited snapshot", () => {
  assert.equal(validateBankSnapshot(base).valid, true);
});

test("shared validation rejects unaudited and non-HTTPS evidence", () => {
  const bad = structuredClone(base);
  bad.audited = false;
  bad.metrics.car!.sourceUrl = "http://example.com/report.pdf";
  const result = validateBankSnapshot(bad);
  assert.equal(result.valid, false);
  assert.ok(result.issues.includes("AUDIT_NOT_CONFIRMED"));
  assert.ok(result.issues.includes("NON_HTTPS_SOURCE"));
});

test("calculated metrics require a visible formula", () => {
  const bad = structuredClone(base);
  bad.metrics.roa!.method = "calculated";
  const result = validateBankSnapshot(bad);
  assert.ok(result.issues.includes("MISSING_CALCULATION_FORMULA"));
});

test("metric after report date is rejected by the shared validator and scorer", () => {
  const bad = structuredClone(base);
  bad.metrics.car!.asOf = "2026-03-01";
  assert.ok(validateBankSnapshot(bad).issues.includes("METRIC_AFTER_REPORT_DATE"));
  const scored = calculateBankAssessment(bad);
  assert.equal(scored.groups.find((g) => g.key === "capitalLiquidity")?.available, 1);
});

test("incomplete core metrics never receive a readiness status or score", () => {
  const partial = structuredClone(base);
  delete partial.metrics.nplCoverage;
  const ready = assessFundamentalReadiness(partial);
  assert.equal(ready.status, "incomplete");
  assert.equal(ready.fundamentalScore, null);
  assert.ok(ready.coreMissing.includes("nplCoverage"));
});

test("technical feed failure does not hide fundamental analysis", () => {
  const ready = assessFundamentalReadiness(base);
  const combined = combineAnalysisAvailability(ready, "unverified");
  assert.equal(combined.fundamentalAnalysisAvailable, true);
  assert.equal(combined.technicalRecommendationAllowed, false);
});

test("same filing requires explicit replacement and preserves other banks", () => {
  const other = { ...base, symbol: "BBOB" };
  assert.throws(() => upsertSnapshot([base, other], base), /DUPLICATE_SNAPSHOT/);
  const replacement = { ...base, metrics: { ...base.metrics, car: metric(24.1) } };
  const result = upsertSnapshot([base, other], replacement, true);
  assert.equal(result.length, 2);
  assert.equal(result.find((x) => x.symbol === "BNOI")?.metrics.car?.value, 24.1);
  assert.ok(result.some((x) => x.symbol === "BBOB"));
});

test("both public APIs share the same schema and date/source validation", () => {
  const valid = calculateBankAssessment(base);
  const readiness = assessFundamentalReadiness(base);
  assert.equal(readiness.status, "ready_for_scoring");
  assert.equal(valid.eligible, true);
  const invalid = structuredClone(base);
  invalid.metrics.roe!.sourceUrl = "http://insecure.test/report";
  assert.equal(validateBankSnapshot(invalid).valid, false);
  assert.equal(calculateBankAssessment(invalid).fundamentalScore, null);
});
