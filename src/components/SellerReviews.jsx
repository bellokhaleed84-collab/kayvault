import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { shortDate } from '../lib/orders';
import { Stars } from './Stars';

// Reviews section for the listing page. Renders nothing until the seller has reviews.
export default function SellerReviews({ sellerId, name }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    if (sellerId) api.get(`/reviews/seller/${sellerId}`).then(setData).catch(() => {});
  }, [sellerId]);

  if (!data || data.count === 0) return null;

  return (
    <section className="mt-16">
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <h2 className="font-display text-2xl font-semibold text-slate-100">Reviews for {name}</h2>
        <div className="flex items-center gap-2">
          <Stars value={data.avg} size={16} />
          <span className="text-sm text-slate-400">{data.avg} from {data.count} {data.count === 1 ? 'review' : 'reviews'}</span>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {data.reviews.slice(0, 6).map((r) => (
          <div key={r.id} className="rounded-xl bg-[#131B2E] border border-slate-800 p-5">
            <div className="flex items-center justify-between mb-2">
              <Stars value={r.rating} />
              <span className="text-xs text-slate-600">{shortDate(r.created_at)}</span>
            </div>
            {r.comment && <p className="text-sm text-slate-300 leading-relaxed mb-3">{r.comment}</p>}
            <p className="text-xs text-slate-500">{r.buyer_name}{r.game ? ` \u00b7 bought ${r.game}` : ''}</p>
          </div>
        ))}
      </div>
    </section>
  );
}