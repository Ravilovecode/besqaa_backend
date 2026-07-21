import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest } from '../utils/ApiError.js';
import { uploadBufferToS3 } from '../services/s3.js';

// POST /api/upload/payment-proof  (buyer, multipart, field "proof")
// Screenshot of a completed UPI/online payment, attached to the order.
export const uploadPaymentProof = asyncHandler(async (req, res) => {
  if (!req.file) throw badRequest('No screenshot provided');
  const { url } = await uploadBufferToS3(req.file, 'payment-proofs');
  res.status(201).json({ url });
});

// POST /api/upload  (admin, multipart)  field name: "image" (single) or "images" (multiple)
export const uploadImages = asyncHandler(async (req, res) => {
  const files = req.files?.length ? req.files : req.file ? [req.file] : [];
  if (!files.length) throw badRequest('No image file provided');

  const folder = req.query.folder || 'products';
  const results = await Promise.all(files.map((f) => uploadBufferToS3(f, folder)));

  res.status(201).json({
    urls: results.map((r) => r.url),
    keys: results.map((r) => r.key),
    url: results[0].url,
  });
});
