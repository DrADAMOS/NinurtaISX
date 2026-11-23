#!/usr/bin/env python3
"""Review and confirm stocks flagged DIRECTORY_RECONCILIATION_REVIEW_REQUIRED.

The directory sync links a symbol to an OLD record by fuzzy name similarity. Until a human
confirms the link, the recommendation gate keeps that stock blocked with the specific reason
DIRECTORY_MATCH_UNCONFIRMED (the old technicals/fundamentals might belong to another company).

  python scripts/confirm-directory-match.py                       # list flagged symbols
  python scripts/confirm-directory-match.py --confirm BBOB BASH   # confirm only the symbols you name
"""
import datetime, difflib, json, pathlib, re, shutil, sys

sys.stdout.reconfigure(encoding="utf-8")
ROOT = pathlib.Path(__file__).resolve().parent.parent
STOCKS = ROOT / "src" / "data" / "stocks.json"
LEGACY = ROOT / "src" / "data" / "legacy-stocks.json"
FLAG = "DIRECTORY_RECONCILIATION_REVIEW_REQUIRED"


def norm(text: str) -> str:
    text = re.sub(r"\(.*?\)", "", text or "")
    for a, b in (("أ", "ا"), ("إ", "ا"), ("آ", "ا"), ("ة", "ه"), ("ى", "ي")):
        text = text.replace(a, b)
    return re.sub(r"\s+", " ", text).strip()


def sim(a: str, b: str) -> float:
    return difflib.SequenceMatcher(None, norm(a), norm(b)).ratio()


def main(argv):
    raw = STOCKS.read_bytes().decode("utf-8")
    crlf = "\r\n" in raw
    stocks = json.loads(raw)
    legacy = {s["symbol"]: s for s in json.loads(LEGACY.read_text(encoding="utf-8"))} if LEGACY.exists() else {}
    flagged = [s for s in stocks if FLAG in (s.get("dataQualityIssues") or []) and not s.get("directoryMatchConfirmed")]

    if "--confirm" in argv:
        wanted = {a.upper() for a in argv[argv.index("--confirm") + 1:] if not a.startswith("--")}
        if not wanted:
            sys.exit("Name at least one symbol after --confirm (no bulk confirm by design).")
        unknown = wanted - {s["symbol"] for s in flagged}
        if unknown:
            print("Skipped (not flagged or already confirmed):", ", ".join(sorted(unknown)))
        today = datetime.date.today().isoformat()
        done = []
        for s in flagged:
            if s["symbol"] in wanted:
                s["directoryMatchConfirmed"] = {"confirmedAt": today, "note": "confirmed manually via confirm-directory-match.py"}
                done.append(s["symbol"])
        if not done:
            sys.exit("Nothing to confirm.")
        backup = STOCKS.with_name(f"stocks.json.bak-confirm-{datetime.datetime.now():%Y%m%d-%H%M%S}")
        shutil.copy2(STOCKS, backup)
        out = json.dumps(stocks, indent=2, ensure_ascii=False)
        if crlf:
            out = out.replace("\n", "\r\n")
        STOCKS.write_bytes((out + ("\r\n" if crlf else "\n")).encode("utf-8"))
        print(f"Confirmed {len(done)}: {', '.join(done)}\nBackup: {backup.name}")
        return

    print(f"{len(flagged)} stock(s) awaiting directory-match confirmation\n")
    print(f"{'SYMBOL':7} {'SIM':>4} {'ROWS':>5}  OLD NAME  ->  CURRENT NAME")
    rows = [(sim(legacy.get(s['symbol'], {}).get('nameAr', ''), s.get('nameAr', '')), s) for s in flagged]
    for score, s in sorted(rows, key=lambda r: -r[0]):
        old = legacy.get(s["symbol"], {}).get("nameAr", "?")
        print(f"{s['symbol']:7} {score:4.0%} {len(s.get('verifiedHistoricalPrices') or []):5}  {old}  ->  {s.get('nameAr','')}")
    print("\nSimilarity is only a hint. Confirm a symbol only when both names are the same company.")


main(sys.argv[1:])
