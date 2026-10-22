import { useState } from 'react';
import { Mail } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { safeFrom } from '../lib/redirect'; // KV-LOGIN-IMPORT
import { useAuth } from '../lib/AuthContext';
import AuthShell from '../components/AuthShell';
import { Field, PasswordField, GoldButton } from '../components/AuthFields';
import loginBg from '../assets/login-bg.jpg';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation(); // KV-LOGIN-FROM
  const { login } = useAuth();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const u = await login(form.email, form.password, remember);
      const back = safeFrom(location.state && location.state.from); // KV-LOGIN-GO
      if (back) navigate(back, { replace: true });
      else if (u.is_admin) navigate('/admin');
      else navigate('/home');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      image={loginBg}
      title={<>Your Next<br />Win Awaits</>}
      subtitle="Buy and sell gaming accounts with confidence."
    >
      <h1 className="font-display text-3xl font-semibold text-slate-100 mb-1">Welcome Back</h1>
      <p className="text-slate-500 text-sm mb-8">Sign in to your account to continue.</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field
          label="EMAIL ADDRESS" icon={Mail} required type="email" name="email"
          value={form.email} onChange={handleChange} placeholder="you@example.com"
        />
        <PasswordField
          required name="password" value={form.password} onChange={handleChange}
          placeholder="Enter your password"
        />

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)}
              className="accent-[#D4A94B] w-4 h-4"
            />
            Remember me
          </label>
          <Link to="/forgot-password" className="text-sm text-[#D4A94B] hover:underline">
            Forgot password?
          </Link>
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <GoldButton type="submit" loading={loading}>{loading ? 'Logging in...' : 'Login'}</GoldButton>
      </form>

      <p className="text-center text-sm text-slate-500 mt-8">
        Don't have an account?{' '}
        <Link to="/signup" className="text-[#D4A94B] hover:underline">Sign up</Link>
      </p>
    </AuthShell>
  );
}