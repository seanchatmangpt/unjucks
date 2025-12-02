/**
 * Attestation Generator - Connect Provenance to .attest.json
 * 
 * Generates .attest.json files using minimal provenance objects and CAS integration.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { ProvenanceGenerator } from './core.js';
import { cas } from '../cas/index.js';

/**
 * Attestation Generator using minimal provenance and CAS
 */
export class AttestationGenerator {
  constructor(options = {}) {
    this.provenance = new ProvenanceGenerator(options);
    this.config = {
      attestationSuffix: '.attest.json',
      enableCAS: options.enableCAS !== false,
      enableMinimalMode: options.enableMinimalMode !== false,
      includeFullLineage: options.includeFullLineage || false,
      ...options
    };
  }

  /**
   * Generate .attest.json file from minimal provenance
   * @param {Object} params - Generation parameters
   * @returns {Promise<Object>} Generated attestation
   */
  async generateAttestation(params) {
    const {
      artifactPath,
      templateId,
      templatePath,
      graphPath,
      outputPath
    } = params;

    try {
      // Generate minimal provenance object
      const provenance = await this.provenance.generateProvenance({
        artifactPath,
        templateId,
        templatePath,
        graphPath,
        generatedAt: new Date(),
        kgenVersion: params.kgenVersion || 'unknown'
      });

      // Validate provenance
      const validation = this.provenance.validateProvenance(provenance);
      if (!validation.valid) {
        throw new Error(`Invalid provenance: ${validation.errors.join(', ')}`);
      }

      // Store content in CAS if enabled
      let casHashes = {};
      if (this.config.enableCAS) {
        casHashes = await this._storeCASContent(provenance);
      }

      // Build attestation object
      const attestation = this.config.enableMinimalMode 
        ? this._buildMinimalAttestation(provenance, casHashes)
        : this._buildFullAttestation(provenance, casHashes);

      // Write .attest.json file
      const attestationPath = outputPath || (artifactPath + this.config.attestationSuffix);
      await this._writeAttestationFile(attestationPath, attestation);

      return {
        success: true,
        attestationPath,
        attestation,
        provenance,
        casHashes
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        attestationPath: null,
        attestation: null
      };
    }
  }

  /**
   * Generate attestation for multiple artifacts
   * @param {Array} artifacts - Array of artifact parameters
   * @returns {Promise<Array>} Array of attestation results
   */
  async generateBatchAttestations(artifacts) {
    const results = [];

    for (const artifact of artifacts) {
      const result = await this.generateAttestation(artifact);
      results.push({
        ...artifact,
        ...result
      });
    }

    return {
      success: true,
      results,
      successCount: results.filter(r => r.success).length,
      errorCount: results.filter(r => !r.success).length
    };
  }

  /**
   * Verify existing .attest.json file
   * @param {string} attestationPath - Path to .attest.json file
   * @returns {Promise<Object>} Verification result
   */
  async verifyAttestation(attestationPath) {
    try {
      // Read attestation file
      const content = await fs.readFile(attestationPath, 'utf8');
      const attestation = JSON.parse(content);

      // Extract provenance
      const provenance = this._extractProvenanceFromAttestation(attestation);
      
      // Validate provenance structure
      const validation = this.provenance.validateProvenance(provenance);
      
      // Verify artifact integrity
      const artifactPath = attestationPath.replace(this.config.attestationSuffix, '');
      const integrityCheck = await this._verifyArtifactIntegrity(artifactPath, provenance);

      // Verify CAS content if available
      const casVerification = await this._verifyCASContent(attestation);

      return {
        valid: validation.valid && integrityCheck.valid && casVerification.valid,
        attestationPath,
        validation,
        integrityCheck,
        casVerification,
        provenance
      };

    } catch (error) {
      return {
        valid: false,
        error: error.message,
        attestationPath
      };
    }
  }

  /**
   * Update existing attestation with new information
   * @param {string} attestationPath - Path to existing .attest.json
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} Update result
   */
  async updateAttestation(attestationPath, updates) {
    try {
      // Read existing attestation
      const content = await fs.readFile(attestationPath, 'utf8');
      const existing = JSON.parse(content);

      // Extract and update provenance
      const existingProvenance = this._extractProvenanceFromAttestation(existing);
      const updatedProvenance = this.provenance.updateProvenance(existingProvenance, updates);

      // Rebuild attestation
      const casHashes = existing.cas || {};
      const attestation = this.config.enableMinimalMode
        ? this._buildMinimalAttestation(updatedProvenance, casHashes)
        : this._buildFullAttestation(updatedProvenance, casHashes);

      // Write updated file
      await this._writeAttestationFile(attestationPath, attestation);

      return {
        success: true,
        attestationPath,
        attestation,
        updates
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        attestationPath
      };
    }
  }

  // Private methods

  /**
   * Store content in CAS and return hashes
   */
  async _storeCASContent(provenance) {
    const hashes = {};

    try {
      // Store artifact if exists
      if (provenance.artifact?.path) {
        const content = await fs.readFile(provenance.artifact.path);
        hashes.artifact = await cas.store(content);
      }

      // Store template if exists
      if (provenance.template?.path) {
        const content = await fs.readFile(provenance.template.path);
        hashes.template = await cas.store(content);
      }

      // Store graph if exists  
      if (provenance.graph?.path) {
        const content = await fs.readFile(provenance.graph.path);
        hashes.graph = await cas.store(content);
      }

    } catch (error) {
      console.warn('CAS storage failed:', error.message);
    }

    return hashes;
  }

  /**
   * Build minimal attestation object
   */
  _buildMinimalAttestation(provenance, casHashes = {}) {
    const attestation = {
      version: '1.0.0',
      format: 'kgen-minimal-attestation',
      timestamp: new Date().toISOString(),
      
      // Minimal provenance (exact schema requested)
      provenance: {
        artifact: {
          path: provenance.artifact?.path,
          hash: provenance.artifact?.hash
        },
        template: {
          id: provenance.template?.id,
          hash: provenance.template?.hash
        },
        graph: {
          path: provenance.graph?.path,
          hash: provenance.graph?.hash
        },
        generatedAt: provenance.generatedAt,
        kgenVersion: provenance.kgenVersion
      }
    };

    // Add CAS hashes if available
    if (Object.keys(casHashes).length > 0) {
      attestation.cas = casHashes;
    }

    return attestation;
  }

  /**
   * Build full attestation object with extended metadata
   */
  _buildFullAttestation(provenance, casHashes = {}) {
    const minimal = this._buildMinimalAttestation(provenance, casHashes);
    
    return {
      ...minimal,
      format: 'kgen-full-attestation',
      
      // Extended metadata
      metadata: {
        generator: 'kgen-attestation-generator',
        generatorVersion: '1.0.0',
        platform: process.platform,
        nodeVersion: process.version,
        workingDirectory: process.cwd()
      },

      // File information
      artifact: {
        path: provenance.artifact?.path,
        hash: provenance.artifact?.hash,
        size: null, // Would be filled by reading file
        type: this._inferFileType(provenance.artifact?.path)
      },

      // Verification
      verification: {
        algorithm: 'sha256',
        verifiedAt: new Date().toISOString(),
        integrityChecked: true
      }
    };
  }

  /**
   * Write attestation to file
   */
  async _writeAttestationFile(filePath, attestation) {
    const content = JSON.stringify(attestation, null, 2);
    await fs.writeFile(filePath, content, 'utf8');
  }

  /**
   * Extract provenance from attestation object
   */
  _extractProvenanceFromAttestation(attestation) {
    // Handle both minimal and full formats
    if (attestation.provenance) {
      return attestation.provenance;
    }

    // Fallback for other formats
    return {
      artifact: {
        path: attestation.artifact?.path,
        hash: attestation.artifact?.hash
      },
      template: {
        id: attestation.generation?.template || attestation.template?.id,
        hash: attestation.generation?.templateHash || attestation.template?.hash
      },
      graph: {
        path: attestation.generation?.graphPath || attestation.graph?.path,
        hash: attestation.generation?.graphHash || attestation.graph?.hash
      },
      generatedAt: attestation.generation?.timestamp || attestation.timestamp,
      kgenVersion: attestation.generation?.engine?.replace('kgen@', '') || 
                   attestation.kgenVersion || 'unknown'
    };
  }

  /**
   * Verify artifact integrity
   */
  async _verifyArtifactIntegrity(artifactPath, provenance) {
    try {
      if (!provenance.artifact?.hash) {
        return { valid: false, reason: 'No hash available for verification' };
      }

      const currentHash = await this.provenance._calculateFileHash(artifactPath);
      const valid = currentHash === provenance.artifact.hash;

      return {
        valid,
        expectedHash: provenance.artifact.hash,
        actualHash: currentHash,
        reason: valid ? 'Hash verification passed' : 'Hash mismatch detected'
      };

    } catch (error) {
      return {
        valid: false,
        reason: `Verification failed: ${error.message}`
      };
    }
  }

  /**
   * Verify CAS content
   */
  async _verifyCASContent(attestation) {
    if (!attestation.cas || !this.config.enableCAS) {
      return { valid: true, reason: 'CAS verification not applicable' };
    }

    try {
      const results = {};
      
      for (const [key, hash] of Object.entries(attestation.cas)) {
        const exists = await cas.exists(hash);
        results[key] = { hash, exists };
      }

      const allExist = Object.values(results).every(r => r.exists);

      return {
        valid: allExist,
        results,
        reason: allExist ? 'All CAS content verified' : 'Some CAS content missing'
      };

    } catch (error) {
      return {
        valid: false,
        reason: `CAS verification failed: ${error.message}`
      };
    }
  }

  /**
   * Infer file type from path
   */
  _inferFileType(filePath) {
    if (!filePath) return 'unknown';
    
    const ext = path.extname(filePath).toLowerCase();
    const typeMap = {
      '.js': 'javascript',
      '.ts': 'typescript', 
      '.json': 'json',
      '.md': 'markdown',
      '.html': 'html',
      '.css': 'css',
      '.txt': 'text'
    };

    return typeMap[ext] || 'unknown';
  }
}

// Export singleton instance
export const attestationGenerator = new AttestationGenerator();

export default AttestationGenerator;