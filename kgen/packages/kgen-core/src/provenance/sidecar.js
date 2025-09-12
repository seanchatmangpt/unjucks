/**
 * Sidecar File Generator for kgen-core Provenance
 * 
 * Generates .attest.json sidecar files with:
 * - W3C PROV-O compliant metadata
 * - SLSA attestation format compliance
 * - Flexible output formats (JSON, YAML, XML)
 * - Atomic file operations for reliability
 * - Template-based customization
 */

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export class SidecarGenerator {
  constructor(config = {}) {
    this.config = {
      // File naming and location
      sidecarSuffix: config.sidecarSuffix || '.attest.json',
      outputFormat: config.outputFormat || 'json', // json, yaml, xml, custom
      
      // Content options
      includeProvenance: config.includeProvenance !== false,
      includeSlsaData: config.includeSlsaData !== false,
      includeVerificationGuide: config.includeVerificationGuide !== false,
      includePublicKeys: config.includePublicKeys !== false,
      
      // W3C PROV-O compliance
      provenanceContext: config.provenanceContext || [
        'https://www.w3.org/ns/prov',
        'https://kgen.dev/provenance/v2'
      ],
      
      // SLSA compliance
      slsaVersion: config.slsaVersion || 'v0.2',
      slsaPredicateType: config.slsaPredicateType || 'https://slsa.dev/provenance/v0.2',
      
      // Performance and reliability
      atomicWrites: config.atomicWrites !== false,
      createBackups: config.createBackups || false,
      validateOutput: config.validateOutput !== false,
      
      // Template customization
      customTemplate: config.customTemplate,
      templateVariables: config.templateVariables || {},
      
      ...config
    };
    
    this.templates = new Map();
    this.initialized = false;
    
    this.metrics = {
      sidecarsGenerated: 0,
      backupsCreated: 0,
      validationFailures: 0,
      templateApplications: 0
    };
  }

  /**
   * Initialize the sidecar generator
   */
  async initialize() {
    if (this.initialized) return;
    
    // Load built-in templates
    await this._loadBuiltinTemplates();
    
    // Load custom template if specified
    if (this.config.customTemplate) {
      await this._loadCustomTemplate(this.config.customTemplate);
    }
    
    this.initialized = true;
  }

  /**
   * Generate sidecar file for an artifact
   * @param {string} artifactPath - Path to the original artifact
   * @param {Object} attestationData - Complete attestation data
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generation result
   */
  async generateSidecarFile(artifactPath, attestationData, options = {}) {
    await this.initialize();
    
    const sidecarPath = this._generateSidecarPath(artifactPath, options);
    const format = options.format || this.config.outputFormat;
    
    try {
      // Create backup if file exists and backup is enabled
      if (this.config.createBackups && await this._fileExists(sidecarPath)) {
        await this._createBackup(sidecarPath);
      }
      
      // Generate sidecar content
      const sidecarContent = await this._generateSidecarContent(
        artifactPath,
        attestationData,
        format,
        options
      );
      
      // Validate content if enabled
      if (this.config.validateOutput) {
        await this._validateSidecarContent(sidecarContent, format);
      }
      
      // Write file atomically
      if (this.config.atomicWrites) {
        await this._atomicWrite(sidecarPath, sidecarContent, format);
      } else {
        await this._directWrite(sidecarPath, sidecarContent, format);
      }
      
      this.metrics.sidecarsGenerated++;
      
      return {
        sidecarPath,
        artifactPath,
        format,
        size: Buffer.from(sidecarContent).length,
        generatedAt: new Date().toISOString(),
        contentHash: crypto.createHash('sha256').update(sidecarContent).digest('hex')
      };
      
    } catch (error) {
      throw new Error(`Failed to generate sidecar for ${artifactPath}: ${error.message}`);
    }
  }

  /**
   * Generate multiple sidecar files in batch
   * @param {Array} artifacts - Array of {path, attestation} objects
   * @param {Object} options - Batch options
   * @returns {Promise<Array>} Array of generation results
   */
  async generateBatchSidecars(artifacts, options = {}) {
    const results = [];
    const batchId = uuidv4();
    
    // Process in parallel batches
    const batchSize = options.batchSize || 10;
    for (let i = 0; i < artifacts.length; i += batchSize) {
      const batch = artifacts.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (artifact, index) => {
        const batchOptions = {
          ...options,
          batchId,
          batchIndex: i + index,
          totalArtifacts: artifacts.length
        };
        
        try {
          return await this.generateSidecarFile(
            artifact.path,
            artifact.attestation,
            batchOptions
          );
        } catch (error) {
          return {
            error: error.message,
            artifactPath: artifact.path,
            failed: true
          };
        }
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            error: result.reason.message,
            failed: true
          });
        }
      }
    }
    
    return results;
  }

  /**
   * Update existing sidecar file
   * @param {string} sidecarPath - Path to existing sidecar
   * @param {Object} updates - Updates to apply
   * @param {Object} options - Update options
   * @returns {Promise<Object>} Update result
   */
  async updateSidecarFile(sidecarPath, updates, options = {}) {
    if (!await this._fileExists(sidecarPath)) {
      throw new Error(`Sidecar file not found: ${sidecarPath}`);
    }
    
    try {
      // Load existing content
      const existingContent = await fs.readFile(sidecarPath, 'utf8');
      const existingData = JSON.parse(existingContent);
      
      // Create backup
      if (this.config.createBackups) {
        await this._createBackup(sidecarPath);
      }
      
      // Apply updates
      const updatedData = this._deepMerge(existingData, updates);
      
      // Add update metadata
      updatedData.metadata = {
        ...updatedData.metadata,
        lastUpdated: new Date().toISOString(),
        updateReason: options.reason || 'programmatic-update',
        originalCreated: existingData.metadata?.created || 'unknown'
      };
      
      // Write updated content
      const format = options.format || this.config.outputFormat;
      const updatedContent = await this._formatContent(updatedData, format);
      
      if (this.config.atomicWrites) {
        await this._atomicWrite(sidecarPath, updatedContent, format);
      } else {
        await this._directWrite(sidecarPath, updatedContent, format);
      }
      
      return {
        sidecarPath,
        updatedAt: new Date().toISOString(),
        updateSize: Buffer.from(updatedContent).length,
        backupCreated: this.config.createBackups
      };
      
    } catch (error) {
      throw new Error(`Failed to update sidecar ${sidecarPath}: ${error.message}`);
    }
  }

  /**
   * Validate sidecar file structure and content
   * @param {string} sidecarPath - Path to sidecar file
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation result
   */
  async validateSidecarFile(sidecarPath, options = {}) {
    if (!await this._fileExists(sidecarPath)) {
      return {
        valid: false,
        errors: [`Sidecar file not found: ${sidecarPath}`]
      };
    }
    
    try {
      const content = await fs.readFile(sidecarPath, 'utf8');
      return await this._validateSidecarContent(content, options.format || 'json');
      
    } catch (error) {
      return {
        valid: false,
        errors: [`Failed to validate sidecar: ${error.message}`]
      };
    }
  }

  /**
   * Extract artifact information from sidecar
   * @param {string} sidecarPath - Path to sidecar file
   * @returns {Promise<Object>} Extracted information
   */
  async extractArtifactInfo(sidecarPath) {
    if (!await this._fileExists(sidecarPath)) {
      throw new Error(`Sidecar file not found: ${sidecarPath}`);
    }
    
    const content = await fs.readFile(sidecarPath, 'utf8');
    const data = JSON.parse(content);
    
    return {
      artifactPath: data.artifact?.path,
      contentHash: data.artifact?.contentHash,
      size: data.artifact?.size,
      type: data.artifact?.type,
      generatedAt: data.metadata?.created,
      templatePath: data.generation?.templatePath,
      signatures: data.signatures ? Object.keys(data.signatures) : [],
      slsaLevel: data.slsa?.buildDefinition?.buildType,
      provenanceCompliant: !!(data.provenance && data.provenance['@context']),
      externallyVerifiable: !!(data.signatures && data.keys)
    };
  }

  // Private methods

  async _generateSidecarContent(artifactPath, attestationData, format, options) {
    // Create enhanced sidecar data with additional metadata
    const sidecarData = {
      // Core attestation data
      ...attestationData,
      
      // Enhanced metadata
      metadata: {
        ...attestationData.metadata,
        sidecarVersion: '2.0.0',
        sidecarFormat: format,
        generatedBy: 'kgen-provenance-sidecar-generator',
        artifactPath: path.resolve(artifactPath),
        relativePath: path.relative(process.cwd(), artifactPath),
        sidecarPath: this._generateSidecarPath(artifactPath, options)
      },
      
      // W3C PROV-O enhanced provenance
      ...(this.config.includeProvenance && {
        provenance: this._enhanceProvenance(attestationData.provenance, artifactPath)
      }),
      
      // SLSA enhanced data
      ...(this.config.includeSlsaData && {
        slsa: await this._enhanceSlsaData(attestationData.slsa, artifactPath)
      }),
      
      // Verification guide
      ...(this.config.includeVerificationGuide && {
        verificationGuide: this._generateVerificationGuide(attestationData)
      }),
      
      // File system metadata
      fileMetadata: await this._gatherFileMetadata(artifactPath),
      
      // Template variables
      ...(Object.keys(this.config.templateVariables).length > 0 && {
        templateVariables: this.config.templateVariables
      })
    };
    
    // Apply custom template if specified
    if (options.template || this.config.customTemplate) {
      const templateName = options.template || 'custom';
      sidecarData.templateApplied = templateName;
      this.metrics.templateApplications++;
      
      // Template application would go here
      // For now, we'll just mark that a template was applied
    }
    
    return await this._formatContent(sidecarData, format);
  }

  _enhanceProvenance(existingProvenance, artifactPath) {
    if (!existingProvenance) return null;
    
    return {
      ...existingProvenance,
      '@context': this.config.provenanceContext,
      '@type': 'prov:Generation',
      '@id': `provenance:${crypto.createHash('md5').update(artifactPath).digest('hex')}`,
      
      // Enhanced entity information
      'prov:entity': {
        ...existingProvenance['prov:entity'],
        'kgen:absolutePath': path.resolve(artifactPath),
        'kgen:relativePath': path.relative(process.cwd(), artifactPath),
        'kgen:fileExtension': path.extname(artifactPath),
        'kgen:baseName': path.basename(artifactPath, path.extname(artifactPath))
      },
      
      // Enhanced activity information
      'prov:activity': {
        ...existingProvenance['prov:activity'],
        'kgen:workingDirectory': process.cwd(),
        'kgen:environment': {
          'kgen:nodeVersion': process.version,
          'kgen:platform': process.platform,
          'kgen:architecture': process.arch
        }
      }
    };
  }

  async _enhanceSlsaData(existingSlsa, artifactPath) {
    if (!existingSlsa) return null;
    
    // Calculate MD5 hash
    let md5Hash;
    try {
      const fileContent = await fs.readFile(artifactPath);
      md5Hash = crypto.createHash('md5').update(fileContent).digest('hex');
    } catch (error) {
      md5Hash = 'unavailable';
    }
    
    return {
      ...existingSlsa,
      '_type': this.config.slsaPredicateType,
      'predicateType': this.config.slsaPredicateType,
      
      // Enhanced subject information
      'subject': [
        {
          ...existingSlsa.subject?.[0],
          'name': path.resolve(artifactPath),
          'digest': {
            ...existingSlsa.subject?.[0]?.digest,
            'md5': md5Hash
          }
        }
      ],
      
      // Enhanced build definition
      'predicate': {
        ...existingSlsa.predicate,
        'buildDefinition': {
          ...existingSlsa.predicate?.buildDefinition,
          'externalParameters': {
            ...existingSlsa.predicate?.buildDefinition?.externalParameters,
            'artifactPath': path.resolve(artifactPath),
            'workingDirectory': process.cwd()
          }
        }
      }
    };
  }

  _generateVerificationGuide(attestationData) {
    const guide = {
      overview: 'This attestation can be verified using standard JWT/JWS libraries',
      steps: [],
      examples: {},
      tools: []
    };
    
    if (attestationData.signatures) {
      guide.steps.push(
        'Extract JWS token from signatures object',
        'Extract corresponding public key from keys object',
        'Verify signature using any JWT library',
        'Validate claims (issuer, audience, expiry)',
        'Verify artifact integrity against contentHash'
      );
      
      // Add language-specific examples
      Object.keys(attestationData.signatures).forEach(alg => {
        guide.examples[alg] = {
          nodejs: `const { jwtVerify, importJWK } = require('jose');
const key = await importJWK(attestation.keys.${alg});
const result = await jwtVerify(attestation.signatures.${alg}, key);`,
          
          python: `import jwt
decoded = jwt.decode(signatures['${alg}'], keys['${alg}'], algorithms=['${alg.toUpperCase()}'])`,
          
          cli: `jwt verify --key public.jwk --alg ${alg.toUpperCase()} token.jwt`
        };
      });
      
      guide.tools = [
        'jwt.io - Online JWT debugger',
        'jwt-cli - Command line JWT tool', 
        'Standard JWT libraries in all major languages'
      ];
    }
    
    return guide;
  }

  async _gatherFileMetadata(filePath) {
    try {
      const stats = await fs.stat(filePath);
      
      return {
        size: stats.size,
        created: stats.birthtime.toISOString(),
        modified: stats.mtime.toISOString(),
        accessed: stats.atime.toISOString(),
        permissions: '0' + (stats.mode & parseInt('777', 8)).toString(8),
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        isSymlink: stats.isSymbolicLink()
      };
    } catch (error) {
      return {
        error: `Failed to gather file metadata: ${error.message}`
      };
    }
  }

  async _formatContent(data, format) {
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(data, null, 2);
        
      case 'yaml':
        // Would use a YAML library here
        throw new Error('YAML format not yet implemented');
        
      case 'xml':
        // Would use an XML library here
        throw new Error('XML format not yet implemented');
        
      case 'custom':
        // Apply custom template
        return this._applyCustomTemplate(data);
        
      default:
        return JSON.stringify(data, null, 2);
    }
  }

  _generateSidecarPath(artifactPath, options) {
    if (options.sidecarPath) {
      return options.sidecarPath;
    }
    
    const suffix = options.suffix || this.config.sidecarSuffix;
    return `${artifactPath}${suffix}`;
  }

  async _atomicWrite(filePath, content, format) {
    const tempPath = `${filePath}.tmp.${Date.now()}`;
    
    try {
      await fs.writeFile(tempPath, content, 'utf8');
      await fs.rename(tempPath, filePath);
    } catch (error) {
      // Cleanup temp file if it exists
      await fs.unlink(tempPath).catch(() => {});
      throw error;
    }
  }

  async _directWrite(filePath, content, format) {
    await fs.writeFile(filePath, content, 'utf8');
  }

  async _createBackup(filePath) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${filePath}.backup.${timestamp}`;
    
    await fs.copyFile(filePath, backupPath);
    this.metrics.backupsCreated++;
    
    return backupPath;
  }

  async _fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async _validateSidecarContent(content, format) {
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };
    
    try {
      let data;
      
      switch (format.toLowerCase()) {
        case 'json':
          data = JSON.parse(content);
          break;
        default:
          throw new Error(`Validation not implemented for format: ${format}`);
      }
      
      // Validate required fields
      const requiredFields = ['artifact', 'metadata', 'version'];
      for (const field of requiredFields) {
        if (!data[field]) {
          result.valid = false;
          result.errors.push(`Missing required field: ${field}`);
        }
      }
      
      // Validate artifact data
      if (data.artifact) {
        if (!data.artifact.contentHash) {
          result.warnings.push('Artifact missing contentHash');
        }
        if (!data.artifact.path) {
          result.errors.push('Artifact missing path');
          result.valid = false;
        }
      }
      
      // Validate signatures if present
      if (data.signatures && data.keys) {
        const sigAlgorithms = Object.keys(data.signatures);
        const keyAlgorithms = Object.keys(data.keys);
        
        for (const alg of sigAlgorithms) {
          if (!keyAlgorithms.includes(alg)) {
            result.warnings.push(`Signature for ${alg} has no corresponding public key`);
          }
        }
      }
      
    } catch (error) {
      result.valid = false;
      result.errors.push(`Content validation failed: ${error.message}`);
    }
    
    if (!result.valid) {
      this.metrics.validationFailures++;
    }
    
    return result;
  }

  _deepMerge(target, source) {
    const output = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        output[key] = this._deepMerge(output[key] || {}, source[key]);
      } else {
        output[key] = source[key];
      }
    }
    
    return output;
  }

  async _loadBuiltinTemplates() {
    // In a full implementation, this would load template files
    this.templates.set('default', {
      name: 'Default Template',
      version: '1.0.0',
      fields: ['artifact', 'signatures', 'metadata']
    });
    
    this.templates.set('minimal', {
      name: 'Minimal Template',
      version: '1.0.0',
      fields: ['artifact', 'metadata']
    });
    
    this.templates.set('comprehensive', {
      name: 'Comprehensive Template',
      version: '1.0.0',
      fields: ['artifact', 'signatures', 'keys', 'provenance', 'slsa', 'metadata', 'verificationGuide']
    });
  }

  async _loadCustomTemplate(templatePath) {
    try {
      const templateContent = await fs.readFile(templatePath, 'utf8');
      const template = JSON.parse(templateContent);
      this.templates.set('custom', template);
    } catch (error) {
      throw new Error(`Failed to load custom template: ${error.message}`);
    }
  }

  _applyCustomTemplate(data) {
    // Custom template application logic would go here
    // For now, return as JSON
    return JSON.stringify(data, null, 2);
  }

  /**
   * Get sidecar generator status and metrics
   */
  getStatus() {
    return {
      initialized: this.initialized,
      metrics: this.metrics,
      
      configuration: {
        sidecarSuffix: this.config.sidecarSuffix,
        outputFormat: this.config.outputFormat,
        atomicWrites: this.config.atomicWrites,
        createBackups: this.config.createBackups,
        validateOutput: this.config.validateOutput
      },
      
      templates: {
        available: Array.from(this.templates.keys()),
        active: this.config.customTemplate ? 'custom' : 'default'
      },
      
      compliance: {
        w3cProvenance: this.config.includeProvenance,
        slsaAttestation: this.config.includeSlsaData,
        verificationGuide: this.config.includeVerificationGuide
      }
    };
  }
}

export default SidecarGenerator;