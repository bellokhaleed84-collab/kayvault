export const ORDER_STATUS = {
  held: { label: 'Awaiting confirmation', color: '#D4A94B', bg: 'bg-[#D4A94B]/10' },
  released: { label: 'Completed', color: '#34D399', bg: 'bg-[#34D399]/10' },
  refund_requested: { label: 'Refund requested', color: '#5B8DEF', bg: 'bg-[#5B8DEF]/10' },
  refunded: { label: 'Refunded', color: '#F87171', bg: 'bg-[#F87171]/10' },
};

export const TABS = [
  ['all', 'All'],
  ['active', 'Active'],
  ['delivered', 'Delivered'],
  ['secure', 'Secure Requests'],
];

// Active = waiting for the buyer, Delivered = completed, Secure Requests = refund flow
export const inTab = (p, tab) =>
  tab === 'all' ||
  (tab === 'active' && p.escrow_status === 'held') ||
  (tab === 'delivered' && p.escrow_status === 'released') ||
  (tab === 'secure' && (p.escrow_status === 'refund_requested' || p.escrow_status === 'refunded'));

export function timeLeft(deadline, now = Date.now()) {
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - now;
  if (ms <= 0) return { expired: true, text: 'Window closed', pct: 0 };
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return { expired: false, text: `${h}h ${m}m left`, pct: Math.min(100, (ms / 86400000) * 100) };
}

export const money = (n) => '\u20A6' + Number(n || 0).toLocaleString();

export const shortDate = (d) =>
  d ? new Date(d).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' }) : '';