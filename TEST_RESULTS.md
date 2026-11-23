# Test results — personal local edition

## Verified in the preparation environment

- Public-market parser tests: 4 passed, 0 failed.
- Python syntax compilation: passed.
- The existing 96-stock `stocks.json` was not changed during this conversion.
- All 96 symbols are unique.
- The original stock database SHA-256 remains `dff104d65e883661fb48aef840f2097e1ef1856cc789b73b89808a3d524aa836`.

## Not verified here

- Live page fetch and 96/96 symbol coverage: this environment could not resolve the public source host during the dry-run attempt.
- Windows Task Scheduler installation.
- Full npm test/type-check/build after dependency cleanup; run those commands on the user's Windows machine.

The live updater fails closed and will not write either data file unless it parses a dated session and matches every one of the 96 tracked symbols.

## Integration pass — 2026-11-13

- CSD discovery tests after merge: 8 passed, 0 failed.
- Official CSD dataset audit test: passed (1,922 rows, 48 securities, 71 report dates; no duplicate symbol/date pairs or OHLC issues).
- Public market updater parser tests: 6 passed, 0 failed.
- Sahmi calculator tests: 6 passed, 0 failed.
- TypeScript check: passed with temporary ambient declarations for OCR/XLSX modules absent from the Linux preparation environment; no shim was retained.
- Live public updater dry-run: blocked by DNS resolution in the preparation environment; no market data file was changed.
- Vite production build: not verified in this environment because npm dependency installation timed out and the available node_modules archive contained Windows-native binaries.
