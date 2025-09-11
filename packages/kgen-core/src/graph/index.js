/**
 * Graph Operations - Main export file for kgen graph commands
 * 
 * Provides the core graph processing functionality for kgen:
 * - hash: Canonical SHA256 hashing for .ttl files
 * - diff: Delta calculation with blast radius
 * - index: Subject-to-artifact mapping
 * - impact: Change impact analysis
 */

export { HashCalculator } from './hash-calculator.js';
export { DiffAnalyzer } from './diff-analyzer.js';
export { IndexBuilder } from './index-builder.js';
export { ImpactCalculator } from './impact-calculator.js';

/**
 * Convenience function to create a complete graph processing pipeline
 * @param {Object} config - Configuration for graph processors
 * @returns {Object} Graph processing pipeline
 */
export function createGraphProcessor(config = {}) {
  return {
    hashCalculator: new (await import('./hash-calculator.js')).HashCalculator(config.hash),
    diffAnalyzer: new (await import('./diff-analyzer.js')).DiffAnalyzer(config.diff),
    indexBuilder: new (await import('./index-builder.js')).IndexBuilder(config.index),
    impactCalculator: new (await import('./impact-calculator.js')).ImpactCalculator(config.impact)
  };
}

/**
 * High-level function to perform complete graph analysis
 * @param {string} originalTTL - Original TTL content
 * @param {string} modifiedTTL - Modified TTL content (optional)
 * @param {Object} options - Analysis options
 * @returns {Promise<Object>} Complete graph analysis
 */
export async function analyzeGraph(originalTTL, modifiedTTL = null, options = {}) {
  const processors = await createGraphProcessor(options);
  
  const analysis = {
    original: {
      hash: await processors.hashCalculator.calculateTTLHash(originalTTL, options.hash),
      index: await processors.indexBuilder.buildIndex(originalTTL, options.index)
    }
  };
  
  if (modifiedTTL) {
    analysis.modified = {
      hash: await processors.hashCalculator.calculateTTLHash(modifiedTTL, options.hash),
      index: await processors.indexBuilder.buildIndex(modifiedTTL, options.index)
    };
    
    // Calculate diff and impact
    analysis.diff = await processors.diffAnalyzer.calculateDiff(originalTTL, modifiedTTL, options.diff);
    analysis.impact = await processors.impactCalculator.calculateChangeImpact(originalTTL, modifiedTTL, options.impact);
    
    // Hash comparison
    analysis.hashComparison = {
      isEqual: analysis.original.hash.hash === analysis.modified.hash.hash,
      originalHash: analysis.original.hash.hash,
      modifiedHash: analysis.modified.hash.hash
    };
  }
  
  return analysis;
}

/**
 * Utility function for kgen graph hash command
 * @param {string} ttlContent - TTL file content
 * @param {Object} options - Hash options
 * @returns {Promise<Object>} Hash result
 */
export async function calculateGraphHash(ttlContent, options = {}) {
  const { HashCalculator } = await import('./hash-calculator.js');
  const calculator = new HashCalculator(options);
  return calculator.calculateTTLHash(ttlContent, options);
}

/**
 * Utility function for kgen graph diff command
 * @param {string} originalTTL - Original TTL content
 * @param {string} modifiedTTL - Modified TTL content
 * @param {Object} options - Diff options
 * @returns {Promise<Object>} Diff result
 */
export async function calculateGraphDiff(originalTTL, modifiedTTL, options = {}) {
  const { DiffAnalyzer } = await import('./diff-analyzer.js');
  const analyzer = new DiffAnalyzer(options);
  return analyzer.calculateDiff(originalTTL, modifiedTTL, options);
}

/**
 * Utility function for kgen graph index command
 * @param {string} ttlContent - TTL file content
 * @param {Array<Object>} artifacts - Artifact definitions (optional)
 * @param {Object} options - Index options
 * @returns {Promise<Object>} Index result
 */
export async function buildGraphIndex(ttlContent, artifacts = null, options = {}) {
  const { IndexBuilder } = await import('./index-builder.js');
  const builder = new IndexBuilder(options);
  
  const index = await builder.buildIndex(ttlContent, options);
  
  if (artifacts) {
    const mapping = await builder.buildSubjectToArtifactMapping(ttlContent, artifacts, options);
    index.artifactMapping = mapping;
  }
  
  return index;
}

/**
 * Utility function for kgen graph impact command  
 * @param {string} originalTTL - Original TTL content
 * @param {string} modifiedTTL - Modified TTL content
 * @param {Object} options - Impact analysis options
 * @returns {Promise<Object>} Impact analysis result
 */
export async function calculateGraphImpact(originalTTL, modifiedTTL, options = {}) {
  const { ImpactCalculator } = await import('./impact-calculator.js');
  const calculator = new ImpactCalculator(options);
  return calculator.calculateChangeImpact(originalTTL, modifiedTTL, options);
}

/**
 * Batch processing function for multiple graph operations
 * @param {Array<Object>} operations - Array of operations to perform
 * @param {Object} options - Global options
 * @returns {Promise<Array>} Results from all operations
 */
export async function batchGraphOperations(operations, options = {}) {
  const processors = await createGraphProcessor(options);
  
  const results = await Promise.all(
    operations.map(async (op) => {
      try {
        switch (op.type) {
          case 'hash':
            return {
              id: op.id,
              type: 'hash',
              result: await processors.hashCalculator.calculateTTLHash(op.ttlContent, op.options)
            };
            
          case 'diff':
            return {
              id: op.id,
              type: 'diff',
              result: await processors.diffAnalyzer.calculateDiff(op.originalTTL, op.modifiedTTL, op.options)
            };
            
          case 'index':
            return {
              id: op.id,
              type: 'index',
              result: await processors.indexBuilder.buildIndex(op.ttlContent, op.options)
            };
            
          case 'impact':
            return {
              id: op.id,
              type: 'impact',
              result: await processors.impactCalculator.calculateChangeImpact(op.originalTTL, op.modifiedTTL, op.options)
            };
            
          default:
            throw new Error(`Unknown operation type: ${op.type}`);
        }
      } catch (error) {
        return {
          id: op.id,
          type: op.type,
          error: error.message
        };
      }
    })
  );
  
  return results;
}

/**
 * Validate graph integrity using multiple methods
 * @param {string} ttlContent - TTL content to validate
 * @param {Object} options - Validation options
 * @returns {Promise<Object>} Validation result
 */
export async function validateGraph(ttlContent, options = {}) {
  const processors = await createGraphProcessor(options);
  
  const validation = {
    isValid: true,
    issues: [],
    hash: null,
    index: null,
    statistics: {}
  };
  
  try {
    // Calculate hash for integrity
    validation.hash = await processors.hashCalculator.calculateTTLHash(ttlContent, options.hash);
    
    // Build index to check structure
    validation.index = await processors.indexBuilder.buildIndex(ttlContent, options.index);
    
    // Extract validation statistics
    validation.statistics = {
      tripleCount: validation.hash.metadata.tripleCount,
      subjectCount: validation.index.statistics.subjectCount,
      predicateCount: validation.index.statistics.predicateCount,
      namespaceCount: validation.index.statistics.namespaceCount
    };
    
    // Basic validation checks
    if (validation.statistics.tripleCount === 0) {
      validation.isValid = false;
      validation.issues.push({
        type: 'empty_graph',
        message: 'Graph contains no triples',
        severity: 'error'
      });
    }
    
    if (validation.statistics.subjectCount === 0) {
      validation.isValid = false;
      validation.issues.push({
        type: 'no_subjects',
        message: 'Graph contains no subjects',
        severity: 'error'  
      });
    }
    
    // Check for suspicious patterns
    if (validation.statistics.predicateCount === 1) {
      validation.issues.push({
        type: 'single_predicate',
        message: 'Graph uses only one predicate type',
        severity: 'warning'
      });
    }
    
  } catch (error) {
    validation.isValid = false;
    validation.issues.push({
      type: 'processing_error',
      message: `Graph processing failed: ${error.message}`,
      severity: 'error'
    });
  }
  
  return validation;
}

// Export default configuration
export const defaultConfig = {
  hash: {
    algorithm: 'sha256',
    encoding: 'hex',
    normalizeBlankNodes: true,
    sortTriples: true,
    ignoreGraphNames: false
  },
  diff: {
    includeBlankNodes: true,
    includeGraphContext: true,
    calculateBlastRadius: true,
    maxBlastRadius: 10,
    includeSemanticDiff: true,
    diffGranularity: 'triple'
  },
  index: {
    enableSemanticIndexing: true,
    enablePredicateIndexing: true,
    enableNamespaceIndexing: true,
    enableArtifactMapping: true,
    maxDepthTraversal: 5,
    cacheIndexes: true
  },
  impact: {
    maxBlastRadius: 5,
    includeInverseRelationships: true,
    calculateArtifactImpact: true,
    weightedImpactScoring: true,
    enableSemanticAnalysis: true,
    impactThreshold: 0.1
  }
};