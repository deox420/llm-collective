# 07 · Seguridad y modelo de amenazas

## Activos a proteger
| Activo | Sensibilidad |
|--------|--------------|
| Notas del Second Brain | Alta (datos personales) |
| Código del Dev Team | Alta |
| Claves API (Ollama, Anthropic) | Crítica |
| Host del usuario / GPU | Crítica |

## Modelo de amenazas (STRIDE resumido)

| Amenaza | Vector | Mitigación | Requisito |
|---------|--------|------------|-----------|
| Spoofing | Acceso remoto sin auth | Túnel autenticado (Tailscale/CF), nunca puerto abierto | CON-3, ADR-0006 |
| Tampering | Agente del dev-team modifica el host | Sandbox Docker; sin montar el host | NFR-4, FR-D3 |
| Repudiation | Acciones sin traza | Logs por etapa/herramienta | 09-operations |
| Information disclosure | Notas filtradas a un tercero | Chairman + vector DB en GPU propia; embedding local | NFR-3, ADR-0004 |
| Denial of service | Cola cloud llena, bucle infinito | Backoff; MAX_FIX_ITERATIONS | NFR-6, FR-D4 |
| Elevation of privilege | Escape del sandbox | Contenedor sin privilegios, FS de solo lectura salvo workdir | NFR-4 |

## Controles concretos
- **Secretos:** solo en `.env`, cubierto por `.gitignore`. Nunca en logs ni en el repo.
- **Sandbox (Dev Team):** contenedor sin privilegios, sin acceso a la red salvo lo necesario, workdir efímero, sin montar directorios del host. Cada herramienta valida rutas dentro del workdir.
- **Túnel (Second Brain):** identidad por dispositivo; el servicio sigue ligado a red privada.
- **Datos en reposo:** la vector DB vive en la GPU/host del usuario; si la GPU es alquilada, borrar el volumen al destruir la instancia.
- **Modelos de terceros:** Ollama Cloud declara no loguear ni entrenar con prompts; aun así, datos críticos se mantienen en GPU dedicada.

## Supuestos y límites
- No hay multi-tenant: se asume un usuario u operador de confianza.
- La seguridad del túnel depende del proveedor elegido.
- El sandbox reduce el riesgo del dev-team pero no lo elimina; revisar las herramientas habilitadas.
