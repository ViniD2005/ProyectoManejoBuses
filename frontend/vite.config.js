import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// En Docker el backend se llama "backend" (CC-18); sin Docker, localhost
const destino = process.env.VITE_PROXY_TARGET || 'http://localhost:3000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // En Docker sobre Windows los cambios de archivos se detectan por sondeo
    watch: process.env.VITE_USE_POLLING === 'true' ? { usePolling: true, interval: 300 } : undefined,
    // Redirige /api al backend para evitar problemas de CORS en desarrollo
    proxy: {
      '/api': destino,
      '/uploads': destino,
    },
  },
})
