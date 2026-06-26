# 12 · Frontend y UX

Especifica la interfaz. El diseño visual se genera con Claude Design a partir de [prompts/claude-design-prompt.md](../prompts/claude-design-prompt.md). Referencia de interacción: ralv.ai (canvas espacial para agentes en paralelo).

## 12.1 Modelo de navegación

- **Hub (página principal):** lo primero al cargar. Presenta los tres modos; desde aquí se entra a uno. Acento índigo.
- **Modos como carpetas:** panel lateral izquierdo con tres carpetas — Council, Dev Team, Second Brain — expandibles/colapsables. Al abrir una, muestra el **historial de conversaciones** de ese modo (FR-3).
- **Shells independientes:** cada modo conserva su estado; abrir uno no destruye el otro. Esto habilita la concurrencia (NFR-2).

## 12.2 Paleta por contexto

| Contexto | Acento | Coherencia |
|----------|--------|------------|
| Hub | Índigo/violeta | tono neutro que reúne |
| Council | Teal | agentes cloud en los diagramas |
| Dev Team | Coral/ámbar | acción / construir |
| Second Brain | Púrpura | memoria / introspección |
| Tab activo | hereda el del modo | el cambio de paleta es total |

Transición de paleta al cambiar de modo: cross-fade de 200–300 ms. Todo lo no-acento permanece gris/negro/blanco. Modo claro y oscuro.

## 12.3 Fondo animado (estilo ralv.ai)

Campo espacial de fondo por modo: nodos/partículas conectados por líneas finas, en el acento del modo.

| Estado | Comportamiento |
|--------|----------------|
| Reposo | nodos flotan muy lento, baja opacidad |
| Trabajando | nodos activos, líneas pulsan, energía fluye hacia el nodo central (chairman) al ritmo del progreso |

No es 3D navegable (eso es el producto de escritorio de ralv); es la sensación espacial adaptada a web ligera. Dos variantes a explorar: inmersiva (campo presente) y sobria (campo insinuado).

## 12.4 Concurrencia en la UI (NFR-2, FR-4)

- Cada modo corre en su carril; lanzar un modo mientras otro trabaja → ambos progresan.
- Relanzar el **mismo** modo ocupado → aviso no bloqueante "X está trabajando" + **barra de progreso con estimación de tiempo restante**.
- Indicador de actividad (punto pulsante) junto a cada modo ocupado en el panel lateral.
- Nunca se colapsan modos entre sí.

## 12.5 Estados por defecto (para diseño "vivo")

| Modo | Estado mostrado |
|------|-----------------|
| Hub | tres tarjetas; una con punto de actividad |
| Council | pregunta enviada, 3 tabs de agentes poblados, respuesta del chairman arriba, rankings cruzados en panel derecho |
| Dev Team | pipeline a media ejecución (arquitecto hecho, programador en curso), código con resaltado |
| Second Brain | respuesta con 2 chips de cita, panel de notas recuperadas, indicador "túnel seguro" |

## 12.6 Vistas por modo

- **Council:** tabs por modelo (etapa 1), vista de rankings anonimizados (etapa 2), respuesta del chairman destacada (etapa 3). Mapea a [04-council](04-council.md).
- **Dev Team:** pipeline por roles con estados (pendiente/en curso/hecho/fallido), flecha de loop_back al fallar el tester, bloques de código. Mapea a [05-dev-team](05-dev-team.md).
- **Second Brain:** chips de cita enlazables, tarjetas de notas recuperadas, indicador de túnel. Mapea a [06-second-brain](06-second-brain.md).

## 12.7 Estados transversales

- Vacío (antes de la primera consulta) con frase de propósito.
- Carga por etapas (council: "recogiendo opiniones…", "revisando…", "sintetizando…").
- Error no bloqueante (modelo caído, cola llena — códigos en [api-spec](specs/api-spec.md)).
- Ocupado (aviso + barra de progreso).

## 12.8 Stack e integración

- React + Vite, `react-markdown`, SSE para streaming.
- Consume la [API](specs/api-spec.md); los eventos SSE alimentan tabs, pipeline y citas en tiempo real.
- Responsive: en móvil la barra lateral colapsa a menú; el panel derecho pasa a pestaña.
