import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, Clock, PackageCheck, ChevronRight } from 'lucide-react';
import DashHeader from '../components/DashHeader';
import GameArt from '../components/GameArt';
import StatusPill from '../components/StatusPill';
import { api, assetUrl } from '../lib/api';
import { useAuth } from '../lib/AuthContext';
import { TABS, inTab, timeLeft, money, shortDate } from '../lib/orders';

export default function BuyerDashboard() {
  const { profile } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('all');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    api.get('/purchases/mine')
      .then(setPurchases)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  const stats = useMemo(() => {
    const sum = (f) => purchases.filter(f).reduce((t, p) => t + (p.price || 0), 0);
    return {
      orders: purchases.length,
      escrow: sum((p) => p.escrow_status === 'held' || p.escrow_status === 'refund_requested'),
      spent: sum((p) => p.escrow_status === 'released'),
    };
  }, [purchases]);

  const shown = purchases.filter((p) => inTab(p, tab));
  const cards = [
    { icon: PackageCheck, label: 'Total orders', value: stats.orders, color: '#34D399' },
    { icon: Clock, label: 'In escrow', value: money(stats.escrow), color: '#5B8DEF' },
    { icon: Wallet, label: 'Total spent', value: money(stats.spent), color: '#D4A94B' },
  ];

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-200">
      <DashHeader />

      <div className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="font-display text-3xl font-semibold text-slate-100 mb-1">My Purchases</h1>
        <p className="text-slate-500 text-sm mb-8">
          {profile?.full_name ? `Welcome back, ${profile.full_name.split(' ')[0]}. ` : ''}
          Open an order to see your login details and confirm the account.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
          {cards.map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="rounded-xl bg-[#131B2E] border border-slate-800 p-5">
              <Icon size={18} style={{ color }} className="mb-3" />
              <p className="text-slate-500 text-xs font-mono mb-1">{label.toUpperCase()}</p>
              <p className="font-display text-2xl font-semibold text-slate-100">{value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {TABS.map(([v, l]) => {
            const n = purchases.filter((p) => inTab(p, v)).length;
            return (
              <button
                key={v}
                onClick={() => setTab(v)}
                className={`rounded-full px-4 py-1.5 text-xs font-medium border transition-colors ${
                  tab === v
                    ? 'bg-[#D4A94B] border-[#D4A94B] text-[#0B1120]'
                    : 'border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {l} <span className={tab === v ? 'text-[#0B1120]/70' : 'text-slate-600'}>{n}</span>
              </button>
            );
          })}
        </div>

        {error && <p className="text-red-400 text-sm mb-6">{error}</p>}

        {loading ? (
          <p className="text-slate-500 text-sm">Loading your orders...</p>
        ) : shown.length === 0 ? (
          <div className="rounded-xl bg-[#131B2E] border border-slate-800 p-10 text-center">
            <p className="text-slate-500 text-sm mb-4">
              {purchases.length === 0 ? 'You have not bought an account yet.' : 'No orders in this tab.'}
            </p>
            {purchases.length === 0 && (
              <Link
                to="/browse"
                className="inline-block bg-[#D4A94B] hover:bg-[#c49a3f] text-[#0B1120] font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors"
              >
                Browse listings
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {shown.map((p) => {
              const t = p.escrow_status === 'held' ? timeLeft(p.confirm_deadline, now) : null;
              const image = p.has_image ? assetUrl(`/api/listings/${p.listing}/image/0`) : null;
              return (
                <Link
                  key={p.id}
                  to={`/orders/${p.id}`}
                  className="group rounded-xl bg-[#131B2E] border border-slate-800 hover:border-[#D4A94B]/50 transition-colors p-4 flex items-center gap-4"
                >
                  <GameArt game={p.game} image={image} className="w-24 h-20 rounded-lg shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display text-slate-100 font-semibold truncate">{p.game}</h3>
                    <p className="text-sm text-slate-500 truncate">{p.tier}</p>
                    <p className="text-xs text-slate-600 mt-1.5">
                      Ordered {shortDate(p.created_at)}
                      {p.seller_name ? ` \u00b7 Seller: ${p.seller_name}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <p className="font-mono text-[#D4A94B] font-semibold">{money(p.price)}</p>
                    <StatusPill status={p.escrow_status} />
                    {t && (
                      <p className={`text-xs ${t.expired ? 'text-slate-500' : 'text-slate-400'}`}>{t.text}</p>
                    )}
                  </div>
                  <ChevronRight size={18} className="text-slate-600 group-hover:text-[#D4A94B] shrink-0" />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}