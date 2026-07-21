import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, notFound } from '../utils/ApiError.js';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';

async function getOrCreateCart(userId) {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) cart = await Cart.create({ user: userId, items: [] });
  return cart;
}

// Populate + compute totals so the app can render the cart summary directly.
async function serializeCart(cart) {
  await cart.populate('items.product');
  // Drop items whose product was deleted from the catalog.
  const items = cart.items.filter((i) => i.product);
  const summary = items.reduce(
    (acc, i) => {
      acc.subtotal += i.product.price * i.quantity;
      acc.count += i.quantity;
      return acc;
    },
    { subtotal: 0, count: 0 }
  );
  const gst = Math.round(summary.subtotal * 0.18);
  const deliveryFee = summary.subtotal > 0 ? 1200 : 0;
  return {
    items: items.map((i) => ({ product: i.product, quantity: i.quantity })),
    summary: {
      ...summary,
      gst,
      deliveryFee,
      total: summary.subtotal + gst + deliveryFee,
    },
  };
}

// GET /api/cart
export const getCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  res.json(await serializeCart(cart));
});

// POST /api/cart/items   { productId, quantity }
export const addItem = asyncHandler(async (req, res) => {
  const { productId, quantity = 1 } = req.body;
  if (!productId) throw badRequest('productId is required');
  const product = await Product.findById(productId);
  if (!product) throw notFound('Product not found');

  const cart = await getOrCreateCart(req.user._id);
  const existing = cart.items.find((i) => String(i.product) === String(productId));
  if (existing) existing.quantity += Number(quantity);
  else cart.items.push({ product: productId, quantity: Number(quantity) });
  await cart.save();
  res.json(await serializeCart(cart));
});

// PUT /api/cart/items/:productId   { quantity }  (absolute set; <=0 removes)
export const updateItem = asyncHandler(async (req, res) => {
  const { quantity } = req.body;
  const cart = await getOrCreateCart(req.user._id);
  const item = cart.items.find((i) => String(i.product) === String(req.params.productId));
  if (!item) throw notFound('Item not in cart');

  if (Number(quantity) <= 0) {
    cart.items = cart.items.filter((i) => String(i.product) !== String(req.params.productId));
  } else {
    item.quantity = Number(quantity);
  }
  await cart.save();
  res.json(await serializeCart(cart));
});

// DELETE /api/cart/items/:productId
export const removeItem = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  cart.items = cart.items.filter((i) => String(i.product) !== String(req.params.productId));
  await cart.save();
  res.json(await serializeCart(cart));
});

// DELETE /api/cart
export const clearCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  cart.items = [];
  await cart.save();
  res.json(await serializeCart(cart));
});
