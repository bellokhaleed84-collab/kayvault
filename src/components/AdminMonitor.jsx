// KV-MONITOR v1: is everything working, how much space is left, how much money is where
import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Database, HardDrive, Activity, Wallet, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';
import { money } from '../lib/orders';

const card = 'rounded-xl bg-[#131B2E] border border-slate-800';
const DOT = { up: '#34D399', down: '#F87171', off: '#64748B' };
const WORD = { up: 'Working', down: 'Not working', off: 'Not set up' };

const fmtMB = (n) => (Number(n || 0) >= 1024 ? (Number(n) / 1024).toFixed(2) + ' GB' : Number(n || 0).toFixed(1) + ' MB');
const fmtUp = (s) => {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d ? d + 'd ' + h + 'h' : h ? h + 'h ' + m + 'm' : m + 'm';
};
const clock = (iso) => (iso ? new Date(iso).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' }) : '');

function Title({ icon: Icon, children, sub }) {
  return (
    <div className="mb-3">
      <h2 className="font-display text-lg font-semibold text-slate-100 flex items-center gap-2">
        <Icon size={18} className="text-[#8B5CF6]" /> {children}
      </h2>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function Bar({ pct }) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  const color = p >= 90 ? '#F87171' : p >= 70 ? '#F59E0B' : '#34D399';
  return (
    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
      <div className="h-full" style={{ width: p + '%', background: color }} />
    </div>
  );
}

function Stat({ label, value, sub, color }) {
  return (
    <div className={card + ' p-4 sm:p-5 min-w-0'}>
      <p className="text-slate-500 text-xs font-mono mb-1">{label.toUpperCase()}</p>
      <p className="font-display text-xl sm:text-2xl font-semibold break-words" style={{ color: color || '#F1F5F9' }}>{value}</p>
      {sub && <p className="text-xs text-slate-600 mt-1">{sub}</p>}
    </div>
  );
}

export default function AdminMonitor() {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setD(await api.get('/admin/monitor'));
      setError('');
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 60000);
    return () => clearInterval(t);
  }, [load]);

  if (!d) return error ? <p className="text-red-400 text-sm">{error}</p> : <p className="text-slate-500 text-sm">Checking everything...</p>;

  const s = d.server;
  const m = d.money;
  const db = d.storage.db;
  const cl = d.storage.cloud;
  const eyadService = d.services.find((x) => x.key === 'eyad');
  const psService = d.services.find((x) => x.key === 'paystack');
  const down = d.services.filter((x) => x.status === 'down').length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={'text-sm ' + (down ? 'text-[#F87171]' : 'text-[#34D399]')}>
          {down ? down + (down === 1 ? ' service is' : ' services are') + ' not working' : 'Everything that is set up is working'}
        </p>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">Checked at {clock(d.at)}</span>
          <button onClick={load} disabled={busy}
            className="flex items-center gap-1.5 border border-slate-700 hover:border-slate-500 disabled:opacity-60 text-slate-300 rounded-lg px-3.5 py-2.5 sm:py-2 text-xs transition-colors">
            <RefreshCw size={13} className={busy ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}

      <section>
        <Title icon={Activity} sub="Each one is checked live when you open this tab.">Is everything working?</Title>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {d.services.map((x) => (
            <div key={x.key} className={card + ' p-4 sm:p-5 min-w-0'}>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: DOT[x.status] }} />
                <p className="text-sm text-slate-100 font-medium">{x.name}</p>
              </div>
              <p className="text-xs" style={{ color: DOT[x.status] }}>
                {WORD[x.status]}{x.ms != null ? ' · ' + x.ms + ' ms' : ''}
              </p>
              {x.detail && <p className="text-xs text-slate-500 mt-1 break-words">{x.detail}</p>}
            </div>
          ))}
        </div>
      </section>

      <section>
        <Title icon={Activity} sub="Counted since the server last started. This resets when the server restarts or wakes up.">Server</Title>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Stat label="Running for" value={fmtUp(s.uptime_s)} sub={'Node ' + s.node} />
          <Stat label="Memory" value={s.memory_mb + ' MB'} sub="used by the server" />
          <Stat label="Requests" value={Number(s.requests).toLocaleString()} sub={'average ' + s.avg_ms + ' ms'} />
          <Stat label="Errors" value={s.errors} sub={s.slow_count + ' slow (over 2 seconds)'} color={s.errors > 0 ? '#F87171' : undefined} />
        </div>

        {(s.last_errors.length > 0 || s.slow.length > 0) && (
          <div className="grid lg:grid-cols-2 gap-4 mt-4">
            <div className={card + ' p-4 sm:p-5 min-w-0'}>
              <p className="text-[11px] font-mono text-slate-500 mb-2">LATEST ERRORS</p>
              {s.last_errors.length === 0 ? <p className="text-xs text-slate-500">None.</p> : (
                <ul className="space-y-2">
                  {s.last_errors.map((e, i) => (
                    <li key={i} className="text-xs text-slate-400 break-words">
                      <span className="text-[#F87171]">{e.method} {e.path}</span> · {e.message} · {clock(e.at)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className={card + ' p-4 sm:p-5 min-w-0'}>
              <p className="text-[11px] font-mono text-slate-500 mb-2">SLOWEST PAGES</p>
              {s.slow.length === 0 ? <p className="text-xs text-slate-500">None.</p> : (
                <ul className="space-y-2">
                  {s.slow.map((e, i) => (
                    <li key={i} className="text-xs text-slate-400 break-words">
                      <span className="text-[#F59E0B]">{e.method} {e.path}</span> · {(e.ms / 1000).toFixed(1)} s · {clock(e.at)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      <section>
        <Title icon={HardDrive} sub="Running out of space is the thing that breaks a site without warning.">Storage</Title>
        <div className="grid lg:grid-cols-2 gap-4">
          <div className={card + ' p-4 sm:p-5 min-w-0'}>
            <div className="flex items-center gap-2 mb-3">
              <Database size={16} className="text-[#8B5CF6]" />
              <p className="text-sm text-slate-100 font-medium">Database</p>
            </div>
            {db ? (
              <>
                <p className="font-display text-xl sm:text-2xl font-semibold text-slate-100">
                  {fmtMB(db.used_mb)} <span className="text-sm text-slate-500 font-normal">of {fmtMB(db.limit_mb)}</span>
                </p>
                <div className="my-3"><Bar pct={(db.used_mb / db.limit_mb) * 100} /></div>
                <p className="text-xs text-slate-500">
                  {Math.round((db.used_mb / db.limit_mb) * 100)}% used · {db.collections} collections · {Number(db.objects).toLocaleString()} records
                </p>
                <p className="text-[11px] text-slate-600 mt-1">Assumes the free 512 MB plan. If you pay for more, set MONGO_LIMIT_MB on Render.</p>
                {db.top.length > 0 && (
                  <ul className="mt-4 space-y-1.5">
                    {db.top.map((c) => (
                      <li key={c.name} className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-slate-300 truncate">{c.name}</span>
                        <span className="font-mono text-slate-500 whitespace-nowrap">{fmtMB(c.mb)} · {Number(c.count).toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-500">{d.storage.db_error || 'Not available right now.'}</p>
            )}
          </div>

          <div className={card + ' p-4 sm:p-5 min-w-0'}>
            <div className="flex items-center gap-2 mb-3">
              <HardDrive size={16} className="text-[#8B5CF6]" />
              <p className="text-sm text-slate-100 font-medium">Image and file storage (Cloudinary)</p>
            </div>
            {cl ? (
              <>
                {cl.credits_percent != null ? (
                  <>
                    <p className="font-display text-xl sm:text-2xl font-semibold text-slate-100">
                      {Math.round(cl.credits_percent)}% <span className="text-sm text-slate-500 font-normal">of this month's allowance used</span>
                    </p>
                    <div className="my-3"><Bar pct={cl.credits_percent} /></div>
                    {cl.credits_used != null && cl.credits_limit != null && (
                      <p className="text-xs text-slate-500">{cl.credits_used} of {cl.credits_limit} credits</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-slate-500">Cloudinary did not report an allowance.</p>
                )}
                {cl.storage_mb != null && <p className="text-xs text-slate-500 mt-2">Files stored: {fmtMB(cl.storage_mb)}</p>}
                {cl.plan && <p className="text-xs text-slate-600 mt-1">Plan: {cl.plan}</p>}
              </>
            ) : (
              <p className="text-sm text-slate-500">{d.storage.cloud_error || 'Cloudinary is not set up.'}</p>
            )}
          </div>
        </div>
      </section>

      <section>
        <Title icon={Wallet} sub="Where the money is right now. This page only shows numbers.">Money</Title>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <Stat label="Eyad balance"
            value={!m.eyad_ok ? '-' : m.eyad_usd == null ? 'Payment mode' : '$' + Number(m.eyad_usd).toFixed(2)}
            sub={eyadService && eyadService.status === 'up' ? 'buying is open when this is above $0' : 'could not be read'}
            color={m.eyad_ok && m.eyad_usd === 0 ? '#F87171' : undefined} />
          <Stat label="Paystack balance"
            value={m.paystack_naira == null ? '-' : money(m.paystack_naira)}
            sub={psService && psService.status === 'up' ? m.paystack_mode + ' mode, settled money only' : 'could not be read'} />
          <Stat label="Owed to sellers" value={money(m.owed)} sub="released, not yet paid out" />
          <Stat label="Withdrawals waiting" value={money(m.requested)} sub="sellers asked for this" />
          <Stat label="In escrow" value={money(m.escrow)} sub="held until buyers confirm" />
          <Stat label="Top-ups to look at" value={m.topups_attention} sub="refund needed or check needed"
            color={m.topups_attention > 0 ? '#F59E0B' : undefined} />
        </div>

        {m.covered != null && (
          <div className={'mt-4 flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm ' + (m.covered ? 'border-[#34D399]/30 bg-[#34D399]/10 text-[#34D399]' : 'border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#F59E0B]')}>
            {!m.covered && <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
            <p>
              {m.covered
                ? 'Your Paystack balance covers what you owe sellers and what they asked to withdraw.'
                : 'Your Paystack balance is lower than what you owe sellers (' + money(m.owed + m.requested) + '). Recent sales may still be settling, so check again later.'}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}