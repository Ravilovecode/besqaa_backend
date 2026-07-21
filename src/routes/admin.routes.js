import { Router } from 'express';
import { adminLogin, adminMe } from '../controllers/adminAuthController.js';
import { adminListOrders, adminUpdateOrder } from '../controllers/orderController.js';
import { adminListQueries, adminUpdateQuery } from '../controllers/queryController.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

// Auth
router.post('/auth/login', adminLogin);
router.get('/auth/me', requireAdmin, adminMe);

// Orders management
router.get('/orders', requireAdmin, adminListOrders);
router.put('/orders/:id', requireAdmin, adminUpdateOrder);

// Besqaa Query management
router.get('/queries', requireAdmin, adminListQueries);
router.put('/queries/:id', requireAdmin, adminUpdateQuery);

export default router;
