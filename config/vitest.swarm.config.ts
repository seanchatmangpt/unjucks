import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['tests/setup/swarm-test-setup.ts'],
    include: [
      'tests/features/swarm/**/*.feature.spec.ts'
    ],
    exclude: [
      'node_modules/**/*',
      'dist/**/*',
      '**/*.d.ts'
    ],
    testTimeout: 30000, // 30 second timeout for swarm operations
    hookTimeout: 10000, // 10 second timeout for setup/teardown
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 4,
        minThreads: 1
      }
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/mcp/**/*',
        'src/server/**/*',
        'src/pages/swarm/**/*'
      ],
      exclude: [
        'tests/**/*',
        'dist/**/*',
        '**/*.d.ts',
        '**/*.config.*'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 85,
          lines: 90,
          statements: 90
        },
        // Higher thresholds for critical swarm components
        'src/mcp/swarm/': {
          branches: 90,
          functions: 95,
          lines: 95,
          statements: 95
        },
        'src/mcp/tools/unjucks-e2e-swarm.ts': {
          branches: 95,
          functions: 100,
          lines: 98,
          statements: 98
        }
      }
    },
    reporters: [
      'default',
      'verbose',
      'json',
      'html'
    ],
    outputFile: {
      json: 'reports/swarm-test-results.json',
      html: 'reports/swarm-test-report.html'
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '../src'),
      '~': resolve(__dirname, '../'),
      '#imports': resolve(__dirname, '../.nuxt/imports.d.ts')
    }
  },
  define: {
    'import.meta.vitest': false
  },
  esbuild: {
    target: 'node18'
  }
})