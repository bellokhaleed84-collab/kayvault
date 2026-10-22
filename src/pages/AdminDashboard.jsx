import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard, Package, RotateCcw, BadgeCheck, Users, ShoppingBag, CheckCircle2, XCircle,
  Wallet, Clock, Ban, ShieldCheck, Search, ChevronRight, Banknote,
} from 'lucide-react';
import DashHeader from '../components/DashHeader';
import GameArt from '../components/GameArt';
import StatusPill from '../components/StatusPill';
import AdminKyc from '../components/AdminKyc';
import AdminPayouts from '../components/AdminPayouts';
import { EarningsChart, StatusDonut } from '../components/charts';
import { api, assetUrl } from '../lib/api';
import RefundProofs from '../components/RefundProofs';
import RefundActivity from '../components/RefundActivity';
import AdminCredCheck from '../components/AdminCredCheck';
import CaseChat from '../components/CaseChat';
import { money, shortDate } from '../lib/orders';

const card = 'rounded-xl bg-[#131B2E] border border-slate-800';
const th = 'px-5 py-3 font-medium text-xs font-mono text-slate-500';
const TYPE_LABELS = { standard: 'Standard', modded: 'Modded', smurf: 'Smurf', fresh: 'Fresh', other: 'Other' };
const KYC_LABEL = { none: 'Not verified', pending: 'Pending', verified: 'Verified', rejected: 'Rejected' };
const KYC_COLOR = { none: '#64748B', pending: '#D4A94B', verified: '#34D399', rejected: '#F87171' };

const TITLES = {
  overview: ['Overview', 'How the marketplace is doing right now.'],
  listings: ['Pending listings', 'Review and approve seller submissions before they go live.'],
  refunds: ['Refund requests', 'Buyers who say the account did not work. Refund them or release to the seller.'],
  kyc: ['Seller verification', 'Check IDs and selfies before a seller gets the Verified badge.'],
  users: ['Users', 'Search accounts and suspend anyone who breaks the rules.'],
  orders: ['Orders', 'The 50 most recent orders across the marketplace.'],
  payouts: ['Payouts', 'Pay sellers by bank transfer, mark them as paid, and handle refunds that need attention.'],
};

function Empty({ children }) {
  return (
    <div className={`${card} p-10 text-center`}>
      <p className="text-slate-500 text-sm">{children}</p>
    </div>
  );
}

export default function AdminDashboard() {
  const [view, setView] = useState('overview');
  const [stats, setStats] = useState(null);
  const [pending, setPending] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState({ items: [], total: 0, page: 1, pages: 1 });
  const [uq, setUq] = useState('');
  const [urole, setUrole] = useState('');
  const [upage, setUpage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  const loadCore = useCallback(async () => {
    try {
      const [s, l, r] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/listings/pending'),
        api.get('/admin/refunds'),
      ]);
      setStats(s);
      setPending(l);
      setRefunds(r);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadCore(); }, [loadCore, view, tick]);

  useEffect(() => {
    if (view !== 'orders') return;
    api.get('/admin/orders').then(setOrders).catch((e) => setError(e.message));
  }, [view, tick]);

  useEffect(() => {
    if (view !== 'users') return;
    const t = setTimeout(() => {
      const qs = new URLSearchParams({ page: String(upage) });
      if (uq.trim()) qs.set('q', uq.trim());
      if (urole) qs.set('role', urole);
      api.get(`/admin/users?${qs}`).then(setUsers).catch((e) => setError(e.message));
    }, 300);
    return () => clearTimeout(t);
  }, [view, uq, urole, upage, tick]);

  async function run(fn) {
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    }
    setTick((n) => n + 1);
  }

  const approve = (id) => run(() => api.post(`/listings/${id}/approve`));
  const reject = (l) => {
    if (window.confirm(`Reject and delete the ${l.game} listing? The seller is notified.`)) run(() => api.del(`/listings/${l.id}/reject`));
  };
  const resolve = (p, action) => {
    const msg = action === 'refund' ? `Refund ${money(p.price)} to the buyer?` : `Release ${money(p.price)} to the seller?`;
    if (window.confirm(msg)) run(() => api.post(`/purchases/${p.id}/resolve`, { action }));
  };
  const suspend = (u) => {
    const next = !u.suspended;
    if (window.confirm(next ? `Suspend ${u.full_name}? They will be logged out and blocked.` : `Restore ${u.full_name}?`)) {
      run(() => api.post(`/admin/users/${u.id}/suspend`, { suspended: next }));
    }
  };

  const nav = [
    ['overview', 'Overview', LayoutDashboard, 0],
    ['listings', 'Pending listings', Package, stats?.pending_listings || 0],
    ['refunds', 'Refund requests', RotateCcw, stats?.refund_requests || 0],
    ['kyc', 'Verification', BadgeCheck, stats?.kyc_pending || 0],
    ['users', 'Users', Users, 0],
    ['orders', 'Orders', ShoppingBag, 0],
    ['payouts', 'Payouts', Banknote, 0],
  ];

  const navBtn = (active) =>
    `flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm whitespace-nowrap transition-colors ${
      active ? 'bg-[#D4A94B]/15 text-[#D4A94B]' : 'text-slate-400 hover:text-slate-100'
    }`;

  const cards = useMemo(() => !stats ? [] : [
    { icon: Users, label: 'Users', value: stats.buyers + stats.sellers, sub: `${stats.buyers} buyers, ${stats.sellers} sellers`, color: '#A78BFA' },
    { icon: Package, label: 'Live listings', value: stats.live, sub: `${stats.sold} sold`, color: '#34D399' },
    { icon: ShoppingBag, label: 'Orders', value: stats.orders, sub: 'all time', color: '#5B8DEF' },
    { icon: Clock, label: 'In escrow', value: money(stats.escrow), sub: 'held or in dispute', color: '#D4A94B' },
    { icon: Wallet, label: 'Released', value: money(stats.released), sub: `${money(stats.fees || 0)} platform fees`, color: '#34D399' },
    { icon: RotateCcw, label: 'Refunded', value: money(stats.refunded), sub: 'returned to buyers', color: '#F87171' },
  ], [stats]);

  const [title, subtitle] = TITLES[view];

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-200">
      <DashHeader />

      <div className="max-w-6xl mx-auto px-6 py-8 grid lg:grid-cols-[210px_1fr] gap-8">
        <aside>
          <nav className="flex lg:flex-col gap-1 overflow-x-auto">
            {nav.map(([v, l, Icon, n]) => (
              <button key={v} onClick={() => setView(v)} className={navBtn(view === v)}>
                <Icon size={16} /> {l}
                {n > 0 && (
                  <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-[#D4A94B] text-[#0B1120] text-[11px] font-semibold flex items-center justify-center">{n}</span>
                )}
              </button>
            ))}
          </nav>
        </aside>

        <main className="min-w-0">
          <div className="mb-6">
            <h1 className="font-display text-3xl font-semibold text-slate-100">{title}</h1>
            <p className="text-slate-500 text-sm mt-1">{subtitle}</p>
          </div>

          {error && <p className="text-red-400 text-sm mb-6">{error}</p>}

          {loading ? (
            <p className="text-slate-500 text-sm">Loading...</p>
          ) : (
            <>
              {view === 'overview' && stats && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    {cards.map(({ icon: Icon, label, value, sub, color }) => (
                      <div key={label} className={`${card} p-5`}>
                        <Icon size={18} style={{ color }} className="mb-3" />
                        <p className="text-slate-500 text-xs font-mono mb-1">{label.toUpperCase()}</p>
                        <p className="font-display text-2xl font-semibold text-slate-100">{value}</p>
                        <p className="text-xs text-slate-600 mt-1">{sub}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid sm:grid-cols-3 gap-4">
                    {[
                      ['listings', 'Listings to review', stats.pending_listings],
                      ['refunds', 'Refund requests', stats.refund_requests],
                      ['kyc', 'Verifications waiting', stats.kyc_pending],
                    ].map(([v, l, n]) => (
                      <button key={v} onClick={() => setView(v)}
                        className={`${card} p-5 text-left flex items-center justify-between hover:border-[#D4A94B]/50 transition-colors`}>
                        <div>
                          <p className="text-xs font-mono text-slate-500 mb-1">{l.toUpperCase()}</p>
                          <p className={`font-display text-2xl font-semibold ${n > 0 ? 'text-[#D4A94B]' : 'text-slate-100'}`}>{n}</p>
                        </div>
                        <ChevronRight size={18} className="text-slate-600" />
                      </button>
                    ))}
                  </div>

                  <div className="grid lg:grid-cols-3 gap-6">
                    <div className={`${card} p-5 lg:col-span-2`}>
                      <h2 className="font-display text-slate-100 font-semibold mb-1">Released volume</h2>
                      <p className="text-xs text-slate-500 mb-4">Money released to sellers, last 6 months.</p>
                      <EarningsChart data={stats.monthly} format={money} />
                    </div>
                    <div className={`${card} p-5`}>
                      <h2 className="font-display text-slate-100 font-semibold mb-4">Listing status</h2>
                      <StatusDonut parts={[
                        { label: 'Live', value: stats.live, color: '#34D399' },
                        { label: 'Pending review', value: stats.pending_listings, color: '#D4A94B' },
                        { label: 'Sold', value: stats.sold, color: '#5B8DEF' },
                      ]} />
                    </div>
                  </div>
                </div>
              )}

              {view === 'listings' && (
                pending.length === 0 ? <Empty>No pending listings. You are all caught up.</Empty> : (
                  <div className="space-y-4">
                    {pending.map((l) => {
                      const imgs = (l.image_urls || []).map(assetUrl);
                      return (
                        <div key={l.id} className={`${card} p-5`}>
                          <div className="flex flex-col sm:flex-row gap-5">
                            <GameArt game={l.game} image={imgs[0]} className="w-full sm:w-48 h-36 rounded-lg shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <h3 className="font-display text-slate-100 font-semibold">{l.game}</h3>
                                  <p className="text-sm text-slate-500">{l.tier}</p>
                                </div>
                                <p className="font-mono text-[#D4A94B] font-semibold">{money(l.price)}</p>
                              </div>
                              <p className="text-xs text-slate-500 mt-2">
                                Seller: {l.seller_name} &middot; {l.platform} &middot; {TYPE_LABELS[l.account_type] || l.account_type}
                                {l.level ? ` \u00b7 ${l.level}` : ''} &middot; {shortDate(l.created_at)}
                              </p>
                              {l.description && <p className="text-sm text-slate-400 mt-3 line-clamp-3 whitespace-pre-line">{l.description}</p>}
                              {l.features?.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                  {l.features.map((f) => (
                                    <span key={f} className="text-xs text-slate-300 bg-[#0D1524] border border-slate-800 rounded-full px-2.5 py-1">{f}</span>
                                  ))}
                                </div>
                              )}
                              {imgs.length > 1 && (
                                <div className="flex gap-2 mt-3">
                                  {imgs.slice(1).map((src, i) => (
                                    <a key={i} href={src} target="_blank" rel="noreferrer">
                                      <img src={src} alt="" className="w-16 h-12 object-cover rounded-md border border-slate-800" />
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2 mt-5 pt-4 border-t border-slate-800">
                            <button onClick={() => approve(l.id)}
                              className="flex items-center gap-1.5 bg-[#34D399] hover:bg-[#2bb989] text-[#0B1120] font-semibold rounded-lg px-4 py-2 text-xs transition-colors">
                              <CheckCircle2 size={14} /> Approve
                            </button>
                            <button onClick={() => reject(l)}
                              className="flex items-center gap-1.5 border border-slate-700 hover:border-red-500 hover:text-red-400 text-slate-400 rounded-lg px-4 py-2 text-xs transition-colors">
                              <XCircle size={14} /> Reject
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              )}

              {view === 'refunds' && (
                refunds.length === 0 ? <Empty>No refund requests.</Empty> : (
                  <div className="space-y-4">
                    {refunds.map((p) => (
                      <div key={p.id} className={`${card} p-5`}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="font-display text-slate-100 font-semibold">{p.game}</h3>
                            <p className="text-sm text-slate-500">{p.tier}</p>
                          </div>
                          <p className="font-mono text-[#D4A94B] font-semibold">{money(p.price)}</p>
                        </div>
                        <div className="grid sm:grid-cols-3 gap-4 mt-4 text-sm">
                          <div><p className="text-[11px] font-mono text-slate-600">BUYER</p><p className="text-slate-200">{p.buyer_name || '-'}</p><p className="text-xs text-slate-500">{p.buyer_email}</p></div>
                          <div><p className="text-[11px] font-mono text-slate-600">SELLER</p><p className="text-slate-200">{p.seller_name || '-'}</p></div>
                          <div><p className="text-[11px] font-mono text-slate-600">REQUESTED</p><p className="text-slate-200">{shortDate(p.refund_requested_at)}</p></div>
                        </div>
                        <RefundActivity p={p} />
                        <RefundProofs purchaseId={p.id} />
                        <RefundProofs purchaseId={p.id} who="seller" />
                        <AdminCredCheck purchaseId={p.id} />
                        <CaseChat purchaseId={p.id} mode="admin" thread="buyer" />
                        <CaseChat purchaseId={p.id} mode="admin" thread="seller" />
                        <div className="mt-4 rounded-lg bg-[#0D1524] border border-slate-800 px-4 py-3">
                          <p className="text-[11px] font-mono text-slate-600 mb-1">BUYER&apos;S REASON</p>
                          <p className="text-sm text-slate-300 whitespace-pre-line">{p.refund_reason || 'No reason given.'}</p>
                        </div>
                        <div className="flex gap-2 mt-5 pt-4 border-t border-slate-800">
                          <button onClick={() => resolve(p, 'refund')}
                            className="flex items-center gap-1.5 bg-[#F87171] hover:bg-[#ef5b5b] text-[#0B1120] font-semibold rounded-lg px-4 py-2 text-xs transition-colors">
                            <RotateCcw size={14} /> Refund buyer
                          </button>
                          <button onClick={() => resolve(p, 'release')}
                            className="flex items-center gap-1.5 border border-slate-700 hover:border-slate-500 text-slate-300 rounded-lg px-4 py-2 text-xs transition-colors">
                            <CheckCircle2 size={14} /> Release to seller
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {view === 'kyc' && <AdminKyc />}
              {view === 'payouts' && <AdminPayouts />}

              {view === 'users' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
                      <input value={uq} onChange={(e) => { setUq(e.target.value); setUpage(1); }} placeholder="Search by name or email"
                        className="w-full bg-[#0D1524] border border-slate-800 rounded-lg pl-10 pr-3.5 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-[#D4A94B] transition-colors" />
                    </div>
                    <select value={urole} onChange={(e) => { setUrole(e.target.value); setUpage(1); }}
                      className="bg-[#0D1524] border border-slate-800 rounded-lg px-3.5 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-[#D4A94B]">
                      <option value="">All roles</option>
                      <option value="buyer">Buyers</option>
                      <option value="seller">Sellers</option>
                    </select>
                  </div>

                  <div className={card}>
                    {users.items.length === 0 ? (
                      <p className="text-slate-500 text-sm p-8 text-center">No users match.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-slate-800">
                              <th className={th}>USER</th>
                              <th className={th}>ROLE</th>
                              <th className={th}>VERIFICATION</th>
                              <th className={th}>REFUNDS / ORDERS</th>
                              <th className={th}>JOINED</th>
                              <th className={th}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {users.items.map((u) => (
                              <tr key={u.id} className="border-b border-slate-800 last:border-0">
                                <td className="px-5 py-3">
                                  <p className="text-slate-200 font-medium">
                                    {u.full_name}
                                    {u.is_admin && <span className="ml-2 text-[11px] text-[#D4A94B]">Admin</span>}
                                    {u.suspended && <span className="ml-2 text-[11px] text-[#F87171]">Suspended</span>}
                                  </p>
                                  <p className="text-xs text-slate-500">{u.email}</p>
                                </td>
                                <td className="px-5 py-3 text-slate-400 capitalize">{u.role}</td>
                                <td className="px-5 py-3">
                                  {u.role === 'seller' ? (
                                    <span className="text-xs" style={{ color: KYC_COLOR[u.kyc_status || 'none'] }}>{KYC_LABEL[u.kyc_status || 'none']}</span>
                                  ) : <span className="text-xs text-slate-600">-</span>}
                                </td>
                                <td className="px-5 py-3 font-mono text-xs whitespace-nowrap">
                                  <span className={u.refund_requests >= 2 && u.refund_requests >= (u.orders || 0) / 2 ? 'text-[#F87171]' : 'text-slate-400'}>
                                    {u.refund_requests || 0} / {u.orders || 0}
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-slate-500 whitespace-nowrap">{shortDate(u.created_at)}</td>
                                <td className="px-5 py-3 text-right">
                                  {!u.is_admin && (
                                    <button onClick={() => suspend(u)}
                                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs border transition-colors ${
                                        u.suspended
                                          ? 'border-[#34D399]/50 text-[#34D399] hover:bg-[#34D399]/10'
                                          : 'border-slate-700 text-slate-400 hover:border-red-500 hover:text-red-400'
                                      }`}>
                                      {u.suspended ? <><ShieldCheck size={13} /> Restore</> : <><Ban size={13} /> Suspend</>}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-sm text-slate-500">
                    <span>{users.total} {users.total === 1 ? 'user' : 'users'}</span>
                    <div className="flex items-center gap-3">
                      <button disabled={upage <= 1} onClick={() => setUpage(upage - 1)} className="hover:text-slate-200 disabled:opacity-40">Previous</button>
                      <span className="font-mono text-xs">{users.page} / {users.pages}</span>
                      <button disabled={upage >= users.pages} onClick={() => setUpage(upage + 1)} className="hover:text-slate-200 disabled:opacity-40">Next</button>
                    </div>
                  </div>
                </div>
              )}

              {view === 'orders' && (
                <div className={card}>
                  {orders.length === 0 ? (
                    <p className="text-slate-500 text-sm p-8 text-center">No orders yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-800">
                            <th className={th}>ORDER</th>
                            <th className={th}>BUYER</th>
                            <th className={th}>SELLER</th>
                            <th className={th}>AMOUNT</th>
                            <th className={th}>STATUS</th>
                            <th className={th}>DATE</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orders.map((o) => (
                            <tr key={o.id} className="border-b border-slate-800 last:border-0">
                              <td className="px-5 py-3">
                                <p className="text-slate-200 font-medium">{o.game}</p>
                                <p className="text-xs text-slate-500 truncate max-w-[200px]">{o.tier}</p>
                              </td>
                              <td className="px-5 py-3 text-slate-400">{o.buyer_name || '-'}</td>
                              <td className="px-5 py-3 text-slate-400">{o.seller_name || '-'}</td>
                              <td className="px-5 py-3 font-mono text-[#D4A94B] whitespace-nowrap">{money(o.price)}</td>
                              <td className="px-5 py-3"><StatusPill status={o.escrow_status} /></td>
                              <td className="px-5 py-3 text-slate-500 whitespace-nowrap">{shortDate(o.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}