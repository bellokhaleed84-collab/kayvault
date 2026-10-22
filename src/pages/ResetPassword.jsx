import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import AuthShell from '../components/AuthShell';
import { PasswordField, GoldButton } from '../components/AuthFields';
import loginBg from '../assets/login-bg.jpg';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('Password must be at least 8 characters');
    if (password !== confirm) return setError("Passwords don't match");
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <AuthShell image={loginBg} title={<>A fresh start.</>} subtitle="Choose a strong new password for your account.">
      <h1 className="font-display text-3xl font-semibold text-slate-100 mb-1">Set a new password</h1>
      <p className="text-slate-500 text-sm mb-8">Pick something you haven't used before.</p>

      {done ? (
        <div className="rounded-xl bg-[#131B2E] border border-slate-800 p-6 text-center">
          <CheckCircle2 size={30} className="text-[#34D399] mx-auto mb-3" />
          <p className="text-slate-200 font-medium">Password updated</p>
          <Link to="/login" className="inline-block mt-4 bg-[#D4A94B] hover:bg-[#c49a3f] text-[#0B1120] font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors">
            Go to login
          </Link>
        </div>
      ) : !token ? (
        <p className="text-red-400 text-sm">This reset link is missing its token. Request a new one from the login page.</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <PasswordField label="NEW PASSWORD" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
          <PasswordField label="CONFIRM NEW PASSWORD" required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat your password" />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <GoldButton type="submit" loading={loading}>{loading ? 'Saving...' : 'Update password'}</GoldButton>
        </form>
      )}
    </AuthShell>
  );
}