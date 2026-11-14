export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="logo">
      <rect width="32" height="32" rx="7" fill="var(--sun)" />
      <path d="M7 20.5a9 9 0 0 1 18 0" fill="#17110a" />
      <path d="M4.5 21.5h23" stroke="#17110a" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M9 25.5h14" stroke="#17110a" strokeWidth="1.6" strokeLinecap="round" opacity=".55" />
    </svg>
  )
}
