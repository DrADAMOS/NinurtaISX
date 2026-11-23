# Ninurta Bank Intelligence — Implementation Notes

## What changed
- Replaced the old fixed-value bank comparison table with a source-gated bank assessment screen.
- Added `src/utils/bankScoring.ts`: weighted Fundamental Score (100), Risk Score (separate), data coverage and confidence.
- Added `src/data/bankFinancials.ts` as the typed source-data registry. It is intentionally empty because the supplied archive has no per-metric source URLs and reporting dates for the five hard-coded bank comparison values.
- Updated the navigation label to Bank Intelligence.
- Added automated scoring tests (5/5 passed using Node.js type stripping).
- Added `BANK_FINANCIAL_DATA_TEMPLATE.json` documenting the required per-metric source metadata.
- Backed up changed files under `backups/pre-bank-intelligence-20261114/`.

## Scoring model
Asset quality 25%, profitability 20%, capital/liquidity 20%, valuation 15%, growth 10%, dividends 5%, disclosure 5%. Every metric must have a numeric value, `asOf` date, source name and HTTPS source URL. A total score is withheld unless coverage is at least 80% and core categories (asset quality, profitability, capital/liquidity and valuation) have sourced data. Eligibility additionally requires audited statements and confidence >=80%.

The CAR score uses 12.5% as the CBI minimum benchmark stated in its financial soundness indicators material. This is a scoring reference, not a guarantee of bank safety.

## Important data limitation
The supplied `stocks.json` has 105 companies but all sectors are currently `عام`; the current project bundle therefore cannot reliably identify the full bank universe. The prior `MAJOR_BANKS_COMPARISON` has five hard-coded bank records with no per-field provenance; their financial values are not used. Until official financial statements are entered with their individual source metadata, the UI correctly shows no bank ranked.

## Data import workflow added in v5
- The Bank Intelligence screen now accepts one JSON file containing multiple bank snapshots.
- Imported data is stored in the browser's localStorage only; it is not uploaded to a server.
- The screen can download a template containing the current bank symbols.
- Every metric is rejected unless it has a finite numeric value, a real ISO date, a source name, and an HTTPS source URL.
- Newer report periods replace older periods per bank. Same-symbol, same-report-date duplicates are rejected rather than chosen arbitrarily.
- Invalid or missing metrics are ignored, never converted to zero.
- The Fundamental Score is normalized over the available weighted categories after the 80% coverage gate; this prevents missing groups from silently acting as zero.
- Confidence now checks freshness across all accepted metrics, so one recent metric cannot conceal stale figures elsewhere.

## Still not implemented
- Automated downloader/parser for each bank's annual and quarterly filings.
- Independently verified bank universe from the current corrected live company directory.
- Trading score integration into bank ranking.
- A complete audited financial dataset for all listed banks. The app intentionally does not generate unsupported scores.
- Full Vite production build against the user's exact local project; run the supplied one-file BAT to perform TypeScript validation, all tests, and a production build on that machine.
- Browser end-to-end tests.


## Public-source guidance
Use the individual bank financial-statement pages at IQWealth as an index to filings, and retain the original Iraq Securities Commission filing URL for every imported metric. IQWealth states that its figures are extracted from filings and that missing values are not inferred. Its bulk data-pack sales are currently paused; this installer does not depend on a paid data pack or API. Central Bank of Iraq Financial Soundness Indicators are sector-level benchmarks and must not be copied into individual-bank records.
