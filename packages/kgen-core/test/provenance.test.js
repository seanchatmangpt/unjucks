/**
 * Provenance System Tests
 * 
 * Tests for minimal provenance object generation and .attest.json integration.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ProvenanceGenerator } from '../src/provenance/core.js';
import { AttestationGenerator } from '../src/provenance/attestation-generator.js';

describe('Provenance System', () => {
  let tempDir;
  let testArtifactPath;
  let testTemplatePath;
  let testGraphPath;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = join(tmpdir(), 'provenance-test-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });

    // Create test files
    testArtifactPath = join(tempDir, 'test-artifact.js');
    testTemplatePath = join(tempDir, 'test-template.njk');
    testGraphPath = join(tempDir, 'test-graph.ttl');

    await fs.writeFile(testArtifactPath, 'console.log("Generated artifact");');
    await fs.writeFile(testTemplatePath, '<template>{{content}}</template>');
    await fs.writeFile(testGraphPath, '@prefix : <http://example.org/> .');
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('ProvenanceGenerator', () => {
    let generator;

    beforeEach(() => {
      generator = new ProvenanceGenerator({
        enableCAS: false // Disable CAS for isolated testing
      });
    });

    it('should generate minimal provenance object', async () => {
      const provenance = await generator.generateProvenance({
        artifactPath: testArtifactPath,
        templateId: 'test-template',
        templatePath: testTemplatePath,
        graphPath: testGraphPath,
        generatedAt: new Date('2023-01-01T00:00:00Z'),
        kgenVersion: '1.0.0'
      });

      // Verify minimal schema
      assert.ok(provenance.artifact);
      assert.ok(provenance.template);
      assert.ok(provenance.graph);
      assert.strictEqual(provenance.artifact.path, testArtifactPath);
      assert.strictEqual(provenance.template.id, 'test-template');
      assert.strictEqual(provenance.graph.path, testGraphPath);
      assert.strictEqual(provenance.kgenVersion, '1.0.0');
      assert.strictEqual(provenance.generatedAt, '2023-01-01T00:00:00.000Z');

      // Verify hashes are present and valid SHA256
      assert.match(provenance.artifact.hash, /^[a-f0-9]{64}$/);
      assert.match(provenance.template.hash, /^[a-f0-9]{64}$/);
      assert.match(provenance.graph.hash, /^[a-f0-9]{64}$/);
    });

    it('should handle missing optional fields', async () => {
      const provenance = await generator.generateProvenance({
        artifactPath: testArtifactPath,
        templateId: 'minimal-test'
      });

      assert.ok(provenance.artifact);
      assert.ok(provenance.template);
      assert.strictEqual(provenance.template.id, 'minimal-test');
      
      // Optional fields should be absent or null (cleaned up)
      assert.ok(!provenance.graph || provenance.graph.path === undefined);
    });

    it('should generate deterministic hashes', async () => {
      const provenance1 = await generator.generateProvenance({
        artifactPath: testArtifactPath,
        templateId: 'deterministic-test'
      });

      const provenance2 = await generator.generateProvenance({
        artifactPath: testArtifactPath,
        templateId: 'deterministic-test'
      });

      assert.strictEqual(provenance1.artifact.hash, provenance2.artifact.hash);
    });

    it('should validate provenance objects', () => {
      const validProvenance = {
        artifact: { path: '/test/path', hash: 'a'.repeat(64) },
        template: { id: 'test-template', hash: 'b'.repeat(64) },
        kgenVersion: '1.0.0'
      };

      const validation = generator.validateProvenance(validProvenance);
      assert.strictEqual(validation.valid, true);
      assert.strictEqual(validation.errors.length, 0);
    });

    it('should detect invalid provenance objects', () => {
      const invalidProvenance = {
        artifact: { path: '/test/path' }, // Missing hash
        template: {}, // Missing id and hash
        // Missing kgenVersion
      };

      const validation = generator.validateProvenance(invalidProvenance);
      assert.strictEqual(validation.valid, false);
      assert.ok(validation.errors.length > 0);
      assert.ok(validation.warnings.length > 0);
    });

    it('should compare provenance objects', () => {
      const provenance1 = {
        artifact: { hash: 'same-hash' },
        template: { id: 'template-1', hash: 'template-hash-1' },
        kgenVersion: '1.0.0'
      };

      const provenance2 = {
        artifact: { hash: 'same-hash' },
        template: { id: 'template-1', hash: 'template-hash-1' },
        kgenVersion: '1.0.0'
      };

      const comparison = generator.compareProvenance(provenance1, provenance2);
      assert.strictEqual(comparison.identical, true);
      assert.ok(comparison.similarities.length > 0);
      assert.strictEqual(comparison.differences.length, 0);
    });

    it('should detect provenance differences', () => {
      const provenance1 = {
        artifact: { hash: 'hash-1' },
        template: { id: 'template-1' },
        kgenVersion: '1.0.0'
      };

      const provenance2 = {
        artifact: { hash: 'hash-2' },
        template: { id: 'template-2' },
        kgenVersion: '2.0.0'
      };

      const comparison = generator.compareProvenance(provenance1, provenance2);
      assert.strictEqual(comparison.identical, false);
      assert.ok(comparison.differences.length > 0);
    });

    it('should update existing provenance', () => {
      const existing = {
        artifact: { path: '/old/path', hash: 'old-hash' },
        template: { id: 'old-template' },
        kgenVersion: '1.0.0'
      };

      const updates = {
        template: { id: 'new-template', hash: 'new-template-hash' },
        kgenVersion: '2.0.0'
      };

      const updated = generator.updateProvenance(existing, updates);
      
      assert.strictEqual(updated.artifact.path, '/old/path'); // Unchanged
      assert.strictEqual(updated.template.id, 'new-template'); // Updated
      assert.strictEqual(updated.template.hash, 'new-template-hash'); // Updated
      assert.strictEqual(updated.kgenVersion, '2.0.0'); // Updated
      assert.ok(updated.updatedAt); // Should have timestamp
    });

    it('should remove null values', async () => {
      const provenance = await generator.generateProvenance({
        artifactPath: testArtifactPath,
        templateId: 'null-test',
        templatePath: null, // This should be removed
        graphPath: undefined // This should be removed
      });

      // Check that null/undefined values are not present
      const serialized = JSON.stringify(provenance);
      assert.ok(!serialized.includes(':null') && !serialized.includes('null,'));
      assert.ok(!serialized.includes('undefined'));
    });
  });

  describe('AttestationGenerator', () => {
    let generator;

    beforeEach(() => {
      generator = new AttestationGenerator({
        enableCAS: false,
        enableMinimalMode: true
      });
    });

    it('should generate minimal .attest.json file', async () => {
      const result = await generator.generateAttestation({
        artifactPath: testArtifactPath,
        templateId: 'test-template',
        templatePath: testTemplatePath,
        graphPath: testGraphPath,
        kgenVersion: '1.0.0'
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.attestationPath);
      assert.ok(result.attestation);
      assert.ok(result.provenance);

      // Verify attestation structure
      const attestation = result.attestation;
      assert.strictEqual(attestation.format, 'kgen-minimal-attestation');
      assert.ok(attestation.provenance);
      assert.ok(attestation.timestamp);

      // Verify minimal provenance schema
      const provenance = attestation.provenance;
      assert.ok(provenance.artifact);
      assert.ok(provenance.template);
      assert.ok(provenance.graph);
      assert.strictEqual(provenance.artifact.path, testArtifactPath);
      assert.strictEqual(provenance.template.id, 'test-template');
      assert.strictEqual(provenance.kgenVersion, '1.0.0');

      // Verify file was created
      const fileExists = await fs.access(result.attestationPath).then(() => true).catch(() => false);
      assert.strictEqual(fileExists, true);
    });

    it('should generate full attestation when minimal mode disabled', async () => {
      const fullGenerator = new AttestationGenerator({
        enableCAS: false,
        enableMinimalMode: false
      });

      const result = await fullGenerator.generateAttestation({
        artifactPath: testArtifactPath,
        templateId: 'full-test',
        kgenVersion: '1.0.0'
      });

      assert.strictEqual(result.success, true);
      
      const attestation = result.attestation;
      assert.strictEqual(attestation.format, 'kgen-full-attestation');
      assert.ok(attestation.metadata);
      assert.ok(attestation.artifact);
      assert.ok(attestation.verification);
    });

    it('should verify existing attestation', async () => {
      // First generate an attestation
      const generateResult = await generator.generateAttestation({
        artifactPath: testArtifactPath,
        templateId: 'verify-test',
        kgenVersion: '1.0.0'
      });

      assert.strictEqual(generateResult.success, true);

      // Then verify it
      const verifyResult = await generator.verifyAttestation(generateResult.attestationPath);
      
      assert.strictEqual(verifyResult.valid, true);
      assert.ok(verifyResult.validation);
      assert.ok(verifyResult.integrityCheck);
      assert.strictEqual(verifyResult.validation.valid, true);
      assert.strictEqual(verifyResult.integrityCheck.valid, true);
    });

    it('should detect modified artifacts', async () => {
      // Generate attestation
      const generateResult = await generator.generateAttestation({
        artifactPath: testArtifactPath,
        templateId: 'modify-test',
        kgenVersion: '1.0.0'
      });

      // Modify the artifact
      await fs.writeFile(testArtifactPath, 'console.log("Modified content");');

      // Verify should fail
      const verifyResult = await generator.verifyAttestation(generateResult.attestationPath);
      
      assert.strictEqual(verifyResult.valid, false);
      assert.strictEqual(verifyResult.integrityCheck.valid, false);
      assert.ok(verifyResult.integrityCheck.reason.includes('mismatch'));
    });

    it('should update existing attestation', async () => {
      // Generate initial attestation
      const generateResult = await generator.generateAttestation({
        artifactPath: testArtifactPath,
        templateId: 'update-test',
        kgenVersion: '1.0.0'
      });

      // Update with new information
      const updateResult = await generator.updateAttestation(
        generateResult.attestationPath,
        { kgenVersion: '2.0.0' }
      );

      assert.strictEqual(updateResult.success, true);
      assert.strictEqual(updateResult.attestation.provenance.kgenVersion, '2.0.0');
    });

    it('should handle batch attestation generation', async () => {
      const artifacts = [
        {
          artifactPath: testArtifactPath,
          templateId: 'batch-1',
          kgenVersion: '1.0.0'
        },
        {
          artifactPath: testTemplatePath,
          templateId: 'batch-2',
          kgenVersion: '1.0.0'
        }
      ];

      const batchResult = await generator.generateBatchAttestations(artifacts);
      
      assert.strictEqual(batchResult.success, true);
      assert.strictEqual(batchResult.successCount, 2);
      assert.strictEqual(batchResult.errorCount, 0);
      assert.strictEqual(batchResult.results.length, 2);

      // Verify all results are successful
      for (const result of batchResult.results) {
        assert.strictEqual(result.success, true);
        assert.ok(result.attestation);
      }
    });

    it('should handle attestation generation errors gracefully', async () => {
      const result = await generator.generateAttestation({
        artifactPath: '/nonexistent/file.js',
        templateId: 'error-test',
        kgenVersion: '1.0.0'
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
      assert.strictEqual(result.attestation, null);
    });

    it('should extract provenance from legacy attestation formats', async () => {
      // Create a legacy format attestation file
      const legacyAttestation = {
        generation: {
          template: 'legacy-template',
          templateHash: 'legacy-template-hash',
          graphPath: '/legacy/graph.ttl',
          graphHash: 'legacy-graph-hash',
          timestamp: '2023-01-01T00:00:00Z',
          engine: 'kgen@0.9.0'
        },
        artifact: {
          path: testArtifactPath,
          hash: 'legacy-artifact-hash'
        }
      };

      const legacyPath = join(tempDir, 'legacy.attest.json');
      await fs.writeFile(legacyPath, JSON.stringify(legacyAttestation, null, 2));

      const extracted = await generator.provenance.extractFromAttestation(legacyPath);
      
      assert.strictEqual(extracted.template.id, 'legacy-template');
      assert.strictEqual(extracted.template.hash, 'legacy-template-hash');
      assert.strictEqual(extracted.graph.path, '/legacy/graph.ttl');
      assert.strictEqual(extracted.kgenVersion, '0.9.0');
    });
  });

  describe('Integration Tests', () => {
    it('should work end-to-end with CAS integration', async () => {
      const generator = new AttestationGenerator({
        enableCAS: true,
        enableMinimalMode: true
      });

      const result = await generator.generateAttestation({
        artifactPath: testArtifactPath,
        templateId: 'cas-integration-test',
        templatePath: testTemplatePath,
        graphPath: testGraphPath,
        kgenVersion: '1.0.0'
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.casHashes);
      assert.ok(result.attestation.cas);

      // Verify CAS hashes are valid SHA256
      for (const hash of Object.values(result.casHashes)) {
        assert.match(hash, /^[a-f0-9]{64}$/);
      }
    });

    it('should maintain provenance consistency across operations', async () => {
      const generator = new ProvenanceGenerator();
      
      // Generate provenance
      const provenance = await generator.generateProvenance({
        artifactPath: testArtifactPath,
        templateId: 'consistency-test',
        kgenVersion: '1.0.0'
      });

      // Validate it
      const validation = generator.validateProvenance(provenance);
      assert.strictEqual(validation.valid, true);

      // Generate attestation from the same data
      const attestationGen = new AttestationGenerator({ enableMinimalMode: true });
      const attestationResult = await attestationGen.generateAttestation({
        artifactPath: testArtifactPath,
        templateId: 'consistency-test',
        kgenVersion: '1.0.0'
      });

      // Compare provenance objects
      const comparison = generator.compareProvenance(
        provenance,
        attestationResult.provenance
      );

      assert.strictEqual(comparison.identical, true);
    });
  });
});