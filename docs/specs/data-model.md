# Spec · Modelo de datos

## Almacenamiento

| Dato | Tecnología | Ubicación |
|------|-----------|-----------|
| Conversaciones | JSON | `data/conversations/<id>.json` |
| Índice vectorial (Second Brain) | Chroma / LanceDB | `data/vector/` |
| Caché de respuestas | JSON / SQLite | `data/cache/` |
| Secretos | dotenv | `.env` (no versionado) |

## Conversación (los tres proyectos)

```jsonc
{
  "id": "uuid",                         // FR-3
  "project": "council|dev-team|second-brain",
  "created_at": "iso8601",
  "updated_at": "iso8601",
  "messages": [
    {
      "role": "user|assistant",
      "content": "texto",
      "ts": "iso8601",
      "stage_data": { }                 // especifico por app, ver abajo
    }
  ]
}
```

### `stage_data` por app

**Council:**
```jsonc
{
  "opinions": [ { "model": "cloud/qwen3:32b", "content": "..." } ],
  "reviews":  [ { "reviewer": "anon-1", "rankings": [ { "candidate": "anon-2", "score": 8 } ] } ],
  "chairman_model": "gpu/llama3.3:70b"
}
```

**Dev Team:**
```jsonc
{
  "iterations": 2,
  "roles": { "architect": "gpu/qwen3:72b", "programmer": "cloud/qwen3-coder:32b" },
  "files": [ "src/x.py", "tests/test_x.py" ],
  "tests_passed": true
}
```

**Second Brain:**
```jsonc
{
  "retrieved": [ { "note_path": "...", "heading": "...", "score": 0.82 } ],
  "citations": [ "ruta/nota1.md" ]
}
```

## Índice vectorial (solo Second Brain)

Esquema lógico de cada registro (FR-S1, FR-S2):

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string | hash del chunk (estable para dedupe) |
| `vector` | float[768] | embedding de nomic-embed-text |
| `text` | string | el trozo de nota |
| `note_path` | string | ruta relativa en el vault |
| `heading` | string | sección de origen |
| `mtime` | timestamp | mtime de la nota; base del reindexado incremental |
| `chunk_index` | int | posición del chunk dentro de la nota |

### Estrategia de chunking
- Trocear por encabezados de Markdown primero; si una sección excede ~512 tokens, partir por párrafos con solape de ~50 tokens.
- Guardar `heading` para que la cita apunte a la sección concreta.

### Reindexado incremental (FR-S2)
1. Escanear el vault, comparar `mtime` de cada nota con el guardado.
2. Para notas cambiadas: borrar sus chunks antiguos (por `note_path`) y reinsertar.
3. Notas eliminadas: borrar sus chunks.

## Caché de respuestas (FR-5)
Clave: `sha256(model_id + ":" + hash(messages))`. Valor: respuesta + timestamp. TTL configurable.
