import React from 'react';
import { Download, FileSpreadsheet, FileText, ShieldCheck } from 'lucide-react';
import type { PortfolioPosition, Stock } from '../types/stock';
import { buildPortfolioReport } from '../utils/portfolioReport';
import { formatIqd } from '../utils/calculator';

export const PortfolioDashboard: React.FC<{ stocks: Stock[]; positions: PortfolioPosition[] }> = ({ stocks, positions }) => {
  const report = buildPortfolioReport(positions, stocks);
  const exportRows = report.rows.map(row => ({
    'رمز السهم': row.symbol, 'الشركة': row.name, 'الكمية': row.shares,
    'متوسط سعر الشراء': row.averageBuyPrice, 'السعر الحالي': row.currentPrice,
    'الكلفة التقديرية مع العمولة': row.investedGross + row.estimatedBuyFee,
    'القيمة السوقية الإجمالية': row.marketGross, 'عمولة البيع التقديرية': row.estimatedSellFee,
    'القيمة الصافية التقديرية': row.marketNet, 'الربح/الخسارة غير المحققة': row.unrealizedNet,
    'العائد %': row.returnPercent, 'مصدر السعر': row.source,
  }));
  const exportExcel = async () => {
    const XLSX = await import('xlsx');
    const sheet = XLSX.utils.json_to_sheet(exportRows);
    const summary = XLSX.utils.aoa_to_sheet([
      ['تقرير المحفظة الاستثمارية'], ['تاريخ الإنشاء', report.generatedAt],
      ['الكلفة التقديرية', report.invested], ['القيمة السوقية الصافية التقديرية', report.marketValueNet],
      ['الربح/الخسارة غير المحققة', report.unrealizedNet], ['العائد %', report.returnPercent],
      ['تنبيه', 'العمولات تقديرية وفق معدل التطبيق، وليست كشف تسوية وسيط.'],
    ]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, summary, 'ملخص');
    XLSX.utils.book_append_sheet(book, sheet, 'تفاصيل الأسهم');
    XLSX.writeFile(book, `Ninurta-Portfolio-${report.generatedAt.slice(0,10)}.xlsx`);
  };
  const exportPdf = () => {
    const rows = report.rows.map(row => `<tr><td>${escapeHtml(row.symbol)}</td><td>${escapeHtml(row.name)}</td><td>${row.shares}</td><td>${row.averageBuyPrice.toFixed(4)}</td><td>${row.currentPrice.toFixed(4)}</td><td>${row.marketNet.toFixed(2)}</td><td>${row.unrealizedNet.toFixed(2)}</td><td>${row.returnPercent.toFixed(2)}%</td></tr>`).join('');
    const html = `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>تقرير المحفظة</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#172033}h1{font-size:22px}p{color:#475569}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #cbd5e1;padding:8px;text-align:right}th{background:#e2e8f0}.summary{display:flex;gap:20px;flex-wrap:wrap;margin:20px 0}.summary b{display:block}footer{margin-top:24px;font-size:11px;color:#64748b}@media print{button{display:none}}</style><h1>تقرير المحفظة الاستثمارية – Ninurta ISX Pro</h1><p>تاريخ الإنشاء: ${escapeHtml(report.generatedAt)}</p><div class="summary"><span><b>الكلفة التقديرية</b>${report.invested.toFixed(2)} د.ع</span><span><b>القيمة السوقية الصافية التقديرية</b>${report.marketValueNet.toFixed(2)} د.ع</span><span><b>الربح/الخسارة غير المحققة</b>${report.unrealizedNet.toFixed(2)} د.ع</span><span><b>العائد</b>${report.returnPercent.toFixed(2)}%</span></div><table><thead><tr><th>الرمز</th><th>الشركة</th><th>الكمية</th><th>متوسط الشراء</th><th>السعر الحالي</th><th>القيمة الصافية</th><th>ربح/خسارة</th><th>العائد</th></tr></thead><tbody>${rows}</tbody></table><footer>هذا تقرير تقديري للعرض فقط. عمولات الشراء والبيع تقديرية وفق إعداد التطبيق. لا يمثل كشف حساب أو تسوية رسمية من الوسيط، ولا يغيّر أرصدة المحفظة.</footer><script>window.onload=()=>window.print()</script></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const tab = window.open(url, '_blank');
    if (!tab) { URL.revokeObjectURL(url); window.alert('اسمح بفتح النوافذ المنبثقة لتصدير التقرير PDF.'); return; }
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  };
  return <section dir="rtl" className="mb-5 space-y-4 rounded-2xl border border-amber-500/20 bg-[#0A0F1D] p-4 shadow-xl">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-amber-300"/><h3 className="font-black text-white">لوحة المحفظة والتقرير</h3></div><p className="mt-1 text-[11px] text-slate-400">ملخص مشتق من المراكز والأسعار المتاحة؛ لا ينفذ أي تعديل أو تسوية.</p></div><div className="flex gap-2"><button onClick={exportExcel} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600/20 px-3 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-600/30"><FileSpreadsheet size={15}/> Excel</button><button onClick={exportPdf} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-700 px-3 py-2 text-xs font-bold text-white hover:bg-slate-600"><FileText size={15}/> PDF / طباعة</button></div></div>
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4"><Metric label="الكلفة التقديرية" value={formatIqd(report.invested)}/><Metric label="القيمة السوقية الصافية" value={formatIqd(report.marketValueNet)}/><Metric label="الربح / الخسارة غير المحققة" value={formatIqd(report.unrealizedNet)} positive={report.unrealizedNet>=0}/><Metric label="العائد التقديري" value={`${report.returnPercent.toFixed(2)}%`} positive={report.returnPercent>=0}/></div>
    {report.missingQuotes.length>0&&<p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-200">تنبيه: لا تتوفر أسعار حالية للرموز التالية؛ استُخدم متوسط سعر الشراء مؤقتاً: {report.missingQuotes.join('، ')}.</p>}
    <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-right text-xs"><thead className="bg-slate-900 text-slate-400"><tr>{['السهم','الكمية','متوسط الشراء','السعر الحالي','الكلفة مع العمولة','القيمة الصافية','الربح / الخسارة','المصدر'].map(label=><th key={label} className="px-3 py-2">{label}</th>)}</tr></thead><tbody>{report.rows.map(row=><tr key={row.symbol} className="border-t border-slate-800 text-slate-200"><td className="px-3 py-2"><b className="text-amber-300">{row.symbol}</b><div className="text-[10px] text-slate-400">{row.name}</div></td><td className="px-3 py-2">{row.shares.toLocaleString('en-US')}</td><td className="px-3 py-2">{row.averageBuyPrice.toLocaleString('en-US')}</td><td className="px-3 py-2">{row.currentPrice.toLocaleString('en-US')}</td><td className="px-3 py-2">{formatIqd(row.investedGross+row.estimatedBuyFee)}</td><td className="px-3 py-2">{formatIqd(row.marketNet)}</td><td className={`px-3 py-2 ${row.unrealizedNet>=0?'text-emerald-300':'text-rose-300'}`}>{formatIqd(row.unrealizedNet)}</td><td className="px-3 py-2 text-slate-400">{row.source}</td></tr>)}</tbody></table></div>
    <p className="flex items-center gap-1 text-[10px] text-slate-500"><Download size={12}/> التصدير لا يتضمن بيانات غير متاحة. الأسعار والعمولات تقديرية وليست بديلاً عن كشف الوسيط.</p>
  </section>;
};
function Metric({label,value,positive}:{label:string;value:string;positive?:boolean}) { return <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3"><p className="text-[10px] text-slate-400">{label}</p><strong className={`mt-1 block text-sm font-black ${positive===undefined?'text-white':positive?'text-emerald-300':'text-rose-300'}`}>{value}</strong></div>; }
function escapeHtml(value:string) { return value.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char] || char)); }
