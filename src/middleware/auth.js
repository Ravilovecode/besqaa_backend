import { verifyToken } from '../utils/token.js';
import { unauthorized, forbidden } from '../utils/ApiError.js';
import User from '../models/User.js';
import Admin from '../models/Admin.js';

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

// Requires a valid *buyer* token. Attaches req.user.
export async function requireAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) throw unauthorized();
    const decoded = verifyToken(token);
    if (decoded.role !== 'user') throw unauthorized('Buyer account required');
    const user = await User.findById(decoded.id).select('-password');
    if (!user) throw unauthorized('Account no longer exists');
    req.user = user;
    next();
  } catch (err) {
    next(err.statusCode ? err : unauthorized('Invalid or expired token'));
  }
}

// Requires a valid *admin* token. Attaches req.admin.
export async function requireAdmin(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) throw unauthorized();
    const decoded = verifyToken(token);
    if (decoded.role !== 'admin') throw forbidden('Admin access required');
    const admin = await Admin.findById(decoded.id).select('-password');
    if (!admin) throw unauthorized('Admin no longer exists');
    req.admin = admin;
    next();
  } catch (err) {
    next(err.statusCode ? err : unauthorized('Invalid or expired token'));
  }
}
