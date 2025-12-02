import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    {
      input: 'src/index',
      name: 'rules-entry',
      outDir: 'dist',
      format: 'esm',
      ext: 'mjs'
    },
    {
      input: 'src/engine/rules-validator',
      outDir: 'dist/engine',
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
    'n3',
    'rdf-validate-shacl',
    '@rdfjs/data-model',
    '@rdfjs/dataset'
  ]
})