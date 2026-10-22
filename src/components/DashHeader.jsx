import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Search, Settings } from 'lucide-react';
import Logo from './Logo';
import NotificationBell from './NotificationBell';
import { useAuth } from '../lib/AuthContext';

// Top bar for logged-in dashboard pages
export default function DashHeader() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const link = 'flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-slate-100 transition-colors';

  return (
    <header className="border-b border-slate-800 bg-[#0B1120]/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/"><Logo /></Link>
        <div className="flex items-center gap-5">
          <Link to="/browse" className={link}><Search size={14} /> Browse</Link>
          <NotificationBell />
          <Link to="/settings" className={link}><Settings size={14} /> Settings</Link>
          <span className="hidden sm:inline text-sm text-slate-500">Hi, {profile?.full_name?.split(' ')[0]}</span>
          <button
            onClick={async () => { await signOut(); navigate('/'); }}
            className={link}
          >
            <LogOut size={14} /> Log out
          </button>
        </div>
      </div>
    </header>
  );
}