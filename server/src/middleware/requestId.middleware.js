import { randomUUID } from 'node:crypto';

/**
 * Attach a unique request ID to every incoming request for log traceability.
 * If a reverse proxy forwards `X-Request-Id`, it is reused (after validation);
 * otherwise a new UUIDv4 is generated.  The ID is exposed on the response
 * via the `X-Request-Id` header so clients can quote it in bug reports.
 */
export function requestId(req, res, next) {
  const forwarded = req.get('X-Request-Id');
  const id =
    typeof forwarded === 'string' && /^[\w-]{1,128}$/.test(forwarded) ? forwarded : randomUUID();
  req.id = id;
  res.set('X-Request-Id', id);
  next();
}
