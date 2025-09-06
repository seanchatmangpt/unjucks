/**
 * Semantic Validation Types
 * Core type definitions for the validation pipeline
 * 
 * NOTE: ValidationResult, ValidationError, ValidationWarning, etc. are now imported from unified-types.ts
 * This file contains semantic-specific validation types that extend the base validation system.
 */

import type {
  ValidationResult,
  ValidationErrorDetail as ValidationError,
  ValidationWarning,
  ValidationMetadata,
  ValidationLocation,
  ValidationErrorType,
  ValidationWarningType,
  PerformanceMetrics
} from '../../types/unified-types.js';

// Semantic-specific validation metadata extending the base metadata
export interface SemanticValidationMetadata extends ValidationMetadata {
  validator: string;
  version: string;
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

// PerformanceMetrics is now imported from unified-types.ts
// This extends it with semantic-specific metrics
export interface SemanticPerformanceMetrics extends PerformanceMetrics {
  ioOperations: number;
}

// ValidationErrorType and ValidationWarningType are now defined in unified-types.ts
// These extend the base types with semantic-specific validation types
export type SemanticValidationErrorType = ValidationErrorType |
  'shape_violation' |
  'consistency_error' |
  'template_error' |
  'generation_error';

export type SemanticValidationWarningType = ValidationWarningType |
  'style_issue' |
  'compatibility_issue' |
  'maintainability_concern';

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