import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['tests/setup/swarm-test-setup.js'], // Changed from .ts to .js
    include: [
      'tests/features/swarm/**/*.feature.spec.js' // Changed from .ts to .js
    ],
    exclude: [
      'node_modules/**/*',
      'dist/**/*',
      'build/**/*',
      'lib/**/*'
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
        'build/**/*',
        'lib/**/*',
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
        'src/mcp/tools/unjucks-e2e-swarm.js': { // Changed from .ts to .js
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
      '@': resolve(process.cwd(), 'src'), // Changed from __dirname
      '~': resolve(process.cwd(), '.'), // Changed from __dirname
      '#imports': resolve(process.cwd(), 'src/types/imports.js')
    }
  },
  define: {
    'import.meta.vitest': false
  },
  esbuild: {
    target: 'node18'
  }
})