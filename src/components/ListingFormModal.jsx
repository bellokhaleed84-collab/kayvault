import { useState } from 'react';
import { X, ImagePlus, Trash2, Lock } from 'lucide-react';
import { api } from '../lib/api';
import { resizeToDataUrl } from '../lib/images';
import { PasswordField } from './AuthFields';

const PLATFORMS = ['PC', 'PlayStation', 'Xbox', 'Mobile', 'Other'];
const TYPES = [['standard', 'Standard'], ['modded', 'Modded'], ['smurf', 'Smurf'], ['fresh', 'Fresh'], ['other', 'Other']];

const input =
  'w-full bg-[#0D1524] border border-slate-800 rounded-lg px-3.5 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-[#D4A94B]';
const label = 'block text-xs font-mono text-slate-500 mb-2';

export default function ListingFormModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    game: '', tier: '', level: '', platform: 'PC', account_type: 'standard',
    price: '', description: '', features: '',
    account_login: '', account_password: '', account_notes: '',
  });
  const [images, setImages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

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

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/listings', {
        ...form,
        features: form.features.split(',').map((f) => f.trim()).filter(Boolean),
        images,
      });
      onCreated();
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start sm:items-center justify-center px-4 py-6 z-50 overflow-y-auto">
      <div className="w-full max-w-lg rounded-xl bg-[#131B2E] border border-slate-800 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-lg font-semibold text-slate-100">New listing</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={18} /></button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>GAME</label>
              <input required value={form.game} onChange={set('game')} className={input} placeholder="e.g. Fortnite" />
            </div>
            <div>
              <label className={label}>LEVEL / RANK</label>
              <input value={form.level} onChange={set('level')} className={input} placeholder="e.g. Level 320" />
            </div>
          </div>

          <div>
            <label className={label}>HEADLINE</label>
            <input required value={form.tier} onChange={set('tier')} className={input} placeholder="e.g. Galaxy Skin, 150+ skins" />
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
              <input required type="number" min="1" value={form.price} onChange={set('price')} className={input} placeholder="50000" />
            </div>
          </div>

          <div>
            <label className={label}>DESCRIPTION</label>
            <textarea rows={4} value={form.description} onChange={set('description')} className={input}
              placeholder="What is included? Skins, rank, linked accounts, how it is delivered..." />
          </div>

          <div>
            <label className={label}>FEATURES (comma separated)</label>
            <input value={form.features} onChange={set('features')} className={input} placeholder="High level, Rare skins, No bans, Full access" />
          </div>

          <div>
            <label className={label}>SCREENSHOTS (up to 4)</label>
            <div className="flex flex-wrap gap-3">
              {images.map((src, i) => (
                <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-800">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setImages(images.filter((_, j) => j !== i))}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center">
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
              {images.length < 4 && (
                <label className="w-20 h-20 rounded-lg border border-dashed border-slate-700 hover:border-[#D4A94B] flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-[#D4A94B] cursor-pointer transition-colors">
                  <ImagePlus size={18} />
                  <span className="text-[10px]">Add</span>
                  <input type="file" accept="image/*" multiple onChange={pick} className="hidden" />
                </label>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-2">Never include passwords or login details in screenshots.</p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-[#0D1524]/50 p-4 space-y-4">
            <div className="flex items-start gap-2.5">
              <Lock size={15} className="text-[#34D399] mt-0.5 shrink-0" />
              <p className="text-xs text-slate-500 leading-relaxed">
                <span className="text-slate-300 font-medium">Delivery details.</span> Encrypted on our server.
                Only the buyer sees them, and only after they pay. They never appear on the listing.
              </p>
            </div>
            <div>
              <label className={label}>ACCOUNT LOGIN / EMAIL</label>
              <input required value={form.account_login} onChange={set('account_login')} className={input}
                placeholder="Username or email used to sign in" autoComplete="off" />
            </div>
            <PasswordField label="ACCOUNT PASSWORD" required value={form.account_password}
              onChange={set('account_password')} placeholder="Password for this game account" autoComplete="new-password" />
            <div>
              <label className={label}>NOTES FOR THE BUYER (optional)</label>
              <textarea rows={2} value={form.account_notes} onChange={set('account_notes')} className={input}
                placeholder="Recovery email access, 2FA steps, anything the buyer needs..." />
            </div>
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button type="submit" disabled={saving}
            className="w-full bg-[#D4A94B] hover:bg-[#c49a3f] disabled:opacity-60 text-[#0B1120] font-semibold rounded-lg py-3 text-sm transition-colors">
            {saving ? 'Submitting...' : 'Submit for review'}
          </button>
        </form>
      </div>
    </div>
  );
}