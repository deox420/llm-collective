# Spec · Plan de pruebas

Cobertura mínima: cada requisito `Must` de [01-requirements](../01-requirements.md) tiene al menos un caso.

## Niveles

| Nivel | Qué prueba | Herramienta |
|-------|-----------|-------------|
| Unitario | `call_model` enruta y adapta payloads | pytest + httpx mock |
| Integración | Orquestadores con modelos mockeados | pytest async |
| Contrato | Endpoints cumplen la spec de API | schemathesis / pytest |
| E2E | Flujo completo por app con modelos reales | manual + script |
| Seguridad | Sandbox aísla, túnel autentica | revisión + pruebas dirigidas |

## Casos por requisito

### Núcleo
| Caso | Requisito | Verifica |
|------|-----------|----------|
| TC-1 | FR-1 | `call_model("cloud/x")` llama al host cloud; prefijo desconocido lanza ValueError |
| TC-2 | FR-1 | `anthropic/` adapta el payload (system separado, max_tokens) |
| TC-3 | FR-2 | El endpoint SSE emite eventos incrementales |
| TC-4 | FR-3 | Crear y recuperar una conversación persiste los mensajes |
| TC-5 | FR-5 | Dos consultas idénticas hacen una sola llamada al modelo |
| TC-6 | NFR-6 | Si el modelo cloud da 502, se aplica el fallback configurado |

### Council
| Caso | Requisito | Verifica |
|------|-----------|----------|
| TC-C1 | FR-C1, NFR-2 | Las 3 opiniones se piden en paralelo (gather), no en serie |
| TC-C2 | FR-C2 | Las identidades se anonimizan antes de la revisión |
| TC-C3 | FR-C3 | El chairman recibe opiniones + rankings y produce final |
| TC-C4 | NFR-1 | Latencia p50 < 60 s con 3 agentes (E2E, modelos reales) |

### Dev Team
| Caso | Requisito | Verifica |
|------|-----------|----------|
| TC-D1 | FR-D2 | Test fallido dispara loop_back al programador |
| TC-D2 | FR-D3, NFR-4 | Las herramientas se ejecutan en sandbox, no en el host |
| TC-D3 | FR-D4 | El bucle se detiene al alcanzar max_iterations |
| TC-D4 | FR-D3 | Un agente no puede acceder a rutas fuera del sandbox |

### Second Brain
| Caso | Requisito | Verifica |
|------|-----------|----------|
| TC-S1 | FR-S1 | Indexar un vault de prueba crea chunks con embeddings |
| TC-S2 | FR-S2 | Modificar una nota solo reindexa sus chunks |
| TC-S3 | FR-S3, FR-S4 | La respuesta cita al menos una nota real recuperada |
| TC-S4 | NFR-3 | En config por defecto, las notas no salen a terceros (revisión de tráfico) |
| TC-S5 | FR-S5, CON-3 | El acceso remoto exige túnel; puerto directo rechazado |

## Datos de prueba
- Vault de Obsidian sintético con 20 notas y enlaces internos.
- Tarea de dev-team canónica: "función que valida un email + tests".
- Banco de 10 preguntas para el council con respuestas esperadas de referencia.

## Criterios de salida
- 100 % de casos `Must` en verde.
- Sin fugas de datos detectadas en TC-S4.
- Sin escapes del sandbox en TC-D4.
