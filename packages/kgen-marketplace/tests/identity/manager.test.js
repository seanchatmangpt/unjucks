/**
 * Test Suite for Identity Management System
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { IdentityManager, HSMConfig } from '../../src/identity/manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testIdentityStore = path.join(__dirname, 'test-identities');

describe('Identity Management System', () => {
  let identityManager;

  beforeEach(async () => {
    // Clean up test directory
    await fs.remove(testIdentityStore);
    
    // Initialize identity manager
    identityManager = new IdentityManager({
      keyStorePath: testIdentityStore,
      hsmEnabled: false
    });
    await identityManager.initialize();
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.remove(testIdentityStore);
  });

  describe('Identity Generation', () => {
    test('should generate Ed25519 identity', async () => {
      const identity = await identityManager.generateIdentity({
        keyType: 'Ed25519',
        purpose: 'testing'
      });

      assert.ok(identity.id);
      assert.strictEqual(identity.keyType, 'Ed25519');
      assert.strictEqual(identity.algorithm, 'EdDSA');
      assert.strictEqual(identity.status, 'active');
      assert.strictEqual(identity.version, 1);
      assert.ok(identity.keyPair);
      assert.strictEqual(identity.keyPair.type, 'software');
      assert.ok(identity.created);
      assert.ok(identity.rotationSchedule.nextRotation);
    });

    test('should generate RSA identity', async () => {
      const identity = await identityManager.generateIdentity({
        keyType: 'RSA',
        purpose: 'signing'
      });

      assert.strictEqual(identity.keyType, 'RSA');
      assert.ok(identity.keyPair.privateKey.includes('-----BEGIN RSA PRIVATE KEY-----'));
      assert.ok(identity.keyPair.publicKey.includes('-----BEGIN PUBLIC KEY-----'));
    });

    test('should store identity metadata correctly', async () => {
      const identity = await identityManager.generateIdentity({
        keyType: 'Ed25519',
        purpose: 'attestation',
        description: 'Test identity for attestations',
        tags: ['test', 'attestation']
      });

      assert.strictEqual(identity.metadata.purpose, 'attestation');
      assert.strictEqual(identity.metadata.description, 'Test identity for attestations');
      assert.deepStrictEqual(identity.metadata.tags, ['test', 'attestation']);
    });

    test('should generate unique identity IDs', async () => {
      const identity1 = await identityManager.generateIdentity();
      const identity2 = await identityManager.generateIdentity();
      
      assert.notStrictEqual(identity1.id, identity2.id);
      assert.ok(identity1.id.startsWith('kgen_identity_'));
      assert.ok(identity2.id.startsWith('kgen_identity_'));
    });
  });

  describe('Key Rotation', () => {
    test('should rotate identity keys', async () => {
      const identity = await identityManager.generateIdentity({
        keyType: 'Ed25519'
      });
      
      const originalVersion = identity.version;
      const originalKeyPair = identity.keyPair;
      
      const rotationResult = await identityManager.rotateIdentity(identity.id);
      
      assert.strictEqual(rotationResult.identityId, identity.id);
      assert.strictEqual(rotationResult.oldVersion, originalVersion);
      assert.strictEqual(rotationResult.newVersion, originalVersion + 1);
      
      const updatedIdentity = identityManager.getIdentity(identity.id);
      assert.strictEqual(updatedIdentity.version, originalVersion + 1);
      assert.notDeepStrictEqual(updatedIdentity.keyPair.privateKey, originalKeyPair.privateKey);
      assert.ok(updatedIdentity.lastRotated);
    });

    test('should not rotate non-active identity', async () => {
      const identity = await identityManager.generateIdentity();
      
      // Revoke the identity first
      await identityManager.revokeIdentity(identity.id);
      
      await assert.rejects(
        () => identityManager.rotateIdentity(identity.id),
        /Cannot rotate non-active identity/
      );
    });

    test('should check rotation needed', async () => {
      const identity = await identityManager.generateIdentity({
        autoRotate: true
      });
      
      // Force next rotation to be in the past
      const pastDate = new Date(Date.now() - 1000).toISOString();
      identity.rotationSchedule.nextRotation = pastDate;
      identityManager.identities.set(identity.id, identity);
      
      const needsRotation = await identityManager.checkRotationNeeded();
      
      assert.strictEqual(needsRotation.length, 1);
      assert.strictEqual(needsRotation[0].identityId, identity.id);
      assert.ok(needsRotation[0].overdue > 0);
    });

    test('should perform auto-rotation', async () => {
      const identity = await identityManager.generateIdentity({
        autoRotate: true
      });
      
      // Force rotation to be needed
      const pastDate = new Date(Date.now() - 1000).toISOString();
      identity.rotationSchedule.nextRotation = pastDate;
      identityManager.identities.set(identity.id, identity);
      
      const results = await identityManager.autoRotateKeys();
      
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].success, true);
      assert.strictEqual(results[0].identityId, identity.id);
    });
  });

  describe('Identity Revocation', () => {
    test('should revoke identity', async () => {
      const identity = await identityManager.generateIdentity();
      
      const revocationResult = await identityManager.revokeIdentity(
        identity.id,
        'Testing revocation'
      );
      
      assert.strictEqual(revocationResult.identityId, identity.id);
      assert.strictEqual(revocationResult.status, 'revoked');
      assert.strictEqual(revocationResult.reason, 'Testing revocation');
      
      const revokedIdentity = identityManager.getIdentity(identity.id);
      assert.strictEqual(revokedIdentity.status, 'revoked');
      assert.ok(revokedIdentity.revokedAt);
    });

    test('should move revoked identity to revoked directory', async () => {
      const identity = await identityManager.generateIdentity();
      
      await identityManager.revokeIdentity(identity.id);
      
      const revokedPath = path.join(testIdentityStore, 'revoked', `${identity.id}.json`);
      const activePath = path.join(testIdentityStore, 'active', `${identity.id}.json`);
      
      assert.ok(await fs.pathExists(revokedPath));
      assert.ok(!(await fs.pathExists(activePath)));
    });
  });

  describe('Signing Operations', () => {
    test('should sign data with identity', async () => {
      const identity = await identityManager.generateIdentity({
        keyType: 'Ed25519'
      });
      
      const data = 'test data to sign';
      const signature = await identityManager.signWithIdentity(identity.id, data);
      
      assert.ok(signature.signature);
      assert.strictEqual(signature.identityId, identity.id);
      assert.strictEqual(signature.keyType, 'Ed25519');
      assert.strictEqual(signature.algorithm, 'EdDSA');
      assert.ok(signature.timestamp);
    });

    test('should sign with RSA identity', async () => {
      const identity = await identityManager.generateIdentity({
        keyType: 'RSA'
      });
      
      const data = Buffer.from('test data for RSA signing');
      const signature = await identityManager.signWithIdentity(identity.id, data);
      
      assert.ok(signature.signature);
      assert.strictEqual(signature.keyType, 'RSA');
    });

    test('should not sign with revoked identity', async () => {
      const identity = await identityManager.generateIdentity();
      await identityManager.revokeIdentity(identity.id);
      
      await assert.rejects(
        () => identityManager.signWithIdentity(identity.id, 'test data'),
        /Cannot sign with non-active identity/
      );
    });

    test('should not sign with non-existent identity', async () => {
      await assert.rejects(
        () => identityManager.signWithIdentity('nonexistent', 'test data'),
        /Identity not found/
      );
    });
  });

  describe('Identity Management', () => {
    test('should list identities by status', async () => {
      const activeIdentity = await identityManager.generateIdentity();
      const revokedIdentity = await identityManager.generateIdentity();
      await identityManager.revokeIdentity(revokedIdentity.id);
      
      const allIdentities = identityManager.listIdentities();
      const activeIdentities = identityManager.listIdentities('active');
      const revokedIdentities = identityManager.listIdentities('revoked');
      
      assert.strictEqual(allIdentities.length, 2);
      assert.strictEqual(activeIdentities.length, 1);
      assert.strictEqual(revokedIdentities.length, 1);
      assert.strictEqual(activeIdentities[0].id, activeIdentity.id);
      assert.strictEqual(revokedIdentities[0].id, revokedIdentity.id);
    });

    test('should redact private key information', async () => {
      const identity = await identityManager.generateIdentity();
      const safeIdentity = identityManager.getIdentity(identity.id);
      
      assert.strictEqual(safeIdentity.keyPair.privateKey, '[REDACTED]');
      assert.ok(safeIdentity.keyPair.publicKey);
    });

    test('should export identity for backup', async () => {
      const identity = await identityManager.generateIdentity();
      const password = 'test-password-123';
      
      const exportData = await identityManager.exportIdentity(identity.id, password);
      
      assert.ok(exportData.encrypted);
      assert.ok(exportData.salt);
      assert.ok(exportData.iv);
      assert.ok(exportData.tag);
    });

    test('should persist identities across restarts', async () => {
      const identity = await identityManager.generateIdentity({
        keyType: 'Ed25519',
        purpose: 'persistence-test'
      });
      
      // Create new identity manager instance
      const newIdentityManager = new IdentityManager({
        keyStorePath: testIdentityStore,
        hsmEnabled: false
      });
      await newIdentityManager.initialize();
      
      const loadedIdentity = newIdentityManager.getIdentity(identity.id);
      assert.ok(loadedIdentity);
      assert.strictEqual(loadedIdentity.id, identity.id);
      assert.strictEqual(loadedIdentity.metadata.purpose, 'persistence-test');
    });
  });

  describe('HSM Integration', () => {
    test('should initialize HSM configuration', async () => {
      const hsmManager = new IdentityManager({
        keyStorePath: testIdentityStore,
        hsmEnabled: true,
        hsmLibPath: '/usr/lib/pkcs11/test.so',
        hsmSlot: 0
      });
      
      await hsmManager.initialize();
      
      assert.ok(hsmManager.hsmInfo);
      assert.strictEqual(hsmManager.hsmInfo.initialized, true);
      assert.ok(hsmManager.hsmInfo.mechanisms);
    });

    test('should generate HSM-backed identity', async () => {
      const hsmManager = new IdentityManager({
        keyStorePath: testIdentityStore,
        hsmEnabled: true
      });
      await hsmManager.initialize();
      
      const identity = await hsmManager.generateIdentity({
        keyType: 'Ed25519',
        useHSM: true
      });
      
      assert.strictEqual(identity.hsmBacked, true);
      assert.strictEqual(identity.keyPair.type, 'hsm');
      assert.ok(identity.keyPair.privateKeyHandle);
    });
  });
});

describe('HSM Configuration', () => {
  let hsmConfig;
  const testConfigPath = path.join(__dirname, 'test-hsm-config.json');

  beforeEach(async () => {
    await fs.remove(testConfigPath);
    hsmConfig = new HSMConfig();
    hsmConfig.configPath = testConfigPath;
    await hsmConfig.initialize();
  });

  afterEach(async () => {
    await fs.remove(testConfigPath);
  });

  test('should configure HSM settings', async () => {
    const config = await hsmConfig.configureHSM({
      library: '/usr/lib/pkcs11/test.so',
      pin: 'test-pin',
      slots: [0, 1],
      mechanisms: ['CKM_EDDSA', 'CKM_RSA_PKCS']
    });
    
    assert.strictEqual(config.enabled, true);
    assert.strictEqual(config.library, '/usr/lib/pkcs11/test.so');
    assert.deepStrictEqual(config.slots, [0, 1]);
    assert.deepStrictEqual(config.mechanisms, ['CKM_EDDSA', 'CKM_RSA_PKCS']);
  });

  test('should redact PIN in config display', async () => {
    await hsmConfig.configureHSM({
      library: '/usr/lib/pkcs11/test.so',
      pin: 'secret-pin'
    });
    
    const displayConfig = hsmConfig.getConfig();
    assert.strictEqual(displayConfig.pin, '[REDACTED]');
  });

  test('should persist HSM configuration', async () => {
    await hsmConfig.configureHSM({
      library: '/usr/lib/pkcs11/persistent.so',
      slots: [2]
    });
    
    // Create new instance to test persistence
    const newHsmConfig = new HSMConfig();
    newHsmConfig.configPath = testConfigPath;
    await newHsmConfig.initialize();
    
    const config = newHsmConfig.getConfig();
    assert.strictEqual(config.library, '/usr/lib/pkcs11/persistent.so');
    assert.deepStrictEqual(config.slots, [2]);
  });
});
