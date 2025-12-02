/**
 * Test Suite for Trust Policy Engine
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { TrustPolicyEngine, TrustStore } from '../../src/trust/policy-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testPolicyPath = path.join(__dirname, 'test-trust-policy.json');
const testStorePath = path.join(__dirname, 'test-trust-store');

describe('Trust Policy Engine', () => {
  let policyEngine;

  beforeEach(async () => {
    // Clean up test files
    await fs.remove(testPolicyPath);
    await fs.remove(testStorePath);
    
    // Initialize policy engine
    policyEngine = new TrustPolicyEngine({
      policyPath: testPolicyPath
    });
    await policyEngine.initialize();
  });

  afterEach(async () => {
    // Clean up test files
    await fs.remove(testPolicyPath);
    await fs.remove(testStorePath);
  });

  describe('Policy Initialization', () => {
    test('should create default policy on first run', async () => {
      const policy = policyEngine.getTrustPolicy();
      
      assert.strictEqual(policy.version, '1.0');
      assert.strictEqual(policy.metadata.name, 'Default KGEN Trust Policy');
      assert.ok(policy.didPolicy);
      assert.ok(policy.slsaPolicy);
      assert.ok(policy.attestationPolicy);
      assert.ok(policy.cryptographicPolicy);
      assert.ok(policy.compliancePolicy);
    });

    test('should load existing policy from file', async () => {
      const customPolicy = {
        version: '1.0',
        metadata: {
          name: 'Custom Test Policy',
          description: 'Test policy for unit tests',
          created: new Date().toISOString()
        },
        didPolicy: {
          allowlist: ['did:key:test123'],
          denylist: [],
          requireRegistration: true
        },
        slsaPolicy: {
          minimumLevel: 'SLSA_LEVEL_3'
        },
        attestationPolicy: {},
        cryptographicPolicy: {},
        compliancePolicy: {}
      };

      await fs.writeJson(testPolicyPath, customPolicy);
      
      const newEngine = new TrustPolicyEngine({ policyPath: testPolicyPath });
      await newEngine.initialize();
      
      const loadedPolicy = newEngine.getTrustPolicy();
      assert.strictEqual(loadedPolicy.metadata.name, 'Custom Test Policy');
      assert.deepStrictEqual(loadedPolicy.didPolicy.allowlist, ['did:key:test123']);
      assert.strictEqual(loadedPolicy.slsaPolicy.minimumLevel, 'SLSA_LEVEL_3');
    });

    test('should validate policy schema', async () => {
      const invalidPolicy = {
        version: '2.0', // Invalid version
        metadata: {
          // Missing required 'name' field
          description: 'Invalid policy'
        }
      };

      await assert.rejects(
        () => policyEngine.setPolicy(invalidPolicy),
        /Invalid trust policy/
      );
    });
  });

  describe('DID Policy Evaluation', () => {
    beforeEach(async () => {
      const policy = policyEngine.getTrustPolicy();
      policy.didPolicy.allowlist = ['did:key:allowed1', 'did:key:allowed2'];
      policy.didPolicy.denylist = ['did:key:denied1'];
      await policyEngine.setPolicy(policy);
    });

    test('should allow DIDs in allowlist', async () => {
      const attestation = {
        issuer: 'did:key:allowed1',
        type: 'KPackAttestation'
      };

      const evaluation = await policyEngine.evaluateAttestation(attestation);
      
      assert.strictEqual(evaluation.checks.didPolicy.compliant, true);
      assert.strictEqual(evaluation.checks.didPolicy.violations.length, 0);
    });

    test('should deny DIDs in denylist', async () => {
      const attestation = {
        issuer: 'did:key:denied1',
        type: 'KPackAttestation'
      };

      const evaluation = await policyEngine.evaluateAttestation(attestation);
      
      assert.strictEqual(evaluation.checks.didPolicy.compliant, false);
      assert.ok(evaluation.checks.didPolicy.violations.some(
        v => v.type === 'did_denylist'
      ));
    });

    test('should deny DIDs not in allowlist when allowlist is present', async () => {
      const attestation = {
        issuer: 'did:key:unknown',
        type: 'KPackAttestation'
      };

      const evaluation = await policyEngine.evaluateAttestation(attestation);
      
      assert.strictEqual(evaluation.checks.didPolicy.compliant, false);
      assert.ok(evaluation.checks.didPolicy.violations.some(
        v => v.type === 'did_allowlist'
      ));
    });

    test('should check minimum trust score', async () => {
      const policy = policyEngine.getTrustPolicy();
      policy.didPolicy.minimumTrustScore = 0.7;
      await policyEngine.setPolicy(policy);

      const attestation = {
        issuer: 'did:key:allowed1',
        trustScore: 0.5 // Below minimum
      };

      const evaluation = await policyEngine.evaluateAttestation(attestation);
      
      // Trust score violation is a warning, not a compliance failure
      assert.ok(evaluation.checks.didPolicy.violations.some(
        v => v.type === 'trust_score'
      ));
    });
  });

  describe('SLSA Policy Evaluation', () => {
    test('should enforce minimum SLSA level', async () => {
      const policy = policyEngine.getTrustPolicy();
      policy.slsaPolicy.minimumLevel = 'SLSA_LEVEL_3';
      await policyEngine.setPolicy(policy);

      const attestation = {
        issuer: 'did:key:test',
        slsaLevel: 'SLSA_LEVEL_2' // Below minimum
      };

      const evaluation = await policyEngine.evaluateAttestation(attestation);
      
      assert.strictEqual(evaluation.checks.slsaPolicy.compliant, false);
      assert.ok(evaluation.checks.slsaPolicy.violations.some(
        v => v.type === 'slsa_level'
      ));
    });

    test('should enforce reproducible build requirement', async () => {
      const policy = policyEngine.getTrustPolicy();
      policy.slsaPolicy.requireReproducibleBuild = true;
      await policyEngine.setPolicy(policy);

      const attestation = {
        issuer: 'did:key:test',
        reproducibleBuild: false
      };

      const evaluation = await policyEngine.evaluateAttestation(attestation);
      
      assert.strictEqual(evaluation.checks.slsaPolicy.compliant, false);
      assert.ok(evaluation.checks.slsaPolicy.violations.some(
        v => v.type === 'reproducible_build'
      ));
    });

    test('should validate allowed build platforms', async () => {
      const policy = policyEngine.getTrustPolicy();
      policy.slsaPolicy.allowedBuildPlatforms = ['github-actions', 'gitlab-ci'];
      await policyEngine.setPolicy(policy);

      const attestation = {
        issuer: 'did:key:test',
        buildPlatform: 'unknown-platform'
      };

      const evaluation = await policyEngine.evaluateAttestation(attestation);
      
      assert.strictEqual(evaluation.checks.slsaPolicy.compliant, false);
      assert.ok(evaluation.checks.slsaPolicy.violations.some(
        v => v.type === 'build_platform'
      ));
    });
  });

  describe('Attestation Policy Evaluation', () => {
    test('should check attestation age', async () => {
      const policy = policyEngine.getTrustPolicy();
      policy.attestationPolicy.maximumAge = 24 * 60 * 60 * 1000; // 24 hours
      await policyEngine.setPolicy(policy);

      const oldTimestamp = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(); // 48 hours ago
      const attestation = {
        issuer: 'did:key:test',
        timestamp: oldTimestamp
      };

      const evaluation = await policyEngine.evaluateAttestation(attestation);
      
      assert.ok(evaluation.checks.attestationPolicy.violations.some(
        v => v.type === 'attestation_age'
      ));
    });

    test('should enforce certificate transparency requirement', async () => {
      const policy = policyEngine.getTrustPolicy();
      policy.attestationPolicy.requireCertificateTransparency = true;
      await policyEngine.setPolicy(policy);

      const attestation = {
        issuer: 'did:key:test',
        // Missing certificateTransparency field
      };

      const evaluation = await policyEngine.evaluateAttestation(attestation);
      
      assert.strictEqual(evaluation.checks.attestationPolicy.compliant, false);
      assert.ok(evaluation.checks.attestationPolicy.violations.some(
        v => v.type === 'certificate_transparency'
      ));
    });
  });

  describe('Cryptographic Policy Evaluation', () => {
    test('should validate allowed key types', async () => {
      const policy = policyEngine.getTrustPolicy();
      policy.cryptographicPolicy.allowedKeyTypes = ['Ed25519', 'RSA'];
      await policyEngine.setPolicy(policy);

      const attestation = {
        issuer: 'did:key:test',
        keyType: 'secp256k1' // Not in allowed list
      };

      const evaluation = await policyEngine.evaluateAttestation(attestation);
      
      assert.strictEqual(evaluation.checks.cryptographicPolicy.compliant, false);
      assert.ok(evaluation.checks.cryptographicPolicy.violations.some(
        v => v.type === 'key_type'
      ));
    });

    test('should enforce minimum key size', async () => {
      const policy = policyEngine.getTrustPolicy();
      policy.cryptographicPolicy.minimumKeySize = 2048;
      await policyEngine.setPolicy(policy);

      const attestation = {
        issuer: 'did:key:test',
        keySize: 1024 // Below minimum
      };

      const evaluation = await policyEngine.evaluateAttestation(attestation);
      
      assert.strictEqual(evaluation.checks.cryptographicPolicy.compliant, false);
      assert.ok(evaluation.checks.cryptographicPolicy.violations.some(
        v => v.type === 'key_size'
      ));
    });

    test('should enforce hardware key requirement', async () => {
      const policy = policyEngine.getTrustPolicy();
      policy.cryptographicPolicy.requireHardwareKeys = true;
      await policyEngine.setPolicy(policy);

      const attestation = {
        issuer: 'did:key:test',
        hardwareBacked: false
      };

      const evaluation = await policyEngine.evaluateAttestation(attestation);
      
      assert.strictEqual(evaluation.checks.cryptographicPolicy.compliant, false);
      assert.ok(evaluation.checks.cryptographicPolicy.violations.some(
        v => v.type === 'hardware_keys'
      ));
    });
  });

  describe('DID List Management', () => {
    test('should update DID allowlist', async () => {
      const newDIDs = ['did:key:new1', 'did:key:new2'];
      
      const allowlist = await policyEngine.updateDIDAllowlist(newDIDs, 'add');
      
      assert.ok(allowlist.includes('did:key:new1'));
      assert.ok(allowlist.includes('did:key:new2'));
      
      // Verify persistence
      const policy = policyEngine.getTrustPolicy();
      assert.ok(policy.didPolicy.allowlist.includes('did:key:new1'));
    });

    test('should remove DIDs from allowlist', async () => {
      // First add some DIDs
      await policyEngine.updateDIDAllowlist(['did:key:remove1', 'did:key:keep1'], 'add');
      
      // Then remove one
      const allowlist = await policyEngine.updateDIDAllowlist(['did:key:remove1'], 'remove');
      
      assert.ok(!allowlist.includes('did:key:remove1'));
      assert.ok(allowlist.includes('did:key:keep1'));
    });

    test('should update DID denylist', async () => {
      const deniedDIDs = ['did:key:bad1', 'did:key:bad2'];
      
      const denylist = await policyEngine.updateDIDDenylist(deniedDIDs, 'add');
      
      assert.ok(denylist.includes('did:key:bad1'));
      assert.ok(denylist.includes('did:key:bad2'));
    });
  });

  describe('Policy Summary', () => {
    test('should provide policy summary', async () => {
      // Add some DIDs to lists
      await policyEngine.updateDIDAllowlist(['did:key:allowed1'], 'add');
      await policyEngine.updateDIDDenylist(['did:key:denied1'], 'add');
      
      const summary = policyEngine.getPolicySummary();
      
      assert.strictEqual(summary.version, '1.0');
      assert.strictEqual(summary.didPolicy.allowlistSize, 1);
      assert.strictEqual(summary.didPolicy.denylistSize, 1);
      assert.ok(summary.slsaPolicy);
      assert.ok(summary.cryptographicPolicy);
    });
  });
});

describe('Trust Store', () => {
  let trustStore;

  beforeEach(async () => {
    await fs.remove(testStorePath);
    trustStore = new TrustStore({ storePath: testStorePath });
    await trustStore.initialize();
  });

  afterEach(async () => {
    await fs.remove(testStorePath);
  });

  describe('Entity Management', () => {
    test('should add trusted entity', async () => {
      const did = 'did:key:trusted1';
      const entityData = {
        name: 'Trusted Entity 1',
        organization: 'ACME Corp',
        trustScore: 0.8,
        verified: true
      };

      const entity = await trustStore.addTrustedEntity(did, entityData);
      
      assert.strictEqual(entity.did, did);
      assert.strictEqual(entity.name, 'Trusted Entity 1');
      assert.strictEqual(entity.trustScore, 0.8);
      assert.ok(entity.addedAt);
    });

    test('should retrieve trusted entity', async () => {
      const did = 'did:key:retrieve-test';
      await trustStore.addTrustedEntity(did, { name: 'Test Entity' });
      
      const entity = trustStore.getTrustedEntity(did);
      
      assert.ok(entity);
      assert.strictEqual(entity.did, did);
      assert.strictEqual(entity.name, 'Test Entity');
    });

    test('should update trust score', async () => {
      const did = 'did:key:score-test';
      await trustStore.addTrustedEntity(did, { trustScore: 0.5 });
      
      const updatedEntity = await trustStore.updateTrustScore(
        did,
        0.8,
        'Improved reputation'
      );
      
      assert.strictEqual(updatedEntity.trustScore, 0.8);
      assert.ok(updatedEntity.lastScoreUpdate);
      assert.ok(Array.isArray(updatedEntity.scoreHistory));
      assert.strictEqual(updatedEntity.scoreHistory[0].newScore, 0.8);
      assert.strictEqual(updatedEntity.scoreHistory[0].reason, 'Improved reputation');
    });

    test('should clamp trust scores to valid range', async () => {
      const did = 'did:key:clamp-test';
      await trustStore.addTrustedEntity(did, { trustScore: 0.5 });
      
      // Test upper bound
      await trustStore.updateTrustScore(did, 1.5, 'Above max');
      let entity = trustStore.getTrustedEntity(did);
      assert.strictEqual(entity.trustScore, 1.0);
      
      // Test lower bound
      await trustStore.updateTrustScore(did, -0.5, 'Below min');
      entity = trustStore.getTrustedEntity(did);
      assert.strictEqual(entity.trustScore, 0.0);
    });

    test('should persist entities across restarts', async () => {
      const did = 'did:key:persistence-test';
      await trustStore.addTrustedEntity(did, {
        name: 'Persistent Entity',
        trustScore: 0.9
      });
      
      // Create new trust store instance
      const newTrustStore = new TrustStore({ storePath: testStorePath });
      await newTrustStore.initialize();
      
      const entity = newTrustStore.getTrustedEntity(did);
      assert.ok(entity);
      assert.strictEqual(entity.name, 'Persistent Entity');
      assert.strictEqual(entity.trustScore, 0.9);
    });

    test('should list all trusted entities', async () => {
      await trustStore.addTrustedEntity('did:key:entity1', { name: 'Entity 1' });
      await trustStore.addTrustedEntity('did:key:entity2', { name: 'Entity 2' });
      
      const entities = trustStore.listTrustedEntities();
      
      assert.strictEqual(entities.length, 2);
      assert.ok(entities.some(e => e.name === 'Entity 1'));
      assert.ok(entities.some(e => e.name === 'Entity 2'));
    });

    test('should sanitize DID for filename', () => {
      const did = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK';
      const sanitized = trustStore.sanitizeDID(did);
      
      assert.strictEqual(sanitized, 'did_key_z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK');
      assert.ok(!sanitized.includes(':'));
    });
  });
});
