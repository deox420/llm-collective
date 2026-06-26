"""conversations.py — persistencia local de conversaciones (FR-3).

JSON por conversación en data/conversations/<id>.json (data-model.md). Local-first:
los datos viven en disco del usuario; data/ está en .gitignore.
"""
from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

PROJECTS = {"council", "dev-team", "second-brain"}

# Raíz de datos configurable (útil en tests). Por defecto data/conversations/.
_DATA_ROOT = Path(os.environ.get("LLMC_DATA_DIR", "data"))


def _dir() -> Path:
    d = _DATA_ROOT / "conversations"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _path(conversation_id: str) -> Path:
    return _dir() / f"{conversation_id}.json"


def create(project: str) -> dict:
    if project not in PROJECTS:
        raise ValueError(f"proyecto desconocido: {project!r} (válidos: {sorted(PROJECTS)})")
    now = _now()
    conv = {
        "id": str(uuid.uuid4()),
        "project": project,
        "created_at": now,
        "updated_at": now,
        "messages": [],
    }
    _write(conv)
    return conv


def get(conversation_id: str) -> dict | None:
    p = _path(conversation_id)
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding="utf-8"))


def list_conversations(project: str | None = None) -> list[dict]:
    out = []
    for p in sorted(_dir().glob("*.json")):
        conv = json.loads(p.read_text(encoding="utf-8"))
        if project and conv.get("project") != project:
            continue
        # Resumen: sin el cuerpo de mensajes (la lista no necesita el detalle).
        out.append(
            {
                "id": conv["id"],
                "project": conv["project"],
                "created_at": conv["created_at"],
                "updated_at": conv["updated_at"],
                "message_count": len(conv.get("messages", [])),
            }
        )
    return out


def append_message(
    conversation_id: str,
    role: str,
    content: str,
    stage_data: dict | None = None,
) -> dict:
    conv = get(conversation_id)
    if conv is None:
        raise KeyError(conversation_id)
    msg = {"role": role, "content": content, "ts": _now()}
    if stage_data is not None:
        msg["stage_data"] = stage_data
    conv["messages"].append(msg)
    conv["updated_at"] = _now()
    _write(conv)
    return conv


def _write(conv: dict) -> None:
    _path(conv["id"]).write_text(
        json.dumps(conv, ensure_ascii=False, indent=2), encoding="utf-8"
    )
