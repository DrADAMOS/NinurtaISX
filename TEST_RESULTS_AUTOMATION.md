# Local updater validation

## Executed in the build workspace

- Python parser unit tests: 4 passed, 0 failed.
- Python bytecode compilation: passed.
- Test cases cover explicit session date, ticker extraction, down/up percentage parsing, compact K/M/B units, no-change values, and rejection of undated/unrecognized pages.

## Not yet executed

- Live fetch from the user's Windows network.
- 96/96 ticker coverage against the live current session.
- Windows Task Scheduler registration and execution.
- Full frontend build after this local-only conversion (run `npm.cmd install`, `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build` on Windows).

The updater fails closed: if live source parsing, date validation, or complete 96-symbol matching fails, it does not write `stocks.json` or `data-status.json`.
