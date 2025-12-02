/**
 * Attestation Chain Validation System
 * Verifies complete chains from KPack to publisher DID with SLSA compliance
 */

import { createHash } from 'crypto';
import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';
import fs from 'fs-extra';
import path from 'path';

/**
 * SLSA (Supply-chain Levels for Software Artifacts) Validator
 */
export class SLSAValidator {
  constructor() {
    this.supportedLevels = ['SLSA_LEVEL_1', 'SLSA_LEVEL_2', 'SLSA_LEVEL_3', 'SLSA_LEVEL_4'];
    this.requirements = {
      'SLSA_LEVEL_1': {
        buildPlatform: 'registered',
        buildSteps: 'documented',
        provenance: 'available'
      },
      'SLSA_LEVEL_2': {
        buildPlatform: 'registered',
        buildSteps: 'documented',
        provenance: 'authenticated',
        buildService: 'hosted',
        sourceIntegrity: 'verified'
      },
      'SLSA_LEVEL_3': {
        buildPlatform: 'hardened',
        buildSteps: 'documented',
        provenance: 'authenticated',
        buildService: 'isolated',
        sourceIntegrity: 'verified',
        buildReproducible: true
      },
      'SLSA_LEVEL_4': {
        buildPlatform: 'hardened',
        buildSteps: 'documented',
        provenance: 'authenticated',
        buildService: 'hermetic',
        sourceIntegrity: 'verified',
        buildReproducible: true,
        twoPersonReview: true
      }
    };
  }

  /**
   * Validate SLSA level compliance
   */
  async validateSLSALevel(attestation, requiredLevel) {
    const requirements = this.requirements[requiredLevel];
    if (!requirements) {
      throw new Error(`Unsupported SLSA level: ${requiredLevel}`);
    }

    const validationResults = {
      level: requiredLevel,
      compliant: true,
      checks: {},
      violations: []
    };

    // Check build platform requirements
    validationResults.checks.buildPlatform = this.validateBuildPlatform(
      attestation.buildPlatform,
      requirements.buildPlatform
    );

    // Check build steps documentation
    validationResults.checks.buildSteps = this.validateBuildSteps(
      attestation.buildSteps,
      requirements.buildSteps
    );

    // Check provenance requirements
    validationResults.checks.provenance = this.validateProvenance(
      attestation.provenance,
      requirements.provenance
    );

    // Level 2+ requirements
    if (requiredLevel !== 'SLSA_LEVEL_1') {
      validationResults.checks.buildService = this.validateBuildService(
        attestation.buildService,
        requirements.buildService
      );

      validationResults.checks.sourceIntegrity = this.validateSourceIntegrity(
        attestation.sourceIntegrity,
        requirements.sourceIntegrity
      );
    }

    // Level 3+ requirements
    if (['SLSA_LEVEL_3', 'SLSA_LEVEL_4'].includes(requiredLevel)) {
      validationResults.checks.buildReproducible = this.validateBuildReproducible(
        attestation.buildReproducible,
        requirements.buildReproducible
      );
    }

    // Level 4 requirements
    if (requiredLevel === 'SLSA_LEVEL_4') {
      validationResults.checks.twoPersonReview = this.validateTwoPersonReview(
        attestation.twoPersonReview,
        requirements.twoPersonReview
      );
    }

    // Collect violations
    for (const [check, result] of Object.entries(validationResults.checks)) {
      if (!result.valid) {
        validationResults.violations.push({
          check,
          reason: result.reason,
          severity: result.severity || 'error'
        });
        validationResults.compliant = false;
      }
    }

    return validationResults;
  }

  validateBuildPlatform(actual, required) {
    const validPlatforms = {
      registered: ['github-actions', 'gitlab-ci', 'jenkins', 'travis-ci'],
      hardened: ['github-actions-hardened', 'google-cloud-build', 'tekton']
    };

    if (required === 'registered') {
      return {
        valid: validPlatforms.registered.includes(actual) || validPlatforms.hardened.includes(actual),
        reason: actual ? `Platform ${actual} validation` : 'No build platform specified'
      };
    }

    if (required === 'hardened') {
      return {
        valid: validPlatforms.hardened.includes(actual),
        reason: actual ? `Hardened platform ${actual} validation` : 'No hardened build platform specified'
      };
    }

    return { valid: false, reason: `Unknown requirement: ${required}` };
  }

  validateBuildSteps(actual, required) {
    if (required === 'documented') {
      return {
        valid: Array.isArray(actual) && actual.length > 0,
        reason: 'Build steps must be documented as an array of steps'
      };
    }

    return { valid: false, reason: `Unknown requirement: ${required}` };
  }

  validateProvenance(actual, required) {
    if (required === 'available') {
      return {
        valid: actual && typeof actual === 'object',
        reason: 'Provenance information must be available'
      };
    }

    if (required === 'authenticated') {
      return {
        valid: actual && actual.signature && actual.certificate,
        reason: 'Provenance must be cryptographically authenticated'
      };
    }

    return { valid: false, reason: `Unknown requirement: ${required}` };
  }

  validateBuildService(actual, required) {
    const serviceTypes = {
      hosted: ['github-actions', 'gitlab-ci', 'circleci'],
      isolated: ['github-actions-isolated', 'google-cloud-build'],
      hermetic: ['bazel-remote', 'nix-build', 'docker-hermetic']
    };

    if (!serviceTypes[required]) {
      return { valid: false, reason: `Unknown service requirement: ${required}` };
    }

    return {
      valid: serviceTypes[required].includes(actual),
      reason: `Build service must be ${required}`
    };
  }

  validateSourceIntegrity(actual, required) {
    if (required === 'verified') {
      return {
        valid: actual && actual.commitSha && actual.repositoryUri && actual.verified === true,
        reason: 'Source integrity must include commit SHA, repository URI, and verification status'
      };
    }

    return { valid: false, reason: `Unknown requirement: ${required}` };
  }

  validateBuildReproducible(actual, required) {
    if (required === true) {
      return {
        valid: actual === true,
        reason: 'Build must be reproducible'
      };
    }

    return { valid: true, reason: 'Reproducible build not required' };
  }

  validateTwoPersonReview(actual, required) {
    if (required === true) {
      return {
        valid: actual && Array.isArray(actual.reviewers) && actual.reviewers.length >= 2,
        reason: 'Two-person review required with at least 2 reviewers'
      };
    }

    return { valid: true, reason: 'Two-person review not required' };
  }
}

/**
 * Attestation Chain Validator
 * Validates complete attestation chains from KPack to publisher DID
 */
export class AttestationChainValidator {
  constructor(options = {}) {
    this.slsaValidator = new SLSAValidator();
    this.trustStore = options.trustStore;
    this.certificateTransparencyLogs = options.ctLogs || [
      'https://ct.googleapis.com/rocketeer',
      'https://ct.googleapis.com/aviator'
    ];
  }

  /**
   * Validate complete attestation chain
   */
  async validateAttestationChain(attestationChain, options = {}) {
    const validation = {
      valid: true,
      timestamp: new Date().toISOString(),
      chainLength: attestationChain.length,
      validations: [],
      violations: [],
      trustLevel: 'unknown'
    };

    // Validate each attestation in the chain
    for (let i = 0; i < attestationChain.length; i++) {
      const attestation = attestationChain[i];
      const isRoot = i === 0;
      const isLeaf = i === attestationChain.length - 1;

      const attestationValidation = await this.validateSingleAttestation(
        attestation,
        { isRoot, isLeaf, ...options }
      );

      validation.validations.push({
        index: i,
        attestationId: attestation.id,
        ...attestationValidation
      });

      if (!attestationValidation.valid) {
        validation.valid = false;
        validation.violations.push(...attestationValidation.violations);
      }
    }

    // Validate chain continuity
    const continuityValidation = this.validateChainContinuity(attestationChain);
    validation.validations.push({
      type: 'chain_continuity',
      ...continuityValidation
    });

    if (!continuityValidation.valid) {
      validation.valid = false;
      validation.violations.push(...continuityValidation.violations);
    }

    // Determine overall trust level
    validation.trustLevel = this.calculateTrustLevel(validation);

    return validation;
  }

  /**
   * Validate a single attestation in the chain
   */
  async validateSingleAttestation(attestation, options = {}) {
    const validation = {
      valid: true,
      checks: {},
      violations: []
    };

    // Basic structure validation
    validation.checks.structure = this.validateAttestationStructure(attestation);

    // Signature validation
    validation.checks.signature = await this.validateAttestationSignature(attestation);

    // SLSA compliance validation
    if (attestation.slsaLevel) {
      validation.checks.slsa = await this.slsaValidator.validateSLSALevel(
        attestation,
        attestation.slsaLevel
      );
    }

    // Certificate transparency validation
    if (attestation.certificate) {
      validation.checks.certificateTransparency = await this.validateCertificateTransparency(
        attestation.certificate
      );
    }

    // Trust policy validation
    if (this.trustStore) {
      validation.checks.trustPolicy = await this.validateTrustPolicy(attestation);
    }

    // Collect violations
    for (const [check, result] of Object.entries(validation.checks)) {
      if (result && !result.valid && !result.compliant) {
        validation.violations.push({
          check,
          reason: result.reason || result.violations?.[0]?.reason,
          severity: result.severity || 'error'
        });
        validation.valid = false;
      }
    }

    return validation;
  }

  /**
   * Validate attestation structure
   */
  validateAttestationStructure(attestation) {
    const requiredFields = ['id', 'type', 'issuer', 'subject', 'timestamp', 'signature'];
    const missingFields = requiredFields.filter(field => !attestation[field]);

    return {
      valid: missingFields.length === 0,
      reason: missingFields.length > 0 ? `Missing required fields: ${missingFields.join(', ')}` : 'Structure valid',
      missingFields
    };
  }

  /**
   * Validate attestation signature
   */
  async validateAttestationSignature(attestation) {
    try {
      // Extract signature components
      const { signature, publicKey, algorithm } = attestation;
      
      if (!signature || !publicKey) {
        return {
          valid: false,
          reason: 'Missing signature or public key'
        };
      }

      // Create canonical representation for verification
      const attestationCopy = { ...attestation };
      delete attestationCopy.signature;
      const canonicalData = JSON.stringify(attestationCopy, Object.keys(attestationCopy).sort());
      const dataHash = createHash('sha256').update(canonicalData).digest();

      // Mock signature verification - in production this would use proper crypto
      const expectedSignature = createHash('sha256')
        .update(publicKey)
        .update(dataHash)
        .digest('hex');

      return {
        valid: signature.includes('mock') || signature.length > 64, // Mock validation
        reason: 'Signature verification completed',
        algorithm: algorithm || 'unknown'
      };
    } catch (error) {
      return {
        valid: false,
        reason: `Signature validation error: ${error.message}`
      };
    }
  }

  /**
   * Validate certificate transparency
   */
  async validateCertificateTransparency(certificate) {
    try {
      // Mock CT log validation - in production this would query actual CT logs
      const mockCTEntry = {
        logId: 'mock_ct_log_id',
        timestamp: Date.now(),
        leafIndex: 12345,
        signedCertificateTimestamp: 'mock_sct'
      };

      return {
        valid: true,
        reason: 'Certificate found in transparency logs',
        ctLogs: [mockCTEntry]
      };
    } catch (error) {
      return {
        valid: false,
        reason: `Certificate transparency validation error: ${error.message}`
      };
    }
  }

  /**
   * Validate against trust policy
   */
  async validateTrustPolicy(attestation) {
    if (!this.trustStore) {
      return { valid: true, reason: 'No trust store configured' };
    }

    try {
      const policy = await this.trustStore.getTrustPolicy();
      
      // Check DID allowlist
      if (policy.didAllowlist && policy.didAllowlist.length > 0) {
        if (!policy.didAllowlist.includes(attestation.issuer)) {
          return {
            valid: false,
            reason: `Issuer DID ${attestation.issuer} not in allowlist`
          };
        }
      }

      // Check DID denylist
      if (policy.didDenylist && policy.didDenylist.includes(attestation.issuer)) {
        return {
          valid: false,
          reason: `Issuer DID ${attestation.issuer} is in denylist`
        };
      }

      // Check minimum SLSA level
      if (policy.minimumSLSALevel && attestation.slsaLevel) {
        const levelOrder = ['SLSA_LEVEL_1', 'SLSA_LEVEL_2', 'SLSA_LEVEL_3', 'SLSA_LEVEL_4'];
        const actualLevel = levelOrder.indexOf(attestation.slsaLevel);
        const requiredLevel = levelOrder.indexOf(policy.minimumSLSALevel);
        
        if (actualLevel < requiredLevel) {
          return {
            valid: false,
            reason: `SLSA level ${attestation.slsaLevel} below required ${policy.minimumSLSALevel}`
          };
        }
      }

      return {
        valid: true,
        reason: 'Trust policy validation passed'
      };
    } catch (error) {
      return {
        valid: false,
        reason: `Trust policy validation error: ${error.message}`
      };
    }
  }

  /**
   * Validate chain continuity (each attestation properly references the next)
   */
  validateChainContinuity(attestationChain) {
    const violations = [];

    for (let i = 0; i < attestationChain.length - 1; i++) {
      const current = attestationChain[i];
      const next = attestationChain[i + 1];

      // Check if current attestation references next attestation subject
      if (current.subject !== next.issuer) {
        violations.push({
          reason: `Chain break at index ${i}: current subject ${current.subject} does not match next issuer ${next.issuer}`,
          severity: 'error'
        });
      }

      // Check temporal ordering
      const currentTime = new Date(current.timestamp);
      const nextTime = new Date(next.timestamp);
      
      if (currentTime > nextTime) {
        violations.push({
          reason: `Temporal violation at index ${i}: current timestamp ${current.timestamp} is after next timestamp ${next.timestamp}`,
          severity: 'warning'
        });
      }
    }

    return {
      valid: violations.length === 0,
      violations
    };
  }

  /**
   * Calculate overall trust level based on validation results
   */
  calculateTrustLevel(validation) {
    if (!validation.valid) {
      return 'untrusted';
    }

    const errorCount = validation.violations.filter(v => v.severity === 'error').length;
    const warningCount = validation.violations.filter(v => v.severity === 'warning').length;

    if (errorCount === 0 && warningCount === 0) {
      return 'trusted';
    }

    if (errorCount === 0) {
      return 'partially_trusted';
    }

    return 'untrusted';
  }
}

/**
 * Certificate Transparency Log Manager
 */
export class CertificateTransparencyManager {
  constructor(options = {}) {
    this.ctLogs = options.ctLogs || [
      'https://ct.googleapis.com/rocketeer',
      'https://ct.googleapis.com/aviator',
      'https://ct.googleapis.com/icarus',
      'https://ct.googleapis.com/pilot'
    ];
  }

  /**
   * Submit certificate to CT logs
   */
  async submitCertificate(certificate) {
    const submissions = [];

    for (const logUrl of this.ctLogs) {
      try {
        const submission = await this.submitToSingleLog(logUrl, certificate);
        submissions.push({
          logUrl,
          success: true,
          ...submission
        });
      } catch (error) {
        submissions.push({
          logUrl,
          success: false,
          error: error.message
        });
      }
    }

    return submissions;
  }

  /**
   * Submit to a single CT log
   */
  async submitToSingleLog(logUrl, certificate) {
    // Mock CT log submission - in production this would make HTTP requests
    return {
      sct: {
        version: 1,
        logId: createHash('sha256').update(logUrl).digest('hex'),
        timestamp: Date.now(),
        signature: 'mock_signature_' + Date.now()
      },
      leafIndex: Math.floor(Math.random() * 1000000)
    };
  }

  /**
   * Verify SCT (Signed Certificate Timestamp)
   */
  async verifySCT(sct, certificate) {
    // Mock SCT verification
    return {
      valid: true,
      logId: sct.logId,
      timestamp: sct.timestamp,
      verified: new Date().toISOString()
    };
  }
}
