const base = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
export const socketOrigin = new URL(base, window.location.origin).origin;
let sessionRevision = 0;
// Responses started under an older session must not sign out a newly logged-in user.
export const advanceSession = () => ++sessionRevision;
export class ApiError extends Error {
  status;
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export async function request(path, { method = 'GET', body, signal, timeoutMs = 15000 } = {}) {
  const revision = sessionRevision;
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    const response = await fetch(`${base}${path}`, {
      method,
      signal: controller.signal,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Flowboard-Request': '1' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data = null;
    if (response.status !== 204) {
      try {
        data = await response.json();
      } catch (error) {
        if (error.name === 'AbortError') throw error;
      }
    }
    if (!response.ok) {
      if (
        response.status === 401 &&
        revision === sessionRevision &&
        !['/auth/login', '/auth/register'].includes(path)
      ) {
        window.dispatchEvent(new Event('flowboard:unauthorized'));
      }
      const message =
        typeof data?.error === 'string' ? data.error : `Request failed (${response.status})`;
      throw new ApiError(response.status, message);
    }
    if (data === null && response.status !== 204)
      throw new ApiError(502, 'The server returned an invalid response');
    return data;
  } catch (error) {
    if (timedOut)
      throw new ApiError(
        408,
        'The request timed out. Refresh before retrying; your last change may have been saved.',
      );
    if (error instanceof ApiError) throw error;
    if (
      typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      error.name === 'AbortError'
    )
      throw error;
    throw new ApiError(0, 'Cannot reach the server. Check your connection and retry.');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}
export const write = (path, method, body) => request(path, { method, body });
