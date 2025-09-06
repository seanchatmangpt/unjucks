/**
 * Common semantic type definitions shared across modules
 * Consolidates duplicate interfaces to avoid export conflicts
 */

// Consolidated PropertyDefinition that works for both RDF and Semantic use cases
export interface PropertyDefinition {
  // Common fields
  uri: string;
  label: string;
  required: boolean;
  
  // Type handling - can be string or complex type
  type?: string | TypescriptType;
  
  // Semantic fields (from semantic-template-engine.ts)
  domain?: string[];
  range?: string[];
  datatype?: string;
  cardinality?: 'single' | 'multiple';
  
  // RDF fields (from rdf-type-converter.ts)  
  name?: string;
  description?: string;
  constraints?: PropertyConstraints;
}

export interface PropertyConstraints {
  minLength?: number;
  maxLength?: number;
  format?: 'email' | 'uri' | 'date' | 'uuid';
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

// Consolidated ValidationRule that works across all modules
export interface ValidationRule {
  id: string;
  type: 'constraint' | 'inference' | 'compliance' | 'semantic' | 'argument';
  
  // Common validation fields
  severity: 'error' | 'warning' | 'info';
  message?: string;
  
  // Semantic validation fields (from semantic-template-engine.ts)
  ontology?: string;
  rule?: string;
  complianceFramework?: string;
  
  // Argument validation fields (from ArgumentValidator.ts)
  validator?: (value: any) => boolean;
  errorMessage?: string;
  
  // Additional metadata
  metadata?: Record<string, any>;
}

// Additional common interfaces used across semantic modules
export interface ClassDefinition {
  uri: string;
  label: string;
  requiredProperties: string[];
  optionalProperties: string[];
  parentClasses: string[];
  validationRules: string[];
}

export interface CrossOntologyRule {
  id: string;
  sourceOntology: string;
  targetOntology: string;
  sourceProperty: string;
  targetProperty: string;
  mappingType: 'equivalent' | 'similar' | 'broader' | 'narrower';
  confidence: number;
}

export interface PerformanceProfile {
  level: 'fast' | 'balanced' | 'comprehensive';
  cacheEnabled: boolean;
  indexingEnabled: boolean;
  parallelProcessing: boolean;
  maxMemoryUsage: number;
  maxProcessingTime: number;
}