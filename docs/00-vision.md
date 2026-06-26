# 00 · Visión y alcance

## Problema

Preguntar a un solo LLM tiene límites conocidos: sesgo del modelo, errores no contrastados, y la imposibilidad de que "se revise a sí mismo" de forma fiable. Para tareas difíciles (decisiones, desarrollo, recuperación de conocimiento personal), tener varios modelos colaborando supera a uno solo —si la orquestación es buena.

## Visión

Una plataforma **local-first** que orquesta modelos heterogéneos (cloud, GPU dedicada, local) sobre un núcleo común, y que sirve para tres cosas distintas con el mismo esqueleto:

1. **Council** — varios modelos opinan, se critican y un presidente sintetiza.
2. **Dev Team** — un equipo de roles construye software con herramientas reales.
3. **Second Brain** — un asistente que responde desde tus notas de Obsidian.

## Usuarios objetivo

- **Individuo técnico** que quiere mejores respuestas y un cerebro digital privado.
- **Equipo pequeño** que quiere un dev-team asistido sin exponer su código a terceros.

No objetivo: organización grande con necesidades multi-tenant, RBAC y SLA.

## Principios rectores

| Principio | Implicación de diseño |
|-----------|----------------------|
| Local-first | Los datos sensibles no salen de infraestructura controlada por el usuario por defecto. |
| Un núcleo, tres apps | Maximizar código compartido; las apps difieren en topología de agentes, no en plumbing. |
| Heterogeneidad transparente | Cambiar dónde corre un modelo = cambiar un string. |
| Coste bajo demanda | Nada corre 24/7 salvo decisión explícita; la GPU se enciende/apaga. |
| Honestidad epistémica | Coincidencia entre modelos ≠ verdad; la UI lo refleja. |

## Alcance

**Dentro:** los tres subsistemas, el núcleo `call_model`, frontend común, almacenamiento local (JSON + vector DB), acceso remoto por túnel.

**Fuera:** autenticación multi-usuario, facturación, marketplace de modelos, entrenamiento de modelos propios, alta disponibilidad.

## Métricas de éxito

- M1: una pregunta de Council devuelve respuesta sintetizada en < 60 s con 3 agentes en paralelo.
- M2: el Second Brain responde citando al menos una nota real del vault en > 90 % de preguntas sobre contenido indexado.
- M3: el Dev Team completa una tarea "escribe función + tests pasan" sin intervención humana en casos sencillos.
- M4: coste mensual en el presupuesto base por debajo de lo estimado en [08-costs](08-costs.md).
