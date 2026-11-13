// KV-SELLERCONTACT v1: the buyer taps to see the seller's phone number. The server only answers while the order is open.
import { useState } from 'react';
import { Phone, MessageCircle, ShieldAlert } from 'lucide-react';
import { api } from '../lib/api';

export default function SellerContact({ purchaseId }) {
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function show() {
    setBusy(true);
    setError('');
    try {
      setInfo(await api.get('/purchases/' + purchaseId + '/seller-contact'));
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  const phone = info && info.phone ? info.phone : '';
  const digits = phone.replace(/\D/g, '');
  const pretty = phone.replace(/^(\+234)(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3 $4');
  const wa = 'https://wa.me/' + digits + '?text=' +
    encodeURIComponent('Hello, I bought your account on KayVault. Please come online so we can finish the delivery.');

  return (
    <div className="rounded-xl bg-[#131B2E] border border-slate-800 p-6">
      <div className="flex items-center gap-2 mb-2">
        <Phone size={16} className="text-[#D4A94B]" />
        <h2 className="font-display text-slate-100 font-semibold">Seller offline?</h2>
      </div>
      <p className="text-sm text-slate-400 mb-4">
        If the seller is not answering in the chat, you can call them so they come online.
      </p>

      {!info && (
        <button type="button" onClick={show} disabled={busy}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#D4A94B] hover:bg-[#c49a3f] disabled:opacity-60 text-[#0B1120] font-semibold rounded-lg px-6 py-3 text-sm transition-colors">
          <Phone size={15} /> {busy ? 'Loading...' : "Show seller's number"}
        </button>
      )}

      {info && phone && (
        <div className="space-y-3">
          <p className="font-mono text-2xl tracking-wide text-slate-100">{pretty}</p>
          <div className="flex flex-wrap gap-3">
            <a href={'tel:' + phone}
              className="flex items-center justify-center gap-2 bg-[#D4A94B] hover:bg-[#c49a3f] text-[#0B1120] font-semibold rounded-lg px-6 py-3 text-sm transition-colors">
              <Phone size={15} /> Call
            </a>
            <a href={wa} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 border border-[#34D399]/60 text-[#34D399] hover:bg-[#34D399]/10 font-semibold rounded-lg px-6 py-3 text-sm transition-colors">
              <MessageCircle size={15} /> WhatsApp
            </a>
          </div>
        </div>
      )}

      {info && !phone && (
        <p className="text-sm text-slate-500">
          This seller has not added a phone number yet. Send a message in the chat and they will see it in their Orders.
        </p>
      )}

      {error && <p className="text-red-400 text-xs mt-3">{error}</p>}

      <div className="flex items-start gap-2 mt-4 text-[11px] text-slate-600">
        <ShieldAlert size={12} className="mt-0.5 shrink-0" />
        <p>Keep everything inside KayVault. Never pay or confirm anything outside the platform, even if the seller asks you to.</p>
      </div>
    </div>
  );
}