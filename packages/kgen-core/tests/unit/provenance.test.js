/**
 * Provenance Verification Tests
 * Tests provenance tracking, attestation, and verification
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { createHash, createSign, createVerify } from 'crypto';
import { ProvenanceTracker } from '../../src/provenance/tracker.js';
import { AttestationGenerator } from '../../src/attestation/generator.js';

describe('Provenance Verification', () => {
  let tracker;
  let attestationGen;
  let outputDir;
  let mockSources;
  let mockTemplates;

  beforeEach(() => {
    outputDir = testUtils.createTempDir();
    
    tracker = new ProvenanceTracker({
      enableCrypto: true,
      enableTimestamps: true,
      outputDir
    });
    
    attestationGen = new AttestationGenerator({
      algorithm: 'sha256',
      keySize: 2048
    });
    
    mockSources = {
      graph: resolve(__TEST_FIXTURES__, 'graphs', 'simple-person.ttl'),
      template: resolve(__TEST_FIXTURES__, 'templates', 'person-template.json')
    };
    
    mockTemplates = {
      simple: JSON.parse(readFileSync(resolve(__TEST_FIXTURES__, 'templates', 'person-template.json'), 'utf-8'))
    };
  });

  afterEach(() => {
    testUtils.cleanupTempDir(outputDir);
  });

  describe('provenance tracking', () => {
    it('should track complete generation lineage', async () => {
      const operation = {
        id: 'test-operation-001',
        type: 'generate',
        inputs: {
          graph: mockSources.graph,
          template: mockSources.template
        },
        outputs: {
          file: resolve(outputDir, 'generated.ts')
        },
        timestamp: this.getDeterministicDate().toISOString()
      };
      
      const provenance = await tracker.track(operation);
      
      expect(provenance.success).toBe(true);
      expect(provenance.provenanceId).toBeDefined();
      expect(provenance.lineage).toBeDefined();
      expect(provenance.lineage.inputs).toHaveLength(2);
      expect(provenance.lineage.outputs).toHaveLength(1);
      
      // Verify input tracking
      const graphInput = provenance.lineage.inputs.find(i => i.path === mockSources.graph);
      expect(graphInput).toBeDefined();
      expect(graphInput.checksum).toBeDefined();
      expect(graphInput.contentType).toBe('text/turtle');
      
      // Verify output tracking
      const output = provenance.lineage.outputs[0];
      expect(output.path).toBe(resolve(outputDir, 'generated.ts'));
      expect(output.generated).toBe(true);
    });

    it('should compute accurate input checksums', async () => {
      const graphContent = readFileSync(mockSources.graph, 'utf-8');
      const templateContent = readFileSync(mockSources.template, 'utf-8');
      
      const operation = {
        id: 'checksum-test',
        type: 'generate',
        inputs: {
          graph: mockSources.graph,
          template: mockSources.template
        }
      };
      
      const provenance = await tracker.track(operation);
      
      // Verify checksums match actual content
      const graphInput = provenance.lineage.inputs.find(i => i.path === mockSources.graph);
      const templateInput = provenance.lineage.inputs.find(i => i.path === mockSources.template);
      
      const expectedGraphChecksum = createHash('sha256').update(graphContent).digest('hex');
      const expectedTemplateChecksum = createHash('sha256').update(templateContent).digest('hex');
      
      expect(graphInput.checksum).toBe(expectedGraphChecksum);
      expect(templateInput.checksum).toBe(expectedTemplateChecksum);
    });

    it('should track intermediate processing steps', async () => {
      const operation = {
        id: 'multi-step-test',
        type: 'generate',
        steps: [
          { name: 'parse-rdf', duration: 100, status: 'success' },
          { name: 'execute-query', duration: 50, status: 'success' },
          { name: 'render-template', duration: 25, status: 'success' },
          { name: 'write-output', duration: 10, status: 'success' }
        ]
      };
      
      const provenance = await tracker.track(operation);
      
      expect(provenance.lineage.steps).toHaveLength(4);
      expect(provenance.lineage.totalDuration).toBe(185);
      expect(provenance.lineage.steps.every(s => s.status === 'success')).toBe(true);
    });

    it('should handle operation failures in provenance', async () => {
      const operation = {
        id: 'failure-test',
        type: 'generate',
        status: 'failed',
        error: {
          message: 'Template compilation failed',
          code: 'TEMPLATE_ERROR',
          stack: 'Error: Template compilation failed\n    at ...'
        }
      };
      
      const provenance = await tracker.track(operation);
      
      expect(provenance.success).toBe(true); // Tracking succeeds even for failed operations
      expect(provenance.lineage.status).toBe('failed');
      expect(provenance.lineage.error).toBeDefined();
      expect(provenance.lineage.error.message).toBe('Template compilation failed');
    });
  });

  describe('attestation generation', () => {
    it('should generate valid attestation documents', async () => {
      const generationData = {
        inputs: [
          {
            path: mockSources.graph,
            checksum: createHash('sha256').update(readFileSync(mockSources.graph)).digest('hex'),
            type: 'graph'
          }
        ],
        outputs: [
          {
            path: resolve(outputDir, 'test-output.ts'),
            checksum: 'abc123',
            type: 'generated-code'
          }
        ],
        operation: {
          id: 'attestation-test',
          timestamp: '2024-01-01T00:00:00.000Z',
          engine: 'kgen-v1.0.0'
        }
      };
      
      const attestation = await attestationGen.generate(generationData);
      
      expect(attestation.success).toBe(true);
      expect(attestation.document).toBeDefined();
      
      // Verify attestation structure
      const doc = attestation.document;
      expect(doc._type).toBe('https://in-toto.io/Statement/v0.1');
      expect(doc.predicateType).toBe('https://slsa.dev/provenance/v0.2');
      expect(doc.subject).toHaveLength(1);
      expect(doc.predicate.builder.id).toBe('kgen-v1.0.0');
    });

    it('should include cryptographic signatures', async () => {
      const generationData = {
        inputs: [{ path: mockSources.graph, checksum: 'test-checksum' }],
        outputs: [{ path: 'output.ts', checksum: 'output-checksum' }],
        operation: { id: 'signature-test' }
      };
      
      const attestation = await attestationGen.generate(generationData, {
        sign: true,
        algorithm: 'RS256'
      });
      
      expect(attestation.success).toBe(true);
      expect(attestation.signature).toBeDefined();
      expect(attestation.signature.algorithm).toBe('RS256');
      expect(attestation.signature.value).toMatch(/^[A-Za-z0-9+/=]+$/);
      
      // Verify signature can be validated
      const publicKey = attestation.publicKey;
      const verify = createVerify('RSA-SHA256');
      verify.update(JSON.stringify(attestation.document));
      
      const isValid = verify.verify(publicKey, attestation.signature.value, 'base64');
      expect(isValid).toBe(true);
    });

    it('should generate reproducible attestations for identical inputs', async () => {
      const generationData = {
        inputs: [{ path: 'input.ttl', checksum: 'fixed-checksum-123' }],
        outputs: [{ path: 'output.ts', checksum: 'output-checksum-456' }],
        operation: {
          id: 'reproducible-test',
          timestamp: '2024-01-01T00:00:00.000Z' // Fixed timestamp
        }
      };
      
      const attestation1 = await attestationGen.generate(generationData);
      const attestation2 = await attestationGen.generate(generationData);
      
      expect(attestation1.success).toBe(true);
      expect(attestation2.success).toBe(true);
      
      // Documents should be identical (without signatures)
      delete attestation1.document.signature;
      delete attestation2.document.signature;
      
      expect(JSON.stringify(attestation1.document)).toBe(JSON.stringify(attestation2.document));
    });
  });

  describe('drift detection', () => {
    let originalOutput;
    let modifiedOutput;
    
    beforeEach(() => {
      originalOutput = resolve(outputDir, 'original.ts');
      modifiedOutput = resolve(outputDir, 'modified.ts');
      
      // Create test files
      writeFileSync(originalOutput, 'export const data = { name: "John Doe" };');
      writeFileSync(modifiedOutput, 'export const data = { name: "Jane Doe" };');
    });

    it('should detect file modifications', async () => {
      const originalProvenance = {
        outputs: [{
          path: originalOutput,
          checksum: createHash('sha256').update(readFileSync(originalOutput)).digest('hex')
        }]
      };
      
      // Modify the file
      writeFileSync(originalOutput, 'export const data = { name: "Modified" };');
      
      const driftCheck = await tracker.detectDrift(originalProvenance);
      
      expect(driftCheck.hasDrift).toBe(true);
      expect(driftCheck.driftedFiles).toHaveLength(1);
      expect(driftCheck.driftedFiles[0].path).toBe(originalOutput);
      expect(driftCheck.driftedFiles[0].reason).toBe('checksum_mismatch');
    });

    it('should detect file deletions', async () => {
      const provenance = {
        outputs: [{
          path: resolve(outputDir, 'deleted.ts'),
          checksum: 'some-checksum'
        }]
      };
      
      const driftCheck = await tracker.detectDrift(provenance);
      
      expect(driftCheck.hasDrift).toBe(true);
      expect(driftCheck.driftedFiles).toHaveLength(1);
      expect(driftCheck.driftedFiles[0].reason).toBe('file_missing');
    });

    it('should detect unauthorized file additions', async () => {
      const provenance = {
        outputs: [{
          path: originalOutput,
          checksum: createHash('sha256').update(readFileSync(originalOutput)).digest('hex')
        }]
      };
      
      // Add unexpected file
      const unexpectedFile = resolve(outputDir, 'unexpected.ts');
      writeFileSync(unexpectedFile, 'export const unexpected = true;');
      
      const driftCheck = await tracker.detectDrift(provenance, {
        checkDirectory: outputDir,
        includeUnexpected: true
      });
      
      expect(driftCheck.hasDrift).toBe(true);
      expect(driftCheck.unexpectedFiles).toHaveLength(1);
      expect(driftCheck.unexpectedFiles[0]).toBe(unexpectedFile);
    });

    it('should accurately measure drift severity', async () => {
      const provenance = {
        outputs: [
          { path: originalOutput, checksum: 'checksum1' },
          { path: modifiedOutput, checksum: 'checksum2' },
          { path: resolve(outputDir, 'missing.ts'), checksum: 'checksum3' }
        ]
      };
      
      const driftCheck = await tracker.detectDrift(provenance);
      
      expect(driftCheck.hasDrift).toBe(true);
      expect(driftCheck.severity).toBe('HIGH'); // Multiple files affected
      expect(driftCheck.driftedFiles).toHaveLength(3);
      
      const reasons = driftCheck.driftedFiles.map(f => f.reason);
      expect(reasons).toContain('checksum_mismatch');
      expect(reasons).toContain('file_missing');
    });
  });

  describe('provenance verification', () => {
    it('should verify valid provenance chains', async () => {
      // Create a complete provenance chain
      const operation1 = {
        id: 'step-1',
        type: 'ingest',
        inputs: { graph: mockSources.graph },
        outputs: { processed: resolve(outputDir, 'processed.jsonld') }
      };
      
      const operation2 = {
        id: 'step-2',
        type: 'generate',
        inputs: { processed: resolve(outputDir, 'processed.jsonld') },
        outputs: { code: resolve(outputDir, 'final.ts') }
      };
      
      const prov1 = await tracker.track(operation1);
      const prov2 = await tracker.track(operation2);
      
      const chainVerification = await tracker.verifyChain([prov1, prov2]);
      
      expect(chainVerification.valid).toBe(true);
      expect(chainVerification.chainLength).toBe(2);
      expect(chainVerification.issues).toHaveLength(0);
    });

    it('should detect broken provenance chains', async () => {
      const operation1 = {
        id: 'step-1',
        outputs: { file: 'output1.ts' }
      };
      
      const operation2 = {
        id: 'step-2',
        inputs: { file: 'different-input.ts' } // Broken chain
      };
      
      const prov1 = await tracker.track(operation1);
      const prov2 = await tracker.track(operation2);
      
      const chainVerification = await tracker.verifyChain([prov1, prov2]);
      
      expect(chainVerification.valid).toBe(false);
      expect(chainVerification.issues).toHaveLength(1);
      expect(chainVerification.issues[0].type).toBe('broken_chain');
    });

    it('should validate attestation signatures', async () => {
      const generationData = {
        inputs: [{ path: 'input.ttl', checksum: 'test' }],
        outputs: [{ path: 'output.ts', checksum: 'test' }],
        operation: { id: 'signature-validation-test' }
      };
      
      const attestation = await attestationGen.generate(generationData, { sign: true });
      
      // Verify signature
      const verification = await attestationGen.verify(attestation);
      
      expect(verification.valid).toBe(true);
      expect(verification.signatureValid).toBe(true);
      expect(verification.documentIntegrity).toBe(true);
    });

    it('should detect tampered attestations', async () => {
      const generationData = {
        inputs: [{ path: 'input.ttl', checksum: 'original' }],
        outputs: [{ path: 'output.ts', checksum: 'original' }],
        operation: { id: 'tamper-test' }
      };
      
      const attestation = await attestationGen.generate(generationData, { sign: true });
      
      // Tamper with document
      attestation.document.predicate.materials[0].digest.sha256 = 'tampered';
      
      const verification = await attestationGen.verify(attestation);
      
      expect(verification.valid).toBe(false);
      expect(verification.signatureValid).toBe(false);
      expect(verification.issues).toContain('signature_mismatch');
    });
  });

  describe('compliance reporting', () => {
    it('should generate SLSA compliance reports', async () => {
      const operation = {
        id: 'compliance-test',
        type: 'generate',
        inputs: { graph: mockSources.graph },
        outputs: { code: resolve(outputDir, 'compliant.ts') },
        buildEnvironment: {
          os: 'linux',
          arch: 'x64',
          node: process.version
        }
      };
      
      const provenance = await tracker.track(operation);
      const compliance = await tracker.generateComplianceReport(provenance, 'slsa-level-2');
      
      expect(compliance.standard).toBe('slsa-level-2');
      expect(compliance.compliant).toBe(true);
      expect(compliance.requirements.reproduced).toBe(true);
      expect(compliance.requirements.buildService).toBe(true);
      expect(compliance.requirements.signed).toBe(true);
    });

    it('should identify compliance gaps', async () => {
      const operation = {
        id: 'gap-test',
        type: 'generate',
        // Missing required fields for compliance
      };
      
      const provenance = await tracker.track(operation);
      const compliance = await tracker.generateComplianceReport(provenance, 'slsa-level-3');
      
      expect(compliance.compliant).toBe(false);
      expect(compliance.gaps).toBeDefined();
      expect(compliance.gaps.length).toBeGreaterThan(0);
    });
  });

  describe('performance', () => {
    it('should handle large provenance datasets efficiently', async () => {
      const operations = [];
      
      // Create 100 operations
      for (let i = 0; i < 100; i++) {
        operations.push({
          id: `perf-test-${i}`,
          type: 'generate',
          inputs: { file: `input-${i}.ttl` },
          outputs: { file: `output-${i}.ts` }
        });
      }
      
      const start = this.getDeterministicTimestamp();
      
      const provenances = await Promise.all(
        operations.map(op => tracker.track(op))
      );
      
      const duration = this.getDeterministicTimestamp() - start;
      
      expect(provenances).toHaveLength(100);
      expect(provenances.every(p => p.success)).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});
