import { useEffect, useState } from 'react';
import { User, KeyRound, Bell, Building2, Globe, BadgeCheck } from 'lucide-react';
import KycPanel from '../components/KycPanel';
import DashHeader from '../components/DashHeader';
import { PasswordField } from '../components/AuthFields';
import { api } from '../lib/api';
import { useAuth } from '../lib/AuthContext';
import { COUNTRIES, SELLER_COUNTRY, flag } from '../lib/countries';

const BANKS = [
  'Access Bank', 'Fidelity Bank', 'First Bank', 'FCMB', 'GTBank', 'Kuda', 'Moniepoint',
  'Opay', 'PalmPay', 'Polaris Bank', 'Stanbic IBTC', 'Sterling Bank', 'UBA', 'Union Bank',
  'Wema Bank', 'Zenith Bank',
];

const input =
  'w-full bg-[#0D1524] border border-slate-800 rounded-lg px-3.5 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-[#D4A94B] transition-colors';
const label = 'block text-xs font-mono text-slate-500 mb-2';
const card = 'rounded-xl bg-[#131B2E] border border-slate-800 p-6 space-y-5';
const gold =
  'bg-[#D4A94B] hover:bg-[#c49a3f] disabled:opacity-60 text-[#0B1120] font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors';

function Msg({ m }) {
  if (!m) return null;
  return <p className={`text-sm ${m.ok ? 'text-[#34D399]' : 'text-red-400'}`}>{m.text}</p>;
}

export default function Settings() {
  const { user, profile, refreshProfile } = useAuth();
  const isSeller = profile?.role === 'seller';
  const [tab, setTab] = useState('profile');

  const [name, setName] = useState(profile?.full_name || '');
  const [country, setCountry] = useState(profile?.country || '');
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
    save(async () => { await api.patch('/profile', { full_name: name, country }); await refreshProfile(); }, 'Profile saved.');
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
      await api.post('/profile/password', { current_password: cur, new_password: pw });
      setCur(''); setPw(''); setPw2('');
    }, 'Password updated.');
  };

  const toggleEmail = () => {
    const next = !notifyEmail;
    setNotifyEmail(next);
    save(async () => { await api.patch('/profile', { notify_email: next }); await refreshProfile(); }, 'Preference saved.');
  };

  const tabBtn = (active) =>
    `flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm whitespace-nowrap transition-colors ${
      active ? 'bg-[#D4A94B]/15 text-[#D4A94B]' : 'text-slate-400 hover:text-slate-100'
    }`;

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-200">
      <DashHeader />

      <div className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="font-display text-3xl font-semibold text-slate-100 mb-1">Settings</h1>
        <p className="text-slate-500 text-sm mb-8">
          {isSeller ? 'Manage your seller profile, security and payout details.' : 'Manage your profile, security and notifications.'}
        </p>

        <div className="grid lg:grid-cols-[200px_1fr] gap-8">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto self-start">
            {tabs.map(([v, l, Icon]) => (
              <button key={v} onClick={() => { setTab(v); setMsg(null); }} className={tabBtn(tab === v)}>
                <Icon size={16} /> {l}
              </button>
            ))}
          </nav>

          <div className="max-w-xl">
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
                <div className="flex items-center justify-between gap-6">
                  <div>
                    <p className="text-sm text-slate-200">Email me about order updates</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Email delivery is not switched on yet. Your choice is saved and will apply when it is.
                    </p>
                  </div>
                  <button type="button" onClick={toggleEmail} aria-pressed={notifyEmail} aria-label="Email notifications"
                    className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${notifyEmail ? 'bg-[#D4A94B]' : 'bg-slate-700'}`}>
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${notifyEmail ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
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
                <p className="text-xs text-slate-500">Earnings are paid to this account once live payments launch. Use an account in your own name.</p>
                <Msg m={msg} />
                <button type="submit" disabled={busy} className={gold}>{busy ? 'Saving...' : 'Save bank details'}</button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}