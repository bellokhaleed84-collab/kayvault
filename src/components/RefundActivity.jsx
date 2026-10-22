import { Fragment } from 'react';

const when = (d) =>
  d ? new Date(d).toLocaleString('en', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '-';

function gap(ms) {
  const m = Math.round(ms / 60000);
  if (m < 1) return 'under a minute';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)} days`;
}

// Admin: what the buyer actually did before asking for the refund, and what the seller said
export default function RefundActivity({ p }) {
  const delivered = p.delivered_at ? new Date(p.delivered_at).getTime() : null;
  const first = p.first_revealed_at ? new Date(p.first_revealed_at).getTime() : null;
  const asked = p.refund_requested_at ? new Date(p.refund_requested_at).getTime() : null;
  const tracked = p.reveal_count !== undefined; // older orders were placed before opening the details was logged

  const rows = [['DELIVERED', when(p.delivered_at), '#E2E8F0']];

  if (!tracked) {
    rows.push(['LOGIN DETAILS', 'Not tracked for this older order', '#94A3B8']);
  } else if (!first) {
    rows.push(['LOGIN DETAILS', 'The buyer never opened the login details', '#F87171']);
  } else {
    const after = delivered ? `${gap(first - delivered)} after delivery` : when(p.first_revealed_at);
    rows.push(['LOGIN DETAILS', `First opened ${after}, ${p.reveal_count} ${p.reveal_count === 1 ? 'time' : 'times'} in total`, '#E2E8F0']);
  }

  if (asked) {
    const quick = first && asked - first < 5 * 60000;
    const text = first
      ? `${when(p.refund_requested_at)} (${gap(Math.max(0, asked - first))} after first opening the details)`
      : when(p.refund_requested_at);
    rows.push(['REFUND ASKED', text, quick ? '#D4A94B' : '#E2E8F0']);
  }

  return (
    <div className="mt-4 rounded-lg bg-[#0D1524] border border-slate-800 px-4 py-3">
      <p className="text-[11px] font-mono text-slate-600 mb-2">BUYER ACTIVITY</p>
      <dl className="grid grid-cols-[110px_1fr] gap-x-4 gap-y-1.5 text-sm">
        {rows.map(([k, v, c]) => (
          <Fragment key={k}>
            <dt className="text-[11px] font-mono text-slate-600 pt-0.5">{k}</dt>
            <dd style={{ color: c }}>{v}</dd>
          </Fragment>
        ))}
      </dl>

      <div className="mt-3 pt-3 border-t border-slate-800">
        <p className="text-[11px] font-mono text-slate-600 mb-1">SELLER&apos;S REPLY</p>
        {p.seller_reply ? (
          <>
            <p className="text-sm text-slate-300 whitespace-pre-line">{p.seller_reply}</p>
            <p className="text-[11px] text-slate-600 mt-1">Replied {when(p.seller_replied_at)}</p>
          </>
        ) : (
          <p className="text-sm text-slate-500">
            No reply yet.{p.seller_reply_due ? ` The seller has until ${when(p.seller_reply_due)}.` : ''}
          </p>
        )}
      </div>
    </div>
  );
}