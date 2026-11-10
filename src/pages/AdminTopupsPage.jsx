// KV-EYAD v1: admin top-ups (provider switch, Naira rate, profit %, balances, orders)
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import DashHeader from '../components/DashHeader';
import { api } from '../lib/api';
import { money, shortDate } from '../lib/orders';

const card = 'rounded-xl bg-[#131B2E] border border-slate-800';
const th = 'px-4 py-3 font-medium text-xs font-mono text-slate-500';
const box = 'w-full bg-[#0D1524] border border-slate-800 rounded-lg px-3.5 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-[#D4A94B] transition-colors';
const lbl = 'block text-xs font-mono text-slate-500 mb-1.5';
const COLOR = {
  completed: '#34D399', processing: '#5B8DEF', paid: '#D4A94B', pending: '#64748B', failed: '#64748B',
  refunded: '#F87171', refund_needed: '#F87171', refunding: '#F87171', refund_failed: '#F87171',
  check_needed: '#D4A94B', error: '#F87171',
};

export default function AdminTopupsPage() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ provider: 'eyad', usd_ngn: '', profit_percent: '20', games: '' });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const d = await api.get('/topups/admin/overview');
      setData(d);
      setDirty((wasDirty) => {
        if (!wasDirty) {
          setForm({
            provider: d.settings.provider,
            usd_ngn: d.settings.usd_ngn ? String(d.settings.usd_ngn) : '',
            profit_percent: String(d.settings.profit_percent),
            games: (d.settings.eyad_games || []).join(', '),
          });
        }
        return wasDirty;
      });
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setDirty(true);
  };

  async function save() {
    setSaving(true);
    setMsg('');
    setError('');
    try {
      await api.post('/topups/admin/settings', {
        provider: form.provider,
        usd_ngn: Number(form.usd_ngn || 0),
        profit_percent: Number(form.profit_percent),
        eyad_games: form.games.split(/[\s,]+/).filter(Boolean),
      });
      setDirty(false);
      setMsg('Saved.');
      await load();
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  }

  async function act(o, action, ask) {
    if (!window.confirm(ask)) return;
    setError('');
    try {
      await api.post(`/topups/admin/${o.id}/${action}`);
    } catch (e) {
      setError(e.message);
    }
    load();
  }

  const rate = Number(form.usd_ngn) || 0;
  const profit = Number(form.profit_percent) || 0;
  const preview = rate > 0 ? Math.ceil((rate * (1 + profit / 100)) / 10 - 1e-9) * 10 : 0;

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-200">
      <DashHeader />
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div>
          <Link to="/admin" className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-100 mb-3"><ArrowLeft size={14} /> Admin</Link>
          <h1 className="font-display text-3xl font-semibold text-slate-100">Top-ups</h1>
          <p className="text-slate-500 text-sm mt-1">Choose the provider, set your prices and watch orders.</p>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {!data ? <p className="text-slate-500 text-sm">Loading...</p> : (
          <>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className={`${card} p-5`}>
                <p className="text-xs font-mono text-slate-500 mb-1">EYAD BALANCE</p>
                <p className="font-display text-2xl font-semibold text-slate-100">
                  {data.eyad.error ? '-' : data.eyad.balance_usd == null ? 'Payment mode' : '$' + data.eyad.balance_usd.toFixed(2)}
                </p>
                {data.eyad.error && <p className="text-xs text-red-400 mt-1">{data.eyad.error}</p>}
              </div>
              <div className={`${card} p-5`}>
                <p className="text-xs font-mono text-slate-500 mb-1">GAMESDROP BALANCE</p>
                <p className="font-display text-2xl font-semibold text-slate-100">
                  {data.balance ? `${data.balance.amount} ${data.balance.currency}` : '-'}
                </p>
                {data.balance_error && <p className="text-xs text-slate-600 mt-1">{data.balance_error}</p>}
              </div>
              <div className={`${card} p-5`}>
                <p className="text-xs font-mono text-slate-500 mb-1">NEEDS ATTENTION</p>
                <p className={`font-display text-2xl font-semibold ${data.needs_attention > 0 ? 'text-[#D4A94B]' : 'text-slate-100'}`}>{data.needs_attention}</p>
              </div>
            </div>

            <div className={`${card} p-5 space-y-4`}>
              <h2 className="font-display text-slate-100 font-semibold">Settings</h2>
              <div>
                <label className={lbl}>ACTIVE PROVIDER</label>
                <div className="flex gap-3">
                  {[['eyad', 'Eyad'], ['gamesdrop', 'GamesDrop']].map(([v, l]) => (
                    <button key={v} onClick={() => { setForm((f) => ({ ...f, provider: v })); setDirty(true); }}
                      className={`rounded-lg px-4 py-2 text-sm border transition-colors ${
                        form.provider === v ? 'bg-[#D4A94B] border-[#D4A94B] text-[#0B1120] font-semibold' : 'border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}>
                      {l}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-600 mt-2">Orders already paid keep using the provider they were bought with.</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>NAIRA PER DOLLAR (EYAD)</label>
                  <input value={form.usd_ngn} onChange={set('usd_ngn')} inputMode="decimal" placeholder="for example 1600" className={box} />
                </div>
                <div>
                  <label className={lbl}>PROFIT % (EYAD)</label>
                  <input value={form.profit_percent} onChange={set('profit_percent')} inputMode="decimal" className={box} />
                </div>
              </div>
              <p className="text-xs text-slate-500">
                {rate > 0 ? `Example: a $1.00 pack sells for ${money(preview)}.` : 'Set the rate to open Eyad top-ups. Until then buyers see "not set up yet".'}
                {' '}Price = Eyad USD price x rate x (1 + profit), rounded up to the next 10 Naira.
              </p>
              <div>
                <label className={lbl}>ONLY SELL THESE EYAD GAMES (OPTIONAL)</label>
                <textarea value={form.games} onChange={set('games')} rows={2} placeholder="genshin, mlbb, pubgm (leave empty to sell every game Eyad offers)" className={box} />
              </div>
              <div className="flex items-center gap-4">
                <button onClick={save} disabled={saving || !dirty}
                  className="bg-[#D4A94B] hover:bg-[#c49a3f] disabled:opacity-40 text-[#0B1120] font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors">
                  {saving ? 'Saving...' : 'Save settings'}
                </button>
                {msg && <span className="text-sm text-[#34D399]">{msg}</span>}
              </div>
            </div>

            <div className={card}>
              {data.orders.length === 0 ? (
                <p className="text-slate-500 text-sm p-8 text-center">No top-up orders yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-800">
                        <th className={th}>ORDER</th>
                        <th className={th}>BUYER</th>
                        <th className={th}>PLAYER</th>
                        <th className={th}>AMOUNT</th>
                        <th className={th}>STATUS</th>
                        <th className={th}>DATE</th>
                        <th className={th}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.orders.map((o) => {
                        const note = o.fail_reason || o.refund_error || o.gd_error || o.gd_status;
                        return (
                          <tr key={o.id} className="border-b border-slate-800 last:border-0 align-top">
                            <td className="px-4 py-3">
                              <p className="text-slate-200 font-medium">{o.product_name}</p>
                              <p className="text-xs text-slate-500 max-w-[200px] truncate">{o.offer_name}</p>
                              <p className="text-[11px] text-slate-600 uppercase">{o.provider}</p>
                            </td>
                            <td className="px-4 py-3 text-slate-400 text-xs">{o.buyer_name || '-'}<br />{o.buyer_email}</td>
                            <td className="px-4 py-3 text-slate-400 text-xs">
                              {o.player_name && <>{o.player_name}<br /></>}
                              {o.game_user_id}{o.game_server_id ? ` / ${o.game_server_id}` : ''}{o.zone_id ? ` / ${o.zone_id}` : ''}
                            </td>
                            <td className="px-4 py-3 font-mono text-[#D4A94B] whitespace-nowrap">{money(o.naira_amount)}</td>
                            <td className="px-4 py-3">
                              <span className="text-xs font-medium" style={{ color: COLOR[o.status] || '#64748B' }}>{o.status.replace('_', ' ')}</span>
                              {note && <p className="text-[11px] text-slate-600 max-w-[220px] mt-1">{String(note).slice(0, 140)}</p>}
                            </td>
                            <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">{shortDate(o.created_at)}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1.5 items-end">
                                {o.status === 'paid' && (
                                  <button onClick={() => act(o, 'retry', 'Try to place this paid order again?')}
                                    className="text-xs border border-slate-700 hover:border-[#D4A94B] text-slate-300 rounded-lg px-3 py-1">Retry</button>
                                )}
                                {['paid', 'refund_needed', 'refund_failed', 'check_needed'].includes(o.status) && (
                                  <button onClick={() => act(o, 'refund', `Refund ${money(o.naira_amount)} to the buyer?`)}
                                    className="text-xs border border-slate-700 hover:border-red-500 hover:text-red-400 text-slate-400 rounded-lg px-3 py-1">Refund</button>
                                )}
                                {o.status === 'check_needed' && (
                                  <button onClick={() => act(o, 'complete', 'Mark this order as delivered? Only do this after checking with the provider.')}
                                    className="text-xs border border-slate-700 hover:border-[#34D399] hover:text-[#34D399] text-slate-400 rounded-lg px-3 py-1">Mark delivered</button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}