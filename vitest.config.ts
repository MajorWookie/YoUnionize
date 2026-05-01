import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: [
      'node_modules',
      'dist',
      '.sst',
      'e2e/**',
      'web/**',
      '.claude/**',
    ],
    testTimeout: 10_000,
    setupFiles: ['./vitest.setup.ts'],
  },
})
