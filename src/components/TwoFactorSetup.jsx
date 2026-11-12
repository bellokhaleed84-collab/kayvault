// KV-TWOFA v1: seller form section. How do login codes reach the buyer?
import { useEffect, useState } from 'react';
import { KeyRound, Mail, ShieldOff, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api';

const MODES = [
  ['authenticator', 'Authenticator app', 'The buyer gets the code instantly. Best choice.', KeyRound],
  ['message', 'Codes go to email or phone', 'The buyer asks you in the chat and you send the code.', Mail],
  ['none', 'No 2FA on this account', 'Nothing extra to send.', ShieldOff],
];

const input =
  'w-full bg-[#0D1524] border border-slate-800 rounded-lg px-3.5 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-[#D4A94B] transition-colors';
const label = 'block text-xs font-mono text-slate-500 mb-2';

// value: { twofa_mode, twofa_secret, twofa_confirmed }. onChange(patch) updates the form. hasSaved: a key is already saved (edit page).
export default function TwoFactorSetup({ value, onChange, hasSaved = false }) {
  const [preview, setPreview] = useState(null); // { code, left }
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const mode = value.twofa_mode;

  useEffect(() => {
    if (!preview) return undefined;
    const t = setInterval(() => setPreview((p) => (p ? { ...p, left: Math.max(0, p.left - 1) } : p)), 1000);
    return () => clearInterval(t);
  }, [preview ? preview.code : null]); // eslint-disable-line react-hooks/exhaustive-deps

  function pickMode(m) {
    setPreview(null);
    setErr('');
    onChange({ twofa_mode: m, twofa_confirmed: false });
  }

  function typeKey(e) {
    setPreview(null);
    setErr('');
    onChange({ twofa_secret: e.target.value, twofa_confirmed: false });
  }

  async function check() {
    setErr('');
    if (!value.twofa_secret.trim()) return setErr('Paste the key first.');
    setBusy(true);
    try {
      const r = await api.post('/listings/twofa-preview', { twofa_secret: value.twofa_secret });
      if (!r.valid) {
        setPreview(null);
        setErr('That key does not look right. Copy it again from the game.');
      } else {
        setPreview({ code: r.code, left: r.seconds_left });
      }
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-[#0D1524]/50 p-4 space-y-4">
      <div>
        <p className="text-sm text-slate-200 font-medium">How do login codes (2FA) reach the buyer?</p>
        <p className="text-xs text-slate-500 mt-1">Many games ask for a code when the buyer signs in. Pick what applies to this account.</p>
      </div>

      <div className="space-y-2.5">
        {MODES.map(([m, title, sub, Icon]) => (
          <button key={m} type="button" onClick={() => pickMode(m)}
            className={'w-full flex items-start gap-3 rounded-lg border px-4 py-3.5 text-left transition-colors ' +
              (mode === m ? 'border-[#D4A94B] bg-[#D4A94B]/10' : 'border-slate-800 bg-[#131B2E] hover:border-slate-600')}>
            <Icon size={18} className={'mt-0.5 shrink-0 ' + (mode === m ? 'text-[#D4A94B]' : 'text-slate-500')} />
            <span>
              <span className="block text-sm text-slate-100 font-medium">{title}</span>
              <span className="block text-xs text-slate-500 mt-0.5">{sub}</span>
            </span>
          </button>
        ))}
      </div>

      {mode === 'authenticator' && (
        <div className="space-y-4">
          <div className="rounded-lg bg-[#131B2E] border border-slate-800 p-4">
            <p className="text-xs font-mono text-[#D4A94B] mb-2">HOW TO GET THE KEY ON YOUR PHONE</p>
            <ol className="space-y-2 text-sm text-slate-400 list-decimal pl-5">
              <li>Open the game, go to Account or Security settings and turn on 2-step verification. Choose "Authenticator app".</li>
              <li>The game shows a QR code. Under it, tap "Can't scan?" or "Enter key manually" and copy the long key of letters and numbers.</li>
              <li>In Google Authenticator or Microsoft Authenticator on your phone, tap +, choose "Enter a setup key", and paste the same key. This makes the game accept the setup.</li>
              <li>Paste the key below and tap "Check key". The 6 digit code shown here must match the one in your app.</li>
            </ol>
            <p className="text-xs text-slate-500 mt-3">No authenticator option in this game? Choose "Codes go to email or phone" instead.</p>
          </div>

          <div>
            <label className={label}>AUTHENTICATOR KEY</label>
            <input value={value.twofa_secret} onChange={typeKey} className={input + ' font-mono uppercase'} autoComplete="off" spellCheck={false}
              placeholder={hasSaved ? 'Leave empty to keep the saved key' : 'Paste the key here'} />
            <p className="text-xs text-slate-600 mt-2">Saved encrypted. Only used to show the buyer the code after they pay.</p>
          </div>

          <button type="button" onClick={check} disabled={busy || !value.twofa_secret.trim()}
            className="w-full sm:w-auto border border-[#D4A94B]/60 text-[#D4A94B] hover:bg-[#D4A94B]/10 disabled:opacity-40 font-semibold rounded-lg px-6 py-3 text-sm transition-colors">
            {busy ? 'Checking...' : preview ? 'Check again' : 'Check key'}
          </button>

          {preview && (
            <div className="rounded-lg bg-[#131B2E] border border-slate-800 p-4 space-y-3">
              <p className="text-xs font-mono text-slate-500">CODE FROM YOUR KEY</p>
              <p className="font-mono text-3xl tracking-widest text-slate-100">{preview.code.slice(0, 3) + ' ' + preview.code.slice(3)}</p>
              <p className="text-xs text-slate-500">
                {preview.left > 0 ? 'Valid for about ' + preview.left + ' more seconds. Compare it with your app now.' : 'This code has changed. Tap "Check again" to see the new one.'}
              </p>
              <label className="flex items-start gap-3 text-sm text-slate-300 cursor-pointer pt-1">
                <input type="checkbox" checked={Boolean(value.twofa_confirmed)} onChange={(e) => onChange({ twofa_confirmed: e.target.checked })}
                  className="accent-[#D4A94B] w-5 h-5 mt-0.5 shrink-0" />
                The code matches the one in my authenticator app.
              </label>
              {value.twofa_confirmed && <p className="flex items-center gap-1.5 text-xs text-[#34D399]"><CheckCircle2 size={14} /> Key confirmed</p>}
            </div>
          )}
          {err && <p className="text-red-400 text-xs">{err}</p>}
        </div>
      )}

      {mode === 'message' && (
        <p className="text-xs text-slate-500 leading-relaxed">
          After the buyer pays, they can chat with you from the order. Check your Orders page often so you can send the code quickly.
        </p>
      )}
    </div>
  );
}