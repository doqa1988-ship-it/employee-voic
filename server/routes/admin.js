/**
 * مسارات إدارة المستخدمين والإعدادات (للمسؤولين)
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, param, validationResult } = require('express-validator');
const db = require('../models/database');
const { authenticateToken, requireAdmin, requireSuperAdmin } = require('../middleware/auth');

/**
 * قائمة المستخدمين (المسؤولين)
 * GET /api/admin/users
 */
router.get('/users', authenticateToken, requireSuperAdmin, (req, res) => {
  try {
    const users = db.prepare(`
      SELECT id, username, name, role, email, is_active, created_at, last_login
      FROM users
      ORDER BY created_at DESC
    `).all();

    res.json({ users });
  } catch (error) {
    console.error('خطأ في جلب المستخدمين:', error);
    res.status(500).json({ error: 'حدث خطأ في جلب المستخدمين' });
  }
});

/**
 * إضافة مستخدم جديد
 * POST /api/admin/users
 */
router.post('/users', authenticateToken, requireSuperAdmin, [
  body('username').trim().notEmpty().withMessage('اسم المستخدم مطلوب')
    .isLength({ min: 3 }).withMessage('اسم المستخدم يجب أن يكون 3 أحرف على الأقل'),
  body('password').isLength({ min: 8 }).withMessage('كلمة المرور يجب أن تكون 8 أحرف على الأقل'),
  body('name').trim().notEmpty().withMessage('الاسم الكامل مطلوب'),
  body('role').isIn(['admin', 'super_admin', 'viewer']).withMessage('الدور غير صحيح')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { username, password, name, role, email } = req.body;

    // التحقق من عدم وجود المستخدم
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(409).json({ error: 'اسم المستخدم موجود مسبقاً' });
    }

    // تشفير كلمة المرور
    const hashedPassword = await bcrypt.hash(password, 12);

    // إضافة المستخدم
    const result = db.prepare(`
      INSERT INTO users (username, password, name, role, email)
      VALUES (?, ?, ?, ?, ?)
    `).run(username, hashedPassword, name, role, email || null);

    res.status(201).json({
      message: 'تم إضافة المستخدم بنجاح',
      userId: result.lastInsertRowid
    });
  } catch (error) {
    console.error('خطأ في إضافة المستخدم:', error);
    res.status(500).json({ error: 'حدث خطأ في إضافة المستخدم' });
  }
});

/**
 * تحديث مستخدم
 * PATCH /api/admin/users/:id
 */
router.patch('/users/:id', authenticateToken, requireSuperAdmin, [
  param('id').isInt().withMessage('معرف المستخدم غير صحيح'),
  body('name').optional().trim().notEmpty(),
  body('role').optional().isIn(['admin', 'super_admin', 'viewer']),
  body('is_active').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { id } = req.params;
    const { name, role, email, is_active, newPassword } = req.body;

    // التحقق من وجود المستخدم
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    // بناء استعلام التحديث
    const updates = [];
    const params = [];

    if (name) {
      updates.push('name = ?');
      params.push(name);
    }
    if (role) {
      updates.push('role = ?');
      params.push(role);
    }
    if (email !== undefined) {
      updates.push('email = ?');
      params.push(email || null);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(is_active ? 1 : 0);
    }
    if (newPassword) {
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      updates.push('password = ?');
      params.push(hashedPassword);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'لا توجد بيانات للتحديث' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    res.json({ message: 'تم تحديث المستخدم بنجاح' });
  } catch (error) {
    console.error('خطأ في تحديث المستخدم:', error);
    res.status(500).json({ error: 'حدث خطأ في تحديث المستخدم' });
  }
});

/**
 * حذف مستخدم
 * DELETE /api/admin/users/:id
 */
router.delete('/users/:id', authenticateToken, requireSuperAdmin, (req, res) => {
  try {
    const { id } = req.params;

    // منع حذف المستخدم الحالي
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'لا يمكنك حذف حسابك' });
    }

    const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    res.json({ message: 'تم حذف المستخدم بنجاح' });
  } catch (error) {
    console.error('خطأ في حذف المستخدم:', error);
    res.status(500).json({ error: 'حدث خطأ في حذف المستخدم' });
  }
});

/**
 * سجل النشاط
 * GET /api/admin/activity
 */
router.get('/activity', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const activities = db.prepare(`
      SELECT 
        t.id,
        t.status,
        t.note,
        t.created_at,
        c.tracking_id,
        c.subject,
        u.name as user_name
      FROM complaint_timeline t
      JOIN complaints c ON t.complaint_id = c.id
      LEFT JOIN users u ON t.created_by = u.id
      ORDER BY t.created_at DESC
      LIMIT ?
    `).all(parseInt(limit));

    res.json({ activities });
  } catch (error) {
    console.error('خطأ في جلب سجل النشاط:', error);
    res.status(500).json({ error: 'حدث خطأ في جلب سجل النشاط' });
  }
});

module.exports = router;
