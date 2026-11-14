/**
 * One-off migration: copies every S3 image referenced in the database into
 * MongoDB (through the same resize/compress pipeline as new uploads) and
 * rewrites the URLs to <PUBLIC_URL>/api/images/<key>.
 *
 * S3 objects are not touched, so the originals remain as a backup, and an
 * old → new URL map is written to a JSON file for rollback. Safe to re-run:
 * only URLs still pointing at S3 are migrated.
 *
 *   PUBLIC_URL=https://besqaa-backend.onrender.com node scripts/migrate-images-to-mongodb.mjs --dry-run
 *   PUBLIC_URL=https://besqaa-backend.onrender.com node scripts/migrate-images-to-mongodb.mjs
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import mongoose from 'mongoose';
import env from '../src/config/env.js';
import { saveImage } from '../src/services/images.js';

const dryRun = process.argv.includes('--dry-run');
const S3_URL = /^https?:\/\/[^/]*amazonaws\.com\//;
const isS3 = (url) => typeof url === 'string' && S3_URL.test(url);

if (!process.env.PUBLIC_URL) {
  console.error('Set PUBLIC_URL to the API origin images are served from, e.g. https://besqaa-backend.onrender.com');
  process.exit(1);
}

// Folder (size preset) from the S3 key, e.g. .../avatars/123.jpg → avatars.
function folderOf(url, fallback) {
  const match = new URL(url).pathname.match(/^\/(products|avatars|payment-proofs)\//);
  return match ? match[1] : fallback;
}

await mongoose.connect(env.mongoUri);
const db = mongoose.connection.db;
const products = await db.collection('products').find({ images: { $regex: S3_URL } }).toArray();
const categories = await db.collection('categories').find({ imageUrl: { $regex: S3_URL } }).toArray();
const users = await db.collection('users').find({ avatarUrl: { $regex: S3_URL } }).toArray();
const orders = await db
  .collection('orders')
  .find({ $or: [{ paymentProofUrl: { $regex: S3_URL } }, { 'items.image': { $regex: S3_URL } }] })
  .toArray();

// Unique S3 URLs → folder.
const wanted = new Map();
const want = (url, fallback) => isS3(url) && !wanted.has(url) && wanted.set(url, folderOf(url, fallback));
products.forEach((p) => p.images.forEach((u) => want(u, 'products')));
categories.forEach((c) => want(c.imageUrl, 'products'));
users.forEach((u) => want(u.avatarUrl, 'avatars'));
orders.forEach((o) => {
  want(o.paymentProofUrl, 'payment-proofs');
  (o.items || []).forEach((i) => want(i.image, 'products'));
});

console.log(`${dryRun ? '[dry run] ' : ''}${wanted.size} S3 image(s) referenced by ` +
  `${products.length} product(s), ${categories.length} categor(ies), ${users.length} user(s), ${orders.length} order(s)`);

const map = {};
let before = 0;
let after = 0;
for (const [url, folder] of wanted) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    before += buffer.length;
    if (dryRun) {
      console.log(`  would copy ${folder.padEnd(15)} ${(buffer.length / 1024).toFixed(0).padStart(6)} KB  ${url}`);
      continue;
    }
    const { key, url: newUrl } = await saveImage(buffer, folder);
    const saved = await mongoose.model('Image').findOne({ key }).select('size');
    after += saved.size;
    map[url] = newUrl;
    console.log(`  copied ${folder.padEnd(15)} ${(buffer.length / 1024).toFixed(0).padStart(6)} KB → ${(saved.size / 1024).toFixed(0).padStart(4)} KB  ${newUrl}`);
  } catch (err) {
    console.error(`  FAILED ${url}: ${err.message} (left unchanged)`);
  }
}

if (!dryRun) {
  const swap = (u) => map[u] ?? u;
  for (const p of products) {
    await db.collection('products').updateOne({ _id: p._id }, { $set: { images: p.images.map(swap) } });
  }
  for (const c of categories) {
    await db.collection('categories').updateOne({ _id: c._id }, { $set: { imageUrl: swap(c.imageUrl) } });
  }
  for (const u of users) {
    await db.collection('users').updateOne({ _id: u._id }, { $set: { avatarUrl: swap(u.avatarUrl) } });
  }
  for (const o of orders) {
    await db.collection('orders').updateOne(
      { _id: o._id },
      {
        $set: {
          paymentProofUrl: swap(o.paymentProofUrl),
          items: (o.items || []).map((i) => ({ ...i, image: swap(i.image) })),
        },
      }
    );
  }
  const out = path.join(os.tmpdir(), `besqaa-image-migration-${Date.now()}.json`);
  fs.writeFileSync(out, JSON.stringify(map, null, 2));
  console.log(`\nMigrated ${Object.keys(map).length}/${wanted.size} image(s): ` +
    `${(before / 1024 / 1024).toFixed(1)} MB on S3 → ${(after / 1024 / 1024).toFixed(1)} MB in MongoDB`);
  console.log(`Old → new URL map (for rollback): ${out}`);
} else {
  console.log(`\nTotal on S3: ${(before / 1024 / 1024).toFixed(1)} MB. Re-run without --dry-run to migrate.`);
}

await mongoose.disconnect();
