# ADR-0009 · Sandbox del Dev Team: subprocess como backend por defecto

**Estado:** Aceptada · **Fecha:** 2026-06-26
**Relacionado:** NFR-4, FR-D3, [07-security.md](../07-security.md), [05-dev-team.md](../05-dev-team.md)

## Contexto

El Dev Team ejecuta código y tests generados por LLMs. El SDD pide hacerlo en un
**contenedor Docker sin privilegios** (`SANDBOX = "docker"`, NFR-4): sin montar el
host, FS de solo lectura salvo el workdir, sin red. En el entorno de construcción
(contenedor remoto de Claude Code) **Docker no está disponible** (no hay daemon ni
privilegios para `--network`/namespaces).

## Decisión

Implementar el sandbox como una **interfaz** (`shared`/`Sandbox`) con un backend por
defecto basado en **subprocess** y mitigaciones a nivel de proceso, dejando lista la
sustitución por un backend Docker sin tocar el pipeline:

- **workdir efímero** por run (`tempfile.mkdtemp`), borrado al terminar; nunca se
  montan ni tocan rutas del host fuera de él.
- **validación de rutas**: toda ruta se resuelve (`realpath`) y se exige que caiga
  dentro del workdir; absolutas o con `..` que escapen → `SandboxError` (TC-D4).
- **límites de recursos** del hijo: `RLIMIT_CPU` y `RLIMIT_FSIZE` + **timeout** de
  reloj. (No se fija `RLIMIT_AS` porque estrangula la importación de Python/pytest.)
- **entorno mínimo**: el subproceso NO hereda secretos del `.env`; solo `PATH` y un
  `HOME` dentro del workdir.

## Consecuencias

- **Positivas:** funciona sin Docker; el pipeline y sus tests corren end-to-end;
  protege contra escapes de ruta y fuga de secretos; interfaz lista para Docker.
- **Negativas / límites (a señalar):** el subprocess **no aísla red ni PIDs** ni
  limita memoria con la misma garantía que un contenedor — es **más débil que lo que
  pide NFR-4**. No debe considerarse aislamiento de seguridad fuerte frente a código
  hostil; es una mitigación razonable para uso de un operador de confianza (supuesto
  de 07-security: no multi-tenant).
- **Acción futura:** en despliegue real (GPU/host con Docker), activar el backend
  Docker (contenedor sin privilegios, sin red, FS RO salvo workdir) para cumplir
  NFR-4 plenamente. No se revierte esta decisión sin un ADR que lo supere.
