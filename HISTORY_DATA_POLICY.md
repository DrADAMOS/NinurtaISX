# Historical OHLCV provenance and safety gate

## Findings in the supplied project snapshot

- `stocks.json` contains 105 current directory records. 27 records still carry historical OHLCV arrays; 78 have empty arrays.
- `legacy-stocks.json` contains 96 archived records and 3,483 historical rows.
- Every one of the 96 legacy securities has a duplicate date on 2026-09-30 (two rows for that date).
- The legacy file contains 27 incomplete OHLCV rows and 3 invalid OHLC rows (BSUC on 2026-10-22 and HKAR on 2026-09-09/10).
- The 27 securities with history still present in current `stocks.json` each have a duplicate date on 2026-09-30. Their arrays contain 35 or 36 unique dates; 16 of those securities also have one incomplete row. All 27 arrays are byte-for-byte equivalent as parsed JSON values to the corresponding arrays in `legacy-stocks.json`.
- The two 2026-09-30 rows appear sequential in many cases (first close equals second open), but the archive has no session identifier or intraday timestamp to prove they are separate sessions. Do not merge or sum them.

## Source conclusion

The current and legacy files share 51 symbols; 45 archived symbols are no longer in the current 105-company directory. The current project contains no historical-data fetcher or source manifest that establishes where these legacy OHLCV rows came from. The current `source`, `sourceUrl`, `retrievedAt`, and `marketSessionDate` fields describe the current public quote snapshot only; they are not evidence for the origin or retrieval time of old candles. The old Python application asset contains references to IQWealth financial filings, but no defensible mapping from those references to the legacy OHLCV arrays.

Therefore the historical OHLCV source remains **unknown / unverified**. This is a finding, not a reason to invent provenance.

## Implemented protection

- Raw historical arrays remain unchanged in `stocks.json` and `legacy-stocks.json`.
- `assessStockDataQuality` now exposes historical rows to charts only when separate historical provenance is explicitly verified (`historicalDataVerified`, `historicalDataSource`, `historicalDataSourceUrl`, and `historicalDataRetrievedAt`).
- Current quote metadata is not accepted as historical provenance.
- Technical indicator panels and RSI badges are hidden while the overall stock data status is not `verified`.
- No legacy signal, RSI, MACD, moving average, support/resistance, or recommendation was recalculated or imported.
- `scripts/audit-historical-data.py` generates CSV and JSON reports and is read-only.

## Safe next step

Obtain the original historical export or its provider URL/API documentation and the session definition for 2026-09-30. Then reconcile each row by symbol, date, and session ID. Only after that should a separate import be designed. Never silently delete duplicates, merge volume, fill missing OHLC, or use old indicator values.


## Official CSD daily bulletin history (2026-11-11)

A separate, audited official regular-market series is now embedded in `src/data/stocks.json` as `verifiedHistoricalPrices`, with per-stock provenance in `verifiedHistoricalData`. It contains 1,922 OHLCV rows for 48 securities across 71 dated reports (72 PDFs downloaded), covering 2026-06-22 through 2026-11-09. The extraction audit reports zero duplicate symbol/date pairs and zero OHLC validation issues. The audit artifacts and source CSV/JSON are retained under `src/data/official-csd-history/`.

This series is intentionally separate from legacy `historicalPrices`: the latter remains byte-content-preserved and is never merged, deduplicated, or overwritten. Charts prefer the separately audited official series. Technical recommendations, RSI/MACD signals, and support/resistance remain independently locked until current-session data and technical levels are verified.

Official archive: https://csd.gov.iq/en/category/reports-en/
