// Cabecera: nombre del contexto, toggle de vista (Chat / Interactiva) y estado.
export default function Header({ context, selected, view, onToggleView, health, busy }) {
  return (
    <header className="header">
      <div className="header-title">
        <span className="header-icon">{context.icon}</span>
        <h2>{context.label}</h2>
        {busy && <span className="dot pulse" title={`${busy.mode} trabajando`} />}
      </div>

      <div className="header-right">
        {selected !== 'hub' && (
          <div className="view-toggle" role="tablist" aria-label="Vista">
            <button
              role="tab"
              aria-selected={view === 'chat'}
              className={view === 'chat' ? 'active' : ''}
              onClick={() => onToggleView('chat')}
            >
              Chat
            </button>
            <button
              role="tab"
              aria-selected={view === 'interactive'}
              className={view === 'interactive' ? 'active' : ''}
              onClick={() => onToggleView('interactive')}
            >
              Interactiva
            </button>
          </div>
        )}
        {health && (
          <span className="health" title="Perfil de modelos activo">
            perfil: {health.profile}
          </span>
        )}
      </div>
    </header>
  )
}
