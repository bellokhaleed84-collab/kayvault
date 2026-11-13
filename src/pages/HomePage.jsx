// KV-HOME v3: accounts for sale + top-ups (phone friendly: rows swipe sideways)
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ShoppingBag, Plus, LayoutDashboard, ShieldCheck, ArrowRight } from 'lucide-react';
import PublicNavbar from '../components/PublicNavbar';
import Footer from '../components/Footer';
import GameArt from '../components/GameArt';
import TopupGameImage from '../components/TopupGameImage';
import Skel from '../components/Skeleton';
import { api, assetUrl } from '../lib/api';
import { useAuth } from '../lib/AuthContext';

// Popular top-up games are shown first
const POPULAR = ['genshin', 'hsr', 'zzz', 'mlbb', 'pubgm', 'freefire_global', 'codm_id', 'wuthering', 'hok', 'deltaforce', 'bloodstrike', 'marvel_rivals'];
const rank = (id) => {
  const i = POPULAR.indexOf(id);
  return i === -1 ? 999 : i;
};

// On a phone: one row that swipes sideways. From the sm size up: a normal grid.
const ROW =
  'flex gap-3 overflow-x-auto snap-x snap-mandatory -mx-5 px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ' +
  'sm:mx-0 sm:px-0 sm:pb-0 sm:overflow-visible sm:grid sm:grid-cols-3 lg:grid-cols-6 sm:gap-4';
const TILE =
  'group shrink-0 w-36 snap-start sm:w-auto rounded-xl overflow-hidden border border-slate-800 hover:border-[#D4A94B]/50 transition-colors bg-[#131B2E]';

function SectionTitle({ children, sub, to, toLabel = 'View all' }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-5 sm:mb-6">
      <div className="min-w-0">
        <h2 className="font-display text-xl sm:text-2xl font-semibold text-slate-100">{children}</h2>
        {sub && <p className="text-slate-500 text-sm mt-1">{sub}</p>}
      </div>
      {to && <Link to={to} className="text-sm text-[#D4A94B] hover:underline whitespace-nowrap py-1">{toLabel}</Link>}
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className={ROW}>
      {[0, 1, 2, 3, 4, 5].map((i) => <Skel key={i} className="shrink-0 w-36 sm:w-auto h-40 rounded-xl" />)}
    </div>
  );
}

export default function HomePage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [games, setGames] = useState(null);
  const [topups, setTopups] = useState(null); // null = loading, 'off' = not available, otherwise a list of games
  const [q, setQ] = useState('');

  const isBuyer = profile?.role === 'buyer';

  useEffect(() => {
    api.get('/listings/games?limit=12').then(setGames).catch(() => setGames([]));
  }, []);

  useEffect(() => {
    if (!isBuyer) return;
    api.get('/topups/catalog')
      .then((r) => {
        const list = (r.games || []).slice().sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name));
        setTopups(list.slice(0, 12));
      })
      .catch(() => setTopups('off'));
  }, [isBuyer]);

  const first = profile?.full_name?.split(' ')[0] || '';
  const isSeller = profile?.role === 'seller';

  const actions = [
    ...(isSeller
      ? [
          { to: '/dashboard/seller/new', label: 'Create listing', icon: Plus, primary: true },
          { to: '/dashboard/seller', label: 'Seller dashboard', icon: LayoutDashboard },
        ]
      : [
          { to: '/dashboard/buyer', label: 'My purchases', icon: ShoppingBag, primary: true },
        ]),
    ...(profile?.is_admin ? [{ to: '/admin', label: 'Admin', icon: ShieldCheck }] : []),
  ];

  function search(e) {
    e.preventDefault();
    navigate(q.trim() ? `/browse?q=${encodeURIComponent(q.trim())}` : '/browse');
  }

  return (
    <div className="relative min-h-screen bg-[#0B1120] text-slate-200">
      <PublicNavbar overlay minimal />

      <section className="relative overflow-hidden bg-[#0B1120]">
        <div
          className="absolute inset-0"
          aria-hidden="true"
          style={{
            backgroundImage: "url('/home-bg.png')",
            backgroundSize: 'cover',
            backgroundPosition: '70% center',
            backgroundRepeat: 'no-repeat',
          }}
        />
        <div className="absolute inset-0 bg-[#0B1120]/70 md:hidden" aria-hidden="true" />
        <div
          className="absolute inset-0 hidden md:block"
          aria-hidden="true"
          style={{ background: 'linear-gradient(90deg, #0B1120 0%, #0B1120 25%, rgba(11,17,32,0.65) 50%, rgba(11,17,32,0) 78%)' }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-32"
          aria-hidden="true"
          style={{ background: 'linear-gradient(180deg, rgba(11,17,32,0), #0B1120)' }}
        />

        <div className="relative max-w-6xl mx-auto px-5 sm:px-6 pt-28 md:pt-36 pb-14 md:pb-28 min-h-[420px] md:min-h-[480px] flex flex-col justify-center">
          <p className="text-xs font-mono text-[#D4A94B] mb-3">WELCOME BACK</p>
          <h1 className="font-display text-3xl md:text-5xl font-bold text-slate-100 leading-tight max-w-xl">
            {first ? `Hi ${first}, ` : ''}find your next<br />
            <span className="text-[#D4A94B]">gaming account</span>
          </h1>

          <form onSubmit={search} className="relative mt-7 sm:mt-8 max-w-xl w-full">
            <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search games, ranks, accounts..."
              className="w-full bg-[#0D1524]/90 border border-slate-700 rounded-xl pl-11 pr-24 sm:pr-28 py-3.5 text-slate-200 text-sm focus:outline-none focus:border-[#D4A94B] transition-colors" />
            <button type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-[#D4A94B] hover:bg-[#c49a3f] text-[#0B1120] font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors">
              Search
            </button>
          </form>

          <div className="flex flex-wrap gap-3 mt-5 sm:mt-6">
            {actions.map(({ to, label, icon: Icon, primary }) => (
              <Link key={to} to={to}
                className={`flex items-center gap-2 rounded-xl sm:rounded-lg px-4 py-3 sm:py-2.5 text-sm font-semibold transition-colors ${
                  primary
                    ? 'bg-[#D4A94B] hover:bg-[#c49a3f] text-[#0B1120]'
                    : 'border border-[#D4A94B]/60 text-[#D4A94B] hover:bg-[#D4A94B]/10 bg-[#0B1120]/50'
                }`}>
                <Icon size={15} /> {label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 sm:px-6 py-9 sm:py-12">
        <SectionTitle sub="Buy gaming accounts from verified sellers, protected by escrow." to="/browse" toLabel="Browse all">
          Accounts for sale
        </SectionTitle>
        {games === null ? (
          <RowSkeleton />
        ) : games.length === 0 ? (
          <div className="rounded-xl bg-[#131B2E] border border-slate-800 p-8 sm:p-10 text-center">
            <p className="text-slate-500 text-sm">No live listings yet. Check back soon.</p>
          </div>
        ) : (
          <div className={ROW}>
            {games.map((g) => (
              <Link to={`/browse?game=${encodeURIComponent(g.game)}`} key={g.game} className={TILE}>
                <GameArt game={g.game} image={assetUrl(g.cover)} className="h-28 w-full" />
                <div className="px-3 py-2.5">
                  <p className="text-sm text-slate-200 font-medium truncate">{g.game}</p>
                  <p className="text-xs text-slate-500">{g.count} {g.count === 1 ? 'listing' : 'listings'}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {isBuyer && (
        <section className="max-w-6xl mx-auto px-5 sm:px-6 py-9 sm:py-12">
          <SectionTitle sub="Pay in Naira and the coins are sent straight to your game account." to="/topup" toLabel="Browse all">
            Game top-ups
          </SectionTitle>
          {topups === null ? (
            <RowSkeleton />
          ) : topups === 'off' || topups.length === 0 ? (
            <div className="rounded-xl bg-[#131B2E] border border-slate-800 p-8 sm:p-10 text-center">
              <p className="text-slate-500 text-sm">Top-ups are not available right now. Check back soon.</p>
            </div>
          ) : (
            <div className={ROW}>
              {topups.map((g) => (
                <Link to="/topup" key={g.id} className={TILE}>
                  <TopupGameImage key={g.id} game={g} className="h-28 w-full" />
                  <div className="px-3 py-2.5">
                    <p className="text-sm text-slate-200 font-medium truncate">{g.name}</p>
                    <p className="text-xs text-slate-500">Top-up</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="max-w-6xl mx-auto px-5 sm:px-6 pb-14 sm:pb-16">
        <div className="rounded-2xl bg-[#131B2E] border border-slate-800 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <ShieldCheck size={22} className="text-[#D4A94B] shrink-0" />
            <p className="text-sm text-slate-400">
              Every purchase is protected by KayVault Escrow. Your money is only released when you confirm the account works.
            </p>
          </div>
          <Link to="/browse" className="flex items-center gap-2 text-sm text-[#D4A94B] hover:underline whitespace-nowrap py-1">
            Start browsing <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}