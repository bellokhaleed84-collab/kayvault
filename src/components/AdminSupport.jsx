// KV-SUPPORT v1: admin side. See open chats, reply, close when the problem is fixed.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Send, Lock } from 'lucide-react';
import { api } from '../lib/api';
import Skel from './Skeleton';

const card = 'rounded-xl bg-[#131B2E] border border-slate-800';
const stamp = (d) =>
  d ? new Date(d).toLocaleString('en', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' }) : '';

function Thread({ id, onBack }) {
  const [t, setT] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const list = useRef(null);

  const load = useCallback(async () => {
    try {
      setT(await api.get('/support/admin/' + id));
    } catch (e) {
      setError(e.message);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const i = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 8000);
    return () => clearInterval(i);
  }, [load]);
  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [t]);

  async function send() {
    const msg = text.trim();
    if (!msg || busy) return;
    setBusy(true);
    setError('');
    try {
      await api.post('/support/admin/' + id + '/messages', { body: msg });
      setText('');
      await load();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  async function close() {
    if (!window.confirm('Close this chat? The user will not be able to send more messages.')) return;
    setBusy(true);
    setError('');
    try {
      await api.post('/support/admin/' + id + '/close');
      await load();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  return (
    <div className={`${card} p-4 sm:p-5`}>
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-100 mb-4 py-1">
        <ArrowLeft size={14} /> Back to chats
      </button>

      {!t ? (
        <div className="space-y-2">
          <Skel className="h-6 w-1/2" />
          <Skel className="h-12 w-2/3" />
          <Skel className="h-12 w-1/2 ml-auto" />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <p className="text-slate-100 font-medium break-words">{t.user_name}</p>
              <p className="text-xs text-slate-500 break-all">{t.user_email} &middot; <span className="capitalize">{t.user_role}</span></p>
            </div>
            {t.status === 'open' ? (
              <button type="button" onClick={close} disabled={busy}
                className="flex items-center gap-1.5 bg-[#34D399] hover:bg-[#2bb989] disabled:opacity-60 text-[#0B1120] font-semibold rounded-lg px-4 py-2.5 text-xs transition-colors">
                <Lock size={13} /> Close chat
              </button>
            ) : (
              <span className="text-xs text-slate-500">Closed {stamp(t.closed_at)}</span>
            )}
          </div>

          <div ref={list} className="max-h-96 overflow-y-auto space-y-2 mb-4">
            {t.messages.map((m) => {
              const mine = m.from === 'admin';
              return (
                <div key={m.id} className={'flex ' + (mine ? 'justify-end' : 'justify-start')}>
                  <div className={'max-w-[85%] rounded-lg px-3 py-2 border ' + (mine ? 'bg-[#8B5CF6]/10 border-[#8B5CF6]/30' : 'bg-[#0D1524] border-slate-800')}>
                    <p className="text-sm text-slate-200 whitespace-pre-line break-words">{m.body}</p>
                    <p className="text-[10px] text-slate-600 mt-1">{mine ? 'You (admin)' : t.user_name} &middot; {stamp(m.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {t.status === 'open' ? (
            <div className="space-y-3">
              <textarea rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a reply..."
                className="w-full bg-[#0D1524] border border-slate-800 rounded-lg px-3.5 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-[#8B5CF6]" />
              <button type="button" onClick={send} disabled={busy || text.trim().length < 1}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-60 text-white font-semibold rounded-lg px-6 py-3 text-sm transition-colors">
                <Send size={14} /> {busy ? 'Sending...' : 'Send reply'}
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-500">This chat is closed and locked.</p>
          )}
        </>
      )}
      {error && <p className="text-red-400 text-xs mt-3">{error}</p>}
    </div>
  );
}

export default function AdminSupport() {
  const [status, setStatus] = useState('open');
  const [rows, setRows] = useState(null);
  const [sel, setSel] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setRows(await api.get('/support/admin/list?status=' + status));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [status]);

  useEffect(() => { setRows(null); load(); }, [load]);
  useEffect(() => {
    if (sel) return undefined;
    const i = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 8000);
    return () => clearInterval(i);
  }, [load, sel]);

  if (sel) return <Thread id={sel} onBack={() => { setSel(null); load(); }} />;

  const tab = (v, l) => (
    <button key={v} type="button" onClick={() => setStatus(v)}
      className={`rounded-lg px-4 py-2.5 text-sm transition-colors ${status === v ? 'bg-[#8B5CF6]/15 text-[#8B5CF6]' : 'text-slate-400 hover:text-slate-100'}`}>
      {l}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-1">{tab('open', 'Open')}{tab('closed', 'Closed')}</div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {!rows ? (
        <div className="space-y-3">
          <Skel className="h-16 w-full" />
          <Skel className="h-16 w-full" />
          <Skel className="h-16 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <div className={`${card} p-8 sm:p-10 text-center`}>
          <p className="text-slate-500 text-sm">{status === 'open' ? 'No open chats. You are all caught up.' : 'No closed chats.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <button key={r.id} type="button" onClick={() => setSel(r.id)}
              className={`${card} w-full text-left p-4 flex items-start justify-between gap-3 hover:border-[#8B5CF6]/50 transition-colors`}>
              <div className="min-w-0">
                <p className="text-slate-100 text-sm font-medium break-words">
                  {r.user_name} <span className="text-xs text-slate-500 capitalize">&middot; {r.user_role}</span>
                </p>
                <p className="text-xs text-slate-500 mt-1 break-words">{r.preview}</p>
              </div>
              <div className="text-right shrink-0">
                {r.unread > 0 && (
                  <span className="inline-flex min-w-5 h-5 px-1.5 rounded-full bg-[#8B5CF6] text-white text-[11px] font-semibold items-center justify-center mb-1">{r.unread}</span>
                )}
                <p className="text-[10px] text-slate-600">{stamp(r.last_message_at)}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}