// Email through Resend (https://resend.com), called with plain fetch.
// Every function here is safe to fire and forget: nothing throws, a failed email only logs a line.
//
// server/.env:
//   RESEND_API_KEY=re_xxxxxxxx
//   MAIL_FROM=KayVault <noreply@your-domain.com>      (while testing: KayVault <onboarding@resend.dev>)

const ENDPOINT = 'https://api.resend.com/emails';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const origin = () => (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0];
const fromAddress = () => process.env.MAIL_FROM || 'KayVault <onboarding@resend.dev>';

export const mailConfigured = () => Boolean(process.env.RESEND_API_KEY);

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/* ------------------------------------------------ sending */

async function deliver(msg, attempt = 0) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 10000);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromAddress(),
        to: [msg.to],
        subject: String(msg.subject || 'KayVault').replace(/[\r\n]+/g, ' ').slice(0, 150),
        html: msg.html,
        text: msg.text,
      }),
      signal: ctl.signal,
    });
    if (res.status === 429 && attempt < 2) {
      await sleep(1500);
      return deliver(msg, attempt + 1);
    }
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      console.error(`[email] Resend ${res.status}: ${d.message || 'send failed'} (to ${msg.to})`);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[email] failed:', e.name === 'AbortError' ? 'timed out' : e.message);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// Resend allows about 2 requests per second, so emails go out one at a time with a short gap
let chain = Promise.resolve();
export function sendMail(msg) {
  if (!mailConfigured() || !msg?.to) return Promise.resolve(false);
  const run = chain.then(() => deliver(msg));
  chain = run.then(() => sleep(600), () => sleep(600));
  return run;
}

/* ------------------------------------------------ the look: dark navy and gold */

export function emailTemplate({ heading, paragraphs = [], button = null, footer = '' }) {
  const defaultFooter = `You are getting this email because you have a KayVault account. You can turn order emails off in Settings: ${origin()}/settings`;
  const foot = footer || defaultFooter;
  const lines = paragraphs.filter(Boolean);
  const paras = lines
    .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#CBD5E1;">${esc(p)}</p>`)
    .join('');
  const btn = button
    ? `<p style="margin:22px 0 6px;"><a href="${esc(button.url)}" style="display:inline-block;background:#D4A94B;color:#0B1120;font-weight:700;font-size:14px;text-decoration:none;padding:12px 22px;border-radius:8px;">${esc(button.label)}</a></p>` +
      `<p style="margin:12px 0 0;font-size:12px;line-height:1.5;color:#64748B;word-break:break-all;">Or paste this link into your browser:<br>${esc(button.url)}</p>`
    : '';

  const html =
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="margin:0;padding:0;background:#0B1120;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0B1120;padding:28px 12px;"><tr><td align="center">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">' +
    '<tr><td style="padding:0 4px 16px;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;color:#D4A94B;letter-spacing:0.5px;">KayVault</td></tr>' +
    '<tr><td style="background:#131B2E;border:1px solid #1E293B;border-radius:12px;padding:28px;font-family:Arial,Helvetica,sans-serif;">' +
    `<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#F1F5F9;">${esc(heading)}</h1>${paras}${btn}</td></tr>` +
    `<tr><td style="padding:16px 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#64748B;">${esc(foot)}</td></tr>` +
    '</table></td></tr></table></body></html>';

  const text = [heading, '', ...lines, ...(button ? ['', `${button.label}: ${button.url}`] : []), '', foot].join('\n');
  return { html, text };
}

const SECURITY_FOOTER = 'This is a security email from KayVault, so it is sent even if you turned order emails off.';

/* ------------------------------------------------ the emails */

export function sendPasswordReset(to, name, link) {
  const { html, text } = emailTemplate({
    heading: 'Reset your password',
    paragraphs: [
      `Hi ${name || 'there'},`,
      'We got a request to reset the password for your KayVault account. The link below works for 1 hour.',
      'If you did not ask for this, you can ignore this email. Your password stays the same.',
    ],
    button: { label: 'Choose a new password', url: link },
    footer: SECURITY_FOOTER,
  });
  return sendMail({ to, subject: 'Reset your KayVault password', html, text });
}

export function sendPasswordChanged(to, name) {
  const { html, text } = emailTemplate({
    heading: 'Your password was changed',
    paragraphs: [
      `Hi ${name || 'there'},`,
      'The password for your KayVault account was just changed.',
      'If this was you, there is nothing more to do. If it was not you, reset your password now so nobody else can get in.',
    ],
    button: { label: 'Reset my password', url: `${origin()}/forgot-password` },
    footer: SECURITY_FOOTER,
  });
  return sendMail({ to, subject: 'Your KayVault password was changed', html, text });
}

export function sendWelcome(to, name, role) {
  const seller = role === 'seller';
  const { html, text } = emailTemplate({
    heading: 'Welcome to KayVault',
    paragraphs: [
      `Hi ${name || 'there'},`,
      seller
        ? 'Your seller account is ready. Add your first listing, then verify your identity in Settings to earn the Verified badge. Every sale is protected by escrow, and we pay you after the buyer confirms.'
        : 'Your account is ready. Browse gaming accounts from sellers across Africa. Every purchase is protected by escrow: you have 24 hours after delivery to check the account and confirm it works.',
    ],
    button: { label: seller ? 'Go to my dashboard' : 'Browse accounts', url: `${origin()}${seller ? '/dashboard/seller' : '/browse'}` },
  });
  return sendMail({ to, subject: 'Welcome to KayVault', html, text });
}