# ADR-0006 · Acceso remoto vía túnel, no puerto abierto

**Estado:** Aceptada · **Fecha:** 2026-06-26

## Contexto
El usuario quiere acceder al Second Brain "siempre", también desde el móvil. Ollama escucha en `127.0.0.1:11434` por defecto.

## Opciones consideradas
1. **Abrir el puerto** de Ollama/backend a internet — simple pero expone un servicio sin auth robusta.
2. **Túnel seguro** (Tailscale o Cloudflare Tunnel) — acceso autenticado sin abrir puertos.
3. **VPN propia** — control total, más complejidad de mantenimiento.

## Decisión
Acceso remoto exclusivamente por **túnel seguro autenticado** (Tailscale/Cloudflare). Nunca puerto abierto (CON-3, NFR-3).

## Justificación
- Ollama no trae autenticación fuerte de serie; exponerlo directo es peligroso.
- Tailscale/Cloudflare dan identidad y cifrado sin gestionar certificados ni firewall manual.
- Encaja con local-first: el servicio sigue ligado a `localhost`/red privada, el túnel solo da un canal autenticado.

## Consecuencias
- **Positivas:** seguridad por defecto, acceso desde el móvil, sin abrir la máquina al mundo.
- **Negativas:** dependencia de un servicio de túnel; latencia añadida mínima. Aceptable para uso personal.
