import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { money, shortDate } from '../lib/orders';

const th = 'px-5 py-3 font-medium text-xs font-mono text-slate-500';

// Seller wallet: what is waiting to be paid out, what was paid, and the fee on every sale
export default function SellerWallet() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/payouts/mine').then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-red-400 text-sm p-5">{error}</p>;
  if (!data) return <p className="text-slate-500 text-sm p-5">Loading...</p>;

  const stats = [
    ['AWAITING PAYOUT', data.awaiting_payout, '#D4A94B'],
    ['PAID OUT', data.paid_out, '#34D399'],
    ['PLATFORM FEES', data.fees_paid, '#5B8DEF'],
  ];

  return (
    <div>
      <div className="grid sm:grid-cols-3 gap-4 p-5">
        {stats.map(([label, value, color]) => (
          <div key={label} className="rounded-lg bg-[#0D1524] border border-slate-800 p-4">
            <p className="text-[11px] font-mono text-slate-500 mb-1">{label}</p>
            <p className="font-display text-xl font-semibold" style={{ color }}>{money(value)}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500 px-5 pb-4">
        KayVault keeps {data.fee_percent}% of each sale. After the buyer confirms, our team sends your share to your bank account and marks it as paid.
      </p>

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
                    ) : (
                      <span className="text-xs text-[#D4A94B]">Awaiting payout</span>
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