# Phase 9 - Arabic Terminology (Fix 2)

هذه الحزمة كاملة وتحتوي على ملفات patchfiles المطلوبة، بما فيها:
- patchfiles/src/components/RabeeStatementPanel.tsx
- patchfiles/src/components/Navigation.tsx
- patchfiles/tests/arabicTerminology.test.ts

## طريقة التثبيت
1. أغلق التطبيق/الخادم إن كان يعمل.
2. فك ضغط الحزمة في جذر المشروع `Ninurta-Current`، وليس داخل مجلد `phase9patch`.
3. وافق على دمج واستبدال مجلد `phase9patch` عند الطلب.
4. تحقق أن هذا المسار موجود قبل التشغيل:
   `phase9patch\patchfiles\src\components\RabeeStatementPanel.tsx`
5. شغّل من جذر المشروع:
   `powershell -NoProfile -ExecutionPolicy Bypass -File ".\phase9patch\Apply-Phase9-Arabic-Terminology.ps1"`

المثبت ينسخ الملفات ثم يشغل الاختبارات وTypeScript والبناء. إذا فشل فحص، يستعيد الملفات السابقة.
