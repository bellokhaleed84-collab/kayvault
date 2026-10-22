import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ShieldCheck, Layers, Monitor, Tag, User } from 'lucide-react';
import PublicNavbar from '../components/PublicNavbar';
import Footer from '../components/Footer';
import GameArt from '../components/GameArt';
import AccountCard from '../components/AccountCard';
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
          <Link to="/browse" className="text-[#D4A94B] hover:underline">Back to listings</Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0B1120] text-slate-200">
        <PublicNavbar />
        <p className="max-w-6xl mx-auto px-6 py-24 text-slate-500 text-sm">Loading...</p>
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

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-200">
      <PublicNavbar />

      <div className="max-w-6xl mx-auto px-6 py-10">
        <Link to="/browse" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 mb-6">
          <ArrowLeft size={14} /> Back to Listings
        </Link>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div>
              {images.length > 0 ? (
                <img src={images[active]} alt={l.game} className="w-full h-72 sm:h-96 object-cover rounded-2xl border border-slate-800" />
              ) : (
                <GameArt game={l.game} className="w-full h-72 sm:h-96 rounded-2xl border border-slate-800" />
              )}
              {images.length > 1 && (
                <div className="flex gap-3 mt-3">
                  {images.map((src, i) => (
                    <button key={i} onClick={() => setActive(i)}
                      className={`w-20 h-16 rounded-lg overflow-hidden border-2 transition-colors ${i === active ? 'border-[#D4A94B]' : 'border-slate-800'}`}>
                      <img src={src} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="font-display text-2xl sm:text-3xl font-semibold text-slate-100">{l.game} &mdash; {l.tier}</h1>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${sold ? 'bg-[#5B8DEF]/15 text-[#5B8DEF]' : 'bg-[#34D399]/15 text-[#34D399]'}`}>
                  {sold ? 'Sold' : 'Live'}
                </span>
              </div>
              <p className="font-mono text-3xl text-[#D4A94B]">&#8358;{Number(l.price).toLocaleString()}</p>
            </div>

            <div className="rounded-xl bg-[#131B2E] border border-slate-800 p-6">
              <h2 className="font-display text-lg font-semibold text-slate-100 mb-3">About This Account</h2>
              <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-line">
                {l.description || 'The seller has not added a description yet.'}
              </p>
              {l.features?.length > 0 && (
                <div className="grid sm:grid-cols-2 gap-3 mt-5">
                  {l.features.map((f) => (
                    <div key={f} className="flex items-center gap-2 text-sm text-slate-300">
                      <CheckCircle2 size={16} className="text-[#34D399]" /> {f}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24 self-start">
            {facts.length > 0 && (
              <div className="rounded-xl bg-[#131B2E] border border-slate-800 p-5 space-y-3.5">
                {facts.map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-3">
                    <Icon size={16} className="text-[#D4A94B]" />
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
                <div className="w-11 h-11 rounded-full bg-[#0D1524] border border-slate-800 flex items-center justify-center text-[#D4A94B]">
                  <User size={18} />
                </div>
                <div className="leading-tight">
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

            <div className="rounded-xl bg-[#131B2E] border border-slate-800 p-5">
              <p className="text-[11px] font-mono text-slate-500 mb-2">BUY THIS ACCOUNT</p>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-slate-400">Price</span>
                <span className="font-mono text-xl text-slate-100">&#8358;{Number(l.price).toLocaleString()}</span>
              </div>
              <button onClick={buy} disabled={buying || sold}
                className="w-full bg-[#D4A94B] hover:bg-[#c49a3f] disabled:opacity-60 text-[#0B1120] font-semibold rounded-lg py-3 text-sm transition-colors">
                {sold ? 'Sold' : buying ? 'Processing...' : profile ? 'Purchase Now' : 'Log in to buy'}
              </button>
              {buyError && <p className="text-red-400 text-xs mt-3">{buyError}</p>}
              <div className="flex items-center gap-2 mt-4 text-xs text-slate-500">
                <ShieldCheck size={14} className="text-[#D4A94B]" /> Protected by KayVault Escrow
              </div>
            </div>
          </aside>
        </div>

        <SellerReviews sellerId={seller.id} name={seller.name} />

        {similar.length > 0 && (
          <section className="mt-16">
            <h2 className="font-display text-2xl font-semibold text-slate-100 mb-6">Similar Listings</h2>
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

      <Footer />
    </div>
  );
}