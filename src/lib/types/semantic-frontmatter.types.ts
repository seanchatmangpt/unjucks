/**
 * Types for semantic frontmatter processing and enterprise data sources
 */

export interface SemanticQueryPattern {
  type: 'basic' | 'sparql' | 'graphql';
  subject?: string;
  predicate?: string;
  object?: string;
  query?: string;
  endpoint?: string;
  limit?: number;
  orderBy?: string;
}

export interface SemanticValidationRequirements {
  enabled: boolean;
  ontologies: string[];
  strictMode: boolean;
  complianceFrameworks: ('GDPR' | 'HIPAA' | 'SOX')[];
  requiresValidation: boolean;
}

export interface EnterpriseDataSource {
  id: string;
  type: 'file' | 'uri' | 'graphql' | 'sparql' | 'inline';
  source: string;
  format?: string;
  query?: string;
  endpoint?: string;
  headers?: Record<string, string>;
  priority: 'low' | 'medium' | 'high';
}

export interface VariableEnhancementConfig {
  semanticMapping: boolean;
  typeInference: boolean;
  ontologyContext: string;
  enableInference: boolean;
  performanceOptimization: boolean;
}

export default {
  SemanticQueryPattern,
  SemanticValidationRequirements,
  EnterpriseDataSource,
  VariableEnhancementConfig
};