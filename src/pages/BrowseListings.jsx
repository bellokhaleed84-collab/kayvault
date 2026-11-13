// KV-BROWSE v2: one Filter button holds every filter (sort, game, platform, account type, price)
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, SlidersHorizontal, X } from 'lucide-react';
import PublicNavbar from '../components/PublicNavbar';
import Footer from '../components/Footer';
import AccountCard from '../components/AccountCard';
import Skel from '../components/Skeleton';
import { api, assetUrl } from '../lib/api';

const PLATFORMS = ['PC', 'PlayStation', 'Xbox', 'Mobile'];
const TYPES = [['standard', 'Standard'], ['modded', 'Modded'], ['smurf', 'Smurf'], ['fresh', 'Fresh'], ['other', 'Other']];
const SORTS = [['newest', 'Newest'], ['price_asc', 'Price: Low to High'], ['price_desc', 'Price: High to Low']];

const box =
  'w-full bg-[#0D1524] border border-slate-800 rounded-xl px-3.5 py-3 text-slate-200 text-sm focus:outline-none focus:border-[#D4A94B] focus:ring-2 focus:ring-[#D4A94B]/20 transition-colors';
const heading = 'text-xs font-mono text-slate-500 mb-3';
const chip = (on) =>
  `rounded-full px-4 py-2.5 text-sm font-medium border transition-colors ${
    on ? 'bg-[#D4A94B] border-[#D4A94B] text-[#0B1120]' : 'border-slate-700 text-slate-300 hover:border-slate-500'
  }`;

export default function BrowseListings() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState({ items: [], total: 0, page: 1, pages: 1 });
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState(params.get('q') || '');

  // the filter panel works on a draft; nothing changes until "Show results"
  const [open, setOpen] = useState(false);
  const [dGame, setDGame] = useState('');
  const [dPlatform, setDPlatform] = useState('');
  const [dTypes, setDTypes] = useState([]);
  const [dMin, setDMin] = useState('');
  const [dMax, setDMax] = useState('');
  const [dSort, setDSort] = useState('newest');
  const [panelError, setPanelError] = useState('');

  const game = params.get('game') || '';
  const platform = params.get('platform') || '';
  const types = (params.get('type') || '').split(',').filter(Boolean);
  const sort = params.get('sort') || 'newest';
  const page = Number(params.get('page')) || 1;
  const query = params.toString();
  const hasFilters = Boolean(game || platform || types.length || params.get('min') || params.get('max') || params.get('sort'));

  useEffect(() => {
    api.get('/listings/games?limit=50').then(setGames).catch(() => {});
  }, []);

  useEffect(() => {
    setQ(params.get('q') || '');
    setLoading(true);
    setError('');
    window.scrollTo(0, 0);
    api.get(`/listings/browse?${query}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  // lock the page behind the panel, and let Escape close it
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in changes)) next.delete('page');
    setParams(next);
  };

  function openPanel() {
    setDGame(game);
    setDPlatform(platform);
    setDTypes(types);
    setDMin(params.get('min') || '');
    setDMax(params.get('max') || '');
    setDSort(sort);
    setPanelError('');
    setOpen(true);
  }

  function clearDraft() {
    setDGame('');
    setDPlatform('');
    setDTypes([]);
    setDMin('');
    setDMax('');
    setDSort('newest');
    setPanelError('');
  }

  function apply() {
    if (dMin && dMax && Number(dMin) > Number(dMax)) {
      return setPanelError('The lowest price is higher than the highest price.');
    }
    const next = new URLSearchParams(params); // keeps the search text
    const set = (k, v) => (v ? next.set(k, v) : next.delete(k));
    set('game', dGame);
    set('platform', dPlatform);
    set('type', dTypes.join(','));
    set('min', dMin);
    set('max', dMax);
    set('sort', dSort === 'newest' ? '' : dSort);
    next.delete('page');
    setParams(next);
    setOpen(false);
  }

  const toggleType = (t) => setDTypes(dTypes.includes(t) ? dTypes.filter((x) => x !== t) : [...dTypes, t]);

  const pageNumbers = [];
  for (let p = Math.max(1, page - 2); p <= Math.min(data.pages, page + 2); p++) pageNumbers.push(p);

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-200">
      <PublicNavbar />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="mb-5 sm:mb-6">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-slate-100 break-words">{game || 'All Games'}</h1>
          <p className="text-slate-500 text-sm mt-1">{loading ? 'Loading...' : `${data.total} ${data.total === 1 ? 'listing' : 'listings'} found`}</p>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <form onSubmit={(e) => { e.preventDefault(); update({ q }); }} className="relative flex-1 min-w-0">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search games, accounts..."
              className={`${box} pl-10 h-12`} />
          </form>
          <button type="button" onClick={openPanel}
            className="shrink-0 flex items-center gap-2 h-12 rounded-xl border border-slate-700 hover:border-[#D4A94B] text-slate-200 px-4 text-sm font-medium transition-colors">
            <SlidersHorizontal size={16} /> Filter
          </button>
        </div>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[0, 1, 2, 3, 4, 5].map((i) => <Skel key={i} className="h-64 w-full rounded-xl" />)}
          </div>
        ) : data.items.length === 0 ? (
          <div className="rounded-xl bg-[#131B2E] border border-slate-800 p-8 sm:p-10 text-center">
            <p className="text-slate-500 text-sm mb-4">No listings match your search. Try widening it.</p>
            {(hasFilters || params.get('q')) && (
              <button type="button" onClick={() => setParams(new URLSearchParams())}
                className="border border-[#D4A94B]/60 text-[#D4A94B] hover:bg-[#D4A94B]/10 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors">
                Show all listings
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {data.items.map((l) => (
              <Link key={l.id} to={`/listing/${l.id}`} className="block">
                <AccountCard game={l.game} tier={l.tier} price={l.price} status={l.status} image={assetUrl(l.image_urls?.[0])} />
              </Link>
            ))}
          </div>
        )}

        {data.pages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-10">
            <button disabled={page <= 1} onClick={() => update({ page: page - 1 })} aria-label="Previous page"
              className="w-10 h-10 rounded-lg border border-slate-800 text-slate-400 disabled:opacity-40 flex items-center justify-center">
              <ChevronLeft size={16} />
            </button>
            {pageNumbers.map((p) => (
              <button key={p} onClick={() => update({ page: p })}
                className={`w-10 h-10 rounded-lg text-sm border transition-colors ${
                  p === page ? 'bg-[#D4A94B] border-[#D4A94B] text-[#0B1120] font-semibold' : 'border-slate-800 text-slate-400 hover:text-slate-200'
                }`}>
                {p}
              </button>
            ))}
            <button disabled={page >= data.pages} onClick={() => update({ page: page + 1 })} aria-label="Next page"
              className="w-10 h-10 rounded-lg border border-slate-800 text-slate-400 disabled:opacity-40 flex items-center justify-center">
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      <Footer />

      {open && (
        <div className="fixed inset-0 z-50 flex items-end md:items-stretch md:justify-end" role="dialog" aria-modal="true" aria-label="Filter">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative w-full md:w-[420px] max-h-[88dvh] md:max-h-none md:h-full flex flex-col bg-[#0B1120] border-t md:border-t-0 md:border-l border-slate-800 rounded-t-2xl md:rounded-none shadow-2xl">
            <div className="flex items-center justify-between pl-5 pr-2 py-2 border-b border-slate-800 shrink-0">
              <h2 className="font-display text-lg font-semibold text-slate-100">Filter</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close"
                className="w-11 h-11 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-100">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-7">
              <div>
                <p className={heading}>SORT BY</p>
                <div className="flex flex-wrap gap-2">
                  {SORTS.map(([v, l]) => (
                    <button key={v} type="button" onClick={() => setDSort(v)} className={chip(dSort === v)}>{l}</button>
                  ))}
                </div>
              </div>

              <div>
                <p className={heading}>GAME</p>
                <div className="rounded-xl border border-slate-800 divide-y divide-slate-800 max-h-60 overflow-y-auto">
                  {[{ game: '', count: null }, ...games].map((g) => {
                    const on = dGame.toLowerCase() === g.game.toLowerCase();
                    return (
                      <button key={g.game || 'all'} type="button" onClick={() => setDGame(g.game)}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 text-left text-sm transition-colors ${on ? 'text-[#D4A94B]' : 'text-slate-300 hover:bg-slate-800/40'}`}>
                        <span className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${on ? 'border-[#D4A94B]' : 'border-slate-600'}`}>
                          {on && <span className="w-2 h-2 rounded-full bg-[#D4A94B]" />}
                        </span>
                        <span className="flex-1 truncate">{g.game || 'All Games'}</span>
                        {g.count != null && <span className="text-xs text-slate-600">{g.count}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className={heading}>PLATFORM</p>
                <div className="flex flex-wrap gap-2">
                  {['', ...PLATFORMS].map((p) => (
                    <button key={p || 'all'} type="button" onClick={() => setDPlatform(p)} className={chip(dPlatform === p)}>
                      {p || 'All'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className={heading}>ACCOUNT TYPE</p>
                <div className="flex flex-wrap gap-2">
                  {TYPES.map(([v, l]) => (
                    <button key={v} type="button" onClick={() => toggleType(v)} className={chip(dTypes.includes(v))}>{l}</button>
                  ))}
                </div>
              </div>

              <div>
                <p className={heading}>PRICE RANGE (&#8358;)</p>
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" inputMode="numeric" min="0" placeholder="Lowest" value={dMin} onChange={(e) => setDMin(e.target.value)} className={box} />
                  <input type="number" inputMode="numeric" min="0" placeholder="Highest" value={dMax} onChange={(e) => setDMax(e.target.value)} className={box} />
                </div>
              </div>

              {panelError && <p className="text-red-400 text-sm">{panelError}</p>}
            </div>

            <div className="shrink-0 border-t border-slate-800 px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] flex gap-3">
              <button type="button" onClick={clearDraft}
                className="flex-1 border border-slate-700 hover:border-slate-500 text-slate-300 font-semibold rounded-xl py-3.5 text-sm transition-colors">
                Clear all
              </button>
              <button type="button" onClick={apply}
                className="flex-[2] bg-[#D4A94B] hover:bg-[#c49a3f] text-[#0B1120] font-semibold rounded-xl py-3.5 text-sm transition-colors">
                Show results
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}