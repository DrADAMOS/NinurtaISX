import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPortfolioReport } from '../src/utils/portfolioReport';
import type { PortfolioPosition, Stock } from '../src/types/stock';
const position: PortfolioPosition = { id:'p1', symbol:'BBOB', shares:100, averageBuyPrice:2, buyDate:'2026-01-01' };
const stock = { symbol:'BBOB', nameAr:'مصرف بغداد', currentPrice:3, source:'اختبار المصدر' } as Stock;
test('portfolio report calculates fees, net market value and unrealized return', () => {
 const report = buildPortfolioReport([position], [stock], '2026-11-15T12:00:00.000Z');
 assert.equal(report.rows.length, 1);
 assert.equal(report.rows[0].investedGross, 200);
 assert.equal(report.rows[0].estimatedBuyFee, 1.2);
 assert.equal(report.rows[0].marketGross, 300);
 assert.equal(report.rows[0].estimatedSellFee, 1.8);
 assert.equal(report.rows[0].marketNet, 298.2);
 assert.ok(Math.abs(report.unrealizedNet - 97) < 1e-9);
});
test('missing current quote is explicitly flagged and uses buy price as a conservative display fallback', () => {
 const report = buildPortfolioReport([position], [], '2026-11-15T12:00:00.000Z');
 assert.deepEqual(report.missingQuotes, ['BBOB']);
 assert.equal(report.rows[0].currentPrice, 2);
 assert.equal(report.rows[0].source, 'سعر الشراء المستخدم لغياب السعر الحالي');
});
test('empty portfolio produces zero totals without division errors', () => {
 const report = buildPortfolioReport([], [], '2026-11-15T12:00:00.000Z');
 assert.equal(report.invested, 0);
 assert.equal(report.marketValueNet, 0);
 assert.equal(report.returnPercent, 0);
});
