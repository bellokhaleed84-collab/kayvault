import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ShieldCheck, Layers, Monitor, Tag, User } from 'lucide-react';
import PublicNavbar from '../components/PublicNavbar';
import Footer from '../components/Footer';
import GameArt from '../components/GameArt';
import AccountCard from '../components/AccountCard';
import Skel from '../components/Skeleton';
import { Stars } from '../components/Stars';
import SellerReviews from '../components/SellerReviews';
import VerifiedBadge from '../components/VerifiedBadge';
import { api, assetUrl } from '../lib/api';
import { useAuth } from '../lib/AuthContext';

const TYPE_LABELS = { standard: 'Standard', modded: 'Modded', smurf: 'Smurf', fresh: 'Fresh', other: 'Other' };

export default function ListingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [active, setActive] = useState(0);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState('');

  useEffect(() => {
    setData(null);
    setError('');
    setActive(0);
    setBuyError('');
    window.scrollTo(0, 0);
    api.get(`/listings/item/${id}`).then(setData).catch((e) => setError(e.message));
  }, [id]);

  async function buy() {
    setBuyError('');
    if (!profile) return navigate('/login');
    if (profile.role !== 'buyer') return setBuyError('Only buyer accounts can purchase. Sign up with a buyer account to buy.');
    setBuying(true);
    try {
      const pay = await api.post('/payments/initialize', { listing_id: id });
      window.location.assign(pay.authorization_url);
    } catch (e) {
      setBuyError(e.message);
    }
    setBuying(false);
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0B1120] text-slate-200">
        <PublicNavbar />
        <div className="max-w-6xl mx-auto px-6 py-24 text-center">
          <p className="text-slate-400 mb-4">{error}</p>
          <Link to="/browse" className="text-[#8B5CF6] hover:underline">Back to listings</Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0B1120] text-slate-200">
        <PublicNavbar />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-5">
          <Skel className="h-5 w-32" />
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-5">
              <Skel className="h-60 sm:h-96 w-full rounded-2xl" />
              <Skel className="h-8 w-3/4" />
              <Skel className="h-8 w-40" />
              <Skel className="h-40 w-full rounded-xl" />
            </div>
            <Skel className="h-56 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  const { listing: l, seller, similar } = data;
  const images = (l.image_urls || []).map(assetUrl);
  const sold = l.status === 'sold';
  const since = seller.since
    ? new Date(seller.since).toLocaleDateString('en', { month: 'short', year: 'numeric' })
    : null;

  const facts = [
    { icon: Layers, label: 'Level / Rank', value: l.level },
    { icon: Monitor, label: 'Platform', value: l.platform },
    { icon: Tag, label: 'Account type', value: TYPE_LABELS[l.account_type] },
  ].filter((f) => f.value);

  const buyLabel = sold ? 'Sold' : buying ? 'Processing...' : profile ? 'Purchase Now' : 'Log in to buy';

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-200">
      <PublicNavbar />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <Link to="/browse" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 mb-5 sm:mb-6 py-1">
          <ArrowLeft size={14} /> Back to Listings
        </Link>

        <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-2 space-y-6 sm:space-y-8 min-w-0">
            <div>
              {images.length > 0 ? (
                <img src={images[active]} alt={l.game} className="w-full h-60 sm:h-96 object-cover rounded-xl sm:rounded-2xl border border-slate-800" />
              ) : (
                <GameArt game={l.game} className="w-full h-60 sm:h-96 rounded-xl sm:rounded-2xl border border-slate-800" />
              )}
              {images.length > 1 && (
                <div className="flex gap-3 mt-3 overflow-x-auto pb-1">
                  {images.map((src, i) => (
                    <button key={i} onClick={() => setActive(i)}
                      className={`w-20 h-16 shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${i === active ? 'border-[#8B5CF6]' : 'border-slate-800'}`}>
                      <img src={src} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-2">
                <h1 className="font-display text-xl sm:text-2xl lg:text-3xl font-semibold text-slate-100 break-words min-w-0">{l.game} &mdash; {l.tier}</h1>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${sold ? 'bg-[#5B8DEF]/15 text-[#5B8DEF]' : 'bg-[#34D399]/15 text-[#34D399]'}`}>
                  {sold ? 'Sold' : 'Live'}
                </span>
              </div>
              <p className="font-mono text-2xl sm:text-3xl text-[#8B5CF6]">&#8358;{Number(l.price).toLocaleString()}</p>
            </div>

            <div className="rounded-xl bg-[#131B2E] border border-slate-800 p-5 sm:p-6">
              <h2 className="font-display text-lg font-semibold text-slate-100 mb-3">About This Account</h2>
              <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-line break-words">
                {l.description || 'The seller has not added a description yet.'}
              </p>
              {l.features?.length > 0 && (
                <div className="grid sm:grid-cols-2 gap-3 mt-5">
                  {l.features.map((f) => (
                    <div key={f} className="flex items-center gap-2 text-sm text-slate-300">
                      <CheckCircle2 size={16} className="text-[#34D399] shrink-0" /> {f}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24 self-start min-w-0">
            {facts.length > 0 && (
              <div className="rounded-xl bg-[#131B2E] border border-slate-800 p-5 space-y-3.5">
                {facts.map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-3">
                    <Icon size={16} className="text-[#8B5CF6]" />
                    <div className="leading-tight">
                      <p className="text-[11px] font-mono text-slate-500">{label.toUpperCase()}</p>
                      <p className="text-sm text-slate-200">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-xl bg-[#131B2E] border border-slate-800 p-5">
              <p className="text-[11px] font-mono text-slate-500 mb-3">SOLD BY</p>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 shrink-0 rounded-full bg-[#0D1524] border border-slate-800 flex items-center justify-center text-[#8B5CF6]">
                  <User size={18} />
                </div>
                <div className="leading-tight min-w-0">
                  <p className="text-sm text-slate-100 font-medium flex items-center gap-1.5 flex-wrap">{seller.name}{seller.verified && <VerifiedBadge />}</p>
                  <p className="text-xs text-slate-500">
                    {since ? `Seller since ${since}` : 'KayVault seller'}
                    {seller.country ? ` \u00b7 ${seller.country}` : ''}
                  </p>
                  <p className="text-xs text-slate-500">{seller.sales} completed {seller.sales === 1 ? 'sale' : 'sales'}</p>
                  <div className="mt-1">
                    {seller.reviews > 0 ? (
                      <span className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Stars value={seller.rating} size={13} /> {seller.rating} ({seller.reviews})
                      </span>
                    ) : (
                      <span className="text-xs text-slate-600">No reviews yet</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* desktop buy box. On a phone the buy bar at the bottom of the screen is used instead. */}
            <div className="hidden lg:block rounded-xl bg-[#131B2E] border border-slate-800 p-5">
              <p className="text-[11px] font-mono text-slate-500 mb-2">BUY THIS ACCOUNT</p>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-slate-400">Price</span>
                <span className="font-mono text-xl text-slate-100">&#8358;{Number(l.price).toLocaleString()}</span>
              </div>
              <button onClick={buy} disabled={buying || sold}
                className="w-full bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-60 text-white font-semibold rounded-lg py-3 text-sm transition-colors">
                {buyLabel}
              </button>
              {buyError && <p className="text-red-400 text-xs mt-3">{buyError}</p>}
              <div className="flex items-center gap-2 mt-4 text-xs text-slate-500">
                <ShieldCheck size={14} className="text-[#8B5CF6]" /> Protected by KayVault Escrow
              </div>
            </div>
          </aside>
        </div>

        <SellerReviews sellerId={seller.id} name={seller.name} />

        {similar.length > 0 && (
          <section className="mt-12 sm:mt-16">
            <h2 className="font-display text-xl sm:text-2xl font-semibold text-slate-100 mb-5 sm:mb-6">Similar Listings</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {similar.map((s) => (
                <Link key={s.id} to={`/listing/${s.id}`} className="block">
                  <AccountCard game={s.game} tier={s.tier} price={s.price} status={s.status} image={assetUrl(s.image_urls?.[0])} />
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="pb-24 lg:pb-0">
        <Footer />
      </div>

      {/* phone buy bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-slate-800 bg-[#0B1120]/95 backdrop-blur px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {buyError && <p className="text-red-400 text-xs mb-2">{buyError}</p>}
        <div className="flex items-center gap-4">
          <div className="leading-tight">
            <p className="font-mono text-lg text-[#8B5CF6]">&#8358;{Number(l.price).toLocaleString()}</p>
            <p className="flex items-center gap-1 text-[11px] text-slate-500"><ShieldCheck size={12} className="text-[#8B5CF6]" /> Escrow protected</p>
          </div>
          <button onClick={buy} disabled={buying || sold}
            className="flex-1 bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-60 text-white font-semibold rounded-xl py-3.5 text-base transition-colors">
            {buyLabel}
          </button>
        </div>
      </div>
    </div>
  );
}