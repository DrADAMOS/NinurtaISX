import type { Stock } from '../types/stock';

export type MarketPulseDirection = 'positive' | 'negative' | 'flat' | 'unavailable';
export interface MarketPulse {
  direction: MarketPulseDirection;
  label: string;
  reason: string;
  changePercent: number | null;
  transactionsCount: number;
}

/**
 * Describes only the published quote snapshot. It is deliberately not an
 * investment recommendation and never derives targets, stops, RSI or valuation.
 */
export function getMarketPulse(stock: Stock): MarketPulse {
  const transactionsCount = Number.isFinite(stock.transactionsCount) ? stock.transactionsCount : 0;
  const change = Number.isFinite(stock.changePercent) ? stock.changePercent : 0;
  const refreshed = Array.isArray(stock.quoteFieldsRefreshed) ? stock.quoteFieldsRefreshed : [];
  const hasQuoteProvenance =
    typeof stock.source === 'string' && stock.source.trim().length > 0 &&
    typeof stock.sourceUrl === 'string' && /^https?:\/\//i.test(stock.sourceUrl) &&
    typeof stock.retrievedAt === 'string' && stock.retrievedAt.trim().length > 0 &&
    typeof stock.marketSessionDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(stock.marketSessionDate) &&
    refreshed.includes('currentPrice') && refreshed.includes('changePercent') && refreshed.includes('quoteStatus');

  const unavailable = (reason: string): MarketPulse => ({
    direction: 'unavailable', label: 'لا توجد إشارة سوقية', reason, changePercent: null, transactionsCount
  });

  if (!hasQuoteProvenance) return unavailable('بيانات الجلسة أو مصدر السعر غير مكتملة.');
  if (stock.quoteStatus === 'suspended' || stock.listingStatus === 'suspended') {
    return unavailable('السهم موقوف؛ لا تُعرض له إشارة حركة.');
  }
  if (stock.quoteStatus === 'no_trade' || stock.listingStatus === 'not_traded_recently') {
    return unavailable('لا توجد صفقة حديثة مثبتة في سجل الجلسة.');
  }
  if (stock.quoteStatus !== 'published' || stock.listingStatus !== 'active' || !(stock.currentPrice > 0)) {
    return unavailable('حالة التداول أو السعر المنشور لا تسمح بقراءة الحركة.');
  }
  if (!(transactionsCount > 0)) {
    return unavailable('عدد الصفقات غير مثبت؛ لا يمكن اعتماد تغير السعر كإشارة.');
  }

  if (change > 0) return { direction: 'positive', label: 'ارتفاع مسجل', reason: 'تغير موجب منشور في جلسة السوق؛ إشارة وصفية وليست توصية شراء.', changePercent: change, transactionsCount };
  if (change < 0) return { direction: 'negative', label: 'انخفاض مسجل', reason: 'تغير سالب منشور في جلسة السوق؛ إشارة وصفية وليست توصية بيع.', changePercent: change, transactionsCount };
  return { direction: 'flat', label: 'دون تغير مسجل', reason: 'السعر المنشور دون تغير؛ لا توجد دلالة اتجاهية من هذه اللقطة وحدها.', changePercent: 0, transactionsCount };
}
