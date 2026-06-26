"""Configuración común de tests."""
from shared.backend_loader import load_devteam_backend, load_secondbrain_backend

# Registra los backends con guion en la ruta como paquetes importables.
load_devteam_backend()
load_secondbrain_backend()
