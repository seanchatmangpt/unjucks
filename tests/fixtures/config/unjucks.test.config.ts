import type { UnjucksConfig } from '../../../src/types/config';

export const testConfig: UnjucksConfig = {
  // Template directories
  templateDirs: [
    'tests/fixtures/basic-generator/_templates',
    'tests/fixtures/complex-generator/_templates',
    'tests/fixtures/injection-templates/_templates',
    'tests/fixtures/variable-parsing/_templates',
    'tests/fixtures/error-scenarios/_templates',
    'tests/fixtures/dry-run-scenarios/_templates',
  ],
  
  // Output configuration
  outputDir: 'tests/fixtures/output',
  
  // Template engine settings
  templateEngine: 'nunjucks',
  templateExtensions: ['.ejs', '.njk', '.hbs'],
  
  // Variable handling
  promptForMissingVars: false, // Don't prompt during tests
  defaultVariables: {
    author: 'Test Suite',
    year: new Date().getFullYear().toString(),
    license: 'MIT',
  },
  
  // File processing
  overwrite: false, // Require explicit --force flag in tests
  dryRun: false,    // Can be overridden per test
  
  // Injection settings
  injection: {
    skipIfExists: true,
    preserveIndentation: true,
    addNewlines: true,
    backupOriginal: false, // Don't create backups during tests
  },
  
  // Validation
  validateTemplates: true,
  validateFrontmatter: true,
  
  // Logging
  verbose: false, // Keep test output clean
  quiet: false,
  
  // Git integration
  gitAdd: false, // Don't automatically git add during tests
  gitCommit: false,
  
  // Performance
  concurrency: 2, // Limit concurrent operations in tests
  
  // Hooks (disabled for basic tests)
  hooks: {
    beforeGenerate: [],
    afterGenerate: [],
    beforeInject: [],
    afterInject: [],
  },
  
  // Custom filters and globals for Nunjucks
  nunjucks: {
    filters: {
      camelCase: (str: string) => str.replace(/-([a-z])/g, (g) => g[1].toUpperCase()),
      pascalCase: (str: string) => str.replace(/(?:^|-)([a-z])/g, (g, c) => c.toUpperCase()),
      kebabCase: (str: string) => str.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, ''),
      title: (str: string) => str.charAt(0).toUpperCase() + str.slice(1),
    },
    globals: {
      currentYear: new Date().getFullYear(),
      testMode: true,
    },
  },
};