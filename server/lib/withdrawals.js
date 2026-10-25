// KV-WDLIB v1
import Purchase from '../models/Purchase.js';
import Withdrawal from '../models/Withdrawal.js';
import { notify, notifyAdmins } from './notify.js';
import { nigerianBanks, secretConfigured } from './paystack.js';
import { createRecipient, initiateTransfer, verifyTransfer } from './transfers.js';

const naira = (n) => '\u20A6' + Number(n || 0).toLocaleString();
const FAIL = new Set(['failed', 'reversed', 'rejected', 'blocked', 'cancelled']);
const OTP_MSG = 'Paystack is waiting for an OTP. Turn off "Confirm transfers before sending" in Paystack Preferences, then finish or cancel this transfer in the Paystack dashboard.';

export const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

// Smallest amount a seller can withdraw (MIN_WITHDRAWAL in server/.env, default 1000 Naira)
export function minWithdrawal() {
  const n = Number(process.env.MIN_WITHDRAWAL);
  return Number.isFinite(n) && n >= 0 ? n : 1000;
}

// Automatic payouts: AUTO_PAYOUTS=true in server/.env and Paystack Transfers switched on
export const autoOn = () => process.env.AUTO_PAYOUTS === 'true' && secretConfigured();

// Makes the orders match the result of the withdrawal. Safe to run many times.
async function applyToOrders(w) {
  if (w.status === 'paid') {
    await Purchase.updateMany(
      { withdrawal: w._id, payout_status: 'requested' },
      { $set: { payout_status: 'paid', payout_paid_at: w.paid_at || new Date(), payout_note: ('Withdrawal ' + w.reference).slice(0, 120) } }
    );
  } else if (w.status === 'failed') {
    await Purchase.updateMany(
      { withdrawal: w._id, payout_status: 'requested' },
      { $set: { payout_status: 'unpaid' }, $unset: { withdrawal: 1 } }
    );
  } else {
    return;
  }
  await Withdrawal.updateOne({ _id: w._id }, { $set: { done: true } });
}

// Moves a withdrawal to paid or failed, once. Returns the withdrawal, or null if it was not in an allowed state.
export async function settle(id, outcome, opts = {}) {
  const from = opts.from || ['pending', 'processing'];
  const note = String(opts.note || '').slice(0, 300);
  const set = outcome === 'paid'
    ? { status: 'paid', paid_at: new Date(), error: '', note }
    : { status: 'failed', error: String(opts.error || '').slice(0, 300), note };
  const w = await Withdrawal.findOneAndUpdate({ _id: id, status: { $in: from } }, { $set: set }, { new: true });
  if (!w) return null;
  if (outcome === 'paid') {
    notify(w.seller, { type: 'order', title: 'Payout sent', body: naira(w.amount) + ' was sent to your bank account.', link: '/dashboard/seller' });
  } else {
    notify(w.seller, {
      type: 'order',
      title: 'Withdrawal not completed',
      body: (naira(w.amount) + ': ' + (w.note || 'The transfer did not go through.') + ' The money is back in your wallet.').slice(0, 290),
      link: '/dashboard/seller',
    });
  }
  await applyToOrders(w);
  return w;
}

// Sends one pending withdrawal through Paystack. Only one caller can start it.
// Problems before Paystack accepted the transfer put it back to "pending" so an admin can pay by hand.
export async function sendTransfer(id) {
  if (!autoOn()) return null;
  const w = await Withdrawal.findOneAndUpdate({ _id: id, status: 'pending' }, { $set: { status: 'processing', error: '' } }, { new: true });
  if (!w) return null;

  const back = async (msg) => {
    await Withdrawal.updateOne({ _id: w._id, status: 'processing' }, { $set: { status: 'pending', error: String(msg).slice(0, 300) } });
    notifyAdmins({ type: 'order', title: 'Automatic payout did not go through', body: (naira(w.amount) + ': ' + msg).slice(0, 290), link: '/admin' }).catch(() => {});
  };

  let stage = 'prep';
  try {
    let code = w.recipient_code;
    if (!code) {
      const banks = await nigerianBanks();
      const want = String(w.bank_name || '').toLowerCase();
      const hit = banks.find((b) => b.name.toLowerCase() === want);
      if (!hit || !hit.code) return await back('Could not find the bank code for "' + w.bank_name + '"');
      const r = await createRecipient({
        type: 'nuban',
        name: w.bank_account_name || 'KayVault seller',
        account_number: w.bank_account_number,
        bank_code: hit.code,
        currency: 'NGN',
      });
      code = r && r.recipient_code;
      if (!code) return await back('Paystack did not return a recipient code');
      await Withdrawal.updateOne({ _id: w._id }, { $set: { recipient_code: code } });
    }

    stage = 'send';
    const t = await initiateTransfer({
      source: 'balance',
      amount: Math.round(w.amount * 100),
      recipient: code,
      reason: 'KayVault payout',
      reference: w.reference,
    });
    await Withdrawal.updateOne({ _id: w._id }, { $set: { transfer_code: String((t && t.transfer_code) || '') } });
    const st = String((t && t.status) || '');
    if (st === 'success') {
      await settle(w._id, 'paid', { from: ['processing'] });
    } else if (FAIL.has(st)) {
      await settle(w._id, 'failed', { from: ['processing'], note: 'The bank transfer failed.', error: 'Paystack status: ' + st });
    } else if (st === 'otp') {
      await Withdrawal.updateOne({ _id: w._id }, { $set: { error: OTP_MSG } });
      notifyAdmins({ type: 'order', title: 'Payout is waiting for an OTP', body: OTP_MSG.slice(0, 290), link: '/admin' }).catch(() => {});
    }
  } catch (e) {
    const msg = (e && e.message) || 'Paystack request failed';
    if (stage === 'prep' || (e && e.status >= 400 && e.status < 500)) {
      await back(msg);
    } else {
      // Unknown whether Paystack got it: stay "processing" and let the check settle it
      await Withdrawal.updateOne({ _id: w._id }, { $set: { error: ('Waiting for Paystack: ' + msg).slice(0, 300) } });
    }
  }
  return Withdrawal.findById(id);
}

// Asks Paystack what happened to a "processing" withdrawal and settles it
export async function checkWithdrawal(id) {
  const w = await Withdrawal.findOne({ _id: id, status: 'processing' });
  if (!w) return 'not_processing';
  let t;
  try {
    t = await verifyTransfer(w.reference);
  } catch (e) {
    if (e && e.status === 404 && Date.now() - new Date(w.updated_at).getTime() > 10 * 60 * 1000) {
      await Withdrawal.updateOne({ _id: w._id, status: 'processing' }, { $set: { status: 'pending', error: 'Paystack has no record of this transfer. It can be sent again.' } });
      return 'not_found';
    }
    throw e;
  }
  if (t && Number.isFinite(Number(t.amount)) && Number(t.amount) !== Math.round(w.amount * 100)) {
    notifyAdmins({ type: 'order', title: 'Payout amount mismatch', body: 'ref ' + w.reference + ': expected ' + Math.round(w.amount * 100) + ' got ' + t.amount, link: '/admin' }).catch(() => {});
    return 'mismatch';
  }
  const st = String((t && t.status) || '');
  if (st === 'success') {
    await settle(w._id, 'paid', { from: ['processing'] });
  } else if (FAIL.has(st)) {
    await settle(w._id, 'failed', { from: ['processing'], note: 'The bank transfer failed.', error: 'Paystack status: ' + st });
  }
  return st || 'pending';
}

// Paystack webhook events: transfer.success, transfer.failed, transfer.reversed
export async function handleTransferEvent(ev) {
  const d = ev && ev.data;
  const ref = d && typeof d.reference === 'string' ? d.reference : '';
  if (!ref.startsWith('kvw_')) return;
  const w = await Withdrawal.findOne({ reference: ref });
  if (!w) return;
  if (Number.isFinite(Number(d.amount)) && Number(d.amount) !== Math.round(w.amount * 100)) {
    await notifyAdmins({ type: 'order', title: 'Payout amount mismatch', body: 'ref ' + ref + ': expected ' + Math.round(w.amount * 100) + ' got ' + d.amount, link: '/admin' });
    return;
  }
  if (ev.event === 'transfer.success') {
    await settle(w._id, 'paid', { from: ['pending', 'processing'] });
  } else if (ev.event === 'transfer.failed' || ev.event === 'transfer.reversed') {
    await settle(w._id, 'failed', { from: ['pending', 'processing'], note: 'The bank transfer failed.', error: 'Paystack event: ' + ev.event });
  }
}

// Every few minutes: finish half-done settlements and ask Paystack about transfers whose webhook never came
export async function sweepWithdrawals() {
  let n = 0;
  const undone = await Withdrawal.find({ status: { $in: ['paid', 'failed'] }, done: { $ne: true } }).limit(20);
  for (const w of undone) {
    try { await applyToOrders(w); n++; } catch (e) { console.error('[withdrawal] could not finish', String(w._id), e.message); }
  }
  if (secretConfigured()) {
    const rows = await Withdrawal.find({ status: 'processing', updated_at: { $lt: new Date(Date.now() - 5 * 60 * 1000) } }).select('_id').limit(20);
    for (const w of rows) {
      try { await checkWithdrawal(w._id); n++; } catch (e) { console.error('[withdrawal] check failed', String(w._id), e.message); }
    }
  }
  return n;
}