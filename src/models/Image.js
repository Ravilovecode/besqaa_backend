import mongoose from 'mongoose';

// Uploaded images (product photos, profile pictures, payment screenshots),
// stored in MongoDB and served by GET /api/images/:key. `key` is a long random
// id, so a payment screenshot can't be found by guessing its URL.
const imageSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    folder: { type: String, required: true, index: true },
    contentType: { type: String, required: true },
    data: { type: Buffer, required: true },
    size: { type: Number, required: true },
    width: { type: Number },
    height: { type: Number },
  },
  { timestamps: true }
);

export default mongoose.model('Image', imageSchema);
