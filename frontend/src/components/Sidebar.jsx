import { useState } from 'react'
import { MODES, MODE_ORDER } from '../theme.js'

// Panel lateral: Hub arriba + los tres modos como carpetas colapsables, cada una
// con su historial de conversaciones (12-frontend.md §12.1).
export default function Sidebar({ selected, onSelect, histories, busy }) {
  const [expanded, setExpanded] = useState({ council: false, devteam: false, brain: false })

  const toggle = (mode) => {
    onSelect(mode)
    setExpanded((e) => ({ ...e, [mode]: !e[mode] }))
  }

  return (
    <aside className="sidebar">
      <button
        className={`hub-link ${selected === 'hub' ? 'active' : ''}`}
        onClick={() => onSelect('hub')}
      >
        <span className="folder-icon">{MODES.hub.icon}</span> Hub
      </button>

      <nav className="folders">
        {MODE_ORDER.map((mode) => {
          const md = MODES[mode]
          const isSelected = selected === mode
          const isBusy = busy?.mode === mode
          const items = histories[mode] || []
          return (
            <div key={mode} className={`folder ${isSelected ? 'selected' : ''}`}
              style={{ '--folder-accent': md.accent }}>
              <button className="folder-head" onClick={() => toggle(mode)}>
                <span className={`chevron ${expanded[mode] ? 'open' : ''}`}>▸</span>
                <span className="folder-icon">{md.icon}</span>
                <span className="folder-label">{md.label}</span>
                {isBusy && <span className="dot pulse" aria-label={`${md.label} ocupado`} />}
              </button>
              {expanded[mode] && (
                <ul className="conv-list">
                  {items.length === 0 && <li className="conv-empty">Sin conversaciones</li>}
                  {items.map((c) => (
                    <li key={c.id} className="conv-item">{c.title}</li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
