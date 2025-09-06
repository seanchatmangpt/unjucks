/**
 * Semantic Template Renderer - RDF-aware Nunjucks template engine
 * Converts RDF knowledge into executable code with semantic understanding
 */

import nunjucks from 'nunjucks';
import { Store, Quad, DataFactory, Parser, Writer } from 'n3';
import { FrontmatterParser, type FrontmatterConfig } from './frontmatter-parser.js';
import { TurtleParser, type TurtleParseResult, TurtleUtils } from './turtle-parser.js';
import { RDFDataLoader, type RDFDataResult } from './rdf-data-loader.js';
import type { 
  RDFTemplateContext, 
  RDFResource, 
  RDFValue,
  CommonVocabularies,
  RDFNamespaceConfig,
  RDFValidationResult
} from './types/turtle-types.js';
import fs from 'fs-extra';
import path from 'node:path';

/**
 * Semantic template configuration
 */
export interface SemanticTemplateConfig extends FrontmatterConfig {
  // Semantic-specific configuration
  ontology?: string | string[];
  semanticValidation?: boolean;
  ontologyCache?: boolean;
  reasoning?: 'none' | 'rdfs' | 'owl';
  consistency?: 'strict' | 'permissive';
  
  // Multi-ontology support
  ontologies?: {
    [key: string]: {
      uri: string;
      prefix?: string;
      version?: string;
      local?: string;
    };
  };
  
  // Semantic filters
  semanticFilters?: {
    [filterName: string]: string; // SPARQL-like queries
  };
  
  // Compliance requirements
  compliance?: {
    framework: string;
    version: string;
    rules: string[];
  };
}

/**
 * Semantic rendering context with enhanced RDF capabilities
 */
export interface SemanticRenderingContext extends RDFTemplateContext {
  // Ontology-specific contexts
  $ontologies: {
    [key: string]: {
      store: Store;
      prefixes: Record<string, string>;
      classes: RDFResource[];
      properties: RDFResource[];
      individuals: RDFResource[];
    };
  };
  
  // Semantic reasoning results
  $inferences: {
    derivedTriples: Quad[];
    classifications: Record<string, string[]>;
    inconsistencies: string[];
  };
  
  // Compliance context
  $compliance: {
    framework: string;
    version: string;
    validationResults: Record<string, boolean>;
    warnings: string[];
  };
  
  // Performance monitoring
  $performance: {
    renderTime: number;
    ontologyLoadTime: number;
    reasoningTime: number;
    queryExecutionTime: number;
  };
}

/**
 * Ontology information for caching and validation
 */
export interface OntologyInfo {
  uri: string;
  localPath?: string;
  lastModified?: Date;
  version?: string;
  classes: string[];
  properties: string[];
  individuals: string[];
  imports: string[];
  store: Store;
}

/**
 * Semantic validation result
 */
export interface SemanticValidationResult extends RDFValidationResult {
  ontologyConsistency: boolean;
  typeChecking: boolean;
  propertyDomainRange: boolean;
  cardinalityConstraints: boolean;
  semanticWarnings: Array<{
    type: 'inconsistency' | 'type-error' | 'cardinality' | 'domain-range';
    message: string;
    subject?: string;
    predicate?: string;
    object?: string;
  }>;
}

/**
 * Performance metrics for semantic rendering
 */
export interface SemanticPerformanceMetrics {
  ontologyLoadTime: number;
  reasoningTime: number;
  templateRenderTime: number;
  totalTime: number;
  queriesExecuted: number;
  triplesProcessed: number;
  memoryUsed: number;
}

/**
 * Semantic Template Renderer - Main class
 */
export class SemanticRenderer {
  private nunjucksEnv: nunjucks.Environment;
  private frontmatterParser: FrontmatterParser;
  private rdfLoader: RDFDataLoader;
  private ontologyCache: Map<string, OntologyInfo>;
  private performanceMetrics: SemanticPerformanceMetrics;
  
  constructor() {
    // Initialize Nunjucks environment with semantic-aware configuration
    this.nunjucksEnv = new nunjucks.Environment(
      new nunjucks.FileSystemLoader(['templates', '_templates', '.'], {
        noCache: false,
        watch: false
      }),
      {
        autoescape: false,
        throwOnUndefined: false,
        trimBlocks: true,
        lstripBlocks: true
      }
    );
    
    this.frontmatterParser = new FrontmatterParser();
    this.rdfLoader = new RDFDataLoader();
    this.ontologyCache = new Map();
    
    this.performanceMetrics = {
      ontologyLoadTime: 0,
      reasoningTime: 0,
      templateRenderTime: 0,
      totalTime: 0,
      queriesExecuted: 0,
      triplesProcessed: 0,
      memoryUsed: 0
    };
    
    // Register semantic filters
    this.registerSemanticFilters();
  }

  /**
   * Render template with semantic context
   */
  async render(
    templateContent: string,
    variables: Record<string, any> = {},
    config: SemanticTemplateConfig = {}
  ): Promise<{
    rendered: string;
    context: SemanticRenderingContext;
    validation: SemanticValidationResult;
    performance: SemanticPerformanceMetrics;
  }> {
    const startTime = Date.now();
    this.resetPerformanceMetrics();
    
    try {
      // Parse frontmatter
      const { frontmatter, content } = this.frontmatterParser.parse(templateContent);
      const mergedConfig = { ...frontmatter, ...config } as SemanticTemplateConfig;
      
      // Load and process ontologies
      const ontologyStartTime = Date.now();
      const ontologyContext = await this.loadOntologies(mergedConfig);
      this.performanceMetrics.ontologyLoadTime = Date.now() - ontologyStartTime;
      
      // Build semantic context
      const semanticContext = await this.buildSemanticContext(
        variables,
        mergedConfig,
        ontologyContext
      );
      
      // Perform semantic reasoning
      const reasoningStartTime = Date.now();
      const inferences = await this.performReasoning(semanticContext, mergedConfig);
      this.performanceMetrics.reasoningTime = Date.now() - reasoningStartTime;
      
      // Add inferences to context
      semanticContext.$inferences = inferences;
      
      // Validate semantic consistency
      const validation = await this.validateSemanticConsistency(
        semanticContext,
        mergedConfig
      );
      
      // Render template
      const renderStartTime = Date.now();
      const rendered = this.nunjucksEnv.renderString(content, semanticContext);
      this.performanceMetrics.templateRenderTime = Date.now() - renderStartTime;
      
      // Calculate total time
      this.performanceMetrics.totalTime = Date.now() - startTime;
      
      return {
        rendered,
        context: semanticContext,
        validation,
        performance: { ...this.performanceMetrics }
      };
      
    } catch (error) {
      throw new Error(`Semantic rendering failed: ${error.message}`);
    }
  }

  /**
   * Load and cache ontologies
   */
  private async loadOntologies(
    config: SemanticTemplateConfig
  ): Promise<Record<string, OntologyInfo>> {
    const ontologyContext: Record<string, OntologyInfo> = {};
    
    // Handle single ontology
    if (config.ontology) {
      const ontologies = Array.isArray(config.ontology) ? config.ontology : [config.ontology];
      
      for (const ontUri of ontologies) {
        const info = await this.loadOntology(ontUri, config.ontologyCache !== false);
        const key = this.getOntologyKey(ontUri);
        ontologyContext[key] = info;
      }
    }
    
    // Handle multiple ontologies configuration
    if (config.ontologies) {
      for (const [key, ontConfig] of Object.entries(config.ontologies)) {
        const info = await this.loadOntology(ontConfig.uri, config.ontologyCache !== false);
        ontologyContext[key] = info;
      }
    }
    
    return ontologyContext;
  }

  /**
   * Load single ontology
   */
  private async loadOntology(uri: string, useCache: boolean = true): Promise<OntologyInfo> {
    // Check cache first
    if (useCache && this.ontologyCache.has(uri)) {
      return this.ontologyCache.get(uri)!;
    }
    
    let content: string;
    
    // Load ontology content
    if (uri.startsWith('http://') || uri.startsWith('https://')) {
      // TODO: Implement HTTP loading with proper caching
      throw new Error(`HTTP ontology loading not yet implemented: ${uri}`);
    } else {
      // Load from local file
      try {
        content = await fs.readFile(uri, 'utf-8');
      } catch (error) {
        throw new Error(`Failed to load ontology file ${uri}: ${error.message}`);
      }
    }
    
    // Parse ontology
    const parser = new TurtleParser();
    const parseResult = await parser.parse(content);
    
    // Create store
    const store = new Store();
    for (const triple of parseResult.triples) {
      const quad = DataFactory.quad(
        DataFactory.namedNode(triple.subject.value),
        DataFactory.namedNode(triple.predicate.value),
        triple.object.type === 'uri' 
          ? DataFactory.namedNode(triple.object.value)
          : DataFactory.literal(triple.object.value, triple.object.datatype)
      );
      store.add(quad);
    }
    
    // Extract classes, properties, and individuals
    const classes = this.extractClasses(store);
    const properties = this.extractProperties(store);
    const individuals = this.extractIndividuals(store);
    const imports = this.extractImports(store);
    
    const ontologyInfo: OntologyInfo = {
      uri,
      classes: classes.map(c => c.uri),
      properties: properties.map(p => p.uri),
      individuals: individuals.map(i => i.uri),
      imports,
      store,
      lastModified: new Date()
    };
    
    // Cache if enabled
    if (useCache) {
      this.ontologyCache.set(uri, ontologyInfo);
    }
    
    this.performanceMetrics.triplesProcessed += parseResult.triples.length;
    
    return ontologyInfo;
  }

  /**
   * Build semantic rendering context
   */
  private async buildSemanticContext(
    variables: Record<string, any>,
    config: SemanticTemplateConfig,
    ontologies: Record<string, OntologyInfo>
  ): Promise<SemanticRenderingContext> {
    // Load RDF data if configured
    let rdfContext: RDFTemplateContext['$rdf'] | undefined;
    
    if (config.rdf || config.turtle || config.rdfData || config.turtleData) {
      const rdfDataSource = this.frontmatterParser.getRDFConfig(config);
      if (rdfDataSource) {
        const rdfResult = await this.loadRDFData(rdfDataSource);
        rdfContext = this.buildRDFContext(rdfResult);
      }
    }
    
    // Build ontology contexts
    const ontologyContexts: SemanticRenderingContext['$ontologies'] = {};
    for (const [key, ontInfo] of Object.entries(ontologies)) {
      ontologyContexts[key] = {
        store: ontInfo.store,
        prefixes: {}, // TODO: Extract prefixes from ontology
        classes: await this.extractClasses(ontInfo.store),
        properties: await this.extractProperties(ontInfo.store),
        individuals: await this.extractIndividuals(ontInfo.store)
      };
    }
    
    // Build compliance context
    const complianceContext = config.compliance ? {
      framework: config.compliance.framework,
      version: config.compliance.version,
      validationResults: {},
      warnings: []
    } : {
      framework: '',
      version: '',
      validationResults: {},
      warnings: []
    };
    
    return {
      // Spread user variables
      ...variables,
      
      // RDF context (if available)
      ...(rdfContext ? { $rdf: rdfContext } : {}),
      
      // Metadata placeholder
      $metadata: {},
      
      // Ontology contexts
      $ontologies: ontologyContexts,
      
      // Inference placeholder (filled later)
      $inferences: {
        derivedTriples: [],
        classifications: {},
        inconsistencies: []
      },
      
      // Compliance context
      $compliance: complianceContext,
      
      // Performance placeholder
      $performance: {
        renderTime: 0,
        ontologyLoadTime: 0,
        reasoningTime: 0,
        queryExecutionTime: 0
      }
    };
  }

  /**
   * Perform semantic reasoning
   */
  private async performReasoning(
    context: SemanticRenderingContext,
    config: SemanticTemplateConfig
  ): Promise<SemanticRenderingContext['$inferences']> {
    const reasoning = config.reasoning || 'none';
    
    if (reasoning === 'none') {
      return {
        derivedTriples: [],
        classifications: {},
        inconsistencies: []
      };
    }
    
    // TODO: Implement RDFS and OWL reasoning
    // This would include:
    // - RDFS subclass/subproperty inference
    // - Domain/range inference
    // - Type inference
    // - OWL class equivalence, disjointness
    // - Cardinality constraints
    
    return {
      derivedTriples: [],
      classifications: {},
      inconsistencies: []
    };
  }

  /**
   * Validate semantic consistency
   */
  private async validateSemanticConsistency(
    context: SemanticRenderingContext,
    config: SemanticTemplateConfig
  ): Promise<SemanticValidationResult> {
    const result: SemanticValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      ontologyConsistency: true,
      typeChecking: true,
      propertyDomainRange: true,
      cardinalityConstraints: true,
      semanticWarnings: []
    };
    
    if (config.semanticValidation === false) {
      return result;
    }
    
    // TODO: Implement semantic validation
    // - Check ontology consistency
    // - Validate type assignments
    // - Check property domain/range constraints
    // - Validate cardinality constraints
    
    return result;
  }

  /**
   * Register semantic-aware Nunjucks filters
   */
  private registerSemanticFilters(): void {
    // RDF query filter
    this.nunjucksEnv.addFilter('sparql', (store: Store, query: string) => {
      // TODO: Implement SPARQL-like querying
      return [];
    });
    
    // Ontology class filter
    this.nunjucksEnv.addFilter('hasClass', (resource: string, className: string, ontologyKey: string) => {
      // TODO: Check if resource has specified class
      return false;
    });
    
    // Property value filter
    this.nunjucksEnv.addFilter('propertyValue', (subject: string, property: string, ontologyKey: string) => {
      // TODO: Get property value for subject
      return null;
    });
    
    // Semantic validation filter
    this.nunjucksEnv.addFilter('validateDomain', (property: string, resource: string, ontologyKey: string) => {
      // TODO: Validate domain constraints
      return true;
    });
    
    // Compliance check filter
    this.nunjucksEnv.addFilter('compliant', (resource: string, rule: string, framework: string) => {
      // TODO: Check compliance with specific rule
      return true;
    });
    
    // Ontology reasoning filter
    this.nunjucksEnv.addFilter('infer', (store: Store, reasoningType: string) => {
      // TODO: Apply reasoning and return inferred triples
      return [];
    });
    
    // Type checking filter
    this.nunjucksEnv.addFilter('instanceOf', (resource: string, type: string, ontologyKey: string) => {
      // TODO: Check if resource is instance of type
      return false;
    });
  }

  // Helper methods for ontology processing
  private extractClasses(store: Store): RDFResource[] {
    const classes: RDFResource[] = [];
    const rdfType = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
    const rdfsClass = 'http://www.w3.org/2000/01/rdf-schema#Class';
    const owlClass = 'http://www.w3.org/2002/07/owl#Class';
    
    // Query for RDFS and OWL classes
    const classQuads = store.getQuads(null, rdfType, rdfsClass, null)
      .concat(store.getQuads(null, rdfType, owlClass, null));
    
    for (const quad of classQuads) {
      if (quad.subject.termType === 'NamedNode') {
        classes.push({
          uri: quad.subject.value,
          properties: {},
          type: ['Class']
        });
      }
    }
    
    return classes;
  }

  private extractProperties(store: Store): RDFResource[] {
    const properties: RDFResource[] = [];
    const rdfType = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
    const rdfProperty = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#Property';
    const owlObjectProperty = 'http://www.w3.org/2002/07/owl#ObjectProperty';
    const owlDatatypeProperty = 'http://www.w3.org/2002/07/owl#DatatypeProperty';
    
    // Query for RDF and OWL properties
    const propQuads = store.getQuads(null, rdfType, rdfProperty, null)
      .concat(store.getQuads(null, rdfType, owlObjectProperty, null))
      .concat(store.getQuads(null, rdfType, owlDatatypeProperty, null));
    
    for (const quad of propQuads) {
      if (quad.subject.termType === 'NamedNode') {
        properties.push({
          uri: quad.subject.value,
          properties: {},
          type: ['Property']
        });
      }
    }
    
    return properties;
  }

  private extractIndividuals(store: Store): RDFResource[] {
    // TODO: Extract individuals (instances)
    return [];
  }

  private extractImports(store: Store): string[] {
    const imports: string[] = [];
    const owlImports = 'http://www.w3.org/2002/07/owl#imports';
    
    const importQuads = store.getQuads(null, owlImports, null, null);
    for (const quad of importQuads) {
      if (quad.object.termType === 'NamedNode') {
        imports.push(quad.object.value);
      }
    }
    
    return imports;
  }

  private async loadRDFData(rdfSource: any): Promise<RDFDataResult> {
    // Use existing RDFDataLoader
    if (rdfSource.type === 'file') {
      return this.rdfLoader.loadFile(rdfSource.source);
    } else if (rdfSource.type === 'inline') {
      return this.rdfLoader.loadContent(rdfSource.source);
    }
    throw new Error(`Unsupported RDF source type: ${rdfSource.type}`);
  }

  private buildRDFContext(rdfResult: RDFDataResult): RDFTemplateContext['$rdf'] {
    // Convert RDF result to context
    return {
      subjects: {},
      prefixes: {},
      query: () => [],
      getByType: () => [],
      compact: (uri: string) => uri,
      expand: (prefixed: string) => prefixed
    };
  }

  private getOntologyKey(uri: string): string {
    // Extract key from URI
    if (uri.includes('#')) {
      return uri.split('#')[0].split('/').pop() || 'ontology';
    }
    return uri.split('/').pop() || 'ontology';
  }

  private resetPerformanceMetrics(): void {
    this.performanceMetrics = {
      ontologyLoadTime: 0,
      reasoningTime: 0,
      templateRenderTime: 0,
      totalTime: 0,
      queriesExecuted: 0,
      triplesProcessed: 0,
      memoryUsed: 0
    };
  }

  /**
   * Get cached ontology information
   */
  getCachedOntologies(): Map<string, OntologyInfo> {
    return new Map(this.ontologyCache);
  }

  /**
   * Clear ontology cache
   */
  clearOntologyCache(): void {
    this.ontologyCache.clear();
  }

  /**
   * Validate template against ontology
   */
  async validateTemplate(
    templateContent: string,
    config: SemanticTemplateConfig = {}
  ): Promise<SemanticValidationResult> {
    try {
      const { validation } = await this.render(templateContent, {}, config);
      return validation;
    } catch (error) {
      return {
        valid: false,
        errors: [{ message: error.message, severity: 'error' as const }],
        warnings: [],
        ontologyConsistency: false,
        typeChecking: false,
        propertyDomainRange: false,
        cardinalityConstraints: false,
        semanticWarnings: []
      };
    }
  }
}

/**
 * Convenience function for semantic template rendering
 */
export async function renderSemanticTemplate(
  templateContent: string,
  variables: Record<string, any> = {},
  config: SemanticTemplateConfig = {}
): Promise<string> {
  const renderer = new SemanticRenderer();
  const result = await renderer.render(templateContent, variables, config);
  return result.rendered;
}

/**
 * Export default semantic renderer instance
 */
export const semanticRenderer = new SemanticRenderer();

export default SemanticRenderer;