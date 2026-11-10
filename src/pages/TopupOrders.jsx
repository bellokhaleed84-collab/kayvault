// KV-EYAD v1: the buyer's top-up history
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicNavbar from '../components/PublicNavbar';
import Footer from '../components/Footer';
import { api } from '../lib/api';
import { money, shortDate } from '../lib/orders';

const STATUS = {
  pending: ['Waiting for payment', '#D4A94B'],
  paid: ['Payment received', '#5B8DEF'],
  processing: ['Delivering', '#5B8DEF'],
  completed: ['Delivered', '#34D399'],
  failed: ['Payment not completed', '#F87171'],
  refund_needed: ['Refund in progress', '#F87171'],
  refunding: ['Refund in progress', '#F87171'],
  refunded: ['Refunded', '#F87171'],
  refund_failed: ['Refund being sorted by our team', '#D4A94B'],
  check_needed: ['Being checked by our team', '#D4A94B'],
  error: ['Needs attention', '#F87171'],
};
const ACTIVE = new Set(['paid', 'processing']);

export default function TopupOrders() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(() => api.get('/topups/mine').then(setRows).catch((e) => setError(e.message)), []);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  async function refresh(o) {
    setBusy(o.reference);
    try {
      await api.post('/topups/verify', { reference: o.reference });
    } catch (e) {
      setError(e.message);
    }
    await load();
    setBusy('');
  }

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-200">
      <PublicNavbar />
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-end justify-between mb-8">
          <h1 className="font-display text-3xl font-semibold text-slate-100">My top-ups</h1>
          <Link to="/topup" className="text-sm text-[#D4A94B] hover:underline">New top-up</Link>
        </div>
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        {rows === null ? (
          <p className="text-slate-500 text-sm">Loading...</p>
        ) : rows.length === 0 ? (
          <div className="rounded-xl bg-[#131B2E] border border-slate-800 p-10 text-center">
            <p className="text-slate-500 text-sm">No top-ups yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((o) => {
              const [text, color] = STATUS[o.status] || [o.status, '#64748B'];
              return (
                <div key={o.id} className="rounded-xl bg-[#131B2E] border border-slate-800 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-slate-100 font-medium">{o.product_name}</p>
                      <p className="text-sm text-slate-500">{o.offer_name}</p>
                    </div>
                    <p className="font-mono text-[#D4A94B] font-semibold">{money(o.naira_amount)}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
                    <p className="text-xs text-slate-500">
                      {o.player_name ? `${o.player_name} - ` : ''}{o.game_user_id} - {shortDate(o.created_at)}
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium" style={{ color }}>{text}</span>
                      {ACTIVE.has(o.status) && (
                        <button onClick={() => refresh(o)} disabled={busy === o.reference}
                          className="text-xs border border-slate-700 hover:border-slate-500 text-slate-400 rounded-lg px-3 py-1 disabled:opacity-40">
                          {busy === o.reference ? 'Checking...' : 'Check status'}
                        </button>
                      )}
                    </div>
                  </div>
                  {o.fail_reason && ['refund_needed', 'refunding', 'refunded', 'refund_failed', 'failed'].includes(o.status) && (
                    <p className="text-xs text-slate-500 mt-2">{o.fail_reason}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}