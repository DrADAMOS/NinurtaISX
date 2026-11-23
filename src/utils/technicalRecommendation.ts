import type { HistoricalPrice } from '../types/stock';

export type TechnicalRecommendationStatus = 'available' | 'insufficient_data' | 'inactive' | 'stale_history';
export interface TechnicalRecommendation {
  status: TechnicalRecommendationStatus;
  label: string;
  reason: string;
  rsi: number | null;
  sma20: number | null;
  sma50: number | null;
  asOf: string | null;
}

const round = (n: number) => Number(n.toFixed(3));
function average(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}
function calculateRsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const delta = closes[i] - closes[i - 1];
    if (delta > 0) gains += delta; else losses -= delta;
  }
  if (losses === 0) return gains === 0 ? 50 : 100;
  const rs = (gains / period) / (losses / period);
  return 100 - 100 / (1 + rs);
}

/** Uses only audited CSD candles. It can read the last completed session outside market hours, but never consumes legacy history or stale precomputed indicators. */
export const MAX_OFFICIAL_HISTORY_AGE_DAYS = 5;
export function assessTechnicalRecommendation(raw: any): TechnicalRecommendation {
  const unavailable = (status: TechnicalRecommendationStatus, reason: string, asOf: string | null = null): TechnicalRecommendation =>
    ({ status, label: status === 'inactive' ? 'غير قابل للتحليل' : status === 'stale_history' ? 'السجل التاريخي قديم' : 'بيانات فنية غير كافية', reason, rsi: null, sma20: null, sma50: null, asOf });

  // A closed market or a no-trade quote does not invalidate the last completed
  // official session. Suspended listings remain excluded from technical readings.
  if (raw?.quoteStatus === 'suspended' || raw?.listingStatus === 'suspended') {
    return unavailable('inactive', 'السهم موقوف؛ لا تُعرض له قراءة فنية حتى استئناف التداول.');
  }
  const session = String(raw?.marketSessionDate || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(session) || !Number.isFinite(Date.parse(`${session}T00:00:00Z`))) {
    return unavailable('insufficient_data', 'تاريخ جلسة السوق غير متوفر أو غير صالح.');
  }
  const meta = raw?.verifiedHistoricalData;
  const rows: HistoricalPrice[] = Array.isArray(raw?.verifiedHistoricalPrices) ? raw.verifiedHistoricalPrices : [];
  if (meta?.verified !== true || !/^https:\/\//i.test(String(meta?.sourceUrl || '')) || !meta?.source || !rows.length) {
    return unavailable('insufficient_data', 'لا يتوفر سجل تاريخي رسمي موثق لهذا السهم.');
  }
  const sorted = rows.filter((x: any) => x && /^\d{4}-\d{2}-\d{2}$/.test(x.date) &&
    [x.open, x.high, x.low, x.close].every((v: any) => Number.isFinite(v) && v > 0) &&
    Number.isFinite(x.volume) && x.volume >= 0 && x.high >= Math.max(x.open, x.close, x.low) && x.low <= Math.min(x.open, x.close, x.high))
    .slice().sort((a, b) => a.date.localeCompare(b.date));
  const unique = sorted.filter((row, i) => sorted.findIndex(x => x.date === row.date) === i);
  if (unique.length < 20) return unavailable('insufficient_data', `السجل الرسمي يحتوي ${unique.length} جلسة صالحة؛ يلزم 20 جلسة على الأقل لحساب المتوسط المتحرك 20.`, unique.at(-1)?.date ?? null);
  const last = unique.at(-1)!;
  const ageDays = Math.floor((Date.parse(`${session}T00:00:00Z`) - Date.parse(`${last.date}T00:00:00Z`)) / 86400000);
  if (ageDays < 0 || ageDays > MAX_OFFICIAL_HISTORY_AGE_DAYS) return unavailable('stale_history', `آخر إغلاق رسمي موثق ${last.date} ويبعد ${ageDays} يوماً تقويمياً عن تاريخ جلسة السوق المنشور ${session}؛ الحد الأقصى المسموح به ${MAX_OFFICIAL_HISTORY_AGE_DAYS} أيام. القراءة الفنية موقوفة حتى تحديث سجل CSD الرسمي.`, last.date);

  const closes = unique.map(x => x.close);
  const sma20 = average(closes.slice(-20));
  const sma50 = closes.length >= 50 ? average(closes.slice(-50)) : null;
  const rsi = calculateRsi(closes);
  if (sma20 === null || rsi === null) return unavailable('insufficient_data', 'تعذر حساب RSI(14) والمتوسط المتحرك 20 من الشموع المتاحة.', last.date);

  let label = 'محايدة';
  let reason = `قراءة آخر جلسة رسمية ${last.date}: الإغلاق ${round(last.close)}، RSI(14)=${round(rsi)}، وSMA20=${round(sma20)}. هذه قراءة فنية تاريخية وليست سعراً لحظياً.`;
  if (rsi >= 70) reason += ' السهم في نطاق تشبع شرائي؛ لا تُصدر إشارة شراء.';
  else if (rsi <= 30) reason += ' السهم في نطاق تشبع بيعي؛ يلزم تأكيد قبل أي قرار.';
  else if (last.close > sma20 && rsi >= 50 && (sma50 === null || sma20 >= sma50)) {
    label = 'اتجاه فني إيجابي'; reason += ' السعر أعلى SMA20 والزخم غير سلبي.';
  } else if (last.close < sma20 && rsi < 50 && (sma50 === null || sma20 <= sma50)) {
    label = 'اتجاه فني سلبي'; reason += ' السعر أدنى SMA20 والزخم ضعيف.';
  } else reason += ' المؤشرات متضاربة؛ القراءة محايدة.';
  return { status: 'available', label, reason, rsi: round(rsi), sma20: round(sma20), sma50: sma50 === null ? null : round(sma50), asOf: last.date };
}
