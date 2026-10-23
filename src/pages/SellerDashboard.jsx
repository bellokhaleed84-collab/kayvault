import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Package, ShoppingBag, Settings, Plus, Wallet, Clock, PackageCheck, CheckCircle2, Banknote, Star, Pencil, Trash2,
} from 'lucide-react';
import DashHeader from '../components/DashHeader';
import GameArt from '../components/GameArt';
import StatusPill from '../components/StatusPill';
import { EarningsChart, StatusDonut } from '../components/charts';
import { Stars } from '../components/Stars';
import SellerDisputes from '../components/SellerDisputes';
import SellerWallet from '../components/SellerWallet';
import { api, assetUrl } from '../lib/api';
import { useAuth } from '../lib/AuthContext';
import { money, shortDate, timeLeft } from '../lib/orders';

const LISTING_STATUS = {
  live: { color: '#34D399', bg: 'bg-[#34D399]/10', label: 'Live' },
  pending: { color: '#D4A94B', bg: 'bg-[#D4A94B]/10', label: 'Pending review' },
  sold: { color: '#5B8DEF', bg: 'bg-[#5B8DEF]/10', label: 'Sold' },
};

function ListingPill({ status }) {
  const s = LISTING_STATUS[status] || LISTING_STATUS.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${s.bg}`}
      style={{ color: s.color }}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" /> {s.label}
    </span>
  );
}

const NAV = [
  ['overview', 'Overview', LayoutDashboard],
  ['listings', 'My listings', Package],
  ['orders', 'Orders', ShoppingBag],
  ['payouts', 'Payouts', Banknote],
  ['reviews', 'Reviews', Star],
];

const th = 'px-5 py-3 font-medium text-xs font-mono text-slate-500';
const card = 'rounded-xl bg-[#131B2E] border border-slate-800';

function ListingsTable({ rows, empty, onDelete }) {
  if (rows.length === 0) {
    return <p className="text-slate-500 text-sm p-8 text-center">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-800">
            <th className={th}>LISTING</th>
            <th className={th}>PRICE</th>
            <th className={th}>STATUS</th>
            <th className={th}>CREATED</th>
            <th className={th + ' kv-actions-th'}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.id} className="border-b border-slate-800 last:border-0">
              <td className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <GameArt game={l.game} image={assetUrl(l.image_urls?.[0])} className="w-14 h-11 rounded-md shrink-0" />
                  <div className="min-w-0">
                    {l.status === 'pending' ? (
                      <p className="text-slate-200 font-medium truncate">{l.game}</p>
                    ) : (
                      <Link to={`/listing/${l.id}`} className="text-slate-200 font-medium truncate hover:text-[#D4A94B]">{l.game}</Link>
                    )}
                    <p className="text-xs text-slate-500 truncate max-w-[220px]">{l.tier}</p>
                  </div>
                </div>
              </td>
              <td className="px-5 py-3 font-mono text-[#D4A94B] whitespace-nowrap">{money(l.price)}</td>
              <td className="px-5 py-3"><ListingPill status={l.status} /></td>
              <td className="px-5 py-3 text-slate-500 whitespace-nowrap">{shortDate(l.created_at)}</td>
              <td className="px-5 py-3 text-right whitespace-nowrap kv-actions-td">
                {l.status !== 'sold' && (
                  <span className="inline-flex items-center gap-2">
                    <Link to={`/dashboard/seller/edit/${l.id}`}
                      className="inline-flex items-center gap-1.5 border border-[#D4A94B]/60 text-[#D4A94B] hover:bg-[#D4A94B]/10 rounded-lg px-3 py-1.5 text-xs transition-colors">
                      <Pencil size={13} /> Edit
                    </Link>
                    {onDelete && (
                      <button type="button" onClick={() => onDelete(l)}
                        className="inline-flex items-center gap-1.5 border border-slate-700 hover:border-red-500 hover:text-red-400 text-slate-400 rounded-lg px-3 py-1.5 text-xs transition-colors">
                        <Trash2 size={13} /> Delete
                      </button>
                    )}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrdersTable({ rows, empty, now }) {
  if (rows.length === 0) {
    return <p className="text-slate-500 text-sm p-8 text-center">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-800">
            <th className={th}>ORDER</th>
            <th className={th}>AMOUNT</th>
            <th className={th}>STATUS</th>
            <th className={th}>DATE</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const t = p.escrow_status === 'held' ? timeLeft(p.confirm_deadline, now) : null;
            return (
              <tr key={p.id} className="border-b border-slate-800 last:border-0">
                <td className="px-5 py-3">
                  <p className="text-slate-200 font-medium">{p.game}</p>
                  <p className="text-xs text-slate-500 truncate max-w-[220px]">{p.tier}</p>
                </td>
                <td className="px-5 py-3 font-mono text-[#D4A94B] whitespace-nowrap">{money(p.price)}</td>
                <td className="px-5 py-3">
                  <StatusPill status={p.escrow_status} />
                  {t && <p className="text-xs text-slate-500 mt-1">{t.text}</p>}
                </td>
                <td className="px-5 py-3 text-slate-500 whitespace-nowrap">{shortDate(p.created_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function SellerDashboard() {
  const { profile } = useAuth();
  const location = useLocation();
  const [view, setView] = useState('overview');
  const [listings, setListings] = useState([]);
  const [sales, setSales] = useState([]);
  const [reviewData, setReviewData] = useState({ reviews: [], avg: null, count: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const created = location.state?.created;
  const reloadSales = () => api.get('/purchases/sales').then(setSales).catch(() => {});
  const deleteListing = async (l) => {
    if (!window.confirm(`Delete the ${l.game} listing? This also removes its pictures and cannot be undone.`)) return;
    setError('');
    try {
      await api.del(`/listings/${l.id}`);
      setListings((rows) => rows.filter((x) => x.id !== l.id));
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    Promise.all([api.get('/listings/mine'), api.get('/purchases/sales'), api.get('/reviews/mine')])
      .then(([l, s, r]) => { setListings(l); setSales(s); setReviewData(r); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  const stats = useMemo(() => {
    const sum = (f) => sales.filter(f).reduce((t, p) => t + (p.seller_amount ?? p.price ?? 0), 0);
    return {
      earnings: sum((p) => p.escrow_status === 'released'),
      escrow: sum((p) => p.escrow_status === 'held' || p.escrow_status === 'refund_requested'),
      active: listings.filter((l) => l.status === 'live').length,
      orders: sales.length,
    };
  }, [listings, sales]);

  const months = useMemo(() => {
    const out = [];
    const base = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      out.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('en', { month: 'short' }), value: 0 });
    }
    sales.filter((p) => p.escrow_status === 'released').forEach((p) => {
      const d = new Date(p.released_at || p.updated_at || p.created_at);
      const m = out.find((x) => x.key === `${d.getFullYear()}-${d.getMonth()}`);
      if (m) m.value += p.seller_amount ?? p.price ?? 0;
    });
    return out;
  }, [sales]);

  const parts = [
    { label: 'Live', value: listings.filter((l) => l.status === 'live').length, color: '#34D399' },
    { label: 'Pending review', value: listings.filter((l) => l.status === 'pending').length, color: '#D4A94B' },
    { label: 'Sold', value: listings.filter((l) => l.status === 'sold').length, color: '#5B8DEF' },
  ];

  const cards = [
    { icon: Wallet, label: 'Total earnings', value: money(stats.earnings), color: '#D4A94B' },
    { icon: Clock, label: 'In escrow', value: money(stats.escrow), color: '#5B8DEF' },
    { icon: PackageCheck, label: 'Active listings', value: stats.active, color: '#34D399' },
    { icon: ShoppingBag, label: 'Orders', value: stats.orders, color: '#A78BFA' },
  ];

  const title = { overview: 'Overview', listings: 'My listings', orders: 'Orders', payouts: 'Payouts', reviews: 'Reviews' }[view];
  const navBtn = (active) =>
    `flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm whitespace-nowrap transition-colors ${
      active ? 'bg-[#D4A94B]/15 text-[#D4A94B]' : 'text-slate-400 hover:text-slate-100'
    }`;

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-200">
      <DashHeader />

      <div className="max-w-6xl mx-auto px-6 py-8 grid lg:grid-cols-[210px_1fr] gap-8">
        <aside>
          <nav className="flex lg:flex-col gap-1 overflow-x-auto">
            {NAV.map(([v, l, Icon]) => (
              <button key={v} onClick={() => setView(v)} className={navBtn(view === v)}>
                <Icon size={16} /> {l}
              </button>
            ))}
            <Link to="/settings" className={navBtn(false)}><Settings size={16} /> Settings</Link>
          </nav>
        </aside>

        <main className="min-w-0">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="font-display text-3xl font-semibold text-slate-100">{title}</h1>
              <p className="text-slate-500 text-sm mt-1">
                {profile?.full_name ? `${profile.full_name.split(' ')[0]}, ` : ''}track your accounts and escrow payouts.
              </p>
            </div>
            <Link to="/dashboard/seller/new"
              className="flex items-center gap-2 bg-[#D4A94B] hover:bg-[#c49a3f] text-[#0B1120] font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors">
              <Plus size={16} /> New listing
            </Link>
          </div>

          {created && (
            <div className="flex items-center gap-2.5 rounded-lg border border-[#34D399]/30 bg-[#34D399]/10 text-[#34D399] text-sm px-4 py-3 mb-6">
              <CheckCircle2 size={16} /> Listing submitted. It goes live once our team approves it.
            </div>
          )}
          {/* KV-P17C-BANNER */}
          {profile && profile.kyc_status !== 'verified' && (
            <div className="rounded-lg border border-[#D4A94B]/40 bg-[#D4A94B]/5 px-4 py-3 mb-6 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-300">
                {profile.kyc_status === 'pending'
                  ? 'Your ID is being reviewed. Your listings and payouts are released once you are verified.'
                  : "Verify your identity (National ID, driver's licence or passport) before your listings can go live and you can be paid."}
              </p>
              {profile.kyc_status !== 'pending' && (
                <Link to="/settings?tab=verification" className="bg-[#D4A94B] hover:bg-[#c49a3f] text-[#0B1120] font-semibold rounded-lg px-4 py-2 text-xs transition-colors">Verify now</Link>
              )}
            </div>
          )}
          {error && <p className="text-red-400 text-sm mb-6">{error}</p>}
          {!loading && <SellerDisputes sales={sales} onDone={reloadSales} />}

          {loading ? (
            <p className="text-slate-500 text-sm">Loading your dashboard...</p>
          ) : (
            <>
              {view === 'overview' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {cards.map(({ icon: Icon, label, value, color }) => (
                      <div key={label} className={`${card} p-5`}>
                        <Icon size={18} style={{ color }} className="mb-3" />
                        <p className="text-slate-500 text-xs font-mono mb-1">{label.toUpperCase()}</p>
                        <p className="font-display text-2xl font-semibold text-slate-100">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid lg:grid-cols-3 gap-6">
                    <div className={`${card} p-5 lg:col-span-2`}>
                      <h2 className="font-display text-slate-100 font-semibold mb-1">Earnings</h2>
                      <p className="text-xs text-slate-500 mb-4">
                        Released payments, last 6 months{stats.earnings === 0 ? '. Nothing released yet.' : ''}
                      </p>
                      <EarningsChart data={months} format={money} />
                    </div>
                    <div className={`${card} p-5`}>
                      <h2 className="font-display text-slate-100 font-semibold mb-4">Listing status</h2>
                      <StatusDonut parts={parts} />
                    </div>
                  </div>

                  <div className={card}>
                    <div className="flex items-center justify-between px-5 pt-5">
                      <h2 className="font-display text-slate-100 font-semibold">Recent listings</h2>
                      <button onClick={() => setView('listings')} className="text-sm text-[#D4A94B] hover:underline">View all</button>
                    </div>
                    <ListingsTable rows={listings.slice(0, 5)} onDelete={deleteListing} empty="No listings yet. Create your first one." />
                  </div>

                  <div className={card}>
                    <div className="flex items-center justify-between px-5 pt-5">
                      <h2 className="font-display text-slate-100 font-semibold">Recent orders</h2>
                      <button onClick={() => setView('orders')} className="text-sm text-[#D4A94B] hover:underline">View all</button>
                    </div>
                    <OrdersTable rows={sales.slice(0, 5)} now={now} empty="No orders yet. They show up here when a buyer purchases." />
                  </div>
                </div>
              )}

              {view === 'listings' && (
                <div className={card}>
                  <ListingsTable rows={listings} onDelete={deleteListing} empty="No listings yet. Create your first one." />
                </div>
              )}

              {view === 'payouts' && (
                <div className="space-y-6">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className={`${card} p-5`}>
                      <Wallet size={18} className="text-[#D4A94B] mb-3" />
                      <p className="text-slate-500 text-xs font-mono mb-1">RELEASED EARNINGS</p>
                      <p className="font-display text-2xl font-semibold text-slate-100">{money(stats.earnings)}</p>
                      <p className="text-xs text-slate-500 mt-1">Confirmed by buyers, after the platform fee.</p>
                    </div>
                    <div className={`${card} p-5`}>
                      <Clock size={18} className="text-[#5B8DEF] mb-3" />
                      <p className="text-slate-500 text-xs font-mono mb-1">IN ESCROW</p>
                      <p className="font-display text-2xl font-semibold text-slate-100">{money(stats.escrow)}</p>
                      <p className="text-xs text-slate-500 mt-1">Released when the buyer confirms, or after 24 hours.</p>
                    </div>
                  </div>

                  <div className={`${card} p-5`}>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="font-display text-slate-100 font-semibold">Payout account</h2>
                      <Link to="/settings" className="text-sm text-[#D4A94B] hover:underline">
                        {profile?.bank_account_number ? 'Edit' : 'Add bank details'}
                      </Link>
                    </div>
                    {profile?.bank_account_number ? (
                      <dl className="grid sm:grid-cols-3 gap-4 text-sm">
                        <div><dt className="text-[11px] font-mono text-slate-600">BANK</dt><dd className="text-slate-200">{profile.bank_name || '-'}</dd></div>
                        <div><dt className="text-[11px] font-mono text-slate-600">ACCOUNT NUMBER</dt><dd className="font-mono text-slate-200">{'\u2022\u2022\u2022\u2022 ' + profile.bank_account_number.slice(-4)}</dd></div>
                        <div><dt className="text-[11px] font-mono text-slate-600">ACCOUNT NAME</dt><dd className="text-slate-200">{profile.bank_account_name || '-'}</dd></div>
                      </dl>
                    ) : (
                      <p className="text-sm text-slate-400">
                        No bank details yet. Add them in Settings so we know where to send your earnings.
                      </p>
                    )}
                    <p className="text-xs text-slate-500 mt-4">
                      Payouts are sent to this account by our team after the buyer confirms. You get a notification when one is marked as paid.
                    </p>
                  </div>

                  <div className={card}>
                    <h2 className="font-display text-slate-100 font-semibold px-5 pt-5">Released payments</h2>
                    <SellerWallet />
                  </div>
                </div>
              )}

              {view === 'reviews' && (
                <div className={card}>
                  <div className="p-5 border-b border-slate-800 flex items-center gap-4">
                    <p className="font-display text-4xl font-semibold text-slate-100">{reviewData.avg ?? '-'}</p>
                    <div>
                      <Stars value={reviewData.avg || 0} size={18} />
                      <p className="text-xs text-slate-500 mt-1">{reviewData.count} {reviewData.count === 1 ? 'review' : 'reviews'}</p>
                    </div>
                  </div>
                  {reviewData.reviews.length === 0 ? (
                    <p className="text-slate-500 text-sm p-8 text-center">No reviews yet. Buyers can rate you after they confirm an order.</p>
                  ) : (
                    reviewData.reviews.map((r) => (
                      <div key={r.id} className="p-5 border-b border-slate-800 last:border-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <Stars value={r.rating} />
                          <span className="text-xs text-slate-600">{shortDate(r.created_at)}</span>
                        </div>
                        {r.comment && <p className="text-sm text-slate-300 mb-1.5">{r.comment}</p>}
                        <p className="text-xs text-slate-500">{r.buyer_name}{r.game ? ' \u00b7 ' + r.game : ''}</p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {view === 'orders' && (
                <div className={card}>
                  <OrdersTable rows={sales} now={now} empty="No orders yet. They show up here when a buyer purchases." />
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}