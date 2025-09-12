/**
 * KGEN Core Artifact Module
 * 
 * Main exports for artifact generation system
 * Provides clean API for kgen-cli integration
 */

import { ArtifactGenerator } from './generator.js';
import { ProvenanceTracker } from './provenance.js';
import { verifyArtifactFile, verifyArtifactAttestation, compareArtifacts } from './verification.js';

/**
 * Create and configure artifact generator
 * @param {Object} options - Generator configuration
 * @returns {ArtifactGenerator} Configured generator instance
 */
export function createArtifactGenerator(options = {}) {
  return new ArtifactGenerator(options);
}

/**
 * Create and configure provenance tracker  
 * @param {Object} options - Tracker configuration
 * @returns {ProvenanceTracker} Configured tracker instance
 */
export function createProvenanceTracker(options = {}) {
  return new ProvenanceTracker(options);
}

/**
 * Generate single artifact with full provenance tracking
 * High-level API for simple artifact generation
 * 
 * @param {string} graphFile - Path to RDF graph file
 * @param {string} template - Template path relative to templatesDir
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Complete generation result with provenance
 */
export async function generateArtifact(graphFile, template, options = {}) {
  const generator = createArtifactGenerator(options);
  
  // Generate artifact
  const result = await generator.generateArtifact(graphFile, template, options);
  
  if (result.success && options.writeToFile !== false) {
    await generator.writeArtifact(result, options);
  }
  
  return result;
}

/**
 * Generate artifact with comprehensive provenance tracking
 * Full-featured API with detailed lineage tracking
 * 
 * @param {string} graphFile - Path to RDF graph file  
 * @param {string} template - Template path relative to templatesDir
 * @param {Object} options - Generation and provenance options
 * @returns {Promise<Object>} Generation result with attestation
 */
export async function generateArtifactWithProvenance(graphFile, template, options = {}) {
  const generator = createArtifactGenerator(options);
  const tracker = createProvenanceTracker(options);
  
  const operationId = options.operationId || `artifact-gen-${Date.now()}`;
  
  try {
    // Start provenance tracking
    await tracker.startTracking(operationId, {
      description: options.description || 'Artifact generation with provenance',
      graphFile,
      template,
      ...options.metadata
    });
    
    // Record inputs
    tracker.recordInput(operationId, 'rdf-graph', graphFile, {
      format: 'turtle/json-ld',
      purpose: 'context-enrichment'
    });
    
    const templatePath = options.templatesDir 
      ? `${options.templatesDir}/${template}`
      : template;
      
    tracker.recordInput(operationId, 'template', templatePath, {
      format: 'nunjucks',
      purpose: 'artifact-generation'
    });
    
    // Generate artifact
    const result = await generator.generateArtifact(graphFile, template, options);
    
    if (!result.success) {
      await tracker.completeTracking(operationId, { success: false, error: result.error });
      return result;
    }
    
    // Record transformation
    tracker.recordTransformation(
      operationId,
      'rdf-template-rendering',
      'Generate artifact from RDF context and Nunjucks template',
      [graphFile, templatePath],
      [result.outputPath]
    );
    
    // Record output
    tracker.recordOutput(operationId, 'generated-artifact', result.outputPath, result.content, {
      contentType: 'text/plain',
      contentHash: result.contentHash,
      size: result.content.length
    });
    
    // Write artifact if requested
    if (options.writeToFile !== false) {
      await generator.writeArtifact(result, options);
    }
    
    // Complete provenance tracking
    const { attestation } = await tracker.completeTracking(operationId, result);
    
    return {
      ...result,
      provenance: {
        operationId,
        attestation,
        tracking: {
          inputs: tracker.activeSessions.get(operationId)?.inputs || new Map(),
          outputs: tracker.activeSessions.get(operationId)?.outputs || new Map(),
          transformations: tracker.activeSessions.get(operationId)?.transformations || []
        }
      }
    };
    
  } catch (error) {
    // Record error in provenance
    await tracker.completeTracking(operationId, { 
      success: false, 
      error: error.message 
    });
    
    throw error;
  }
}

/**
 * Validate artifact reproducibility
 * Compare two artifacts for deterministic generation validation
 * 
 * @param {string} originalArtifactPath - Path to original artifact
 * @param {string} reproducedArtifactPath - Path to reproduced artifact  
 * @param {Object} options - Validation options
 * @returns {Promise<Object>} Reproducibility validation result
 */
export async function validateReproducibility(originalArtifactPath, reproducedArtifactPath, options = {}) {
  const tracker = createProvenanceTracker(options);
  
  // Check if both artifacts have attestations
  const originalAttestationPath = `${originalArtifactPath}.attest.json`;
  const reproducedAttestationPath = `${reproducedArtifactPath}.attest.json`;
  
  return await tracker.checkReproducibility(originalAttestationPath, reproducedAttestationPath);
}

/**
 * Verify artifact attestation
 * Cryptographically verify artifact integrity and provenance
 * 
 * @param {string} artifactPath - Path to artifact file
 * @param {Object} options - Verification options
 * @returns {Promise<Object>} Verification result
 */
export async function verifyArtifact(artifactPath, options = {}) {
  return await verifyArtifactFile(artifactPath, options);
}

/**
 * Batch generate multiple artifacts
 * Efficient parallel generation of multiple artifacts
 * 
 * @param {Array} requests - Array of generation requests
 * @param {Object} options - Batch generation options
 * @returns {Promise<Object>} Batch generation results
 */
export async function batchGenerateArtifacts(requests, options = {}) {
  const generator = createArtifactGenerator(options);
  const results = [];
  
  const maxConcurrency = options.maxConcurrency || 5;
  
  // Process requests in batches to control concurrency
  for (let i = 0; i < requests.length; i += maxConcurrency) {
    const batch = requests.slice(i, i + maxConcurrency);
    
    const batchPromises = batch.map(async (request, index) => {
      try {
        const result = await generator.generateArtifact(
          request.graphFile,
          request.template,
          { ...options, ...request.options }
        );
        
        if (result.success && options.writeToFile !== false) {
          await generator.writeArtifact(result, options);
        }
        
        return {
          index: i + index,
          request,
          result,
          success: true
        };
        
      } catch (error) {
        return {
          index: i + index,
          request,
          error: error.message,
          success: false
        };
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  return {
    total: requests.length,
    successful: successful.length,
    failed: failed.length,
    results,
    statistics: generator.getStatistics()
  };
}

/**
 * Get system information and capabilities
 * Returns information about the artifact generation system
 * 
 * @returns {Object} System information
 */
export function getSystemInfo() {
  return {
    name: 'kgen-core-artifact',
    version: '1.0.0',
    description: 'KGEN Core Artifact Generation System',
    features: [
      'deterministic-rendering',
      'rdf-context-enrichment', 
      'frontmatter-processing',
      'content-addressing',
      'cryptographic-attestations',
      'provenance-tracking',
      'reproducibility-validation'
    ],
    supportedFormats: {
      rdf: ['turtle', 'json-ld', 'rdf/xml'],
      templates: ['nunjucks', 'njk'],
      outputs: ['javascript', 'typescript', 'html', 'css', 'json', 'xml', 'text']
    },
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    }
  };
}

// Re-export verification functions
export { compareArtifacts, verifyArtifactAttestation };

// Re-export main classes for advanced usage
export { ArtifactGenerator, ProvenanceTracker };

// Default export for convenience
export default {
  createArtifactGenerator,
  createProvenanceTracker,
  generateArtifact,
  generateArtifactWithProvenance,
  validateReproducibility,
  verifyArtifact,
  compareArtifacts,
  verifyArtifactAttestation,
  batchGenerateArtifacts,
  getSystemInfo,
  ArtifactGenerator,
  ProvenanceTracker
};