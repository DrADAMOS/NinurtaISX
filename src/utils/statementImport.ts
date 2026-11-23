export interface StatementLike {
  date: string;
  description: string;
  debit: number;
  credit: number;
}

/** Conservative fingerprint: only exact normalized transaction matches are flagged. */
export function statementFingerprint(row: StatementLike): string {
  const description = row.description
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[إأآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .toLocaleLowerCase('ar')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  const amount = (value: number) => Number.isFinite(value) ? value.toFixed(3) : 'invalid';
  return [row.date.trim(), description, amount(row.debit), amount(row.credit)].join('|');
}

/** Returns fingerprints repeated in the imported rows or already present in saved entries. */
export function findDuplicateFingerprints<T extends StatementLike>(
  imported: T[],
  existing: StatementLike[] = [],
): Set<string> {
  const existingKeys = new Set(existing.map(statementFingerprint));
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const row of imported) {
    const key = statementFingerprint(row);
    if (existingKeys.has(key) || seen.has(key)) duplicates.add(key);
    seen.add(key);
  }
  return duplicates;
}

/** Strict ISO calendar-date validation for rows edited in the review table. */
export function isValidStatementDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
