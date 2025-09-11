/**
 * Attestation Generator Tests
 * 
 * Comprehensive test suite for the AttestationGenerator class
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AttestationGenerator } from '../../../packages/kgen-core/src/attestation/generator.js';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('AttestationGenerator', () => {
  let generator;
  let testDir;
  let testArtifactPath;

  beforeEach(async () => {
    // Create test directory
    testDir = path.join(__dirname, 'test-artifacts');
    await fs.mkdir(testDir, { recursive: true });

    // Create test artifact
    testArtifactPath = path.join(testDir, 'test-artifact.js');
    await fs.writeFile(testArtifactPath, 'console.log("Hello World");');

    // Initialize generator
    generator = new AttestationGenerator({
      enableBlockchainIntegrity: false // Disable for testing
    });
    
    await generator.initialize();
  });

  afterEach(async () => {
    // Cleanup test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const newGenerator = new AttestationGenerator();
      const result = await newGenerator.initialize();
      
      expect(result.status).toBe('success');
      expect(result.version).toBe('1.0.0');
      expect(result.blockchain).toBe('disabled');
    });

    it('should initialize hash chain with genesis block', async () => {
      expect(generator.hashChain).toHaveLength(1);
      expect(generator.hashChain[0].type).toBe('genesis');
      expect(generator.hashChain[0].previousHash).toBe('0');
    });
  });

  describe('generateAttestation', () => {
    it('should generate attestation for artifact', async () => {
      const context = {
        templatePath: '/path/to/template.njk',
        templateHash: 'abc123',
        sourceGraph: { entity1: 'value1' },
        variables: { name: 'test' },
        agent: 'test-agent'
      };

      const result = await generator.generateAttestation(testArtifactPath, context);

      expect(result.attestation).toBeDefined();
      expect(result.sidecarPath).toBe(testArtifactPath + '.attest.json');
      expect(result.artifactHash).toMatch(/^[a-f0-9]{64}$/);
      expect(result.attestationHash).toMatch(/^[a-f0-9]{64}$/);

      // Check attestation structure
      const attestation = result.attestation;
      expect(attestation.id).toBeDefined();
      expect(attestation.version).toBe('1.0.0');
      expect(attestation.artifact.path).toBe(testArtifactPath);
      expect(attestation.provenance.templatePath).toBe(context.templatePath);
      expect(attestation.integrity.chainIndex).toBe(1); // After genesis
    });

    it('should create sidecar file', async () => {
      const context = { templatePath: '/test/template.njk' };
      const result = await generator.generateAttestation(testArtifactPath, context);

      const sidecarExists = await fs.access(result.sidecarPath).then(() => true).catch(() => false);
      expect(sidecarExists).toBe(true);

      const sidecarContent = await fs.readFile(result.sidecarPath, 'utf8');
      const parsedAttestation = JSON.parse(sidecarContent);
      expect(parsedAttestation.id).toBe(result.attestation.id);
    });

    it('should build verification chain', async () => {
      const context = {
        templatePath: '/path/to/template.njk',
        templateHash: 'template123',
        rulePath: '/path/to/rule.js',
        sourceGraph: { entity1: 'test' }
      };

      const result = await generator.generateAttestation(testArtifactPath, context);
      const verificationChain = result.attestation.integrity.verificationChain;

      expect(verificationChain).toBeInstanceOf(Array);
      expect(verificationChain.length).toBeGreaterThan(0);
      
      const templateEntry = verificationChain.find(item => item.type === 'template');
      expect(templateEntry).toBeDefined();
      expect(templateEntry.path).toBe(context.templatePath);
      expect(templateEntry.hash).toBe(context.templateHash);
    });

    it('should maintain hash chain integrity', async () => {
      const context1 = { templatePath: '/template1.njk' };
      const context2 = { templatePath: '/template2.njk' };

      const result1 = await generator.generateAttestation(testArtifactPath, context1);
      
      // Create second artifact
      const testArtifactPath2 = path.join(testDir, 'test-artifact2.js');
      await fs.writeFile(testArtifactPath2, 'console.log("Hello World 2");');
      
      const result2 = await generator.generateAttestation(testArtifactPath2, context2);

      // Check chain linkage
      expect(result2.attestation.integrity.previousHash).toBe(result1.attestation.attestationHash);
      expect(result2.attestation.integrity.chainIndex).toBe(result1.attestation.integrity.chainIndex + 1);
    });
  });

  describe('verifyAttestation', () => {
    it('should verify valid attestation', async () => {
      const context = { templatePath: '/test/template.njk' };
      await generator.generateAttestation(testArtifactPath, context);

      const verification = await generator.verifyAttestation(testArtifactPath);
      
      expect(verification.verified).toBe(true);
      expect(verification.artifactPath).toBe(testArtifactPath);
      expect(verification.verificationDetails.artifactHash.verified).toBe(true);
    });

    it('should detect tampered artifact', async () => {
      const context = { templatePath: '/test/template.njk' };
      await generator.generateAttestation(testArtifactPath, context);

      // Tamper with artifact
      await fs.writeFile(testArtifactPath, 'console.log("TAMPERED");');

      const verification = await generator.verifyAttestation(testArtifactPath);
      
      expect(verification.verified).toBe(false);
      expect(verification.verificationDetails.artifactHash.verified).toBe(false);
    });

    it('should handle missing sidecar', async () => {
      const verification = await generator.verifyAttestation(testArtifactPath);
      
      expect(verification.verified).toBe(false);
      expect(verification.reason).toBe('No attestation sidecar found');
    });
  });

  describe('explainArtifact', () => {
    it('should provide comprehensive explanation', async () => {
      const context = {
        templatePath: '/templates/component.njk',
        templateHash: 'hash123',
        sourceGraph: { entity1: 'value1', entity2: 'value2' },
        variables: { name: 'MyComponent', type: 'React' },
        agent: 'kgen-system'
      };

      await generator.generateAttestation(testArtifactPath, context);
      const explanation = await generator.explainArtifact(testArtifactPath);

      expect(explanation.success).toBe(true);
      expect(explanation.explanation.artifact.path).toBe(testArtifactPath);
      expect(explanation.explanation.origin.template.path).toBe(context.templatePath);
      expect(explanation.explanation.origin.sourceGraph).toEqual(context.sourceGraph);
      expect(explanation.explanation.integrity.artifactHash).toBeDefined();
    });

    it('should handle unverified artifact', async () => {
      const explanation = await generator.explainArtifact(testArtifactPath);
      
      expect(explanation.success).toBe(false);
      expect(explanation.reason).toBe('Attestation verification failed');
    });
  });

  describe('template versioning', () => {
    it('should track template versions', async () => {
      const templatePath = path.join(testDir, 'template.njk');
      await fs.writeFile(templatePath, '{{ name }} template');

      const context = { templatePath };
      const result = await generator.generateAttestation(testArtifactPath, context);

      expect(result.attestation.provenance.templateVersion).toMatch(/^v[a-f0-9]{8}$/);
      expect(generator.templateVersions.has(templatePath)).toBe(true);
    });

    it('should detect template changes', async () => {
      const templatePath = path.join(testDir, 'template.njk');
      await fs.writeFile(templatePath, 'Original template');

      const context = { templatePath };
      const result1 = await generator.generateAttestation(testArtifactPath, context);

      // Modify template
      await fs.writeFile(templatePath, 'Modified template');
      
      const testArtifactPath2 = path.join(testDir, 'artifact2.js');
      await fs.writeFile(testArtifactPath2, 'console.log("artifact2");');
      
      const result2 = await generator.generateAttestation(testArtifactPath2, context);

      expect(result2.attestation.provenance.templateVersion).not.toBe(
        result1.attestation.provenance.templateVersion
      );
    });
  });

  describe('error handling', () => {
    it('should handle missing artifact file', async () => {
      const nonExistentPath = path.join(testDir, 'missing.js');
      const context = { templatePath: '/test/template.njk' };

      await expect(generator.generateAttestation(nonExistentPath, context))
        .rejects.toThrow();
    });

    it('should handle invalid context', async () => {
      const result = await generator.generateAttestation(testArtifactPath, {});
      
      // Should still work with minimal context
      expect(result.attestation).toBeDefined();
      expect(result.attestation.provenance.templatePath).toBeUndefined();
    });
  });

  describe('statistics', () => {
    it('should provide system statistics', async () => {
      const stats = generator.getStatistics();
      
      expect(stats.state).toBe('ready');
      expect(stats.totalArtifacts).toBe(0);
      expect(stats.hashChainLength).toBe(1); // Genesis block
      expect(stats.templateVersions).toBe(0);
    });

    it('should update statistics after operations', async () => {
      const context = { templatePath: '/test/template.njk' };
      await generator.generateAttestation(testArtifactPath, context);

      const stats = generator.getStatistics();
      expect(stats.totalArtifacts).toBe(1);
      expect(stats.hashChainLength).toBe(2); // Genesis + 1 attestation
    });
  });
});