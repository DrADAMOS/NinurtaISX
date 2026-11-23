import { Stock, RecommendationCategory, RiskLevel, TimeHorizon } from '../types/stock';

/**
 * Default scenario only. This is NOT a universal official exchange tariff.
 * Confirm the applicable broker and market fee schedule before each trade.
 */
export const ISXC_COMMISSION_RATE = 0.006;

export interface FeeCalculationResult {
  shares: number;
  buyPrice: number;
  grossBuyValue: number;
  buyFee: number;
  totalBuyCost: number;
  breakevenSellPrice: number;
  breakevenPercent: number;
  sellTargets: {
    targetPercent: number;
    sellPrice: number;
    grossSellValue: number;
    sellFee: number;
    netSellProceeds: number;
    netProfitIqd: number;
  }[];
}

function assertPositiveFinite(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite number greater than zero`);
  }
}

function roundUpToTick(price: number, tickSize: number): number {
  const units = Math.ceil(price / tickSize - 1e-10);
  return Number((units * tickSize).toFixed(8));
}

/**
 * Scenario calculator. commissionRate is the aggregate fee per side, expressed
 * as a decimal (0.006 = 0.6%). It is configurable and must be verified against
 * the user's broker fee schedule. Executable sell prices are rounded UP to tick.
 */
export function calculateISXCFees(
  shares: number,
  buyPrice: number,
  commissionRate: number = ISXC_COMMISSION_RATE,
  tickSize: number = 0.001
): FeeCalculationResult {
  assertPositiveFinite('shares', shares);
  assertPositiveFinite('buyPrice', buyPrice);
  assertPositiveFinite('tickSize', tickSize);
  if (!Number.isInteger(shares)) throw new RangeError('shares must be a whole number');
  if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate >= 1) {
    throw new RangeError('commissionRate must be finite and in [0, 1)');
  }

  const grossBuyValue = shares * buyPrice;
  const buyFee = grossBuyValue * commissionRate;
  const totalBuyCost = grossBuyValue + buyFee;

  const rawBreakEven = (totalBuyCost / shares) / (1 - commissionRate);
  const breakevenSellPrice = roundUpToTick(rawBreakEven, tickSize);
  const breakevenGross = shares * breakevenSellPrice;
  const breakevenNet = breakevenGross * (1 - commissionRate);
  const breakevenPercent = ((breakevenSellPrice - buyPrice) / buyPrice) * 100;

  const targets = [5, 10, 15, 20, 30].map((targetPercent) => {
    const desiredNet = totalBuyCost * (1 + targetPercent / 100);
    const rawTargetPrice = (desiredNet / shares) / (1 - commissionRate);
    const sellPrice = roundUpToTick(rawTargetPrice, tickSize);
    const grossSellValue = shares * sellPrice;
    const sellFee = grossSellValue * commissionRate;
    const netSellProceeds = grossSellValue - sellFee;
    const netProfitIqd = netSellProceeds - totalBuyCost;

    return {
      targetPercent,
      sellPrice,
      grossSellValue: Math.round(grossSellValue),
      sellFee: Math.round(sellFee),
      netSellProceeds: Math.round(netSellProceeds),
      netProfitIqd: Math.round(netProfitIqd),
    };
  });

  // The rounded, executable breakeven must not produce a net loss.
  if (breakevenNet + 1e-7 < totalBuyCost) {
    throw new Error('Internal fee calculation error: rounded breakeven is below total cost');
  }

  return {
    shares,
    buyPrice,
    grossBuyValue: Math.round(grossBuyValue),
    buyFee: Math.round(buyFee),
    totalBuyCost: Math.round(totalBuyCost),
    breakevenSellPrice,
    breakevenPercent: Number(breakevenPercent.toFixed(2)),
    sellTargets: targets,
  };
}

/**
 * Normalizes raw signals from python dataset into clear 4 investor pillars
 */
export function categorizeRecommendation(
  signal: string,
  invScore: number,
  specScore: number,
  _rsi: number,
  _peRatio: number,
  _dividendYield: number
): {
  category: RecommendationCategory;
  signalStrength: number;
  risk: RiskLevel;
  horizon: TimeHorizon;
} {
  // Never promote a neutral/avoid signal to BUY from score-only heuristics.
  // Scores are displayed as signal strength, not probability of success.
  const sig = (signal || '').trim().toLowerCase();
  const score = (value: number) => Number.isFinite(value)
    ? Math.max(0, Math.min(100, value))
    : 0;

  if (sig.includes('تجنب') || sig.includes('بيع')) {
    return { category: 'بيع', signalStrength: score(invScore), risk: 'غير محددة', horizon: 'تخفيف وجني أرباح' };
  }
  if (sig.includes('شراء للمضارب') || sig.includes('مضاربة')) {
    return { category: 'مضاربة', signalStrength: score(specScore), risk: 'غير محددة', horizon: 'مضاربي قصير' };
  }
  if (sig.includes('شراء قوي') || sig.includes('شراء للمستثمر') || sig === 'شراء') {
    return { category: 'شراء', signalStrength: score(invScore), risk: 'غير محددة', horizon: 'استثماري متوسط/طويل' };
  }
  return { category: 'انتظار', signalStrength: 0, risk: 'غير محددة', horizon: 'مراقبة واقتناص' };
}

/**
 * Format currency and numbers for clean financial display
 */
export function formatIqd(amount: number): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '0 د.ع';
  return new Intl.NumberFormat('ar-IQ').format(Math.round(amount)) + ' د.ع';
}

export function formatNumber(val: number, decimals: number = 2): string {
  if (val === undefined || val === null || isNaN(val)) return '—';
  return Number(val).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
