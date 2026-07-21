import crypto from 'crypto';
import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, unauthorized, notFound } from '../utils/ApiError.js';
import { signToken } from '../utils/token.js';
import { uploadBufferToS3 } from '../services/s3.js';
import User from '../models/User.js';
import env from '../config/env.js';

function publicUser(user) {
  const obj = user.toObject ? user.toObject() : user;
  delete obj.password;
  delete obj.emailOtp;
  delete obj.phoneOtp;
  delete obj.otpExpiresAt;
  return obj;
}

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Generates + stores fresh OTPs on the user. Returns the plain codes so they
// can be dispatched. TODO: send via email (SES) / SMS (MSG91, Twilio) here.
async function issueOtps(user) {
  const emailOtp = String(crypto.randomInt(100000, 1000000));
  const phoneOtp = String(crypto.randomInt(100000, 1000000));
  user.emailOtp = emailOtp;
  user.phoneOtp = phoneOtp;
  user.otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
  user.otpGeneratedAt = new Date();
  await user.save();

  // No provider wired yet — log so devs can complete the flow.
  console.log(`📩 OTP for ${user.email}: ${emailOtp} | 📱 OTP for ${user.phone}: ${phoneOtp}`);
  return { emailOtp, phoneOtp };
}

// Outside production, echo OTPs in the response so the flow is testable
// without an email/SMS provider.
function devOtpPayload(otps) {
  return env.nodeEnv !== 'production' ? { devOtps: { email: otps.emailOtp, phone: otps.phoneOtp } } : {};
}

// POST /api/auth/register  (buyer / "candidate")
// Requires BOTH email and phone; account must then be verified via either OTP.
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password || !phone) {
    throw badRequest('name, email, phone and password are required');
  }
  if (password.length < 6) throw badRequest('Password must be at least 6 characters');
  if (!/^\+?\d{10,14}$/.test(phone.replace(/[\s-]/g, ''))) {
    throw badRequest('Please enter a valid phone number');
  }

  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) throw badRequest('An account with this email already exists');

  const user = await User.create({ name, email, password, phone });
  const otps = await issueOtps(user);

  res.status(201).json({
    requiresVerification: true,
    pendingId: user._id,
    email: user.email,
    phone: user.phone,
    message: 'Enter the OTP sent to your email or phone — either one verifies your account.',
    ...devOtpPayload(otps),
  });
});

// POST /api/auth/verify-otp   { pendingId, emailOtp?, phoneOtp? }
// EITHER code verifies the account and issues the auth token.
export const verifyOtp = asyncHandler(async (req, res) => {
  const { pendingId, emailOtp, phoneOtp } = req.body;
  if (!pendingId) throw badRequest('pendingId is required');
  if (!emailOtp && !phoneOtp) throw badRequest('Enter the OTP from your email or phone');

  const user = await User.findById(pendingId).select('+emailOtp +phoneOtp +otpExpiresAt');
  if (!user) throw notFound('Account not found');

  if (!user.otpExpiresAt || user.otpExpiresAt < new Date()) {
    throw badRequest('OTP expired — request a new one');
  }

  const emailMatch = emailOtp && user.emailOtp && emailOtp.trim() === user.emailOtp;
  const phoneMatch = phoneOtp && user.phoneOtp && phoneOtp.trim() === user.phoneOtp;
  if (!emailMatch && !phoneMatch) throw badRequest('Incorrect OTP — check and try again');

  if (emailMatch) user.emailVerified = true;
  if (phoneMatch) user.phoneVerified = true;
  user.emailOtp = undefined;
  user.phoneOtp = undefined;
  user.otpExpiresAt = undefined;
  await user.save();

  const token = signToken({ id: user._id }, 'user');
  res.json({ token, user: publicUser(user) });
});

// POST /api/auth/resend-otp   { pendingId }
export const resendOtp = asyncHandler(async (req, res) => {
  const { pendingId } = req.body;
  if (!pendingId) throw badRequest('pendingId is required');
  const user = await User.findById(pendingId);
  if (!user) throw notFound('Account not found');
  const otps = await issueOtps(user);
  res.json({ message: 'New OTPs sent to your email and phone', ...devOtpPayload(otps) });
});

// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw badRequest('email and password are required');

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user) throw unauthorized('Invalid email or password');

  const ok = await user.comparePassword(password);
  if (!ok) throw unauthorized('Invalid email or password');

  if (!user.emailVerified && !user.phoneVerified) {
    if (!user.otpGeneratedAt) {
      // Legacy account created before OTP verification existed — grandfather in.
      user.emailVerified = true;
      await user.save();
    } else {
      const otps = await issueOtps(user);
      return res.status(403).json({
        requiresVerification: true,
        pendingId: user._id,
        email: user.email,
        phone: user.phone,
        message: 'Please verify your account — enter the OTP sent to your email or phone.',
        ...devOtpPayload(otps),
      });
    }
  }

  const token = signToken({ id: user._id }, 'user');
  res.json({ token, user: publicUser(user) });
});

// POST /api/auth/me/avatar   (multipart, field "avatar") — buyer profile photo → S3
export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw badRequest('No image provided');
  const { url } = await uploadBufferToS3(req.file, 'avatars');
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { avatarUrl: url },
    { new: true }
  );
  res.json({ user: publicUser(user) });
});

// PUT /api/auth/me/buyback   { date, amount }
export const updateBuyback = asyncHandler(async (req, res) => {
  const { date, amount } = req.body;
  if (!date || amount == null) throw badRequest('Buyback date and amount are required');

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) throw badRequest('Invalid buyback date');
  if (Number(amount) <= 0) throw badRequest('Buyback amount must be greater than 0');

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { buybackDate: parsed, buybackAmount: Number(amount) },
    { new: true, runValidators: true }
  );
  res.json({ user: publicUser(user) });
});

// GET /api/auth/me
export const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

// PUT /api/auth/me
export const updateMe = asyncHandler(async (req, res) => {
  const allowed = ['name', 'phone', 'gstNumber', 'avatarUrl'];
  const updates = {};
  for (const key of allowed) if (key in req.body) updates[key] = req.body[key];

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  });
  if (!user) throw notFound('User not found');
  res.json({ user });
});

// ---- Addresses ----

// POST /api/auth/me/addresses
export const addAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (req.body.isDefault) user.addresses.forEach((a) => (a.isDefault = false));
  user.addresses.push(req.body);
  await user.save();
  res.status(201).json({ addresses: user.addresses });
});

// DELETE /api/auth/me/addresses/:addressId
export const deleteAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  user.addresses = user.addresses.filter((a) => String(a._id) !== req.params.addressId);
  await user.save();
  res.json({ addresses: user.addresses });
});
