# Prompt para Claude Design — Web de LLM Collective

Copia el bloque "Prompt" en Claude Design. Incluye ya las decisiones de paleta, estados por defecto, concurrencia y fondo animado estilo ralv.ai, de modo que no necesitas adjuntar el SDD.

---

## Prompt

> Diseña una aplicación web local-first llamada **LLM Collective**, una interfaz tipo Claude/ChatGPT que orquesta varios modelos de lenguaje a la vez. Estética sobria y minimalista: mucho espacio en blanco, tipografía neutra, foco en el contenido. Soporta modo claro y oscuro.
>
> ## Estructura (shell compartido + 3 modos como carpetas)
> - **Panel lateral izquierdo** con tres "carpetas" que son los modos: **Council**, **Dev Team**, **Second Brain**. Cada carpeta es **expandible/colapsable** y, al abrirla, muestra el **historial de conversaciones** de ese modo (lista de chats anteriores), igual que las carpetas de proyectos en Claude.
> - **Página principal (hub)** que es lo primero que se ve al cargar: un "hall" que presenta los tres modos con una tarjeta cada uno y una frase de qué hace. Desde aquí entras a un modo.
> - Cada modo es un **shell independiente**: abrir uno no destruye el estado del otro. Tienen identidad visual propia (ver paletas).
> - **Área central de chat** (historial arriba, caja de entrada fija abajo) y un **panel derecho contextual** que cambia según el modo, colapsable.
>
> ## Paleta por contexto (un acento cada uno, resto gris/negro/blanco)
> - **Hub (main page):** acento índigo/violeta neutro.
> - **Council:** acento teal.
> - **Dev Team:** acento coral/ámbar.
> - **Second Brain:** acento púrpura.
> - **Tabs y estado activo:** heredan el acento del modo activo (el tab no tiene color propio).
> - Al cambiar de modo, **la paleta transiciona con una animación corta (200–300 ms, cross-fade del acento)**. Todo el resto permanece neutro.
>
> ## Fondo animado estilo ralv.ai (en cada modo)
> Inspírate en ralv.ai: un campo espacial sutil de fondo, hecho de nodos/partículas conectados por líneas finas, con sensación viva y reconocimiento rápido del estado. Adáptalo a web ligera (no 3D pesado navegable, sino la *sensación* espacial):
> - **En reposo:** los nodos flotan muy despacio, casi imperceptibles, en el color de acento del modo a baja opacidad.
> - **Trabajando:** los nodos se activan, las líneas pulsan y fluye "energía" entre ellos hacia un nodo central (el chairman), a un ritmo ligado al progreso de la tarea.
> - El campo usa el acento del modo, así que cambia de color al cambiar de modo.
>
> ## Concurrencia (clave): modos en paralelo sin pisarse
> - Cada modo corre en su propio carril. Lanzar el modo B mientras A trabaja: **ambos progresan en paralelo**, sin colapsar.
> - Si se intenta **relanzar el mismo modo que ya está ocupado**, mostrar un **aviso no bloqueante**: "Council está trabajando" + una **barra de progreso con estimación de tiempo restante**.
> - En el panel lateral, cada modo ocupado muestra un **indicador de actividad** (punto pulsante) junto a su nombre, para ver de un vistazo qué está trabajando.
>
> ## Estado por defecto de cada modo (mostrar el diseño "vivo", no vacío)
> - **Hub:** las tres tarjetas de modo, una de ellas con el punto de actividad (simulando que trabaja).
> - **Council:** una pregunta ya enviada, con **3 tabs de agentes** poblados (respuestas individuales) y la **respuesta final del chairman** destacada arriba; el panel derecho muestra los rankings cruzados anonimizados.
> - **Dev Team:** el **pipeline a media ejecución** en el panel derecho — Arquitecto (hecho), Programador (en curso), Revisor (pendiente), Tester (pendiente) — con estados de color; bloques de código con resaltado en el chat.
> - **Second Brain:** una respuesta con **2 chips de citas** enlazables (nombres de notas de Obsidian) y el panel derecho con **tarjetas de notas recuperadas** (título + fragmento); indicador discreto "conectado vía túnel seguro".
>
> ## Interactividad (nivel medio-alto, espíritu ralv)
> - Paneles que reaccionan en tiempo real; detalle bajo demanda al hover/click (estilo "drill into detail" de ralv).
> - Tabs y acordeones funcionales, barra de progreso animada, transición de paleta entre modos.
> - El fondo de partículas responde al estado (reposo vs trabajando).
>
> ## Estilo visual
> - Bordes finos (hairline), esquinas suavemente redondeadas, sin sombras fuertes ni gradientes salvo el campo de fondo.
> - Sans-serif limpia para UI; monoespaciada para código.
> - Streaming: las respuestas aparecen token a token con un indicador de "pensando".
>
> ## Estados a contemplar
> - Vacío de cada modo (antes de la primera consulta) con una frase de qué hace.
> - Carga por etapas (council: "recogiendo opiniones…", "revisando…", "sintetizando…").
> - Error (un modelo no respondió, cola de cloud llena) — no bloqueante.
> - Ocupado (aviso + barra de progreso al relanzar un modo activo).
>
> ## Responsive
> En móvil: la barra lateral colapsa a un menú; el panel derecho pasa a una pestaña.
>
> ## Variaciones que quiero explorar
> Genera **dos variantes**: (A) **inmersiva**, con el campo de partículas de fondo más presente; (B) **sobria**, donde el campo solo se insinúa. Mismo layout y paletas en ambas.

---

## Extracto del SDD (sección frontend) — contexto para el diseño

El frontend mantiene el estilo de `llm-council` (minimalista, tipo ChatGPT). Componentes:
- Caja de chat central; tabs por modelo para inspeccionar cada respuesta individual (etapa 1 del council).
- Vista de revisión con rankings cruzados (council).
- Vista de pipeline por roles (dev-team).
- Citas a notas con enlaces (second-brain).
- Streaming por SSE.

Reparto de cómputo por modo: 3 agentes en Ollama Cloud (Pro, 3 concurrentes) + chairman en GPU alquilada. Esto justifica la concurrencia: distintos modos usan distintos recursos y pueden correr a la vez.

Detalle completo en `docs/SDD.md` y `docs/05-dev-team.md`, `docs/04-council.md`, `docs/06-second-brain.md`.

---

## Notas de uso
- Tras generar el diseño, puedes exportarlo a Replit/Vercel para un esqueleto desplegable.
- Para iterar, pide a Claude Design ajustar un modo concreto sin tocar los otros.
- Referencia de interacción y fondo: ralv.ai (canvas espacial para agentes en paralelo).
