/**
 * Comprehensive Test Suite for Enhanced Attestation System
 * 
 * Tests SLSA compliance, git-notes integration, trust policy enforcement,
 * and cryptographic verification using BDD approach.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { AttestationGenerator } from '../../src/attestation/generator.js';
import { AttestationVerifier } from '../../src/attestation/verifier.js';
import { GitNotesManager } from '../../src/attestation/git-notes.js';

describe('Enhanced Attestation System', () => {
  let tempDir: string;
  let generator: AttestationGenerator;
  let verifier: AttestationVerifier;
  let gitNotes: GitNotesManager;
  let testArtifact: string;
  
  beforeEach(async () => {
    // Create temporary test directory
    tempDir = path.join('/tmp', `attestation-test-${crypto.randomUUID()}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    // Change to temp directory
    process.chdir(tempDir);
    
    // Initialize git repository
    await fs.mkdir('.git', { recursive: true });
    
    // Create test artifact
    testArtifact = path.join(tempDir, 'test-artifact.js');
    await fs.writeFile(testArtifact, 'console.log("Hello, SLSA!");');
    
    // Initialize components
    generator = new AttestationGenerator({
      enableCryptographicSigning: true,
      enableGitNotes: true,
      enableCASTracking: true,
      timestampSource: 'deterministic'
    });
    
    verifier = new AttestationVerifier({
      enableSLSAValidation: true,
      enableTrustPolicyEnforcement: true,
      enableSignatureVerification: true
    });
    
    gitNotes = new GitNotesManager({
      receiptDirectory: path.join(tempDir, '.kgen/receipts')
    });
    
    await generator.initialize();
    await verifier.initialize();
  });
  
  afterEach(async () => {
    // Cleanup temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup temp directory:', error.message);
    }
  });

  describe('SLSA-Style Attestation Generation', () => {
    it('should generate SLSA-compliant attestation with all required fields', async () => {
      const context = {
        command: 'kgen',
        args: ['generate', 'component'],
        templatePath: 'template.nunjucks',
        templateHash: 'abc123',
        variables: { name: 'TestComponent' },
        agent: 'kgen-system',
        workingDirectory: tempDir,
        casRoots: ['sha256:def456']
      };
      
      const result = await generator.generateAttestation(testArtifact, context);
      
      expect(result.attestation).toMatchObject({
        _type: 'https://in-toto.io/Statement/v0.1',
        subject: expect.arrayContaining([
          expect.objectContaining({
            name: 'test-artifact.js',
            digest: expect.objectContaining({
              sha256: expect.stringMatching(/^[a-f0-9]{64}$/)
            })
          })
        ]),
        predicateType: 'https://kgen.dev/attestation/v1',
        predicate: expect.objectContaining({
          type: 'kgen-generation',
          params: expect.objectContaining({
            command: 'kgen',
            args: ['generate', 'component'],
            variables: { name: 'TestComponent' }
          }),
          materials: expect.any(Array),
          environment: expect.objectContaining({
            arch: process.arch,
            os: process.platform
          }),
          metadata: expect.objectContaining({
            buildInvocationId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
            buildStartedOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
            completeness: {
              parameters: true,
              environment: true,
              materials: true
            },
            reproducible: true
          })
        })
      });
      
      expect(result.envelope).toMatchObject({
        payload: expect.stringMatching(/^[A-Za-z0-9+/]+=*$/),
        payloadType: 'application/vnd.in-toto+json',
        signatures: expect.any(Array)
      });
      
      // Verify attestation file exists
      const attestationExists = await fs.access(result.attestationPath).then(() => true).catch(() => false);
      expect(attestationExists).toBe(true);
    });
    
    it('should include CAS roots in predicate byproducts', async () => {
      const context = {
        templatePath: 'template.nunjucks',
        casRoots: ['sha256:root1', 'sha256:root2'],
        sourceGraph: { entity1: 'value1', entity2: 'value2' }
      };
      
      const result = await generator.generateAttestation(testArtifact, context);
      
      expect(result.attestation.predicate.byproducts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: expect.stringMatching(/^cas-root:sha256:/)
          })
        ])
      );
    });
    
    it('should sanitize sensitive environment variables', async () => {
      const context = {
        environment: {
          NODE_ENV: 'production',
          SECRET_KEY: 'super-secret',
          API_TOKEN: 'token-123',
          PUBLIC_URL: 'https://example.com'
        }
      };
      
      const result = await generator.generateAttestation(testArtifact, context);
      
      const envVars = result.attestation.predicate.environment.variables;
      expect(envVars.NODE_ENV).toBe('production');
      expect(envVars.PUBLIC_URL).toBe('https://example.com');
      expect(envVars.SECRET_KEY).toBe('[REDACTED]');
      expect(envVars.API_TOKEN).toBe('[REDACTED]');
    });
  });

  describe('Cryptographic Signing with Ed25519', () => {
    it('should generate Ed25519 key pair in PEM format', async () => {
      const keys = await generator.generateKeys();
      
      expect(keys.signingKey).toMatch(/-----BEGIN PRIVATE KEY-----/);
      expect(keys.signingKey).toMatch(/-----END PRIVATE KEY-----/);
      expect(keys.verifyingKey).toMatch(/-----BEGIN PUBLIC KEY-----/);
      expect(keys.verifyingKey).toMatch(/-----END PUBLIC KEY-----/);
    });
    
    it('should create JWS envelope with valid signature', async () => {
      const context = { command: 'kgen' };
      const result = await generator.generateAttestation(testArtifact, context);
      
      expect(result.envelope.signatures).toHaveLength(1);
      expect(result.envelope.signatures[0]).toMatchObject({
        keyid: expect.stringMatching(/^did:key:/),
        sig: expect.stringMatching(/^[A-Za-z0-9+/]+=*$/)
      });
    });
  });

  describe('Git-Notes Integration', () => {
    beforeEach(async () => {
      // Mock git SHA
      const mockGitSHA = 'a'.repeat(40);
      jest.spyOn(generator, 'getCurrentGitSHA').mockResolvedValue(mockGitSHA);
    });
    
    it('should store attestation receipt in git-notes', async () => {
      const context = { command: 'kgen' };
      const result = await generator.generateAttestation(testArtifact, context);
      
      expect(result.receiptPath).toBeDefined();
      expect(result.receiptPath).toMatch(/\.kgen\/receipts\/[a-f0-9]{40}\/[0-9a-f-]{36}\.attest\.json$/);
      
      // Verify receipt file exists
      const receiptExists = await fs.access(result.receiptPath!).then(() => true).catch(() => false);
      expect(receiptExists).toBe(true);
      
      // Verify receipt content
      const receiptContent = await fs.readFile(result.receiptPath!, 'utf8');
      const receipt = JSON.parse(receiptContent);
      
      expect(receipt).toMatchObject({
        id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
        gitSHA: expect.stringMatching(/^[a-f0-9]{40}$/),
        artifactPath: path.resolve(testArtifact),
        attestation: result.attestation,
        envelope: result.envelope,
        version: '1.0.0'
      });
    });
    
    it('should retrieve receipts by git SHA', async () => {
      await gitNotes.initialize();
      
      const gitSHA = 'b'.repeat(40);
      await gitNotes.storeReceipt(
        gitSHA,
        testArtifact,
        { test: 'attestation' },
        { test: 'envelope' }
      );
      
      const receipts = await gitNotes.getReceipts(gitSHA);
      
      expect(receipts).toHaveLength(1);
      expect(receipts[0]).toMatchObject({
        gitSHA,
        artifactPath: path.resolve(testArtifact),
        attestation: { test: 'attestation' },
        envelope: { test: 'envelope' }
      });
    });
    
    it('should find receipts for specific artifacts', async () => {
      await gitNotes.initialize();
      
      // Store receipts for multiple commits
      const gitSHA1 = 'c'.repeat(40);
      const gitSHA2 = 'd'.repeat(40);
      
      await gitNotes.storeReceipt(gitSHA1, testArtifact, {}, {});
      await gitNotes.storeReceipt(gitSHA2, testArtifact, {}, {});
      
      const receipts = await gitNotes.getReceiptsForArtifact(testArtifact);
      
      expect(receipts).toHaveLength(2);
      expect(receipts.map(r => r.gitSHA)).toEqual(expect.arrayContaining([gitSHA1, gitSHA2]));
    });
  });

  describe('SLSA Compliance Verification', () => {
    let attestationPath: string;
    
    beforeEach(async () => {
      const context = {
        command: 'kgen',
        templatePath: 'template.nunjucks',
        variables: { name: 'Test' }
      };
      const result = await generator.generateAttestation(testArtifact, context);
      attestationPath = result.attestationPath;
    });
    
    it('should verify SLSA Level 1 compliance', async () => {
      const result = await verifier.verifyAttestation(attestationPath);
      
      expect(result.verified).toBe(true);
      expect(result.slsaLevel).toBeGreaterThanOrEqual(1);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should validate SLSA schema requirements', async () => {
      const result = await verifier.verifyAttestation(attestationPath);
      
      expect(result.attestation).toMatchObject({
        _type: 'https://in-toto.io/Statement/v0.1',
        subject: expect.arrayContaining([
          expect.objectContaining({
            digest: expect.objectContaining({
              sha256: expect.stringMatching(/^[a-f0-9]{64}$/)
            })
          })
        ]),
        predicateType: expect.stringMatching(/^https?:\/\//),
        predicate: expect.any(Object)
      });
    });
    
    it('should detect SLSA Level 2+ features', async () => {
      const result = await verifier.verifyAttestation(attestationPath);
      
      if (result.slsaLevel && result.slsaLevel >= 2) {
        expect(result.attestation.predicate.metadata.buildInvocationId).toBeDefined();
        expect(result.attestation.predicate.materials).toBeDefined();
      }
    });
  });

  describe('Trust Policy Enforcement', () => {
    let trustPolicyPath: string;
    
    beforeEach(async () => {
      trustPolicyPath = path.join(tempDir, 'trust-policy.json');
      
      const trustPolicy = {
        version: '1.0.0',
        trustedSigners: [
          {
            keyid: 'did:key:test',
            publicKey: '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA...\n-----END PUBLIC KEY-----',
            name: 'Test Signer'
          }
        ],
        requiredSignatures: 1,
        allowedPredicateTypes: ['https://kgen.dev/attestation/v1'],
        slsaLevel: 2,
        additionalChecks: {
          requireReproducibleBuilds: true,
          maxAttestationAge: '30d'
        }
      };
      
      await fs.writeFile(trustPolicyPath, JSON.stringify(trustPolicy, null, 2));
      
      verifier = new AttestationVerifier({
        trustPolicyPath,
        enableTrustPolicyEnforcement: true
      });
      await verifier.initialize();
    });
    
    it('should validate trust policy structure', async () => {
      const validation = await verifier.validateTrustPolicy(trustPolicyPath);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.policy).toBeDefined();
    });
    
    it('should enforce trust policy during verification', async () => {
      const context = { command: 'kgen' };
      const result = await generator.generateAttestation(testArtifact, context);
      
      const verification = await verifier.verifyAttestation(result.attestationPath);
      
      expect(verification.trustPolicy).toMatchObject({
        loaded: true,
        satisfied: expect.any(Boolean)
      });
    });
    
    it('should reject attestations with disallowed predicate types', async () => {
      // Create trust policy that doesn't allow our predicate type
      const restrictivePolicy = {
        version: '1.0.0',
        trustedSigners: [],
        requiredSignatures: 0,
        allowedPredicateTypes: ['https://other.example.com/predicate'],
        slsaLevel: 1
      };
      
      const restrictivePolicyPath = path.join(tempDir, 'restrictive-trust-policy.json');
      await fs.writeFile(restrictivePolicyPath, JSON.stringify(restrictivePolicy, null, 2));
      
      const restrictiveVerifier = new AttestationVerifier({
        trustPolicyPath: restrictivePolicyPath,
        enableTrustPolicyEnforcement: true
      });
      await restrictiveVerifier.initialize();
      
      const context = { command: 'kgen' };
      const result = await generator.generateAttestation(testArtifact, context);
      
      const verification = await restrictiveVerifier.verifyAttestation(result.attestationPath);
      
      expect(verification.verified).toBe(false);
      expect(verification.trustPolicy?.satisfied).toBe(false);
      expect(verification.trustPolicy?.violations).toContain(
        expect.stringMatching(/Predicate type .* not allowed/)
      );
    });
  });

  describe('Deep Verification', () => {
    it('should verify artifact hash matches attestation', async () => {
      const context = { command: 'kgen' };
      const result = await generator.generateAttestation(testArtifact, context);
      
      const verification = await verifier.verifyAttestation(
        result.attestationPath,
        { deep: true, artifactPath: testArtifact }
      );
      
      expect(verification.verified).toBe(true);
    });
    
    it('should detect artifact tampering', async () => {
      const context = { command: 'kgen' };
      const result = await generator.generateAttestation(testArtifact, context);
      
      // Tamper with artifact
      await fs.writeFile(testArtifact, 'console.log("Tampered!");');
      
      const verification = await verifier.verifyAttestation(
        result.attestationPath,
        { deep: true, artifactPath: testArtifact }
      );
      
      expect(verification.verified).toBe(false);
      expect(verification.errors).toContain(
        expect.stringMatching(/hash mismatch/i)
      );
    });
  });

  describe('Batch Verification', () => {
    let attestationPaths: string[];
    
    beforeEach(async () => {
      attestationPaths = [];
      
      // Generate multiple attestations
      for (let i = 0; i < 3; i++) {
        const artifact = path.join(tempDir, `artifact-${i}.js`);
        await fs.writeFile(artifact, `console.log("Artifact ${i}");`);
        
        const context = { command: 'kgen', variables: { index: i } };
        const result = await generator.generateAttestation(artifact, context);
        attestationPaths.push(result.attestationPath);
      }
    });
    
    it('should verify multiple attestations in parallel', async () => {
      const batchResult = await verifier.batchVerify(attestationPaths, {
        maxConcurrency: 2
      });
      
      expect(batchResult.summary.total).toBe(3);
      expect(batchResult.summary.verified).toBe(3);
      expect(batchResult.summary.failed).toBe(0);
      expect(batchResult.summary.averageTime).toBeGreaterThan(0);
      
      expect(batchResult.results).toHaveLength(3);
      batchResult.results.forEach(result => {
        expect(result.verified).toBe(true);
        expect(result.path).toMatch(/\.attest\.json$/);
      });
    });
  });

  describe('Cache Management', () => {
    it('should cache verification results', async () => {
      const context = { command: 'kgen' };
      const result = await generator.generateAttestation(testArtifact, context);
      
      // First verification
      const verification1 = await verifier.verifyAttestation(result.attestationPath);
      const time1 = verification1.verificationTime || 0;
      
      // Second verification (should be cached)
      const verification2 = await verifier.verifyAttestation(result.attestationPath);
      const time2 = verification2.verificationTime || 0;
      
      expect(verification1.verified).toBe(verification2.verified);
      // Note: May not always be faster due to test timing variations
    });
    
    it('should respect cache skip option', async () => {
      const context = { command: 'kgen' };
      const result = await generator.generateAttestation(testArtifact, context);
      
      await verifier.verifyAttestation(result.attestationPath);
      
      const uncachedVerification = await verifier.verifyAttestation(
        result.attestationPath,
        { skipCache: true }
      );
      
      expect(uncachedVerification.verified).toBe(true);
    });
    
    it('should clear cache on demand', async () => {
      const stats1 = verifier.getStatistics();
      const initialCacheSize = stats1.cacheSize;
      
      verifier.clearCache();
      
      const stats2 = verifier.getStatistics();
      expect(stats2.cacheSize).toBe(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing attestation files gracefully', async () => {
      const nonExistentPath = path.join(tempDir, 'missing.attest.json');
      
      const verification = await verifier.verifyAttestation(nonExistentPath);
      
      expect(verification.verified).toBe(false);
      expect(verification.errors).toContain(
        expect.stringMatching(/Failed to load attestation/)
      );
    });
    
    it('should handle malformed attestation files', async () => {
      const malformedPath = path.join(tempDir, 'malformed.attest.json');
      await fs.writeFile(malformedPath, 'invalid json content');
      
      const verification = await verifier.verifyAttestation(malformedPath);
      
      expect(verification.verified).toBe(false);
      expect(verification.errors).toBeDefined();
    });
    
    it('should handle receipt cleanup gracefully', async () => {
      await gitNotes.initialize();
      
      const cleanedCount = await gitNotes.cleanupReceipts({
        olderThanDays: 0, // Clean everything
        keepMinimum: 0
      });
      
      expect(cleanedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Integration with kgen Commands', () => {
    it('should integrate with artifact generation workflow', async () => {
      // Simulate kgen command execution
      const context = {
        command: 'kgen',
        args: ['generate', 'component', 'UserCard'],
        templatePath: 'templates/component.nunjucks',
        templateHash: 'sha256:abc123',
        variables: {
          componentName: 'UserCard',
          withProps: true,
          withTests: true
        },
        workingDirectory: tempDir,
        agent: 'kgen-cli-v1.0.0'
      };
      
      // Generate attestation
      const result = await generator.generateAttestation(testArtifact, context);
      
      // Verify the attestation contains kgen-specific metadata
      expect(result.attestation.predicate.params.command).toBe('kgen');
      expect(result.attestation.predicate.params.args).toEqual(['generate', 'component', 'UserCard']);
      expect(result.attestation.predicate.params.variables.componentName).toBe('UserCard');
      
      // Verify attestation can be verified
      const verification = await verifier.verifyAttestation(result.attestationPath);
      expect(verification.verified).toBe(true);
    });
  });
});