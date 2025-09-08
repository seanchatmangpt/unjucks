/**
 * Types for the spec-to-code transformation engine
 */

export interface Specification {
  id: string;
  name: string;
  version: string;
  description: string;
  metadata: SpecMetadata;
  entities: Entity[];
  relationships: Relationship[];
  constraints: Constraint[];
  context: SpecContext;
}

export interface SpecMetadata {
  author?: string;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'draft' | 'review' | 'approved' | 'deprecated';
}

export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  properties: Property[];
  methods?: Method[];
  annotations: Annotation[];
  location?: SourceLocation;
}

export interface Property {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: unknown;
  constraints: PropertyConstraint[];
  annotations: Annotation[];
}

export interface Method {
  name: string;
  parameters: Parameter[];
  returnType: string;
  visibility: 'public' | 'private' | 'protected';
  annotations: Annotation[];
  body?: string;
}

export interface Parameter {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: unknown;
}

export interface Relationship {
  id: string;
  type: RelationshipType;
  source: EntityReference;
  target: EntityReference;
  cardinality: Cardinality;
  annotations: Annotation[];
}

export interface Constraint {
  id: string;
  type: ConstraintType;
  description: string;
  entities: string[];
  expression: string;
  severity: 'error' | 'warning' | 'info';
}

export interface SpecContext {
  domain: string;
  technology: TechnologyStack;
  patterns: ArchitecturalPattern[];
  requirements: Requirement[];
}

export interface TechnologyStack {
  language: string;
  framework?: string;
  database?: string;
  runtime?: string;
  dependencies: string[];
}

export interface ArchitecturalPattern {
  name: string;
  type: 'mvc' | 'mvvm' | 'repository' | 'factory' | 'observer' | 'strategy' | 'command' | 'other';
  description: string;
  applications: string[];
}

export interface Requirement {
  id: string;
  type: 'functional' | 'non-functional' | 'business' | 'technical';
  description: string;
  priority: 'must' | 'should' | 'could' | 'wont';
  status: 'pending' | 'in-progress' | 'completed' | 'deferred';
}

export interface TemplateMapping {
  specPattern: SpecPattern;
  templatePath: string;
  variables: VariableMapping[];
  conditions: MappingCondition[];
  priority: number;
}

export interface SpecPattern {
  entityTypes: EntityType[];
  relationshipTypes: RelationshipType[];
  technologyStack: Partial<TechnologyStack>;
  patterns: string[];
}

export interface VariableMapping {
  specPath: string;
  templateVariable: string;
  transformer?: string;
  defaultValue?: unknown;
}

export interface MappingCondition {
  type: 'exists' | 'equals' | 'contains' | 'matches';
  path: string;
  value?: unknown;
  pattern?: string;
}

export interface GenerationResult {
  files: GeneratedFile[];
  traceability: TraceabilityRecord[];
  warnings: GenerationWarning[];
  errors: GenerationError[];
  metadata: GenerationMetadata;
}

export interface GeneratedFile {
  path: string;
  content: string;
  encoding: string;
  permissions?: string;
  sourceElements: string[];
  templateUsed: string;
}

export interface TraceabilityRecord {
  id: string;
  specElementId: string;
  specElementType: string;
  generatedFilePath: string;
  generatedLineRange: LineRange;
  transformationRules: string[];
  timestamp: Date;
}

export interface LineRange {
  start: number;
  end: number;
}

export interface GenerationWarning {
  type: string;
  message: string;
  specElementId?: string;
  templatePath?: string;
  suggestions: string[];
}

export interface GenerationError {
  type: string;
  message: string;
  specElementId?: string;
  templatePath?: string;
  stack?: string;
}

export interface GenerationMetadata {
  specificationId: string;
  timestamp: Date;
  templateVersion: string;
  engineVersion: string;
  duration: number;
  statistics: GenerationStatistics;
}

export interface GenerationStatistics {
  totalFiles: number;
  totalLines: number;
  entitiesProcessed: number;
  relationshipsProcessed: number;
  templatesUsed: string[];
}

export interface SourceLocation {
  file: string;
  line: number;
  column: number;
}

export interface EntityReference {
  entityId: string;
  propertyId?: string;
}

export interface Annotation {
  name: string;
  parameters: Record<string, unknown>;
}

export interface PropertyConstraint {
  type: 'length' | 'range' | 'pattern' | 'unique' | 'required';
  value: unknown;
}

// Enums
export type EntityType = 
  | 'model' 
  | 'service' 
  | 'controller' 
  | 'repository' 
  | 'view' 
  | 'component' 
  | 'middleware' 
  | 'util' 
  | 'config' 
  | 'test';

export type RelationshipType = 
  | 'hasOne' 
  | 'hasMany' 
  | 'belongsTo' 
  | 'belongsToMany' 
  | 'uses' 
  | 'extends' 
  | 'implements' 
  | 'depends';

export type Cardinality = 
  | '1:1' 
  | '1:n' 
  | 'n:1' 
  | 'n:n';

export type ConstraintType = 
  | 'business' 
  | 'technical' 
  | 'security' 
  | 'performance' 
  | 'validation';

export interface ParseOptions {
  strict: boolean;
  validateSchema: boolean;
  includeComments: boolean;
  resolveReferences: boolean;
}

export interface MappingOptions {
  allowPartialMatch: boolean;
  fallbackToDefault: boolean;
  priorityThreshold: number;
  includeExperimental: boolean;
}

export interface GenerationOptions {
  dryRun: boolean;
  overwriteExisting: boolean;
  createDirectories: boolean;
  preserveFormatting: boolean;
  includeTraceability: boolean;
}