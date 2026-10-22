import { useEffect, useState } from 'react';
import { BadgeCheck, CheckCircle2, XCircle, Eye } from 'lucide-react';
import { api } from '../lib/api';

const ID_LABEL = { nin: 'National ID', drivers_licence: "Driver's licence", passport: 'Passport' };

export default function AdminKyc() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imgs, setImgs] = useState({});
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');

  async function load() {
    try {
      setRows(await api.get('/kyc/pending'));
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function view(id) {
    setError('');
    try {
      const r = await api.get(`/kyc/${id}/images`);
      setImgs((m) => ({ ...m, [id]: r }));
    } catch (e) {
      setError(e.message);
    }
  }

  async function decide(id, action) {
    setError('');
    try {
      await api.post(`/kyc/${id}/${action}`, action === 'reject' ? { reason } : {});
      setRejecting(null);
      setReason('');
    } catch (e) {
      setError(e.message);
    }
    load();
  }

  return (
    <section>
      <h2 className="font-display text-2xl font-semibold text-slate-100 mb-1 flex items-center gap-2">
        <BadgeCheck size={22} className="text-[#34D399]" /> Seller verification
      </h2>
      <p className="text-slate-500 text-sm mb-8">Check the ID photo and selfie, then approve or reject with a reason.</p>
      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {loading ? (
        <p className="text-slate-500 text-sm">Loading...</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl bg-[#131B2E] border border-slate-800 p-10 text-center">
          <p className="text-slate-500 text-sm">No verifications waiting.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => (
            <div key={r.id} className="rounded-xl bg-[#131B2E] border border-slate-800 p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="font-display text-slate-100 font-semibold">{r.full_name}</h3>
                  <p className="text-sm text-slate-500">{r.email} &middot; {r.country}</p>
                  <p className="text-xs text-slate-600 mt-1">{ID_LABEL[r.id_type] || r.id_type}</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {!imgs[r.id] && (
                    <button onClick={() => view(r.id)}
                      className="flex items-center gap-1.5 border border-[#D4A94B]/60 text-[#D4A94B] hover:bg-[#D4A94B]/10 rounded-lg px-3.5 py-2 text-xs transition-colors">
                      <Eye size={14} /> View documents
                    </button>
                  )}
                  <button onClick={() => decide(r.id, 'approve')}
                    className="flex items-center gap-1.5 bg-[#34D399] hover:bg-[#2bb989] text-[#0B1120] font-semibold rounded-lg px-3.5 py-2 text-xs transition-colors">
                    <CheckCircle2 size={14} /> Approve
                  </button>
                  <button onClick={() => { setRejecting(rejecting === r.id ? null : r.id); setReason(''); }}
                    className="flex items-center gap-1.5 border border-slate-700 hover:border-red-500 hover:text-red-400 text-slate-400 rounded-lg px-3.5 py-2 text-xs transition-colors">
                    <XCircle size={14} /> Reject
                  </button>
                </div>
              </div>

              {imgs[r.id] && (
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[11px] font-mono text-slate-500 mb-1.5">ID PHOTO</p>
                    <img src={imgs[r.id].id_image} alt="ID" className="w-full max-h-80 object-contain rounded-lg border border-slate-800 bg-[#0D1524]" />
                  </div>
                  <div>
                    <p className="text-[11px] font-mono text-slate-500 mb-1.5">SELFIE</p>
                    <img src={imgs[r.id].selfie} alt="Selfie" className="w-full max-h-80 object-contain rounded-lg border border-slate-800 bg-[#0D1524]" />
                  </div>
                </div>
              )}

              {rejecting === r.id && (
                <div className="space-y-3">
                  <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300}
                    placeholder="Reason, e.g. The ID photo is blurry. Please upload a clearer one."
                    className="w-full bg-[#0D1524] border border-slate-800 rounded-lg px-3.5 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-[#D4A94B]" />
                  <button onClick={() => decide(r.id, 'reject')} disabled={reason.trim().length < 5}
                    className="bg-[#F87171] hover:bg-[#ef5b5b] disabled:opacity-60 text-[#0B1120] font-semibold rounded-lg px-4 py-2 text-xs transition-colors">
                    Send rejection
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}