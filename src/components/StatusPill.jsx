import { ORDER_STATUS } from '../lib/orders';

export default function StatusPill({ status }) {
  const s = ORDER_STATUS[status] || ORDER_STATUS.held;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${s.bg}`}
      style={{ color: s.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" /> {s.label}
    </span>
  );
}