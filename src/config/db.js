import mongoose from 'mongoose';
import env from './env.js';

export async function connectDB() {
  mongoose.set('strictQuery', true);
  try {
    const conn = await mongoose.connect(env.mongoUri);
    console.log(`✅ MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
    // Email became optional (unique+sparse) — drop/recreate any index whose
    // options changed so email-less accounts don't hit the old unique index.
    try {
      const { default: User } = await import('../models/User.js');
      await User.syncIndexes();
    } catch (err) {
      console.warn('⚠️ User index sync failed:', err.message);
    }
    return conn;
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
}
