import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { api } from '../lib/api';

function ago(d) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const box = useRef(null);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ items: [], unread: 0 });

  async function load() {
    try {
      setData(await api.get('/notifications'));
    } catch {
      /* stay quiet: the bell is not essential */
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  async function openItem(n) {
    setOpen(false);
    if (!n.read) api.post(`/notifications/${n.id}/read`).then(load).catch(() => {});
    if (n.link) navigate(n.link);
  }

  async function readAll() {
    await api.post('/notifications/read-all').catch(() => {});
    load();
  }

  return (
    <div className="relative" ref={box}>
      <button onClick={() => setOpen(!open)} aria-label="Notifications"
        className="relative p-2 text-slate-400 hover:text-slate-100 transition-colors">
        <Bell size={17} />
        {data.unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 rounded-full bg-[#D4A94B] text-[#0B1120] text-[10px] font-semibold flex items-center justify-center">
            {data.unread > 9 ? '9+' : data.unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl bg-[#131B2E] border border-slate-800 shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <p className="text-sm font-medium text-slate-100">Notifications</p>
            {data.unread > 0 && (
              <button onClick={readAll} className="text-xs text-[#D4A94B] hover:underline">Mark all read</button>
            )}
          </div>
          {data.items.length === 0 ? (
            <p className="text-sm text-slate-500 px-4 py-8 text-center">Nothing yet. Order updates show up here.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {data.items.map((n) => (
                <li key={n.id}>
                  <button onClick={() => openItem(n)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-800 last:border-0 hover:bg-[#0D1524] transition-colors ${n.read ? '' : 'bg-[#D4A94B]/5'}`}>
                    <div className="flex items-start gap-2.5">
                      <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${n.read ? 'bg-transparent' : 'bg-[#D4A94B]'}`} />
                      <div className="min-w-0">
                        <p className="text-sm text-slate-200">{n.title}</p>
                        {n.body && <p className="text-xs text-slate-500 mt-0.5">{n.body}</p>}
                        <p className="text-[11px] text-slate-600 mt-1">{ago(n.created_at)}</p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}