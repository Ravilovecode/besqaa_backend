import mongoose from 'mongoose';

// Free-form spec rows shown on the product detail screen (Display, Smart OS, ...).
const specSchema = new mongoose.Schema(
  { label: { type: String, required: true }, value: { type: String, required: true } },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    price: { type: Number, required: true, min: 0 },
    // Original / strike-through price for deals. 0 = no discount shown.
    compareAtPrice: { type: Number, default: 0, min: 0 },
    images: [{ type: String }],
    stock: { type: Number, default: 0, min: 0 },
    unit: { type: String, default: 'piece' },
    brand: { type: String, default: '' },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
    specs: [specSchema],
    shipsInDays: { type: Number, default: 2 },
    isDeal: { type: Boolean, default: false },
    isRecommended: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.index({ name: 'text', description: 'text', brand: 'text' });

// Convenience virtual: discount percentage for deal badges (-18% DEAL).
productSchema.virtual('discountPercent').get(function discountPercent() {
  if (!this.compareAtPrice || this.compareAtPrice <= this.price) return 0;
  return Math.round(((this.compareAtPrice - this.price) / this.compareAtPrice) * 100);
});

productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

export default mongoose.model('Product', productSchema);
