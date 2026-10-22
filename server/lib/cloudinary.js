// KV-CLOUD v1
// Cloudinary through its REST API with plain fetch (no package). Signed uploads, nothing is public except an unguessable link the server keeps.
import crypto from 'node:crypto';

const cfg = () => ({
  name: process.env.CLOUDINARY_CLOUD_NAME,
  key: process.env.CLOUDINARY_API_KEY,
  secret: process.env.CLOUDINARY_API_SECRET,
});

export const cloudConfigured = () => {
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

async function call(resourceType, action, fields, file) {
  const c = cfg();
  const params = { ...fields, timestamp: Math.floor(Date.now() / 1000) };
  const form = new FormData();
  for (const [k, v] of Object.entries(params)) form.append(k, String(v));
  form.append('api_key', c.key);
  form.append('signature', sign(params, c.secret));
  if (file) form.append('file', new Blob([file.buf], { type: file.mime }), 'upload');

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 120000);
  try {
    const res = await fetch('https://api.cloudinary.com/v1_1/' + c.name + '/' + resourceType + '/' + action, {
      method: 'POST',
      body: form,
      signal: ctl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data && data.error && data.error.message) || ('Cloudinary ' + res.status));
    return data;
  } finally {
    clearTimeout(timer);
  }
}

// resourceType: 'image' or 'video'. Returns { public_id, resource_type, secure_url }.
export async function uploadBuffer(buf, resourceType, folder, mime = 'application/octet-stream') {
  const data = await call(resourceType, 'upload', { folder, public_id: crypto.randomBytes(16).toString('hex') }, { buf, mime });
  if (!data.public_id || !data.secure_url) throw new Error('Cloudinary did not return a file id');
  return { public_id: data.public_id, resource_type: data.resource_type || resourceType, secure_url: data.secure_url };
}

// Bytes of a stored file, or null if Cloudinary cannot give it back
export async function fetchAsset(rec) {
  if (!rec || !rec.cloud_url) return null;
  const res = await fetch(rec.cloud_url);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

export async function destroyAsset(rec) {
  if (!rec || !rec.cloud_id) return;
  await call(rec.cloud_type || 'image', 'destroy', { public_id: rec.cloud_id, invalidate: 'true' });
}
