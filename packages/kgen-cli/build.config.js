import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    // Skip CLI build due to import issues - build handled by root
    // 'src/index.js'
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

      // CLI dependencies
      'citty', 'consola', 'c12',

      // Workspace packages
      '@kgen/core', '@kgen/rules'
    ],

    inlineDependencies: false
  },

  preset: 'node',

  // Don't fail on warnings
  failOnWarn: false,

  hooks: {
    'build:prepare': async () => {
      console.log('🖥️  Building @kgen/cli...')
    },
    'build:done': async () => {
      console.log('✅ @kgen/cli build completed!')
    }
  }
})