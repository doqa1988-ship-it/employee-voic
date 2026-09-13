/**
 * Middleware للمصادقة والتحقق من الصلاحيات
 */

const jwt = require('jsonwebtoken');
const db = require('../models/database');

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';

/**
 * التحقق من توكن JWT
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'غير مصرح - يرجى تسجيل الدخول' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // التحقق من وجود المستخدم ونشاطه
    const user = db.prepare('SELECT id, username, name, role, is_active FROM users WHERE id = ?').get(decoded.userId);
    
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'الحساب غير نشط أو غير موجود' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'انتهت صلاحية الجلسة - يرجى تسجيل الدخول مجدداً' });
    }
    return res.status(403).json({ error: 'توكن غير صالح' });
  }
};

/**
 * التحقق من صلاحية المسؤول
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || !['admin', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'ليس لديك صلاحية للوصول لهذا المورد' });
  }
  next();
};

/**
 * التحقق من صلاحية المسؤول الأعلى
 */
const requireSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'هذا الإجراء يتطلب صلاحيات المسؤول الأعلى' });
  }
  next();
};

/**
 * مصادقة اختيارية (للمسارات العامة التي قد تحتاج معلومات المستخدم)
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = db.prepare('SELECT id, username, name, role FROM users WHERE id = ? AND is_active = 1').get(decoded.userId);
      req.user = user || null;
    } catch {
      req.user = null;
    }
  } else {
    req.user = null;
  }
  
  next();
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireSuperAdmin,
  optionalAuth,
  JWT_SECRET
};
