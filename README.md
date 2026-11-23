# Ninurta Bank Intelligence — Audit Gate Patch

This is a non-destructive implementation patch. It does not overwrite the user's current project or publish changes to `main`.

## Included
- `src/banks/fundamentalEngine.ts`: strict evidence validation, fundamental readiness gate, independent technical status, explicit duplicate replacement.
- `tests/fundamentalEngine.test.ts`: regression tests for audit/source/date gates, formula provenance, technical/fundamental separation, and safe replacement.
- `docs/BNOI-FY2025-RECONCILIATION.md`: source conflict warning and data handling decision.

## Important
This patch intentionally does not generate a bank ranking score. It only decides whether data is eligible for a separately approved scoring model. No unaudited, unreferenced, future-dated, or incomplete record should become a scored bank.

## Integration
1. Copy `src/banks/fundamentalEngine.ts` into the matching project path.
2. Add the test file under `tests/`.
3. Wire `assessFundamentalReadiness()` into Bank Intelligence display logic.
4. Display `fundamentalAnalysisAvailable` independently from `technicalRecommendationAllowed`.
5. Use `upsertSnapshot(..., true)` only after an explicit user confirmation to replace the exact same symbol/period/report-date record.
6. Run `npm run lint`, `npm test`, and `npm run build`.

The current local application has newer Bank Intelligence import UI than the public repository snapshot. Therefore this patch is delivered separately instead of overwriting the current UI with an older repository version.
