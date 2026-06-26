"""Configuración común de tests."""
from shared.devteam_loader import load_devteam_backend

# Registra el paquete del Dev Team (projects/dev-team/backend) como devteam_backend
# para poder importarlo pese al guion en la ruta.
load_devteam_backend()
