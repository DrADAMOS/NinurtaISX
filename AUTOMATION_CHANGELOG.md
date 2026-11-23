# Local personal updater change log

- Removed the Pro-only IQWealth API-key updater and GitHub Actions workflow.
- Added a standard-library Python parser for the public end-of-session market page.
- Added explicit session-date parsing and strict 96/96 symbol coverage gate.
- Added dry-run mode; it performs no writes.
- Added atomic JSON writes and timestamped local backups.
- Refreshes only fields actually published in the public table; never fabricates OHLC, previous close, historical candles, or technical levels.
- Added Windows Task Scheduler install/uninstall scripts and manual update launcher.
- Bound Vite dev server to 127.0.0.1 for local-only access.
- Removed unused Gemini/Express/dotenv packages and cloud/API key setup from this personal edition.
- Kept the original stock dataset untouched during this code-only conversion.


## FIXED12 — additive in-app manual refresh
- Restored an explicit refresh icon in the top header without removing or replacing any existing controls.
- Added a localhost-only Vite middleware endpoint that runs the existing public quote updater.
- The running app reloads the validated quote snapshot into React state after success.
- Existing automatic startup refresh and standalone BAT updater remain unchanged.
- Refresh does not modify historical OHLCV or technical indicators.
