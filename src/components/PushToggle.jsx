// KV-PUSH v1: button to turn phone notifications on or off for this device
import { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { api } from '../lib/api';

const supported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function keyToBytes(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export default function PushToggle() {
  const [state, setState] = useState('checking'); // checking | unsupported | denied | off | on
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let dead = false;
    (async () => {
      if (!supported()) return !dead && setState('unsupported');
      if (Notification.permission === 'denied') return !dead && setState('denied');
      try {
        const reg = await navigator.serviceWorker.getRegistration('/sw.js');
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (!dead) setState(sub && Notification.permission === 'granted' ? 'on' : 'off');
      } catch {
        if (!dead) setState('off');
      }
    })();
    return () => { dead = true; };
  }, []);

  async function turnOn() {
    setBusy(true);
    setError('');
    try {
      const perm = await Notification.requestPermission(); // must be the first step, right after the tap
      if (perm !== 'granted') {
        setState(perm === 'denied' ? 'denied' : 'off');
        setBusy(false);
        return;
      }
      const { key } = await api.get('/notifications/push/key');
      if (!key) throw new Error('Phone notifications are not switched on at KayVault yet. Please try again later.');
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(key) }));
      await api.post('/notifications/push/subscribe', sub.toJSON());
      setState('on');
    } catch (e) {
      setError(e.message || 'Could not turn notifications on.');
    }
    setBusy(false);
  }

  async function turnOff() {
    setBusy(true);
    setError('');
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await api.post('/notifications/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
        await sub.unsubscribe();
      }
      setState('off');
    } catch (e) {
      setError(e.message || 'Could not turn notifications off.');
    }
    setBusy(false);
  }

  return (
    <div className="flex items-center justify-between gap-4 sm:gap-6">
      <div className="min-w-0">
        <p className="text-sm text-slate-200 flex items-center gap-2"><BellRing size={15} className="text-[#8B5CF6]" /> Phone notifications</p>
        <p className="text-xs text-slate-500 mt-1">
          {state === 'unsupported'
            ? 'This browser cannot show phone notifications. On iPhone, tap Share, then "Add to Home Screen", and open KayVault from there.'
            : state === 'denied'
              ? 'Notifications are blocked for this site. Allow them in your browser or phone settings, then come back.'
              : 'Get a buzz on this device when you have a new order, payment or update. Messages are never shown on the lock screen.'}
        </p>
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      </div>
      {(state === 'off' || state === 'on') && (
        <button type="button" onClick={state === 'on' ? turnOff : turnOn} disabled={busy} aria-pressed={state === 'on'} aria-label="Phone notifications"
          className={`w-11 h-6 rounded-full transition-colors relative shrink-0 disabled:opacity-60 ${state === 'on' ? 'bg-[#8B5CF6]' : 'bg-slate-700'}`}>
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${state === 'on' ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      )}
    </div>
  );
}