import React from 'react';
import { LayoutGrid, Target } from 'lucide-react';

interface NavigationProps {
  activeView: string;
  onNavigate: (view: string) => void;
  recommendationsCount: { buy: number; speculate: number; wait: number; sell: number };
}

export const Navigation: React.FC<NavigationProps> = ({ activeView, onNavigate, recommendationsCount }) => (
  <nav aria-label="التنقل الرئيسي" className="border-b border-slate-800/80 bg-[#080D1A] px-4 py-2.5">
    <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
      <button type="button" onClick={() => onNavigate('tools')} aria-current={activeView === 'tools' ? 'page' : undefined}
        className={`flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-right transition-colors ${activeView === 'tools' ? 'border-amber-500/50 bg-amber-500/10 text-amber-200' : 'border-slate-800 bg-slate-900/50 text-slate-300 hover:border-slate-700 hover:bg-slate-800/70'}`}>
        <span className="rounded-lg bg-amber-500/10 p-1.5 text-amber-300"><LayoutGrid className="h-4 w-4" /></span>
        <span><span className="block text-xs font-bold">مركز أدوات نينورتا</span><span className="block text-[10px] text-slate-500">جميع الأدوات في صفحة واحدة</span></span>
      </button>
      <button type="button" onClick={() => onNavigate('recommendations')} aria-current={activeView === 'recommendations' ? 'page' : undefined}
        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition-colors ${activeView === 'recommendations' ? 'border-amber-500/40 bg-amber-500/10 text-amber-200' : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:text-slate-200'}`}>
        <Target className="h-4 w-4" /> إشارات السوق
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-300">{recommendationsCount.buy}</span>
      </button>
    </div>
  </nav>
);
