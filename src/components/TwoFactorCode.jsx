// KV-TWOFA v1: the buyer taps "Get code" and sees the current authenticator code for the account they bought
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyRound, Copy, Check, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import Skel from './Skeleton';

export default function TwoFactorCode({ orderId }) {
  const [info, setInfo] = useState(null);
  const [code, setCode] = useState(null);
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const inflight = useRef(false);

  useEffect(() => {
    api.get('/twofa/order/' + orderId).then(setInfo).catch((e) => setError(e.message));
  }, [orderId]);

  const fetchCode = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    setBusy(true);
    setError('');
    try {
      const r = await api.post('/twofa/order/' + orderId + '/code');
      setCode(r.code);
      setLeft(r.seconds_left);
    } catch (e) {
      setError(e.message);
      setCode(null);
    }
    inflight.current = false;
    setBusy(false);
  }, [orderId]);

  // count down once a second
  useEffect(() => {
    if (!code) return undefined;
    const t = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => clearInterval(t);
  }, [code]);

  // when the code runs out, get the next one (only while the page is open on screen)
  useEffect(() => {
    if (code && left <= 0) {
      if (document.visibilityState === 'visible') fetchCode();
      else setCode(null);
    }
  }, [left, code, fetchCode]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the code is on screen */
    }
  }

  if (!info && !error) {
    return (
      <div className="rounded-xl bg-[#131B2E] border border-slate-800 p-6 space-y-3">
        <Skel className="h-5 w-40" />
        <Skel className="h-12 w-full" />
      </div>
    );
  }
  if (info && info.mode === 'none') return null;

  return (
    <div className="rounded-xl bg-[#131B2E] border border-slate-800 p-6">
      <div className="flex items-center gap-2 mb-3">
        <KeyRound size={16} className="text-[#D4A94B]" />
        <h2 className="font-display text-slate-100 font-semibold">Login code (2FA)</h2>
      </div>

      {info && info.mode === 'message' && (
        <p className="text-sm text-slate-400">
          This account sends its login codes to the seller's email or phone. When the game asks for a code, ask the seller in the chat below.
        </p>
      )}

      {info && info.mode === 'authenticator' && !info.available && (
        <p className="text-sm text-slate-500">Login codes are no longer available for this order.</p>
      )}

      {info && info.mode === 'authenticator' && info.available && (
        <div>
          {code ? (
            <div>
              <div className="flex items-center gap-3 bg-[#0D1524] border border-slate-800 rounded-lg px-4 py-4">
                <span className="flex-1 font-mono text-3xl tracking-widest text-slate-100">{code.slice(0, 3) + ' ' + code.slice(3)}</span>
                <button type="button" onClick={copy} aria-label="Copy code" className="p-2 text-slate-500 hover:text-[#D4A94B]">
                  {copied ? <Check size={20} className="text-[#34D399]" /> : <Copy size={20} />}
                </button>
              </div>
              <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden mt-3">
                <div className={'h-full ' + (left <= 5 ? 'bg-[#F87171]' : 'bg-[#D4A94B]')} style={{ width: Math.max(0, Math.min(100, (left / 30) * 100)) + '%' }} />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {left <= 5 ? 'About to change. A new code is coming.' : 'This code changes in ' + Math.max(0, left) + ' seconds.'}
              </p>
            </div>
          ) : (
            <button type="button" onClick={fetchCode} disabled={busy}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#D4A94B] hover:bg-[#c49a3f] disabled:opacity-60 text-[#0B1120] font-semibold rounded-lg px-6 py-3 text-sm transition-colors">
              <RefreshCw size={15} className={busy ? 'animate-spin' : ''} /> {busy ? 'Getting code...' : 'Get code'}
            </button>
          )}
          <p className="text-xs text-slate-500 mt-4">
            Type this code into the game when it asks for 2-step verification. Once you are in, change the 2FA to your own phone so only you can open the account.
          </p>
        </div>
      )}

      {error && <p className="text-red-400 text-xs mt-3">{error}</p>}
    </div>
  );
}