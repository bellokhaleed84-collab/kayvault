import { BadgeCheck } from 'lucide-react';

export default function VerifiedBadge({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-[#34D399]/10 text-[#34D399] px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${className}`}>
      <BadgeCheck size={12} /> Verified
    </span>
  );
}