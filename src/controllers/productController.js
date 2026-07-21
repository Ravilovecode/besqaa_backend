import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, notFound } from '../utils/ApiError.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';

// Normalise specs coming from the admin form (may arrive as a JSON string).
function parseSpecs(specs) {
  if (!specs) return undefined;
  if (typeof specs === 'string') {
    try {
      specs = JSON.parse(specs);
    } catch {
      throw badRequest('specs must be valid JSON');
    }
  }
  if (!Array.isArray(specs)) throw badRequest('specs must be an array');
  return specs.filter((s) => s && s.label && s.value);
}

// GET /api/products    (public — used by the app)
// Filters: ?category=<id|slug>&search=&deal=true&recommended=true&page=&limit=&sort=
export const listProducts = asyncHandler(async (req, res) => {
  const {
    category,
    search,
    deal,
    recommended,
    sort = '-createdAt',
    page = 1,
    limit = 20,
    all,
  } = req.query;

  const filter = {};
  if (all !== 'true') filter.isActive = true;

  if (category) {
    // Accept either an ObjectId or a category slug.
    if (/^[0-9a-fA-F]{24}$/.test(category)) {
      filter.category = category;
    } else {
      const cat = await Category.findOne({ slug: category });
      filter.category = cat ? cat._id : null;
    }
  }
  if (deal === 'true') filter.isDeal = true;
  if (recommended === 'true') filter.isRecommended = true;
  if (search) filter.$text = { $search: search };

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const [items, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'name slug')
      .sort(sort)
      .skip((pageNum - 1) * perPage)
      .limit(perPage),
    Product.countDocuments(filter),
  ]);

  res.json({
    products: items,
    pagination: { page: pageNum, limit: perPage, total, pages: Math.ceil(total / perPage) },
  });
});

// GET /api/products/:id
export const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate('category', 'name slug');
  if (!product) throw notFound('Product not found');
  res.json({ product });
});

// POST /api/products    (admin) — list a product into an existing category.
export const createProduct = asyncHandler(async (req, res) => {
  const body = { ...req.body };

  if (!body.name) throw badRequest('Product name is required');
  if (!body.category) throw badRequest('A category is required to list a product');
  if (body.price == null) throw badRequest('Price is required');

  const category = await Category.findById(body.category);
  if (!category) throw badRequest('Selected category does not exist');

  if (body.specs) body.specs = parseSpecs(body.specs);
  if (typeof body.images === 'string') body.images = [body.images];

  const product = await Product.create(body);
  await product.populate('category', 'name slug');
  res.status(201).json({ product });
});

// PUT /api/products/:id  (admin)
export const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw notFound('Product not found');

  const body = { ...req.body };
  if (body.category) {
    const category = await Category.findById(body.category);
    if (!category) throw badRequest('Selected category does not exist');
  }
  if (body.specs) body.specs = parseSpecs(body.specs);
  if (typeof body.images === 'string') body.images = [body.images];

  const editable = [
    'name', 'description', 'category', 'price', 'compareAtPrice', 'images', 'stock',
    'unit', 'brand', 'rating', 'reviewCount', 'specs', 'shipsInDays', 'isDeal',
    'isRecommended', 'isActive',
  ];
  for (const f of editable) if (f in body) product[f] = body[f];

  await product.save();
  await product.populate('category', 'name slug');
  res.json({ product });
});

// DELETE /api/products/:id  (admin)
export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) throw notFound('Product not found');
  res.json({ message: 'Product deleted' });
});
