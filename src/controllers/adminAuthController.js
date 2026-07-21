import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, unauthorized } from '../utils/ApiError.js';
import { signToken } from '../utils/token.js';
import Admin from '../models/Admin.js';

function publicAdmin(admin) {
  const obj = admin.toObject ? admin.toObject() : admin;
  delete obj.password;
  return obj;
}

// POST /api/admin/auth/login
export const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw badRequest('email and password are required');

  const admin = await Admin.findOne({ email: email.toLowerCase() }).select('+password');
  if (!admin) throw unauthorized('Invalid email or password');

  const ok = await admin.comparePassword(password);
  if (!ok) throw unauthorized('Invalid email or password');

  const token = signToken({ id: admin._id }, 'admin');
  res.json({ token, admin: publicAdmin(admin) });
});

// GET /api/admin/auth/me
export const adminMe = asyncHandler(async (req, res) => {
  res.json({ admin: req.admin });
});
