// KV-SEC-VERIFY: the page the email link opens. Works even when the person is not logged in on this device.
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, getToken } from '../lib/api';
import { useAuth } from '../lib/AuthContext';
import AuthShell from '../components/AuthShell';
import loginBg from '../assets/login-bg.jpg';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const { refreshProfile } = useAuth();
  const [status, setStatus] = useState(token ? 'checking' : 'bad');
  const [error, setError] = useState(token ? '' : 'This link is missing its code.');
  const ran = useRef(false);

  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true;
    api.post('/auth/verify-email', { token })
      .then(() => {
        setStatus('ok');
        if (getToken()) refreshProfile().catch(() => {});
      })
      .catch((e) => {
        setError(e.message);
        setStatus('bad');
      });
  }, [token, refreshProfile]);

  const loggedIn = Boolean(getToken());
  const linkBtn = 'inline-block mt-4 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-semibold rounded-lg px-6 py-3 text-sm transition-colors';

  return (
    <AuthShell image={loginBg} title={<>One quick step.</>} subtitle="Confirming your email keeps your account and your money safe.">
      <h1 className="font-display text-3xl font-semibold text-slate-100 mb-6">Confirm your email</h1>

      {status === 'checking' && (
        <div className="rounded-xl bg-[#131B2E] border border-slate-800 p-6 space-y-3 animate-pulse">
          <div className="h-8 w-8 rounded-full bg-slate-700 mx-auto" />
          <div className="h-4 w-1/2 rounded bg-slate-700 mx-auto" />
          <div className="h-3 w-3/4 rounded bg-slate-800 mx-auto" />
        </div>
      )}

      {status === 'ok' && (
        <div className="rounded-xl bg-[#131B2E] border border-slate-800 p-6 text-center">
          <CheckCircle2 size={30} className="text-[#34D399] mx-auto mb-3" />
          <p className="text-slate-200 font-medium">Email confirmed</p>
          <p className="text-slate-500 text-sm mt-1">You can now buy, sell and withdraw.</p>
          <Link to={loggedIn ? '/home' : '/login'} className={linkBtn}>
            {loggedIn ? 'Continue' : 'Go to login'}
          </Link>
        </div>
      )}

      {status === 'bad' && (
        <div className="rounded-xl bg-[#131B2E] border border-slate-800 p-6 text-center">
          <XCircle size={30} className="text-[#F87171] mx-auto mb-3" />
          <p className="text-slate-200 font-medium">{error || 'This link is invalid or has expired'}</p>
          <p className="text-slate-500 text-sm mt-1">Log in, then tap "Send me the email again" at the top of the page.</p>
          <Link to={loggedIn ? '/home' : '/login'} className={linkBtn}>
            {loggedIn ? 'Go to my account' : 'Go to login'}
          </Link>
        </div>
      )}
    </AuthShell>
  );
}