import multer from 'multer';
import { badRequest } from '../utils/ApiError.js';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

// Keep files in memory; the controller streams the buffer straight to S3.
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED.includes(file.mimetype)) return cb(null, true);
    cb(badRequest('Only image files (jpg, png, webp, gif, avif) are allowed'));
  },
});
