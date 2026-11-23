NINURTA ISX PRO - PHASE 11
Portfolio Dashboard & Reports

INSTALLATION
1. Extract the phase11patch folder into the Ninurta-Current project root.
2. Open PowerShell in the project root.
3. Run:
   powershell -NoProfile -ExecutionPolicy Bypass -File ".\phase11patch\Apply-Phase11-Portfolio-Dashboard.ps1"

FEATURES
- Portfolio summary derived from saved positions and available local stock quotes.
- Per-position cost, estimated fees, net market value and unrealized P/L.
- Excel export with summary and per-stock detail sheets.
- Printable PDF report through the browser print dialog (choose Save as PDF).
- Missing current quotes are explicitly flagged; the average buy price is used only as a display fallback.
- Read-only reporting. No positions or broker trades are modified.

IMPORTANT
Fees use the app's configured ISXC_COMMISSION_RATE (currently 0.6% per side).
Values are estimates, not an official broker settlement statement.
The installer creates a backup and rolls back changed files if tests, TypeScript, or build fail.
