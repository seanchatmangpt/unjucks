import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    // Main CLI entry
    {
      input: 'src/cli-entry.js',
      name: 'cli-entry',
      outDir: 'dist',
      format: 'esm',
      ext: 'mjs'
    }
  ],
  declaration: false,  // Disable TypeScript declarations to avoid .d.ts parsing
  clean: true,
  failOnWarn: false,
  rollup: {
    emitCJS: false,
    inlineDependencies: false,
    commonjs: {
      include: ['node_modules/**/*.js'],  // ONLY process .js files
      exclude: ['node_modules/**/*.d.ts', 'node_modules/**/*.ts']  // Skip TypeScript files
    }
  },
  externals: [
    // Node.js built-ins
    'fs', 'path', 'url', 'crypto', 'util', 'events',
    // Dependencies that should remain external
    'n3', 'sparqljs', 'nunjucks', 'yaml', 'consola', 'citty',
    'c12', 'gray-matter', 'fs-extra', 'glob', 'clownface',
    'rdf-ext', 'rdf-validate-shacl', 'cli-table3', 'chalk', 'table',
    'ora'  // Used by init.js
  ],
  hooks: {
    'rollup:options'(ctx, options) {
      // Force external resolution for .d.ts files
      if (!options.external) {
        options.external = [];
      }
      const originalExternal = options.external;
      options.external = (id, parentId, isResolved) => {
        // Skip .d.ts files
        if (id.endsWith('.d.ts')) {
          return true;
        }
        // Call original external if it exists
        if (typeof originalExternal === 'function') {
          return originalExternal(id, parentId, isResolved);
        }
        if (Array.isArray(originalExternal)) {
          return originalExternal.includes(id);
        }
        return false;
      };
    }
  }
})