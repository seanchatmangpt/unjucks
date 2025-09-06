/**
 * Enterprise RDF types for semantic coordination and advanced filtering
 */

export interface ValidationResult {
  valid: boolean;
  missingRequired: string[];
  unexpectedProperties: string[];
  coverage: number;
  complianceScore: number;
}

export interface ExpectedProperties {
  required: string[];
  all: string[];
}

export type ComplianceFramework = 'GDPR' | 'HIPAA' | 'SOX';

export interface ComplianceMapping {
  framework: ComplianceFramework;
  mappedData: Record<string, any>;
  issues: string[];
  complianceScore: number;
  certificationReady: boolean;
}

export interface ComplianceRule {
  property: string;
  mappedField: string;
  description: string;
  dataType: 'personalData' | 'phi' | 'financial';
  constraints: string[];
}

export interface InferredProperties {
  subject: string;
  properties: Record<string, string[]>;
  inferenceRules: string[];
  confidence: number;
  processingTime: number;
}

// SemanticContext moved to semantic-template-engine.ts to avoid duplicate exports
// Use: import { SemanticContext } from '../semantic-template-engine.js';

export interface EnterpriseSemanticContext {
  propertyMappings?: SemanticPropertyMapping[];
  hasOrganizations?: boolean;
  hasPersons?: boolean;
  hasTimestamps?: boolean;
  organizationCount?: number;
  personCount?: number;
  latestTimestamp?: string;
}

export interface SemanticPropertyMapping {
  templateVariable: string;
  semanticProperty: string;
  ontology: string;
  expectedType: string;
  aliases?: string[];
  enhancer?: (value: any) => any;
}

export interface TemplateVariableResult {
  variables: Record<string, any>;
  typeChecks: Record<string, boolean>;
  enhancements: string[];
  inferredCount: number;
  validationScore: number;
}

export interface OptimizedQueryPattern {
  subject?: string;
  predicate?: string;
  object?: string;
  graph?: string;
}

export interface QueryOptimizationOptions {
  useIndex?: boolean;
  deduplicate?: boolean;
  sort?: string;
  limit?: number;
}

export interface OptimizedQueryResult {
  results: any[][];
  resultCount: number;
  executionTime: number;
  optimizations: string[];
  indexUsed: boolean;
  cached: boolean;
}

export default {
  ValidationResult,
  ComplianceMapping,
  InferredProperties,
  EnterpriseSemanticContext,
  TemplateVariableResult,
  OptimizedQueryResult
};