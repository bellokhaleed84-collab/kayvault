// KV-SKEL v1: grey pulsing placeholder used instead of "Loading..." text
export default function Skel({ className = '' }) {
  return <div className={'animate-pulse rounded-lg bg-slate-800/70 ' + className} />;
}