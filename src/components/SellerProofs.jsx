// KV-SELLERPROOFS v1
import { useEffect, useRef, useState } from 'react';
import { Upload, FileImage, FileVideo, Loader2 } from 'lucide-react';
import { api, uploadFile } from '../lib/api';

const MAX_FILES = 4;
const MAX_BYTES = 14 * 1024 * 1024;
const sizeText = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');

// Seller: add proof (screenshots or a screen recording) to a refund case. Only KayVault staff can see it.
export default function SellerProofs({ purchaseId }) {
  const [proofs, setProofs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef(null);

  useEffect(() => {
    api.get(`/proofs/seller/${purchaseId}`).then((r) => setProofs(r.proofs)).catch(() => {});
  }, [purchaseId]);

  async function pick(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    setError('');
    setBusy(true);
    let list = proofs;
    for (const f of files) {
      if (list.length >= MAX_FILES) {
        setError(`You can add up to ${MAX_FILES} files.`);
        break;
      }
      if (f.size > MAX_BYTES) {
        setError(`${f.name} is too large. Keep each file under 14 MB.`);
        continue;
      }
      try {
        const r = await uploadFile(`/proofs/seller/${purchaseId}?name=${encodeURIComponent(f.name.slice(0, 100))}`, f);
        list = [...list, r.proof];
        setProofs(list);
      } catch (err) {
        setError(err.message);
      }
    }
    setBusy(false);
  }

  return (
    <div className="mt-3">
      <p className="text-[11px] font-mono text-slate-600 mb-1">YOUR PROOF (OPTIONAL)</p>
      <p className="text-xs text-slate-500 mb-2">
        Show that the account worked, for example a screen recording of you logging in. Only our team sees it, not the buyer. Files cannot be removed after upload, so check them first.
      </p>
      {proofs.length > 0 && (
        <ul className="space-y-2 mb-2">
          {proofs.map((p) => (
            <li key={p.id} className="flex items-center gap-2.5 bg-[#0D1524] border border-slate-800 rounded-lg px-3 py-2">
              {p.mime.startsWith('video/')
                ? <FileVideo size={15} className="text-[#5B8DEF] shrink-0" />
                : <FileImage size={15} className="text-[#34D399] shrink-0" />}
              <span className="flex-1 min-w-0 text-xs text-slate-300 truncate">{p.name}</span>
              <span className="text-[11px] font-mono text-slate-600 shrink-0">{sizeText(p.size)}</span>
            </li>
          ))}
        </ul>
      )}
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
        multiple onChange={pick} className="hidden" />
      <button type="button" onClick={() => input.current?.click()} disabled={busy || proofs.length >= MAX_FILES}
        className="flex items-center gap-2 border border-[#D4A94B]/60 text-[#D4A94B] hover:bg-[#D4A94B]/10 disabled:opacity-50 font-semibold rounded-lg px-4 py-2 text-xs transition-colors">
        {busy ? <><Loader2 size={13} className="animate-spin" /> Uploading...</> : <><Upload size={13} /> {proofs.length === 0 ? 'Add screenshot or recording' : 'Add another file'}</>}
      </button>
      <p className="text-[11px] text-slate-600 mt-1.5">Up to {MAX_FILES} files, 14 MB each. PNG, JPG, MP4, MOV or WebM.</p>
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  );
}
