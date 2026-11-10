// KV-EYAD v1: where Paystack sends the buyer back. Checks the order until it is delivered or refunded.
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import PublicNavbar from '../components/PublicNavbar';
import { api } from '../lib/api';
import { money } from '../lib/orders';

const FINAL = new Set(['completed', 'refund_needed', 'refunding', 'refunded', 'refund_failed', 'failed', 'error', 'check_needed']);

const TEXT = {
  completed: ['good', 'Top-up delivered', 'The coins were added to your game account.'],
  refund_needed: ['bad', 'We could not deliver this top-up', 'Your payment is being refunded.'],
  refunding: ['bad', 'We could not deliver this top-up', 'Your payment is being refunded.'],
  refunded: ['bad', 'We could not deliver this top-up', 'Your payment was refunded. It can take a few days to show in your account.'],
  refund_failed: ['bad', 'We could not deliver this top-up', 'Our team is sorting out your refund. You do not need to do anything.'],
  failed: ['bad', 'Payment not completed', 'You were not charged. You can try again.'],
  error: ['bad', 'This order needs attention', 'Our team has been notified and will contact you.'],
  check_needed: ['wait', 'Our team is checking your order', 'This takes a little longer than usual. Check My top-ups for updates.'],
};

export default function TopupCallback() {
  const [params] = useSearchParams();
  const ref = params.get('reference') || params.get('trxref') || '';
  const [order, setOrder] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!ref) return undefined;
    let stop = false;
    let timer;
    let n = 0;
    async function tick() {
      n += 1;
      try {
        const r = await api.post('/topups/verify', { reference: ref });
        if (stop) return;
        setOrder(r.order);
        setErr('');
        if (FINAL.has(r.order.status)) return;
      } catch (e) {
        if (stop) return;
        setErr(e.message);
      }
      if (n < 150) timer = setTimeout(tick, 4000);
    }
    tick();
    return () => { stop = true; clearTimeout(timer); };
  }, [ref]);

  const t = order && TEXT[order.status];
  const tone = t ? t[0] : 'wait';

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-200">
      <PublicNavbar />
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        {!ref ? (
          <p className="text-slate-500 text-sm">No payment reference found.</p>
        ) : (
          <>
            {tone === 'good' && <CheckCircle2 size={44} className="text-[#34D399] mx-auto mb-5" />}
            {tone === 'bad' && <XCircle size={44} className="text-[#F87171] mx-auto mb-5" />}
            {tone === 'wait' && <Loader2 size={44} className="text-[#D4A94B] mx-auto mb-5 animate-spin" />}
            <h1 className="font-display text-2xl font-semibold text-slate-100">
              {t ? t[1] : 'Confirming your payment...'}
            </h1>
            <p className="text-slate-400 text-sm mt-3">
              {t ? t[2] : 'Please keep this page open. This usually takes under a minute.'}
            </p>
            {order && (
              <p className="text-xs text-slate-600 mt-4">
                {order.product_name} - {order.offer_name} - {money(order.naira_amount)}
              </p>
            )}
            {err && !order && <p className="text-xs text-slate-600 mt-4">{err}</p>}
            <div className="flex justify-center gap-4 mt-8 text-sm">
              <Link to="/topup/orders" className="text-[#D4A94B] hover:underline">My top-ups</Link>
              <Link to="/topup" className="text-slate-400 hover:text-slate-100">Top up again</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}