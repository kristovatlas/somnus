import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // T-01 (docs/THREAT_MODEL.md): only accept loopback Host headers so a rebound
    // attacker host served to :5173 cannot proxy into the backend (changeOrigin
    // would otherwise rewrite the Host and slip past backend TrustedHost checks).
    allowedHosts: ['localhost', '127.0.0.1'],
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    css: true,
    exclude: ['e2e/**', 'node_modules/**'],
  },
})
