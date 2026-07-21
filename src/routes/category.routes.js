import { Router } from 'express';
import {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/categoryController.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

// Public reads (the app lists categories).
router.get('/', listCategories);
router.get('/:id', getCategory);

// Admin writes.
router.post('/', requireAdmin, createCategory);
router.put('/:id', requireAdmin, updateCategory);
router.delete('/:id', requireAdmin, deleteCategory);

export default router;
