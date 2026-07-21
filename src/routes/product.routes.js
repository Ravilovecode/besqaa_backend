import { Router } from 'express';
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/productController.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

// Public reads (the app browses products).
router.get('/', listProducts);
router.get('/:id', getProduct);

// Admin writes.
router.post('/', requireAdmin, createProduct);
router.put('/:id', requireAdmin, updateProduct);
router.delete('/:id', requireAdmin, deleteProduct);

export default router;
