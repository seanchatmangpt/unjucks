/**
 * RDF Core Processor - Semantic Web Capabilities for Unjucks
 * 
 * Implements the 80/20 principle: 80% of use cases with 20% of complexity
 * Features:
 * - N3.js integration for RDF/Turtle processing
 * - SPARQL-like query patterns
 * - Template filter integration
 * - Vocabulary management
 * - Knowledge graph scaffolding
 */

import { Store, Parser, Writer, DataFactory } from 'n3';
import { RDFDataLoader } from '../lib/rdf-data-loader.js';
import { RDFFilters } from '../lib/rdf-filters.js';
import { TurtleParser } from '../lib/turtle-parser.js';

const { namedNode, literal, blankNode, quad } = DataFactory;

/**
 * @typedef {Object} RDFProcessorOptions
 * @property {string} [baseUri='http://example.org/'] - Base URI for resolving relative URIs
 * @property {Object} [prefixes] - Namespace prefixes
 * @property {boolean} [enableCache=true] - Enable query result caching
 * @property {number} [cacheSize=1000] - Maximum cache entries
 * @property {string[]} [vocabularies] - Vocabulary files to preload
 */

/**
 * @typedef {Object} QueryPattern
 * @property {string|null} subject - Subject pattern (null for variable)
 * @property {string|null} predicate - Predicate pattern (null for variable)
 * @property {string|null} object - Object pattern (null for variable)
 * @property {string|null} graph - Graph pattern (null for variable)
 * @property {boolean} [optional=false] - Optional pattern
 * @property {Object} [filter] - Filter conditions
 */

/**
 * @typedef {Object} BindingSet
 * @property {Map<string, import('n3').Term>} bindings - Variable bindings
 */

/**
 * @typedef {Object} SemanticEntity
 * @property {string} uri - Entity URI
 * @property {string[]} types - RDF types
 * @property {Object} properties - Property-value map
 * @property {string} label - Primary label
 * @property {string} comment - Description/comment
 */

/**
 * Core RDF Processor for semantic web capabilities
 */
export class RDFProcessor {
  constructor(options = {}) {
    this.options = {
      baseUri: options.baseUri || 'http://example.org/',
      enableCache: options.enableCache !== false,
      cacheSize: options.cacheSize || 1000,
      vocabularies: options.vocabularies || [],
      ...options
    };

    // Core N3 components
    this.store = new Store();
    this.parser = new Parser({ baseIRI: this.options.baseUri });
    this.writer = new Writer({ prefixes: this.getPrefixes() });

    // Unjucks-specific components
    this.dataLoader = new RDFDataLoader({ baseUri: this.options.baseUri });
    this.filters = new RDFFilters({ 
      store: this.store,
      prefixes: this.getPrefixes(),
      baseUri: this.options.baseUri
    });

    // Query engine
    this.queryCache = new Map();
    this.bindingCache = new Map();

    // Vocabulary registry
    this.vocabularies = new Map();
    this.schemas = new Map();

    // Initialize default vocabularies
    this.initializeVocabularies();
  }

  /**
   * Get default namespace prefixes
   * @returns {Object} Namespace prefixes
   */
  getPrefixes() {
    return {
      rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
      owl: 'http://www.w3.org/2002/07/owl#',
      xsd: 'http://www.w3.org/2001/XMLSchema#',
      foaf: 'http://xmlns.com/foaf/0.1/',
      skos: 'http://www.w3.org/2004/02/skos/core#',
      dcterms: 'http://purl.org/dc/terms/',
      dc: 'http://purl.org/dc/elements/1.1/',
      schema: 'https://schema.org/',
      ...this.options.prefixes
    };
  }

  /**
   * Initialize default vocabularies for common use cases
   */
  initializeVocabularies() {
    // Register common vocabularies
    this.vocabularies.set('schema.org', {
      namespace: 'https://schema.org/',
      prefix: 'schema',
      description: 'Schema.org structured data vocabulary',
      loaded: false
    });

    this.vocabularies.set('foaf', {
      namespace: 'http://xmlns.com/foaf/0.1/',
      prefix: 'foaf', 
      description: 'Friend of a Friend vocabulary',
      loaded: false
    });

    this.vocabularies.set('dublin-core', {
      namespace: 'http://purl.org/dc/terms/',
      prefix: 'dcterms',
      description: 'Dublin Core metadata terms',
      loaded: false
    });
  }

  /**
   * Load RDF data from various sources
   * @param {Object|string} source - Data source specification
   * @returns {Promise<Object>} Load result
   */
  async loadData(source) {
    try {
      let data;
      
      if (typeof source === 'string') {
        // Parse inline Turtle content
        data = await this.dataLoader.loadFromSource({
          type: 'inline',
          content: source
        });
      } else {
        // Use structured source specification
        data = await this.dataLoader.loadFromSource(source);
      }

      // Add triples to store
      if (data.triples && data.triples.length > 0) {
        const quads = data.triples.map(triple => 
          quad(
            this.convertToN3Term(triple.subject),
            this.convertToN3Term(triple.predicate),
            this.convertToN3Term(triple.object)
          )
        );
        
        this.store.addQuads(quads);
        
        // Update filters with new data
        this.filters = new RDFFilters({ 
          store: this.store,
          prefixes: { ...this.getPrefixes(), ...data.prefixes },
          baseUri: this.options.baseUri
        });
      }

      return data;
    } catch (error) {
      console.error('RDF data loading failed:', error);
      throw new Error(`Failed to load RDF data: ${error.message}`);
    }
  }

  /**
   * Convert parsed RDF term to N3 term
   * @param {Object} term - Parsed RDF term
   * @returns {import('n3').Term} N3 term
   */
  convertToN3Term(term) {
    switch (term.type) {
      case 'uri':
        return namedNode(term.value);
      case 'literal':
        if (term.datatype) {
          return literal(term.value, namedNode(term.datatype));
        }
        if (term.language) {
          return literal(term.value, term.language);
        }
        return literal(term.value);
      case 'blank':
        return blankNode(term.value);
      default:
        return namedNode(term.value);
    }
  }

  /**
   * Execute SPARQL-like query patterns
   * @param {QueryPattern[]} patterns - Query patterns
   * @returns {BindingSet[]} Query results
   */
  query(patterns) {
    if (!Array.isArray(patterns)) {
      patterns = [patterns];
    }

    const cacheKey = JSON.stringify(patterns);
    if (this.options.enableCache && this.queryCache.has(cacheKey)) {
      return this.queryCache.get(cacheKey);
    }

    try {
      let results = [new Map()]; // Start with empty binding

      for (const pattern of patterns) {
        results = this.bindPattern(pattern, results);
        
        // Early termination if no results
        if (results.length === 0 && !pattern.optional) {
          break;
        }
      }

      // Cache results
      if (this.options.enableCache) {
        this.cacheResult(cacheKey, results);
      }

      return results;
    } catch (error) {
      console.error('Query execution failed:', error);
      return [];
    }
  }

  /**
   * Bind a single pattern against current results
   * @param {QueryPattern} pattern - Pattern to bind
   * @param {BindingSet[]} bindings - Current bindings
   * @returns {BindingSet[]} Updated bindings
   */
  bindPattern(pattern, bindings) {
    const newBindings = [];

    for (const binding of bindings) {
      const boundPattern = this.applyBinding(pattern, binding);
      
      const subjectTerm = boundPattern.subject ? this.expandTerm(boundPattern.subject) : null;
      const predicateTerm = boundPattern.predicate ? this.expandTerm(boundPattern.predicate) : null;
      const objectTerm = boundPattern.object ? this.expandTerm(boundPattern.object) : null;
      const graphTerm = boundPattern.graph ? this.expandTerm(boundPattern.graph) : null;

      const matches = this.store.getQuads(subjectTerm, predicateTerm, objectTerm, graphTerm);

      if (matches.length === 0 && pattern.optional) {
        // Keep original binding for optional patterns with no matches
        newBindings.push(binding);
        continue;
      }

      for (const quad of matches) {
        const newBinding = this.extractVariables(pattern, quad, binding);
        if (newBinding && this.applyFilter(pattern.filter, newBinding, quad)) {
          newBindings.push(newBinding);
        }
      }
    }

    return newBindings;
  }

  /**
   * Apply current bindings to a pattern
   * @param {QueryPattern} pattern - Pattern
   * @param {Map} binding - Variable bindings
   * @returns {QueryPattern} Bound pattern
   */
  applyBinding(pattern, binding) {
    return {
      subject: this.bindVariable(pattern.subject, binding),
      predicate: this.bindVariable(pattern.predicate, binding),
      object: this.bindVariable(pattern.object, binding),
      graph: this.bindVariable(pattern.graph, binding)
    };
  }

  /**
   * Bind a variable if it exists in bindings
   * @param {string|null} term - Term or variable
   * @param {Map} binding - Variable bindings  
   * @returns {string|null} Bound term
   */
  bindVariable(term, binding) {
    if (!term || !term.startsWith('?')) {
      return term;
    }
    
    const variable = term.substring(1);
    if (binding.has(variable)) {
      const boundTerm = binding.get(variable);
      return boundTerm.value;
    }
    
    return null; // Unbound variable
  }

  /**
   * Extract variable bindings from a matched quad
   * @param {QueryPattern} pattern - Original pattern
   * @param {import('n3').Quad} quad - Matched quad
   * @param {Map} binding - Current bindings
   * @returns {Map|null} New binding set
   */
  extractVariables(pattern, quad, binding) {
    const newBinding = new Map(binding);
    
    // Extract subject variable
    if (pattern.subject && pattern.subject.startsWith('?')) {
      const variable = pattern.subject.substring(1);
      newBinding.set(variable, quad.subject);
    }

    // Extract predicate variable
    if (pattern.predicate && pattern.predicate.startsWith('?')) {
      const variable = pattern.predicate.substring(1);
      newBinding.set(variable, quad.predicate);
    }

    // Extract object variable
    if (pattern.object && pattern.object.startsWith('?')) {
      const variable = pattern.object.substring(1);
      newBinding.set(variable, quad.object);
    }

    // Extract graph variable
    if (pattern.graph && pattern.graph.startsWith('?')) {
      const variable = pattern.graph.substring(1);
      newBinding.set(variable, quad.graph);
    }

    return newBinding;
  }

  /**
   * Apply filter conditions to binding and quad
   * @param {Object} filter - Filter conditions
   * @param {Map} binding - Variable bindings
   * @param {import('n3').Quad} quad - Matched quad
   * @returns {boolean} Filter result
   */
  applyFilter(filter, binding, quad) {
    if (!filter) {
      return true;
    }

    // Simple filter implementation - can be extended
    if (filter.regex && filter.variable) {
      const term = binding.get(filter.variable.substring(1));
      if (term && term.termType === 'Literal') {
        const regex = new RegExp(filter.regex, 'i');
        return regex.test(term.value);
      }
    }

    return true;
  }

  /**
   * Expand term using prefixes and variables
   * @param {string} term - Term to expand
   * @returns {import('n3').Term|null} Expanded N3 term
   */
  expandTerm(term) {
    if (!term) {
      return null;
    }

    if (term.startsWith('?')) {
      return null; // Variable
    }

    if (term.startsWith('_:')) {
      return blankNode(term.substring(2));
    }

    if (term.startsWith('http://') || term.startsWith('https://')) {
      return namedNode(term);
    }

    if (term.includes(':')) {
      const [prefix, localName] = term.split(':', 2);
      const prefixes = this.getPrefixes();
      if (prefixes[prefix]) {
        return namedNode(prefixes[prefix] + localName);
      }
    }

    // Check if it's a quoted literal
    if ((term.startsWith('"') && term.endsWith('"')) || 
        (term.startsWith("'") && term.endsWith("'"))) {
      return literal(term.slice(1, -1));
    }

    // Assume it's a URI or literal
    return namedNode(term);
  }

  /**
   * Get semantic entity information
   * @param {string} uri - Entity URI
   * @returns {SemanticEntity} Entity information
   */
  getEntity(uri) {
    const entityUri = this.expandTerm(uri);
    if (!entityUri) {
      return null;
    }

    const entity = {
      uri: entityUri.value,
      types: [],
      properties: {},
      label: null,
      comment: null
    };

    // Get types
    const typeQuads = this.store.getQuads(entityUri, namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), null);
    entity.types = typeQuads.map(q => q.object.value);

    // Get label
    const labelQuads = this.store.getQuads(entityUri, namedNode('http://www.w3.org/2000/01/rdf-schema#label'), null);
    if (labelQuads.length > 0) {
      entity.label = labelQuads[0].object.value;
    }

    // Get comment
    const commentQuads = this.store.getQuads(entityUri, namedNode('http://www.w3.org/2000/01/rdf-schema#comment'), null);
    if (commentQuads.length > 0) {
      entity.comment = commentQuads[0].object.value;
    }

    // Get all properties
    const propertyQuads = this.store.getQuads(entityUri, null, null);
    for (const quad of propertyQuads) {
      const predicate = quad.predicate.value;
      const localName = this.getLocalName(predicate);
      
      if (!entity.properties[localName]) {
        entity.properties[localName] = [];
      }
      
      entity.properties[localName].push({
        value: quad.object.value,
        type: quad.object.termType,
        datatype: quad.object.datatype?.value,
        language: quad.object.language
      });
    }

    return entity;
  }

  /**
   * Get local name from URI
   * @param {string} uri - Full URI
   * @returns {string} Local name
   */
  getLocalName(uri) {
    const hashIndex = uri.lastIndexOf('#');
    const slashIndex = uri.lastIndexOf('/');
    const index = Math.max(hashIndex, slashIndex);
    return index >= 0 ? uri.substring(index + 1) : uri;
  }

  /**
   * Generate template context from RDF data
   * @param {string[]} entityUris - Entity URIs to include
   * @returns {Object} Template context
   */
  createTemplateContext(entityUris = []) {
    const context = {
      entities: {},
      prefixes: this.getPrefixes(),
      stats: this.getStoreStats()
    };

    if (entityUris.length === 0) {
      // Get all subjects if no specific entities requested
      const subjects = this.store.getSubjects(null, null, null);
      entityUris = subjects.map(s => s.value).slice(0, 100); // Limit for performance
    }

    for (const uri of entityUris) {
      const entity = this.getEntity(uri);
      if (entity) {
        context.entities[uri] = entity;
      }
    }

    return context;
  }

  /**
   * Get store statistics
   * @returns {Object} Statistics
   */
  getStoreStats() {
    const allQuads = this.store.getQuads(null, null, null, null);
    const subjects = new Set();
    const predicates = new Set();
    const objects = new Set();

    for (const quad of allQuads) {
      subjects.add(quad.subject.value);
      predicates.add(quad.predicate.value);
      objects.add(quad.object.value);
    }

    return {
      tripleCount: allQuads.length,
      subjectCount: subjects.size,
      predicateCount: predicates.size,
      objectCount: objects.size
    };
  }

  /**
   * Get all template filters for Nunjucks integration
   * @returns {Object} Filter functions
   */
  getTemplateFilters() {
    return this.filters.getAllFilters();
  }

  /**
   * Register filters with Nunjucks environment
   * @param {Object} nunjucksEnv - Nunjucks environment
   */
  registerFilters(nunjucksEnv) {
    const filters = this.getTemplateFilters();
    
    for (const [name, filter] of Object.entries(filters)) {
      nunjucksEnv.addFilter(name, filter);
    }

    // Add convenience globals
    nunjucksEnv.addGlobal('rdf', {
      query: (patterns) => this.query(patterns),
      entity: (uri) => this.getEntity(uri),
      expand: (term) => this.expandTerm(term)?.value,
      compact: (uri) => this.filters.rdfCompact(uri)
    });
  }

  /**
   * Cache query results
   * @param {string} key - Cache key
   * @param {any} result - Result to cache
   */
  cacheResult(key, result) {
    if (this.queryCache.size >= this.options.cacheSize) {
      // Remove oldest entry
      const oldestKey = this.queryCache.keys().next().value;
      this.queryCache.delete(oldestKey);
    }
    
    this.queryCache.set(key, result);
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.queryCache.clear();
    this.bindingCache.clear();
  }

  /**
   * Export current store as Turtle
   * @returns {string} Turtle serialization
   */
  exportTurtle() {
    const writer = new Writer({ prefixes: this.getPrefixes() });
    const quads = this.store.getQuads(null, null, null, null);
    
    writer.addQuads(quads);
    return writer.end();
  }

  /**
   * Load vocabulary from file or URL
   * @param {string} source - Vocabulary source
   * @param {string} prefix - Namespace prefix
   * @returns {Promise<void>}
   */
  async loadVocabulary(source, prefix) {
    try {
      const data = await this.loadData(source);
      
      if (data.success) {
        // Register vocabulary
        const namespace = data.prefixes[prefix] || data.prefixes[''] || this.options.baseUri;
        this.vocabularies.set(prefix, {
          namespace,
          prefix,
          source,
          loaded: true,
          tripleCount: data.stats.tripleCount
        });
        
        console.log(`Loaded vocabulary '${prefix}' with ${data.stats.tripleCount} triples`);
      }
    } catch (error) {
      console.error(`Failed to load vocabulary '${prefix}':`, error);
      throw error;
    }
  }

  /**
   * Get loaded vocabularies
   * @returns {Map} Vocabulary registry
   */
  getVocabularies() {
    return this.vocabularies;
  }

  /**
   * Generate semantic patterns for memory storage
   * @returns {Object} Semantic patterns
   */
  generateSemanticPatterns() {
    const patterns = {
      timestamp: new Date().toISOString(),
      vocabularies: Array.from(this.vocabularies.entries()),
      prefixes: this.getPrefixes(),
      stats: this.getStoreStats(),
      commonPatterns: this.extractCommonPatterns(),
      entityTypes: this.extractEntityTypes(),
      propertyFrequency: this.extractPropertyFrequency()
    };

    return patterns;
  }

  /**
   * Extract common RDF patterns from the store
   * @returns {Object[]} Common patterns
   */
  extractCommonPatterns() {
    const patterns = [];
    const typeProperty = namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
    
    // Find common type patterns
    const typeQuads = this.store.getQuads(null, typeProperty, null);
    const typeFreq = new Map();
    
    for (const quad of typeQuads) {
      const type = quad.object.value;
      typeFreq.set(type, (typeFreq.get(type) || 0) + 1);
    }
    
    // Sort by frequency and take top patterns
    const sortedTypes = Array.from(typeFreq.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);
    
    for (const [type, count] of sortedTypes) {
      patterns.push({
        pattern: 'typeFrequency',
        type,
        count,
        localName: this.getLocalName(type)
      });
    }
    
    return patterns;
  }

  /**
   * Extract entity types from the store
   * @returns {Object} Entity type map
   */
  extractEntityTypes() {
    const types = new Map();
    const typeProperty = namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
    const typeQuads = this.store.getQuads(null, typeProperty, null);
    
    for (const quad of typeQuads) {
      const type = quad.object.value;
      const localName = this.getLocalName(type);
      
      if (!types.has(localName)) {
        types.set(localName, {
          uri: type,
          instances: [],
          count: 0
        });
      }
      
      const typeInfo = types.get(localName);
      typeInfo.instances.push(quad.subject.value);
      typeInfo.count++;
    }
    
    return Object.fromEntries(types);
  }

  /**
   * Extract property frequency information
   * @returns {Object} Property frequency map
   */
  extractPropertyFrequency() {
    const properties = new Map();
    const allQuads = this.store.getQuads(null, null, null);
    
    for (const quad of allQuads) {
      const property = quad.predicate.value;
      const localName = this.getLocalName(property);
      
      if (!properties.has(localName)) {
        properties.set(localName, {
          uri: property,
          count: 0,
          examples: []
        });
      }
      
      const propInfo = properties.get(localName);
      propInfo.count++;
      
      if (propInfo.examples.length < 3) {
        propInfo.examples.push({
          subject: quad.subject.value,
          object: quad.object.value,
          objectType: quad.object.termType
        });
      }
    }
    
    return Object.fromEntries(properties);
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.clearCache();
    this.dataLoader?.destroy();
  }

  // =============================================================================
  // SEMANTIC JOB-RESUME MATCHING ENGINE
  // =============================================================================

  /**
   * Initialize job matching vocabularies and semantic patterns
   * @returns {void}
   */
  initializeJobMatchingVocabularies() {
    // Add job-specific prefixes
    const jobPrefixes = {
      job: 'http://schema.org/JobPosting#',
      skill: 'http://data.europa.eu/esco/skill#',
      occupation: 'http://data.europa.eu/esco/occupation#',
      person: 'http://schema.org/Person#',
      resume: 'http://schema.org/resume#',
      experience: 'http://schema.org/WorkExperience#',
      education: 'http://schema.org/EducationalOccupationalCredential#'
    };

    // Merge with existing prefixes
    this.options.prefixes = { ...this.options.prefixes, ...jobPrefixes };
  }

  /**
   * Calculate semantic distance between two skill URIs
   * @param {string} skill1Uri - First skill URI
   * @param {string} skill2Uri - Second skill URI
   * @returns {number} Semantic distance (0-1, lower = more similar)
   */
  calculateSemanticDistance(skill1Uri, skill2Uri) {
    if (skill1Uri === skill2Uri) return 0;

    const skill1 = this.getEntity(skill1Uri);
    const skill2 = this.getEntity(skill2Uri);

    if (!skill1 || !skill2) return 1;

    let distance = 1;
    let factors = 0;

    // 1. Direct hierarchical relationship
    const hierarchyDistance = this.calculateHierarchyDistance(skill1Uri, skill2Uri);
    if (hierarchyDistance < 1) {
      distance = Math.min(distance, hierarchyDistance);
      factors++;
    }

    // 2. Shared broader/narrower concepts
    const conceptDistance = this.calculateConceptSimilarity(skill1, skill2);
    if (conceptDistance < 1) {
      distance = Math.min(distance, conceptDistance);
      factors++;
    }

    // 3. Label/description similarity
    const labelDistance = this.calculateLabelSimilarity(skill1, skill2);
    distance = (distance + labelDistance) / 2;
    factors++;

    // 4. Co-occurrence in job requirements
    const cooccurrenceDistance = this.calculateCooccurrenceDistance(skill1Uri, skill2Uri);
    if (cooccurrenceDistance < 1) {
      distance = (distance + cooccurrenceDistance) / 2;
      factors++;
    }

    return Math.min(distance, 1);
  }

  /**
   * Calculate hierarchical distance in skill taxonomy
   * @param {string} skill1Uri - First skill URI
   * @param {string} skill2Uri - Second skill URI
   * @returns {number} Hierarchy distance
   */
  calculateHierarchyDistance(skill1Uri, skill2Uri) {
    const broaderProperty = namedNode('http://www.w3.org/2004/02/skos/core#broader');
    const narrowerProperty = namedNode('http://www.w3.org/2004/02/skos/core#narrower');

    // Check if skill1 is broader than skill2
    const skill1Broader = this.store.getQuads(this.expandTerm(skill2Uri), broaderProperty, this.expandTerm(skill1Uri));
    if (skill1Broader.length > 0) return 0.3;

    // Check if skill2 is broader than skill1
    const skill2Broader = this.store.getQuads(this.expandTerm(skill1Uri), broaderProperty, this.expandTerm(skill2Uri));
    if (skill2Broader.length > 0) return 0.3;

    // Check for shared parent concepts
    const skill1Parents = this.store.getQuads(this.expandTerm(skill1Uri), broaderProperty, null);
    const skill2Parents = this.store.getQuads(this.expandTerm(skill2Uri), broaderProperty, null);

    for (const parent1 of skill1Parents) {
      for (const parent2 of skill2Parents) {
        if (parent1.object.value === parent2.object.value) {
          return 0.5; // Siblings in hierarchy
        }
      }
    }

    return 1; // No hierarchical relationship found
  }

  /**
   * Calculate concept similarity using SKOS relationships
   * @param {SemanticEntity} skill1 - First skill entity
   * @param {SemanticEntity} skill2 - Second skill entity  
   * @returns {number} Concept similarity distance
   */
  calculateConceptSimilarity(skill1, skill2) {
    const relatedProperty = namedNode('http://www.w3.org/2004/02/skos/core#related');
    const exactMatchProperty = namedNode('http://www.w3.org/2004/02/skos/core#exactMatch');
    const closeMatchProperty = namedNode('http://www.w3.org/2004/02/skos/core#closeMatch');

    // Check for exact match
    const exactMatch = this.store.getQuads(
      this.expandTerm(skill1.uri), 
      exactMatchProperty, 
      this.expandTerm(skill2.uri)
    );
    if (exactMatch.length > 0) return 0.1;

    // Check for close match
    const closeMatch = this.store.getQuads(
      this.expandTerm(skill1.uri), 
      closeMatchProperty, 
      this.expandTerm(skill2.uri)
    );
    if (closeMatch.length > 0) return 0.2;

    // Check for related concepts
    const related = this.store.getQuads(
      this.expandTerm(skill1.uri), 
      relatedProperty, 
      this.expandTerm(skill2.uri)
    );
    if (related.length > 0) return 0.4;

    return 1;
  }

  /**
   * Calculate label/description similarity using string metrics
   * @param {SemanticEntity} skill1 - First skill entity
   * @param {SemanticEntity} skill2 - Second skill entity
   * @returns {number} Label similarity distance
   */
  calculateLabelSimilarity(skill1, skill2) {
    const label1 = skill1.label?.toLowerCase() || '';
    const label2 = skill2.label?.toLowerCase() || '';
    
    if (!label1 || !label2) return 1;

    // Jaccard similarity for label words
    const words1 = new Set(label1.split(/\s+/));
    const words2 = new Set(label2.split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    const jaccard = intersection.size / union.size;
    
    // Levenshtein distance for overall similarity
    const levenshtein = this.calculateLevenshteinDistance(label1, label2);
    const maxLen = Math.max(label1.length, label2.length);
    const normalizedLevenshtein = maxLen > 0 ? levenshtein / maxLen : 0;
    
    // Combine metrics (favor higher weight on Jaccard for semantic understanding)
    const combinedSimilarity = 0.7 * jaccard + 0.3 * (1 - normalizedLevenshtein);
    
    return 1 - combinedSimilarity;
  }

  /**
   * Calculate Levenshtein distance between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Edit distance
   */
  calculateLevenshteinDistance(str1, str2) {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Calculate co-occurrence distance based on job requirements
   * @param {string} skill1Uri - First skill URI
   * @param {string} skill2Uri - Second skill URI
   * @returns {number} Co-occurrence distance
   */
  calculateCooccurrenceDistance(skill1Uri, skill2Uri) {
    // Query for jobs that require both skills
    const jobsWithSkill1 = this.query([
      { subject: '?job', predicate: 'rdf:type', object: 'schema:JobPosting' },
      { subject: '?job', predicate: 'schema:skills', object: skill1Uri }
    ]);

    const jobsWithSkill2 = this.query([
      { subject: '?job', predicate: 'rdf:type', object: 'schema:JobPosting' },
      { subject: '?job', predicate: 'schema:skills', object: skill2Uri }
    ]);

    if (jobsWithSkill1.length === 0 || jobsWithSkill2.length === 0) {
      return 1;
    }

    // Find intersection
    const jobs1Set = new Set(jobsWithSkill1.map(binding => binding.get('job')?.value));
    const jobs2Set = new Set(jobsWithSkill2.map(binding => binding.get('job')?.value));
    
    const intersection = new Set([...jobs1Set].filter(x => jobs2Set.has(x)));
    const union = new Set([...jobs1Set, ...jobs2Set]);

    const cooccurrence = intersection.size / union.size;
    return 1 - cooccurrence;
  }

  /**
   * Find skills matching for a person's profile
   * @param {string} personUri - Person URI
   * @param {Object} options - Matching options
   * @returns {Object[]} Skill matches with scores
   */
  findSkillMatches(personUri, options = {}) {
    const threshold = options.threshold || 0.7;
    const maxResults = options.maxResults || 20;

    // Get person's skills
    const personSkills = this.query([
      { subject: personUri, predicate: 'schema:knowsAbout', object: '?skill' }
    ]);

    if (personSkills.length === 0) {
      return [];
    }

    // Get all available skills in the knowledge base
    const allSkills = this.query([
      { subject: '?skill', predicate: 'rdf:type', object: 'skill:Skill' }
    ]);

    const matches = [];
    const personSkillUris = personSkills.map(binding => binding.get('skill')?.value);

    for (const skillBinding of allSkills) {
      const skillUri = skillBinding.get('skill')?.value;
      if (!skillUri || personSkillUris.includes(skillUri)) continue;

      let maxSimilarity = 0;
      let bestMatch = null;

      // Find best match among person's skills
      for (const personSkillUri of personSkillUris) {
        const distance = this.calculateSemanticDistance(personSkillUri, skillUri);
        const similarity = 1 - distance;

        if (similarity > maxSimilarity) {
          maxSimilarity = similarity;
          bestMatch = personSkillUri;
        }
      }

      if (maxSimilarity >= threshold) {
        const skillEntity = this.getEntity(skillUri);
        matches.push({
          skill: skillEntity,
          similarity: maxSimilarity,
          matchedWith: bestMatch,
          category: this.getSkillCategory(skillUri)
        });
      }
    }

    // Sort by similarity and limit results
    return matches
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxResults);
  }

  /**
   * Generate job recommendations for a person
   * @param {string} personUri - Person URI
   * @param {Object} options - Recommendation options
   * @returns {Object[]} Job recommendations with match scores
   */
  generateJobRecommendations(personUri, options = {}) {
    const minMatchScore = options.minMatchScore || 0.6;
    const maxResults = options.maxResults || 10;
    const experienceWeight = options.experienceWeight || 0.3;
    const skillWeight = options.skillWeight || 0.5;
    const educationWeight = options.educationWeight || 0.2;

    // Get person's profile
    const personProfile = this.getPersonProfile(personUri);
    if (!personProfile) {
      return [];
    }

    // Get all job postings
    const jobs = this.query([
      { subject: '?job', predicate: 'rdf:type', object: 'schema:JobPosting' }
    ]);

    const recommendations = [];

    for (const jobBinding of jobs) {
      const jobUri = jobBinding.get('job')?.value;
      if (!jobUri) continue;

      const jobProfile = this.getJobProfile(jobUri);
      const matchScore = this.calculateJobMatchScore(personProfile, jobProfile, {
        experienceWeight,
        skillWeight,
        educationWeight
      });

      if (matchScore >= minMatchScore) {
        recommendations.push({
          job: jobProfile,
          matchScore,
          skillMatch: this.calculateSkillMatchDetails(personProfile.skills, jobProfile.requiredSkills),
          experienceMatch: this.calculateExperienceMatch(personProfile.experience, jobProfile.experienceLevel),
          educationMatch: this.calculateEducationMatch(personProfile.education, jobProfile.educationRequirements),
          gapAnalysis: this.generateGapAnalysis(personProfile, jobProfile)
        });
      }
    }

    return recommendations
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, maxResults);
  }

  /**
   * Get comprehensive person profile
   * @param {string} personUri - Person URI
   * @returns {Object} Person profile
   */
  getPersonProfile(personUri) {
    const personEntity = this.getEntity(personUri);
    if (!personEntity) return null;

    // Get skills
    const skillsQuery = this.query([
      { subject: personUri, predicate: 'schema:knowsAbout', object: '?skill' }
    ]);
    const skills = skillsQuery.map(binding => binding.get('skill')?.value).filter(Boolean);

    // Get work experience
    const experienceQuery = this.query([
      { subject: personUri, predicate: 'schema:hasOccupation', object: '?experience' },
      { subject: '?experience', predicate: 'schema:experienceLevel', object: '?level' }
    ]);

    // Get education
    const educationQuery = this.query([
      { subject: personUri, predicate: 'schema:hasCredential', object: '?education' },
      { subject: '?education', predicate: 'schema:educationalLevel', object: '?level' }
    ]);

    return {
      uri: personUri,
      entity: personEntity,
      skills,
      experience: this.extractExperienceLevel(experienceQuery),
      education: this.extractEducationLevel(educationQuery),
      profile: {
        yearsExperience: this.calculateYearsExperience(personUri),
        seniorityLevel: this.determineSeniorityLevel(personUri)
      }
    };
  }

  /**
   * Get comprehensive job profile
   * @param {string} jobUri - Job URI
   * @returns {Object} Job profile
   */
  getJobProfile(jobUri) {
    const jobEntity = this.getEntity(jobUri);
    if (!jobEntity) return null;

    // Get required skills
    const skillsQuery = this.query([
      { subject: jobUri, predicate: 'schema:skills', object: '?skill' }
    ]);
    const requiredSkills = skillsQuery.map(binding => binding.get('skill')?.value).filter(Boolean);

    // Get experience requirements
    const experienceQuery = this.query([
      { subject: jobUri, predicate: 'schema:experienceRequirements', object: '?experience' }
    ]);

    // Get education requirements
    const educationQuery = this.query([
      { subject: jobUri, predicate: 'schema:educationRequirements', object: '?education' }
    ]);

    return {
      uri: jobUri,
      entity: jobEntity,
      requiredSkills,
      experienceLevel: this.extractRequiredExperience(experienceQuery),
      educationRequirements: this.extractRequiredEducation(educationQuery),
      jobDetails: {
        title: jobEntity.properties.jobTitle?.[0]?.value || 'Unknown Position',
        company: jobEntity.properties.hiringOrganization?.[0]?.value || 'Unknown Company',
        location: jobEntity.properties.jobLocation?.[0]?.value || 'Unknown Location',
        employmentType: jobEntity.properties.employmentType?.[0]?.value || 'Unknown Type'
      }
    };
  }

  /**
   * Calculate overall job match score
   * @param {Object} personProfile - Person profile
   * @param {Object} jobProfile - Job profile
   * @param {Object} weights - Scoring weights
   * @returns {number} Match score (0-1)
   */
  calculateJobMatchScore(personProfile, jobProfile, weights) {
    const skillScore = this.calculateSkillMatchScore(personProfile.skills, jobProfile.requiredSkills);
    const experienceScore = this.calculateExperienceMatchScore(personProfile.experience, jobProfile.experienceLevel);
    const educationScore = this.calculateEducationMatchScore(personProfile.education, jobProfile.educationRequirements);

    return (
      skillScore * weights.skillWeight +
      experienceScore * weights.experienceWeight +
      educationScore * weights.educationWeight
    );
  }

  /**
   * Calculate skill match score between person and job
   * @param {string[]} personSkills - Person's skills
   * @param {string[]} jobSkills - Required job skills
   * @returns {number} Skill match score (0-1)
   */
  calculateSkillMatchScore(personSkills, jobSkills) {
    if (!jobSkills || jobSkills.length === 0) return 1;
    if (!personSkills || personSkills.length === 0) return 0;

    let totalScore = 0;
    let matchedSkills = 0;

    for (const jobSkill of jobSkills) {
      let bestMatch = 0;
      
      for (const personSkill of personSkills) {
        const distance = this.calculateSemanticDistance(personSkill, jobSkill);
        const similarity = 1 - distance;
        bestMatch = Math.max(bestMatch, similarity);
      }

      totalScore += bestMatch;
      if (bestMatch > 0.7) matchedSkills++;
    }

    // Average similarity with bonus for high match count
    const averageScore = totalScore / jobSkills.length;
    const coverageBonus = matchedSkills / jobSkills.length * 0.2;
    
    return Math.min(averageScore + coverageBonus, 1);
  }

  /**
   * Calculate detailed skill match information
   * @param {string[]} personSkills - Person's skills
   * @param {string[]} jobSkills - Required job skills
   * @returns {Object} Detailed skill match
   */
  calculateSkillMatchDetails(personSkills, jobSkills) {
    const matches = [];
    const missing = [];
    
    for (const jobSkill of jobSkills) {
      const jobSkillEntity = this.getEntity(jobSkill);
      let bestMatch = { similarity: 0, skill: null };
      
      for (const personSkill of personSkills) {
        const distance = this.calculateSemanticDistance(personSkill, jobSkill);
        const similarity = 1 - distance;
        
        if (similarity > bestMatch.similarity) {
          bestMatch = { similarity, skill: personSkill };
        }
      }

      if (bestMatch.similarity > 0.7) {
        matches.push({
          requiredSkill: jobSkillEntity,
          matchedSkill: this.getEntity(bestMatch.skill),
          similarity: bestMatch.similarity
        });
      } else {
        missing.push({
          skill: jobSkillEntity,
          bestSimilarity: bestMatch.similarity
        });
      }
    }

    return { matches, missing, coverage: matches.length / jobSkills.length };
  }

  /**
   * Calculate experience level match
   * @param {Object} personExperience - Person's experience
   * @param {Object} jobExperience - Job experience requirements
   * @returns {number} Experience match score (0-1)
   */
  calculateExperienceMatchScore(personExperience, jobExperience) {
    if (!jobExperience) return 1;
    if (!personExperience) return 0;

    const personLevel = this.normalizeExperienceLevel(personExperience.level);
    const requiredLevel = this.normalizeExperienceLevel(jobExperience.level);

    // Experience levels: 0=none, 1=junior, 2=mid, 3=senior, 4=expert
    if (personLevel >= requiredLevel) {
      return 1;
    } else {
      // Penalty for insufficient experience
      const gap = requiredLevel - personLevel;
      return Math.max(0, 1 - (gap * 0.25));
    }
  }

  /**
   * Normalize experience level to numeric scale
   * @param {string} level - Experience level string
   * @returns {number} Normalized level (0-4)
   */
  normalizeExperienceLevel(level) {
    if (!level) return 0;
    
    const normalized = level.toLowerCase();
    if (normalized.includes('expert') || normalized.includes('lead') || normalized.includes('principal')) return 4;
    if (normalized.includes('senior')) return 3;
    if (normalized.includes('mid') || normalized.includes('intermediate')) return 2;
    if (normalized.includes('junior') || normalized.includes('entry')) return 1;
    return 0;
  }

  /**
   * Calculate education match score
   * @param {Object} personEducation - Person's education
   * @param {Object} jobEducation - Job education requirements
   * @returns {number} Education match score (0-1)
   */
  calculateEducationMatchScore(personEducation, jobEducation) {
    if (!jobEducation) return 1;
    if (!personEducation) return 0;

    const personLevel = this.normalizeEducationLevel(personEducation.level);
    const requiredLevel = this.normalizeEducationLevel(jobEducation.level);

    // Education levels: 0=none, 1=high school, 2=bachelor, 3=master, 4=doctorate
    return personLevel >= requiredLevel ? 1 : Math.max(0, 0.7 - (requiredLevel - personLevel) * 0.15);
  }

  /**
   * Normalize education level to numeric scale
   * @param {string} level - Education level string
   * @returns {number} Normalized level (0-4)
   */
  normalizeEducationLevel(level) {
    if (!level) return 0;
    
    const normalized = level.toLowerCase();
    if (normalized.includes('phd') || normalized.includes('doctorate')) return 4;
    if (normalized.includes('master') || normalized.includes('mba')) return 3;
    if (normalized.includes('bachelor') || normalized.includes('degree')) return 2;
    if (normalized.includes('high school') || normalized.includes('diploma')) return 1;
    return 0;
  }

  /**
   * Generate gap analysis for person vs job requirements
   * @param {Object} personProfile - Person profile
   * @param {Object} jobProfile - Job profile
   * @returns {Object} Gap analysis
   */
  generateGapAnalysis(personProfile, jobProfile) {
    const skillGaps = [];
    const strengthAreas = [];
    const developmentAreas = [];

    // Analyze skill gaps
    for (const requiredSkill of jobProfile.requiredSkills) {
      let bestMatch = 0;
      let matchedSkill = null;

      for (const personSkill of personProfile.skills) {
        const distance = this.calculateSemanticDistance(personSkill, requiredSkill);
        const similarity = 1 - distance;
        
        if (similarity > bestMatch) {
          bestMatch = similarity;
          matchedSkill = personSkill;
        }
      }

      const skillEntity = this.getEntity(requiredSkill);
      
      if (bestMatch < 0.7) {
        skillGaps.push({
          skill: skillEntity,
          similarity: bestMatch,
          priority: bestMatch < 0.3 ? 'high' : 'medium',
          recommendation: this.generateSkillRecommendation(requiredSkill)
        });
      } else {
        strengthAreas.push({
          skill: skillEntity,
          matchedWith: this.getEntity(matchedSkill),
          similarity: bestMatch
        });
      }
    }

    // Experience gap
    const experienceGap = this.calculateExperienceGap(personProfile.experience, jobProfile.experienceLevel);
    
    // Education gap
    const educationGap = this.calculateEducationGap(personProfile.education, jobProfile.educationRequirements);

    return {
      skillGaps,
      strengthAreas,
      experienceGap,
      educationGap,
      overallReadiness: this.calculateOverallReadiness(personProfile, jobProfile),
      recommendations: this.generateImprovementRecommendations(skillGaps, experienceGap, educationGap)
    };
  }

  /**
   * Generate skill learning recommendation
   * @param {string} skillUri - Skill URI
   * @returns {Object} Learning recommendation
   */
  generateSkillRecommendation(skillUri) {
    const skillEntity = this.getEntity(skillUri);
    const category = this.getSkillCategory(skillUri);
    
    return {
      skill: skillEntity,
      category,
      suggestedLearningPath: this.getSuggestedLearningPath(skillUri),
      relatedSkills: this.getRelatedSkills(skillUri),
      estimatedLearningTime: this.estimateLearningTime(skillUri, category)
    };
  }

  /**
   * Get skill category for classification
   * @param {string} skillUri - Skill URI
   * @returns {string} Skill category
   */
  getSkillCategory(skillUri) {
    const categoryQuery = this.query([
      { subject: skillUri, predicate: 'skill:skillType', object: '?category' }
    ]);

    if (categoryQuery.length > 0) {
      return categoryQuery[0].get('category')?.value || 'general';
    }

    // Fallback to basic categorization based on skill name
    const skillEntity = this.getEntity(skillUri);
    const label = skillEntity?.label?.toLowerCase() || '';
    
    if (label.includes('programming') || label.includes('coding') || label.includes('development')) {
      return 'technical';
    } else if (label.includes('management') || label.includes('leadership')) {
      return 'management';
    } else if (label.includes('communication') || label.includes('collaboration')) {
      return 'soft-skills';
    }
    
    return 'general';
  }

  /**
   * Extract helper methods for profile building
   */
  extractExperienceLevel(experienceQuery) {
    if (experienceQuery.length === 0) return { level: 'none', details: [] };
    
    return {
      level: experienceQuery[0].get('level')?.value || 'unknown',
      details: experienceQuery.map(binding => ({
        experience: binding.get('experience')?.value,
        level: binding.get('level')?.value
      }))
    };
  }

  extractEducationLevel(educationQuery) {
    if (educationQuery.length === 0) return { level: 'none', details: [] };
    
    return {
      level: educationQuery[0].get('level')?.value || 'unknown',
      details: educationQuery.map(binding => ({
        education: binding.get('education')?.value,
        level: binding.get('level')?.value
      }))
    };
  }

  extractRequiredExperience(experienceQuery) {
    if (experienceQuery.length === 0) return null;
    return { level: experienceQuery[0].get('experience')?.value };
  }

  extractRequiredEducation(educationQuery) {
    if (educationQuery.length === 0) return null;
    return { level: educationQuery[0].get('education')?.value };
  }

  calculateYearsExperience(personUri) {
    // Simplified calculation - would need temporal data in real implementation
    const experienceQuery = this.query([
      { subject: personUri, predicate: 'schema:worksFor', object: '?org' }
    ]);
    return experienceQuery.length * 2; // Rough estimate
  }

  determineSeniorityLevel(personUri) {
    const yearsExperience = this.calculateYearsExperience(personUri);
    if (yearsExperience >= 10) return 'senior';
    if (yearsExperience >= 5) return 'mid';
    if (yearsExperience >= 2) return 'junior';
    return 'entry';
  }

  calculateExperienceGap(personExperience, jobExperience) {
    if (!jobExperience) return null;
    
    const personLevel = this.normalizeExperienceLevel(personExperience?.level);
    const requiredLevel = this.normalizeExperienceLevel(jobExperience.level);
    
    return {
      required: jobExperience.level,
      current: personExperience?.level || 'none',
      gap: Math.max(0, requiredLevel - personLevel),
      recommendation: requiredLevel > personLevel ? 
        `Gain ${requiredLevel - personLevel} more experience levels` : 
        'Experience requirement met'
    };
  }

  calculateEducationGap(personEducation, jobEducation) {
    if (!jobEducation) return null;
    
    const personLevel = this.normalizeEducationLevel(personEducation?.level);
    const requiredLevel = this.normalizeEducationLevel(jobEducation.level);
    
    return {
      required: jobEducation.level,
      current: personEducation?.level || 'none',
      gap: Math.max(0, requiredLevel - personLevel),
      recommendation: requiredLevel > personLevel ? 
        `Consider pursuing ${jobEducation.level}` : 
        'Education requirement met'
    };
  }

  calculateOverallReadiness(personProfile, jobProfile) {
    const skillScore = this.calculateSkillMatchScore(personProfile.skills, jobProfile.requiredSkills);
    const experienceScore = this.calculateExperienceMatchScore(personProfile.experience, jobProfile.experienceLevel);
    const educationScore = this.calculateEducationMatchScore(personProfile.education, jobProfile.educationRequirements);
    
    const overall = (skillScore * 0.5 + experienceScore * 0.3 + educationScore * 0.2);
    
    if (overall >= 0.8) return 'high';
    if (overall >= 0.6) return 'medium';
    if (overall >= 0.4) return 'low';
    return 'very-low';
  }

  generateImprovementRecommendations(skillGaps, experienceGap, educationGap) {
    const recommendations = [];
    
    // High priority skill gaps
    const highPrioritySkills = skillGaps.filter(gap => gap.priority === 'high');
    if (highPrioritySkills.length > 0) {
      recommendations.push({
        type: 'skills',
        priority: 'high',
        action: `Focus on developing ${highPrioritySkills.length} critical skills`,
        skills: highPrioritySkills.map(gap => gap.skill.label).slice(0, 3)
      });
    }
    
    // Experience recommendations
    if (experienceGap && experienceGap.gap > 0) {
      recommendations.push({
        type: 'experience',
        priority: experienceGap.gap > 2 ? 'high' : 'medium',
        action: experienceGap.recommendation
      });
    }
    
    // Education recommendations
    if (educationGap && educationGap.gap > 0) {
      recommendations.push({
        type: 'education',
        priority: 'medium',
        action: educationGap.recommendation
      });
    }
    
    return recommendations;
  }

  getSuggestedLearningPath(skillUri) {
    // Simplified learning path - would connect to learning resources in real implementation
    const skillEntity = this.getEntity(skillUri);
    const category = this.getSkillCategory(skillUri);
    
    return {
      beginner: [`Learn basics of ${skillEntity?.label}`],
      intermediate: [`Practice ${skillEntity?.label} projects`],
      advanced: [`Master advanced ${skillEntity?.label} concepts`]
    };
  }

  getRelatedSkills(skillUri) {
    return this.query([
      { subject: skillUri, predicate: 'skos:related', object: '?related' }
    ]).map(binding => binding.get('related')?.value).filter(Boolean);
  }

  estimateLearningTime(skillUri, category) {
    // Simplified estimation - would use ML models in real implementation
    const baseTime = {
      'technical': '3-6 months',
      'management': '6-12 months',
      'soft-skills': '2-4 months',
      'general': '1-3 months'
    };
    
    return baseTime[category] || '2-4 months';
  }

  /**
   * Store semantic query patterns in memory for reuse
   * @returns {Object} Semantic query patterns
   */
  generateSemanticQueryPatterns() {
    return {
      timestamp: new Date().toISOString(),
      patterns: {
        // Basic profile queries
        personSkills: [
          { subject: '?person', predicate: 'schema:knowsAbout', object: '?skill' }
        ],
        jobRequirements: [
          { subject: '?job', predicate: 'rdf:type', object: 'schema:JobPosting' },
          { subject: '?job', predicate: 'schema:skills', object: '?skill' }
        ],
        
        // Hierarchical skill queries
        skillHierarchy: [
          { subject: '?skill', predicate: 'skos:broader', object: '?parent' },
          { subject: '?parent', predicate: 'rdfs:label', object: '?parentLabel' }
        ],
        
        // Experience queries
        experienceLevel: [
          { subject: '?person', predicate: 'schema:hasOccupation', object: '?experience' },
          { subject: '?experience', predicate: 'schema:experienceLevel', object: '?level' }
        ],
        
        // Education queries
        educationLevel: [
          { subject: '?person', predicate: 'schema:hasCredential', object: '?education' },
          { subject: '?education', predicate: 'schema:educationalLevel', object: '?level' }
        ],
        
        // Job matching queries
        skillMatch: [
          { subject: '?job', predicate: 'schema:skills', object: '?requiredSkill' },
          { subject: '?person', predicate: 'schema:knowsAbout', object: '?personSkill' }
        ],
        
        // Advanced semantic queries
        relatedSkills: [
          { subject: '?skill1', predicate: 'skos:related', object: '?skill2' },
          { subject: '?skill2', predicate: 'rdfs:label', object: '?label' }
        ],
        
        conceptSimilarity: [
          { subject: '?skill1', predicate: 'skos:closeMatch', object: '?skill2' },
          { subject: '?skill1', predicate: 'skos:exactMatch', object: '?skill2', optional: true }
        ],
        
        // Co-occurrence patterns
        skillCooccurrence: [
          { subject: '?job1', predicate: 'schema:skills', object: '?skill1' },
          { subject: '?job1', predicate: 'schema:skills', object: '?skill2' },
          { filter: { variable: '?skill1', operator: '!=', value: '?skill2' } }
        ]
      },
      
      // Semantic distance algorithms
      algorithms: {
        semanticDistance: {
          hierarchical: 'SKOS broader/narrower relationships',
          conceptual: 'SKOS related/exactMatch/closeMatch',
          lexical: 'Label/description similarity using Jaccard + Levenshtein',
          cooccurrence: 'Job requirement co-occurrence analysis'
        },
        
        matching: {
          skillMatch: 'Weighted combination of semantic distances',
          experienceMatch: 'Normalized experience level comparison',
          educationMatch: 'Normalized education level comparison',
          overallMatch: 'Weighted combination (skills 50%, experience 30%, education 20%)'
        }
      },
      
      // Optimization strategies
      optimization: {
        caching: 'Query result caching for semantic distance calculations',
        indexing: 'Pre-computed similarity matrices for frequent skill pairs',
        batching: 'Batch processing for multiple job recommendations',
        thresholds: 'Configurable similarity thresholds for performance tuning'
      }
    };
  }
}

/**
 * Factory function to create RDF processor
 * @param {RDFProcessorOptions} options - Configuration options
 * @returns {RDFProcessor} RDF processor instance
 */
export function createRDFProcessor(options = {}) {
  return new RDFProcessor(options);
}

/**
 * Convenience function to process RDF and create template context
 * @param {Object|string} source - RDF data source
 * @param {RDFProcessorOptions} options - Configuration options
 * @returns {Promise<Object>} Template context
 */
export async function processRDFForTemplate(source, options = {}) {
  const processor = createRDFProcessor(options);
  await processor.loadData(source);
  return processor.createTemplateContext();
}

export default RDFProcessor;