/**
 * RDF Canonical Drift Processing
 * 
 * Integrates RDF canonical normalization with drift:// URI scheme:
 * - Canonical graph comparison for semantic equivalence
 * - RDF-specific patch generation and application
 * - Integration with drift URI resolver
 * - Performance-optimized RDF graph diffing
 */

import { canonicalProcessor } from '../rdf/canonical-processor-cas.js';
import { driftURIResolver } from './drift-uri-resolver.js';
import { cas } from '../cas/cas-core.js';
import { Store, Parser, Writer, DataFactory } from 'n3';
import { consola } from 'consola';

const { namedNode, literal, defaultGraph, quad } = DataFactory;

/**
 * RDF Canonical Drift Processor
 */
export class RDFCanonicalDriftProcessor {
  constructor(config = {}) {
    this.config = {
      enableCanonicalComparison: config.enableCanonicalComparison !== false,
      enableSemanticEquivalence: config.enableSemanticEquivalence !== false,
      enableGraphHashing: config.enableGraphHashing !== false,
      maxTriples: config.maxTriples || 10000,
      ...config
    };
    
    this.logger = consola.withTag('rdf-canonical-drift');
    this.store = new Store();
    this.parser = new Parser();
    this.writer = new Writer();
    
    // Performance metrics
    this.metrics = {
      canonicalComparisons: 0,
      semanticEquivalenceChecks: 0,
      graphDiffs: 0,
      averageComparisonTime: 0
    };
  }

  /**
   * Generate canonical drift analysis for RDF content
   * @param {string} baselineRDF - Baseline RDF content
   * @param {string} currentRDF - Current RDF content  
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Canonical drift analysis
   */
  async analyzeCanonicalDrift(baselineRDF, currentRDF, options = {}) {
    const startTime = performance.now();
    this.metrics.canonicalComparisons++;
    
    try {
      // Parse both RDF documents
      const baselineQuads = await this.parseRDF(baselineRDF, options.format || 'turtle');
      const currentQuads = await this.parseRDF(currentRDF, options.format || 'turtle');
      
      // Generate canonical representations
      const baselineCanonical = await canonicalProcessor.parseAndAddress(baselineRDF, {
        format: options.format || 'turtle',
        algorithm: 'URDNA2015'
      });
      
      const currentCanonical = await canonicalProcessor.parseAndAddress(currentRDF, {
        format: options.format || 'turtle', 
        algorithm: 'URDNA2015'
      });
      
      // Check canonical equivalence
      const canonicallyEquivalent = baselineCanonical.canonicalCID === currentCanonical.canonicalCID;
      
      // Detailed graph comparison if not equivalent
      let graphDiff = null;
      let semanticChanges = [];
      
      if (!canonicallyEquivalent) {
        graphDiff = await this.performGraphDiff(baselineQuads, currentQuads);
        semanticChanges = this.analyzeSemanticChanges(graphDiff);
      }
      
      // Generate drift URI if significant changes detected
      let driftURI = null;
      if (!canonicallyEquivalent && options.generateDriftURI) {
        const patchData = {
          baseline: {
            canonical: baselineCanonical.canonical,
            cid: baselineCanonical.canonicalCID,
            quadCount: baselineQuads.length
          },
          current: {
            canonical: currentCanonical.canonical,
            cid: currentCanonical.canonicalCID,
            quadCount: currentQuads.length
          },
          graphDiff,
          semanticChanges
        };
        
        const patchResult = await driftURIResolver.storePatch(
          { rdf: baselineRDF },
          { rdf: currentRDF },
          {
            source: 'rdf-canonical-drift',
            format: 'rdf-canonical',
            metadata: patchData
          }
        );
        
        driftURI = patchResult.uri;
      }
      
      const analysisTime = performance.now() - startTime;
      this.updateMetrics(analysisTime);
      
      return {
        canonicallyEquivalent,
        syntacticallyIdentical: baselineRDF === currentRDF,
        baseline: {
          canonical: baselineCanonical.canonical,
          cid: baselineCanonical.canonicalCID,
          quadCount: baselineQuads.length,
          hash: await cas.calculateHash(baselineRDF)
        },
        current: {
          canonical: currentCanonical.canonical,
          cid: currentCanonical.canonicalCID,
          quadCount: currentQuads.length,
          hash: await cas.calculateHash(currentRDF)
        },
        graphDiff,
        semanticChanges,
        driftURI,
        significance: this.calculateSemanticSignificance(graphDiff, semanticChanges),
        analysisTime,
        timestamp: this.getDeterministicDate().toISOString()
      };
      
    } catch (error) {
      this.logger.error('RDF canonical drift analysis failed:', error);
      throw new Error(`Canonical drift analysis failed: ${error.message}`);
    }
  }

  /**
   * Perform detailed graph diff between RDF graphs
   * @param {Array} baselineQuads - Baseline RDF quads
   * @param {Array} currentQuads - Current RDF quads
   * @returns {Object} Graph diff result
   */
  async performGraphDiff(baselineQuads, currentQuads) {
    this.metrics.graphDiffs++;
    
    const baselineSet = new Set(baselineQuads.map(q => this.quadToCanonicalString(q)));
    const currentSet = new Set(currentQuads.map(q => this.quadToCanonicalString(q)));
    
    const added = currentQuads.filter(q => !baselineSet.has(this.quadToCanonicalString(q)));
    const removed = baselineQuads.filter(q => !currentSet.has(this.quadToCanonicalString(q)));
    const unchanged = baselineQuads.filter(q => currentSet.has(this.quadToCanonicalString(q)));
    
    // Group changes by predicate for semantic analysis
    const changesByPredicate = new Map();
    
    for (const quad of added) {
      const predicate = quad.predicate.value;
      if (!changesByPredicate.has(predicate)) {
        changesByPredicate.set(predicate, { added: [], removed: [] });
      }
      changesByPredicate.get(predicate).added.push(quad);
    }
    
    for (const quad of removed) {
      const predicate = quad.predicate.value;
      if (!changesByPredicate.has(predicate)) {
        changesByPredicate.set(predicate, { added: [], removed: [] });
      }
      changesByPredicate.get(predicate).removed.push(quad);
    }
    
    return {
      added,
      removed,
      unchanged: unchanged.length,
      totalChanges: added.length + removed.length,
      changesByPredicate: Object.fromEntries(changesByPredicate),
      identical: added.length === 0 && removed.length === 0
    };
  }

  /**
   * Analyze semantic significance of RDF changes
   * @param {Object} graphDiff - Graph diff result
   * @returns {Array} Semantic change analysis
   */
  analyzeSemanticChanges(graphDiff) {
    if (!graphDiff || graphDiff.identical) {
      return [];
    }
    
    const semanticChanges = [];
    
    // Analyze by RDF vocabulary importance
    const vocabularyWeights = {
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#type': 1.0,      // rdf:type
      'http://www.w3.org/2000/01/rdf-schema#subClassOf': 0.9,      // rdfs:subClassOf
      'http://www.w3.org/2002/07/owl#sameAs': 0.9,                 // owl:sameAs
      'http://www.w3.org/2000/01/rdf-schema#label': 0.7,           // rdfs:label
      'http://www.w3.org/2000/01/rdf-schema#comment': 0.5,         // rdfs:comment
      'http://purl.org/dc/elements/1.1/title': 0.6,                // dc:title
      'http://xmlns.com/foaf/0.1/name': 0.6                        // foaf:name
    };
    
    for (const [predicate, changes] of Object.entries(graphDiff.changesByPredicate)) {
      const weight = vocabularyWeights[predicate] || 0.3; // Default weight
      
      if (changes.added.length > 0) {
        semanticChanges.push({
          type: 'addition',
          predicate,
          count: changes.added.length,
          weight,
          significance: weight * Math.min(changes.added.length / 10, 1),
          triples: changes.added.slice(0, 5) // Sample triples
        });
      }
      
      if (changes.removed.length > 0) {
        semanticChanges.push({
          type: 'removal',
          predicate,
          count: changes.removed.length,
          weight,
          significance: weight * Math.min(changes.removed.length / 10, 1),
          triples: changes.removed.slice(0, 5) // Sample triples
        });
      }
    }
    
    // Sort by significance
    semanticChanges.sort((a, b) => b.significance - a.significance);
    
    return semanticChanges;
  }

  /**
   * Calculate overall semantic significance score
   * @param {Object} graphDiff - Graph diff
   * @param {Array} semanticChanges - Semantic changes
   * @returns {number} Significance score 0-1
   */
  calculateSemanticSignificance(graphDiff, semanticChanges) {
    if (!graphDiff || graphDiff.identical) {
      return 0.0;
    }
    
    if (semanticChanges.length === 0) {
      return 0.1; // Minimal significance for any change
    }
    
    // Weighted average of semantic changes
    const totalWeight = semanticChanges.reduce((sum, change) => sum + change.weight, 0);
    const weightedSignificance = semanticChanges.reduce(
      (sum, change) => sum + (change.significance * change.weight), 
      0
    );
    
    const significance = totalWeight > 0 ? weightedSignificance / totalWeight : 0.1;
    
    // Cap at 1.0
    return Math.min(significance, 1.0);
  }

  /**
   * Apply RDF patch using drift URI
   * @param {string} baselineRDF - Baseline RDF content
   * @param {string} driftURI - Drift URI for patch
   * @returns {Promise<{result: string, metadata: Object}>}
   */
  async applyRDFPatch(baselineRDF, driftURI) {
    try {
      // Retrieve patch from drift URI
      const { patch, metadata } = await driftURIResolver.retrievePatch(driftURI);
      
      if (!patch || !patch.rdf) {
        throw new Error('Invalid RDF patch format');
      }
      
      // For RDF, patches contain the target RDF content directly
      const resultRDF = patch.rdf;
      
      // Validate result is valid RDF
      await this.parseRDF(resultRDF, metadata.format || 'turtle');
      
      return {
        result: resultRDF,
        metadata: {
          ...metadata,
          appliedAt: this.getDeterministicDate().toISOString(),
          baselineHash: await cas.calculateHash(baselineRDF),
          resultHash: await cas.calculateHash(resultRDF)
        }
      };
      
    } catch (error) {
      throw new Error(`Failed to apply RDF patch: ${error.message}`);
    }
  }

  /**
   * Parse RDF content to quads
   * @param {string} rdfContent - RDF content
   * @param {string} format - RDF format
   * @returns {Promise<Array>} RDF quads
   */
  async parseRDF(rdfContent, format = 'turtle') {
    return new Promise((resolve, reject) => {
      const quads = [];
      const parser = new Parser({ format });
      
      parser.parse(rdfContent, (error, quad, prefixes) => {
        if (error) {
          reject(error);
        } else if (quad) {
          quads.push(quad);
        } else {
          resolve(quads);
        }
      });
    });
  }

  /**
   * Convert quad to canonical string representation
   * @param {Object} quad - RDF quad
   * @returns {string} Canonical string
   */
  quadToCanonicalString(quad) {
    const subject = quad.subject.termType === 'BlankNode' 
      ? `_:${quad.subject.value}` 
      : quad.subject.value;
      
    const predicate = quad.predicate.value;
    
    const object = quad.object.termType === 'BlankNode'
      ? `_:${quad.object.value}`
      : quad.object.termType === 'Literal'
      ? `"${quad.object.value}"${quad.object.language ? `@${quad.object.language}` : ''}${quad.object.datatype ? `^^${quad.object.datatype.value}` : ''}`
      : quad.object.value;
      
    return `${subject} ${predicate} ${object}`;
  }

  /**
   * Update performance metrics
   * @param {number} analysisTime - Analysis time in ms
   */
  updateMetrics(analysisTime) {
    this.metrics.averageComparisonTime = 
      (this.metrics.averageComparisonTime * (this.metrics.canonicalComparisons - 1) + analysisTime) / 
      this.metrics.canonicalComparisons;
  }

  /**
   * Get performance metrics
   * @returns {Object} Performance statistics
   */
  getMetrics() {
    return {
      ...this.metrics,
      lastUpdated: this.getDeterministicDate().toISOString()
    };
  }

  /**
   * Reset processor state
   */
  reset() {
    this.store.removeQuads(this.store.getQuads());
    this.metrics = {
      canonicalComparisons: 0,
      semanticEquivalenceChecks: 0,
      graphDiffs: 0,
      averageComparisonTime: 0
    };
  }
}

// Export singleton instance
export const rdfCanonicalDriftProcessor = new RDFCanonicalDriftProcessor();

export default RDFCanonicalDriftProcessor;