import test from 'node:test';
import assert from 'node:assert/strict';
import { groupPdfTextItems } from '../src/utils/pdfText';

const item = (str: string, x: number, y: number) => ({ str, transform: [1, 0, 0, 1, x, y] });

test('groups PDF text spans into visual rows and sorts columns left-to-right', () => {
  const text = groupPdfTextItems([
    item('Credit', 120, 700), item('Date', 10, 700), item('100', 120, 680), item('2026/01/02', 10, 680),
  ]);
  assert.equal(text, 'Date Credit\n2026/01/02 100');
});

test('ignores empty or malformed PDF text items', () => {
  const text = groupPdfTextItems([
    item('  ', 10, 700), { str: 'bad', transform: [] }, item('Valid', 10, 680),
  ]);
  assert.equal(text, 'Valid');
});
