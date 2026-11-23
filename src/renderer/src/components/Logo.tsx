export function Logo({ size = 20 }: { size?: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f05a50" />
          <stop offset="1" stopColor="#c8322e" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="7" fill="url(#logo-g)" />
      <rect x="7" y="8" width="18" height="17" rx="2.5" fill="#fff6f3" />
      <rect x="7" y="8" width="18" height="5" rx="2" fill="#78181e" />
      <rect x="10.4" y="5.5" width="2.2" height="5" rx="1.1" fill="#fff6f3" />
      <rect x="19.4" y="5.5" width="2.2" height="5" rx="1.1" fill="#fff6f3" />
      <rect x="17" y="17" width="5" height="5" rx="1.2" fill="#d63c3a" />
    </svg>
  )
}
