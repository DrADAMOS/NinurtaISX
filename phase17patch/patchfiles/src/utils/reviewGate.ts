import type {
  DataQualityAssessment, GateReason, HistoricalPrice, RecommendationGate, TechnicalIndicators,
} from '../types/stock';
import { getVerifiedCurrentSessionBar } from './dataQuality';

/**
 * بوابة المراجعة — فصل صريح بين:
 *  1) جودة البيانات: تُحسب من اكتمال المصدر + حداثة الجلسة + اتساق السعر.
 *  2) التوصية الفنية: لا تُحسب إلا عند توفر مؤشرات فنية موثوقة (من سجل رسمي موثق).
 * كل حالة غير جاهزة تُرجع سبباً محدداً (رمز + عنوان + تفصيل + إجراء)، لا عبارة «قيد المراجعة» العامة.
 */

/** أقصى فارق (بجلسات التداول) بين آخر شمعة موثقة وجلسة السعر الحالي. */
export const MAX_INDICATOR_LAG_TRADING_DAYS = 3;
/** أقل عدد جلسات موثقة لحساب RSI(14) و MA20. */
export const MIN_HISTORY_ROWS = 20;
/** حداثة السعر: حتى جلستين = سليمة، حتى MAX_STALE = متقادمة بتحذير، بعدها = مانعة. */
export const FRESH_TRADING_DAYS = 1;
export const MAX_STALE_TRADING_DAYS = 3;
export const QUALITY_HIGH_SCORE = 85;
export const QUALITY_PARTIAL_SCORE = 60;

const DIRECTORY_FLAG = 'DIRECTORY_RECONCILIATION_REVIEW_REQUIRED';

// ───────────────────────── تواريخ جلسات التداول (الأحد–الخميس) ─────────────────────────
const DAY_MS = 86_400_000;
const ymdMs = (s: unknown): number | null =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(`${s}T00:00:00Z`))
    ? Date.parse(`${s}T00:00:00Z`) : null;

/** تاريخ بغداد (UTC+3 دون توقيت صيفي) بصيغة YYYY-MM-DD. */
export function baghdadDate(now: Date): string {
  return new Date(now.getTime() + 3 * 3_600_000).toISOString().slice(0, 10);
}

/** عدد جلسات التداول (الأحد–الخميس؛ العطل الرسمية غير مضمّنة) في الفترة (from, to]. */
export function tradingDaysBetween(from: string, to: string): number | null {
  const a = ymdMs(from), b = ymdMs(to);
  if (a === null || b === null) return null;
  if (b <= a) return 0;
  let n = 0;
  for (let t = a + DAY_MS; t <= b; t += DAY_MS) {
    const dow = new Date(t).getUTCDay(); // 5=الجمعة، 6=السبت
    if (dow !== 5 && dow !== 6) n++;
  }
  return n;
}

const finitePositive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const reason = (code: string, severity: GateReason['severity'], title: string, detail: string, action?: string): GateReason =>
  ({ code, severity, title, detail, action });

// ───────────────────────── 1) جودة البيانات ─────────────────────────
export function assessDataQuality(raw: any, now: Date = new Date()): DataQualityAssessment {
  const reasons: GateReason[] = [];

  // اكتمال المصدر: اسم المصدر، رابط https، وقت الجلب، تاريخ الجلسة، السعر
  const checks = [
    { ok: typeof raw?.source === 'string' && raw.source.trim().length > 0,
      r: reason('SOURCE_NAME_MISSING', 'blocking', 'اسم مصدر السعر غير مسجل', 'لا يمكن نسب السعر إلى جهة منشورة.', 'شغّل تحديث البيانات اليومي ليُسجَّل المصدر.') },
    { ok: typeof raw?.sourceUrl === 'string' && /^https:\/\//i.test(raw.sourceUrl),
      r: reason('SOURCE_URL_MISSING', 'blocking', 'رابط المصدر غير موجود أو غير آمن', 'المطلوب رابط https قابل للتحقق.', 'شغّل تحديث البيانات اليومي.') },
    { ok: typeof raw?.retrievedAt === 'string' && Number.isFinite(Date.parse(raw.retrievedAt)),
      r: reason('RETRIEVED_AT_MISSING', 'blocking', 'وقت جلب السعر غير مسجل', 'لا يمكن الحكم على حداثة السعر بدون وقت الجلب.', 'شغّل تحديث البيانات اليومي.') },
    { ok: ymdMs(raw?.marketSessionDate) !== null,
      r: reason('SESSION_DATE_INVALID', 'blocking', 'تاريخ جلسة السوق غير صالح', 'تاريخ الجلسة مفقود أو بصيغة غير YYYY-MM-DD.', 'شغّل تحديث البيانات اليومي.') },
    { ok: finitePositive(raw?.currentPrice),
      r: reason('PRICE_INVALID', 'blocking', 'السعر الحالي مفقود أو غير صالح', 'يجب أن يكون السعر رقماً موجباً.', 'تحقق من صف السهم في مصدر السوق.') },
  ];
  checks.filter(c => !c.ok).forEach(c => reasons.push(c.r));
  const completeness = Math.round(100 * checks.filter(c => c.ok).length / checks.length);

  // حداثة الجلسة (بجلسات التداول مقارنةً بتاريخ بغداد الآن)
  let freshness = 0;
  let sessionAgeTradingDays: number | null = null;
  const sessionDate: string | undefined = ymdMs(raw?.marketSessionDate) !== null ? raw.marketSessionDate : undefined;
  if (sessionDate) {
    const today = baghdadDate(now);
    if (ymdMs(sessionDate)! > ymdMs(today)!) {
      freshness = 0;
      reasons.push(reason('SESSION_DATE_IN_FUTURE', 'blocking', 'تاريخ الجلسة في المستقبل',
        `تاريخ الجلسة ${sessionDate} بعد تاريخ اليوم ${today}؛ غالباً خلل في ساعة الجهاز أو في الملف.`, 'تحقق من ساعة الجهاز ثم أعد تشغيل التحديث.'));
    } else {
      sessionAgeTradingDays = tradingDaysBetween(sessionDate, today)!;
      if (sessionAgeTradingDays <= FRESH_TRADING_DAYS) freshness = 100;
      else if (sessionAgeTradingDays <= MAX_STALE_TRADING_DAYS) {
        freshness = 60;
        reasons.push(reason('PRICE_STALE_WARNING', 'warning', 'السعر متأخر عن السوق',
          `آخر جلسة ${sessionDate}، قبل ${sessionAgeTradingDays} جلسات تداول.`, 'شغّل تحديث البيانات اليومي.'));
      } else {
        freshness = 0;
        reasons.push(reason('PRICE_STALE', 'blocking', 'السعر قديم',
          `آخر جلسة ${sessionDate}، قبل ${sessionAgeTradingDays} جلسات تداول (الحد ${MAX_STALE_TRADING_DAYS}).`, 'شغّل تحديث البيانات اليومي.'));
      }
    }
  } else if (!reasons.some(r => r.code === 'SESSION_DATE_INVALID')) {
    reasons.push(reason('SESSION_DATE_INVALID', 'blocking', 'تاريخ جلسة السوق غير صالح', 'تاريخ الجلسة مفقود.', 'شغّل تحديث البيانات اليومي.'));
  }
  // سهم موقوف/بلا تداول: السعر هو آخر سعر منشور وليس سعر تداول في الجلسة
  if (raw?.quoteStatus === 'suspended' || raw?.quoteStatus === 'no_trade') {
    freshness = Math.min(freshness, 60);
    const label = raw.quoteStatus === 'suspended' ? 'السهم موقوف عن التداول' : 'لا تداول على السهم';
    reasons.push(reason('NOT_TRADED_THIS_SESSION', 'warning', label,
      `السعر المنشور هو آخر سعر معروف وليس صفقة في جلسة ${sessionDate ?? 'اليوم'}${raw.quoteStatusText ? ` (${raw.quoteStatusText})` : ''}.`));
  }

  // اتساق السعر
  let consistency = finitePositive(raw?.currentPrice) ? 100 : 0;
  if (finitePositive(raw?.currentPrice)) {
    const bar = getVerifiedCurrentSessionBar(raw);
    const sameSessionRows = Array.isArray(raw?.verifiedHistoricalPrices)
      ? raw.verifiedHistoricalPrices.filter((r: any) => r?.date === raw.marketSessionDate) : [];
    if (sameSessionRows.length === 1 && !bar && finitePositive(sameSessionRows[0]?.close)) {
      consistency = 0;
      reasons.push(reason('PRICE_CONFLICTS_OFFICIAL_CLOSE', 'blocking', 'السعر يخالف إغلاق مركز الإيداع',
        `السعر ${raw.currentPrice} بينما إغلاق ${raw.marketSessionDate} الرسمي ${sameSessionRows[0].close}.`, 'راجع السعر مقابل نشرة مركز الإيداع.'));
    }
    // نطاق الجلسة يُفحص فقط عندما تكون high/low من الجلسة نفسها (شمعة رسمية أو حقول حُدّثت في اللقطة)
    const refreshed: string[] = Array.isArray(raw?.quoteFieldsRefreshed) ? raw.quoteFieldsRefreshed : [];
    const rangeIsCurrent = !!bar || (refreshed.includes('high') && refreshed.includes('low'));
    const hi = bar?.high ?? raw?.high, lo = bar?.low ?? raw?.low;
    if (rangeIsCurrent && finitePositive(hi) && finitePositive(lo) && !(lo <= raw.currentPrice && raw.currentPrice <= hi)) {
      consistency = Math.min(consistency, 40);
      reasons.push(reason('PRICE_OUTSIDE_SESSION_RANGE', 'blocking', 'السعر خارج مدى الجلسة',
        `السعر ${raw.currentPrice} خارج [${lo} – ${hi}] لنفس الجلسة.`, 'راجع صف السهم في مصدر السوق.'));
    }
    if (typeof raw?.changePercent === 'number' && Math.abs(raw.changePercent) > 20) {
      consistency = Math.min(consistency, 60);
      reasons.push(reason('CHANGE_PERCENT_IMPLAUSIBLE', 'warning', 'نسبة التغير غير معتادة',
        `التغير ${raw.changePercent}% في جلسة واحدة.`, 'تحقق من الإيقاف/التجزئة أو خطأ في المصدر.'));
    }
    const bids = (raw?.orderBook?.bids ?? []).map((x: any) => x?.price).filter(Number.isFinite);
    const asks = (raw?.orderBook?.asks ?? []).map((x: any) => x?.price).filter(Number.isFinite);
    if (bids.length && asks.length && Math.max(...bids) >= Math.min(...asks)) {
      consistency = Math.min(consistency, 70);
      reasons.push(reason('CROSSED_ORDER_BOOK', 'warning', 'دفتر الأوامر متقاطع', 'أعلى طلب ≥ أدنى عرض؛ يُخفى دفتر الأوامر.'));
    }
  }

  const score = Math.round(completeness * 0.4 + freshness * 0.3 + consistency * 0.3);
  const hasBlocking = reasons.some(r => r.severity === 'blocking');
  const level = hasBlocking || score < QUALITY_PARTIAL_SCORE ? 'insufficient'
    : score >= QUALITY_HIGH_SCORE ? 'high' : 'partial';
  const levelLabel = level === 'high' ? 'جيدة' : level === 'partial' ? 'جزئية' : 'غير كافية';
  return { score, level, levelLabel, components: { completeness, freshness, consistency }, reasons, sessionAgeTradingDays };
}

// ───────────────────────── 2) مؤشرات فنية موثوقة ─────────────────────────
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

/** RSI(14) بتمهيد Wilder. يتطلب 15 إغلاقاً على الأقل. */
export function computeRsi14(closes: number[]): number | null {
  if (closes.length < 15) return null;
  let gain = 0, loss = 0;
  for (let i = 1; i <= 14; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  gain /= 14; loss /= 14;
  for (let i = 15; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    gain = (gain * 13 + Math.max(d, 0)) / 14;
    loss = (loss * 13 + Math.max(-d, 0)) / 14;
  }
  if (loss === 0) return gain === 0 ? 50 : 100;
  return Number((100 - 100 / (1 + gain / loss)).toFixed(1));
}

/** مؤشرات محسوبة حصراً من الشموع الموثقة (مرتبة تصاعدياً). */
export function computeTechnicalIndicators(bars: HistoricalPrice[]): TechnicalIndicators | null {
  if (bars.length < MIN_HISTORY_ROWS) return null;
  const closes = bars.map(b => b.close);
  const rsi14 = computeRsi14(closes);
  if (rsi14 === null) return null;
  const last10 = bars.slice(-10), last20 = bars.slice(-20);
  const r = (n: number) => Number(n.toFixed(3));
  return {
    asOf: bars[bars.length - 1].date,
    rows: bars.length,
    rsi14,
    ma20: r(mean(closes.slice(-20))),
    ma50: bars.length >= 50 ? r(mean(closes.slice(-50))) : null,
    support1: r(Math.min(...last10.map(b => b.low))),
    support2: r(Math.min(...last20.map(b => b.low))),
    resistance1: r(Math.max(...last10.map(b => b.high))),
    resistance2: r(Math.max(...last20.map(b => b.high))),
  };
}

// ───────────────────────── 3) بوابة التوصية ─────────────────────────
export function assessRecommendationGate(
  raw: any,
  quality: DataQualityAssessment,
  verifiedBars: HistoricalPrice[],
  legacyIssues: string[] = [],
): RecommendationGate {
  const blockers: GateReason[] = [];

  // أ) جودة البيانات نفسها مانعة: تُعرض أسبابها المحددة
  quality.reasons.filter(r => r.severity === 'blocking').forEach(r => blockers.push(r));

  // ب) لا تداول
  if (raw?.quoteStatus === 'suspended' || raw?.quoteStatus === 'no_trade') {
    blockers.push(reason('NO_TRADING_NO_SIGNAL', 'blocking',
      raw.quoteStatus === 'suspended' ? 'لا توصية: السهم موقوف' : 'لا توصية: لا تداول على السهم',
      'لا تُحسب توصية فنية على سعر لم يتحرك في جلسة التداول.'));
  }

  // ج) هوية السجل: مطابقة الاسم التقريبية عند مزامنة دليل الشركات
  const flagged = Array.isArray(raw?.dataQualityIssues) && raw.dataQualityIssues.includes(DIRECTORY_FLAG);
  const confirmed = typeof raw?.directoryMatchConfirmed?.confirmedAt === 'string' && raw.directoryMatchConfirmed.confirmedAt.trim().length > 0;
  if (flagged && !confirmed) {
    blockers.push(reason('DIRECTORY_MATCH_UNCONFIRMED', 'blocking', 'مطابقة الرمز مع السجل القديم لم تُؤكَّد',
      'رُبط هذا الرمز بسجل قديم بالتشابه الاسمي فقط؛ قد تعود المؤشرات المخزنة لشركة أخرى.',
      'نفّذ: python scripts/confirm-directory-match.py ثم أكّد الرموز التي تطابقت فعلاً.'));
  }

  // د) سلامة السجل التاريخي
  const invalid = legacyIssues.find(i => i.startsWith('INVALID_OHLCV_ROWS:'));
  if (invalid) {
    blockers.push(reason('HISTORY_INVALID_ROWS', 'blocking', 'سجل الأسعار فيه صفوف OHLC غير صالحة',
      `عدد الصفوف غير الصالحة: ${invalid.split(':')[1]}.`, 'شغّل: npm run data:audit-history'));
  }

  // هـ) كفاية السجل الرسمي والمؤشرات
  let indicators: TechnicalIndicators | null = null;
  let lag: number | null = null;
  if (verifiedBars.length === 0) {
    blockers.push(reason('HISTORY_MISSING', 'blocking', 'لا يوجد سجل تاريخي رسمي موثق',
      'التوصية الفنية تحتاج شموعاً يومية موثقة من مركز الإيداع، وهذا السهم بلا سجل.',
      'شغّل Fetch-Official-History.bat ثم npm run data:import-official'));
  } else if (verifiedBars.length < MIN_HISTORY_ROWS) {
    blockers.push(reason('HISTORY_TOO_SHORT', 'blocking', 'السجل التاريخي أقصر من الحد الأدنى',
      `${verifiedBars.length} جلسة موثقة من ${MIN_HISTORY_ROWS} لازمة لحساب RSI(14) وMA20.`,
      'حدّث السجل الرسمي حين تتوفر نشرات أكثر.'));
  } else {
    indicators = computeTechnicalIndicators(verifiedBars);
    lag = indicators && ymdMs(raw?.marketSessionDate) !== null
      ? tradingDaysBetween(indicators.asOf, raw.marketSessionDate) : null;
    if (indicators && lag !== null && lag > MAX_INDICATOR_LAG_TRADING_DAYS) {
      blockers.push(reason('INDICATORS_STALE', 'blocking', 'المؤشرات الفنية متأخرة عن سعر اليوم',
        `آخر شمعة موثقة ${indicators.asOf}، قبل ${lag} جلسات من جلسة السعر ${raw.marketSessionDate} (الحد ${MAX_INDICATOR_LAG_TRADING_DAYS}).`,
        'شغّل Fetch-Official-History.bat لجلب النشرات الأحدث.'));
      indicators = null;
    }
  }

  const unique = [...new Map(blockers.map(b => [b.code, b])).values()];
  const allowed = unique.length === 0 && indicators !== null;
  const primary = unique[0] ?? null;
  return {
    allowed,
    primaryReason: primary,
    reasons: unique,
    indicators: allowed ? indicators : null,
    indicatorLagTradingDays: lag,
    summary: allowed ? 'متاحة' : primary ? `معلّقة: ${primary.title}` : 'معلّقة: المؤشرات الفنية غير متاحة',
  };
}
