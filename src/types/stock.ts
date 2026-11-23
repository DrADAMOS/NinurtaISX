export type RecommendationCategory = 'شراء' | 'مضاربة' | 'بيع' | 'انتظار';

export type RiskLevel = 'منخفضة' | 'متوسطة' | 'عالية' | 'غير محددة';

export type TimeHorizon = 'استثماري متوسط/طويل' | 'مضاربي قصير' | 'مراقبة واقتناص' | 'تخفيف وجني أرباح';

export interface HistoricalPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderBookEntry {
  price: number;
  quantity: number;
  orders: number;
}

export interface OrderBook {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
}

export interface StockDisclosure {
  id: string;
  date: string;
  title: string;
  type: string;
  summary: string;
}

export interface QuarterlyFinancial {
  period: string;
  revenue: number;
  netProfit: number;
  eps: number;
}

export interface Stock {
  symbol: string;
  nameAr: string;
  nameEn: string;
  sector: string;
  currentPrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
  quoteStatus?: 'published' | 'no_trade' | 'suspended' | 'unknown';
  quoteStatusText?: string;
  listingStatus?: 'active' | 'not_traded_recently' | 'suspended';
  source?: string;
  sourceUrl?: string;
  retrievedAt?: string;
  marketSessionDate?: string;
  priceDataType?: string;
  quoteFieldsRefreshed?: string[];
  high: number;
  low: number;
  open: number;
  limitUp: number;
  limitDown: number;
  volume: number;
  tradedValue: number;
  transactionsCount: number;
  marketCap: number; // in Billion IQD
  sharesIssued: number; // source unit; normalize only after source verification
  bookValue: number;
  peRatio: number;
  pbRatio: number;
  dividendYield: number; // in %
  lastDividend: number;
  eps: number;
  roe: number; // in %
  debtToEquity: number;
  freeFloatPercent: number;
  week52High: number;
  week52Low: number;
  
  // Core Decision Recommendations
  signal: string;
  sourceSignal?: string;
  recommendationCategory: RecommendationCategory;
  signalReason: string;
  investmentScore: number; // 0 - 100
  speculationScore: number; // 0 - 100
  signalStrength: number; // heuristic score; not probability
  entryTarget: number;
  stopLoss: number;
  targetPrice1: number;
  targetPrice2: number;
  riskLevel: RiskLevel;
  timeHorizon: TimeHorizon;
  fairValue: number; // estimated intrinsic fair value
  
  // Technical Indicators
  rsi: number;
  macd: string;
  ma20: number;
  ma50: number;
  support1: number;
  support2: number;
  resistance1: number;
  resistance2: number;

  // Depth & Historical
  historicalPrices: HistoricalPrice[];
  /** Independently audited official CSD series; kept separate from legacy history. */
  verifiedHistoricalPrices?: HistoricalPrice[];
  verifiedHistoricalData?: {
    verified: boolean; source: string; sourceUrl: string; retrievedAt: string;
    firstSession: string; lastSession: string; rowCount: number; pdfCount: number; reportsWithDates: number; audit: string;
  };
  orderBook?: OrderBook;
  disclosures?: StockDisclosure[];
  quarterlyData?: QuarterlyFinancial[] | Record<string, QuarterlyFinancial>;
  dataQualityStatus?: 'verified' | 'review_required' | 'quarantined';
  dataQualityIssues?: string[];
  technicalRecommendationStatus?: 'available' | 'insufficient_data' | 'inactive' | 'stale_history';
  technicalRecommendationLabel?: string;
  technicalRecommendationReason?: string;
  technicalRecommendationAsOf?: string | null;
  technicalRsi?: number | null;
  technicalSma20?: number | null;
  technicalSma50?: number | null;
}

export interface PortfolioPosition {
  id: string;
  symbol: string;
  shares: number;
  averageBuyPrice: number;
  buyDate: string;
  notes?: string;
}

export interface PriceAlert {
  id: string;
  symbol: string;
  targetPrice: number;
  condition: 'ABOVE' | 'BELOW';
  createdAt: string;
  triggered: boolean;
  notes?: string;
}

export interface BankMetrics {
  symbol: string;
  nameAr: string;
  capital: number; // Billion IQD
  netProfitQ3: number; // Billion IQD
  netProfit9MCurrent: number;
  netProfit9MPrev: number;
  price: number;
  car: number; // Capital Adequacy Ratio %
  npl: number; // Non-Performing Loans %
  roe: number;
  pe: number;
  pb: number;
  dividendYield: number;
}
