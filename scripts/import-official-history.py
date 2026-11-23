#!/usr/bin/env python3
"""Import verified OHLCV CSV rows from official ISX/CSD or Rabee publications.

The importer is deliberately non-destructive: it never synthesizes OHLCV,
never overwrites current quotes, and quarantines duplicate/invalid rows.
"""
from __future__ import annotations
import argparse, csv, hashlib, json, re, shutil
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
STOCKS = ROOT / 'src/data/stocks.json'
BACKUPS = ROOT / 'backups'
MANIFEST = ROOT / 'src/data/historical-import-manifest.json'
ALLOWED_HOSTS = {'isx-iq.net', 'www.isx-iq.net', 'isc.gov.iq', 'csd.gov.iq', 'rs.iq', 'www.rs.iq'}
ALIASES = {
 'symbol': {'symbol','ticker','code','رمز','رمز الشركة','الرمز'},
 'date': {'date','sessiondate','tradingdate','التاريخ','تاريخ الجلسة'},
 'open': {'open','opening','سعر الافتتاح','الافتتاح'},
 'high': {'high','highest','اعلى','أعلى سعر','الاعلى'},
 'low': {'low','lowest','ادنى','أدنى سعر','الادنى'},
 'close': {'close','last','closing','سعر الاغلاق','سعر الإغلاق','الاغلاق','الإغلاق'},
 'volume': {'volume','shares','tradedvolume','الحجم','عدد الاسهم','عدد الأسهم'},
}
def norm(s):
 return re.sub(r'[^a-z0-9\u0600-\u06ff]+','', (s or '').strip().lower())
def number(v):
 s=(v or '').strip().replace(',','').replace('٬','').replace('٫','.')
 if not s or s in {'-','—','–'}: return None
 try: return float(s)
 except ValueError: return None
def iso_date(v):
 s=(v or '').strip()
 for f in ('%Y-%m-%d','%d/%m/%Y','%d-%m-%Y','%Y/%m/%d','%d.%m.%Y'):
  try: return datetime.strptime(s,f).date().isoformat()
  except ValueError: pass
 raise ValueError(f'Invalid session date: {s}')
def valid(row):
 o,h,l,c,v=(row[k] for k in ('open','high','low','close','volume'))
 return all(x is not None for x in (o,h,l,c,v)) and min(o,h,l,c)>0 and v>=0 and h>=max(o,l,c) and l<=min(o,h,c)
def main():
 ap=argparse.ArgumentParser()
 ap.add_argument('csv_file'); ap.add_argument('--source-url',required=True); ap.add_argument('--source-name',default='Official ISX/CSD bulletin')
 ap.add_argument('--dry-run',action='store_true'); ap.add_argument('--confirm-official-source',action='store_true',help='Confirm this CSV was transcribed/exported from the cited official source')
 a=ap.parse_args()
 host=(urlparse(a.source_url).hostname or '').lower()
 if urlparse(a.source_url).scheme!='https' or host not in ALLOWED_HOSTS:
  raise SystemExit('Rejected source URL. Use HTTPS from ISX, ISC, CSD, or Rabee official domains.')
 if not a.confirm_official_source:
  raise SystemExit('Confirmation required: add --confirm-official-source only after checking that the CSV came from the cited official document.')
 path=Path(a.csv_file)
 digest=hashlib.sha256(path.read_bytes()).hexdigest()
 with path.open(encoding='utf-8-sig',newline='') as f:
  sample=f.read(4096); f.seek(0)
  try: dialect=csv.Sniffer().sniff(sample, delimiters=',;\t')
  except csv.Error: dialect=csv.excel
  reader=csv.DictReader(f,dialect=dialect)
  headers={norm(k):k for k in (reader.fieldnames or [])}
  cols={field:next((headers[norm(alias)] for alias in aliases if norm(alias) in headers),None) for field,aliases in ALIASES.items()}
  missing=[k for k,v in cols.items() if not v]
  if missing: raise SystemExit('Missing required CSV columns: '+', '.join(missing))
  incoming={}; rejected=[]
  for line,r in enumerate(reader,2):
   try:
    sym=(r[cols['symbol']] or '').strip().upper()
    if not re.fullmatch(r'[A-Z0-9]{2,8}',sym): raise ValueError('invalid symbol')
    row={'date':iso_date(r[cols['date']])}
    row.update({k:number(r[cols[k]]) for k in ('open','high','low','close','volume')})
    if not valid(row): raise ValueError('incomplete or invalid OHLCV')
    if (sym,row['date']) in incoming: raise ValueError('duplicate symbol/date in input')
    incoming[(sym,row['date'])]=row
   except Exception as e: rejected.append({'line':line,'reason':str(e)})
 if not incoming: raise SystemExit('No valid OHLCV rows found; nothing changed.')
 stocks=json.loads(STOCKS.read_text(encoding='utf-8'))
 by={s['symbol']:s for s in stocks}
 unknown=sorted({sym for sym,_ in incoming if sym not in by})
 if unknown: raise SystemExit('Unknown symbols (not imported): '+', '.join(unknown))
 added=0; duplicates=[]; accepted_symbols=set()
 for (sym,dt),row in sorted(incoming.items()):
  stock=by[sym]; hist=stock.setdefault('historicalPrices',[])
  if any(x.get('date')==dt for x in hist): duplicates.append({'symbol':sym,'date':dt}); continue
  hist.append(row); hist.sort(key=lambda x:x['date']); added+=1; accepted_symbols.add(sym)
 now=datetime.now().astimezone().isoformat(timespec='seconds')
 entry={'sourceName':a.source_name,'sourceUrl':a.source_url,'operatorConfirmedOfficialSource':True,'retrievedAt':now,'fileName':path.name,'sha256':digest,'acceptedRows':added,'acceptedSymbols':sorted(accepted_symbols),'duplicateRowsSkipped':len(duplicates),'rejectedRows':len(rejected),'acceptedDateRange':{'from':min(r['date'] for r in incoming.values()),'to':max(r['date'] for r in incoming.values())},'rejected':rejected,'duplicates':duplicates}
 if not a.dry_run and added:
  BACKUPS.mkdir(exist_ok=True); shutil.copy2(STOCKS,BACKUPS/f'stocks-before-history-import-{datetime.now():%Y%m%d-%H%M%S}.json')
  for s in stocks:
   if s.get('symbol') in accepted_symbols:
    s['historicalDataVerified']=True; s['historicalDataSource']=a.source_name
    s['historicalDataSourceUrl']=a.source_url; s['historicalDataRetrievedAt']=now
    # Clear only obsolete quarantine flags that this accepted historical import resolves.
    stale={'SOURCE_RECORD_QUARANTINED','NO_VERIFIED_FINANCIAL_OR_PRICE_DATA','HISTORICAL_SOURCE_NOT_VERIFIED'}
    s['dataQualityIssues']=[issue for issue in s.get('dataQualityIssues',[]) if issue not in stale]
    s['dataQualityStatus']='review_required'
    # Current-session recommendations remain locked until separately verified.
    s['signal']='انتظار'; s['signalStrength']=0
    s['signalReason']='تم استيراد تاريخ سعري موثق؛ التوصيات تبقى مقفلة لحين التحقق من البيانات المالية والمستويات الفنية للجلسة الحالية.'
  STOCKS.write_text(json.dumps(stocks,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
  old=json.loads(MANIFEST.read_text(encoding='utf-8')) if MANIFEST.exists() else {'imports':[]}
  old['imports'].append(entry); MANIFEST.write_text(json.dumps(old,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(json.dumps({'dryRun':a.dry_run,**entry},ensure_ascii=False,indent=2))
if __name__=='__main__': main()
