// KV-ADMINCREDS v1
import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { api } from '../lib/api';

const when = (d) =>
  d ? new Date(d).toLocaleString('en', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
const ACTIONS = { reveal_credentials: 'Opened the login details' };

// Admin: look at the saved login details of an order in a refund case. Every check is recorded.
export default function AdminCredCheck({ purchaseId }) {
  const [log, setLog] = useState([]);
  const [creds, setCreds] = useState(null);
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadLog = useCallback(
    () => api.get(`/admin/orders/${purchaseId}/audit`).then(setLog).catch(() => {}),
    [purchaseId]
  );
  useEffect(() => { loadLog(); }, [loadLog]);

  async function check() {
    if (!window.confirm('Open the login details for this order? This check is recorded in the audit log with your name and the time.')) return;
    setBusy(true);
    setError('');
    try {
      setCreds(await api.post(`/admin/orders/${purchaseId}/credentials`));
      setShowPw(false);
      await loadLog();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  return (
    <div className="mt-4 rounded-lg bg-[#0D1524] border border-slate-800 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <p className="text-[11px] font-mono text-slate-600">ACCOUNT CHECK</p>
        {!creds ? (
          <button type="button" onClick={check} disabled={busy}
            className="flex items-center gap-1.5 border border-[#D4A94B]/60 text-[#D4A94B] hover:bg-[#D4A94B]/10 disabled:opacity-60 font-semibold rounded-lg px-3 py-1.5 text-xs transition-colors">
            <KeyRound size={13} /> {busy ? 'Opening...' : 'Check login details'}
          </button>
        ) : (
          <button type="button" onClick={() => setCreds(null)} className="text-xs text-slate-500 hover:text-slate-300">Hide details</button>
        )}
      </div>

      <p className="flex items-center gap-1.5 text-[11px] text-slate-600 mb-2">
        <ShieldAlert size={12} className="text-[#D4A94B]" /> Every check is recorded in the audit log.
      </p>

      {creds && (
        <div className="space-y-2 mb-3">
          <div>
            <p className="text-[11px] font-mono text-slate-600">LOGIN</p>
            <p className="font-mono text-sm text-slate-200 break-all">{creds.login}</p>
          </div>
          <div>
            <p className="text-[11px] font-mono text-slate-600">PASSWORD</p>
            <div className="flex items-center gap-2">
              <p className="font-mono text-sm text-slate-200 break-all">{showPw ? creds.password : '\u2022'.repeat(Math.min((creds.password || '').length, 14))}</p>
              <button type="button" onClick={() => setShowPw(!showPw)} aria-label={showPw ? 'Hide' : 'Show'} className="text-slate-500 hover:text-slate-300">
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          {creds.notes && <p className="text-xs text-slate-400 whitespace-pre-line">{creds.notes}</p>}
        </div>
      )}

      {error && <p className="text-red-400 text-xs mb-2">{error}</p>}

      <p className="text-[11px] font-mono text-slate-600 mb-1">AUDIT LOG</p>
      {log.length === 0 ? (
        <p className="text-xs text-slate-500">No checks yet.</p>
      ) : (
        <ul className="space-y-1">
          {log.map((r) => (
            <li key={r.id} className="text-xs text-slate-400">
              {ACTIONS[r.action] || r.action} &middot; {r.admin_name || 'Admin'} &middot; {when(r.created_at)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
