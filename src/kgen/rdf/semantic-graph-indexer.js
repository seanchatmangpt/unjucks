/**
 * Semantic Graph Indexer - Full semantic RDF indexing with N3 parsing
 * 
 * This replaces the basic text-based parsing in bin/kgen.mjs with proper
 * semantic RDF indexing using N3 for comprehensive triple processing.
 */

import { Parser, Store, DataFactory, Writer } from 'n3';
import { EventEmitter } from 'events';
import { consola } from 'consola';
import crypto from 'crypto';
import fs from 'fs';

const { namedNode, literal, blankNode } = DataFactory;

/**
 * Full Semantic Graph Indexer
 */
export class SemanticGraphIndexer extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      enableFullTextIndex: config.enableFullTextIndex !== false,
      enableTypeIndex: config.enableTypeIndex !== false,
      enableLanguageIndex: config.enableLanguageIndex !== false,
      enableStatistics: config.enableStatistics !== false,
      enableValidation: config.enableValidation !== false,
      maxIndexSize: config.maxIndexSize || 50000000, // 50M entries
      performanceTarget: config.performanceTarget || 150, // ms
      ...config
    };
    
    // N3 Store for semantic processing
    this.store = new Store();
    this.parser = new Parser({ blankNodePrefix: '_:b' });
    this.writer = new Writer({ format: 'text/turtle' });
    
    // Core semantic indexes
    this.semanticIndexes = {
      subjects: new Map(),        // Subject URI -> metadata
      predicates: new Map(),      // Predicate URI -> usage stats
      objects: new Map(),         // Object value -> references
      types: new Map(),           // RDF type -> subjects
      literals: new Map(),        // Literal values -> locations
      languages: new Map(),       // Language tags -> literals
      datatypes: new Map(),       // Datatypes -> literals
      graphs: new Map(),          // Named graphs -> content
      fullText: new Map(),        // Text search -> matches
      relationships: new Map()    // Subject -> related subjects
    };
    
    // Advanced statistics
    this.statistics = {
      totalTriples: 0,
      uniqueSubjects: 0,
      uniquePredicates: 0,
      uniqueObjects: 0,
      literalCount: 0,
      uriCount: 0,
      blankNodeCount: 0,
      processingTime: 0,
      indexingComplete: false,
      validationResults: null,
      performance: {
        indexingRate: 0, // triples per second
        memoryUsage: 0,
        cacheHitRatio: 0
      },
      samples: {
        languages: new Set(),
        datatypes: new Set(),
        predicates: new Set(),
        subjects: new Set()
      }
    };
    
    this.logger = consola.withTag('semantic-indexer');
  }
  
  /**
   * Index RDF content with full semantic processing
   */
  async indexRDF(rdfContent, options = {}) {
    const startTime = performance.now();
    
    try {
      this.logger.debug('Starting semantic RDF indexing...');
      
      // Clear previous data if requested
      if (options.clearPrevious !== false) {
        this.clear();
      }
      
      // Parse RDF content with N3
      const quads = await this.parseRDFContent(rdfContent, options.format);
      
      if (quads.length === 0) {
        throw new Error('No valid RDF triples found in content');
      }
      
      // Add quads to semantic store
      this.store.addQuads(quads);
      
      // Build semantic indexes
      await this.buildSemanticIndexes(quads);
      
      // Update statistics
      this.updateStatistics();
      
      // Validate if enabled
      if (this.config.enableValidation) {
        await this.validateSemanticStructure();
      }
      
      const processingTime = Math.round(performance.now() - startTime);
      this.statistics.processingTime = processingTime;
      this.statistics.indexingComplete = true;
      this.statistics.performance.indexingRate = Math.round(quads.length / (processingTime / 1000));
      
      this.emit('indexing-complete', {
        totalTriples: this.statistics.totalTriples,
        processingTime,
        indexingRate: this.statistics.performance.indexingRate
      });
      
      return {
        success: true,
        mode: 'SEMANTIC',
        totalTriples: this.statistics.totalTriples,
        uniqueSubjects: this.statistics.uniqueSubjects,
        uniquePredicates: this.statistics.uniquePredicates,
        uniqueObjects: this.statistics.uniqueObjects,
        processingTime,
        indexingRate: this.statistics.performance.indexingRate,
        performanceTarget: this.config.performanceTarget,
        targetMet: processingTime <= this.config.performanceTarget,
        samples: {
          languages: Array.from(this.statistics.samples.languages).slice(0, 5),
          datatypes: Array.from(this.statistics.samples.datatypes).slice(0, 5),
          predicates: Array.from(this.statistics.samples.predicates).slice(0, 10),
          subjects: Array.from(this.statistics.samples.subjects).slice(0, 10)
        },
        validation: this.statistics.validationResults,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      this.logger.error('Semantic indexing failed:', error);
      throw error;
    }
  }
  
  /**
   * Parse RDF content using N3 parser
   */
  async parseRDFContent(content, format = 'turtle') {
    return new Promise((resolve, reject) => {
      const quads = [];
      
      this.parser.parse(content, (error, quad, prefixes) => {
        if (error) {
          reject(new Error(`RDF parsing error: ${error.message}`));
        } else if (quad) {
          quads.push(quad);
        } else {
          // Parsing complete
          this.logger.debug(`Parsed ${quads.length} RDF triples`);
          resolve(quads);
        }
      });
    });
  }
  
  /**
   * Build comprehensive semantic indexes
   */
  async buildSemanticIndexes(quads) {
    for (const quad of quads) {
      await this.indexQuadSemantically(quad);
    }
    
    // Build relationship graph
    await this.buildRelationshipIndex();
    
    // Build full-text search index
    if (this.config.enableFullTextIndex) {
      await this.buildFullTextIndex();
    }
  }
  
  /**
   * Index a single quad with full semantic analysis
   */
  async indexQuadSemantically(quad) {
    const { subject, predicate, object, graph } = quad;
    
    // Index subject
    await this.indexSubject(subject, predicate, object);
    
    // Index predicate usage
    await this.indexPredicate(predicate, subject, object);
    
    // Index object with type-specific handling
    await this.indexObject(object, subject, predicate);
    
    // Special RDF vocabulary handling
    await this.handleSpecialVocabularies(quad);
    
    // Graph indexing
    if (graph && !graph.equals(DataFactory.defaultGraph())) {
      await this.indexNamedGraph(graph, quad);
    }
    
    this.statistics.totalTriples++;
  }
  
  /**
   * Index RDF subjects with metadata
   */
  async indexSubject(subject, predicate, object) {
    const subjectKey = this.termToString(subject);
    
    if (!this.semanticIndexes.subjects.has(subjectKey)) {
      this.semanticIndexes.subjects.set(subjectKey, {
        uri: subjectKey,
        termType: subject.termType,
        predicates: new Set(),
        outgoingRelations: new Set(),
        incomingRelations: new Set(),
        types: new Set(),
        tripleCount: 0
      });
      this.statistics.samples.subjects.add(subjectKey);
    }
    
    const subjectInfo = this.semanticIndexes.subjects.get(subjectKey);
    subjectInfo.predicates.add(this.termToString(predicate));
    subjectInfo.tripleCount++;
    
    // Track types
    if (predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
      subjectInfo.types.add(this.termToString(object));
      
      // Update type index
      const typeKey = this.termToString(object);
      if (!this.semanticIndexes.types.has(typeKey)) {
        this.semanticIndexes.types.set(typeKey, new Set());
      }
      this.semanticIndexes.types.get(typeKey).add(subjectKey);
    }
  }
  
  /**
   * Index RDF predicates with usage statistics
   */
  async indexPredicate(predicate, subject, object) {
    const predicateKey = this.termToString(predicate);
    
    if (!this.semanticIndexes.predicates.has(predicateKey)) {
      this.semanticIndexes.predicates.set(predicateKey, {
        uri: predicateKey,
        usageCount: 0,
        subjects: new Set(),
        objects: new Set(),
        objectTypes: new Set(),
        domains: new Set(),
        ranges: new Set()
      });
      this.statistics.samples.predicates.add(predicateKey);
    }
    
    const predicateInfo = this.semanticIndexes.predicates.get(predicateKey);
    predicateInfo.usageCount++;
    predicateInfo.subjects.add(this.termToString(subject));
    predicateInfo.objects.add(this.termToString(object));
    predicateInfo.objectTypes.add(object.termType);
  }
  
  /**
   * Index RDF objects with type-specific processing
   */
  async indexObject(object, subject, predicate) {
    const objectKey = this.termToString(object);
    
    if (!this.semanticIndexes.objects.has(objectKey)) {
      this.semanticIndexes.objects.set(objectKey, {
        value: objectKey,
        termType: object.termType,
        referencedBy: new Set(),
        predicates: new Set()
      });
    }
    
    const objectInfo = this.semanticIndexes.objects.get(objectKey);
    objectInfo.referencedBy.add(this.termToString(subject));
    objectInfo.predicates.add(this.termToString(predicate));
    
    // Type-specific processing
    if (object.termType === 'Literal') {
      await this.indexLiteral(object);
    } else if (object.termType === 'NamedNode') {
      // Track outgoing relationships
      const subjectKey = this.termToString(subject);
      if (this.semanticIndexes.subjects.has(subjectKey)) {
        this.semanticIndexes.subjects.get(subjectKey).outgoingRelations.add(objectKey);
      }
    }
  }
  
  /**
   * Index literal values with language and datatype handling
   */
  async indexLiteral(literal) {
    const value = literal.value;
    const language = literal.language;
    const datatype = literal.datatype;
    const normalizedValue = value.toLowerCase().trim();
    
    // Literal value index
    if (!this.semanticIndexes.literals.has(normalizedValue)) {
      this.semanticIndexes.literals.set(normalizedValue, {
        originalValue: value,
        occurrences: new Set(),
        languages: new Set(),
        datatypes: new Set()
      });
    }
    
    const literalInfo = this.semanticIndexes.literals.get(normalizedValue);
    literalInfo.occurrences.add(this.termToString(literal));
    
    // Language indexing
    if (language && this.config.enableLanguageIndex) {
      if (!this.semanticIndexes.languages.has(language)) {
        this.semanticIndexes.languages.set(language, new Set());
      }
      this.semanticIndexes.languages.get(language).add(this.termToString(literal));
      literalInfo.languages.add(language);
      this.statistics.samples.languages.add(language);
    }
    
    // Datatype indexing
    if (datatype) {
      const datatypeStr = datatype.value;
      if (!this.semanticIndexes.datatypes.has(datatypeStr)) {
        this.semanticIndexes.datatypes.set(datatypeStr, new Set());
      }
      this.semanticIndexes.datatypes.get(datatypeStr).add(this.termToString(literal));
      literalInfo.datatypes.add(datatypeStr);
      this.statistics.samples.datatypes.add(datatypeStr);
    }
  }
  
  /**
   * Handle special RDF vocabularies (RDFS, OWL, etc.)
   */
  async handleSpecialVocabularies(quad) {
    const { subject, predicate, object } = quad;
    const predicateUri = predicate.value;
    
    // RDFS domain/range processing
    if (predicateUri === 'http://www.w3.org/2000/01/rdf-schema#domain') {
      const predicateKey = this.termToString(subject);
      const domainKey = this.termToString(object);
      if (this.semanticIndexes.predicates.has(predicateKey)) {
        this.semanticIndexes.predicates.get(predicateKey).domains.add(domainKey);
      }
    }
    
    if (predicateUri === 'http://www.w3.org/2000/01/rdf-schema#range') {
      const predicateKey = this.termToString(subject);
      const rangeKey = this.termToString(object);
      if (this.semanticIndexes.predicates.has(predicateKey)) {
        this.semanticIndexes.predicates.get(predicateKey).ranges.add(rangeKey);
      }
    }
    
    // OWL equivalence and relationships
    if (predicateUri === 'http://www.w3.org/2002/07/owl#sameAs') {
      // Track equivalent entities
      const subjectKey = this.termToString(subject);
      const objectKey = this.termToString(object);
      // Implementation for equivalence tracking
    }
  }
  
  /**
   * Build relationship index for graph traversal
   */
  async buildRelationshipIndex() {
    for (const [subjectKey, subjectInfo] of this.semanticIndexes.subjects) {
      const relationships = new Set();
      
      // Find related subjects through shared predicates or objects
      for (const predicateKey of subjectInfo.predicates) {
        const predicateInfo = this.semanticIndexes.predicates.get(predicateKey);
        if (predicateInfo) {
          for (const relatedSubject of predicateInfo.subjects) {
            if (relatedSubject !== subjectKey) {
              relationships.add(relatedSubject);
            }
          }
        }
      }
      
      this.semanticIndexes.relationships.set(subjectKey, relationships);
    }
  }
  
  /**
   * Build full-text search index
   */
  async buildFullTextIndex() {
    for (const [value, literalInfo] of this.semanticIndexes.literals) {
      const words = this.tokenizeText(literalInfo.originalValue);
      
      for (const word of words) {
        const normalizedWord = word.toLowerCase();
        if (!this.semanticIndexes.fullText.has(normalizedWord)) {
          this.semanticIndexes.fullText.set(normalizedWord, new Set());
        }
        
        for (const occurrence of literalInfo.occurrences) {
          this.semanticIndexes.fullText.get(normalizedWord).add(occurrence);
        }
      }
    }
  }
  
  /**
   * Tokenize text for full-text search
   */
  tokenizeText(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 100); // Limit words per text
  }
  
  /**
   * Validate semantic structure
   */
  async validateSemanticStructure() {
    const validation = {
      structuralIntegrity: true,
      warnings: [],
      errors: [],
      recommendations: []
    };
    
    // Check for disconnected components
    const connected = this.analyzeConnectivity();
    if (connected.components > 1) {
      validation.warnings.push(`Graph has ${connected.components} disconnected components`);
    }
    
    // Check for dangling references
    const dangling = this.findDanglingReferences();
    if (dangling.length > 0) {
      validation.warnings.push(`Found ${dangling.length} dangling references`);
      validation.recommendations.push('Consider adding missing resource definitions');
    }
    
    // Check for common patterns
    if (this.statistics.totalTriples > 1000) {
      validation.recommendations.push('Large graph detected - consider partitioning for better performance');
    }
    
    this.statistics.validationResults = validation;
    return validation;
  }
  
  /**
   * Analyze graph connectivity
   */
  analyzeConnectivity() {
    const visited = new Set();
    let components = 0;
    
    for (const subjectKey of this.semanticIndexes.subjects.keys()) {
      if (!visited.has(subjectKey)) {
        this.dfsComponent(subjectKey, visited);
        components++;
      }
    }
    
    return { components, totalNodes: this.semanticIndexes.subjects.size };
  }
  
  /**
   * DFS for connectivity analysis
   */
  dfsComponent(node, visited) {
    visited.add(node);
    
    const relationships = this.semanticIndexes.relationships.get(node);
    if (relationships) {
      for (const related of relationships) {
        if (!visited.has(related)) {
          this.dfsComponent(related, visited);
        }
      }
    }
  }
  
  /**
   * Find dangling references
   */
  findDanglingReferences() {
    const dangling = [];
    
    for (const [objectKey, objectInfo] of this.semanticIndexes.objects) {
      if (objectInfo.termType === 'NamedNode' && !this.semanticIndexes.subjects.has(objectKey)) {
        dangling.push(objectKey);
      }
    }
    
    return dangling.slice(0, 50); // Limit results
  }
  
  /**
   * Query semantic indexes
   */
  async query(pattern, options = {}) {
    const startTime = performance.now();
    const maxResults = options.maxResults || 1000;
    
    try {
      // Use N3 Store for SPARQL-like queries
      const matches = this.store.getQuads(
        pattern.subject ? namedNode(pattern.subject) : null,
        pattern.predicate ? namedNode(pattern.predicate) : null,
        pattern.object ? (pattern.objectLiteral ? literal(pattern.object) : namedNode(pattern.object)) : null,
        pattern.graph ? namedNode(pattern.graph) : null
      );
      
      const results = matches.slice(0, maxResults).map(quad => ({
        subject: this.termToString(quad.subject),
        predicate: this.termToString(quad.predicate),
        object: this.termToString(quad.object),
        graph: this.termToString(quad.graph)
      }));
      
      return {
        results,
        count: results.length,
        hasMore: matches.length > maxResults,
        queryTime: Math.round(performance.now() - startTime)
      };
    } catch (error) {
      this.logger.error('Semantic query failed:', error);
      throw error;
    }
  }
  
  /**
   * Find resources by type using semantic index
   */
  findByType(typeUri, options = {}) {
    const maxResults = options.maxResults || 1000;
    const typeKey = typeof typeUri === 'string' ? `<${typeUri}>` : this.termToString(typeUri);
    
    const subjects = this.semanticIndexes.types.get(typeKey);
    if (!subjects) {
      return { results: [], count: 0, type: typeKey };
    }
    
    const results = Array.from(subjects).slice(0, maxResults).map(subjectKey => {
      const subjectInfo = this.semanticIndexes.subjects.get(subjectKey);
      return {
        subject: subjectKey,
        predicateCount: subjectInfo ? subjectInfo.predicates.size : 0,
        tripleCount: subjectInfo ? subjectInfo.tripleCount : 0
      };
    });
    
    return {
      results,
      count: results.length,
      hasMore: subjects.size > maxResults,
      type: typeKey
    };
  }
  
  /**
   * Full-text search in semantic index
   */
  searchText(query, options = {}) {
    const maxResults = options.maxResults || 100;
    const words = this.tokenizeText(query);
    const matchCounts = new Map();
    
    // Score results by word frequency
    for (const word of words) {
      const matches = this.semanticIndexes.fullText.get(word);
      if (matches) {
        for (const match of matches) {
          const count = matchCounts.get(match) || 0;
          matchCounts.set(match, count + 1);
        }
      }
    }
    
    // Sort by relevance score
    const sortedResults = Array.from(matchCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxResults)
      .map(([literal, score]) => ({ literal, relevanceScore: score }));
    
    return {
      results: sortedResults,
      count: sortedResults.length,
      query: words,
      totalMatches: matchCounts.size
    };
  }
  
  /**
   * Convert RDF term to string representation
   */
  termToString(term) {
    if (!term) return '';
    
    switch (term.termType) {
      case 'NamedNode':
        return `<${term.value}>`;
      case 'BlankNode':
        return `_:${term.value}`;
      case 'Literal':
        let result = `"${term.value}"`;
        if (term.language) {
          result += `@${term.language}`;
        } else if (term.datatype && term.datatype.value !== 'http://www.w3.org/2001/XMLSchema#string') {
          result += `^^<${term.datatype.value}>`;
        }
        return result;
      case 'DefaultGraph':
        return 'DEFAULT';
      default:
        return term.value || '';
    }
  }
  
  /**
   * Update comprehensive statistics
   */
  updateStatistics() {
    this.statistics.uniqueSubjects = this.semanticIndexes.subjects.size;
    this.statistics.uniquePredicates = this.semanticIndexes.predicates.size;
    this.statistics.uniqueObjects = this.semanticIndexes.objects.size;
    
    // Count term types from objects
    let literalCount = 0, uriCount = 0, blankNodeCount = 0;
    
    for (const [objectKey, objectInfo] of this.semanticIndexes.objects) {
      switch (objectInfo.termType) {
        case 'Literal':
          literalCount++;
          break;
        case 'NamedNode':
          uriCount++;
          break;
        case 'BlankNode':
          blankNodeCount++;
          break;
      }
    }
    
    this.statistics.literalCount = literalCount;
    this.statistics.uriCount = uriCount;
    this.statistics.blankNodeCount = blankNodeCount;
    
    // Memory usage estimation
    const totalIndexEntries = Object.values(this.semanticIndexes)
      .reduce((sum, index) => sum + (index instanceof Map ? index.size : 0), 0);
    this.statistics.performance.memoryUsage = Math.round(totalIndexEntries * 0.15); // Rough MB estimate
  }
  
  /**
   * Generate comprehensive index report
   */
  generateReport() {
    const report = {
      indexingMode: 'SEMANTIC',
      timestamp: new Date().toISOString(),
      statistics: { ...this.statistics },
      indexes: {
        subjects: this.semanticIndexes.subjects.size,
        predicates: this.semanticIndexes.predicates.size,
        objects: this.semanticIndexes.objects.size,
        types: this.semanticIndexes.types.size,
        literals: this.semanticIndexes.literals.size,
        languages: this.semanticIndexes.languages.size,
        datatypes: this.semanticIndexes.datatypes.size,
        fullText: this.semanticIndexes.fullText.size,
        relationships: this.semanticIndexes.relationships.size
      },
      topPredicates: this.getTopPredicates(10),
      languageDistribution: this.getLanguageDistribution(),
      datatypeDistribution: this.getDatatypeDistribution(),
      performance: {
        processingTime: this.statistics.processingTime,
        indexingRate: this.statistics.performance.indexingRate,
        memoryUsage: this.statistics.performance.memoryUsage,
        performanceTargetMet: this.statistics.processingTime <= this.config.performanceTarget
      },
      validation: this.statistics.validationResults
    };
    
    return report;
  }
  
  /**
   * Get top predicates by usage
   */
  getTopPredicates(limit = 10) {
    return Array.from(this.semanticIndexes.predicates.entries())
      .sort((a, b) => b[1].usageCount - a[1].usageCount)
      .slice(0, limit)
      .map(([predicate, info]) => ({
        predicate,
        usageCount: info.usageCount,
        uniqueSubjects: info.subjects.size,
        uniqueObjects: info.objects.size
      }));
  }
  
  /**
   * Get language distribution
   */
  getLanguageDistribution() {
    const distribution = {};
    for (const [language, literals] of this.semanticIndexes.languages) {
      distribution[language] = literals.size;
    }
    return distribution;
  }
  
  /**
   * Get datatype distribution
   */
  getDatatypeDistribution() {
    const distribution = {};
    for (const [datatype, literals] of this.semanticIndexes.datatypes) {
      distribution[datatype] = literals.size;
    }
    return distribution;
  }
  
  /**
   * Clear all indexes
   */
  clear() {
    this.store = new Store();
    
    for (const index of Object.values(this.semanticIndexes)) {
      if (index instanceof Map) {
        index.clear();
      }
    }
    
    this.statistics = {
      totalTriples: 0,
      uniqueSubjects: 0,
      uniquePredicates: 0,
      uniqueObjects: 0,
      literalCount: 0,
      uriCount: 0,
      blankNodeCount: 0,
      processingTime: 0,
      indexingComplete: false,
      validationResults: null,
      performance: {
        indexingRate: 0,
        memoryUsage: 0,
        cacheHitRatio: 0
      },
      samples: {
        languages: new Set(),
        datatypes: new Set(),
        predicates: new Set(),
        subjects: new Set()
      }
    };
    
    this.emit('cleared');
  }
}

export default SemanticGraphIndexer;
