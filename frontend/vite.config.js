import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// El backend FastAPI corre en :8000. Proxiamos /api y /health en desarrollo para
// que el frontend hable con el backend sin CORS. SSE pasa por aquí también.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Permite importar los assets de escena de PixelLab desde la raíz del repo
    // (assets/scenes/…), fuera del root de Vite (frontend/). Ver scenes.js.
    fs: { allow: ['..'] },
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/health': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
})
