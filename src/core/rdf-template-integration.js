/**
 * RDF Template Integration
 * 
 * Integrates RDF semantic web capabilities with Unjucks template generation pipeline
 * Provides seamless RDF data processing for template variables and filters
 */

import { RDFProcessor } from './rdf.js';
import { Logger } from '../utils/logger.js';

/**
 * @typedef {Object} RDFTemplateConfig
 * @property {Object[]} rdf - RDF data sources
 * @property {string[]} vocabularies - Vocabulary prefixes to load
 * @property {Object} semanticVars - Semantic variable mappings
 * @property {boolean} enableFilters - Enable RDF template filters
 */

/**
 * RDF Template Integration Manager
 * Handles semantic web features in template generation workflow
 */
export class RDFTemplateIntegration {
  constructor(options = {}) {
    this.options = {
      enableCache: options.enableCache !== false,
      cacheSize: options.cacheSize || 500,
      defaultVocabularies: options.defaultVocabularies || ['schema.org', 'foaf'],
      ...options
    };

    this.processor = new RDFProcessor(this.options);
    this.logger = new Logger({ component: 'RDFTemplateIntegration' });
    this.entityCache = new Map();
    this.contextCache = new Map();
  }

  /**
   * Process RDF configuration from template frontmatter
   * @param {RDFTemplateConfig} rdfConfig - RDF configuration
   * @param {Object} templateVars - Template variables
   * @returns {Promise<Object>} Enhanced template context
   */
  async processRDFConfig(rdfConfig, templateVars = {}) {
    if (!rdfConfig) {
      return templateVars;
    }

    try {
      this.logger.info('Processing RDF configuration for template');

      // Load RDF data sources
      if (rdfConfig.rdf && Array.isArray(rdfConfig.rdf)) {
        for (const source of rdfConfig.rdf) {
          await this.processor.loadData(source);
        }
      }

      // Load specified vocabularies
      if (rdfConfig.vocabularies) {
        await this.loadVocabularies(rdfConfig.vocabularies);
      }

      // Process semantic variables
      const semanticContext = await this.createSemanticContext(rdfConfig, templateVars);

      // Merge semantic context with template variables
      const enhancedContext = {
        ...templateVars,
        ...semanticContext,
        rdf: {
          processor: this.processor,
          entity: (uri) => this.getEntityWithCache(uri),
          query: (patterns) => this.processor.query(patterns),
          stats: this.processor.getStoreStats()
        }
      };

      this.logger.info('RDF context enhancement completed', {
        entitiesLoaded: Object.keys(semanticContext.entities || {}).length,
        triplesTotal: this.processor.getStoreStats().tripleCount
      });

      return enhancedContext;
    } catch (error) {
      this.logger.error('Failed to process RDF configuration', error);
      // Return original context on error, don't break template generation
      return templateVars;
    }
  }

  /**
   * Load specified vocabularies
   * @param {string[]} vocabularies - Vocabulary names or URIs
   * @returns {Promise<void>}
   */
  async loadVocabularies(vocabularies) {
    for (const vocab of vocabularies) {
      try {
        if (vocab === 'schema.org') {
          // Load minimal Schema.org subset for performance
          await this.loadSchemaOrgSubset();
        } else if (vocab === 'foaf') {
          await this.loadFOAFVocabulary();
        } else if (vocab.startsWith('http')) {
          // Load from URL
          await this.processor.loadVocabulary(vocab, this.extractPrefixFromURI(vocab));
        } else {
          this.logger.warn(`Unknown vocabulary: ${vocab}`);
        }
      } catch (error) {
        this.logger.error(`Failed to load vocabulary: ${vocab}`, error);
      }
    }
  }

  /**
   * Load minimal Schema.org subset for common use cases
   * @returns {Promise<void>}
   */
  async loadSchemaOrgSubset() {
    const schemaOrgTurtle = `
@prefix schema: <https://schema.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

schema:Person a rdfs:Class ;
  rdfs:label "Person" ;
  rdfs:comment "A person (alive, dead, undead, or fictional)." .

schema:Organization a rdfs:Class ;
  rdfs:label "Organization" ;
  rdfs:comment "An organization such as a school, NGO, corporation, club, etc." .

schema:name a rdf:Property ;
  rdfs:label "name" ;
  rdfs:comment "The name of the item." ;
  rdfs:domain schema:Thing ;
  rdfs:range schema:Text .

schema:email a rdf:Property ;
  rdfs:label "email" ;
  rdfs:comment "Email address." ;
  rdfs:domain schema:Person ;
  rdfs:range schema:Text .

schema:description a rdf:Property ;
  rdfs:label "description" ;
  rdfs:comment "A description of the item." ;
  rdfs:domain schema:Thing ;
  rdfs:range schema:Text .

schema:url a rdf:Property ;
  rdfs:label "url" ;
  rdfs:comment "URL of the item." ;
  rdfs:domain schema:Thing ;
  rdfs:range schema:URL .
`;

    await this.processor.loadData({
      type: 'inline',
      content: schemaOrgTurtle
    });

    this.logger.info('Loaded Schema.org subset vocabulary');
  }

  /**
   * Load FOAF vocabulary subset
   * @returns {Promise<void>}
   */
  async loadFOAFVocabulary() {
    const foafTurtle = `
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

foaf:Person a rdfs:Class ;
  rdfs:label "Person" ;
  rdfs:comment "A person." .

foaf:name a rdf:Property ;
  rdfs:label "name" ;
  rdfs:comment "A name for some thing." ;
  rdfs:domain foaf:Person ;
  rdfs:range rdfs:Literal .

foaf:email a rdf:Property ;
  rdfs:label "email" ;
  rdfs:comment "A personal mailbox." ;
  rdfs:domain foaf:Person .

foaf:homepage a rdf:Property ;
  rdfs:label "homepage" ;
  rdfs:comment "A homepage for some thing." .
`;

    await this.processor.loadData({
      type: 'inline',
      content: foafTurtle
    });

    this.logger.info('Loaded FOAF vocabulary subset');
  }

  /**
   * Create semantic context from RDF configuration
   * @param {RDFTemplateConfig} rdfConfig - RDF configuration
   * @param {Object} templateVars - Template variables
   * @returns {Promise<Object>} Semantic context
   */
  async createSemanticContext(rdfConfig, templateVars) {
    const context = {
      entities: {},
      classes: {},
      properties: {},
      vocabularies: Array.from(this.processor.getVocabularies().keys())
    };

    // Process semantic variable mappings
    if (rdfConfig.semanticVars) {
      for (const [varName, config] of Object.entries(rdfConfig.semanticVars)) {
        if (config.type === 'entity' && config.uri) {
          context.entities[varName] = await this.getEntityWithCache(config.uri);
        } else if (config.type === 'query' && config.pattern) {
          context[varName] = this.processor.query(config.pattern);
        } else if (config.type === 'class' && config.uri) {
          context.classes[varName] = await this.getClassInfo(config.uri);
        }
      }
    }

    // Auto-extract entities from template variables
    if (templateVars) {
      await this.autoExtractEntities(templateVars, context);
    }

    return context;
  }

  /**
   * Auto-extract semantic entities from template variables
   * @param {Object} templateVars - Template variables
   * @param {Object} context - Context to enhance
   * @returns {Promise<void>}
   */
  async autoExtractEntities(templateVars, context) {
    for (const [key, value] of Object.entries(templateVars)) {
      if (typeof value === 'string') {
        // Check if value looks like a URI
        if (value.startsWith('http://') || value.startsWith('https://')) {
          const entity = await this.getEntityWithCache(value);
          if (entity && entity.types.length > 0) {
            context.entities[key] = entity;
          }
        }
        // Check for prefixed URIs
        else if (value.includes(':') && !value.includes(' ')) {
          const expandedUri = this.processor.expandTerm(value)?.value;
          if (expandedUri) {
            const entity = await this.getEntityWithCache(expandedUri);
            if (entity && entity.types.length > 0) {
              context.entities[key] = entity;
            }
          }
        }
      }
    }
  }

  /**
   * Get entity with caching
   * @param {string} uri - Entity URI
   * @returns {Promise<Object>} Entity information
   */
  async getEntityWithCache(uri) {
    if (this.entityCache.has(uri)) {
      return this.entityCache.get(uri);
    }

    const entity = this.processor.getEntity(uri);
    
    if (entity) {
      this.entityCache.set(uri, entity);
      
      // Limit cache size
      if (this.entityCache.size > this.options.cacheSize) {
        const firstKey = this.entityCache.keys().next().value;
        this.entityCache.delete(firstKey);
      }
    }

    return entity;
  }

  /**
   * Get class information including instances
   * @param {string} classUri - Class URI
   * @returns {Promise<Object>} Class information
   */
  async getClassInfo(classUri) {
    const classEntity = await this.getEntityWithCache(classUri);
    
    // Find instances of this class
    const instances = this.processor.query([{
      subject: '?instance',
      predicate: 'rdf:type',
      object: classUri
    }]);

    return {
      ...classEntity,
      instances: instances.map(binding => binding.get('instance')?.value).filter(Boolean),
      instanceCount: instances.length
    };
  }

  /**
   * Extract prefix from URI
   * @param {string} uri - Full URI
   * @returns {string} Suggested prefix
   */
  extractPrefixFromURI(uri) {
    try {
      const url = new URL(uri);
      return url.hostname.split('.')[0] || 'vocab';
    } catch {
      return 'vocab';
    }
  }

  /**
   * Register RDF filters with Nunjucks environment
   * @param {Object} nunjucksEnv - Nunjucks environment
   * @param {RDFTemplateConfig} rdfConfig - RDF configuration
   */
  registerRDFFilters(nunjucksEnv, rdfConfig) {
    if (!rdfConfig?.enableFilters) {
      return;
    }

    try {
      this.processor.registerFilters(nunjucksEnv);
      
      // Add template-specific filters
      nunjucksEnv.addFilter('semanticLabel', (uri) => {
        const entity = this.processor.getEntity(uri);
        return entity?.label || this.processor.getLocalName(uri);
      });

      nunjucksEnv.addFilter('semanticType', (uri) => {
        const entity = this.processor.getEntity(uri);
        return entity?.types[0] ? this.processor.getLocalName(entity.types[0]) : null;
      });

      nunjucksEnv.addFilter('semanticProperty', (uri, property) => {
        const entity = this.processor.getEntity(uri);
        return entity?.properties[property]?.[0]?.value;
      });

      this.logger.info('RDF filters registered with Nunjucks environment');
    } catch (error) {
      this.logger.error('Failed to register RDF filters', error);
    }
  }

  /**
   * Generate semantic patterns for memory storage
   * @returns {Object} Semantic patterns
   */
  generateSemanticPatterns() {
    const patterns = this.processor.generateSemanticPatterns();
    
    // Add integration-specific patterns
    patterns.integration = {
      entityCacheSize: this.entityCache.size,
      contextCacheSize: this.contextCache.size,
      loadedVocabularies: Array.from(this.processor.getVocabularies().keys()),
      templateUsagePatterns: this.extractTemplateUsagePatterns()
    };

    return patterns;
  }

  /**
   * Extract template usage patterns
   * @returns {Object} Usage patterns
   */
  extractTemplateUsagePatterns() {
    return {
      entityAccessFrequency: this.entityCache.size,
      commonEntityTypes: this.extractCommonEntityTypes(),
      filterUsage: 'tracked-via-nunjucks-calls', // Would need hook integration
      queryPatterns: 'stored-in-processor-cache'
    };
  }

  /**
   * Extract common entity types from cache
   * @returns {Object} Common types
   */
  extractCommonEntityTypes() {
    const types = new Map();
    
    for (const entity of this.entityCache.values()) {
      for (const type of entity.types) {
        const localName = this.processor.getLocalName(type);
        types.set(localName, (types.get(localName) || 0) + 1);
      }
    }
    
    return Object.fromEntries(
      Array.from(types.entries()).sort(([,a], [,b]) => b - a).slice(0, 10)
    );
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.entityCache.clear();
    this.contextCache.clear();
    this.processor.clearCache();
  }

  /**
   * Get integration statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      rdfProcessor: this.processor.getStoreStats(),
      entityCache: this.entityCache.size,
      contextCache: this.contextCache.size,
      vocabularies: this.processor.getVocabularies().size
    };
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.clearCache();
    this.processor.destroy();
  }
}

/**
 * Factory function to create RDF template integration
 * @param {Object} options - Configuration options
 * @returns {RDFTemplateIntegration} Integration instance
 */
export function createRDFTemplateIntegration(options = {}) {
  return new RDFTemplateIntegration(options);
}

export default RDFTemplateIntegration;