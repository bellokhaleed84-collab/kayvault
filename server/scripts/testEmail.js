// Usage (in \server):  npm run test-email -- you@example.com
import 'dotenv/config';
import { sendMail, mailConfigured, emailTemplate } from '../lib/mailer.js';

const to = process.argv[2];
if (!to) {
  console.log('Usage: npm run test-email -- you@example.com');
  process.exit(1);
}
if (!mailConfigured()) {
  console.log('RESEND_API_KEY is missing in server/.env');
  process.exit(1);
}

const { html, text } = emailTemplate({
  heading: 'Email is working',
  paragraphs: [
    'This is a test email from KayVault.',
    'If you can read this, password resets and order updates will reach your users.',
  ],
  button: { label: 'Open KayVault', url: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0] },
});

const ok = await sendMail({ to, subject: 'KayVault test email', html, text });
console.log(ok ? `Test email sent to ${to}. Check the inbox (and the spam folder).` : 'Email was NOT sent. Read the [email] line above for the reason.');
process.exit(ok ? 0 : 1);