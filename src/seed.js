/**
 * Seeds a bootstrap admin plus a few demo categories and products so the app
 * shows content immediately. Safe to re-run: it upserts by unique keys.
 *
 *   cd server && npm run seed
 */
import mongoose from 'mongoose';
import env from './config/env.js';
import { connectDB } from './config/db.js';
import Admin from './models/Admin.js';
import Category from './models/Category.js';
import Product from './models/Product.js';

async function seedAdmin() {
  const existing = await Admin.findOne({ email: env.seedAdmin.email });
  if (existing) {
    console.log(`• Admin already exists: ${env.seedAdmin.email}`);
    return;
  }
  await Admin.create({
    name: env.seedAdmin.name,
    email: env.seedAdmin.email,
    password: env.seedAdmin.password,
    role: 'superadmin',
  });
  console.log(`✅ Created admin: ${env.seedAdmin.email} / ${env.seedAdmin.password}`);
}

const CATEGORIES = [
  { name: 'Televisions', description: 'Smart TVs and displays' },
  { name: 'Appliances', description: 'Home and kitchen appliances' },
  { name: 'Furniture', description: 'Beds, sofas and more' },
];

const PRODUCTS = [
  {
    name: '55" 4K Smart TV',
    categoryName: 'Televisions',
    price: 54990,
    compareAtPrice: 66990,
    stock: 24,
    brand: 'Besqaa',
    rating: 4.7,
    reviewCount: 1284,
    isDeal: true,
    isRecommended: true,
    shipsInDays: 2,
    specs: [
      { label: 'Display', value: '55" UHD 4K · 60 Hz' },
      { label: 'Smart OS', value: 'Android TV 12' },
      { label: 'Connectivity', value: '3× HDMI · 2× USB · Wi-Fi' },
      { label: 'Warranty', value: '2 years on-site' },
    ],
  },
  {
    name: '43" LED Smart TV',
    categoryName: 'Televisions',
    price: 27990,
    stock: 40,
    rating: 4.4,
    reviewCount: 512,
    isRecommended: true,
  },
  {
    name: 'Double Door Refrigerator',
    categoryName: 'Appliances',
    price: 28990,
    stock: 15,
    rating: 4.5,
    reviewCount: 340,
    isRecommended: true,
  },
  {
    name: 'Front-Load Washing Machine',
    categoryName: 'Appliances',
    price: 24490,
    stock: 12,
    rating: 4.6,
    reviewCount: 220,
    isRecommended: true,
  },
  {
    name: 'Microwave Oven 28L',
    categoryName: 'Appliances',
    price: 9490,
    stock: 30,
    rating: 4.3,
    reviewCount: 190,
  },
  {
    name: '1.5 Ton Split AC',
    categoryName: 'Appliances',
    price: 34990,
    compareAtPrice: 41990,
    stock: 18,
    rating: 4.5,
    reviewCount: 410,
    isDeal: true,
  },
  {
    name: 'Queen Size Bed',
    categoryName: 'Furniture',
    price: 28990,
    stock: 8,
    rating: 4.2,
    reviewCount: 96,
  },
  {
    name: '3-Seater Sofa',
    categoryName: 'Furniture',
    price: 32500,
    compareAtPrice: 43000,
    stock: 6,
    rating: 4.4,
    reviewCount: 78,
    isDeal: true,
  },
];

async function seedCatalog() {
  const bySlugName = {};
  for (const c of CATEGORIES) {
    let cat = await Category.findOne({ name: c.name });
    if (!cat) cat = await Category.create(c);
    bySlugName[c.name] = cat;
  }
  console.log(`✅ Categories ready: ${Object.keys(bySlugName).join(', ')}`);

  let created = 0;
  for (const p of PRODUCTS) {
    const existing = await Product.findOne({ name: p.name });
    if (existing) continue;
    const { categoryName, ...rest } = p;
    await Product.create({ ...rest, category: bySlugName[categoryName]._id });
    created += 1;
  }
  console.log(`✅ Products created: ${created} (skipped existing)`);
}

async function run() {
  await connectDB();
  await seedAdmin();
  await seedCatalog();
  await mongoose.disconnect();
  console.log('🌱 Seed complete.');
  process.exit(0);
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
