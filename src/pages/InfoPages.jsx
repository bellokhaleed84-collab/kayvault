// KV-INFOPAGES v1
import { useEffect } from 'react';
import PublicNavbar from '../components/PublicNavbar';
import Footer from '../components/Footer';

// Change this one line when you have your real support email
const SUPPORT_EMAIL = 'support@your-domain.com';
const UPDATED = 'October 2026';

function Shell({ title, intro, children }) {
  useEffect(() => { window.scrollTo(0, 0); }, [title]);
  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-200">
      <PublicNavbar />
      <main className="max-w-3xl mx-auto px-6 py-12">
        <p className="text-xs font-mono text-[#D4A94B] mb-3">KAYVAULT</p>
        <h1 className="font-display text-3xl md:text-4xl font-bold text-slate-100">{title}</h1>
        {intro && <p className="text-slate-500 text-sm mt-3">{intro}</p>}
        <div className="mt-10 space-y-8">{children}</div>
      </main>
      <Footer />
    </div>
  );
}

function Section({ title, items }) {
  return (
    <section>
      <h2 className="font-display text-lg font-semibold text-slate-100 mb-3">{title}</h2>
      <div className="space-y-3">
        {items.map((t, i) => <p key={i} className="text-sm text-slate-400 leading-relaxed">{t}</p>)}
      </div>
    </section>
  );
}

function Contact() {
  return (
    <section className="rounded-xl bg-[#131B2E] border border-slate-800 p-5">
      <p className="text-sm text-slate-400">Questions about this page? Email us at <span className="text-[#D4A94B]">{SUPPORT_EMAIL}</span>.</p>
    </section>
  );
}

const TERMS = [
  ['1. About KayVault', [
    'KayVault is an online marketplace where sellers list gaming accounts and buyers purchase them. KayVault is not the owner or the seller of the accounts. We provide the marketplace, escrow payment protection and dispute handling.',
    'By creating an account or using KayVault you agree to these Terms. If you do not agree, please do not use the service.',
  ]],
  ['2. Who can use KayVault', [
    'You must be at least 18 years old and able to enter a binding contract. You must give true information and keep it up to date. One person may hold one account.',
    'Sellers must be located in Nigeria. Buyers can join from Nigeria, Ghana, Kenya, South Africa and Cote d\'Ivoire. We may change this list over time.',
  ]],
  ['3. Your account', [
    'You are responsible for your password and for everything that happens under your account. Tell us at once if you think someone else has used it. We may suspend or close accounts that break these Terms or put other users at risk.',
  ]],
  ['4. Listings', [
    'Sellers must own the account they sell or have the full right to sell it. Stolen, hacked, shared or fraudulent accounts are not allowed. Listings must describe the account honestly, including level, items, platform and any limits.',
    'Every new listing is reviewed by our team before it goes live, and a live listing that is edited goes back to review. We may refuse or remove any listing.',
    'Sellers give us the login details of the account so they can be delivered to the buyer. These details are stored encrypted and are shown only to the buyer after payment.',
  ]],
  ['5. Buying and escrow', [
    'Buyers pay in Naira through Paystack. KayVault holds the payment in escrow. After payment, the buyer can open the login details.',
    'The buyer has 24 hours from delivery to check the account and either confirm it or ask for a refund. Confirming releases the money to the seller and cannot be undone. If the buyer does nothing for 24 hours, the money is released to the seller automatically.',
  ]],
  ['6. Refunds and disputes', [
    'If the account does not work or does not match the listing, the buyer can ask for a refund inside the 24 hour window. A refund request needs a written reason and proof, such as screenshots or a screen recording.',
    'The seller is asked to reply with their side, and we may message either person for more information. Our team reviews the proof, the messages, the seller reply and how the buyer used the login details, then decides to refund the buyer or release the money to the seller.',
    'Approved refunds are sent back through Paystack to the original payment method. Banks and Paystack can take several days to complete a refund.',
  ]],
  ['7. Fees and payouts', [
    'KayVault charges sellers a platform fee, currently 12 percent of the sale price. The fee is taken from the sale, and the seller receives the rest. The fee is shown in the seller dashboard.',
    'Payouts are sent by bank transfer to the account the seller saved in Settings, after the money is released from escrow. Payouts are currently processed by our team. Bank details must belong to the seller. We may hold a payout while an account is suspended or under review.',
  ]],
  ['8. Seller verification', [
    'Sellers must verify their identity before their listings can go live and before they can be paid. A seller sends a photo of a government ID (National ID, driver\'s licence or international passport) and a selfie, and gets a Verified badge once approved. We use these only to check identity and delete them after the review period described in our Privacy Policy.',
  ]],
  ['9. What is not allowed', [
    'Taking back or recovering an account after it was sold. Selling or sharing the same account more than once. Making false refund claims. Moving a deal or payment outside KayVault to avoid escrow. Fake reviews or extra accounts used to cheat. Harassing other users. Anything illegal, or anything that harms the platform or its users.',
  ]],
  ['10. Game publishers and risk', [
    'KayVault is not connected to any game publisher. Game names and logos belong to their owners. Some publishers do not allow accounts to be sold or transferred. Users take that risk, and KayVault is not responsible if a publisher bans, locks or changes an account.',
  ]],
  ['11. Suspension and ending', [
    'We may suspend or close an account, remove listings and hold payouts if we believe these Terms were broken or there is a risk of fraud. You can stop using KayVault at any time. Money already held in escrow is still handled under these Terms.',
  ]],
  ['12. Limits of our responsibility', [
    'KayVault is provided as it is. To the extent the law allows, we are not responsible for indirect or lost-profit losses, or for the actions of sellers, buyers, game publishers or payment providers. Where we are responsible, our liability is limited to the amount of the transaction in question.',
  ]],
  ['13. Changes to these Terms', [
    'We may update these Terms. The date at the top shows the latest version. If you keep using KayVault after a change, you accept the new Terms.',
  ]],
  ['14. Governing law', [
    'These Terms are governed by the laws of the Federal Republic of Nigeria.',
  ]],
];

const PRIVACY = [
  ['1. About this policy', [
    'This policy explains what personal information KayVault collects, why, and what choices you have. We handle personal data in line with the Nigeria Data Protection Act 2023.',
  ]],
  ['2. Information we collect', [
    'Account: your name, email address, country, role (buyer or seller) and a password, which we store only as a hash that cannot be read back.',
    'Sellers: bank name, account number and account name so we can pay you. For seller verification: your ID type, a photo of your ID and a selfie.',
    'Listings: the details and pictures you upload, and the game login details you give us for delivery, which we store encrypted.',
    'Orders and payments: order records, payment references and amounts. Card and bank details are handled by Paystack. We never see or store your card number.',
    'Refund cases: your written reason, screenshots or screen recordings you upload, and messages between you and our support team.',
    'Technical: your IP address and basic request logs, used for security, spam and fraud prevention. Your browser stores a login token so you stay signed in. We do not use advertising cookies.',
  ]],
  ['3. How we use it', [
    'To run the marketplace, take payments, deliver accounts, hold and release escrow, pay sellers, handle refunds and disputes, verify sellers, send you order and security emails, prevent fraud and abuse, and meet legal duties.',
  ]],
  ['4. Who we share it with', [
    'We use trusted service providers to run KayVault: Paystack for payments, Resend for email, Cloudinary for file storage, MongoDB Atlas for our database, and Render and Vercel for hosting. They only get what they need to do their job.',
    'Other users see limited information: a seller\'s name, join date, country, ratings and number of sales; reviews show a first name and initial. Sellers do not see a buyer\'s email address.',
    'We may share information when the law requires it or to protect users from fraud. We do not sell your personal data.',
  ]],
  ['5. How long we keep it', [
    'Verification photos are deleted 14 days after our team approves or rejects the request. Refund proof files are deleted 30 days after the case is resolved. Support messages are deleted after 120 days. Notifications are deleted after 60 days. Order and payment records are kept as long as needed for accounting, fraud prevention and legal reasons.',
  ]],
  ['6. How we protect it', [
    'Game login details are encrypted. Passwords are hashed. Verification photos and proof files are kept in private storage and are shown only to authorised staff. Our team can open the login details of an order only while a refund case is open, and every such check is recorded in an audit log. No system is perfectly secure, but we work to protect your data.',
  ]],
  ['7. Your rights', [
    'You can ask to see, correct or delete your personal data, to object to how we use it, or to withdraw consent where we rely on it. Email us and we will reply as soon as we can. Some records must be kept by law. You can also complain to the Nigeria Data Protection Commission.',
  ]],
  ['8. Children', [
    'KayVault is for people aged 18 and over. We do not knowingly collect data from children.',
  ]],
  ['9. Changes', [
    'We may update this policy. The date at the top shows the latest version.',
  ]],
];

const FAQ = [
  ['Buying', [
    ['How does escrow work?', 'You pay through Paystack and KayVault holds the money. The seller does not get paid until you confirm the account works, or until 24 hours pass after delivery with no action from you.'],
    ['How do I get the login details?', 'After your payment is confirmed, open the order from My Purchases and press Reveal login details. Change the password and recovery email straight away.'],
    ['What if the account does not work?', 'Open the order within the 24 hour window and choose Request refund. Write what went wrong and add a screenshot or screen recording. Our team reviews it and decides.'],
    ['How long does a refund take?', 'Once approved, the refund is sent back through Paystack. Your bank can take several days to show it.'],
    ['Where can I buy from?', 'Buyers can join from Nigeria, Ghana, Kenya, South Africa and Cote d\'Ivoire. Prices are in Naira.'],
  ]],
  ['Selling', [
    ['How do I start selling?', 'Sign up with the Seller option. Sellers must be in Nigeria for now. Verify your identity in Settings (ID photo and selfie), add bank details, then create a listing. Our team reviews it before it goes live.'],
    ['What does it cost?', 'KayVault keeps a 12 percent platform fee from each sale. You receive the rest.'],
    ['When do I get paid?', 'After the buyer confirms, or after 24 hours with no action, the money is released. Our team then sends it to your bank account. You get a notification when it is paid.'],
    ['How do I get the Verified badge?', 'Go to Settings, open Verification, and send a photo of your ID and a selfie. Our team will review them.'],
    ['Why is my listing waiting?', 'Every new listing, and every edited live listing, is checked by our team before it shows to buyers.'],
    ['A buyer asked for a refund. What do I do?', 'Reply with your side from your dashboard within 12 hours, and add proof that the account worked. Our team makes the final decision.'],
  ]],
  ['Staying safe', [
    ['Will KayVault ever ask for my password?', 'No. Never send your KayVault password or a game account password to anyone, and keep all payments inside KayVault so escrow can protect you.'],
  ]],
];

export function Terms() {
  return (
    <Shell title="Terms of Service" intro={'Last updated: ' + UPDATED}>
      {TERMS.map(([t, items]) => <Section key={t} title={t} items={items} />)}
      <Contact />
    </Shell>
  );
}

export function Privacy() {
  return (
    <Shell title="Privacy Policy" intro={'Last updated: ' + UPDATED}>
      {PRIVACY.map(([t, items]) => <Section key={t} title={t} items={items} />)}
      <Contact />
    </Shell>
  );
}

export function Help() {
  return (
    <Shell title="Help Center and FAQ" intro="Quick answers about buying, selling and escrow.">
      {FAQ.map(([group, qs]) => (
        <section key={group}>
          <h2 className="font-display text-xl font-semibold text-[#D4A94B] mb-4">{group}</h2>
          <div className="space-y-3">
            {qs.map(([q, a]) => (
              <div key={q} className="rounded-xl bg-[#131B2E] border border-slate-800 p-5">
                <h3 className="font-display text-slate-100 font-semibold mb-1.5">{q}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </section>
      ))}
      <Contact />
    </Shell>
  );
}