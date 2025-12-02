/**
 * Test Suite for Attestation Chain Validation System
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  SLSAValidator,
  AttestationChainValidator,
  CertificateTransparencyManager
} from '../../src/trust/validation.js';
import { TrustPolicyEngine } from '../../src/trust/policy-engine.js';

describe('SLSA Validator', () => {
  let slsaValidator;

  beforeEach(() => {
    slsaValidator = new SLSAValidator();
  });

  describe('SLSA Level 1 Validation', () => {
    test('should validate compliant SLSA Level 1 attestation', async () => {
      const attestation = {
        buildPlatform: 'github-actions',
        buildSteps: [
          { name: 'checkout', command: 'git checkout' },
          { name: 'build', command: 'npm run build' }
        ],
        provenance: {
          buildId: 'build-123',
          timestamp: new Date().toISOString()
        }
      };

      const result = await slsaValidator.validateSLSALevel(attestation, 'SLSA_LEVEL_1');
      
      assert.strictEqual(result.compliant, true);
      assert.strictEqual(result.level, 'SLSA_LEVEL_1');
      assert.strictEqual(result.violations.length, 0);
      assert.ok(result.checks.buildPlatform.valid);
      assert.ok(result.checks.buildSteps.valid);
      assert.ok(result.checks.provenance.valid);
    });

    test('should detect non-compliant SLSA Level 1 attestation', async () => {
      const attestation = {
        buildPlatform: 'unknown-platform',
        buildSteps: [], // Empty build steps
        provenance: null // Missing provenance
      };

      const result = await slsaValidator.validateSLSALevel(attestation, 'SLSA_LEVEL_1');
      
      assert.strictEqual(result.compliant, false);
      assert.ok(result.violations.length > 0);
    });
  });

  describe('SLSA Level 2 Validation', () => {
    test('should validate compliant SLSA Level 2 attestation', async () => {
      const attestation = {
        buildPlatform: 'github-actions',
        buildSteps: [{ name: 'build', command: 'make build' }],
        provenance: {
          signature: 'signature-data',
          certificate: 'cert-data'
        },
        buildService: 'github-actions',
        sourceIntegrity: {
          commitSha: 'abc123def456',
          repositoryUri: 'https://github.com/example/repo',
          verified: true
        }
      };

      const result = await slsaValidator.validateSLSALevel(attestation, 'SLSA_LEVEL_2');
      
      assert.strictEqual(result.compliant, true);
      assert.ok(result.checks.buildService.valid);
      assert.ok(result.checks.sourceIntegrity.valid);
    });

    test('should require authenticated provenance for Level 2', async () => {
      const attestation = {
        buildPlatform: 'github-actions',
        buildSteps: [{ name: 'build' }],
        provenance: { buildId: 'build-123' }, // Missing signature and certificate
        buildService: 'github-actions',
        sourceIntegrity: {
          commitSha: 'abc123',
          repositoryUri: 'https://github.com/example/repo',
          verified: true
        }
      };

      const result = await slsaValidator.validateSLSALevel(attestation, 'SLSA_LEVEL_2');
      
      assert.strictEqual(result.compliant, false);
      assert.ok(result.violations.some(v => v.check === 'provenance'));
    });
  });

  describe('SLSA Level 3 Validation', () => {
    test('should validate compliant SLSA Level 3 attestation', async () => {
      const attestation = {
        buildPlatform: 'github-actions-hardened',
        buildSteps: [{ name: 'build', command: 'bazel build' }],
        provenance: {
          signature: 'signature-data',
          certificate: 'cert-data'
        },
        buildService: 'github-actions-isolated',
        sourceIntegrity: {
          commitSha: 'abc123def456',
          repositoryUri: 'https://github.com/example/repo',
          verified: true
        },
        buildReproducible: true
      };

      const result = await slsaValidator.validateSLSALevel(attestation, 'SLSA_LEVEL_3');
      
      assert.strictEqual(result.compliant, true);
      assert.ok(result.checks.buildReproducible.valid);
    });

    test('should require reproducible build for Level 3', async () => {
      const attestation = {
        buildPlatform: 'github-actions-hardened',
        buildSteps: [{ name: 'build' }],
        provenance: { signature: 'sig', certificate: 'cert' },
        buildService: 'github-actions-isolated',
        sourceIntegrity: { commitSha: 'abc', repositoryUri: 'repo', verified: true },
        buildReproducible: false // Not reproducible
      };

      const result = await slsaValidator.validateSLSALevel(attestation, 'SLSA_LEVEL_3');
      
      assert.strictEqual(result.compliant, false);
      assert.ok(result.violations.some(v => v.check === 'buildReproducible'));
    });
  });

  describe('SLSA Level 4 Validation', () => {
    test('should validate compliant SLSA Level 4 attestation', async () => {
      const attestation = {
        buildPlatform: 'github-actions-hardened',
        buildSteps: [{ name: 'hermetic-build', command: 'bazel build --hermetic' }],
        provenance: {
          signature: 'signature-data',
          certificate: 'cert-data'
        },
        buildService: 'bazel-remote',
        sourceIntegrity: {
          commitSha: 'abc123def456',
          repositoryUri: 'https://github.com/example/repo',
          verified: true
        },
        buildReproducible: true,
        twoPersonReview: {
          reviewers: ['alice@example.com', 'bob@example.com']
        }
      };

      const result = await slsaValidator.validateSLSALevel(attestation, 'SLSA_LEVEL_4');
      
      assert.strictEqual(result.compliant, true);
      assert.ok(result.checks.twoPersonReview.valid);
    });

    test('should require two-person review for Level 4', async () => {
      const attestation = {
        buildPlatform: 'github-actions-hardened',
        buildSteps: [{ name: 'build' }],
        provenance: { signature: 'sig', certificate: 'cert' },
        buildService: 'bazel-remote',
        sourceIntegrity: { commitSha: 'abc', repositoryUri: 'repo', verified: true },
        buildReproducible: true,
        twoPersonReview: {
          reviewers: ['alice@example.com'] // Only one reviewer
        }
      };

      const result = await slsaValidator.validateSLSALevel(attestation, 'SLSA_LEVEL_4');
      
      assert.strictEqual(result.compliant, false);
      assert.ok(result.violations.some(v => v.check === 'twoPersonReview'));
    });
  });
});

describe('Attestation Chain Validator', () => {
  let chainValidator;

  beforeEach(() => {
    chainValidator = new AttestationChainValidator();
  });

  describe('Single Attestation Validation', () => {
    test('should validate well-formed attestation', async () => {
      const attestation = {
        id: 'attestation-123',
        type: 'KPackAttestation',
        issuer: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
        subject: 'did:key:z6MkpTHR2VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH',
        timestamp: new Date().toISOString(),
        signature: 'mock-signature-data',
        publicKey: 'mock-public-key',
        algorithm: 'EdDSA'
      };

      const result = await chainValidator.validateSingleAttestation(attestation);
      
      assert.strictEqual(result.valid, true);
      assert.ok(result.checks.structure.valid);
      assert.ok(result.checks.signature.valid);
    });

    test('should detect missing required fields', async () => {
      const attestation = {
        id: 'attestation-456',
        type: 'KPackAttestation'
        // Missing issuer, subject, timestamp, signature
      };

      const result = await chainValidator.validateSingleAttestation(attestation);
      
      assert.strictEqual(result.valid, false);
      assert.ok(result.violations.some(v => v.check === 'structure'));
    });

    test('should validate SLSA compliance when present', async () => {
      const attestation = {
        id: 'attestation-789',
        type: 'KPackAttestation',
        issuer: 'did:key:issuer',
        subject: 'did:key:subject',
        timestamp: new Date().toISOString(),
        signature: 'mock-signature',
        publicKey: 'mock-public-key',
        slsaLevel: 'SLSA_LEVEL_2',
        buildPlatform: 'github-actions',
        buildSteps: [{ name: 'build' }],
        provenance: { signature: 'sig', certificate: 'cert' },
        buildService: 'github-actions',
        sourceIntegrity: { commitSha: 'abc', repositoryUri: 'repo', verified: true }
      };

      const result = await chainValidator.validateSingleAttestation(attestation);
      
      assert.strictEqual(result.valid, true);
      assert.ok(result.checks.slsa);
    });
  });

  describe('Chain Continuity Validation', () => {
    test('should validate proper chain continuity', () => {
      const attestationChain = [
        {
          id: 'root-attestation',
          issuer: 'did:key:root',
          subject: 'did:key:intermediate',
          timestamp: '2023-01-01T10:00:00Z'
        },
        {
          id: 'intermediate-attestation',
          issuer: 'did:key:intermediate',
          subject: 'did:key:leaf',
          timestamp: '2023-01-01T11:00:00Z'
        },
        {
          id: 'leaf-attestation',
          issuer: 'did:key:leaf',
          subject: 'did:key:final',
          timestamp: '2023-01-01T12:00:00Z'
        }
      ];

      const result = chainValidator.validateChainContinuity(attestationChain);
      
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.violations.length, 0);
    });

    test('should detect chain breaks', () => {
      const attestationChain = [
        {
          id: 'root-attestation',
          issuer: 'did:key:root',
          subject: 'did:key:intermediate',
          timestamp: '2023-01-01T10:00:00Z'
        },
        {
          id: 'broken-chain',
          issuer: 'did:key:different', // Should be did:key:intermediate
          subject: 'did:key:leaf',
          timestamp: '2023-01-01T11:00:00Z'
        }
      ];

      const result = chainValidator.validateChainContinuity(attestationChain);
      
      assert.strictEqual(result.valid, false);
      assert.ok(result.violations.some(v => v.reason.includes('Chain break')));
    });

    test('should detect temporal violations', () => {
      const attestationChain = [
        {
          id: 'first',
          issuer: 'did:key:issuer1',
          subject: 'did:key:subject1',
          timestamp: '2023-01-01T12:00:00Z' // Later timestamp
        },
        {
          id: 'second',
          issuer: 'did:key:subject1',
          subject: 'did:key:subject2',
          timestamp: '2023-01-01T10:00:00Z' // Earlier timestamp
        }
      ];

      const result = chainValidator.validateChainContinuity(attestationChain);
      
      assert.strictEqual(result.valid, false);
      assert.ok(result.violations.some(v => v.reason.includes('Temporal violation')));
    });
  });

  describe('Complete Chain Validation', () => {
    test('should validate complete attestation chain', async () => {
      const attestationChain = [
        {
          id: 'root-attestation',
          type: 'RootAttestation',
          issuer: 'did:key:root',
          subject: 'did:key:intermediate',
          timestamp: '2023-01-01T10:00:00Z',
          signature: 'mock-root-signature',
          publicKey: 'mock-root-key'
        },
        {
          id: 'leaf-attestation',
          type: 'KPackAttestation',
          issuer: 'did:key:intermediate',
          subject: 'did:key:kpack',
          timestamp: '2023-01-01T11:00:00Z',
          signature: 'mock-leaf-signature',
          publicKey: 'mock-leaf-key'
        }
      ];

      const result = await chainValidator.validateAttestationChain(attestationChain);
      
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.chainLength, 2);
      assert.strictEqual(result.validations.length, 3); // 2 attestations + chain continuity
      assert.ok(['trusted', 'partially_trusted'].includes(result.trustLevel));
    });
  });

  describe('Trust Level Calculation', () => {
    test('should calculate trusted level for clean validation', () => {
      const validation = {
        valid: true,
        violations: []
      };

      const trustLevel = chainValidator.calculateTrustLevel(validation);
      assert.strictEqual(trustLevel, 'trusted');
    });

    test('should calculate partially trusted for warnings only', () => {
      const validation = {
        valid: true,
        violations: [
          { severity: 'warning', reason: 'Minor issue' }
        ]
      };

      const trustLevel = chainValidator.calculateTrustLevel(validation);
      assert.strictEqual(trustLevel, 'partially_trusted');
    });

    test('should calculate untrusted for errors', () => {
      const validation = {
        valid: false,
        violations: [
          { severity: 'error', reason: 'Critical issue' }
        ]
      };

      const trustLevel = chainValidator.calculateTrustLevel(validation);
      assert.strictEqual(trustLevel, 'untrusted');
    });
  });
});

describe('Certificate Transparency Manager', () => {
  let ctManager;

  beforeEach(() => {
    ctManager = new CertificateTransparencyManager();
  });

  test('should submit certificate to CT logs', async () => {
    const certificate = {
      subject: 'CN=Test Certificate',
      issuer: 'CN=Test CA',
      serialNumber: '12345',
      notBefore: new Date().toISOString(),
      notAfter: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    };

    const submissions = await ctManager.submitCertificate(certificate);
    
    assert.ok(Array.isArray(submissions));
    assert.ok(submissions.length > 0);
    
    // Check that we have submissions for multiple logs
    const successfulSubmissions = submissions.filter(s => s.success);
    assert.ok(successfulSubmissions.length > 0);
    
    // Check SCT structure
    const sct = successfulSubmissions[0].sct;
    assert.strictEqual(sct.version, 1);
    assert.ok(sct.logId);
    assert.ok(sct.timestamp);
    assert.ok(sct.signature);
  });

  test('should verify SCT', async () => {
    const sct = {
      version: 1,
      logId: 'test-log-id',
      timestamp: Date.now(),
      signature: 'test-signature'
    };

    const certificate = { subject: 'CN=Test' };
    
    const verification = await ctManager.verifySCT(sct, certificate);
    
    assert.strictEqual(verification.valid, true);
    assert.strictEqual(verification.logId, sct.logId);
    assert.strictEqual(verification.timestamp, sct.timestamp);
  });

  test('should handle CT log submission failures gracefully', async () => {
    // Test with invalid certificate data
    const invalidCertificate = null;
    
    const submissions = await ctManager.submitCertificate(invalidCertificate);
    
    // Should still return results, but some may have failed
    assert.ok(Array.isArray(submissions));
    
    // At least one submission should indicate failure handling
    const hasFailureHandling = submissions.some(s => s.hasOwnProperty('success'));
    assert.ok(hasFailureHandling);
  });
});
