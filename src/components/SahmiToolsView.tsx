import React, { useState } from 'react';
import { Calculator, Info } from 'lucide-react';
import { calculateAGMEntitlement, calculateAffordableShares, calculateAveragePurchase, calculateDividendYield, calculateDistribution, calculateEPS, calculateFairValue, calculateIndicativePrice, calculatePE, calculateROE, calculateTradeNet } from '../utils/sahmiCalculators';

type Values = Record<string, string>;
const initial: Values = {
  fairProfit: '', fairCapital: '', fairPar: '1', fairPe: '',
  dividendShares: '', cashPct: '', bonusPct: '', dividendPar: '1',
  amount1: '', price1: '', amount2: '', price2: '',
  budget: '', budgetPrice: '', feeBuy: '0.6',
  tradeShares: '', buyPrice: '', sellPrice: '', tradeBuyFee: '0.6', tradeSellFee: '0.6',
  indicativePrice: '', changePct: '',
  agmShares: '', meetingCash: '', agmBonusPct: '',
  pePrice: '', peProfit: '', peCapital: '', pePar: '1',
  roeProfit: '', equity: '',
  epsProfit: '', epsCapital: '', epsPar: '1',
  yieldPrice: '', annualCash: '',
};
const n = (v: string) => v.trim() === '' ? NaN : Number(v);
const fmt = (v: number, digits = 2) => Number.isFinite(v)
  ? new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(v)
  : '—';
const money = (v: number) => Number.isFinite(v) ? `${fmt(v)} د.ع` : '—';

function Input({ label, value, onChange, min = 0, step = 'any' }: { label: string; value: string; onChange: (v: string) => void; min?: number; step?: string }) {
  return <label className="block min-w-0 space-y-1.5"><span className="text-xs text-slate-400">{label}</span><input type="number" min={min} step={step} value={value} onChange={e => onChange(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-[#070B14] px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500 font-mono-numbers" /></label>;
}
function Output({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="rounded-xl border border-amber-500/20 bg-[#070B14] p-3"><div className="text-[10px] text-slate-500">{label}</div><div className="mt-1 text-sm font-bold text-amber-300 font-mono-numbers break-words">{value}</div>{hint && <div className="mt-1 text-[10px] leading-5 text-slate-500">{hint}</div>}</div>;
}
function Card({ title, number, children, formula }: { title: string; number: string; children: React.ReactNode; formula: string }) {
  return <section className="rounded-2xl border border-slate-800 bg-[#0A0F1D] p-4 sm:p-5 space-y-3"><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold tracking-wider text-amber-400">{number}</span><Calculator className="h-4 w-4 text-amber-400" /></div><h3 className="font-bold text-white">{title}</h3>{children}<p className="border-t border-slate-800 pt-2 text-[11px] leading-6 text-slate-500">{formula}</p></section>;
}

export const SahmiToolsView: React.FC = () => {
  const [v, setV] = useState<Values>(initial);
  const set = (key: string) => (value: string) => setV(old => ({ ...old, [key]: value }));
  const x = (key: string) => n(v[key] ?? '');
  const fair = calculateFairValue(x('fairProfit'), x('fairCapital'), x('fairPar'), x('fairPe'));
  const distribution = calculateDistribution(x('dividendShares'), x('cashPct'), x('dividendPar'), x('bonusPct'));
  const average = calculateAveragePurchase(x('amount1'), x('price1'), x('amount2'), x('price2'));
  const affordable = calculateAffordableShares(x('budget'), x('budgetPrice'), x('feeBuy'));
  const trade = calculateTradeNet(x('tradeShares'), x('buyPrice'), x('sellPrice'), x('tradeBuyFee'), x('tradeSellFee'));
  const indicativeScenario = calculateIndicativePrice(x('indicativePrice'), x('changePct'));
  const agm = calculateAGMEntitlement(x('agmShares'), x('meetingCash'), x('agmBonusPct'));
  const pe = calculatePE(x('pePrice'), x('peProfit'), x('peCapital'), x('pePar'));
  const roe = calculateROE(x('roeProfit'), x('equity'));
  const epsValue = calculateEPS(x('epsProfit'), x('epsCapital'), x('epsPar'));
  const dividendYield = calculateDividendYield(x('annualCash'), x('yieldPrice'));
  const has = (...keys: string[]) => keys.every(k => (v[k] ?? '').trim() !== '');
  const field = (key: string, label: string, min = 0) => <Input label={label} value={v[key] ?? ''} onChange={set(key)} min={min} />;

  return <div dir="rtl" className="space-y-4">
    <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-l from-amber-500/10 to-[#0A0F1D] p-4 sm:p-5"><div className="flex items-center gap-2 text-amber-300 text-xs font-bold"><Calculator className="h-4 w-4"/> أدوات حسابية مستوحاة من سهمي</div><h2 className="mt-2 text-xl font-black text-white">حاسبات المستثمر العراقي</h2><p className="mt-2 text-xs leading-6 text-slate-300">١١ حاسبة مستقلة تعمل محلياً على الأرقام التي تدخلها. لا تتصل بحساب سهمي ولا تسحب منه أسعاراً أو بيانات مالية.</p><div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] leading-6 text-amber-100"><Info className="mt-0.5 h-4 w-4 shrink-0"/> أدخل القيم المنشورة وتحقق من وحداتها. القيمة الاسمية الافتراضية ١ د.ع قابلة للتعديل. العمولات افتراضات قابلة للتغيير وليست تعرفة رسمية موحدة. النتائج تقديرية وليست توصية.</div></div>
    <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
      <Card number="01 · FAIR VALUE" title="القيمة العادلة المبسطة" formula="عدد الأسهم = رأس المال ÷ القيمة الاسمية. ربحية السهم = صافي الربح ÷ عدد الأسهم. القيمة التقديرية = EPS × مكرر مستهدف. لا تصلح وحدها لتقييم شركة. "><div className="grid grid-cols-2 gap-2">{field('fairProfit','صافي الربح (د.ع)',-1000000000000)}{field('fairCapital','رأس المال (د.ع)')}{field('fairPar','القيمة الاسمية للسهم (د.ع)',0.000001)}{field('fairPe','مكرر الربحية المستهدف')}</div><Output label="ربحية السهم التقديرية" value={fair ? money(fair.eps) : 'أدخل بيانات صحيحة'}/><Output label="القيمة العادلة التقديرية" value={fair ? money(fair.fairValue) : '—'}/></Card>
      <Card number="02 · DIVIDEND & BONUS" title="التوزيعات والرسملة" formula="النقد = عدد الأسهم × التوزيع النقدي للسهم. الأسهم المجانية = الأسهم المملوكة × نسبة المنحة. افحص قرار الهيئة العامة وتاريخ الاستحقاق."><div className="grid grid-cols-2 gap-2">{field('dividendShares','عدد الأسهم المملوكة')}{field('cashPct','التوزيع النقدي (% من الاسمية)')}{field('bonusPct','الأسهم المجانية (%)')}{field('dividendPar','القيمة الاسمية للسهم (د.ع)',0.000001)}</div><Output label="النقد التقديري" value={distribution && has('dividendShares','cashPct','dividendPar') ? money(distribution.totalCash) : '—'}/><Output label="الأسهم المجانية التقديرية" value={distribution && has('dividendShares','bonusPct') ? fmt(distribution.bonusShares,0)+' سهم' : '—'}/></Card>
      <Card number="03 · AVERAGE PRICE" title="متوسط سعر الشراء" formula="متوسط مرجح = مجموع مبالغ الشراء ÷ مجموع الأسهم المشتراة. أدخل المبالغ والأسعار قبل الرسوم أو أضف الرسوم إلى المبالغ."><div className="grid grid-cols-2 gap-2">{field('amount1','مبلغ الشراء الأول (د.ع)')}{field('price1','سعر الشراء الأول (د.ع)',0.000001)}{field('amount2','مبلغ الشراء الثاني (د.ع)')}{field('price2','سعر الشراء الثاني (د.ع)',0.000001)}</div><Output label="متوسط سعر الشراء" value={average && has('amount1','price1','amount2','price2') ? money(average.averagePrice) : '—'}/><Output label="إجمالي الأسهم" value={average ? fmt(average.shares,0) : '—'}/></Card>
      <Card number="04 · SHARE QUANTITY" title="عدد الأسهم حسب الميزانية" formula="العدد الصحيح = الميزانية ÷ (سعر السهم × (1 + عمولة الشراء)). لا يشمل الرسوم الثابتة أو فروقات التنفيذ."><div className="grid grid-cols-2 gap-2">{field('budget','المبلغ المتاح (د.ع)')}{field('budgetPrice','سعر السهم (د.ع)',0.000001)}{field('feeBuy','عمولة الشراء (%)')}</div><Output label="عدد الأسهم الممكن شراؤها" value={affordable && has('budget','budgetPrice','feeBuy') ? fmt(affordable.shares,0)+' سهم' : '—'}/><Output label="المبلغ المستخدم تقريباً" value={affordable && has('budget','budgetPrice','feeBuy') ? money(affordable.usedBudget) : '—'}/></Card>
      <Card number="05 · NET TRADE P/L" title="صافي ربح أو خسارة البيع" formula="صافي النتيجة = البيع بعد العمولة − الشراء شاملاً العمولة. لا تشمل الرسوم الإضافية أو الانزلاق السعري."><div className="grid grid-cols-2 gap-2">{field('tradeShares','عدد الأسهم')}{field('buyPrice','سعر الشراء للسهم')}{field('sellPrice','سعر البيع للسهم')}{field('tradeBuyFee','عمولة الشراء (%)')}{field('tradeSellFee','عمولة البيع (%)')}</div><Output label="صافي النتيجة" value={trade && has('tradeShares','buyPrice','sellPrice','tradeBuyFee','tradeSellFee') ? money(trade.net) : '—'}/><Output label="إجمالي العمولة" value={trade && has('tradeShares','buyPrice','sellPrice','tradeBuyFee','tradeSellFee') ? money(trade.totalFees) : '—'}/></Card>
      <Card number="06 · INDICATIVE PRICE" title="السعر التأشيري الحسابي" formula="السعر التأشيري في هذا السيناريو = السعر المرجعي × (1 + نسبة التغير ÷ 100). ليس سعر إغلاق رسمياً أو توقعاً للسوق."><div className="grid grid-cols-2 gap-2">{field('indicativePrice','السعر المرجعي (د.ع)')}{field('changePct','نسبة التغير (%)',-100)}</div><Output label="السعر الناتج عن السيناريو" value={indicativeScenario !== null && has('indicativePrice','changePct') ? money(indicativeScenario) : '—'}/></Card>
      <Card number="07 · AGM ENTITLEMENT" title="استحقاقات الهيئة العامة" formula="تقدير أولي للنقد والأسهم وفق القرار. لا يثبت أهلية المساهم؛ تحقق من تاريخ الاستحقاق وسجل المساهمين وقرار الشركة."><div className="grid grid-cols-2 gap-2">{field('agmShares','عدد الأسهم بتاريخ الاستحقاق')}{field('meetingCash','التوزيع النقدي للسهم (د.ع)')}{field('agmBonusPct','نسبة الأسهم المجانية (%)')}</div><Output label="التوزيع النقدي المتوقع" value={agm && has('agmShares','meetingCash') ? money(agm.cash) : '—'}/><Output label="الأسهم المجانية المتوقعة" value={agm && has('agmShares','agmBonusPct') ? fmt(agm.bonusShares,0)+' سهم' : '—'}/></Card>
      <Card number="08 · P/E" title="مكرر الربحية P/E" formula="P/E = سعر السهم ÷ ربحية السهم. يجب أن تكون ربحية السهم للفترة نفسها وعلى أساس عدد الأسهم المرجح، ولا يُفسر المكرر المعتاد عند الخسارة."><div className="grid grid-cols-2 gap-2">{field('pePrice','سعر السهم (د.ع)')}{field('peProfit','صافي الربح (د.ع)',-1000000000000)}{field('peCapital','رأس المال (د.ع)')}{field('pePar','القيمة الاسمية (د.ع)',0.000001)}</div><Output label="مكرر الربحية" value={pe !== null && has('pePrice','peProfit','peCapital','pePar') ? fmt(pe)+' مرة' : 'غير متاح / تحقق من الربح'}/></Card>
      <Card number="09 · ROE" title="العائد على حقوق الملكية ROE" formula="ROE = صافي الربح ÷ متوسط حقوق الملكية × 100. استخدام رصيد نهاية الفترة بدلاً من المتوسط يعطي تقديراً تقريبياً."><div className="grid grid-cols-2 gap-2">{field('roeProfit','صافي الربح للفترة (د.ع)',-1000000000000)}{field('equity','متوسط حقوق الملكية (د.ع)')}</div><Output label="ROE" value={roe !== null && has('roeProfit','equity') ? fmt(roe)+'%' : '—'}/></Card>
      <Card number="10 · EPS" title="ربحية السهم EPS" formula="EPS = الربح المنسوب للمساهمين العاديين ÷ المتوسط المرجح لعدد الأسهم. رأس المال ÷ القيمة الاسمية بديل تقريبي فقط عند ثبات عدد الأسهم."><div className="grid grid-cols-2 gap-2">{field('epsProfit','صافي الربح (د.ع)',-1000000000000)}{field('epsCapital','رأس المال (د.ع)')}{field('epsPar','القيمة الاسمية (د.ع)',0.000001)}</div><Output label="EPS التقريبية" value={epsValue !== null && has('epsProfit','epsCapital','epsPar') ? money(epsValue) : '—'}/></Card>
      <Card number="11 · DIVIDEND YIELD" title="عائد التوزيعات النقدية" formula="العائد = التوزيع النقدي السنوي للسهم ÷ سعر السهم × 100. استخدم توزيعات سنوية معتمدة أو موضحة، ولا تعتبرها مضمونة."><div className="grid grid-cols-2 gap-2">{field('yieldPrice','سعر السهم الحالي (د.ع)')}{field('annualCash','التوزيع النقدي السنوي للسهم (د.ع)')}</div><Output label="عائد التوزيعات" value={dividendYield !== null && has('yieldPrice','annualCash') ? fmt(dividendYield)+'%' : '—'}/></Card>
    </div>
    <p className="text-[11px] leading-6 text-slate-500">مرجع الفكرة: <a href="https://sahmi.net/" target="_blank" rel="noopener noreferrer" className="text-sky-300 underline">Sahmi.net</a>. أعيد تنفيذ الحاسبات محلياً؛ لا يتم نسخ حسابات المستخدمين أو بيانات الموقع، ولا يُستخدم سهمي كمصدر لتحديث أسعار السوق.</p>
  </div>;
};
