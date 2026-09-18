import { Router } from 'express';
import { config } from '../utils/config.js';
import { verifyPassword } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rateLimiter.js';
import { addAuditEntry } from '../utils/database.js';

const router = Router();

// تسجيل الدخول
router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبان' });
  }
  
  if (username !== config.auth.username) {
    addAuditEntry({
      action: 'login_failed',
      targetType: 'auth',
      details: { username, reason: 'اسم مستخدم خاطئ' },
      ip: req.ip,
    });
    return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
  }
  
  const isValid = await verifyPassword(password);
  if (!isValid) {
    addAuditEntry({
      action: 'login_failed',
      targetType: 'auth',
      details: { username, reason: 'كلمة مرور خاطئة' },
      ip: req.ip,
    });
    return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
  }
  
  // تسجيل الدخول بنجاح
  req.session.authenticated = true;
  req.session.username = username;
  req.session.loginTime = new Date().toISOString();
  
  addAuditEntry({
    user: username,
    action: 'login_success',
    targetType: 'auth',
    ip: req.ip,
  });
  
  res.json({ 
    success: true, 
    message: 'تم تسجيل الدخول بنجاح',
    user: { username },
  });
});

// تسجيل الخروج
router.post('/logout', (req, res) => {
  const username = req.session?.username;
  
  if (username) {
    addAuditEntry({
      user: username,
      action: 'logout',
      targetType: 'auth',
      ip: req.ip,
    });
  }
  
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'فشل تسجيل الخروج' });
    }
    res.json({ success: true, message: 'تم تسجيل الخروج' });
  });
});

// التحقق من حالة المصادقة
router.get('/status', (req, res) => {
  if (req.session?.authenticated) {
    return res.json({
      authenticated: true,
      user: { username: req.session.username },
      loginTime: req.session.loginTime,
    });
  }
  res.json({ authenticated: false });
});

export default router;
