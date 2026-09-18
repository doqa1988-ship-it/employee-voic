import 'dotenv/config';

export const config = {
  // الخادم
  port: parseInt(process.env.PORT || '3000', 10),
  publicBaseUrl: process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // المصادقة
  auth: {
    username: process.env.APP_USERNAME || 'doqa',
    password: process.env.APP_PASSWORD,
    sessionSecret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
  },
  
  // OpenAI
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    realtimeModel: process.env.OPENAI_REALTIME_MODEL || 'gpt-4o-realtime-preview',
    textModel: process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini',
    voice: process.env.OPENAI_VOICE || 'alloy',
  },
  
  // Twilio
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
    validateSignatures: process.env.TWILIO_VALIDATE_SIGNATURES === 'true',
  },
  
  // المكالمات
  calls: {
    maxMinutes: parseInt(process.env.MAX_CALL_MINUTES || '3', 10),
    allowedPrefixes: (process.env.ALLOWED_DESTINATION_PREFIXES || '+964').split(',').map(p => p.trim()),
    iraqMobileRateUsd: parseFloat(process.env.IRAQ_MOBILE_RATE_USD || '0.4633'),
  },
  
  // الوضع
  appMode: process.env.APP_MODE || 'demo',
  
  // التحقق من الإعدادات
  isLiveMode() {
    return this.appMode === 'live';
  },
  
  isDemoMode() {
    return this.appMode === 'demo';
  },
  
  validateForLive() {
    const errors = [];
    
    if (!this.auth.password || this.auth.password === 'PUT-A-LONG-RANDOM-PASSWORD-HERE') {
      errors.push('APP_PASSWORD غير مضبوط');
    }
    
    if (!this.openai.apiKey || this.openai.apiKey.startsWith('sk-your')) {
      errors.push('OPENAI_API_KEY غير مضبوط');
    }
    
    if (!this.twilio.accountSid || this.twilio.accountSid.startsWith('ACxxx')) {
      errors.push('TWILIO_ACCOUNT_SID غير مضبوط');
    }
    
    if (!this.twilio.authToken || this.twilio.authToken === 'your-twilio-auth-token') {
      errors.push('TWILIO_AUTH_TOKEN غير مضبوط');
    }
    
    if (!this.twilio.phoneNumber || this.twilio.phoneNumber === '+1234567890') {
      errors.push('TWILIO_PHONE_NUMBER غير مضبوط');
    }
    
    if (!this.publicBaseUrl || this.publicBaseUrl.includes('YOUR-DOMAIN')) {
      errors.push('PUBLIC_BASE_URL غير مضبوط');
    }
    
    return errors;
  }
};
