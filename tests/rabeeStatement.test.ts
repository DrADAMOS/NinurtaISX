import test from 'node:test';
import assert from 'node:assert/strict';
import { findRabeeDuplicateContracts, parseRabeeTradeItems, type RabeeTrade } from '../src/utils/rabeeStatement';

const item = (str: string, x: number, y = 100) => ({ str, transform: [1, 0, 0, 1, x, 600 - y] });
const buyItems = [
  item('20250729-000051275925', 696), item('BNOI', 656), item('المصرف الاهلي العراقي', 590),
  item('2,808', 520), item('3.540', 453), item('9,940.320', 386), item('59.642', 247),
  item('0.0060', 185), item('9,999.962', 138),
];
const sellItems = [
  item('20251125-000051350721', 696), item('IKHC', 656), item('الخازر للانتاج', 590),
  item('124,324', 513), item('1.450', 453), item('180,269.800', 305), item('1,081.619', 238),
  item('0.0060', 185), item('179,188.181', 54),
];

test('parses Rabee buy row by column position, not token order', () => {
  const [row] = parseRabeeTradeItems(buyItems, 842, 595);
  assert.equal(row.side, 'BUY'); assert.equal(row.ticker, 'BNOI');
  assert.equal(row.quantity, 2808); assert.equal(row.price, 3.54);
  assert.equal(row.grossValue, 9940.32); assert.equal(row.commission, 59.642);
  assert.equal(row.netValue, 9999.962); assert.equal(row.date, '2025-07-29');
});

test('parses Rabee sell row from sell-side coordinate columns', () => {
  const [row] = parseRabeeTradeItems(sellItems, 842, 595);
  assert.equal(row.side, 'SELL'); assert.equal(row.ticker, 'IKHC');
  assert.equal(row.grossValue, 180269.8); assert.equal(row.netValue, 179188.181);
});

test('flags duplicate broker contract numbers', () => {
  const [row] = parseRabeeTradeItems(buyItems, 842, 595);
  assert.equal(findRabeeDuplicateContracts([row], [row]).has(row.contractNo), true);
});

test('ignores page headings and rows without a contract number', () => {
  assert.deepEqual(parseRabeeTradeItems([item('حركات التداول', 100)], 842, 595), []);
});


test('collects split Arabic company-name tokens without swallowing the ticker', () => {
  const splitCompany = [
    item('20250729-000051275925', 696), item('BNOI', 656),
    item('يقارعلا', 586), item('يلهلا', 604), item('فرصملا', 620),
    item('2,808', 520), item('3.540', 453), item('9,940.320', 386),
    item('59.642', 247), item('0.0060', 185), item('9,999.962', 138),
  ];
  const [row] = parseRabeeTradeItems(splitCompany, 792, 612);
  assert.equal(row.ticker, 'BNOI');
  assert.equal(row.company, 'يقارعلا يلهلا فرصملا');
  assert.equal(row.confidence, 'high');
});
