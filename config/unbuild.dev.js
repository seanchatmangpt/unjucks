/**
 * Unbuild Configuration for Development
 * Fast builds with hot reloading and debugging support
 */

import { defineBuildConfig } from 'unbuild'
import { resolve } from 'path'

export default defineBuildConfig({
  // Development entries with preserve module structure
  entries: [
    // Main application entry
    'src/index.js',

    // Core modules (separate for better debugging)
    'src/cli/index.js',
    'src/kgen/index.js',
    'src/config/index.js',
    'src/office/index.ts',
    'src/attestation/index.ts',

    // Package entries
    'packages/kgen-core/src/index.js',
    'packages/kgen-cli/src/index.js',
    'packages/kgen-templates/src/index.js',
    'packages/kgen-rules/src/index.js',
    'packages/kgen-marketplace/src/index.js'
  ],

  outDir: 'dist',
  clean: false, // Don't clean in dev for faster rebuilds

  // Development optimizations
  minify: false,
  sourcemap: true,
  declaration: true,

  // Fast development builds
  rollup: {
    emitCJS: true, // Emit both ESM and CJS for compatibility

    // Don't inline dependencies in development
    inlineDependencies: false,

    // Preserve modules for better debugging
    preserveModules: true,

    // Fast compilation
    esbuild: {
      target: 'node18',
      minify: false,
      keepNames: true,
      sourcemap: true,
      platform: 'node'
    },

    // External all dependencies in development
    external: (id) => {
      // Bundle internal modules
      if (id.startsWith('@kgen/') || id.startsWith('@/')) {
        return false
      }

      // External everything else
      return !id.startsWith('.') && !id.startsWith('/')
    }
  },

  // TypeScript support with relaxed checking for speed
  typescript: {
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'Node',
      allowSyntheticDefaultImports: true,
      esModuleInterop: true,
      strict: false, // Relaxed for faster builds
      skipLibCheck: true,
      declaration: true,
      declarationMap: true,
      sourceMap: true,

      // Fast incremental builds
      incremental: true,
      tsBuildInfoFile: '.tsbuildinfo'
    }
  },

  // Path aliases for development
  alias: {
    '@kgen/core': resolve('./packages/kgen-core/src'),
    '@kgen/cli': resolve('./packages/kgen-cli/src'),
    '@kgen/templates': resolve('./packages/kgen-templates/src'),
    '@kgen/rules': resolve('./packages/kgen-rules/src'),
    '@kgen/marketplace': resolve('./packages/kgen-marketplace/src'),
    '@': resolve('./src')
  },

  // Watch mode configuration
  dev: {
    watch: ['src', 'packages/*/src'],
    exclude: ['**/*.test.*', '**/*.spec.*', 'node_modules']
  },

  // Development environment
  replace: {
    __DEV__: 'true',
    __PROD__: 'false',
    'process.env.NODE_ENV': '"development"'
  },

  // Development hooks
  hooks: {
    'build:prepare': async () => {
      console.log('🔧 Building development bundle...')
    },
    'build:done': async (ctx) => {
      console.log('✅ Development build ready!')
      console.log(`📁 Output: ${ctx.options.outDir}`)
      console.log('👀 Watching for changes...')
    }
  }
})