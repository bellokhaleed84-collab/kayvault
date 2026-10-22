import { useState } from 'react';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import AuthShell from '../components/AuthShell';
import { Field, GoldButton } from '../components/AuthFields';
import loginBg from '../assets/login-bg.jpg';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <AuthShell image={loginBg} title={<>Locked out?<br />We've got you.</>} subtitle="Reset your password and get back in the game.">
      <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 mb-6">
        <ArrowLeft size={14} /> Back to login
      </Link>
      <h1 className="font-display text-3xl font-semibold text-slate-100 mb-1">Forgot password?</h1>
      <p className="text-slate-500 text-sm mb-8">Enter your email and we'll send you a reset link.</p>

      {sent ? (
        <div className="rounded-xl bg-[#131B2E] border border-slate-800 p-6 text-center">
          <CheckCircle2 size={30} className="text-[#34D399] mx-auto mb-3" />
          <p className="text-slate-200 font-medium">Check your email</p>
          <p className="text-slate-500 text-sm mt-1">
            If an account exists for {email}, a reset link is on its way. It expires in 1 hour.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <Field
            label="EMAIL ADDRESS" icon={Mail} required type="email" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
          />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <GoldButton type="submit" loading={loading}>{loading ? 'Sending...' : 'Send reset link'}</GoldButton>
        </form>
      )}
    </AuthShell>
  );
}