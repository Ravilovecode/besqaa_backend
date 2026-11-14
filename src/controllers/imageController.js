import { asyncHandler } from '../utils/asyncHandler.js';
import { notFound } from '../utils/ApiError.js';
import Image from '../models/Image.js';

// GET /api/images/:key  (public) — serves an image stored by saveImage().
export const serveImage = asyncHandler(async (req, res) => {
  const image = await Image.findOne({ key: req.params.key }).select('data contentType');
  if (!image) throw notFound('Image not found');
  res.set({
    'Content-Type': image.contentType,
    // A key's content never changes, so clients may cache it indefinitely.
    'Cache-Control': 'public, max-age=31536000, immutable',
  });
  res.send(image.data);
});
