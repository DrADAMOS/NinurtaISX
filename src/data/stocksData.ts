import rawStocks from './stocks.json';
import { Stock, BankMetrics } from '../types/stock';
import { categorizeRecommendation } from '../utils/calculator';
import { assessStockDataQuality, getVerifiedCurrentSessionBar } from '../utils/dataQuality';
import { assessTechnicalRecommendation } from '../utils/technicalRecommendation';

export function mapRawStocks(rawRows: any[]): Stock[] {
  return rawRows.map((raw) => {
  const quality = assessStockDataQuality(raw);
  const officialSessionBar = getVerifiedCurrentSessionBar(raw);
  const technical = assessTechnicalRecommendation(raw);
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
  const rsi = numeric(raw.rsi);

  const { category, signalStrength, risk, horizon } = categorizeRecommendation(
    raw.signal,
    invScore,
    specScore,
    rsi,
    peRatio,
    dividendYield
  );

  // Use only source-provided levels. Never manufacture entry/stop/targets from fixed percentages.
  const sup1 = numeric(raw.support1);
  const sup2 = numeric(raw.support2);
  const res1 = numeric(raw.resistance1);
  const res2 = numeric(raw.resistance2);
  const verifiedLevels = quality.status === 'verified' &&
    raw.technicalLevelsAsOf === raw.marketSessionDate &&
    typeof raw.technicalLevelsSource === 'string' && raw.technicalLevelsSource.trim().length > 0 &&
    [sup1, sup2, res1, res2].every(value => value > 0);
  const recommendationAllowed = verifiedLevels && technical.status === 'available';
  // A computed trend reading is not a buy/sell instruction. Actionable levels remain
  // hidden unless the exchange/source explicitly verifies them for this exact session.
  const safeCategory = recommendationAllowed ? category : 'انتظار';

  const entryTarget = recommendationAllowed ? sup1 : 0;
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
    signal: recommendationAllowed ? (raw.signal || 'انتظار') : technical.status === 'available' ? `اتجاه فني من آخر جلسة موثقة: ${technical.label} — لا توجد مستويات دخول/خروج معتمدة` : technical.status === 'inactive' ? `مستبعد من القراءة الفنية: ${technical.reason}` : `لا تتوفر قراءة فنية: ${technical.reason}`,
    sourceSignal: raw.signal || '',
    recommendationCategory: safeCategory,
    signalReason: recommendationAllowed ? (raw.signalReason || 'مستويات فنية موثقة للجلسة') : technical.reason,
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
    macd: raw.macd || 'محايد',
    ma20: numeric(raw.ma20),
    ma50: numeric(raw.ma50),
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
    technicalRecommendationStatus: technical.status,
    technicalRecommendationLabel: technical.label,
    technicalRecommendationReason: technical.reason,
    technicalRecommendationAsOf: technical.asOf,
    technicalRsi: technical.rsi,
    technicalSma20: technical.sma20,
    technicalSma50: technical.sma50
  };
  });
}

export const STOCKS_DATA: Stock[] = mapRawStocks(rawStocks as any[]);


// Major Iraqi Banks for the comparative analytics tool
export const MAJOR_BANKS_COMPARISON: BankMetrics[] = [
  {
    symbol: 'BNOI',
    nameAr: 'المصرف الأهلي العراقي',
    capital: 650.0,
    netProfitQ3: 52.0,
    netProfit9MCurrent: 173.6,
    netProfit9MPrev: 234.56,
    price: 3.30,
    car: 22.4,
    npl: 2.1,
    roe: 18.2,
    pe: 6.8,
    pb: 1.15,
    dividendYield: 7.8
  },
  {
    symbol: 'BBOB',
    nameAr: 'مصرف بغداد',
    capital: 400.0,
    netProfitQ3: 20.0,
    netProfit9MCurrent: 75.0,
    netProfit9MPrev: 163.0,
    price: 2.58,
    car: 19.8,
    npl: 3.4,
    roe: 16.8,
    pe: 7.2,
    pb: 1.13,
    dividendYield: 9.1
  },
  {
    symbol: 'BMNS',
    nameAr: 'مصرف المنصور للاستثمار',
    capital: 250.0,
    netProfitQ3: 12.5,
    netProfit9MCurrent: 38.2,
    netProfit9MPrev: 31.4,
    price: 1.95,
    car: 18.5,
    npl: 4.2,
    roe: 14.5,
    pe: 8.4,
    pb: 0.98,
    dividendYield: 6.5
  },
  {
    symbol: 'BCOI',
    nameAr: 'المصرف التجاري العراقي',
    capital: 250.0,
    netProfitQ3: 9.8,
    netProfit9MCurrent: 27.6,
    netProfit9MPrev: 24.1,
    price: 0.51,
    car: 17.2,
    npl: 4.8,
    roe: 11.2,
    pe: 9.1,
    pb: 0.82,
    dividendYield: 5.2
  },
  {
    symbol: 'BKUI',
    nameAr: 'مصرف كردستان الدولي',
    capital: 400.0,
    netProfitQ3: 15.2,
    netProfit9MCurrent: 44.5,
    netProfit9MPrev: 39.8,
    price: 1.62,
    car: 20.1,
    npl: 3.1,
    roe: 13.9,
    pe: 7.9,
    pb: 1.04,
    dividendYield: 8.2
  }
];
