import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, notFound, forbidden } from '../utils/ApiError.js';
import { customAlphabet } from 'nanoid';
import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import { sendMail, orderConfirmedEmail } from '../services/mailer.js';

const orderId = customAlphabet('0123456789', 5);

// POST /api/orders   { shippingAddress, paymentMethod, paymentProofUrl }
// Builds the order from the user's current cart, then clears the cart.
// Online payments must attach a payment screenshot; COD skips it.
export const createOrder = asyncHandler(async (req, res) => {
  const { shippingAddress, paymentMethod = 'cod', paymentProofUrl = '' } = req.body;

  if (paymentMethod === 'online' && !paymentProofUrl) {
    throw badRequest('Please upload your payment screenshot to place an online-paid order');
  }

  const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
  const items = (cart?.items || []).filter((i) => i.product);
  if (!items.length) throw badRequest('Your cart is empty');

  const orderItems = items.map((i) => ({
    product: i.product._id,
    name: i.product.name,
    image: i.product.images?.[0] || '',
    price: i.product.price,
    quantity: i.quantity,
  }));

  const subtotal = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const gst = Math.round(subtotal * 0.18);
  const deliveryFee = 1200;
  const total = subtotal + gst + deliveryFee;

  // Estimate delivery 3 days out.
  const estimatedDelivery = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  const order = await Order.create({
    orderNumber: `BSQ-${orderId()}`,
    user: req.user._id,
    items: orderItems,
    subtotal,
    gst,
    deliveryFee,
    total,
    shippingAddress,
    paymentMethod,
    paymentProofUrl,
    estimatedDelivery,
  });

  // Decrement stock where tracked.
  await Promise.all(
    orderItems.map((i) =>
      Product.updateOne({ _id: i.product, stock: { $gt: 0 } }, { $inc: { stock: -i.quantity } })
    )
  );

  cart.items = [];
  await cart.save();

  res.status(201).json({ order });
});

// GET /api/orders           (buyer's own orders)
export const listMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json({ orders });
});

// GET /api/orders/:id       (buyer — own order only)
export const getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw notFound('Order not found');
  if (String(order.user) !== String(req.user._id)) throw forbidden();
  res.json({ order });
});

// ---------- Admin ----------

// GET /api/admin/orders?status=
export const adminListOrders = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const orders = await Order.find(filter)
    .populate('user', 'name email')
    .sort({ createdAt: -1 });
  res.json({ orders });
});

// PUT /api/admin/orders/:id   { status, paymentStatus }
// Marking an order "confirmed" (after verifying payment) emails the buyer once.
export const adminUpdateOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email');
  if (!order) throw notFound('Order not found');
  if (req.body.status) order.status = req.body.status;
  if (req.body.paymentStatus) order.paymentStatus = req.body.paymentStatus;

  const shouldEmail =
    order.status === 'confirmed' && !order.confirmationEmailSentAt && order.user?.email;

  if (shouldEmail) order.confirmationEmailSentAt = new Date();
  await order.save();

  if (shouldEmail) {
    // Fire-and-forget — an email hiccup must not fail the admin action.
    sendMail(orderConfirmedEmail(order, order.user)).catch((err) =>
      console.error('order-confirmed email failed:', err.message)
    );
  }

  res.json({ order });
});
