import csv
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'src' / 'data' / 'official-csd-history'

class OfficialCsdHistoryTests(unittest.TestCase):
    def test_audit_and_dataset_counts_match(self):
        audit = json.loads((DATA / 'audit_summary.json').read_text(encoding='utf-8'))
        with (DATA / 'csd_regular_market_ohlcv.csv').open(encoding='utf-8-sig', newline='') as f:
            rows = list(csv.DictReader(f))
        self.assertEqual(len(rows), 1922)
        self.assertEqual(audit['records'], len(rows))
        self.assertEqual(audit['duplicatePairs'], 0)
        self.assertEqual(audit['ohlcIssues'], 0)
        self.assertEqual(audit['dateRange'], ['2026-06-22', '2026-11-09'])

    def test_every_imported_stock_has_separate_official_series(self):
        stocks = json.loads((ROOT / 'src' / 'data' / 'stocks.json').read_text(encoding='utf-8'))
        imported = [s for s in stocks if s.get('verifiedHistoricalData', {}).get('verified')]
        self.assertEqual(len(imported), 48)
        self.assertEqual(sum(len(s['verifiedHistoricalPrices']) for s in imported), 1922)
        for stock in imported:
            self.assertTrue(stock['verifiedHistoricalData']['sourceUrl'].startswith('https://csd.gov.iq/'))
            dates = [r['date'] for r in stock['verifiedHistoricalPrices']]
            self.assertEqual(len(dates), len(set(dates)))

if __name__ == '__main__':
    unittest.main()
