/**
 * @fileoverview Integration tests for complete packaging workflow
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { createSignedPackage, verifySignedPackage } from '../../src/pack/index.js';
import { DeterministicTarBuilder } from '../../src/pack/builder.js';
import { PackageSigner } from '../../src/pack/signer.js';
import { PackageVerifier, createDefaultTrustPolicy, saveTrustPolicy } from '../../src/pack/verifier.js';
import { exampleKPackManifest } from '../../src/types/kpack.js';

describe('Package Integration Tests', () => {
  let tempDir: string;
  let testPackageDir: string;
  let outputPath: string;
  let keyPair: any;
  let trustPolicyPath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kgen-integration-test-'));
    testPackageDir = path.join(tempDir, 'test-package');
    outputPath = path.join(tempDir, 'package.tar');
    trustPolicyPath = path.join(tempDir, 'trust-policy.json');

    // Create test package structure
    await fs.mkdir(testPackageDir, { recursive: true });
    await fs.mkdir(path.join(testPackageDir, 'templates'), { recursive: true });
    await fs.mkdir(path.join(testPackageDir, 'src'), { recursive: true });

    // Create test files
    await fs.writeFile(
      path.join(testPackageDir, 'README.md'),
      '# Test Package\n\nThis is a test package for integration testing.'
    );
    
    await fs.writeFile(
      path.join(testPackageDir, 'src', 'index.ts'),
      'export const version = "1.0.0";'
    );
    
    await fs.writeFile(
      path.join(testPackageDir, 'templates', 'api.njk'),
      'class {{ className }} {\n  // Generated API class\n}'
    );

    // Generate signing key pair
    const signer = new PackageSigner();
    keyPair = await signer.generateKeyPair();

    // Create trust policy with the key
    const trustPolicy = createDefaultTrustPolicy();
    trustPolicy.trustedKeys.push({
      fingerprint: keyPair.fingerprint,
      publicKey: keyPair.publicKeyJWK,
      owner: 'integration-test-publisher',
      validFrom: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      purpose: ['signing', 'attestation']
    });
    
    trustPolicy.trustedPublishers.push({
      id: 'integration-test-publisher',
      name: 'Integration Test Publisher',
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

  describe('Complete Packaging Workflow', () => {
    it('should create, sign, and verify a package end-to-end', async () => {
      // 1. Create signed package
      const result = await createSignedPackage({
        baseDir: testPackageDir,
        outputPath,
        manifest: exampleKPackManifest,
        privateKey: keyPair.privateKey,
        publisherId: 'integration-test-publisher'
      });

      // Verify package was created
      expect(result.packagePath).toBe(outputPath);
      expect(result.buildResult.contentAddress.type).toBe('sha256');
      expect(result.signatureBundle.manifest.signatures).toHaveLength(1);
      expect(result.signatureBundle.attestations).toHaveLength(2);

      // Verify file exists and has content
      const stats = await fs.stat(outputPath);
      expect(stats.isFile()).toBe(true);
      expect(stats.size).toBeGreaterThan(0);

      // 2. Verify signed package
      const verification = await verifySignedPackage({
        packagePath: outputPath,
        signatureBundle: result.signatureBundle,
        trustPolicyPath
      });

      expect(verification.verificationResult.valid).toBe(true);
      expect(verification.trusted).toBe(true);
      expect(verification.errors).toHaveLength(0);
      expect(verification.verificationResult.trustScore).toBeGreaterThan(0.7);
    });

    it('should detect package tampering', async () => {
      // Create and sign package
      const result = await createSignedPackage({
        baseDir: testPackageDir,
        outputPath,
        manifest: exampleKPackManifest,
        privateKey: keyPair.privateKey,
        publisherId: 'integration-test-publisher'
      });

      // Tamper with the package
      const originalContent = await fs.readFile(outputPath);
      const tamperedContent = Buffer.concat([originalContent, Buffer.from('tampered')]);
      await fs.writeFile(outputPath, tamperedContent);

      // Verify tampered package
      const verification = await verifySignedPackage({
        packagePath: outputPath,
        signatureBundle: result.signatureBundle,
        trustPolicyPath
      });

      expect(verification.verificationResult.valid).toBe(false);
      expect(verification.trusted).toBe(false);
      expect(verification.errors.length).toBeGreaterThan(0);
    });

    it('should handle multiple signatures', async () => {
      // Create second key pair
      const signer2 = new PackageSigner();
      const keyPair2 = await signer2.generateKeyPair();

      // Add second key to trust policy
      const trustPolicy = await new PackageVerifier().loadTrustPolicy(trustPolicyPath);
      trustPolicy.trustedKeys.push({
        fingerprint: keyPair2.fingerprint,
        publicKey: keyPair2.publicKeyJWK,
        owner: 'second-publisher',
        validFrom: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        purpose: ['signing']
      });
      
      trustPolicy.trustedPublishers.push({
        id: 'second-publisher',
        name: 'Second Publisher',
        publicKeys: [keyPair2.fingerprint]
      });

      await saveTrustPolicy(trustPolicy, trustPolicyPath);

      // Create package with multiple signatures
      const signer = new PackageSigner();
      const bundle = await signer.createSignatureBundle(
        exampleKPackManifest,
        {
          privateKey: keyPair.privateKey,
          publisherId: 'integration-test-publisher',
          contentAddress: { type: 'sha256', value: 'test', size: 4 },
          manifest: exampleKPackManifest
        },
        [{
          privateKey: keyPair2.privateKey,
          publisherId: 'second-publisher',
          contentAddress: { type: 'sha256', value: 'test', size: 4 },
          manifest: exampleKPackManifest
        }]
      );

      expect(bundle.manifest.signatures).toHaveLength(2);
      expect(bundle.additionalSignatures).toHaveLength(1);

      // Create actual package
      const builder = new DeterministicTarBuilder({
        baseDir: testPackageDir,
        outputPath,
        manifest: bundle.manifest
      });

      const buildResult = await builder.build();

      // Verify with multiple signatures
      const verification = await verifySignedPackage({
        packagePath: outputPath,
        signatureBundle: bundle,
        trustPolicyPath
      });

      expect(verification.verificationResult.valid).toBe(true);
      expect(verification.verificationResult.signatures).toHaveLength(2);
      expect(verification.verificationResult.signatures.every(s => s.valid && s.trusted)).toBe(true);
    });
  });

  describe('Deterministic Build Verification', () => {
    it('should produce identical packages across multiple builds', async () => {
      const results = await Promise.all([
        createSignedPackage({
          baseDir: testPackageDir,
          outputPath: path.join(tempDir, 'package1.tar'),
          manifest: exampleKPackManifest,
          privateKey: keyPair.privateKey,
          publisherId: 'integration-test-publisher'
        }),
        createSignedPackage({
          baseDir: testPackageDir,
          outputPath: path.join(tempDir, 'package2.tar'),
          manifest: exampleKPackManifest,
          privateKey: keyPair.privateKey,
          publisherId: 'integration-test-publisher'
        }),
        createSignedPackage({
          baseDir: testPackageDir,
          outputPath: path.join(tempDir, 'package3.tar'),
          manifest: exampleKPackManifest,
          privateKey: keyPair.privateKey,
          publisherId: 'integration-test-publisher'
        })
      ]);

      // All builds should produce the same content hash
      const contentHashes = results.map(r => r.buildResult.contentAddress.value);
      expect(new Set(contentHashes).size).toBe(1);

      // All package files should be byte-identical
      const [content1, content2, content3] = await Promise.all(
        results.map(r => fs.readFile(r.packagePath))
      );

      expect(content1.equals(content2)).toBe(true);
      expect(content2.equals(content3)).toBe(true);
    });

    it('should validate determinism with excluded files', async () => {
      // Add files that should be excluded
      await fs.writeFile(path.join(testPackageDir, 'temp.log'), 'temporary log');
      await fs.writeFile(path.join(testPackageDir, 'debug.tmp'), 'debug info');
      await fs.mkdir(path.join(testPackageDir, 'node_modules'), { recursive: true });
      await fs.writeFile(path.join(testPackageDir, 'node_modules', 'dep.js'), 'dependency');

      const excludePatterns = ['*.log', '*.tmp', 'node_modules/**'];

      const results = await Promise.all([
        createSignedPackage({
          baseDir: testPackageDir,
          outputPath: path.join(tempDir, 'package-excl1.tar'),
          manifest: exampleKPackManifest,
          privateKey: keyPair.privateKey,
          publisherId: 'integration-test-publisher',
          exclude: excludePatterns
        }),
        createSignedPackage({
          baseDir: testPackageDir,
          outputPath: path.join(tempDir, 'package-excl2.tar'),
          manifest: exampleKPackManifest,
          privateKey: keyPair.privateKey,
          publisherId: 'integration-test-publisher',
          exclude: excludePatterns
        })
      ]);

      // Builds should be identical despite excluded files
      expect(results[0].buildResult.contentAddress.value)
        .toBe(results[1].buildResult.contentAddress.value);

      // Verify excluded files are not in the package
      const entries = results[0].buildResult.entries;
      const excludedEntries = entries.filter(e => 
        e.path.includes('.log') || 
        e.path.includes('.tmp') || 
        e.path.includes('node_modules')
      );
      
      expect(excludedEntries).toHaveLength(0);
    });
  });

  describe('Trust Policy Enforcement', () => {
    it('should reject packages from untrusted publishers', async () => {
      // Create package with untrusted key
      const untrustedSigner = new PackageSigner();
      const untrustedKeyPair = await untrustedSigner.generateKeyPair();

      const result = await createSignedPackage({
        baseDir: testPackageDir,
        outputPath,
        manifest: exampleKPackManifest,
        privateKey: untrustedKeyPair.privateKey,
        publisherId: 'untrusted-publisher'
      });

      // Verify with original trust policy (doesn't include untrusted key)
      const verification = await verifySignedPackage({
        packagePath: outputPath,
        signatureBundle: result.signatureBundle,
        trustPolicyPath
      });

      expect(verification.verificationResult.valid).toBe(false);
      expect(verification.trusted).toBe(false);
      expect(verification.verificationResult.signatures[0].trusted).toBe(false);
    });

    it('should enforce minimum signature requirements', async () => {
      // Update trust policy to require 2 signatures
      const trustPolicy = await new PackageVerifier().loadTrustPolicy(trustPolicyPath);
      trustPolicy.requirements.minimumSignatures = 2;
      await saveTrustPolicy(trustPolicy, trustPolicyPath);

      // Create package with only 1 signature
      const result = await createSignedPackage({
        baseDir: testPackageDir,
        outputPath,
        manifest: exampleKPackManifest,
        privateKey: keyPair.privateKey,
        publisherId: 'integration-test-publisher'
      });

      const verification = await verifySignedPackage({
        packagePath: outputPath,
        signatureBundle: result.signatureBundle,
        trustPolicyPath
      });

      expect(verification.verificationResult.valid).toBe(false);
      expect(verification.verificationResult.policyCompliance.minimumSignatures).toBe(false);
    });

    it('should enforce attestation requirements', async () => {
      // Update trust policy to require specific attestations
      const trustPolicy = await new PackageVerifier().loadTrustPolicy(trustPolicyPath);
      trustPolicy.requirements.requireAttestations = true;
      trustPolicy.requirements.requiredAttestationTypes = ['security-scan', 'code-review'];
      await saveTrustPolicy(trustPolicy, trustPolicyPath);

      const result = await createSignedPackage({
        baseDir: testPackageDir,
        outputPath,
        manifest: exampleKPackManifest,
        privateKey: keyPair.privateKey,
        publisherId: 'integration-test-publisher'
      });

      const verification = await verifySignedPackage({
        packagePath: outputPath,
        signatureBundle: result.signatureBundle,
        trustPolicyPath
      });

      // Should fail because required attestation types are missing
      expect(verification.verificationResult.valid).toBe(false);
      expect(verification.verificationResult.policyCompliance.attestationRequirements).toBe(false);
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    it('should handle corrupted manifest in package', async () => {
      // Create package
      const result = await createSignedPackage({
        baseDir: testPackageDir,
        outputPath,
        manifest: exampleKPackManifest,
        privateKey: keyPair.privateKey,
        publisherId: 'integration-test-publisher'
      });

      // Corrupt the manifest in signature bundle
      const corruptedBundle = { ...result.signatureBundle };
      corruptedBundle.manifest = { ...corruptedBundle.manifest };
      (corruptedBundle.manifest as any).name = undefined; // Corrupt required field

      const verification = await verifySignedPackage({
        packagePath: outputPath,
        signatureBundle: corruptedBundle,
        trustPolicyPath
      });

      // Should handle gracefully
      expect(verification.verificationResult.valid).toBe(false);
      expect(verification.errors.length).toBeGreaterThan(0);
    });

    it('should handle missing package file', async () => {
      const result = await createSignedPackage({
        baseDir: testPackageDir,
        outputPath,
        manifest: exampleKPackManifest,
        privateKey: keyPair.privateKey,
        publisherId: 'integration-test-publisher'
      });

      // Delete package file
      await fs.unlink(outputPath);

      await expect(verifySignedPackage({
        packagePath: outputPath,
        signatureBundle: result.signatureBundle,
        trustPolicyPath
      })).rejects.toThrow();
    });

    it('should handle empty package directory', async () => {
      const emptyDir = path.join(tempDir, 'empty-package');
      await fs.mkdir(emptyDir);

      const result = await createSignedPackage({
        baseDir: emptyDir,
        outputPath,
        manifest: exampleKPackManifest,
        privateKey: keyPair.privateKey,
        publisherId: 'integration-test-publisher'
      });

      expect(result.buildResult.entries).toHaveLength(1); // Only manifest
      expect(result.buildResult.entries[0].path).toBe('kpack.json');

      const verification = await verifySignedPackage({
        packagePath: outputPath,
        signatureBundle: result.signatureBundle,
        trustPolicyPath
      });

      expect(verification.verificationResult.valid).toBe(true);
      expect(verification.trusted).toBe(true);
    });
  });
});