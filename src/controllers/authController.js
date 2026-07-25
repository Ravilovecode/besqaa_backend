import crypto from 'crypto';
import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, unauthorized, notFound } from '../utils/ApiError.js';
import { signToken } from '../utils/token.js';
import { uploadBufferToS3 } from '../services/s3.js';
import { sendMail, otpEmail } from '../services/mailer.js';
import { sendSms, otpSms } from '../services/sms.js';
import User, { MAX_BUYBACKS } from '../models/User.js';
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

// Generates + stores fresh OTPs on the user, then dispatches them via
// email (SES/SMTP) and SMS (SNS). Unconfigured providers log to the console;
// a failed send never blocks the flow — the user can hit resend.
async function issueOtps(user) {
  // Email is optional — only issue an email OTP when the account has one.
  const emailOtp = user.email ? String(crypto.randomInt(100000, 1000000)) : undefined;
  const phoneOtp = String(crypto.randomInt(100000, 1000000));
  user.emailOtp = emailOtp;
  user.phoneOtp = phoneOtp;
  user.otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
  user.otpGeneratedAt = new Date();
  await user.save();

  const dispatches = [];
  if (user.email) dispatches.push(['email', sendMail(otpEmail(user, emailOtp))]);
  if (user.phone) dispatches.push(['SMS', sendSms(user.phone, otpSms(phoneOtp))]);
  const results = await Promise.allSettled(dispatches.map(([, p]) => p));
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`OTP ${dispatches[i][0]} send failed for ${user.email || user.phone}:`, r.reason?.message || r.reason);
    }
  });

  if (env.nodeEnv !== 'production') {
    console.log(`📩 OTP for ${user.email || '(no email)'}: ${emailOtp || '—'} | 📱 OTP for ${user.phone}: ${phoneOtp}`);
  }
  return { emailOtp, phoneOtp };
}

// Outside production, echo OTPs in the response so the flow is testable
// without an email/SMS provider.
function devOtpPayload(otps) {
  return env.nodeEnv !== 'production' ? { devOtps: { email: otps.emailOtp, phone: otps.phoneOtp } } : {};
}

// POST /api/auth/register  (buyer / "candidate")
// Requires name, phone and password; email is optional. The account must then
// be verified via OTP (phone, or email when provided).
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !password || !phone) {
    throw badRequest('name, phone and password are required');
  }
  if (password.length < 6) throw badRequest('Password must be at least 6 characters');
  if (!/^\+?\d{10,14}$/.test(phone.replace(/[\s-]/g, ''))) {
    throw badRequest('Please enter a valid phone number');
  }

  const cleanEmail = email?.trim() ? email.trim().toLowerCase() : undefined;
  if (cleanEmail && !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
    throw badRequest('Please enter a valid email address');
  }
  if (cleanEmail) {
    const exists = await User.findOne({ email: cleanEmail });
    if (exists) throw badRequest('An account with this email already exists');
  }
  // Phone is the fallback login identifier, so it must be unique too.
  const phoneExists = await User.findOne({ phone });
  if (phoneExists) throw badRequest('An account with this phone number already exists');

  const user = await User.create({ name, ...(cleanEmail && { email: cleanEmail }), password, phone });
  const otps = await issueOtps(user);

  res.status(201).json({
    requiresVerification: true,
    pendingId: user._id,
    email: user.email || '',
    phone: user.phone,
    message: user.email
      ? 'Enter the OTP sent to your email or phone — either one verifies your account.'
      : 'Enter the OTP sent to your phone to verify your account.',
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
  res.json({
    message: user.email ? 'New OTPs sent to your email and phone' : 'New OTP sent to your phone',
    ...devOtpPayload(otps),
  });
});

// POST /api/auth/login
// `email` accepts an email address OR a phone number (accounts can be
// phone-only since email became optional at signup).
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw badRequest('email/phone and password are required');

  const identifier = String(email).trim();
  const digits = identifier.replace(/[\s-]/g, '');
  let user;
  if (/^\+?\d{10,14}$/.test(digits)) {
    // Phone login — match the stored format (+91XXXXXXXXXX) plus raw variants.
    const last10 = digits.replace(/^\+?91/, '').slice(-10);
    user = await User.findOne({
      phone: { $in: [digits, `+${digits}`, `+91${last10}`, last10] },
    }).select('+password');
  } else {
    user = await User.findOne({ email: identifier.toLowerCase() }).select('+password');
  }
  if (!user) throw unauthorized('Invalid email/phone or password');

  const ok = await user.comparePassword(password);
  if (!ok) throw unauthorized('Invalid email/phone or password');

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
        email: user.email || '',
        phone: user.phone,
        message: user.email
          ? 'Please verify your account — enter the OTP sent to your email or phone.'
          : 'Please verify your account — enter the OTP sent to your phone.',
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

// PUT /api/auth/me/buyback   { buybacks: [{ date, amount }, …] }  (max 15)
// Legacy single-entry payload { date, amount } is still accepted.
export const updateBuyback = asyncHandler(async (req, res) => {
  let entries = req.body.buybacks;
  if (!Array.isArray(entries)) {
    const { date, amount } = req.body;
    if (!date || amount == null) throw badRequest('Buyback date and amount are required');
    entries = [{ date, amount }];
  }
  if (entries.length === 0) throw badRequest('Add at least one buyback');
  if (entries.length > MAX_BUYBACKS) throw badRequest(`You can save up to ${MAX_BUYBACKS} buybacks`);

  const clean = entries
    .map((e, i) => {
      const parsed = new Date(e?.date);
      if (Number.isNaN(parsed.getTime())) throw badRequest(`Buyback #${i + 1}: invalid date`);
      const amt = Number(e?.amount);
      if (!amt || amt <= 0) throw badRequest(`Buyback #${i + 1}: amount must be greater than 0`);
      return { date: parsed, amount: amt };
    })
    .sort((a, b) => a.date - b.date);

  // Legacy mirror fields = next upcoming entry (or the latest one if all past).
  const now = new Date();
  const next = clean.find((e) => e.date >= now) || clean[clean.length - 1];

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { buybacks: clean, buybackDate: next.date, buybackAmount: next.amount },
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
