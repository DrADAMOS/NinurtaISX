NINURTA ISX PRO - PHASE 10 FIX 3

This package fixes the TypeScript validation failure caused by the temporary
patchfiles directory being included in the project's TypeScript scan.

1. Extract this ZIP into the Ninurta-Current project root and merge phase10patch.
2. Run PowerShell from the Ninurta-Current project root:
   powershell -NoProfile -ExecutionPolicy Bypass -File ".\phase10patch\Apply-Phase10-Portfolio-Reconciliation.ps1"

The installer validates all source files, creates a timestamped backup, copies
the four target files, removes temporary patch staging BEFORE tests/tsc/build,
then runs all three checks. If a check fails, the original target files are
restored from backup (or newly created files are removed).

The patch does not auto-adjust portfolio balances. Reconciliation is read-only.
