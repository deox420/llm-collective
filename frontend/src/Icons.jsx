// Iconos SVG (line-art) extraídos del diseño Claude Design.
const PATHS = {
  logo: { sw: 2.2, el: <><circle cx="12" cy="6" r="2.4" /><circle cx="6" cy="17" r="2.4" /><circle cx="18" cy="17" r="2.4" /><path d="M12 8.4v3M10.4 15.4 7.6 8.6M13.6 15.4l2.8-6.8" /></> },
  hub: { el: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></> },
  council: { el: <><rect x="3" y="4" width="4" height="16" rx="1" /><rect x="10" y="4" width="4" height="16" rx="1" /><rect x="17" y="4" width="4" height="16" rx="1" /></> },
  devteam: { el: <path d="m8 9-3 3 3 3M16 9l3 3-3 3M13 6l-2 12" /> },
  brain: { el: <><path d="M12 5a3 3 0 0 0-3 3 3 3 0 0 0-1 5.8A2.5 2.5 0 0 0 12 18a2.5 2.5 0 0 0 4-4.2A3 3 0 0 0 15 8a3 3 0 0 0-3-3Z" /><path d="M12 5v13" /></> },
  chevron: { sw: 2.4, el: <path d="m9 6 6 6-6 6" /> },
  sun: { el: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></> },
  moon: { el: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /> },
  panel: { el: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16" /></> },
  check: { sw: 2.4, el: <path d="M20 6 9 17l-5-5" /> },
  send: { sw: 2, el: <path d="M12 19V5M5 12l7-7 7 7" /> },
  retry: { sw: 1.8, el: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></> },
  file: { sw: 1.8, el: <><path d="M14 3v5h5" /><path d="M18 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8l6 6v10a2 2 0 0 1-2 2Z" /></> },
  lock: { sw: 1.9, el: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></> },
  close: { sw: 1.9, el: <path d="M18 6 6 18M6 6l12 12" /> },
}

export function Icon({ name, size = 16, stroke = 'currentColor' }) {
  const p = PATHS[name]
  if (!p) return null
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke}
      strokeWidth={p.sw || 1.7} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
      {p.el}
    </svg>
  )
}
