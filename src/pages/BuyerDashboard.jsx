import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, Clock, PackageCheck, ChevronRight, Zap } from 'lucide-react';
import DashHeader from '../components/DashHeader';
import GameArt from '../components/GameArt';
import StatusPill from '../components/StatusPill';
import Skel from '../components/Skeleton';
import { api, assetUrl } from '../lib/api';
import { useAuth } from '../lib/AuthContext';
import { TABS, inTab, timeLeft, money, shortDate } from '../lib/orders';

// KV-TOPUPLIST v1: what the buyer sees for each top-up status
const TOPUP_STATUS = {
  pending: { label: 'Awaiting payment', color: '#8B5CF6' },
  paid: { label: 'Delivering', color: '#5B8DEF' },
  processing: { label: 'Delivering', color: '#5B8DEF' },
  completed: { label: 'Delivered', color: '#34D399' },
  failed: { label: 'Payment not completed', color: '#F87171' },
  refund_needed: { label: 'Refund on its way', color: '#5B8DEF' },
  refunding: { label: 'Refund on its way', color: '#5B8DEF' },
  refunded: { label: 'Refunded', color: '#F87171' },
  refund_failed: { label: 'Under review', color: '#8B5CF6' },
  check_needed: { label: 'Under review', color: '#8B5CF6' },
  error: { label: 'Under review', color: '#8B5CF6' },
};
const TOPUP_SHOW_REASON = ['failed', 'refund_needed', 'refunding', 'refunded'];

function TopupPill({ status }) {
  const s = TOPUP_STATUS[status] || TOPUP_STATUS.error;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap"
      style={{ color: s.color, backgroundColor: s.color + '1A' }}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" /> {s.label}
    </span>
  );
}

// KV-MOBILE v1: phone friendly (cards stack, tabs swipe sideways)
export default function BuyerDashboard() {
  const { profile } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [unread, setUnread] = useState({}); // KV-ORDERCHAT: unread messages per order
  const [topups, setTopups] = useState([]); // KV-TOPUPLIST
  const [topupLoading, setTopupLoading] = useState(true);
  const [topupError, setTopupError] = useState('');
  const [showAllTopups, setShowAllTopups] = useState(false);
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

  useEffect(() => {
    const load = () => api.get('/order-chat/unread').then((r) => setUnread(r.counts || {})).catch(() => {});
    load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 30000);
    return () => clearInterval(t);
  }, []);

  // KV-TOPUPLIST: the buyer's game top-ups, refreshed while the page is open
  useEffect(() => {
    const load = () =>
      api.get('/topups/mine')
        .then((rows) => { setTopups(Array.isArray(rows) ? rows : []); setTopupError(''); })
        .catch((e) => setTopupError(e.message))
        .finally(() => setTopupLoading(false));
    load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 30000);
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
  const topupRows = showAllTopups ? topups : topups.slice(0, 5);
  const cards = [
    { icon: PackageCheck, label: 'Total orders', value: stats.orders, color: '#34D399' },
    { icon: Clock, label: 'In escrow', value: money(stats.escrow), color: '#5B8DEF' },
    { icon: Wallet, label: 'Total spent', value: money(stats.spent), color: '#8B5CF6' },
  ];

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-200">
      <DashHeader />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <h1 className="font-display text-2xl sm:text-3xl font-semibold text-slate-100 mb-1">My Purchases</h1>
        <p className="text-slate-500 text-sm mb-6 sm:mb-8">
          {profile?.full_name ? `Welcome back, ${profile.full_name.split(' ')[0]}. ` : ''}
          Open an order to see your login details and confirm the account.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-5 mb-8 sm:mb-10">
          {cards.map(({ icon: Icon, label, value, color }, i) => (
            <div key={label} className={`rounded-xl bg-[#131B2E] border border-slate-800 p-4 sm:p-5 min-w-0 ${i === 2 ? 'col-span-2 sm:col-span-1' : ''}`}>
              <Icon size={18} style={{ color }} className="mb-3" />
              <p className="text-slate-500 text-[11px] sm:text-xs font-mono mb-1">{label.toUpperCase()}</p>
              {loading ? <Skel className="h-8 w-24" /> : <p className="font-display text-xl sm:text-2xl font-semibold text-slate-100 break-words">{value}</p>}
            </div>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 mb-5 sm:mb-6 sm:flex-wrap sm:mx-0 sm:px-0 sm:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map(([v, l]) => {
            const n = purchases.filter((p) => inTab(p, v)).length;
            return (
              <button
                key={v}
                onClick={() => setTab(v)}
                className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2.5 sm:py-2 text-xs font-medium border transition-colors ${
                  tab === v
                    ? 'bg-[#8B5CF6] border-[#8B5CF6] text-white'
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
          <div className="space-y-3">
            {[0, 1, 2].map((i) => <Skel key={i} className="h-28 w-full rounded-xl" />)}
          </div>
        ) : shown.length === 0 ? (
          <div className="rounded-xl bg-[#131B2E] border border-slate-800 p-8 sm:p-10 text-center">
            <p className="text-slate-500 text-sm mb-4">
              {purchases.length === 0 ? 'You have not bought an account yet.' : 'No orders in this tab.'}
            </p>
            {purchases.length === 0 && (
              <Link
                to="/browse"
                className="inline-block bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-semibold rounded-lg px-5 py-3 text-sm transition-colors"
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
              const newMsgs = unread[p.id] || 0;
              return (
                <Link
                  key={p.id}
                  to={`/orders/${p.id}`}
                  className="group rounded-xl bg-[#131B2E] border border-slate-800 hover:border-[#8B5CF6]/50 transition-colors p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4"
                >
                  <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                    <GameArt game={p.game} image={image} className="w-20 h-16 sm:w-24 sm:h-20 rounded-lg shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display text-slate-100 font-semibold truncate">{p.game}</h3>
                      <p className="text-sm text-slate-500 truncate">{p.tier}</p>
                      <p className="text-xs text-slate-600 mt-1.5 truncate">
                        Ordered {shortDate(p.created_at)}
                        {p.seller_name ? ` \u00b7 Seller: ${p.seller_name}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0">
                    <p className="font-mono text-[#8B5CF6] font-semibold">{money(p.price)}</p>
                    <StatusPill status={p.escrow_status} />
                    {newMsgs > 0 && (
                      <span className="rounded-full bg-[#F87171] text-[#0B1120] text-[11px] font-bold px-2.5 py-1 whitespace-nowrap">
                        {newMsgs === 1 ? '1 new message' : newMsgs + ' new messages'}
                      </span>
                    )}
                    {t && (
                      <p className={`text-xs ${t.expired ? 'text-slate-500' : 'text-slate-400'}`}>{t.text}</p>
                    )}
                  </div>
                  <ChevronRight size={18} className="hidden sm:block text-slate-600 group-hover:text-[#8B5CF6] shrink-0" />
                </Link>
              );
            })}
          </div>
        )}

        {/* KV-TOPUPLIST: game top-ups */}
        <div className="mt-10 sm:mt-12">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap size={18} className="text-[#8B5CF6]" />
              <h2 className="font-display text-xl sm:text-2xl font-semibold text-slate-100">Top-ups</h2>
            </div>
            <Link to="/topup" className="text-sm text-[#8B5CF6] hover:underline py-1">New top-up</Link>
          </div>

          {topupError && <p className="text-red-400 text-sm mb-4">{topupError}</p>}

          {topupLoading ? (
            <div className="space-y-3">
              {[0, 1].map((i) => <Skel key={i} className="h-20 w-full rounded-xl" />)}
            </div>
          ) : topups.length === 0 ? (
            <div className="rounded-xl bg-[#131B2E] border border-slate-800 p-8 text-center">
              <p className="text-slate-500 text-sm mb-4">You have not made a top-up yet.</p>
              <Link
                to="/topup"
                className="inline-block bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-semibold rounded-lg px-5 py-3 text-sm transition-colors"
              >
                Top up a game
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {topupRows.map((tp) => (
                <div key={tp.id} className="rounded-xl bg-[#131B2E] border border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center shrink-0">
                      <Zap size={20} className="text-[#8B5CF6]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display text-slate-100 font-semibold truncate">{tp.product_name || 'Game top-up'}</h3>
                      <p className="text-sm text-slate-500 truncate">{tp.offer_name}</p>
                      <p className="text-xs text-slate-600 mt-1 truncate">
                        Ordered {shortDate(tp.created_at)}
                        {tp.player_name ? ` \u00b7 ${tp.player_name}` : tp.game_user_id ? ` \u00b7 ID ${tp.game_user_id}` : ''}
                      </p>
                      {TOPUP_SHOW_REASON.includes(tp.status) && tp.fail_reason && (
                        <p className="text-xs text-slate-500 mt-1">{tp.fail_reason}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0">
                    <p className="font-mono text-[#8B5CF6] font-semibold">{money(tp.naira_amount)}</p>
                    <TopupPill status={tp.status} />
                  </div>
                </div>
              ))}
              {topups.length > 5 && (
                <button type="button" onClick={() => setShowAllTopups(!showAllTopups)}
                  className="w-full border border-slate-800 hover:border-slate-600 text-slate-400 rounded-lg py-3.5 text-sm transition-colors">
                  {showAllTopups ? 'Show fewer' : 'Show all ' + topups.length + ' top-ups'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}