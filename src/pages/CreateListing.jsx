import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, ImagePlus, Trash2, Lock } from 'lucide-react';
import DashHeader from '../components/DashHeader';
import GameArt from '../components/GameArt';
import { PasswordField } from '../components/AuthFields';
import { api } from '../lib/api';
import { useAuth } from '../lib/AuthContext'; // KV-P17C-AUTHIMP
import { resizeToDataUrl } from '../lib/images';
import { money } from '../lib/orders';

const STEPS = ['Details', 'Images', 'Delivery', 'Review'];
const PLATFORMS = ['PC', 'PlayStation', 'Xbox', 'Mobile', 'Other'];
const TYPES = [['standard', 'Standard'], ['modded', 'Modded'], ['smurf', 'Smurf'], ['fresh', 'Fresh'], ['other', 'Other']];

const input =
  'w-full bg-[#0D1524] border border-slate-800 rounded-lg px-3.5 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-[#D4A94B] transition-colors';
const label = 'block text-xs font-mono text-slate-500 mb-2';

export default function CreateListing() {
  const navigate = useNavigate();
  const { profile } = useAuth(); // KV-P17C-HOOK
  const needsId = Boolean(profile && profile.role === 'seller' && profile.kyc_status !== 'verified'); // KV-P17E-NEEDS
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    game: '', tier: '', level: '', platform: 'PC', account_type: 'standard',
    price: '', description: '', features: '',
    account_login: '', account_password: '', account_notes: '',
  });
  const [images, setImages] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  function problem(s) {
    if (needsId) return 'Only verified sellers can create listings.'; // KV-P17E-PROB
    if (s === 0) {
      if (!form.game.trim()) return 'Enter the game name.';
      if (!form.tier.trim()) return 'Add a headline buyers will see, for example "Galaxy Skin, 150+ skins".';
      if (!(Number(form.price) > 0)) return 'Enter a price in naira.';
    }
    if (s === 2) {
      if (!form.account_login.trim()) return 'Enter the login or email for the account.';
      if (!form.account_password) return 'Enter the account password.';
    }
    return '';
  }

  function next() {
    const msg = problem(step);
    if (msg) return setError(msg);
    setError('');
    setStep(step + 1);
  }

  async function pick(e) {
    setError('');
    try {
      const files = [...e.target.files].slice(0, 4 - images.length);
      const out = await Promise.all(files.map((f) => resizeToDataUrl(f)));
      setImages([...images, ...out]);
    } catch (err) {
      setError(err.message);
    }
    e.target.value = '';
  }

  async function submit() {
    const msg = problem(0) || problem(2);
    if (msg) return setError(msg);
    setSaving(true);
    setError('');
    try {
      await api.post('/listings', {
        ...form,
        features: form.features.split(',').map((f) => f.trim()).filter(Boolean),
        images,
      });
      navigate('/dashboard/seller', { state: { created: true } });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  const features = form.features.split(',').map((f) => f.trim()).filter(Boolean);

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-200">
      <DashHeader />

      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link to="/dashboard/seller" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 mb-6">
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
        <h1 className="font-display text-3xl font-semibold text-slate-100 mb-8">Create a listing</h1>
        {/* KV-P17C-CREATEBANNER */}
        {needsId && (
          <div className="rounded-lg border border-[#D4A94B]/40 bg-[#D4A94B]/5 px-4 py-3 mb-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-300">{profile && profile.kyc_status === 'pending' ? 'Your ID is being reviewed. You can create listings once you are verified.' : 'Only verified sellers can create listings. Verify your identity first.'}</p>
            <Link to="/settings?tab=verification" className="bg-[#D4A94B] hover:bg-[#c49a3f] text-[#0B1120] font-semibold rounded-lg px-4 py-2 text-xs transition-colors">Verify now</Link>
          </div>
        )}

        <ol className="flex items-center mb-8">
          {STEPS.map((name, i) => (
            <li key={name} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-2.5">
                <span className={`w-7 h-7 rounded-full text-xs font-mono flex items-center justify-center border ${
                  i < step ? 'bg-[#D4A94B] border-[#D4A94B] text-[#0B1120]'
                  : i === step ? 'border-[#D4A94B] text-[#D4A94B]'
                  : 'border-slate-700 text-slate-600'
                }`}>
                  {i < step ? <Check size={14} /> : i + 1}
                </span>
                <span className={`text-sm hidden sm:inline ${i === step ? 'text-slate-100' : 'text-slate-500'}`}>{name}</span>
              </div>
              {i < STEPS.length - 1 && <span className="flex-1 h-px bg-slate-800 mx-3" />}
            </li>
          ))}
        </ol>

        <div className="rounded-xl bg-[#131B2E] border border-slate-800 p-6 space-y-5">
          {step === 0 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={label}>GAME</label>
                  <input value={form.game} onChange={set('game')} className={input} placeholder="e.g. Fortnite" />
                </div>
                <div>
                  <label className={label}>LEVEL / RANK</label>
                  <input value={form.level} onChange={set('level')} className={input} placeholder="e.g. Level 320" />
                </div>
              </div>
              <div>
                <label className={label}>HEADLINE</label>
                <input value={form.tier} onChange={set('tier')} className={input} placeholder="e.g. Galaxy Skin, 150+ skins" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={label}>PLATFORM</label>
                  <select value={form.platform} onChange={set('platform')} className={input}>
                    {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className={label}>ACCOUNT TYPE</label>
                  <select value={form.account_type} onChange={set('account_type')} className={input}>
                    {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className={label}>PRICE (&#8358;)</label>
                  <input type="number" min="1" value={form.price} onChange={set('price')} className={input} placeholder="50000" />
                </div>
              </div>
              <div>
                <label className={label}>DESCRIPTION</label>
                <textarea rows={5} value={form.description} onChange={set('description')} className={input}
                  placeholder="What is included? Skins, rank, linked accounts, how it was earned..." />
              </div>
              <div>
                <label className={label}>FEATURES (comma separated)</label>
                <input value={form.features} onChange={set('features')} className={input}
                  placeholder="High level, Rare skins, No bans, Full access" />
              </div>
            </>
          )}

          {step === 1 && (
            <div>
              <label className={label}>SCREENSHOTS (up to 4)</label>
              <div className="flex flex-wrap gap-3">
                {images.map((src, i) => (
                  <div key={i} className="relative w-28 h-24 rounded-lg overflow-hidden border border-slate-800">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button type="button" aria-label="Remove image" onClick={() => setImages(images.filter((_, j) => j !== i))}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                {images.length < 4 && (
                  <label className="w-28 h-24 rounded-lg border border-dashed border-slate-700 hover:border-[#D4A94B] flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-[#D4A94B] cursor-pointer transition-colors">
                    <ImagePlus size={20} />
                    <span className="text-xs">Add image</span>
                    <input type="file" accept="image/*" multiple onChange={pick} className="hidden" />
                  </label>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-4 leading-relaxed">
                The first image is the cover. Show the profile, rank and items. Never include passwords or login details in screenshots. You can skip this step, but listings with images sell faster.
              </p>
            </div>
          )}

          {step === 2 && (
            <>
              <div className="flex items-start gap-2.5 rounded-lg border border-slate-800 bg-[#0D1524]/50 p-4">
                <Lock size={15} className="text-[#34D399] mt-0.5 shrink-0" />
                <p className="text-xs text-slate-500 leading-relaxed">
                  <span className="text-slate-300 font-medium">Encrypted on our server.</span> Only the buyer sees these details, and only after they pay. They never appear on the listing or to our review team.
                </p>
              </div>
              <div>
                <label className={label}>ACCOUNT LOGIN / EMAIL</label>
                <input value={form.account_login} onChange={set('account_login')} className={input}
                  placeholder="Username or email used to sign in" autoComplete="off" />
              </div>
              <PasswordField label="ACCOUNT PASSWORD" value={form.account_password} onChange={set('account_password')}
                placeholder="Password for this game account" autoComplete="new-password" />
              <div>
                <label className={label}>NOTES FOR THE BUYER (optional)</label>
                <textarea rows={3} value={form.account_notes} onChange={set('account_notes')} className={input}
                  placeholder="Recovery email access, 2FA steps, anything the buyer needs..." />
              </div>
            </>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div className="flex gap-4">
                {images[0] ? (
                  <img src={images[0]} alt="" className="w-36 h-28 rounded-lg object-cover border border-slate-800 shrink-0" />
                ) : (
                  <GameArt game={form.game} className="w-36 h-28 rounded-lg shrink-0" />
                )}
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-semibold text-slate-100">{form.game}</h2>
                  <p className="text-sm text-slate-500 mb-2">{form.tier}</p>
                  <p className="font-mono text-xl text-[#D4A94B]">{money(form.price)}</p>
                </div>
              </div>

              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                {[
                  ['Level / Rank', form.level || '-'],
                  ['Platform', form.platform],
                  ['Type', (TYPES.find(([v]) => v === form.account_type) || [])[1]],
                  ['Images', String(images.length)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[11px] font-mono text-slate-600">{k.toUpperCase()}</dt>
                    <dd className="text-slate-300">{v}</dd>
                  </div>
                ))}
              </dl>

              {form.description && <p className="text-sm text-slate-400 whitespace-pre-line">{form.description}</p>}
              {features.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {features.map((f) => (
                    <span key={f} className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">{f}</span>
                  ))}
                </div>
              )}

              <div className="rounded-lg border border-slate-800 bg-[#0D1524]/50 p-4 text-sm text-slate-400">
                <p className="flex items-center gap-2 text-slate-300 mb-1"><Lock size={14} className="text-[#34D399]" /> Delivery details saved</p>
                Login: <span className="font-mono text-slate-300">{form.account_login}</span> &middot; Password hidden
              </div>

              <p className="text-xs text-slate-500">
                After you submit, our team reviews the listing before it goes live. You can follow its status on your dashboard.
              </p>
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex items-center justify-between pt-2">
            {step > 0 ? (
              <button type="button" onClick={() => { setError(''); setStep(step - 1); }}
                className="border border-slate-700 hover:border-slate-500 text-slate-300 font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors">
                Back
              </button>
            ) : <span />}
            {step < STEPS.length - 1 ? (
              <button type="button" onClick={next}
                className="bg-[#D4A94B] hover:bg-[#c49a3f] text-[#0B1120] font-semibold rounded-lg px-6 py-2.5 text-sm transition-colors">
                {step === 1 && images.length === 0 ? 'Skip for now' : 'Continue'}
              </button>
            ) : (
              <button type="button" onClick={submit} disabled={saving}
                className="bg-[#D4A94B] hover:bg-[#c49a3f] disabled:opacity-60 text-[#0B1120] font-semibold rounded-lg px-6 py-2.5 text-sm transition-colors">
                {saving ? 'Submitting...' : 'Submit for review'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}