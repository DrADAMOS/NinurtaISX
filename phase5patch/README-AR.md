# Ninurta ISX Pro — Phase 5

This patch lazy-loads the Stock Detail and Price Alerts modals only when they are opened.

## Apply

1. Extract the `phase5patch` folder into the root of `Ninurta-Current`.
2. Open PowerShell in the project root.
3. Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".\phase5patch\Apply-Phase5-OnDemand-Modals.ps1"
```

The installer checks the expected Phase 4 baseline, creates timestamped backups, applies the two-file patch, and runs tests, TypeScript validation, and the production build. On failure, it restores both original files.

No financial calculations, market data, storage keys, or import workflows are changed.
