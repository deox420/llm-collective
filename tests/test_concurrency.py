"""Tests del gestor de concurrencia global (Fase 1 DoD, ADR-0008)."""
from __future__ import annotations

import pytest

from shared.concurrency import ConcurrencyManager, ModeBusyError


@pytest.fixture
def mgr():
    return ConcurrencyManager()


async def test_second_mode_is_blocked_while_first_runs(mgr):
    # DoD: iniciar un segundo modo mientras otro corre devuelve "bloqueado".
    await mgr.acquire("council")
    assert mgr.is_busy()
    assert mgr.active_mode == "council"
    with pytest.raises(ModeBusyError) as exc:
        await mgr.acquire("devteam")
    # El modo activo no cambia por el intento fallido.
    assert mgr.active_mode == "council"
    assert exc.value.active_mode == "council"
    assert exc.value.requested_mode == "devteam"


async def test_relaunching_same_busy_mode_is_blocked(mgr):
    await mgr.acquire("council")
    with pytest.raises(ModeBusyError):
        await mgr.acquire("council")


async def test_release_frees_the_mode(mgr):
    await mgr.acquire("council")
    await mgr.release("council")
    assert not mgr.is_busy()
    # Ahora otro modo puede arrancar.
    await mgr.acquire("brain")
    assert mgr.active_mode == "brain"


async def test_run_context_manager_releases_on_exit(mgr):
    async with mgr.run("devteam"):
        assert mgr.active_mode == "devteam"
    assert not mgr.is_busy()


async def test_run_releases_even_on_exception(mgr):
    with pytest.raises(ValueError):
        async with mgr.run("council"):
            raise ValueError("boom")
    # El finally del context manager debe haber liberado el modo.
    assert not mgr.is_busy()


async def test_unknown_mode_rejected(mgr):
    with pytest.raises(ValueError):
        await mgr.acquire("nope")
