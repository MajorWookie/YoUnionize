import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const root = fileURLToPath(new URL('.', import.meta.url))

// envPrefix keeps the historical EXPO_PUBLIC_* keys readable so
// existing .env files still work without renaming every variable.
export default defineConfig({
  plugins: [react()],
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
