import { useState } from 'react';
import { User, Mail, Globe, Gamepad2, ShoppingBag, Upload, Check } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { COUNTRIES, SELLER_COUNTRY, flag } from '../lib/countries';
import AuthShell from '../components/AuthShell';
import { Field, PasswordField, GoldButton } from '../components/AuthFields';
import signupBg from '../assets/signup-bg.jpg';
import { api } from '../lib/api'; // KV-P17D-IMP
import { fileToJpeg } from '../components/KycPanel';

export default function Signup() {
  const [role, setRole] = useState('buyer');
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', country: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false); // KV-P17B-STATE
  const [idType, setIdType] = useState('nin'); // KV-P17D-STATE
  const [idFile, setIdFile] = useState(null);
  const [selfie, setSelfie] = useState(null);
  const navigate = useNavigate();
  const { signup, refreshProfile } = useAuth(); // KV-P17D-AUTH

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) return setError("Passwords don't match");
    if (form.password.length < 8) return setError('Password must be at least 8 characters');
    if (!agreed) return setError('Please accept the Terms of Service and Privacy Policy to continue.'); // KV-P17B-CHECK
    if (role === 'seller' && (!idFile || !selfie)) return setError('Sellers must add a photo of their ID and a selfie.'); // KV-P17D-CHECK
    if (role === 'seller' && form.country !== SELLER_COUNTRY) return setError('Sellers must be in Nigeria. Switch to Buyer to join from another country.'); // KV-SIGNUP-NG

    setLoading(true);
    try {
      let kyc = null; // KV-P17D-PREP
      if (role === 'seller') kyc = { id_type: idType, id_image: await fileToJpeg(idFile), selfie: await fileToJpeg(selfie) };
      await signup({
        name: form.name, email: form.email, password: form.password,
        country: form.country, role, accepted_terms: true, // KV-P17B-SEND
      });
      if (kyc) { // KV-P17D-UPLOAD
        try {
          await api.post('/kyc', kyc);
          await refreshProfile();
          navigate('/dashboard/seller');
        } catch {
          navigate('/settings?tab=verification');
        }
        return;
      }
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

        {role === 'seller' && <p className="text-xs text-slate-500">Sellers must be in Nigeria. Buyers can join from Nigeria, Ghana, Kenya, South Africa and C&ocirc;te d&#39;Ivoire.</p>} {/* KV-SIGNUP-HINT */}
        {role === 'seller' && (
          <div className="rounded-xl border border-slate-800 bg-[#0D1524]/50 p-4 space-y-4">
            {/* KV-P17D-BLOCK */}
            <div>
              <p className="text-sm text-slate-200 font-medium">Verify your identity</p>
              <p className="text-xs text-slate-500 mt-1">Sellers must send an ID and a selfie. Only our team sees them, and they are deleted 14 days after review.</p>
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-500 mb-2">ID TYPE</label>
              <select value={idType} onChange={(e) => setIdType(e.target.value)}
                className="w-full bg-[#0D1524] border border-slate-800 rounded-lg px-3.5 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-[#D4A94B] transition-colors">
                <option value="nin">National ID (NIN slip or card)</option>
                <option value="drivers_licence">Driver&#39;s licence</option>
                <option value="passport">International passport</option>
              </select>
            </div>
            {[
              ['PHOTO OF YOUR ID', idFile, setIdFile, 'Choose a clear photo of the front of your ID'],
              ['SELFIE', selfie, setSelfie, 'Choose a selfie of your face, in good light'],
            ].map(([title, file, setFile, hint]) => (
              <div key={title}>
                <label className="block text-xs font-mono text-slate-500 mb-2">{title}</label>
                <label className="flex items-center gap-3 cursor-pointer rounded-lg border border-dashed border-slate-700 hover:border-[#D4A94B] bg-[#0D1524] px-4 py-3 transition-colors">
                  {file ? <Check size={16} className="text-[#34D399] shrink-0" /> : <Upload size={16} className="text-slate-500 shrink-0" />}
                  <span className="text-sm text-slate-300 truncate">{file ? file.name : hint}</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] || null)} />
                </label>
              </div>
            ))}
          </div>
        )}
        {/* KV-P17B-BOX */}
        <label className="flex items-start gap-2.5 text-xs text-slate-400 cursor-pointer select-none">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="accent-[#D4A94B] w-4 h-4 mt-0.5 shrink-0" />
          <span>
            I am 18 or older and I agree to the{' '}
            <Link to="/terms" target="_blank" className="text-[#D4A94B] hover:underline">Terms of Service</Link>
            {' '}and{' '}
            <Link to="/privacy" target="_blank" className="text-[#D4A94B] hover:underline">Privacy Policy</Link>.
          </span>
        </label>
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