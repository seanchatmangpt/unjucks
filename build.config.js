import { defineBuildConfig } from 'unbuild'
import { resolve } from 'path'

export default defineBuildConfig({
  // Main CLI entry point only
  entries: [
    'src/cli-entry.js'
  ],

  // Output directory
  outDir: 'dist',

  // Clean output directory before build
  clean: true,

  // Generate source maps
  sourcemap: true,

  // Generate TypeScript declarations
  declaration: true,

  // Bundle all dependencies except externals
  rollup: {
    emitCJS: true,
    esbuild: {
      target: 'node18',
      minify: false,
      keepNames: true
    },

    // External dependencies that shouldn't be bundled
    external: [
      // Node.js built-ins
      'fs', 'path', 'url', 'crypto', 'child_process', 'os', 'util', 'stream',
      'events', 'buffer', 'querystring', 'http', 'https', 'net', 'tls',

      // Large dependencies that should remain external
      'n3', 'sparqljs', 'nunjucks', 'yaml', 'gray-matter', 'fs-extra',
      'glob', 'chalk', 'consola', 'citty', 'c12', 'isomorphic-git',
      'simple-git', 'vm2', 'ajv', 'ajv-formats', 'validator',
      'rdf-validate-shacl', 'shacl-engine', 'jose', 'crypto-js',
      'node-forge', 'hash-wasm', 'fflate', 'multiformats',
      'jsondiffpatch', 'table',

      // Crypto and security
      '@noble/curves', '@noble/ed25519', '@noble/secp256k1',

      // RDF and semantic web
      '@rdfjs/data-model', '@rdfjs/dataset', 'clownface', 'rdf-ext',

      // OpenTelemetry (heavy and optional)
      '@opentelemetry/api', '@opentelemetry/resources',
      '@opentelemetry/sdk-node', '@opentelemetry/sdk-trace-node',
      '@opentelemetry/semantic-conventions',

      // DOMPurify (browser/isomorphic)
      'isomorphic-dompurify',

      // Development/testing dependencies
      'bcryptjs', 'jsonwebtoken', 'chai', 'vitest', '@cucumber/cucumber'
    ],

    // Input/output options
    inlineDependencies: true,

    // Preserve module structure for internal modules
    preserveModules: false
  },

  // TypeScript configuration
  typescript: {
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'Node',
      allowSyntheticDefaultImports: true,
      esModuleInterop: true,
      strict: false,
      skipLibCheck: true,
      declaration: true,
      declarationMap: true,
      sourceMap: true
    }
  },

  // Path aliases
  alias: {
    '@kgen/core': resolve('./packages/kgen-core/src'),
    '@kgen/cli': resolve('./packages/kgen-cli/src'),
    '@kgen/templates': resolve('./packages/kgen-templates/src'),
    '@kgen/rules': resolve('./packages/kgen-rules/src'),
    '@kgen/marketplace': resolve('./packages/kgen-marketplace/src'),
    '@': resolve('./src')
  },

  // Development mode configuration
  dev: {
    watch: ['src', 'packages/*/src']
  },

  // Production optimizations
  preset: 'node',

  // Hooks for custom processing
  hooks: {
    'build:prepare': async (ctx) => {
      console.log('🚀 Preparing unbuild for KGEN monorepo...')
    },
    'build:done': async (ctx) => {
      console.log('✅ Unbuild completed successfully!')
      console.log(`📦 Built ${ctx.buildEntries.length} entries`)
      console.log(`📁 Output directory: ${ctx.options.outDir}`)
    }
  },

  // Fail on warnings in production
  failOnWarn: false,

  // Replace values during build
  // Don't fail on warnings
  failOnWarn: false,

  replace: {
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development'),
    __VERSION__: JSON.stringify(process.env.npm_package_version || '0.1.0')
  }
})