/**
 * مسارات إدارة الشكاوى
 */

const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../models/database');
const { authenticateToken, optionalAuth, requireAdmin } = require('../middleware/auth');

// إعداد رفع الملفات
const uploadDir = process.env.UPLOAD_PATH || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['application/pdf', 'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg', 'image/png', 'image/gif'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('نوع الملف غير مسموح'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 }
});

/**
 * تقديم شكوى جديدة (عام - بدون تسجيل دخول)
 * POST /api/complaints
 */
router.post('/', upload.array('attachments', 5), [
  body('category').notEmpty().withMessage('نوع الشكوى مطلوب'),
  body('subject').trim().notEmpty().withMessage('عنوان الشكوى مطلوب')
    .isLength({ max: 200 }).withMessage('العنوان طويل جداً'),
  body('description').trim().notEmpty().withMessage('تفاصيل الشكوى مطلوبة')
    .isLength({ min: 20 }).withMessage('التفاصيل قصيرة جداً - اكتب 20 حرفاً على الأقل'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('البريد الإلكتروني غير صحيح')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const {
      category, department, subject, description,
      anonymous, name, email, employeeNumber,
      incidentDate, confidentiality
    } = req.body;

    // إنشاء رقم تتبع فريد
    const trackingId = 'SHK-' + Date.now().toString(36).toUpperCase() + '-' + 
      Math.random().toString(36).substring(2, 6).toUpperCase();

    // إدخال الشكوى
    const result = db.prepare(`
      INSERT INTO complaints (
        tracking_id, category, department, subject, description,
        is_anonymous, complainant_name, complainant_email, complainant_employee_id,
        incident_date, confidentiality, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')
    `).run(
      trackingId, category, department || null, subject, description,
      anonymous === 'true' || anonymous === true ? 1 : 0,
      anonymous === 'true' || anonymous === true ? null : (name || null),
      anonymous === 'true' || anonymous === true ? null : (email || null),
      anonymous === 'true' || anonymous === true ? null : (employeeNumber || null),
      incidentDate || null,
      confidentiality || 'confidential'
    );

    const complaintId = result.lastInsertRowid;

    // إضافة سجل في Timeline
    db.prepare(`
      INSERT INTO complaint_timeline (complaint_id, status, note)
      VALUES (?, 'new', 'تم استلام الشكوى')
    `).run(complaintId);

    // حفظ معلومات المرفقات
    if (req.files && req.files.length > 0) {
      const insertAttachment = db.prepare(`
        INSERT INTO attachments (complaint_id, filename, original_name, mime_type, size)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const file of req.files) {
        insertAttachment.run(complaintId, file.filename, file.originalname, file.mimetype, file.size);
      }
    }

    res.status(201).json({
      message: 'تم تقديم الشكوى بنجاح',
      trackingId,
      complaintId
    });
  } catch (error) {
    console.error('خطأ في تقديم الشكوى:', error);
    res.status(500).json({ error: 'حدث خطأ في تقديم الشكوى' });
  }
});

/**
 * متابعة شكوى برقم التتبع (عام)
 * GET /api/complaints/track/:trackingId
 */
router.get('/track/:trackingId', [
  param('trackingId').trim().notEmpty().withMessage('رقم التتبع مطلوب')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { trackingId } = req.params;

    const complaint = db.prepare(`
      SELECT tracking_id, category, subject, status, created_at, updated_at
      FROM complaints WHERE tracking_id = ?
    `).get(trackingId.toUpperCase());

    if (!complaint) {
      return res.status(404).json({ error: 'لم يتم العثور على شكوى بهذا الرقم' });
    }

    // جلب سجل التحديثات
    const timeline = db.prepare(`
      SELECT status, note, created_at
      FROM complaint_timeline
      WHERE complaint_id = (SELECT id FROM complaints WHERE tracking_id = ?)
      ORDER BY created_at ASC
    `).all(trackingId.toUpperCase());

    res.json({ complaint, timeline });
  } catch (error) {
    console.error('خطأ في متابعة الشكوى:', error);
    res.status(500).json({ error: 'حدث خطأ في البحث عن الشكوى' });
  }
});

/**
 * قائمة جميع الشكاوى (للمسؤولين فقط)
 * GET /api/complaints
 */
router.get('/', authenticateToken, requireAdmin, [
  query('status').optional().isIn(['new', 'pending', 'progress', 'resolved', 'closed']),
  query('category').optional().trim(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], (req, res) => {
  try {
    const { status, category, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '1=1';
    const params = [];

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }
    if (category) {
      whereClause += ' AND category = ?';
      params.push(category);
    }

    // عدد الشكاوى
    const countResult = db.prepare(`SELECT COUNT(*) as total FROM complaints WHERE ${whereClause}`).get(...params);

    // جلب الشكاوى
    const complaints = db.prepare(`
      SELECT c.*, u.name as assigned_to_name
      FROM complaints c
      LEFT JOIN users u ON c.assigned_to = u.id
      WHERE ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

    res.json({
      complaints,
      pagination: {
        total: countResult.total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(countResult.total / limit)
      }
    });
  } catch (error) {
    console.error('خطأ في جلب الشكاوى:', error);
    res.status(500).json({ error: 'حدث خطأ في جلب الشكاوى' });
  }
});

/**
 * تفاصيل شكوى معينة (للمسؤولين)
 * GET /api/complaints/:id
 */
router.get('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;

    const complaint = db.prepare(`
      SELECT c.*, u.name as assigned_to_name
      FROM complaints c
      LEFT JOIN users u ON c.assigned_to = u.id
      WHERE c.id = ? OR c.tracking_id = ?
    `).get(id, id);

    if (!complaint) {
      return res.status(404).json({ error: 'الشكوى غير موجودة' });
    }

    // جلب المرفقات
    const attachments = db.prepare(`
      SELECT id, filename, original_name, mime_type, size, uploaded_at
      FROM attachments WHERE complaint_id = ?
    `).all(complaint.id);

    // جلب سجل التحديثات
    const timeline = db.prepare(`
      SELECT t.*, u.name as created_by_name
      FROM complaint_timeline t
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.complaint_id = ?
      ORDER BY t.created_at ASC
    `).all(complaint.id);

    res.json({ complaint, attachments, timeline });
  } catch (error) {
    console.error('خطأ في جلب تفاصيل الشكوى:', error);
    res.status(500).json({ error: 'حدث خطأ في جلب تفاصيل الشكوى' });
  }
});

/**
 * تحديث حالة شكوى (للمسؤولين)
 * PATCH /api/complaints/:id
 */
router.patch('/:id', authenticateToken, requireAdmin, [
  body('status').optional().isIn(['new', 'pending', 'progress', 'resolved', 'closed']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('note').optional().trim()
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { id } = req.params;
    const { status, priority, note, assignedTo, resolutionNotes } = req.body;

    // التحقق من وجود الشكوى
    const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);
    if (!complaint) {
      return res.status(404).json({ error: 'الشكوى غير موجودة' });
    }

    // بناء استعلام التحديث
    const updates = [];
    const params = [];

    if (status) {
      updates.push('status = ?');
      params.push(status);
      
      if (status === 'resolved' || status === 'closed') {
        updates.push('resolved_at = CURRENT_TIMESTAMP');
      }
    }
    if (priority) {
      updates.push('priority = ?');
      params.push(priority);
    }
    if (assignedTo !== undefined) {
      updates.push('assigned_to = ?');
      params.push(assignedTo || null);
    }
    if (resolutionNotes) {
      updates.push('resolution_notes = ?');
      params.push(resolutionNotes);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    if (updates.length > 1) {
      db.prepare(`UPDATE complaints SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    // إضافة سجل في Timeline
    if (status || note) {
      db.prepare(`
        INSERT INTO complaint_timeline (complaint_id, status, note, created_by)
        VALUES (?, ?, ?, ?)
      `).run(id, status || complaint.status, note || `تم تحديث الحالة إلى: ${status}`, req.user.id);
    }

    res.json({ message: 'تم تحديث الشكوى بنجاح' });
  } catch (error) {
    console.error('خطأ في تحديث الشكوى:', error);
    res.status(500).json({ error: 'حدث خطأ في تحديث الشكوى' });
  }
});

/**
 * إحصائيات الشكاوى (للمسؤولين)
 * GET /api/complaints/stats/summary
 */
router.get('/stats/summary', authenticateToken, requireAdmin, (req, res) => {
  try {
    const stats = {
      total: db.prepare('SELECT COUNT(*) as count FROM complaints').get().count,
      new: db.prepare("SELECT COUNT(*) as count FROM complaints WHERE status = 'new'").get().count,
      pending: db.prepare("SELECT COUNT(*) as count FROM complaints WHERE status = 'pending'").get().count,
      progress: db.prepare("SELECT COUNT(*) as count FROM complaints WHERE status = 'progress'").get().count,
      resolved: db.prepare("SELECT COUNT(*) as count FROM complaints WHERE status = 'resolved'").get().count,
      closed: db.prepare("SELECT COUNT(*) as count FROM complaints WHERE status = 'closed'").get().count
    };

    // إحصائيات حسب النوع
    const byCategory = db.prepare(`
      SELECT category, COUNT(*) as count 
      FROM complaints 
      GROUP BY category 
      ORDER BY count DESC
    `).all();

    // إحصائيات هذا الشهر
    const thisMonth = db.prepare(`
      SELECT COUNT(*) as count 
      FROM complaints 
      WHERE created_at >= date('now', 'start of month')
    `).get().count;

    res.json({ stats, byCategory, thisMonth });
  } catch (error) {
    console.error('خطأ في جلب الإحصائيات:', error);
    res.status(500).json({ error: 'حدث خطأ في جلب الإحصائيات' });
  }
});

module.exports = router;
