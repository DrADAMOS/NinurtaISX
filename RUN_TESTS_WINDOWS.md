# تشغيل واختبار Ninurta Personal على Windows

افتح PowerShell داخل المجلد الذي يحتوي `package.json` ثم نفّذ:

```powershell
$env:Path = "D:\Program Files\nodejs;$env:Path"
node --version
npm.cmd --version
npm.cmd install
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

للتأكد من المصدر العام دون تعديل قاعدة البيانات:

```powershell
py -3 scripts/update-market-data-public.py --dry-run
```

يجب أن يظهر تاريخ جلسة صريح ومطابقة 105/105. إذا ظهرت رموز ناقصة أو تعذر تحليل الجدول، لا تشغّل التحديث الفعلي؛ أرسل سجل الخطأ للمراجعة.

لتشغيل الموقع محلياً فقط، انقر `Start-Ninurta.bat`. يفتح الموقع على `http://127.0.0.1:3000` ولا يستمع إلى اتصالات الشبكة الخارجية.

للتحديث اليدوي مع إعادة البناء، انقر `Run-Ninurta-Update.bat`. وللجدولة التلقائية، انقر `Install-Ninurta-Schedule.bat` مرة واحدة.

ملاحظة: التحديث المجاني يقتصر على الحقول التي تنشرها صفحة السوق العامة. لا يتم إنشاء شموع OHLC أو مؤشرات أو مستويات فنية اصطناعية، ولذلك لا تعاد التوصيات إلى العمل لمجرد تحديث السعر.
