import { Router } from 'express';
import { requireApiAuth } from '../middleware/auth.js';
import { callLimiter, preventDoubleClick } from '../middleware/rateLimiter.js';
import { config } from '../utils/config.js';
import { 
  getCalls, 
  getCallById, 
  addCall, 
  getContactById,
  addAuditEntry 
} from '../utils/database.js';
import { 
  initiateCall, 
  endCall, 
  estimateCost, 
  isAllowedDestination 
} from '../services/twilioService.js';
import { hasActiveSession } from '../services/openaiRealtimeService.js';

const router = Router();

// حماية جميع المسارات
router.use(requireApiAuth);

// قائمة المكالمات
router.get('/', (req, res) => {
  const calls = getCalls();
  res.json(calls);
});

// مكالمة واحدة
router.get('/:id', (req, res) => {
  const call = getCallById(req.params.id);
  if (!call) {
    return res.status(404).json({ error: 'المكالمة غير موجودة' });
  }
  res.json(call);
});

// تقدير تكلفة المكالمة
router.get('/estimate/:contactId', (req, res) => {
  const contact = getContactById(req.params.contactId);
  if (!contact) {
    return res.status(404).json({ error: 'جهة الاتصال غير موجودة' });
  }
  
  const estimate = estimateCost(config.calls.maxMinutes);
  res.json({
    contact: { id: contact.id, name: contact.name, phone: contact.phone },
    maxDuration: config.calls.maxMinutes,
    ...estimate,
  });
});

// بدء مكالمة جديدة
router.post(
  '/initiate',
  callLimiter,
  preventDoubleClick(req => `call_${req.session.username}_${req.body.contactId}`),
  async (req, res) => {
    const { contactId, task, confirmed } = req.body;
    
    // التحقق من البيانات المطلوبة
    if (!contactId) {
      return res.status(400).json({ error: 'جهة الاتصال مطلوبة' });
    }
    
    if (!task || task.trim().length < 10) {
      return res.status(400).json({ 
        error: 'يجب كتابة مهمة الاتصال (10 حروف على الأقل)' 
      });
    }
    
    // التحقق من جهة الاتصال
    const contact = getContactById(contactId);
    if (!contact) {
      return res.status(404).json({ error: 'جهة الاتصال غير موجودة' });
    }
    
    // التحقق من الرقم المسموح
    if (!isAllowedDestination(contact.phone)) {
      return res.status(400).json({ 
        error: `الرقم ${contact.phone} غير مسموح. الأرقام المسموحة: ${config.calls.allowedPrefixes.join(', ')}` 
      });
    }
    
    // التحقق من الموافقة (في وضع live فقط)
    if (config.isLiveMode() && !contact.consentGiven) {
      return res.status(403).json({ 
        error: 'يجب تسجيل موافقة جهة الاتصال أولاً قبل الاتصال بها' 
      });
    }
    
    // التحقق من تأكيد المستخدم (في وضع live فقط)
    if (config.isLiveMode() && !confirmed) {
      const estimate = estimateCost(config.calls.maxMinutes);
      return res.status(400).json({ 
        error: 'يجب تأكيد المكالمة',
        requiresConfirmation: true,
        contact: { id: contact.id, name: contact.name, phone: contact.phone },
        task,
        estimate,
        message: `هل أنت متأكد من الاتصال بـ ${contact.name} (${contact.phone})؟ التكلفة التقديرية: $${estimate.totalEstimate}`,
      });
    }
    
    // التحقق من إعدادات live mode
    if (config.isLiveMode()) {
      const errors = config.validateForLive();
      if (errors.length > 0) {
        return res.status(500).json({ 
          error: 'إعدادات غير مكتملة للوضع الحي',
          missingConfig: errors,
        });
      }
    }
    
    try {
      // إنشاء سجل المكالمة
      const callRecord = addCall({
        contactId: contact.id,
        contactName: contact.name,
        contactPhone: contact.phone,
        task: task.trim(),
        estimatedCostUsd: estimateCost(config.calls.maxMinutes).totalEstimate,
      });
      
      // بدء المكالمة
      const result = await initiateCall(
        callRecord, 
        req.session.username, 
        req.ip
      );
      
      res.json({
        success: true,
        message: config.isDemoMode() 
          ? 'مكالمة تجريبية - لا يوجد اتصال حقيقي' 
          : 'تم بدء المكالمة',
        call: getCallById(callRecord.id),
        ...result,
      });
    } catch (error) {
      console.error('[Calls] خطأ في بدء المكالمة:', error);
      res.status(500).json({ 
        error: error.message || 'فشل بدء المكالمة' 
      });
    }
  }
);

// إنهاء مكالمة جارية
router.post('/:id/end', async (req, res) => {
  const call = getCallById(req.params.id);
  
  if (!call) {
    return res.status(404).json({ error: 'المكالمة غير موجودة' });
  }
  
  const activeStatuses = ['initiated', 'ringing', 'in-progress', 'demo_initiated', 'demo_ringing', 'demo_in_progress'];
  if (!activeStatuses.includes(call.status)) {
    return res.status(400).json({ 
      error: 'المكالمة ليست جارية',
      currentStatus: call.status,
    });
  }
  
  try {
    await endCall(req.params.id, req.session.username, req.ip);
    res.json({ 
      success: true, 
      message: 'تم إنهاء المكالمة',
      call: getCallById(req.params.id),
    });
  } catch (error) {
    console.error('[Calls] خطأ في إنهاء المكالمة:', error);
    res.status(500).json({ error: error.message });
  }
});

// حالة المكالمة
router.get('/:id/status', (req, res) => {
  const call = getCallById(req.params.id);
  
  if (!call) {
    return res.status(404).json({ error: 'المكالمة غير موجودة' });
  }
  
  res.json({
    id: call.id,
    status: call.status,
    hasActiveSession: hasActiveSession(call.id),
    startedAt: call.startedAt,
    endedAt: call.endedAt,
    durationSeconds: call.durationSeconds,
  });
});

export default router;
