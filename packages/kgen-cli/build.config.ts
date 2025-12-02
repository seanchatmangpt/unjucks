import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    {
      input: 'entry/simple-cli.js',
      outDir: 'dist',
      format: 'esm',
      ext: 'mjs'
    }
  ],
  declaration: true,
  clean: true,
  failOnWarn: false,
  rollup: {
    emitCJS: false
  },
  externals: [
    '@kgen/core',
    '@kgen/rules',
    '@kgen/templates',
    'citty',
    'consola',
    'c12'
  ]
})