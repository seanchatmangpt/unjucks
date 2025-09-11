/**
 * RDF* (RDF-Star) Processor - Statement annotation and nested triples support
 * Enables provenance tracking, metadata attachment, and contextual statements
 */

import { DataFactory } from 'n3';
import { EventEmitter } from 'events';
import crypto from 'crypto';

const { namedNode, literal, blankNode, defaultGraph, quad } = DataFactory;

/**
 * Extended DataFactory for RDF* quoted triples
 */
class RDFStarDataFactory extends DataFactory {
  static quotedTriple(subject, predicate, object) {
    return {
      termType: 'Quad',
      subject,
      predicate, 
      object,
      graph: defaultGraph(),
      value: `<<${subject.value} ${predicate.value} ${object.value}>>`
    };
  }
  
  static annotationQuad(quotedTriple, predicate, object, graph = defaultGraph()) {
    return {
      termType: 'Quad',
      subject: quotedTriple,
      predicate,
      object,
      graph,
      isAnnotation: true
    };
  }
}

export class RDFStarProcessor extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // RDF* specific settings
      maxNestingDepth: config.maxNestingDepth || 10,
      enableProvenanceTracking: config.enableProvenanceTracking !== false,
      enableMetadataAttachment: config.enableMetadataAttachment !== false,
      annotationNamespace: config.annotationNamespace || 'http://kgen.ai/anno/',
      
      // Performance settings
      quotedTripleCache: config.quotedTripleCache !== false,
      maxCacheSize: config.maxCacheSize || 100000,
      enableIndexing: config.enableIndexing !== false,
      
      // Validation settings
      validateNesting: config.validateNesting !== false,
      strictModeChecking: config.strictModeChecking || false,
      
      ...config
    };
    
    // Core storage for quoted triples and annotations
    this.quotedTriples = new Map(); // quoted triple -> metadata
    this.annotations = new Map();   // annotation subject -> [annotations]
    this.provenanceGraph = new Map(); // statement -> provenance data
    
    // Indexes for fast lookup
    this.indexes = {
      byQuotedTriple: new Map(),
      byAnnotationPredicate: new Map(),
      byProvenanceSource: new Map(),
      byTimestamp: new Map()
    };
    
    // Cache for performance
    this.cache = {
      quotedTriples: new Map(),
      serialized: new Map(),
      validated: new Set()
    };
    
    this.dataFactory = RDFStarDataFactory;
    this.metrics = {
      quotedTriplesCreated: 0,
      annotationsAdded: 0,
      provenanceEntriesCreated: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
    
    this.status = 'initialized';
  }

  /**
   * Create a quoted triple for statement annotation
   */
  createQuotedTriple(subject, predicate, object, options = {}) {
    // Validate inputs
    this._validateTerms(subject, predicate, object);
    
    // Check nesting depth
    const nestingDepth = this._calculateNestingDepth(subject, predicate, object);
    if (nestingDepth > this.config.maxNestingDepth) {
      throw new Error(`Maximum nesting depth exceeded: ${nestingDepth}`);
    }
    
    // Create quoted triple
    const quotedTriple = this.dataFactory.quotedTriple(subject, predicate, object);
    
    // Add metadata
    const metadata = {
      id: this._generateId(),
      created: Date.now(),
      nestingDepth,
      hash: this._calculateQuotedTripleHash(quotedTriple),
      ...options.metadata
    };
    
    this.quotedTriples.set(quotedTriple.value, {
      quotedTriple,
      metadata
    });
    
    // Update indexes
    this._updateIndexes('add', quotedTriple, metadata);
    
    // Add to cache
    if (this.config.quotedTripleCache) {
      this.cache.quotedTriples.set(quotedTriple.value, quotedTriple);
    }
    
    this.metrics.quotedTriplesCreated++;
    this.emit('quoted-triple-created', { quotedTriple, metadata });
    
    return quotedTriple;
  }

  /**
   * Add annotation to a quoted triple or regular statement
   */
  addAnnotation(statement, predicate, object, options = {}) {
    const annotationQuad = this.dataFactory.annotationQuad(
      statement,
      predicate,
      object,
      options.graph
    );
    
    // Store annotation
    const statementKey = this._getStatementKey(statement);
    if (!this.annotations.has(statementKey)) {
      this.annotations.set(statementKey, []);
    }
    
    const annotation = {
      id: this._generateId(),
      quad: annotationQuad,
      created: Date.now(),
      source: options.source || 'system',
      confidence: options.confidence || 1.0,
      ...options.metadata
    };
    
    this.annotations.get(statementKey).push(annotation);
    
    // Update indexes
    this._updateAnnotationIndexes(annotation);
    
    // Add provenance if enabled
    if (this.config.enableProvenanceTracking && options.provenance) {
      this._addProvenance(statement, options.provenance);
    }
    
    this.metrics.annotationsAdded++;
    this.emit('annotation-added', { statement, annotation });
    
    return annotation;
  }

  /**
   * Add provenance information to a statement
   */
  addProvenance(statement, provenanceData) {
    const statementKey = this._getStatementKey(statement);
    
    const provenance = {
      id: this._generateId(),
      statement: statementKey,
      timestamp: Date.now(),
      source: provenanceData.source,
      agent: provenanceData.agent,
      activity: provenanceData.activity,
      derivedFrom: provenanceData.derivedFrom,
      wasGeneratedBy: provenanceData.wasGeneratedBy,
      ...provenanceData
    };
    
    this.provenanceGraph.set(statementKey, provenance);
    
    // Update provenance indexes
    this._updateProvenanceIndexes(provenance);
    
    this.metrics.provenanceEntriesCreated++;
    this.emit('provenance-added', { statement, provenance });
    
    return provenance;
  }

  /**
   * Get all annotations for a statement
   */
  getAnnotations(statement) {
    const statementKey = this._getStatementKey(statement);
    return this.annotations.get(statementKey) || [];
  }

  /**
   * Get provenance for a statement
   */
  getProvenance(statement) {
    const statementKey = this._getStatementKey(statement);
    return this.provenanceGraph.get(statementKey);
  }

  /**
   * Query quoted triples by pattern
   */
  queryQuotedTriples(pattern = {}) {
    const results = [];
    
    for (const [key, entry] of this.quotedTriples) {
      const { quotedTriple } = entry;
      
      if (this._matchesPattern(quotedTriple, pattern)) {
        results.push(entry);
      }
    }
    
    return results;
  }

  /**
   * Query annotations by predicate
   */
  queryAnnotationsByPredicate(predicate) {
    const predicateUri = typeof predicate === 'string' ? predicate : predicate.value;
    return this.indexes.byAnnotationPredicate.get(predicateUri) || [];
  }

  /**
   * Create contextual statement with full metadata
   */
  createContextualStatement(subject, predicate, object, context) {
    // Create the base statement
    const baseQuad = quad(subject, predicate, object, context.graph || defaultGraph());
    
    // Create quoted triple for annotation
    const quotedTriple = this.createQuotedTriple(subject, predicate, object, {
      metadata: context.metadata
    });
    
    // Add contextual annotations
    const annotations = [];
    
    if (context.confidence !== undefined) {
      annotations.push(this.addAnnotation(
        quotedTriple,
        namedNode(this.config.annotationNamespace + 'confidence'),
        literal(context.confidence.toString(), namedNode('http://www.w3.org/2001/XMLSchema#float'))
      ));
    }
    
    if (context.source) {
      annotations.push(this.addAnnotation(
        quotedTriple,
        namedNode(this.config.annotationNamespace + 'source'),
        typeof context.source === 'string' ? namedNode(context.source) : context.source
      ));
    }
    
    if (context.timestamp) {
      annotations.push(this.addAnnotation(
        quotedTriple,
        namedNode(this.config.annotationNamespace + 'timestamp'),
        literal(context.timestamp.toISOString(), namedNode('http://www.w3.org/2001/XMLSchema#dateTime'))
      ));
    }
    
    if (context.author) {
      annotations.push(this.addAnnotation(
        quotedTriple,
        namedNode(this.config.annotationNamespace + 'author'),
        typeof context.author === 'string' ? namedNode(context.author) : context.author
      ));
    }
    
    // Add custom annotations
    if (context.annotations) {
      for (const [pred, obj] of Object.entries(context.annotations)) {
        annotations.push(this.addAnnotation(
          quotedTriple,
          typeof pred === 'string' ? namedNode(pred) : pred,
          typeof obj === 'string' ? literal(obj) : obj
        ));
      }
    }
    
    // Add provenance if provided
    if (context.provenance) {
      this.addProvenance(quotedTriple, context.provenance);
    }
    
    return {
      baseQuad,
      quotedTriple,
      annotations,
      context
    };
  }

  /**
   * Serialize RDF* statements to various formats
   */
  async serialize(format = 'turtle-star', options = {}) {
    const cacheKey = `${format}-${JSON.stringify(options)}`;
    
    if (this.cache.serialized.has(cacheKey)) {
      this.metrics.cacheHits++;
      return this.cache.serialized.get(cacheKey);
    }
    
    this.metrics.cacheMisses++;
    
    let result;
    switch (format) {
      case 'turtle-star':
      case 'ttls':
        result = await this._serializeTurtleStar(options);
        break;
      case 'n3-star':
        result = await this._serializeN3Star(options);
        break;
      case 'jsonld-star':
        result = await this._serializeJSONLDStar(options);
        break;
      case 'canonical':
        result = await this._serializeCanonical(options);
        break;
      default:
        throw new Error(`Unsupported RDF* serialization format: ${format}`);
    }
    
    // Cache result
    if (this.config.quotedTripleCache && this.cache.serialized.size < this.config.maxCacheSize) {
      this.cache.serialized.set(cacheKey, result);
    }
    
    return result;
  }

  /**
   * Parse RDF* data from various formats
   */
  async parse(data, format = 'turtle-star', options = {}) {
    let parser;
    
    switch (format) {
      case 'turtle-star':
      case 'ttls':
        parser = this._createTurtleStarParser(options);
        break;
      case 'n3-star':
        parser = this._createN3StarParser(options);
        break;
      case 'jsonld-star':
        parser = this._createJSONLDStarParser(options);
        break;
      default:
        throw new Error(`Unsupported RDF* parsing format: ${format}`);
    }
    
    return parser.parse(data);
  }

  /**
   * Export contextual graph with full metadata
   */
  exportContextualGraph(options = {}) {
    const graph = {
      quotedTriples: [],
      annotations: [],
      provenance: [],
      metadata: {
        exported: new Date().toISOString(),
        totalQuotedTriples: this.quotedTriples.size,
        totalAnnotations: Array.from(this.annotations.values()).reduce((sum, arr) => sum + arr.length, 0),
        totalProvenance: this.provenanceGraph.size,
        format: 'kgen-rdf-star-v1'
      }
    };
    
    // Export quoted triples
    for (const [key, entry] of this.quotedTriples) {
      graph.quotedTriples.push({
        key,
        quotedTriple: this._serializeQuotedTriple(entry.quotedTriple),
        metadata: entry.metadata
      });
    }
    
    // Export annotations
    for (const [statementKey, annotations] of this.annotations) {
      graph.annotations.push({
        statement: statementKey,
        annotations: annotations.map(a => ({
          id: a.id,
          predicate: a.quad.predicate.value,
          object: this._serializeTerm(a.quad.object),
          created: a.created,
          source: a.source,
          confidence: a.confidence,
          metadata: a.metadata || {}
        }))
      });
    }
    
    // Export provenance
    for (const [statementKey, prov] of this.provenanceGraph) {
      graph.provenance.push({
        statement: statementKey,
        ...prov
      });
    }
    
    return graph;
  }

  /**
   * Import contextual graph
   */
  async importContextualGraph(graphData) {
    if (graphData.metadata?.format !== 'kgen-rdf-star-v1') {
      throw new Error('Unsupported contextual graph format');
    }
    
    // Import quoted triples
    for (const entry of graphData.quotedTriples) {
      const quotedTriple = this._deserializeQuotedTriple(entry.quotedTriple);
      this.quotedTriples.set(entry.key, {
        quotedTriple,
        metadata: entry.metadata
      });
    }
    
    // Import annotations
    for (const entry of graphData.annotations) {
      this.annotations.set(entry.statement, entry.annotations.map(a => ({
        id: a.id,
        quad: this.dataFactory.annotationQuad(
          this._deserializeStatement(entry.statement),
          namedNode(a.predicate),
          this._deserializeTerm(a.object)
        ),
        created: a.created,
        source: a.source,
        confidence: a.confidence,
        metadata: a.metadata
      })));
    }
    
    // Import provenance
    for (const entry of graphData.provenance) {
      this.provenanceGraph.set(entry.statement, entry);
    }
    
    // Rebuild indexes
    await this._rebuildIndexes();
    
    this.emit('contextual-graph-imported', {
      quotedTriples: graphData.quotedTriples.length,
      annotations: graphData.annotations.length,
      provenance: graphData.provenance.length
    });
  }

  /**
   * Get comprehensive statistics
   */
  getStatistics() {
    const memUsage = process.memoryUsage();
    
    return {
      counts: {
        quotedTriples: this.quotedTriples.size,
        annotations: Array.from(this.annotations.values()).reduce((sum, arr) => sum + arr.length, 0),
        provenance: this.provenanceGraph.size
      },
      metrics: { ...this.metrics },
      cache: {
        quotedTriples: this.cache.quotedTriples.size,
        serialized: this.cache.serialized.size,
        validated: this.cache.validated.size
      },
      indexes: {
        byQuotedTriple: this.indexes.byQuotedTriple.size,
        byAnnotationPredicate: this.indexes.byAnnotationPredicate.size,
        byProvenanceSource: this.indexes.byProvenanceSource.size,
        byTimestamp: this.indexes.byTimestamp.size
      },
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external
      }
    };
  }

  // Private methods

  _validateTerms(subject, predicate, object) {
    if (!subject || !predicate || !object) {
      throw new Error('Subject, predicate, and object are required');
    }
    
    if (this.config.strictModeChecking) {
      // Additional validation for strict mode
      if (predicate.termType !== 'NamedNode') {
        throw new Error('Predicate must be a NamedNode in strict mode');
      }
    }
  }

  _calculateNestingDepth(subject, predicate, object) {
    let maxDepth = 0;
    
    const checkTerm = (term, depth = 0) => {
      if (term.termType === 'Quad') {
        const subDepth = Math.max(
          checkTerm(term.subject, depth + 1),
          checkTerm(term.predicate, depth + 1),
          checkTerm(term.object, depth + 1)
        );
        return Math.max(depth, subDepth);
      }
      return depth;
    };
    
    maxDepth = Math.max(
      checkTerm(subject),
      checkTerm(predicate),
      checkTerm(object)
    );
    
    return maxDepth;
  }

  _generateId() {
    return crypto.randomBytes(16).toString('hex');
  }

  _calculateQuotedTripleHash(quotedTriple) {
    const serialized = this._serializeQuotedTriple(quotedTriple);
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  _getStatementKey(statement) {
    if (statement.termType === 'Quad' && statement.isAnnotation) {
      // For annotation quads, use the full quad serialization
      return this._serializeQuad(statement);
    } else if (statement.termType === 'Quad') {
      // For quoted triples
      return statement.value;
    } else {
      // For regular quads
      return this._serializeQuad(statement);
    }
  }

  _matchesPattern(quotedTriple, pattern) {
    if (pattern.subject && !this._termMatches(quotedTriple.subject, pattern.subject)) {
      return false;
    }
    if (pattern.predicate && !this._termMatches(quotedTriple.predicate, pattern.predicate)) {
      return false;
    }
    if (pattern.object && !this._termMatches(quotedTriple.object, pattern.object)) {
      return false;
    }
    return true;
  }

  _termMatches(term, pattern) {
    if (typeof pattern === 'string') {
      return term.value === pattern;
    }
    return term.equals && term.equals(pattern);
  }

  _updateIndexes(operation, quotedTriple, metadata) {
    const key = quotedTriple.value;
    
    if (operation === 'add') {
      // Index by quoted triple
      this.indexes.byQuotedTriple.set(key, { quotedTriple, metadata });
      
      // Index by timestamp
      const timestamp = Math.floor(metadata.created / 1000); // Group by second
      if (!this.indexes.byTimestamp.has(timestamp)) {
        this.indexes.byTimestamp.set(timestamp, []);
      }
      this.indexes.byTimestamp.get(timestamp).push(key);
    }
  }

  _updateAnnotationIndexes(annotation) {
    const predicateUri = annotation.quad.predicate.value;
    
    if (!this.indexes.byAnnotationPredicate.has(predicateUri)) {
      this.indexes.byAnnotationPredicate.set(predicateUri, []);
    }
    this.indexes.byAnnotationPredicate.get(predicateUri).push(annotation);
  }

  _updateProvenanceIndexes(provenance) {
    if (provenance.source) {
      if (!this.indexes.byProvenanceSource.has(provenance.source)) {
        this.indexes.byProvenanceSource.set(provenance.source, []);
      }
      this.indexes.byProvenanceSource.get(provenance.source).push(provenance);
    }
  }

  _addProvenance(statement, provenanceData) {
    return this.addProvenance(statement, provenanceData);
  }

  async _serializeTurtleStar(options) {
    const lines = [];
    
    // Add prefixes
    if (options.prefixes) {
      for (const [prefix, uri] of Object.entries(options.prefixes)) {
        lines.push(`@prefix ${prefix}: <${uri}> .`);
      }
      lines.push('');
    }
    
    // Serialize quoted triples with annotations
    for (const [key, entry] of this.quotedTriples) {
      const { quotedTriple } = entry;
      
      // Get annotations for this quoted triple
      const annotations = this.getAnnotations(quotedTriple);
      
      if (annotations.length > 0) {
        lines.push(`<< ${this._serializeTermTurtle(quotedTriple.subject)} ${this._serializeTermTurtle(quotedTriple.predicate)} ${this._serializeTermTurtle(quotedTriple.object)} >>`);
        
        for (const annotation of annotations) {
          lines.push(`    ${this._serializeTermTurtle(annotation.quad.predicate)} ${this._serializeTermTurtle(annotation.quad.object)} ;`);
        }
        
        // Remove last semicolon and add period
        lines[lines.length - 1] = lines[lines.length - 1].slice(0, -1) + ' .';
        lines.push('');
      }
    }
    
    return lines.join('\n');
  }

  async _serializeN3Star(options) {
    // Similar to Turtle* but with N3 specific syntax
    return this._serializeTurtleStar(options);
  }

  async _serializeJSONLDStar(options) {
    const graph = [];
    
    for (const [key, entry] of this.quotedTriples) {
      const { quotedTriple } = entry;
      const annotations = this.getAnnotations(quotedTriple);
      
      if (annotations.length > 0) {
        const node = {
          '@id': `_:qt${entry.metadata.id}`,
          '@type': 'rdf:Statement',
          'rdf:subject': this._termToJSONLD(quotedTriple.subject),
          'rdf:predicate': this._termToJSONLD(quotedTriple.predicate),
          'rdf:object': this._termToJSONLD(quotedTriple.object)
        };
        
        // Add annotations
        for (const annotation of annotations) {
          const predKey = this._shortenURI(annotation.quad.predicate.value);
          node[predKey] = this._termToJSONLD(annotation.quad.object);
        }
        
        graph.push(node);
      }
    }
    
    return JSON.stringify({
      '@context': {
        'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        'anno': this.config.annotationNamespace,
        ...options.context
      },
      '@graph': graph
    }, null, 2);
  }

  async _serializeCanonical(options) {
    const lines = [];
    
    // Get all entries and sort for deterministic output
    const entries = Array.from(this.quotedTriples.entries()).sort();
    
    for (const [key, entry] of entries) {
      const { quotedTriple } = entry;
      const annotations = this.getAnnotations(quotedTriple).sort((a, b) => 
        a.quad.predicate.value.localeCompare(b.quad.predicate.value)
      );
      
      lines.push(`<< ${this._serializeTermCanonical(quotedTriple.subject)} ${this._serializeTermCanonical(quotedTriple.predicate)} ${this._serializeTermCanonical(quotedTriple.object)} >>`);
      
      for (const annotation of annotations) {
        lines.push(`  ${this._serializeTermCanonical(annotation.quad.predicate)} ${this._serializeTermCanonical(annotation.quad.object)}`);
      }
    }
    
    return lines.join('\n');
  }

  _serializeQuotedTriple(quotedTriple) {
    return `<< ${quotedTriple.subject.value} ${quotedTriple.predicate.value} ${quotedTriple.object.value} >>`;
  }

  _serializeQuad(quad) {
    return `${quad.subject.value} ${quad.predicate.value} ${quad.object.value} ${quad.graph.value}`;
  }

  _serializeTerm(term) {
    if (term.termType === 'NamedNode') {
      return { type: 'NamedNode', value: term.value };
    } else if (term.termType === 'Literal') {
      return {
        type: 'Literal',
        value: term.value,
        language: term.language || undefined,
        datatype: term.datatype?.value || undefined
      };
    } else if (term.termType === 'BlankNode') {
      return { type: 'BlankNode', value: term.value };
    }
    return { type: 'Unknown', value: term.value };
  }

  _serializeTermTurtle(term) {
    if (term.termType === 'NamedNode') {
      return `<${term.value}>`;
    } else if (term.termType === 'Literal') {
      let result = `"${term.value}"`;
      if (term.language) {
        result += `@${term.language}`;
      } else if (term.datatype) {
        result += `^^<${term.datatype.value}>`;
      }
      return result;
    } else if (term.termType === 'BlankNode') {
      return `_:${term.value}`;
    }
    return term.value;
  }

  _serializeTermCanonical(term) {
    return this._serializeTermTurtle(term);
  }

  _termToJSONLD(term) {
    if (term.termType === 'NamedNode') {
      return { '@id': term.value };
    } else if (term.termType === 'Literal') {
      const obj = { '@value': term.value };
      if (term.language) {
        obj['@language'] = term.language;
      } else if (term.datatype) {
        obj['@type'] = term.datatype.value;
      }
      return obj;
    } else if (term.termType === 'BlankNode') {
      return { '@id': `_:${term.value}` };
    }
    return term.value;
  }

  _shortenURI(uri) {
    // Simple URI shortening for common namespaces
    if (uri.startsWith('http://www.w3.org/1999/02/22-rdf-syntax-ns#')) {
      return 'rdf:' + uri.substring(43);
    } else if (uri.startsWith(this.config.annotationNamespace)) {
      return 'anno:' + uri.substring(this.config.annotationNamespace.length);
    }
    return uri;
  }

  _deserializeQuotedTriple(data) {
    // Deserialize quoted triple from exported format
    const subject = this._deserializeTerm(data.subject);
    const predicate = this._deserializeTerm(data.predicate);
    const object = this._deserializeTerm(data.object);
    
    return this.dataFactory.quotedTriple(subject, predicate, object);
  }

  _deserializeTerm(data) {
    switch (data.type) {
      case 'NamedNode':
        return namedNode(data.value);
      case 'Literal':
        return literal(data.value, data.language || (data.datatype ? namedNode(data.datatype) : undefined));
      case 'BlankNode':
        return blankNode(data.value);
      default:
        throw new Error(`Unknown term type: ${data.type}`);
    }
  }

  _deserializeStatement(statementKey) {
    // Parse statement key back to statement object
    // This is a simplified implementation
    return { value: statementKey };
  }

  async _rebuildIndexes() {
    // Clear existing indexes
    for (const index of Object.values(this.indexes)) {
      index.clear();
    }
    
    // Rebuild from current data
    for (const [key, entry] of this.quotedTriples) {
      this._updateIndexes('add', entry.quotedTriple, entry.metadata);
    }
    
    for (const annotations of this.annotations.values()) {
      for (const annotation of annotations) {
        this._updateAnnotationIndexes(annotation);
      }
    }
    
    for (const provenance of this.provenanceGraph.values()) {
      this._updateProvenanceIndexes(provenance);
    }
  }

  _createTurtleStarParser(options) {
    // Create parser for Turtle* format
    return {
      parse: async (data) => {
        // Simplified Turtle* parsing
        const results = { quotedTriples: [], annotations: [] };
        // Implementation would parse the actual Turtle* syntax
        return results;
      }
    };
  }

  _createN3StarParser(options) {
    return this._createTurtleStarParser(options);
  }

  _createJSONLDStarParser(options) {
    return {
      parse: async (data) => {
        // Parse JSON-LD with RDF* support
        const jsonData = typeof data === 'string' ? JSON.parse(data) : data;
        const results = { quotedTriples: [], annotations: [] };
        // Implementation would parse the actual JSON-LD* syntax
        return results;
      }
    };
  }

  /**
   * Clear all data
   */
  clear() {
    this.quotedTriples.clear();
    this.annotations.clear();
    this.provenanceGraph.clear();
    
    for (const index of Object.values(this.indexes)) {
      index.clear();
    }
    
    for (const cache of Object.values(this.cache)) {
      cache.clear();
    }
    
    this.emit('cleared');
  }

  /**
   * Shutdown the processor
   */
  async shutdown() {
    this.clear();
    this.removeAllListeners();
    this.status = 'shutdown';
  }
}

export default RDFStarProcessor;
