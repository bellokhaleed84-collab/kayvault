import { useEffect, useRef, useState } from 'react';
import { Upload, FileImage, FileVideo, X, Loader2 } from 'lucide-react';
import { api, uploadFile } from '../lib/api';

const MAX_FILES = 4;
const MAX_BYTES = 14 * 1024 * 1024;

const sizeText = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');

// Buyer: attach screenshots or a screen recording to a refund request.
// Files upload as soon as they are picked. onCount tells the page how many are attached.
export default function ProofUploader({ purchaseId, onCount }) {
  const [proofs, setProofs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef(null);

  useEffect(() => {
    api.get(`/proofs/purchase/${purchaseId}`)
      .then((r) => { setProofs(r.proofs); onCount(r.proofs.length); })
      .catch(() => {});
  }, [purchaseId]); // eslint-disable-line react-hooks/exhaustive-deps

  function update(list) {
    setProofs(list);
    onCount(list.length);
  }

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
        setError(`${f.name} is too large. Keep each file under 14 MB: trim the recording or use a screenshot.`);
        continue;
      }
      try {
        const r = await uploadFile(`/proofs/purchase/${purchaseId}?name=${encodeURIComponent(f.name.slice(0, 100))}`, f);
        list = [...list, r.proof];
        update(list);
      } catch (err) {
        setError(err.message);
      }
    }
    setBusy(false);
  }

  async function remove(p) {
    setError('');
    try {
      await api.del(`/proofs/file/${p.id}`);
      update(proofs.filter((x) => x.id !== p.id));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <label className="block text-[11px] font-mono text-slate-500 mb-1.5">PROOF (REQUIRED)</label>
      <p className="text-xs text-slate-500 mb-3">
        Upload a screen recording that shows the problem from the login screen, or screenshots of the error. Our team reviews it before deciding.
      </p>

      {proofs.length > 0 && (
        <ul className="space-y-2 mb-3">
          {proofs.map((p) => (
            <li key={p.id} className="flex items-center gap-2.5 bg-[#0D1524] border border-slate-800 rounded-lg px-3 py-2">
              {p.mime.startsWith('video/')
                ? <FileVideo size={15} className="text-[#5B8DEF] shrink-0" />
                : <FileImage size={15} className="text-[#34D399] shrink-0" />}
              <span className="flex-1 min-w-0 text-xs text-slate-300 truncate">{p.name}</span>
              <span className="text-[11px] font-mono text-slate-600 shrink-0">{sizeText(p.size)}</span>
              <button type="button" onClick={() => remove(p)} disabled={busy} aria-label={`Remove ${p.name}`}
                className="text-slate-500 hover:text-[#F87171] disabled:opacity-50">
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
        multiple onChange={pick} className="hidden" />
      <button type="button" onClick={() => input.current?.click()} disabled={busy || proofs.length >= MAX_FILES}
        className="w-full flex items-center justify-center gap-2 border border-[#D4A94B]/60 text-[#D4A94B] hover:bg-[#D4A94B]/10 disabled:opacity-50 font-semibold rounded-lg py-2.5 text-sm transition-colors">
        {busy ? <><Loader2 size={15} className="animate-spin" /> Uploading...</> : <><Upload size={15} /> {proofs.length === 0 ? 'Add screenshot or recording' : 'Add another file'}</>}
      </button>
      <p className="text-[11px] text-slate-600 mt-2">Up to {MAX_FILES} files, 14 MB each. PNG, JPG, MP4, MOV or WebM.</p>
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  );
}