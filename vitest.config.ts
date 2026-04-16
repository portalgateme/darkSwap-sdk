import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts', 'test/**/*.spec.ts'],
    environment: 'node',
    globals: true,
    maxWorkers: 1,
    minWorkers: 1,
  },
  resolve: {
    alias: {
    },
  },
}) 