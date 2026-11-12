// KV-ORDERCHAT v1: chat between the buyer and the seller of one order (login codes, questions)
import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, ShieldAlert } from 'lucide-react';
import { api } from '../lib/api';
import Skel from './Skeleton';

const stamp = (d) =>
  d ? new Date(d).toLocaleString('en', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' }) : '';

// One tap messages, so nobody has to type on a phone
const QUICK = {
  buyer: ['Please send the login code', 'The code did not work. Please send a new one.'],
  seller: ['I am sending the code now', 'Please try again. A new code is on the way.'],
};

export default function OrderChat({ purchaseId, who = 'buyer' }) {
  const [data, setData] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const list = useRef(null);
  const path = '/order-chat/' + purchaseId + '/messages';

  const load = useCallback(async () => {
    try {
      setData(await api.get(path));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [path]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 8000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [data]);

  async function send(body) {
    const msg = (body || '').trim();
    if (!msg || busy) return;
    setBusy(true);
    setError('');
    try {
      await api.post(path, { body: msg });
      setText('');
      await load();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  const other = who === 'buyer' ? 'seller' : 'buyer';

  return (
    <div className="rounded-xl bg-[#131B2E] border border-slate-800 p-5">
      <div className="flex items-center gap-2 mb-2">
        <MessageSquare size={16} className="text-[#D4A94B]" />
        <h2 className="font-display text-slate-100 font-semibold">Chat with the {other}</h2>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        {who === 'buyer'
          ? 'Need a login code that was sent to the account email or phone? Ask the seller here.'
          : 'The buyer may ask you for a login code. Send it here.'}
      </p>

      <div ref={list} className="max-h-72 overflow-y-auto space-y-2 mb-4">
        {!data ? (
          <>
            <Skel className="h-12 w-2/3" />
            <Skel className="h-12 w-1/2 ml-auto" />
            <Skel className="h-12 w-3/5" />
          </>
        ) : data.messages.length === 0 ? (
          <p className="text-xs text-slate-500">No messages yet.</p>
        ) : (
          data.messages.map((m) => (
            <div key={m.id} className={'flex ' + (m.mine ? 'justify-end' : 'justify-start')}>
              <div className={'max-w-[85%] rounded-lg px-3 py-2 border ' + (m.mine ? 'bg-[#D4A94B]/10 border-[#D4A94B]/30' : 'bg-[#0D1524] border-slate-800')}>
                <p className="text-sm text-slate-200 whitespace-pre-line break-words">{m.body}</p>
                <p className="text-[10px] text-slate-600 mt-1">{m.mine ? 'You' : 'The ' + other} &middot; {stamp(m.created_at)}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {data && data.open && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {QUICK[who].map((q) => (
              <button key={q} type="button" onClick={() => send(q)} disabled={busy}
                className="rounded-full border border-slate-700 hover:border-[#D4A94B] text-slate-300 hover:text-[#D4A94B] disabled:opacity-50 px-4 py-2.5 text-xs text-left transition-colors">
                {q}
              </button>
            ))}
          </div>
          <textarea rows={2} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Type a message..."
            className="w-full bg-[#0D1524] border border-slate-800 rounded-lg px-3.5 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-[#D4A94B]" />
          <button type="button" onClick={() => send(text)} disabled={busy || text.trim().length < 1}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#D4A94B] hover:bg-[#c49a3f] disabled:opacity-60 text-[#0B1120] font-semibold rounded-lg px-6 py-3 text-sm transition-colors">
            <Send size={14} /> {busy ? 'Sending...' : 'Send'}
          </button>
        </div>
      )}
      {data && !data.open && <p className="text-xs text-slate-500">This chat is closed, so new messages cannot be sent.</p>}
      {error && <p className="text-red-400 text-xs mt-3">{error}</p>}

      <div className="flex items-start gap-2 mt-4 text-[11px] text-slate-600">
        <ShieldAlert size={12} className="mt-0.5 shrink-0" />
        <p>Keep everything inside KayVault. Never pay or confirm anything outside the platform. KayVault staff can read this chat if there is a dispute.</p>
      </div>
    </div>
  );
}