import { defineConfig } from 'vitest/config'
import type { PluginOption } from 'vite'
import react from '@vitejs/plugin-react'

const codespaceName = process.env.CODESPACE_NAME
const forwardingDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
const codespaceHosts =
  codespaceName && forwardingDomain ? [`${codespaceName}-5173.${forwardingDomain}`] : []

// T-14 (docs/THREAT_MODEL.md): defense-in-depth CSP for the SPA. Injected only
// in the production build (as a <meta>, since the SPA is served as static files
// with no response-header layer) so Vite's dev HMR — which needs a ws:
// connection and eval — is left untouched. The SPA loads only local assets and
// calls only the same-origin /api, so 'self' is low-friction; 'unsafe-inline'
// in style-src is required because the UI uses React inline style={{}}.
function spaCspPlugin(): PluginOption {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
  return {
    name: 'somnus-spa-csp',
    apply: 'build',
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: csp },
          injectTo: 'head',
        },
      ]
    },
  }
}

export default defineConfig({
  plugins: [react(), spaCspPlugin()],
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
