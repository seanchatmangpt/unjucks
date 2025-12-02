/**
 * @fileoverview Tests for package verification and trust validation
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { PackageVerifier, createPackageVerifier, verifyPackage, createDefaultTrustPolicy, saveTrustPolicy } from '../../src/pack/verifier.js';
import { PackageSigner } from '../../src/pack/signer.js';
import { exampleKPackManifest, createContentAddress } from '../../src/types/kpack.js';

describe('PackageVerifier', () => {
  let tempDir: string;
  let verifier: PackageVerifier;
  let signer: PackageSigner;
  let keyPair: any;
  let contentAddress: any;
  let trustPolicyPath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kgen-verifier-test-'));
    verifier = new PackageVerifier();
    signer = new PackageSigner();
    keyPair = await signer.generateKeyPair();
    contentAddress = await createContentAddress('test package content', 'sha256');
    trustPolicyPath = path.join(tempDir, 'trust-policy.json');

    // Create basic trust policy
    const trustPolicy = createDefaultTrustPolicy();
    trustPolicy.trustedKeys.push({
      fingerprint: keyPair.fingerprint,
      publicKey: keyPair.publicKeyJWK,
      owner: 'test-publisher',
      validFrom: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
      purpose: ['signing', 'attestation']
    });
    trustPolicy.trustedPublishers.push({
      id: 'test-publisher',
      name: 'Test Publisher',
      publicKeys: [keyPair.fingerprint]
    });

    await saveTrustPolicy(trustPolicy, trustPolicyPath);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Trust Policy Management', () => {
    it('should load trust policy from file', async () => {
      const policy = await verifier.loadTrustPolicy(trustPolicyPath);

      expect(policy.version).toBe('1.0.0');
      expect(policy.trustedKeys).toHaveLength(1);
      expect(policy.trustedPublishers).toHaveLength(1);
      expect(policy.requirements).toBeDefined();
      expect(policy.metadata).toBeDefined();
    });

    it('should create default trust policy', () => {
      const policy = createDefaultTrustPolicy();

      expect(policy.version).toBe('1.0.0');
      expect(policy.trustedKeys).toEqual([]);
      expect(policy.trustedPublishers).toEqual([]);
      expect(policy.requirements.minimumSignatures).toBe(1);
      expect(policy.requirements.allowedAlgorithms).toContain('EdDSA');
      expect(policy.metadata.name).toContain('Default');
    });

    it('should save trust policy to file', async () => {
      const policy = createDefaultTrustPolicy();
      const policyPath = path.join(tempDir, 'new-policy.json');

      await saveTrustPolicy(policy, policyPath);

      const fileExists = await fs.access(policyPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      const loadedPolicy = await verifier.loadTrustPolicy(policyPath);
      expect(loadedPolicy).toEqual(policy);
    });

    it('should reject invalid trust policy format', async () => {
      const invalidPolicyPath = path.join(tempDir, 'invalid-policy.json');
      await fs.writeFile(invalidPolicyPath, JSON.stringify({ invalid: 'policy' }));

      await expect(verifier.loadTrustPolicy(invalidPolicyPath)).rejects.toThrow('Invalid trust policy format');
    });
  });

  describe('Signature Verification', () => {
    it('should verify valid signature bundle', async () => {
      const bundle = await signer.createSignatureBundle(
        exampleKPackManifest,
        {
          privateKey: keyPair.privateKey,
          publisherId: 'test-publisher',
          contentAddress,
          manifest: exampleKPackManifest
        }
      );

      const trustPolicy = await verifier.loadTrustPolicy(trustPolicyPath);
      const result = await verifier.verifySignatureBundle(bundle, contentAddress, {
        trustPolicy
      });

      expect(result.valid).toBe(true);
      expect(result.signatures).toHaveLength(1);
      expect(result.signatures[0].valid).toBe(true);
      expect(result.signatures[0].trusted).toBe(true);
      expect(result.attestations).toHaveLength(2);
      expect(result.trustScore).toBeGreaterThan(0.5);
    });

    it('should reject signatures with wrong content hash', async () => {
      const bundle = await signer.createSignatureBundle(
        exampleKPackManifest,
        {
          privateKey: keyPair.privateKey,
          publisherId: 'test-publisher',
          contentAddress,
          manifest: exampleKPackManifest
        }
      );

      const wrongContentAddress = await createContentAddress('different content', 'sha256');
      const trustPolicy = await verifier.loadTrustPolicy(trustPolicyPath);

      const result = await verifier.verifySignatureBundle(bundle, wrongContentAddress, {
        trustPolicy
      });

      expect(result.valid).toBe(false);
      expect(result.signatures[0].valid).toBe(false);
      expect(result.signatures[0].error).toContain('Content hash mismatch');
    });

    it('should reject expired signatures', async () => {
      const expiredTimestamp = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000); // 2 years ago

      const bundle = await signer.createSignatureBundle(
        exampleKPackManifest,
        {
          privateKey: keyPair.privateKey,
          publisherId: 'test-publisher',
          contentAddress,
          manifest: exampleKPackManifest,
          timestamp: expiredTimestamp
        }
      );

      const trustPolicy = await verifier.loadTrustPolicy(trustPolicyPath);
      const result = await verifier.verifySignatureBundle(bundle, contentAddress, {
        trustPolicy
      });

      expect(result.valid).toBe(false);
      expect(result.signatures[0].valid).toBe(false);
      expect(result.signatures[0].error).toContain('too old');
    });

    it('should allow expired signatures when context allows', async () => {
      const expiredTimestamp = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000); // 2 years ago

      const bundle = await signer.createSignatureBundle(
        exampleKPackManifest,
        {
          privateKey: keyPair.privateKey,
          publisherId: 'test-publisher',
          contentAddress,
          manifest: exampleKPackManifest,
          timestamp: expiredTimestamp
        }
      );

      const trustPolicy = await verifier.loadTrustPolicy(trustPolicyPath);
      const result = await verifier.verifySignatureBundle(bundle, contentAddress, {
        trustPolicy,
        allowExpired: true
      });

      expect(result.signatures[0].valid).toBe(true);
      expect(result.signatures[0].warnings).toContain('Signature is expired but allowed by context');
    });

    it('should reject signatures from untrusted keys', async () => {
      const untrustedKeyPair = await signer.generateKeyPair();

      const bundle = await signer.createSignatureBundle(
        exampleKPackManifest,
        {
          privateKey: untrustedKeyPair.privateKey,
          publisherId: 'untrusted-publisher',
          contentAddress,
          manifest: exampleKPackManifest
        }
      );

      const trustPolicy = await verifier.loadTrustPolicy(trustPolicyPath);
      const result = await verifier.verifySignatureBundle(bundle, contentAddress, {
        trustPolicy
      });

      expect(result.signatures[0].valid).toBe(true); // Signature is cryptographically valid
      expect(result.signatures[0].trusted).toBe(false); // But not trusted
      expect(result.valid).toBe(false); // Overall result is invalid due to policy
    });

    it('should reject disallowed algorithms', async () => {
      const trustPolicy = await verifier.loadTrustPolicy(trustPolicyPath);
      trustPolicy.requirements.allowedAlgorithms = ['RS256']; // Exclude EdDSA
      await saveTrustPolicy(trustPolicy, trustPolicyPath);

      const bundle = await signer.createSignatureBundle(
        exampleKPackManifest,
        {
          privateKey: keyPair.privateKey,
          publisherId: 'test-publisher',
          contentAddress,
          manifest: exampleKPackManifest
        }
      );

      const result = await verifier.verifySignatureBundle(bundle, contentAddress, {
        trustPolicy
      });

      expect(result.signatures[0].valid).toBe(false);
      expect(result.signatures[0].error).toContain('Algorithm EdDSA not allowed');
    });
  });

  describe('Attestation Verification', () => {
    it('should verify attestations in signature bundle', async () => {
      const bundle = await signer.createSignatureBundle(
        exampleKPackManifest,
        {
          privateKey: keyPair.privateKey,
          publisherId: 'test-publisher',
          contentAddress,
          manifest: exampleKPackManifest
        }
      );

      const trustPolicy = await verifier.loadTrustPolicy(trustPolicyPath);
      const result = await verifier.verifySignatureBundle(bundle, contentAddress, {
        trustPolicy
      });

      expect(result.attestations).toHaveLength(2);
      expect(result.attestations[0].valid).toBe(true);
      expect(result.attestations[1].valid).toBe(true);

      // Check default attestation types
      const attestationTypes = bundle.attestations.map(att => att.claims[0].type);
      expect(attestationTypes).toContain('publisher-identity');
      expect(attestationTypes).toContain('content-integrity');
    });

    it('should validate attestation claims', async () => {
      const customClaims = [{
        type: 'code-review',
        subject: exampleKPackManifest.name,
        predicate: 'passed-security-review',
        confidence: 0.95
      }];

      const attestation = await signer.createAttestation(
        {
          contentAddress,
          name: exampleKPackManifest.name,
          version: exampleKPackManifest.version
        },
        customClaims,
        {
          privateKey: keyPair.privateKey,
          publisherId: 'test-publisher'
        }
      );

      const bundle = await signer.createSignatureBundle(
        exampleKPackManifest,
        {
          privateKey: keyPair.privateKey,
          publisherId: 'test-publisher',
          contentAddress,
          manifest: exampleKPackManifest
        }
      );

      bundle.attestations.push(attestation);
      bundle.manifest.attestations = bundle.attestations;

      const trustPolicy = await verifier.loadTrustPolicy(trustPolicyPath);
      const result = await verifier.verifySignatureBundle(bundle, contentAddress, {
        trustPolicy
      });

      expect(result.attestations).toHaveLength(3); // 2 default + 1 custom
      expect(result.attestations.every(att => att.valid)).toBe(true);
    });
  });

  describe('Policy Compliance', () => {
    it('should check minimum signature requirements', async () => {
      const trustPolicy = await verifier.loadTrustPolicy(trustPolicyPath);
      trustPolicy.requirements.minimumSignatures = 2;
      await saveTrustPolicy(trustPolicy, trustPolicyPath);

      const bundle = await signer.createSignatureBundle(
        exampleKPackManifest,
        {
          privateKey: keyPair.privateKey,
          publisherId: 'test-publisher',
          contentAddress,
          manifest: exampleKPackManifest
        }
      );

      const result = await verifier.verifySignatureBundle(bundle, contentAddress, {
        trustPolicy
      });

      expect(result.policyCompliance.minimumSignatures).toBe(false);
      expect(result.valid).toBe(false);
    });

    it('should check attestation requirements', async () => {
      const trustPolicy = await verifier.loadTrustPolicy(trustPolicyPath);
      trustPolicy.requirements.requireAttestations = true;
      trustPolicy.requirements.requiredAttestationTypes = ['security-scan'];
      await saveTrustPolicy(trustPolicy, trustPolicyPath);

      const bundle = await signer.createSignatureBundle(
        exampleKPackManifest,
        {
          privateKey: keyPair.privateKey,
          publisherId: 'test-publisher',
          contentAddress,
          manifest: exampleKPackManifest
        }
      );

      const result = await verifier.verifySignatureBundle(bundle, contentAddress, {
        trustPolicy
      });

      expect(result.policyCompliance.attestationRequirements).toBe(false);
      expect(result.valid).toBe(false);
    });

    it('should check publisher verification requirements', async () => {
      const trustPolicy = await verifier.loadTrustPolicy(trustPolicyPath);
      trustPolicy.requirements.requirePublisherVerification = true;
      trustPolicy.trustedPublishers = []; // Remove trusted publisher
      await saveTrustPolicy(trustPolicy, trustPolicyPath);

      const bundle = await signer.createSignatureBundle(
        exampleKPackManifest,
        {
          privateKey: keyPair.privateKey,
          publisherId: 'test-publisher',
          contentAddress,
          manifest: exampleKPackManifest
        }
      );

      const result = await verifier.verifySignatureBundle(bundle, contentAddress, {
        trustPolicy
      });

      expect(result.policyCompliance.publisherRequirements).toBe(false);
      expect(result.valid).toBe(false);
    });
  });

  describe('Trust Score Calculation', () => {
    it('should calculate trust scores based on verification results', async () => {
      const bundle = await signer.createSignatureBundle(
        exampleKPackManifest,
        {
          privateKey: keyPair.privateKey,
          publisherId: 'test-publisher',
          contentAddress,
          manifest: exampleKPackManifest
        }
      );

      const trustPolicy = await verifier.loadTrustPolicy(trustPolicyPath);
      const result = await verifier.verifySignatureBundle(bundle, contentAddress, {
        trustPolicy
      });

      expect(result.trustScore).toBeGreaterThan(0);
      expect(result.trustScore).toBeLessThanOrEqual(1);
      
      // High trust score for valid, trusted signatures with attestations
      expect(result.trustScore).toBeGreaterThan(0.8);
    });

    it('should give lower trust scores for untrusted signatures', async () => {
      const untrustedKeyPair = await signer.generateKeyPair();

      const bundle = await signer.createSignatureBundle(
        exampleKPackManifest,
        {
          privateKey: untrustedKeyPair.privateKey,
          publisherId: 'untrusted-publisher',
          contentAddress,
          manifest: exampleKPackManifest
        }
      );

      const trustPolicy = await verifier.loadTrustPolicy(trustPolicyPath);
      const result = await verifier.verifySignatureBundle(bundle, contentAddress, {
        trustPolicy
      });

      expect(result.trustScore).toBeLessThan(0.5);
    });
  });

  describe('Utility Functions', () => {
    it('should create verifier with factory function', () => {
      const verifier = createPackageVerifier();
      expect(verifier).toBeInstanceOf(PackageVerifier);
    });

    it('should verify package with utility function', async () => {
      const bundle = await signer.createSignatureBundle(
        exampleKPackManifest,
        {
          privateKey: keyPair.privateKey,
          publisherId: 'test-publisher',
          contentAddress,
          manifest: exampleKPackManifest
        }
      );

      const result = await verifyPackage(bundle, contentAddress, trustPolicyPath);

      expect(result.valid).toBe(true);
      expect(result.trustScore).toBeGreaterThan(0.5);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid signature format', async () => {
      const bundle = await signer.createSignatureBundle(
        exampleKPackManifest,
        {
          privateKey: keyPair.privateKey,
          publisherId: 'test-publisher',
          contentAddress,
          manifest: exampleKPackManifest
        }
      );

      // Corrupt the signature
      bundle.manifest.signatures[0].signature = 'invalid.jwt.signature';

      const trustPolicy = await verifier.loadTrustPolicy(trustPolicyPath);
      const result = await verifier.verifySignatureBundle(bundle, contentAddress, {
        trustPolicy
      });

      expect(result.valid).toBe(false);
      expect(result.signatures[0].valid).toBe(false);
      expect(result.signatures[0].error).toBeDefined();
    });

    it('should handle missing trust policy file', async () => {
      const nonexistentPath = path.join(tempDir, 'nonexistent-policy.json');

      await expect(verifier.loadTrustPolicy(nonexistentPath)).rejects.toThrow('Failed to load trust policy');
    });

    it('should handle corrupted trust policy file', async () => {
      const corruptedPath = path.join(tempDir, 'corrupted-policy.json');
      await fs.writeFile(corruptedPath, 'invalid json');

      await expect(verifier.loadTrustPolicy(corruptedPath)).rejects.toThrow('Failed to load trust policy');
    });
  });
});