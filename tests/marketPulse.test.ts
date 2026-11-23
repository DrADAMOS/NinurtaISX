import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getMarketPulse } from '../src/utils/marketPulse';
import type { Stock } from '../src/types/stock';
const base = {
  symbol:'TEST', nameAr:'اختبار', nameEn:'Test', sector:'عام', currentPrice:1, previousClose:1, change:0, changePercent:0, quoteStatus:'published' as const, listingStatus:'active' as const,
  high:0, low:0, open:0, limitUp:0, limitDown:0, volume:100, tradedValue:100, transactionsCount:5, marketCap:0, sharesIssued:0, bookValue:0, peRatio:0, pbRatio:0, dividendYield:0, lastDividend:0, eps:0, roe:0, debtToEquity:0, freeFloatPercent:0, week52High:0, week52Low:0, signal:'', recommendationCategory:'انتظار' as const, signalReason:'', investmentScore:0, speculationScore:0, signalStrength:0, entryTarget:0, stopLoss:0, targetPrice1:0, targetPrice2:0, riskLevel:'غير محددة' as const, timeHorizon:'مراقبة واقتناص' as const, fairValue:0, rsi:0, macd:'', ma20:0, ma50:0, support1:0, support2:0, resistance1:0, resistance2:0, historicalPrices:[],
  source:'IQWealth', sourceUrl:'https://iraqsm.com/en/market', retrievedAt:'2026-11-09T12:00:00+03:00', marketSessionDate:'2026-11-08', quoteFieldsRefreshed:['currentPrice','changePercent','quoteStatus']
} satisfies Stock;
test('positive published traded quote is only a positive market pulse', () => assert.equal(getMarketPulse({...base, changePercent:2}).direction, 'positive'));
test('negative published traded quote is only a negative market pulse', () => assert.equal(getMarketPulse({...base, changePercent:-1}).direction, 'negative'));
test('flat quote is neutral, not a buy recommendation', () => assert.equal(getMarketPulse(base).direction, 'flat'));
test('no-trade rows do not produce a signal', () => assert.equal(getMarketPulse({...base, quoteStatus:'no_trade', listingStatus:'not_traded_recently'}).direction, 'unavailable'));
test('missing provenance does not produce a signal', () => assert.equal(getMarketPulse({...base, sourceUrl:''}).direction, 'unavailable'));
test('suspended rows do not produce a signal', () => assert.equal(getMarketPulse({...base, quoteStatus:'suspended', listingStatus:'suspended'}).direction, 'unavailable'));
