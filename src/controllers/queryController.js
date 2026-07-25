import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, notFound } from '../utils/ApiError.js';
import Query from '../models/Query.js';

// POST /api/queries   — the "Besqaa Query" form. Works logged-in or as a guest.
export const createQuery = asyncHandler(async (req, res) => {
  const { name, email, phone, category, subject, message, budget, quantity } = req.body;
  if (!subject || !message) throw badRequest('subject and message are required');

  // If authenticated, backfill name/email/phone from the account.
  const doc = {
    user: req.user?._id,
    name: name || req.user?.name,
    email: email || req.user?.email,
    phone: phone || req.user?.phone,
    category: category || undefined,
    subject,
    message,
    budget: budget || 0,
    quantity: quantity || 1,
  };
  // Email is optional on accounts now — any contact channel is enough.
  if (!doc.name || (!doc.email && !doc.phone)) {
    throw badRequest('name and an email or phone number are required');
  }

  const query = await Query.create(doc);
  res.status(201).json({ query });
});

// GET /api/queries    (buyer's own submitted queries)
export const listMyQueries = asyncHandler(async (req, res) => {
  const queries = await Query.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json({ queries });
});

// ---------- Admin ----------

// GET /api/admin/queries?status=
export const adminListQueries = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const queries = await Query.find(filter)
    .populate('category', 'name')
    .populate('user', 'name email')
    .sort({ createdAt: -1 });
  res.json({ queries });
});

// PUT /api/admin/queries/:id   { status, adminNote }
export const adminUpdateQuery = asyncHandler(async (req, res) => {
  const query = await Query.findById(req.params.id);
  if (!query) throw notFound('Query not found');
  if (req.body.status) query.status = req.body.status;
  if ('adminNote' in req.body) query.adminNote = req.body.adminNote;
  await query.save();
  res.json({ query });
});
