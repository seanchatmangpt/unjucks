/**
 * KGEN Core Artifact Generator Tests
 * 
 * Comprehensive tests for artifact generation functionality
 * with actual RDF files and templates.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ArtifactGenerator } from '../../src/artifact/generator.js';
import { ProvenanceTracker } from '../../src/artifact/provenance.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const TEST_DATA_DIR = path.join(__dirname, 'test-data');
const TEMP_OUTPUT_DIR = path.join(__dirname, 'temp-output');
const STATIC_BUILD_TIME = '2024-01-01T00:00:00.000Z';

describe('ArtifactGenerator', () => {
  let generator;
  let outputDir;

  beforeEach(async () => {
    // Create temporary output directory
    outputDir = path.join(TEMP_OUTPUT_DIR, `test-${Date.now()}`);
    await fs.mkdir(outputDir, { recursive: true });

    // Initialize generator
    generator = new ArtifactGenerator({
      templatesDir: TEST_DATA_DIR,
      outputDir,
      staticBuildTime: STATIC_BUILD_TIME,
      enableContentAddressing: true,
      enableAttestations: true,
      debug: false
    });
  });

  afterEach(async () => {
    // Cleanup temporary files
    try {
      await fs.rm(outputDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Basic Artifact Generation', () => {
    it('should generate artifact from RDF graph and template', async () => {
      const graphFile = path.join(TEST_DATA_DIR, 'sample.ttl');
      const template = 'component.njk';
      
      const result = await generator.generateArtifact(graphFile, template, {
        context: {
          name: 'TestComponent',
          version: '1.0.0',
          description: 'Test component for validation'
        }
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.contentHash);
      assert.ok(result.outputPath);
      assert.ok(result.content);
      assert.strictEqual(result.generatedAt, STATIC_BUILD_TIME);

      // Verify content contains expected substitutions
      assert.ok(result.content.includes('TestComponent'));
      assert.ok(result.content.includes('1.0.0'));
      assert.ok(result.content.includes(STATIC_BUILD_TIME));
    });

    it('should enrich context with RDF data', async () => {
      const graphFile = path.join(TEST_DATA_DIR, 'sample.ttl');
      const template = 'component.njk';
      
      const result = await generator.generateArtifact(graphFile, template, {
        context: {
          name: 'RDFEnrichedComponent'
        }
      });

      assert.strictEqual(result.success, true);
      
      // Check that RDF data was enriched into context
      assert.ok(result.context.project_label || result.context.developer_name);
      
      // Verify RDF-derived content in the generated artifact
      if (result.context.project_label) {
        assert.ok(result.content.includes(result.context.project_label));
      }
    });

    it('should process frontmatter correctly', async () => {
      const graphFile = path.join(TEST_DATA_DIR, 'sample.ttl');
      const template = 'component.njk';
      
      const result = await generator.generateArtifact(graphFile, template, {
        context: {
          name: 'FrontmatterTest'
        }
      });

      assert.strictEqual(result.success, true);
      
      // Verify frontmatter was processed
      assert.ok(result.frontmatter);
      assert.ok(result.frontmatter.to);
      
      // Check that frontmatter influenced the output path
      const expectedFilename = 'frontmattertest-component.js';
      assert.ok(result.outputPath.includes(expectedFilename));
    });
  });

  describe('Deterministic Generation', () => {
    it('should produce identical output for same inputs', async () => {
      const graphFile = path.join(TEST_DATA_DIR, 'sample.ttl');
      const template = 'component.njk';
      const context = {
        name: 'DeterministicTest',
        version: '2.0.0'
      };

      // Generate artifact twice
      const result1 = await generator.generateArtifact(graphFile, template, { context });
      const result2 = await generator.generateArtifact(graphFile, template, { context });

      assert.strictEqual(result1.success, true);
      assert.strictEqual(result2.success, true);
      
      // Content and hashes should be identical
      assert.strictEqual(result1.content, result2.content);
      assert.strictEqual(result1.contentHash, result2.contentHash);
      assert.strictEqual(result1.shortHash, result2.shortHash);
    });

    it('should use static build time consistently', async () => {
      const graphFile = path.join(TEST_DATA_DIR, 'sample.ttl');
      const template = 'component.njk';
      
      const result = await generator.generateArtifact(graphFile, template, {
        context: { name: 'TimeTest' }
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.generatedAt, STATIC_BUILD_TIME);
      assert.ok(result.content.includes(STATIC_BUILD_TIME));
    });

    it('should sort object keys deterministically', async () => {
      const graphFile = path.join(TEST_DATA_DIR, 'sample.ttl');
      const template = 'component.njk';
      
      // Test with different key ordering
      const context1 = { z: 'last', a: 'first', m: 'middle' };
      const context2 = { a: 'first', m: 'middle', z: 'last' };
      
      const result1 = await generator.generateArtifact(graphFile, template, { context: context1 });
      const result2 = await generator.generateArtifact(graphFile, template, { context: context2 });

      assert.strictEqual(result1.success, true);
      assert.strictEqual(result2.success, true);
      assert.strictEqual(result1.contentHash, result2.contentHash);
    });
  });

  describe('File Writing and Attestations', () => {
    it('should write artifact to filesystem', async () => {
      const graphFile = path.join(TEST_DATA_DIR, 'sample.ttl');
      const template = 'component.njk';
      
      const result = await generator.generateArtifact(graphFile, template, {
        context: { name: 'WriteTest' }
      });

      assert.strictEqual(result.success, true);

      // Write the artifact
      const writeResult = await generator.writeArtifact(result);
      
      assert.strictEqual(writeResult.success, true);
      assert.strictEqual(writeResult.outputPath, result.outputPath);

      // Verify file exists and content matches
      const writtenContent = await fs.readFile(result.outputPath, 'utf-8');
      assert.strictEqual(writtenContent, result.content);
    });

    it('should create attestation files', async () => {
      const graphFile = path.join(TEST_DATA_DIR, 'sample.ttl');
      const template = 'component.njk';
      
      const result = await generator.generateArtifact(graphFile, template, {
        context: { name: 'AttestationTest' }
      });

      await generator.writeArtifact(result);

      // Check attestation file exists
      const attestationPath = `${result.outputPath}.attest.json`;
      const attestationExists = await fs.access(attestationPath).then(() => true).catch(() => false);
      assert.strictEqual(attestationExists, true);

      // Verify attestation content
      const attestationContent = await fs.readFile(attestationPath, 'utf-8');
      const attestation = JSON.parse(attestationContent);
      
      assert.strictEqual(attestation.version, '1.0.0');
      assert.strictEqual(attestation.artifact.contentHash, result.contentHash);
      assert.ok(attestation.signature);
      assert.ok(attestation.verification.reproducible);
    });
  });

  describe('RDF Context Processing', () => {
    it('should handle JSON-LD graph files', async () => {
      const graphFile = path.join(TEST_DATA_DIR, 'config.json');
      const template = 'component.njk';
      
      const result = await generator.generateArtifact(graphFile, template, {
        context: { name: 'JsonLdTest' }
      });

      assert.strictEqual(result.success, true);
      
      // Should have processed JSON-LD context
      assert.ok(result.context);
    });

    it('should handle missing graph files gracefully', async () => {
      const graphFile = path.join(TEST_DATA_DIR, 'nonexistent.ttl');
      const template = 'component.njk';
      
      const result = await generator.generateArtifact(graphFile, template, {
        context: { name: 'MissingGraphTest' },
        throwOnError: false
      });

      // Should still succeed with empty RDF context
      assert.strictEqual(result.success, true);
      assert.ok(result.content.includes('MissingGraphTest'));
    });
  });

  describe('Error Handling', () => {
    it('should handle missing templates gracefully', async () => {
      const graphFile = path.join(TEST_DATA_DIR, 'sample.ttl');
      const template = 'nonexistent.njk';
      
      const result = await generator.generateArtifact(graphFile, template, {
        context: { name: 'ErrorTest' },
        throwOnError: false
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
      assert.ok(result.error.includes('not found') || result.error.includes('ENOENT'));
    });

    it('should handle template rendering errors', async () => {
      // Create a template with invalid syntax
      const badTemplate = path.join(TEST_DATA_DIR, 'bad-template.njk');
      await fs.writeFile(badTemplate, '{{ unclosed_tag');

      const graphFile = path.join(TEST_DATA_DIR, 'sample.ttl');
      
      const result = await generator.generateArtifact(graphFile, 'bad-template.njk', {
        context: { name: 'RenderErrorTest' },
        throwOnError: false
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.error);

      // Cleanup
      await fs.unlink(badTemplate).catch(() => {});
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should track generation statistics', async () => {
      const initialStats = generator.getStatistics();
      
      const graphFile = path.join(TEST_DATA_DIR, 'sample.ttl');
      const template = 'component.njk';
      
      await generator.generateArtifact(graphFile, template, {
        context: { name: 'StatsTest' }
      });

      const finalStats = generator.getStatistics();
      
      assert.strictEqual(finalStats.artifactsGenerated, initialStats.artifactsGenerated + 1);
      assert.ok(finalStats.totalGenerationTime >= initialStats.totalGenerationTime);
    });

    it('should provide template engine statistics', async () => {
      const stats = generator.getStatistics();
      
      assert.ok(stats.templateEngineStats);
      assert.ok(typeof stats.templateEngineStats.renders === 'number');
      assert.ok(typeof stats.templateEngineStats.cacheSize === 'number');
    });
  });
});

describe('ProvenanceTracker Integration', () => {
  let generator;
  let tracker;
  let outputDir;

  beforeEach(async () => {
    outputDir = path.join(TEMP_OUTPUT_DIR, `provenance-test-${Date.now()}`);
    await fs.mkdir(outputDir, { recursive: true });

    generator = new ArtifactGenerator({
      templatesDir: TEST_DATA_DIR,
      outputDir,
      staticBuildTime: STATIC_BUILD_TIME,
      debug: false
    });

    tracker = new ProvenanceTracker({
      staticBuildTime: STATIC_BUILD_TIME,
      provenanceDir: path.join(outputDir, '.provenance'),
      debug: false
    });
  });

  afterEach(async () => {
    try {
      await fs.rm(outputDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should track complete artifact generation process', async () => {
    const operationId = 'test-provenance-tracking';
    
    // Start tracking
    await tracker.startTracking(operationId, {
      description: 'Test artifact generation with provenance'
    });

    const graphFile = path.join(TEST_DATA_DIR, 'sample.ttl');
    const template = 'component.njk';

    // Record inputs
    tracker.recordInput(operationId, 'rdf-graph', graphFile);
    tracker.recordInput(operationId, 'template', path.join(TEST_DATA_DIR, template));

    // Generate artifact
    const result = await generator.generateArtifact(graphFile, template, {
      context: { name: 'ProvenanceTest' }
    });

    // Record transformation
    tracker.recordTransformation(
      operationId,
      'template-rendering',
      'Render Nunjucks template with RDF-enriched context',
      [graphFile, template],
      [result.outputPath]
    );

    // Record output
    tracker.recordOutput(operationId, 'javascript-component', result.outputPath, result.content);

    // Complete tracking
    const { attestation } = await tracker.completeTracking(operationId, result);

    // Verify attestation structure
    assert.ok(attestation);
    assert.strictEqual(attestation.operationId, operationId);
    assert.ok(attestation.inputs.length >= 2);
    assert.ok(attestation.outputs.length >= 1);
    assert.ok(attestation.transformations.length >= 1);
    assert.ok(attestation.cryptography);
    assert.ok(attestation.signature);
    assert.strictEqual(attestation.reproducibility.deterministicProcess, true);
  });

  it('should verify attestation integrity', async () => {
    const operationId = 'test-attestation-verification';
    
    await tracker.startTracking(operationId);
    
    const graphFile = path.join(TEST_DATA_DIR, 'sample.ttl');
    const template = 'component.njk';
    
    const result = await generator.generateArtifact(graphFile, template, {
      context: { name: 'VerificationTest' }
    });

    tracker.recordOutput(operationId, 'test-artifact', result.outputPath, result.content);
    
    const { attestation } = await tracker.completeTracking(operationId, result);

    // Write attestation to file
    const attestationPath = path.join(outputDir, 'test.attest.json');
    await fs.writeFile(attestationPath, JSON.stringify(attestation, null, 2));

    // Verify the attestation
    const verification = await tracker.verifyAttestation(attestationPath);
    
    assert.strictEqual(verification.verified, true);
    assert.strictEqual(verification.attestation.operationId, operationId);
  });
});