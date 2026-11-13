// KV-EYAD v2: the buyer's top-up history (phone friendly)
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicNavbar from '../components/PublicNavbar';
import Footer from '../components/Footer';
import Skel from '../components/Skeleton';
import { api } from '../lib/api';
import { money, shortDate } from '../lib/orders';

const STATUS = {
  pending: ['Waiting for payment', '#8B5CF6'],
  paid: ['Payment received', '#5B8DEF'],
  processing: ['Delivering', '#5B8DEF'],
  completed: ['Delivered', '#34D399'],
  failed: ['Payment not completed', '#F87171'],
  refund_needed: ['Refund in progress', '#F87171'],
  refunding: ['Refund in progress', '#F87171'],
  refunded: ['Refunded', '#F87171'],
  refund_failed: ['Refund being sorted by our team', '#8B5CF6'],
  check_needed: ['Being checked by our team', '#8B5CF6'],
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
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 20000);
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex items-end justify-between gap-4 mb-6 sm:mb-8">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-slate-100">My top-ups</h1>
          <Link to="/topup" className="text-sm text-[#8B5CF6] hover:underline py-1">New top-up</Link>
        </div>
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        {rows === null ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => <Skel key={i} className="h-28 w-full rounded-xl" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl bg-[#131B2E] border border-slate-800 p-8 sm:p-10 text-center">
            <p className="text-slate-500 text-sm mb-4">No top-ups yet.</p>
            <Link to="/topup" className="inline-block bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-semibold rounded-lg px-5 py-3 text-sm transition-colors">
              Top up a game
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((o) => {
              const [text, color] = STATUS[o.status] || [o.status, '#64748B'];
              return (
                <div key={o.id} className="rounded-xl bg-[#131B2E] border border-slate-800 p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-slate-100 font-medium break-words">{o.product_name}</p>
                      <p className="text-sm text-slate-500 break-words">{o.offer_name}</p>
                    </div>
                    <p className="font-mono text-[#8B5CF6] font-semibold whitespace-nowrap">{money(o.naira_amount)}</p>
                  </div>
                  <p className="text-xs text-slate-500 mt-3 break-words">
                    {o.player_name ? `${o.player_name} - ` : ''}{o.game_user_id} - {shortDate(o.created_at)}
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
                    <span className="text-xs font-medium" style={{ color }}>{text}</span>
                    {ACTIVE.has(o.status) && (
                      <button onClick={() => refresh(o)} disabled={busy === o.reference}
                        className="text-xs border border-slate-700 hover:border-slate-500 text-slate-300 rounded-lg px-4 py-2.5 disabled:opacity-40">
                        {busy === o.reference ? 'Checking...' : 'Check status'}
                      </button>
                    )}
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