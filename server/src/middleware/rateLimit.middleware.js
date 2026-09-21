import rateLimit from 'express-rate-limit';
export function authenticationLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts. Try again in 15 minutes.' },
  });
}
