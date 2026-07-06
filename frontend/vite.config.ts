import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const codespaceName = process.env.CODESPACE_NAME
const forwardingDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
const codespaceHosts =
  codespaceName && forwardingDomain ? [`${codespaceName}-5173.${forwardingDomain}`] : []

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // T-01 (docs/THREAT_MODEL.md): the /api dev-proxy's F1p rebinding path is
    // closed by Vite's *built-in* host filter (it rejects any Host that isn't an
    // IP literal or localhost/*.localhost, e.g. a rebound attacker.com). This
    // array only adds the Codespaces forwarded host so browser dogfooding works;
    // the loopback entries are redundant with Vite's built-ins. NOTE: `--host`
    // (or a non-loopback server.host) exposes the /api proxy to the LAN — never
    // run it with real data.
    allowedHosts: ['localhost', '127.0.0.1', ...codespaceHosts],
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
