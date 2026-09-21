/**
 * Wraps an async Express route handler so thrown errors
 * are forwarded to Express's error-handling middleware.
 * Express 5 already does this, but the wrapper makes intent explicit.
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
