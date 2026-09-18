import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { config } from './utils/config.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { 
  createRealtimeSession, 
  sendAudioToOpenAI, 
  setStreamSid, 
  cleanupSession,
  getSessionStats 
} from './services/openaiRealtimeService.js';
import { getCallById, updateCall } from './utils/database.js';

// Routes
import authRoutes from './routes/auth.js';
import contactsRoutes from './routes/contacts.js';
import callsRoutes from './routes/calls.js';
import twilioRoutes from './routes/twilio.js';
import auditRoutes from './routes/audit.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);

// ===== Middleware =====

// أمان HTTP headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// ثقة بالـ proxy (لـ Heroku, Railway, etc)
app.set('trust proxy', 1);

// معالجة JSON و form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// الجلسات
app.use(session({
  secret: config.auth.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.nodeEnv === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // يوم واحد
    sameSite: 'lax',
  },
}));

// Rate limiting للـ API
app.use('/api/', apiLimiter);

// الملفات الثابتة
app.use(express.static(join(__dirname, '../public')));

// ===== API Routes =====

app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/calls', callsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/twilio', twilioRoutes);

// معلومات التطبيق
app.get('/api/info', (req, res) => {
  res.json({
    name: 'مساعد دقة الصوتي',
    version: '1.0.0',
    mode: config.appMode,
    isLive: config.isLiveMode(),
    maxCallMinutes: config.calls.maxMinutes,
    allowedPrefixes: config.calls.allowedPrefixes,
    sessions: getSessionStats(),
  });
});

// فحص صحة الخادم
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    mode: config.appMode,
  });
});

// صفحة تسجيل الدخول
app.get('/login', (req, res) => {
  res.sendFile(join(__dirname, '../public/login.html'));
});

// الصفحة الرئيسية (لوحة التحكم)
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, '../public/index.html'));
});

// ===== WebSocket للـ Media Stream =====

const wss = new WebSocketServer({ server, path: '/media-stream' });

wss.on('connection', (ws, req) => {
  console.log('[WebSocket] اتصال جديد من Twilio');
  
  let callId = null;
  let streamSid = null;

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.event) {
        case 'connected':
          console.log('[WebSocket] Twilio متصل');
          break;
          
        case 'start':
          // بداية الـ stream - نحصل على معلومات المكالمة
          streamSid = message.start.streamSid;
          callId = message.start.customParameters?.callId;
          
          console.log('[WebSocket] بدء Stream:', { streamSid, callId });
          
          if (callId) {
            const call = getCallById(callId);
            if (call) {
              // إنشاء جلسة OpenAI Realtime
              const session = createRealtimeSession(
                callId,
                call.contactName,
                call.task,
                ws
              );
              
              if (session) {
                setStreamSid(callId, streamSid);
                updateCall(callId, { status: 'in-progress' });
              }
            }
          }
          break;
          
        case 'media':
          // استقبال الصوت من Twilio وإرساله لـ OpenAI
          if (callId && message.media?.payload) {
            sendAudioToOpenAI(callId, message.media.payload);
          }
          break;
          
        case 'stop':
          console.log('[WebSocket] توقف Stream:', streamSid);
          if (callId) {
            cleanupSession(callId);
          }
          break;
          
        case 'mark':
          // علامة من Twilio (تجاهل)
          break;
          
        default:
          console.log('[WebSocket] حدث غير معروف:', message.event);
      }
    } catch (error) {
      console.error('[WebSocket] خطأ في معالجة الرسالة:', error);
    }
  });

  ws.on('close', (code, reason) => {
    console.log('[WebSocket] اتصال مغلق:', code);
    if (callId) {
      cleanupSession(callId);
      
      const call = getCallById(callId);
      if (call && !call.endedAt) {
        updateCall(callId, {
          status: 'completed',
          endedAt: new Date().toISOString(),
        });
      }
    }
  });

  ws.on('error', (error) => {
    console.error('[WebSocket] خطأ:', error.message);
    if (callId) {
      updateCall(callId, {
        errorMessage: `WebSocket: ${error.message}`,
      });
    }
  });
});

// ===== معالجة الأخطاء =====

app.use((err, req, res, next) => {
  console.error('[Error]', err);
  res.status(500).json({ 
    error: config.nodeEnv === 'production' 
      ? 'حدث خطأ في الخادم' 
      : err.message 
  });
});

// ===== بدء الخادم =====

server.listen(config.port, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║              مساعد دقة الصوتي الشخصي                        ║
╠══════════════════════════════════════════════════════════════╣
║  الخادم: http://localhost:${config.port}                            ║
║  الوضع: ${config.appMode.padEnd(10)}                                     ║
║  البيئة: ${config.nodeEnv.padEnd(10)}                                    ║
╠══════════════════════════════════════════════════════════════╣
║  Twilio Voice Webhook: ${config.publicBaseUrl}/twilio/voice   
║  Twilio Status Callback: ${config.publicBaseUrl}/twilio/status
╚══════════════════════════════════════════════════════════════╝
  `);
  
  // تحذيرات الإعدادات
  if (config.isLiveMode()) {
    const errors = config.validateForLive();
    if (errors.length > 0) {
      console.warn('\n⚠️  تحذير: إعدادات ناقصة للوضع الحي:');
      errors.forEach(e => console.warn(`   - ${e}`));
      console.warn('');
    }
  }
  
  if (config.isDemoMode()) {
    console.log('📋 وضع Demo: المكالمات ستكون تجريبية بدون اتصال حقيقي\n');
  }
});

export default app;
