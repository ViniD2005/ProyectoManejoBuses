// Ilustración de bus para estados vacíos de las pantallas del cliente (CC-20)
function IconoBus({ tam = 32 }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="3" width="16" height="15" rx="3" />
      <path d="M4 11h16M8 3v8M16 3v8M7 18v2M17 18v2" />
      <circle cx="8" cy="15" r="1" />
      <circle cx="16" cy="15" r="1" />
    </svg>
  )
}

export default IconoBus
