import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import PublicNavbar from '../components/PublicNavbar';
import Footer from '../components/Footer';
import AccountCard from '../components/AccountCard';
import { api, assetUrl } from '../lib/api';

const PLATFORMS = ['PC', 'PlayStation', 'Xbox', 'Mobile'];
const TYPES = [['standard', 'Standard'], ['modded', 'Modded'], ['smurf', 'Smurf'], ['fresh', 'Fresh'], ['other', 'Other']];
const SORTS = [['newest', 'Newest'], ['price_asc', 'Price: Low to High'], ['price_desc', 'Price: High to Low']];

const box = 'w-full bg-[#0D1524] border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-[#D4A94B]';
const heading = 'text-xs font-mono text-slate-500 mb-3';

export default function BrowseListings() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState({ items: [], total: 0, page: 1, pages: 1 });
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState(params.get('q') || '');
  const [min, setMin] = useState(params.get('min') || '');
  const [max, setMax] = useState(params.get('max') || '');

  const game = params.get('game') || '';
  const platform = params.get('platform') || '';
  const types = (params.get('type') || '').split(',').filter(Boolean);
  const sort = params.get('sort') || 'newest';
  const page = Number(params.get('page')) || 1;
  const query = params.toString();

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in changes)) next.delete('page');
    setParams(next);
  };

  useEffect(() => {
    api.get('/listings/games?limit=50').then(setGames).catch(() => {});
  }, []);

  useEffect(() => {
    setQ(params.get('q') || '');
    setMin(params.get('min') || '');
    setMax(params.get('max') || '');
    setLoading(true);
    setError('');
    api.get(`/listings/browse?${query}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleType = (t) => {
    const next = types.includes(t) ? types.filter((x) => x !== t) : [...types, t];
    update({ type: next.join(',') });
  };

  const pageNumbers = [];
  for (let p = Math.max(1, page - 2); p <= Math.min(data.pages, page + 2); p++) pageNumbers.push(p);

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-200">
      <PublicNavbar />

      <div className="max-w-6xl mx-auto px-6 py-10 grid lg:grid-cols-[230px_1fr] gap-8">
        {/* ------------------------------ filters */}
        <aside className="space-y-8">
          <div>
            <p className={heading}>BROWSE</p>
            <button onClick={() => update({ game: '' })}
              className={`w-full text-left text-sm rounded-lg px-3 py-2 transition-colors ${!game ? 'bg-[#D4A94B]/15 text-[#D4A94B]' : 'text-slate-400 hover:text-slate-200'}`}>
              All Games
            </button>
            {games.map((g) => (
              <button key={g.game} onClick={() => update({ game: g.game })}
                className={`w-full flex items-center justify-between text-left text-sm rounded-lg px-3 py-2 transition-colors ${
                  game.toLowerCase() === g.game.toLowerCase() ? 'bg-[#D4A94B]/15 text-[#D4A94B]' : 'text-slate-400 hover:text-slate-200'
                }`}>
                <span className="truncate">{g.game}</span>
                <span className="text-xs text-slate-600">{g.count}</span>
              </button>
            ))}
          </div>

          <div>
            <p className={heading}>PRICE RANGE (&#8358;)</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <input type="number" min="0" placeholder="Min" value={min} onChange={(e) => setMin(e.target.value)} className={box} />
              <input type="number" min="0" placeholder="Max" value={max} onChange={(e) => setMax(e.target.value)} className={box} />
            </div>
            <button onClick={() => update({ min, max })}
              className="w-full bg-[#D4A94B] hover:bg-[#c49a3f] text-[#0B1120] font-semibold rounded-lg py-2 text-sm transition-colors">
              Apply
            </button>
          </div>

          <div>
            <p className={heading}>ACCOUNT TYPE</p>
            {TYPES.map(([v, l]) => (
              <label key={v} className="flex items-center gap-2.5 text-sm text-slate-400 mb-2.5 cursor-pointer">
                <input type="checkbox" checked={types.includes(v)} onChange={() => toggleType(v)} className="accent-[#D4A94B] w-4 h-4" />
                {l}
              </label>
            ))}
          </div>

          {query && (
            <button onClick={() => setParams(new URLSearchParams())} className="text-sm text-[#D4A94B] hover:underline">
              Reset filters
            </button>
          )}
        </aside>

        {/* ------------------------------ results */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="font-display text-3xl font-semibold text-slate-100">{game || 'All Games'}</h1>
              <p className="text-slate-500 text-sm mt-1">{data.total} {data.total === 1 ? 'listing' : 'listings'} found</p>
            </div>
            <div className="flex items-center gap-3">
              <form onSubmit={(e) => { e.preventDefault(); update({ q }); }} className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search games, accounts..."
                  className={`${box} pl-9 w-56`} />
              </form>
              <select value={sort} onChange={(e) => update({ sort: e.target.value === 'newest' ? '' : e.target.value })} className={`${box} w-auto`}>
                {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {['', ...PLATFORMS].map((p) => (
              <button key={p || 'all'} onClick={() => update({ platform: p })}
                className={`rounded-full px-4 py-1.5 text-xs font-medium border transition-colors ${
                  platform === p ? 'bg-[#D4A94B] border-[#D4A94B] text-[#0B1120]' : 'border-slate-800 text-slate-400 hover:text-slate-200'
                }`}>
                {p || 'All Listings'}
              </button>
            ))}
          </div>

          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

          {loading ? (
            <p className="text-slate-500 text-sm">Loading listings...</p>
          ) : data.items.length === 0 ? (
            <div className="rounded-xl bg-[#131B2E] border border-slate-800 p-10 text-center">
              <p className="text-slate-500 text-sm">No listings match your filters. Try widening your search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {data.items.map((l) => (
                <Link key={l.id} to={`/listing/${l.id}`} className="block">
                  <AccountCard game={l.game} tier={l.tier} price={l.price} status={l.status} image={assetUrl(l.image_urls?.[0])} />
                </Link>
              ))}
            </div>
          )}

          {data.pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-10">
              <button disabled={page <= 1} onClick={() => update({ page: page - 1 })}
                className="w-9 h-9 rounded-lg border border-slate-800 text-slate-400 disabled:opacity-40 flex items-center justify-center">
                <ChevronLeft size={16} />
              </button>
              {pageNumbers.map((p) => (
                <button key={p} onClick={() => update({ page: p })}
                  className={`w-9 h-9 rounded-lg text-sm border transition-colors ${
                    p === page ? 'bg-[#D4A94B] border-[#D4A94B] text-[#0B1120] font-semibold' : 'border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}>
                  {p}
                </button>
              ))}
              <button disabled={page >= data.pages} onClick={() => update({ page: page + 1 })}
                className="w-9 h-9 rounded-lg border border-slate-800 text-slate-400 disabled:opacity-40 flex items-center justify-center">
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </section>
      </div>

      <Footer />
    </div>
  );
}