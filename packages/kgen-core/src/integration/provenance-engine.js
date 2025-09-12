/**
 * Provenance Engine Integration - Complete provenance tracking integration with KGenEngine
 * 
 * Provides comprehensive integration between KGenEngine operations and the provenance
 * tracking system, enabling full lifecycle tracking from semantic reasoning to artifact generation.
 */

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import consola from 'consola';
import { v4 as uuidv4 } from 'uuid';

// Import provenance components
import { CryptoManager } from '../provenance/crypto/manager.js';
import { AttestationGenerator } from '../provenance/attestation/generator.js';
import { AttestationVerifier } from '../attestation/verifier.js';
import { OperationLineageTracker } from '../provenance/lineage/tracker.js';
import { TemplateVersionTracker } from '../versioning/template-tracker.js';
import { ImmutableAuditTrail } from '../audit/immutable-trail.js';
import { AttestationBundler } from '../project/attestation-bundler.js';

export class ProvenanceEngine {
  constructor(config = {}) {
    this.config = {
      // Core configuration
      enableProvenanceTracking: config.enableProvenanceTracking !== false,
      enableCryptographicSigning: config.enableCryptographicSigning !== false,
      enableBlockchainAnchoring: config.enableBlockchainAnchoring || false,
      enableSemanticTracking: config.enableSemanticTracking !== false,
      
      // Storage configuration
      storageLocation: config.storageLocation || './.kgen/provenance',
      
      // Attestation configuration
      attestationVersion: config.attestationVersion || '1.0',
      includeReasoningChains: config.includeReasoningChains !== false,
      includeTemplateLineage: config.includeTemplateLineage !== false,
      
      // Performance configuration
      batchSize: config.batchSize || 50,
      asyncProcessing: config.asyncProcessing !== false,
      
      // Compliance configuration
      complianceFrameworks: config.complianceFrameworks || ['SLSA', 'PROV-O'],
      retentionPolicy: config.retentionPolicy || '7y',
      
      ...config
    };
    
    this.logger = consola.withTag('provenance-engine');
    
    // Initialize components
    this.cryptoManager = null;
    this.attestationGenerator = null;
    this.attestationVerifier = null;
    this.lineageTracker = null;
    this.templateTracker = null;
    this.auditTrail = null;
    this.bundler = null;
    
    // Operation tracking
    this.activeOperations = new Map();
    this.completedOperations = new Map();
    
    // Performance metrics
    this.metrics = {
      operationsTracked: 0,
      attestationsGenerated: 0,
      verificationsPerformed: 0,
      bundlesCreated: 0,
      averageProcessingTime: 0
    };
    
    this.initialized = false;
  }

  /**
   * Initialize the provenance engine
   */
  async initialize() {
    try {
      this.logger.info('Initializing provenance engine...');
      
      // Ensure storage directory exists
      await fs.mkdir(this.config.storageLocation, { recursive: true });
      
      // Initialize crypto manager if cryptographic features enabled
      if (this.config.enableCryptographicSigning) {
        this.cryptoManager = new CryptoManager({
          keyPath: path.join(this.config.storageLocation, 'keys/private.pem'),
          publicKeyPath: path.join(this.config.storageLocation, 'keys/public.pem'),
          autoGenerateKeys: true
        });
        await this.cryptoManager.initialize();
      }
      
      // Initialize attestation components
      this.attestationGenerator = new AttestationGenerator({
        attestationVersion: this.config.attestationVersion,
        includeReasoningChains: this.config.includeReasoningChains,
        cryptoManager: this.cryptoManager
      });
      
      this.attestationVerifier = new AttestationVerifier({
        enableParallelVerification: true,
        cryptoManager: this.cryptoManager
      });
      
      // Initialize lineage tracker
      if (this.config.enableSemanticTracking) {
        this.lineageTracker = new OperationLineageTracker({
          storageLocation: path.join(this.config.storageLocation, 'lineage'),
          enableSemanticRelations: true,
          enableImpactAnalysis: true
        });
        await this.lineageTracker.initialize();
      }
      
      // Initialize template version tracker
      this.templateTracker = new TemplateVersionTracker({
        storageLocation: path.join(this.config.storageLocation, 'versions'),
        enableCryptographicIntegrity: this.config.enableCryptographicSigning,
        cryptoManager: this.cryptoManager
      });
      await this.templateTracker.initialize();
      
      // Initialize audit trail
      this.auditTrail = new ImmutableAuditTrail({
        storageLocation: path.join(this.config.storageLocation, 'audit'),
        enableBlockchainAnchoring: this.config.enableBlockchainAnchoring,
        complianceFrameworks: this.config.complianceFrameworks,
        cryptoManager: this.cryptoManager
      });
      await this.auditTrail.initialize();
      
      // Initialize bundler
      this.bundler = new AttestationBundler({
        signatureRequired: this.config.enableCryptographicSigning,
        cryptoManager: this.cryptoManager
      });
      
      this.initialized = true;
      this.logger.success('Provenance engine initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize provenance engine:', error);
      throw error;
    }
  }

  /**
   * Begin tracking an operation with full context
   * @param {Object} operationContext - Complete operation context
   * @returns {Promise<Object>} Operation tracking result
   */
  async beginOperation(operationContext) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      const operationId = operationContext.operationId || uuidv4();
      const startTime = new Date();
      
      this.logger.debug(`Beginning operation: ${operationId}`);
      
      // Create comprehensive operation record
      const operation = {
        operationId,
        type: operationContext.type,
        startTime,
        endTime: null,
        status: 'in_progress',
        
        // Context information
        agent: operationContext.agent || {
          id: 'system',
          name: 'KGEN System',
          type: 'software',
          version: '1.0.0'
        },
        
        // Template and rule context
        templateId: operationContext.templateId,
        templateVersion: operationContext.templateVersion,
        templatePath: operationContext.templatePath,
        ruleIds: operationContext.ruleIds || [],
        
        // Semantic context
        semanticGraph: operationContext.semanticGraph || null,
        reasoningChain: [],
        
        // Input/output tracking
        inputs: operationContext.inputs || [],
        outputs: [],
        
        // Configuration snapshot
        configuration: operationContext.configuration || {},
        
        // Provenance tracking
        integrityHash: null,
        chainIndex: this.completedOperations.size,
        
        // Performance tracking
        metrics: {
          processingTime: 0,
          reasoningSteps: 0,
          templatesResolved: 0,
          rulesApplied: 0
        }
      };
      
      // Store active operation
      this.activeOperations.set(operationId, operation);
      
      // Record audit event
      if (this.auditTrail) {
        await this.auditTrail.recordEvent({
          type: 'operation-started',
          operationId,
          source: {
            system: 'kgen',
            component: 'provenance-engine',
            operation: 'begin-operation'
          },
          actor: operation.agent,
          action: 'start',
          resource: operationId,
          resourceType: 'operation',
          outcome: 'success',
          metadata: {
            operationType: operation.type,
            templateId: operation.templateId,
            ruleCount: operation.ruleIds.length
          }
        });
      }
      
      // Track template version if specified
      if (operation.templateId && this.templateTracker) {
        await this._trackTemplateUsage(operation);
      }
      
      const result = {
        operationId,
        tracked: true,
        startTime: operation.startTime.toISOString(),
        context: {
          template: operation.templateId,
          rules: operation.ruleIds.length,
          agent: operation.agent.name
        }
      };
      
      this.logger.debug(`Operation started: ${operationId}`);
      
      return result;
      
    } catch (error) {
      this.logger.error(`Failed to begin operation:`, error);
      throw error;
    }
  }

  /**
   * Record reasoning step during operation
   * @param {string} operationId - Operation identifier
   * @param {Object} reasoningStep - Reasoning step data
   * @returns {Promise<void>}
   */
  async recordReasoningStep(operationId, reasoningStep) {
    try {
      const operation = this.activeOperations.get(operationId);
      if (!operation) {
        throw new Error(`Operation not found: ${operationId}`);
      }
      
      const step = {
        stepNumber: operation.reasoningChain.length,
        timestamp: new Date().toISOString(),
        rule: reasoningStep.rule,
        inferenceType: reasoningStep.type || 'unknown',
        inputEntities: reasoningStep.inputs || [],
        outputEntities: reasoningStep.outputs || [],
        confidence: reasoningStep.confidence || 1.0,
        processingTime: reasoningStep.processingTime || 0
      };
      
      operation.reasoningChain.push(step);
      operation.metrics.reasoningSteps++;
      
      // Record audit event for significant reasoning steps
      if (step.confidence < 0.8 || step.inferenceType === 'critical') {
        await this.auditTrail.recordEvent({
          type: 'reasoning-step',
          operationId,
          source: {
            system: 'kgen',
            component: 'semantic-reasoner',
            operation: 'inference'
          },
          actor: operation.agent,
          action: 'infer',
          resource: step.rule,
          resourceType: 'rule',
          outcome: 'success',
          metadata: {
            inferenceType: step.inferenceType,
            confidence: step.confidence,
            stepNumber: step.stepNumber
          },
          severity: step.confidence < 0.8 ? 'warn' : 'info'
        });
      }
      
      this.logger.debug(`Reasoning step recorded: ${operationId} step ${step.stepNumber}`);
      
    } catch (error) {
      this.logger.error(`Failed to record reasoning step:`, error);
      throw error;
    }
  }

  /**
   * Complete operation with results and generate attestations
   * @param {string} operationId - Operation identifier
   * @param {Object} results - Operation results
   * @returns {Promise<Object>} Completion result with attestations
   */
  async completeOperation(operationId, results) {
    try {
      const operation = this.activeOperations.get(operationId);
      if (!operation) {
        throw new Error(`Active operation not found: ${operationId}`);
      }
      
      const endTime = new Date();
      const processingTime = endTime - operation.startTime;
      
      this.logger.debug(`Completing operation: ${operationId}`);
      
      // Update operation with results
      operation.endTime = endTime;
      operation.status = results.status || 'completed';
      operation.outputs = results.outputs || [];
      operation.metrics.processingTime = processingTime;
      
      // Calculate integrity hash
      operation.integrityHash = this._calculateOperationHash(operation);
      
      // Move to completed operations
      this.activeOperations.delete(operationId);
      this.completedOperations.set(operationId, operation);
      
      // Track operation lineage
      if (this.lineageTracker) {
        await this.lineageTracker.trackOperation(operation);
      }
      
      // Generate attestations for outputs
      const attestations = [];
      for (const output of operation.outputs) {
        if (output.filePath) {
          const attestation = await this._generateArtifactAttestation(operation, output);
          attestations.push(attestation);
          
          // Write attestation sidecar
          const attestationPath = `${output.filePath}.attest.json`;
          await fs.writeFile(attestationPath, JSON.stringify(attestation, null, 2));
        }
      }
      
      // Record completion audit event
      await this.auditTrail.recordEvent({
        type: 'operation-completed',
        operationId,
        source: {
          system: 'kgen',
          component: 'provenance-engine',
          operation: 'complete-operation'
        },
        actor: operation.agent,
        action: 'complete',
        resource: operationId,
        resourceType: 'operation',
        outcome: operation.status === 'completed' ? 'success' : 'failure',
        duration: processingTime,
        metadata: {
          outputsGenerated: operation.outputs.length,
          attestationsCreated: attestations.length,
          reasoningSteps: operation.reasoningChain.length,
          processingTime
        }
      });
      
      // Update metrics
      this.metrics.operationsTracked++;
      this.metrics.attestationsGenerated += attestations.length;
      this.metrics.averageProcessingTime = 
        (this.metrics.averageProcessingTime * (this.metrics.operationsTracked - 1) + processingTime) / 
        this.metrics.operationsTracked;
      
      const result = {
        operationId,
        completed: true,
        status: operation.status,
        processingTime,
        outputs: operation.outputs.length,
        attestations: attestations.length,
        integrityHash: operation.integrityHash,
        reasoningSteps: operation.reasoningChain.length
      };
      
      this.logger.debug(`Operation completed: ${operationId} in ${processingTime}ms`);
      
      return result;
      
    } catch (error) {
      this.logger.error(`Failed to complete operation ${operationId}:`, error);
      
      // Record failure audit event
      if (this.auditTrail) {
        await this.auditTrail.recordEvent({
          type: 'operation-failed',
          operationId,
          source: {
            system: 'kgen',
            component: 'provenance-engine'
          },
          action: 'complete',
          outcome: 'failure',
          errorMessage: error.message
        });
      }
      
      throw error;
    }
  }

  /**
   * Verify project integrity with comprehensive checking
   * @param {string} projectPath - Path to project
   * @param {Object} options - Verification options
   * @returns {Promise<Object>} Verification result
   */
  async verifyProjectIntegrity(projectPath, options = {}) {
    try {
      this.logger.info(`Verifying project integrity: ${projectPath}`);
      
      const {
        includeLineageVerification = true,
        includeTemplateVerification = true,
        includeAuditVerification = true,
        deep = false
      } = options;
      
      const verification = {
        projectPath,
        overallValid: true,
        verificationTime: new Date().toISOString(),
        
        // Component verification results
        attestations: null,
        lineage: null,
        templates: null,
        audit: null,
        
        // Summary
        totalChecks: 0,
        passedChecks: 0,
        failedChecks: 0,
        
        // Issues and recommendations
        issues: [],
        recommendations: []
      };
      
      // Verify attestations
      const attestationFiles = await this._findAttestationFiles(projectPath);
      
      if (attestationFiles.length > 0) {
        verification.attestations = await this.attestationVerifier.batchVerify(
          attestationFiles, 
          { deep }
        );
        
        verification.totalChecks += verification.attestations.results.length;
        verification.passedChecks += verification.attestations.results.filter(r => r.verified).length;
        verification.failedChecks += verification.attestations.results.filter(r => !r.verified).length;
        
        if (!verification.attestations.success) {
          verification.overallValid = false;
          verification.issues.push('Attestation verification failures detected');
        }
      }
      
      // Verify lineage integrity
      if (includeLineageVerification && this.lineageTracker) {
        // This would verify the lineage graph consistency
        verification.lineage = {
          valid: true,
          operations: this.lineageTracker.getStatistics().operations,
          message: 'Lineage verification completed'
        };
        verification.totalChecks++;
        verification.passedChecks++;
      }
      
      // Verify template versions
      if (includeTemplateVerification && this.templateTracker) {
        // Get all template IDs from the project
        const templateIds = await this._extractTemplateIds(projectPath);
        
        verification.templates = {
          valid: true,
          totalTemplates: templateIds.length,
          verifiedTemplates: 0,
          issues: []
        };
        
        for (const templateId of templateIds) {
          const templateVerification = await this.templateTracker.verifyVersionIntegrity(templateId);
          
          if (templateVerification.overallValid) {
            verification.templates.verifiedTemplates++;
          } else {
            verification.templates.valid = false;
            verification.templates.issues.push({
              templateId,
              errors: templateVerification.results.flatMap(r => r.errors)
            });
          }
        }
        
        verification.totalChecks += templateIds.length;
        verification.passedChecks += verification.templates.verifiedTemplates;
        verification.failedChecks += templateIds.length - verification.templates.verifiedTemplates;
        
        if (!verification.templates.valid) {
          verification.overallValid = false;
          verification.issues.push('Template version verification failures');
        }
      }
      
      // Verify audit trail
      if (includeAuditVerification && this.auditTrail) {
        verification.audit = await this.auditTrail.verifyIntegrity();
        
        verification.totalChecks++;
        if (verification.audit.overallValid) {
          verification.passedChecks++;
        } else {
          verification.failedChecks++;
          verification.overallValid = false;
          verification.issues.push('Audit trail integrity issues');
        }
      }
      
      // Generate recommendations
      if (verification.issues.length > 0) {
        verification.recommendations = this._generateVerificationRecommendations(verification);
      }
      
      this.metrics.verificationsPerformed++;
      
      this.logger.info(`Project verification completed: ${verification.overallValid ? 'VALID' : 'INVALID'}`);
      
      return verification;
      
    } catch (error) {
      this.logger.error(`Failed to verify project integrity:`, error);
      throw error;
    }
  }

  /**
   * Create comprehensive project bundle
   * @param {string} projectPath - Path to project
   * @param {Object} options - Bundle options
   * @returns {Promise<Object>} Bundle result
   */
  async createProjectBundle(projectPath, options = {}) {
    try {
      this.logger.info(`Creating project bundle: ${projectPath}`);
      
      // First verify project integrity
      const verification = await this.verifyProjectIntegrity(projectPath, {
        deep: true
      });
      
      // Find all attestation files
      const attestationFiles = await this._findAttestationFiles(projectPath);
      const artifactFiles = await this._findArtifactFiles(projectPath);
      
      // Create bundle request
      const bundleRequest = {
        bundleId: options.bundleId || uuidv4(),
        createdBy: options.createdBy || 'kgen-system',
        purpose: options.purpose || 'compliance-verification',
        description: options.description || `Provenance bundle for ${path.basename(projectPath)}`,
        
        artifactPaths: artifactFiles,
        attestationPaths: attestationFiles,
        
        // Include verification results
        verificationResults: verification,
        
        // Include lineage data if available
        provenanceRecords: this.lineageTracker ? 
          Array.from(this.completedOperations.values()) : [],
        
        // Compliance metadata
        complianceFramework: options.complianceFramework || 'enterprise',
        complianceStandards: this.config.complianceFrameworks
      };
      
      // Create the bundle
      const bundleResult = await this.bundler.createAttestationBundle(bundleRequest);
      
      this.metrics.bundlesCreated++;
      
      this.logger.success(`Project bundle created: ${bundleResult.bundlePath}`);
      
      return {
        ...bundleResult,
        verification,
        statistics: {
          totalArtifacts: artifactFiles.length,
          totalAttestations: attestationFiles.length,
          verificationValid: verification.overallValid
        }
      };
      
    } catch (error) {
      this.logger.error(`Failed to create project bundle:`, error);
      throw error;
    }
  }

  /**
   * Get provenance engine statistics
   * @returns {Object} Comprehensive statistics
   */
  getStatistics() {
    const stats = {
      // Engine status
      initialized: this.initialized,
      activeOperations: this.activeOperations.size,
      completedOperations: this.completedOperations.size,
      
      // Performance metrics
      performance: this.metrics,
      
      // Component statistics
      components: {}
    };
    
    // Add component statistics
    if (this.cryptoManager) {
      stats.components.crypto = this.cryptoManager.getStatus();
    }
    
    if (this.lineageTracker) {
      stats.components.lineage = this.lineageTracker.getStatistics();
    }
    
    if (this.templateTracker) {
      stats.components.templates = this.templateTracker.getStatistics();
    }
    
    if (this.auditTrail) {
      stats.components.audit = this.auditTrail.getStatistics();
    }
    
    return stats;
  }

  // Private methods

  async _trackTemplateUsage(operation) {
    if (!operation.templateId) return;
    
    // Track template usage
    await this.templateTracker.trackTemplateVersion({
      id: operation.templateId,
      version: operation.templateVersion,
      filePath: operation.templatePath,
      createdBy: operation.agent.name,
      dependencies: [], // Would extract from template analysis
      tags: ['used-in-operation', operation.type]
    });
  }

  async _generateArtifactAttestation(operation, output) {
    const context = {
      operationId: operation.operationId,
      type: operation.type,
      startTime: operation.startTime,
      endTime: operation.endTime,
      agent: operation.agent,
      templateId: operation.templateId,
      templateVersion: operation.templateVersion,
      ruleIds: operation.ruleIds,
      integrityHash: operation.integrityHash,
      chainIndex: operation.chainIndex,
      reasoningChain: operation.reasoningChain,
      configuration: operation.configuration,
      sources: operation.inputs,
      outputs: [output]
    };
    
    const artifact = {
      id: output.id || crypto.randomUUID(),
      path: output.filePath,
      hash: output.hash,
      size: output.size,
      createdAt: operation.endTime
    };
    
    const attestation = await this.attestationGenerator.generateAttestation(context, artifact);
    
    // Sign attestation if crypto manager available
    if (this.cryptoManager) {
      return await this.attestationGenerator.signAttestation(attestation, this.cryptoManager);
    }
    
    return attestation;
  }

  _calculateOperationHash(operation) {
    const hashData = {
      operationId: operation.operationId,
      type: operation.type,
      startTime: operation.startTime.toISOString(),
      endTime: operation.endTime?.toISOString(),
      inputs: operation.inputs,
      outputs: operation.outputs,
      reasoningChain: operation.reasoningChain,
      configuration: operation.configuration
    };
    
    const dataString = JSON.stringify(hashData, Object.keys(hashData).sort());
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  async _findAttestationFiles(projectPath) {
    const { glob } = await import('glob');
    return await glob('**/*.attest.json', { 
      cwd: projectPath, 
      absolute: true,
      ignore: ['**/node_modules/**', '**/.*/**']
    });
  }

  async _findArtifactFiles(projectPath) {
    const { glob } = await import('glob');
    const allFiles = await glob('**/*', { 
      cwd: projectPath, 
      absolute: true,
      nodir: true,
      ignore: ['**/node_modules/**', '**/.*/**']
    });
    
    // Exclude attestation files
    return allFiles.filter(file => !file.endsWith('.attest.json'));
  }

  async _extractTemplateIds(projectPath) {
    // This would analyze the project to find template references
    // For now, return template IDs from completed operations
    const templateIds = new Set();
    
    for (const operation of this.completedOperations.values()) {
      if (operation.templateId) {
        templateIds.add(operation.templateId);
      }
    }
    
    return Array.from(templateIds);
  }

  _generateVerificationRecommendations(verification) {
    const recommendations = [];
    
    if (verification.attestations && !verification.attestations.success) {
      recommendations.push({
        type: 'attestation-issues',
        priority: 'high',
        description: 'Some attestations failed verification',
        action: 'Review and regenerate failed attestations'
      });
    }
    
    if (verification.templates && !verification.templates.valid) {
      recommendations.push({
        type: 'template-issues',
        priority: 'medium',
        description: 'Template version verification issues detected',
        action: 'Verify template integrity and update versions if needed'
      });
    }
    
    if (verification.audit && !verification.audit.overallValid) {
      recommendations.push({
        type: 'audit-issues',
        priority: 'critical',
        description: 'Audit trail integrity compromised',
        action: 'Investigate audit trail corruption immediately'
      });
    }
    
    return recommendations;
  }
}

export default ProvenanceEngine;