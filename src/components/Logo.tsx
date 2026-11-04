export function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="18" fill="#0f0e17" />
      <path d="M18 18 L46 46 M46 18 L18 46" stroke="#f2efe8" strokeWidth="7" strokeLinecap="round" />
      <rect x="10" y="30" width="44" height="4" rx="2" fill="#c8f53a" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-display font-extrabold tracking-tight ${className}`}>
      <LogoMark size={28} />
      <span>
        MF <span className="text-brand">X-ray</span>
      </span>
    </span>
  );
}
