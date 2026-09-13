/**
 * مسارات المصادقة وتسجيل الدخول
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../models/database');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

/**
 * تسجيل الدخول
 * POST /api/auth/login
 */
router.post('/login', [
  body('username').trim().notEmpty().withMessage('اسم المستخدم مطلوب'),
  body('password').notEmpty().withMessage('كلمة المرور مطلوبة')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { username, password } = req.body;

    // البحث عن المستخدم
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);

    if (!user) {
      return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }

    // التحقق من كلمة المرور
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }

    // تحديث وقت آخر تسجيل دخول
    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

    // إنشاء التوكن
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      message: 'تم تسجيل الدخول بنجاح',
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('خطأ في تسجيل الدخول:', error);
    res.status(500).json({ error: 'حدث خطأ في تسجيل الدخول' });
  }
});

/**
 * الحصول على بيانات المستخدم الحالي
 * GET /api/auth/me
 */
router.get('/me', authenticateToken, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      username: req.user.username,
      name: req.user.name,
      role: req.user.role
    }
  });
});

/**
 * تغيير كلمة المرور
 * POST /api/auth/change-password
 */
router.post('/change-password', authenticateToken, [
  body('currentPassword').notEmpty().withMessage('كلمة المرور الحالية مطلوبة'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('كلمة المرور يجب أن تحتوي على حرف كبير وصغير ورقم')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { currentPassword, newPassword } = req.body;

    // الحصول على كلمة المرور الحالية
    const user = db.prepare('SELECT password FROM users WHERE id = ?').get(req.user.id);

    // التحقق من كلمة المرور الحالية
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'كلمة المرور الحالية غير صحيحة' });
    }

    // تشفير وحفظ كلمة المرور الجديدة
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(hashedPassword, req.user.id);

    res.json({ message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (error) {
    console.error('خطأ في تغيير كلمة المرور:', error);
    res.status(500).json({ error: 'حدث خطأ في تغيير كلمة المرور' });
  }
});

/**
 * تسجيل الخروج
 * POST /api/auth/logout
 */
router.post('/logout', authenticateToken, (req, res) => {
  res.json({ message: 'تم تسجيل الخروج بنجاح' });
});

module.exports = router;
