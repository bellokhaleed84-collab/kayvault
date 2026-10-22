import { useState } from 'react';
import { Eye, EyeOff, KeyRound } from 'lucide-react';

export function Field({ label, icon: Icon, right, trailing, ...props }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-xs font-mono text-slate-500">{label}</label>
        {right}
      </div>
      <div className="relative">
        {Icon && <Icon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" />}
        <input
          {...props}
          className={`w-full bg-[#0D1524] border border-slate-800 rounded-lg ${Icon ? 'pl-10' : 'pl-3.5'} ${
            trailing ? 'pr-10' : 'pr-3.5'
          } py-2.5 text-slate-200 text-sm focus:outline-none focus:border-[#D4A94B] transition-colors`}
        />
        {trailing}
      </div>
    </div>
  );
}

export function PasswordField({ label = 'PASSWORD', ...props }) {
  const [show, setShow] = useState(false);
  return (
    <Field
      label={label}
      icon={KeyRound}
      type={show ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setShow(!show)}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      }
      {...props}
    />
  );
}

export function GoldButton({ loading, children, ...props }) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className="w-full bg-[#D4A94B] hover:bg-[#c49a3f] disabled:opacity-60 text-[#0B1120] font-semibold rounded-lg py-3 text-sm transition-colors"
    >
      {children}
    </button>
  );
}