import { logger } from '../utils/logger.js';
import { config } from '../config/env.js';

export const errorHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  let status = error.status || 500;
  let message = error.message;
  if (error.name === 'ZodError') {
    status = 400;
    message = error.issues
      ?.map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
      .join('; ');
  } else if (['ValidationError', 'CastError', 'StrictModeError'].includes(error.name ?? '')) {
    status = 400;
    message = 'Invalid document fields';
  } else if (error.name === 'VersionError') {
    status = 409;
    message = 'This board changed. Reload it and retry your action.';
  } else if (error.code === 11000) {
    status = 409;
    message = 'An account with that email already exists';
  } else if (error.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON';
  } else if (error.type === 'entity.too.large') {
    status = 413;
    message = 'Request body is too large';
  } else if (
    [
      'MongoNetworkError',
      'MongoServerSelectionError',
      'MongooseServerSelectionError',
      'MongoOperationTimeoutError',
      'MongoNetworkTimeoutError',
    ].includes(error.name) ||
    error.code === 50
  ) {
    status = 503;
  }
  if (status >= 500) {
    logger.error('Request failed', {
      name: error.name,
      message: error.message,
      ...(config.NODE_ENV !== 'production' ? { stack: error.stack } : {}),
    });
    message =
      status === 503
        ? 'Database temporarily unavailable. Please retry shortly.'
        : 'The server could not complete your request';
  }
  res.status(status).json({
    success: false,
    error: message,
  });
};
