import { Router } from 'express';
import { validateTwilioRequest } from '../middleware/twilioValidation.js';
import { config } from '../utils/config.js';
import { 
  updateCall, 
  getCallByTwilioSid, 
  addAuditEntry 
} from '../utils/database.js';
import { 
  generateVoiceResponse, 
  generateWaitResponse 
} from '../services/twilioService.js';

const router = Router();

// Webhook للرد على المكالمة - Twilio يستدعي هذا عند الرد
router.post('/voice', validateTwilioRequest, (req, res) => {
  const { CallSid, To, From, CallStatus } = req.body;
  
  console.log('[Twilio] Voice webhook:', { CallSid, To, CallStatus });
  
  // البحث عن سجل المكالمة
  const call = getCallByTwilioSid(CallSid);
  
  if (!call) {
    console.error('[Twilio] مكالمة غير موجودة:', CallSid);
    res.type('text/xml');
    return res.send(generateWaitResponse());
  }
  
  // تحديث حالة المكالمة
  updateCall(call.id, { status: 'answered' });
  
  addAuditEntry({
    user: 'twilio',
    action: 'call_answered',
    targetType: 'call',
    targetId: call.id,
    details: { twilioSid: CallSid, to: To, from: From },
  });
  
  // إرسال TwiML لبدء Media Stream
  res.type('text/xml');
  res.send(generateVoiceResponse(call.id));
});

// Webhook لتحديثات حالة المكالمة
router.post('/status', validateTwilioRequest, (req, res) => {
  const { 
    CallSid, 
    CallStatus, 
    CallDuration,
    AnsweredBy,
    ErrorCode,
    ErrorMessage 
  } = req.body;
  
  console.log('[Twilio] Status callback:', { CallSid, CallStatus, CallDuration });
  
  const call = getCallByTwilioSid(CallSid);
  
  if (!call) {
    console.error('[Twilio] مكالمة غير موجودة للحالة:', CallSid);
    return res.sendStatus(200);
  }
  
  const updates = { status: mapTwilioStatus(CallStatus) };
  
  // تحديثات إضافية حسب الحالة
  switch (CallStatus) {
    case 'completed':
      updates.endedAt = new Date().toISOString();
      if (CallDuration) {
        updates.durationSeconds = parseInt(CallDuration, 10);
        updates.actualCostUsd = calculateActualCost(updates.durationSeconds);
      }
      break;
      
    case 'busy':
      updates.errorMessage = 'الخط مشغول';
      updates.endedAt = new Date().toISOString();
      break;
      
    case 'no-answer':
      updates.errorMessage = 'لا يوجد رد';
      updates.endedAt = new Date().toISOString();
      break;
      
    case 'failed':
      updates.errorMessage = ErrorMessage || `خطأ: ${ErrorCode || 'غير معروف'}`;
      updates.endedAt = new Date().toISOString();
      break;
      
    case 'canceled':
      updates.errorMessage = 'تم إلغاء المكالمة';
      updates.endedAt = new Date().toISOString();
      break;
  }
  
  // إضافة معلومات المجيب الآلي
  if (AnsweredBy && AnsweredBy !== 'human') {
    updates.errorMessage = `رد عليها: ${AnsweredBy}`;
  }
  
  updateCall(call.id, updates);
  
  addAuditEntry({
    user: 'twilio',
    action: `call_status_${CallStatus}`,
    targetType: 'call',
    targetId: call.id,
    details: { 
      twilioSid: CallSid, 
      status: CallStatus,
      duration: CallDuration,
      answeredBy: AnsweredBy,
      error: ErrorMessage,
    },
  });
  
  res.sendStatus(200);
});

// تحويل حالات Twilio لحالاتنا
function mapTwilioStatus(twilioStatus) {
  const mapping = {
    'queued': 'queued',
    'initiated': 'initiated',
    'ringing': 'ringing',
    'in-progress': 'in-progress',
    'completed': 'completed',
    'busy': 'busy',
    'no-answer': 'no-answer',
    'failed': 'failed',
    'canceled': 'canceled',
  };
  return mapping[twilioStatus] || twilioStatus;
}

// حساب التكلفة الفعلية
function calculateActualCost(durationSeconds) {
  const minutes = durationSeconds / 60;
  const twilioCallCost = minutes * config.calls.iraqMobileRateUsd;
  const mediaStreamsCost = minutes * 0.004;
  const openaiCost = minutes * 0.10;
  return Math.round((twilioCallCost + mediaStreamsCost + openaiCost) * 100) / 100;
}

export default router;
