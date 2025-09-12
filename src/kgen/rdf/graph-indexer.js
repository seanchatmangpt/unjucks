/**
 * RDF Graph Indexer
 * 
 * Efficient triple indexing for fast queries and graph operations.
 * Replaces the basic subject/predicate/object extraction in bin/kgen.mjs
 * with proper semantic indexing.
 */

import { EventEmitter } from 'events';
import { consola } from 'consola';
import { DataFactory } from 'n3';

const { namedNode, literal, blankNode } = DataFactory;

/**
 * Advanced RDF Graph Indexer
 */
export class GraphIndexer extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      enableFullTextIndex: config.enableFullTextIndex !== false,
      enableTypeIndex: config.enableTypeIndex !== false,
      enableLanguageIndex: config.enableLanguageIndex !== false,
      enableStatistics: config.enableStatistics !== false,
      maxIndexSize: config.maxIndexSize || 10000000, // 10M entries
      ...config
    };
    
    // Core indexes (SPO permutations)
    this.indexes = {
      spo: new Map(), // Subject -> Predicate -> Objects
      sop: new Map(), // Subject -> Object -> Predicates  
      pso: new Map(), // Predicate -> Subject -> Objects
      pos: new Map(), // Predicate -> Object -> Subjects
      osp: new Map(), // Object -> Subject -> Predicates
      ops: new Map()  // Object -> Predicate -> Subjects
    };
    
    // Specialized indexes
    this.specialIndexes = {
      types: new Map(),        // rdf:type index
      literals: new Map(),     // Literal value index
      languages: new Map(),    // Language tag index
      datatypes: new Map(),    // Datatype index
      fullText: new Map(),     // Full text search index
      graphs: new Map()        // Named graph index
    };
    
    // Statistics and metrics
    this.stats = {
      totalTriples: 0,
      uniqueSubjects: 0,
      uniquePredicates: 0,
      uniqueObjects: 0,
      uniqueGraphs: 0,
      literalCount: 0,
      uriCount: 0,
      blankNodeCount: 0,
      languageStats: new Map(),
      datatypeStats: new Map(),
      predicateStats: new Map()
    };
    
    this.logger = consola.withTag('graph-indexer');
  }
  
  /**
   * Index a collection of quads
   */
  async indexQuads(quads, options = {}) {
    const startTime = this.getDeterministicTimestamp();
    let indexed = 0;
    
    try {
      // Batch processing for better performance
      const batchSize = options.batchSize || 1000;
      
      for (let i = 0; i < quads.length; i += batchSize) {
        const batch = quads.slice(i, i + batchSize);
        
        for (const quad of batch) {
          await this.indexQuad(quad);
          indexed++;
        }
        
        // Emit progress for large datasets
        if (quads.length > 10000 && i % (batchSize * 10) === 0) {
          this.emit('indexing-progress', {
            processed: i + batch.length,
            total: quads.length,
            percentage: Math.round(((i + batch.length) / quads.length) * 100)
          });
        }
      }
      
      // Update global statistics
      this.updateStatistics();
      
      const processingTime = this.getDeterministicTimestamp() - startTime;
      
      this.emit('indexing-complete', {
        indexed,
        processingTime,
        totalTriples: this.stats.totalTriples
      });
      
      return {
        success: true,
        indexed,
        totalTriples: this.stats.totalTriples,
        processingTime,
        indexes: this.getIndexSummary()
      };
    } catch (error) {
      this.logger.error('Indexing failed:', error);
      throw error;
    }
  }
  
  /**
   * Index a single quad
   */
  async indexQuad(quad) {
    const { subject, predicate, object, graph } = quad;
    
    // Index all six SPO permutations
    this.addToIndex(this.indexes.spo, subject, predicate, object);
    this.addToIndex(this.indexes.sop, subject, object, predicate);
    this.addToIndex(this.indexes.pso, predicate, subject, object);
    this.addToIndex(this.indexes.pos, predicate, object, subject);
    this.addToIndex(this.indexes.osp, object, subject, predicate);
    this.addToIndex(this.indexes.ops, object, predicate, subject);
    
    // Special indexing
    await this.indexSpecialCases(quad);
    
    // Update counters
    this.stats.totalTriples++;
  }
  
  /**
   * Add triple to a specific index structure
   */
  addToIndex(index, key1, key2, value) {
    const key1Str = this.termToString(key1);
    const key2Str = this.termToString(key2);
    const valueStr = this.termToString(value);
    
    if (!index.has(key1Str)) {
      index.set(key1Str, new Map());
    }
    
    const secondLevel = index.get(key1Str);
    if (!secondLevel.has(key2Str)) {
      secondLevel.set(key2Str, new Set());
    }
    
    secondLevel.get(key2Str).add(valueStr);
  }
  
  /**
   * Handle special indexing cases
   */
  async indexSpecialCases(quad) {
    const { subject, predicate, object, graph } = quad;
    
    // RDF type indexing
    if (predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
      this.indexType(subject, object);
    }
    
    // Literal indexing
    if (object.termType === 'Literal') {
      this.indexLiteral(object);
      
      // Full-text indexing
      if (this.config.enableFullTextIndex) {
        this.indexFullText(object);
      }
    }
    
    // Graph indexing
    if (graph && !graph.equals(DataFactory.defaultGraph())) {
      this.indexGraph(graph, quad);
    }
    
    // Update predicate usage statistics
    const predStr = this.termToString(predicate);
    const currentCount = this.stats.predicateStats.get(predStr) || 0;
    this.stats.predicateStats.set(predStr, currentCount + 1);
  }
  
  /**
   * Index RDF types
   */
  indexType(subject, type) {
    const typeStr = this.termToString(type);
    const subjectStr = this.termToString(subject);
    
    if (!this.specialIndexes.types.has(typeStr)) {
      this.specialIndexes.types.set(typeStr, new Set());
    }
    
    this.specialIndexes.types.get(typeStr).add(subjectStr);
  }
  
  /**
   * Index literal values
   */
  indexLiteral(literal) {
    const value = literal.value;
    const language = literal.language;
    const datatype = literal.datatype;
    
    // Value index
    const normalizedValue = value.toLowerCase().trim();
    if (!this.specialIndexes.literals.has(normalizedValue)) {
      this.specialIndexes.literals.set(normalizedValue, new Set());
    }
    this.specialIndexes.literals.get(normalizedValue).add(this.termToString(literal));
    
    // Language index
    if (language && this.config.enableLanguageIndex) {
      if (!this.specialIndexes.languages.has(language)) {
        this.specialIndexes.languages.set(language, new Set());
      }
      this.specialIndexes.languages.get(language).add(this.termToString(literal));
      
      // Update language statistics
      const langCount = this.stats.languageStats.get(language) || 0;
      this.stats.languageStats.set(language, langCount + 1);
    }
    
    // Datatype index
    if (datatype) {
      const datatypeStr = datatype.value;
      if (!this.specialIndexes.datatypes.has(datatypeStr)) {
        this.specialIndexes.datatypes.set(datatypeStr, new Set());
      }
      this.specialIndexes.datatypes.get(datatypeStr).add(this.termToString(literal));
      
      // Update datatype statistics
      const dtCount = this.stats.datatypeStats.get(datatypeStr) || 0;
      this.stats.datatypeStats.set(datatypeStr, dtCount + 1);
    }
  }
  
  /**
   * Index for full-text search
   */
  indexFullText(literal) {
    const text = literal.value;
    const words = this.tokenizeText(text);
    
    for (const word of words) {
      const normalizedWord = word.toLowerCase();
      if (!this.specialIndexes.fullText.has(normalizedWord)) {
        this.specialIndexes.fullText.set(normalizedWord, new Set());
      }
      this.specialIndexes.fullText.get(normalizedWord).add(this.termToString(literal));
    }
  }
  
  /**
   * Simple text tokenization
   */
  tokenizeText(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2) // Filter out short words
      .slice(0, 50); // Limit words per literal
  }
  
  /**
   * Index named graphs
   */
  indexGraph(graph, quad) {
    const graphStr = this.termToString(graph);
    
    if (!this.specialIndexes.graphs.has(graphStr)) {
      this.specialIndexes.graphs.set(graphStr, {
        triples: new Set(),
        subjects: new Set(),
        predicates: new Set(),
        objects: new Set()
      });
    }
    
    const graphIndex = this.specialIndexes.graphs.get(graphStr);
    const tripleStr = `${this.termToString(quad.subject)} ${this.termToString(quad.predicate)} ${this.termToString(quad.object)}`;
    
    graphIndex.triples.add(tripleStr);
    graphIndex.subjects.add(this.termToString(quad.subject));
    graphIndex.predicates.add(this.termToString(quad.predicate));
    graphIndex.objects.add(this.termToString(quad.object));
  }
  
  /**
   * Query the indexes
   */
  async query(pattern, options = {}) {
    const { subject, predicate, object, graph } = pattern;
    const maxResults = options.maxResults || 1000;
    const results = [];
    
    try {
      // Choose optimal index based on bound variables
      const index = this.selectOptimalIndex(pattern);
      const matches = this.executeIndexQuery(index, pattern, maxResults);
      
      for (const match of matches) {
        results.push(this.parseMatchResult(match, pattern));
        if (results.length >= maxResults) break;
      }
      
      return {
        results,
        count: results.length,
        hasMore: matches.length > maxResults,
        index: index.name
      };
    } catch (error) {
      this.logger.error('Query failed:', error);
      throw error;
    }
  }
  
  /**
   * Select optimal index for query pattern
   */
  selectOptimalIndex(pattern) {
    const { subject, predicate, object } = pattern;
    
    // Count bound variables
    const boundCount = [subject, predicate, object].filter(v => v !== null).length;
    
    if (boundCount === 0) {
      return { name: 'spo', index: this.indexes.spo }; // Default to SPO
    }
    
    if (subject && predicate) {
      return { name: 'spo', index: this.indexes.spo };
    }
    
    if (subject && object) {
      return { name: 'sop', index: this.indexes.sop };
    }
    
    if (predicate && object) {
      return { name: 'pos', index: this.indexes.pos };
    }
    
    if (subject) {
      return { name: 'spo', index: this.indexes.spo };
    }
    
    if (predicate) {
      return { name: 'pso', index: this.indexes.pso };
    }
    
    if (object) {
      return { name: 'osp', index: this.indexes.osp };
    }
    
    return { name: 'spo', index: this.indexes.spo };
  }
  
  /**
   * Execute query against specific index
   */
  executeIndexQuery(indexInfo, pattern, maxResults) {
    const { index } = indexInfo;
    const { subject, predicate, object } = pattern;
    const results = [];
    
    // This is a simplified query execution
    // Real implementation would need more sophisticated matching
    
    for (const [key1, level2] of index) {
      for (const [key2, values] of level2) {
        for (const value of values) {
          results.push({ key1, key2, value });
          if (results.length >= maxResults) return results;
        }
      }
    }
    
    return results;
  }
  
  /**
   * Parse match result back to quad pattern
   */
  parseMatchResult(match, pattern) {
    // This would need to be implemented based on the index structure
    return match;
  }
  
  /**
   * Find resources by type
   */
  findByType(typeUri, options = {}) {
    const typeStr = typeof typeUri === 'string' ? typeUri : this.termToString(typeUri);
    const maxResults = options.maxResults || 1000;
    
    const subjects = this.specialIndexes.types.get(typeStr);
    if (!subjects) {
      return { results: [], count: 0 };
    }
    
    const results = Array.from(subjects).slice(0, maxResults);
    
    return {
      results,
      count: results.length,
      hasMore: subjects.size > maxResults,
      type: typeStr
    };
  }
  
  /**
   * Full-text search in literals
   */
  searchText(query, options = {}) {
    const maxResults = options.maxResults || 100;
    const words = this.tokenizeText(query);
    const results = new Set();
    
    for (const word of words) {
      const matches = this.specialIndexes.fullText.get(word);
      if (matches) {
        for (const match of matches) {
          results.add(match);
          if (results.size >= maxResults) break;
        }
      }
    }
    
    return {
      results: Array.from(results),
      count: results.size,
      query: words
    };
  }
  
  /**
   * Get all resources of specific language
   */
  findByLanguage(language, options = {}) {
    const maxResults = options.maxResults || 1000;
    const literals = this.specialIndexes.languages.get(language);
    
    if (!literals) {
      return { results: [], count: 0 };
    }
    
    const results = Array.from(literals).slice(0, maxResults);
    
    return {
      results,
      count: results.length,
      hasMore: literals.size > maxResults,
      language
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
   * Update global statistics
   */
  updateStatistics() {
    // Count unique elements across all indexes
    const allSubjects = new Set();
    const allPredicates = new Set();
    const allObjects = new Set();
    
    for (const [subject, predicateMap] of this.indexes.spo) {
      allSubjects.add(subject);
      for (const [predicate, objects] of predicateMap) {
        allPredicates.add(predicate);
        for (const object of objects) {
          allObjects.add(object);
        }
      }
    }
    
    this.stats.uniqueSubjects = allSubjects.size;
    this.stats.uniquePredicates = allPredicates.size;
    this.stats.uniqueObjects = allObjects.size;
    this.stats.uniqueGraphs = this.specialIndexes.graphs.size;
    
    // Count term types
    this.stats.literalCount = 0;
    this.stats.uriCount = 0;
    this.stats.blankNodeCount = 0;
    
    for (const object of allObjects) {
      if (object.startsWith('"')) {
        this.stats.literalCount++;
      } else if (object.startsWith('<')) {
        this.stats.uriCount++;
      } else if (object.startsWith('_:')) {
        this.stats.blankNodeCount++;
      }
    }
  }
  
  /**
   * Get index summary for reporting
   */
  getIndexSummary() {
    return {
      coreIndexes: {
        spo: this.indexes.spo.size,
        sop: this.indexes.sop.size,
        pso: this.indexes.pso.size,
        pos: this.indexes.pos.size,
        osp: this.indexes.osp.size,
        ops: this.indexes.ops.size
      },
      specialIndexes: {
        types: this.specialIndexes.types.size,
        literals: this.specialIndexes.literals.size,
        languages: this.specialIndexes.languages.size,
        datatypes: this.specialIndexes.datatypes.size,
        fullText: this.specialIndexes.fullText.size,
        graphs: this.specialIndexes.graphs.size
      },
      statistics: { ...this.stats }
    };
  }
  
  /**
   * Generate detailed index report
   */
  generateReport() {
    const summary = this.getIndexSummary();
    
    return {
      timestamp: this.getDeterministicDate().toISOString(),
      summary,
      topPredicates: this.getTopPredicates(10),
      languageDistribution: Object.fromEntries(this.stats.languageStats),
      datatypeDistribution: Object.fromEntries(this.stats.datatypeStats),
      memoryUsage: this.estimateMemoryUsage()
    };
  }
  
  /**
   * Get most frequently used predicates
   */
  getTopPredicates(limit = 10) {
    return Array.from(this.stats.predicateStats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([predicate, count]) => ({ predicate, count }));
  }
  
  /**
   * Estimate memory usage
   */
  estimateMemoryUsage() {
    // Rough estimation
    const indexEntries = Object.values(this.indexes).reduce((sum, index) => sum + index.size, 0);
    const specialEntries = Object.values(this.specialIndexes).reduce((sum, index) => sum + index.size, 0);
    
    return {
      estimatedMB: Math.round((indexEntries + specialEntries) * 0.1), // Very rough estimate
      indexEntries,
      specialEntries
    };
  }
  
  /**
   * Clear all indexes
   */
  clear() {
    for (const index of Object.values(this.indexes)) {
      index.clear();
    }
    
    for (const index of Object.values(this.specialIndexes)) {
      if (index instanceof Map) {
        index.clear();
      }
    }
    
    // Reset statistics
    this.stats = {
      totalTriples: 0,
      uniqueSubjects: 0,
      uniquePredicates: 0,
      uniqueObjects: 0,
      uniqueGraphs: 0,
      literalCount: 0,
      uriCount: 0,
      blankNodeCount: 0,
      languageStats: new Map(),
      datatypeStats: new Map(),
      predicateStats: new Map()
    };
    
    this.emit('cleared');
  }
}

export default GraphIndexer;