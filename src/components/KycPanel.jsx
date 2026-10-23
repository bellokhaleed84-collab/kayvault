import { useEffect, useState } from 'react';
import { BadgeCheck, Clock, XCircle, Upload, Check } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/AuthContext';

const ID_TYPES = [
  ['nin', 'National ID (NIN slip or card)'],
  ['drivers_licence', "Driver's licence"],
  ['passport', 'International passport'],
];

const card = 'rounded-xl bg-[#131B2E] border border-slate-800 p-6 space-y-5';
const label = 'block text-xs font-mono text-slate-500 mb-2';

// Shrinks a photo to a JPEG data URL under the server limit
export function fileToJpeg(file, maxDim = 1400) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file is not a readable image.')); };
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      let q = 0.85;
      let out = c.toDataURL('image/jpeg', q);
      while (out.length > 700000 && q > 0.4) { q -= 0.1; out = c.toDataURL('image/jpeg', q); }
      if (out.length > 780000) return reject(new Error('That photo is too large. Try a smaller one.'));
      resolve(out);
    };
    img.src = url;
  });
}

function FilePick({ title, hint, file, onPick }) {
  return (
    <div>
      <label className={label}>{title}</label>
      <label className="flex items-center gap-3 cursor-pointer rounded-lg border border-dashed border-slate-700 hover:border-[#D4A94B] bg-[#0D1524] px-4 py-3.5 transition-colors">
        {file ? <Check size={16} className="text-[#34D399] shrink-0" /> : <Upload size={16} className="text-slate-500 shrink-0" />}
        <span className="text-sm text-slate-300 truncate">{file ? file.name : hint}</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
          onChange={(e) => onPick(e.target.files?.[0] || null)} />
      </label>
    </div>
  );
}

export default function KycPanel() {
  const { refreshProfile } = useAuth();
  const [info, setInfo] = useState(null);
  const [idType, setIdType] = useState('nin');
  const [idFile, setIdFile] = useState(null);
  const [selfie, setSelfie] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () => api.get('/kyc/mine').then(setInfo).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!idFile || !selfie) return setError('Add both the ID photo and the selfie.');
    setBusy(true);
    try {
      const [id_image, selfieData] = await Promise.all([fileToJpeg(idFile), fileToJpeg(selfie)]);
      await api.post('/kyc', { id_type: idType, id_image, selfie: selfieData });
      setIdFile(null);
      setSelfie(null);
      await load();
      refreshProfile().catch(() => {});
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  if (!info) return <p className="text-slate-500 text-sm">{error || 'Loading...'}</p>;

  if (info.status === 'verified') {
    return (
      <div className={card}>
        <div className="flex gap-3">
          <BadgeCheck size={20} className="text-[#34D399] shrink-0 mt-0.5" />
          <div>
            <p className="text-slate-100 font-medium">You are a verified seller</p>
            <p className="text-sm text-slate-500 mt-1">A Verified badge shows on your seller card so buyers can trust your listings.</p>
          </div>
        </div>
      </div>
    );
  }

  if (info.status === 'pending') {
    return (
      <div className={card}>
        <div className="flex gap-3">
          <Clock size={20} className="text-[#D4A94B] shrink-0 mt-0.5" />
          <div>
            <p className="text-slate-100 font-medium">Verification under review</p>
            <p className="text-sm text-slate-500 mt-1">Our team is checking your documents. You will get a notification when it is done.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={card}>
      {info.status === 'rejected' && (
        <div className="flex gap-3 rounded-lg border border-[#F87171]/30 bg-[#F87171]/10 p-4">
          <XCircle size={18} className="text-[#F87171] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-slate-100 font-medium">Your last submission was not approved</p>
            <p className="text-sm text-slate-400 mt-1">{info.reject_reason || 'Please check your photos and try again.'}</p>
          </div>
        </div>
      )}

      <div>
        <p className="text-slate-100 font-medium">Verify your identity to sell on KayVault</p>
        <p className="text-sm text-slate-500 mt-1">
          Upload a government ID and a selfie. We only use them to confirm who you are. We never ask for your NIN or BVN number.
        </p>
      </div>

      <div>
        <label className={label}>ID TYPE</label>
        <select value={idType} onChange={(e) => setIdType(e.target.value)}
          className="w-full bg-[#0D1524] border border-slate-800 rounded-lg px-3.5 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-[#D4A94B] transition-colors">
          {ID_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <FilePick title="PHOTO OF YOUR ID" hint="Choose a clear photo of the front of your ID" file={idFile} onPick={setIdFile} />
      <FilePick title="SELFIE" hint="Choose a selfie of your face, in good light" file={selfie} onPick={setSelfie} />

      {error && <p className="text-sm text-red-400">{error}</p>}
      <button type="submit" disabled={busy}
        className="bg-[#D4A94B] hover:bg-[#c49a3f] disabled:opacity-60 text-[#0B1120] font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors">
        {busy ? 'Submitting...' : 'Submit for review'}
      </button>
    </form>
  );
}