/**
 * Attestation Commands - CLI interface for kgen artifact explain
 * 
 * Provides command-line interface for attestation verification and
 * artifact origin explanation functionality.
 */

import { AttestationGenerator } from './generator.js';
import consola from 'consola';
import path from 'path';
import { promises as fs } from 'fs';

export class AttestationCommands {
  constructor(config = {}) {
    this.config = config;
    this.logger = consola.withTag('attestation-commands');
    this.generator = new AttestationGenerator(config);
  }

  /**
   * Initialize commands
   */
  async initialize() {
    await this.generator.initialize();
    return this;
  }

  /**
   * Explain artifact command - kgen artifact explain <path>
   * @param {string} artifactPath - Path to artifact to explain
   * @param {Object} options - Command options
   */
  async explainArtifact(artifactPath, options = {}) {
    try {
      this.logger.info(`Explaining artifact: ${artifactPath}`);
      
      // Resolve absolute path
      const absolutePath = path.resolve(artifactPath);
      
      // Check if artifact exists
      if (!await this._fileExists(absolutePath)) {
        return {
          success: false,
          error: `Artifact not found: ${artifactPath}`,
          path: absolutePath
        };
      }
      
      // Get explanation from generator
      const explanation = await this.generator.explainArtifact(absolutePath);
      
      if (!explanation.success) {
        this.logger.error(`Failed to explain artifact: ${explanation.reason}`);
        return explanation;
      }
      
      // Format output based on options
      return this._formatExplanation(explanation, options);
      
    } catch (error) {
      this.logger.error(`Error explaining artifact ${artifactPath}:`, error);
      return {
        success: false,
        error: error.message,
        path: artifactPath
      };
    }
  }

  /**
   * Verify artifact command - kgen artifact verify <path>
   * @param {string} artifactPath - Path to artifact to verify
   * @param {Object} options - Command options
   */
  async verifyArtifact(artifactPath, options = {}) {
    try {
      this.logger.info(`Verifying artifact: ${artifactPath}`);
      
      const absolutePath = path.resolve(artifactPath);
      
      if (!await this._fileExists(absolutePath)) {
        return {
          success: false,
          error: `Artifact not found: ${artifactPath}`,
          path: absolutePath
        };
      }
      
      // Perform verification
      const verification = await this.generator.verifyAttestation(absolutePath);
      
      return {
        success: verification.verified,
        verification,
        path: absolutePath
      };
      
    } catch (error) {
      this.logger.error(`Error verifying artifact ${artifactPath}:`, error);
      return {
        success: false,
        error: error.message,
        path: artifactPath
      };
    }
  }

  /**
   * List artifacts with attestations
   * @param {string} directory - Directory to scan
   * @param {Object} options - Command options
   */
  async listAttestations(directory = '.', options = {}) {
    try {
      this.logger.info(`Listing attestations in: ${directory}`);
      
      const absoluteDir = path.resolve(directory);
      const attestations = [];
      
      // Find all .attest.json files
      const files = await this._findAttestationFiles(absoluteDir, options.recursive !== false);
      
      for (const attestFile of files) {
        try {
          const attestContent = await fs.readFile(attestFile, 'utf8');
          const attestation = JSON.parse(attestContent);
          
          // Get corresponding artifact path
          const artifactPath = attestFile.replace(/\.attest\.json$/, '');
          const artifactExists = await this._fileExists(artifactPath);
          
          attestations.push({
            artifactPath,
            attestationPath: attestFile,
            artifactExists,
            id: attestation.id,
            timestamp: attestation.timestamp,
            templatePath: attestation.provenance?.templatePath,
            verified: artifactExists ? null : false // null means not checked yet
          });
          
        } catch (error) {
          this.logger.warn(`Invalid attestation file: ${attestFile}`, error.message);
        }
      }
      
      return {
        success: true,
        directory: absoluteDir,
        count: attestations.length,
        attestations
      };
      
    } catch (error) {
      this.logger.error(`Error listing attestations in ${directory}:`, error);
      return {
        success: false,
        error: error.message,
        directory
      };
    }
  }

  /**
   * Batch verify multiple artifacts
   * @param {Array|string} paths - Artifact paths or directory
   * @param {Object} options - Command options
   */
  async batchVerify(paths, options = {}) {
    try {
      let artifactPaths = [];
      
      if (typeof paths === 'string') {
        // Directory scan
        const listResult = await this.listAttestations(paths, options);
        if (!listResult.success) return listResult;
        
        artifactPaths = listResult.attestations
          .filter(a => a.artifactExists)
          .map(a => a.artifactPath);
      } else {
        // Array of paths
        artifactPaths = paths;
      }
      
      this.logger.info(`Batch verifying ${artifactPaths.length} artifacts`);
      
      const results = [];
      let verified = 0;
      let failed = 0;
      
      for (const artifactPath of artifactPaths) {
        try {
          const result = await this.verifyArtifact(artifactPath, options);
          results.push(result);
          
          if (result.success && result.verification.verified) {
            verified++;
          } else {
            failed++;
          }
          
        } catch (error) {
          results.push({
            success: false,
            error: error.message,
            path: artifactPath
          });
          failed++;
        }
      }
      
      return {
        success: true,
        total: artifactPaths.length,
        verified,
        failed,
        results
      };
      
    } catch (error) {
      this.logger.error('Error in batch verification:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get attestation statistics
   * @param {string} directory - Directory to analyze
   */
  async getStatistics(directory = '.') {
    try {
      const listResult = await this.listAttestations(directory, { recursive: true });
      if (!listResult.success) return listResult;
      
      const stats = {
        totalAttestations: listResult.count,
        artifactsWithAttestations: listResult.attestations.filter(a => a.artifactExists).length,
        orphanedAttestations: listResult.attestations.filter(a => !a.artifactExists).length,
        templateUsage: {},
        oldestAttestation: null,
        newestAttestation: null
      };
      
      // Analyze attestations
      for (const attestation of listResult.attestations) {
        // Template usage
        if (attestation.templatePath) {
          const template = path.basename(attestation.templatePath);
          stats.templateUsage[template] = (stats.templateUsage[template] || 0) + 1;
        }
        
        // Date range
        const timestamp = new Date(attestation.timestamp);
        if (!stats.oldestAttestation || timestamp < new Date(stats.oldestAttestation)) {
          stats.oldestAttestation = attestation.timestamp;
        }
        if (!stats.newestAttestation || timestamp > new Date(stats.newestAttestation)) {
          stats.newestAttestation = attestation.timestamp;
        }
      }
      
      // Add generator statistics
      const generatorStats = this.generator.getStatistics();
      
      return {
        success: true,
        directory: path.resolve(directory),
        fileSystemStats: stats,
        generatorStats
      };
      
    } catch (error) {
      this.logger.error(`Error getting statistics for ${directory}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Private helper methods

  async _fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async _findAttestationFiles(directory, recursive = true) {
    const files = [];
    
    const scan = async (dir) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isFile() && entry.name.endsWith('.attest.json')) {
            files.push(fullPath);
          } else if (entry.isDirectory() && recursive) {
            await scan(fullPath);
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };
    
    await scan(directory);
    return files;
  }

  _formatExplanation(explanation, options = {}) {
    const { format = 'detailed' } = options;
    
    if (!explanation.success) {
      return explanation;
    }
    
    const exp = explanation.explanation;
    
    switch (format) {
      case 'json':
        return explanation;
        
      case 'summary':
        return {
          success: true,
          artifact: exp.artifact.path,
          template: exp.origin.template.path,
          templateVersion: exp.origin.template.version,
          generatedAt: exp.artifact.generatedAt,
          verified: exp.artifact.verified,
          chainPosition: exp.lineage.chainPosition
        };
        
      case 'detailed':
      default:
        return {
          success: true,
          ...explanation,
          formatted: {
            title: `Artifact Explanation: ${exp.artifact.name}`,
            sections: {
              artifact: {
                title: 'Artifact Information',
                data: exp.artifact
              },
              origin: {
                title: 'Origin & Provenance',
                data: exp.origin
              },
              lineage: {
                title: 'Template Lineage',
                data: exp.lineage
              },
              integrity: {
                title: 'Cryptographic Integrity',
                data: exp.integrity
              }
            }
          }
        };
    }
  }
}

export default AttestationCommands;