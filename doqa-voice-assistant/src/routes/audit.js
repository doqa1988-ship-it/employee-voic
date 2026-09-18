import { Router } from 'express';
import { requireApiAuth } from '../middleware/auth.js';
import { getAuditLog } from '../utils/database.js';

const router = Router();

// حماية جميع المسارات
router.use(requireApiAuth);

// سجل التدقيق
router.get('/', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const log = getAuditLog(limit);
  res.json(log);
});

export default router;
