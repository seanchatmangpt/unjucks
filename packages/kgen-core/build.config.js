import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    // Only build files without complex dependencies
    'src/cache/index.js',
    'src/artifacts/generator.js'
  ],

  outDir: 'dist',
  clean: true,
  sourcemap: true,
  declaration: true,

  rollup: {
    emitCJS: true,
    esbuild: {
      target: 'node18',
      minify: false,
      keepNames: true,
      // Ignore TypeScript files to avoid declaration errors
      exclude: ['**/*.d.ts', '**/*.ts']
    },

    external: [
      // Node.js built-ins
      'fs', 'path', 'url', 'crypto', 'child_process', 'os', 'util', 'stream',
      'events', 'buffer', 'querystring', 'http', 'https', 'net', 'tls',
      'readline', 'perf_hooks', 'zlib',

      // Core dependencies
      'n3', 'rdf-ext', 'rdf-validate-shacl', '@tpluscode/rdf-string',
      'crypto-js', 'c12', 'zod', 'mkdirp', 'yaml', 'sparqljs',
      'gray-matter', 'nunjucks', 'tar-stream', 'pako', 'hash-wasm',
      'multiformats', 'consola', 'events'
    ],

    inlineDependencies: false
  },

  preset: 'node',

  // Don't fail on warnings about missing package.json files
  failOnWarn: false,

  hooks: {
    'build:prepare': async () => {
      console.log('🔧 Building @kgen/core...')
    },
    'build:done': async () => {
      console.log('✅ @kgen/core build completed!')
    }
  }
})