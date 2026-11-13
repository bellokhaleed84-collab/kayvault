import { Link } from 'react-router-dom';
import Logo from './Logo';

// KV-MOBILE v1: on a phone the artwork is a short banner above the form. On a computer it stays a split screen.
// Swap the artwork by replacing src/assets/login-bg.jpg and signup-bg.jpg.
export default function AuthShell({ children, image, title, subtitle }) {
  const art = image
    ? `linear-gradient(to top, rgba(11,17,32,0.96) 8%, rgba(11,17,32,0.45) 60%, rgba(11,17,32,0.7) 100%), url(${image})`
    : 'radial-gradient(ellipse at 70% 20%, rgba(124,58,237,0.35), transparent 60%), linear-gradient(135deg, #131B2E, #0B1120)';

  return (
    <div className="min-h-screen bg-[#0B1120] grid lg:grid-cols-2">
      <div className="flex flex-col">
        <div
          className="lg:hidden flex flex-col justify-between gap-5 px-5 pt-5 pb-5 border-b border-slate-800"
          style={{ background: art, backgroundSize: 'cover', backgroundPosition: 'center' }}
        >
          <Link to="/" className="self-start"><Logo /></Link>
          <h2 className="font-display text-xl font-bold text-slate-100 leading-tight">{title}</h2>
        </div>

        <div className="flex-1 flex flex-col px-5 sm:px-12 pt-7 pb-10 lg:py-8">
          <Link to="/" className="self-start hidden lg:block"><Logo /></Link>
          <div className="flex-1 flex lg:items-center lg:py-10">
            <div className="w-full max-w-md mx-auto">{children}</div>
          </div>
        </div>
      </div>

      <div
        className="hidden lg:flex relative items-end p-14 border-l border-slate-800 bg-cover bg-center"
        style={{ background: art, backgroundSize: 'cover', backgroundPosition: 'center' }}
      >
        <div>
          <h2 className="font-display text-4xl font-bold text-slate-100 leading-tight mb-3">{title}</h2>
          <p className="text-slate-400 max-w-sm">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}