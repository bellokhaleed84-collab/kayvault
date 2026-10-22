import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { sendMail, emailTemplate, mailConfigured } from './mailer.js';

const EMAIL_TYPES = new Set(['order', 'listing']); // bell-only types: review, info
const origin = () => (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0];

// Emails the same message as the bell, unless the person turned email off in Settings.
async function emailIt(userId, { title, body, link }) {
  const u = await User.findById(userId).select('email full_name notify_email');
  if (!u || u.notify_email === false) return;
  const { html, text } = emailTemplate({
    heading: title,
    paragraphs: [`Hi ${u.full_name?.split(' ')[0] || 'there'},`, body],
    button: link ? { label: 'Open KayVault', url: origin() + link } : null,
  });
  await sendMail({ to: u.email, subject: title, html, text });
}

// Fire and forget: a failed notification or email must never break an order.
export function notify(user, { type = 'info', title, body = '', link = '' }) {
  return Notification.create({ user, type, title, body, link })
    .then((n) => {
      if (EMAIL_TYPES.has(type) && mailConfigured()) {
        emailIt(user, { title, body, link }).catch((e) => console.error('[email] notify failed:', e.message));
      }
      return n;
    })
    .catch((e) => console.error('notify failed:', e.message));
}

export async function notifyAdmins(payload) {
  const admins = await User.find({ is_admin: true }).select('_id');
  await Promise.all(admins.map((a) => notify(a._id, payload)));
}