import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/unit/**/*.test.js', 'test/integration/**/*.test.js'],
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.js'],
      exclude: ['src/types.d.ts'],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 72,
        statements: 85,
      },
    },
  },
})
