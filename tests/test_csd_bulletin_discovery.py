import importlib.util
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts' / 'fetch-csd-bulletins.py'
spec = importlib.util.spec_from_file_location('fetch_csd_bulletins', SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class CsdBulletinDiscoveryTests(unittest.TestCase):
    def test_english_reports_archive_is_primary(self):
        self.assertEqual(module.ARCHIVES[0], 'https://csd.gov.iq/en/category/reports-en/')

    def test_exchange_news_alias_points_to_reports_archive(self):
        self.assertEqual(module.ARCHIVES[0], 'https://csd.gov.iq/en/category/reports-en/')

    def test_current_english_daily_report_is_recognized(self):
        self.assertEqual(
            module.article_kind('https://csd.gov.iq/en/daily-report-iraq-stock-exchange-trades-for-july-302026/'),
            'daily'
        )

    def test_monthly_report_is_recognized(self):
        self.assertEqual(
            module.article_kind('https://csd.gov.iq/en/monthly-report-iraq-stock-exchange-july-2026/'),
            'monthly'
        )

    def test_unrelated_csd_page_is_rejected(self):
        self.assertIsNone(module.article_kind('https://csd.gov.iq/en/about-us/'))

    def test_exchange_pdf_attachment_is_recognized(self):
        self.assertTrue(module.is_bulletin_file('https://www.isx-iq.net/isxportal/files/30-7%20E126.pdf'))

    def test_non_official_attachment_host_is_rejected(self):
        self.assertFalse(module.is_bulletin_file('https://example.com/report.pdf'))

    def test_archive_pagination_url(self):
        self.assertEqual(
            module.page_url('https://csd.gov.iq/en/category/reports-en/', 2),
            'https://csd.gov.iq/en/category/reports-en/page/2/'
        )


if __name__ == '__main__':
    unittest.main()
