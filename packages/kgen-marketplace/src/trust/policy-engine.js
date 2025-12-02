/**
 * Trust Policy Engine
 * Manages trust policies, allowlists, denylists, and SLSA level requirements
 */

import fs from 'fs-extra';
import path from 'path';
import { createHash } from 'crypto';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

/**
 * Trust Policy Engine
 * Defines and enforces trust policies for KPack attestations
 */
export class TrustPolicyEngine {
  constructor(options = {}) {
    this.policyPath = options.policyPath || '.kgen/trust-policy.json';
    this.policy = null;
    this.ajv = new Ajv({ allErrors: true });
    addFormats(this.ajv);
    this.setupSchemas();
  }

  /**
   * Initialize the trust policy engine
   */
  async initialize() {
    await fs.ensureDir(path.dirname(this.policyPath));
    await this.loadPolicy();
  }

  /**
   * Setup JSON schemas for policy validation
   */
  setupSchemas() {
    // Trust policy schema
    const trustPolicySchema = {
      type: 'object',
      properties: {
        version: { type: 'string', enum: ['1.0'] },
        metadata: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            created: { type: 'string', format: 'date-time' },
            updated: { type: 'string', format: 'date-time' },
            owner: { type: 'string' }
          },
          required: ['name', 'created']
        },
        didPolicy: {
          type: 'object',
          properties: {
            allowlist: {
              type: 'array',
              items: { type: 'string', pattern: '^did:' }
            },
            denylist: {
              type: 'array',
              items: { type: 'string', pattern: '^did:' }
            },
            requireRegistration: { type: 'boolean' },
            minimumTrustScore: { type: 'number', minimum: 0, maximum: 1 }
          }
        },
        slsaPolicy: {
          type: 'object',
          properties: {
            minimumLevel: {
              type: 'string',
              enum: ['SLSA_LEVEL_1', 'SLSA_LEVEL_2', 'SLSA_LEVEL_3', 'SLSA_LEVEL_4']
            },
            requireReproducibleBuild: { type: 'boolean' },
            allowedBuildPlatforms: {
              type: 'array',
              items: { type: 'string' }
            },
            requireSourceIntegrity: { type: 'boolean' }
          }
        },
        attestationPolicy: {
          type: 'object',
          properties: {
            maximumAge: { type: 'number', minimum: 0 },
            requireCertificateTransparency: { type: 'boolean' },
            allowedIssuers: {
              type: 'array',
              items: { type: 'string', pattern: '^did:' }
            },
            minimumChainLength: { type: 'number', minimum: 1 },
            maximumChainLength: { type: 'number', minimum: 1 }
          }
        },
        cryptographicPolicy: {
          type: 'object',
          properties: {
            allowedKeyTypes: {
              type: 'array',
              items: { type: 'string', enum: ['Ed25519', 'RSA', 'secp256k1'] }
            },
            minimumKeySize: { type: 'number', minimum: 256 },
            allowedSignatureAlgorithms: {
              type: 'array',
              items: { type: 'string' }
            },
            requireHardwareKeys: { type: 'boolean' }
          }
        },
        compliancePolicy: {
          type: 'object',
          properties: {
            requireAuditTrail: { type: 'boolean' },
            allowedJurisdictions: {
              type: 'array',
              items: { type: 'string' }
            },
            dataRetentionPeriod: { type: 'number', minimum: 0 },
            privacyCompliance: {
              type: 'array',
              items: { type: 'string', enum: ['GDPR', 'CCPA', 'HIPAA', 'SOX'] }
            }
          }
        }
      },
      required: ['version', 'metadata'],
      additionalProperties: false
    };

    this.ajv.addSchema(trustPolicySchema, 'trustPolicy');
  }

  /**
   * Load trust policy from file
   */
  async loadPolicy() {
    try {
      if (await fs.pathExists(this.policyPath)) {
        const policyData = await fs.readJson(this.policyPath);
        await this.setPolicy(policyData);
      } else {
        // Create default policy
        await this.createDefaultPolicy();
      }
    } catch (error) {
      throw new Error(`Failed to load trust policy: ${error.message}`);
    }
  }

  /**
   * Set and validate trust policy
   */
  async setPolicy(policyData) {
    const valid = this.ajv.validate('trustPolicy', policyData);
    if (!valid) {
      throw new Error(`Invalid trust policy: ${this.ajv.errorsText()}`);
    }

    this.policy = {
      ...policyData,
      metadata: {
        ...policyData.metadata,
        updated: new Date().toISOString()
      }
    };

    await this.savePolicy();
  }

  /**
   * Create default trust policy
   */
  async createDefaultPolicy() {
    const defaultPolicy = {
      version: '1.0',
      metadata: {
        name: 'Default KGEN Trust Policy',
        description: 'Default trust policy for KGEN marketplace',
        created: new Date().toISOString(),
        owner: 'system'
      },
      didPolicy: {
        allowlist: [],
        denylist: [],
        requireRegistration: false,
        minimumTrustScore: 0.0
      },
      slsaPolicy: {
        minimumLevel: 'SLSA_LEVEL_2',
        requireReproducibleBuild: false,
        allowedBuildPlatforms: [
          'github-actions',
          'gitlab-ci',
          'jenkins',
          'travis-ci',
          'google-cloud-build'
        ],
        requireSourceIntegrity: true
      },
      attestationPolicy: {
        maximumAge: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
        requireCertificateTransparency: false,
        allowedIssuers: [],
        minimumChainLength: 1,
        maximumChainLength: 10
      },
      cryptographicPolicy: {
        allowedKeyTypes: ['Ed25519', 'RSA'],
        minimumKeySize: 2048,
        allowedSignatureAlgorithms: ['EdDSA', 'RS256', 'ES256'],
        requireHardwareKeys: false
      },
      compliancePolicy: {
        requireAuditTrail: true,
        allowedJurisdictions: [],
        dataRetentionPeriod: 7 * 365 * 24 * 60 * 60 * 1000, // 7 years
        privacyCompliance: []
      }
    };

    await this.setPolicy(defaultPolicy);
  }

  /**
   * Save policy to file
   */
  async savePolicy() {
    if (!this.policy) {
      throw new Error('No policy to save');
    }

    await fs.writeJson(this.policyPath, this.policy, { spaces: 2 });
  }

  /**
   * Evaluate attestation against trust policy
   */
  async evaluateAttestation(attestation) {
    if (!this.policy) {
      throw new Error('No trust policy loaded');
    }

    const evaluation = {
      compliant: true,
      evaluatedAt: new Date().toISOString(),
      policyVersion: this.policy.version,
      checks: {},
      violations: []
    };

    // Evaluate DID policy
    evaluation.checks.didPolicy = this.evaluateDIDPolicy(attestation);

    // Evaluate SLSA policy
    evaluation.checks.slsaPolicy = this.evaluateSLSAPolicy(attestation);

    // Evaluate attestation policy
    evaluation.checks.attestationPolicy = this.evaluateAttestationPolicy(attestation);

    // Evaluate cryptographic policy
    evaluation.checks.cryptographicPolicy = this.evaluateCryptographicPolicy(attestation);

    // Evaluate compliance policy
    evaluation.checks.compliancePolicy = this.evaluateCompliancePolicy(attestation);

    // Collect violations
    for (const [check, result] of Object.entries(evaluation.checks)) {
      if (!result.compliant) {
        evaluation.violations.push(...result.violations);
        evaluation.compliant = false;
      }
    }

    return evaluation;
  }

  /**
   * Evaluate DID policy compliance
   */
  evaluateDIDPolicy(attestation) {
    const result = {
      compliant: true,
      violations: []
    };

    const { didPolicy } = this.policy;
    const issuerDID = attestation.issuer;

    // Check denylist
    if (didPolicy.denylist && didPolicy.denylist.includes(issuerDID)) {
      result.violations.push({
        type: 'did_denylist',
        message: `Issuer DID ${issuerDID} is in denylist`,
        severity: 'error'
      });
      result.compliant = false;
    }

    // Check allowlist (if not empty, only allowed DIDs are permitted)
    if (didPolicy.allowlist && didPolicy.allowlist.length > 0) {
      if (!didPolicy.allowlist.includes(issuerDID)) {
        result.violations.push({
          type: 'did_allowlist',
          message: `Issuer DID ${issuerDID} not in allowlist`,
          severity: 'error'
        });
        result.compliant = false;
      }
    }

    // Check minimum trust score (if available)
    if (didPolicy.minimumTrustScore && attestation.trustScore !== undefined) {
      if (attestation.trustScore < didPolicy.minimumTrustScore) {
        result.violations.push({
          type: 'trust_score',
          message: `Trust score ${attestation.trustScore} below minimum ${didPolicy.minimumTrustScore}`,
          severity: 'warning'
        });
      }
    }

    return result;
  }

  /**
   * Evaluate SLSA policy compliance
   */
  evaluateSLSAPolicy(attestation) {
    const result = {
      compliant: true,
      violations: []
    };

    const { slsaPolicy } = this.policy;

    // Check minimum SLSA level
    if (slsaPolicy.minimumLevel && attestation.slsaLevel) {
      const levelOrder = ['SLSA_LEVEL_1', 'SLSA_LEVEL_2', 'SLSA_LEVEL_3', 'SLSA_LEVEL_4'];
      const actualLevel = levelOrder.indexOf(attestation.slsaLevel);
      const requiredLevel = levelOrder.indexOf(slsaPolicy.minimumLevel);

      if (actualLevel < requiredLevel) {
        result.violations.push({
          type: 'slsa_level',
          message: `SLSA level ${attestation.slsaLevel} below required ${slsaPolicy.minimumLevel}`,
          severity: 'error'
        });
        result.compliant = false;
      }
    }

    // Check reproducible build requirement
    if (slsaPolicy.requireReproducibleBuild && !attestation.reproducibleBuild) {
      result.violations.push({
        type: 'reproducible_build',
        message: 'Reproducible build required but not provided',
        severity: 'error'
      });
      result.compliant = false;
    }

    // Check allowed build platforms
    if (slsaPolicy.allowedBuildPlatforms && attestation.buildPlatform) {
      if (!slsaPolicy.allowedBuildPlatforms.includes(attestation.buildPlatform)) {
        result.violations.push({
          type: 'build_platform',
          message: `Build platform ${attestation.buildPlatform} not in allowed list`,
          severity: 'error'
        });
        result.compliant = false;
      }
    }

    // Check source integrity requirement
    if (slsaPolicy.requireSourceIntegrity && !attestation.sourceIntegrity?.verified) {
      result.violations.push({
        type: 'source_integrity',
        message: 'Source integrity verification required but not provided',
        severity: 'error'
      });
      result.compliant = false;
    }

    return result;
  }

  /**
   * Evaluate attestation policy compliance
   */
  evaluateAttestationPolicy(attestation) {
    const result = {
      compliant: true,
      violations: []
    };

    const { attestationPolicy } = this.policy;

    // Check maximum age
    if (attestationPolicy.maximumAge && attestation.timestamp) {
      const age = Date.now() - new Date(attestation.timestamp).getTime();
      if (age > attestationPolicy.maximumAge) {
        result.violations.push({
          type: 'attestation_age',
          message: `Attestation age ${Math.round(age / (24 * 60 * 60 * 1000))} days exceeds maximum ${Math.round(attestationPolicy.maximumAge / (24 * 60 * 60 * 1000))} days`,
          severity: 'warning'
        });
      }
    }

    // Check certificate transparency requirement
    if (attestationPolicy.requireCertificateTransparency && !attestation.certificateTransparency) {
      result.violations.push({
        type: 'certificate_transparency',
        message: 'Certificate transparency required but not provided',
        severity: 'error'
      });
      result.compliant = false;
    }

    // Check allowed issuers
    if (attestationPolicy.allowedIssuers && attestationPolicy.allowedIssuers.length > 0) {
      if (!attestationPolicy.allowedIssuers.includes(attestation.issuer)) {
        result.violations.push({
          type: 'allowed_issuers',
          message: `Issuer ${attestation.issuer} not in allowed issuers list`,
          severity: 'error'
        });
        result.compliant = false;
      }
    }

    return result;
  }

  /**
   * Evaluate cryptographic policy compliance
   */
  evaluateCryptographicPolicy(attestation) {
    const result = {
      compliant: true,
      violations: []
    };

    const { cryptographicPolicy } = this.policy;

    // Check allowed key types
    if (cryptographicPolicy.allowedKeyTypes && attestation.keyType) {
      if (!cryptographicPolicy.allowedKeyTypes.includes(attestation.keyType)) {
        result.violations.push({
          type: 'key_type',
          message: `Key type ${attestation.keyType} not in allowed list`,
          severity: 'error'
        });
        result.compliant = false;
      }
    }

    // Check minimum key size
    if (cryptographicPolicy.minimumKeySize && attestation.keySize) {
      if (attestation.keySize < cryptographicPolicy.minimumKeySize) {
        result.violations.push({
          type: 'key_size',
          message: `Key size ${attestation.keySize} below minimum ${cryptographicPolicy.minimumKeySize}`,
          severity: 'error'
        });
        result.compliant = false;
      }
    }

    // Check allowed signature algorithms
    if (cryptographicPolicy.allowedSignatureAlgorithms && attestation.signatureAlgorithm) {
      if (!cryptographicPolicy.allowedSignatureAlgorithms.includes(attestation.signatureAlgorithm)) {
        result.violations.push({
          type: 'signature_algorithm',
          message: `Signature algorithm ${attestation.signatureAlgorithm} not in allowed list`,
          severity: 'error'
        });
        result.compliant = false;
      }
    }

    // Check hardware key requirement
    if (cryptographicPolicy.requireHardwareKeys && !attestation.hardwareBacked) {
      result.violations.push({
        type: 'hardware_keys',
        message: 'Hardware-backed keys required but not provided',
        severity: 'error'
      });
      result.compliant = false;
    }

    return result;
  }

  /**
   * Evaluate compliance policy
   */
  evaluateCompliancePolicy(attestation) {
    const result = {
      compliant: true,
      violations: []
    };

    const { compliancePolicy } = this.policy;

    // Check audit trail requirement
    if (compliancePolicy.requireAuditTrail && !attestation.auditTrail) {
      result.violations.push({
        type: 'audit_trail',
        message: 'Audit trail required but not provided',
        severity: 'warning'
      });
    }

    // Check allowed jurisdictions
    if (compliancePolicy.allowedJurisdictions && compliancePolicy.allowedJurisdictions.length > 0 && attestation.jurisdiction) {
      if (!compliancePolicy.allowedJurisdictions.includes(attestation.jurisdiction)) {
        result.violations.push({
          type: 'jurisdiction',
          message: `Jurisdiction ${attestation.jurisdiction} not in allowed list`,
          severity: 'warning'
        });
      }
    }

    return result;
  }

  /**
   * Update DID allowlist
   */
  async updateDIDAllowlist(dids, operation = 'add') {
    if (!this.policy) {
      throw new Error('No policy loaded');
    }

    const allowlist = this.policy.didPolicy.allowlist || [];

    if (operation === 'add') {
      for (const did of dids) {
        if (!allowlist.includes(did)) {
          allowlist.push(did);
        }
      }
    } else if (operation === 'remove') {
      for (const did of dids) {
        const index = allowlist.indexOf(did);
        if (index > -1) {
          allowlist.splice(index, 1);
        }
      }
    }

    this.policy.didPolicy.allowlist = allowlist;
    await this.savePolicy();

    return allowlist;
  }

  /**
   * Update DID denylist
   */
  async updateDIDDenylist(dids, operation = 'add') {
    if (!this.policy) {
      throw new Error('No policy loaded');
    }

    const denylist = this.policy.didPolicy.denylist || [];

    if (operation === 'add') {
      for (const did of dids) {
        if (!denylist.includes(did)) {
          denylist.push(did);
        }
      }
    } else if (operation === 'remove') {
      for (const did of dids) {
        const index = denylist.indexOf(did);
        if (index > -1) {
          denylist.splice(index, 1);
        }
      }
    }

    this.policy.didPolicy.denylist = denylist;
    await this.savePolicy();

    return denylist;
  }

  /**
   * Get current trust policy
   */
  getTrustPolicy() {
    return this.policy;
  }

  /**
   * Get policy summary
   */
  getPolicySummary() {
    if (!this.policy) {
      return null;
    }

    return {
      version: this.policy.version,
      name: this.policy.metadata.name,
      created: this.policy.metadata.created,
      updated: this.policy.metadata.updated,
      didPolicy: {
        allowlistSize: this.policy.didPolicy.allowlist?.length || 0,
        denylistSize: this.policy.didPolicy.denylist?.length || 0,
        requireRegistration: this.policy.didPolicy.requireRegistration
      },
      slsaPolicy: {
        minimumLevel: this.policy.slsaPolicy.minimumLevel,
        requireReproducibleBuild: this.policy.slsaPolicy.requireReproducibleBuild
      },
      cryptographicPolicy: {
        allowedKeyTypes: this.policy.cryptographicPolicy.allowedKeyTypes,
        requireHardwareKeys: this.policy.cryptographicPolicy.requireHardwareKeys
      }
    };
  }
}

/**
 * Trust Store Manager
 * Manages trusted entities and their credentials
 */
export class TrustStore {
  constructor(options = {}) {
    this.storePath = options.storePath || '.kgen/trust-store';
    this.trustedEntities = new Map();
  }

  /**
   * Initialize trust store
   */
  async initialize() {
    await fs.ensureDir(this.storePath);
    await fs.ensureDir(path.join(this.storePath, 'entities'));
    await fs.ensureDir(path.join(this.storePath, 'certificates'));
    await this.loadTrustedEntities();
  }

  /**
   * Add trusted entity
   */
  async addTrustedEntity(did, entityData) {
    const entity = {
      did,
      ...entityData,
      addedAt: new Date().toISOString(),
      trustScore: entityData.trustScore || 0.5,
      verified: entityData.verified || false,
      certificates: entityData.certificates || []
    };

    this.trustedEntities.set(did, entity);
    
    const entityPath = path.join(this.storePath, 'entities', `${this.sanitizeDID(did)}.json`);
    await fs.writeJson(entityPath, entity, { spaces: 2 });

    return entity;
  }

  /**
   * Get trusted entity
   */
  getTrustedEntity(did) {
    return this.trustedEntities.get(did);
  }

  /**
   * Update trust score
   */
  async updateTrustScore(did, newScore, reason) {
    const entity = this.trustedEntities.get(did);
    if (!entity) {
      throw new Error(`Trusted entity not found: ${did}`);
    }

    const oldScore = entity.trustScore;
    entity.trustScore = Math.max(0, Math.min(1, newScore));
    entity.lastScoreUpdate = new Date().toISOString();
    entity.scoreHistory = entity.scoreHistory || [];
    entity.scoreHistory.push({
      oldScore,
      newScore: entity.trustScore,
      reason,
      timestamp: entity.lastScoreUpdate
    });

    this.trustedEntities.set(did, entity);
    
    const entityPath = path.join(this.storePath, 'entities', `${this.sanitizeDID(did)}.json`);
    await fs.writeJson(entityPath, entity, { spaces: 2 });

    return entity;
  }

  /**
   * Load trusted entities from storage
   */
  async loadTrustedEntities() {
    try {
      const entitiesDir = path.join(this.storePath, 'entities');
      const files = await fs.readdir(entitiesDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const entityPath = path.join(entitiesDir, file);
          const entity = await fs.readJson(entityPath);
          this.trustedEntities.set(entity.did, entity);
        }
      }
    } catch (error) {
      // Directory might not exist
    }
  }

  /**
   * Sanitize DID for filename
   */
  sanitizeDID(did) {
    return did.replace(/[^a-zA-Z0-9]/g, '_');
  }

  /**
   * List all trusted entities
   */
  listTrustedEntities() {
    return Array.from(this.trustedEntities.values());
  }
}
