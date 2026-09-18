import { WebSocket } from 'ws';
import { config } from '../utils/config.js';
import { updateCall, getCallById, addAuditEntry } from '../utils/database.js';

const OPENAI_REALTIME_URL = 'wss://api.openai.com/v1/realtime';

// تخزين الجلسات النشطة
const activeSessions = new Map();

// إنشاء تعريف المساعد
function createSystemPrompt(contactName, task, ownerName = 'دقة') {
  return `أنت مساعد ذكاء اصطناعي صوتي تابع للأستاذ ${ownerName}. أنت تجري مكالمة هاتفية الآن.

## هويتك:
- أنت مساعد ذكاء اصطناعي وليس إنساناً. يجب أن تكون صريحاً بهذا عند بداية المكالمة.
- أنت تتحدث العربية باللهجة العراقية.
- أنت مهذب ومحترف.

## بداية المكالمة:
ابدأ المكالمة بالتحية التالية (بالضبط أو بصيغة مشابهة):
"السلام عليكم أستاذ ${contactName}، أنا مساعد ذكاء اصطناعي تابع للأستاذ ${ownerName}. أتصل للاستفسار عن موضوع معين."

## المهمة المطلوبة:
${task}

## قواعد المحادثة:
1. كن مختصراً وواضحاً
2. استمع جيداً للرد
3. اسأل أسئلة متابعة إذا لزم الأمر
4. لا تكرر نفسك كثيراً
5. إذا لم يفهم المتحدث، أعد الشرح ببساطة
6. أنهِ المكالمة بأدب عند اكتمال المهمة

## إنهاء المكالمة:
عند الانتهاء، قل شيئاً مثل:
"شكراً جزيلاً أستاذ ${contactName}. تحياتي للأستاذ ${ownerName}. مع السلامة."

## تنبيهات:
- لا تدّعي أنك إنسان أبداً
- لا تتحدث عن مواضيع خارج المهمة
- إذا سُئلت عن طبيعتك، أكد أنك ذكاء اصطناعي
- إذا طلب الشخص إنهاء المكالمة، أنهها بأدب فوراً`;
}

export function createRealtimeSession(callId, contactName, task, twilioWs) {
  if (!config.openai.apiKey) {
    console.error('[OpenAI] مفتاح API غير موجود');
    return null;
  }

  const callRecord = getCallById(callId);
  if (!callRecord) {
    console.error('[OpenAI] سجل المكالمة غير موجود:', callId);
    return null;
  }

  const url = `${OPENAI_REALTIME_URL}?model=${config.openai.realtimeModel}`;
  
  const openaiWs = new WebSocket(url, {
    headers: {
      'Authorization': `Bearer ${config.openai.apiKey}`,
      'OpenAI-Beta': 'realtime=v1',
    },
  });

  const session = {
    callId,
    openaiWs,
    twilioWs,
    streamSid: null,
    conversationItems: [],
    isConnected: false,
  };

  activeSessions.set(callId, session);

  openaiWs.on('open', () => {
    console.log('[OpenAI] اتصال WebSocket مفتوح للمكالمة:', callId);
    session.isConnected = true;

    // إعداد الجلسة
    const sessionConfig = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: createSystemPrompt(contactName, task),
        voice: config.openai.voice,
        input_audio_format: 'g711_ulaw',
        output_audio_format: 'g711_ulaw',
        input_audio_transcription: {
          model: 'whisper-1',
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
        },
      },
    };

    openaiWs.send(JSON.stringify(sessionConfig));
    console.log('[OpenAI] تم إرسال إعدادات الجلسة');
  });

  openaiWs.on('message', (data) => {
    try {
      const event = JSON.parse(data.toString());
      handleOpenAIEvent(session, event);
    } catch (error) {
      console.error('[OpenAI] خطأ في تحليل الرسالة:', error);
    }
  });

  openaiWs.on('close', (code, reason) => {
    console.log('[OpenAI] اتصال مغلق:', code, reason?.toString());
    session.isConnected = false;
    cleanupSession(callId);
  });

  openaiWs.on('error', (error) => {
    console.error('[OpenAI] خطأ WebSocket:', error.message);
    session.isConnected = false;
    
    updateCall(callId, {
      errorMessage: `خطأ OpenAI: ${error.message}`,
    });
  });

  return session;
}

function handleOpenAIEvent(session, event) {
  const { callId, twilioWs, streamSid } = session;

  switch (event.type) {
    case 'session.created':
      console.log('[OpenAI] جلسة منشأة:', event.session?.id);
      break;

    case 'session.updated':
      console.log('[OpenAI] جلسة محدّثة');
      // بدء المحادثة بالتحية
      startConversation(session);
      break;

    case 'response.audio.delta':
      // إرسال الصوت إلى Twilio
      if (event.delta && twilioWs && twilioWs.readyState === WebSocket.OPEN && streamSid) {
        const audioMessage = {
          event: 'media',
          streamSid: streamSid,
          media: {
            payload: event.delta,
          },
        };
        twilioWs.send(JSON.stringify(audioMessage));
      }
      break;

    case 'response.audio_transcript.delta':
      // نص الرد (للتتبع فقط، لا نحفظه)
      break;

    case 'response.audio_transcript.done':
      console.log('[OpenAI] انتهى رد المساعد');
      break;

    case 'input_audio_buffer.speech_started':
      console.log('[OpenAI] بدأ المتحدث الكلام');
      // إيقاف رد المساعد إذا كان يتحدث (مقاطعة)
      if (session.openaiWs && session.openaiWs.readyState === WebSocket.OPEN) {
        session.openaiWs.send(JSON.stringify({ type: 'response.cancel' }));
        // مسح صوت Twilio المتبقي
        if (twilioWs && twilioWs.readyState === WebSocket.OPEN && streamSid) {
          twilioWs.send(JSON.stringify({
            event: 'clear',
            streamSid: streamSid,
          }));
        }
      }
      break;

    case 'input_audio_buffer.speech_stopped':
      console.log('[OpenAI] توقف المتحدث عن الكلام');
      break;

    case 'conversation.item.input_audio_transcription.completed':
      console.log('[OpenAI] نص المتحدث:', event.transcript?.substring(0, 50));
      break;

    case 'response.done':
      console.log('[OpenAI] انتهى الرد');
      // تحقق إذا كان المساعد يريد إنهاء المكالمة
      if (event.response?.output) {
        const lastOutput = event.response.output[event.response.output.length - 1];
        if (lastOutput?.content) {
          const text = lastOutput.content.map(c => c.transcript || '').join(' ').toLowerCase();
          if (text.includes('مع السلامة') || text.includes('وداعاً')) {
            // انتظر قليلاً ثم أنهِ المكالمة
            setTimeout(() => {
              endCallGracefully(session);
            }, 2000);
          }
        }
      }
      break;

    case 'error':
      console.error('[OpenAI] خطأ:', event.error);
      updateCall(callId, {
        errorMessage: `OpenAI: ${event.error?.message || 'خطأ غير معروف'}`,
      });
      break;

    default:
      // تجاهل الأحداث الأخرى
      break;
  }
}

function startConversation(session) {
  if (!session.openaiWs || session.openaiWs.readyState !== WebSocket.OPEN) {
    return;
  }

  // طلب رد أولي من المساعد (التحية)
  session.openaiWs.send(JSON.stringify({
    type: 'response.create',
    response: {
      modalities: ['text', 'audio'],
    },
  }));
  
  console.log('[OpenAI] طلب بدء المحادثة');
}

// استقبال الصوت من Twilio وإرساله إلى OpenAI
export function sendAudioToOpenAI(callId, audioPayload) {
  const session = activeSessions.get(callId);
  if (!session || !session.openaiWs || session.openaiWs.readyState !== WebSocket.OPEN) {
    return;
  }

  const audioEvent = {
    type: 'input_audio_buffer.append',
    audio: audioPayload,
  };

  session.openaiWs.send(JSON.stringify(audioEvent));
}

// تحديث StreamSid من Twilio
export function setStreamSid(callId, streamSid) {
  const session = activeSessions.get(callId);
  if (session) {
    session.streamSid = streamSid;
    console.log('[OpenAI] تم تعيين StreamSid:', streamSid);
  }
}

// إنهاء المكالمة برفق
function endCallGracefully(session) {
  const { callId, twilioWs, streamSid } = session;
  
  console.log('[OpenAI] إنهاء المكالمة برفق:', callId);
  
  // إرسال أمر إنهاء إلى Twilio
  if (twilioWs && twilioWs.readyState === WebSocket.OPEN && streamSid) {
    // إغلاق الـ stream
    twilioWs.send(JSON.stringify({
      event: 'stop',
      streamSid: streamSid,
    }));
  }
  
  cleanupSession(callId);
}

// تنظيف الجلسة
export function cleanupSession(callId) {
  const session = activeSessions.get(callId);
  if (!session) return;

  console.log('[OpenAI] تنظيف جلسة المكالمة:', callId);

  // إغلاق OpenAI WebSocket
  if (session.openaiWs && session.openaiWs.readyState === WebSocket.OPEN) {
    session.openaiWs.close();
  }

  activeSessions.delete(callId);

  // إنشاء ملخص (بدون تفاصيل المحادثة)
  const callRecord = getCallById(callId);
  if (callRecord && !callRecord.summary) {
    updateCall(callId, {
      summary: `مكالمة إلى ${callRecord.contactName}. المهمة: ${callRecord.task}`,
    });
  }
}

// الحصول على الجلسة النشطة
export function getActiveSession(callId) {
  return activeSessions.get(callId);
}

// التحقق من وجود جلسة نشطة
export function hasActiveSession(callId) {
  const session = activeSessions.get(callId);
  return session && session.isConnected;
}

// إحصائيات الجلسات
export function getSessionStats() {
  return {
    activeSessions: activeSessions.size,
    sessions: Array.from(activeSessions.keys()),
  };
}
