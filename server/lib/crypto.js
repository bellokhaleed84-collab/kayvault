import crypto from 'node:crypto';

// AES-256-GCM. The key comes from CREDENTIALS_KEY in server/.env.
// If you lose that key, stored account logins can no longer be read.
function getKey() {
  const raw = process.env.CREDENTIALS_KEY;
  if (!raw || raw.length < 32) throw new Error('CREDENTIALS_KEY is missing or too short in server/.env');
  return crypto.createHash('sha256').update(raw).digest();
}

export function encryptJson(obj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString('base64')).join('.');
}

export function decryptJson(payload) {
  const [iv, tag, enc] = String(payload).split('.').map((s) => Buffer.from(s, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(tag);
  const out = Buffer.concat([decipher.update(enc), decipher.final()]);
  return JSON.parse(out.toString('utf8'));
}