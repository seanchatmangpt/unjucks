import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/performance/**/*.test.{js,ts}'],
    exclude: ['node_modules/**', 'dist/**'],
    environment: 'node',
    testTimeout: 600000, // 10 minutes for performance tests
    hookTimeout: 60000,
    teardownTimeout: 60000,
    globals: true,
    reporters: ['verbose'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    }
  }
});