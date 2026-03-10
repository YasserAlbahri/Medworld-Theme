# تحديث التسميات العربية لـ Menu Visibility

## نظرة عامة

هذا السكربت يقوم بتحديث التسميات العربية (`item_label_ar`) تلقائياً لجميع سجلات `User Menu Hide Item` التي لديها `item_label` إنجليزي لكن `item_label_ar` فارغ.

## الطرق المتاحة

### الطريقة 1: تلقائية (عند Migration)

السكربت سيعمل تلقائياً عند تشغيل:
```bash
bench --site medworldyemen.com migrate
```

### الطريقة 2: يدوية (تشغيل مباشر)

يمكنك تشغيل السكربت يدوياً باستخدام:

```bash
bench --site medworldyemen.com execute medworld_theme.scripts.update_menu_hide_arabic_labels_manual.update_all
```

## ما يقوم به السكربت

1. **البحث**: يبحث عن جميع سجلات `User Menu Hide Item` التي:
   - لديها `item_label` (غير فارغ)
   - لا لديها `item_label_ar` (فارغ أو NULL)

2. **الحصول على الترجمة**: يحاول الحصول على الترجمة العربية من:
   - ملفات الترجمة (`get_all_translations`)
   - API الخاص بالتطبيق (`get_label_translations`)

3. **التحديث**: يحدث `item_label_ar` تلقائياً لكل سجل

4. **التقرير**: يعرض تقرير بعدد السجلات المحدثة والفاشلة

## مثال على الاستخدام

```bash
# الانتقال إلى مجلد bench
cd /mnt/d/medworld/frappe-bench

# تشغيل السكربت
bench --site medworldyemen.com execute medworld_theme.scripts.update_menu_hide_arabic_labels_manual.update_all
```

## المخرجات المتوقعة

```
Starting update of Arabic labels for User Menu Hide Items...
Found 15 items to update
✓ Updated: abc123 - 'Patient' -> 'مريض'
✓ Updated: def456 - 'Healthcare' -> 'الرعاية الصحية'
✗ No translation found for: 'Custom Label' (item: ghi789)
...
============================================================
Update completed!
✓ Updated: 12 items
✗ Failed/Skipped: 3 items
============================================================
```

## ملاحظات مهمة

1. **الترجمات المفقودة**: إذا لم يتم العثور على ترجمة لـ label معين، سيتم تخطيه (لن يفشل السكربت)

2. **الأمان**: السكربت آمن - لا يحذف أو يعدل بيانات موجودة، فقط يضيف `item_label_ar` للسجلات الفارغة

3. **الأداء**: السكربت يعمل على دفعات ويستخدم `update_modified=False` لتحسين الأداء

## استكشاف الأخطاء

إذا واجهت مشاكل:

1. **تحقق من السجلات**:
```sql
SELECT COUNT(*) FROM `tabUser Menu Hide Item` 
WHERE item_label IS NOT NULL 
AND item_label != '' 
AND (item_label_ar IS NULL OR item_label_ar = '');
```

2. **تحقق من السجلات**:
```bash
bench --site medworldyemen.com console
```

ثم في الـ console:
```python
from medworld_theme.scripts.update_menu_hide_arabic_labels_manual import update_all
result = update_all()
print(result)
```

3. **تحقق من سجلات الأخطاء**:
```bash
tail -f sites/medworldyemen.com/logs/frappe.log | grep "Menu Visibility"
```

## التحديثات المستقبلية

- السكربت يعمل تلقائياً عند إضافة عناصر جديدة للإخفاء (من خلال JavaScript)
- السجلات القديمة تحتاج لتشغيل السكربت مرة واحدة فقط


