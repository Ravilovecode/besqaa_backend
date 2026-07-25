import mongoose from 'mongoose';

// "Besqaa Query" — the form that replaces the barcode scanner. Buyers submit a
// sourcing / product request and admins respond from the panel.
const querySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    name: { type: String, required: true, trim: true },
    // Optional — the controller requires at least one of email/phone.
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, default: '' },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    budget: { type: Number, default: 0 },
    quantity: { type: Number, default: 1 },
    status: {
      type: String,
      enum: ['new', 'in_review', 'responded', 'closed'],
      default: 'new',
      index: true,
    },
    adminNote: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('Query', querySchema);
