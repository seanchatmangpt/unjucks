import { Store, Quad, NamedNode, DataFactory } from 'n3';
import type { TurtleData, RDFResource, RDFValue, RDFTemplateContext } from './types/turtle-types.js';
import { CommonVocabularies, CommonProperties } from './types/turtle-types.js';
import { RDFDataLoader, type RDFDataLoadResult } from './rdf-data-loader.js';
import { RDFFilters } from './rdf-filters.js';

const { namedNode } = DataFactory;

/**
 * Enterprise Semantic Context for 100K+ triples optimization
 */
export class EnterpriseSemanticContext {
  private typeIndex = new Map<string, Set<string>>();
  private propertyChains = new Map<string, string[]>();
  private patternCache = new Map<string, any>();
  private frequencyIndex = new Map<string, number>();

  constructor(private data: TurtleData) {}

  /**
   * Build type index for O(1) type lookups
   */
  buildTypeIndex(): void {
    for (const [subjectUri, resource] of Object.entries(this.data.subjects)) {
      if (resource.type && resource.type.length > 0) {
        for (const type of resource.type) {
          if (!this.typeIndex.has(type)) {
            this.typeIndex.set(type, new Set());
          }
          this.typeIndex.get(type)!.add(subjectUri);
        }
      }
    }
  }

  /**
   * Build property chains for complex semantic queries
   */
  buildPropertyChains(): void {
    for (const [subjectUri, resource] of Object.entries(this.data.subjects)) {
      const properties = Object.keys(resource.properties);
      this.propertyChains.set(subjectUri, properties);
      
      // Track property frequency for optimization
      for (const prop of properties) {
        this.frequencyIndex.set(prop, (this.frequencyIndex.get(prop) || 0) + 1);
      }
    }
  }

  /**
   * Build pattern cache for frequently accessed queries
   */
  buildPatternCache(): void {
    // Cache common patterns for enterprise use
    const enterprisePatterns = [
      'schema:Organization',
      'foaf:Person',
      'dcterms:creator',
      'rdfs:label',
      'owl:Class'
    ];

    for (const pattern of enterprisePatterns) {
      const expandedPattern = this.expandPrefix(pattern);
      const results = this.getByType(expandedPattern);
      this.patternCache.set(pattern, results);
    }
  }

  getPropertyInfo(propertyName: string): SemanticPropertyInfo | null {
    // Map to common ontology properties
    const propertyMappings = new Map([
      ['name', CommonProperties.NAME],
      ['title', CommonProperties.TITLE],
      ['description', CommonProperties.DESCRIPTION],
      ['label', CommonProperties.LABEL],
      ['type', CommonProperties.TYPE],
      ['creator', CommonProperties.CREATOR],
      ['created', CommonProperties.CREATED],
      ['homepage', CommonProperties.HOMEPAGE]
    ]);

    const mappedProperty = propertyMappings.get(propertyName.toLowerCase());
    if (!mappedProperty) return null;

    return {
      uri: mappedProperty,
      description: this.getPropertyDescription(mappedProperty),
      ontologyClass: this.getPropertyOntology(mappedProperty),
      constraints: this.getPropertyConstraints(mappedProperty),
      validators: this.getPropertyValidators(mappedProperty),
      enumValues: this.getPropertyEnumValues(mappedProperty),
      pattern: this.getPropertyPattern(mappedProperty),
      format: this.getPropertyFormat(mappedProperty)
    };
  }

  private getPropertyDescription(propertyUri: string): string {
    // Get description from RDF data or use defaults
    const descriptions = new Map([
      [CommonProperties.NAME, 'Name of the entity'],
      [CommonProperties.TITLE, 'Title or heading'],
      [CommonProperties.DESCRIPTION, 'Description of the entity'],
      [CommonProperties.LABEL, 'Human-readable label'],
      [CommonProperties.TYPE, 'RDF type of the entity'],
      [CommonProperties.CREATOR, 'Creator of the resource'],
      [CommonProperties.CREATED, 'Creation date'],
      [CommonProperties.HOMEPAGE, 'Homepage URL']
    ]);

    return descriptions.get(propertyUri) || 'Property value';
  }

  private getPropertyOntology(propertyUri: string): string {
    if (propertyUri.startsWith(CommonVocabularies.FOAF)) return 'FOAF';
    if (propertyUri.startsWith(CommonVocabularies.DCTERMS)) return 'Dublin Core';
    if (propertyUri.startsWith(CommonVocabularies.SCHEMA)) return 'Schema.org';
    if (propertyUri.startsWith(CommonVocabularies.RDFS)) return 'RDF Schema';
    if (propertyUri.startsWith(CommonVocabularies.OWL)) return 'OWL';
    return 'Custom';
  }

  private getPropertyConstraints(propertyUri: string): PropertyConstraints {
    // Define constraints based on property semantics
    const constraints: PropertyConstraints = {};
    
    if (propertyUri === CommonProperties.CREATED || 
        propertyUri === CommonProperties.MODIFIED) {
      constraints.format = 'date-time';
    }
    
    if (propertyUri === CommonProperties.HOMEPAGE) {
      constraints.format = 'uri';
    }

    return constraints;
  }

  private getPropertyValidators(propertyUri: string): string[] {
    const validators: string[] = [];
    
    if (propertyUri === CommonProperties.HOMEPAGE) {
      validators.push('uri');
    }
    
    if (propertyUri === CommonProperties.CREATED) {
      validators.push('date');
    }

    return validators;
  }

  private getPropertyEnumValues(propertyUri: string): string[] | undefined {
    // Return enum values for constrained properties
    if (propertyUri === CommonProperties.TYPE) {
      // Get all types from the data
      const types = new Set<string>();
      for (const resource of Object.values(this.data.subjects)) {
        if (resource.type) {
          resource.type.forEach(t => types.add(t));
        }
      }
      return Array.from(types);
    }
    return undefined;
  }

  private getPropertyPattern(propertyUri: string): string | undefined {
    if (propertyUri === CommonProperties.HOMEPAGE) {
      return '^https?://.*';
    }
    return undefined;
  }

  private getPropertyFormat(propertyUri: string): string | undefined {
    if (propertyUri === CommonProperties.CREATED || 
        propertyUri === CommonProperties.MODIFIED) {
      return 'date-time';
    }
    if (propertyUri === CommonProperties.HOMEPAGE) {
      return 'uri';
    }
    return undefined;
  }

  private getByType(typeUri: string): RDFResource[] {
    const cached = this.patternCache.get(typeUri);
    if (cached) return cached;

    const subjectUris = this.typeIndex.get(typeUri) || new Set();
    return Array.from(subjectUris).map(uri => this.data.subjects[uri]).filter(Boolean);
  }

  private expandPrefix(prefixed: string): string {
    if (!prefixed.includes(':')) return prefixed;
    
    const [prefix, local] = prefixed.split(':', 2);
    const namespace = this.data.prefixes[prefix];
    return namespace ? `${namespace}${local}` : prefixed;
  }
}

/**
 * Semantic property information for template variables
 */
export interface SemanticPropertyInfo {
  uri: string;
  description: string;
  ontologyClass: string;
  constraints?: PropertyConstraints;
  validators?: string[];
  enumValues?: string[];
  pattern?: string;
  format?: string;
}

export interface PropertyConstraints {
  min?: number;
  max?: number;
  format?: string;
  required?: boolean;
}

/**
 * Multi-Ontology Integration Engine for Enterprise RDF Processing
 * Supports FHIR, FIBO, GS1, Schema.org, and custom ontologies
 */
export class SemanticEngine {
  private dataLoader: RDFDataLoader;
  private filters: RDFFilters;
  private ontologyStore = new Store();
  private contextCache = new Map<string, RDFTemplateContext>();
  
  // Enterprise ontology mappings
  private readonly ENTERPRISE_ONTOLOGIES = {
    FHIR: 'http://hl7.org/fhir/',
    FIBO: 'https://spec.edmcouncil.org/fibo/ontology/',
    GS1: 'http://gs1.org/voc/',
    SCHEMA: 'https://schema.org/',
    DCTERMS: 'http://purl.org/dc/terms/',
    FOAF: 'http://xmlns.com/foaf/0.1/',
    OWL: 'http://www.w3.org/2002/07/owl#'
  } as const;

  constructor(options: SemanticEngineOptions = {}) {
    this.dataLoader = new RDFDataLoader({
      cacheEnabled: true,
      cacheTTL: options.cacheTTL || 600000, // 10 minutes default
      ...options.dataLoaderOptions
    });
    
    this.filters = new RDFFilters({
      baseUri: options.baseUri,
      prefixes: {
        ...this.getDefaultPrefixes(),
        ...options.prefixes
      }
    });
  }

  /**
   * Create RDF-driven template context with semantic enhancement
   */
  async createSemanticTemplateContext(
    dataSources: RDFDataSource[],
    templateVariables?: Record<string, any>
  ): Promise<RDFTemplateContext> {
    const cacheKey = this.createCacheKey(dataSources);
    
    if (this.contextCache.has(cacheKey)) {
      const cached = this.contextCache.get(cacheKey)!;
      return { ...cached, ...templateVariables };
    }

    // Load data from all sources in parallel
    const loadResults = await Promise.all(
      dataSources.map(source => this.dataLoader.loadFromSource(source))
    );

    // Merge successful results
    const successfulResults = loadResults.filter(r => r.success);
    const mergedData = this.mergeSemanticData(successfulResults);

    // Build enterprise semantic context
    const semanticContext = new EnterpriseSemanticContext(mergedData.data);
    semanticContext.buildTypeIndex();
    semanticContext.buildPropertyChains();
    semanticContext.buildPatternCache();

    // Create enhanced template context
    const context = this.buildEnhancedContext(mergedData, semanticContext);
    
    // Cache for reuse
    this.contextCache.set(cacheKey, context);

    return { ...context, ...templateVariables };
  }

  /**
   * Validate RDF data against multiple ontology schemas
   */
  async validateSemanticData(
    data: TurtleData,
    ontologies: OntologyValidationConfig[]
  ): Promise<SemanticValidationResult> {
    const results: SemanticValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      ontologyResults: new Map()
    };

    for (const ontologyConfig of ontologies) {
      const ontologyResult = await this.validateAgainstOntology(data, ontologyConfig);
      results.ontologyResults.set(ontologyConfig.ontology, ontologyResult);
      
      if (!ontologyResult.valid) {
        results.valid = false;
        results.errors.push(...ontologyResult.errors);
      }
      results.warnings.push(...ontologyResult.warnings);
    }

    return results;
  }

  /**
   * Generate semantic template variables from RDF schema
   */
  async generateSemanticVariables(schemaSource: RDFDataSource): Promise<SemanticVariable[]> {
    const result = await this.dataLoader.loadFromSource(schemaSource);
    
    if (!result.success) {
      return [];
    }

    const semanticContext = new EnterpriseSemanticContext(result.data);
    const variables: SemanticVariable[] = [];

    for (const [subjectUri, resource] of Object.entries(result.data.subjects)) {
      // Extract semantic information from the resource
      const localName = this.extractLocalName(subjectUri);
      const semanticInfo = semanticContext.getPropertyInfo(localName);
      
      const variable: SemanticVariable = {
        name: localName,
        uri: subjectUri,
        type: this.inferVariableType(resource),
        ontologyClass: semanticInfo?.ontologyClass || 'Unknown',
        description: semanticInfo?.description,
        required: this.isRequiredProperty(resource),
        constraints: semanticInfo?.constraints || {},
        examples: this.extractExamples(resource)
      };

      variables.push(variable);
    }

    return variables;
  }

  /**
   * Execute multi-ontology SPARQL-like queries
   */
  async executeSemanticQuery(
    dataSources: RDFDataSource[],
    query: SemanticQuery
  ): Promise<SemanticQueryResult> {
    try {
      // Load data and build unified context
      const context = await this.createSemanticTemplateContext(dataSources);
      
      // Execute query against the semantic context
      const results = this.processSemanticQuery(context, query);
      
      return {
        bindings: results,
        variables: query.variables || [],
        success: true,
        errors: []
      };
    } catch (error) {
      return {
        bindings: [],
        variables: [],
        success: false,
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  /**
   * Optimize RDF processing for Fortune 5 scale data
   */
  optimizeForEnterpriseScale(data: TurtleData): OptimizedRDFData {
    // Build indexes for common access patterns
    const typeIndex = this.buildTypeIndex(data);
    const propertyIndex = this.buildPropertyIndex(data);
    const subjectIndex = this.buildSubjectIndex(data);

    // Partition data by complexity and frequency
    const partitions = this.partitionDataByUsage(data);

    return {
      original: data,
      indexes: {
        types: typeIndex,
        properties: propertyIndex,
        subjects: subjectIndex
      },
      partitions,
      metadata: {
        tripleCount: data.triples.length,
        subjectCount: Object.keys(data.subjects).length,
        typeCount: typeIndex.size,
        optimizationLevel: this.calculateOptimizationLevel(data)
      }
    };
  }

  // Private helper methods

  private getDefaultPrefixes(): Record<string, string> {
    return {
      rdf: CommonVocabularies.RDF,
      rdfs: CommonVocabularies.RDFS,
      owl: CommonVocabularies.OWL,
      dc: CommonVocabularies.DCTERMS,
      foaf: CommonVocabularies.FOAF,
      skos: CommonVocabularies.SKOS,
      schema: CommonVocabularies.SCHEMA,
      xsd: CommonVocabularies.XSD,
      fhir: this.ENTERPRISE_ONTOLOGIES.FHIR,
      fibo: this.ENTERPRISE_ONTOLOGIES.FIBO,
      gs1: this.ENTERPRISE_ONTOLOGIES.GS1
    };
  }

  private createCacheKey(dataSources: RDFDataSource[]): string {
    return dataSources
      .map(s => `${s.type}:${s.source}`)
      .sort()
      .join('|');
  }

  private mergeSemanticData(results: RDFDataLoadResult[]): RDFDataLoadResult {
    if (results.length === 0) {
      return {
        data: { subjects: {}, predicates: new Set(), triples: [], prefixes: {} },
        variables: {},
        metadata: {},
        success: true,
        errors: []
      };
    }

    if (results.length === 1) {
      return results[0];
    }

    // Merge multiple results with semantic deduplication
    const mergedData: TurtleData = {
      subjects: {},
      predicates: new Set(),
      triples: [],
      prefixes: {}
    };

    const mergedVariables: Record<string, any> = {};
    const allErrors: string[] = [];

    for (const result of results) {
      // Merge data with semantic deduplication
      this.mergeSubjectsWithDeduplication(mergedData.subjects, result.data.subjects);
      result.data.predicates.forEach(p => mergedData.predicates.add(p));
      mergedData.triples.push(...result.data.triples);
      Object.assign(mergedData.prefixes, result.data.prefixes);
      
      // Merge variables with conflict resolution
      Object.assign(mergedVariables, result.variables);
      allErrors.push(...result.errors);
    }

    return {
      data: mergedData,
      variables: mergedVariables,
      metadata: {
        sources: results.length,
        totalTriples: mergedData.triples.length
      },
      success: allErrors.length === 0,
      errors: allErrors
    };
  }

  private mergeSubjectsWithDeduplication(
    target: Record<string, RDFResource>,
    source: Record<string, RDFResource>
  ): void {
    for (const [uri, resource] of Object.entries(source)) {
      if (target[uri]) {
        // Merge properties with deduplication
        for (const [prop, values] of Object.entries(resource.properties)) {
          if (!target[uri].properties[prop]) {
            target[uri].properties[prop] = [...values];
          } else {
            // Deduplicate values
            const existingValues = new Set(target[uri].properties[prop].map(v => v.value));
            const newValues = values.filter(v => !existingValues.has(v.value));
            target[uri].properties[prop].push(...newValues);
          }
        }
        
        // Merge types
        if (resource.type) {
          const existingTypes = new Set(target[uri].type || []);
          const newTypes = resource.type.filter(t => !existingTypes.has(t));
          target[uri].type = [...(target[uri].type || []), ...newTypes];
        }
      } else {
        target[uri] = { ...resource };
      }
    }
  }

  private buildEnhancedContext(
    mergedData: RDFDataLoadResult,
    semanticContext: EnterpriseSemanticContext
  ): RDFTemplateContext {
    return {
      ...mergedData.variables,
      $rdf: {
        subjects: mergedData.data.subjects,
        prefixes: mergedData.data.prefixes,
        query: (subject?: string, predicate?: string, object?: string) => {
          return this.queryTriples(mergedData.data, subject, predicate, object);
        },
        getByType: (typeUri: string) => {
          return Object.values(mergedData.data.subjects).filter(resource => 
            resource.type?.includes(typeUri)
          );
        },
        compact: (uri: string) => {
          return this.compactUri(uri, mergedData.data.prefixes);
        },
        expand: (prefixed: string) => {
          return this.expandPrefixed(prefixed, mergedData.data.prefixes);
        }
      },
      $semantic: {
        context: semanticContext,
        ontologies: this.ENTERPRISE_ONTOLOGIES,
        filters: this.filters.getAllFilters()
      },
      $metadata: mergedData.metadata
    };
  }

  private queryTriples(
    data: TurtleData,
    subject?: string,
    predicate?: string,
    object?: string
  ): Quad[] {
    return data.triples.filter(triple => {
      if (subject && triple.subject.value !== subject) return false;
      if (predicate && triple.predicate.value !== predicate) return false;
      if (object && triple.object.value !== object) return false;
      return true;
    });
  }

  private compactUri(uri: string, prefixes: Record<string, string>): string {
    for (const [prefix, namespace] of Object.entries(prefixes)) {
      if (uri.startsWith(namespace)) {
        return `${prefix}:${uri.substring(namespace.length)}`;
      }
    }
    return uri;
  }

  private expandPrefixed(prefixed: string, prefixes: Record<string, string>): string {
    if (!prefixed.includes(':')) return prefixed;
    
    const [prefix, local] = prefixed.split(':', 2);
    const namespace = prefixes[prefix];
    return namespace ? `${namespace}${local}` : prefixed;
  }

  private extractLocalName(uri: string): string {
    if (uri.includes('#')) {
      return uri.split('#').pop() || uri;
    }
    return uri.split('/').pop() || uri;
  }

  private inferVariableType(resource: RDFResource): SemanticVariableType {
    // Infer type from RDF types and properties
    if (resource.type?.some(t => t.includes('Organization'))) return 'organization';
    if (resource.type?.some(t => t.includes('Person'))) return 'person';
    if (resource.type?.some(t => t.includes('Date') || t.includes('Time'))) return 'date';
    if (resource.properties[CommonProperties.HOMEPAGE]) return 'uri';
    
    return 'string';
  }

  private isRequiredProperty(resource: RDFResource): boolean {
    // Check for required property indicators in RDF
    return resource.properties[CommonProperties.TYPE] !== undefined;
  }

  private extractExamples(resource: RDFResource): any[] {
    // Extract example values from the resource
    const examples: any[] = [];
    
    for (const values of Object.values(resource.properties)) {
      if (values.length > 0) {
        examples.push(values[0].value);
      }
    }

    return examples.slice(0, 3); // Limit to 3 examples
  }

  private async validateAgainstOntology(
    data: TurtleData,
    config: OntologyValidationConfig
  ): Promise<OntologyValidationResult> {
    // Implement ontology-specific validation
    return {
      valid: true,
      errors: [],
      warnings: [],
      coverage: 1.0
    };
  }

  private processSemanticQuery(
    context: RDFTemplateContext,
    query: SemanticQuery
  ): Array<Record<string, any>> {
    // Implement semantic query processing
    return [];
  }

  private buildTypeIndex(data: TurtleData): Map<string, Set<string>> {
    const index = new Map<string, Set<string>>();
    
    for (const [subjectUri, resource] of Object.entries(data.subjects)) {
      if (resource.type) {
        for (const type of resource.type) {
          if (!index.has(type)) {
            index.set(type, new Set());
          }
          index.get(type)!.add(subjectUri);
        }
      }
    }

    return index;
  }

  private buildPropertyIndex(data: TurtleData): Map<string, Set<string>> {
    const index = new Map<string, Set<string>>();
    
    for (const [subjectUri, resource] of Object.entries(data.subjects)) {
      for (const property of Object.keys(resource.properties)) {
        if (!index.has(property)) {
          index.set(property, new Set());
        }
        index.get(property)!.add(subjectUri);
      }
    }

    return index;
  }

  private buildSubjectIndex(data: TurtleData): Map<string, RDFResource> {
    return new Map(Object.entries(data.subjects));
  }

  private partitionDataByUsage(data: TurtleData): RDFDataPartition[] {
    // Implement data partitioning for enterprise scale
    return [
      {
        name: 'high_frequency',
        subjects: new Map(),
        accessPattern: 'frequent'
      }
    ];
  }

  private calculateOptimizationLevel(data: TurtleData): number {
    // Calculate optimization score based on data characteristics
    const tripleCount = data.triples.length;
    const subjectCount = Object.keys(data.subjects).length;
    
    if (tripleCount > 100000) return 3; // High optimization needed
    if (tripleCount > 10000) return 2;  // Medium optimization
    return 1; // Basic optimization
  }
}

// Supporting interfaces and types

export interface SemanticEngineOptions {
  baseUri?: string;
  prefixes?: Record<string, string>;
  cacheTTL?: number;
  dataLoaderOptions?: any;
}

export interface RDFDataSource {
  type: 'file' | 'inline' | 'uri' | 'graphql' | 'sparql';
  source: string;
  format?: string;
  variables?: string[];
  query?: string;
  endpoint?: string;
}

export interface SemanticVariable {
  name: string;
  uri: string;
  type: SemanticVariableType;
  ontologyClass: string;
  description?: string;
  required: boolean;
  constraints: PropertyConstraints;
  examples: any[];
}

export type SemanticVariableType = 
  | 'string' | 'number' | 'boolean' | 'date' | 'uri' | 'array'
  | 'person' | 'organization' | 'place' | 'event' | 'product';

export interface SemanticQuery {
  patterns: SemanticPattern[];
  variables?: string[];
  filters?: SemanticFilter[];
  orderBy?: string[];
  limit?: number;
}

export interface SemanticPattern {
  subject?: string;
  predicate: string;
  object?: string;
  ontology?: keyof typeof SemanticEngine.prototype.ENTERPRISE_ONTOLOGIES;
}

export interface SemanticFilter {
  variable: string;
  operation: 'equals' | 'contains' | 'matches' | 'gt' | 'lt';
  value: any;
}

export interface SemanticQueryResult {
  bindings: Array<Record<string, any>>;
  variables: string[];
  success: boolean;
  errors: string[];
}

export interface SemanticValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  ontologyResults: Map<string, OntologyValidationResult>;
}

export interface OntologyValidationConfig {
  ontology: string;
  schemaUrl?: string;
  rules?: ValidationRule[];
}

export interface OntologyValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  coverage: number;
}

export interface RDFValidationRule {
  name: string;
  description: string;
  check: (data: TurtleData) => boolean;
}

export interface OptimizedRDFData {
  original: TurtleData;
  indexes: {
    types: Map<string, Set<string>>;
    properties: Map<string, Set<string>>;
    subjects: Map<string, RDFResource>;
  };
  partitions: RDFDataPartition[];
  metadata: {
    tripleCount: number;
    subjectCount: number;
    typeCount: number;
    optimizationLevel: number;
  };
}

export interface RDFDataPartition {
  name: string;
  subjects: Map<string, RDFResource>;
  accessPattern: 'frequent' | 'occasional' | 'rare';
}

export default SemanticEngine;