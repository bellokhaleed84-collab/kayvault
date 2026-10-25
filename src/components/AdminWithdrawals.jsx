// KV-ADMINWD v1
import { useCallback, useEffect, useState } from 'react';
import { Banknote, CheckCircle2, XCircle, RefreshCw, Send } from 'lucide-react';
import { api } from '../lib/api';
import { money, shortDate } from '../lib/orders';

const card = 'rounded-xl bg-[#131B2E] border border-slate-800';
const goldBtn = 'flex items-center justify-center gap-1.5 bg-[#D4A94B] hover:bg-[#c49a3f] disabled:opacity-60 text-[#0B1120] font-semibold rounded-lg px-4 py-2 text-xs transition-colors';
const ghostBtn = 'flex items-center justify-center gap-1.5 border border-slate-700 hover:border-slate-500 disabled:opacity-60 text-slate-300 rounded-lg px-4 py-2 text-xs transition-colors';
const redBtn = 'flex items-center justify-center gap-1.5 border border-[#F87171]/50 text-[#F87171] hover:bg-[#F87171]/10 disabled:opacity-60 rounded-lg px-4 py-2 text-xs transition-colors';
const STATUS = { pending: ['Waiting to be paid', '#D4A94B'], processing: ['Sending via Paystack', '#5B8DEF'], paid: ['Paid', '#34D399'], failed: ['Rejected or failed', '#F87171'] };

// Admin: seller withdrawal requests. In automatic mode most of these pay themselves.
export default function AdminWithdrawals({ onChange }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [notes, setNotes] = useState({});

  const load = useCallback(async () => {
    try {
      setData(await api.get('/withdrawals/admin/list'));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 30000);
    return () => clearInterval(t);
  }, [load]);

  async function act(key, fn) {
    setBusy(key);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    }
    await load();
    if (onChange) onChange();
    setBusy('');
  }

  function markPaid(w) {
    const msg = 'Confirm you sent ' + money(w.amount) + ' to ' + w.seller_name + ' (' + w.bank_name + ' ' + w.bank_account_number + ')? The seller is notified.';
    if (!window.confirm(msg)) return;
    act('paid-' + w.id, () => api.post('/withdrawals/admin/' + w.id + '/paid', { note: notes[w.id] || '' }));
  }

  function reject(w) {
    const reason = window.prompt('Why is this withdrawal rejected? The seller will see this, and the money goes back to their wallet.');
    if (reason === null) return;
    act('rej-' + w.id, () => api.post('/withdrawals/admin/' + w.id + '/reject', { reason }));
  }

  function send(w) {
    if (!window.confirm('Send ' + money(w.amount) + ' to ' + w.seller_name + ' through Paystack now?')) return;
    act('send-' + w.id, () => api.post('/withdrawals/admin/' + w.id + '/send'));
  }

  function check(w) {
    act('chk-' + w.id, () => api.post('/withdrawals/admin/' + w.id + '/check'));
  }

  if (!data) {
    return error ? <p className="text-red-400 text-sm">{error}</p> : <p className="text-slate-500 text-sm">Loading...</p>;
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-slate-100 flex items-center gap-2">
          <Banknote size={18} className="text-[#D4A94B]" /> Withdrawal requests
        </h2>
        <span className={'text-xs font-mono ' + (data.auto ? 'text-[#34D399]' : 'text-slate-500')}>
          AUTOMATIC PAYOUTS: {data.auto ? 'ON' : 'OFF'}
        </span>
      </div>
      <p className="text-xs text-slate-500 mt-1 mb-3">
        {data.auto
          ? 'Withdrawals are sent through Paystack automatically. Anything that could not be sent shows here so you can retry it or pay it by hand.'
          : 'Send each seller their money from your bank, then press Mark as paid. Minimum withdrawal: ' + money(data.min) + '.'}
      </p>
      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      {data.open.length === 0 ? (
        <div className={card + ' p-8 text-center'}>
          <p className="text-slate-500 text-sm">No withdrawals waiting.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.open.map((w) => {
            const s = STATUS[w.status] || STATUS.pending;
            return (
              <div key={w.id} className={card + ' p-5'}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-slate-100 font-semibold">
                      {w.seller_name}
                      {w.suspended && <span className="ml-2 text-[11px] text-[#F87171]">Suspended, payout on hold</span>}
                    </h3>
                    <p className="text-xs text-slate-500">{w.seller_email} &middot; {w.order_count} {w.order_count === 1 ? 'order' : 'orders'} &middot; {shortDate(w.created_at)}</p>
                    <p className="text-xs mt-1" style={{ color: s[1] }}>{s[0]}</p>
                  </div>
                  <p className="font-mono text-xl text-[#D4A94B]">{money(w.amount)}</p>
                </div>

                <dl className="grid sm:grid-cols-3 gap-4 mt-4 text-sm">
                  <div><dt className="text-[11px] font-mono text-slate-600">BANK</dt><dd className="text-slate-200">{w.bank_name}</dd></div>
                  <div><dt className="text-[11px] font-mono text-slate-600">ACCOUNT NUMBER</dt><dd className="font-mono text-slate-200">{w.bank_account_number}</dd></div>
                  <div><dt className="text-[11px] font-mono text-slate-600">ACCOUNT NAME</dt><dd className="text-slate-200">{w.bank_account_name || '-'}</dd></div>
                </dl>

                {w.error && <p className="text-xs text-red-400 mt-3">{w.error}</p>}

                {w.status === 'pending' && (
                  <div className="flex flex-col sm:flex-row gap-3 mt-5 pt-4 border-t border-slate-800">
                    <input value={notes[w.id] || ''} onChange={(e) => setNotes({ ...notes, [w.id]: e.target.value })}
                      maxLength={120} placeholder="Transfer reference (optional)"
                      className="flex-1 bg-[#0D1524] border border-slate-800 rounded-lg px-3.5 py-2 text-slate-200 text-sm focus:outline-none focus:border-[#D4A94B]" />
                    {data.auto && (
                      <button onClick={() => send(w)} disabled={w.suspended || busy === 'send-' + w.id} className={goldBtn}>
                        <Send size={14} /> {busy === 'send-' + w.id ? 'Sending...' : 'Send via Paystack'}
                      </button>
                    )}
                    <button onClick={() => markPaid(w)} disabled={w.suspended || busy === 'paid-' + w.id} className={data.auto ? ghostBtn : goldBtn}>
                      <CheckCircle2 size={14} /> {busy === 'paid-' + w.id ? 'Saving...' : 'Mark as paid'}
                    </button>
                    <button onClick={() => reject(w)} disabled={busy === 'rej-' + w.id} className={redBtn}>
                      <XCircle size={14} /> Reject
                    </button>
                  </div>
                )}

                {w.status === 'processing' && (
                  <div className="flex gap-2 mt-5 pt-4 border-t border-slate-800">
                    <button onClick={() => check(w)} disabled={busy === 'chk-' + w.id} className={ghostBtn}>
                      <RefreshCw size={14} /> {busy === 'chk-' + w.id ? 'Checking...' : 'Check with Paystack'}
                    </button>
                    <p className="text-xs text-slate-500 self-center">Do not pay this one by hand. Check again in a few minutes.</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {data.recent.length > 0 && (
        <div className={card + ' mt-4'}>
          <p className="text-[11px] font-mono text-slate-500 px-5 pt-4 pb-2">RECENT</p>
          <ul>
            {data.recent.map((w) => {
              const s = STATUS[w.status] || STATUS.paid;
              return (
                <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 border-t border-slate-800 text-sm">
                  <span className="text-slate-300">{w.seller_name} &middot; <span className="font-mono">{money(w.amount)}</span></span>
                  <span className="text-xs" style={{ color: s[1] }}>{s[0]} &middot; {shortDate(w.paid_at || w.created_at)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}