import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Redirige /api al backend para evitar problemas de CORS en desarrollo
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})