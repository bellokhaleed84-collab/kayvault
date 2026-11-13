// KV-SUPPORT v1: the user's chat with the admin
import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { api } from '../lib/api';
import Skel from './Skeleton';

const stamp = (d) =>
  d ? new Date(d).toLocaleString('en', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' }) : '';

export default function SupportChat() {
  const [data, setData] = useState(null); // { ticket }
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const list = useRef(null);

  const load = useCallback(async () => {
    try {
      setData(await api.get('/support/mine'));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 8000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [data]);

  const ticket = data ? data.ticket : null;
  const open = ticket && ticket.status === 'open';

  async function send() {
    const msg = text.trim();
    if (!msg || busy) return;
    setBusy(true);
    setError('');
    try {
      if (open) await api.post('/support/' + ticket.id + '/messages', { body: msg });
      else await api.post('/support', { body: msg });
      setText('');
      await load();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  return (
    <div className="rounded-xl bg-[#131B2E] border border-slate-800 p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-2">
        <MessageSquare size={16} className="text-[#8B5CF6]" />
        <h2 className="font-display text-slate-100 font-semibold">Contact us</h2>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Have a problem? Message the KayVault team here. We reply in this chat and close it when the problem is fixed.
      </p>

      {!data ? (
        <div className="space-y-2 mb-4">
          <Skel className="h-12 w-2/3" />
          <Skel className="h-12 w-1/2 ml-auto" />
          <Skel className="h-12 w-3/5" />
        </div>
      ) : (
        <>
          {ticket && (
            <div ref={list} className="max-h-80 overflow-y-auto space-y-2 mb-4">
              {ticket.messages.map((m) => {
                const mine = m.from === 'user';
                return (
                  <div key={m.id} className={'flex ' + (mine ? 'justify-end' : 'justify-start')}>
                    <div className={'max-w-[85%] rounded-lg px-3 py-2 border ' + (mine ? 'bg-[#8B5CF6]/10 border-[#8B5CF6]/30' : 'bg-[#0D1524] border-slate-800')}>
                      <p className="text-sm text-slate-200 whitespace-pre-line break-words">{m.body}</p>
                      <p className="text-[10px] text-slate-600 mt-1">{mine ? 'You' : 'KayVault team'} &middot; {stamp(m.created_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {ticket && !open && (
            <p className="text-xs text-slate-500 mb-4">
              This chat was closed{ticket.closed_at ? ' on ' + stamp(ticket.closed_at) : ''}, so new messages cannot be sent here. If you still need help, start a new chat below.
            </p>
          )}

          <div className="space-y-3">
            <textarea rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)}
              placeholder={open ? 'Type a message...' : 'Tell us what the problem is...'}
              className="w-full bg-[#0D1524] border border-slate-800 rounded-lg px-3.5 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-[#8B5CF6]" />
            <button type="button" onClick={send} disabled={busy || text.trim().length < 1}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-60 text-white font-semibold rounded-lg px-6 py-3 text-sm transition-colors">
              <Send size={14} /> {busy ? 'Sending...' : open ? 'Send' : 'Start new chat'}
            </button>
          </div>
        </>
      )}
      {error && <p className="text-red-400 text-xs mt-3">{error}</p>}
      <p className="text-[11px] text-slate-600 mt-4">
        Never send your password or card details in this chat. KayVault will never ask for them.
      </p>
    </div>
  );
}