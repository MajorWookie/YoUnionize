import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const root = fileURLToPath(new URL('.', import.meta.url))

// Read env vars from the repo root (one level up) so the same .env file the
// Expo app uses is the single source of truth. envPrefix accepts both VITE_*
// (web-specific overrides) and EXPO_PUBLIC_* (shared with iOS); only those
// prefixes reach the client bundle — server-side secrets stay out.
export default defineConfig({
  plugins: [react()],
  envDir: path.resolve(root, '..'),
  envPrefix: ['VITE_', 'EXPO_PUBLIC_'],
  resolve: {
    alias: {
      '~': path.resolve(root, 'src'),
    },
  },
  server: {
    port: 5173,
  },
})
