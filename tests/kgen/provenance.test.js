/**
 * Comprehensive Test Suite for KGEN Provenance System
 * 
 * Tests all components of the provenance system including attestation generation,
 * cryptographic verification, SPARQL queries, and artifact explanation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';

// Import provenance components
import { AttestationGenerator } from '../../packages/kgen-core/src/provenance/attestation.js';
import { CryptographicVerifier } from '../../packages/kgen-core/src/provenance/verification.js';
import { ArtifactExplainer } from '../../packages/kgen-core/src/provenance/artifact-explainer.js';
import { ProvenanceQueries } from '../../packages/kgen-core/src/provenance/queries/sparql.js';
import { createProvenanceTracker, explainArtifact, verifyArtifact } from '../../packages/kgen-core/src/provenance/index.js';

describe('KGEN Provenance System', () => {
  let testDir;
  let testFiles;
  let attestationGenerator;
  let verifier;
  let explainer;
  let queries;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = path.join(tmpdir(), 'kgen-provenance-test-' + uuidv4());
    await fs.mkdir(testDir, { recursive: true });
    
    // Create test files
    testFiles = {
      artifact: path.join(testDir, 'test-artifact.js'),
      source: path.join(testDir, 'source-graph.ttl'),
      template: path.join(testDir, 'template.js'),
      rules: path.join(testDir, 'rules.json')
    };
    
    // Create test artifact
    await fs.writeFile(testFiles.artifact, `
// Generated JavaScript artifact
function testFunction() {
  return 'Hello from KGEN';
}

module.exports = { testFunction };
`);
    
    // Create test source graph
    await fs.writeFile(testFiles.source, `
@prefix ex: <http://example.org/> .
@prefix prov: <http://www.w3.org/ns/prov#> .

ex:TestEntity a prov:Entity ;
  prov:generatedAtTime "2025-09-11T20:00:00Z" .
`);
    
    // Create test template
    await fs.writeFile(testFiles.template, `
// Template: JavaScript Function
function {{functionName}}() {
  return '{{message}}';
}
`);
    
    // Create test rules
    await fs.writeFile(testFiles.rules, JSON.stringify({
      rules: [
        { type: 'function_generation', pattern: 'js_function' },
        { type: 'export_generation', pattern: 'commonjs' }
      ]
    }, null, 2));
    
    // Initialize components
    attestationGenerator = new AttestationGenerator({
      enableSignatures: false, // Disable for testing
      createSidecars: true
    });
    
    verifier = new CryptographicVerifier({
      enableTimingAttackProtection: false // Disable for testing performance
    });
    
    explainer = new ArtifactExplainer({
      enableCaching: false // Disable for testing
    });
    
    queries = new ProvenanceQueries();
    
    await verifier.initialize();
  });

  afterEach(async () => {
    // Cleanup test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup test directory:', error);
    }
    
    await verifier.shutdown();
    await explainer.shutdown();
  });

  describe('Attestation Generation', () => {
    it('should generate complete attestation for artifact', async () => {
      const metadata = {
        graphHash: 'sha256:abc123',
        template: 'javascript-function',
        templateVersion: '1.0.0',
        rules: 'javascript-rules',
        rulesVersion: '1.0.0',
        engineVersion: '1.0.0',
        operationId: uuidv4()
      };
      
      const attestation = await attestationGenerator.generateAttestation(
        testFiles.artifact,
        metadata
      );
      
      // Verify attestation structure
      expect(attestation).toHaveProperty('attestationId');
      expect(attestation).toHaveProperty('version');
      expect(attestation).toHaveProperty('timestamp');
      expect(attestation).toHaveProperty('artifact');
      expect(attestation).toHaveProperty('generation');
      expect(attestation).toHaveProperty('provenance');
      expect(attestation).toHaveProperty('verification');
      
      // Verify artifact information
      expect(attestation.artifact.path).toBe(path.resolve(testFiles.artifact));
      expect(attestation.artifact.hash).toMatch(/^sha256:/);
      expect(attestation.artifact.size).toBeGreaterThan(0);
      
      // Verify generation metadata
      expect(attestation.generation.graphHash).toBe(metadata.graphHash);
      expect(attestation.generation.template).toBe(metadata.template);
      expect(attestation.generation.rules).toBe(metadata.rules);
      expect(attestation.generation.engine).toBe(`kgen@${metadata.engineVersion}`);
      
      // Verify PROV-O compliance
      expect(attestation.provenance).toHaveProperty('@context');
      expect(attestation.provenance).toHaveProperty('entity');
      expect(attestation.provenance).toHaveProperty('activity');
      expect(attestation.provenance).toHaveProperty('agent');
      
      // Verify sidecar file creation
      const sidecarPath = testFiles.artifact + '.attest.json';
      const sidecarExists = await fs.access(sidecarPath).then(() => true).catch(() => false);
      expect(sidecarExists).toBe(true);
    });
    
    it('should generate attestation with lineage chain', async () => {
      const metadata = {
        sourceGraph: testFiles.source,
        graphHash: 'sha256:source123',
        template: testFiles.template,
        templateHash: 'sha256:template123',
        rules: testFiles.rules,
        rulesHash: 'sha256:rules123',
        dependencies: [
          { path: testFiles.source, hash: 'sha256:dep1' },
          { path: testFiles.template, hash: 'sha256:dep2' }
        ]
      };
      
      const attestation = await attestationGenerator.generateAttestation(
        testFiles.artifact,
        metadata
      );
      
      expect(attestation).toHaveProperty('lineage');
      expect(attestation.lineage).toBeInstanceOf(Array);
      expect(attestation.lineage.length).toBeGreaterThan(0);
      
      // Check lineage items
      const sourceItem = attestation.lineage.find(item => item.type === 'source');
      expect(sourceItem).toBeDefined();
      expect(sourceItem.resource).toBe(metadata.sourceGraph);
      expect(sourceItem.hash).toBe(metadata.graphHash);
      
      const templateItem = attestation.lineage.find(item => item.type === 'template');
      expect(templateItem).toBeDefined();
      expect(templateItem.resource).toBe(metadata.template);
    });
    
    it('should batch generate attestations', async () => {
      const artifactPaths = [testFiles.artifact, testFiles.template, testFiles.rules];
      const metadata = { batchId: uuidv4() };
      
      const results = await attestationGenerator.batchGenerateAttestations(
        artifactPaths,
        metadata
      );
      
      expect(results).toHaveLength(3);
      
      results.forEach((result, index) => {
        expect(result).toHaveProperty('path');
        expect(result).toHaveProperty('success');
        expect(result.path).toBe(artifactPaths[index]);
        expect(result.success).toBe(true);
        expect(result.attestation).toHaveProperty('attestationId');
        expect(result.attestation.generation.batchId).toBe(metadata.batchId);
      });
    });
  });

  describe('Cryptographic Verification', () => {
    let attestation;
    
    beforeEach(async () => {
      // Generate attestation for testing
      attestation = await attestationGenerator.generateAttestation(
        testFiles.artifact,
        { operationId: uuidv4() }
      );
    });
    
    it('should verify artifact integrity', async () => {
      const result = await verifier.verifyArtifact(testFiles.artifact, attestation);
      
      expect(result).toHaveProperty('verificationId');
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('checks');
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.checks.artifactExists).toBe(true);
      expect(result.checks.hashMatches).toBe(true);
      expect(result.checks.currentHash).toMatch(/^sha256:/);
    });
    
    it('should detect hash mismatch', async () => {
      // Modify the artifact
      await fs.writeFile(testFiles.artifact, 'modified content');
      
      const result = await verifier.verifyArtifact(testFiles.artifact, attestation);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(error => error.includes('Hash mismatch'))).toBe(true);
      expect(result.checks.hashMatches).toBe(false);
    });
    
    it('should verify attestation structure', async () => {
      const result = await verifier.verifyArtifact(testFiles.artifact, attestation);
      
      expect(result.checks.structureValid).toBe(true);
      expect(result.checks.provOCompliant).toBeDefined();
      expect(result.checks.versionSupported).toBe(true);
    });
    
    it('should batch verify multiple artifacts', async () => {
      // Generate attestations for all test files
      const attestations = [];
      for (const filePath of [testFiles.artifact, testFiles.template, testFiles.rules]) {
        const att = await attestationGenerator.generateAttestation(filePath, {});
        attestations.push(att);
      }
      
      const results = await verifier.batchVerify(
        [testFiles.artifact, testFiles.template, testFiles.rules],
        { attestations }
      );
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });
  });

  describe('Artifact Explanation', () => {
    let attestation;
    
    beforeEach(async () => {
      // Generate comprehensive attestation
      attestation = await attestationGenerator.generateAttestation(
        testFiles.artifact,
        {
          sourceGraph: testFiles.source,
          graphHash: 'sha256:source123',
          template: 'javascript-function',
          templateVersion: '1.0.0',
          rules: 'javascript-rules',
          rulesVersion: '1.0.0',
          operationId: uuidv4(),
          dependencies: [
            { path: testFiles.template, hash: 'sha256:template123' },
            { path: testFiles.rules, hash: 'sha256:rules123' }
          ]
        }
      );
    });
    
    it('should generate comprehensive artifact explanation', async () => {
      const explanation = await explainer.explainArtifact(testFiles.artifact);
      
      expect(explanation).toHaveProperty('explanationId');
      expect(explanation).toHaveProperty('artifact');
      expect(explanation).toHaveProperty('attestation');
      expect(explanation).toHaveProperty('verification');
      expect(explanation).toHaveProperty('lineage');
      expect(explanation).toHaveProperty('generation');
      expect(explanation).toHaveProperty('compliance');
      expect(explanation).toHaveProperty('summary');
      expect(explanation).toHaveProperty('metrics');
      
      // Verify artifact analysis
      expect(explanation.artifact.exists).toBe(true);
      expect(explanation.artifact.hash).toMatch(/^sha256:/);
      expect(explanation.artifact.type).toBe('javascript');
      
      // Verify attestation analysis
      expect(explanation.attestation.found).toBe(true);
      expect(explanation.attestation.data).toHaveProperty('attestationId');
      
      // Verify verification results
      expect(explanation.verification.performed).toBe(true);
      expect(explanation.verification.result.valid).toBe(true);
    });
    
    it('should build complete lineage chain', async () => {
      const explanation = await explainer.explainArtifact(testFiles.artifact);
      
      expect(explanation.lineage).toHaveProperty('chain');
      expect(explanation.lineage).toHaveProperty('depth');
      expect(explanation.lineage).toHaveProperty('dependencyGraph');
      expect(explanation.lineage).toHaveProperty('metrics');
      
      expect(explanation.lineage.depth).toBeGreaterThan(0);
      expect(explanation.lineage.chain).toBeInstanceOf(Array);
      expect(explanation.lineage.dependencyGraph).toHaveProperty('nodes');
      expect(explanation.lineage.dependencyGraph).toHaveProperty('edges');
    });
    
    it('should generate compliance report', async () => {
      const explanation = await explainer.explainArtifact(testFiles.artifact);
      
      expect(explanation.compliance).toHaveProperty('overall');
      expect(explanation.compliance).toHaveProperty('checks');
      expect(explanation.compliance).toHaveProperty('score');
      
      expect(explanation.compliance.overall).toMatch(/^(COMPLIANT|NON_COMPLIANT|PARTIAL)$/);
      expect(explanation.compliance.score).toBeGreaterThanOrEqual(0);
      expect(explanation.compliance.score).toBeLessThanOrEqual(100);
      expect(explanation.compliance.checks).toBeInstanceOf(Array);
    });
    
    it('should generate quality summary', async () => {
      const explanation = await explainer.explainArtifact(testFiles.artifact);
      
      expect(explanation.summary).toHaveProperty('artifact');
      expect(explanation.summary).toHaveProperty('provenance');
      expect(explanation.summary).toHaveProperty('generation');
      expect(explanation.summary).toHaveProperty('quality');
      expect(explanation.summary).toHaveProperty('auditability');
      
      expect(explanation.summary.quality.overall).toMatch(/^(EXCELLENT|GOOD|FAIR|POOR)$/);
      expect(explanation.summary.auditability.level).toMatch(/^(ENTERPRISE|STANDARD|BASIC|NONE)$/);
    });
  });

  describe('SPARQL Queries', () => {
    beforeEach(async () => {
      // Populate store with test data
      // This would be expanded with actual RDF data in a real implementation
    });
    
    it('should execute lineage queries', async () => {
      const entityUri = 'http://kgen.enterprise/entity/test1';
      const lineage = await queries.findEntityLineage(entityUri);
      
      expect(lineage).toBeInstanceOf(Array);
      // Results would be populated from actual RDF store in production
    });
    
    it('should generate audit trails', async () => {
      const criteria = {
        startTime: '2025-09-01T00:00:00Z',
        endTime: '2025-09-12T00:00:00Z'
      };
      
      const auditTrail = await queries.generateAuditTrail(criteria);
      
      expect(auditTrail).toHaveProperty('period');
      expect(auditTrail).toHaveProperty('totalOperations');
      expect(auditTrail).toHaveProperty('auditTrail');
      expect(auditTrail).toHaveProperty('compliance');
      
      expect(auditTrail.compliance.standard).toBe('W3C-PROV-O');
    });
    
    it('should validate PROV-O compliance', async () => {
      const validation = await queries.validateProvOCompliance();
      
      expect(validation).toHaveProperty('compliant');
      expect(validation).toHaveProperty('counts');
      expect(validation).toHaveProperty('issues');
      expect(validation).toHaveProperty('validatedAt');
      
      expect(typeof validation.compliant).toBe('boolean');
      expect(validation.counts).toHaveProperty('entities');
      expect(validation.counts).toHaveProperty('activities');
      expect(validation.counts).toHaveProperty('agents');
    });
  });

  describe('Integration Functions', () => {
    it('should explain artifact using utility function', async () => {
      // Generate attestation first
      await attestationGenerator.generateAttestation(testFiles.artifact, {});
      
      const explanation = await explainArtifact(testFiles.artifact);
      
      expect(explanation).toHaveProperty('explanationId');
      expect(explanation).toHaveProperty('artifact');
      expect(explanation).toHaveProperty('summary');
    });
    
    it('should verify artifact using utility function', async () => {
      // Generate attestation first
      await attestationGenerator.generateAttestation(testFiles.artifact, {});
      
      const verification = await verifyArtifact(testFiles.artifact);
      
      expect(verification).toHaveProperty('verified');
      expect(typeof verification.verified).toBe('boolean');
    });
    
    it('should create provenance tracker with different configurations', async () => {
      const configs = [
        { complianceMode: 'enterprise' },
        { complianceMode: 'none' },
        { storageBackend: 'memory' },
        { enableCryptographicSigning: false }
      ];
      
      for (const config of configs) {
        const tracker = createProvenanceTracker(config);
        expect(tracker).toBeDefined();
        expect(typeof tracker.trackGeneration).toBe('function');
      }
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle missing files gracefully', async () => {
      const nonExistentFile = path.join(testDir, 'does-not-exist.js');
      
      const explanation = await explainer.explainArtifact(nonExistentFile);
      
      expect(explanation.artifact.exists).toBe(false);
      expect(explanation.artifact.error).toBeDefined();
      expect(explanation.verification.performed).toBe(false);
    });
    
    it('should handle malformed attestations', async () => {
      // Create malformed attestation
      const malformedAttestation = { invalid: 'structure' };
      
      const result = await verifier.verifyArtifact(testFiles.artifact, malformedAttestation);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.checks.structureValid).toBe(false);
    });
    
    it('should process large lineage chains efficiently', async () => {
      // Create large lineage chain
      const largeLineage = Array.from({ length: 100 }, (_, i) => ({
        type: 'dependency',
        resource: `dependency-${i}.js`,
        hash: `sha256:${Buffer.from(`dep${i}`).toString('hex')}`,
        timestamp: new Date(Date.now() - i * 1000).toISOString()
      }));
      
      const metadata = { lineage: largeLineage };
      const attestation = await attestationGenerator.generateAttestation(
        testFiles.artifact,
        metadata
      );
      
      expect(attestation.lineage).toHaveLength(100);
      
      const explanation = await explainer.explainArtifact(testFiles.artifact);
      expect(explanation.lineage.depth).toBe(100);
      expect(explanation.metrics.explanationTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
    
    it('should maintain cache consistency', async () => {
      const explainerWithCache = new ArtifactExplainer({
        enableCaching: true,
        cacheTimeout: 1000
      });
      
      // First explanation should be cached
      const explanation1 = await explainerWithCache.explainArtifact(testFiles.artifact);
      const explanation2 = await explainerWithCache.explainArtifact(testFiles.artifact);
      
      expect(explanation1.explanationId).toBe(explanation2.explanationId);
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const explanation3 = await explainerWithCache.explainArtifact(testFiles.artifact);
      expect(explanation1.explanationId).not.toBe(explanation3.explanationId);
      
      await explainerWithCache.shutdown();
    });
  });

  describe('Security and Compliance', () => {
    it('should not expose sensitive information in attestations', async () => {
      process.env.SECRET_API_KEY = 'secret-value';
      
      const attestation = await attestationGenerator.generateAttestation(
        testFiles.artifact,
        {}
      );
      
      const serialized = JSON.stringify(attestation);
      expect(serialized).not.toContain('SECRET_API_KEY');
      expect(serialized).not.toContain('secret-value');
      
      delete process.env.SECRET_API_KEY;
    });
    
    it('should validate PROV-O compliance requirements', async () => {
      const attestation = await attestationGenerator.generateAttestation(
        testFiles.artifact,
        { includeFullProvenance: true }
      );
      
      const provenance = attestation.provenance;
      
      // Check required PROV-O elements
      expect(provenance).toHaveProperty('@context');
      expect(provenance['@context']).toHaveProperty('prov');
      expect(provenance).toHaveProperty('entity');
      expect(provenance).toHaveProperty('activity');
      expect(provenance).toHaveProperty('agent');
      expect(provenance).toHaveProperty('relations');
      
      // Check entity structure
      expect(provenance.entity).toHaveProperty('@type');
      expect(provenance.entity['@type']).toBe('prov:Entity');
      
      // Check activity structure
      expect(provenance.activity).toHaveProperty('@type');
      expect(provenance.activity['@type']).toBe('prov:Activity');
      
      // Check agent structure
      expect(provenance.agent).toHaveProperty('@type');
      expect(provenance.agent['@type']).toBe('prov:SoftwareAgent');
    });
    
    it('should handle concurrent operations safely', async () => {
      const concurrentOperations = Array.from({ length: 10 }, (_, i) => 
        attestationGenerator.generateAttestation(
          testFiles.artifact,
          { operationId: `concurrent-${i}` }
        )
      );
      
      const results = await Promise.all(concurrentOperations);
      
      // All operations should succeed
      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result).toHaveProperty('attestationId');
        expect(result.generation.operationId).toBe(`concurrent-${index}`);
      });
      
      // All attestation IDs should be unique
      const attestationIds = results.map(r => r.attestationId);
      const uniqueIds = new Set(attestationIds);
      expect(uniqueIds.size).toBe(attestationIds.length);
    });
  });
});