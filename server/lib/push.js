// KV-PUSH v1: sends a push to every phone the user turned notifications on for.
// Does nothing until VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT are set on the server.
import * as wp from 'web-push';
import PushSubscription from '../models/PushSubscription.js';

const webpush = wp.default || wp; // works whichever way the package exports itself

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
const ready = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT);

if (ready) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  } catch (e) {
    console.error('[push] bad VAPID settings:', e.message);
  }
}

export const pushReady = () => ready;
export const publicKey = () => (ready ? VAPID_PUBLIC_KEY : null);

// Fire and forget. Never throws, so a push problem can never break an order.
export async function sendPush(userId, { title, body = '', link = '/' }) {
  if (!ready) return;
  try {
    const subs = await PushSubscription.find({ user: userId }).limit(10);
    if (!subs.length) return;
    const payload = JSON.stringify({ title: String(title).slice(0, 120), body: String(body).slice(0, 200), link: String(link || '/').slice(0, 200) });
    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 24 * 60 * 60 });
      } catch (e) {
        // The phone removed the subscription, so forget it
        if (e && (e.statusCode === 404 || e.statusCode === 410)) await PushSubscription.deleteOne({ _id: s._id }).catch(() => {});
        else console.error('[push] send failed:', e && e.statusCode ? e.statusCode : e.message);
      }
    }));
  } catch (e) {
    console.error('[push] failed:', e.message);
  }
}