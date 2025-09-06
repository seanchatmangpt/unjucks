/**
 * Semantic Validation Types
 * Core type definitions for the validation pipeline
 */

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
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
}

export interface ValidationWarning {
  type: ValidationWarningType;
  message: string;
  code: string;
  location?: ValidationLocation;
  context?: Record<string, any>;
  suggestion?: string;
}

export interface ValidationLocation {
  file?: string;
  line?: number;
  column?: number;
  offset?: number;
  triple?: {
    subject: string;
    predicate: string;
    object: string;
  };
}

export interface ValidationMetadata {
  timestamp: Date;
  validator: string;
  version: string;
  duration: number;
  resourcesValidated: number;
  statistics: ValidationStatistics;
}

export interface ValidationStatistics {
  totalTriples?: number;
  validTriples?: number;
  invalidTriples?: number;
  shapesEvaluated?: number;
  constraintsChecked?: number;
  templatesProcessed?: number;
  codeFilesValidated?: number;
  performanceMetrics?: PerformanceMetrics;
}

export interface PerformanceMetrics {
  memoryUsage: number;
  cpuTime: number;
  ioOperations: number;
  cacheHits: number;
  cacheMisses: number;
}

export type ValidationErrorType =
  | 'syntax_error'
  | 'semantic_error'
  | 'constraint_violation'
  | 'shape_violation'
  | 'consistency_error'
  | 'reference_error'
  | 'type_error'
  | 'format_error'
  | 'template_error'
  | 'generation_error';

export type ValidationWarningType =
  | 'deprecated_usage'
  | 'style_issue'
  | 'performance_concern'
  | 'best_practice'
  | 'compatibility_issue'
  | 'maintainability_concern';

export interface ValidationConfig {
  strictMode: boolean;
  maxErrors: number;
  timeout: number;
  memoryLimit: number;
  enablePerformanceMetrics: boolean;
  cacheEnabled: boolean;
  parallelProcessing: boolean;
  validationRules: ValidationRuleConfig[];
  shaclShapes?: string[];
  customValidators?: CustomValidatorConfig[];
}

export interface ValidationRuleConfig {
  name: string;
  enabled: boolean;
  severity: 'error' | 'warning' | 'info';
  parameters?: Record<string, any>;
}

export interface CustomValidatorConfig {
  name: string;
  type: 'code' | 'template' | 'rdf' | 'shacl';
  validator: string | Function;
  parameters?: Record<string, any>;
}

export interface BatchValidationRequest {
  items: ValidationItem[];
  config: ValidationConfig;
  parallel: boolean;
  maxConcurrency?: number;
}

export interface ValidationItem {
  id: string;
  type: 'code' | 'template' | 'rdf' | 'ttl';
  content: string;
  metadata?: Record<string, any>;
  dependencies?: string[];
}

export interface BatchValidationResult {
  results: Map<string, ValidationResult>;
  summary: BatchValidationSummary;
  duration: number;
  errors: ValidationError[];
}

export interface BatchValidationSummary {
  totalItems: number;
  validItems: number;
  invalidItems: number;
  skippedItems: number;
  totalErrors: number;
  totalWarnings: number;
  performance: PerformanceMetrics;
}

export interface ShaclValidationReport {
  conforms: boolean;
  results: ShaclValidationResult[];
  shapesGraph: string;
  dataGraph: string;
  metadata: ValidationMetadata;
}

export interface ShaclValidationResult {
  focusNode: string;
  resultPath?: string;
  resultSeverity: 'Violation' | 'Warning' | 'Info';
  resultMessage: string;
  sourceConstraintComponent: string;
  sourceShape: string;
  value?: string;
  detail?: string;
}

export interface TemplateValidationContext {
  templatePath: string;
  variables: Record<string, any>;
  dependencies: string[];
  outputPaths: string[];
  generatedContent: Map<string, string>;
}

export interface CodeValidationContext {
  language: string;
  filePath: string;
  imports: string[];
  exports: string[];
  dependencies: string[];
  ast?: any;
}

export interface RdfValidationContext {
  format: 'turtle' | 'rdf-xml' | 'json-ld' | 'n-triples' | 'n-quads';
  baseUri?: string;
  namespaces: Record<string, string>;
  tripleCount: number;
  subjectCount: number;
  predicateCount: number;
  objectCount: number;
}

export interface ValidationCache {
  get(key: string): ValidationResult | undefined;
  set(key: string, result: ValidationResult): void;
  has(key: string): boolean;
  clear(): void;
  size(): number;
  cleanup(): void;
}

export interface ValidationLogger {
  debug(message: string, context?: Record<string, any>): void;
  info(message: string, context?: Record<string, any>): void;
  warn(message: string, context?: Record<string, any>): void;
  error(message: string, error?: Error, context?: Record<string, any>): void;
  metric(name: string, value: number, tags?: Record<string, string>): void;
}

export interface ValidationRegistry {
  registerValidator(name: string, validator: Validator): void;
  getValidator(name: string): Validator | undefined;
  listValidators(): string[];
  removeValidator(name: string): boolean;
}

export interface Validator {
  name: string;
  version: string;
  type: ValidationItem['type'];
  validate(content: string, config?: ValidationConfig): Promise<ValidationResult>;
  supportsFormat(format: string): boolean;
  getSchema?(): any;
}

export interface SemanticValidationPipeline {
  addValidator(validator: Validator): void;
  removeValidator(name: string): void;
  validate(item: ValidationItem, config?: ValidationConfig): Promise<ValidationResult>;
  validateBatch(request: BatchValidationRequest): Promise<BatchValidationResult>;
  getValidators(): Validator[];
  getMetrics(): ValidationStatistics;
}