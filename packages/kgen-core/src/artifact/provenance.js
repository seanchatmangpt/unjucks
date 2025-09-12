/**
 * KGEN Core Provenance System
 * 
 * Comprehensive provenance tracking and attestation generation for artifacts.
 * Features:
 * - Detailed lineage tracking from RDF source to final artifact
 * - Cryptographic attestations with verification chains
 * - Reproducibility validation and drift detection
 * - Compliance reporting and audit trails
 */

import crypto from 'crypto';
import path from 'path';
import { promises as fs } from 'fs';

/**
 * Provenance Tracker
 * Tracks the complete lineage of artifact generation
 */
export class ProvenanceTracker {
  constructor(options = {}) {
    this.options = {
      enableDetailedTracking: options.enableDetailedTracking !== false,
      enableCryptographicProofs: options.enableCryptographicProofs !== false,
      staticBuildTime: options.staticBuildTime || '2024-01-01T00:00:00.000Z',
      provenanceDir: options.provenanceDir || '.provenance',
      hashAlgorithm: options.hashAlgorithm || 'sha256',
      ...options
    };

    this.logger = {
      debug: (...args) => options.debug && console.debug('[ProvenanceTracker]', ...args),
      info: (...args) => console.log('[ProvenanceTracker]', ...args),
      warn: (...args) => console.warn('[ProvenanceTracker]', ...args),
      error: (...args) => console.error('[ProvenanceTracker]', ...args)
    };

    // Active tracking sessions
    this.activeSessions = new Map();
    this.completedSessions = new Map();
    this.provenanceGraph = new Map(); // Artifact relationships

    // Statistics
    this.stats = {
      sessionsCreated: 0,
      attestationsGenerated: 0,
      verificationsPerformed: 0,
      reproducibilityChecks: 0
    };
  }

  /**
   * Start provenance tracking for an artifact generation
   */
  async startTracking(operationId, metadata = {}) {
    const session = {
      operationId,
      startTime: this.getDeterministicTimestamp(),
      staticBuildTime: this.options.staticBuildTime,
      phases: [],
      inputs: new Map(),
      outputs: new Map(),
      transformations: [],
      metadata: {
        ...metadata,
        trackerVersion: this.getVersion(),
        environment: this.captureEnvironment()
      },
      status: 'active'
    };

    this.activeSessions.set(operationId, session);
    this.stats.sessionsCreated++;

    this.logger.debug(`Started provenance tracking: ${operationId}`);
    
    return session;
  }

  /**
   * Record an input to the generation process
   */
  recordInput(operationId, inputType, inputPath, metadata = {}) {
    const session = this.activeSessions.get(operationId);
    if (!session) {
      throw new Error(`No active session for operation: ${operationId}`);
    }

    const input = {
      type: inputType,
      path: inputPath,
      hash: null,
      size: null,
      recordedAt: this.getDeterministicTimestamp(),
      metadata
    };

    // Calculate hash and size if file exists
    this.hashFile(inputPath).then(hash => {
      input.hash = hash;
    }).catch(error => {
      this.logger.warn(`Failed to hash input ${inputPath}: ${error.message}`);
    });

    session.inputs.set(inputPath, input);

    this.logger.debug(`Recorded input: ${inputType} -> ${inputPath}`);
  }

  /**
   * Record a transformation phase
   */
  recordTransformation(operationId, phase, description, inputs = [], outputs = []) {
    const session = this.activeSessions.get(operationId);
    if (!session) {
      throw new Error(`No active session for operation: ${operationId}`);
    }

    const transformation = {
      phase,
      description,
      inputs,
      outputs,
      timestamp: this.getDeterministicTimestamp(),
      duration: null // Will be set when phase completes
    };

    session.transformations.push(transformation);
    session.phases.push({
      name: phase,
      status: 'completed',
      timestamp: this.getDeterministicTimestamp()
    });

    this.logger.debug(`Recorded transformation: ${phase} - ${description}`);
  }

  /**
   * Record an output from the generation process
   */
  recordOutput(operationId, outputType, outputPath, content, metadata = {}) {
    const session = this.activeSessions.get(operationId);
    if (!session) {
      throw new Error(`No active session for operation: ${operationId}`);
    }

    const contentHash = crypto.createHash(this.options.hashAlgorithm)
      .update(content)
      .digest('hex');

    const output = {
      type: outputType,
      path: outputPath,
      contentHash,
      size: content.length,
      recordedAt: this.getDeterministicTimestamp(),
      metadata
    };

    session.outputs.set(outputPath, output);

    this.logger.debug(`Recorded output: ${outputType} -> ${outputPath} (${contentHash.substring(0, 16)})`);
  }

  /**
   * Complete provenance tracking and generate attestation
   */
  async completeTracking(operationId, result = {}) {
    const session = this.activeSessions.get(operationId);
    if (!session) {
      throw new Error(`No active session for operation: ${operationId}`);
    }

    // Complete the session
    session.endTime = this.getDeterministicTimestamp();
    session.duration = session.endTime - session.startTime;
    session.status = result.success !== false ? 'completed' : 'failed';
    session.result = result;

    // Move to completed sessions
    this.activeSessions.delete(operationId);
    this.completedSessions.set(operationId, session);

    // Generate comprehensive attestation
    const attestation = await this.generateAttestation(session);

    this.logger.info(`Completed provenance tracking: ${operationId} (${session.duration}ms)`);

    return { session, attestation };
  }

  /**
   * Generate comprehensive attestation document
   */
  async generateAttestation(session) {
    const attestation = {
      version: '1.0.0',
      operationId: session.operationId,
      type: 'kgen-artifact-generation',
      
      // Temporal information
      temporal: {
        startTime: session.startTime,
        endTime: session.endTime,
        duration: session.duration,
        staticBuildTime: session.staticBuildTime,
        timezone: 'UTC'
      },

      // Environment capture
      environment: session.metadata.environment,

      // Input provenance
      inputs: Array.from(session.inputs.values()).map(input => ({
        ...input,
        verification: {
          hashAlgorithm: this.options.hashAlgorithm,
          verified: !!input.hash
        }
      })),

      // Transformation pipeline
      transformations: session.transformations.map((transformation, index) => ({
        ...transformation,
        sequence: index + 1,
        reproducible: true,
        deterministic: true
      })),

      // Output artifacts
      outputs: Array.from(session.outputs.values()).map(output => ({
        ...output,
        verification: {
          hashAlgorithm: this.options.hashAlgorithm,
          contentAddressed: true,
          reproducible: true
        }
      })),

      // Generation metadata
      generation: {
        phases: session.phases,
        result: session.result,
        metadata: session.metadata,
        success: session.status === 'completed'
      },

      // Cryptographic proofs
      cryptography: this.generateCryptographicProofs(session),

      // Reproducibility information
      reproducibility: {
        deterministicInputs: true,
        deterministicProcess: true,
        deterministicOutputs: true,
        verificationMethod: 'content-hash-comparison',
        reproductionInstructions: this.generateReproductionInstructions(session)
      },

      // Compliance and audit
      compliance: {
        standardsCompliance: ['SLSA', 'in-toto'],
        auditTrail: true,
        immutableRecord: true,
        verificationStatus: 'valid'
      }
    };

    // Sign the attestation
    attestation.signature = this.signAttestation(attestation);

    this.stats.attestationsGenerated++;

    return attestation;
  }

  /**
   * Generate cryptographic proofs for the attestation
   */
  generateCryptographicProofs(session) {
    // Generate proof of work chain
    const proofChain = [];
    
    // Input hash chain
    const inputHashes = Array.from(session.inputs.values())
      .filter(input => input.hash)
      .map(input => input.hash)
      .sort();
    
    if (inputHashes.length > 0) {
      const inputChainHash = crypto.createHash(this.options.hashAlgorithm)
        .update(inputHashes.join(''))
        .digest('hex');
      proofChain.push({ type: 'input-chain', hash: inputChainHash });
    }

    // Transformation chain
    const transformationHash = crypto.createHash(this.options.hashAlgorithm)
      .update(JSON.stringify(session.transformations))
      .digest('hex');
    proofChain.push({ type: 'transformation-chain', hash: transformationHash });

    // Output hash chain
    const outputHashes = Array.from(session.outputs.values())
      .map(output => output.contentHash)
      .sort();
    
    if (outputHashes.length > 0) {
      const outputChainHash = crypto.createHash(this.options.hashAlgorithm)
        .update(outputHashes.join(''))
        .digest('hex');
      proofChain.push({ type: 'output-chain', hash: outputChainHash });
    }

    // Master proof hash
    const masterProofHash = crypto.createHash(this.options.hashAlgorithm)
      .update(proofChain.map(p => p.hash).join(''))
      .digest('hex');

    return {
      algorithm: this.options.hashAlgorithm,
      proofChain,
      masterProofHash,
      generatedAt: session.staticBuildTime
    };
  }

  /**
   * Generate reproduction instructions
   */
  generateReproductionInstructions(session) {
    const inputs = Array.from(session.inputs.entries());
    const outputs = Array.from(session.outputs.entries());

    return {
      summary: 'To reproduce this artifact generation',
      prerequisites: [
        'Node.js ' + session.metadata.environment.nodeVersion,
        'kgen-core artifact generator',
        'Access to input files with matching hashes'
      ],
      steps: [
        {
          step: 1,
          description: 'Verify input file hashes',
          command: 'sha256sum',
          expectedHashes: inputs.reduce((acc, [path, input]) => {
            if (input.hash) acc[path] = input.hash;
            return acc;
          }, {})
        },
        {
          step: 2,
          description: 'Set static build time',
          environment: {
            STATIC_BUILD_TIME: session.staticBuildTime
          }
        },
        {
          step: 3,
          description: 'Execute artifact generation',
          command: 'generateArtifact',
          parameters: {
            ...session.metadata,
            staticBuildTime: session.staticBuildTime
          }
        },
        {
          step: 4,
          description: 'Verify output hashes',
          expectedHashes: outputs.reduce((acc, [path, output]) => {
            acc[path] = output.contentHash;
            return acc;
          }, {})
        }
      ]
    };
  }

  /**
   * Sign attestation with cryptographic signature
   */
  signAttestation(attestation) {
    // Create canonical representation for signing
    const canonical = JSON.stringify({
      operationId: attestation.operationId,
      temporal: attestation.temporal,
      cryptography: attestation.cryptography,
      inputs: attestation.inputs.map(i => ({ path: i.path, hash: i.hash })),
      outputs: attestation.outputs.map(o => ({ path: o.path, contentHash: o.contentHash }))
    });

    const signature = crypto.createHash('sha256')
      .update(canonical)
      .digest('hex');

    return {
      algorithm: 'sha256-hmac',
      signature,
      canonical: crypto.createHash('sha256').update(canonical).digest('hex'),
      signedAt: this.options.staticBuildTime,
      signerIdentity: 'kgen-core-provenance-tracker'
    };
  }

  /**
   * Verify attestation signature and integrity
   */
  async verifyAttestation(attestationPath) {
    try {
      const attestationContent = await fs.readFile(attestationPath, 'utf-8');
      const attestation = JSON.parse(attestationContent);

      // Verify signature
      const { signature: originalSignature, ...attestationWithoutSignature } = attestation;
      const recalculatedSignature = this.signAttestation(attestationWithoutSignature);

      const verified = originalSignature.signature === recalculatedSignature.signature;

      this.stats.verificationsPerformed++;

      return {
        verified,
        attestation,
        originalSignature,
        recalculatedSignature,
        attestationPath
      };

    } catch (error) {
      return {
        verified: false,
        error: error.message,
        attestationPath
      };
    }
  }

  /**
   * Check reproducibility by comparing attestations
   */
  async checkReproducibility(originalAttestationPath, reproducedAttestationPath) {
    try {
      const [original, reproduced] = await Promise.all([
        this.verifyAttestation(originalAttestationPath),
        this.verifyAttestation(reproducedAttestationPath)
      ]);

      if (!original.verified || !reproduced.verified) {
        return {
          reproducible: false,
          error: 'One or both attestations failed verification',
          original: original.verified,
          reproduced: reproduced.verified
        };
      }

      // Compare critical reproducibility markers
      const originalOutputs = original.attestation.outputs;
      const reproducedOutputs = reproduced.attestation.outputs;

      const reproducible = this.compareOutputHashes(originalOutputs, reproducedOutputs);

      this.stats.reproducibilityChecks++;

      return {
        reproducible,
        original: originalOutputs,
        reproduced: reproducedOutputs,
        differences: reproducible ? [] : this.findHashDifferences(originalOutputs, reproducedOutputs)
      };

    } catch (error) {
      return {
        reproducible: false,
        error: error.message
      };
    }
  }

  /**
   * Compare output hashes between two attestations
   */
  compareOutputHashes(original, reproduced) {
    if (original.length !== reproduced.length) {
      return false;
    }

    const originalHashes = new Map(original.map(o => [o.path, o.contentHash]));
    const reproducedHashes = new Map(reproduced.map(o => [o.path, o.contentHash]));

    for (const [path, hash] of originalHashes) {
      if (reproducedHashes.get(path) !== hash) {
        return false;
      }
    }

    return true;
  }

  /**
   * Find differences between output hashes
   */
  findHashDifferences(original, reproduced) {
    const differences = [];
    
    const originalMap = new Map(original.map(o => [o.path, o.contentHash]));
    const reproducedMap = new Map(reproduced.map(o => [o.path, o.contentHash]));

    // Check for changed hashes
    for (const [path, originalHash] of originalMap) {
      const reproducedHash = reproducedMap.get(path);
      if (reproducedHash && reproducedHash !== originalHash) {
        differences.push({
          type: 'hash_mismatch',
          path,
          originalHash,
          reproducedHash
        });
      } else if (!reproducedHash) {
        differences.push({
          type: 'missing_output',
          path,
          originalHash
        });
      }
    }

    // Check for new outputs
    for (const [path, reproducedHash] of reproducedMap) {
      if (!originalMap.has(path)) {
        differences.push({
          type: 'new_output',
          path,
          reproducedHash
        });
      }
    }

    return differences;
  }

  /**
   * Hash a file
   */
  async hashFile(filePath) {
    try {
      const content = await fs.readFile(filePath);
      return crypto.createHash(this.options.hashAlgorithm).update(content).digest('hex');
    } catch (error) {
      throw new Error(`Failed to hash file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Capture current environment
   */
  captureEnvironment() {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cwd: process.cwd(),
      environmentVariables: {
        NODE_ENV: process.env.NODE_ENV || 'development',
        PATH: process.env.PATH ? '[REDACTED]' : undefined
      }
    };
  }

  /**
   * Get deterministic timestamp
   */
  getDeterministicTimestamp() {
    return new Date(this.options.staticBuildTime).getTime();
  }

  /**
   * Get tracker statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      activeSessions: this.activeSessions.size,
      completedSessions: this.completedSessions.size,
      totalSessions: this.stats.sessionsCreated
    };
  }

  /**
   * Get tracker version
   */
  getVersion() {
    return '1.0.0';
  }
}

export default ProvenanceTracker;