import { Router } from 'express';
import { uploadImages, uploadPaymentProof } from '../controllers/uploadController.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = Router();

// Buyers upload their online-payment screenshot here.
router.post('/payment-proof', requireAuth, upload.single('proof'), uploadPaymentProof);

// Accept either a single "image" field or multiple "images" fields.
router.post(
  '/',
  requireAdmin,
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'images', maxCount: 8 },
  ]),
  (req, res, next) => {
    // Flatten multer's field map into req.files for the controller.
    const image = req.files?.image || [];
    const images = req.files?.images || [];
    req.files = [...image, ...images];
    next();
  },
  uploadImages
);

export default router;
