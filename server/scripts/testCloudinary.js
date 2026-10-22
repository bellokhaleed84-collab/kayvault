// KV-TESTCLOUD v1
import 'dotenv/config';
import { cloudConfigured, uploadBuffer, fetchAsset, destroyAsset } from '../lib/cloudinary.js';

if (!cloudConfigured()) {
  console.error('Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in server/.env first.');
  process.exit(1);
}
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
try {
  const up = await uploadBuffer(png, 'image', 'kayvault/test', 'image/png');
  console.log('uploaded ok:', up.public_id);
  const back = await fetchAsset({ cloud_url: up.secure_url });
  console.log('read back:', back ? back.length + ' bytes' : 'FAILED');
  await destroyAsset({ cloud_id: up.public_id, cloud_type: up.resource_type });
  console.log('deleted ok');
  console.log(back ? 'CLOUDINARY OK' : 'CLOUDINARY: upload worked but reading failed');
} catch (e) {
  console.error('CLOUDINARY FAILED:', e.message);
  process.exit(1);
}
