// KV-SEC-VERIFY: shown at the top of every page to NEW users who have not confirmed their email yet
import { useState } from 'react';
import { MailWarning } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { api } from '../lib/api';

export default function EmailBanner() {
  const { profile, refreshProfile } = useAuth();
  const { pathname } = useLocation();
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  if (!profile || profile.email_unverified !== true || pathname === '/verify-email') return null;

  async function resend() {
    setSending(true);
    setError('');
    setNote('');
    try {
      await api.post('/auth/resend-verification');
      setNote('Sent. Check your inbox and your spam folder.');
    } catch (e) {
      setError(e.message);
    }
    setSending(false);
  }

  async function check() {
    setChecking(true);
    setError('');
    setNote('');
    try {
      await refreshProfile();
      setNote('Not confirmed yet. Tap the link in the email first.');
    } catch (e) {
      setError(e.message);
    }
    setChecking(false);
  }

  const btn = 'w-full sm:w-auto flex items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold disabled:opacity-60 transition-colors';

  return (
    <div className="bg-[#F59E0B]/10 border-b border-[#F59E0B]/40 px-4 py-3">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          <MailWarning size={18} className="text-[#F59E0B] mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm text-slate-200">Confirm your email to buy, sell or withdraw.</p>
            <p className="text-xs text-slate-400 break-all">We sent a link to {profile.email}.</p>
            {note && <p className="text-xs text-[#34D399] mt-1">{note}</p>}
            {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button onClick={resend} disabled={sending} className={btn + ' bg-[#F59E0B] hover:bg-[#d98a06] text-[#0B1120]'}>
            {sending ? 'Sending...' : 'Send me the email again'}
          </button>
          <button onClick={check} disabled={checking} className={btn + ' border border-slate-600 text-slate-300 hover:border-slate-400'}>
            {checking ? 'Checking...' : 'I have confirmed it'}
          </button>
        </div>
      </div>
    </div>
  );
}