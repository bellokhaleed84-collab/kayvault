// KV-HOME v1
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ShoppingBag, Plus, LayoutDashboard, ShieldCheck, ArrowRight } from 'lucide-react';
import PublicNavbar from '../components/PublicNavbar';
import Footer from '../components/Footer';
import GameArt from '../components/GameArt';
import AccountCard from '../components/AccountCard';
import { api, assetUrl } from '../lib/api';
import { useAuth } from '../lib/AuthContext';

function SectionTitle({ children, sub, to, toLabel = 'View all' }) {
  return (
    <div className="flex items-end justify-between mb-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-slate-100">{children}</h2>
        {sub && <p className="text-slate-500 text-sm mt-1">{sub}</p>}
      </div>
      {to && <Link to={to} className="text-sm text-[#D4A94B] hover:underline">{toLabel}</Link>}
    </div>
  );
}

export default function HomePage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [games, setGames] = useState(null);
  const [latest, setLatest] = useState(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    api.get('/listings/games?limit=12').then(setGames).catch(() => setGames([]));
    api.get('/listings/featured').then(setLatest).catch(() => setLatest([]));
  }, []);

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
      <PublicNavbar overlay />

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

        <div className="relative max-w-6xl mx-auto px-6 pt-32 md:pt-36 pb-20 md:pb-28 min-h-[480px] flex flex-col justify-center">
          <p className="text-xs font-mono text-[#D4A94B] mb-3">WELCOME BACK</p>
          <h1 className="font-display text-3xl md:text-5xl font-bold text-slate-100 leading-tight max-w-xl">
            {first ? `Hi ${first}, ` : ''}find your next<br />
            <span className="text-[#D4A94B]">gaming account</span>
          </h1>

          <form onSubmit={search} className="relative mt-8 max-w-xl w-full">
            <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search games, ranks, accounts..."
              className="w-full bg-[#0D1524]/90 border border-slate-700 rounded-xl pl-11 pr-28 py-3.5 text-slate-200 text-sm focus:outline-none focus:border-[#D4A94B] transition-colors" />
            <button type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#D4A94B] hover:bg-[#c49a3f] text-[#0B1120] font-semibold rounded-lg px-4 py-2 text-sm transition-colors">
              Search
            </button>
          </form>

          <div className="flex flex-wrap gap-3 mt-6">
            {actions.map(({ to, label, icon: Icon, primary }) => (
              <Link key={to} to={to}
                className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
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

      <section className="max-w-6xl mx-auto px-6 py-12">
        <SectionTitle sub="The games with the most accounts available right now." to="/browse" toLabel="Browse all games">
          Top Games
        </SectionTitle>
        {games === null ? (
          <p className="text-slate-500 text-sm">Loading...</p>
        ) : games.length === 0 ? (
          <div className="rounded-xl bg-[#131B2E] border border-slate-800 p-10 text-center">
            <p className="text-slate-500 text-sm">No live listings yet. Check back soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {games.map((g) => (
              <Link
                to={`/browse?game=${encodeURIComponent(g.game)}`}
                key={g.game}
                className="group rounded-xl overflow-hidden border border-slate-800 hover:border-[#D4A94B]/50 transition-colors bg-[#131B2E]"
              >
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

      <section className="max-w-6xl mx-auto px-6 py-12">
        <SectionTitle sub="The newest accounts approved by our team." to="/browse">
          Latest Accounts
        </SectionTitle>
        {latest === null ? (
          <p className="text-slate-500 text-sm">Loading...</p>
        ) : latest.length === 0 ? (
          <div className="rounded-xl bg-[#131B2E] border border-slate-800 p-10 text-center">
            <p className="text-slate-500 text-sm">Nothing here yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {latest.map((l) => (
              <Link key={l.id} to={`/listing/${l.id}`} className="block">
                <AccountCard game={l.game} tier={l.tier} price={l.price} status={l.status} image={assetUrl(l.image_urls?.[0])} />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="rounded-2xl bg-[#131B2E] border border-slate-800 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldCheck size={22} className="text-[#D4A94B] shrink-0" />
            <p className="text-sm text-slate-400">
              Every purchase is protected by KayVault Escrow. Your money is only released when you confirm the account works.
            </p>
          </div>
          <Link to="/browse" className="flex items-center gap-2 text-sm text-[#D4A94B] hover:underline whitespace-nowrap">
            Start browsing <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
