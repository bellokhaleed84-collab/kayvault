// KV-KYCSTORE v1
// Private Cloudinary storage for KYC photos. Files are uploaded as type "authenticated":
// there is no public link, only a signed request from this server can read them.
import crypto from 'node:crypto';
import KycSubmission from '../models/KycSubmission.js';

export const KEEP_DAYS = 14; // photos are deleted this many days after the admin decides

const cfg = () => ({
  name: process.env.CLOUDINARY_CLOUD_NAME,
  key: process.env.CLOUDINARY_API_KEY,
  secret: process.env.CLOUDINARY_API_SECRET,
});

export const kycCloudConfigured = () => {
  const c = cfg();
  return Boolean(c.name && c.key && c.secret);
};

function sign(params, secret) {
  const s = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== '')
    .sort()
    .map((k) => k + '=' + params[k])
    .join('&');
  return crypto.createHash('sha1').update(s + secret).digest('hex');
}

async function post(action, fields, file) {
  const c = cfg();
  const params = { ...fields, timestamp: Math.floor(Date.now() / 1000) };
  const form = new FormData();
  for (const [k, v] of Object.entries(params)) form.append(k, String(v));
  form.append('api_key', c.key);
  form.append('signature', sign(params, c.secret));
  if (file) form.append('file', new Blob([file.buf], { type: file.mime }), 'upload');

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 60000);
  try {
    const res = await fetch('https://api.cloudinary.com/v1_1/' + c.name + '/image/' + action, { method: 'POST', body: form, signal: ctl.signal });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data && data.error && data.error.message) || ('Cloudinary ' + res.status));
    return data;
  } finally {
    clearTimeout(timer);
  }
}

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

// One private image. Returns { mime, cloud_id, cloud_format }.
export async function uploadPrivate(buf, mime) {
  const data = await post('upload', { folder: 'kayvault/kyc', public_id: crypto.randomBytes(16).toString('hex'), type: 'authenticated' }, { buf, mime });
  if (!data.public_id) throw new Error('Cloudinary did not return a file id');
  return { mime, cloud_id: data.public_id, cloud_format: data.format || EXT[mime] || 'jpg' };
}

export async function destroyPrivate(rec) {
  if (!rec || !rec.cloud_id) return;
  await post('destroy', { public_id: rec.cloud_id, type: 'authenticated', invalidate: 'true' });
}

// Uploads several images. If one fails, the ones already uploaded are removed again.
export async function storeImages(list) {
  const done = [];
  try {
    for (const img of list) done.push(await uploadPrivate(img.data, img.mime));
    return done;
  } catch (e) {
    for (const d of done) await destroyPrivate(d).catch(() => {});
    throw e;
  }
}

// Bytes of a private image through a short-lived signed download link, or null
export async function fetchPrivate(rec) {
  if (!rec || !rec.cloud_id) return null;
  const c = cfg();
  const params = {
    public_id: rec.cloud_id,
    format: rec.cloud_format || 'jpg',
    type: 'authenticated',
    timestamp: Math.floor(Date.now() / 1000),
    expires_at: Math.floor(Date.now() / 1000) + 300,
  };
  const qs = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), api_key: c.key, signature: sign(params, c.secret) });
  const res = await fetch('https://api.cloudinary.com/v1_1/' + c.name + '/image/download?' + qs.toString());
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

// Called when the admin approves or rejects: the photos are kept for KEEP_DAYS, then the sweep deletes them
export function scheduleDelete(userId) {
  return KycSubmission.updateOne({ user: userId }, { delete_after: new Date(Date.now() + KEEP_DAYS * 24 * 3600 * 1000) })
    .catch((e) => console.error('[kyc] could not schedule deletion:', e.message));
}
