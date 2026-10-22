// KV-TESTPRIVATE v1
import 'dotenv/config';
import { kycCloudConfigured, uploadPrivate, fetchPrivate, destroyPrivate } from '../lib/kycStore.js';

if (!kycCloudConfigured()) {
  console.error('Set the three CLOUDINARY_* variables in server/.env first.');
  process.exit(1);
}
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
try {
  const rec = await uploadPrivate(png, 'image/png');
  console.log('uploaded private file:', rec.cloud_id);
  const back = await fetchPrivate(rec);
  console.log('signed read:', back ? back.length + ' bytes' : 'FAILED');
  const pub = await fetch('https://res.cloudinary.com/' + process.env.CLOUDINARY_CLOUD_NAME + '/image/upload/' + rec.cloud_id + '.' + rec.cloud_format);
  console.log('public link status:', pub.status, pub.status === 200 ? '(PUBLIC - NOT PRIVATE!)' : '(blocked, good)');
  await destroyPrivate(rec);
  console.log('deleted ok');
  console.log(back && pub.status !== 200 ? 'PRIVATE CLOUDINARY OK' : 'PRIVATE CLOUDINARY: check the lines above');
} catch (e) {
  console.error('PRIVATE CLOUDINARY FAILED:', e.message);
  process.exit(1);
}
