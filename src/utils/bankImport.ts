import type { BankFinancialSnapshot, BankMetricKey, SourcedMetric } from './bankScoring';

const METRIC_KEYS: BankMetricKey[] = [
  'npl', 'nplCoverage', 'roe', 'roa', 'car', 'liquidAssetsToDeposits',
  'pe', 'pb', 'profitGrowthYoY', 'equityGrowthYoY', 'dividendYield', 'dividendYears',
];

export interface BankImportResult {
  snapshots: BankFinancialSnapshot[];
  rejected: string[];
  ignoredMetrics: number;
}

function isRealIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try { const url = new URL(value); return url.protocol === 'https:' && !!url.hostname; }
  catch { return false; }
}

function validMetric(value: unknown): value is SourcedMetric {
  if (!value || typeof value !== 'object') return false;
  const metric = value as Record<string, unknown>;
  return typeof metric.value === 'number' && Number.isFinite(metric.value) &&
    isRealIsoDate(metric.asOf) && typeof metric.sourceName === 'string' &&
    metric.sourceName.trim().length > 0 && validHttpsUrl(metric.sourceUrl);
}

/**
 * Accepts either an array of snapshots or { snapshots: [...] }.
 * Keeps the newest dated report per symbol and rejects ambiguous same-date duplicates.
 * No missing/invalid metric is ever converted to zero.
 */
export function parseBankFinancialImport(input: unknown): BankImportResult {
  const rows = Array.isArray(input)
    ? input
    : input && typeof input === 'object' && Array.isArray((input as { snapshots?: unknown }).snapshots)
      ? (input as { snapshots: unknown[] }).snapshots
      : null;
  if (!rows) throw new Error('صيغة الملف غير صحيحة: المطلوب مصفوفة أو كائن يحتوي snapshots.');

  const rejected: string[] = [];
  const candidates: BankFinancialSnapshot[] = [];
  let ignoredMetrics = 0;

  rows.forEach((row, index) => {
    const label = `السجل ${index + 1}`;
    if (!row || typeof row !== 'object') { rejected.push(`${label}: ليس كائناً صالحاً`); return; }
    const item = row as Record<string, unknown>;
    const symbol = typeof item.symbol === 'string' ? item.symbol.trim().toUpperCase() : '';
    if (!/^[A-Z0-9]{2,12}$/.test(symbol)) { rejected.push(`${label}: رمز المصرف غير صالح`); return; }
    if (typeof item.reportPeriod !== 'string' || !/^(FY\d{4}|Q[1-4]-\d{4})$/.test(item.reportPeriod.trim()) || !isRealIsoDate(item.reportDate) || typeof item.audited !== 'boolean') {
      rejected.push(`${symbol}: الفترة أو تاريخ التقرير أو حالة التدقيق غير مكتملة`); return;
    }
    if (!item.metrics || typeof item.metrics !== 'object' || Array.isArray(item.metrics)) {
      rejected.push(`${symbol}: لا توجد مؤشرات مالية`); return;
    }
    const rawMetrics = item.metrics as Record<string, unknown>;
    const metrics: Partial<Record<BankMetricKey, SourcedMetric>> = {};
    for (const key of Object.keys(rawMetrics)) {
      if (!METRIC_KEYS.includes(key as BankMetricKey)) { ignoredMetrics++; continue; }
      if (validMetric(rawMetrics[key])) {
        const metric = rawMetrics[key] as SourcedMetric;
        if (metric.asOf <= item.reportDate) metrics[key as BankMetricKey] = metric;
        else ignoredMetrics++;
      } else ignoredMetrics++;
    }
    if (Object.keys(metrics).length === 0) { rejected.push(`${symbol}: لا يوجد مؤشر واحد موثق بمصدر وتاريخ ورابط HTTPS`); return; }
    candidates.push({ symbol, reportPeriod: item.reportPeriod.trim(), reportDate: item.reportDate, audited: item.audited, metrics });
  });

  const bySymbol = new Map<string, BankFinancialSnapshot>();
  const ambiguous = new Set<string>();
  for (const snapshot of candidates) {
    const current = bySymbol.get(snapshot.symbol);
    if (!current || snapshot.reportDate > current.reportDate) {
      bySymbol.set(snapshot.symbol, snapshot);
      ambiguous.delete(snapshot.symbol);
    } else if (snapshot.reportDate === current.reportDate) {
      ambiguous.add(snapshot.symbol);
    }
  }
  for (const symbol of ambiguous) {
    bySymbol.delete(symbol);
    rejected.push(`${symbol}: توجد تقارير متعددة بالتاريخ نفسه؛ لم يتم اختيار أحدها تلقائياً`);
  }

  return { snapshots: [...bySymbol.values()].sort((a, b) => a.symbol.localeCompare(b.symbol)), rejected, ignoredMetrics };
}

export function makeBankImportTemplate(symbols: Array<{ symbol: string; name?: string }>) {
  return {
    schemaVersion: 1,
    instructions: 'أدخل القيم الفعلية فقط. كل مؤشر يحتاج value وasOf وsourceName وsourceUrl HTTPS. لا تضع صفراً للمعلومة المفقودة.',
    snapshots: symbols.map(({ symbol }) => ({
      symbol: symbol.toUpperCase(), reportPeriod: 'FY2025', reportDate: '', audited: false, metrics: {},
    })),
  };
}


/**
 * Merge imported reports with the browser's existing records without deleting
 * other banks or silently replacing a same-date filing.
 * Newer report dates supersede older ones for the same bank.
 */
export function mergeBankFinancialSnapshots(
  existing: BankFinancialSnapshot[],
  incoming: BankFinancialSnapshot[],
): { snapshots: BankFinancialSnapshot[]; conflicts: string[] } {
  const bySymbol = new Map(existing.map((snapshot) => [snapshot.symbol, snapshot]));
  const conflicts: string[] = [];
  for (const snapshot of incoming) {
    const current = bySymbol.get(snapshot.symbol);
    if (!current || snapshot.reportDate > current.reportDate) {
      bySymbol.set(snapshot.symbol, snapshot);
    } else if (snapshot.reportDate === current.reportDate) {
      conflicts.push(`${snapshot.symbol}: يوجد تقرير محفوظ بالتاريخ نفسه؛ احتُفظ بالنسخة الحالية`);
    }
  }
  return {
    snapshots: [...bySymbol.values()].sort((a, b) => a.symbol.localeCompare(b.symbol)),
    conflicts,
  };
}
