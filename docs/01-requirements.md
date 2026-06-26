# 01 · Requisitos

Cada requisito tiene un ID estable para poder trazarlo desde el diseño y las pruebas. `FR` = funcional, `NFR` = no funcional, `CON` = restricción.

## Requisitos funcionales

### Comunes a los tres subsistemas

| ID | Requisito | Prioridad |
|----|-----------|-----------|
| FR-1 | El sistema enruta una llamada a un modelo según un identificador con prefijo (`cloud/`, `gpu/`, `local/`, `anthropic/`). | Must |
| FR-2 | El usuario envía una consulta desde un frontend tipo chat y recibe la respuesta en streaming (SSE). | Must |
| FR-3 | El sistema persiste cada conversación localmente y permite recuperarla. | Must |
| FR-4 | El usuario puede cambiar entre los tres modos (Council / Dev Team / Second Brain) desde la UI. | Must |
| FR-5 | El sistema cachea respuestas idénticas (misma consulta, mismo modelo) para no repetir llamadas. | Should |

### Council

| ID | Requisito | Prioridad |
|----|-----------|-----------|
| FR-C1 | La consulta se envía a N agentes (config) en paralelo y se recogen sus respuestas. | Must |
| FR-C2 | Cada agente recibe las respuestas de los otros, anonimizadas, y las rankea por precisión e insight. | Must |
| FR-C3 | Un modelo chairman sintetiza una respuesta final a partir de respuestas y rankings. | Must |
| FR-C4 | La UI muestra cada respuesta individual en tabs y los rankings cruzados. | Should |

### Dev Team

| ID | Requisito | Prioridad |
|----|-----------|-----------|
| FR-D1 | Cada rol (arquitecto, programador, revisor) es un modelo con system prompt propio. | Must |
| FR-D2 | El flujo es un grafo con bucle: si el tester falla, vuelve al programador. | Must |
| FR-D3 | Los agentes ejecutan herramientas reales (ficheros, shell, git, runner de tests) dentro de un sandbox. | Must |
| FR-D4 | El bucle de corrección tiene un tope de iteraciones configurable. | Must |
| FR-D5 | La UI muestra el avance del pipeline por estados (pendiente / en curso / hecho / fallido). | Should |

### Second Brain

| ID | Requisito | Prioridad |
|----|-----------|-----------|
| FR-S1 | El sistema indexa un vault de Obsidian: trocea notas `.md`, genera embeddings y los guarda en una base vectorial. | Must |
| FR-S2 | El reindexado es incremental: solo recalcula chunks de notas modificadas (por `mtime`). | Must |
| FR-S3 | Ante una consulta, recupera los chunks más relevantes y el chairman responde basándose en ellos. | Must |
| FR-S4 | La respuesta cita las notas de origen con enlaces. | Must |
| FR-S5 | El sistema es accesible en remoto vía túnel seguro autenticado. | Should |
| FR-S6 | (Opcional) Un overlay de council puede aplicarse sobre las notas recuperadas. | Could |

## Requisitos no funcionales

| ID | Categoría | Requisito | Métrica |
|----|-----------|-----------|---------|
| NFR-1 | Rendimiento | Council con 3 agentes en paralelo responde en < 60 s p50. | latencia |
| NFR-2 | Rendimiento | La etapa 1 (opiniones) no se serializa con plan Pro (3 concurrentes). | concurrencia |
| NFR-3 | Privacidad | Los datos del Second Brain no salen de infraestructura del usuario en la config por defecto. | data residency |
| NFR-4 | Seguridad | Ningún agente ejecuta código en el host; siempre en sandbox aislado. | aislamiento |
| NFR-5 | Coste | El gasto recurrente se limita a Ollama Pro; la GPU es bajo demanda. | €/mes |
| NFR-6 | Fiabilidad | Si un modelo cloud falla o no existe, hay fallback configurable. | disponibilidad |
| NFR-7 | Mantenibilidad | El código de invocación de modelos está centralizado en un solo módulo. | acoplamiento |
| NFR-8 | Usabilidad | El streaming muestra progreso incremental; nunca una espera ciega. | percepción |
| NFR-9 | Portabilidad | Arranca con `uv sync` + `npm install` sin pasos manuales adicionales. | setup |

## Restricciones

| ID | Restricción | Origen |
|----|-------------|--------|
| CON-1 | Plan Ollama Cloud Pro: máximo 3 modelos concurrentes; uso medido por tiempo de GPU, límites de sesión cada 5 h y semanales cada 7 días. | proveedor |
| CON-2 | El chairman debe caber entero en la VRAM de la GPU alquilada para cargarse. | hardware |
| CON-3 | El acceso remoto no abre puertos: solo túnel (Tailscale/Cloudflare). | seguridad |
| CON-4 | Sin conector de GitHub disponible en el entorno de generación; entrega por zip o coordinación manual. | tooling |

## Trazabilidad

Cada requisito `Must` debe estar cubierto por al menos un caso en [specs/test-plan.md](specs/test-plan.md) y referenciado en el documento de subsistema correspondiente.
