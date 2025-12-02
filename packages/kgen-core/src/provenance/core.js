/**
 * Minimal Provenance Object Generation
 * 
 * Generates lightweight provenance objects with only essential metadata
 * for efficient tracking and .attest.json generation.
 */

import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { casStorage } from '../cas/storage.js';

/**
 * Minimal Provenance Generator
 */
export class ProvenanceGenerator {
  constructor(options = {}) {
    this.config = {
      includeTimestamps: options.includeTimestamps !== false,
      includeHashes: options.includeHashes !== false,
      enableCAS: options.enableCAS !== false,
      kgenVersion: options.kgenVersion || 'unknown',
      ...options
    };

    this.casStorage = this.config.enableCAS ? casStorage : null;
  }

  /**
   * Generate minimal provenance object
   * @param {Object} params - Generation parameters
   * @returns {Promise<Object>} Minimal provenance object
   */
  async generateProvenance(params) {
    const {
      artifactPath,
      templateId,
      templatePath,
      graphPath,
      generatedAt = new Date(),
      kgenVersion = this.config.kgenVersion
    } = params;

    // Calculate required hashes
    const [artifactHash, templateHash, graphHash] = await Promise.all([
      this._calculateFileHash(artifactPath),
      templatePath ? this._calculateFileHash(templatePath) : null,
      graphPath ? this._calculateFileHash(graphPath) : null
    ]);

    // Store in CAS if enabled
    if (this.casStorage) {
      try {
        if (artifactPath) await this._storeInCAS(artifactPath);
        if (templatePath) await this._storeInCAS(templatePath);
        if (graphPath) await this._storeInCAS(graphPath);
      } catch (error) {
        // CAS storage is optional, don't fail on CAS errors
        console.warn('CAS storage failed:', error.message);
      }
    }

    // Build minimal provenance object
    const provenance = {
      artifact: {
        path: artifactPath,
        hash: artifactHash
      },
      template: {
        id: templateId,
        hash: templateHash
      },
      graph: {
        path: graphPath,
        hash: graphHash
      },
      generatedAt: this.config.includeTimestamps ? generatedAt.toISOString() : null,
      kgenVersion
    };

    // Remove null values to keep it minimal
    return this._removeNullValues(provenance);
  }

  /**
   * Generate provenance from template execution context
   * @param {Object} context - Template execution context
   * @returns {Promise<Object>} Provenance object
   */
  async generateFromContext(context) {
    const {
      outputPath,
      templateInfo,
      graphInfo,
      timestamp,
      version
    } = context;

    return this.generateProvenance({
      artifactPath: outputPath,
      templateId: templateInfo?.id,
      templatePath: templateInfo?.path,
      graphPath: graphInfo?.path,
      generatedAt: timestamp ? new Date(timestamp) : new Date(),
      kgenVersion: version
    });
  }

  /**
   * Update existing provenance with new information
   * @param {Object} existing - Existing provenance object
   * @param {Object} updates - Updates to apply
   * @returns {Object} Updated provenance object
   */
  updateProvenance(existing, updates) {
    const updated = {
      ...existing,
      ...updates
    };

    // Update timestamp if new data added
    if (this.config.includeTimestamps && updates && Object.keys(updates).length > 0) {
      updated.updatedAt = new Date().toISOString();
    }

    return this._removeNullValues(updated);
  }

  /**
   * Validate provenance object structure
   * @param {Object} provenance - Provenance object to validate
   * @returns {Object} Validation result
   */
  validateProvenance(provenance) {
    const errors = [];
    const warnings = [];

    // Check required fields
    if (!provenance.artifact) {
      errors.push('Missing artifact information');
    } else {
      if (!provenance.artifact.path) {
        errors.push('Missing artifact path');
      }
      if (!provenance.artifact.hash) {
        warnings.push('Missing artifact hash - integrity cannot be verified');
      }
    }

    if (!provenance.template) {
      errors.push('Missing template information');
    } else if (!provenance.template.id && !provenance.template.hash) {
      errors.push('Template information incomplete - missing both id and hash');
    }

    if (!provenance.kgenVersion) {
      warnings.push('Missing kgen version information');
    }

    // Check hash format if present
    const hashFields = [
      ['artifact.hash', provenance.artifact?.hash],
      ['template.hash', provenance.template?.hash],
      ['graph.hash', provenance.graph?.hash]
    ];

    for (const [field, hash] of hashFields) {
      if (hash && !this._isValidSHA256(hash)) {
        errors.push(`Invalid SHA256 hash format in ${field}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Create provenance comparison between two objects
   * @param {Object} provenance1 - First provenance object
   * @param {Object} provenance2 - Second provenance object
   * @returns {Object} Comparison result
   */
  compareProvenance(provenance1, provenance2) {
    const differences = [];
    const similarities = [];

    // Compare artifact hashes
    if (provenance1.artifact?.hash && provenance2.artifact?.hash) {
      if (provenance1.artifact.hash === provenance2.artifact.hash) {
        similarities.push('Identical artifact content');
      } else {
        differences.push('Different artifact content');
      }
    }

    // Compare template information
    if (provenance1.template?.hash && provenance2.template?.hash) {
      if (provenance1.template.hash === provenance2.template.hash) {
        similarities.push('Same template version');
      } else {
        differences.push('Different template version');
      }
    }

    if (provenance1.template?.id && provenance2.template?.id) {
      if (provenance1.template.id === provenance2.template.id) {
        similarities.push('Same template ID');
      } else {
        differences.push('Different template ID');
      }
    }

    // Compare graph information
    if (provenance1.graph?.hash && provenance2.graph?.hash) {
      if (provenance1.graph.hash === provenance2.graph.hash) {
        similarities.push('Same graph data');
      } else {
        differences.push('Different graph data');
      }
    }

    // Compare versions
    if (provenance1.kgenVersion && provenance2.kgenVersion) {
      if (provenance1.kgenVersion === provenance2.kgenVersion) {
        similarities.push('Same kgen version');
      } else {
        differences.push('Different kgen version');
      }
    }

    return {
      identical: differences.length === 0 && similarities.length > 0,
      differences,
      similarities,
      divergence: differences.length / (differences.length + similarities.length)
    };
  }

  /**
   * Extract provenance from .attest.json file
   * @param {string} attestPath - Path to .attest.json file
   * @returns {Promise<Object>} Extracted provenance object
   */
  async extractFromAttestation(attestPath) {
    try {
      const content = await fs.readFile(attestPath, 'utf8');
      const attestation = JSON.parse(content);

      // Extract minimal provenance from full attestation
      return {
        artifact: {
          path: attestation.artifact?.path || attestation.artifact?.relativePath,
          hash: attestation.artifact?.hash?.split(':')[1] || attestation.artifact?.contentHash
        },
        template: {
          id: attestation.generation?.template,
          hash: attestation.generation?.templateHash
        },
        graph: {
          path: attestation.generation?.graphPath,
          hash: attestation.generation?.graphHash
        },
        generatedAt: attestation.generation?.timestamp || attestation.timestamp,
        kgenVersion: attestation.generation?.engine?.replace('kgen@', '') || 'unknown'
      };
    } catch (error) {
      throw new Error(`Failed to extract provenance from attestation: ${error.message}`);
    }
  }

  // Private methods

  /**
   * Calculate SHA256 hash of file
   */
  async _calculateFileHash(filePath) {
    if (!filePath) return null;

    try {
      const content = await fs.readFile(filePath);
      return createHash('sha256').update(content).digest('hex');
    } catch (error) {
      console.warn(`Failed to hash file ${filePath}:`, error.message);
      return null;
    }
  }

  /**
   * Store file content in CAS
   */
  async _storeInCAS(filePath) {
    if (!this.casStorage || !filePath) return null;

    try {
      const content = await fs.readFile(filePath);
      return await this.casStorage.store(content);
    } catch (error) {
      console.warn(`Failed to store ${filePath} in CAS:`, error.message);
      return null;
    }
  }

  /**
   * Remove null/undefined values from object
   */
  _removeNullValues(obj) {
    if (obj === null || obj === undefined) return undefined;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.filter(item => item != null);

    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value != null) {
        const cleanedValue = typeof value === 'object' 
          ? this._removeNullValues(value)
          : value;
        
        // Only add the key if the cleaned value is not undefined
        if (cleanedValue !== undefined && !(typeof cleanedValue === "object" && Object.keys(cleanedValue).length === 0)) {
          cleaned[key] = cleanedValue;
        }
      }
    }

    return cleaned;
  }

  /**
   * Validate SHA256 hash format
   */
  _isValidSHA256(hash) {
    return typeof hash === 'string' && /^[a-f0-9]{64}$/i.test(hash);
  }
}

// Export singleton instance
export const provenanceGenerator = new ProvenanceGenerator();

export default ProvenanceGenerator;