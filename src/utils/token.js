import jwt from 'jsonwebtoken';
import env from '../config/env.js';

// `role` distinguishes buyer tokens from admin tokens so middleware can gate routes.
export function signToken(payload, role) {
  return jwt.sign({ ...payload, role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

export function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}
