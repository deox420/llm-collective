# 08 · Costes y dimensionamiento

Presupuesto base del SDD: **Ollama Pro + GPU alquilada por horas**. Las cifras de GPU son de mayo–junio 2026 y varían a diario; verifica en el deploy.

## Componentes de coste

| Componente | Modelo de coste | Cifra de referencia |
|------------|-----------------|---------------------|
| Ollama Cloud Pro | Suscripción fija | 20 $/mes (3 concurrentes) |
| GPU alquilada (chairman) | Por hora, bajo demanda | ver tabla GPU |
| Almacenamiento de la GPU | Por GB/mes (persiste aunque esté parada) | ~0,07 $/GB·mes |
| Embeddings (Second Brain) | Local | 0 $ |
| Anthropic API (opcional) | Por token | según uso |

## Tabla de GPU alquilada (single GPU, on-demand)

Rangos de mercado actuales (neo-clouds tipo Runpod/Vast.ai/Lambda/Spheron):

| GPU | VRAM | Precio/hora aprox. | Apto para chairman |
|-----|------|--------------------|--------------------|
| RTX 4090 | 24 GB | 0,31–0,69 $ | Modelos hasta ~30B cuantizados |
| A100 80GB | 80 GB | 0,67–1,07 $ | Modelos 70B cuantizados |
| H100 80GB | 80 GB | 1,49–2,99 $ | 70B holgado / mayor throughput |

Marketplaces (Vast.ai) tocan el suelo de precio; los de tier dedicado (Lambda/Spheron) dan más fiabilidad por algo más. Los hyperscalers (AWS/GCP/Azure) son 2–5× más caros para la misma GPU y no aportan nada aquí.

## Escenarios mensuales

Asumen GPU encendida solo durante el uso (clave del ahorro). Precio GPU tomado en el punto medio del rango.

### Escenario 0 — Arranque sin GPU (perfil `cloud_only`)
Para construir y probar todo el proyecto con solo Ollama Cloud, sin decidir aún físico vs alquiler.
- Ollama Cloud Pro: 20 $/mes.
- Sin GPU alquilada, sin almacenamiento de GPU.
- **Total ≈ 20 $/mes.** Es el punto de partida recomendado.

### Escenario 0-bis — Desarrollo 100% local (perfil `local_dev`)
Trastear gratis en tu propio equipo con modelos 7–8B (RTX). Calidad menor, pero coste **0 €**.
- Sin cloud, sin GPU alquilada.
- **Total ≈ 0 €/mes.** Útil mientras Claude Code construye y depura.

### Escenario A — Uso ligero (individual)
- GPU A100 a ~0,85 $/h, **2 h/día × 20 días = 40 h/mes** → ~34 $/mes.
- Ollama Pro: 20 $/mes.
- Almacenamiento (50 GB modelo): ~3,5 $/mes.
- **Total ≈ 57,5 $/mes.**

### Escenario B — Uso medio (individual intensivo)
- GPU A100, **4 h/día × 22 días = 88 h/mes** → ~75 $/mes.
- Ollama Pro: 20 $/mes.
- Almacenamiento: ~3,5 $/mes.
- **Total ≈ 98,5 $/mes.**

### Escenario C — Equipo pequeño, dev-team activo
- GPU H100 a ~2 $/h, **6 h/día × 22 días = 132 h/mes** → ~264 $/mes.
- Ollama Pro (quizá Max si se saturan los 3 slots): 20–100 $/mes.
- Almacenamiento: ~7 $/mes.
- **Total ≈ 291–371 $/mes.**

## Palancas de ahorro (NFR-5)
1. **Apagado automático por inactividad** de la GPU: lo más impactante. Una GPU olvidada encendida 24/7 multiplica el coste por ~10.
2. **Caché de respuestas** (FR-5): evita llamadas repetidas.
3. **Spot/community tier** para cargas tolerantes a interrupción (no para inferencia user-facing).
4. **Modelo de chairman cuantizado**: cabe en GPU más barata (CON-2).
5. **Free tier de Ollama** para pruebas; subir a Pro solo cuando el paralelismo importe.

## Comparativa con alternativas
- **Todo en OpenRouter de pago:** evita gestionar GPU pero el coste por token de modelos frontera y el fee del 5,5 % se acumulan; sin control de privacidad. Ver [ADR-0001](adr/0001-ollama-cloud-vs-openrouter.md).
- **GPU propia comprada:** sin coste recurrente de alquiler, pero inversión inicial alta y se atado a un hardware; tiene sentido solo con uso sostenido y alto.

## Avisos
- Los créditos/instancias se facturan aunque la GPU esté parada si el volumen persiste; destruir el volumen al terminar si no se reutiliza.
- El uso de Ollama Cloud se mide por tiempo de GPU con límites de sesión (5 h) y semanales (7 días); un uso muy intensivo puede requerir Max.
