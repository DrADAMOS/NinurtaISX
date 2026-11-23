#!/usr/bin/env python3
"""Non-destructive audit of Ninurta historical OHLCV records.

Reads stocks.json and legacy-stocks.json. It never modifies source data,
never deduplicates, never repairs candles, and never calculates signals.
"""
from __future__ import annotations
import argparse
import csv
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src" / "data"


def valid_ohlc(row):
    try:
        o, h, l, c, v = (float(row[k]) for k in ("open", "high", "low", "close", "volume"))
    except (KeyError, TypeError, ValueError):
        return False, "INCOMPLETE_OHLCV"
    if min(o, h, l, c) <= 0 or v < 0:
        return False, "NON_POSITIVE_PRICE_OR_NEGATIVE_VOLUME"
    if h < max(o, c, l) or l > min(o, c, h):
        return False, "INVALID_OHLC_RANGE"
    return True, ""


def inspect_file(path: Path, label: str):
    records = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(records, list):
        raise ValueError(f"{path} must contain a JSON array")
    rows = []
    totals = Counter()
    for stock in records:
        history = stock.get("historicalPrices") or []
        counts = Counter(str(x.get("date", "")) for x in history)
        duplicates = sorted(d for d, count in counts.items() if count > 1)
        incomplete, invalid, valid = [], [], []
        for item in history:
            ok, reason = valid_ohlc(item)
            if ok:
                valid.append(item)
            elif reason == "INCOMPLETE_OHLCV":
                incomplete.append(item)
            else:
                invalid.append((item, reason))
        dates = sorted(d for d in counts if d)
        totals["securities"] += 1
        totals["history_rows"] += len(history)
        totals["securities_with_history"] += bool(history)
        totals["duplicate_date_securities"] += bool(duplicates)
        totals["duplicate_date_events"] += len(duplicates)
        totals["incomplete_rows"] += len(incomplete)
        totals["invalid_rows"] += len(invalid)
        rows.append({
            "dataset": label,
            "symbol": stock.get("symbol", ""),
            "nameAr": stock.get("nameAr", ""),
            "history_rows": len(history),
            "unique_dates": len(counts),
            "first_date": dates[0] if dates else "",
            "last_date": dates[-1] if dates else "",
            "duplicate_dates": ";".join(duplicates),
            "incomplete_rows": len(incomplete),
            "invalid_rows": len(invalid),
            "valid_ohlcv_rows_before_provenance_gate": len(valid),
            "historical_source_verified": bool(stock.get("historicalDataVerified") is True
                and stock.get("historicalDataSource")
                and stock.get("historicalDataSourceUrl")
                and stock.get("historicalDataRetrievedAt")),
            "invalid_reasons": ";".join(sorted({reason for _, reason in invalid})),
        })
    return rows, dict(totals)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", default="reports/historical-audit")
    args = parser.parse_args()
    out = ROOT / args.output_dir
    out.mkdir(parents=True, exist_ok=True)
    all_rows, summaries, datasets = [], {}, {}
    for filename, label in (("stocks.json", "current"), ("legacy-stocks.json", "legacy")):
        path = DATA / filename
        rows, summary = inspect_file(path, label)
        all_rows.extend(rows)
        summaries[label] = summary
        datasets[label] = json.loads(path.read_text(encoding="utf-8"))
    fields = list(all_rows[0].keys()) if all_rows else []
    with (out / "historical-data-audit.csv").open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(all_rows)
    current_by_symbol = {x.get("symbol"): x for x in datasets["current"]}
    legacy_by_symbol = {x.get("symbol"): x for x in datasets["legacy"]}
    shared_symbols = set(current_by_symbol) & set(legacy_by_symbol)
    active_history_symbols = {x.get("symbol") for x in datasets["current"] if x.get("historicalPrices")}
    identical_active_history = sorted(
        symbol for symbol in active_history_symbols
        if symbol in legacy_by_symbol and
        current_by_symbol[symbol].get("historicalPrices") == legacy_by_symbol[symbol].get("historicalPrices")
    )
    report = {
        "readOnly": True,
        "sourceFiles": ["src/data/stocks.json", "src/data/legacy-stocks.json"],
        "sourceProvenance": "No historical-source provenance is inferred from current quote metadata.",
        "summaries": summaries,
        "crossFileComparison": {
            "currentLegacySymbolOverlap": len(shared_symbols),
            "legacySymbolsNotInCurrentDirectory": len(set(legacy_by_symbol) - set(current_by_symbol)),
            "currentSymbolsWithHistory": len(active_history_symbols),
            "currentHistoryArraysIdenticalToLegacy": len(identical_active_history),
            "identicalHistorySymbols": identical_active_history,
        },
        "policy": [
            "No duplicate rows were deleted or merged.",
            "No incomplete or invalid OHLCV values were repaired.",
            "No legacy signals or technical indicators were imported or recalculated.",
            "A historical record is not approved for chart/indicator use without its own verified source, URL, and retrieval timestamp."
        ]
    }
    (out / "historical-data-audit.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summaries, ensure_ascii=False, indent=2))
    print(f"Reports written to: {out}")


if __name__ == "__main__":
    main()
