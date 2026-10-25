// KV-SELLERWALLET v2
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { money, shortDate } from '../lib/orders';

const th = 'px-5 py-3 font-medium text-xs font-mono text-slate-500';
const STATUS = {
  pending: ['Requested', '#D4A94B'],
  processing: ['Sending', '#5B8DEF'],
  paid: ['Paid', '#34D399'],
  failed: ['Not completed', '#F87171'],
};

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
  if (!data || !wd) return <p className="text-slate-500 text-sm p-5">Loading...</p>;

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
    ['AVAILABLE TO WITHDRAW', wd.available, '#D4A94B'],
    ['WITHDRAWAL IN PROGRESS', wd.pending, '#5B8DEF'],
    ['PAID OUT', wd.paid_out, '#34D399'],
    ['PLATFORM FEES', data.fees_paid, '#94A3B8'],
  ];

  return (
    <div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 p-5">
        {stats.map(([label, value, color]) => (
          <div key={label} className="rounded-lg bg-[#0D1524] border border-slate-800 p-4">
            <p className="text-[11px] font-mono text-slate-500 mb-1">{label}</p>
            <p className="font-display text-xl font-semibold" style={{ color }}>{money(value)}</p>
          </div>
        ))}
      </div>

      <div className="mx-5 mb-4 rounded-lg bg-[#0D1524] border border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm text-slate-200">
            {wd.bank ? 'Pays to ' + wd.bank.bank_name + ' \u2022\u2022\u2022\u2022 ' + wd.bank.last4 : 'No bank account saved yet'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {why || (wd.auto ? 'Sent to your bank automatically, usually within a few minutes.' : 'Our team sends it to your bank account after you request it.')}
          </p>
          {(!wd.bank || !wd.verified) && <Link to="/settings" className="text-xs text-[#D4A94B] hover:underline">Open Settings</Link>}
        </div>
        <button type="button" onClick={withdraw} disabled={busy || Boolean(why)}
          className="flex items-center justify-center gap-2 bg-[#D4A94B] hover:bg-[#c49a3f] disabled:opacity-50 text-[#0B1120] font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors shrink-0">
          {busy ? <><Loader2 size={15} className="animate-spin" /> Working...</> : <><Banknote size={15} /> Withdraw</>}
        </button>
      </div>
      {msg && <p className={'text-sm px-5 pb-3 ' + (msg.ok ? 'text-[#34D399]' : 'text-red-400')}>{msg.text}</p>}

      <p className="text-xs text-slate-500 px-5 pb-4">
        KayVault keeps {data.fee_percent}% of each sale. Money becomes available after the buyer confirms the account, or after 24 hours with no action.
      </p>

      {wd.withdrawals.length > 0 && (
        <div className="border-t border-slate-800">
          <p className="text-[11px] font-mono text-slate-500 px-5 pt-4 pb-2">YOUR WITHDRAWALS</p>
          <ul>
            {wd.withdrawals.map((w) => {
              const s = STATUS[w.status] || STATUS.pending;
              return (
                <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-t border-slate-800">
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
        <div className="overflow-x-auto border-t border-slate-800">
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
                  <td className="px-5 py-3 font-mono text-[#D4A94B] whitespace-nowrap">{money(o.seller_amount)}</td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    {o.paid ? (
                      <span className="text-xs text-[#34D399]">Paid {shortDate(o.payout_paid_at)}</span>
                    ) : o.requested ? (
                      <span className="text-xs text-[#5B8DEF]">Withdrawal in progress</span>
                    ) : (
                      <span className="text-xs text-[#D4A94B]">Available</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}