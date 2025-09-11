/**
 * Attestation Generator - Creates .attest.json sidecar files for artifacts
 * 
 * Generates comprehensive attestation documents that provide cryptographic
 * proof of artifact generation, including all metadata needed for auditability.
 */

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import consola from 'consola';
import { v4 as uuidv4 } from 'uuid';

export class AttestationGenerator {
  constructor(config = {}) {
    this.config = {
      attestationVersion: config.attestationVersion || '1.0',
      includeFileContent: config.includeFileContent || false,
      includeEnvironment: config.includeEnvironment !== false,
      includeSystemInfo: config.includeSystemInfo !== false,
      hashAlgorithm: config.hashAlgorithm || 'sha256',
      timestampPrecision: config.timestampPrecision || 'milliseconds',
      ...config
    };
    
    this.logger = consola.withTag('attestation-generator');
  }

  /**
   * Generate comprehensive attestation for an artifact
   * @param {Object} context - Operation context
   * @param {Object} artifact - Artifact information
   * @returns {Promise<Object>} Complete attestation document
   */
  async generateAttestation(context, artifact) {
    try {
      this.logger.debug(`Generating attestation for artifact: ${artifact.path}`);
      
      // Core attestation structure
      const attestation = {
        // Schema and versioning
        '$schema': 'https://kgen.enterprise/schemas/attestation/v1.0.json',
        version: this.config.attestationVersion,
        
        // Unique identifiers
        attestationId: uuidv4(),
        artifactId: artifact.id || this._generateArtifactId(artifact.path),
        
        // Artifact metadata
        artifact: await this._generateArtifactMetadata(artifact),
        
        // Generation context
        generation: await this._generateGenerationContext(context),
        
        // Provenance tracking
        provenance: await this._generateProvenanceMetadata(context),
        
        // System context
        system: await this._generateSystemContext(),
        
        // Integrity verification
        integrity: await this._generateIntegrityMetadata(artifact, context),
        
        // Timestamps
        timestamps: {
          generated: new Date().toISOString(),
          artifactCreated: artifact.createdAt?.toISOString() || new Date().toISOString(),
          operationStarted: context.startTime.toISOString(),
          operationCompleted: context.endTime.toISOString()
        },
        
        // Compliance and validation
        compliance: await this._generateComplianceMetadata(context),
        validation: context.validationResults || null
      };
      
      // Add optional content hash if enabled
      if (this.config.includeFileContent && await this._fileExists(artifact.path)) {
        attestation.content = await this._generateContentMetadata(artifact.path);
      }
      
      // Add signature placeholder (will be filled by crypto manager)
      attestation.signature = null;
      
      return attestation;
      
    } catch (error) {
      this.logger.error(`Failed to generate attestation for ${artifact.path}:`, error);
      throw error;
    }
  }

  /**
   * Generate artifact metadata section
   * @param {Object} artifact - Artifact information
   * @returns {Promise<Object>} Artifact metadata
   */
  async _generateArtifactMetadata(artifact) {
    const metadata = {
      path: artifact.path,
      name: path.basename(artifact.path),
      directory: path.dirname(artifact.path),
      extension: path.extname(artifact.path),
      type: artifact.type || this._inferArtifactType(artifact.path),
      encoding: artifact.encoding || 'utf8',
      mimeType: artifact.mimeType || this._inferMimeType(artifact.path)
    };
    
    // Add file system metadata if file exists
    if (await this._fileExists(artifact.path)) {
      try {
        const stats = await fs.stat(artifact.path);
        metadata.size = stats.size;
        metadata.created = stats.birthtime.toISOString();
        metadata.modified = stats.mtime.toISOString();
        metadata.permissions = this._formatPermissions(stats.mode);
        
        // Calculate file hash
        metadata.hash = await this._calculateFileHash(artifact.path);
      } catch (error) {
        this.logger.warn(`Could not get file stats for ${artifact.path}:`, error);
      }
    } else {
      // Use provided metadata for non-existent files
      metadata.size = artifact.size || 0;
      metadata.hash = artifact.hash || null;
    }
    
    return metadata;
  }

  /**
   * Generate generation context metadata
   * @param {Object} context - Operation context
   * @returns {Promise<Object>} Generation context
   */
  async _generateGenerationContext(context) {
    return {
      operationId: context.operationId,
      operationType: context.type,
      engine: {
        name: 'kgen',
        version: context.engineVersion || process.env.KGEN_VERSION || '1.0.0',
        mode: context.mode || 'production'
      },
      template: context.templateId ? {
        id: context.templateId,
        version: context.templateVersion,
        path: context.templatePath
      } : null,
      rules: context.ruleIds ? context.ruleIds.map(ruleId => ({
        id: ruleId,
        type: context.ruleTypes?.[ruleId] || 'unknown'
      })) : [],
      configuration: context.configuration || {},
      parameters: context.parameters || {},
      agent: {
        id: context.agent.id,
        type: context.agent.type,
        name: context.agent.name
      }
    };
  }

  /**
   * Generate provenance metadata section
   * @param {Object} context - Operation context
   * @returns {Promise<Object>} Provenance metadata
   */
  async _generateProvenanceMetadata(context) {
    return {
      graphHash: context.outputGraphHash || context.inputGraphHash,
      integrityHash: context.integrityHash,
      chainIndex: context.chainIndex || null,
      
      sources: (context.sources || []).map(source => ({
        id: source.id,
        path: source.path,
        hash: source.hash,
        type: source.type,
        role: source.role || 'input'
      })),
      
      derivation: {
        method: context.derivationMethod || 'generation',
        transformations: context.transformations || [],
        lineage: context.lineage || []
      },
      
      dependencies: {
        templates: context.templateDependencies || [],
        rules: context.ruleDependencies || [],
        data: context.dataDependencies || [],
        external: context.externalDependencies || []
      }
    };
  }

  /**
   * Generate system context metadata
   * @returns {Promise<Object>} System context
   */
  async _generateSystemContext() {
    if (!this.config.includeSystemInfo) {
      return null;
    }
    
    const systemInfo = {
      platform: process.platform,
      architecture: process.arch,
      nodeVersion: process.version,
      hostname: require('os').hostname(),
      username: require('os').userInfo().username,
      
      environment: this.config.includeEnvironment ? {
        NODE_ENV: process.env.NODE_ENV,
        KGEN_ENV: process.env.KGEN_ENV,
        CI: process.env.CI,
        BUILD_ID: process.env.BUILD_ID
      } : null,
      
      memory: {
        total: require('os').totalmem(),
        free: require('os').freemem(),
        used: process.memoryUsage()
      },
      
      cpu: {
        count: require('os').cpus().length,
        model: require('os').cpus()[0]?.model
      }
    };
    
    return systemInfo;
  }

  /**
   * Generate integrity metadata section
   * @param {Object} artifact - Artifact information
   * @param {Object} context - Operation context
   * @returns {Promise<Object>} Integrity metadata
   */
  async _generateIntegrityMetadata(artifact, context) {
    const integrity = {
      algorithm: this.config.hashAlgorithm,
      artifactHash: artifact.hash || await this._calculateFileHash(artifact.path),
      contextHash: await this._calculateContextHash(context),
      chainVerification: {
        enabled: context.enableChainVerification !== false,
        previousHash: context.previousHash || null,
        nextHash: null // Will be filled when next operation occurs
      }
    };
    
    // Add Merkle tree information if available
    if (context.merkleRoot) {
      integrity.merkle = {
        root: context.merkleRoot,
        proof: context.merkleProof,
        position: context.merklePosition
      };
    }
    
    return integrity;
  }

  /**
   * Generate compliance metadata section
   * @param {Object} context - Operation context
   * @returns {Promise<Object>} Compliance metadata
   */
  async _generateComplianceMetadata(context) {
    return {
      framework: context.complianceFramework || 'enterprise',
      standards: context.complianceStandards || ['ISO-27001', 'SOC-2'],
      
      dataClassification: {
        level: context.dataClassification || 'internal',
        categories: context.dataCategories || [],
        restrictions: context.dataRestrictions || []
      },
      
      retention: {
        period: context.retentionPeriod || '7years',
        policy: context.retentionPolicy || 'standard',
        deleteAfter: context.deleteAfter ? new Date(context.deleteAfter).toISOString() : null
      },
      
      access: {
        permissions: context.accessPermissions || ['read'],
        restrictions: context.accessRestrictions || [],
        auditRequired: context.auditRequired !== false
      },
      
      regulatory: {
        frameworks: context.regulatoryFrameworks || [],
        requirements: context.regulatoryRequirements || [],
        exemptions: context.regulatoryExemptions || []
      }
    };
  }

  /**
   * Generate content metadata for file
   * @param {string} filePath - Path to file
   * @returns {Promise<Object>} Content metadata
   */
  async _generateContentMetadata(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      
      return {
        hash: crypto.createHash(this.config.hashAlgorithm).update(content).digest('hex'),
        lines: content.split('\n').length,
        characters: content.length,
        encoding: 'utf8',
        preview: content.length > 1000 ? content.substring(0, 1000) + '...' : content,
        analysis: {
          isEmpty: content.trim().length === 0,
          isBinary: this._isBinaryContent(content),
          hasTemplateMarkers: this._hasTemplateMarkers(content),
          language: this._detectLanguage(filePath, content)
        }
      };
    } catch (error) {
      this.logger.warn(`Could not read content for ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Write attestation as sidecar file
   * @param {string} artifactPath - Path to artifact
   * @param {Object} attestation - Attestation document
   * @returns {Promise<string>} Path to written attestation file
   */
  async writeAttestationSidecar(artifactPath, attestation) {
    try {
      const attestationPath = `${artifactPath}.attest.json`;
      const attestationContent = JSON.stringify(attestation, null, 2);
      
      // Ensure directory exists
      const dir = path.dirname(attestationPath);
      await fs.mkdir(dir, { recursive: true });
      
      // Write attestation file
      await fs.writeFile(attestationPath, attestationContent, 'utf8');
      
      this.logger.debug(`Wrote attestation sidecar: ${attestationPath}`);
      
      return attestationPath;
      
    } catch (error) {
      this.logger.error(`Failed to write attestation sidecar for ${artifactPath}:`, error);
      throw error;
    }
  }

  /**
   * Validate attestation document
   * @param {Object} attestation - Attestation to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateAttestation(attestation) {
    const validation = {
      valid: true,
      errors: [],
      warnings: []
    };
    
    // Check required fields
    const requiredFields = [
      'attestationId', 'artifactId', 'artifact', 'generation',
      'provenance', 'integrity', 'timestamps'
    ];
    
    for (const field of requiredFields) {
      if (!attestation[field]) {
        validation.errors.push(`Missing required field: ${field}`);
        validation.valid = false;
      }
    }
    
    // Validate artifact hash if file exists
    if (attestation.artifact?.path && attestation.artifact?.hash) {
      try {
        const currentHash = await this._calculateFileHash(attestation.artifact.path);
        if (currentHash !== attestation.artifact.hash) {
          validation.errors.push(`Artifact hash mismatch: expected ${attestation.artifact.hash}, got ${currentHash}`);
          validation.valid = false;
        }
      } catch (error) {
        validation.warnings.push(`Could not verify artifact hash: ${error.message}`);
      }
    }
    
    // Validate timestamps
    if (attestation.timestamps) {
      const timestamps = attestation.timestamps;
      if (new Date(timestamps.operationCompleted) < new Date(timestamps.operationStarted)) {
        validation.errors.push('Operation completed timestamp is before started timestamp');
        validation.valid = false;
      }
    }
    
    // Validate schema version
    if (attestation.version && attestation.version !== this.config.attestationVersion) {
      validation.warnings.push(`Attestation version mismatch: expected ${this.config.attestationVersion}, got ${attestation.version}`);
    }
    
    return validation;
  }

  // Private utility methods

  async _fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async _calculateFileHash(filePath) {
    try {
      const content = await fs.readFile(filePath);
      return crypto.createHash(this.config.hashAlgorithm).update(content).digest('hex');
    } catch (error) {
      this.logger.warn(`Could not calculate hash for ${filePath}:`, error);
      return null;
    }
  }

  async _calculateContextHash(context) {
    const contextData = {
      operationId: context.operationId,
      type: context.type,
      templateId: context.templateId,
      ruleIds: context.ruleIds,
      agent: context.agent.id,
      configuration: context.configuration
    };
    
    const contextString = JSON.stringify(contextData, Object.keys(contextData).sort());
    return crypto.createHash(this.config.hashAlgorithm).update(contextString).digest('hex');
  }

  _generateArtifactId(filePath) {
    const normalized = path.normalize(filePath).replace(/\\/g, '/');
    return crypto.createHash('md5').update(normalized).digest('hex');
  }

  _inferArtifactType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const typeMap = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.h': 'header',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.xml': 'xml',
      '.html': 'html',
      '.css': 'css',
      '.md': 'markdown',
      '.txt': 'text',
      '.sql': 'sql',
      '.sh': 'shell',
      '.bat': 'batch'
    };
    
    return typeMap[ext] || 'unknown';
  }

  _inferMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap = {
      '.js': 'application/javascript',
      '.ts': 'application/typescript',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.html': 'text/html',
      '.css': 'text/css',
      '.md': 'text/markdown',
      '.txt': 'text/plain',
      '.yaml': 'application/yaml',
      '.yml': 'application/yaml'
    };
    
    return mimeMap[ext] || 'application/octet-stream';
  }

  _formatPermissions(mode) {
    return '0' + (mode & parseInt('777', 8)).toString(8);
  }

  _isBinaryContent(content) {
    // Simple binary detection
    for (let i = 0; i < Math.min(1000, content.length); i++) {
      const charCode = content.charCodeAt(i);
      if (charCode === 0 || (charCode < 32 && charCode !== 9 && charCode !== 10 && charCode !== 13)) {
        return true;
      }
    }
    return false;
  }

  _hasTemplateMarkers(content) {
    // Check for common template markers
    const markers = [
      /\{\{.*?\}\}/, // Handlebars/Mustache
      /\{%.*?%\}/, // Jinja2
      /<%.*?%>/, // EJS
      /<\?.*?\?>/, // PHP
      /\$\{.*?\}/ // JavaScript template literals
    ];
    
    return markers.some(marker => marker.test(content));
  }

  _detectLanguage(filePath, content) {
    const ext = path.extname(filePath).toLowerCase();
    
    // File extension based detection
    const extMap = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.rb': 'ruby',
      '.php': 'php',
      '.go': 'go',
      '.rs': 'rust',
      '.kt': 'kotlin',
      '.swift': 'swift'
    };
    
    if (extMap[ext]) {
      return extMap[ext];
    }
    
    // Content-based detection for common patterns
    if (content.includes('#!/usr/bin/env python') || content.includes('def ') || content.includes('import ')) {
      return 'python';
    }
    
    if (content.includes('function ') || content.includes('const ') || content.includes('let ')) {
      return 'javascript';
    }
    
    if (content.includes('class ') && content.includes('public ')) {
      return 'java';
    }
    
    return 'unknown';
  }
}

export default AttestationGenerator;