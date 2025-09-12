/**
 * KGEN Frontmatter System - Main Entry Point
 * 
 * Comprehensive frontmatter workflow system for KGEN that enables metadata-driven
 * template processing with deterministic output, provenance tracking, and audit trails.
 */

export { FrontmatterWorkflowEngine } from './workflow-engine.js';
export { FrontmatterParser } from './parser.js';
export { PathResolver } from './path-resolver.js';
export { ConditionalProcessor } from './conditional-processor.js';
export { OperationEngine } from './operation-engine.js';
export { SchemaValidator } from './schema-validator.js';
export { MetadataExtractor } from './metadata-extractor.js';

/**
 * Create a configured frontmatter workflow engine
 * @param {Object} config - Configuration options
 * @returns {FrontmatterWorkflowEngine} Configured workflow engine
 */
export function createFrontmatterWorkflow(config = {}) {
  const { FrontmatterWorkflowEngine } = await import('./workflow-engine.js');
  return new FrontmatterWorkflowEngine(config);
}

/**
 * Quick template processing function
 * @param {string} templateContent - Template content with frontmatter
 * @param {Object} context - Template rendering context
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} Processing result
 */
export async function processTemplate(templateContent, context = {}, options = {}) {
  const engine = await createFrontmatterWorkflow(options);
  await engine.initialize();
  
  try {
    const result = await engine.processTemplate(templateContent, context, options);
    return result;
  } finally {
    await engine.shutdown();
  }
}

/**
 * Batch process multiple templates
 * @param {Array} templates - Array of {content, context} objects
 * @param {Object} globalOptions - Global processing options
 * @returns {Promise<Object>} Batch processing result
 */
export async function processTemplates(templates, globalOptions = {}) {
  const engine = await createFrontmatterWorkflow(globalOptions);
  await engine.initialize();
  
  try {
    const result = await engine.processTemplates(templates, globalOptions);
    return result;
  } finally {
    await engine.shutdown();
  }
}

/**
 * Validate template frontmatter
 * @param {string} templateContent - Template content
 * @param {string} schemaName - Schema name to validate against
 * @returns {Promise<Object>} Validation result
 */
export async function validateTemplate(templateContent, schemaName = 'default') {
  const engine = await createFrontmatterWorkflow();
  await engine.initialize();
  
  try {
    const result = await engine.validateTemplate(templateContent, schemaName);
    return result;
  } finally {
    await engine.shutdown();
  }
}

/**
 * Extract variables from template
 * @param {string} templateContent - Template content
 * @returns {Promise<Object>} Variable extraction result
 */
export async function extractVariables(templateContent) {
  const engine = await createFrontmatterWorkflow();
  await engine.initialize();
  
  try {
    const result = await engine.extractVariables(templateContent);
    return result;
  } finally {
    await engine.shutdown();
  }
}

/**
 * Default configuration for production use
 */
export const DEFAULT_CONFIG = {
  enableValidation: true,
  enableProvenance: true,
  enableConditionalProcessing: true,
  enableSchemaValidation: true,
  maxConcurrentOperations: 10,
  deterministic: true,
  auditTrail: true,
  errorHandling: {
    enableRecovery: true,
    maxRetryAttempts: 3,
    retryDelay: 1000,
    enableEventEmission: true
  }
};

/**
 * Configuration for development use
 */
export const DEV_CONFIG = {
  ...DEFAULT_CONFIG,
  enableValidation: false,
  enableProvenance: false,
  maxConcurrentOperations: 5,
  deterministic: false,
  errorHandling: {
    enableRecovery: false,
    maxRetryAttempts: 1,
    retryDelay: 500
  }
};

/**
 * Configuration for testing use
 */
export const TEST_CONFIG = {
  ...DEFAULT_CONFIG,
  enableProvenance: false,
  maxConcurrentOperations: 1,
  deterministic: true,
  enableBackups: false,
  enableRollback: false
};

export default {
  FrontmatterWorkflowEngine,
  FrontmatterParser,
  PathResolver,
  ConditionalProcessor,
  OperationEngine,
  SchemaValidator,
  MetadataExtractor,
  createFrontmatterWorkflow,
  processTemplate,
  processTemplates,
  validateTemplate,
  extractVariables,
  DEFAULT_CONFIG,
  DEV_CONFIG,
  TEST_CONFIG
};