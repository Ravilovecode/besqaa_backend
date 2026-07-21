import { Router } from 'express';
import {
  register,
  verifyOtp,
  resendOtp,
  login,
  me,
  updateMe,
  uploadAvatar,
  updateBuyback,
  addAddress,
  deleteAddress,
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = Router();

router.post('/register', register);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/login', login);
router.get('/me', requireAuth, me);
router.put('/me', requireAuth, updateMe);
router.post('/me/avatar', requireAuth, upload.single('avatar'), uploadAvatar);
router.put('/me/buyback', requireAuth, updateBuyback);
router.post('/me/addresses', requireAuth, addAddress);
router.delete('/me/addresses/:addressId', requireAuth, deleteAddress);

export default router;
