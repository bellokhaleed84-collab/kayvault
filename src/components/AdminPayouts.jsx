import { useCallback, useEffect, useState } from 'react';
import { Clock, CheckCircle2, Wallet, RotateCcw, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';
import { money, shortDate } from '../lib/orders';
import AdminWithdrawals from './AdminWithdrawals'; // KV-WD-ADMINIMP

const card = 'rounded-xl bg-[#131B2E] border border-slate-800';
const goldBtn = 'flex items-center justify-center gap-1.5 bg-[#D4A94B] hover:bg-[#c49a3f] disabled:opacity-60 text-[#0B1120] font-semibold rounded-lg px-4 py-2 text-xs transition-colors';
const redBtn = 'flex items-center justify-center gap-1.5 bg-[#F87171] hover:bg-[#ef5b5b] disabled:opacity-60 text-[#0B1120] font-semibold rounded-lg px-4 py-2 text-xs transition-colors';
const ghostBtn = 'flex items-center justify-center gap-1.5 border border-slate-700 hover:border-slate-500 disabled:opacity-60 text-slate-300 rounded-lg px-4 py-2 text-xs transition-colors';

function Block({ title, hint, children }) {
  return (
    <section>
      <h2 className="font-display text-lg font-semibold text-slate-100">{title}</h2>
      {hint && <p className="text-xs text-slate-500 mt-1 mb-3">{hint}</p>}
      {children}
    </section>
  );
}

function Empty({ children }) {
  return (
    <div className={`${card} p-8 text-center`}>
      <p className="text-slate-500 text-sm">{children}</p>
    </div>
  );
}

// Admin: who to pay, what to refund, and the platform money totals
export default function AdminPayouts() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [notes, setNotes] = useState({});

  const load = useCallback(async () => {
    try {
      setData(await api.get('/payouts/summary'));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function act(key, fn) {
    setBusy(key);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    }
    await load();
    setBusy('');
  }

  function markPaid(s) {
    const msg = `Confirm you sent ${money(s.total)} to ${s.name}? This marks ${s.count} ${s.count === 1 ? 'order' : 'orders'} as paid and notifies the seller.`;
    if (!window.confirm(msg)) return;
    act(`pay-${s.seller_id}`, () =>
      api.post(`/payouts/seller/${s.seller_id}/mark-paid`, { order_ids: s.order_ids, note: notes[s.seller_id] || '' })
    );
  }

  function refundPayment(p, manual) {
    const msg = manual
      ? `Mark ${money(p.amount)} for ${p.game} as already refunded (done in the Paystack dashboard)?`
      : `Refund ${money(p.amount)} to ${p.buyer_name || 'the buyer'} through Paystack?`;
    if (!window.confirm(msg)) return;
    act(`pref-${p.reference}`, () => api.post(`/payouts/payment-refund/${p.reference}`, { manual }));
  }

  function retryRefund(o, manual) {
    const msg = manual
      ? `Mark ${money(o.price)} for ${o.game} as already refunded (done in the Paystack dashboard)?`
      : `Send ${money(o.price)} back to ${o.buyer_name || 'the buyer'} through Paystack?`;
    if (!window.confirm(msg)) return;
    act(`ret-${o.id}`, () => api.post(`/payouts/refund-retry/${o.id}`, { manual }));
  }

  if (!data) {
    return error ? <p className="text-red-400 text-sm">{error}</p> : <p className="text-slate-500 text-sm">Loading...</p>;
  }

  const t = data.totals;
  const cards = [
    [Clock, 'Owed to sellers', money(t.owed), '#D4A94B', `${data.sellers.length} ${data.sellers.length === 1 ? 'seller' : 'sellers'} waiting`],
    [CheckCircle2, 'Paid out', money(t.paid_out), '#34D399', 'sent to sellers'],
    [Wallet, 'Platform fees', money(t.fees), '#5B8DEF', `${t.fee_percent}% of released sales`],
    [RotateCcw, 'Refunded', money(t.refunded), '#F87171', 'returned to buyers'],
  ];

  return (
    <div className="space-y-8">
      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(([Icon, label, value, color, sub]) => (
          <div key={label} className={`${card} p-5`}>
            <Icon size={18} style={{ color }} className="mb-3" />
            <p className="text-slate-500 text-xs font-mono mb-1">{label.toUpperCase()}</p>
            <p className="font-display text-2xl font-semibold text-slate-100">{value}</p>
            <p className="text-xs text-slate-600 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* KV-WD-ADMINUI */}
      <AdminWithdrawals onChange={load} />

      <Block title="Sellers to pay" hint="Send each seller their share from your bank, then press Mark as paid. Amounts are already after the platform fee.">
        {data.sellers.length === 0 ? (
          <Empty>Nobody is waiting to be paid.</Empty>
        ) : (
          <div className="space-y-4">
            {data.sellers.map((s) => (
              <div key={s.seller_id} className={`${card} p-5`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-slate-100 font-semibold">
                      {s.name}
                      {s.suspended && <span className="ml-2 text-[11px] text-[#F87171]">Suspended, payout on hold</span>}
                    </h3>
                    <p className="text-xs text-slate-500">{s.email} &middot; {s.count} {s.count === 1 ? 'order' : 'orders'}</p>
                  </div>
                  <p className="font-mono text-xl text-[#D4A94B]">{money(s.total)}</p>
                </div>

                {s.bank_account_number && s.bank_name ? (
                  <dl className="grid sm:grid-cols-3 gap-4 mt-4 text-sm">
                    <div><dt className="text-[11px] font-mono text-slate-600">BANK</dt><dd className="text-slate-200">{s.bank_name}</dd></div>
                    <div><dt className="text-[11px] font-mono text-slate-600">ACCOUNT NUMBER</dt><dd className="font-mono text-slate-200">{s.bank_account_number}</dd></div>
                    <div><dt className="text-[11px] font-mono text-slate-600">ACCOUNT NAME</dt><dd className="text-slate-200">{s.bank_account_name || '-'}</dd></div>
                  </dl>
                ) : (
                  <p className="flex items-center gap-2 text-sm text-[#D4A94B] mt-4">
                    <AlertTriangle size={15} /> This seller has not added bank details yet. Ask them to add them in Settings.
                  </p>
                )}

                <div className="flex flex-col sm:flex-row gap-3 mt-5 pt-4 border-t border-slate-800">
                  <input
                    value={notes[s.seller_id] || ''}
                    onChange={(e) => setNotes({ ...notes, [s.seller_id]: e.target.value })}
                    maxLength={120}
                    placeholder="Transfer reference (optional)"
                    className="flex-1 bg-[#0D1524] border border-slate-800 rounded-lg px-3.5 py-2 text-slate-200 text-sm focus:outline-none focus:border-[#D4A94B]"
                  />
                  <button onClick={() => markPaid(s)} disabled={s.suspended || busy === `pay-${s.seller_id}`} className={goldBtn}>
                    <CheckCircle2 size={14} /> {busy === `pay-${s.seller_id}` ? 'Saving...' : 'Mark as paid'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Block>

      <Block title="Payments to refund" hint="The buyer paid, but the account was no longer available or the order could not be created.">
        {data.payments_to_refund.length === 0 ? (
          <Empty>No payments need a refund.</Empty>
        ) : (
          <div className="space-y-4">
            {data.payments_to_refund.map((p) => (
              <div key={p.reference} className={`${card} p-5`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-slate-100 font-semibold">{p.game || 'Order'}</h3>
                    <p className="text-xs text-slate-500">{p.buyer_name} &middot; {p.buyer_email} &middot; {shortDate(p.created_at)}</p>
                    <p className="text-[11px] font-mono text-slate-600 mt-1">{p.reference}</p>
                  </div>
                  <p className="font-mono text-xl text-[#D4A94B]">{money(p.amount)}</p>
                </div>
                {p.refund_error && <p className="text-xs text-red-400 mt-3">Last attempt failed: {p.refund_error}</p>}
                <div className="flex gap-2 mt-5 pt-4 border-t border-slate-800">
                  <button onClick={() => refundPayment(p, false)} disabled={busy === `pref-${p.reference}`} className={redBtn}>
                    <RotateCcw size={14} /> Refund via Paystack
                  </button>
                  <button onClick={() => refundPayment(p, true)} disabled={busy === `pref-${p.reference}`} className={ghostBtn}>
                    I refunded it in Paystack
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Block>

      <Block title="Refunds that need attention" hint="You approved these refunds, but Paystack did not accept the refund yet.">
        {data.refunds_to_retry.length === 0 ? (
          <Empty>No refunds need attention.</Empty>
        ) : (
          <div className="space-y-4">
            {data.refunds_to_retry.map((o) => (
              <div key={o.id} className={`${card} p-5`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-slate-100 font-semibold">{o.game}</h3>
                    <p className="text-xs text-slate-500">{o.buyer_name} &middot; {o.buyer_email}</p>
                  </div>
                  <p className="font-mono text-xl text-[#D4A94B]">{money(o.price)}</p>
                </div>
                {o.refund_error && <p className="text-xs text-red-400 mt-3">Paystack said: {o.refund_error}</p>}
                <div className="flex gap-2 mt-5 pt-4 border-t border-slate-800">
                  <button onClick={() => retryRefund(o, false)} disabled={busy === `ret-${o.id}`} className={redBtn}>
                    <RotateCcw size={14} /> Retry Paystack refund
                  </button>
                  <button onClick={() => retryRefund(o, true)} disabled={busy === `ret-${o.id}`} className={ghostBtn}>
                    I refunded it in Paystack
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Block>
    </div>
  );
}