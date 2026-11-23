# Ninurta ISX Pro - Phase 4 Performance

This patch applies React lazy loading to eight secondary workspace components and wraps the main workspace in Suspense. It does not change market calculations, bank scoring, fees, or imported data.

## Apply
1. Extract this archive.
2. Keep the `patchfiles` folder beside `Apply-Phase4-Performance.ps1`.
3. Open PowerShell in the Ninurta project root (`Ninurta-Current`).
4. Run: `powershell -NoProfile -ExecutionPolicy Bypass -File ".\phase4patch\Apply-Phase4-Performance.ps1"` if extracted as the `phase4patch` folder.

The script is ASCII-only to avoid Windows PowerShell encoding/parser issues. It creates a timestamped backup, checks expected source anchors, then runs tests, TypeScript, and the production build. If validation fails, the backup is retained; restore it manually before continuing.
