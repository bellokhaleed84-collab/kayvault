import { useState } from 'react';
import { AlertTriangle, Send } from 'lucide-react';
import { api } from '../lib/api';
import { money, timeLeft } from '../lib/orders';
import CaseChat from './CaseChat';
import SellerProofs from './SellerProofs';

// Seller: refund requests waiting for the seller's side of the story
export default function SellerDisputes({ sales, onDone }) {
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const open = sales.filter((p) => p.escrow_status === 'refund_requested');
  if (open.length === 0) return null;

  async function send(p) {
    setBusy(p.id);
    setError('');
    try {
      await api.post(`/disputes/${p.id}/reply`, { note: notes[p.id] || '' });
      await onDone();
    } catch (e) {
      setError(e.message);
    }
    setBusy('');
  }

  return (
    <div className="rounded-xl border border-[#D4A94B]/40 bg-[#D4A94B]/5 p-5 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle size={16} className="text-[#D4A94B]" />
        <h2 className="font-display text-slate-100 font-semibold">Refund requests need your reply</h2>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        A buyer asked for a refund. Tell our team your side. You can reply once, so include everything: what you delivered and anything that shows the account works.
      </p>

      <div className="space-y-4">
        {open.map((p) => {
          const t = timeLeft(p.seller_reply_due);
          return (
            <div key={p.id} className="rounded-lg bg-[#131B2E] border border-slate-800 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-slate-100 font-medium">{p.game}</p>
                  <p className="text-xs text-slate-500">{p.tier}</p>
                </div>
                <p className="font-mono text-[#D4A94B]">{money(p.price)}</p>
              </div>

              <div className="mt-3 rounded-lg bg-[#0D1524] border border-slate-800 px-3.5 py-2.5">
                <p className="text-[11px] font-mono text-slate-600 mb-1">BUYER&apos;S REASON</p>
                <p className="text-sm text-slate-300 whitespace-pre-line">{p.refund_reason || 'No reason given.'}</p>
              </div>

              <CaseChat purchaseId={p.id} mode="user" />

              <SellerProofs purchaseId={p.id} />

              {p.seller_reply ? (
                <div className="mt-3">
                  <p className="text-[11px] font-mono text-slate-600 mb-1">YOUR REPLY</p>
                  <p className="text-sm text-slate-300 whitespace-pre-line">{p.seller_reply}</p>
                </div>
              ) : (
                <div className="mt-3 space-y-2.5">
                  <p className="text-xs text-slate-500">
                    {!t
                      ? 'Please reply as soon as you can.'
                      : t.expired
                        ? 'The reply window has closed. You can still reply until our team decides.'
                        : `${t.text} to reply.`}
                  </p>
                  <textarea rows={3} maxLength={500} value={notes[p.id] || ''}
                    onChange={(e) => setNotes({ ...notes, [p.id]: e.target.value })}
                    placeholder="e.g. The account was working when I delivered it. The login is correct and the buyer has not tried 2-step verification."
                    className="w-full bg-[#0D1524] border border-slate-800 rounded-lg px-3.5 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-[#D4A94B]" />
                  <button onClick={() => send(p)} disabled={busy === p.id || (notes[p.id] || '').trim().length < 5}
                    className="flex items-center gap-2 bg-[#D4A94B] hover:bg-[#c49a3f] disabled:opacity-60 text-[#0B1120] font-semibold rounded-lg px-4 py-2 text-xs transition-colors">
                    <Send size={13} /> {busy === p.id ? 'Sending...' : 'Send reply'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {error && <p className="text-red-400 text-xs mt-3">{error}</p>}
    </div>
  );
}