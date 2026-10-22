import { createRefund } from './paystack.js';
import { notifyAdmins } from './notify.js';

// Sends the buyer's money back through Paystack for a refunded order.
// Never throws: a failure is stored on the order so an admin can retry it.
export async function refundViaPaystack(p) {
  if (!p.payment_reference) return p; // test order from before real payments: no money to return
  try {
    const r = await createRefund({
      transaction: p.payment_reference,
      amount: Math.round(Number(p.price) * 100),
      customer_note: 'KayVault refund',
      merchant_note: `Order ${p.id} refunded by admin`,
    });
    p.refund_status = 'submitted';
    p.refund_reference = String(r?.id || '');
    p.refunded_at = new Date();
    p.refund_error = '';
  } catch (e) {
    p.refund_status = 'failed';
    p.refund_error = String(e.message || 'Refund failed').slice(0, 200);
    notifyAdmins({
      type: 'order',
      title: 'Paystack refund failed',
      body: `${p.game}: ${p.refund_error}`.slice(0, 290),
      link: '/admin',
    }).catch(() => {});
  }
  await p.save();
  return p;
}