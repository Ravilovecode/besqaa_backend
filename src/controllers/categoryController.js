import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, notFound } from '../utils/ApiError.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';

// GET /api/categories        (public — used by the app)
// Admins pass ?all=true to include inactive categories.
export const listCategories = asyncHandler(async (req, res) => {
  const filter = req.query.all === 'true' ? {} : { isActive: true };
  const categories = await Category.find(filter).sort({ name: 1 }).lean();

  // Attach a live product count for each category (handy for the admin panel).
  const counts = await Product.aggregate([
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));

  res.json({
    categories: categories.map((c) => ({ ...c, productCount: countMap[String(c._id)] || 0 })),
  });
});

// GET /api/categories/:id
export const getCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw notFound('Category not found');
  res.json({ category });
});

// POST /api/categories       (admin)
export const createCategory = asyncHandler(async (req, res) => {
  const { name, description, imageUrl, isActive } = req.body;
  if (!name) throw badRequest('Category name is required');
  const category = await Category.create({ name, description, imageUrl, isActive });
  res.status(201).json({ category });
});

// PUT /api/categories/:id     (admin)
export const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw notFound('Category not found');

  const fields = ['name', 'description', 'imageUrl', 'isActive'];
  for (const f of fields) if (f in req.body) category[f] = req.body[f];
  await category.save();
  res.json({ category });
});

// DELETE /api/categories/:id  (admin) — blocked if products still reference it.
export const deleteCategory = asyncHandler(async (req, res) => {
  const count = await Product.countDocuments({ category: req.params.id });
  if (count > 0) {
    throw badRequest(
      `Cannot delete: ${count} product(s) still in this category. Move or delete them first.`
    );
  }
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) throw notFound('Category not found');
  res.json({ message: 'Category deleted' });
});
