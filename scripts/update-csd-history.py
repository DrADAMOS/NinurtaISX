#!/usr/bin/env python3
"""Import audited regular-market OHLCV rows from official Iraqi CSD daily PDFs.

Safe by default: downloads/parses into memory and prints a report. Files are only
changed when --apply is supplied. No price interpolation, no synthetic candles,
and no edits to portfolio/localStorage data.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import re
import sys
import time
from datetime import date, datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

CSD_ARCHIVES = [
    "https://csd.gov.iq/en/category/reports-en/",
    "https://csd.gov.iq/en/category/reports-en/page/2/",
    "https://csd.gov.iq/en/category/reports-en/page/3/",
]
CSD_REPORTS_HOME = "https://csd.gov.iq/en/category/reports-en/"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
CSV_FIELDS = [
    "date", "bulletin_no", "company_name", "code", "open", "high", "low",
    "average_price", "previous_average_price", "close", "previous_close",
    "change_percent", "trades", "volume", "value_iqd", "source_file",
    "source_url", "source_sha256",
]
NUM = r"[-+]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?"
NUM_RE = re.compile(NUM)
REPORT_SLUG_RE = re.compile(r"daily-report-iraq-stock-exchange-trades-for-([a-z]+)-(\d{1,2})(\d{4})", re.I)
MONTHS = {m.lower(): i for i, m in enumerate([
    "", "January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"
]) if m}


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[tuple[str, str]] = []
        self._href: str | None = None
        self._text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() == "a":
            self._href = dict(attrs).get("href")
            self._text = []

    def handle_data(self, data: str) -> None:
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "a" and self._href is not None:
            self.links.append((self._href, " ".join(" ".join(self._text).split())))
            self._href = None
            self._text = []


def http_get(url: str, timeout: int = 35) -> bytes:
    req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/pdf,*/*"})
    with urlopen(req, timeout=timeout) as response:
        return response.read()


def parse_report_date(url: str) -> str | None:
    match = REPORT_SLUG_RE.search(url)
    if not match:
        return None
    month = MONTHS.get(match.group(1).lower())
    if not month:
        return None
    try:
        return date(int(match.group(3)), month, int(match.group(2))).isoformat()
    except ValueError:
        return None


def discover_report_pages(from_date: str, to_date: str) -> list[tuple[str, str]]:
    found: dict[str, str] = {}
    errors: list[str] = []
    archive_urls = list(CSD_ARCHIVES)
    start = date.fromisoformat(from_date)
    finish = date.fromisoformat(to_date)
    if (finish - start).days <= 45:
        cursor = start
        while cursor <= finish:
            archive_urls.append(f"https://csd.gov.iq/en/{cursor.year:04d}/{cursor.month:02d}/{cursor.day:02d}/")
            cursor += __import__("datetime").timedelta(days=1)
    for archive in dict.fromkeys(archive_urls):
        try:
            html = http_get(archive).decode("utf-8", errors="replace")
            if "Please wait while your request is being verified" in html or "cf-challenge" in html.lower():
                errors.append(f"CSD archive challenge: {archive}")
                continue
            parser = LinkParser()
            parser.feed(html)
            for href, _label in parser.links:
                absolute = urljoin(archive, href)
                session = parse_report_date(absolute)
                if session and from_date <= session <= to_date:
                    found[session] = absolute
        except Exception as exc:  # network failures are reported, never hidden
            errors.append(f"{archive}: {exc}")
    if not found:
        detail = "\n".join(errors) if errors else "No matching daily-report links were found in the CSD archive pages."
        raise RuntimeError("Could not discover official CSD report pages.\n" + detail)
    return sorted(found.items())


def find_pdf_attachment(report_page: str) -> str:
    html = http_get(report_page).decode("utf-8", errors="replace")
    parser = LinkParser()
    parser.feed(html)
    candidates = []
    for href, label in parser.links:
        absolute = urljoin(report_page, href)
        parsed = urlparse(absolute)
        if parsed.path.lower().endswith(".pdf") and ("isx-iq.net" in parsed.netloc.lower() or "csd.gov.iq" in parsed.netloc.lower()):
            candidates.append(absolute)
    if not candidates:
        raise RuntimeError(f"No official PDF attachment link found on {report_page}")
    # Daily CSD pages have one primary attachment; reject ambiguous pages.
    unique = list(dict.fromkeys(candidates))
    if len(unique) != 1:
        raise RuntimeError(f"Expected one report PDF, found {len(unique)} on {report_page}: {unique}")
    return unique[0]


def download_pdf(url: str) -> bytes:
    attempts = [url]
    if url.startswith("http://"):
        attempts.append("https://" + url[len("http://"):])
    last_error: Exception | None = None
    for candidate in attempts:
        try:
            data = http_get(candidate, timeout=60)
            if not data.startswith(b"%PDF-"):
                raise RuntimeError(f"Attachment did not return a PDF: {candidate}")
            return data
        except Exception as exc:
            last_error = exc
            time.sleep(1)
    raise RuntimeError(f"Unable to download PDF {url}: {last_error}")


def extract_pdf_text(pdf_bytes: bytes) -> str:
    try:
        try:
            import pymupdf as fitz  # Current PyMuPDF API
        except ImportError:
            import fitz  # Compatibility with older PyMuPDF releases
    except ImportError as exc:
        raise RuntimeError("PyMuPDF is required. Install it with: py -3.13 -m pip install PyMuPDF") from exc
    document = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        return "\n".join(page.get_text("text", sort=True) for page in document)
    finally:
        document.close()


def parse_regular_rows(text: str, symbols: set[str], session_date: str,
                       bulletin_no: int, source_file: str, source_url: str,
                       source_sha256: str, minimum_rows: int = 10) -> list[dict[str, Any]]:
    # The first detailed OHLCV table is the Regular Market. PDF text extraction
    # is not consistent across bulletin layouts: some versions split/reorder the
    # column header. Prefer the header when present; otherwise anchor on the first
    # known regular-market ticker followed by the 11 numeric OHLCV fields. The
    # first "Total Of Regular" is a hard boundary before Second Platform data.
    header = re.search(r"Company\s+Name\s+Code\s+opening\s+Price\s+highest\s+price", text, re.I)
    if header:
        section_start = header.start()
    else:
        section_start = None
        for line_match in re.finditer(r"[^\r\n]+", text):
            line = " ".join(line_match.group(0).replace("\u00a0", " ").split())
            for symbol in symbols:
                ticker = re.search(rf"(?<![A-Z0-9]){re.escape(symbol)}\s+", line, re.I)
                if ticker and len(NUM_RE.findall(line[ticker.end():])) >= 11:
                    section_start = line_match.start()
                    break
            if section_start is not None:
                break
        if section_start is None:
            preview = " | ".join(" ".join(x.split()) for x in text.splitlines()[:35] if x.strip())
            raise RuntimeError(f"Could not locate the Regular Market OHLCV header or first ticker row in {source_file}. PDF text preview: {preview[:1400]}")

    section = text[section_start:]
    total = re.search(r"Total\s+Of\s+Regular", section, re.I)
    if total:
        section = section[:total.start()]
    else:
        # If the report uses a different total label, stop before the next
        # explicitly named platform rather than risk cross-platform mixing.
        next_platform = re.search(r"Second\s+Platform\s+Market\s+Bulletin|Non-Disclosing\s+Platform\s+Companies\s+Bulletin", section, re.I)
        if next_platform:
            section = section[:next_platform.start()]

    rows: list[dict[str, Any]] = []
    seen: set[str] = set()
    for line in section.splitlines():
        clean = " ".join(line.replace("\u00a0", " ").split())
        if not clean:
            continue
        for symbol in symbols:
            match = re.search(rf"{re.escape(symbol)}\s+", clean)
            if not match:
                continue
            numeric_text = clean[match.end():]
            values = NUM_RE.findall(numeric_text)
            if len(values) < 11:
                continue
            values = values[:11]
            parsed = [float(v.replace(",", "")) for v in values]
            open_price, high, low, average_price, previous_average, close, previous_close, change, trades, volume, value = parsed
            # A regular traded row must contain actual trades and a positive volume.
            if trades <= 0 or volume <= 0 or any(v <= 0 for v in [open_price, high, low, close]):
                continue
            if high < max(open_price, close, low) or low > min(open_price, close, high):
                raise RuntimeError(f"Invalid OHLC bounds for {symbol} on {session_date} in {source_file}")
            if symbol in seen:
                raise RuntimeError(f"Duplicate regular-market row for {symbol} on {session_date} in {source_file}")
            name = clean[:match.start()].strip(" -\t")
            rows.append({
                "date": session_date, "bulletin_no": bulletin_no, "company_name": name,
                "code": symbol, "open": open_price, "high": high, "low": low,
                "average_price": average_price, "previous_average_price": previous_average,
                "close": close, "previous_close": previous_close, "change_percent": change,
                "trades": int(trades), "volume": int(volume), "value_iqd": int(value),
                "source_file": source_file, "source_url": source_url, "source_sha256": source_sha256,
            })
            seen.add(symbol)
    if len(rows) < minimum_rows:
        raise RuntimeError(f"Only {len(rows)} regular-market rows parsed from {source_file}; minimum is {minimum_rows}, refusing a partial parse")
    return rows


def parse_pdf_report(pdf_bytes: bytes, report_page: str, pdf_url: str,
                     symbols: set[str]) -> tuple[str, int, list[dict[str, Any]]]:
    text = extract_pdf_text(pdf_bytes)
    date_match = re.search(r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(\d{1,2})/(\d{1,2})/(\d{4})", text, re.I)
    if not date_match:
        raise RuntimeError(f"Could not verify session date inside PDF: {pdf_url}")
    session_date = date(int(date_match.group(3)), int(date_match.group(2)), int(date_match.group(1))).isoformat()
    expected_date = parse_report_date(report_page)
    if expected_date != session_date:
        raise RuntimeError(f"Report page date {expected_date} does not match PDF session date {session_date}")
    bulletin_match = re.search(r"Bulletin\s+No\s*\(?\s*(\d+)\s*\)?", text, re.I)
    if not bulletin_match:
        raise RuntimeError(f"Bulletin number not found in {pdf_url}")
    bulletin_no = int(bulletin_match.group(1))
    digest = hashlib.sha256(pdf_bytes).hexdigest()
    filename = Path(urlparse(pdf_url).path).name
    rows = parse_regular_rows(text, symbols, session_date, bulletin_no, filename, pdf_url, digest)
    return session_date, bulletin_no, rows


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json_atomic(path: Path, value: Any) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def main() -> int:
    parser = argparse.ArgumentParser(description="Update verified OHLCV history from official CSD daily reports")
    parser.add_argument("--project", type=Path, default=Path.cwd(), help="Ninurta project root")
    parser.add_argument("--from-date", default="2026-11-10", help="First CSD session date YYYY-MM-DD")
    parser.add_argument("--to-date", default=None, help="Last session date; defaults to today in local system date")
    parser.add_argument("--max-reports", type=int, default=30)
    parser.add_argument("--apply", action="store_true", help="Write files; default is dry-run")
    parser.add_argument("--self-test", action="store_true", help="Run parser regression checks only")
    args = parser.parse_args()

    if args.self_test:
        fixture = """Company Name Code opening Price highest price lowest price Average price Prev Average price Closing Price prev closing price change (%) No.of Trades Traded Volume Traded Value\nAshur International Bank BASH 0.240 0.250 0.240 0.240 0.250 0.240 0.240 0.00 33 42,951,338 10,331,321\nBank of Baghdad BBOB 2.550 2.570 2.510 2.540 2.470 2.550 2.500 2.00 41 14,353,112 36,415,292\nAsia Cell TASC 13.560 13.880 13.560 13.700 13.580 13.750 13.560 1.40 90 2,457,194 33,661,761\nAl-Mansour Bank BMNS 1.800 1.890 1.790 1.830 1.800 1.870 1.800 3.89 112 87,992,205 160,869,710\nIraqi for Seed Production AISP 5.050 5.100 5.030 5.050 5.030 5.100 5.050 0.99 41 7,758,658 39,147,696\nTotal Of Regular 779 337,365,131 657,131,093\nSecond Platform Market Bulletin No (206)\n"""
        test = parse_regular_rows(fixture, {"BASH", "BBOB", "TASC", "BMNS", "AISP"}, "2026-11-18", 206, "fixture.pdf", "https://example.invalid/report.pdf", "0" * 64, minimum_rows=5)
        assert len(test) == 5 and test[0]["close"] == 0.24 and test[1]["volume"] == 14353112
        headerless_fixture = "\n".join(fixture.splitlines()[1:])
        test_headerless = parse_regular_rows(headerless_fixture, {"BASH", "BBOB", "TASC", "BMNS", "AISP"}, "2026-11-18", 206, "headerless.pdf", "https://example.invalid/headerless.pdf", "1" * 64, minimum_rows=5)
        assert len(test_headerless) == 5 and test_headerless[0]["code"] == "BASH"
        print("SELF-TEST PASS: regular-market extraction, headerless PDF fallback, and numeric mapping")
        return 0

    project = args.project.resolve()
    stocks_path = project / "src/data/stocks.json"
    csv_path = project / "src/data/official-csd-history/csd_regular_market_ohlcv.csv"
    json_path = project / "src/data/official-csd-history/csd_regular_market_ohlcv.json"
    audit_path = project / "src/data/official-csd-history/audit_summary.json"
    status_path = project / "src/data/data-status.json"
    for required in [stocks_path, csv_path, json_path, audit_path, status_path]:
        if not required.exists():
            raise SystemExit(f"Required project file missing: {required}")

    stocks = load_json(stocks_path)
    symbols = {str(x.get("symbol", "")).strip().upper() for x in stocks if x.get("symbol")}
    if len(symbols) < 20:
        raise SystemExit("Stock symbol directory is unexpectedly small; aborting")
    today = date.today().isoformat()
    to_date = args.to_date or today
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", args.from_date) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", to_date) or args.from_date > to_date:
        raise SystemExit("Invalid date range")

    report_pages = discover_report_pages(args.from_date, to_date)[-args.max_reports:]
    print(f"Official CSD report pages discovered: {len(report_pages)}")
    parsed_reports: list[dict[str, Any]] = []
    failed_reports: list[dict[str, str]] = []
    new_rows: list[dict[str, Any]] = []
    for session, page_url in report_pages:
        print(f"[FETCH] {session} {page_url}")
        try:
            pdf_url = find_pdf_attachment(page_url)
            pdf_bytes = download_pdf(pdf_url)
            verified_date, bulletin_no, rows = parse_pdf_report(pdf_bytes, page_url, pdf_url, symbols)
            parsed_reports.append({"date": verified_date, "page_url": page_url, "pdf_url": pdf_url,
                                   "sha256": hashlib.sha256(pdf_bytes).hexdigest(), "bulletin_no": bulletin_no,
                                   "rows": len(rows)})
            new_rows.extend(rows)
            print(f"[PARSED] bulletin {bulletin_no}: {len(rows)} regular-market rows")
        except Exception as exc:
            # A bad/mislinked daily PDF must not abort later dates or be imported
            # under the page's date. Record it and continue with the next report.
            reason = " ".join(str(exc).split())
            failed_reports.append({"date": session, "page_url": page_url, "error": reason})
            print(f"[SKIP] {session}: {reason}")

    if not parsed_reports:
        print(f"ERROR: No reports passed PDF date and Regular Market validation; {len(failed_reports)} report(s) skipped.")
        return 2

    existing_rows = list(csv.DictReader(csv_path.open("r", encoding="utf-8-sig", newline="")))
    by_key: dict[tuple[str, str], dict[str, Any]] = {(r["date"], r["code"]): r for r in existing_rows}
    added = 0
    for row in new_rows:
        key = (row["date"], row["code"])
        if key in by_key:
            old = by_key[key]
            compare_fields = ["open", "high", "low", "close", "volume", "trades"]
            if any(abs(float(old[field]) - float(row[field])) > 1e-9 for field in compare_fields):
                raise SystemExit(f"CONFLICT: existing CSD row differs for {key}; no files changed")
            continue
        by_key[key] = row
        added += 1

    merged = sorted(by_key.values(), key=lambda r: (r["date"], r["code"]))
    latest = max((r["date"] for r in merged), default="")
    print("\n--- DRY-RUN SUMMARY ---" if not args.apply else "\n--- APPLY SUMMARY ---")
    print(f"Reports parsed: {len(parsed_reports)}")
    print(f"Reports skipped (not imported): {len(failed_reports)}")
    for failure in failed_reports:
        print(f"  [SKIPPED] {failure['date']}: {failure['error']}")
    print(f"New official OHLCV rows: {added}")
    print(f"Total history rows after merge: {len(merged)}")
    print(f"Unique securities: {len({r['code'] for r in merged})}")
    print(f"Latest official session in history: {latest}")
    if not args.apply:
        print("DRY RUN ONLY — no project files were changed. Review the report counts, then rerun with --apply.")
        return 0

    retrieved_at = datetime.now().astimezone().isoformat(timespec="seconds")
    backup_dir = project / "backups" / f"before-csd-history-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    backup_dir.mkdir(parents=True, exist_ok=False)
    for path in [stocks_path, csv_path, json_path, audit_path, status_path]:
        (backup_dir / path.name).write_bytes(path.read_bytes())

    # CSV is the canonical row-level audit table. JSON mirrors the same rows with numeric types.
    with csv_path.with_suffix(".csv.tmp").open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(merged)
    csv_path.with_suffix(".csv.tmp").replace(csv_path)

    numeric_fields = {"bulletin_no", "open", "high", "low", "average_price", "previous_average_price", "close", "previous_close", "change_percent", "trades", "volume", "value_iqd"}
    json_rows = []
    for row in merged:
        converted = dict(row)
        for field in numeric_fields:
            converted[field] = float(converted[field]) if field not in {"bulletin_no", "trades", "volume", "value_iqd"} else int(float(converted[field]))
        json_rows.append(converted)
    write_json_atomic(json_path, json_rows)

    by_symbol: dict[str, list[dict[str, Any]]] = {}
    for row in json_rows:
        by_symbol.setdefault(row["code"], []).append(row)
    all_pdf_count = len({r["source_sha256"] for r in json_rows})
    report_dates = sorted({r["date"] for r in json_rows})
    for stock in stocks:
        symbol = str(stock.get("symbol", "")).upper()
        history = by_symbol.get(symbol, [])
        if not history:
            stock.pop("verifiedHistoricalPrices", None)
            stock.pop("verifiedHistoricalData", None)
            continue
        stock["verifiedHistoricalPrices"] = [
            {"date": r["date"], "open": r["open"], "high": r["high"], "low": r["low"], "close": r["close"], "volume": r["volume"]}
            for r in history
        ]
        stock["verifiedHistoricalData"] = {
            "verified": True,
            "source": "Central Securities Depository of Iraq — official daily Regular Market bulletins",
            "sourceUrl": CSD_REPORTS_HOME,
            "retrievedAt": retrieved_at,
            "firstSession": history[0]["date"],
            "lastSession": history[-1]["date"],
            "rowCount": len(history),
            "pdfCount": len({r["source_sha256"] for r in history}),
            "reportsWithDates": len({r["date"] for r in history}),
            "audit": "PDF SHA-256 recorded per row; Regular Market section only; no interpolation, carry-forward, synthetic candles, or cross-platform mixing.",
        }

    write_json_atomic(stocks_path, stocks)
    audit = load_json(audit_path)
    audit.update({
        "source": "Central Securities Depository of Iraq daily trading reports",
        "retrievedAt": retrieved_at,
        "dateRange": [report_dates[0], report_dates[-1]] if report_dates else [None, None],
        "tradingDates": report_dates,
        "records": len(json_rows),
        "uniqueSecurities": len({r["code"] for r in json_rows}),
        "uniqueDateSecurityPairs": len({(r["date"], r["code"]) for r in json_rows}),
        "duplicatePairs": 0,
        "recentImport": parsed_reports,
        "recentImportFailures": failed_reports,
        "notes": [
            "Regular Market Bulletin rows only. Second Platform, Non-Disclosing, OTC, non-Iraqi and bond bulletins are excluded.",
            "OHLC mapping follows printed columns: opening, highest, lowest, closing.",
            "No records were fabricated, interpolated, merged across platforms, or adjusted.",
            "Each row retains PDF URL and SHA-256 for auditability.",
        ],
    })
    write_json_atomic(audit_path, audit)
    status = load_json(status_path)
    status.update({
        "historyUpdated": True,
        "historicalSource": "Central Securities Depository of Iraq — official daily Regular Market bulletins",
        "historicalLastSession": latest,
        "historyRetrievedAt": retrieved_at,
        "historyRecords": len(json_rows),
        "historyReports": len({r["source_sha256"] for r in json_rows}),
        "technicalIndicatorsUpdated": False,
        "recommendations": "technical readings are recalculated from verifiedHistoricalPrices at runtime; actionable buy/sell levels remain locked unless separately source-verified",
    })
    write_json_atomic(status_path, status)
    print(f"APPLIED. Backup: {backup_dir}")
    print("Quotes, portfolio records, and localStorage keys were not modified.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (RuntimeError, HTTPError, URLError, OSError, ValueError, AssertionError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(2)
