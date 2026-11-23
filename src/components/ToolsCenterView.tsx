import React, { useMemo, useState } from 'react';
import {
  Activity, ArrowLeft, BarChart3, BookOpenCheck, BrainCircuit, BriefcaseBusiness,
  Calculator, FileSpreadsheet, Landmark, Search, ShieldCheck, Target, Zap,
  WalletCards
} from 'lucide-react';

type ToolItem = {
  id: string;
  title: string;
  description: string;
  category: 'الذكاء والتحليل' | 'إدارة الاستثمار' | 'السوق والبيانات' | 'الحاسبات والتعلم';
  icon: React.ComponentType<{ className?: string }>;
  tag?: string;
};

const tools: ToolItem[] = [
  { id: 'investorIntelligence', title: 'ذكاء المستثمر', description: 'قراءة المحفظة والمراكز والفرص والمخاطر اعتماداً على بيانات المنصة.', category: 'الذكاء والتحليل', icon: BrainCircuit, tag: 'تحليل شخصي' },
  { id: 'marketIntelligence', title: 'ذكاء السوق', description: 'نظرة تحليلية إلى حركة السوق والقطاعات والأسهم المتاحة.', category: 'الذكاء والتحليل', icon: Activity, tag: 'تحليل السوق' },
  { id: 'banks', title: 'تحليل المصارف', description: 'مقارنة المصارف وقراءة مؤشرات الجودة والمخاطر والبيانات المتاحة.', category: 'الذكاء والتحليل', icon: Landmark },
  { id: 'portfolio', title: 'محفظة المستثمر', description: 'إدارة المراكز المسجلة ومتابعة التكلفة والقيمة والنتيجة التقديرية.', category: 'إدارة الاستثمار', icon: BriefcaseBusiness },
  { id: 'accountStatement', title: 'كشف الحساب', description: 'استيراد الحركات ومراجعة سجل العمليات وكشف الحساب.', category: 'إدارة الاستثمار', icon: FileSpreadsheet },
  { id: 'recommendations', title: 'إشارات حركة السوق', description: 'عرض إشارات الأسهم واتجاه الحركة وفق البيانات المتوفرة.', category: 'السوق والبيانات', icon: Target },
  { id: 'movers', title: 'نبض السوق والحركة', description: 'متابعة الأسهم الأعلى حركة وسيولة وصعوداً وهبوطاً.', category: 'السوق والبيانات', icon: Zap },
  { id: 'directory', title: 'دليل الأسهم', description: 'البحث في الشركات والرموز والبيانات الفنية المتاحة.', category: 'السوق والبيانات', icon: BarChart3 },
  { id: 'calculator', title: 'حاسبة العمولة ISXC', description: 'حساب عمولات التداول ونقطة التعادل والسيناريوهات الربحية.', category: 'الحاسبات والتعلم', icon: Calculator },
  { id: 'sahmiTools', title: 'حاسبات سهمي', description: '11 حاسبة مالية مستقلة: القيمة العادلة، المتوسط، EPS، P/E وغيرها.', category: 'الحاسبات والتعلم', icon: WalletCards, tag: '11 حاسبة' },
  { id: 'investorHub', title: 'نصائح وأدوات المستثمر', description: 'مواد إرشادية وأدوات التقييم والمخاطر للمستثمر.', category: 'الحاسبات والتعلم', icon: BookOpenCheck },
];

const categories: ToolItem['category'][] = ['الذكاء والتحليل', 'إدارة الاستثمار', 'السوق والبيانات', 'الحاسبات والتعلم'];

export const ToolsCenterView: React.FC<{ onNavigate: (view: string) => void }> = ({ onNavigate }) => {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('ar');
    if (!q) return tools;
    return tools.filter(tool => `${tool.title} ${tool.description} ${tool.category}`.toLocaleLowerCase('ar').includes(q));
  }, [query]);

  return (
    <section dir="rtl" className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="min-w-0 overflow-hidden rounded-2xl border border-slate-800 bg-[#080E19] lg:sticky lg:top-4">
        <div className="border-b border-slate-800 px-4 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-white">الأدوات</h2>
            <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-300">{filtered.length} / {tools.length}</span>
          </div>
          <label className="relative mt-3 block">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="ابحث عن أداة..." aria-label="ابحث عن أداة" className="w-full rounded-lg border border-slate-700/90 bg-[#050A13] py-2 pr-9 pl-3 text-xs text-white outline-none placeholder:text-slate-500 focus:border-amber-500/60" />
          </label>
        </div>
        <nav aria-label="قائمة أدوات نينورتا" className="max-h-[calc(100vh-260px)] overflow-y-auto p-2">
          {categories.map(category => {
            const items = filtered.filter(tool => tool.category === category);
            if (!items.length) return null;
            return (
              <div key={category} className="mb-2 last:mb-0">
                <h3 className="px-2 pb-1.5 pt-2 text-[10px] font-bold text-amber-300/80">{category}</h3>
                <div className="space-y-1">
                  {items.map(tool => {
                    const Icon = tool.icon;
                    return (
                      <button key={tool.id} type="button" onClick={() => onNavigate(tool.id)} title={tool.description} className="group flex min-h-10 w-full items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-2 text-right transition-colors hover:border-amber-500/25 hover:bg-amber-500/[0.07] focus:outline-none focus:ring-2 focus:ring-amber-500/50">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-amber-500/20 bg-amber-500/[0.08] text-amber-300 group-hover:bg-amber-500/15">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-200 group-hover:text-white">{tool.title}</span>
                        {tool.tag && <span className="hidden shrink-0 rounded-full border border-amber-500/20 px-1.5 py-0.5 text-[9px] text-amber-300 xl:inline">{tool.tag}</span>}
                        <ArrowLeft className="h-3.5 w-3.5 shrink-0 text-slate-600 transition-transform group-hover:-translate-x-0.5 group-hover:text-amber-300" />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <p className="px-3 py-6 text-center text-xs text-slate-500">لا توجد أداة تطابق عبارة البحث.</p>}
        </nav>
      </aside>

      <div className="min-w-0 space-y-5">
        <header className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-l from-amber-500/10 via-[#0A1221] to-[#0A1221] p-5 sm:p-6">
          <div className="pointer-events-none absolute -left-12 -top-16 h-48 w-48 rounded-full bg-amber-500/5 blur-3xl" />
          <div className="relative">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold text-amber-300">
              <span className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2"><BarChart3 className="h-4 w-4" /></span>
              NINURTA · TOOL CENTER
            </div>
            <h1 className="text-xl font-black text-white sm:text-2xl">مركز أدوات نينورتا</h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">
              اختر الأداة من القائمة الجانبية للوصول مباشرة إلى وظيفتها. جُمعت الأدوات في قائمة واحدة لتقليل ازدحام الصفحة.
            </p>
            <div className="mt-5 flex items-center gap-2 text-xs text-slate-400">
              <ShieldCheck className="h-4 w-4 text-amber-400" />
              <span>{tools.length} أداة · 4 مجموعات</span>
            </div>
          </div>
        </header>
        <div className="rounded-2xl border border-slate-800 bg-[#0A1120] p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-300">
              <BrainCircuit className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-white">مساحة العمل</h2>
              <p className="mt-1 text-xs leading-6 text-slate-400">حدد إحدى الأدوات من القائمة اليمنى لفتحها داخل المنصة.</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {categories.map((category, index) => {
              const count = tools.filter(tool => tool.category === category).length;
              return (
                <div key={category} className="rounded-xl border border-slate-800/90 bg-[#080E19] px-3 py-3">
                  <div className="text-lg font-black text-amber-300">{count}</div>
                  <div className="mt-1 text-[11px] leading-5 text-slate-400">{category}</div>
                </div>
              );
            })}
          </div>
        </div>
        <p className="rounded-xl border border-slate-800/80 bg-[#080E19] px-4 py-3 text-[11px] leading-6 text-slate-500">
          ملاحظة: نتائج التحليل والحاسبات تعتمد على البيانات والقيم المتاحة أو المدخلة داخل المنصة، ولا تمثل ضماناً للأرباح أو توصية استثمارية ملزمة.
        </p>
      </div>
    </section>
  );
};
