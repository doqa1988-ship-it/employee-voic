import twilio from 'twilio';
import { config } from '../utils/config.js';
import { updateCall, addAuditEntry, getCallById } from '../utils/database.js';

let twilioClient = null;

function getClient() {
  if (!twilioClient && config.twilio.accountSid && config.twilio.authToken) {
    twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
  }
  return twilioClient;
}

// التحقق من صلاحية رقم الهاتف
export function isAllowedDestination(phone) {
  if (!phone) return false;
  
  const normalized = phone.replace(/[\s\-\(\)]/g, '');
  return config.calls.allowedPrefixes.some(prefix => 
    normalized.startsWith(prefix)
  );
}

// تقدير التكلفة
export function estimateCost(durationMinutes = config.calls.maxMinutes) {
  const twilioCallCost = durationMinutes * config.calls.iraqMobileRateUsd;
  const mediaStreamsCost = durationMinutes * 0.004; // تقريبي
  const openaiCost = durationMinutes * 0.10; // تقريبي للـ Realtime
  
  return {
    durationMinutes,
    twilioCallCost: Math.round(twilioCallCost * 1000) / 1000,
    mediaStreamsCost: Math.round(mediaStreamsCost * 1000) / 1000,
    openaiCost: Math.round(openaiCost * 1000) / 1000,
    totalEstimate: Math.round((twilioCallCost + mediaStreamsCost + openaiCost) * 100) / 100,
    note: 'تقدير تقريبي. الأسعار قد تختلف.',
  };
}

// بدء مكالمة
export async function initiateCall(callRecord, user, ip) {
  if (config.isDemoMode()) {
    // في وضع Demo، محاكاة المكالمة
    return simulateCall(callRecord, user, ip);
  }
  
  const client = getClient();
  if (!client) {
    throw new Error('Twilio غير مُعدّ. تحقق من متغيرات البيئة.');
  }
  
  if (!isAllowedDestination(callRecord.contactPhone)) {
    throw new Error(`الرقم ${callRecord.contactPhone} غير مسموح. الأرقام المسموحة: ${config.calls.allowedPrefixes.join(', ')}`);
  }
  
  const webhookUrl = `${config.publicBaseUrl}/twilio/voice`;
  const statusCallbackUrl = `${config.publicBaseUrl}/twilio/status`;
  
  try {
    const call = await client.calls.create({
      to: callRecord.contactPhone,
      from: config.twilio.phoneNumber,
      url: webhookUrl,
      statusCallback: statusCallbackUrl,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
      timeout: 30, // ثواني للرد
      timeLimit: config.calls.maxMinutes * 60, // الحد الأقصى بالثواني
      record: false, // لا نسجل الصوت
      machineDetection: 'Enable', // كشف المجيب الآلي
    });
    
    // تحديث سجل المكالمة
    updateCall(callRecord.id, {
      status: 'initiated',
      twilioCallSid: call.sid,
      startedAt: new Date().toISOString(),
    });
    
    // سجل التدقيق
    addAuditEntry({
      user,
      action: 'call_initiated',
      targetType: 'call',
      targetId: callRecord.id,
      details: {
        phone: callRecord.contactPhone,
        twilioSid: call.sid,
        task: callRecord.task,
      },
      ip,
    });
    
    return {
      success: true,
      callId: callRecord.id,
      twilioSid: call.sid,
      status: 'initiated',
    };
  } catch (error) {
    updateCall(callRecord.id, {
      status: 'failed',
      errorMessage: error.message,
    });
    
    addAuditEntry({
      user,
      action: 'call_failed',
      targetType: 'call',
      targetId: callRecord.id,
      details: { error: error.message },
      ip,
    });
    
    throw error;
  }
}

// إنهاء مكالمة جارية
export async function endCall(callId, user, ip) {
  const callRecord = getCallById(callId);
  if (!callRecord) {
    throw new Error('المكالمة غير موجودة');
  }
  
  if (config.isDemoMode()) {
    updateCall(callId, {
      status: 'completed',
      endedAt: new Date().toISOString(),
    });
    
    addAuditEntry({
      user,
      action: 'call_ended_manual',
      targetType: 'call',
      targetId: callId,
      ip,
    });
    
    return { success: true };
  }
  
  if (!callRecord.twilioCallSid) {
    throw new Error('لا يوجد SID للمكالمة');
  }
  
  const client = getClient();
  if (!client) {
    throw new Error('Twilio غير مُعدّ');
  }
  
  try {
    await client.calls(callRecord.twilioCallSid).update({ status: 'completed' });
    
    updateCall(callId, {
      status: 'completed',
      endedAt: new Date().toISOString(),
    });
    
    addAuditEntry({
      user,
      action: 'call_ended_manual',
      targetType: 'call',
      targetId: callId,
      details: { twilioSid: callRecord.twilioCallSid },
      ip,
    });
    
    return { success: true };
  } catch (error) {
    throw new Error(`فشل إنهاء المكالمة: ${error.message}`);
  }
}

// محاكاة مكالمة في وضع Demo
async function simulateCall(callRecord, user, ip) {
  const fakeSid = `DEMO_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  updateCall(callRecord.id, {
    status: 'demo_initiated',
    twilioCallSid: fakeSid,
    startedAt: new Date().toISOString(),
  });
  
  addAuditEntry({
    user,
    action: 'demo_call_initiated',
    targetType: 'call',
    targetId: callRecord.id,
    details: {
      phone: callRecord.contactPhone,
      task: callRecord.task,
      note: 'وضع Demo - لا يوجد اتصال حقيقي',
    },
    ip,
  });
  
  // محاكاة تقدم المكالمة
  setTimeout(() => {
    updateCall(callRecord.id, { status: 'demo_ringing' });
  }, 1000);
  
  setTimeout(() => {
    updateCall(callRecord.id, { status: 'demo_in_progress' });
  }, 3000);
  
  // إنهاء المكالمة التجريبية بعد 10 ثوانٍ
  setTimeout(() => {
    const duration = 10;
    updateCall(callRecord.id, {
      status: 'demo_completed',
      endedAt: new Date().toISOString(),
      durationSeconds: duration,
      actualCostUsd: estimateCost(duration / 60).totalEstimate,
      summary: `[Demo] مكالمة تجريبية إلى ${callRecord.contactName}. المهمة: ${callRecord.task}. هذه محاكاة ولم يحدث اتصال حقيقي.`,
    });
    
    addAuditEntry({
      user: 'system',
      action: 'demo_call_completed',
      targetType: 'call',
      targetId: callRecord.id,
      details: { duration },
    });
  }, 10000);
  
  return {
    success: true,
    callId: callRecord.id,
    twilioSid: fakeSid,
    status: 'demo_initiated',
    isDemo: true,
  };
}

// إنشاء TwiML للرد على المكالمة
export function generateVoiceResponse(callId) {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();
  
  // بدء Media Stream للاتصال بـ OpenAI
  const connect = response.connect();
  const stream = connect.stream({
    url: `wss://${new URL(config.publicBaseUrl).host}/media-stream`,
    name: 'openai-stream',
  });
  
  // إرسال معلومات المكالمة
  stream.parameter({ name: 'callId', value: callId });
  
  return response.toString();
}

// إنشاء TwiML للانتظار (fallback)
export function generateWaitResponse() {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();
  
  response.say({
    language: 'ar-XA',
    voice: 'Google.ar-XA-Standard-A',
  }, 'عذراً، حدث خطأ في الاتصال. يرجى المحاولة لاحقاً.');
  
  response.hangup();
  
  return response.toString();
}
