# Ninurta ISX Pro — Working Copy Repair Changelog

## Safety / provenance
- This is a separate working copy extracted from the user-provided ZIP.
- The original ZIP and its internal `src/data/stocks.json` are unchanged.
- No external market prices were invented or injected.
- The working copy deliberately fails closed: because the supplied records have no source/session provenance and duplicate dates, recommendations are suppressed until data is reconciled.

## Changes applied

### 1. Data quality gate (`src/utils/dataQuality.ts`)
- Added non-destructive validation for source/session metadata, current price, support/resistance levels, OHLCV completeness, OHLC consistency, duplicate dates, quote-vs-session range conflicts, and crossed order books.
- Excludes every row belonging to a duplicated date from the validated chart/indicator series; does not pick, average, or delete raw source rows.
- Excludes incomplete or invalid OHLCV rows.
- Flags order books without verified timestamps and suppresses them from the UI.

### 2. Stock normalization (`src/data/stocksData.ts`, `src/types/stock.ts`)
- Removed random synthetic historical price generation.
- Removed fabricated order-book fallback generation.
- Removed fabricated disclosure fallback records.
- Removed fabricated fallback values for core financial/price fields (missing values normalize to zero/blank display rather than invented financial assumptions).
- Added `dataQualityStatus`, `dataQualityIssues`, and `sourceSignal`.
- Suppresses recommendations, entry/stop/targets, signal-strength percentage, and Graham estimate unless the data quality gate passes.
- Fair-value output is explicitly described as a Graham estimate, not a guaranteed intrinsic value.

### 3. Recommendation engine (`src/utils/calculator.ts`)
- Removed score-only overrides that could promote neutral/avoid signals into BUY.
- Only explicit source buy/speculation/sell signals can map to those categories.
- Replaced misleading confidence semantics with `signalStrength`; it is not a probability of success.
- Risk is marked `غير محددة` because this dataset does not contain sufficient validated risk inputs.

### 4. Fee calculator
- Rejects zero, negative, non-finite, fractional share quantities, invalid prices, and invalid commission rates.
- Commission is a configurable per-side scenario, not described as a universal official market tariff.
- Rounds executable sell targets upward to the configured tick before calculating displayed fees/profit.
- Custom target calculation uses the rounded displayed price.

### 5. UI / portfolio / alerts
- New users start with an empty portfolio and empty alerts.
- Legacy seeded demo positions/alerts (`pos-1..3`, `alert-1..2`) are filtered from persisted local storage.
- Alerts do not trigger from unverified quotes.
- UI labels no longer claim live prices, live alerts, official commission, or calibrated confidence.
- Unverified target prices and Graham estimates display as unavailable.
- Bank comparison panel warns that its hard-coded values lack source references and effective dates; unsupported 72% liquidity claim removed.
- Historical chart periods use calendar-month cutoffs relative to the latest available observation rather than arbitrary row counts.

### 6. Tests
- Added `tests/calculator.test.ts` and `tests/dataQuality.test.ts`.
- Added `npm test` script using the already-declared `tsx` development dependency.

## Current data gate result on the supplied 96-stock dataset
- 96 securities inspected.
- 0 pass as fully verified.
- 94 are `review_required`.
- 2 are `quarantined` due invalid OHLC.
- All 96 have duplicate historical dates.
- 3,261 historical rows pass row-level OHLCV checks and are retained for charting only if their date is not duplicated.
- 222 historical rows are excluded from validated chart/indicator inputs.
- No raw source row was edited or deleted.

## Known limitations / not yet completed
- Full React/Vite production build was not possible in this environment because dependencies are not installed and offline npm cache lacks `vite/client` and other packages.
- `npm install --offline` failed because the package cache does not contain the required dependencies.
- Focused strict TypeScript compilation passed for `calculator.ts`, `dataQuality.ts`, and `stock.ts`.
- 19 runtime assertions passed against the compiled financial/data-quality modules.
- Per-security official market reconciliation is still pending; the CSD report attachment could not be retrieved during this session.
- The bank comparison figures still exist as legacy static values but are clearly marked unverified in the UI; they must be replaced with sourced financial statement data before being relied upon.
- The working copy is a safety/hardening patch, not a production release.


## Follow-up dependency compatibility fix
- Updated the declared `esbuild` dev dependency from `^0.25.0` to `^0.28.2` to satisfy Vite 8.3.x's optional peer dependency range (`^0.27.0 || ^0.28.0`).
- Updated Windows test instructions to use `npm.cmd` and explicitly add the known Node.js installation directory to the current PowerShell session when needed.
- Full dependency installation and production build are still pending a successful install on the user's Windows machine; no successful build is claimed.


## 2026-11-09 — Current listed-company directory migration

- Added a strict parser for the public 105-company directory, including unique-symbol and expected-count validation.
- Added `--directory-dry-run` and `--sync-directory`; the latter backs up the existing list and archives the full prior 96-stock dataset in `src/data/legacy-stocks.json`.
- Migration preserves an existing record only when its ticker matches and the company name passes a conservative similarity check. Preserved records are flagged `DIRECTORY_RECONCILIATION_REVIEW_REQUIRED`, locking recommendations until review.
- New directory entries receive no invented price, OHLC, fundamentals, indicators, or recommendations. Missing prices display as unavailable and are excluded from gainers/losers and transaction price selectors.
- Quote updates now accept partial session quote rows, update only returned symbols, and preserve last known prices for companies absent from the quote table. Directory status is recorded separately.
- Added parser tests for 105 unique symbols and incomplete-directory rejection. Python parser suite: 6/6 passed.
- TypeScript lint/build could not be rerun in this Linux workspace because the uploaded `node_modules` contains Windows-only native binaries; the previous Windows test/build results remain the last confirmed frontend build.


## 2026-11-11 — CSD bulletin discovery repair (non-UI)

- Corrected the primary CSD archive to the live English Reports category (`/en/category/reports-en/`).
- Corrected the `exchange-news` alias used by `Fetch-Official-History.bat`; it previously pointed to a general Arabic news category, which could return HTTP 200 without containing daily report articles.
- Changed automatic fallback behavior: the downloader now continues to the next archive when a category responds successfully but yields no matching daily/monthly report articles. It stops only after finding matching report articles.
- Added `matchingArticlesFound` to the manifest and a diagnostic message when a category contains no matching reports.
- Updated CSD discovery tests to match the actual downloader API and cover the archive order, daily/monthly URL recognition, official attachment host validation, and pagination.
- No UI components, tools, navigation entries, icons, stock data, historical rows, or financial values were removed or modified.
- Important limitation: downloading official PDFs is not the same as extracting verified OHLCV. This repair restores report discovery/download only; the existing importer still requires a reviewed OHLCV CSV and explicit source confirmation. No candles are fabricated or imported by this change.
