import rawStocks from './stocks.json';
import { Stock } from '../types/stock';
import { categorizeRecommendation } from '../utils/calculator';
import { assessStockDataQuality, getVerifiedCurrentSessionBar } from '../utils/dataQuality';
import { assessDataQuality, assessRecommendationGate } from '../utils/reviewGate';

export function mapRawStocks(rawRows: any[], now: Date = new Date()): Stock[] {
  return rawRows.map((raw) => {
  const quality = assessStockDataQuality(raw);
  const dataQuality = assessDataQuality(raw, now);
  const recommendationGate = assessRecommendationGate(raw, dataQuality, quality.usableHistoricalPrices, quality.issues);
  const ind = recommendationGate.indicators;
  const officialSessionBar = getVerifiedCurrentSessionBar(raw);
  const numeric = (value: unknown, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const currentPrice = numeric(raw.currentPrice);
  const bookValue = numeric(raw.bookValue);
  const eps = numeric(raw.eps);
  const peRatio = numeric(raw.peRatio);
  const dividendYield = numeric(raw.dividendYield);
  const invScore = numeric(raw.investmentScore);
  const specScore = numeric(raw.speculationScore);
  // المؤشرات الفنية تُعرض فقط عندما تفتح بوابة التوصية، وتُحسب من الشموع الموثقة وليس من حقول بلا مصدر.
  const rsi = ind ? ind.rsi14 : 0;

  const { category, signalStrength, risk, horizon } = categorizeRecommendation(
    raw.signal,
    invScore,
    specScore,
    rsi,
    peRatio,
    dividendYield
  );

  // Use only source-provided levels. Never manufacture entry/stop/targets from fixed percentages.
  const sup1 = ind ? ind.support1 : 0;
  const sup2 = ind ? ind.support2 : 0;
  const res1 = ind ? ind.resistance1 : 0;
  const res2 = ind ? ind.resistance2 : 0;
  const recommendationAllowed = recommendationGate.allowed;
  const safeCategory = recommendationAllowed ? category : 'انتظار';

  const entryTarget = recommendationAllowed && sup1 > 0 ? sup1 : 0;
  const stopLoss = recommendationAllowed ? sup2 : 0;
  const targetPrice1 = recommendationAllowed ? res1 : 0;
  const targetPrice2 = recommendationAllowed ? res2 : 0;

  // Calculate estimated fair value (Graham formula / P/E / P/B blend)
  const fairValue = recommendationAllowed && eps > 0 && bookValue > 0
    ? Number(Math.sqrt(22.5 * eps * bookValue).toFixed(3))
    : 0;

  return {
    symbol: raw.symbol,
    nameAr: raw.nameAr || raw.symbol,
    nameEn: raw.nameEn || raw.symbol,
    sector: raw.sector || 'عام',
    currentPrice,
    previousClose: numeric(raw.previousClose),
    change: numeric(raw.change),
    changePercent: numeric(raw.changePercent),
    quoteStatus: raw.quoteStatus || 'unknown',
    quoteStatusText: raw.quoteStatusText || '',
    listingStatus: raw.listingStatus || 'not_traded_recently',
    source: raw.source || '',
    sourceUrl: raw.sourceUrl || '',
    retrievedAt: raw.retrievedAt || '',
    marketSessionDate: raw.marketSessionDate || '',
    priceDataType: raw.priceDataType || '',
    quoteFieldsRefreshed: Array.isArray(raw.quoteFieldsRefreshed) ? raw.quoteFieldsRefreshed : [],
    high: officialSessionBar?.high ?? numeric(raw.high),
    low: officialSessionBar?.low ?? numeric(raw.low),
    open: officialSessionBar?.open ?? numeric(raw.open),
    limitUp: numeric(raw.limitUp),
    limitDown: numeric(raw.limitDown),
    volume: officialSessionBar?.volume ?? (Number(raw.volume) || 0),
    tradedValue: Number(raw.tradedValue) || 0,
    transactionsCount: Number(raw.transactionsCount) || 0,
    marketCap: numeric(raw.marketCap),
    sharesIssued: numeric(raw.sharesIssued),
    bookValue,
    peRatio,
    pbRatio: numeric(raw.pbRatio),
    dividendYield,
    lastDividend: numeric(raw.lastDividend),
    eps,
    roe: numeric(raw.roe),
    debtToEquity: numeric(raw.debtToEquity),
    freeFloatPercent: numeric(raw.freeFloatPercent),
    week52High: numeric(raw.week52High),
    week52Low: numeric(raw.week52Low),
    signal: recommendationAllowed ? (raw.signal || 'انتظار') : `التوصية موقوفة — ${recommendationGate.primaryReason?.title ?? 'المؤشرات الفنية غير متاحة'}`,
    sourceSignal: raw.signal || '',
    recommendationCategory: safeCategory,
    signalReason: recommendationAllowed ? (raw.signalReason || 'لا يوجد تفسير موثق للإشارة') : recommendationGate.reasons.map(r => `${r.title}: ${r.detail}`).join(' | ') || 'المؤشرات الفنية غير متاحة',
    investmentScore: invScore,
    speculationScore: specScore,
    signalStrength: recommendationAllowed ? signalStrength : 0,
    entryTarget,
    stopLoss,
    targetPrice1,
    targetPrice2,
    riskLevel: risk,
    timeHorizon: horizon,
    fairValue,
    rsi,
    macd: 'غير محسوب',
    ma20: ind ? ind.ma20 : 0,
    ma50: ind?.ma50 ?? 0,
    support1: sup1,
    support2: sup2,
    resistance1: res1,
    resistance2: res2,
    historicalPrices: quality.usableHistoricalPrices,
    verifiedHistoricalPrices: Array.isArray(raw.verifiedHistoricalPrices) ? raw.verifiedHistoricalPrices : [],
    verifiedHistoricalData: raw.verifiedHistoricalData,
    orderBook: quality.issues.includes('CROSSED_ORDER_BOOK') || quality.issues.includes('ORDER_BOOK_SOURCE_TIMESTAMP_NOT_VERIFIED') ? undefined : raw.orderBook,
    disclosures: Array.isArray(raw.disclosures) ? raw.disclosures : [],
    quarterlyData: raw.quarterlyData || [],
    dataQualityStatus: quality.status,
    dataQualityIssues: quality.issues,
    dataQuality,
    recommendationGate
  };
  });
}

export const STOCKS_DATA: Stock[] = mapRawStocks(rawStocks as any[]);
