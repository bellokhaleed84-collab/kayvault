import { useState } from 'react';
import { User, Mail, Globe, Gamepad2, ShoppingBag } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { COUNTRIES, flag } from '../lib/countries';
import AuthShell from '../components/AuthShell';
import { Field, PasswordField, GoldButton } from '../components/AuthFields';
import signupBg from '../assets/signup-bg.jpg';

export default function Signup() {
  const [role, setRole] = useState('buyer');
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', country: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { signup } = useAuth();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) return setError("Passwords don't match");
    if (form.password.length < 8) return setError('Password must be at least 8 characters');

    setLoading(true);
    try {
      await signup({
        name: form.name, email: form.email, password: form.password,
        country: form.country, role,
      });
      navigate('/home');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const roleBtn = (value, Icon, label) => (
    <button
      type="button"
      onClick={() => setRole(value)}
      className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
        role === value ? 'bg-[#D4A94B] text-[#0B1120]' : 'text-slate-400 hover:text-slate-200'
      }`}
    >
      <Icon size={16} /> {label}
    </button>
  );

  return (
    <AuthShell
      image={signupBg}
      title={<>Real Gamers.<br />Real Accounts.<br />Trusted.</>}
      subtitle="Join KayVault and start buying or selling gaming accounts today."
    >
      <h1 className="font-display text-3xl font-semibold text-slate-100 mb-1">Create Your Account</h1>
      <p className="text-slate-500 text-sm mb-6">Join KayVault and start buying or selling gaming accounts today.</p>

      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#0D1524] border border-slate-800 mb-6">
        {roleBtn('buyer', ShoppingBag, 'Buyer')}
        {roleBtn('seller', Gamepad2, 'Seller')}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="FULL NAME" icon={User} required name="name" value={form.name}
          onChange={handleChange} placeholder="Enter your full name"
        />
        <Field
          label="EMAIL ADDRESS" icon={Mail} required type="email" name="email"
          value={form.email} onChange={handleChange} placeholder="you@example.com"
        />
        <PasswordField
          required name="password" value={form.password} onChange={handleChange}
          placeholder="Create a strong password"
        />
        <PasswordField
          label="CONFIRM PASSWORD" required name="confirm" value={form.confirm}
          onChange={handleChange} placeholder="Repeat your password"
        />

        <div>
          <label className="block text-xs font-mono text-slate-500 mb-2">COUNTRY</label>
          <div className="relative">
            <Globe size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
            <select
              required name="country" value={form.country} onChange={handleChange}
              className="w-full bg-[#0D1524] border border-slate-800 rounded-lg pl-10 pr-3.5 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-[#D4A94B] transition-colors appearance-none"
            >
              <option value="" disabled>Select your country</option>
              {COUNTRIES.map(([name, code]) => (
                <option key={code} value={name}>{flag(code)} {name}</option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <GoldButton type="submit" loading={loading}>
          {loading ? 'Creating account...' : 'Create Account'}
        </GoldButton>
      </form>

      <p className="text-center text-sm text-slate-500 mt-6">
        Already have an account?{' '}
        <Link to="/login" className="text-[#D4A94B] hover:underline">Login</Link>
      </p>
    </AuthShell>
  );
}