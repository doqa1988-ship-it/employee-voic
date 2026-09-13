# دليل تثبيت ونشر منصة صوت الموظف

## نظرة عامة

منصة صوت الموظف هي نظام متكامل لإدارة شكاوى الموظفين، يتكون من:
- **الواجهة الأمامية**: HTML/CSS/JavaScript
- **الخادم الخلفي**: Node.js + Express
- **قاعدة البيانات**: SQLite (يمكن الترقية لـ PostgreSQL)
- **المصادقة**: JWT مع تشفير bcrypt

---

## المتطلبات

### الخيار 1: تشغيل مباشر
- Node.js 18 أو أحدث
- npm أو yarn

### الخيار 2: Docker (موصى به للإنتاج)
- Docker 20.10 أو أحدث
- Docker Compose 2.0 أو أحدث

---

## طريقة التثبيت

### الطريقة 1: Docker (الأسهل والموصى بها)

```bash
# 1. استنساخ المشروع
git clone https://github.com/YOUR_USERNAME/employee-voice.git
cd employee-voice

# 2. إنشاء ملف البيئة
cp server/.env.example .env

# 3. تعديل ملف .env (مهم جداً!)
nano .env
# غيّر JWT_SECRET لقيمة عشوائية طويلة
# غيّر DEFAULT_ADMIN_PASSWORD

# 4. بناء وتشغيل التطبيق
docker-compose up -d

# 5. التحقق من التشغيل
docker-compose logs -f
```

التطبيق سيعمل على: `http://localhost:3000`

### الطريقة 2: تشغيل مباشر (للتطوير)

```bash
# 1. استنساخ المشروع
git clone https://github.com/YOUR_USERNAME/employee-voice.git
cd employee-voice

# 2. تثبيت المكتبات
cd server
npm install

# 3. إعداد ملف البيئة
cp .env.example .env
nano .env  # عدّل الإعدادات

# 4. تهيئة قاعدة البيانات وإنشاء المسؤول
npm run init-db

# 5. تشغيل الخادم
npm start

# أو للتطوير مع إعادة التشغيل التلقائي
npm run dev
```

---

## إعدادات البيئة (.env)

```env
# إعدادات الخادم
PORT=3000
NODE_ENV=production

# مفتاح JWT (مهم جداً - غيّره!)
JWT_SECRET=your-super-secret-jwt-key-change-this-min-32-chars

# مدة صلاحية الجلسة (بالساعات)
JWT_EXPIRES_IN=8

# قاعدة البيانات
DB_PATH=./data/complaints.db

# المرفقات
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=5242880

# CORS - عناوين الواجهة المسموح بها
ALLOWED_ORIGINS=https://your-domain.com

# المسؤول الافتراضي (يُستخدم مرة واحدة عند التثبيت)
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=YourSecurePassword123!
DEFAULT_ADMIN_NAME=مدير النظام
```

---

## النشر على السيرفر

### خطوات النشر على سيرفر Linux

```bash
# 1. تحديث النظام
sudo apt update && sudo apt upgrade -y

# 2. تثبيت Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# 3. تثبيت Docker Compose
sudo apt install docker-compose-plugin -y

# 4. استنساخ المشروع
git clone https://github.com/YOUR_USERNAME/employee-voice.git
cd employee-voice

# 5. إعداد البيئة
cp server/.env.example .env
nano .env  # عدّل الإعدادات

# 6. تشغيل التطبيق
docker compose up -d

# 7. إعداد Nginx كـ Reverse Proxy (اختياري)
sudo apt install nginx -y
```

### إعداد Nginx (اختياري)

```nginx
# /etc/nginx/sites-available/employee-voice
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# تفعيل الموقع
sudo ln -s /etc/nginx/sites-available/employee-voice /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# إضافة شهادة SSL مجانية
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

---

## إدارة المستخدمين

### إنشاء مسؤول جديد عبر سطر الأوامر

```bash
# داخل مجلد server
node scripts/create-admin.js username password "الاسم الكامل"

# أو تفاعلياً
node scripts/create-admin.js
```

### أدوار المستخدمين

| الدور | الصلاحيات |
|-------|----------|
| `super_admin` | جميع الصلاحيات + إدارة المستخدمين |
| `admin` | عرض وتحديث الشكاوى |
| `viewer` | عرض الشكاوى فقط |

---

## النسخ الاحتياطي

### نسخ قاعدة البيانات

```bash
# باستخدام Docker
docker cp employee-voice-platform:/app/data/complaints.db ./backup_$(date +%Y%m%d).db

# أو مباشرة
cp server/data/complaints.db ./backup_$(date +%Y%m%d).db
```

### نسخ المرفقات

```bash
# باستخدام Docker
docker cp employee-voice-platform:/app/uploads ./uploads_backup_$(date +%Y%m%d)

# أو مباشرة
cp -r uploads ./uploads_backup_$(date +%Y%m%d)
```

### استعادة النسخة الاحتياطية

```bash
# إيقاف التطبيق
docker-compose down

# استعادة قاعدة البيانات
docker cp backup.db employee-voice-platform:/app/data/complaints.db

# إعادة التشغيل
docker-compose up -d
```

---

## الصيانة

### عرض السجلات

```bash
# سجلات Docker
docker-compose logs -f

# آخر 100 سطر
docker-compose logs --tail=100
```

### إعادة تشغيل التطبيق

```bash
docker-compose restart
```

### تحديث التطبيق

```bash
git pull origin main
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

---

## استكشاف الأخطاء

### التطبيق لا يعمل

```bash
# تحقق من حالة الحاويات
docker-compose ps

# عرض السجلات
docker-compose logs app

# إعادة البناء
docker-compose down
docker-compose up -d --build
```

### خطأ في قاعدة البيانات

```bash
# تحقق من صلاحيات مجلد البيانات
ls -la server/data/

# أعد تهيئة قاعدة البيانات (سيمسح البيانات!)
rm server/data/complaints.db
npm run init-db
```

### خطأ في تسجيل الدخول

```bash
# إنشاء مسؤول جديد
node server/scripts/create-admin.js newadmin NewPassword123! "مسؤول جديد"
```

---

## الأمان

### قائمة التحقق للإنتاج

- [ ] تغيير `JWT_SECRET` لقيمة عشوائية طويلة (32+ حرف)
- [ ] تغيير كلمة مرور المسؤول الافتراضي
- [ ] تفعيل HTTPS عبر Nginx + Let's Encrypt
- [ ] تحديد `ALLOWED_ORIGINS` للدومين الخاص بك فقط
- [ ] إعداد جدار حماية (UFW)
- [ ] إعداد نسخ احتياطي تلقائي
- [ ] مراجعة السجلات دورياً

### أوامر الأمان الأساسية

```bash
# جدار الحماية
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable

# تحديثات الأمان التلقائية
sudo apt install unattended-upgrades -y
sudo dpkg-reconfigure unattended-upgrades
```

---

## الدعم الفني

للمساعدة أو الإبلاغ عن مشاكل:
- افتح Issue على GitHub
- راجع السجلات باستخدام `docker-compose logs`

---

## الترخيص

هذا المشروع للاستخدام الداخلي في المؤسسة.
