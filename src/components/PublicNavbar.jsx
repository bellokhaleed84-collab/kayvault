import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Menu, X } from 'lucide-react';
import Logo from './Logo';
import NotificationBell from './NotificationBell';
import { useAuth } from '../lib/AuthContext';

const BASE_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Browse', to: '/browse' },
  { label: 'How It Works', to: '/#how-it-works' },
  { label: 'Sell', to: '/signup' },
  { label: 'About', to: '/#about' },
];

function NavLink({ to, children, className }) {
  return to.startsWith('/#') ? (
    <a href={to} className={className}>{children}</a>
  ) : (
    <Link to={to} className={className}>{children}</Link>
  );
}

export default function PublicNavbar({ overlay = false }) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);

  const dash = profile?.is_admin
    ? '/admin'
    : profile?.role === 'seller'
    ? '/dashboard/seller'
    : '/dashboard/buyer';

  const link = 'text-sm text-slate-400 hover:text-slate-100 transition-colors';
  const LINKS = BASE_LINKS
    .filter((l) => !profile || (!l.to.startsWith('/#') && l.label !== 'Sell'))
    .map((l) => (profile && l.label === 'Home' ? { ...l, to: '/home' } : l));

  return (
    <header className={overlay ? 'absolute inset-x-0 top-0 z-40 bg-gradient-to-b from-[#0B1120]/85 to-transparent' : 'border-b border-slate-800/80 bg-[#0B1120]/80 backdrop-blur sticky top-0 z-40'}>
      {/* KV-NAV-OVERLAY */}
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/"><Logo /></Link>

        <nav className="hidden md:flex items-center gap-7">
          {LINKS.map((l) => (
            <NavLink key={l.label} to={l.to} className={link}>{l.label}</NavLink>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {profile && <NotificationBell />}
          <button aria-label="Search" className="text-slate-400 hover:text-slate-100 p-2">
            <Search size={17} />
          </button>
          {profile ? (
            <Link to={dash} className="text-sm bg-[#D4A94B] hover:bg-[#c49a3f] text-[#0B1120] font-semibold rounded-lg px-4 py-2 transition-colors">
              Dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-sm border border-[#D4A94B]/60 text-[#D4A94B] hover:bg-[#D4A94B]/10 font-semibold rounded-lg px-4 py-2 transition-colors">
                Login
              </Link>
              <Link to="/signup" className="text-sm bg-[#D4A94B] hover:bg-[#c49a3f] text-[#0B1120] font-semibold rounded-lg px-4 py-2 transition-colors">
                Sign Up
              </Link>
            </>
          )}
        </div>

        <button className="md:hidden text-slate-300" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-slate-800 px-6 py-4 space-y-3 bg-[#0B1120]">
          {LINKS.map((l) => (
            <NavLink key={l.label} to={l.to} className={`block ${link}`}>{l.label}</NavLink>
          ))}
          <div className="flex gap-3 pt-2">
            {profile ? (
              <Link to={dash} className="flex-1 text-center text-sm bg-[#D4A94B] text-[#0B1120] font-semibold rounded-lg py-2">Dashboard</Link>
            ) : (
              <>
                <Link to="/login" className="flex-1 text-center text-sm border border-[#D4A94B]/60 text-[#D4A94B] font-semibold rounded-lg py-2">Login</Link>
                <Link to="/signup" className="flex-1 text-center text-sm bg-[#D4A94B] text-[#0B1120] font-semibold rounded-lg py-2">Sign Up</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}