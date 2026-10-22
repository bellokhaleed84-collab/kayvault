// KV-CASECHAT v1
import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, Flag, ChevronDown } from 'lucide-react';
import { api } from '../lib/api';

const stamp = (d) =>
  d ? new Date(d).toLocaleString('en', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';

// Private support thread for one refund case.
// mode="admin": KayVault staff writing to the buyer or the seller (thread says which).
// mode="user": the buyer or seller answering support. Hidden until support has written.
export default function CaseChat({ purchaseId, mode = 'user', thread = 'seller' }) {
  const admin = mode === 'admin';
  const [data, setData] = useState(null);
  const [expanded, setExpanded] = useState(!admin);
  const [text, setText] = useState('');
  const [flag, setFlag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const list = useRef(null);
  const path = '/cases/' + purchaseId + '/messages' + (admin ? '?with=' + thread : '');

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
    if (!expanded) return undefined;
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 8000);
    return () => clearInterval(t);
  }, [expanded, load]);

  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [data, expanded]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    setError('');
    try {
      await api.post('/cases/' + purchaseId + '/messages', admin ? { with: thread, body, flag } : { body });
      setText('');
      setFlag(false);
      await load();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  if (!admin && (!data || !data.has_support)) return null;

  const count = data ? data.messages.length : 0;
  const title = admin ? 'Message the ' + thread : 'Messages from KayVault support';

  return (
    <div className="mt-4 rounded-lg bg-[#0D1524] border border-slate-800">
      <button type="button" onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left">
        <MessageSquare size={14} className="text-[#D4A94B]" />
        <span className="text-sm text-slate-200 font-medium">{title}</span>
        {count > 0 && <span className="text-[11px] font-mono text-slate-500">{count}</span>}
        <ChevronDown size={14} className={'ml-auto text-slate-500 transition-transform ' + (expanded ? 'rotate-180' : '')} />
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          {admin && (
            <p className="text-[11px] text-slate-600 mb-2">
              Private thread. The {thread === 'buyer' ? 'seller' : 'buyer'} cannot see it. The {thread} gets a bell notification and an email.
            </p>
          )}

          <div ref={list} className="max-h-64 overflow-y-auto space-y-2 mb-3">
            {!data ? (
              <p className="text-xs text-slate-500">Loading...</p>
            ) : data.messages.length === 0 ? (
              <p className="text-xs text-slate-500">No messages yet.</p>
            ) : (
              data.messages.map((m) => (
                <div key={m.id} className={'flex ' + (m.mine ? 'justify-end' : 'justify-start')}>
                  <div className={'max-w-[85%] rounded-lg px-3 py-2 border ' + (m.mine ? 'bg-[#D4A94B]/10 border-[#D4A94B]/30' : 'bg-[#131B2E] border-slate-800')}>
                    {m.flag && (
                      <p className="flex items-center gap-1 text-[10px] font-mono text-[#D4A94B] mb-1"><Flag size={10} /> INFORMATION REQUESTED</p>
                    )}
                    <p className="text-sm text-slate-200 whitespace-pre-line break-words">{m.body}</p>
                    <p className="text-[10px] text-slate-600 mt-1">
                      {m.from_admin ? 'KayVault support' : (admin ? 'The ' + thread : 'You')} &middot; {stamp(m.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {data && !data.open ? (
            <p className="text-xs text-slate-500">This case is closed, so new messages cannot be sent.</p>
          ) : (
            <div className="space-y-2">
              <textarea rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)}
                placeholder={admin ? 'Ask for details, e.g. the exact error and a screen recording of the login.' : 'Type your reply to support...'}
                className="w-full bg-[#0B1120] border border-slate-800 rounded-lg px-3.5 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-[#D4A94B]" />
              <div className="flex flex-wrap items-center justify-between gap-2">
                {admin ? (
                  <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                    <input type="checkbox" checked={flag} onChange={(e) => setFlag(e.target.checked)} />
                    Mark as urgent information request
                  </label>
                ) : <span />}
                <button type="button" onClick={send} disabled={busy || text.trim().length < 1}
                  className="flex items-center gap-2 bg-[#D4A94B] hover:bg-[#c49a3f] disabled:opacity-60 text-[#0B1120] font-semibold rounded-lg px-4 py-2 text-xs transition-colors">
                  <Send size={13} /> {busy ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          )}
          {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
        </div>
      )}
    </div>
  );
}
