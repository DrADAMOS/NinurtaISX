import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rabee = readFileSync('src/components/RabeeStatementPanel.tsx', 'utf8');
const navigation = readFileSync('src/components/Navigation.tsx', 'utf8');

test('Rabee statement uses consistent financial table terminology', () => {
  for (const term of ['حالة العقد', 'تاريخ التنفيذ', 'رقم العقد', 'رمز السهم', 'اسم الشركة', 'نوع العملية', 'سعر السهم', 'إجمالي قيمة الصفقة', 'صافي قيمة الصفقة']) {
    assert.ok(rabee.includes(term), `Missing terminology: ${term}`);
  }
  for (const obsolete of ["'الحالة','التاريخ','العقد','الرمز','الشركة','النوع','الكمية','السعر','القيمة الإجمالية','العمولة','الصافي'"]) {
    assert.ok(!rabee.includes(obsolete), `Obsolete table headings remain: ${obsolete}`);
  }
});

test('Rabee draft statuses distinguish saved and unsaved states', () => {
  assert.ok(rabee.includes('جديد — غير محفوظ'));
  assert.ok(rabee.includes('قيد المراجعة'));
  assert.ok(rabee.includes('مكرر سابقاً'));
});

test('navigation labels describe their destinations and buy count accurately', () => {
  assert.ok(navigation.includes("label: 'دليل الأسهم'"));
  assert.ok(navigation.includes("label: 'تحليل المصارف'"));
  assert.ok(navigation.includes('{item.badge} شراء'));
});
