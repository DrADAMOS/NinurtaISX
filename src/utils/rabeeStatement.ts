export interface RabeeTextItem {
  str?: string;
  transform?: number[];
}

export interface RabeeTrade {
  contractNo: string;
  date: string;
  ticker: string;
  company: string;
  side: 'BUY' | 'SELL' | 'REVIEW';
  quantity: number;
  price: number;
  grossValue: number;
  commission: number;
  netValue: number;
  confidence: 'high' | 'review';
  sourceLine: string;
}

const arabicDigits: Record<string, string> = { '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9' };
const normalize = (value: string) => value.replace(/[٠-٩]/g, d => arabicDigits[d]).replace(/[٬]/g, ',').replace(/[٫]/g, '.').replace(/[−–]/g, '-').replace(/[\u200e\u200f\u202a-\u202e]/g, '').trim();
const amount = (value: string): number => {
  const n = Number(normalize(value).replace(/,/g, '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? Math.abs(n) : 0;
};

/**
 * Parse Rabee Securities landscape trade-statement rows using PDF text coordinates.
 * Column positions are relative to page width; blank cells are intentionally preserved
 * by position, so BUY and SELL values are never inferred from token order alone.
 */
export function parseRabeeTradeItems(items: RabeeTextItem[], pageWidth: number, pageHeight: number): RabeeTrade[] {
  if (!Number.isFinite(pageWidth) || pageWidth <= 0 || !Number.isFinite(pageHeight) || pageHeight <= 0) return [];
  const rows: Array<{ y: number; items: Array<{ text: string; x: number }> }> = [];
  for (const item of items) {
    if (!item || typeof item.str !== 'string' || !item.str.trim() || !Array.isArray(item.transform) || item.transform.length < 6) continue;
    const x = item.transform[4] / pageWidth;
    const y = (pageHeight - item.transform[5]);
    let row = rows.find(candidate => Math.abs(candidate.y - y) <= 2.8);
    if (!row) { row = { y, items: [] }; rows.push(row); }
    row.items.push({ text: normalize(item.str), x });
  }

  const output: RabeeTrade[] = [];
  for (const row of rows) {
    const joined = row.items.map(item => item.text).join(' ');
    const contract = joined.match(/\b(\d{8}-\d{12})\b/);
    if (!contract) continue;
    const get = (min: number, max: number) => row.items.filter(item => item.x >= min && item.x < max).map(item => item.text);
    const numeric = (min: number, max: number) => get(min, max).find(text => /^-?[\d,]+(?:\.\d+)?$/.test(text));
    // In the supplied Rabee PDF, the company name is right-aligned immediately
    // before the ticker. Arabic words can be emitted as separate PDF text items;
    // the old 0.64-0.76 window clipped the latter words. Keep ticker in its own
    // right-side band wide enough for both the legacy 842px test layout and
    // the supplied 792px Rabee PDF. The ticker is excluded from company tokens
    // by its uppercase-symbol pattern, even when both share the same band.
    const ticker = get(0.76, 0.89).find(text => /^[A-Z]{2,8}$/.test(text)) || '';
    const company = get(0.69, 0.82).filter(text => !/^\d/.test(text) && !/^[A-Z]{2,8}$/.test(text)).join(' ').trim();
    const date = `${contract[1].slice(0,4)}-${contract[1].slice(4,6)}-${contract[1].slice(6,8)}`;
    const quantity = amount(numeric(0.59, 0.66) || '0');
    const price = amount(numeric(0.52, 0.58) || '0');
    const buyGross = amount(numeric(0.445, 0.51) || '0');
    const sellGross = amount(numeric(0.335, 0.405) || '0');
    const commission = amount(numeric(0.27, 0.325) || '0');
    const buyNet = amount(numeric(0.145, 0.205) || '0');
    const sellNet = amount(numeric(0.045, 0.12) || '0');
    const isBuy = buyGross > 0 || buyNet > 0;
    const isSell = sellGross > 0 || sellNet > 0;
    const side: RabeeTrade['side'] = isBuy !== isSell ? (isBuy ? 'BUY' : 'SELL') : 'REVIEW';
    const grossValue = isBuy ? buyGross : sellGross;
    const netValue = isBuy ? buyNet : sellNet;
    const confidence: RabeeTrade['confidence'] = ticker && company && quantity > 0 && price > 0 && grossValue > 0 && commission >= 0 && side !== 'REVIEW' ? 'high' : 'review';
    output.push({ contractNo: contract[1], date, ticker, company, side, quantity, price, grossValue, commission, netValue, confidence, sourceLine: joined });
  }
  return output;
}

export function findRabeeDuplicateContracts(imported: RabeeTrade[], existing: RabeeTrade[] = []): Set<string> {
  const known = new Set(existing.map(row => row.contractNo));
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const row of imported) {
    if (known.has(row.contractNo) || seen.has(row.contractNo)) duplicates.add(row.contractNo);
    seen.add(row.contractNo);
  }
  return duplicates;
}
