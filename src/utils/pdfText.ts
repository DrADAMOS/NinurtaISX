export interface PdfTextItemLike {
  str: string;
  transform: number[];
}

/** Rebuild reading lines from PDF.js text spans, ordered top-to-bottom and left-to-right. */
export function groupPdfTextItems(items: PdfTextItemLike[], yTolerance = 2): string {
  const positioned = items
    .filter((item) => item.str.trim().length > 0 && Number.isFinite(item.transform?.[4]) && Number.isFinite(item.transform?.[5]))
    .map((item) => ({ text: item.str.trim(), x: item.transform[4], y: item.transform[5] }));
  positioned.sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: Array<{ y: number; spans: Array<{ x: number; text: string }> }> = [];
  for (const item of positioned) {
    let line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= yTolerance);
    if (!line) {
      line = { y: item.y, spans: [] };
      lines.push(line);
    }
    line.spans.push({ x: item.x, text: item.text });
  }
  return lines
    .sort((a, b) => b.y - a.y)
    .map((line) => line.spans.sort((a, b) => a.x - b.x).map((span) => span.text).join(' '))
    .join('\n');
}
