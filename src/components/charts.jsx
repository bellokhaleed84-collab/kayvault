// Small dependency-free SVG charts for the seller dashboard

export function EarningsChart({ data, format }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const W = 480, H = 200, padX = 8, padB = 28, top = 14;
  const bw = (W - padX * 2) / data.length;
  const plotH = H - padB - top;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Earnings by month">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={padX} x2={W - padX} y1={top + plotH * (1 - f)} y2={top + plotH * (1 - f)}
          stroke="#1E293B" strokeWidth="1" />
      ))}
      <line x1={padX} x2={W - padX} y1={H - padB} y2={H - padB} stroke="#334155" strokeWidth="1" />
      {data.map((d, i) => {
        const h = d.value ? Math.max(4, plotH * (d.value / max)) : 3;
        const x = padX + i * bw + bw * 0.22;
        const w = bw * 0.56;
        return (
          <g key={d.label + i}>
            <rect x={x} y={H - padB - h} width={w} height={h} rx="4"
              fill={d.value ? '#D4A94B' : '#334155'} opacity={d.value ? 1 : 0.6}>
              <title>{`${d.label}: ${format(d.value)}`}</title>
            </rect>
            <text x={x + w / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#64748B">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function StatusDonut({ parts }) {
  const total = parts.reduce((t, p) => t + p.value, 0);
  const r = 46, c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 120 120" className="w-32 h-32 shrink-0" role="img" aria-label="Listings by status">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#1E293B" strokeWidth="14" />
        {total > 0 && parts.map((p) => {
          const len = (p.value / total) * c;
          const el = (
            <circle key={p.label} cx="60" cy="60" r={r} fill="none" stroke={p.color} strokeWidth="14"
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset}
              transform="rotate(-90 60 60)" />
          );
          offset += len;
          return el;
        })}
        <text x="60" y="58" textAnchor="middle" fontSize="20" fontWeight="600" fill="#F1F5F9">{total}</text>
        <text x="60" y="74" textAnchor="middle" fontSize="9" fill="#64748B">listings</text>
      </svg>
      <ul className="space-y-2.5 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
            <span className="text-slate-400">{p.label}</span>
            <span className="font-mono text-slate-200 ml-auto pl-4">{p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}