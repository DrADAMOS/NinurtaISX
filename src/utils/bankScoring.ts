export type BankMetricKey =
  | 'npl' | 'nplCoverage' | 'roe' | 'roa' | 'car' | 'liquidAssetsToDeposits'
  | 'pe' | 'pb' | 'profitGrowthYoY' | 'equityGrowthYoY' | 'dividendYield' | 'dividendYears';

export const BANK_METRIC_KEYS: readonly BankMetricKey[] = [
  'npl', 'nplCoverage', 'roe', 'roa', 'car', 'liquidAssetsToDeposits',
  'pe', 'pb', 'profitGrowthYoY', 'equityGrowthYoY', 'dividendYield', 'dividendYears',
] as const;

export type MetricMethod = 'reported' | 'calculated';

export interface SourcedMetric {
  value: number;
  asOf: string;
  sourceName: string;
  sourceUrl: string;
  method?: MetricMethod;
  formula?: string;
  notes?: string;
}

export interface BankFinancialSnapshot {
  symbol: string;
  reportPeriod: string;
  reportDate: string;
  audited: boolean;
  metrics: Partial<Record<BankMetricKey, SourcedMetric>>;
}

export interface BankGroupScore {
  key: string;
  label: string;
  weight: number;
  score: number | null;
  available: number;
  required: number;
}

export interface BankAssessment {
  symbol: string;
  fundamentalScore: number | null;
  riskScore: number | null;
  confidence: number;
  coverage: number;
  eligible: boolean;
  reason: string;
  groups: BankGroupScore[];
}

export type BankDataIssue =
  | 'INVALID_SYMBOL' | 'INVALID_REPORT_PERIOD' | 'INVALID_REPORT_DATE'
  | 'AUDIT_NOT_CONFIRMED' | 'UNKNOWN_METRIC' | 'INVALID_METRIC_VALUE'
  | 'INVALID_METRIC_DATE' | 'METRIC_AFTER_REPORT_DATE' | 'MISSING_SOURCE_NAME'
  | 'NON_HTTPS_SOURCE' | 'MISSING_CALCULATION_FORMULA';

export interface BankSnapshotValidation {
  valid: boolean;
  issues: BankDataIssue[];
  validMetricCount: number;
  presentMetricCount: number;
}

const GROUPS: Array<{key:string;label:string;weight:number;fields:BankMetricKey[]}> = [
  {key:'assetQuality',label:'جودة الأصول والقروض',weight:25,fields:['npl','nplCoverage']},
  {key:'profitability',label:'الربحية والكفاءة',weight:20,fields:['roe','roa']},
  {key:'capitalLiquidity',label:'رأس المال والسيولة',weight:20,fields:['car','liquidAssetsToDeposits']},
  {key:'valuation',label:'التقييم والسعر',weight:15,fields:['pe','pb']},
  {key:'growth',label:'النمو والاستدامة',weight:10,fields:['profitGrowthYoY','equityGrowthYoY']},
  {key:'dividends',label:'التوزيعات النقدية',weight:5,fields:['dividendYield','dividendYears']},
  {key:'disclosure',label:'الإفصاح والتدقيق',weight:5,fields:[]},
];

export function isValidBankIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === value;
}

function isValidHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && !!parsed.hostname;
  } catch {
    return false;
  }
}

export function isValidSourcedBankMetric(metric: unknown, reportDate: string): metric is SourcedMetric {
  if (!metric || typeof metric !== 'object') return false;
  const m = metric as Partial<SourcedMetric>;
  return typeof m.value === 'number' && Number.isFinite(m.value) &&
    isValidBankIsoDate(m.asOf) && m.asOf <= reportDate &&
    typeof m.sourceName === 'string' && !!m.sourceName.trim() &&
    isValidHttpsUrl(m.sourceUrl) &&
    (m.method !== 'calculated' || (typeof m.formula === 'string' && !!m.formula.trim()));
}

/** Shared validation contract used by both the scoring and readiness layers. */
export function validateBankSnapshot(input: unknown): BankSnapshotValidation {
  const issues: BankDataIssue[] = [];
  if (!input || typeof input !== 'object') {
    return { valid: false, issues: ['INVALID_SYMBOL','INVALID_REPORT_PERIOD','INVALID_REPORT_DATE','AUDIT_NOT_CONFIRMED'], validMetricCount: 0, presentMetricCount: 0 };
  }
  const snapshot = input as Partial<BankFinancialSnapshot>;
  if (typeof snapshot.symbol !== 'string' || !/^[A-Z0-9]{2,12}$/.test(snapshot.symbol)) issues.push('INVALID_SYMBOL');
  if (typeof snapshot.reportPeriod !== 'string' || !/^(FY\d{4}|Q[1-4]-\d{4})$/.test(snapshot.reportPeriod)) issues.push('INVALID_REPORT_PERIOD');
  const reportDateValid = isValidBankIsoDate(snapshot.reportDate);
  if (!reportDateValid) issues.push('INVALID_REPORT_DATE');
  if (snapshot.audited !== true) issues.push('AUDIT_NOT_CONFIRMED');

  const rawMetrics = snapshot.metrics && typeof snapshot.metrics === 'object'
    ? snapshot.metrics as Record<string, unknown> : {};
  let validMetricCount = 0;
  const presentMetricCount = Object.keys(rawMetrics).length;
  for (const [key, raw] of Object.entries(rawMetrics)) {
    if (!(BANK_METRIC_KEYS as readonly string[]).includes(key)) {
      issues.push('UNKNOWN_METRIC');
      continue;
    }
    const m = raw as Partial<SourcedMetric> | null;
    if (!m || typeof m.value !== 'number' || !Number.isFinite(m.value)) issues.push('INVALID_METRIC_VALUE');
    if (!m || !isValidBankIsoDate(m.asOf)) issues.push('INVALID_METRIC_DATE');
    else if (reportDateValid && m.asOf > snapshot.reportDate!) issues.push('METRIC_AFTER_REPORT_DATE');
    if (!m || typeof m.sourceName !== 'string' || !m.sourceName.trim()) issues.push('MISSING_SOURCE_NAME');
    if (!m || !isValidHttpsUrl(m.sourceUrl)) issues.push('NON_HTTPS_SOURCE');
    if (m?.method === 'calculated' && (typeof m.formula !== 'string' || !m.formula.trim())) issues.push('MISSING_CALCULATION_FORMULA');
    if (reportDateValid && isValidSourcedBankMetric(raw, snapshot.reportDate!)) validMetricCount++;
  }
  return { valid: issues.length === 0, issues: [...new Set(issues)], validMetricCount, presentMetricCount };
}

function clamp(n:number){ return Math.max(0,Math.min(100,n)); }
function linear(value:number, zero:number, full:number){
  if (full === zero) return value >= full ? 100 : 0;
  return clamp((value-zero)/(full-zero)*100);
}
function metricScore(key:BankMetricKey, v:number):number|null {
  switch(key){
    case 'npl': return linear(v, 15, 1);
    case 'nplCoverage': return linear(v, 30, 120);
    case 'roe': return linear(v, 0, 20);
    case 'roa': return linear(v, 0, 2);
    case 'car': return linear(v, 12.5, 30);
    case 'liquidAssetsToDeposits': return linear(v, 10, 40);
    case 'pe': return v <= 0 ? null : v <= 6 ? 100 : v >= 20 ? 0 : linear(20-v, 0, 14);
    case 'pb': return v <= 0 ? null : v <= 1 ? 100 : v >= 3 ? 0 : linear(3-v, 0, 2);
    case 'profitGrowthYoY': return linear(v, -20, 20);
    case 'equityGrowthYoY': return linear(v, -20, 20);
    case 'dividendYield': return linear(v, 0, 10);
    case 'dividendYears': return linear(v, 0, 5);
  }
}

export function calculateBankAssessment(snapshot:BankFinancialSnapshot):BankAssessment {
  const validation = validateBankSnapshot(snapshot);
  const reportDateValid = isValidBankIsoDate(snapshot.reportDate);
  const valid = new Map<BankMetricKey,SourcedMetric>();
  for (const key of BANK_METRIC_KEYS) {
    const metric = snapshot.metrics?.[key];
    if (reportDateValid && isValidSourcedBankMetric(metric, snapshot.reportDate)) valid.set(key, metric);
  }
  const groups:BankGroupScore[] = GROUPS.map(g=>{
    if(g.key==='disclosure'){
      const hasDisclosure = snapshot.audited === true && reportDateValid &&
        [...valid.values()].some(m=>isValidHttpsUrl(m.sourceUrl));
      return {key:g.key,label:g.label,weight:g.weight,score:hasDisclosure?100:null,available:hasDisclosure?1:0,required:1};
    }
    const scored = g.fields.map(k=>{
      const m=valid.get(k); return m ? metricScore(k,m.value) : null;
    }).filter((x):x is number=>x!==null);
    return {key:g.key,label:g.label,weight:g.weight,score:scored.length?scored.reduce((a,b)=>a+b,0)/scored.length:null,available:scored.length,required:g.fields.length};
  });
  const requiredWeight = GROUPS.reduce((s,g)=>s+g.weight,0);
  const availableWeight = GROUPS.reduce((s,g)=>{
    const row=groups.find(x=>x.key===g.key)!;
    return s + g.weight*(g.key==='disclosure' ? row.available : row.available/g.fields.length);
  },0);
  const coverage = requiredWeight ? Math.round(availableWeight/requiredWeight*100) : 0;
  const critical = ['assetQuality','profitability','capitalLiquidity','valuation'];
  const criticalReady = critical.every(k=>groups.find(g=>g.key===k)?.score!==null);
  const weighted = groups.reduce((sum,g)=>sum+(g.score===null?0:g.score*g.weight),0);
  const baseScore = coverage>=80 && criticalReady && availableWeight>0 ? Math.round(weighted/availableWeight) : null;
  const fundamentalsPermitted = validation.valid && snapshot.audited === true && reportDateValid &&
    /^(FY\d{4}|Q[1-4]-\d{4})$/.test(snapshot.reportPeriod) &&
    coverage >= 80 && criticalReady && validation.validMetricCount >= 1;
  // Score publication is gated by confidence after freshness is calculated.
  const asset = groups.find(g=>g.key==='assetQuality')?.score;
  const capital = groups.find(g=>g.key==='capitalLiquidity')?.score;
  const profitability = groups.find(g=>g.key==='profitability')?.score;
  const riskBase = typeof asset === 'number' && typeof capital === 'number' && typeof profitability === 'number'
    ? Math.round(100-(asset*0.45+capital*0.35+profitability*0.20)) : null;
  const riskScore = fundamentalsPermitted ? riskBase : null;
  const freshnessFactors = [...valid.values()].map(m=>{
    const ageDays=(Date.now()-Date.parse(`${m.asOf}T00:00:00.000Z`))/(1000*60*60*24);
    return ageDays<=548 ? 1 : ageDays<=730 ? 0.8 : 0.6;
  });
  const freshnessFactor = freshnessFactors.length ? freshnessFactors.reduce((a,b)=>a+b,0)/freshnessFactors.length : 0;
  const confidence = Math.round(coverage * (snapshot.audited ? 1 : 0.85) * freshnessFactor);
  const fundamentalScore = fundamentalsPermitted && confidence >= 80 ? baseScore : null;
  const eligible = fundamentalScore!==null && riskScore!==null && confidence>=80;
  const reason = eligible ? 'اجتاز الحد الأدنى من اكتمال البيانات والتوثيق' :
    snapshot.audited !== true ? 'القوائم المدخلة غير موصوفة بأنها مدققة' :
    !reportDateValid ? 'تاريخ التقرير غير صالح' :
    !/^(FY\d{4}|Q[1-4]-\d{4})$/.test(snapshot.reportPeriod) ? 'فترة التقرير غير صالحة' :
    !criticalReady ? 'بيانات أساسية ناقصة: جودة الأصول أو الربحية أو رأس المال أو التقييم' :
    validation.validMetricCount === 0 ? 'لا توجد مؤشرات مكتملة المصدر والتاريخ' :
    `اكتمال البيانات ${coverage}%؛ يلزم 80% على الأقل مع مصادر موثقة`;
  return {symbol:snapshot.symbol,fundamentalScore,riskScore,confidence,coverage,eligible,reason,groups};
}

export const BANK_SCORE_WEIGHTS = GROUPS.map(({key,label,weight})=>({key,label,weight}));
