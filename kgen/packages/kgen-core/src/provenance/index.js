/**
 * kgen-core Provenance System
 * 
 * Production-grade JOSE/JWS attestation system with:
 * - Ed25519 and RSA signature support
 * - External JWT tool compatibility  
 * - SLSA compliance features
 * - W3C PROV-O compliant metadata
 * - Comprehensive verification capabilities
 */

export { AttestationGenerator } from './attestation.js';
export { AttestationVerifier } from './verifier.js';
export { KeyManager } from './keys.js';
export { JOSEOperations } from './jose.js';
export { SidecarGenerator } from './sidecar.js';

// Convenience exports for common use cases
import { AttestationGenerator } from './attestation.js';
import { AttestationVerifier } from './verifier.js';
import { KeyManager } from './keys.js';
import { JOSEOperations } from './jose.js';
import { SidecarGenerator } from './sidecar.js';

/**
 * Create a pre-configured provenance system instance
 * @param {Object} config - Configuration options
 * @returns {Object} Configured provenance system
 */
export function createProvenanceSystem(config = {}) {
  const keyManager = new KeyManager(config.keys);
  const attestationGenerator = new AttestationGenerator({
    ...config.attestation,
    keyManager: config.keys
  });
  const verifier = new AttestationVerifier(config.verifier);
  
  return {
    keyManager,
    attestationGenerator,
    verifier,
    
    // Convenience methods
    async initialize() {
      await Promise.all([
        keyManager.initialize(),
        attestationGenerator.initialize(),
        verifier.initialize()
      ]);
    },
    
    async generateAttestation(artifact, context, options) {
      return await attestationGenerator.generateAttestation(artifact, context, options);
    },
    
    async verifyAttestation(attestation, options) {
      return await verifier.verifyAttestationIntegrity(attestation, options);
    },
    
    async crossVerify(jwsToken, publicKey, options) {
      return await verifier.crossVerify(jwsToken, publicKey, options);
    },
    
    getStatus() {
      return {
        keyManager: keyManager.getStatus(),
        attestationGenerator: attestationGenerator.getStatus(),
        verifier: verifier.getStatus()
      };
    }
  };
}

/**
 * Quick-start attestation generation with defaults
 * @param {string} artifactPath - Path to artifact
 * @param {Object} context - Generation context
 * @param {Object} options - Options
 * @returns {Promise<Object>} Generated attestation
 */
export async function quickAttest(artifactPath, context = {}, options = {}) {
  const system = createProvenanceSystem(options.config);
  await system.initialize();
  
  return await system.generateAttestation(
    { path: artifactPath },
    context,
    options
  );
}

/**
 * Quick verification of JWS token
 * @param {string} jwsToken - JWS token to verify
 * @param {Object} publicKey - Public key in JWK format
 * @param {Object} options - Verification options
 * @returns {Promise<Object>} Verification result
 */
export async function quickVerify(jwsToken, publicKey, options = {}) {
  const verifier = new AttestationVerifier(options.config);
  await verifier.initialize();
  
  return await verifier.verifyWithJOSE(jwsToken, publicKey, options);
}

// Version and metadata
export const VERSION = '2.0.0';
export const SUPPORTED_ALGORITHMS = ['EdDSA', 'RS256', 'RS512'];
export const COMPLIANCE_STANDARDS = [
  'RFC 7515', // JWS
  'RFC 7518', // JWA  
  'RFC 7519', // JWT
  'SLSA',     // Supply-chain Levels for Software Artifacts
  'W3C PROV-O' // W3C Provenance Ontology
];

// Default configuration
export const DEFAULT_CONFIG = {
  keys: {
    defaultAlgorithm: 'EdDSA',
    supportedAlgorithms: SUPPORTED_ALGORITHMS,
    enableAutoRotation: false,
    keyStorePath: './keys'
  },
  
  attestation: {
    issuer: 'urn:kgen:provenance-system',
    audience: ['urn:kgen:verifiers', 'urn:external:jwt-tools'],
    slsaLevel: 'SLSA_BUILD_LEVEL_L2',
    builderIdentity: 'kgen-provenance-system@v2.0.0'
  },
  
  verifier: {
    clockTolerance: '5m',
    enableCache: true,
    strict: true
  },
  
  sidecar: {
    sidecarSuffix: '.attest.json',
    includeProvenance: true,
    includeSlsaData: true,
    includeVerificationGuide: true
  }
};

export default {
  AttestationGenerator,
  AttestationVerifier,
  KeyManager,
  JOSEOperations,
  SidecarGenerator,
  createProvenanceSystem,
  quickAttest,
  quickVerify,
  VERSION,
  SUPPORTED_ALGORITHMS,
  COMPLIANCE_STANDARDS,
  DEFAULT_CONFIG
};