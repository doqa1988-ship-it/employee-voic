# منصة صوت الموظف

نظام متكامل لإدارة شكاوى الموظفين في المؤسسات - جاهز للاستخدام المؤسسي.

## المميزات

- ✅ **واجهة عربية كاملة** مع دعم RTL
- ✅ **نظام مصادقة آمن** (JWT + تشفير bcrypt)
- ✅ **قاعدة بيانات** SQLite (قابلة للترقية لـ PostgreSQL)
- ✅ **رفع المرفقات** (PDF, Word, صور)
- ✅ **تقديم شكوى مجهول الهوية** أو بالاسم
- ✅ **متابعة الشكوى** برقم التتبع
- ✅ **لوحة تحكم للمسؤولين** مع إحصائيات
- ✅ **سجل تحديثات (Timeline)** لكل شكوى
- ✅ **جاهز للنشر** عبر Docker

## التشغيل السريع (Docker)

```bash
# 1. استنساخ المشروع
git clone https://github.com/YOUR_USERNAME/employee-voice.git
cd employee-voice

# 2. إعداد البيئة
cp server/.env.example .env
# عدّل ملف .env وغيّر JWT_SECRET وكلمة مرور المسؤول

# 3. تشغيل التطبيق
docker-compose up -d

# التطبيق يعمل على: http://localhost:3000
```

## التشغيل للتطوير

```bash
cd server
npm install
cp .env.example .env
npm run init-db  # إنشاء قاعدة البيانات والمسؤول
npm run dev
```

## هيكل المشروع

```
employee-voice/
├── server/                 # الخادم الخلفي (Node.js)
│   ├── routes/            # مسارات API
│   ├── middleware/        # المصادقة والأمان
│   ├── models/            # قاعدة البيانات
│   └── scripts/           # سكربتات الإدارة
├── public/                 # الواجهة الأمامية
│   ├── css/               # ملفات التنسيق
│   ├── js/                # JavaScript
│   └── *.html             # صفحات HTML
├── Dockerfile             # لبناء صورة Docker
├── docker-compose.yml     # لتشغيل التطبيق
└── DEPLOYMENT.md          # دليل النشر التفصيلي
```

## الصفحات

| الصفحة | الوصف | الوصول |
|--------|-------|--------|
| `/` | الصفحة الرئيسية | عام |
| `/submit.html` | تقديم شكوى جديدة | عام |
| `/track.html` | متابعة شكوى برقم التتبع | عام |
| `/dashboard.html` | لوحة إدارة الشكاوى | مسؤولين |
| `/complaint.html?id=X` | تفاصيل شكوى | مسؤولين |

## API Endpoints

| المسار | الطريقة | الوصف |
|--------|---------|-------|
| `/api/auth/login` | POST | تسجيل الدخول |
| `/api/complaints` | POST | تقديم شكوى |
| `/api/complaints/track/:id` | GET | متابعة شكوى |
| `/api/complaints` | GET | قائمة الشكاوى (مسؤولين) |
| `/api/complaints/:id` | PATCH | تحديث شكوى (مسؤولين) |
| `/api/complaints/stats/summary` | GET | إحصائيات (مسؤولين) |

## الأمان

- ✅ كلمات المرور مشفرة بـ bcrypt
- ✅ مصادقة JWT مع صلاحية محدودة
- ✅ حماية من هجمات Rate Limiting
- ✅ CORS للتحكم بالمصادر المسموحة
- ✅ Helmet لرؤوس الأمان HTTP

## النشر على السيرفر

راجع ملف [DEPLOYMENT.md](./DEPLOYMENT.md) للتعليمات التفصيلية:
- النشر عبر Docker
- إعداد Nginx
- شهادة SSL مجانية
- النسخ الاحتياطي
- استكشاف الأخطاء

## الترخيص

للاستخدام الداخلي في المؤسسة.
