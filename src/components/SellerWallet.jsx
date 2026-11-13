// KV-SELLERWALLET v3 (phone friendly: payments table becomes cards)
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { money, shortDate } from '../lib/orders';
import Skel from './Skeleton';

const th = 'px-5 py-3 font-medium text-xs font-mono text-slate-500';
const STATUS = {
  pending: ['Requested', '#8B5CF6'],
  processing: ['Sending', '#5B8DEF'],
  paid: ['Paid', '#34D399'],
  failed: ['Not completed', '#F87171'],
};

function Payout({ o }) {
  if (o.paid) return <span className="text-xs text-[#34D399]">Paid {shortDate(o.payout_paid_at)}</span>;
  if (o.requested) return <span className="text-xs text-[#5B8DEF]">Withdrawal in progress</span>;
  return <span className="text-xs text-[#8B5CF6]">Available</span>;
}

// Seller wallet: money available to withdraw, withdrawals in progress, and the fee on every sale
export default function SellerWallet() {
  const [data, setData] = useState(null);
  const [wd, setWd] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([api.get('/payouts/mine'), api.get('/withdrawals/mine')]);
      setData(a);
      setWd(b);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function withdraw() {
    const b = wd.bank;
    if (!window.confirm('Withdraw ' + money(wd.available) + ' to ' + b.bank_name + ' (' + b.last4 + ')?')) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.post('/withdrawals', {});
      const s = r.withdrawal.status;
      setMsg({
        ok: true,
        text: s === 'paid'
          ? 'Done. Your money was sent to your bank account.'
          : r.auto && s === 'processing'
            ? 'Your withdrawal is being sent to your bank. This usually takes a few minutes.'
            : 'Withdrawal requested. Our team will send it to your bank account soon.',
      });
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    }
    await load();
    setBusy(false);
  }

  if (error && !data) return <p className="text-red-400 text-sm p-5">{error}</p>;
  if (!data || !wd) {
    return (
      <div className="p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => <Skel key={i} className="h-20 w-full" />)}
        </div>
        <Skel className="h-20 w-full" />
      </div>
    );
  }

  const why = !wd.verified
    ? 'Verify your identity in Settings to withdraw.'
    : !wd.bank
      ? 'Add your bank details in Settings to withdraw.'
      : wd.available <= 0
        ? 'Nothing available yet. Money appears here after the buyer confirms.'
        : wd.available < wd.min
          ? 'The minimum withdrawal is ' + money(wd.min) + '.'
          : '';

  const stats = [
    ['AVAILABLE TO WITHDRAW', wd.available, '#8B5CF6'],
    ['WITHDRAWAL IN PROGRESS', wd.pending, '#5B8DEF'],
    ['PAID OUT', wd.paid_out, '#34D399'],
    ['PLATFORM FEES', data.fees_paid, '#94A3B8'],
  ];

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 p-4 sm:p-5">
        {stats.map(([label, value, color]) => (
          <div key={label} className="rounded-lg bg-[#0D1524] border border-slate-800 p-3.5 sm:p-4 min-w-0">
            <p className="text-[10px] sm:text-[11px] font-mono text-slate-500 mb-1">{label}</p>
            <p className="font-display text-lg sm:text-xl font-semibold break-words" style={{ color }}>{money(value)}</p>
          </div>
        ))}
      </div>

      <div className="mx-4 sm:mx-5 mb-4 rounded-lg bg-[#0D1524] border border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm text-slate-200">
            {wd.bank ? 'Pays to ' + wd.bank.bank_name + ' \u2022\u2022\u2022\u2022 ' + wd.bank.last4 : 'No bank account saved yet'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {why || (wd.auto ? 'Sent to your bank automatically, usually within a few minutes.' : 'Our team sends it to your bank account after you request it.')}
          </p>
          {(!wd.bank || !wd.verified) && <Link to="/settings" className="text-xs text-[#8B5CF6] hover:underline">Open Settings</Link>}
        </div>
        <button type="button" onClick={withdraw} disabled={busy || Boolean(why)}
          className="flex items-center justify-center gap-2 bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-50 text-white font-semibold rounded-xl sm:rounded-lg px-5 py-3.5 sm:py-2.5 text-sm transition-colors sm:shrink-0 w-full sm:w-auto">
          {busy ? <><Loader2 size={15} className="animate-spin" /> Working...</> : <><Banknote size={15} /> Withdraw</>}
        </button>
      </div>
      {msg && <p className={'text-sm px-4 sm:px-5 pb-3 ' + (msg.ok ? 'text-[#34D399]' : 'text-red-400')}>{msg.text}</p>}

      <p className="text-xs text-slate-500 px-4 sm:px-5 pb-4">
        KayVault keeps {data.fee_percent}% of each sale. Money becomes available after the buyer confirms the account, or after 24 hours with no action.
      </p>

      {wd.withdrawals.length > 0 && (
        <div className="border-t border-slate-800">
          <p className="text-[11px] font-mono text-slate-500 px-4 sm:px-5 pt-4 pb-2">YOUR WITHDRAWALS</p>
          <ul>
            {wd.withdrawals.map((w) => {
              const s = STATUS[w.status] || STATUS.pending;
              return (
                <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 border-t border-slate-800">
                  <div>
                    <p className="font-mono text-slate-200">{money(w.amount)}</p>
                    <p className="text-xs text-slate-500">
                      {shortDate(w.created_at)} &middot; {w.order_count} {w.order_count === 1 ? 'order' : 'orders'}
                    </p>
                    {w.note && <p className="text-xs text-slate-400 mt-1">{w.note}</p>}
                  </div>
                  <span className="text-xs font-medium" style={{ color: s[1] }}>{s[0]}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {data.orders.length === 0 ? (
        <p className="text-slate-500 text-sm p-8 text-center border-t border-slate-800">No released payments yet.</p>
      ) : (
        <>
          <ul className="sm:hidden border-t border-slate-800 divide-y divide-slate-800">
            {data.orders.map((o) => (
              <li key={o.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-slate-200 font-medium truncate">{o.game}</p>
                    <p className="text-xs text-slate-500 truncate">{o.tier}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[#8B5CF6] whitespace-nowrap">{money(o.seller_amount)}</p>
                    <p className="text-[10px] font-mono text-slate-600">YOU RECEIVE</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
                  <span className="text-xs text-slate-500">Sale {money(o.price)} &middot; fee -{money(o.platform_fee)}</span>
                  <Payout o={o} />
                </div>
              </li>
            ))}
          </ul>

          <div className="hidden sm:block overflow-x-auto border-t border-slate-800">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className={th}>ORDER</th>
                  <th className={th}>SALE</th>
                  <th className={th}>FEE</th>
                  <th className={th}>YOU RECEIVE</th>
                  <th className={th}>PAYOUT</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((o) => (
                  <tr key={o.id} className="border-b border-slate-800 last:border-0">
                    <td className="px-5 py-3">
                      <p className="text-slate-200 font-medium">{o.game}</p>
                      <p className="text-xs text-slate-500 truncate max-w-[200px]">{o.tier}</p>
                    </td>
                    <td className="px-5 py-3 font-mono text-slate-300 whitespace-nowrap">{money(o.price)}</td>
                    <td className="px-5 py-3 font-mono text-slate-500 whitespace-nowrap">-{money(o.platform_fee)}</td>
                    <td className="px-5 py-3 font-mono text-[#8B5CF6] whitespace-nowrap">{money(o.seller_amount)}</td>
                    <td className="px-5 py-3 whitespace-nowrap"><Payout o={o} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}