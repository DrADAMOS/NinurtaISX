import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessDataQuality, assessRecommendationGate, computeRsi14, computeTechnicalIndicators,
  tradingDaysBetween, MIN_HISTORY_ROWS,
} from '../src/utils/reviewGate';
import { mapRawStocks } from '../src/data/stocksData';
import rawStocks from '../src/data/stocks.json';

const NOW = new Date('2026-11-17T09:00:00+03:00'); // الثلاثاء
const SESSION = '2026-11-16'; // الاثنين

/** n شمعة يومية موثقة تنتهي في `last` وتتخطى الجمعة والسبت. */
function bars(n: number, last = SESSION, step = 0.01) {
  const out: any[] = [];
  let t = Date.parse(`${last}T00:00:00Z`);
  while (out.length < n) {
    const dow = new Date(t).getUTCDay();
    if (dow !== 5 && dow !== 6) {
      const pos = n - 1 - out.length; // موضع الشمعة في السلسلة النهائية (تُملأ من الأحدث)
      const close = Number((1 + pos * step).toFixed(4));
      out.unshift({ date: new Date(t).toISOString().slice(0, 10), open: close, high: close + 0.02, low: close - 0.02, close, volume: 1000 });
    }
    t -= 86_400_000;
  }
  return out;
}
const goodRaw = (over: any = {}) => ({
  symbol: 'TEST', source: 'IQWealth', sourceUrl: 'https://iraqsm.com/en/market',
  retrievedAt: '2026-11-16T15:52:56+03:00', marketSessionDate: SESSION, currentPrice: 1.5,
  quoteStatus: 'published', ...over,
});
const gate = (raw: any, b: any[], legacy: string[] = []) =>
  assessRecommendationGate(raw, assessDataQuality(raw, NOW), b, legacy);

test('جلسات التداول تتجاوز الجمعة والسبت', () => {
  assert.equal(tradingDaysBetween('2026-11-12', '2026-11-15'), 1);      // خميس → أحد
  assert.equal(tradingDaysBetween('2026-11-09', '2026-11-16'), 5);      // اثنين → اثنين
  assert.equal(tradingDaysBetween('2026-11-16', '2026-11-16'), 0);
});

test('جودة البيانات: سجل مكتمل وحديث ومتسق = جيدة 100', () => {
  const q = assessDataQuality(goodRaw(), NOW);
  assert.equal(q.score, 100);
  assert.equal(q.level, 'high');
  assert.equal(q.reasons.length, 0);
});

test('جودة البيانات: السعر القديم يُمنع بسبب محدد ويحمل عدد الجلسات', () => {
  const q = assessDataQuality(goodRaw({ marketSessionDate: '2026-11-01' }), NOW);
  assert.equal(q.level, 'insufficient');
  const r = q.reasons.find(x => x.code === 'PRICE_STALE');
  assert.ok(r && /قبل \d+ جلسات/.test(r.detail));
});

test('جودة البيانات: تأخر بسيط تحذير لا منع', () => {
  const q = assessDataQuality(goodRaw({ marketSessionDate: '2026-11-12' }), NOW); // 3 جلسات
  assert.equal(q.reasons[0].code, 'PRICE_STALE_WARNING');
  assert.notEqual(q.level, 'insufficient');
});

test('جودة البيانات: نقص المصدر ينقص الاكتمال ويسمّي الحقل الناقص', () => {
  const q = assessDataQuality(goodRaw({ source: '' }), NOW);
  assert.equal(q.components.completeness, 80);
  assert.ok(q.reasons.some(r => r.code === 'SOURCE_NAME_MISSING'));
  assert.equal(q.level, 'insufficient');
});

test('اتساق السعر: high/low قديمة غير محدثة لا تُستخدم، وتعارض الإغلاق الرسمي يُكشف', () => {
  const stale = assessDataQuality(goodRaw({ high: 1.99, low: 1.98, quoteFieldsRefreshed: ['currentPrice'] }), NOW);
  assert.ok(!stale.reasons.some(r => r.code === 'PRICE_OUTSIDE_SESSION_RANGE'));
  const hist = bars(25);
  const conflict = assessDataQuality(goodRaw({
    currentPrice: 9, verifiedHistoricalPrices: hist,
    verifiedHistoricalData: { verified: true, source: 'CSD', sourceUrl: 'https://csd.gov.iq', retrievedAt: '2026-11-16T10:00:00+03:00' },
  }), NOW);
  assert.ok(conflict.reasons.some(r => r.code === 'PRICE_CONFLICTS_OFFICIAL_CLOSE'));
});

test('السهم الموقوف: جودة جزئية بسبب محدد، والتوصية موقوفة بسبب محدد', () => {
  const raw = goodRaw({ quoteStatus: 'suspended', quoteStatusText: 'Suspended' });
  const q = assessDataQuality(raw, NOW);
  assert.ok(q.reasons.some(r => r.code === 'NOT_TRADED_THIS_SESSION'));
  const g = gate(raw, bars(25));
  assert.equal(g.allowed, false);
  assert.ok(g.reasons.some(r => r.code === 'NO_TRADING_NO_SIGNAL'));
});

test('البوابة: بلا سجل رسمي → HISTORY_MISSING بعنوان محدد وإجراء', () => {
  const g = gate(goodRaw(), []);
  assert.equal(g.allowed, false);
  assert.equal(g.primaryReason?.code, 'HISTORY_MISSING');
  assert.ok(g.primaryReason?.action);
  assert.ok(!g.summary.includes('قيد المراجعة'));
});

test('البوابة: سجل أقصر من الحد الأدنى يذكر العدد', () => {
  const g = gate(goodRaw(), bars(MIN_HISTORY_ROWS - 1));
  assert.equal(g.primaryReason?.code, 'HISTORY_TOO_SHORT');
  assert.ok(g.primaryReason!.detail.includes(String(MIN_HISTORY_ROWS - 1)));
});

test('البوابة: مؤشرات متأخرة 5 جلسات تُمنع مع ذكر التاريخ والفارق', () => {
  const g = gate(goodRaw(), bars(30, '2026-11-09'));
  assert.equal(g.primaryReason?.code, 'INDICATORS_STALE');
  assert.ok(g.primaryReason!.detail.includes('2026-11-09') && g.primaryReason!.detail.includes('5'));
  assert.equal(g.indicators, null);
});

test('البوابة: سجل كافٍ وحديث يفتح التوصية ويحسب المؤشرات من الشموع', () => {
  const b = bars(60);
  const g = gate(goodRaw(), b);
  assert.equal(g.allowed, true, JSON.stringify(g.reasons));
  const ind = g.indicators!;
  assert.equal(ind.asOf, SESSION);
  assert.equal(ind.rsi14, 100); // سلسلة صاعدة بالكامل
  const mean20 = b.slice(-20).reduce((s, x) => s + x.close, 0) / 20;
  assert.ok(Math.abs(ind.ma20 - mean20) < 0.001);
  assert.ok(ind.ma50 !== null);
  assert.ok(ind.support1 >= ind.support2 && ind.resistance2 >= ind.resistance1);
});

test('البوابة: MA50 فارغ عند أقل من 50 شمعة', () => {
  assert.equal(computeTechnicalIndicators(bars(30))!.ma50, null);
  assert.equal(computeTechnicalIndicators(bars(19)), null);
  assert.equal(computeRsi14(bars(14).map(x => x.close)), null);
});

test('البوابة: مطابقة الدليل غير المؤكدة تمنع بسبب خاص، والتأكيد يرفعه', () => {
  const flagged = goodRaw({ dataQualityIssues: ['DIRECTORY_RECONCILIATION_REVIEW_REQUIRED'] });
  const g1 = gate(flagged, bars(60));
  assert.equal(g1.allowed, false);
  assert.equal(g1.primaryReason?.code, 'DIRECTORY_MATCH_UNCONFIRMED');
  const g2 = gate({ ...flagged, directoryMatchConfirmed: { confirmedAt: '2026-11-17' } }, bars(60));
  assert.equal(g2.allowed, true);
});

test('البوابة: صفوف OHLC غير صالحة تمنع بسبب محدد', () => {
  const g = gate(goodRaw(), bars(60), ['INVALID_OHLCV_ROWS:3']);
  assert.ok(g.reasons.some(r => r.code === 'HISTORY_INVALID_ROWS' && r.detail.includes('3')));
});

test('التكامل: لا سهم في البيانات المرفقة يعرض «قيد المراجعة» العامة بلا سبب', () => {
  const mapped = mapRawStocks(rawStocks as any[], NOW);
  assert.equal(mapped.length, (rawStocks as any[]).length);
  for (const s of mapped) {
    assert.ok(s.dataQuality && s.recommendationGate, s.symbol);
    assert.ok(!s.signal.includes('قيد المراجعة'), s.symbol);
    if (!s.recommendationGate!.allowed) {
      assert.ok(s.recommendationGate!.primaryReason, `${s.symbol} بلا سبب محدد`);
      assert.equal(s.entryTarget, 0);
      assert.equal(s.rsi, 0);
    } else {
      assert.ok(s.rsi > 0 && s.recommendationGate!.indicators);
    }
  }
});

test('التكامل: بعد تحديث السجل الرسمي تنفتح البوابة للسهم المؤكد', () => {
  const base = (rawStocks as any[]).find(s => s.symbol === 'BBOB');
  assert.ok(base);
  const history = bars(60);
  const refreshed = {
    ...base,
    currentPrice: history[history.length - 1].close,
    dataQualityIssues: [],
    verifiedHistoricalPrices: history,
    verifiedHistoricalData: { ...base.verifiedHistoricalData, lastSession: SESSION, rowCount: 60 },
  };
  const [s] = mapRawStocks([refreshed], NOW);
  assert.equal(s.recommendationGate!.allowed, true, JSON.stringify(s.recommendationGate!.reasons));
  assert.ok(s.rsi > 0 && s.ma20 > 0);
});
