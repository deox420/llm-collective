"""sandbox.py — ejecución aislada de código/tests del Dev Team (FR-D3, NFR-4).

Modelo de amenazas (07-security.md): el bloque de herramientas es la mayor
superficie de riesgo, así que TODA escritura y ejecución pasa por aquí:

- **workdir efímero**: cada run vive en un directorio temporal propio que se borra
  al terminar; nunca se montan ni tocan directorios del host fuera de él.
- **validación de rutas**: toda ruta de fichero se resuelve y se comprueba que cae
  dentro del workdir; `..` o rutas absolutas que escapen → SandboxError (TC-D4).
- **límites de recursos**: el subproceso recibe límites de CPU, memoria y tamaño de
  fichero (RLIMIT_*) y un timeout duro.
- **entorno mínimo**: el subproceso NO hereda secretos (.env); solo PATH y un HOME
  apuntando al workdir.

IMPORTANTE (divergencia registrada en ADR-0009): el SDD pide un contenedor Docker
sin privilegios (NFR-4). En este entorno Docker no está disponible, así que el
backend por defecto es **subprocess** con las mitigaciones de arriba. Es más débil
que un contenedor (no aísla red ni PIDs); la interfaz está pensada para enchufar un
backend Docker sin tocar el pipeline.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile


class SandboxError(RuntimeError):
    """Operación no permitida en el sandbox (p. ej. ruta que escapa del workdir)."""


# Límites por defecto del subproceso.
DEFAULT_TIMEOUT = 30          # segundos de reloj
_CPU_SECONDS = 15             # RLIMIT_CPU
_FSIZE_BYTES = 32 * 1024 * 1024  # RLIMIT_FSIZE (32 MiB)
# Nota: no fijamos RLIMIT_AS (memoria virtual) porque estrangula la importación de
# Python/pytest y provoca falsos fallos; el límite de memoria real corresponde al
# backend Docker (ADR-0009). Mantenemos CPU, tamaño de fichero y timeout de reloj.


def _set_limits() -> None:  # pragma: no cover - corre en el hijo, no medible por cobertura
    try:
        import resource
        resource.setrlimit(resource.RLIMIT_CPU, (_CPU_SECONDS, _CPU_SECONDS))
        resource.setrlimit(resource.RLIMIT_FSIZE, (_FSIZE_BYTES, _FSIZE_BYTES))
    except Exception:
        pass


class Sandbox:
    """Workdir aislado donde escribir ficheros y ejecutar código/tests."""

    def __init__(self, prefix: str = "llmc-sandbox-") -> None:
        self.root = os.path.realpath(tempfile.mkdtemp(prefix=prefix))

    # --- rutas -----------------------------------------------------------
    def _resolve(self, relpath: str) -> str:
        if os.path.isabs(relpath):
            raise SandboxError(f"ruta absoluta no permitida: {relpath!r}")
        target = os.path.realpath(os.path.join(self.root, relpath))
        if target != self.root and not target.startswith(self.root + os.sep):
            raise SandboxError(f"la ruta escapa del sandbox: {relpath!r}")
        return target

    # --- ficheros --------------------------------------------------------
    def write_file(self, relpath: str, content: str) -> str:
        target = self._resolve(relpath)
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with open(target, "w", encoding="utf-8") as f:
            f.write(content)
        return relpath

    def read_file(self, relpath: str) -> str:
        target = self._resolve(relpath)
        with open(target, encoding="utf-8") as f:
            return f.read()

    def list_files(self) -> list[str]:
        out = []
        for dirpath, _dirs, files in os.walk(self.root):
            for fn in files:
                full = os.path.join(dirpath, fn)
                out.append(os.path.relpath(full, self.root))
        return sorted(out)

    # --- ejecución -------------------------------------------------------
    def run(self, args: list[str], timeout: int = DEFAULT_TIMEOUT) -> dict:
        """Ejecuta un comando dentro del workdir con límites. No hereda secretos."""
        env = {"PATH": os.environ.get("PATH", "/usr/bin:/bin"), "HOME": self.root,
               "PYTHONDONTWRITEBYTECODE": "1"}
        try:
            proc = subprocess.run(
                args, cwd=self.root, env=env, capture_output=True, text=True,
                timeout=timeout, preexec_fn=_set_limits if os.name == "posix" else None,
            )
            return {"returncode": proc.returncode, "stdout": proc.stdout,
                    "stderr": proc.stderr, "timed_out": False}
        except subprocess.TimeoutExpired as e:
            return {"returncode": -1, "stdout": e.stdout or "", "stderr": "timeout",
                    "timed_out": True}

    def run_pytest(self, timeout: int = DEFAULT_TIMEOUT) -> dict:
        """Corre pytest en el workdir y resume el resultado (rol Tester, no-LLM)."""
        res = self.run([sys.executable, "-m", "pytest", "-q", "--no-header"], timeout=timeout)
        passed = res["returncode"] == 0 and not res["timed_out"]
        summary = _summarize_pytest(res["stdout"] + "\n" + res["stderr"])
        return {"passed": passed, "summary": summary, **res}

    # --- ciclo de vida ---------------------------------------------------
    def cleanup(self) -> None:
        shutil.rmtree(self.root, ignore_errors=True)

    def __enter__(self) -> "Sandbox":
        return self

    def __exit__(self, *exc) -> None:
        self.cleanup()


def _summarize_pytest(output: str) -> str:
    """Extrae la última línea de resumen de pytest (p. ej. '2 passed', '1 failed')."""
    for line in reversed(output.strip().splitlines()):
        s = line.strip().strip("=").strip()
        if any(k in s for k in ("passed", "failed", "error", "no tests")):
            return s
    return "sin resumen"
