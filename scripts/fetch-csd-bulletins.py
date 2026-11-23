#!/usr/bin/env python3
"""Download public CSD daily trading bulletins without importing unverified data.

The current CSD archive is the English WordPress category /en/category/reports-en/.
Each article links to an attachment hosted by the Iraq Stock Exchange.  Older
Arabic archive URLs are retained as a fallback.  Downloads are immutable by
URL/hash in the manifest; this script never edits stocks.json.
"""
from __future__ import annotations
import argparse, hashlib, json, re, time
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse, quote
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
# The English reports archive is the primary source. Keep Arabic archives as
# fallbacks; the general Arabic news category can return HTTP 200 without
# containing daily report attachments, so it must never block the English scan.
ARCHIVES = [
    'https://csd.gov.iq/en/category/reports-en/',
    'https://csd.gov.iq/category/نشرات-التداول-اليومية/',
    'https://csd.gov.iq/category/اخبار-سوق-العراق-للأوراق-المالية/',
]
OUT = ROOT / 'public' / 'historical-sources' / 'csd'

class Links(HTMLParser):
    def __init__(self):
        super().__init__(); self.links: list[str] = []
    def handle_starttag(self, tag, attrs):
        if tag.lower() == 'a':
            href = dict(attrs).get('href', '')
            if href: self.links.append(href)

def get(url: str):
    req = Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (compatible; NinurtaPersonalResearch/1.1)',
        'Accept': 'text/html,application/pdf,application/octet-stream,*/*',
    })
    with urlopen(req, timeout=45) as response:
        return response.geturl(), response.read(), response.headers.get('Content-Type', '')

def article_kind(url: str) -> str | None:
    host = (urlparse(url).hostname or '').lower()
    path = urlparse(url).path.lower()
    if host not in {'csd.gov.iq', 'www.csd.gov.iq'}:
        return None
    if any(token in path for token in ('monthly-report', 'التقرير-الشهري', 'تقارير-شهرية')):
        return 'monthly'
    if any(token in path for token in ('daily-report-iraq-stock-exchange-trades', 'التقرير-اليومي-لتداولات', 'نشرة-التداول')):
        return 'daily'
    return None

def is_bulletin_file(url: str) -> bool:
    host = (urlparse(url).hostname or '').lower()
    path = urlparse(url).path.lower()
    return host in {'isx-iq.net', 'www.isx-iq.net', 'csd.gov.iq', 'www.csd.gov.iq'} and bool(
        re.search(r'\.(pdf|xlsx?|docx?)(?:$)', path)
    )

def page_url(base: str, page: int) -> str:
    # Encode Arabic slugs before passing them to urllib on Windows/Linux.
    parsed = urlparse(base)
    safe_path = quote(parsed.path, safe='/%:@')
    encoded_base = parsed._replace(path=safe_path).geturl()
    if page <= 1: return encoded_base
    return urljoin(encoded_base.rstrip('/') + '/', f'page/{page}/')

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pages', type=int, default=10, help='Archive pages to scan (3 reports per page; max 775)')
    ap.add_argument('--delay', type=float, default=0.5)
    ap.add_argument('--archive', choices=['exchange-news', 'english', 'arabic', 'auto'], default='auto')
    ap.add_argument('--kind', choices=['all', 'daily', 'monthly'], default='all', help='Report type to download')
    args = ap.parse_args()
    pages = max(1, min(args.pages, 775))
    archive_map = {'exchange-news': ARCHIVES[0], 'english': ARCHIVES[0], 'arabic': ARCHIVES[1]}
    bases = ARCHIVES if args.archive == 'auto' else [archive_map[args.archive]]
    OUT.mkdir(parents=True, exist_ok=True)
    manifest_path = OUT / 'manifest.json'
    old = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {}
    known = {x.get('url'): x for x in old.get('files', []) if x.get('url')}
    seen_articles: set[str] = set()
    downloaded = 0
    pages_scanned = []
    for base in bases:
        successful_pages = 0
        matching_articles = 0
        for page in range(1, pages + 1):
            listing_url = page_url(base, page)
            try:
                final_listing, body, _ = get(listing_url)
                successful_pages += 1
            except Exception as exc:
                print(f'PAGE ERROR {listing_url}: {exc}')
                if page == 1: break
                continue
            parser = Links(); parser.feed(body.decode('utf-8', 'replace'))
            articles = []
            for href in parser.links:
                full = urljoin(final_listing, href)
                if article_kind(full) and (args.kind == 'all' or article_kind(full) == args.kind) and full not in seen_articles:
                    seen_articles.add(full); articles.append(full)
            matching_articles += len(articles)
            pages_scanned.append({'url': listing_url, 'articlesFound': len(articles)})
            for article in articles:
                try:
                    article_url, article_body, _ = get(article)
                    detail = Links(); detail.feed(article_body.decode('utf-8', 'replace'))
                    files = [urljoin(article_url, h) for h in detail.links]
                    files = list(dict.fromkeys(u for u in files if is_bulletin_file(u)))
                    if not files:
                        print(f'NO ATTACHMENT {article_url}')
                    for file_url in files:
                        if file_url in known and (ROOT / known[file_url]['file']).exists():
                            continue
                        try:
                            final_file, data, ctype = get(file_url)
                            name = Path(urlparse(final_file).path).name or f'bulletin-{len(known)+1}.pdf'
                            dest = OUT / name
                            if dest.exists() and hashlib.sha256(dest.read_bytes()).hexdigest() != hashlib.sha256(data).hexdigest():
                                dest = OUT / (dest.stem + '-' + hashlib.sha256(data).hexdigest()[:8] + dest.suffix)
                            dest.write_bytes(data)
                            item = {
                                'articleUrl': article_url, 'reportType': article_kind(article_url), 'url': final_file,
                                'file': str(dest.relative_to(ROOT)), 'bytes': len(data),
                                'sha256': hashlib.sha256(data).hexdigest(),
                                'contentType': ctype, 'retrievedAt': datetime.now().astimezone().isoformat(timespec='seconds'),
                            }
                            known[final_file] = item; downloaded += 1
                            print(f'DOWNLOADED {name} ({len(data)} bytes)')
                        except Exception as exc:
                            print(f'FILE ERROR {file_url}: {exc}')
                except Exception as exc:
                    print(f'ARTICLE ERROR {article}: {exc}')
                time.sleep(max(0, args.delay))
            time.sleep(max(0, args.delay))
        if matching_articles:
            # Stop only after finding actual report articles. A successful HTTP
            # response from an unrelated category is not evidence of discovery.
            break
        if successful_pages:
            print(f'No matching {args.kind} report articles in {base}; trying fallback archive.')
    report = {
        'source': 'Central Securities Depository of Iraq public market reports',
        'reportTypesIncluded': args.kind,
        'archiveUrls': bases, 'retrievedAt': datetime.now().astimezone().isoformat(timespec='seconds'),
        'pagesRequested': pages, 'pagesScanned': pages_scanned,
        'matchingArticlesFound': sum(x.get('articlesFound', 0) for x in pages_scanned),
        'files': sorted(known.values(), key=lambda x: x.get('url', '')),
        'newFilesDownloadedThisRun': downloaded,
        'important': 'Files are source documents only. Monthly reports may contain monthly aggregate OHLC fields; daily reports are required for daily candles. No OHLCV is imported and stocks.json is not modified by this downloader.',
    }
    manifest_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Saved {downloaded} new bulletin files; {len(known)} total in manifest.')
    print(f'Manifest: {manifest_path}')

if __name__ == '__main__': main()
