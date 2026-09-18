import { Router } from 'express';
import { requireApiAuth } from '../middleware/auth.js';
import { 
  getContacts, 
  getContactById, 
  addContact, 
  updateContact, 
  giveConsent,
  deleteContact,
  addAuditEntry,
  normalizePhone,
  getContactByPhone 
} from '../utils/database.js';
import { isAllowedDestination } from '../services/twilioService.js';

const router = Router();

// حماية جميع المسارات
router.use(requireApiAuth);

// قائمة جهات الاتصال
router.get('/', (req, res) => {
  const contacts = getContacts();
  res.json(contacts);
});

// جهة اتصال واحدة
router.get('/:id', (req, res) => {
  const contact = getContactById(req.params.id);
  if (!contact) {
    return res.status(404).json({ error: 'جهة الاتصال غير موجودة' });
  }
  res.json(contact);
});

// إضافة جهة اتصال جديدة
router.post('/', (req, res) => {
  const { name, phone } = req.body;
  
  if (!name || !phone) {
    return res.status(400).json({ error: 'الاسم ورقم الهاتف مطلوبان' });
  }
  
  // التحقق من الرقم
  const normalized = normalizePhone(phone);
  if (!isAllowedDestination(normalized)) {
    return res.status(400).json({ 
      error: 'رقم الهاتف غير مسموح. يجب أن يبدأ بـ +964' 
    });
  }
  
  // التحقق من عدم وجود الرقم مسبقاً
  const existing = getContactByPhone(normalized);
  if (existing) {
    return res.status(409).json({ 
      error: 'رقم الهاتف مسجل مسبقاً',
      existingContact: { id: existing.id, name: existing.name },
    });
  }
  
  const contact = addContact({ name, phone: normalized });
  
  addAuditEntry({
    user: req.session.username,
    action: 'contact_created',
    targetType: 'contact',
    targetId: contact.id,
    details: { name, phone: normalized },
    ip: req.ip,
  });
  
  res.status(201).json(contact);
});

// تحديث جهة اتصال
router.patch('/:id', (req, res) => {
  const { name, phone } = req.body;
  const contact = getContactById(req.params.id);
  
  if (!contact) {
    return res.status(404).json({ error: 'جهة الاتصال غير موجودة' });
  }
  
  const updates = {};
  if (name) updates.name = name;
  if (phone) {
    const normalized = normalizePhone(phone);
    if (!isAllowedDestination(normalized)) {
      return res.status(400).json({ 
        error: 'رقم الهاتف غير مسموح. يجب أن يبدأ بـ +964' 
      });
    }
    updates.phone = normalized;
  }
  
  const updated = updateContact(req.params.id, updates);
  
  addAuditEntry({
    user: req.session.username,
    action: 'contact_updated',
    targetType: 'contact',
    targetId: req.params.id,
    details: updates,
    ip: req.ip,
  });
  
  res.json(updated);
});

// تسجيل موافقة جهة الاتصال
router.post('/:id/consent', (req, res) => {
  const contact = getContactById(req.params.id);
  
  if (!contact) {
    return res.status(404).json({ error: 'جهة الاتصال غير موجودة' });
  }
  
  if (contact.consentGiven) {
    return res.json({ 
      message: 'الموافقة مسجلة مسبقاً',
      contact,
    });
  }
  
  const updated = giveConsent(req.params.id);
  
  addAuditEntry({
    user: req.session.username,
    action: 'contact_consent_given',
    targetType: 'contact',
    targetId: req.params.id,
    details: { consentDate: updated.consentDate },
    ip: req.ip,
  });
  
  res.json({
    message: 'تم تسجيل الموافقة',
    contact: updated,
  });
});

// حذف جهة اتصال
router.delete('/:id', (req, res) => {
  const contact = getContactById(req.params.id);
  
  if (!contact) {
    return res.status(404).json({ error: 'جهة الاتصال غير موجودة' });
  }
  
  deleteContact(req.params.id);
  
  addAuditEntry({
    user: req.session.username,
    action: 'contact_deleted',
    targetType: 'contact',
    targetId: req.params.id,
    details: { name: contact.name, phone: contact.phone },
    ip: req.ip,
  });
  
  res.json({ success: true, message: 'تم حذف جهة الاتصال' });
});

export default router;
