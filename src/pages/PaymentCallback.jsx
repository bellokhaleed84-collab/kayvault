import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, AlertTriangle } from 'lucide-react';
import DashHeader from '../components/DashHeader';
import { api } from '../lib/api';

// Paystack sends the buyer back here. We confirm the payment on the server, then open the order.
export default function PaymentCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const reference = params.get('reference') || params.get('trxref') || '';
  const [error, setError] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!reference) {
      setError('This page needs a payment reference.');
      return;
    }
    (async () => {
      for (let i = 0; i < 8; i++) {
        try {
          const r = await api.post('/payments/verify', { reference });
          if (r.purchase_id) {
            navigate(`/orders/${r.purchase_id}`, { replace: true });
            return;
          }
        } catch (e) {
          setError(e.message);
          return;
        }
        await new Promise((res) => setTimeout(res, 3000));
      }
      setError('We are still waiting for Paystack to confirm the payment. Check My Purchases in a minute.');
    })();
  }, [reference, navigate]);

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-200">
      <DashHeader />
      <div className="max-w-md mx-auto px-6 py-24 text-center">
        {error ? (
          <>
            <AlertTriangle size={32} className="text-[#D4A94B] mx-auto mb-4" />
            <h1 className="font-display text-2xl font-semibold text-slate-100 mb-2">Payment not completed</h1>
            <p className="text-sm text-slate-400 mb-6">{error}</p>
            <div className="flex justify-center gap-3">
              <Link to="/dashboard/buyer" className="bg-[#D4A94B] hover:bg-[#c49a3f] text-[#0B1120] font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors">My purchases</Link>
              <Link to="/browse" className="border border-[#D4A94B]/60 text-[#D4A94B] hover:bg-[#D4A94B]/10 font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors">Browse</Link>
            </div>
          </>
        ) : (
          <>
            <Loader2 size={32} className="text-[#D4A94B] mx-auto mb-4 animate-spin" />
            <h1 className="font-display text-2xl font-semibold text-slate-100 mb-2">Confirming your payment</h1>
            <p className="text-sm text-slate-500">Please wait. Do not close this page.</p>
          </>
        )}
      </div>
    </div>
  );
}