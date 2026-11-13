import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom'; // KV-P17-NAVIMP
import { Search, Menu, X } from 'lucide-react';
import Logo from './Logo';
import NotificationBell from './NotificationBell';
import { useAuth } from '../lib/AuthContext';

const BASE_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Browse', to: '/browse' },
  { label: 'Top-Up', to: '/topup' },
  { label: 'How It Works', to: '/#how-it-works' },
  { label: 'Sell', to: '/signup' },
  { label: 'About', to: '/#about' },
];

function NavLink({ to, children, className, onClick }) {
  return to.startsWith('/#') ? (
    <a href={to} className={className} onClick={onClick}>{children}</a>
  ) : (
    <Link to={to} className={className} onClick={onClick}>{children}</Link>
  );
}

// minimal hides the Browse and Top-Up links (used on the logged-in home page, which has its own sections for them)
// KV-MOBILE v1: on a phone the links sit in a menu with big tap targets
export default function PublicNavbar({ overlay = false, minimal = false }) {
  const { profile } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false); const navigate = useNavigate(); // KV-P17-NAVHOOK

  useEffect(() => { setOpen(false); }, [location.pathname]);

  const dash = profile?.is_admin
    ? '/admin'
    : profile?.role === 'seller'
    ? '/dashboard/seller'
    : '/dashboard/buyer';

  const link = 'text-sm text-slate-400 hover:text-slate-100 transition-colors';
  const LINKS = BASE_LINKS
    .filter((l) => l.label !== 'Top-Up' || !profile || profile.role === 'buyer') // KV-EYAD: top-up is for buyers
    .filter((l) => !minimal || (l.label !== 'Browse' && l.label !== 'Top-Up'))
    .filter((l) => !profile || (!l.to.startsWith('/#') && l.label !== 'Sell'))
    .map((l) => (profile && l.label === 'Home' ? { ...l, to: '/home' } : l));

  return (
    <header className={overlay ? 'absolute inset-x-0 top-0 z-40 bg-gradient-to-b from-[#0B1120]/85 to-transparent' : 'border-b border-slate-800/80 bg-[#0B1120]/90 backdrop-blur sticky top-0 z-40'}>
      {/* KV-NAV-OVERLAY */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between">
        <Link to="/"><Logo /></Link>

        <nav className="hidden md:flex items-center gap-7">
          {LINKS.map((l) => (
            <NavLink key={l.label} to={l.to} className={link}>{l.label}</NavLink>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {profile && <NotificationBell />}
          <button aria-label="Search" onClick={() => navigate('/browse')} className="text-slate-400 hover:text-slate-100 p-2">
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

        <div className="md:hidden flex items-center gap-1">
          {profile && <NotificationBell />}
          <button
            className="w-11 h-11 flex items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800/60"
            onClick={() => setOpen(!open)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {open && (
        <>
          <div className="md:hidden fixed inset-x-0 bottom-0 top-14 bg-black/50" onClick={() => setOpen(false)} />
          <div className="md:hidden absolute top-full inset-x-0 bg-[#0B1120] border-b border-slate-800 shadow-2xl px-4 pt-3 pb-4">
            <nav className="space-y-1">
              {LINKS.map((l) => (
                <NavLink
                  key={l.label}
                  to={l.to}
                  onClick={() => setOpen(false)}
                  className={`block rounded-lg px-3 py-3.5 text-[15px] transition-colors ${
                    location.pathname === l.to ? 'bg-[#D4A94B]/15 text-[#D4A94B]' : 'text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>
            <div className="flex gap-3 pt-4">
              {profile ? (
                <Link to={dash} className="flex-1 text-center bg-[#D4A94B] text-[#0B1120] font-semibold rounded-xl py-3.5 text-[15px]">Dashboard</Link>
              ) : (
                <>
                  <Link to="/login" className="flex-1 text-center border border-[#D4A94B]/60 text-[#D4A94B] font-semibold rounded-xl py-3.5 text-[15px]">Login</Link>
                  <Link to="/signup" className="flex-1 text-center bg-[#D4A94B] text-[#0B1120] font-semibold rounded-xl py-3.5 text-[15px]">Sign Up</Link>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </header>
  );
}