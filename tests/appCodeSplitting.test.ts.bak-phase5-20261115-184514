import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const lazyViews = ['RecommendationsView','MarketDirectory','PortfolioView','FeeCalculator','BankAnalyticsView','TopMoversView','InvestorHubView','AccountStatementView'];

test('secondary workspaces are loaded through React lazy imports', () => {
  for (const view of lazyViews) {
    assert.match(app, new RegExp(`const ${view} = lazy\\(`), `${view} should be lazy-loaded`);
    assert.doesNotMatch(app, new RegExp(`import \\{ ${view} \\} from './components/${view}'`));
  }
});

test('workspace rendering is protected by a Suspense fallback', () => {
  assert.match(app, /<Suspense fallback=/);
  assert.match(app, /Loading section/);
});
