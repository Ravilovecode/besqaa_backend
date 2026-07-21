import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const addressSchema = new mongoose.Schema(
  {
    label: { type: String, default: 'Home' },
    line1: { type: String, required: true },
    line2: { type: String, default: '' },
    landmark: { type: String, default: '' },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    phone: { type: String, default: '' },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true, timestamps: true }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 6, select: false },
    phone: { type: String, default: '' },
    gstNumber: { type: String, default: '' },
    gstVerified: { type: Boolean, default: false },
    avatarUrl: { type: String, default: '' },
    addresses: [addressSchema],
    savedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],

    // ---- OTP verification (either email OR phone verifies the account) ----
    emailVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },
    emailOtp: { type: String, select: false },
    phoneOtp: { type: String, select: false },
    otpExpiresAt: { type: Date, select: false },
    otpGeneratedAt: { type: Date }, // absent = legacy account (pre-OTP feature)

    // ---- Buyback (from the buyer's furniture card) ----
    buybackDate: { type: Date },
    buybackAmount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.password);
};

export default mongoose.model('User', userSchema);
