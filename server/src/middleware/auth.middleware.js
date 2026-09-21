import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { User } from '../modules/users/users.model.js';
import { AppError } from '../errors/AppError.js';
export const cookieOptions = {
  httpOnly: true,
  secure: config.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
};
export function setSession(res, user) {
  const token = jwt.sign({ ver: user.tokenVersion }, config.JWT_SECRET, {
    algorithm: 'HS256',
    subject: user._id.toString(),
    issuer: 'flowboard-api',
    audience: 'flowboard-web',
    expiresIn: config.tokenSeconds,
  });
  res.cookie(config.cookieName, token, { ...cookieOptions, maxAge: config.tokenSeconds * 1000 });
}
export async function authenticate(token) {
  let subject;
  let version;
  let expiry;
  try {
    if (typeof token !== 'string') throw new Error('Invalid token');
    const claims = jwt.verify(token, config.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'flowboard-api',
      audience: 'flowboard-web',
    });
    if (
      typeof claims === 'string' ||
      typeof claims.sub !== 'string' ||
      !/^[a-f0-9]{24}$/i.test(claims.sub) ||
      typeof claims.ver !== 'number' ||
      !Number.isInteger(claims.ver) ||
      typeof claims.exp !== 'number' ||
      !Number.isInteger(claims.exp)
    )
      throw new Error('Invalid claims');
    subject = claims.sub;
    version = claims.ver;
    expiry = claims.exp;
  } catch {
    throw new AppError(401, 'Please sign in again');
  }
  const user = await User.findById(subject).select('+tokenVersion');
  if (!user || user.tokenVersion !== version) throw new AppError(401, 'Please sign in again');
  return { user, expiresAt: expiry * 1000 };
}
export const requireAuth = async (req, _res, next) => {
  const session = await authenticate(req.cookies[config.cookieName]);
  req.user = session.user;
  next();
};
export function authenticatedUser(req) {
  if (!req.user) throw new AppError(401, 'Please sign in again');
  return req.user;
}
