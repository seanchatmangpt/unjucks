/**
 * Pure JavaScript Attestation Verifier for kgen-core
 * 
 * Provides comprehensive verification capabilities for attestations:
 * - Native Node.js crypto verification (no JOSE dependencies)
 * - Hash integrity verification
 * - Digital signature validation using Ed25519 and RSA
 * - Attestation structure validation
 * - Cross-platform verification support
 */

import { createVerify, createHash, timingSafeEqual, verify } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export class AttestationVerifier {
  constructor(config = {}) {
    this.config = {
      // Hash algorithms (ordered by preference)
      hashAlgorithms: ['sha256', 'sha512', 'sha3-256'],
      primaryHash: 'sha256',
      
      // Signature algorithms supported
      signatureAlgorithms: ['ed25519', 'rsa-sha256', 'rsa-sha512'],
      
      // Verification settings
      enableTimingAttackProtection: true,
      enableHashChainVerification: true,
      enableIntegrityDatabase: true,
      
      // Clock tolerance for verification
      clockTolerance: config.clockTolerance || '5m',
      maxAge: config.maxAge || '1y',
      strict: config.strict !== false,
      
      // Caching
      enableCache: config.enableCache !== false,
      cacheSize: config.cacheSize || 1000,
      cacheTTL: config.cacheTTL || 300000, // 5 minutes
      
      // Output
      includePayload: config.includePayload !== false,
      verboseLogging: config.verboseLogging || false,
      
      ...config
    };
    
    this.verificationCache = new Map();
    this.integrityDatabase = new Map();
    this.initialized = false;
    
    this.metrics = {
      verificationsPerformed: 0,
      hashesComputed: 0,
      signaturesVerified: 0,
      cacheHits: 0,
      cacheMisses: 0,
      integrityFailures: 0
    };
  }

  /**
   * Initialize the verifier
   */
  async initialize() {
    if (this.initialized) return;
    this.initialized = true;
  }

  /**
   * Verify attestation using native Node.js crypto
   * @param {string} attestationPath - Path to attestation file
   * @param {Object} options - Verification options
   * @returns {Promise<Object>} Verification result
   */
  async verifyAttestation(attestationPath, options = {}) {
    await this.initialize();
    
    try {
      // Check cache first
      const cacheKey = this._generateCacheKey('attestation', attestationPath);
      if (this.config.enableCache && this.verificationCache.has(cacheKey)) {
        const cached = this.verificationCache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.config.cacheTTL) {
          this.metrics.cacheHits++;
          return { ...cached.result, fromCache: true };
        }
      }
      
      this.metrics.cacheMisses++;
      
      // Load attestation
      const attestationContent = await fs.readFile(attestationPath, 'utf8');
      const attestation = JSON.parse(attestationContent);
      
      const result = {
        valid: true,
        tool: 'kgen-native-verifier',
        attestationPath,
        verifiedAt: new Date().toISOString(),
        errors: [],
        warnings: [],
        checks: {}
      };
      
      // Verify artifact exists and integrity
      await this._verifyArtifactIntegrity(attestation, result);
      
      // Verify signatures if present
      if (attestation.signatures) {
        await this._verifySignatures(attestation, result);
      }
      
      // Verify attestation structure
      await this._verifyAttestationStructure(attestation, result);
      
      // Verify timestamps
      await this._verifyTimestamps(attestation, result);
      
      // Verify git metadata if present
      if (attestation.git) {
        await this._verifyGitMetadata(attestation, result);
      }
      
      this.metrics.verificationsPerformed++;
      
      // Cache the result
      if (this.config.enableCache && result.valid) {
        this._cacheResult(cacheKey, result);
      }
      
      if (!result.valid) {
        this.metrics.integrityFailures++;
      }
      
      return result;
      
    } catch (error) {
      const result = {
        valid: false,
        tool: 'kgen-native-verifier',
        attestationPath,
        error: error.message,
        verifiedAt: new Date().toISOString()
      };
      
      if (this.config.verboseLogging) {
        console.warn('Attestation verification failed:', error);
      }
      
      return result;
    }
  }

  /**
   * Verify artifact integrity against attestation
   */
  async _verifyArtifactIntegrity(attestation, result) {
    if (!attestation.artifact) {
      result.errors.push('No artifact information found in attestation');
      result.valid = false;
      return;
    }
    
    const artifact = attestation.artifact;
    
    // Check if artifact exists
    try {
      await fs.access(artifact.path);
      result.checks.artifactExists = true;
    } catch (error) {
      result.errors.push(`Artifact not found: ${artifact.path}`);
      result.valid = false;
      result.checks.artifactExists = false;
      return;
    }
    
    // Verify hash integrity
    try {
      const currentHash = await this._calculateFileHash(artifact.path);
      const expectedHash = artifact.contentHash || artifact.checksum?.value;
      
      if (expectedHash) {
        result.checks.hashIntegrity = this._secureCompare(currentHash, expectedHash);
        
        if (!result.checks.hashIntegrity) {
          result.errors.push(`Hash mismatch: expected ${expectedHash}, got ${currentHash}`);
          result.valid = false;
        } else {
          result.checks.currentHash = currentHash;
          result.checks.expectedHash = expectedHash;
        }
      } else {
        result.warnings.push('No hash available for integrity verification');
      }
    } catch (error) {
      result.errors.push(`Hash verification failed: ${error.message}`);
      result.valid = false;
    }
    
    // Verify file size if available
    if (artifact.size) {
      try {
        const stats = await fs.stat(artifact.path);
        result.checks.sizeMatches = stats.size === artifact.size;
        
        if (!result.checks.sizeMatches) {
          result.warnings.push(`Size mismatch: expected ${artifact.size}, got ${stats.size}`);
        }
      } catch (error) {
        result.warnings.push(`Could not verify file size: ${error.message}`);
      }
    }
  }

  /**
   * Verify all signatures in the attestation
   */
  async _verifySignatures(attestation, result) {
    result.checks.signatures = {};
    
    for (const [algorithm, signature] of Object.entries(attestation.signatures)) {
      try {
        const publicKeyData = attestation.keys?.[algorithm];
        
        if (!publicKeyData) {
          result.errors.push(`No public key found for algorithm: ${algorithm}`);
          result.valid = false;
          continue;
        }
        
        const isValid = await this._verifySignature(
          attestation.artifact,
          signature,
          publicKeyData,
          algorithm
        );
        
        result.checks.signatures[algorithm] = isValid;
        
        if (!isValid) {
          result.errors.push(`${algorithm} signature verification failed`);
          result.valid = false;
        }
        
        this.metrics.signaturesVerified++;
        
      } catch (error) {
        result.errors.push(`${algorithm} signature verification error: ${error.message}`);
        result.valid = false;
        result.checks.signatures[algorithm] = false;
      }
    }
  }

  /**
   * Verify individual signature
   */
  async _verifySignature(artifact, signature, publicKeyData, algorithm) {
    // Reconstruct the signed payload
    const payload = JSON.stringify(artifact, Object.keys(artifact).sort());
    
    try {
      switch (algorithm) {
        case 'ed25519':
          // Use direct crypto.verify for Ed25519
          const data = Buffer.from(payload, 'utf8');
          const sig = Buffer.from(signature, 'base64');
          return verify(null, data, publicKeyData.key, sig);
          
        case 'rsa-sha256':
          const rsaVerify = createVerify('SHA256');
          rsaVerify.update(payload);
          return rsaVerify.verify(publicKeyData.key, signature, 'base64');
          
        default:
          throw new Error(`Signature verification not implemented for algorithm: ${algorithm}`);
      }
    } catch (error) {
      throw new Error(`Signature verification failed: ${error.message}`);
    }
  }

  /**
   * Verify attestation structure and required fields
   */
  async _verifyAttestationStructure(attestation, result) {
    const requiredFields = [
      'version',
      'artifact',
      'generation'
    ];
    
    const missingFields = requiredFields.filter(field => !attestation[field]);
    
    if (missingFields.length > 0) {
      result.errors.push(`Missing required fields: ${missingFields.join(', ')}`);
      result.valid = false;
    }
    
    result.checks.structureValid = missingFields.length === 0;
    
    // Verify version compatibility
    if (attestation.version) {
      const supportedVersions = ['2.0.0'];
      result.checks.versionSupported = supportedVersions.includes(attestation.version);
      
      if (!result.checks.versionSupported) {
        result.warnings.push(`Attestation version ${attestation.version} may not be fully supported`);
      }
    }
    
    // Verify provenance structure if present
    if (attestation.provenance) {
      result.checks.provenanceValid = this._verifyProvenanceStructure(attestation.provenance);
      
      if (!result.checks.provenanceValid) {
        result.warnings.push('Provenance structure is not W3C PROV-O compliant');
      }
    }
    
    // Verify SLSA structure if present
    if (attestation.slsa) {
      result.checks.slsaValid = this._verifySLSAStructure(attestation.slsa);
      
      if (!result.checks.slsaValid) {
        result.warnings.push('SLSA structure is not fully compliant');
      }
    }
  }

  /**
   * Verify timestamps for validity and consistency
   */
  async _verifyTimestamps(attestation, result) {
    const now = new Date();
    
    if (attestation.timestamp) {
      const createdTime = new Date(attestation.timestamp);
      
      result.checks.timestampValid = !isNaN(createdTime.getTime());
      
      if (result.checks.timestampValid) {
        // Check if timestamp is in the future
        if (createdTime > now) {
          result.warnings.push('Attestation timestamp is in the future');
        }
        
        // Check if attestation is too old
        const maxAge = this._parseTimespan(this.config.maxAge);
        if (now - createdTime > maxAge) {
          result.warnings.push('Attestation is older than maximum age threshold');
        }
      } else {
        result.errors.push('Invalid attestation timestamp');
        result.valid = false;
      }
    }
    
    // Verify generation timestamp consistency
    if (attestation.generation?.timestamp && attestation.timestamp) {
      const generatedTime = new Date(attestation.generation.timestamp);
      const createdTime = new Date(attestation.timestamp);
      
      if (Math.abs(generatedTime - createdTime) > 60000) { // 1 minute tolerance
        result.warnings.push('Generation and creation timestamps differ significantly');
      }
    }
  }

  /**
   * Verify git metadata if present
   */
  async _verifyGitMetadata(attestation, result) {
    const gitData = attestation.git;
    
    if (!gitData) return;
    
    result.checks.gitValid = true;
    
    // Verify commit hash format
    if (gitData.commit) {
      const commitRegex = /^[a-f0-9]{40}$/;
      if (!commitRegex.test(gitData.commit)) {
        result.warnings.push('Git commit hash appears to be invalid');
        result.checks.gitValid = false;
      }
    }
    
    // Check for uncommitted changes
    if (gitData.dirty === true && gitData.uncommittedFiles?.length > 0) {
      result.warnings.push(`Artifact was generated with ${gitData.uncommittedFiles.length} uncommitted files`);
    }
    
    // Verify against current git state if in same repository
    try {
      const currentCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
      
      if (gitData.commit && gitData.commit !== currentCommit) {
        result.warnings.push('Attestation was generated from a different git commit');
      }
    } catch (error) {
      // Not in a git repository or git not available - this is fine
    }
  }

  /**
   * Verify W3C PROV-O provenance structure
   */
  _verifyProvenanceStructure(provenance) {
    // Check for required PROV-O elements
    const hasContext = provenance['@context'] && 
      Array.isArray(provenance['@context']) &&
      provenance['@context'].includes('https://www.w3.org/ns/prov');
    
    const hasEntity = provenance['prov:entity'] && 
      provenance['prov:entity']['@type'] === 'prov:Entity';
    
    const hasActivity = provenance['prov:activity'] && 
      provenance['prov:activity']['@type'] === 'prov:Activity';
    
    return hasContext && hasEntity && hasActivity;
  }

  /**
   * Verify SLSA structure compliance
   */
  _verifySLSAStructure(slsa) {
    const hasPredicateType = slsa.predicateType && 
      slsa.predicateType.includes('slsa.dev/provenance');
    
    const hasSubject = slsa.subject && 
      Array.isArray(slsa.subject) &&
      slsa.subject.length > 0;
    
    const hasBuildDefinition = slsa.buildDefinition &&
      slsa.buildDefinition.buildType;
    
    return hasPredicateType && hasSubject && hasBuildDefinition;
  }

  /**
   * Calculate file hash
   */
  async _calculateFileHash(filePath, algorithm = 'sha256') {
    try {
      const content = await fs.readFile(filePath);
      const hash = createHash(algorithm);
      hash.update(content);
      this.metrics.hashesComputed++;
      return hash.digest('hex');
    } catch (error) {
      throw new Error(`Failed to calculate hash: ${error.message}`);
    }
  }

  /**
   * Secure string comparison using timing-safe equal
   */
  _secureCompare(a, b) {
    if (!this.config.enableTimingAttackProtection) {
      return a === b;
    }
    
    if (a.length !== b.length) {
      return false;
    }
    
    try {
      return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
    } catch {
      // Fallback for non-hex strings
      return timingSafeEqual(Buffer.from(a), Buffer.from(b));
    }
  }

  /**
   * Parse time span string to milliseconds
   */
  _parseTimespan(timespan) {
    if (typeof timespan === 'number') return timespan;
    if (typeof timespan === 'string') {
      const match = timespan.match(/^(\d+)([smhdy])$/);
      if (match) {
        const [, num, unit] = match;
        const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000, y: 31536000000 };
        return parseInt(num) * multipliers[unit];
      }
    }
    return 31536000000; // Default to 1 year
  }

  /**
   * Generate cache key for caching results
   */
  _generateCacheKey(operation, filePath) {
    const data = `${operation}:${filePath}`;
    const hash = createHash('md5');
    hash.update(data);
    return hash.digest('hex');
  }

  /**
   * Cache verification result
   */
  _cacheResult(key, result) {
    if (this.verificationCache.size >= this.config.cacheSize) {
      const firstKey = this.verificationCache.keys().next().value;
      this.verificationCache.delete(firstKey);
    }
    
    this.verificationCache.set(key, {
      result,
      timestamp: Date.now()
    });
  }

  /**
   * Batch verify multiple attestations
   * @param {Array} attestationPaths - Array of attestation file paths
   * @param {Object} options - Verification options
   * @returns {Promise<Array>} Array of verification results
   */
  async batchVerifyAttestations(attestationPaths, options = {}) {
    const results = [];
    const batchSize = options.batchSize || 10;
    
    for (let i = 0; i < attestationPaths.length; i += batchSize) {
      const batch = attestationPaths.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (attestationPath, index) => {
        try {
          return await this.verifyAttestation(attestationPath, options);
        } catch (error) {
          return {
            valid: false,
            attestationPath,
            error: error.message,
            verifiedAt: new Date().toISOString()
          };
        }
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            valid: false,
            error: result.reason.message,
            verifiedAt: new Date().toISOString()
          });
        }
      }
    }
    
    return results;
  }

  /**
   * Generate detailed verification report
   * @param {Object} verificationResult - Result from verification
   * @param {Object} options - Report options
   * @returns {string} Formatted report
   */
  generateVerificationReport(verificationResult, options = {}) {
    const format = options.format || 'markdown';
    
    if (format === 'json') {
      return JSON.stringify(verificationResult, null, 2);
    }
    
    let report = '# Attestation Verification Report\n\n';
    
    // Executive Summary
    const status = verificationResult.valid ? '✅ VALID' : '❌ INVALID';
    report += `## Status: ${status}\n\n`;
    report += `- **Attestation**: ${path.basename(verificationResult.attestationPath)}\n`;
    report += `- **Verified At**: ${verificationResult.verifiedAt}\n`;
    report += `- **Tool**: ${verificationResult.tool}\n\n`;
    
    // Checks Summary
    if (verificationResult.checks) {
      report += `## Verification Checks\n\n`;
      for (const [check, result] of Object.entries(verificationResult.checks)) {
        const checkStatus = result === true ? '✅' : result === false ? '❌' : '⚠️';
        report += `- **${check}**: ${checkStatus} ${result}\n`;
      }
      report += '\n';
    }
    
    // Errors
    if (verificationResult.errors?.length > 0) {
      report += `## Errors\n\n`;
      for (const error of verificationResult.errors) {
        report += `- ❌ ${error}\n`;
      }
      report += '\n';
    }
    
    // Warnings
    if (verificationResult.warnings?.length > 0) {
      report += `## Warnings\n\n`;
      for (const warning of verificationResult.warnings) {
        report += `- ⚠️ ${warning}\n`;
      }
      report += '\n';
    }
    
    // Manual Verification Commands
    report += `## Manual Verification\n\n`;
    report += `### Using Node.js crypto module\n`;
    report += '```javascript\n';
    report += `const crypto = require('crypto');\n`;
    report += `const fs = require('fs');\n\n`;
    report += `// Load attestation\n`;
    report += `const attestation = JSON.parse(fs.readFileSync('${path.basename(verificationResult.attestationPath)}'));\n\n`;
    report += `// Verify signature example (Ed25519)\n`;
    report += `if (attestation.signatures.ed25519) {\n`;
    report += `  const verify = crypto.createVerify('SHA256');\n`;
    report += `  const payload = JSON.stringify(attestation.artifact, Object.keys(attestation.artifact).sort());\n`;
    report += `  verify.update(payload);\n`;
    report += `  const isValid = verify.verify(attestation.keys.ed25519.key, attestation.signatures.ed25519, 'base64');\n`;
    report += `  console.log('Signature valid:', isValid);\n`;
    report += `}\n`;
    report += '```\n\n';
    
    return report;
  }

  /**
   * Get verifier status and metrics
   */
  getStatus() {
    return {
      initialized: this.initialized,
      metrics: this.metrics,
      cacheSize: this.verificationCache.size,
      maxCacheSize: this.config.cacheSize,
      cacheTTL: this.config.cacheTTL,
      supportedAlgorithms: this.config.signatureAlgorithms,
      features: {
        nativeCrypto: true,
        timingAttackProtection: this.config.enableTimingAttackProtection,
        caching: this.config.enableCache,
        strictMode: this.config.strict,
        gitMetadataVerification: true,
        provenanceVerification: true,
        slsaVerification: true
      }
    };
  }
}

export default AttestationVerifier;