import { useState } from 'react';
import { api } from '../lib/api';
import { Stars, StarInput } from './Stars';

// Shown on a completed order: the buyer rates the seller once
export default function ReviewBox({ purchaseId, existing, onDone }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await api.post('/reviews', { purchase_id: purchaseId, rating, comment });
      await onDone();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  if (existing) {
    return (
      <div className="rounded-xl bg-[#131B2E] border border-slate-800 p-5">
        <p className="text-[11px] font-mono text-slate-500 mb-3">YOUR REVIEW</p>
        <Stars value={existing.rating} size={16} />
        {existing.comment && <p className="text-sm text-slate-400 mt-3">{existing.comment}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-[#131B2E] border border-slate-800 p-5">
      <p className="text-[11px] font-mono text-slate-500 mb-3">RATE THIS SELLER</p>
      <StarInput value={rating} onChange={setRating} />
      <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500}
        placeholder="How was the account and the seller? (optional)"
        className="w-full mt-3 bg-[#0D1524] border border-slate-800 rounded-lg px-3.5 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-[#D4A94B]" />
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      <button onClick={submit} disabled={busy || rating === 0}
        className="w-full mt-3 bg-[#D4A94B] hover:bg-[#c49a3f] disabled:opacity-60 text-[#0B1120] font-semibold rounded-lg py-2.5 text-sm transition-colors">
        {busy ? 'Sending...' : 'Submit review'}
      </button>
    </div>
  );
}