import importlib.util
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "update-market-data-public.py"
SPEC = importlib.util.spec_from_file_location("public_market_updater", SCRIPT)
UPDATER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(UPDATER)


SAMPLE = """
<html><body><h1>Session of 8 November 2026</h1>
<table>
<thead><tr><th>Company</th><th>Price</th><th>24h</th><th>7 days</th><th>30 days</th><th>Value</th><th>Trades</th><th>Market cap</th><th>Shares</th></tr></thead>
<tbody>
<tr><td><a href="/en/c/BBOB"><b>Bank of Baghdad</b></a> · Banking</td><td>2.60</td><td>▼ 3.35%</td><td>-4.06%</td><td>-21.45%</td><td>135 M</td><td>185</td><td>1.0 T</td><td>400 B</td></tr>
<tr><td><a href="/en/c/TASC"><b>Asiacell</b></a> · Telecom</td><td>15.30</td><td>+0.26%</td><td>-2.17%</td><td>-8.11%</td><td>208 M</td><td>328</td><td>4.7 T</td><td>310 B</td></tr>
<tr><td><a href="/en/c/BCIH"><b>Cihan Bank</b></a> · Banking</td><td>1.75</td><td>Did not trade this session</td><td></td><td></td><td>—</td><td>—</td><td>700 B</td><td>400 B</td></tr>
</tbody></table></body></html>
"""


class PublicMarketParserTests(unittest.TestCase):
    def test_parses_explicit_session_and_symbols(self):
        result = UPDATER.parse_market_page(SAMPLE)
        self.assertEqual(result["sessionDate"], "2026-11-08")
        self.assertEqual(result["prices"]["BBOB"]["close"], 2.60)
        self.assertAlmostEqual(result["prices"]["BBOB"]["changePercent"], -3.35)
        self.assertEqual(result["prices"]["BBOB"]["tradedValue"], 135_000_000)
        self.assertEqual(result["prices"]["TASC"]["transactionsCount"], 328)
        self.assertIsNone(result["prices"]["BBOB"]["volume"], "Shares outstanding must not be mistaken for traded volume")
        self.assertEqual(result["prices"]["BCIH"]["quoteStatus"], "no_trade")
        self.assertIsNone(result["prices"]["BCIH"]["changePercent"])

    def test_rejects_page_without_explicit_session_date(self):
        with self.assertRaisesRegex(ValueError, "تاريخ الجلسة"):
            UPDATER.parse_market_page(SAMPLE.replace("Session of 8 November 2026", "Market prices"))

    def test_rejects_unrecognized_table(self):
        with self.assertRaisesRegex(ValueError, "لم يتم التعرف"):
            UPDATER.parse_market_page("<h1>Session of 8 November 2026</h1><table><tr><th>Name</th><th>Thing</th></tr></table>")

    def test_compact_units_and_no_change(self):
        self.assertEqual(UPDATER.parse_compact_number("1.2 B"), 1_200_000_000)
        self.assertEqual(UPDATER.parse_percent("No change"), 0.0)
        self.assertIsNone(UPDATER.parse_percent("Did not trade this session"))

    def test_directory_parser_extracts_sector_symbol_and_status(self):
        parts = ["<html><section><h2>Banking 43 companies</h2><ul>"]
        for index in range(UPDATER.EXPECTED_DIRECTORY_COUNT):
            symbol = f"X{index:03d}"
            parts.append(f'<li><a href="/en/c/{symbol}">Company {index} مصرف تجريبي {symbol}</a><p>Active · traded in the last session</p></li>')
        parts.append("</ul></section></html>")
        rows = UPDATER.parse_company_directory("".join(parts))
        self.assertEqual(len(rows), 105)
        self.assertEqual(rows[0]["sector"], "المصارف")
        self.assertEqual(rows[0]["symbol"], "X000")
        self.assertEqual(rows[0]["tradingStatus"], "active")


    def test_directory_parser_collects_split_nested_sector_heading(self):
        parts = ["<html><body>"]
        categories = [
            ("Banking", "المصارف"), ("Industrial", "الصناعة"),
            ("Services", "الخدمات"), ("Hotels &amp; tourism", "الفنادق والسياحة"),
            ("Agriculture", "الزراعة"), ("Financial investment", "الاستثمار المالي"),
            ("Insurance", "التأمين"), ("Telecom", "الاتصالات"),
        ]
        for sector_index, (heading, _arabic) in enumerate(categories):
            parts.append(f'<section><h2><span>{heading}</span> <small>{sector_index + 1} companies</small></h2><ul>')
            for company_index in range(13 if sector_index == 0 else 1):
                symbol = f"Z{sector_index}{company_index:02d}"
                parts.append(f'<li><a href="/en/c/{symbol}">Company {symbol} شركة تجريبية</a><p>Active</p></li>')
            parts.append("</ul></section>")
        parts.append("</body></html>")
        parser = UPDATER.CompanyDirectoryParser()
        parser.feed("".join(parts))
        self.assertEqual(parser.rows[0]["sector"], "المصارف")
        self.assertEqual(parser.rows[13]["sector"], "الصناعة")
        self.assertEqual({row["sector"] for row in parser.rows}, {label for _, label in categories})

    def test_directory_parser_rejects_incomplete_directory(self):
        html = '<section><h2>Banking 1 companies</h2><ul><li><a href="/en/c/BMAL">Bank مصرف BMAL</a></li></ul></section>'
        with self.assertRaisesRegex(ValueError, "دليل الشركات غير مكتمل"):
            UPDATER.parse_company_directory(html)


if __name__ == "__main__":
    unittest.main()
