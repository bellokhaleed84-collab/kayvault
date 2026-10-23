// KV-LANDING v1
import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  ShieldCheck, BadgeCheck, Zap, Headphones, Search, CreditCard, PackageCheck,
  Banknote, Lock, UserCheck, Globe2, Send, ArrowRight,
} from 'lucide-react';
import PublicNavbar from '../components/PublicNavbar';
import Footer from '../components/Footer';
import { useAuth } from '../lib/AuthContext';

const TRUST = [
  { icon: ShieldCheck, title: 'Secure Escrow', sub: 'Protection' },
  { icon: BadgeCheck, title: 'Verified Sellers', sub: '& Buyers' },
  { icon: Zap, title: 'Fast & Easy', sub: 'Transactions' },
  { icon: Headphones, title: '24/7 Support', sub: 'Always here' },
];

const WHY = [
  { icon: Lock, title: 'Secure Escrow', desc: 'Your money is safe until you confirm.' },
  { icon: UserCheck, title: 'Verified Accounts', desc: 'Real sellers, real accounts.' },
  { icon: Headphones, title: '24/7 Support', desc: "We're always here to help." },
  { icon: Globe2, title: 'Global Access', desc: 'Buy and sell from anywhere in Africa.' },
];

const STEPS = [
  { icon: Search, title: 'Browse & Choose', desc: 'Find the perfect account from verified sellers.' },
  { icon: CreditCard, title: 'Pay Securely', desc: 'Your payment is held safely in escrow.' },
  { icon: PackageCheck, title: 'Receive & Confirm', desc: 'Get the account details and confirm it works.' },
  { icon: Banknote, title: 'Funds Released', desc: 'The seller gets paid once you confirm.' },
];

function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#0B1120]">
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          backgroundImage: "url('/landing-bg.png')",
          backgroundSize: 'cover',
          backgroundPosition: '70% center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      <div className="absolute inset-0 bg-[#0B1120]/65 md:hidden" aria-hidden="true" />
      <div
        className="absolute inset-0 hidden md:block"
        aria-hidden="true"
        style={{ background: 'linear-gradient(90deg, #0B1120 0%, #0B1120 22%, rgba(11,17,32,0.6) 45%, rgba(11,17,32,0) 70%)' }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-40"
        aria-hidden="true"
        style={{ background: 'linear-gradient(180deg, rgba(11,17,32,0), #0B1120)' }}
      />

      <div className="relative max-w-6xl mx-auto px-6 min-h-[560px] md:min-h-[660px] flex flex-col justify-center pt-28 pb-10">
        <div className="max-w-xl">
          <p className="font-mono text-xs text-[#D4A94B] mb-5">ESCROW-PROTECTED GAMING MARKETPLACE</p>
          <h1 className="font-display text-4xl md:text-6xl font-bold text-slate-100 leading-[1.08]">
            Buy &amp; Sell<br />Gaming Accounts<br />
            <span className="text-[#D4A94B] inline-flex items-center gap-3">
              Safely <ShieldCheck size={40} strokeWidth={1.75} />
            </span>
          </h1>
          <p className="text-slate-300 mt-6 max-w-md leading-relaxed">
            KayVault is the trusted marketplace for buying and selling gaming accounts.
            Protect every deal with escrow and game with confidence.
          </p>
          <div className="mt-9">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 bg-[#D4A94B] hover:bg-[#c49a3f] text-[#0B1120] font-semibold rounded-lg px-8 py-3.5 text-base transition-colors"
            >
              Get started <ArrowRight size={18} />
            </Link>
            <p className="text-xs text-slate-500 mt-3">Free to join. Your money stays in escrow until you confirm.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16">
          {TRUST.map(({ icon: Icon, title, sub }) => (
            <div key={title} className="flex items-center gap-3">
              <Icon size={20} className="text-[#D4A94B]" strokeWidth={1.75} />
              <div className="leading-tight">
                <p className="text-sm text-slate-200 font-medium">{title}</p>
                <p className="text-xs text-slate-500">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SectionTitle({ children, sub }) {
  return (
    <div className="mb-8">
      <h2 className="font-display text-2xl md:text-3xl font-semibold text-slate-100">{children}</h2>
      {sub && <p className="text-slate-500 text-sm mt-1.5">{sub}</p>}
    </div>
  );
}

function Newsletter() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  return (
    <div className="rounded-2xl bg-[#131B2E] border border-slate-800 p-8">
      <h3 className="font-display text-xl font-semibold text-slate-100">Stay Updated</h3>
      <p className="text-slate-500 text-sm mt-1 mb-5">
        Get the latest deals and offers straight to your inbox.
      </p>
      {sent ? (
        <p className="text-[#34D399] text-sm font-medium">You're on the list. We'll email you at launch.</p>
      ) : (
        <form
          onSubmit={(e) => { e.preventDefault(); if (email) setSent(true); }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <input
            required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address"
            className="flex-1 bg-[#0D1524] border border-slate-800 rounded-lg px-4 py-3 text-slate-200 text-sm focus:outline-none focus:border-[#D4A94B] transition-colors"
          />
          <button type="submit" className="flex items-center justify-center gap-2 bg-[#D4A94B] hover:bg-[#c49a3f] text-[#0B1120] font-semibold rounded-lg px-5 py-3 text-sm transition-colors">
            <Send size={15} /> Subscribe
          </button>
        </form>
      )}
    </div>
  );
}

// The public marketing page. Signed-in people go to /home instead.
export default function LandingPage() {
  const { profile, loading } = useAuth();

  if (loading) return <div className="min-h-screen bg-[#0B1120]" />;
  if (profile) return <Navigate to="/home" replace />;

  return (
    <div className="relative min-h-screen bg-[#0B1120] text-slate-200">
      <PublicNavbar overlay />
      <Hero />

      <section className="max-w-6xl mx-auto px-6 py-14">
        <SectionTitle>Why Choose KayVault?</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {WHY.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-xl bg-[#131B2E] border border-slate-800 p-5 flex gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#0D1524] border border-slate-800 flex items-center justify-center shrink-0">
                <Icon size={18} className="text-[#D4A94B]" strokeWidth={1.75} />
              </div>
              <div>
                <h3 className="font-display text-slate-100 font-semibold text-sm mb-1">{title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-14">
        <SectionTitle sub="Four steps. Your money never reaches the seller until you say so.">
          How It Works
        </SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {STEPS.map(({ icon: Icon, title, desc }, i) => (
            <div key={title} className="rounded-xl bg-[#131B2E] border border-slate-800 p-5">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-7 h-7 rounded-full border border-[#D4A94B]/60 text-[#D4A94B] font-mono text-xs flex items-center justify-center">
                  {i + 1}
                </span>
                <Icon size={20} className="text-[#D4A94B]" strokeWidth={1.75} />
              </div>
              <h3 className="font-display text-slate-100 font-semibold mb-1.5">{title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="about" className="max-w-6xl mx-auto px-6 py-14 grid lg:grid-cols-2 gap-6">
        <div
          className="rounded-2xl border border-slate-800 p-8 flex flex-col justify-between"
          style={{ background: 'linear-gradient(135deg, #131B2E 0%, #1B1A2E 60%, rgba(201,161,90,0.18) 100%)' }}
        >
          <div>
            <h3 className="font-display text-2xl font-semibold text-slate-100">Become a Seller</h3>
            <p className="text-slate-400 text-sm mt-2 max-w-sm">
              Turn your gaming skills and accounts into cash. Create a free account, list your gaming accounts, and get paid through escrow.
            </p>
          </div>
          <div className="mt-8">
            <Link to="/signup" className="inline-block bg-[#D4A94B] hover:bg-[#c49a3f] text-[#0B1120] font-semibold rounded-lg px-6 py-3 text-sm transition-colors">
              Start Selling
            </Link>
          </div>
        </div>
        <div className="rounded-2xl bg-[#131B2E] border border-slate-800 p-8 flex flex-col justify-between">
          <div>
            <h3 className="font-display text-xl font-semibold text-slate-100">Have questions?</h3>
            <p className="text-slate-500 text-sm mt-1">Read how escrow, refunds and payouts work before you buy or sell.</p>
          </div>
          <div className="mt-6">
            <Link to="/help" className="inline-block border border-[#D4A94B]/60 text-[#D4A94B] hover:bg-[#D4A94B]/10 font-semibold rounded-lg px-6 py-3 text-sm transition-colors">Visit the Help Center</Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
