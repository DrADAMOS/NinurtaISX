#!/usr/bin/env python3
"""Restore sector labels from the live 105-company public directory.

Only the `sector` property in stocks.json is changed. Prices, quote dates,
historical candles, financial fields, recommendation fields and user data
remain byte-for-byte equivalent at the JSON-object value level.
"""
from __future__ import annotations

import importlib.util
import json
import shutil
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UPDATER_PATH = ROOT / "scripts" / "update-market-data-public.py"
STOCKS_PATH = ROOT / "src" / "data" / "stocks.json"
BACKUP_DIR = ROOT / "backups"

def load_updater():
    spec = importlib.util.spec_from_file_location("ninurta_public_updater", UPDATER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("تعذر تحميل محلّل دليل الشركات")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module

def main():
    updater = load_updater()
    print("[1/4] جلب دليل الشركات من المصدر العام...")
    companies = updater.parse_company_directory(updater.fetch_directory_page())
    sector_by_symbol = {row["symbol"]: row["sector"] for row in companies}
    if len(sector_by_symbol) != updater.EXPECTED_DIRECTORY_COUNT:
        raise RuntimeError("عدد الرموز المستخرج غير مكتمل؛ لم يتم تعديل البيانات.")

    print("[2/4] فحص قاعدة الأسهم المحلية...")
    stocks = json.loads(STOCKS_PATH.read_text(encoding="utf-8"))
    if not isinstance(stocks, list) or len(stocks) != updater.EXPECTED_DIRECTORY_COUNT:
        raise RuntimeError(f"قاعدة الأسهم ليست {updater.EXPECTED_DIRECTORY_COUNT} سجلاً؛ لم يتم تعديل البيانات.")
    local_symbols = [str(row.get("symbol", "")).upper() for row in stocks]
    if len(set(local_symbols)) != len(local_symbols) or set(local_symbols) != set(sector_by_symbol):
        missing = sorted(set(local_symbols) - set(sector_by_symbol))
        new = sorted(set(sector_by_symbol) - set(local_symbols))
        raise RuntimeError(f"اختلاف رموز قاعدة البيانات والدليل. محلي فقط: {missing}; في الدليل فقط: {new}")

    sectors = {row["sector"] for row in companies}
    if len(sectors) != 8 or "عام" in sectors:
        raise RuntimeError(f"الدليل لم يرجع 8 قطاعات مصنفة بوضوح: {sorted(sectors)}")

    print("[3/4] إنشاء نسخة احتياطية وتحديث حقل القطاع فقط...")
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = BACKUP_DIR / f"stocks-before-sector-repair-{stamp}.json"
    shutil.copy2(STOCKS_PATH, backup)

    before = {row["symbol"]: dict(row) for row in stocks}
    for row in stocks:
        row["sector"] = sector_by_symbol[row["symbol"]]
    # Guard: prove no property other than sector was changed.
    for row in stocks:
        original = dict(before[row["symbol"]])
        original.pop("sector", None)
        updated = dict(row)
        updated.pop("sector", None)
        if updated != original:
            raise RuntimeError(f"تغير حقل غير القطاع في {row['symbol']}؛ أُلغي الحفظ.")

    temp = STOCKS_PATH.with_suffix(".json.sector.tmp")
    temp.write_text(json.dumps(stocks, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    json.loads(temp.read_text(encoding="utf-8"))
    temp.replace(STOCKS_PATH)

    counts = Counter(row["sector"] for row in stocks)
    print("[4/4] التحقق من النتائج...")
    print(f"الشركات المصنفة: {len(stocks)}/{updater.EXPECTED_DIRECTORY_COUNT}")
    print(f"عدد القطاعات: {len(counts)}")
    for sector, count in sorted(counts.items()):
        print(f"  {sector}: {count}")
    print(f"النسخة الاحتياطية: {backup}")
    print("SUCCESS: تم إصلاح تصنيف القطاعات فقط دون تغيير أي بيانات أخرى.")

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"SECTOR REPAIR FAILED — لم يتم اعتماد تعديل جزئي: {exc}", file=sys.stderr)
        sys.exit(1)
