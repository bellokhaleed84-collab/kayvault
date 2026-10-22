import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api, fetchBlobUrl } from '../lib/api';

// Admin: the buyer's proof for one refund request (screenshots and screen recordings)
export default function RefundProofs({ purchaseId, who = 'buyer' }) { // KV-RP-WHO
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let dead = false;
    const made = [];
    (async () => {
      try {
        const { proofs: all } = await api.get(`/proofs/purchase/${purchaseId}`);
        const proofs = all.filter((x) => (x.role === 'seller') === (who === 'seller')); // KV-RP-FILTER
        const out = [];
        for (const p of proofs) {
          try {
            const url = await fetchBlobUrl(`/proofs/file/${p.id}`);
            made.push(url);
            out.push({ ...p, url });
          } catch {
            out.push({ ...p, url: null });
          }
        }
        if (!dead) setItems(out);
      } catch (e) {
        if (!dead) setError(e.message);
      }
    })();
    return () => {
      dead = true;
      made.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [purchaseId]);

  return (
    <div className="mt-4 rounded-lg bg-[#0D1524] border border-slate-800 px-4 py-3">
      <p className="text-[11px] font-mono text-slate-600 mb-2">PROOF FROM THE {who.toUpperCase()}</p>
      {error ? (
        <p className="text-xs text-red-400">{error}</p>
      ) : items === null ? (
        <p className="flex items-center gap-2 text-xs text-slate-500"><Loader2 size={13} className="animate-spin" /> Loading proof...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[#D4A94B]">{who === 'seller' ? 'The seller has not uploaded any proof.' : 'No proof attached. This request was sent before proof was required.'}</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {items.map((p) => (
            <div key={p.id}>
              {!p.url ? (
                <p className="text-xs text-red-400">Could not load {p.name}</p>
              ) : p.mime.startsWith('video/') ? (
                <video src={p.url} controls preload="metadata" className="w-full max-h-72 rounded-md border border-slate-800 bg-black" />
              ) : (
                <a href={p.url} target="_blank" rel="noreferrer">
                  <img src={p.url} alt={p.name} className="w-full max-h-72 object-contain rounded-md border border-slate-800 bg-black" />
                </a>
              )}
              <p className="text-[11px] text-slate-600 mt-1 truncate">{p.name}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}