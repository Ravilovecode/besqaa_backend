import { Router } from 'express';
import {
  createOrder,
  listMyOrders,
  getOrder,
} from '../controllers/orderController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.post('/', createOrder);
router.get('/', listMyOrders);
router.get('/:id', getOrder);

export default router;
