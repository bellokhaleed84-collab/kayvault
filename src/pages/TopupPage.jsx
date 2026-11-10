// KV-EYAD v1: buyer top-up page (pick a game, pick a pack, check the player ID, pay with Paystack)
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ArrowLeft, Lock, CheckCircle2, ListOrdered } from 'lucide-react';
import PublicNavbar from '../components/PublicNavbar';
import Footer from '../components/Footer';
import { api } from '../lib/api';
import { money } from '../lib/orders';

const box = 'w-full bg-[#0D1524] border border-slate-800 rounded-lg px-3.5 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-[#D4A94B] transition-colors';
const card = 'rounded-xl bg-[#131B2E] border border-slate-800';
const label = 'block text-xs font-mono text-slate-500 mb-1.5';

export default function TopupPage() {
  const [cat, setCat] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [game, setGame] = useState(null);
  const [packs, setPacks] = useState([]);
  const [loadingPacks, setLoadingPacks] = useState(false);
  const [pack, setPack] = useState(null);
  const [uid, setUid] = useState('');
  const [sid, setSid] = useState('');
  const [zid, setZid] = useState('');
  const [check, setCheck] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    api.get('/topups/catalog').then(setCat).catch((e) => setError(e.message));
  }, []);

  const shown = useMemo(() => {
    const list = cat && cat.games ? cat.games : [];
    const s = q.trim().toLowerCase();
    return s ? list.filter((g) => g.name.toLowerCase().includes(s)) : list;
  }, [cat, q]);

  async function openGame(g) {
    setError('');
    setPack(null);
    setCheck(null);
    setConfirmed(false);
    setUid('');
    setSid('');
    setZid('');
    setGame(g);
    setPacks([]);
    setLoadingPacks(true);
    try {
      const r = await api.get(`/topups/packages/${encodeURIComponent(g.id)}`);
      setGame(r.game);
      setPacks(r.packs);
    } catch (e) {
      setError(e.message);
    }
    setLoadingPacks(false);
  }

  // Reloads prices after a failed checkout, keeping what the buyer typed
  async function refreshPacks() {
    try {
      const r = await api.get(`/topups/packages/${encodeURIComponent(game.id)}`);
      setPacks(r.packs);
      setPack((cur) => (cur ? r.packs.find((p) => p.pack_id === cur.pack_id) || null : null));
    } catch {
      /* keep the old list */
    }
  }

  const edit = (setter) => (e) => {
    setter(e.target.value);
    setCheck(null);
    setConfirmed(false);
  };

  const fieldsReady = game && uid.trim() && (!game.requires_server || sid) && (!game.requires_zone || zid.trim());
  const locked = !cat || !cat.buy_enabled || (pack && pack.buyable === false);
  const idOk = !game || !game.supports_id_check || (check && check.valid === true && confirmed);
  const canPay = Boolean(pack && fieldsReady && !locked && idOk && !busy);

  async function checkId() {
    setBusy('check');
    setError('');
    setCheck(null);
    setConfirmed(false);
    try {
      const r = await api.post('/topups/validate', {
        game: game.id,
        game_user_id: uid.trim(),
        game_server_id: sid,
        zone_id: zid.trim(),
      });
      setCheck(r);
    } catch (e) {
      setError(e.message);
    }
    setBusy('');
  }

  async function pay() {
    setBusy('pay');
    setError('');
    try {
      const r = await api.post('/topups/checkout', {
        game: game.id,
        pack_id: pack.pack_id,
        game_user_id: uid.trim(),
        game_server_id: sid,
        zone_id: zid.trim(),
        expected_naira: pack.naira,
      });
      window.location.href = r.authorization_url;
      return;
    } catch (e) {
      setError(e.message);
      refreshPacks();
    }
    setBusy('');
  }

  const unsupported = cat && cat.provider && cat.provider !== 'eyad';

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-200">
      <PublicNavbar />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl font-semibold text-slate-100">Game top-up</h1>
            <p className="text-slate-500 text-sm mt-1">Pay in Naira and the coins are sent straight to your game account.</p>
          </div>
          <Link to="/topup/orders" className="flex items-center gap-2 text-sm text-[#D4A94B] hover:underline">
            <ListOrdered size={15} /> My top-ups
          </Link>
        </div>

        {error && <p className="text-red-400 text-sm mb-6">{error}</p>}
        {!cat && !error && <p className="text-slate-500 text-sm">Loading...</p>}
        {unsupported && <div className={`${card} p-10 text-center`}><p className="text-slate-500 text-sm">Top-ups are being updated. Please check back soon.</p></div>}

        {cat && !unsupported && !game && (
          <>
            {!cat.buy_enabled && (
              <div className={`${card} p-4 mb-6 flex items-center gap-3`}>
                <Lock size={16} className="text-[#D4A94B] shrink-0" />
                <p className="text-sm text-slate-400">Buying is temporarily unavailable. You can still browse the games.</p>
              </div>
            )}
            <div className="relative mb-6 max-w-md">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search games" className={`${box} pl-10`} />
            </div>
            {shown.length === 0 ? (
              <div className={`${card} p-10 text-center`}><p className="text-slate-500 text-sm">No games match.</p></div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {shown.map((g) => (
                  <button key={g.id} onClick={() => openGame(g)}
                    className={`${card} p-4 text-left hover:border-[#D4A94B]/50 transition-colors`}>
                    <p className="text-sm text-slate-100 font-medium">{g.name}</p>
                    <p className="text-xs text-slate-600 mt-1">{g.id_label}</p>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {cat && !unsupported && game && (
          <div className="space-y-6">
            <button onClick={() => { setGame(null); setError(''); }} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-100">
              <ArrowLeft size={15} /> All games
            </button>
            <h2 className="font-display text-2xl font-semibold text-slate-100">{game.name}</h2>

            <div>
              <p className={label}>1. CHOOSE A PACK</p>
              {loadingPacks ? (
                <p className="text-slate-500 text-sm">Loading packs...</p>
              ) : packs.length === 0 ? (
                <div className={`${card} p-8 text-center`}><p className="text-slate-500 text-sm">No packs are available for this game right now.</p></div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {packs.map((p) => (
                    <button key={p.pack_id} onClick={() => setPack(p)}
                      className={`rounded-xl border p-4 text-left transition-colors ${
                        pack && pack.pack_id === p.pack_id ? 'border-[#D4A94B] bg-[#D4A94B]/10' : 'border-slate-800 bg-[#131B2E] hover:border-slate-600'
                      }`}>
                      <p className="text-sm text-slate-100 font-medium">{p.name}</p>
                      <p className="font-mono text-[#D4A94B] font-semibold mt-2">{money(p.naira)}</p>
                      {p.buyable === false && <p className="text-[11px] text-slate-500 mt-1">Unavailable</p>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className={`${card} p-5 space-y-4`}>
              <p className={label}>2. YOUR GAME ACCOUNT</p>
              <div>
                <label className={label}>{game.id_label.toUpperCase()}</label>
                <input value={uid} onChange={edit(setUid)} placeholder={game.id_format === 'riot_id' ? 'Username#Tag' : game.id_label} className={box} />
              </div>
              {game.requires_server && (
                <div>
                  <label className={label}>SERVER</label>
                  <select value={sid} onChange={edit(setSid)} className={box}>
                    <option value="">Choose your server</option>
                    {game.servers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              {game.requires_zone && (
                <div>
                  <label className={label}>{String(game.zone_label || 'Zone ID').toUpperCase()}</label>
                  <input value={zid} onChange={edit(setZid)} placeholder={game.zone_label} className={box} />
                </div>
              )}

              {game.supports_id_check && (
                <div className="space-y-3">
                  <button onClick={checkId} disabled={!fieldsReady || busy === 'check'}
                    className="border border-[#D4A94B]/60 text-[#D4A94B] hover:bg-[#D4A94B]/10 disabled:opacity-40 font-semibold rounded-lg px-4 py-2 text-sm transition-colors">
                    {busy === 'check' ? 'Checking...' : 'Check player ID'}
                  </button>
                  {check && check.valid === true && (
                    <div className="rounded-lg bg-[#0D1524] border border-slate-800 px-4 py-3">
                      <p className="flex items-center gap-2 text-sm text-[#34D399]"><CheckCircle2 size={15} /> Player found: <span className="font-semibold">{check.player_name || 'OK'}</span></p>
                      <label className="flex items-center gap-2.5 text-sm text-slate-400 mt-3 cursor-pointer">
                        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="accent-[#D4A94B] w-4 h-4" />
                        This is my account. Coins sent to the wrong account cannot be reversed.
                      </label>
                    </div>
                  )}
                  {check && check.valid !== true && (
                    <p className="text-sm text-red-400">{check.message || 'We could not find that player ID. Check it and try again.'}</p>
                  )}
                </div>
              )}
            </div>

            <div className={`${card} p-5 flex flex-wrap items-center justify-between gap-4`}>
              <div>
                <p className="text-xs font-mono text-slate-500">TOTAL</p>
                <p className="font-display text-2xl font-semibold text-slate-100">{pack ? money(pack.naira) : '-'}</p>
                {pack && <p className="text-xs text-slate-600 mt-1">{game.name} - {pack.name}</p>}
              </div>
              {locked && pack ? (
                <button disabled className="flex items-center gap-2 bg-slate-800 text-slate-500 font-semibold rounded-lg px-6 py-3 text-sm cursor-not-allowed">
                  <Lock size={15} /> Temporarily unavailable
                </button>
              ) : (
                <button onClick={pay} disabled={!canPay}
                  className="bg-[#D4A94B] hover:bg-[#c49a3f] disabled:opacity-40 text-[#0B1120] font-semibold rounded-lg px-6 py-3 text-sm transition-colors">
                  {busy === 'pay' ? 'Starting payment...' : 'Pay with Paystack'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}