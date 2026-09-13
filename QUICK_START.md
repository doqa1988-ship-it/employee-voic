# دليل التشغيل السريع - منصة صوت الموظف

## للقسم التقني: 3 خطوات فقط للتشغيل

---

## الطريقة 1: Docker (الأسهل - موصى بها)

### المتطلبات:
- Docker و Docker Compose مثبتان على السيرفر

### الخطوات:

```bash
# 1. فك ضغط الملف ودخول المجلد
unzip employee-voice-platform.zip
cd employee-voice-platform

# 2. نسخ وتعديل ملف الإعدادات
cp server/.env.example .env
nano .env   # أو أي محرر نصوص

# 3. تشغيل التطبيق
docker-compose up -d
```

**انتهى! التطبيق يعمل على:** `http://your-server-ip:3000`

---

## الطريقة 2: بدون Docker

### المتطلبات:
- Node.js 18 أو أحدث
- npm

### الخطوات:

```bash
# 1. فك ضغط الملف ودخول المجلد
unzip employee-voice-platform.zip
cd employee-voice-platform

# 2. تثبيت المكتبات
cd server
npm install

# 3. إعداد البيئة
cp .env.example .env
nano .env   # عدّل الإعدادات

# 4. تهيئة قاعدة البيانات وإنشاء المسؤول
npm run init-db

# 5. تشغيل الخادم
npm start
```

**التطبيق يعمل على:** `http://localhost:3000`

---

## إعدادات مهمة يجب تغييرها في ملف .env

| الإعداد | الوصف | مثال |
|---------|-------|------|
| `JWT_SECRET` | مفتاح سري للتشفير (32 حرف على الأقل) | `xK9#mP2$vL5nQ8@wR3tY6uI0oA4sD7fG` |
| `DEFAULT_ADMIN_PASSWORD` | كلمة مرور المسؤول | `MySecurePass@2024!` |
| `ALLOWED_ORIGINS` | عنوان الموقع | `https://complaints.yourcompany.com` |

---

## بيانات تسجيل الدخول الافتراضية

| الحقل | القيمة |
|-------|--------|
| اسم المستخدم | `admin` |
| كلمة المرور | (ما وضعته في DEFAULT_ADMIN_PASSWORD) |

⚠️ **غيّر كلمة المرور بعد أول تسجيل دخول!**

---

## هيكل الملفات

```
employee-voice-platform/
│
├── server/                 ← كود الخادم (Node.js)
│   ├── server.js          ← نقطة البداية
│   ├── routes/            ← مسارات API
│   ├── models/            ← قاعدة البيانات
│   ├── middleware/        ← المصادقة والأمان
│   ├── scripts/           ← سكربتات مساعدة
│   ├── package.json       ← المكتبات المطلوبة
│   └── .env.example       ← نموذج الإعدادات
│
├── public/                 ← الواجهة الأمامية
│   ├── index.html         ← الصفحة الرئيسية
│   ├── submit.html        ← تقديم شكوى
│   ├── track.html         ← متابعة شكوى
│   ├── dashboard.html     ← لوحة التحكم
│   ├── complaint.html     ← تفاصيل شكوى
│   ├── css/               ← ملفات التصميم
│   └── js/                ← ملفات JavaScript
│
├── Dockerfile             ← لبناء Docker image
├── docker-compose.yml     ← للتشغيل السهل
├── DEPLOYMENT.md          ← دليل النشر التفصيلي
└── README.md              ← توثيق المشروع
```

---

## للمبرمجين: كيفية التعديل

### تعديل الواجهة:
- ملفات HTML في مجلد `public/`
- التصميم في `public/css/styles.css`
- JavaScript في `public/js/`

### تعديل الخادم:
- API في `server/routes/`
- قاعدة البيانات في `server/models/database.js`
- المصادقة في `server/middleware/auth.js`

### إضافة حقول جديدة للشكوى:
1. عدّل جدول `complaints` في `server/models/database.js`
2. عدّل مسار الإنشاء في `server/routes/complaints.js`
3. أضف الحقل في نموذج `public/submit.html`

---

## الدعم

للمزيد من التفاصيل راجع:
- `README.md` - نظرة عامة
- `DEPLOYMENT.md` - دليل النشر الكامل

---

## ملاحظة أمنية

🔒 هذا النظام يحتوي على:
- تشفير كلمات المرور (bcrypt)
- مصادقة JWT آمنة
- حماية من هجمات Rate Limiting
- CORS للتحكم بالمصادر
