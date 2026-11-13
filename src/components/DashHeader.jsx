import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Search, Settings, Gamepad2, Coins, Menu, X, LayoutDashboard } from 'lucide-react';
import Logo from './Logo';
import NotificationBell from './NotificationBell';
import { useAuth } from '../lib/AuthContext';

// KV-MOBILE v1: top bar for logged-in pages. On a phone the links move into a menu.
export default function DashHeader() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [location.pathname]);

  const isBuyer = profile?.role === 'buyer' && !profile?.is_admin;
  const dash = profile?.is_admin ? '/admin' : profile?.role === 'seller' ? '/dashboard/seller' : profile?.role === 'buyer' ? '/dashboard/buyer' : null;
  const items = [
    ...(dash ? [[dash, isBuyer ? 'My Purchases' : 'Dashboard', LayoutDashboard]] : []),
    ['/browse', 'Browse', Search],
    ...(profile?.role === 'buyer' ? [['/topup', 'Top-up', Gamepad2]] : []),
    ...(profile?.is_admin ? [['/admin/topups', 'Top-ups', Coins]] : []),
    ['/settings', 'Settings', Settings],
  ];

  async function logout() {
    await signOut();
    navigate('/');
  }

  const link = 'flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-slate-100 transition-colors';
  const first = profile?.full_name?.split(' ')[0];

  return (
    <header className="border-b border-slate-800 bg-[#0B1120]/90 backdrop-blur sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between">
        <Link to="/"><Logo /></Link>

        <div className="flex items-center gap-1 md:gap-5">
          <nav className="hidden md:flex items-center gap-5">
            {items.map(([to, text, Icon]) => (
              <Link key={to} to={to} className={link}><Icon size={14} /> {text}</Link>
            ))}
          </nav>

          <NotificationBell />

          <div className="hidden md:flex items-center gap-5">
            {first && <span className="text-sm text-slate-500">Hi, {first}</span>}
            <button onClick={logout} className={link}><LogOut size={14} /> Log out</button>
          </div>

          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            className="md:hidden w-11 h-11 flex items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800/60"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {open && (
        <>
          <div className="md:hidden fixed inset-x-0 bottom-0 top-14 bg-black/50" onClick={() => setOpen(false)} />
          <div className="md:hidden absolute top-full inset-x-0 bg-[#0B1120] border-b border-slate-800 shadow-2xl px-4 pt-3 pb-4">
            {first && <p className="px-3 pb-2 text-xs font-mono text-slate-500">HI, {first.toUpperCase()}</p>}
            <nav className="space-y-1">
              {items.map(([to, text, Icon]) => {
                const active = location.pathname === to;
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`flex items-center gap-3 rounded-lg px-3 py-3.5 text-[15px] transition-colors ${
                      active ? 'bg-[#8B5CF6]/15 text-[#8B5CF6]' : 'text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon size={18} /> {text}
                  </Link>
                );
              })}
            </nav>
            <button
              onClick={logout}
              className="mt-3 w-full flex items-center justify-center gap-2 rounded-lg border border-slate-700 text-slate-300 hover:border-slate-500 py-3.5 text-[15px] transition-colors"
            >
              <LogOut size={17} /> Log out
            </button>
          </div>
        </>
      )}
    </header>
  );
}