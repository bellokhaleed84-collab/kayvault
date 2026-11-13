import { useEffect, useState } from 'react';
import { User, KeyRound, Bell, Building2, Globe, BadgeCheck, LifeBuoy, ChevronDown } from 'lucide-react';
import KycPanel from '../components/KycPanel';
import DashHeader from '../components/DashHeader';
import SupportChat from '../components/SupportChat'; // KV-SUPPORT
import PushToggle from '../components/PushToggle'; // KV-PUSH
import { PasswordField } from '../components/AuthFields';
import { api, setToken } from '../lib/api'; // KV-SEC-SESSION
import { useAuth } from '../lib/AuthContext';
import { COUNTRIES, SELLER_COUNTRY, flag } from '../lib/countries';

const BANKS = [
  'Access Bank', 'Fidelity Bank', 'First Bank', 'FCMB', 'GTBank', 'Kuda', 'Moniepoint',
  'Opay', 'PalmPay', 'Polaris Bank', 'Stanbic IBTC', 'Sterling Bank', 'UBA', 'Union Bank',
  'Wema Bank', 'Zenith Bank',
];

// KV-SUPPORT: common questions. Seller-only ones are marked.
const FAQ = [
  ['How does payment protection (escrow) work?', 'When you pay, KayVault holds the money. The seller only gets paid after you confirm the account works, or after the confirm window ends with no complaint.'],
  ['How long do I have to confirm an order?', 'You have 24 hours after delivery to check the account. If it does not work, ask for a refund before the time runs out.'],
  ['The account does not work. What do I do?', 'Open the order and request a refund with proof, such as a screenshot or short video. The KayVault team reviews it and either refunds you or releases the money to the seller.'],
  ['The account asks for a login code. What do I do?', 'Open your order and use the chat there to ask the seller for the code. If it uses an authenticator app, the order page shows how to get the code.'],
  ['How do game top-ups work?', 'Choose the game and pack, enter your player ID and pay. You can follow the order under Top-ups in your dashboard. If it takes too long, contact us below.'],
  ['I forgot my password.', 'Use "Forgot password" on the login page. When you change your password, your other devices are logged out for your safety.'],
  ['How do I withdraw my earnings?', 'Sellers can withdraw released money from the seller dashboard to the bank account saved in Settings.', 'seller'],
  ['Why are my withdrawals paused?', 'If you change bank details that were already saved, withdrawals pause for 24 hours to protect your money.', 'seller'],
  ['How do I get the Verified badge?', 'Open the Verification tab in Settings and send your ID and selfie. The team will review them.', 'seller'],
];

// KV-PHONE: 08031234567, +2348031234567 and 2348031234567 are all fine
const ngPhoneOk = (v) => {
  const d = String(v || '').replace(/\D/g, '');
  const n = d.length === 13 && d.startsWith('234') ? d.slice(3) : d.length === 11 && d.startsWith('0') ? d.slice(1) : d.length === 10 ? d : '';
  return /^[789]\d{9}$/.test(n);
};

const input =
  'w-full bg-[#0D1524] border border-slate-800 rounded-lg px-3.5 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-[#8B5CF6] transition-colors';
const label = 'block text-xs font-mono text-slate-500 mb-2';
const card = 'rounded-xl bg-[#131B2E] border border-slate-800 p-4 sm:p-6 space-y-5';
const gold =
  'w-full sm:w-auto bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-60 text-white font-semibold rounded-lg px-5 py-3 sm:py-2.5 text-sm transition-colors';

function Msg({ m }) {
  if (!m) return null;
  return <p className={`text-sm ${m.ok ? 'text-[#34D399]' : 'text-red-400'}`}>{m.text}</p>;
}

export default function Settings() {
  const { user, profile, refreshProfile } = useAuth();
  const isSeller = profile?.role === 'seller';
  const urlTab = new URLSearchParams(window.location.search).get('tab');
  const [tab, setTab] = useState(urlTab === 'verification' ? 'verification' : urlTab === 'help' ? 'help' : 'profile'); // KV-P17C-TAB

  const [name, setName] = useState(profile?.full_name || '');
  const [country, setCountry] = useState(profile?.country || '');
  const [phone, setPhone] = useState(profile?.phone || ''); // KV-PHONE
  const [bankName, setBankName] = useState(profile?.bank_name || '');
  const [acctNo, setAcctNo] = useState(profile?.bank_account_number || '');
  const [acctName, setAcctName] = useState(profile?.bank_account_name || '');
  const [notifyEmail, setNotifyEmail] = useState(profile?.notify_email ?? true);
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [bankList, setBankList] = useState(BANKS); // KV-SET-BANKS
  useEffect(() => {
    if (!isSeller) return;
    api.get('/profile/banks')
      .then((r) => { if (Array.isArray(r.banks) && r.banks.length) setBankList(r.banks); })
      .catch(() => {});
  }, [isSeller]);

  const tabs = [
    ['profile', 'Profile', User],
    ['security', 'Security', KeyRound],
    ['notifications', 'Notifications', Bell],
    ...(isSeller ? [['bank', 'Bank details', Building2], ['verification', 'Verification', BadgeCheck]] : []),
    ['help', 'Help & contact', LifeBuoy],
  ];

  async function save(fn, okText) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: okText });
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    }
    setBusy(false);
  }

  const saveProfile = (e) => {
    e.preventDefault();
    if (!name.trim()) return setMsg({ ok: false, text: 'Enter your name.' });
    if (isSeller && phone.trim() && !ngPhoneOk(phone)) return setMsg({ ok: false, text: 'Enter a Nigerian mobile number, for example 08031234567.' });
    save(async () => {
      const r = await api.patch('/profile', { full_name: name, country, ...(isSeller ? { phone } : {}) });
      if (r && r.user && typeof r.user.phone === 'string') setPhone(r.user.phone);
      await refreshProfile();
    }, 'Profile saved.');
  };

  const saveBank = (e) => {
    e.preventDefault();
    if (acctNo && !/^\d{10}$/.test(acctNo)) return setMsg({ ok: false, text: 'A Nigerian account number has 10 digits.' });
    save(async () => {
      await api.patch('/profile', { bank_name: bankName, bank_account_number: acctNo, bank_account_name: acctName });
      await refreshProfile();
    }, 'Bank details saved.');
  };

  const savePassword = (e) => {
    e.preventDefault();
    if (pw.length < 8) return setMsg({ ok: false, text: 'New password must be at least 8 characters.' });
    if (pw !== pw2) return setMsg({ ok: false, text: 'The new passwords do not match.' });
    save(async () => {
      const remember = Boolean(localStorage.getItem('kv_token')); // KV-SEC-SESSION: keep this device logged in the same way
      const r = await api.post('/profile/password', { current_password: cur, new_password: pw, remember });
      if (r && r.token) setToken(r.token, remember); // other devices are logged out by the server
      setCur(''); setPw(''); setPw2('');
    }, 'Password updated. Other devices have been logged out.');
  };

  const toggleEmail = () => {
    const next = !notifyEmail;
    setNotifyEmail(next);
    save(async () => { await api.patch('/profile', { notify_email: next }); await refreshProfile(); }, 'Preference saved.');
  };

  const tabBtn = (active) =>
    `flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm whitespace-nowrap shrink-0 transition-colors ${
      active ? 'bg-[#8B5CF6]/15 text-[#8B5CF6]' : 'text-slate-400 hover:text-slate-100'
    }`;

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-200">
      <DashHeader />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <h1 className="font-display text-2xl sm:text-3xl font-semibold text-slate-100 mb-1">Settings</h1>
        <p className="text-slate-500 text-sm mb-6 sm:mb-8">
          {isSeller ? 'Manage your seller profile, security and payout details.' : 'Manage your profile, security and notifications.'}
        </p>

        <div className="grid lg:grid-cols-[200px_1fr] gap-4 lg:gap-8">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto self-start min-w-0 -mx-4 px-4 pb-1 sm:mx-0 sm:px-0">
            {tabs.map(([v, l, Icon]) => (
              <button key={v} onClick={() => { setTab(v); setMsg(null); }} className={tabBtn(tab === v)}>
                <Icon size={16} /> {l}
              </button>
            ))}
          </nav>

          <div className="max-w-xl min-w-0">
            {tab === 'profile' && (
              <form onSubmit={saveProfile} className={card}>
                <div>
                  <label className={label}>FULL NAME</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} className={input} />
                </div>
                <div>
                  <label className={label}>COUNTRY</label>
                  <div className="relative">
                    <Globe size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
                    <select value={country} onChange={(e) => setCountry(e.target.value)} className={`${input} pl-10 appearance-none`}>
                      <option value="" disabled>Select your country</option>
                      {COUNTRIES.filter(([n]) => !isSeller || n === SELLER_COUNTRY).map(([n, code]) => <option key={code} value={n}>{flag(code)} {n}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={label}>EMAIL</label>
                  <input disabled value={user?.email || ''}
                    className="w-full bg-[#0D1524]/50 border border-slate-800 rounded-lg px-3.5 py-2.5 text-slate-500 text-sm cursor-not-allowed" />
                  <p className="text-xs text-slate-600 mt-2">Your email is your login and cannot be changed here.</p>
                </div>
                {isSeller && (
                  <div>
                    <label className={label}>PHONE NUMBER</label>
                    <input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                      className={`${input} font-mono`} placeholder="08031234567" />
                    <p className="text-xs text-slate-600 mt-2">
                      Buyers only see this number after they pay for one of your accounts, so they can reach you if you are offline.
                    </p>
                  </div>
                )}
                <Msg m={msg} />
                <button type="submit" disabled={busy} className={gold}>{busy ? 'Saving...' : 'Save changes'}</button>
              </form>
            )}

            {tab === 'security' && (
              <form onSubmit={savePassword} className={card}>
                <PasswordField label="CURRENT PASSWORD" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
                <PasswordField label="NEW PASSWORD" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" />
                <PasswordField label="CONFIRM NEW PASSWORD" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
                <Msg m={msg} />
                <button type="submit" disabled={busy} className={gold}>{busy ? 'Updating...' : 'Update password'}</button>
              </form>
            )}

            {tab === 'notifications' && (
              <div className={card}>
                <div className="flex items-center justify-between gap-4 sm:gap-6">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-200">Email me about order updates</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Order updates are also sent to your email. Security emails are always sent.
                    </p>
                  </div>
                  <button type="button" onClick={toggleEmail} aria-pressed={notifyEmail} aria-label="Email notifications"
                    className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${notifyEmail ? 'bg-[#8B5CF6]' : 'bg-slate-700'}`}>
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${notifyEmail ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                <div className="border-t border-slate-800 pt-5">
                  <PushToggle />
                </div>
                <div className="border-t border-slate-800 pt-5">
                  <p className="text-sm text-slate-200">In-app notifications</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Always on. New orders, payments, refunds and reviews appear under the bell at the top of the page.
                  </p>
                </div>
                <Msg m={msg} />
              </div>
            )}

            {tab === 'verification' && isSeller && <KycPanel />}

            {tab === 'bank' && isSeller && (
              <form onSubmit={saveBank} className={card}>
                <div>
                  <label className={label}>BANK NAME</label>
                  <input list="kv-banks" value={bankName} onChange={(e) => setBankName(e.target.value)} className={input} placeholder="e.g. GTBank" />
                  <datalist id="kv-banks">{bankList.map((b) => <option key={b} value={b} />)}</datalist>
                </div>
                <div>
                  <label className={label}>ACCOUNT NUMBER</label>
                  <input inputMode="numeric" maxLength={10} value={acctNo}
                    onChange={(e) => setAcctNo(e.target.value.replace(/\D/g, ''))} className={`${input} font-mono`} placeholder="10 digits" />
                </div>
                <div>
                  <label className={label}>ACCOUNT NAME</label>
                  <input value={acctName} onChange={(e) => setAcctName(e.target.value)} className={input} placeholder="Name on the bank account" />
                </div>
                <p className="text-xs text-slate-500">Earnings are paid to this account. Use an account in your own name.</p>
                <p className="text-xs text-slate-500">For your safety, if you change bank details that are already saved, withdrawals pause for 24 hours.</p>
                <Msg m={msg} />
                <button type="submit" disabled={busy} className={gold}>{busy ? 'Saving...' : 'Save bank details'}</button>
              </form>
            )}

            {tab === 'help' && (
              <div className="space-y-4">
                <div className="rounded-xl bg-[#131B2E] border border-slate-800 p-4 sm:p-6">
                  <h2 className="font-display text-slate-100 font-semibold mb-4">Frequently asked questions</h2>
                  <div className="divide-y divide-slate-800">
                    {FAQ.filter(([, , only]) => !only || (only === 'seller' && isSeller)).map(([q, a]) => (
                      <details key={q} className="group py-3">
                        <summary className="flex items-center justify-between gap-3 cursor-pointer list-none text-sm text-slate-200 min-h-[28px]">
                          <span>{q}</span>
                          <ChevronDown size={16} className="shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
                        </summary>
                        <p className="text-sm text-slate-400 mt-2 leading-relaxed">{a}</p>
                      </details>
                    ))}
                  </div>
                </div>
                <SupportChat />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}