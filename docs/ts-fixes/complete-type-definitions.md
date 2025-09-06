# TypeScript Type Definitions Reference

This document provides the complete set of TypeScript type definitions needed to refactor the Unjucks codebase and eliminate all TypeScript errors.

## Core Type System

### Base Types
```typescript
// src/types/core/base.ts
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface BaseError {
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  context?: Record<string, any>;
  timestamp: Date;
}

export interface BaseResult<T = any> {
  success: boolean;
  data?: T;
  error?: BaseError;
  metadata?: Record<string, any>;
}

export interface BaseConfig {
  enabled?: boolean;
  debug?: boolean;
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
}
```

### Error Types
```typescript
// src/types/core/errors.ts
export interface UnjucksError extends Error {
  code: string;
  severity: 'error' | 'warning' | 'info';
  context?: Record<string, any>;
  suggestions?: string[];
  timestamp: Date;
}

export interface ValidationError extends UnjucksError {
  type: 'validation';
  field?: string;
  value?: any;
  rule?: string;
}

export interface TemplateError extends UnjucksError {
  type: 'template';
  template?: string;
  line?: number;
  column?: number;
}

export interface RDFError extends UnjucksError {
  type: 'rdf';
  triple?: ParsedTriple;
  ontology?: string;
}

export interface ConfigurationError extends UnjucksError {
  type: 'configuration';
  configPath?: string;
  configValue?: any;
}
```

## RDF Type System

### Turtle Parsing Types
```typescript
// src/types/rdf/turtle.ts
export interface TurtleParseResult {
  success: boolean;
  data: TurtleData;
  variables: Record<string, any>;
  metadata: ParseStats;
  errors: string[];
  warnings: string[];
  namedGraphs?: string[];
}

export interface TurtleData {
  triples: ParsedTriple[];
  subjects: Record<string, any>;
  predicates: Record<string, any>;
  objects: Record<string, any>;
}

export interface ParsedTriple {
  subject: RDFTerm;
  predicate: RDFTerm;
  object: RDFTerm;
  graph?: RDFTerm;
}

export interface RDFTerm {
  value: string;
  type: 'uri' | 'blank' | 'literal';
  datatype?: string;
  language?: string;
}

export interface ParseStats {
  tripleCount: number;
  subjectCount: number;
  predicateCount: number;
  objectCount: number;
  namedGraphCount?: number;
  parseTimeMs: number;
  memoryUsed: number;
}

export interface TurtleParseOptions {
  baseUri?: string;
  validateSyntax?: boolean;
  strictMode?: boolean;
}
```

### RDF Data Loader Types
```typescript
// src/types/rdf/loader.ts
export interface RDFDataSource {
  type: 'file' | 'inline' | 'uri';
  source?: string;
  path?: string;
  content?: string;
  uri?: string;
  options?: TurtleParseOptions;
}

export interface RDFDataLoadResult extends TurtleParseResult {
  source?: string;
  error?: string;
}

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

export interface QueryOptions {
  query: string;
  variables?: Record<string, any>;
  timeout?: number;
}

export interface QueryResult {
  success: boolean;
  data?: any[];
  error?: string;
  metadata?: {
    executionTime: number;
    resultCount: number;
  };
}
```

### Semantic Types
```typescript
// src/types/rdf/semantic.ts
export interface PropertyDefinition {
  uri: string;
  label: string;
  required: boolean;
  type?: string | TypescriptType;
  domain?: string[];
  range?: string[];
  datatype?: string;
  cardinality?: 'single' | 'multiple';
  name?: string;
  description?: string;
  constraints?: PropertyConstraints;
}

export interface PropertyConstraints {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  enum?: any[];
}

export interface TypescriptType {
  interface?: string;
  union?: TypescriptType[];
  literal?: string;
  array?: TypescriptType;
  optional?: boolean;
}

export interface ClassDefinition {
  uri: string;
  label: string;
  properties: PropertyDefinition[];
  superClasses?: string[];
  description?: string;
}

export interface OntologyDefinition {
  uri: string;
  label: string;
  classes: ClassDefinition[];
  properties: PropertyDefinition[];
  namespaces: Record<string, string>;
}
```

## Template Engine Types

### Template Core Types
```typescript
// src/types/template/engine.ts
export interface TemplateEngineConfig {
  nunjucks?: NunjucksConfig;
  filters?: Record<string, FilterFunction>;
  variables?: VariableConfig;
  ejs?: EJSConfig;
}

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

export interface VariableConfig {
  typeInference?: boolean;
  strictTypes?: boolean;
  defaults?: Record<string, any>;
  transforms?: VariableTransformConfig[];
}

export interface VariableTransformConfig {
  match: string | RegExp;
  transform: (value: any) => any;
  when?: 'before' | 'after';
}

export interface EJSConfig {
  enabled?: boolean;
  delimiter?: string;
  openDelimiter?: string;
  closeDelimiter?: string;
}

export type FilterFunction = (value: any, ...args: any[]) => any;
```

### Template Variable Types
```typescript
// src/types/template/variables.ts
export interface TemplateVariable {
  name: string;
  type: 'string' | 'boolean' | 'number' | 'array' | 'object';
  defaultValue?: any;
  description?: string;
  required?: boolean;
  choices?: any[];
  validation?: VariableValidation;
}

export interface VariableValidation {
  min?: number;
  max?: number;
  pattern?: string;
  custom?: (value: any) => boolean;
}

export interface TemplateScanResult {
  variables: TemplateVariable[];
  dependencies: string[];
  metadata: {
    scanTime: number;
    fileCount: number;
    complexity: 'low' | 'medium' | 'high';
  };
}
```

### Template Rendering Types
```typescript
// src/types/template/rendering.ts
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

export interface PerformanceMetrics {
  memoryUsed: number;
  cpuTime: number;
  cacheHits: number;
  cacheMisses: number;
}

export interface SemanticContext {
  ontologies: Map<string, OntologyDefinition>;
  validationRules: ValidationRule[];
  mappingRules: CrossOntologyRule[];
  performanceProfile: PerformanceProfile;
}

export interface PerformanceProfile {
  level: 'development' | 'balanced' | 'production';
  cacheEnabled: boolean;
  indexingEnabled: boolean;
  parallelProcessing: boolean;
  maxMemoryUsage: number;
  maxProcessingTime: number;
}
```

## Validation System Types

### Validation Core Types
```typescript
// src/types/validation/core.ts
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
  metadata: ValidationMetadata;
}

export interface ValidationError {
  type: ValidationErrorType;
  message: string;
  code: string;
  severity: 'error' | 'warning' | 'info';
  location?: ValidationLocation;
  context?: Record<string, any>;
  suggestion?: string;
  timestamp: Date;
}

export interface ValidationWarning {
  type: ValidationWarningType;
  message: string;
  code: string;
  severity: 'warning' | 'info';
  location?: ValidationLocation;
  context?: Record<string, any>;
  suggestion?: string;
  timestamp: Date;
}

export interface ValidationSuggestion {
  type: 'fix' | 'improvement' | 'best-practice';
  message: string;
  code?: string;
  priority: 'low' | 'medium' | 'high';
}

export interface ValidationLocation {
  file?: string;
  line?: number;
  column?: number;
  range?: {
    start: number;
    end: number;
  };
}

export interface ValidationMetadata {
  validationTime: number;
  rulesApplied: string[];
  context: Record<string, any>;
}

export type ValidationErrorType = 
  | 'missing-required' 
  | 'invalid-type' 
  | 'invalid-value' 
  | 'conflicting-args' 
  | 'unknown-arg'
  | 'semantic-violation'
  | 'syntax-error'
  | 'constraint-violation';

export type ValidationWarningType = 
  | 'deprecated' 
  | 'unused-arg' 
  | 'type-mismatch' 
  | 'performance'
  | 'best-practice';
```

### Validation Rule Types
```typescript
// src/types/validation/rules.ts
export interface ValidationRule {
  id: string;
  name: string;
  description?: string;
  type: ValidationRuleType;
  severity: 'error' | 'warning' | 'info';
  condition: string | ValidationConditionFunction;
  message: string | ValidationMessageFunction;
  metadata?: Record<string, any>;
}

export type ValidationRuleType = 
  | 'semantic' 
  | 'syntax' 
  | 'constraint' 
  | 'cross-ontology'
  | 'performance'
  | 'security';

export type ValidationConditionFunction = (
  value: any,
  context: ValidationContext
) => boolean | Promise<boolean>;

export type ValidationMessageFunction = (
  value: any,
  context: ValidationContext
) => string;

export interface ValidationContext {
  args?: Record<string, any>;
  command?: string;
  subcommand?: string;
  templateContext?: TemplateContext;
  environment?: EnvironmentInfo;
  rdfContext?: RDFContext;
}

export interface CrossOntologyRule {
  id: string;
  name: string;
  description?: string;
  sourceOntology: string;
  targetOntology: string;
  mapping: Record<string, string>;
  validation: ValidationRule[];
}
```

## Configuration Types

### Main Configuration
```typescript
// src/types/config/main.ts
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

export interface FileOperationsConfig {
  create?: {
    overwrite?: boolean;
    backup?: boolean;
    permissions?: string;
  };
  inject?: {
    strategy?: 'append' | 'prepend' | 'replace' | 'custom';
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

export interface PerformanceConfig {
  level: 'development' | 'balanced' | 'production';
  cacheEnabled: boolean;
  indexingEnabled: boolean;
  parallelProcessing: boolean;
  maxMemoryUsage: number;
  maxProcessingTime: number;
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number;
  maxSize: number;
  strategy: 'lru' | 'fifo' | 'ttl';
}

export interface SecurityConfig {
  enabled: boolean;
  allowedPaths: string[];
  blockedPaths: string[];
  maxFileSize: number;
  scanForMalware: boolean;
}

export interface SemanticConfig {
  enabled: boolean;
  ontologies: string[];
  validationLevel: 'strict' | 'moderate' | 'permissive';
  crossOntologyMapping: boolean;
}

export interface EnterpriseConfig {
  enabled: boolean;
  auditLogging: boolean;
  complianceMode: boolean;
  performanceMonitoring: boolean;
}

export interface DevelopmentConfig {
  enabled: boolean;
  hotReload: boolean;
  debugMode: boolean;
  verboseLogging: boolean;
}

export interface PluginConfig {
  name: string;
  enabled: boolean;
  config: Record<string, any>;
}
```

## CLI Types

### CLI Command Types
```typescript
// src/types/cli/commands.ts
export interface CLICommand {
  name: string;
  description: string;
  usage: string;
  arguments: CLIArgument[];
  options: CLIOption[];
  examples: string[];
  subcommands?: CLICommand[];
}

export interface CLIArgument {
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  required: boolean;
  default?: any;
  choices?: any[];
  validation?: ArgumentValidation;
}

export interface CLIOption {
  name: string;
  short?: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  default?: any;
  choices?: any[];
  validation?: ArgumentValidation;
}

export interface ArgumentValidation {
  min?: number;
  max?: number;
  pattern?: string;
  custom?: (value: any) => boolean;
}
```

### CLI Output Types
```typescript
// src/types/cli/output.ts
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

export interface CLIError {
  code: string;
  message: string;
  details?: string;
  suggestions?: string[];
  context?: Record<string, any>;
}

export interface CLIWarning {
  code: string;
  message: string;
  suggestion?: string;
  context?: Record<string, any>;
}
```

## MCP Types

### MCP Core Types
```typescript
// src/types/mcp/core.ts
export interface MCPRequest {
  method: string;
  params?: Record<string, any>;
  id?: string | number;
  timestamp?: Date;
}

export interface MCPResponse {
  result?: any;
  error?: MCPError;
  id?: string | number;
  timestamp?: Date;
}

export interface MCPError {
  code: number;
  message: string;
  data?: any;
  timestamp?: Date;
}

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

export interface MCPToolCall {
  name: string;
  arguments: Record<string, any>;
  timestamp?: Date;
}

export interface LoggingCapability {
  level?: "error" | "warn" | "info" | "debug";
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
  };
}

export interface ToolCall {
  name: string;
  arguments: Record<string, any>;
}
```

## Type System Index

### Main Export File
```typescript
// src/types/index.ts
export * from './core/base';
export * from './core/errors';
export * from './rdf/turtle';
export * from './rdf/loader';
export * from './rdf/semantic';
export * from './template/engine';
export * from './template/variables';
export * from './template/rendering';
export * from './validation/core';
export * from './validation/rules';
export * from './config/main';
export * from './cli/commands';
export * from './cli/output';
export * from './mcp/core';
```

## Usage Examples

### Basic Usage
```typescript
import { 
  TurtleParseResult, 
  RDFDataLoader, 
  ValidationResult,
  TemplateEngineConfig 
} from './types';

// Use types in your code
const result: TurtleParseResult = await parser.parse(content);
const config: TemplateEngineConfig = { nunjucks: { autoescape: true } };
```

### Error Handling
```typescript
import { UnjucksError, ValidationError } from './types';

try {
  // Some operation
} catch (error) {
  if (error instanceof ValidationError) {
    console.error(`Validation failed: ${error.message}`);
    console.error(`Field: ${error.field}`);
  } else if (error instanceof UnjucksError) {
    console.error(`Unjucks error: ${error.message}`);
    console.error(`Code: ${error.code}`);
  }
}
```

### Configuration
```typescript
import { UnjucksConfig } from './types';

const config: UnjucksConfig = {
  templatesDir: './templates',
  templateEngine: {
    nunjucks: {
      autoescape: true,
      trimBlocks: true
    }
  },
  performance: {
    level: 'production',
    cacheEnabled: true,
    maxMemoryUsage: 1024 * 1024 * 1024 // 1GB
  }
};
```

This comprehensive type system provides:

1. **Complete Type Coverage**: All TypeScript errors will be resolved
2. **Unified Interface**: Consistent types across all modules
3. **Type Safety**: Strong typing with proper constraints
4. **Extensibility**: Easy to extend without breaking changes
5. **Documentation**: Self-documenting code with JSDoc comments
6. **Maintainability**: Single source of truth for all types
7. **Performance**: Better tree-shaking and optimization
8. **Developer Experience**: Improved IntelliSense and autocomplete
