# ADR-0008 · Concurrencia: un solo modo activo a la vez (lock global)

**Estado:** Aceptada · **Fecha:** 2026-06-26
**Supersede/clarifica:** §12.4 de [12-frontend.md](../12-frontend.md)

## Contexto

Hay una contradicción entre documentos del proyecto sobre el modelo de concurrencia:

- **`docs/12-frontend.md` §12.4** (parte del SDD, fuente de verdad): *"Cada modo corre
  en su carril; lanzar un modo mientras otro trabaja → ambos progresan. […] Nunca se
  colapsan modos entre sí."* Es decir, **carriles paralelos** por modo; solo relanzar
  el **mismo** modo ocupado da un aviso no bloqueante.
- **`CLAUDE.md`** (principios no negociables) e **`IMPLEMENTATION_PLAN.md`** (Fase 1 +
  su DoD): *"un solo modo activo a la vez; los demás bloqueados"*, con *"El estado de
  'ocupado' es global"*. El DoD exige un test que demuestre que **iniciar un segundo
  modo mientras otro corre devuelve 'bloqueado'**.

El usuario, al encargar la implementación, reiteró explícitamente como no negociable:
*"un solo modo activo a la vez"*. CLAUDE.md, además, manda **señalar** toda contradicción
con el SDD (lo que hace este ADR).

## Decisión

El backend mantiene un **estado global de modo ocupado**: como máximo **un modo activo a
la vez**. Mientras un modo trabaja, arrancar cualquier otro (o el mismo) devuelve
"bloqueado" (`ModeBusyError`). Implementado en `shared/concurrency.py` como un singleton
`ConcurrencyManager`.

## Justificación

- **Coherencia con la restricción real de cómputo (CON-1).** El plan Ollama Cloud Pro
  permite 3 modelos concurrentes. Council usa sus 3 agentes en paralelo (`asyncio.gather`),
  saturando los 3 slots. Con los slots llenos no hay capacidad para un segundo modo
  pesado simultáneo: la paralelización entre modos del §12.4 no es realizable con el
  reparto base sin encolar/rechazar peticiones.
- **Simplicidad y seguridad operativa.** Un único punto de "ocupado" evita estados
  inconsistentes y condiciones de carrera entre orquestadores.
- **Es lo que pide el operador del proyecto** (no negociable reiterado) y el DoD de Fase 1.

## Consecuencias

- **Positivas:** modelo de concurrencia simple y testeable; respeta CON-1 sin colas
  entre modos; un solo invariante global ("hay 0 o 1 modo activo").
- **Negativas / a revisar:** diverge de la UX de "carriles paralelos" descrita en
  §12.4. El frontend (Fase 2) debe reflejar **bloqueo** de los otros modos (punto
  pulsante + aviso no bloqueante + barra por etapas), no progreso simultáneo.
- **Reversibilidad:** si en el futuro se adopta un plan con más concurrencia (Ollama Max
  = 10) o GPU dedicada sin límite de slots, esta decisión puede revisarse con un ADR
  nuevo que reactive los carriles paralelos del §12.4. No se revierte sin ADR.

## Pendiente de confirmación

Esta decisión resuelve la contradicción a favor de CLAUDE.md/plan/operador. Queda
**señalada** para que el responsable del SDD actualice §12.4 o confirme la divergencia.
