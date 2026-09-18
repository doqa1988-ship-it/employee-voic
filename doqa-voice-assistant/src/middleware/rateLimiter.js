import rateLimit from 'express-rate-limit';

// حماية من تكرار محاولات تسجيل الدخول
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 5, // 5 محاولات
  message: { error: 'محاولات تسجيل دخول كثيرة. حاول بعد 15 دقيقة.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// حماية من تكرار طلبات الاتصال
export const callLimiter = rateLimit({
  windowMs: 60 * 1000, // دقيقة واحدة
  max: 3, // 3 طلبات
  message: { error: 'طلبات اتصال كثيرة. انتظر قليلاً.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// حماية عامة للـ API
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // دقيقة
  max: 60, // 60 طلب
  message: { error: 'طلبات كثيرة. حاول لاحقاً.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// حماية من النقر المزدوج (تتبع الطلبات الجارية)
const pendingRequests = new Map();

export function preventDoubleClick(keyGenerator) {
  return (req, res, next) => {
    const key = keyGenerator(req);
    
    if (pendingRequests.has(key)) {
      return res.status(429).json({ 
        error: 'طلب قيد المعالجة. انتظر حتى ينتهي.' 
      });
    }
    
    pendingRequests.set(key, Date.now());
    
    // تنظيف عند انتهاء الطلب
    res.on('finish', () => {
      pendingRequests.delete(key);
    });
    
    // تنظيف تلقائي بعد 30 ثانية
    setTimeout(() => {
      pendingRequests.delete(key);
    }, 30000);
    
    next();
  };
}
