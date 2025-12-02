import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    {
      input: 'src/index.js',
      name: 'core',
      outDir: 'dist',
      format: 'esm',
      ext: 'mjs'
    },
    // Submodule exports
    {
      input: 'src/rdf/index.js',
      outDir: 'dist/rdf',
      name: 'rdf-entry',
      format: 'esm',
      ext: 'mjs'
    },
    {
      input: 'src/cas/cas-entry.js',
      outDir: 'dist/cas',
      name: 'cas-entry',
      format: 'esm',
      ext: 'mjs'
    },
    {
      input: 'src/deterministic/index.js',
      outDir: 'dist/deterministic',
      name: 'deterministic-entry',
      format: 'esm',
      ext: 'mjs'
    }
  ],
  declaration: true,
  clean: true,
  failOnWarn: false,
  rollup: {
    emitCJS: false,
    inlineDependencies: false
  },
  externals: [
    'n3', 'rdf-ext', 'rdf-validate-shacl', '@tpluscode/rdf-string',
    'crypto-js', 'c12', 'zod', 'mkdirp', 'yaml', 'sparqljs',
    'gray-matter', 'nunjucks', 'tar-stream', 'pako', 'hash-wasm',
    'multiformats', 'consola', 'events'
  ]
})