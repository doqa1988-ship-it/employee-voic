import twilio from 'twilio';
import { config } from '../utils/config.js';

export function validateTwilioRequest(req, res, next) {
  // تخطي التحقق إذا كان معطلاً
  if (!config.twilio.validateSignatures) {
    return next();
  }
  
  // تخطي التحقق في وضع demo
  if (config.isDemoMode()) {
    return next();
  }
  
  const signature = req.headers['x-twilio-signature'];
  const url = config.publicBaseUrl + req.originalUrl;
  const params = req.body || {};
  
  if (!signature) {
    console.error('[Twilio] طلب بدون توقيع');
    return res.status(403).send('Forbidden: Missing signature');
  }
  
  const isValid = twilio.validateRequest(
    config.twilio.authToken,
    signature,
    url,
    params
  );
  
  if (!isValid) {
    console.error('[Twilio] توقيع غير صالح:', { url, signature });
    return res.status(403).send('Forbidden: Invalid signature');
  }
  
  next();
}
