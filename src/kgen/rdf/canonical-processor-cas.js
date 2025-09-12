/**
 * CAS-Aware RDF Canonical Processor
 * 
 * Provides deterministic RDF graph canonicalization with Content-Addressed Storage
 * - Canonical N-Triples serialization
 * - CID-based content addressing
 * - Efficient caching for repeated operations
 */

import { Parser, Store, Writer, DataFactory } from 'n3';
import { cas } from '../cas/cas-core.js';

const { namedNode, literal, blankNode, quad } = DataFactory;

/**
 * RDF Canonical Processor with CAS integration
 */
export class CanonicalProcessor {
  constructor(options = {}) {
    this.options = {
      format: 'turtle',
      canonicalize: true,
      enableCache: true,
      preserveOrder: true,
      ...options
    };
    
    this.store = new Store();
    this.stats = {
      quadCount: 0,
      parseTime: 0,
      canonicalizeTime: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  /**
   * Parse RDF content and generate CID
   * @param {string} rdfContent - RDF content in specified format
   * @param {Object} options - Processing options
   * @returns {Promise<{cid, quads, canonical, stats}>} Processing result
   */
  async parseAndAddress(rdfContent, options = {}) {
    const startTime = performance.now();
    
    try {
      // Check cache for parsed content
      const contentCID = await cas.generateCID(rdfContent);
      const cacheKey = `parsed:${contentCID.toString()}`;
      
      if (this.options.enableCache) {
        const cached = await cas.retrieve(cacheKey);
        if (cached) {
          this.stats.cacheHits++;
          return JSON.parse(new TextDecoder().decode(cached));
        }
        this.stats.cacheMisses++;
      }

      // Parse RDF content
      const parseResult = await this._parseRDF(rdfContent, options.format);
      
      // Generate canonical form
      const canonical = await this._canonicalize(parseResult.quads);
      
      // Generate CID for canonical content
      const canonicalCID = await cas.generateCID(canonical);
      
      // Prepare result
      const result = {
        contentCID: contentCID.toString(),
        canonicalCID: canonicalCID.toString(),
        quads: parseResult.quads.map(q => this._serializeQuad(q)),
        canonical,
        quadCount: parseResult.quads.length,
        processingTime: performance.now() - startTime,
        stats: this.stats
      };
      
      // Cache the result
      if (this.options.enableCache) {
        await cas.store(JSON.stringify(result), { algorithm: 'sha256' });
      }
      
      return result;
      
    } catch (error) {
      throw new Error(`RDF canonicalization failed: ${error.message}`);
    }
  }

  /**
   * Calculate canonical hash for RDF content - REPLACES crypto.createHash
   * @param {string} rdfContent - RDF content
   * @param {Object} options - Hash options
   * @returns {Promise<{hash, cid, algorithm}>} Hash result
   */
  async calculateContentHash(rdfContent, options = {}) {
    const algorithm = options.algorithm || 'sha256';
    
    try {
      // Parse and canonicalize
      const result = await this.parseAndAddress(rdfContent, options);
      
      // Generate hash using CAS
      const hash = await cas.calculateHash(result.canonical, algorithm);
      const cid = await cas.generateCID(result.canonical);
      
      return {
        hash,
        cid: cid.toString(),
        algorithm,
        canonical: result.canonical,
        quadCount: result.quadCount
      };
      
    } catch (error) {
      throw new Error(`Hash calculation failed: ${error.message}`);
    }
  }

  /**
   * Compare two RDF graphs for drift detection
   * @param {string} graph1 - First RDF graph
   * @param {string} graph2 - Second RDF graph
   * @returns {Promise<{identical, drift, cid1, cid2, details}>} Comparison result
   */
  async compareGraphs(graph1, graph2) {
    const [result1, result2] = await Promise.all([
      this.parseAndAddress(graph1),
      this.parseAndAddress(graph2)
    ]);
    
    // Use CAS comparison for precise drift detection
    const comparison = await cas.compareContent(result1.canonical, result2.canonical);
    
    // Detailed analysis
    const details = {
      quadDelta: result2.quadCount - result1.quadCount,
      canonicalSizeDelta: result2.canonical.length - result1.canonical.length,
      processingTimeDelta: result2.processingTime - result1.processingTime
    };
    
    return {
      identical: comparison.identical,
      drift: comparison.drift,
      cid1: comparison.cid1.toString(),
      cid2: comparison.cid2.toString(),
      details,
      graphs: {
        graph1: { quadCount: result1.quadCount, cid: result1.canonicalCID },
        graph2: { quadCount: result2.quadCount, cid: result2.canonicalCID }
      }
    };
  }

  /**
   * Generate attestation data with CID
   * @param {string} rdfContent - RDF content to attest
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Attestation object
   */
  async generateAttestation(rdfContent, metadata = {}) {
    const result = await this.parseAndAddress(rdfContent);
    const timestamp = this.getDeterministicDate().toISOString();
    
    const attestation = {
      version: '1.0.0',
      timestamp,
      content: {
        originalCID: result.contentCID,
        canonicalCID: result.canonicalCID,
        quadCount: result.quadCount,
        format: this.options.format
      },
      provenance: {
        processor: 'kgen-canonical-processor',
        version: '1.0.0',
        algorithm: 'canonical-ntriples',
        processingTime: result.processingTime
      },
      metadata: {
        ...metadata,
        generatedAt: timestamp
      }
    };
    
    // Generate attestation CID
    const attestationCID = await cas.generateCID(JSON.stringify(attestation));
    attestation.attestationCID = attestationCID.toString();
    
    return attestation;
  }

  /**
   * Get processor performance metrics
   * @returns {Object} Performance statistics
   */
  getMetrics() {
    const casMetrics = cas.getMetrics();
    
    return {
      processor: this.stats,
      cas: casMetrics,
      cacheEfficiency: this.stats.cacheHits + this.stats.cacheMisses > 0
        ? this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses)
        : 0
    };
  }

  // Private methods

  async _parseRDF(content, format = 'turtle') {
    const parseStart = performance.now();
    
    return new Promise((resolve, reject) => {
      const parser = new Parser({ format });
      const quads = [];
      
      parser.parse(content, (error, quad, prefixes) => {
        if (error) {
          reject(error);
          return;
        }
        
        if (quad) {
          quads.push(quad);
        } else {
          // Parsing complete
          this.stats.quadCount = quads.length;
          this.stats.parseTime = performance.now() - parseStart;
          
          resolve({
            quads,
            prefixes: prefixes || {},
            count: quads.length
          });
        }
      });
    });
  }

  async _canonicalize(quads) {
    const canonicalizeStart = performance.now();
    
    try {
      // Sort quads for canonical order
      const sortedQuads = [...quads].sort((a, b) => {
        const aStr = this._quadToCanonicalString(a);
        const bStr = this._quadToCanonicalString(b);
        return aStr.localeCompare(bStr);
      });
      
      // Convert to canonical N-Triples
      const ntriples = sortedQuads.map(quad => 
        this._quadToNTriple(quad)
      ).join('\n');
      
      this.stats.canonicalizeTime = performance.now() - canonicalizeStart;
      
      return ntriples;
      
    } catch (error) {
      throw new Error(`Canonicalization failed: ${error.message}`);
    }
  }

  _quadToCanonicalString(quad) {
    const subjectStr = this._termToString(quad.subject);
    const predicateStr = this._termToString(quad.predicate);
    const objectStr = this._termToString(quad.object);
    const graphStr = quad.graph ? this._termToString(quad.graph) : '';
    
    return `${subjectStr} ${predicateStr} ${objectStr} ${graphStr}`;
  }

  _quadToNTriple(quad) {
    const subject = this._termToNTriple(quad.subject);
    const predicate = this._termToNTriple(quad.predicate);
    const object = this._termToNTriple(quad.object);
    
    return `${subject} ${predicate} ${object} .`;
  }

  _termToString(term) {
    switch (term.termType) {
      case 'NamedNode':
        return `<${term.value}>`;
      case 'BlankNode':
        return `_:${term.value}`;
      case 'Literal':
        if (term.language) {
          return `"${term.value}"@${term.language}`;
        } else if (term.datatype && term.datatype.value !== 'http://www.w3.org/2001/XMLSchema#string') {
          return `"${term.value}"^^<${term.datatype.value}>`;
        } else {
          return `"${term.value}"`;
        }
      default:
        return term.value;
    }
  }

  _termToNTriple(term) {
    return this._termToString(term);
  }

  _serializeQuad(quad) {
    return {
      subject: this._serializeTerm(quad.subject),
      predicate: this._serializeTerm(quad.predicate),
      object: this._serializeTerm(quad.object),
      graph: quad.graph ? this._serializeTerm(quad.graph) : null
    };
  }

  _serializeTerm(term) {
    return {
      termType: term.termType,
      value: term.value,
      language: term.language,
      datatype: term.datatype ? { value: term.datatype.value } : null
    };
  }
}

// Export singleton instance
export const canonicalProcessor = new CanonicalProcessor();