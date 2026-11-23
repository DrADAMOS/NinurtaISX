import {
  BANK_METRIC_KEYS,
  validateBankSnapshot as validateSharedBankSnapshot,
  isValidSourcedBankMetric,
  type BankDataIssue,
  type BankFinancialSnapshot,
  type BankSnapshotValidation,
  type BankMetricKey,
} from "../utils/bankScoring";

export { BANK_METRIC_KEYS };
export type { BankMetricKey };
export type MetricMethod = "reported" | "calculated";
export type BankMetricEvidence = import("../utils/bankScoring").SourcedMetric;
export type BankSnapshot = BankFinancialSnapshot;
export type DataIssue = BankDataIssue;
export type SnapshotValidation = BankSnapshotValidation;

export interface FundamentalReadiness {
  status: "ready_for_scoring" | "incomplete" | "invalid";
  fundamentalScore: null;
  coveragePercent: number;
  coreMissing: BankMetricKey[];
  issues: DataIssue[];
  explanation: string;
}

const CORE_METRICS: readonly BankMetricKey[] = [
  "car", "npl", "nplCoverage", "roe", "roa", "liquidAssetsToDeposits",
];

/** Compatibility facade: validation is implemented once in bankScoring.ts. */
export function validateBankSnapshot(input: unknown): SnapshotValidation {
  return validateSharedBankSnapshot(input);
}

/**
 * Readiness is a data-quality gate only. It intentionally never calculates a score.
 * Scoring, when eligible, is performed only by calculateBankAssessment.
 */
export function assessFundamentalReadiness(snapshot: BankSnapshot): FundamentalReadiness {
  const validation = validateBankSnapshot(snapshot);
  const metrics = snapshot.metrics ?? {};
  const coreMissing = CORE_METRICS.filter((key) => !isValidSourcedBankMetric(metrics[key], snapshot.reportDate));
  const coveragePercent = Math.round(
    (validation.validMetricCount / BANK_METRIC_KEYS.length) * 100
  );

  if (validation.issues.some((issue) => issue !== "AUDIT_NOT_CONFIRMED")) {
    return {
      status: "invalid", fundamentalScore: null, coveragePercent, coreMissing,
      issues: validation.issues,
      explanation: "تم حجب التقييم بسبب أخطاء التوثيق أو صلاحية البيانات.",
    };
  }

  if (snapshot.audited !== true || coreMissing.length > 0 || coveragePercent < 80) {
    return {
      status: "incomplete", fundamentalScore: null, coveragePercent, coreMissing,
      issues: validation.issues,
      explanation: "البيانات لا تحقق متطلبات التقييم الأساسي؛ لا يتم إنشاء ترتيب أو درجة.",
    };
  }

  return {
    status: "ready_for_scoring", fundamentalScore: null, coveragePercent, coreMissing: [],
    issues: [],
    explanation: "اكتملت بوابة جودة البيانات. الدرجة تُحسب حصراً بواسطة محرك التقييم الموحد.",
  };
}

export type TechnicalStatus = "verified" | "stale" | "unverified" | "quarantined";

export interface AnalysisAvailability {
  fundamental: FundamentalReadiness;
  technicalStatus: TechnicalStatus;
  technicalRecommendationAllowed: boolean;
  fundamentalAnalysisAvailable: boolean;
}

export function combineAnalysisAvailability(
  fundamental: FundamentalReadiness,
  technicalStatus: TechnicalStatus,
): AnalysisAvailability {
  return {
    fundamental,
    technicalStatus,
    technicalRecommendationAllowed: technicalStatus === "verified",
    fundamentalAnalysisAvailable: fundamental.status !== "invalid",
  };
}

/** Explicit replacement only: never silently overwrite a same-period bank filing. */
export function upsertSnapshot(
  snapshots: BankSnapshot[],
  incoming: BankSnapshot,
  replaceExisting = false,
): BankSnapshot[] {
  const key = (s: BankSnapshot) => `${s.symbol}|${s.reportPeriod}|${s.reportDate}`;
  const index = snapshots.findIndex((s) => key(s) === key(incoming));
  if (index < 0) return [...snapshots, incoming];
  if (!replaceExisting) {
    throw new Error(`DUPLICATE_SNAPSHOT_REQUIRES_EXPLICIT_REPLACE:${key(incoming)}`);
  }
  return snapshots.map((s, i) => i === index ? incoming : s);
}
