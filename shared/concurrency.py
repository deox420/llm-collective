"""concurrency.py — gestor de concurrencia global: un solo modo activo a la vez.

Principio no negociable (CLAUDE.md): mientras un modo trabaja, los demás están
bloqueados. El estado de "ocupado" es GLOBAL al backend, no por modo.

Esto operativiza CON-1 (plan Ollama Cloud Pro = 3 modelos concurrentes): un modo
como Council ya satura los 3 slots con sus 3 agentes en paralelo, así que no queda
capacidad para un segundo modo simultáneo. Por eso el lock es de modo único.

NOTA de divergencia: el SDD §12.4 (12-frontend.md) describe carriles paralelos por
modo. Esta decisión (lock global de modo único) se registra y justifica en
docs/adr/0008-concurrencia-modo-unico-global.md, que clarifica esa sección.

Uso:
    from shared.concurrency import manager, ModeBusyError
    async with manager.run("council"):
        ...   # mientras dura, cualquier otro modo recibe ModeBusyError
"""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

# Modos válidos del sistema. Coincide con los tres subsistemas + sus claves de UI.
MODES: frozenset[str] = frozenset({"council", "devteam", "brain"})


class ModeBusyError(RuntimeError):
    """Se intentó arrancar un modo mientras otro (o el mismo) ya está activo."""

    def __init__(self, active_mode: str, requested_mode: str) -> None:
        self.active_mode = active_mode
        self.requested_mode = requested_mode
        super().__init__(
            f"modo '{active_mode}' activo; '{requested_mode}' bloqueado"
        )


class ConcurrencyManager:
    """Estado global de 'modo ocupado'. Un único modo activo en todo el backend."""

    def __init__(self) -> None:
        self._active: str | None = None
        # Protege las mutaciones de _active frente a corrutinas concurrentes.
        self._lock = asyncio.Lock()

    @property
    def active_mode(self) -> str | None:
        return self._active

    def is_busy(self) -> bool:
        return self._active is not None

    async def acquire(self, mode: str) -> None:
        """Marca `mode` como activo. Lanza ModeBusyError si ya hay uno activo."""
        if mode not in MODES:
            raise ValueError(f"modo desconocido: {mode!r} (válidos: {sorted(MODES)})")
        async with self._lock:
            if self._active is not None:
                raise ModeBusyError(self._active, mode)
            self._active = mode

    async def release(self, mode: str) -> None:
        """Libera el modo si es el que está activo; no-op si no lo es."""
        async with self._lock:
            if self._active == mode:
                self._active = None

    @asynccontextmanager
    async def run(self, mode: str):
        """Context manager: adquiere el modo y lo libera siempre al salir."""
        await self.acquire(mode)
        try:
            yield
        finally:
            await self.release(mode)


# Singleton del backend: el estado de ocupado es global.
manager = ConcurrencyManager()
