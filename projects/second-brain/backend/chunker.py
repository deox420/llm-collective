"""chunker.py — trocea notas Markdown del vault (FR-S1, data-model.md).

Estrategia: partir por encabezados Markdown; si una sección excede ~max_chars,
subdividir por párrafos con solape para no perder contexto. Cada chunk guarda su
`heading` para que la cita apunte a la sección concreta.
"""
from __future__ import annotations

import hashlib
import re

_HEADING_RE = re.compile(r"^#{1,6}\s+(.*)$")


def _split_long(text: str, max_chars: int, overlap: int) -> list[str]:
    text = text.strip()
    if not text:
        return []
    if len(text) <= max_chars:
        return [text]
    paras = re.split(r"\n\s*\n", text)
    out: list[str] = []
    buf = ""
    for p in paras:
        p = p.strip()
        if not p:
            continue
        if buf and len(buf) + len(p) + 2 > max_chars:
            out.append(buf.strip())
            tail = buf[-overlap:] if overlap else ""
            buf = (tail + "\n\n" + p).strip()
        else:
            buf = f"{buf}\n\n{p}" if buf else p
    if buf.strip():
        out.append(buf.strip())
    return out


def chunk_markdown(text: str, note_path: str, max_chars: int = 1200, overlap: int = 150) -> list[dict]:
    """Devuelve una lista de chunks {id, text, note_path, heading, chunk_index}."""
    sections: list[tuple[str, list[str]]] = []
    heading = ""
    body: list[str] = []
    for line in text.splitlines():
        m = _HEADING_RE.match(line)
        if m:
            if body or heading:
                sections.append((heading, body))
            heading = m.group(1).strip()
            body = []
        else:
            body.append(line)
    if body or heading:
        sections.append((heading, body))

    chunks: list[dict] = []
    idx = 0
    for hd, body_lines in sections:
        body_text = "\n".join(body_lines).strip()
        block = f"{hd}\n{body_text}".strip() if hd else body_text
        for piece in _split_long(block, max_chars, overlap):
            digest = hashlib.sha256(f"{note_path}:{idx}:{piece}".encode()).hexdigest()[:16]
            chunks.append({
                "id": digest, "text": piece, "note_path": note_path,
                "heading": hd, "chunk_index": idx,
            })
            idx += 1
    return chunks
