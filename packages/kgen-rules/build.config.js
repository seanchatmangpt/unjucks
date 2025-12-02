import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    // Main entry - actual existing files
    'src/engine/validator.js'
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
      keepNames: true
    },

    external: [
      // Node.js built-ins
      'fs', 'path', 'url', 'crypto', 'child_process', 'os', 'util', 'stream',
      'events', 'buffer', 'querystring', 'http', 'https', 'net', 'tls',

      // Rules dependencies
      'n3', 'rdf-validate-shacl', '@rdfjs/data-model', '@rdfjs/dataset'
    ],

    inlineDependencies: false
  },

  preset: 'node',

  // Don't fail on warnings
  failOnWarn: false,

  hooks: {
    'build:prepare': async () => {
      console.log('📋 Building @kgen/rules...')
    },
    'build:done': async () => {
      console.log('✅ @kgen/rules build completed!')
    }
  }
})