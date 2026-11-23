#!/usr/bin/env python3
"""Read-only audit of official CSD OHLCV history and technical indicator eligibility.

Run from the Ninurta project root:
  py -3.13 scripts/audit-csd-technical.py
Optional:
  py -3.13 scripts/audit-csd-technical.py --project . --out-dir reports/csd-audit

The script never edits stocks.json, history files, portfolio data, or localStorage.
RSI calculation intentionally mirrors src/utils/technicalRecommendation.ts:
 simple arithmetic mean of gains/losses over the last 14 close-to-close changes.
"""
from __future__ import annotations
import argparse, csv, json, math, sys
from collections import defaultdict, Counter
from datetime import date
from pathlib import Path
from typing import Any


def load_json(path: Path) -> Any:
    with path.open('r', encoding='utf-8-sig') as f:
        return json.load(f)


def valid_num(v: Any) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(float(v))


def calc_rsi(closes: list[float], period: int = 14) -> float | None:
    if len(closes) < period + 1:
        return None
    gains = losses = 0.0
    for i in range(len(closes) - period, len(closes)):
        delta = closes[i] - closes[i - 1]
        if delta > 0:
            gains += delta
        else:
            losses -= delta
    if losses == 0:
        return 50.0 if gains == 0 else 100.0
    rs = (gains / period) / (losses / period)
    return 100.0 - 100.0 / (1.0 + rs)


def main() -> int:
    ap = argparse.ArgumentParser(description='Read-only CSD technical-history audit')
    ap.add_argument('--project', type=Path, default=Path.cwd())
    ap.add_argument('--out-dir', type=Path, default=Path('reports/csd-audit'))
    args = ap.parse_args()
    root = args.project.resolve()
    history_path = root / 'src/data/official-csd-history/csd_regular_market_ohlcv.json'
    stocks_path = root / 'src/data/stocks.json'
    status_path = root / 'src/data/data-status.json'
    for p in (history_path, stocks_path, status_path):
        if not p.is_file():
            print(f'ERROR: required file missing: {p}', file=sys.stderr); return 2

    rows = load_json(history_path)
    stocks = load_json(stocks_path)
    status = load_json(status_path)
    market_session = str(status.get('marketSessionDate') or '')
    if not isinstance(rows, list):
        print('ERROR: CSD history JSON must be an array', file=sys.stderr); return 2

    by_symbol: dict[str, list[dict[str, Any]]] = defaultdict(list)
    key_counts: Counter[tuple[str, str]] = Counter()
    global_issues: list[str] = []
    for i, row in enumerate(rows, 1):
        if not isinstance(row, dict):
            global_issues.append(f'row #{i}: not an object'); continue
        code = str(row.get('code') or '').strip().upper()
        day = str(row.get('date') or '')
        if not code or not day:
            global_issues.append(f'row #{i}: missing code/date'); continue
        try:
            date.fromisoformat(day)
        except ValueError:
            global_issues.append(f'{code} {day}: invalid ISO date'); continue
        key_counts[(day, code)] += 1
        by_symbol[code].append(row)

    for (day, code), count in key_counts.items():
        if count > 1:
            global_issues.append(f'{code} {day}: duplicate key appears {count} times')

    stock_by_symbol = {str(s.get('symbol') or '').strip().upper(): s for s in stocks if isinstance(s, dict)}
    report: list[dict[str, Any]] = []
    for code in sorted(by_symbol):
        source_rows = sorted(by_symbol[code], key=lambda r: str(r.get('date') or ''))
        issues: list[str] = []
        valid_rows: list[dict[str, Any]] = []
        for r in source_rows:
            day = str(r.get('date') or '')
            nums = {k: r.get(k) for k in ('open','high','low','close','volume','trades')}
            if not all(valid_num(v) for v in nums.values()):
                issues.append(f'{day}: missing/non-numeric OHLCV field'); continue
            o,h,l,c = (float(nums[k]) for k in ('open','high','low','close'))
            if min(o,h,l,c) <= 0 or float(nums['volume']) < 0 or float(nums['trades']) < 0:
                issues.append(f'{day}: non-positive price or negative volume/trades'); continue
            if h < max(o,c,l) or l > min(o,c,h):
                issues.append(f'{day}: invalid OHLC bounds'); continue
            if not r.get('source_sha256') or len(str(r.get('source_sha256'))) != 64:
                issues.append(f'{day}: missing/invalid source SHA-256');
            if not r.get('source_url'):
                issues.append(f'{day}: missing source URL')
            valid_rows.append(r)

        # De-duplicate only for safe calculation, but mark duplicates as an audit failure.
        unique_by_date: dict[str, dict[str, Any]] = {}
        for r in valid_rows:
            unique_by_date.setdefault(str(r['date']), r)
        clean = [unique_by_date[d] for d in sorted(unique_by_date)]
        closes = [float(r['close']) for r in clean]
        n = len(clean)
        last_date = str(clean[-1]['date']) if clean else ''
        sma20 = sum(closes[-20:]) / 20 if n >= 20 else None
        sma50 = sum(closes[-50:]) / 50 if n >= 50 else None
        rsi14 = calc_rsi(closes, 14)
        age_days = None
        if market_session and last_date:
            try: age_days = (date.fromisoformat(market_session) - date.fromisoformat(last_date)).days
            except ValueError: pass
        stock = stock_by_symbol.get(code, {})
        # Preserve the most important failure instead of masking data-quality issues.
        if not clean:
            status_flag = 'NO_VALID_ROWS'
        elif issues:
            status_flag = 'REVIEW'
        elif age_days is not None and (age_days < 0 or age_days > 5):
            status_flag = 'STALE_HISTORY'
        elif n < 20:
            status_flag = 'INSUFFICIENT_SMA20'
        else:
            status_flag = 'PASS'
        report.append({
            'code': code,
            'company_name': (stock.get('nameEn') or (clean[-1].get('company_name') if clean else '') or ''),
            'raw_rows': len(source_rows),
            'valid_unique_sessions': n,
            'first_session': str(clean[0]['date']) if clean else '',
            'last_session': last_date,
            'market_session_date': market_session,
            'age_calendar_days': age_days if age_days is not None else '',
            'sma20': round(sma20, 6) if sma20 is not None else '',
            'sma50': round(sma50, 6) if sma50 is not None else '',
            'rsi14': round(rsi14, 6) if rsi14 is not None else '',
            'sma20_eligible': n >= 20,
            'sma50_eligible': n >= 50,
            'rsi14_eligible': rsi14 is not None,
            'fresh_within_5_days': age_days is not None and 0 <= age_days <= 5,
            'audit_status': status_flag,
            'issues': ' | '.join(issues),
        })

    # Report output is separate from all application data files.
    out_dir = (root / args.out_dir).resolve() if not args.out_dir.is_absolute() else args.out_dir
    out_dir.mkdir(parents=True, exist_ok=True)
    csv_path = out_dir / 'technical-audit-by-symbol.csv'
    json_path = out_dir / 'technical-audit-summary.json'
    fields = list(report[0].keys()) if report else []
    with csv_path.open('w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=fields); w.writeheader(); w.writerows(report)

    counts = Counter(r['audit_status'] for r in report)
    summary = {
        'source': str(history_path.relative_to(root)),
        'marketSessionDate': market_session,
        'totalHistoryRows': len(rows),
        'uniqueSymbols': len(by_symbol),
        'symbolsInStocksJson': len(stock_by_symbol),
        'symbolsWithHistoryNotInStocks': sorted(set(by_symbol) - set(stock_by_symbol)),
        'symbolsInStocksWithoutHistory': sorted(set(stock_by_symbol) - set(by_symbol)),
        'duplicateDateSymbolPairs': sum(1 for c in key_counts.values() if c > 1),
        'globalIssues': global_issues,
        'statusCounts': dict(counts),
        'notes': [
            'Read-only audit; no source/application files were modified.',
            'RSI mirrors technicalRecommendation.ts simple-average gain/loss calculation over 14 close-to-close changes.',
            'SMA20/SMA50 use the last 20/50 valid unique official closes.',
            'Legacy stock.rsi/ma20/ma50 values are intentionally not treated as authoritative comparison values.',
            'Freshness uses marketSessionDate from data-status.json and the current five-calendar-day guard.'
        ],
        'csvReport': str(csv_path),
    }
    json_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    print('=== NINURTA CSD TECHNICAL AUDIT (READ ONLY) ===')
    print(f'Market session date: {market_session or "UNKNOWN"}')
    print(f'History rows: {len(rows)} | Symbols with history: {len(by_symbol)} | Stock directory: {len(stock_by_symbol)}')
    print(f'Duplicate date/symbol pairs: {summary["duplicateDateSymbolPairs"]}')
    print('Status counts:', dict(counts))
    print('\nCODE   SESSIONS LAST DATE   SMA20      SMA50      RSI14    STATUS')
    for r in report:
        print(f'{r["code"]:5} {r["valid_unique_sessions"]:8} {r["last_session"]:10} '
              f'{str(r["sma20"]):10} {str(r["sma50"]):10} {str(r["rsi14"]):8} {r["audit_status"]}')
    if global_issues:
        print('\nGLOBAL ISSUES (first 30):')
        for issue in global_issues[:30]: print(' -', issue)
    print('\nReports written:')
    print(csv_path)
    print(json_path)
    print('No application data was modified.')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
