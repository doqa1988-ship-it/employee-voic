# منصة صوت الموظف - Dockerfile
# =================================

FROM node:20-alpine

# تثبيت الأدوات اللازمة لـ better-sqlite3
RUN apk add --no-cache python3 make g++

# إنشاء مجلد التطبيق
WORKDIR /app

# نسخ ملفات package
COPY server/package*.json ./

# تثبيت المكتبات
RUN npm ci --only=production

# نسخ كود الخادم
COPY server/ ./

# نسخ الواجهة الأمامية
COPY public/ ./public/

# إنشاء مجلدات البيانات والمرفقات
RUN mkdir -p data uploads

# تعيين المتغيرات البيئية الافتراضية
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/complaints.db
ENV UPLOAD_PATH=/app/uploads

# فتح المنفذ
EXPOSE 3000

# أمر التشغيل
CMD ["node", "server.js"]
