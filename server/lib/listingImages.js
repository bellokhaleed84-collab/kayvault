// KV-LISTIMG v1
import { cloudConfigured, uploadBuffer, destroyAsset } from './cloudinary.js';

// Turns parsed images ({ mime, data }) into Cloudinary records. Without Cloudinary settings the images stay as they are (MongoDB).
export async function storeListingImages(list) {
  if (!cloudConfigured() || !Array.isArray(list) || list.length === 0) return list;
  const done = [];
  try {
    for (const img of list) {
      const up = await uploadBuffer(img.data, 'image', 'kayvault/listings', img.mime);
      done.push({ mime: img.mime, cloud_id: up.public_id, cloud_type: up.resource_type, cloud_url: up.secure_url });
    }
    return done;
  } catch (e) {
    console.error('[cloudinary] listing image upload failed:', e.message);
    for (const d of done) await destroyAsset(d).catch(() => {});
    throw Object.assign(new Error('Could not store the images right now. Please try again.'), { status: 400 });
  }
}

// Fire and forget: remove the Cloudinary copies of a listing's images
export function removeListingImages(list) {
  for (const img of list || []) {
    if (img && img.cloud_id) destroyAsset(img).catch((e) => console.error('[cloudinary] could not delete image:', e.message));
  }
}
