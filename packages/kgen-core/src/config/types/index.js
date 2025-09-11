/**
 * KGEN Configuration TypeScript Type Generation
 * 
 * Generates TypeScript definition files from configuration schemas
 * for enhanced IDE support and type safety.
 * 
 * @author KGEN Config System Developer
 * @version 1.0.0
 */

import { writeFile, mkdir } from 'fs/promises';
import { resolve, dirname } from 'path';
import { existsSync } from 'fs';

/**
 * Generate TypeScript definition files from configuration object
 * 
 * @param {Object} config - Configuration object
 * @param {Object} options - Generation options
 * @param {string} options.outputDir - Output directory for generated types
 * @param {boolean} [options.includeComments=true] - Include JSDoc comments
 * @param {boolean} [options.exportDefault=true] - Export default interface
 * @param {string} [options.interfaceName='KGenConfig'] - Main interface name
 * @returns {Promise<void>}
 */
export async function createConfigTypes(config, options = {}) {
  const {
    outputDir,
    includeComments = true,
    exportDefault = true,
    interfaceName = 'KGenConfig'
  } = options;

  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true });
  }

  // Generate main configuration interface
  const mainInterface = generateMainInterface(config, {
    interfaceName,
    includeComments
  });

  // Generate utility types
  const utilityTypes = generateUtilityTypes();

  // Generate helper types
  const helperTypes = generateHelperTypes();

  // Combine all types
  const typeDefinitions = [
    generateFileHeader(),
    utilityTypes,
    helperTypes,
    mainInterface,
    generateHelperFunctions(interfaceName, exportDefault)
  ].join('\n\n');

  // Write main type definition file
  const mainTypesPath = resolve(outputDir, 'schema.d.ts');
  await writeFile(mainTypesPath, typeDefinitions, 'utf8');

  // Generate individual section types
  await generateSectionTypes(config, outputDir, includeComments);

  // Generate configuration factory types
  await generateFactoryTypes(outputDir, interfaceName);

  console.log(`Generated TypeScript types in ${outputDir}`);
}

/**
 * Generate the main configuration interface
 * 
 * @param {Object} config - Configuration object
 * @param {Object} options - Generation options
 * @returns {string} TypeScript interface definition
 */
function generateMainInterface(config, options) {
  const { interfaceName, includeComments } = options;
  
  let interfaceDef = '';
  
  if (includeComments) {
    interfaceDef += `/**\n * KGEN Configuration Interface\n * \n * Complete type definition for KGEN configuration with\n * IntelliSense support and validation.\n */\n`;
  }
  
  interfaceDef += `export interface ${interfaceName} {\n`;
  
  // $schema property
  if (includeComments) {
    interfaceDef += `  /** JSON Schema reference for validation */\n`;
  }
  interfaceDef += `  $schema?: string;\n\n`;
  
  // Project configuration
  interfaceDef += generateProjectInterface(includeComments);
  
  // Directories configuration
  interfaceDef += generateDirectoriesInterface(includeComments);
  
  // Generation configuration
  interfaceDef += generateGenerateInterface(includeComments);
  
  // Reasoning configuration
  interfaceDef += generateReasoningInterface(includeComments);
  
  // Provenance configuration
  interfaceDef += generateProvenanceInterface(includeComments);
  
  // Impact analysis configuration
  interfaceDef += generateImpactInterface(includeComments);
  
  // Drift detection configuration
  interfaceDef += generateDriftInterface(includeComments);
  
  // Cache configuration
  interfaceDef += generateCacheInterface(includeComments);
  
  // Metrics configuration
  interfaceDef += generateMetricsInterface(includeComments);
  
  // Validation configuration
  interfaceDef += generateValidationInterface(includeComments);
  
  // Security configuration
  interfaceDef += generateSecurityInterface(includeComments);
  
  // Development configuration
  interfaceDef += generateDevInterface(includeComments);
  
  // Environment configurations
  interfaceDef += generateEnvironmentsInterface(includeComments);
  
  // Plugins and features
  interfaceDef += `  /** Plugin configuration */\n`;
  interfaceDef += `  plugins?: (string | PluginConfig)[];\n\n`;
  
  interfaceDef += `  /** Feature flags */\n`;
  interfaceDef += `  features?: FeatureFlags;\n`;
  
  interfaceDef += `}`;
  
  return interfaceDef;
}

/**
 * Generate project interface
 */
function generateProjectInterface(includeComments) {
  let def = '';
  
  if (includeComments) {
    def += `  /** Project metadata configuration */\n`;
  }
  
  def += `  project: {\n`;
  def += `    /** Project name used in reports and attestations */\n`;
  def += `    name: string;\n`;
  def += `    /** Current version of the project knowledge */\n`;
  def += `    version: string;\n`;
  def += `    /** Project description */\n`;
  def += `    description?: string;\n`;
  def += `    /** Project author */\n`;
  def += `    author?: string;\n`;
  def += `    /** Project license */\n`;
  def += `    license?: string;\n`;
  def += `  };\n\n`;
  
  return def;
}

/**
 * Generate directories interface
 */
function generateDirectoriesInterface(includeComments) {
  let def = '';
  
  if (includeComments) {
    def += `  /** Directory structure configuration */\n`;
  }
  
  def += `  directories?: {\n`;
  def += `    /** Root directory for generated artifacts */\n`;
  def += `    out?: string;\n`;
  def += `    /** Directory for stateful files */\n`;
  def += `    state?: string;\n`;
  def += `    /** Content-addressed cache directory */\n`;
  def += `    cache?: string;\n`;
  def += `    /** Nunjucks templates directory */\n`;
  def += `    templates?: string;\n`;
  def += `    /** N3.js rule packs directory */\n`;
  def += `    rules?: string;\n`;
  def += `    /** Knowledge graphs directory */\n`;
  def += `    knowledge?: string;\n`;
  def += `    /** Temporary files directory */\n`;
  def += `    temp?: string;\n`;
  def += `    /** Log files directory */\n`;
  def += `    logs?: string;\n`;
  def += `  };\n\n`;
  
  return def;
}

/**
 * Generate remaining interface sections
 */
function generateGenerateInterface(includeComments) {
  return `  /** Artifact generation configuration */\n  generate?: GenerateConfig;\n\n`;
}

function generateReasoningInterface(includeComments) {
  return `  /** N3.js reasoning engine configuration */\n  reasoning?: ReasoningConfig;\n\n`;
}

function generateProvenanceInterface(includeComments) {
  return `  /** Provenance and attestation configuration */\n  provenance?: ProvenanceConfig;\n\n`;
}

function generateImpactInterface(includeComments) {
  return `  /** Impact analysis configuration */\n  impact?: ImpactConfig;\n\n`;
}

function generateDriftInterface(includeComments) {
  return `  /** Drift detection configuration */\n  drift?: DriftConfig;\n\n`;
}

function generateCacheInterface(includeComments) {
  return `  /** Cache configuration */\n  cache?: CacheConfig;\n\n`;
}

function generateMetricsInterface(includeComments) {
  return `  /** Metrics and monitoring configuration */\n  metrics?: MetricsConfig;\n\n`;
}

function generateValidationInterface(includeComments) {
  return `  /** Validation configuration */\n  validation?: ValidationConfig;\n\n`;
}

function generateSecurityInterface(includeComments) {
  return `  /** Security configuration */\n  security?: SecurityConfig;\n\n`;
}

function generateDevInterface(includeComments) {
  return `  /** Development options */\n  dev?: DevConfig;\n\n`;
}

function generateEnvironmentsInterface(includeComments) {
  return `  /** Environment-specific configurations */\n  environments?: Record<string, Partial<KGenConfig>>;\n\n`;
}

/**
 * Generate utility types
 */
function generateUtilityTypes() {
  return `// Utility Types
export type TimeUnit = string; // Pattern: /^\\d+[smhd]$/
export type SizeUnit = string; // Pattern: /^\\d+[KMGT]?B$/
export type OptimizationLevel = 'none' | 'basic' | 'aggressive';
export type DriftAction = 'fail' | 'warn' | 'fix';
export type ReportType = 'subjects' | 'triples' | 'artifacts';
export type CacheStrategy = 'lru' | 'fifo' | 'lfu';
export type MetricsFormat = 'jsonl' | 'csv' | 'prometheus';
export type ValidationFramework = 'shacl' | 'owl';
export type LoadingStrategy = 'lazy' | 'eager';`;
}

/**
 * Generate helper types for configuration sections
 */
function generateHelperTypes() {
  return `// Configuration Section Types
export interface GenerateConfig {
  defaultTemplate?: string | null;
  globalVars?: Record<string, any>;
  attestByDefault?: boolean;
  engineOptions?: {
    autoescape?: boolean;
    trimBlocks?: boolean;
    lstripBlocks?: boolean;
    throwOnUndefined?: boolean;
  };
  output?: {
    preserveTimestamps?: boolean;
    createDirectories?: boolean;
    fileMode?: number;
    dirMode?: number;
  };
}

export interface ReasoningConfig {
  enabled?: boolean;
  defaultRules?: string | null;
  engine?: {
    maxIterations?: number;
    optimization?: OptimizationLevel;
    parallel?: boolean;
    memoryLimit?: number;
  };
  rules?: {
    autoLoad?: boolean;
    loadingStrategy?: LoadingStrategy;
    cache?: boolean;
  };
}

export interface ProvenanceConfig {
  engineId?: string;
  include?: {
    timestamp?: boolean;
    engineVersion?: boolean;
    graphHash?: boolean;
    templatePath?: boolean;
    rulesUsed?: boolean;
    environment?: boolean;
    system?: boolean;
  };
  signing?: {
    enabled?: boolean;
    algorithm?: 'RS256' | 'ES256' | 'PS256';
    keyPath?: string | null;
    certPath?: string | null;
  };
  blockchain?: {
    enabled?: boolean;
    network?: string;
    contractAddress?: string | null;
  };
}

export interface ImpactConfig {
  defaultReportType?: ReportType;
  depth?: {
    maxDepth?: number;
    includeIndirect?: boolean;
  };
  ignore?: {
    blankNodes?: boolean;
    predicates?: string[];
    filePatterns?: string[];
  };
  output?: {
    format?: string;
    includeDetails?: boolean;
    groupByType?: boolean;
  };
}

export interface DriftConfig {
  onDrift?: DriftAction;
  exitCode?: number;
  include?: string[];
  exclude?: string[];
  detection?: {
    checkContent?: boolean;
    checkPermissions?: boolean;
    checkTimestamps?: boolean;
  };
}

export interface CacheConfig {
  enabled?: boolean;
  storage?: 'file' | 'memory' | 'redis';
  gc?: {
    strategy?: CacheStrategy;
    maxAge?: TimeUnit;
    maxSize?: SizeUnit;
    interval?: TimeUnit;
  };
  policies?: Record<string, {
    ttl?: TimeUnit;
    maxSize?: SizeUnit;
  }>;
}

export interface MetricsConfig {
  enabled?: boolean;
  format?: MetricsFormat;
  file?: string;
  logFields?: string[];
  performance?: {
    enabled?: boolean;
    sampleRate?: number;
    thresholds?: {
      reasoningTime?: number;
      renderingTime?: number;
      totalTime?: number;
    };
  };
  export?: {
    enabled?: boolean;
    interval?: TimeUnit;
    format?: string;
  };
}

export interface ValidationConfig {
  enabled?: boolean;
  shacl?: {
    enabled?: boolean;
    shapesPath?: string | null;
    allowWarnings?: boolean;
  };
  owl?: {
    enabled?: boolean;
    reasoner?: string;
  };
  custom?: {
    enabled?: boolean;
    rulesPath?: string | null;
  };
}

export interface SecurityConfig {
  sanitize?: {
    enabled?: boolean;
    allowedTags?: string[];
    allowedAttributes?: Record<string, any>;
  };
  pathTraversal?: {
    enabled?: boolean;
    allowedPaths?: string[];
  };
  limits?: {
    maxFileSize?: SizeUnit;
    maxGraphSize?: number;
    maxExecutionTime?: TimeUnit;
  };
}

export interface DevConfig {
  generateTypes?: boolean;
  debug?: boolean;
  hotReload?: boolean;
  verbose?: boolean;
  profile?: boolean;
}

export interface PluginConfig {
  name: string;
  options?: Record<string, any>;
}

export interface FeatureFlags {
  experimental?: {
    enabled?: boolean;
    flags?: string[];
  };
}`;
}

/**
 * Generate file header
 */
function generateFileHeader() {
  return `/**
 * KGEN Configuration Types
 * 
 * Auto-generated TypeScript definitions for KGEN configuration.
 * Provides complete IntelliSense support and type safety.
 * 
 * @generated This file is auto-generated. Do not edit manually.
 * @version 1.0.0
 */`;
}

/**
 * Generate helper functions
 */
function generateHelperFunctions(interfaceName, exportDefault) {
  let helpers = `// Configuration Helper Functions

/**
 * Type-safe configuration definition helper
 * Provides IntelliSense and validation for KGEN configurations.
 * 
 * @param config Configuration object
 * @returns Typed configuration object
 */
export function defineConfig(config: ${interfaceName}): ${interfaceName} {
  return config;
}

/**
 * Merge configuration objects with type safety
 * 
 * @param base Base configuration
 * @param override Override configuration
 * @returns Merged configuration
 */
export function mergeConfig(
  base: Partial<${interfaceName}>,
  override: Partial<${interfaceName}>
): ${interfaceName} {
  return { ...base, ...override } as ${interfaceName};
}`;

  if (exportDefault) {
    helpers += `\n\nexport default ${interfaceName};`;
  }

  return helpers;
}

/**
 * Generate individual section type files
 */
async function generateSectionTypes(config, outputDir, includeComments) {
  const sections = [
    'project', 'directories', 'generate', 'reasoning', 'provenance',
    'impact', 'drift', 'cache', 'metrics', 'validation', 'security', 'dev'
  ];

  for (const section of sections) {
    const sectionTypes = generateSectionTypeFile(section, includeComments);
    const sectionPath = resolve(outputDir, `${section}.d.ts`);
    await writeFile(sectionPath, sectionTypes, 'utf8');
  }
}

/**
 * Generate type file for specific configuration section
 */
function generateSectionTypeFile(section, includeComments) {
  return `/**
 * ${section.charAt(0).toUpperCase() + section.slice(1)} Configuration Types
 * 
 * Type definitions for KGEN ${section} configuration section.
 * 
 * @generated This file is auto-generated. Do not edit manually.
 */

import type { ${section.charAt(0).toUpperCase() + section.slice(1)}Config } from './schema';

export type { ${section.charAt(0).toUpperCase() + section.slice(1)}Config };
export default ${section.charAt(0).toUpperCase() + section.slice(1)}Config;`;
}

/**
 * Generate configuration factory types
 */
async function generateFactoryTypes(outputDir, interfaceName) {
  const factoryTypes = `/**
 * KGEN Configuration Factory Types
 * 
 * Factory functions and builders for creating KGEN configurations.
 * 
 * @generated This file is auto-generated. Do not edit manually.
 */

import type { ${interfaceName} } from './schema';

/**
 * Configuration builder pattern interface
 */
export interface ConfigBuilder {
  project(config: ${interfaceName}['project']): ConfigBuilder;
  directories(config: ${interfaceName}['directories']): ConfigBuilder;
  generate(config: ${interfaceName}['generate']): ConfigBuilder;
  reasoning(config: ${interfaceName}['reasoning']): ConfigBuilder;
  provenance(config: ${interfaceName}['provenance']): ConfigBuilder;
  impact(config: ${interfaceName}['impact']): ConfigBuilder;
  drift(config: ${interfaceName}['drift']): ConfigBuilder;
  cache(config: ${interfaceName}['cache']): ConfigBuilder;
  metrics(config: ${interfaceName}['metrics']): ConfigBuilder;
  validation(config: ${interfaceName}['validation']): ConfigBuilder;
  security(config: ${interfaceName}['security']): ConfigBuilder;
  dev(config: ${interfaceName}['dev']): ConfigBuilder;
  environments(config: ${interfaceName}['environments']): ConfigBuilder;
  build(): ${interfaceName};
}

/**
 * Create a configuration builder
 */
export function createConfigBuilder(): ConfigBuilder;

/**
 * Configuration presets
 */
export interface ConfigPresets {
  development(): Partial<${interfaceName}>;
  production(): Partial<${interfaceName}>;
  test(): Partial<${interfaceName}>;
  minimal(): Partial<${interfaceName}>;
  enterprise(): Partial<${interfaceName}>;
}

export const presets: ConfigPresets;`;

  const factoryPath = resolve(outputDir, 'factory.d.ts');
  await writeFile(factoryPath, factoryTypes, 'utf8');
}

export default {
  createConfigTypes,
  generateMainInterface,
  generateUtilityTypes,
  generateHelperTypes
};
