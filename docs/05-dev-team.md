# 05 · Subsistema Dev Team

Implementa FR-D1..D5. Patrón: pipeline jerárquico de roles con herramientas reales. Decisión de framework en [ADR-0005](adr/0005-langgraph-for-devteam.md).

## Roles (FR-D1)
| Rol | Ubicación | Responsabilidad |
|-----|-----------|-----------------|
| Arquitecto / líder | GPU alquilada (modelo potente) | Diseña, descompone, valida |
| Programador | Cloud (modelo coder) | Escribe el código |
| Revisor | Cloud | Busca bugs y edge cases |
| Tester | Ejecutor (no LLM) | Corre tests reales y reporta |

## Grafo de estados (FR-D2)
```
Arquitecto -> Programador -> Revisor -> Tester
                  ^                        |
                  +--------- si falla -----+
```
El bucle se repite hasta que los tests pasan o se alcanza `MAX_FIX_ITERATIONS` (FR-D4).

Secuencia: [diagrams/seq-devteam.md](diagrams/seq-devteam.md). Arquitectura: [diagrams/02-dev-team.svg](diagrams/02-dev-team.svg).

## Herramientas (FR-D3)
Sistema de ficheros, terminal/shell, git, runner de tests. Todas con efectos reales en disco, **siempre dentro de un sandbox** (ver [07-security](07-security.md), NFR-4).

## Configuración de referencia
```python
ROLES = {
    "architect": "gpu/qwen3:72b",
    "programmer": "cloud/qwen3-coder:32b",
    "reviewer":   "cloud/deepseek-r1:32b",
}
MAX_FIX_ITERATIONS = 5
SANDBOX = "docker"
```

## Decisiones
- No construir el grafo a mano: LangGraph/CrewAI (ADR-0005).
- Sandbox obligatorio; el bloque de herramientas es la principal superficie de riesgo.
- Tope de iteraciones para evitar bucles y gasto descontrolado.
