/**
 * @fileoverview Tests for package signing and attestation
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { jwtVerify } from 'jose';
import { PackageSigner, createPackageSigner, signPackage, generateSigningKeyPair, createPackageSignatureBundle } from '../../src/pack/signer.js';
import { exampleKPackManifest, createContentAddress } from '../../src/types/kpack.js';

describe('PackageSigner', () => {
  let tempDir: string;
  let signer: PackageSigner;
  let keyPair: any;
  let contentAddress: any;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kgen-signer-test-'));
    signer = new PackageSigner();
    keyPair = await signer.generateKeyPair();
    contentAddress = await createContentAddress('test package content', 'sha256');
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Key Generation and Management', () => {
    it('should generate Ed25519 key pair', async () => {
      const keyPair = await signer.generateKeyPair();

      expect(keyPair.publicKey).toBeDefined();
      expect(keyPair.privateKey).toBeDefined();
      expect(keyPair.publicKeyJWK).toBeDefined();
      expect(keyPair.privateKeyJWK).toBeDefined();
      expect(keyPair.fingerprint).toMatch(/^[a-f0-9]{16}$/);

      // Verify key type
      expect(keyPair.publicKeyJWK.kty).toBe('OKP');
      expect(keyPair.publicKeyJWK.crv).toBe('Ed25519');
      expect(keyPair.privateKeyJWK.kty).toBe('OKP');
      expect(keyPair.privateKeyJWK.crv).toBe('Ed25519');
    });

    it('should generate unique fingerprints for different keys', async () => {
      const keyPair1 = await signer.generateKeyPair();
      const keyPair2 = await signer.generateKeyPair();

      expect(keyPair1.fingerprint).not.toBe(keyPair2.fingerprint);
    });

    it('should generate consistent fingerprints for same key', async () => {
      const keyPair1 = await signer.generateKeyPair();
      const keyPair2 = await signer.importKeyPair(keyPair1.publicKeyJWK, keyPair1.privateKeyJWK);

      expect(keyPair1.fingerprint).toBe(keyPair2.fingerprint);
    });

    it('should save and load key pairs', async () => {
      const originalKeyPair = await signer.generateKeyPair();
      const keyPath = path.join(tempDir, 'test-key');

      await signer.saveKeyPair(originalKeyPair, keyPath);

      // Verify files were created
      const publicKeyPath = `${keyPath}.pub.json`;
      const privateKeyPath = `${keyPath}.priv.json`;
      
      expect(await fs.access(publicKeyPath).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.access(privateKeyPath).then(() => true).catch(() => false)).toBe(true);

      // Load and verify
      const loadedKeyPair = await signer.loadKeyPair(keyPath);
      expect(loadedKeyPair.fingerprint).toBe(originalKeyPair.fingerprint);
      expect(loadedKeyPair.publicKeyJWK).toEqual(originalKeyPair.publicKeyJWK);
    });

    it('should set proper file permissions on Unix systems', async () => {
      if (process.platform === 'win32') {
        return; // Skip on Windows
      }

      const keyPath = path.join(tempDir, 'perm-test-key');
      await signer.saveKeyPair(keyPair, keyPath);

      const privateKeyPath = `${keyPath}.priv.json`;
      const publicKeyPath = `${keyPath}.pub.json`;

      const privateStats = await fs.stat(privateKeyPath);
      const publicStats = await fs.stat(publicKeyPath);

      // Private key should be readable only by owner (0o600)
      expect(privateStats.mode & 0o777).toBe(0o600);
      
      // Public key should be readable by all (0o644)
      expect(publicStats.mode & 0o777).toBe(0o644);
    });
  });

  describe('Package Signing', () => {
    it('should sign a package', async () => {
      const signature = await signer.signPackage({
        privateKey: keyPair.privateKey,
        publisherId: 'test-publisher',
        contentAddress,
        manifest: exampleKPackManifest
      });

      expect(signature.signature).toMatch(/^ey/); // JWT format
      expect(signature.algorithm).toBe('EdDSA');
      expect(signature.keyFingerprint).toBe(keyPair.fingerprint);
      expect(signature.contentHash).toBe(contentAddress.value);
      expect(signature.signer.id).toBe('test-publisher');
      expect(new Date(signature.timestamp)).toBeInstanceOf(Date);
    });

    it('should create valid JWT signatures', async () => {
      const signature = await signer.signPackage({
        privateKey: keyPair.privateKey,
        publisherId: 'test-publisher',
        contentAddress,
        manifest: exampleKPackManifest
      });

      // Verify JWT can be decoded
      const { payload } = await jwtVerify(signature.signature, keyPair.publicKey, {
        issuer: 'test-publisher',
        audience: 'kgen-marketplace'
      });

      expect(payload.iss).toBe('test-publisher');
      expect(payload.sub).toBe(contentAddress.value);
      expect(payload.aud).toBe('kgen-marketplace');
      expect(payload.pkg).toBeDefined();
      expect((payload.pkg as any).name).toBe(exampleKPackManifest.name);
      expect((payload.pkg as any).version).toBe(exampleKPackManifest.version);
    });

    it('should include custom metadata in signatures', async () => {
      const customMetadata = {
        buildNumber: 42,
        environment: 'production',
        custom: { key: 'value' }
      };

      const signature = await signer.signPackage({
        privateKey: keyPair.privateKey,
        publisherId: 'test-publisher',
        contentAddress,
        manifest: exampleKPackManifest,
        metadata: customMetadata
      });

      const { payload } = await jwtVerify(signature.signature, keyPair.publicKey, {
        issuer: 'test-publisher',
        audience: 'kgen-marketplace'
      });

      expect(payload.metadata).toEqual(customMetadata);
    });

    it('should use custom timestamp when provided', async () => {
      const customTimestamp = new Date('2025-06-15T12:00:00Z');

      const signature = await signer.signPackage({
        privateKey: keyPair.privateKey,
        publisherId: 'test-publisher',
        contentAddress,
        manifest: exampleKPackManifest,
        timestamp: customTimestamp
      });

      expect(signature.timestamp).toBe(customTimestamp.toISOString());
    });
  });

  describe('Attestations', () => {
    it('should create package attestations', async () => {
      const claims = [{
        type: 'code-review',
        subject: exampleKPackManifest.name,
        predicate: 'has-been-reviewed',
        evidence: [{
          type: 'review-report',
          value: 'passed-security-review',
          source: 'security-team'
        }],
        confidence: 0.95
      }];

      const attestation = await signer.createAttestation(
        {
          contentAddress,
          name: exampleKPackManifest.name,
          version: exampleKPackManifest.version
        },
        claims,
        {
          privateKey: keyPair.privateKey,
          publisherId: 'test-publisher'
        }
      );

      expect(attestation.id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
      expect(attestation.type).toBe('package-attestation');
      expect(attestation.subject.name).toBe(exampleKPackManifest.name);
      expect(attestation.claims).toEqual(claims);
      expect(attestation.signature.algorithm).toBe('EdDSA');
      expect(new Date(attestation.timestamp)).toBeInstanceOf(Date);
    });

    it('should create multiple types of attestations', async () => {
      const reviewClaims = [{
        type: 'code-review',
        subject: exampleKPackManifest.name,
        predicate: 'passed-review'
      }];

      const securityClaims = [{
        type: 'security-scan',
        subject: exampleKPackManifest.name,
        predicate: 'no-vulnerabilities-found'
      }];

      const [reviewAttestation, securityAttestation] = await Promise.all([
        signer.createAttestation(
          { contentAddress, name: exampleKPackManifest.name, version: exampleKPackManifest.version },
          reviewClaims,
          { privateKey: keyPair.privateKey, publisherId: 'review-team' }
        ),
        signer.createAttestation(
          { contentAddress, name: exampleKPackManifest.name, version: exampleKPackManifest.version },
          securityClaims,
          { privateKey: keyPair.privateKey, publisherId: 'security-team' }
        )
      ]);

      expect(reviewAttestation.id).not.toBe(securityAttestation.id);
      expect(reviewAttestation.claims[0].type).toBe('code-review');
      expect(securityAttestation.claims[0].type).toBe('security-scan');
    });
  });

  describe('Signature Bundles', () => {
    it('should create signature bundle with default attestations', async () => {
      const bundle = await signer.createSignatureBundle(
        exampleKPackManifest,
        {
          privateKey: keyPair.privateKey,
          publisherId: 'test-publisher',
          contentAddress,
          manifest: exampleKPackManifest
        }
      );

      expect(bundle.manifest.signatures).toHaveLength(1);
      expect(bundle.primarySignature.signer.id).toBe('test-publisher');
      expect(bundle.attestations).toHaveLength(2); // publisher-identity + content-integrity
      
      // Check default attestations
      const attestationTypes = bundle.attestations.map(att => att.claims[0].type);
      expect(attestationTypes).toContain('publisher-identity');
      expect(attestationTypes).toContain('content-integrity');
    });

    it('should create bundle with multiple signatures', async () => {
      const secondKeyPair = await signer.generateKeyPair();

      const bundle = await signer.createSignatureBundle(
        exampleKPackManifest,
        {
          privateKey: keyPair.privateKey,
          publisherId: 'primary-publisher',
          contentAddress,
          manifest: exampleKPackManifest
        },
        [{
          privateKey: secondKeyPair.privateKey,
          publisherId: 'secondary-publisher',
          contentAddress,
          manifest: exampleKPackManifest
        }]
      );

      expect(bundle.manifest.signatures).toHaveLength(2);
      expect(bundle.additionalSignatures).toHaveLength(1);
      expect(bundle.primarySignature.signer.id).toBe('primary-publisher');
      expect(bundle.additionalSignatures![0].signer.id).toBe('secondary-publisher');
    });

    it('should include signatures and attestations in manifest', async () => {
      const bundle = await signer.createSignatureBundle(
        exampleKPackManifest,
        {
          privateKey: keyPair.privateKey,
          publisherId: 'test-publisher',
          contentAddress,
          manifest: exampleKPackManifest
        }
      );

      expect(bundle.manifest.signatures).toBeDefined();
      expect(bundle.manifest.attestations).toBeDefined();
      expect(bundle.manifest.signatures).toHaveLength(1);
      expect(bundle.manifest.attestations).toHaveLength(2);
    });
  });

  describe('Utility Functions', () => {
    it('should create signer with factory function', () => {
      const signer = createPackageSigner();
      expect(signer).toBeInstanceOf(PackageSigner);
    });

    it('should sign package with utility function', async () => {
      const signature = await signPackage({
        privateKey: keyPair.privateKey,
        publisherId: 'test-publisher',
        contentAddress,
        manifest: exampleKPackManifest
      });

      expect(signature.algorithm).toBe('EdDSA');
      expect(signature.signer.id).toBe('test-publisher');
    });

    it('should generate key pair with utility function', async () => {
      const keyPair = await generateSigningKeyPair();

      expect(keyPair.publicKey).toBeDefined();
      expect(keyPair.privateKey).toBeDefined();
      expect(keyPair.fingerprint).toMatch(/^[a-f0-9]{16}$/);
    });

    it('should create signature bundle with utility function', async () => {
      const bundle = await createPackageSignatureBundle(
        exampleKPackManifest,
        contentAddress,
        keyPair.privateKey,
        'test-publisher'
      );

      expect(bundle.manifest.signatures).toHaveLength(1);
      expect(bundle.primarySignature.signer.id).toBe('test-publisher');
      expect(bundle.attestations).toHaveLength(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid private keys', async () => {
      const invalidKey = { } as CryptoKey;

      await expect(signer.signPackage({
        privateKey: invalidKey,
        publisherId: 'test-publisher',
        contentAddress,
        manifest: exampleKPackManifest
      })).rejects.toThrow();
    });

    it('should handle missing key files', async () => {
      const nonexistentPath = path.join(tempDir, 'nonexistent-key');

      await expect(signer.loadKeyPair(nonexistentPath)).rejects.toThrow('Failed to load key pair');
    });

    it('should handle corrupted key files', async () => {
      const keyPath = path.join(tempDir, 'corrupted-key');
      
      // Create corrupted key files
      await fs.writeFile(`${keyPath}.pub.json`, 'invalid json');
      await fs.writeFile(`${keyPath}.priv.json`, 'invalid json');

      await expect(signer.loadKeyPair(keyPath)).rejects.toThrow('Failed to load key pair');
    });
  });
});