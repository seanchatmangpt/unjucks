/**
 * Unified TypeScript Type System for Unjucks
 *
 * This file contains all the TypeScript types and interfaces needed to resolve
 * all TypeScript errors in the codebase. It provides a single source of truth
 * for all type definitions across the application.
 *
 * @author Unjucks Type System
 * @version 1.0.0
 */

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Base entity interface for all domain objects
 */
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

/**
 * Base error interface for all error types
 */
export interface BaseError {
  code: string;
  message: string;
  severity: "error" | "warning" | "info";
  context?: Record<string, any>;
  timestamp: Date;
}

/**
 * Base result interface for all operations
 */
export interface BaseResult<T = any> {
  success: boolean;
  data?: T;
  error?: BaseError;
  metadata?: Record<string, any>;
}

/**
 * Base configuration interface
 */
export interface BaseConfig {
  enabled?: boolean;
  debug?: boolean;
  logLevel?: "error" | "warn" | "info" | "debug";
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Main error class for Unjucks
 */
export interface UnjucksError extends Error {
  code: string;
  severity: "error" | "warning" | "info";
  context?: Record<string, any>;
  suggestions?: string[];
  timestamp: Date;
}

/**
 * Validation error interface
 */
export interface ValidationError extends UnjucksError {
  type: "validation";
  field?: string;
  value?: any;
  rule?: string;
}

/**
 * Template error interface
 */
export interface TemplateError extends UnjucksError {
  type: "template";
  template?: string;
  line?: number;
  column?: number;
}

/**
 * RDF error interface
 */
export interface RDFError extends UnjucksError {
  type: "rdf";
  triple?: ParsedTriple;
  ontology?: string;
}

/**
 * Configuration error interface
 */
export interface ConfigurationError extends UnjucksError {
  type: "configuration";
  configPath?: string;
  configValue?: any;
}

// ============================================================================
// RDF TYPES
// ============================================================================

/**
 * RDF term interface
 */
export interface RDFTerm {
  value: string;
  type: "uri" | "blank" | "literal";
  datatype?: string;
  language?: string;
}

/**
 * Parsed triple interface
 */
export interface ParsedTriple {
  subject: RDFTerm;
  predicate: RDFTerm;
  object: RDFTerm;
  graph?: RDFTerm;
}

/**
 * Turtle data structure
 */
export interface TurtleData {
  triples: ParsedTriple[];
  subjects: Record<string, any>;
  predicates: Record<string, any>;
  objects: Record<string, any>;
}

/**
 * Parse statistics
 */
export interface ParseStats {
  tripleCount: number;
  subjectCount: number;
  predicateCount: number;
  objectCount: number;
  namedGraphCount?: number;
  parseTimeMs: number;
  memoryUsed: number;
}

/**
 * Turtle parse options
 */
export interface TurtleParseOptions {
  baseUri?: string;
  validateSyntax?: boolean;
  strictMode?: boolean;
}

/**
 * Turtle parse result
 */
export interface TurtleParseResult {
  success: boolean;
  data: TurtleData;
  variables: Record<string, any>;
  metadata: ParseStats;
  errors: string[];
  warnings: string[];
  namedGraphs?: string[];
}

/**
 * RDF data source interface
 */
export interface RDFDataSource {
  type: "file" | "inline" | "uri";
  source?: string;
  path?: string;
  content?: string;
  uri?: string;
  options?: TurtleParseOptions;
}

/**
 * RDF data load result
 */
export interface RDFDataLoadResult extends TurtleParseResult {
  source?: string;
  error?: string;
}

/**
 * RDF data loader options
 */
export interface RDFDataLoaderOptions {
  baseUri?: string;
  validateSyntax?: boolean;
  cacheEnabled?: boolean;
  cacheTTL?: number;
  httpTimeout?: number;
  templateDir?: string;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * Query options
 */
export interface QueryOptions {
  query: string;
  variables?: Record<string, any>;
  timeout?: number;
}

/**
 * Query result
 */
export interface QueryResult {
  success: boolean;
  data?: any[];
  error?: string;
  metadata?: {
    executionTime: number;
    resultCount: number;
  };
}

// ============================================================================
// SEMANTIC TYPES
// ============================================================================

/**
 * Property constraints
 */
export interface PropertyConstraints {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  enum?: any[];
}

/**
 * TypeScript type definition
 */
export interface TypescriptType {
  interface?: string;
  union?: TypescriptType[];
  literal?: string;
  array?: TypescriptType;
  optional?: boolean;
}

/**
 * Property definition
 */
export interface PropertyDefinition {
  uri: string;
  label: string;
  required: boolean;
  type?: string | TypescriptType;
  domain?: string[];
  range?: string[];
  datatype?: string;
  cardinality?: "single" | "multiple";
  name?: string;
  description?: string;
  constraints?: PropertyConstraints;
}

/**
 * Class definition
 */
export interface ClassDefinition {
  uri: string;
  label: string;
  properties: PropertyDefinition[];
  superClasses?: string[];
  description?: string;
}

/**
 * Ontology definition
 */
export interface OntologyDefinition {
  uri: string;
  label: string;
  classes: ClassDefinition[];
  properties: PropertyDefinition[];
  namespaces: Record<string, string>;
}

// ============================================================================
// TEMPLATE ENGINE TYPES
// ============================================================================

/**
 * Filter function type
 */
export type FilterFunction = (value: any, ...args: any[]) => any;

/**
 * Variable transform configuration
 */
export interface VariableTransformConfig {
  match: string | RegExp;
  transform: (value: any) => any;
  when?: "before" | "after";
}

/**
 * Variable configuration
 */
export interface VariableConfig {
  typeInference?: boolean;
  strictTypes?: boolean;
  defaults?: Record<string, any>;
  transforms?: VariableTransformConfig[];
}

/**
 * Nunjucks configuration
 */
export interface NunjucksConfig {
  autoescape?: boolean;
  throwOnUndefined?: boolean;
  trimBlocks?: boolean;
  lstripBlocks?: boolean;
  tags?: {
    blockStart?: string;
    blockEnd?: string;
    variableStart?: string;
    variableEnd?: string;
    commentStart?: string;
    commentEnd?: string;
  };
  globals?: Record<string, any>;
}

/**
 * EJS configuration
 */
export interface EJSConfig {
  enabled?: boolean;
  delimiter?: string;
  openDelimiter?: string;
  closeDelimiter?: string;
}

/**
 * Template engine configuration
 */
export interface TemplateEngineConfig {
  nunjucks?: NunjucksConfig;
  filters?: Record<string, FilterFunction>;
  variables?: VariableConfig;
  ejs?: EJSConfig;
}

/**
 * Template variable
 */
export interface TemplateVariable {
  name: string;
  type: "string" | "boolean" | "number" | "array" | "object";
  defaultValue?: any;
  description?: string;
  required?: boolean;
  choices?: any[];
  validation?: VariableValidation;
}

/**
 * Variable validation
 */
export interface VariableValidation {
  min?: number;
  max?: number;
  pattern?: string;
  custom?: (value: any) => boolean;
}

/**
 * Template scan result
 */
export interface TemplateScanResult {
  variables: TemplateVariable[];
  dependencies: string[];
  metadata: {
    scanTime: number;
    fileCount: number;
    complexity: "low" | "medium" | "high";
  };
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  memoryUsed: number;
  cpuTime: number;
  ioOperations?: number;
  cacheHits: number;
  cacheMisses: number;
}

/**
 * Semantic render result
 */
export interface SemanticRenderResult {
  content: string;
  metadata: {
    renderTime: number;
    variablesUsed: string[];
    filtersApplied: string[];
    validationResults: ValidationResult[];
    performance: PerformanceMetrics;
  };
  errors: string[];
  warnings: string[];
}

/**
 * Performance profile
 */
export interface PerformanceProfile {
  level: "development" | "balanced" | "production";
  cacheEnabled: boolean;
  indexingEnabled: boolean;
  parallelProcessing: boolean;
  maxMemoryUsage: number;
  maxProcessingTime: number;
}

/**
 * Semantic context
 */
export interface SemanticContext {
  ontologies: Map<string, OntologyDefinition>;
  validationRules: ValidationRule[];
  mappingRules: CrossOntologyRule[];
  performanceProfile: PerformanceProfile;
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * Validation error types
 */
export type ValidationErrorType =
  | "missing-required"
  | "invalid-type"
  | "invalid-value"
  | "conflicting-args"
  | "unknown-arg"
  | "semantic-violation"
  | "syntax-error"
  | "constraint-violation"
  | "semantic_error"
  | "reference_error"
  | "type_error"
  | "performance_concern"
  | "style_issue";

/**
 * Validation warning types
 */
export type ValidationWarningType =
  | "deprecated"
  | "unused-arg"
  | "type-mismatch"
  | "performance"
  | "best-practice"
  | "performance_concern"
  | "style_issue";

/**
 * Validation location
 */
export interface ValidationLocation {
  file?: string;
  line?: number;
  column?: number;
  range?: {
    start: number;
    end: number;
  };
  triple?: {
    subject: string;
    predicate: string;
    object: string;
  };
}

/**
 * Validation error
 */
export interface ValidationErrorDetail {
  type: ValidationErrorType;
  message: string;
  code: string;
  severity: "error" | "warning" | "info";
  location?: ValidationLocation;
  context?: Record<string, any>;
  suggestion?: string;
  timestamp: Date;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  type: ValidationWarningType;
  message: string;
  code: string;
  severity: "warning" | "info";
  location?: ValidationLocation;
  context?: Record<string, any>;
  suggestion?: string;
  timestamp: Date;
}

/**
 * Validation suggestion
 */
export interface ValidationSuggestion {
  type: "fix" | "improvement" | "best-practice";
  message: string;
  code?: string;
  priority: "low" | "medium" | "high";
}

/**
 * Validation metadata
 */
export interface ValidationMetadata {
  timestamp?: Date;
  validationTime: number;
  rulesApplied: string[];
  context: Record<string, any>;
}

/**
 * Validation statistics
 */
export interface ValidationStatistics {
  totalErrors: number;
  totalWarnings: number;
  totalSuggestions: number;
  validationTime: number;
  totalTriples: number;
  rulesExecuted: number;
  performance: {
    memoryUsed: number;
    cpuTime: number;
  };
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationErrorDetail[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
  metadata: ValidationMetadata;
  statistics?: ValidationStatistics;
}

/**
 * CLI Command types
 */
export interface CLICommand {
  name: string;
  description: string;
  args?: CLICommandArgs;
  handler: (args: CLICommandArgs) => Promise<CLICommandResult>;
}

export interface CLICommandArgs {
  [key: string]: any;
}

/**
 * Generate command arguments for citty compatibility
 */
export interface GenerateCommandArgs {
  generator?: string;
  template?: string;
  dest?: string;
  dry?: boolean;
  force?: boolean;
  variables?: Record<string, any>;
  [key: string]: any;
}

/**
 * List command arguments for citty compatibility
 */
export interface ListCommandArgs {
  detailed?: boolean;
  format?: "table" | "json" | "yaml";
  filter?: string;
  [key: string]: any;
}

/**
 * Help command arguments for citty compatibility
 */
export interface HelpCommandArgs {
  command?: string;
  generator?: string;
  detailed?: boolean;
  [key: string]: any;
}

/**
 * Inject command arguments for citty compatibility
 */
export interface InjectCommandArgs {
  file?: string;
  content?: string;
  mode?: InjectionMode;
  before?: string;
  after?: string;
  lineAt?: number;
  force?: boolean;
  dry?: boolean;
  [key: string]: any;
}

export interface CLICommandResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Generator types
 */
export interface GeneratorInfo {
  name: string;
  description: string;
  path: string;
  templates: TemplateInfo[];
  category?: string;
  created?: string;
  modified?: string;
  usage?: string;
}

export interface TemplateInfo {
  name: string;
  description: string;
  path: string;
  variables: TemplateVariable[];
  tags?: string[];
  created?: string;
  modified?: string;
}

export interface TemplateFile {
  path: string;
  content: string;
}

export interface GenerateOptions {
  generator: string;
  template: string;
  dest: string;
  variables: Record<string, any>;
  force?: boolean;
  dry?: boolean;
}

export interface GenerationResult {
  success: boolean;
  files: GeneratedFile[];
  errors: string[];
  warnings: string[];
}

export interface GeneratedFile {
  path: string;
  content: string;
  action: "skipped" | "created" | "updated" | "injected";
}

/**
 * Injection types
 */
export interface InjectionOptions {
  file: string;
  content: string;
  mode: InjectionMode;
  before?: string;
  after?: string;
  lineAt?: number;
  force?: boolean;
  dry?: boolean;
}

export interface InjectionResult {
  success: boolean;
  action: string;
  content?: string;
  error?: string;
}

export type InjectionMode =
  | "inject"
  | "append"
  | "prepend"
  | "before"
  | "after"
  | "replace";

/**
 * Frontmatter types
 */
export interface FrontmatterConfig {
  to?: string;
  inject?: boolean;
  before?: string;
  after?: string;
  append?: boolean;
  prepend?: boolean;
  lineAt?: number;
  skipIf?: string;
  chmod?: string | number;
  sh?: string | string[];
  rdf?: RDFDataSource | RDFDataSource[];
  semanticValidation?: {
    enabled: boolean;
    strictMode?: boolean;
    ontologies?: string[];
  };
  variableEnhancement?: {
    semanticMapping?: boolean;
    crossOntologyMapping?: boolean;
  };
}

export interface ParsedTemplate {
  content: string;
  frontmatter: FrontmatterConfig;
  hasValidFrontmatter: boolean;
}

/**
 * Parser types
 */
export interface ParsedArguments {
  positionals: string[];
  flags: Record<string, boolean>;
  variables: Record<string, any>;
}

export interface ParseContext {
  generator?: string;
  template?: string;
  variables?: TemplateVariable[];
}

/**
 * MCP Tool types
 */
export interface MCPToolResult {
  success: boolean;
  data?: any;
  error?: string;
  content?: Array<{ type: string; text: string }>;
}

/**
 * Validation Rule types
 */
export interface ValidationRule {
  name: string;
  priority: number;
  enabled: boolean;
  validate: (
    args: ParsedArguments,
    context?: ParseContext
  ) => Promise<ValidationResult>;
}
/**
 * Validation rule types
 */
export type ValidationRuleType =
  | "semantic"
  | "syntax"
  | "constraint"
  | "cross-ontology"
  | "performance"
  | "compliance"
  | "data-integrity"
  | "ontology-consistency"
  | "security";

/**
 * Validation condition function
 */
export type ValidationConditionFunction = (
  value: any,
  context: ValidationContext
) => boolean | Promise<boolean>;

/**
 * Validation message function
 */
export type ValidationMessageFunction = (
  value: any,
  context: ValidationContext
) => string;

/**
 * Validation context
 */
export interface ValidationContext {
  args?: Record<string, any>;
  command?: string;
  subcommand?: string;
  templateContext?: TemplateContext;
  environment?: EnvironmentInfo;
  rdfContext?: RDFContext;
}

/**
 * Validation rule
 */
export interface ValidationRule {
  id: string;
  name: string;
  description?: string;
  type: ValidationRuleType;
  severity: "error" | "warning" | "info";
  condition: string | ValidationConditionFunction;
  message: string | ValidationMessageFunction;
  metadata?: Record<string, any>;
}

/**
 * Cross ontology rule
 */
export interface CrossOntologyRule {
  id: string;
  name: string;
  description?: string;
  sourceOntology: string;
  targetOntology: string;
  mapping: Record<string, string>;
  validation: ValidationRule[];
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

/**
 * File operations configuration
 */
export interface FileOperationsConfig {
  create?: {
    overwrite?: boolean;
    backup?: boolean;
    permissions?: string;
  };
  inject?: {
    strategy?: "append" | "prepend" | "replace" | "custom";
    markers?: {
      start?: string;
      end?: string;
    };
  };
  copy?: {
    preservePermissions?: boolean;
    followSymlinks?: boolean;
  };
}

/**
 * Performance configuration
 */
export interface PerformanceConfig {
  level: "development" | "balanced" | "production";
  cacheEnabled: boolean;
  indexingEnabled: boolean;
  parallelProcessing: boolean;
  maxMemoryUsage: number;
  maxProcessingTime: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  enabled: boolean;
  ttl: number;
  maxSize: number;
  strategy: "lru" | "fifo" | "ttl";
}

/**
 * Security configuration
 */
export interface SecurityConfig {
  enabled: boolean;
  allowedPaths: string[];
  blockedPaths: string[];
  maxFileSize: number;
  scanForMalware: boolean;
}

/**
 * Semantic configuration
 */
export interface SemanticConfig {
  enabled: boolean;
  ontologies: string[];
  validationLevel: "strict" | "moderate" | "permissive";
  crossOntologyMapping: boolean;
}

/**
 * Enterprise configuration
 */
export interface EnterpriseConfig {
  enabled: boolean;
  auditLogging: boolean;
  complianceMode: boolean;
  performanceMonitoring: boolean;
}

/**
 * Development configuration
 */
export interface DevelopmentConfig {
  enabled: boolean;
  hotReload: boolean;
  debugMode: boolean;
  verboseLogging: boolean;
}

/**
 * Plugin configuration
 */
export interface PluginConfig {
  name: string;
  enabled: boolean;
  config: Record<string, any>;
}

/**
 * Defaults configuration
 */
export interface DefaultsConfig {
  variables?: Record<string, any>;
  templates?: string[];
  output?: string;
}

/**
 * Hooks configuration
 */
export interface HooksConfig {
  beforeGeneration?: string[];
  afterGeneration?: string[];
  beforeTemplate?: string[];
  afterTemplate?: string[];
}

/**
 * Main Unjucks configuration
 */
export interface UnjucksConfig {
  templatesDir?: string;
  outputDir?: string;
  cacheDir?: string;
  templateEngine?: TemplateEngineConfig;
  fileOperations?: FileOperationsConfig;
  defaults?: DefaultsConfig;
  hooks?: HooksConfig;
  performance?: PerformanceConfig;
  cache?: CacheConfig;
  security?: SecurityConfig;
  validation?: ValidationConfig;
  semantic?: SemanticConfig;
  enterprise?: EnterpriseConfig;
  development?: DevelopmentConfig;
  plugins?: PluginConfig[];
}

/**
 * Validation configuration
 */
export interface ValidationConfig {
  enabled?: boolean;
  strictMode?: boolean;
  maxErrors?: number;
  timeout?: number;
  memoryLimit?: number;
  enablePerformanceMetrics?: boolean;
  cacheEnabled?: boolean;
  parallelProcessing?: boolean;
  validationRules?: ValidationRule[];
  rules?: ValidationRule[];
  customValidators?: Record<string, ValidationConditionFunction>;
}

// ============================================================================
// CLI TYPES
// ============================================================================

/**
 * Argument validation
 */
export interface ArgumentValidation {
  min?: number;
  max?: number;
  pattern?: string;
  custom?: (value: any) => boolean;
}

/**
 * CLI argument
 */
export interface CLIArgument {
  name: string;
  description: string;
  type: "string" | "number" | "boolean" | "array";
  required: boolean;
  default?: any;
  choices?: any[];
  validation?: ArgumentValidation;
}

/**
 * CLI option
 */
export interface CLIOption {
  name: string;
  short?: string;
  description: string;
  type: "string" | "number" | "boolean" | "array";
  default?: any;
  choices?: any[];
  validation?: ArgumentValidation;
}

/**
 * CLI command
 */
export interface CLICommand {
  name: string;
  description: string;
  usage: string;
  arguments: CLIArgument[];
  options: CLIOption[];
  examples: string[];
  subcommands?: CLICommand[];
}

/**
 * CLI error
 */
export interface CLIError {
  code: string;
  message: string;
  details?: string;
  suggestions?: string[];
  context?: Record<string, any>;
}

/**
 * CLI warning
 */
export interface CLIWarning {
  code: string;
  message: string;
  suggestion?: string;
  context?: Record<string, any>;
}

/**
 * CLI output
 */
export interface CLIOutput {
  success: boolean;
  data?: any;
  error?: CLIError;
  warnings?: CLIWarning[];
  metadata?: {
    executionTime: number;
    memoryUsed: number;
    filesProcessed: number;
  };
}

// ============================================================================
// MCP TYPES
// ============================================================================

/**
 * MCP request
 */
export interface MCPRequest {
  method: string;
  params?: Record<string, any>;
  id?: string | number;
  timestamp?: Date;
}

/**
 * MCP response
 */
export interface MCPResponse {
  result?: any;
  error?: MCPError;
  id?: string | number;
  timestamp?: Date;
}

/**
 * MCP error
 */
export interface MCPError {
  code: number;
  message: string;
  data?: any;
  timestamp?: Date;
}

/**
 * MCP tool
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
  outputSchema?: {
    type: "object";
    properties: Record<string, any>;
  };
}

/**
 * MCP tool call
 */
export interface MCPToolCall {
  name: string;
  arguments: Record<string, any>;
  timestamp?: Date;
}

/**
 * Logging capability
 */
export interface LoggingCapability {
  level?: "error" | "warn" | "info" | "debug";
}

/**
 * Tool interface
 */
export interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
  };
}

/**
 * Tool call interface
 */
export interface ToolCall {
  name: string;
  arguments: Record<string, any>;
}

// ============================================================================
// CONTEXT TYPES
// ============================================================================

/**
 * Template context
 */
export interface TemplateContext {
  variables: Record<string, any>;
  metadata: Record<string, any>;
  templatePath?: string;
  outputPath?: string;
}

/**
 * Environment info
 */
export interface EnvironmentInfo {
  nodeVersion: string;
  platform: string;
  arch: string;
  cwd: string;
  env: Record<string, string>;
}

/**
 * RDF context
 */
export interface RDFContext {
  ontologies: OntologyDefinition[];
  baseUri: string;
  namespaces: Record<string, string>;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Generic result type
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Optional type utility
 */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Required type utility
 */
export type Required<T, K extends keyof T> = T & { [P in K]-?: T[P] };

/**
 * Deep partial type utility
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Non-nullable type utility
 */
export type NonNullable<T> = T extends null | undefined ? never : T;

// ============================================================================
// VALIDATOR TYPES
// ============================================================================

/**
 * Generated validator function type
 */
export type ValidatorFunction<T = any> = (
  value: any,
  context?: ValidationContext
) => value is T;

/**
 * Generated validator configuration
 */
export interface ValidatorConfig {
  name: string;
  type: ValidationRuleType;
  schema: any;
  strict?: boolean;
  async?: boolean;
}

/**
 * Validator factory type
 */
export type ValidatorFactory = (
  config: ValidatorConfig
) => ValidatorFunction;

/**
 * Generated validator result
 */
export interface GeneratedValidatorResult {
  isValid: boolean;
  value?: any;
  errors: ValidationErrorDetail[];
  warnings: ValidationWarning[];
  transformedValue?: any;
}

/**
 * Runtime validator interface
 */
export interface RuntimeValidator {
  name: string;
  validate: ValidatorFunction;
  config: ValidatorConfig;
  metadata: {
    generatedAt: Date;
    version: string;
    sourceSchema: any;
  };
}

/**
 * Validator registry interface
 */
export interface ValidatorRegistry {
  register(name: string, validator: RuntimeValidator): void;
  get(name: string): RuntimeValidator | undefined;
  list(): string[];
  unregister(name: string): boolean;
  clear(): void;
}

/**
 * Schema compilation options
 */
export interface SchemaCompilationOptions {
  strict?: boolean;
  allowUnknownKeywords?: boolean;
  removeAdditional?: boolean | "all" | "failing";
  useDefaults?: boolean;
  coerceTypes?: boolean | "array";
  allErrors?: boolean;
}

/**
 * Generated schema validator
 */
export interface GeneratedSchemaValidator {
  validate: ValidatorFunction;
  schema: any;
  compiled: boolean;
  options: SchemaCompilationOptions;
  metadata: {
    compiledAt: Date;
    fingerprint: string;
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * All types are exported from this file to provide a single source of truth
 * for TypeScript type definitions across the Unjucks codebase.
 *
 * Usage:
 * ```typescript
 * import { TurtleParseResult, ValidationResult, UnjucksConfig } from './unified-types';
 * ```
 */
