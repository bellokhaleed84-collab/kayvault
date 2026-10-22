// KV-VALIDATE v1
const BAD = /[\u0000-\u001F\u007F<>]/g;

export const isStr = (v) => typeof v === 'string';

// Full name: 2 to 80 characters, no control characters or < >
export function cleanName(v) {
  if (!isStr(v)) return null;
  const s = v.replace(/\s+/g, ' ').trim();
  if (s.length < 2 || s.length > 80 || BAD.test(s)) { BAD.lastIndex = 0; return null; }
  BAD.lastIndex = 0;
  return s;
}

// Email: lower case, trimmed, simple shape check, 254 characters at most
export function cleanEmail(v) {
  if (!isStr(v)) return null;
  const s = v.trim().toLowerCase();
  if (s.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(s)) return null;
  return s;
}

// Free text line: strips control characters and < >, trims, cuts to max
export function cleanLine(v, max) {
  if (!isStr(v)) return '';
  return v.replace(BAD, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

// bcrypt only reads the first 72 bytes, so longer passwords are refused
export function passwordError(v) {
  if (!isStr(v) || v.length < 8) return 'Password must be at least 8 characters';
  if (Buffer.byteLength(v) > 72) return 'Password is too long (72 characters at most)';
  return null;
}