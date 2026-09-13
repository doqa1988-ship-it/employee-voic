/**
 * منصة صوت الموظف - الخادم الرئيسي
 * نظام إدارة شكاوى الموظفين المؤسسي
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const complaintsRoutes = require('./routes/complaints');
const adminRoutes = require('./routes/admin');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// إعدادات الأمان
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// إعدادات CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:3000', 'http://localhost:8080'];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('غير مسموح بالوصول من هذا المصدر'));
    }
  },
  credentials: true
}));

// تحديد معدل الطلبات للحماية من هجمات DDoS
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'تم تجاوز الحد المسموح من الطلبات. حاول لاحقاً.' }
});
app.use('/api/', limiter);

// تحديد معدل أكثر صرامة لتسجيل الدخول
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'محاولات تسجيل دخول كثيرة. حاول بعد 15 دقيقة.' }
});
app.use('/api/auth/login', loginLimiter);

// معالجة JSON و Form Data
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// خدمة الملفات الثابتة (الواجهة الأمامية)
app.use(express.static(path.join(__dirname, '../public')));

// خدمة المرفقات المرفوعة (مع حماية)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// المسارات API
app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintsRoutes);
app.use('/api/admin', adminRoutes);

// مسار فحص صحة الخادم
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// توجيه جميع المسارات الأخرى للواجهة الأمامية (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// معالج الأخطاء العام
app.use(errorHandler);

// بدء الخادم
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║           منصة صوت الموظف - خادم جاهز للعمل              ║
╠════════════════════════════════════════════════════════════╣
║  الخادم يعمل على: http://localhost:${PORT}                   ║
║  البيئة: ${process.env.NODE_ENV || 'development'}                                    ║
║  الوقت: ${new Date().toLocaleString('ar-SA')}                  ║
╚════════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
