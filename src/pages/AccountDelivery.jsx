import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, ShieldCheck, Lock, Copy, Check, Eye, EyeOff, Clock, ShieldAlert,
  RotateCcw, CheckCircle2, KeyRound,
} from 'lucide-react';
import DashHeader from '../components/DashHeader';
import GameArt from '../components/GameArt';
import StatusPill from '../components/StatusPill';
import ReviewBox from '../components/ReviewBox';
import ProofUploader from '../components/ProofUploader';
import CaseChat from '../components/CaseChat';
import { api, assetUrl } from '../lib/api';
import { timeLeft, money, shortDate } from '../lib/orders';

const TYPE_LABELS = { standard: 'Standard', modded: 'Modded', smurf: 'Smurf', fresh: 'Fresh', other: 'Other' };

function CopyRow({ label, value, secret }) {
  const [show, setShow] = useState(!secret);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the person can still select the text */
    }
  }

  return (
    <div>
      <p className="text-[11px] font-mono text-slate-500 mb-1.5">{label}</p>
      <div className="flex items-center gap-2 bg-[#0D1524] border border-slate-800 rounded-lg px-3.5 py-2.5">
        <span className="flex-1 font-mono text-sm text-slate-200 break-all">
          {show ? value : '\u2022'.repeat(Math.min(value.length, 14))}
        </span>
        {secret && (
          <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide' : 'Show'}
            className="text-slate-500 hover:text-slate-300">
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
        <button type="button" onClick={copy} aria-label={`Copy ${label}`}
          className="text-slate-500 hover:text-[#D4A94B]">
          {copied ? <Check size={15} className="text-[#34D399]" /> : <Copy size={15} />}
        </button>
      </div>
    </div>
  );
}

export default function AccountDelivery() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [creds, setCreds] = useState(null);
  const [credsLoading, setCredsLoading] = useState(false);
  const [credsError, setCredsError] = useState('');
  const [panel, setPanel] = useState(null); // 'confirm' | 'refund'
  const [reason, setReason] = useState('');
  const [proofCount, setProofCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [now, setNow] = useState(Date.now());

  async function load() {
    try {
      setData(await api.get(`/purchases/${id}`));
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function reveal() {
    setCredsLoading(true);
    setCredsError('');
    try {
      setCreds(await api.get(`/purchases/${id}/credentials`));
    } catch (e) {
      setCredsError(e.message);
    }
    setCredsLoading(false);
  }

  async function act(path, body) {
    setBusy(true);
    setActionError('');
    try {
      await api.post(path, body);
      setPanel(null);
      setReason('');
      await load();
    } catch (e) {
      setActionError(e.message);
    }
    setBusy(false);
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0B1120] text-slate-200">
        <DashHeader />
        <div className="max-w-3xl mx-auto px-6 py-24 text-center">
          <p className="text-slate-400 mb-4">{error}</p>
          <Link to="/dashboard/buyer" className="text-[#D4A94B] hover:underline">Back to My Purchases</Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0B1120] text-slate-200">
        <DashHeader />
        <p className="max-w-3xl mx-auto px-6 py-24 text-slate-500 text-sm">Loading your order...</p>
      </div>
    );
  }

  const { purchase: p, listing: info } = data;
  const t = timeLeft(p.confirm_deadline, now);
  const status = p.escrow_status;
  const image = p.has_image ? assetUrl(`/api/listings/${p.listing}/image/0`) : null;
  const facts = [
    ['Level / Rank', info?.level],
    ['Platform', info?.platform],
    ['Account type', info ? TYPE_LABELS[info.account_type] : ''],
    ['Seller', p.seller_name],
  ].filter(([, v]) => v);

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-200">
      <DashHeader />

      <div className="max-w-6xl mx-auto px-6 py-10">
        <Link to="/dashboard/buyer" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 mb-6">
          <ArrowLeft size={14} /> Back to My Purchases
        </Link>

        <div className="flex flex-wrap items-center gap-3 mb-8">
          <h1 className="font-display text-3xl font-semibold text-slate-100">Account Delivery</h1>
          <StatusPill status={status} />
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* order summary */}
            <div className="rounded-xl bg-[#131B2E] border border-slate-800 p-5 flex gap-5">
              <GameArt game={p.game} image={image} className="w-32 h-28 rounded-lg shrink-0" />
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-lg font-semibold text-slate-100">{p.game}</h2>
                <p className="text-sm text-slate-500 mb-3">{p.tier}</p>
                <p className="font-mono text-xl text-[#D4A94B] mb-3">{money(p.price)}</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  {facts.map(([k, v]) => (
                    <div key={k}>
                      <p className="text-[11px] font-mono text-slate-600">{k.toUpperCase()}</p>
                      <p className="text-sm text-slate-300 truncate">{v}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* credentials */}
            <div className="rounded-xl bg-[#131B2E] border border-slate-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <KeyRound size={16} className="text-[#D4A94B]" />
                  <h2 className="font-display text-slate-100 font-semibold">Login details</h2>
                </div>
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Lock size={12} className="text-[#34D399]" /> Encrypted
                </span>
              </div>

              {status === 'refunded' ? (
                <p className="text-sm text-slate-500">This order was refunded, so the login details are no longer available.</p>
              ) : creds ? (
                <div className="space-y-4">
                  <CopyRow label="LOGIN / EMAIL" value={creds.login} />
                  <CopyRow label="PASSWORD" value={creds.password} secret />
                  {creds.notes && (
                    <div>
                      <p className="text-[11px] font-mono text-slate-500 mb-1.5">NOTES FROM THE SELLER</p>
                      <p className="text-sm text-slate-300 bg-[#0D1524] border border-slate-800 rounded-lg px-3.5 py-2.5 whitespace-pre-line">
                        {creds.notes}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <p className="text-sm text-slate-500 mb-4">
                    Your payment is held in escrow. The login details are hidden until you choose to reveal them.
                  </p>
                  <button onClick={reveal} disabled={credsLoading}
                    className="flex items-center gap-2 bg-[#D4A94B] hover:bg-[#c49a3f] disabled:opacity-60 text-[#0B1120] font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors">
                    <Eye size={15} /> {credsLoading ? 'Decrypting...' : 'Reveal login details'}
                  </button>
                  {credsError && <p className="text-red-400 text-xs mt-3">{credsError}</p>}
                </div>
              )}
            </div>

            {/* safety tips */}
            <div className="rounded-xl bg-[#131B2E] border border-slate-800 p-6">
              <div className="flex items-center gap-2 mb-3">
                <ShieldAlert size={16} className="text-[#D4A94B]" />
                <h2 className="font-display text-slate-100 font-semibold">Before you confirm</h2>
              </div>
              <ul className="space-y-2 text-sm text-slate-400 list-disc pl-5">
                <li>Log in and check the level, skins and items match the listing.</li>
                <li>Change the password and recovery email right away.</li>
                <li>Only confirm once everything works. Confirming releases the money to the seller.</li>
              </ul>
            </div>
          </div>

          {/* right column: escrow status + actions */}
          <aside className="space-y-5 lg:sticky lg:top-24 self-start">
            <div className="rounded-xl bg-[#131B2E] border border-slate-800 p-5">
              <p className="text-[11px] font-mono text-slate-500 mb-3">ESCROW</p>

              {status === 'held' && (
                <>
                  {t ? (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <Clock size={15} className="text-[#D4A94B]" />
                        <span className="text-sm text-slate-200 font-medium">{t.text}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden mb-3">
                        <div className="h-full bg-[#D4A94B]" style={{ width: `${t.pct}%` }} />
                      </div>
                      <p className="text-xs text-slate-500 mb-5">
                        {t.expired
                          ? 'The 24 hour window has closed. Payment goes to the seller automatically.'
                          : 'You have 24 hours from delivery to confirm or request a refund. If you do nothing, payment is released to the seller.'}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-slate-500 mb-5">Your payment is held until you confirm or request a refund.</p>
                  )}

                  {panel === null && (
                    <div className="space-y-2.5">
                      <button onClick={() => setPanel('confirm')}
                        className="w-full flex items-center justify-center gap-2 bg-[#D4A94B] hover:bg-[#c49a3f] text-[#0B1120] font-semibold rounded-lg py-3 text-sm transition-colors">
                        <ShieldCheck size={16} /> Confirm account
                      </button>
                      {!t?.expired && (
                        <button onClick={() => setPanel('refund')}
                          className="w-full flex items-center justify-center gap-2 border border-[#F87171]/50 text-[#F87171] hover:bg-[#F87171]/10 font-semibold rounded-lg py-3 text-sm transition-colors">
                          <RotateCcw size={15} /> Request refund
                        </button>
                      )}
                    </div>
                  )}

                  {panel === 'confirm' && (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-300">Release {money(p.price)} to the seller? This cannot be undone.</p>
                      <button onClick={() => act(`/purchases/${p.id}/confirm`)} disabled={busy}
                        className="w-full bg-[#D4A94B] hover:bg-[#c49a3f] disabled:opacity-60 text-[#0B1120] font-semibold rounded-lg py-2.5 text-sm transition-colors">
                        {busy ? 'Releasing...' : 'Yes, release payment'}
                      </button>
                      <button onClick={() => setPanel(null)} className="w-full text-sm text-slate-500 hover:text-slate-300">Cancel</button>
                    </div>
                  )}

                  {panel === 'refund' && (
                    <div className="space-y-3">
                      <label className="block text-[11px] font-mono text-slate-500">WHAT WENT WRONG?</label>
                      <textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)}
                        placeholder="e.g. The password does not work, or the account has fewer skins than listed."
                        className="w-full bg-[#0D1524] border border-slate-800 rounded-lg px-3.5 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-[#D4A94B]" />
                      <ProofUploader purchaseId={p.id} onCount={setProofCount} />
                      <button onClick={() => act(`/purchases/${p.id}/refund-request`, { reason })} disabled={busy || reason.trim().length < 5 || proofCount < 1}
                        className="w-full bg-[#F87171] hover:bg-[#ef5b5b] disabled:opacity-60 text-[#0B1120] font-semibold rounded-lg py-2.5 text-sm transition-colors">
                        {busy ? 'Sending...' : 'Send refund request'}
                      </button>
                      <button onClick={() => setPanel(null)} className="w-full text-sm text-slate-500 hover:text-slate-300">Cancel</button>
                    </div>
                  )}

                  {actionError && <p className="text-red-400 text-xs mt-3">{actionError}</p>}
                </>
              )}

              {status === 'released' && (
                <div className="flex gap-2.5">
                  <CheckCircle2 size={16} className="text-[#34D399] mt-0.5 shrink-0" />
                  <p className="text-sm text-slate-400">
                    {p.auto_released
                      ? 'The 24 hour window ended and payment was released to the seller.'
                      : 'You confirmed this account. Payment was released to the seller.'}
                    {p.released_at ? ` (${shortDate(p.released_at)})` : ''}
                  </p>
                </div>
              )}

              {status === 'refund_requested' && (
                <div>
                  <p className="text-sm text-slate-400 mb-3">
                    Your refund request is with our team. Your money stays in escrow until it is resolved.
                  </p>
                  {p.refund_reason && (
                    <p className="text-xs text-slate-500 bg-[#0D1524] border border-slate-800 rounded-lg px-3 py-2">
                      {p.refund_reason}
                    </p>
                  )}
                </div>
              )}

              {status === 'refund_requested' && <CaseChat purchaseId={p.id} mode="user" />}

              {status === 'refunded' && (
                <p className="text-sm text-slate-400">This order was refunded to you.</p>
              )}
            </div>

            {status === 'released' && <ReviewBox purchaseId={p.id} existing={data.review} onDone={load} />}

            <div className="rounded-xl bg-[#131B2E] border border-slate-800 p-5 text-xs text-slate-500 space-y-1.5">
              <p>Order placed {shortDate(p.created_at)}</p>
              <p className="font-mono">Order ID {p.id}</p>
              <div className="flex items-center gap-2 pt-2">
                <ShieldCheck size={14} className="text-[#D4A94B]" /> Protected by KayVault Escrow
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}