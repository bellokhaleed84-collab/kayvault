import { Link } from 'react-router-dom';
import { ShieldCheck, Mail, MessageCircle, Globe } from 'lucide-react';
import Logo from './Logo';

export default function Footer() {
  const h = 'text-xs font-mono text-slate-500 mb-4';
  const a = 'block text-sm text-slate-400 hover:text-slate-100 transition-colors mb-2.5';
  return (
    <footer className="border-t border-slate-800 bg-[#0B1120]">
      <div className="max-w-6xl mx-auto px-6 py-14 grid grid-cols-2 md:grid-cols-5 gap-10">
        <div className="col-span-2">
          <Logo />
          <p className="text-sm text-slate-500 mt-4 max-w-xs">
            The safest place to buy and sell gaming accounts.
          </p>
        </div>
        <div>
          <p className={h}>QUICK LINKS</p>
          <Link to="/" className={a}>Home</Link>
          <Link to="/browse" className={a}>Browse</Link>
          <a href="/#how-it-works" className={a}>How It Works</a>
          <Link to="/signup" className={a}>Sell</Link>
        </div>
        <div>
          <p className={h}>SUPPORT</p>
          <a href="#" className={a}>Help Center</a>
          <a href="#" className={a}>Terms of Service</a>
          <a href="#" className={a}>Privacy Policy</a>
          <a href="#" className={a}>FAQ</a>
        </div>
        <div>
          <p className={h}>FOLLOW US</p>
          <div className="flex gap-3 mb-6">
            {[Mail, MessageCircle, Globe].map((Icon, i) => (
              <a key={i} href="#" className="w-8 h-8 rounded-full border border-slate-800 flex items-center justify-center text-slate-400 hover:text-[#D4A94B] hover:border-[#D4A94B]/50 transition-colors">
                <Icon size={14} />
              </a>
            ))}
          </div>
          <p className={h}>SECURE PAYMENTS</p>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <ShieldCheck size={16} className="text-[#D4A94B]" /> Escrow Protection
          </div>
        </div>
      </div>
      <div className="border-t border-slate-800 py-6 text-center">
        <p className="font-mono text-xs text-slate-600">&copy; 2026 KayVault. All rights reserved.</p>
      </div>
    </footer>
  );
}