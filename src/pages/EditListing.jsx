// KV-EDITLISTING v1
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ImagePlus, Trash2, Lock, CheckCircle2 } from 'lucide-react';
import DashHeader from '../components/DashHeader';
import { PasswordField } from '../components/AuthFields';
import { api, assetUrl } from '../lib/api';
import { resizeToDataUrl } from '../lib/images';

const PLATFORMS = ['PC', 'PlayStation', 'Xbox', 'Mobile', 'Other'];
const TYPES = [['standard', 'Standard'], ['modded', 'Modded'], ['smurf', 'Smurf'], ['fresh', 'Fresh'], ['other', 'Other']];
const input =
  'w-full bg-[#0D1524] border border-slate-800 rounded-lg px-3.5 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-[#D4A94B] transition-colors';
const label = 'block text-xs font-mono text-slate-500 mb-2';

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-200">
      <DashHeader />
      {children}
    </div>
  );
}

export default function EditListing() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [keep, setKeep] = useState([]);
  const [added, setAdded] = useState([]);
  const [ver, setVer] = useState(0);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState('');

  useEffect(() => {
    api.get(`/listings/mine/${id}`)
      .then((l) => {
        setData(l);
        setForm({
          game: l.game || '', tier: l.tier || '', level: l.level || '',
          platform: l.platform || 'PC', account_type: l.account_type || 'standard',
          price: String(l.price || ''), description: l.description || '',
          features: (l.features || []).join(', '),
          account_login: '', account_password: '', account_notes: '',
        });
        setKeep((l.image_urls || []).map((_, i) => i));
      })
      .catch((e) => setLoadError(e.message));
  }, [id]);

  if (loadError) {
    return (
      <Shell>
        <div className="max-w-3xl mx-auto px-6 py-24 text-center">
          <p className="text-slate-400 mb-4">{loadError}</p>
          <Link to="/dashboard/seller" className="text-[#D4A94B] hover:underline">Back to dashboard</Link>
        </div>
      </Shell>
    );
  }
  if (!data || !form) {
    return (
      <Shell>
        <p className="max-w-3xl mx-auto px-6 py-24 text-slate-500 text-sm">Loading...</p>
      </Shell>
    );
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const urls = data.image_urls || [];
  const total = keep.length + added.length;
  const blocked = data.status === 'sold' || data.locked;
  const src = (u) => assetUrl(u) + (ver ? '?v=' + ver : '');

  async function pick(e) {
    setError('');
    try {
      const files = [...e.target.files].slice(0, 4 - total);
      const out = await Promise.all(files.map((f) => resizeToDataUrl(f)));
      setAdded([...added, ...out]);
    } catch (err) {
      setError(err.message);
    }
    e.target.value = '';
  }

  async function submit() {
    setError('');
    setDone('');
    if (!form.game.trim()) return setError('Enter the game name.');
    if (!form.tier.trim()) return setError('Add a headline buyers will see.');
    if (!(Number(form.price) > 0)) return setError('Enter a price in naira.');
    const hasLogin = form.account_login.trim().length > 0;
    const hasPw = form.account_password.length > 0;
    if (hasLogin !== hasPw) return setError('Enter both the login and the password, or leave both empty to keep the saved ones.');
    setSaving(true);
    try {
      const res = await api.patch(`/listings/${id}`, {
        game: form.game, tier: form.tier, level: form.level, platform: form.platform,
        account_type: form.account_type, price: form.price, description: form.description,
        features: form.features.split(',').map((f) => f.trim()).filter(Boolean),
        keep_images: keep, new_images: added,
        account_login: form.account_login, account_password: form.account_password, account_notes: form.account_notes,
      });
      const l = res.listing;
      setData((d) => ({ ...d, status: l.status, image_urls: l.image_urls || [], has_credentials: d.has_credentials || hasLogin }));
      setKeep((l.image_urls || []).map((_, i) => i));
      setAdded([]);
      setVer(Date.now());
      setForm((f) => ({ ...f, account_login: '', account_password: '', account_notes: '' }));
      setDone(res.needs_review ? 'review' : 'saved');
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  }

  return (
    <Shell>
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link to="/dashboard/seller" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 mb-6">
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
        <h1 className="font-display text-3xl font-semibold text-slate-100 mb-2">Edit listing</h1>
        <p className="text-sm text-slate-500 mb-8">
          {data.status === 'live'
            ? 'This listing is live. Changing the price, details or pictures sends it back to our team for review. Changing only the login details does not.'
            : 'This listing is waiting for review. Your changes are saved right away.'}
        </p>

        {data.status === 'sold' && (
          <p className="rounded-lg border border-slate-800 bg-[#131B2E] text-sm text-slate-400 px-4 py-3 mb-6">A sold listing cannot be edited.</p>
        )}
        {data.locked && data.status !== 'sold' && (
          <p className="rounded-lg border border-[#D4A94B]/40 bg-[#D4A94B]/5 text-sm text-[#D4A94B] px-4 py-3 mb-6">
            A buyer is paying for this account right now. You can edit again in a few minutes.
          </p>
        )}
        {done && (
          <div className="flex items-center gap-2.5 rounded-lg border border-[#34D399]/30 bg-[#34D399]/10 text-[#34D399] text-sm px-4 py-3 mb-6">
            <CheckCircle2 size={16} />
            {done === 'review' ? 'Saved. The listing is back in review and goes live again once our team approves it.' : 'Saved.'}
          </div>
        )}

        <div className="rounded-xl bg-[#131B2E] border border-slate-800 p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>GAME</label>
              <input value={form.game} onChange={set('game')} className={input} />
            </div>
            <div>
              <label className={label}>LEVEL / RANK</label>
              <input value={form.level} onChange={set('level')} className={input} />
            </div>
          </div>
          <div>
            <label className={label}>HEADLINE</label>
            <input value={form.tier} onChange={set('tier')} className={input} />
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
              <input type="number" min="1" value={form.price} onChange={set('price')} className={input} />
            </div>
          </div>
          <div>
            <label className={label}>DESCRIPTION</label>
            <textarea rows={5} value={form.description} onChange={set('description')} className={input} />
          </div>
          <div>
            <label className={label}>FEATURES (comma separated)</label>
            <input value={form.features} onChange={set('features')} className={input} />
          </div>

          <div>
            <label className={label}>SCREENSHOTS (up to 4)</label>
            <div className="flex flex-wrap gap-3">
              {keep.map((idx) => (
                <div key={'k' + idx} className="relative w-28 h-24 rounded-lg overflow-hidden border border-slate-800">
                  <img src={src(urls[idx])} alt="" className="w-full h-full object-cover" />
                  <button type="button" aria-label="Remove image" onClick={() => setKeep(keep.filter((x) => x !== idx))}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {added.map((s, i) => (
                <div key={'a' + i} className="relative w-28 h-24 rounded-lg overflow-hidden border border-[#D4A94B]/50">
                  <img src={s} alt="" className="w-full h-full object-cover" />
                  <button type="button" aria-label="Remove image" onClick={() => setAdded(added.filter((_, j) => j !== i))}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {total < 4 && (
                <label className="w-28 h-24 rounded-lg border border-dashed border-slate-700 hover:border-[#D4A94B] flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-[#D4A94B] cursor-pointer transition-colors">
                  <ImagePlus size={20} />
                  <span className="text-xs">Add image</span>
                  <input type="file" accept="image/*" multiple onChange={pick} className="hidden" />
                </label>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-3">The first image is the cover. Never include passwords in screenshots.</p>
          </div>

          <div className="border-t border-slate-800 pt-5 space-y-5">
            <div className="flex items-start gap-2.5 rounded-lg border border-slate-800 bg-[#0D1524]/50 p-4">
              <Lock size={15} className="text-[#34D399] mt-0.5 shrink-0" />
              <p className="text-xs text-slate-500 leading-relaxed">
                {data.has_credentials
                  ? 'Delivery details are saved and encrypted. Leave the three boxes below empty to keep them, or fill all to replace them.'
                  : 'This listing has no delivery details yet, so buyers cannot purchase it. Add the login and password below.'}
              </p>
            </div>
            <div>
              <label className={label}>ACCOUNT LOGIN / EMAIL</label>
              <input value={form.account_login} onChange={set('account_login')} className={input} autoComplete="off"
                placeholder={data.has_credentials ? 'Leave empty to keep the saved login' : 'Username or email used to sign in'} />
            </div>
            <PasswordField label="ACCOUNT PASSWORD" value={form.account_password} onChange={set('account_password')}
              placeholder={data.has_credentials ? 'Leave empty to keep the saved password' : 'Password for this game account'} autoComplete="new-password" />
            <div>
              <label className={label}>NOTES FOR THE BUYER (optional)</label>
              <textarea rows={3} value={form.account_notes} onChange={set('account_notes')} className={input}
                placeholder="Only saved when you also enter a new login and password." />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Link to="/dashboard/seller" className="border border-slate-700 hover:border-slate-500 text-slate-300 font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors">
              Back
            </Link>
            <button type="button" onClick={submit} disabled={saving || blocked}
              className="bg-[#D4A94B] hover:bg-[#c49a3f] disabled:opacity-60 text-[#0B1120] font-semibold rounded-lg px-6 py-2.5 text-sm transition-colors">
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </Shell>
  );
}
