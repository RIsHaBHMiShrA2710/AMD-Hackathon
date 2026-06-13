import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ── Backend target configuration ───────────────────────────────────────────────
// LOCAL DEV (default):
//   VITE_API_URL is not set → proxies to http://localhost:8001
//
// AMD POD (remote backend):
//   Create frontend/.env.local with:
//   VITE_API_URL=https://notebooks.amd.com/tcs-hackathon/user/YOUR-TEAM-ID/proxy/8001
//   Then run: npm run dev

const API_TARGET = process.env.VITE_API_URL || 'http://localhost:8001'

export default defineConfig({
  plugins: [react()],
  base: './', // Use relative paths for assets to support subfolder/Jupyter-proxy deployments
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,       // allow self-signed certs on cloud proxy
        rewrite: (path) => path,
      },
    },
  },
})
