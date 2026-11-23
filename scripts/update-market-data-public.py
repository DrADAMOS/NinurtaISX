#!/usr/bin/env python3
"""Personal, local-only ISX quote updater using the public IraqSM market table.

This source exposes end-of-session quote fields, not full OHLC history. The updater
therefore refreshes only fields explicitly present in the public table and never
fabricates open/high/low or historical candles.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import unicodedata
from difflib import SequenceMatcher
import sys
import time
from datetime import date, datetime, timedelta
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
STOCKS_PATH = ROOT / "src" / "data" / "stocks.json"
STATUS_PATH = ROOT / "src" / "data" / "data-status.json"
BACKUP_DIR = ROOT / "backups"
BASE_URL = "https://iraqsm.com/en/market"
DIRECTORY_URL = "https://iraqsm.com/en/companies"
EXPECTED_DIRECTORY_COUNT = 105
BAGHDAD = ZoneInfo("Asia/Baghdad")
USER_AGENT = "Ninurta-Personal-ISX-Updater/1.0 (local personal use)"


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def header_key(value: str) -> str:
    value = (value or "").lower().replace("↕", "").replace("↓", "").replace("↑", "")
    return re.sub(r"[^a-z0-9%]+", "", value)


def parse_compact_number(value: str):
    text = clean_text(value).replace(",", "").replace("%", "")
    text = re.sub(r"^[▲▼↑↓+\-\s]+", "", text)
    if text.lower() in {"", "—", "–", "-", "n/a", "no change", "did not trade this session"}:
        return None
    factor = 1
    suffix = text[-1:].upper()
    if suffix in {"K", "M", "B", "T"}:
        factor = {"K": 1e3, "M": 1e6, "B": 1e9, "T": 1e12}[suffix]
        text = text[:-1].strip()
    try:
        number = float(text) * factor
    except ValueError:
        return None
    return number if number >= 0 else None


def parse_percent(value: str):
    text = clean_text(value)
    if not text or text in {"—", "–", "-"} or "did not trade" in text.lower() or "suspended" in text.lower():
        return None
    if "no change" in text.lower():
        return 0.0
    match = re.search(r"([+-]?\d+(?:\.\d+)?)\s*%", text)
    if not match:
        return None
    value = float(match.group(1))
    if "▼" in text or "↓" in text:
        return -abs(value)
    if "▲" in text or "↑" in text:
        return abs(value)
    return value


class MarketTableParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tables = []
        self.table = None
        self.row = None
        self.cell = None
        self.bold_depth = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "b" and self.cell is not None:
            self.bold_depth += 1
        if tag == "table":
            if self.table is None:
                self.table = []
        elif self.table is not None and tag == "tr":
            self.row = []
        elif self.table is not None and tag in {"td", "th"}:
            self.cell = {"text": "", "bold": "", "symbol": None}
        elif tag == "a" and self.cell is not None:
            match = re.search(r"/(?:en/)?c/([A-Z0-9]{2,8})(?:[/?#]|$)", attrs.get("href", ""), re.I)
            if match:
                self.cell["symbol"] = match.group(1).upper()

    def handle_data(self, data):
        if self.cell is not None:
            self.cell["text"] += data
            if self.bold_depth:
                self.cell["bold"] += data

    def handle_endtag(self, tag):
        if tag == "b" and self.bold_depth:
            self.bold_depth -= 1
        elif tag in {"td", "th"} and self.cell is not None and self.row is not None:
            self.cell["text"] = clean_text(self.cell["text"])
            self.cell["bold"] = clean_text(self.cell["bold"])
            self.row.append(self.cell)
            self.cell = None
        elif tag == "tr" and self.row is not None and self.table is not None:
            self.table.append(self.row)
            self.row = None
        elif tag == "table" and self.table is not None:
            self.tables.append(self.table)
            self.table = None


def extract_session_date(html: str):
    text = clean_text(re.sub(r"<[^>]+>", " ", html))
    patterns = [
        r"Session\s+of\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})",
        r"Session\s+of\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4})",
        r"(?:Trading|Market)\s+Session(?:\s+Date)?\s*[:：]\s*(\d{4}-\d{2}-\d{2})",
    ]
    for pattern in patterns:
        match = re.search(pattern, html, re.I) or re.search(pattern, text, re.I)
        if match:
            value = match.group(1).strip()
            for fmt in ("%Y-%m-%d", "%d %B %Y", "%d %b %Y", "%B %d, %Y", "%B %d %Y"):
                try:
                    return datetime.strptime(value, fmt).date().isoformat()
                except ValueError:
                    pass
    return None


def parse_market_page(html: str):
    session_date = extract_session_date(html)
    if not session_date:
        raise ValueError("لم أجد تاريخ الجلسة المعلن داخل الصفحة؛ تم رفض البيانات.")
    parser = MarketTableParser()
    parser.feed(html)
    aliases = {
        "symbol": {"company", "symbol", "stock"},
        "close": {"price", "close", "last", "lastprice"},
        "change_pct": {"24h", "change%", "changepercent", "chg%"},
        "volume": {"volume", "tradedshares"},
        "value": {"value", "tradedvalue", "turnover"},
        "trades": {"trades", "numberoftrades", "tradecount"},
    }
    prices = {}
    recognized = False
    for table in parser.tables:
        header = next((row for row in table if len(row) >= 4 and any(header_key(c["text"]) in aliases["symbol"] for c in row)), None)
        if not header:
            continue
        keys = [header_key(cell["text"]) for cell in header]
        indices = {}
        for field, options in aliases.items():
            for idx, key in enumerate(keys):
                if key in options:
                    indices[field] = idx
                    break
        if not {"close", "change_pct"}.issubset(indices):
            continue
        recognized = True
        for row in table:
            if not row:
                continue
            symbol = next((cell.get("symbol") for cell in row if cell.get("symbol")), None)
            if not symbol or symbol in prices:
                continue
            def cell(field):
                idx = indices.get(field)
                return row[idx]["text"] if idx is not None and idx < len(row) else ""
            close = parse_compact_number(cell("close"))
            if close is None or close <= 0:
                continue
            change_text = clean_text(cell("change_pct"))
            pct = parse_percent(change_text)
            volume = parse_compact_number(cell("volume"))
            value = parse_compact_number(cell("value"))
            trades = parse_compact_number(cell("trades"))
            lowered = change_text.lower()
            quote_status = "suspended" if "suspended" in lowered else ("no_trade" if "did not trade" in lowered else "published")
            prices[symbol] = {
                "close": close,
                "changePercent": pct,
                "volume": volume,
                "tradedValue": value,
                "transactionsCount": trades,
                "quoteStatus": quote_status,
                "quoteStatusText": change_text,
            }
    if not recognized:
        raise ValueError("لم يتم التعرف على جدول الأسعار؛ لم تتطابق عناوين الأعمدة مع المتوقع.")
    if not prices:
        raise ValueError("تم التعرف على الجدول لكن لم تُستخرج أسعار صالحة.")
    return {"sessionDate": session_date, "prices": prices}


def fetch_page():
    """Fetch the latest published market page once; do not crawl historical dates."""
    request = Request(BASE_URL, headers={"User-Agent": USER_AGENT, "Accept": "text/html"})
    with urlopen(request, timeout=30) as response:
        if response.status != 200:
            raise RuntimeError(f"HTTP {response.status} من مصدر الأسعار")
        raw = response.read()
    html = raw.decode("utf-8", errors="replace")
    return BASE_URL, html



class CompanyDirectoryParser(HTMLParser):
    """Extract listed companies and their sector from the public directory.

    Headings may contain nested spans, so collect the complete heading text
    before interpreting it. The previous parser tried to match each HTML text
    fragment independently and silently left every company in the default
    sector "عام".
    """
    SECTOR_MAP = {
        "banking": "المصارف",
        "industrial": "الصناعة",
        "services": "الخدمات",
        "hotels & tourism": "الفنادق والسياحة",
        "agriculture": "الزراعة",
        "financial investment": "الاستثمار المالي",
        "insurance": "التأمين",
        "telecom": "الاتصالات",
    }

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.sector = "عام"
        self.heading_tag = None
        self.heading_text = ""
        self.item_depth = 0
        self.item_text = ""
        self.item_symbol = None
        self.item_links = []
        self.rows = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in {"h1", "h2", "h3", "h4"}:
            self.heading_tag = tag
            self.heading_text = ""
        elif tag == "li" and self.item_depth == 0:
            self.item_depth = 1
            self.item_text = ""
            self.item_symbol = None
        elif self.item_depth and tag == "li":
            self.item_depth += 1
        elif self.item_depth and tag == "a":
            match = re.search(r"/c/([A-Z0-9]{2,8})(?:[/?#]|$)", attrs.get("href", ""), re.I)
            if match:
                self.item_symbol = match.group(1).upper()

    def handle_data(self, data):
        if self.heading_tag:
            self.heading_text += " " + data
        if self.item_depth:
            self.item_text += " " + data

    def handle_endtag(self, tag):
        if self.heading_tag == tag:
            heading = clean_text(self.heading_text)
            match = re.match(r"(.+?)\s+\d+\s+companies$", heading, re.I)
            if match:
                key = clean_text(match.group(1)).lower()
                self.sector = self.SECTOR_MAP.get(key, clean_text(match.group(1)))
            self.heading_tag = None
            self.heading_text = ""
        elif tag == "li" and self.item_depth:
            self.item_depth -= 1
            if self.item_depth == 0 and self.item_symbol:
                text = clean_text(self.item_text)
                symbol = self.item_symbol
                prefix = text.split(symbol, 1)[0].strip()
                arabic_at = next((i for i, ch in enumerate(prefix) if "\u0600" <= ch <= "\u06ff"), -1)
                name_en = prefix[:arabic_at].strip() if arabic_at > 0 else prefix
                name_ar = prefix[arabic_at:].strip() if arabic_at >= 0 else prefix
                tail = text.split(symbol, 1)[-1]
                status = "suspended" if re.search(r"Suspended", tail, re.I) else ("active" if re.search(r"Active", tail, re.I) else "not_traded_recently")
                last_match = re.search(r"last traded (\d{1,2} [A-Za-z]+ \d{4})", tail, re.I)
                cap_match = re.search(r"Capital\s+([\d.]+\s+[MBT]?\s*IQD)", tail, re.I)
                self.rows.append({
                    "symbol": symbol, "nameEn": name_en or symbol, "nameAr": name_ar or name_en or symbol,
                    "sector": self.sector, "tradingStatus": status,
                    "lastTraded": last_match.group(1) if last_match else None,
                    "capital": cap_match.group(1) if cap_match else None,
                })


def fetch_directory_page():
    request = Request(DIRECTORY_URL, headers={"User-Agent": USER_AGENT, "Accept": "text/html"})
    with urlopen(request, timeout=30) as response:
        if response.status != 200:
            raise RuntimeError(f"HTTP {response.status} من دليل الشركات")
        return response.read().decode("utf-8", errors="replace")


def parse_company_directory(html: str):
    parser = CompanyDirectoryParser()
    parser.feed(html)
    rows = parser.rows
    symbols = [row["symbol"] for row in rows]
    if len(rows) != EXPECTED_DIRECTORY_COUNT or len(set(symbols)) != EXPECTED_DIRECTORY_COUNT:
        raise ValueError(f"دليل الشركات غير مكتمل أو يحتوي رموزاً مكررة: {len(rows)} صفاً، {len(set(symbols))} رمزاً فريداً؛ المتوقع {EXPECTED_DIRECTORY_COUNT}.")
    unclassified = sorted(row["symbol"] for row in rows if row["sector"] == "عام")
    return rows


def normalize_company_name(value: str):
    value = unicodedata.normalize("NFKC", value or "").lower()
    value = re.sub(r"[\W_]+", "", value, flags=re.UNICODE)
    return value.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ى", "ي")


def blank_stock(company):
    return {
        "symbol": company["symbol"], "nameAr": company["nameAr"], "nameEn": company["nameEn"], "sector": company["sector"],
        "currentPrice": 0, "previousClose": 0, "change": 0, "changePercent": 0, "quoteStatus": "unknown",
        "quoteStatusText": "لا تتوفر لقطة سعر موثوقة بعد", "high": 0, "low": 0, "open": 0, "limitUp": 0, "limitDown": 0,
        "volume": 0, "tradedValue": 0, "transactionsCount": 0, "marketCap": 0, "sharesIssued": 0,
        "bookValue": 0, "peRatio": 0, "pbRatio": 0, "dividendYield": 0, "lastDividend": 0, "eps": 0, "roe": 0,
        "debtToEquity": 0, "freeFloatPercent": 0, "week52High": 0, "week52Low": 0, "signal": "انتظار",
        "signalReason": "شركة مدرجة؛ لا توجد بيانات مالية أو فنية موثقة في قاعدة Ninurta بعد.", "investmentScore": 0,
        "speculationScore": 0, "signalStrength": 0, "entryTarget": 0, "stopLoss": 0, "targetPrice1": 0, "targetPrice2": 0,
        "riskLevel": "غير محددة", "timeHorizon": "مراقبة واقتناص", "fairValue": 0, "rsi": 0, "macd": "غير متاح",
        "ma20": 0, "ma50": 0, "support1": 0, "support2": 0, "resistance1": 0, "resistance2": 0,
        "historicalPrices": [], "dataQualityStatus": "quarantined", "dataQualityIssues": ["NO_VERIFIED_FINANCIAL_OR_PRICE_DATA"],
        "listingStatus": company["tradingStatus"], "listingDirectorySource": DIRECTORY_URL,
    }


def sync_directory(dry_run=False):
    companies = parse_company_directory(fetch_directory_page())
    old = load_json(STOCKS_PATH)
    old_by_symbol = {str(row.get("symbol", "")).upper(): row for row in old if isinstance(row, dict)}
    new_symbols = {row["symbol"] for row in companies}
    old_symbols = set(old_by_symbol)
    additions = sorted(new_symbols - old_symbols)
    removals = sorted(old_symbols - new_symbols)
    matched = []
    rebuilt = []
    for company in companies:
        candidate = old_by_symbol.get(company["symbol"])
        if candidate:
            old_name = normalize_company_name(candidate.get("nameAr", ""))
            new_name = normalize_company_name(company["nameAr"])
            old_en = normalize_company_name(candidate.get("nameEn", ""))
            new_en = normalize_company_name(company["nameEn"])
            similarity = max(SequenceMatcher(None, old_name, new_name).ratio(), SequenceMatcher(None, old_en, new_en).ratio())
            if similarity >= 0.72:
                row = dict(candidate)
                row.update({"nameAr": company["nameAr"], "nameEn": company["nameEn"], "sector": company["sector"], "listingStatus": company["tradingStatus"], "listingDirectorySource": DIRECTORY_URL})
                issues = list(row.get("dataQualityIssues") or [])
                if "DIRECTORY_RECONCILIATION_REVIEW_REQUIRED" not in issues:
                    issues.append("DIRECTORY_RECONCILIATION_REVIEW_REQUIRED")
                row["dataQualityIssues"] = issues
                row["dataQualityStatus"] = "review_required"
                matched.append(company["symbol"])
            else:
                row = blank_stock(company)
        else:
            row = blank_stock(company)
        rebuilt.append(row)
    print(f"Directory: {len(companies)} listed companies across 8 sectors")
    print(f"Existing records safely name-matched: {len(matched)}")
    print(f"New directory symbols: {len(additions)}; retired/removed symbols: {len(removals)}")
    if additions:
        print("New: " + ", ".join(additions))
    if removals:
        print("Removed from current directory (will be archived): " + ", ".join(removals))
    if dry_run:
        print("DIRECTORY DRY RUN: no files were changed.")
        return
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(BAGHDAD).strftime("%Y%m%d-%H%M%S")
    shutil.copy2(STOCKS_PATH, BACKUP_DIR / f"stocks-before-directory-sync-{stamp}.json")
    legacy_path = ROOT / "src" / "data" / "legacy-stocks.json"
    if legacy_path.exists():
        legacy = load_json(legacy_path)
        known = {x.get("symbol") for x in legacy if isinstance(x, dict)}
        legacy.extend(x for x in old if x.get("symbol") not in known)
    else:
        legacy = old
    atomic_json(legacy_path, legacy)
    atomic_json(STOCKS_PATH, rebuilt)
    status = load_json(STATUS_PATH) if STATUS_PATH.exists() else {}
    status.update({"trackedStocks": len(rebuilt), "directoryCount": len(companies), "directorySource": DIRECTORY_URL, "directorySyncedAt": datetime.now(BAGHDAD).isoformat(timespec="seconds"), "status": "directory_synced_quotes_not_refreshed"})
    status["note"] = "دليل الشركات تمت مزامنته. السجلات الجديدة بلا أسعار أو مؤشرات؛ الشركات المطابقة احتفظت بتاريخها لكن توصياتها مقفلة لحين مراجعة جودة البيانات. ملف الشركات السابقة محفوظ في legacy-stocks.json."
    atomic_json(STATUS_PATH, status)
    print(f"Directory synchronized: {len(rebuilt)} companies. Legacy archive: {legacy_path}")

def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def atomic_json(path: Path, payload):
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp.replace(path)


def run(dry_run=False):
    stocks = load_json(STOCKS_PATH)
    if not isinstance(stocks, list) or len(stocks) != EXPECTED_DIRECTORY_COUNT:
        raise RuntimeError(f"يجب مزامنة دليل الشركات أولاً؛ المتوقع {EXPECTED_DIRECTORY_COUNT} شركة، الموجود: {len(stocks) if isinstance(stocks, list) else 'غير صالح'}. شغّل --sync-directory بعد مراجعة --directory-dry-run.")
    symbols = [str(stock.get("symbol", "")).upper() for stock in stocks]
    if len(set(symbols)) != len(symbols) or not all(symbols):
        raise RuntimeError("رموز الأسهم مكررة أو ناقصة في قاعدة البيانات.")

    directory = parse_company_directory(fetch_directory_page())
    directory_symbols = {row["symbol"] for row in directory}
    if set(symbols) != directory_symbols:
        raise RuntimeError("قاعدة البيانات لا تطابق دليل الشركات الحالي؛ شغّل --sync-directory أولاً.")
    source_url, html = fetch_page()
    parsed = parse_market_page(html)
    session_date = parsed["sessionDate"]
    source_day = date.fromisoformat(session_date)
    age_days = (datetime.now(BAGHDAD).date() - source_day).days
    if age_days < 0 or age_days > 7:
        raise RuntimeError(f"تاريخ آخر جلسة منشور غير مقبول أو قديم ({session_date}, age={age_days} days). لم تُغيّر قاعدة البيانات.")
    quote_map = parsed["prices"]
    unknown_quotes = sorted(set(quote_map) - directory_symbols)
    if unknown_quotes:
        raise RuntimeError("جدول الأسعار يحتوي رموزاً غير موجودة في دليل الشركات: " + ", ".join(unknown_quotes))

    previous_dates = [s.get("marketSessionDate") for s in stocks if s.get("marketSessionDate")]
    newest = max(previous_dates) if previous_dates else None
    if newest and session_date < newest:
        raise RuntimeError(f"تاريخ المصدر {session_date} أقدم من آخر جلسة مخزنة {newest}؛ رفض التراجع.")
    if newest and session_date == newest:
        print(f"No new market session: source session {session_date} is already stored. Existing files were not changed.")
        return

    retrieved_at = datetime.now(BAGHDAD).isoformat(timespec="seconds")
    updated = []
    for stock in stocks:
        symbol = stock["symbol"].upper()
        quote = quote_map.get(symbol)
        row = dict(stock)
        if quote is None:
            # No quote row is not a zero-price event. Keep the last known price unchanged.
            listing_status = row.get("listingStatus", "not_traded_recently")
            row["quoteStatus"] = "suspended" if listing_status == "suspended" else "no_trade"
            row["quoteStatusText"] = "موقوف حسب دليل الشركات" if listing_status == "suspended" else "لم يظهر له تداول في جدول الجلسة؛ السعر السابق لم يتغير"
            updated.append(row)
            continue
        row["currentPrice"] = quote["close"]
        row["changePercent"] = quote["changePercent"] if quote["changePercent"] is not None else 0.0
        if quote["volume"] is not None:
            row["volume"] = quote["volume"]
        if quote["tradedValue"] is not None:
            row["tradedValue"] = quote["tradedValue"]
        if quote["transactionsCount"] is not None:
            row["transactionsCount"] = quote["transactionsCount"]
        row["source"] = "IQWealth public market page (iraqsm.com)"
        row["sourceUrl"] = source_url
        row["retrievedAt"] = retrieved_at
        row["marketSessionDate"] = session_date
        row["priceDataType"] = "public_end_of_session_quote_snapshot"
        refreshed_fields = ["currentPrice", "quoteStatus"]
        refreshed_fields.append("changePercent")
        if quote["volume"] is not None:
            refreshed_fields.append("volume")
        if quote["tradedValue"] is not None:
            refreshed_fields.append("tradedValue")
        if quote["transactionsCount"] is not None:
            refreshed_fields.append("transactionsCount")
        row["quoteStatus"] = quote["quoteStatus"]
        row["quoteStatusText"] = quote["quoteStatusText"]
        row["quoteFieldsRefreshed"] = refreshed_fields
        row["quoteSnapshotNote"] = "Public page does not publish full OHLC for this updater. Existing OHLC history and technical levels were not modified or refreshed. A no_trade/suspended row may show the last traded price rather than a trade in this session."
        # Do not alter open/high/low, previousClose, OHLC history, fundamentals, or technical levels.
        updated.append(row)

    status = {
        "status": "updated_quote_snapshot_only",
        "provider": "IQWealth public market page (iraqsm.com)",
        "providerUrl": source_url,
        "dataType": "public_end_of_session_quote_snapshot",
        "marketSessionDate": session_date,
        "retrievedAt": retrieved_at,
        "trackedStocks": len(updated),
        "matchedSymbols": len(quote_map),
        "listedCompanies": len(updated),
        "companiesWithoutQuoteRow": len(updated) - len(quote_map),
        "historyUpdated": False,
        "technicalIndicatorsUpdated": False,
        "recommendations": "remain_locked_until_full_OHLC_history_and_technical_recalculation_are_verified",
        "note": "Only fields explicitly published in the public market table were refreshed. Rows marked no_trade or suspended may carry the last traded price. OHLC history, previousClose, open/high/low, fundamentals, and technical levels were not fabricated or changed.",
    }

    print(f"Source: {source_url}")
    print(f"Session: {session_date}; updated quote rows {len(quote_map)}/{len(stocks)} listed companies")
    print(f"Retrieved: {retrieved_at}")
    print("Request policy: one latest-market-page request per run; no historical crawling.")
    if dry_run:
        print("DRY RUN: validation passed; no files were changed.")
        return

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(BAGHDAD).strftime("%Y%m%d-%H%M%S")
    backup = BACKUP_DIR / f"stocks-before-public-update-{stamp}.json"
    shutil.copy2(STOCKS_PATH, backup)
    status["backupFile"] = str(backup.relative_to(ROOT)).replace("\\", "/")
    atomic_json(STOCKS_PATH, updated)
    atomic_json(STATUS_PATH, status)
    print(f"Updated quote snapshot for {len(updated)} stocks. Backup: {backup}")
    print("NOTE: Historical OHLCV and technical levels were deliberately left untouched.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Update Ninurta personal ISX quote snapshot from public market page")
    parser.add_argument("--dry-run", action="store_true", help="fetch and validate quotes without modifying files")
    parser.add_argument("--directory-dry-run", action="store_true", help="preview 105-company directory reconciliation without modifying files")
    parser.add_argument("--sync-directory", action="store_true", help="backup and synchronize the current listed-company directory")
    args = parser.parse_args()
    try:
        if args.directory_dry_run:
            sync_directory(dry_run=True)
        elif args.sync_directory:
            sync_directory(dry_run=False)
        else:
            run(dry_run=args.dry_run)
    except (HTTPError, URLError, TimeoutError, OSError, ValueError, RuntimeError) as exc:
        print(f"UPDATE FAILED — no partial update was applied: {exc}", file=sys.stderr)
        sys.exit(1)
