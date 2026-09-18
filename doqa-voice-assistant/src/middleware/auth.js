import { config } from '../utils/config.js';
import bcrypt from 'bcryptjs';

// تخزين hash كلمة المرور في الذاكرة
let passwordHash = null;

async function getPasswordHash() {
  if (!passwordHash && config.auth.password) {
    passwordHash = await bcrypt.hash(config.auth.password, 12);
  }
  return passwordHash;
}

export async function verifyPassword(password) {
  if (!config.auth.password) {
    return false;
  }
  // في وضع التطوير، يمكن المقارنة المباشرة للسرعة
  if (config.nodeEnv === 'development') {
    return password === config.auth.password;
  }
  // في الإنتاج، استخدم bcrypt
  const hash = await getPasswordHash();
  return bcrypt.compare(password, hash);
}

export function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }
  
  // للـ API، أرجع 401
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'غير مصرح' });
  }
  
  // للصفحات، أعد التوجيه لصفحة الدخول
  return res.redirect('/login');
}

export function requireApiAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }
  return res.status(401).json({ error: 'غير مصرح' });
}
