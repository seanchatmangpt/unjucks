/**
 * KGEN Core Provenance System - Entry Point
 * 
 * Enhanced provenance tracking system for KGEN with comprehensive auditability,
 * PROV-O compliance, cryptographic attestations, and enterprise compliance.
 */

export { ProvenanceTracker } from './tracker.js';
export { AttestationGenerator } from './attestation/generator.js';
export { ProvenanceStorage } from './storage/index.js';
export { ComplianceAttestor } from './compliance/attestor.js';
export { CryptoManager } from './crypto/manager.js';
export { ArtifactExplainer } from './queries/explainer.js';

/**
 * Create a new enhanced provenance tracker with default configuration
 * @param {Object} config - Configuration options
 * @returns {ProvenanceTracker} Initialized tracker instance
 */
export function createProvenanceTracker(config = {}) {
  return new ProvenanceTracker({
    // Default enhanced configuration
    enableAttestationGeneration: true,
    enableCryptographicSigning: true,
    trackTemplateIds: true,
    trackRuleIds: true,
    trackGraphHashes: true,
    trackEngineVersion: true,
    
    // Storage and performance
    storageBackend: 'file',
    enableCaching: true,
    maxCacheSize: 10000,
    
    // Compliance defaults
    complianceMode: 'enterprise',
    retentionPeriod: '7years',
    
    // Cryptographic defaults
    hashAlgorithm: 'sha256',
    signatureAlgorithm: 'RSA-SHA256',
    autoGenerateKeys: true,
    
    // Override with user config
    ...config
  });
}

/**
 * Create a lightweight provenance tracker for development
 * @param {Object} config - Configuration options
 * @returns {ProvenanceTracker} Lightweight tracker instance
 */
export function createLightweightTracker(config = {}) {
  return new ProvenanceTracker({
    enableAttestationGeneration: false,
    enableCryptographicSigning: false,
    storageBackend: 'memory',
    complianceMode: 'none',
    enableCaching: false,
    ...config
  });
}

/**
 * Create an enterprise-grade provenance tracker with full compliance
 * @param {Object} config - Configuration options
 * @returns {ProvenanceTracker} Enterprise tracker instance
 */
export function createEnterpriseTracker(config = {}) {
  return new ProvenanceTracker({
    // Enhanced enterprise features
    enableAttestationGeneration: true,
    enableCryptographicSigning: true,
    trackTemplateIds: true,
    trackRuleIds: true,
    trackGraphHashes: true,
    trackEngineVersion: true,
    
    // Enterprise storage
    storageBackend: 'database',
    enableCaching: true,
    maxCacheSize: 50000,
    
    // Full compliance
    complianceMode: 'SOX,GDPR,HIPAA,ISO-27001',
    retentionPeriod: '10years',
    
    // Enhanced security
    enableKeyRotation: true,
    keyRotationInterval: 24 * 60 * 60 * 1000, // 24 hours
    
    // Performance optimization
    batchSize: 500,
    enableCompression: true,
    enableEncryption: true,
    
    ...config
  });
}

/**
 * Utility function to explain any artifact by path
 * @param {string} artifactPath - Path to artifact
 * @param {Object} options - Explanation options
 * @returns {Promise<Object>} Artifact explanation
 */
export async function explainArtifact(artifactPath, options = {}) {
  const tracker = createLightweightTracker();
  await tracker.initialize();
  
  try {
    return await tracker.explainArtifact(artifactPath, options);
  } finally {
    await tracker.shutdown();
  }
}

/**
 * Utility function to verify artifact integrity
 * @param {string} artifactPath - Path to artifact
 * @returns {Promise<Object>} Integrity verification result
 */
export async function verifyArtifact(artifactPath) {
  const tracker = createLightweightTracker();
  await tracker.initialize();
  
  try {
    const explanation = await tracker.explainArtifact(artifactPath, {
      includeVerification: true
    });
    
    return explanation.verification || { verified: false, reason: 'No verification data' };
  } finally {
    await tracker.shutdown();
  }
}

/**
 * Create a compliance report for a specific period
 * @param {Object} criteria - Report criteria
 * @param {Object} config - Tracker configuration
 * @returns {Promise<Object>} Compliance report
 */
export async function generateComplianceReport(criteria = {}, config = {}) {
  const tracker = createEnterpriseTracker(config);
  await tracker.initialize();
  
  try {
    return await tracker.generateComplianceBundle(criteria);
  } finally {
    await tracker.shutdown();
  }
}

// Export default factory function
export default createProvenanceTracker;