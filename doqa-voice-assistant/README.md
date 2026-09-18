# مساعد دقة الصوتي الشخصي 🎙️

مساعد ذكاء اصطناعي شخصي يُجري مكالمات هاتفية عادية بالنيابة عنك، يتحدث بالعربية (واللهجة العراقية) عبر **Twilio** و **OpenAI Realtime API**.

## الفكرة

تكتب للمساعد: **"اتصل بعلي واسأله وين وصلت المعاملة"**

المساعد يتصل بعلي ويقول:
> "السلام عليكم أستاذ علي، أنا مساعد ذكاء اصطناعي تابع للأستاذ دقة. أتصل للاستفسار عن المعاملة..."

ثم يُجري الحوار كاملاً، يسأل أسئلة متابعة، وينهي المكالمة بأدب، ويحفظ الملخص في لوحة التحكم.

## المميزات

- ✅ **مكالمات هاتفية حقيقية** عبر Twilio Programmable Voice
- ✅ **صوت ذكاء اصطناعي طبيعي** عبر OpenAI Realtime API
- ✅ **تحدث بالعربية** واللهجة العراقية
- ✅ **يُعرّف نفسه بوضوح** كمساعد ذكاء اصطناعي (لا ينتحل شخصية إنسان)
- ✅ **لوحة تحكم عربية** متجاوبة مع الموبايل والكمبيوتر
- ✅ **نظام موافقة** - لا يتصل إلا بموافقة جهة الاتصال
- ✅ **تأكيد المكالمة** - يطلب تأكيدك قبل الاتصال
- ✅ **تقدير التكلفة** قبل المكالمة
- ✅ **حد زمني للمكالمة** (افتراضي 3 دقائق)
- ✅ **زر إنهاء المكالمة** الجارية
- ✅ **سجل تدقيق شامل** (المستخدم، الرقم، المهمة، الوقت، الحالة، المدة، التكلفة)
- ✅ **تسجيل دخول آمن** للوحة التحكم
- ✅ **التحقق من توقيع Twilio** للـ Webhooks
- ✅ **حماية من النقر المزدوج** وتكرار الاتصال
- ✅ **وضع Demo** للاختبار بدون مكالمات حقيقية
- ✅ **أرقام عراقية فقط** (+964) افتراضياً
- 🚫 **لا يسجل الصوت** - يحفظ ملخصاً فقط

## التقنيات

- **Node.js** (ES Modules)
- **Express** - الخادم
- **WebSocket (ws)** - اتصال ثنائي الاتجاه
- **Twilio Programmable Voice** - المكالمات الهاتفية
- **Twilio Media Streams** - نقل الصوت
- **OpenAI Realtime API** - الذكاء الاصطناعي الصوتي
- **JSON File Storage** - تخزين بسيط

## التثبيت

```bash
# 1. استنساخ المشروع
git clone https://github.com/YOUR_USERNAME/doqa-voice-assistant.git
cd doqa-voice-assistant

# 2. تثبيت التبعيات
npm install

# 3. إعداد متغيرات البيئة
cp .env.example .env
# عدّل ملف .env بالقيم الصحيحة

# 4. تشغيل الخادم
npm start
```

## متغيرات البيئة

أنشئ ملف `.env` من `.env.example`:

```env
# إعدادات الخادم
PORT=3000
PUBLIC_BASE_URL=https://YOUR-DOMAIN.example
NODE_ENV=production

# المصادقة
APP_USERNAME=doqa
APP_PASSWORD=كلمة-مرور-طويلة-وقوية
SESSION_SECRET=سر-جلسة-طويل-وعشوائي

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview
OPENAI_TEXT_MODEL=gpt-4o-mini
OPENAI_VOICE=alloy

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_VALIDATE_SIGNATURES=true

# إعدادات المكالمات
MAX_CALL_MINUTES=3
ALLOWED_DESTINATION_PREFIXES=+964
IRAQ_MOBILE_RATE_USD=0.4633

# الوضع: demo أو live
APP_MODE=demo
```

### أين تضع المفاتيح السرية؟

**لا ترسل المفاتيح في المحادثة أو ترفعها إلى Git!**

في منصة الاستضافة (Railway, Render, Heroku, etc.):
1. اذهب إلى **Settings** أو **Environment Variables**
2. أضف كل متغير من القائمة أعلاه
3. احفظ وأعد تشغيل التطبيق

## إعدادات Twilio

### 1. احصل على رقم هاتف
- اشترِ رقماً من Twilio Console يدعم الاتصال الصوتي

### 2. اضبط Webhook
في إعدادات الرقم (Phone Numbers → Manage → Active Numbers):

| الإعداد | القيمة |
|---------|--------|
| **Voice Configuration** | |
| A Call Comes In | Webhook |
| URL | `https://YOUR-DOMAIN/twilio/voice` |
| HTTP Method | POST |
| **Status Callback URL** | `https://YOUR-DOMAIN/twilio/status` |

## النشر

### متطلبات المنصة
- ✅ دعم **Node.js 20+**
- ✅ دعم **WebSocket** (wss://)
- ✅ **HTTPS** إجباري
- ✅ دعم الاتصالات الطويلة (long-lived connections)

### أمر التشغيل
```bash
npm install && npm start
```

### المنصات المدعومة
- ✅ **Railway** - موصى به
- ✅ **Render**
- ✅ **Fly.io**
- ⚠️ **Vercel** - لا يدعم WebSocket بشكل كامل
- ⚠️ **Netlify** - Functions فقط

### بعد النشر

1. **اضبط `PUBLIC_BASE_URL`** على رابط الاستضافة النهائي
2. **اضبط Twilio Webhooks** على:
   - Voice: `https://YOUR-DOMAIN/twilio/voice`
   - Status: `https://YOUR-DOMAIN/twilio/status`
3. **غيّر `APP_MODE`** إلى `live` فقط بعد التأكد من كل شيء

## الاستخدام

### 1. تسجيل الدخول
افتح `https://YOUR-DOMAIN/login` وسجّل الدخول

### 2. إضافة جهة اتصال
- اذهب لـ **جهات الاتصال**
- أضف الاسم ورقم الهاتف (+964...)
- **سجّل موافقة** جهة الاتصال (مطلوب في الوضع الحي)

### 3. إجراء مكالمة
- اذهب لـ **إجراء مكالمة**
- اختر جهة الاتصال
- اكتب **المهمة** (ماذا تريد من المساعد أن يفعل)
- اضغط **حساب التكلفة** لرؤية التقدير
- اضغط **بدء المكالمة**

### 4. متابعة المكالمة
- ستظهر المكالمة الجارية مع الحالة والمدة
- يمكنك **إنهاء المكالمة** يدوياً في أي وقت
- بعد الانتهاء، سترى الملخص في **سجل المكالمات**

## تقدير التكلفة

| البند | السعر التقريبي |
|-------|----------------|
| Twilio (موبايل عراقي) | ~$0.4633/دقيقة |
| Twilio Media Streams | ~$0.004/دقيقة |
| OpenAI Realtime | ~$0.10/دقيقة |
| **الإجمالي** | **~$0.57/دقيقة** |

> ⚠️ الأسعار تقديرية وقد تتغير. راجع Twilio و OpenAI للأسعار الحالية.

## الأمان

- ✅ كلمات المرور مشفرة (bcrypt في الإنتاج)
- ✅ جلسات آمنة مع httpOnly cookies
- ✅ التحقق من توقيع Twilio Webhooks
- ✅ Rate limiting للحماية من الهجمات
- ✅ Helmet لرؤوس HTTP الآمنة
- 🚫 لا مفاتيح في الكود أو الواجهة
- 🚫 لا تسجيل صوت
- 🚫 لا حفظ نص المكالمة الكامل

## هيكل المشروع

```
doqa-voice-assistant/
├── src/
│   ├── server.js              # الخادم الرئيسي
│   ├── routes/
│   │   ├── auth.js            # تسجيل الدخول/الخروج
│   │   ├── contacts.js        # إدارة جهات الاتصال
│   │   ├── calls.js           # إدارة المكالمات
│   │   ├── twilio.js          # Twilio Webhooks
│   │   └── audit.js           # سجل التدقيق
│   ├── services/
│   │   ├── twilioService.js   # خدمة Twilio
│   │   └── openaiRealtimeService.js  # OpenAI Realtime
│   ├── middleware/
│   │   ├── auth.js            # المصادقة
│   │   ├── twilioValidation.js # التحقق من Twilio
│   │   └── rateLimiter.js     # تحديد المعدل
│   └── utils/
│       ├── config.js          # الإعدادات
│       └── database.js        # قاعدة البيانات
├── public/
│   ├── index.html             # لوحة التحكم
│   ├── login.html             # صفحة الدخول
│   ├── css/styles.css         # التنسيقات
│   └── js/app.js              # JavaScript الواجهة
├── data/
│   └── db.json                # قاعدة البيانات
├── .env.example               # مثال متغيرات البيئة
├── package.json
└── README.md
```

## استكشاف الأخطاء

### المكالمة لا تصل
- تأكد من `PUBLIC_BASE_URL` صحيح ويستخدم HTTPS
- تأكد من إعداد Twilio Webhooks بشكل صحيح
- تأكد من أن الرقم يبدأ بـ +964

### WebSocket ينقطع
- تأكد من أن المنصة تدعم WebSocket
- تأكد من استخدام wss:// وليس ws://

### OpenAI لا يرد
- تأكد من صلاحية `OPENAI_API_KEY`
- تأكد من أن حسابك يدعم Realtime API

### خطأ في توقيع Twilio
- تأكد من `TWILIO_AUTH_TOKEN` صحيح
- تأكد من `PUBLIC_BASE_URL` مطابق لما في Twilio

## الترخيص

للاستخدام الشخصي.

---

**⚠️ تنبيه مهم:** لا تُجري اتصالات حقيقية إلا بعد:
1. تسجيل موافقة جهة الاتصال
2. تأكيدك للمكالمة
3. اختبار كامل في وضع Demo
