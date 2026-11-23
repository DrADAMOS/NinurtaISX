import type { HistoricalPrice } from '../types/stock';

export type DataQualityStatus = 'verified' | 'review_required' | 'quarantined';

export interface DataQualityReport {
  status: DataQualityStatus;
  issues: string[];
  usableHistoricalPrices: HistoricalPrice[];
}

function finitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function hasVerifiedOfficialHistory(raw: any): boolean {
  const metadata = raw?.verifiedHistoricalData;
  return metadata?.verified === true &&
    typeof metadata?.source === 'string' && metadata.source.trim().length > 0 &&
    typeof metadata?.sourceUrl === 'string' && /^https:\/\//i.test(metadata.sourceUrl) &&
    typeof metadata?.retrievedAt === 'string' && metadata.retrievedAt.trim().length > 0 &&
    Array.isArray(raw?.verifiedHistoricalPrices) && raw.verifiedHistoricalPrices.length > 0;
}

function isValidHistoricalRow(row: any): row is HistoricalPrice {
  if (typeof row?.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) ||
      !Number.isFinite(Date.parse(`${row.date}T00:00:00Z`))) return false;
  const { open, high, low, close, volume } = row;
  return [open, high, low, close].every(finitePositive) && Number.isFinite(volume) && volume >= 0 &&
    high >= Math.max(open, close, low) && low <= Math.min(open, close, high);
}

const DERIVED_ISSUES = new Set([
  'SOURCE_RECORD_QUARANTINED',
  'NO_VERIFIED_FINANCIAL_OR_PRICE_DATA',
  'HISTORICAL_SOURCE_NOT_VERIFIED',
]);

/** Historical chart eligibility is independent from current-session technical recommendations. */
export function getVerifiedHistoricalPrices(raw: any): HistoricalPrice[] {
  // Prefer the separately audited official CSD dataset. Legacy historicalPrices remain
  // untouched and quarantined; they are never merged with the official series.
  const official = hasVerifiedOfficialHistory(raw);
  const legacyProvenance = raw?.historicalDataVerified === true &&
    typeof raw?.historicalDataSource === 'string' && raw.historicalDataSource.trim().length > 0 &&
    typeof raw?.historicalDataSourceUrl === 'string' && /^https:\/\//i.test(raw.historicalDataSourceUrl) &&
    typeof raw?.historicalDataRetrievedAt === 'string' && raw.historicalDataRetrievedAt.trim().length > 0;
  const rows: any[] = official && Array.isArray(raw?.verifiedHistoricalPrices)
    ? raw.verifiedHistoricalPrices
    : legacyProvenance && Array.isArray(raw?.historicalPrices) ? raw.historicalPrices : [];
  if (!rows.length) return [];
  const counts = new Map<string, number>();
  for (const row of rows) if (typeof row?.date === 'string') counts.set(row.date, (counts.get(row.date) || 0) + 1);
  const output: HistoricalPrice[] = [];
  for (const row of rows) {
    if (typeof row?.date !== 'string' || !Number.isFinite(Date.parse(row.date)) || counts.get(row.date) !== 1) continue;
    const { open, high, low, close, volume } = row;
    if (![open, high, low, close].every(finitePositive) || !Number.isFinite(volume) || volume < 0 ||
        high < Math.max(open, close, low) || low > Math.min(open, close, high)) continue;
    output.push({ date: row.date, open, high, low, close, volume });
  }
  return output.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Returns an official candle for the quote session only when its close agrees with
 * the published current price. This prevents stale quote-page high/low values from
 * being mixed with a different session's close.
 */
export function getVerifiedCurrentSessionBar(raw: any): HistoricalPrice | null {
  if (!hasVerifiedOfficialHistory(raw) || typeof raw?.marketSessionDate !== 'string' ||
      !finitePositive(raw?.currentPrice)) return null;
  const matches = raw.verifiedHistoricalPrices.filter((row: any) => row?.date === raw.marketSessionDate);
  if (matches.length !== 1 || !isValidHistoricalRow(matches[0])) return null;
  const bar = matches[0] as HistoricalPrice;
  const tolerance = Math.max(1e-9, Math.abs(bar.close) * 1e-6);
  return Math.abs(raw.currentPrice - bar.close) <= tolerance ? bar : null;
}

/** Recomputes derived quality flags; stale quarantine labels cannot permanently lock a repaired record. */
export function assessStockDataQuality(raw: any): DataQualityReport {
  const storedIssues: string[] = Array.isArray(raw?.dataQualityIssues)
    ? raw.dataQualityIssues.filter((x: unknown): x is string => typeof x === 'string') : [];
  const issues = storedIssues.filter(issue => !DERIVED_ISSUES.has(issue) &&
    !issue.startsWith('DUPLICATE_DATES:') && !issue.startsWith('INCOMPLETE_OHLCV_ROWS:') && !issue.startsWith('INVALID_OHLCV_ROWS:'));
  // If an independently audited official CSD series exists, assess that series.
  // Legacy history remains untouched but must not poison the verified chart series
  // with its duplicate/incomplete rows.
  const officialHistory = hasVerifiedOfficialHistory(raw);
  const history: any[] = officialHistory
    ? raw.verifiedHistoricalPrices
    : (Array.isArray(raw?.historicalPrices) ? raw.historicalPrices : []);
  const usableHistoricalPrices = getVerifiedHistoricalPrices(raw);
  const provenance = officialHistory || (raw?.historicalDataVerified === true &&
    typeof raw?.historicalDataSource === 'string' && raw.historicalDataSource.trim().length > 0 &&
    typeof raw?.historicalDataSourceUrl === 'string' && /^https:\/\//i.test(raw.historicalDataSourceUrl) &&
    typeof raw?.historicalDataRetrievedAt === 'string' && raw.historicalDataRetrievedAt.trim().length > 0);

  if (!raw?.source || !raw?.retrievedAt || !raw?.marketSessionDate) issues.push('PRICE_SOURCE_OR_SESSION_METADATA_MISSING');
  if (!finitePositive(raw?.currentPrice)) issues.push('CURRENT_PRICE_MISSING_OR_INVALID');
  if (history.length && !provenance) issues.push('HISTORICAL_SOURCE_NOT_VERIFIED');

  const dateCounts = new Map<string, number>();
  for (const row of history) if (typeof row?.date === 'string') dateCounts.set(row.date, (dateCounts.get(row.date) || 0) + 1);
  const duplicates = [...dateCounts.entries()].filter(([, n]) => n > 1).map(([date]) => date);
  if (duplicates.length) issues.push(`DUPLICATE_DATES:${duplicates.join(',')}`);

  let incomplete = 0, invalid = 0;
  for (const row of history) {
    if (!['open', 'high', 'low', 'close', 'volume'].every(key => Number.isFinite(row?.[key]))) { incomplete++; continue; }
    const { open, high, low, close, volume } = row;
    if (![open, high, low, close].every(finitePositive) || high < Math.max(open, close, low) ||
        low > Math.min(open, close, high) || volume < 0) invalid++;
  }
  if (incomplete) issues.push(`INCOMPLETE_OHLCV_ROWS:${incomplete}`);
  if (invalid) issues.push(`INVALID_OHLCV_ROWS:${invalid}`);

  if (![raw?.support1, raw?.support2, raw?.resistance1, raw?.resistance2].every(finitePositive) ||
      !raw?.technicalLevelsAsOf || raw.technicalLevelsAsOf !== raw?.marketSessionDate || !raw?.technicalLevelsSource) {
    issues.push('TECHNICAL_LEVELS_NOT_VERIFIED_FOR_CURRENT_SESSION');
  }
  const officialSessionBar = getVerifiedCurrentSessionBar(raw);
  const refreshedFields = Array.isArray(raw?.quoteFieldsRefreshed) ? raw.quoteFieldsRefreshed : [];
  const quoteRangeIsCurrent = officialSessionBar !== null || (refreshedFields.includes('high') && refreshedFields.includes('low'));
  const quoteHigh = officialSessionBar?.high ?? (quoteRangeIsCurrent ? raw?.high : undefined);
  const quoteLow = officialSessionBar?.low ?? (quoteRangeIsCurrent ? raw?.low : undefined);
  if (quoteRangeIsCurrent && finitePositive(raw?.currentPrice) && finitePositive(quoteHigh) && finitePositive(quoteLow) &&
      !(quoteLow <= raw.currentPrice && raw.currentPrice <= quoteHigh)) issues.push('CURRENT_PRICE_OUTSIDE_SESSION_RANGE');

  const bids = Array.isArray(raw?.orderBook?.bids) ? raw.orderBook.bids : [];
  const asks = Array.isArray(raw?.orderBook?.asks) ? raw.orderBook.asks : [];
  const bidPrices = bids.map((x: any) => x?.price).filter((x: any) => Number.isFinite(x));
  const askPrices = asks.map((x: any) => x?.price).filter((x: any) => Number.isFinite(x));
  if (bidPrices.length && askPrices.length && Math.max(...bidPrices) >= Math.min(...askPrices)) issues.push('CROSSED_ORDER_BOOK');
  if (bids.length || asks.length) issues.push('ORDER_BOOK_SOURCE_TIMESTAMP_NOT_VERIFIED');

  const uniqueIssues = [...new Set(issues)];
  // Quote quality is independent from historical-series quality and technical readiness.
  // A missing technical-level snapshot must not mark an otherwise sourced current quote
  // as unverified; recommendation eligibility is evaluated separately.
  const quoteBlockingIssues = uniqueIssues.filter(issue => [
    'PRICE_SOURCE_OR_SESSION_METADATA_MISSING',
    'CURRENT_PRICE_MISSING_OR_INVALID',
    'CURRENT_PRICE_OUTSIDE_SESSION_RANGE',
  ].includes(issue));
  const status: DataQualityStatus = !finitePositive(raw?.currentPrice) ? 'quarantined' :
    quoteBlockingIssues.length ? 'review_required' : 'verified';
  return { status, issues: uniqueIssues, usableHistoricalPrices };
}
