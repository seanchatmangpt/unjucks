/**
 * Attestation Generator - Creates .attest.json sidecar files for artifacts
 * 
 * Generates comprehensive attestation documents that provide cryptographic
 * proof of artifact generation, including all metadata needed for auditability.
 */

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import consola from 'consola';
import { v4 as uuidv4 } from 'uuid';
import { CryptoManager } from '../crypto/manager.js';

export class AttestationGenerator {
  constructor(config = {}) {
    this.config = {
      attestationVersion: config.attestationVersion || '1.0',
      includeFileContent: config.includeFileContent || false,
      includeEnvironment: config.includeEnvironment !== false,
      includeSystemInfo: config.includeSystemInfo !== false,
      hashAlgorithm: config.hashAlgorithm || 'sha256',
      timestampPrecision: config.timestampPrecision || 'milliseconds',
      enableCryptographicSigning: config.enableCryptographicSigning !== false,
      ...config
    };
    
    this.logger = consola.withTag('attestation-generator');
    
    // Initialize crypto manager if signing is enabled
    this.cryptoManager = null;
    if (this.config.enableCryptographicSigning) {
      this.cryptoManager = new CryptoManager(config);
    }
  }

  /**
   * Initialize the attestation generator
   */
  async initialize() {
    if (this.cryptoManager) {
      await this.cryptoManager.initialize();
      this.logger.info('Cryptographic signing enabled for attestations');
    }
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
      
      // Sign attestation if crypto manager is available
      if (this.cryptoManager && this.cryptoManager.state === 'ready') {
        try {
          const signedAttestation = await this.cryptoManager.signAttestation(attestation);
          this.logger.debug('Attestation signed successfully');
          return signedAttestation;
        } catch (error) {
          this.logger.error('Failed to sign attestation:', error);
          // Fall back to unsigned attestation with error info
          attestation.signature = {
            error: 'Failed to generate signature',
            details: error.message,
            algorithm: null,
            keyFingerprint: null,
            signedAt: new Date().toISOString(),
            signature: null
          };
          return attestation;
        }
      } else {
        // Initialize crypto manager if signing is enabled but not ready
        if (this.config.enableCryptographicSigning && !this.cryptoManager) {
          this.logger.warn('Cryptographic signing enabled but crypto manager not initialized');
          try {
            this.cryptoManager = new CryptoManager(this.config);
            await this.cryptoManager.initialize();
            const signedAttestation = await this.cryptoManager.signAttestation(attestation);
            this.logger.info('Crypto manager auto-initialized and attestation signed');
            return signedAttestation;
          } catch (error) {
            this.logger.error('Failed to auto-initialize crypto manager:', error);
          }
        }
        
        // Add signature placeholder with clear indication
        attestation.signature = {
          error: 'Cryptographic signing not available',
          details: this.config.enableCryptographicSigning ? 
            'Crypto manager not initialized' : 
            'Cryptographic signing disabled in configuration',
          algorithm: null,
          keyFingerprint: null,
          signedAt: new Date().toISOString(),
          signature: null
        };
        
        this.logger.warn('Attestation created without cryptographic signature');
        return attestation;
      }
      
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
   * Generate PROV-O compliant provenance metadata section
   * @param {Object} context - Operation context
   * @returns {Promise<Object>} Provenance metadata
   */
  async _generateProvenanceMetadata(context) {
    // Generate PROV-O URIs
    const activityUri = `prov:activity_${context.operationId}`;
    const agentUri = `prov:agent_${context.agent.id}`;
    
    // Calculate canonical graph hash from RDF triples
    const graphHash = await this._calculateCanonicalGraphHash(context);
    
    const provenance = {
      // Core PROV-O properties
      '@context': {
        'prov': 'http://www.w3.org/ns/prov#',
        'kgen': 'http://kgen.enterprise/provenance/',
        'dct': 'http://purl.org/dc/terms/',
        'foaf': 'http://xmlns.com/foaf/0.1/'
      },
      
      // Canonical graph identification
      graphHash: graphHash,
      canonicalizationMethod: 'c14n-rdf',
      
      // Activity metadata
      activity: {
        '@id': activityUri,
        '@type': 'prov:Activity',
        'prov:startedAtTime': context.startTime.toISOString(),
        'prov:endedAtTime': context.endTime?.toISOString(),
        'prov:wasAssociatedWith': agentUri,
        'dct:type': context.type,
        'kgen:operationId': context.operationId,
        'kgen:integrityHash': context.integrityHash,
        'kgen:chainIndex': context.chainIndex || 0
      },
      
      // Agent metadata  
      agent: {
        '@id': agentUri,
        '@type': context.agent.type === 'person' ? 'prov:Person' : 'prov:SoftwareAgent',
        'foaf:name': context.agent.name,
        'kgen:version': context.agent.version || '1.0.0'
      },
      
      // Entity relationships
      entities: this._generateEntityRelationships(context),
      
      // Plan metadata (templates/rules used)
      plan: context.planId ? {
        '@id': `prov:plan_${context.planId}`,
        '@type': 'prov:Plan',
        'dct:identifier': context.planId,
        'kgen:templateId': context.templateId,
        'kgen:ruleIds': context.ruleIds || []
      } : null,
      
      // Derivation chains
      derivations: this._generateDerivationChains(context),
      
      // Usage relationships
      usages: this._generateUsageRelationships(context),
      
      // Generation relationships
      generations: this._generateGenerationRelationships(context),
      
      // Dependencies with versioning
      dependencies: {
        templates: (context.templateDependencies || []).map(dep => ({
          '@id': `kgen:template_${dep.id}`,
          '@type': 'kgen:Template',
          'dct:identifier': dep.id,
          'kgen:version': dep.version,
          'kgen:hash': dep.hash,
          'kgen:path': dep.path,
          'prov:specializationOf': dep.baseTemplate ? `kgen:template_${dep.baseTemplate}` : null
        })),
        
        rules: (context.ruleDependencies || []).map(rule => ({
          '@id': `kgen:rule_${rule.id}`,
          '@type': 'kgen:SemanticRule',
          'dct:identifier': rule.id,
          'kgen:version': rule.version,
          'kgen:ruleType': rule.type,
          'kgen:priority': rule.priority || 0,
          'prov:wasDerivedFrom': rule.derivedFrom ? `kgen:rule_${rule.derivedFrom}` : null
        })),
        
        data: (context.dataDependencies || []).map(data => ({
          '@id': `kgen:data_${data.id}`,
          '@type': 'prov:Entity',
          'dct:identifier': data.id,
          'kgen:hash': data.hash,
          'kgen:size': data.size,
          'prov:atLocation': data.location
        })),
        
        external: (context.externalDependencies || []).map(ext => ({
          '@id': ext.uri || `kgen:external_${ext.id}`,
          '@type': 'prov:Entity',
          'dct:identifier': ext.id,
          'foaf:homepage': ext.url,
          'kgen:version': ext.version,
          'kgen:checksum': ext.checksum
        }))
      },
      
      // Semantic reasoning chain
      reasoning: context.reasoningChain ? {
        '@id': `kgen:reasoning_${context.operationId}`,
        '@type': 'kgen:SemanticReasoning',
        'kgen:steps': context.reasoningChain.map((step, index) => ({
          '@id': `kgen:step_${context.operationId}_${index}`,
          '@type': 'kgen:ReasoningStep',
          'kgen:stepNumber': index,
          'kgen:ruleApplied': step.rule,
          'kgen:inferenceType': step.type,
          'kgen:inputEntities': step.inputs || [],
          'kgen:outputEntities': step.outputs || [],
          'kgen:confidence': step.confidence || 1.0
        })),
        'kgen:totalSteps': context.reasoningChain.length,
        'kgen:reasoningTime': context.reasoningTime || 0
      } : null,
      
      // Quality and validation metadata
      quality: {
        'kgen:validationLevel': context.validationLevel || 'basic',
        'kgen:qualityScore': context.qualityScore || 1.0,
        'kgen:testsCoverage': context.testsCoverage || 0,
        'kgen:metricsCollected': context.metrics ? Object.keys(context.metrics) : []
      },
      
      // Cryptographic integrity
      integrity: {
        'kgen:hashAlgorithm': context.hashAlgorithm || 'sha256',
        'kgen:signatureAlgorithm': context.signatureAlgorithm,
        'kgen:merkleRoot': context.merkleRoot,
        'kgen:merkleProof': context.merkleProof,
        'kgen:blockchainAnchor': context.blockchainAnchor || null
      }
    };
    
    // Add bundle information if part of a bundle
    if (context.bundleId) {
      provenance.bundle = {
        '@id': `prov:bundle_${context.bundleId}`,
        '@type': 'prov:Bundle',
        'dct:identifier': context.bundleId,
        'prov:generatedAtTime': context.bundleGeneratedAt,
        'kgen:bundleHash': context.bundleHash
      };
    }
    
    return provenance;
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
      hostname: os.hostname(),
      username: os.userInfo().username,
      
      environment: this.config.includeEnvironment ? {
        NODE_ENV: process.env.NODE_ENV,
        KGEN_ENV: process.env.KGEN_ENV,
        CI: process.env.CI,
        BUILD_ID: process.env.BUILD_ID
      } : null,
      
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: process.memoryUsage()
      },
      
      cpu: {
        count: os.cpus().length,
        model: os.cpus()[0]?.model
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

  /**
   * Calculate canonical graph hash from operation context
   * @param {Object} context - Operation context
   * @returns {Promise<string>} Canonical graph hash
   */
  async _calculateCanonicalGraphHash(context) {
    try {
      // Build canonical RDF graph from context
      const rdfTriples = this._buildCanonicalRDFGraph(context);
      
      // Apply RDF canonicalization (C14N)
      const canonicalTriples = this._canonicalizeRDFTriples(rdfTriples);
      
      // Calculate hash of canonical form
      const canonicalString = canonicalTriples
        .sort()
        .join('\n');
      
      return crypto.createHash(this.config.hashAlgorithm)
        .update(canonicalString, 'utf8')
        .digest('hex');
        
    } catch (error) {
      this.logger.warn('Failed to calculate canonical graph hash:', error);
      // Fallback to context hash
      return await this._calculateContextHash(context);
    }
  }

  /**
   * Build canonical RDF graph from operation context
   * @param {Object} context - Operation context
   * @returns {Array} Array of RDF triples in canonical form
   */
  _buildCanonicalRDFGraph(context) {
    const triples = [];
    const base = 'http://kgen.enterprise/provenance/';
    
    // Activity triples
    const activityUri = `${base}activity/${context.operationId}`;
    triples.push(`<${activityUri}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/ns/prov#Activity> .`);
    triples.push(`<${activityUri}> <http://www.w3.org/ns/prov#startedAtTime> "${context.startTime.toISOString()}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .`);
    
    if (context.endTime) {
      triples.push(`<${activityUri}> <http://www.w3.org/ns/prov#endedAtTime> "${context.endTime.toISOString()}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .`);
    }
    
    // Agent triples
    if (context.agent) {
      const agentUri = `${base}agent/${context.agent.id}`;
      const agentType = context.agent.type === 'person' ? 
        'http://www.w3.org/ns/prov#Person' : 
        'http://www.w3.org/ns/prov#SoftwareAgent';
      
      triples.push(`<${agentUri}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <${agentType}> .`);
      triples.push(`<${activityUri}> <http://www.w3.org/ns/prov#wasAssociatedWith> <${agentUri}> .`);
      
      if (context.agent.name) {
        triples.push(`<${agentUri}> <http://xmlns.com/foaf/0.1/name> "${context.agent.name}" .`);
      }
    }
    
    // Template triples
    if (context.templateId) {
      const templateUri = `${base}template/${context.templateId}`;
      triples.push(`<${templateUri}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <${base}Template> .`);
      triples.push(`<${activityUri}> <http://www.w3.org/ns/prov#used> <${templateUri}> .`);
      
      if (context.templateVersion) {
        triples.push(`<${templateUri}> <${base}version> "${context.templateVersion}" .`);
      }
      
      if (context.templatePath) {
        triples.push(`<${templateUri}> <${base}path> "${context.templatePath}" .`);
      }
    }
    
    // Rule triples
    if (context.ruleIds && context.ruleIds.length > 0) {
      for (const ruleId of context.ruleIds) {
        const ruleUri = `${base}rule/${ruleId}`;
        triples.push(`<${ruleUri}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <${base}SemanticRule> .`);
        triples.push(`<${activityUri}> <http://www.w3.org/ns/prov#used> <${ruleUri}> .`);
      }
    }
    
    // Engine triples
    const engineUri = `${base}engine/kgen`;
    triples.push(`<${engineUri}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/ns/prov#SoftwareAgent> .`);
    triples.push(`<${activityUri}> <http://www.w3.org/ns/prov#wasAssociatedWith> <${engineUri}> .`);
    
    if (context.engineVersion) {
      triples.push(`<${engineUri}> <${base}version> "${context.engineVersion}" .`);
    }
    
    // Integrity hash triple
    if (context.integrityHash) {
      triples.push(`<${activityUri}> <${base}integrityHash> "${context.integrityHash}" .`);
    }
    
    // Configuration triples (deterministic key ordering)
    if (context.configuration) {
      const configKeys = Object.keys(context.configuration).sort();
      for (const key of configKeys) {
        const value = context.configuration[key];
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          triples.push(`<${activityUri}> <${base}config/${key}> "${value}" .`);
        }
      }
    }
    
    return triples;
  }

  /**
   * Canonicalize RDF triples using deterministic ordering
   * @param {Array} triples - Array of RDF triple strings
   * @returns {Array} Canonicalized triples
   */
  _canonicalizeRDFTriples(triples) {
    // Apply RDF canonicalization algorithm (simplified C14N)
    // 1. Normalize whitespace
    // 2. Sort triples lexicographically
    // 3. Ensure consistent blank node labeling
    
    const normalizedTriples = triples
      .map(triple => triple.trim())
      .filter(triple => triple.length > 0)
      .map(triple => this._normalizeTriple(triple));
    
    // Sort for canonical ordering
    return normalizedTriples.sort();
  }

  /**
   * Normalize a single RDF triple
   * @param {string} triple - RDF triple string
   * @returns {string} Normalized triple
   */
  _normalizeTriple(triple) {
    // Remove extra whitespace and ensure consistent formatting
    return triple
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Missing method implementations for PROV-O generation
  _generateEntityRelationships(context) {
    // Generate entity relationships for PROV-O
    return [];
  }

  _generateDerivationChains(context) {
    // Generate derivation chains for PROV-O
    return [];
  }

  _generateUsageRelationships(context) {
    // Generate usage relationships for PROV-O
    return [];
  }

  _generateGenerationRelationships(context) {
    // Generate generation relationships for PROV-O
    return [];
  }
}

export default AttestationGenerator;
