# Ninurta ISX Pro — Phase 4: Performance

## الهدف
تقليل حجم الحزمة الأولية عبر تحميل شاشات العمل الثانوية عند فتحها فقط (React.lazy + Suspense)، بدلاً من تضمين جميع الشاشات في أول تحميل.

## ما الذي يتغير؟
- RecommendationsView
- MarketDirectory
- PortfolioView
- FeeCalculator
- BankAnalyticsView
- TopMoversView
- InvestorHubView
- AccountStatementView

لم يتم تغيير منطق السوق أو حساب الرسوم أو تقييم المصارف أو مصادر البيانات. كما لم يتم تغيير مكونات الرأس والتنقل والشريط المتحرك.

## التطبيق
1. فك ضغط الأرشيف في مجلد مؤقت.
2. افتح PowerShell داخل المجلد الذي يحتوي `Apply-Phase4-Performance.ps1`.
3. شغّل:
   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\Apply-Phase4-Performance.ps1
   ```
4. السكربت يأخذ نسخة احتياطية من `src\App.tsx`، يطبق التعديل، ثم يشغل الاختبارات وTypeScript والبناء.

يفترض السكربت أن المشروع هو `Ninurta-Current` وأن Node موجود في `D:\Program Files\nodejs` كما في إعدادك السابق. شغّله من جذر المشروع بعد وضع السكربت ومجلد `patchfiles` بجانبه.

## ملاحظة
تحذير حجم الحزم قد يبقى جزئياً بسبب ملفات المكتبات أو البيانات الأخرى. لا نعتبر التحسين ناجحاً إلا بعد مقارنة مخرجات `dist` قبل وبعد التطبيق.
