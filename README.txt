NINURTA — OFFICIAL HISTORY FRESHNESS GUARD

Replace:
  src/utils/technicalRecommendation.ts

What this change does:
- Keeps the official CSD-only history rule.
- Tightens the maximum age of the last official CSD close from 14 to 5 calendar days.
- If the app quote snapshot is newer than the last audited CSD history by more than 5 days, it marks the technical reading as stale and suppresses the technical trend label.
- It does NOT fabricate prices, candles, indicators, entry/exit levels, or recommendations.

Why:
The supplied src.zip has data-status.json with quote session 2026-11-18, while the CSD audit_summary.json says the official OHLCV history ends on 2026-11-09. The audit says historyUpdated=false. This is a 9-calendar-day gap.
In stocks.json, 22 symbols have verified history ending 2026-11-09, 5 ending 2026-11-08, several are older, and 57/105 have no verifiedHistoricalData record.
Therefore the displayed 2026-11-09 analysis is not a current 2026-11-18 analysis. This patch makes that limitation explicit.

Apply:
1. Back up your current src/utils/technicalRecommendation.ts.
2. Replace it with the file at the same path in this ZIP.
3. Run:
   & "D:\Program Files\nodejs\npm.cmd" run build

Important:
This patch does not update the CSD source data. A true current technical analysis requires importing and auditing newer official CSD daily bulletins, then rebuilding per-symbol verifiedHistoricalPrices and verifiedHistoricalData. Until that happens, affected symbols should remain stale/unavailable.
