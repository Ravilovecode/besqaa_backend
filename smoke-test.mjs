/**
 * End-to-end smoke test against an in-memory MongoDB.
 * Exercises the whole pipeline: admin login → category → product →
 * user register → browse → cart → order → besqaa query.
 *
 *   node smoke-test.mjs
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

const mongod = await MongoMemoryServer.create();
process.env.MONGO_URI = mongod.getUri('besqaa_test');
process.env.JWT_SECRET = 'test_secret';
process.env.NODE_ENV = 'test';
process.env.PORT = '5099';
process.env.SEED_ADMIN_EMAIL = 'admin@besqaa.in';
process.env.SEED_ADMIN_PASSWORD = 'Admin@12345';

const { connectDB } = await import('./src/config/db.js');
const app = (await import('./src/app.js')).default;
const Admin = (await import('./src/models/Admin.js')).default;

await connectDB();

const server = app.listen(5099);
const base = 'http://localhost:5099/api';

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) {
    pass += 1;
    console.log(`  ✅ ${name}`);
  } else {
    fail += 1;
    console.log(`  ❌ ${name}`);
  }
}

async function j(method, path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

try {
  console.log('\n▶ Health');
  const health = await j('GET', '/health');
  check('health returns ok', health.data.status === 'ok');

  console.log('\n▶ Admin auth');
  await Admin.create({ name: 'Admin', email: 'admin@besqaa.in', password: 'Admin@12345' });
  const adminLogin = await j('POST', '/admin/auth/login', {
    body: { email: 'admin@besqaa.in', password: 'Admin@12345' },
  });
  check('admin login returns token', !!adminLogin.data.token);
  const adminToken = adminLogin.data.token;

  console.log('\n▶ Category (admin creates → app reads)');
  const cat = await j('POST', '/categories', {
    token: adminToken,
    body: { name: 'Televisions', description: 'Smart TVs' },
  });
  check('category created', cat.status === 201 && cat.data.category.slug === 'televisions');
  const catId = cat.data.category._id;

  const catList = await j('GET', '/categories');
  check('category visible publicly', catList.data.categories.some((c) => c._id === catId));

  console.log('\n▶ Product (admin lists → auto-shows in app)');
  const prod = await j('POST', '/products', {
    token: adminToken,
    body: {
      name: '55" 4K Smart TV',
      category: catId,
      price: 54990,
      compareAtPrice: 66990,
      stock: 10,
      isDeal: true,
      isRecommended: true,
      specs: [{ label: 'Display', value: '55" UHD 4K' }],
    },
  });
  check('product created', prod.status === 201);
  check('discountPercent computed', prod.data.product.discountPercent === 18);
  const prodId = prod.data.product._id;

  const publicProducts = await j('GET', '/products?deal=true');
  check('product shows in app deals', publicProducts.data.products.some((p) => p._id === prodId));

  console.log('\n▶ Product creation blocked without admin token');
  const noAuth = await j('POST', '/products', {
    body: { name: 'x', category: catId, price: 1 },
  });
  check('unauthenticated product create rejected', noAuth.status === 401 || noAuth.status === 403);

  console.log('\n▶ Buyer register (email + phone) + OTP verify (either code works)');
  const reg = await j('POST', '/auth/register', {
    body: {
      name: 'Ravi Sharma',
      email: 'ravi@anandtraders.in',
      phone: '+919876543210',
      password: 'secret123',
    },
  });
  check('register returns pending verification', reg.status === 201 && reg.data.requiresVerification);
  check('dev OTPs returned outside production', !!reg.data.devOtps?.phone);

  const badOtp = await j('POST', '/auth/verify-otp', {
    body: { pendingId: reg.data.pendingId, emailOtp: '000000' },
  });
  check('wrong OTP rejected', badOtp.status === 400);

  // Verify with ONLY the phone OTP — either channel must be enough.
  const verify = await j('POST', '/auth/verify-otp', {
    body: { pendingId: reg.data.pendingId, phoneOtp: reg.data.devOtps.phone },
  });
  check('phone OTP alone verifies + returns token', !!verify.data.token);
  check('phoneVerified set, emailVerified not', verify.data.user.phoneVerified === true && verify.data.user.emailVerified === false);
  const userToken = verify.data.token;

  console.log('\n▶ Buyback');
  const buyback = await j('PUT', '/auth/me/buyback', {
    token: userToken,
    body: { date: '2026-08-15', amount: 25000 },
  });
  check('buyback saved', buyback.data.user?.buybackAmount === 25000);

  console.log('\n▶ Cart + order');

  const addCart = await j('POST', '/cart/items', {
    token: userToken,
    body: { productId: prodId, quantity: 2 },
  });
  check('item added to cart', addCart.data.summary.count === 2);
  check('cart subtotal correct', addCart.data.summary.subtotal === 54990 * 2);
  check('cart GST is 18%', addCart.data.summary.gst === Math.round(54990 * 2 * 0.18));

  const order = await j('POST', '/orders', {
    token: userToken,
    body: {
      shippingAddress: { line1: '12 MG Road', city: 'Pune', state: 'MH', pincode: '411001' },
      paymentMethod: 'cod',
    },
  });
  check('order placed', order.status === 201 && order.data.order.orderNumber?.startsWith('BSQ-'));

  const myOrders = await j('GET', '/orders', { token: userToken });
  check('order appears in my orders', myOrders.data.orders.length === 1);

  const emptyCart = await j('GET', '/cart', { token: userToken });
  check('cart cleared after order', emptyCart.data.summary.count === 0);

  console.log('\n▶ Online payment flow (screenshot required, admin verifies → email)');
  await j('POST', '/cart/items', { token: userToken, body: { productId: prodId, quantity: 1 } });
  const noProof = await j('POST', '/orders', {
    token: userToken,
    body: {
      shippingAddress: { line1: '12 MG Road', city: 'Pune', state: 'MH', pincode: '411001' },
      paymentMethod: 'online',
    },
  });
  check('online order without screenshot rejected', noProof.status === 400);

  const withProof = await j('POST', '/orders', {
    token: userToken,
    body: {
      shippingAddress: { line1: '12 MG Road', city: 'Pune', state: 'MH', pincode: '411001' },
      paymentMethod: 'online',
      paymentProofUrl: 'https://example.com/proof.png',
    },
  });
  check('online order with screenshot placed', withProof.status === 201);
  check('proof stored on order', withProof.data.order.paymentProofUrl.includes('proof.png'));

  const confirmed = await j('PUT', `/admin/orders/${withProof.data.order._id}`, {
    token: adminToken,
    body: { status: 'confirmed', paymentStatus: 'paid' },
  });
  check('admin confirmed order + payment', confirmed.data.order.status === 'confirmed' && confirmed.data.order.paymentStatus === 'paid');
  check('confirmation email dispatched once', !!confirmed.data.order.confirmationEmailSentAt);

  console.log('\n▶ Besqaa Query (replaces scanner)');
  const query = await j('POST', '/queries', {
    token: userToken,
    body: { subject: 'Need 50 LED bulbs', message: '9W, warm white', category: catId, quantity: 50 },
  });
  check('query submitted', query.status === 201);

  const adminQueries = await j('GET', '/admin/queries', { token: adminToken });
  check('admin sees the query', adminQueries.data.queries.length === 1);

  console.log(`\n──────────────\n${pass} passed, ${fail} failed\n`);
} catch (err) {
  console.error('Smoke test crashed:', err);
  fail += 1;
} finally {
  server.close();
  const mongoose = (await import('mongoose')).default;
  await mongoose.disconnect();
  await mongod.stop();
  process.exit(fail === 0 ? 0 : 1);
}
