# Medworld-Theme

Medworld Theme for Frappe 15, maintained by Yasser Albahri.

## Quick Install

```bash
# داخل مجلد الـ bench
bench get-app https://github.com/YasserAlbahri/Medworld-Theme.git
bench --site <your-site> install-app medworld_theme
bench --site <your-site> migrate
bench --site <your-site> clear-cache
```

## Usage
- فعّل التطبيق على موقعك ثم اضبط الإعدادات من DocType: `Theme Settings`.
- يمكن تعيين الثيم للويب ولـ Desk عبر إعدادات الموقع/الثيم المعتادة في Frappe.

## Update
```bash
bench --site <your-site> uninstall-app medworld_theme
bench get-app https://github.com/YasserAlbahri/Medworld-Theme.git
bench --site <your-site> install-app medworld_theme
bench --site <your-site> migrate
bench --site <your-site> clear-cache
```

#### License

MIT
