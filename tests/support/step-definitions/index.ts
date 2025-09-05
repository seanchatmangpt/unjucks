/**
 * Step Definitions Index
 * Central export point for all step definition libraries
 * Provides easy import and initialization of all step libraries
 */

// Import all step libraries
export { createAdvancedCliSteps } from './advanced-cli-steps';
export { createTemplateEngineSteps } from './template-engine-steps';
export { createFileSystemSteps } from './filesystem-operations-steps';
export { createGeneratorDiscoverySteps } from './generator-discovery-steps';
export { createInjectionOperationSteps } from './injection-operations-steps';
export { createValidationAssertionSteps } from './validation-assertions-steps';

// Export factory and utilities
export {
  StepLibraryFactory,
  createStepLibraries,
  getStepLibrary,
  getAllStepLibraries,
  getPerformanceReport,
  enableStepDebugging,
  disableStepDebugging
} from './step-library-factory';

export type {
  StepLibraryConfig,
  StepLibraryRegistry
} from './step-library-factory';

// Export existing step definitions for backward compatibility
export * from './cli-steps';
export * from './template-steps';
export * from './file-steps';

// Convenience function to initialize all libraries at once
export function initializeAllStepLibraries(config?: any) {
  const factory = createStepLibraries(config);
  
  // Initialize all libraries
  const libraries = factory.getAllLibraries();
  
  return {
    factory,
    libraries,
    advancedCli: libraries.advancedCli,
    templateEngine: libraries.templateEngine,
    fileSystem: libraries.fileSystem,
    generatorDiscovery: libraries.generatorDiscovery,
    injectionOperations: libraries.injectionOperations,
    validationAssertions: libraries.validationAssertions
  };
}

// Library metadata for documentation and tooling
export const STEP_LIBRARY_METADATA = {
  libraries: [
    {
      name: 'advancedCli',
      description: 'Advanced CLI command patterns, variable substitution, output parsing',
      stepCount: 20,
      features: ['variable substitution', 'command pipelines', 'output validation', 'performance checks']
    },
    {
      name: 'templateEngine',
      description: 'Nunjucks rendering, frontmatter handling, template variables',
      stepCount: 25,
      features: ['nunjucks rendering', 'frontmatter parsing', 'variable injection', 'template inheritance']
    },
    {
      name: 'fileSystem',
      description: 'File system operations, permissions, symlinks, watching',
      stepCount: 30,
      features: ['directory operations', 'permissions', 'symlinks', 'file watching']
    },
    {
      name: 'generatorDiscovery',
      description: 'Generator discovery, listing, filtering, help generation',
      stepCount: 15,
      features: ['generator discovery', 'filtering', 'help generation', 'performance validation']
    },
    {
      name: 'injectionOperations',
      description: 'Idempotent file modifications, skipIf conditions',
      stepCount: 18,
      features: ['idempotent injection', 'skipIf conditions', 'force modes', 'JSON injection']
    },
    {
      name: 'validationAssertions',
      description: 'Content matching, structure validation, error scenarios',
      stepCount: 22,
      features: ['content validation', 'structure checks', 'error validation', 'performance assertions']
    }
  ],
  totalSteps: 130,
  coverage: {
    cliCommands: 95,
    templateRendering: 90,
    fileOperations: 85,
    generatorDiscovery: 92,
    injectionOperations: 88,
    validationAssertions: 93
  }
};

// Default export for convenience
export default initializeAllStepLibraries;