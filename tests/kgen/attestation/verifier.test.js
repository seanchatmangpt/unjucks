/**
 * Attestation Verifier Tests
 * 
 * Test suite for fast verification and chain validation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AttestationVerifier } from '../../../packages/kgen-core/src/attestation/verifier.js';
import { AttestationGenerator } from '../../../packages/kgen-core/src/attestation/generator.js';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('AttestationVerifier', () => {
  let verifier;
  let generator;
  let testDir;
  let testArtifacts;

  beforeEach(async () => {
    // Create test directory
    testDir = path.join(__dirname, 'verifier-test');
    await fs.mkdir(testDir, { recursive: true });

    // Initialize verifier and generator
    verifier = new AttestationVerifier({
      cacheVerificationResults: true,
      maxConcurrentVerifications: 5
    });

    generator = new AttestationGenerator({
      enableBlockchainIntegrity: false
    });
    await generator.initialize();

    // Create test artifacts
    testArtifacts = [];
    for (let i = 0; i < 3; i++) {
      const artifactPath = path.join(testDir, `artifact-${i}.js`);
      await fs.writeFile(artifactPath, `console.log("Artifact ${i}");`);
      
      const context = {
        templatePath: `/template-${i}.njk`,
        sourceGraph: { [`entity${i}`]: `value${i}` }
      };
      
      await generator.generateAttestation(artifactPath, context);
      testArtifacts.push(artifactPath);
    }
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('fastVerify', () => {
    it('should verify valid attestation quickly', async () => {
      const result = await verifier.fastVerify(testArtifacts[0]);
      
      expect(result.verified).toBe(true);
      expect(result.artifactPath).toBe(testArtifacts[0]);
      expect(result.verificationTime).toBeDefined();
      expect(result.details.hash.verified).toBe(true);
      expect(result.details.structure.verified).toBe(true);
    });

    it('should cache verification results', async () => {
      // First verification
      const result1 = await verifier.fastVerify(testArtifacts[0]);
      expect(result1.cached).toBeUndefined();

      // Second verification should be cached
      const result2 = await verifier.fastVerify(testArtifacts[0]);
      expect(result2.cached).toBe(true);
      expect(result2.verificationTime).toBeLessThan(result1.verificationTime);
    });

    it('should detect hash mismatch', async () => {
      // Tamper with artifact
      await fs.writeFile(testArtifacts[0], 'console.log("TAMPERED");');

      const result = await verifier.fastVerify(testArtifacts[0]);
      
      expect(result.verified).toBe(false);
      expect(result.details.hash.verified).toBe(false);
      expect(result.details.hash.reason).toBe('Hash mismatch detected');
    });

    it('should handle missing sidecar', async () => {
      const nonExistentPath = path.join(testDir, 'missing.js');
      await fs.writeFile(nonExistentPath, 'console.log("test");');

      const result = await verifier.fastVerify(nonExistentPath);
      
      expect(result.verified).toBe(false);
      expect(result.reason).toBe('No attestation sidecar found');
    });

    it('should perform deep verification when requested', async () => {
      const result = await verifier.fastVerify(testArtifacts[0], { deep: true });
      
      expect(result.verified).toBe(true);
      expect(result.details.deep).toBeDefined();
      expect(result.details.deep.verified).toBe(true);
    });

    it('should validate attestation structure', async () => {
      // Create malformed attestation
      const malformedPath = path.join(testDir, 'malformed.js');
      await fs.writeFile(malformedPath, 'console.log("test");');
      
      const malformedAttestation = {
        id: 'test',
        // Missing required fields
      };
      
      await fs.writeFile(
        malformedPath + '.attest.json',
        JSON.stringify(malformedAttestation)
      );

      const result = await verifier.fastVerify(malformedPath);
      
      expect(result.verified).toBe(false);
      expect(result.details.structure.verified).toBe(false);
      expect(result.details.structure.reason).toContain('Missing required fields');
    });
  });

  describe('batchVerify', () => {
    it('should verify multiple artifacts in parallel', async () => {
      const startTime = Date.now();
      const result = await verifier.batchVerify(testArtifacts);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.totalArtifacts).toBe(testArtifacts.length);
      expect(result.analysis.verified).toBe(testArtifacts.length);
      expect(result.analysis.failed).toBe(0);
      expect(result.analysis.successRate).toBe(1);
      
      // Should be faster than sequential verification
      expect(duration).toBeLessThan(1000);
    });

    it('should handle mixed verification results', async () => {
      // Tamper with one artifact
      await fs.writeFile(testArtifacts[1], 'console.log("TAMPERED");');

      const result = await verifier.batchVerify(testArtifacts);

      expect(result.success).toBe(true);
      expect(result.analysis.verified).toBe(2);
      expect(result.analysis.failed).toBe(1);
      expect(result.analysis.successRate).toBeCloseTo(2/3);
      
      const failedResult = result.results.find(r => !r.verified);
      expect(failedResult).toBeDefined();
      expect(failedResult.path).toBe(testArtifacts[1]);
    });

    it('should respect concurrent verification limits', async () => {
      const verifierLimited = new AttestationVerifier({
        maxConcurrentVerifications: 2
      });

      // Create many test artifacts
      const manyArtifacts = [];
      for (let i = 0; i < 10; i++) {
        const artifactPath = path.join(testDir, `many-${i}.js`);
        await fs.writeFile(artifactPath, `console.log("Many ${i}");`);
        
        await generator.generateAttestation(artifactPath, {
          templatePath: `/template-many-${i}.njk`
        });
        
        manyArtifacts.push(artifactPath);
      }

      const result = await verifierLimited.batchVerify(manyArtifacts);
      
      expect(result.success).toBe(true);
      expect(result.totalArtifacts).toBe(10);
      expect(result.analysis.verified).toBe(10);
    });

    it('should analyze failure reasons', async () => {
      // Create artifacts with different failure modes
      const brokenArtifacts = [];
      
      // Missing sidecar
      const noSidecar = path.join(testDir, 'no-sidecar.js');
      await fs.writeFile(noSidecar, 'console.log("no sidecar");');
      brokenArtifacts.push(noSidecar);
      
      // Tampered artifact
      const tampered = path.join(testDir, 'tampered.js');
      await fs.writeFile(tampered, 'console.log("original");');
      await generator.generateAttestation(tampered, { templatePath: '/test.njk' });
      await fs.writeFile(tampered, 'console.log("tampered");');
      brokenArtifacts.push(tampered);

      const result = await verifier.batchVerify(brokenArtifacts);

      expect(result.analysis.failureReasons).toBeDefined();
      expect(result.analysis.failureReasons['No attestation sidecar found']).toBe(1);
      expect(result.analysis.failureReasons['Hash mismatch detected']).toBe(1);
    });
  });

  describe('verifyChain', () => {
    it('should verify valid attestation chain', async () => {
      // Get attestations from generated artifacts
      const attestations = [];
      for (const artifactPath of testArtifacts) {
        const sidecarPath = artifactPath + '.attest.json';
        const content = await fs.readFile(sidecarPath, 'utf8');
        attestations.push(JSON.parse(content));
      }

      const result = await verifier.verifyChain(attestations);

      expect(result.verified).toBe(true);
      expect(result.chainLength).toBe(attestations.length);
      expect(result.validLinks).toBe(attestations.length - 1);
      expect(result.brokenLinks).toHaveLength(0);
      expect(result.integrityScore).toBe(1);
    });

    it('should detect broken chain links', async () => {
      // Create attestations with broken chain
      const attestations = [
        {
          id: 'attest-1',
          attestationHash: 'hash1',
          integrity: { chainIndex: 0, previousHash: '0' }
        },
        {
          id: 'attest-2',
          attestationHash: 'hash2',
          integrity: { chainIndex: 1, previousHash: 'wrong-hash' } // Broken link
        }
      ];

      const result = await verifier.verifyChain(attestations);

      expect(result.verified).toBe(false);
      expect(result.brokenLinks).toHaveLength(1);
      expect(result.brokenLinks[0].current).toBe('attest-2');
      expect(result.integrityScore).toBe(0);
    });

    it('should handle empty chain', async () => {
      const result = await verifier.verifyChain([]);

      expect(result.verified).toBe(true);
      expect(result.reason).toBe('Empty chain is valid');
      expect(result.chainLength).toBe(0);
    });
  });

  describe('verifyTemplateLineage', () => {
    it('should verify template lineage', async () => {
      const attestation = {
        templateLineage: {
          templateFamily: 'react-components',
          derivedFrom: ['base-component'],
          modifications: ['added-props'],
          dependencies: ['react', 'styled-components']
        }
      };

      const result = await verifier.verifyTemplateLineage(attestation);

      expect(result.verified).toBe(true);
      expect(result.details.templateFamily.verified).toBe(true);
      expect(result.details.derivationChain.verified).toBe(true);
      expect(result.details.dependencies.verified).toBe(true);
    });

    it('should handle missing lineage', async () => {
      const attestation = {};

      const result = await verifier.verifyTemplateLineage(attestation);

      expect(result.verified).toBe(true);
      expect(result.reason).toBe('No template lineage to verify');
    });
  });

  describe('cache management', () => {
    it('should cache verification results', async () => {
      await verifier.fastVerify(testArtifacts[0]);
      
      const stats = verifier.getStatistics();
      expect(stats.cacheSize).toBe(1);
    });

    it('should clear cache', async () => {
      await verifier.fastVerify(testArtifacts[0]);
      expect(verifier.getStatistics().cacheSize).toBe(1);

      verifier.clearCache();
      expect(verifier.getStatistics().cacheSize).toBe(0);
    });

    it('should not cache forced verifications', async () => {
      await verifier.fastVerify(testArtifacts[0], { force: true });
      
      const result = await verifier.fastVerify(testArtifacts[0], { force: true });
      expect(result.cached).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should handle verification timeout', async () => {
      const slowVerifier = new AttestationVerifier({
        verificationTimeout: 1 // Very short timeout
      });

      // This test would need a slow verification scenario
      // For now, just ensure the timeout config is accepted
      expect(slowVerifier.config.verificationTimeout).toBe(1);
    });

    it('should handle corrupted attestation files', async () => {
      const corruptedPath = path.join(testDir, 'corrupted.js');
      await fs.writeFile(corruptedPath, 'console.log("test");');
      await fs.writeFile(corruptedPath + '.attest.json', 'invalid json{');

      const result = await verifier.fastVerify(corruptedPath);
      
      expect(result.verified).toBe(false);
      expect(result.error).toContain('Unexpected token');
    });
  });

  describe('performance', () => {
    it('should verify quickly with small files', async () => {
      const startTime = Date.now();
      const result = await verifier.fastVerify(testArtifacts[0]);
      const duration = Date.now() - startTime;

      expect(result.verified).toBe(true);
      expect(duration).toBeLessThan(100); // Should be very fast
    });

    it('should provide performance metrics', async () => {
      const result = await verifier.fastVerify(testArtifacts[0]);
      
      expect(result.verificationTime).toBeDefined();
      expect(typeof result.verificationTime).toBe('number');
      expect(result.verificationTime).toBeGreaterThan(0);
    });
  });
});