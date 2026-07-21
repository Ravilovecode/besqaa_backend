import { Router } from 'express';
import { createQuery, listMyQueries } from '../controllers/queryController.js';
import { requireAuth } from '../middleware/auth.js';
import { verifyToken } from '../utils/token.js';
import User from '../models/User.js';

// Optional auth: attaches req.user if a valid buyer token is present, but does
// not reject guests (the Besqaa Query form is open to everyone).
async function optionalAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    if (header.startsWith('Bearer ')) {
      const decoded = verifyToken(header.slice(7));
      if (decoded.role === 'user') {
        req.user = await User.findById(decoded.id).select('-password');
      }
    }
  } catch {
    // ignore invalid token for guest submissions
  }
  next();
}

const router = Router();

router.post('/', optionalAuth, createQuery);
router.get('/', requireAuth, listMyQueries);

export default router;
