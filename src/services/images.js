import sharp from 'sharp';
import { nanoid } from 'nanoid';
import env from '../config/env.js';
import { badRequest } from '../utils/ApiError.js';
import Image from '../models/Image.js';

// Keep sharp's memory use low on a small server instance.
sharp.cache(false);
sharp.concurrency(1);

// Longest side (px) per kind of image. Uploads are shrunk to fit (never
// enlarged) and re-encoded as WebP, which keeps transparency for product
// cut-outs and is far smaller than phone photos or PNG screenshots.
const MAX_SIDE = { avatars: 512, products: 1200, 'payment-proofs': 2000 };
const DEFAULT_MAX_SIDE = 1200;
const WEBP_QUALITY = 80;

// Absolute URL clients load an image from (PUBLIC_URL is this API's origin).
export function imageUrl(key) {
  return `${env.publicUrl}/api/images/${key}`;
}

// The image key from a URL this service generated, or '' for anything else
// (e.g. a legacy S3 URL or an external image).
export function keyFromImageUrl(url) {
  const match = typeof url === 'string' && url.match(/\/api\/images\/([A-Za-z0-9_-]+)$/);
  return match ? match[1] : '';
}

// Resizes + compresses an image buffer and stores it. Returns { key, url }.
export async function saveImage(buffer, folder = 'products') {
  const maxSide = MAX_SIDE[folder] || DEFAULT_MAX_SIDE;
  let data;
  let info;
  try {
    ({ data, info } = await sharp(buffer)
      .rotate() // apply the EXIF orientation phone cameras record
      .resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true }));
  } catch {
    throw badRequest('That file could not be read as an image');
  }

  const key = nanoid(24);
  await Image.create({
    key,
    folder,
    contentType: 'image/webp',
    data,
    size: info.size,
    width: info.width,
    height: info.height,
  });
  return { key, url: imageUrl(key) };
}

// Deletes an image this service stored; ignores any other URL.
export async function deleteImageByUrl(url) {
  const key = keyFromImageUrl(url);
  if (key) await Image.deleteOne({ key });
}
