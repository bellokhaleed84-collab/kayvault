// KV-REDIRECT v1
// Returns a safe in-site path to go back to after login, or null.
export function safeFrom(from) {
  if (!from) return null;
  const path = typeof from === 'string' ? from : (from.pathname || '') + (from.search || '') + (from.hash || '');
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return null;
  if (/^\/(login|signup|forgot-password|reset-password)(\/|\?|#|$)/.test(path)) return null;
  return path;
}