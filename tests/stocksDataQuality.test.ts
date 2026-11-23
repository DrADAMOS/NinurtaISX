import test from 'node:test';
import assert from 'node:assert/strict';
import { STOCKS_DATA } from '../src/data/stocksData';
import { getVerifiedCurrentSessionBar, getVerifiedHistoricalPrices } from '../src/utils/dataQuality';

test('mapped stocks retain official CSD provenance so detail charts can read it', () => {
  const tasc = STOCKS_DATA.find(stock => stock.symbol === 'TASC');
  assert.ok(tasc);
  assert.equal(tasc.verifiedHistoricalData?.verified, true);
  const verifiedHistory = getVerifiedHistoricalPrices(tasc);
  assert.ok(verifiedHistory.length > 0, 'expected a non-empty verified CSD history');
  assert.equal(tasc.historicalPrices.length, verifiedHistory.length);
  assert.equal(tasc.dataQualityStatus, 'review_required');
  assert.ok(tasc.dataQualityIssues.includes('TECHNICAL_LEVELS_NOT_VERIFIED_FOR_CURRENT_SESSION'));
  assert.equal(
    verifiedHistory.at(-1)?.date,
    tasc.verifiedHistoricalData?.lastSession,
    'last verified candle must agree with CSD audit metadata'
  );
});

test('current-session OHLC uses a CSD candle only when that exact session is present and verified', () => {
  const tasc = STOCKS_DATA.find(stock => stock.symbol === 'TASC');
  assert.ok(tasc);
  assert.ok(tasc.marketSessionDate, 'expected a dated current quote');

  const officialRowsForQuoteSession = (tasc.verifiedHistoricalPrices ?? [])
    .filter(row => row.date === tasc.marketSessionDate);
  const verifiedSessionBar = getVerifiedCurrentSessionBar(tasc);

  if (officialRowsForQuoteSession.length === 1) {
    const candle = officialRowsForQuoteSession[0];
    const quoteCloseMatches = Math.abs(candle.close - tasc.currentPrice) <=
      Math.max(1e-9, Math.abs(candle.close) * 1e-6);

    if (quoteCloseMatches) {
      assert.ok(verifiedSessionBar, 'matching official CSD candle should be accepted');
      assert.equal(verifiedSessionBar.date, tasc.marketSessionDate);
      assert.equal(tasc.high, candle.high);
      assert.equal(tasc.low, candle.low);
      assert.equal(tasc.open, candle.open);
    } else {
      assert.equal(verifiedSessionBar, null, 'CSD candle with a different close must not be applied to the live quote');
    }
  } else {
    // A current quote can be newer than the last CSD bulletin available in this
    // packaged dataset. In that case, do not invent or backdate an official candle.
    assert.equal(verifiedSessionBar, null);
    assert.equal(
      getVerifiedHistoricalPrices(tasc).some(row => row.date === tasc.marketSessionDate),
      false,
      'missing CSD session must remain absent from verified history'
    );
  }
});
