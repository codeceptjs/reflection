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
        lines: 83,
        functions: 85,
        branches: 70,
        statements: 83,
      },
    },
  },
})
