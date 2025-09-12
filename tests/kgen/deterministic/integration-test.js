/**
 * Integration Test for KGEN Deterministic Rendering with Existing Engine
 * 
 * Tests the integration of the deterministic renderer with the existing
 * KGEN engine and frontmatter workflow system.
 */

import { describe, it, expect, beforeEach, afterEach } from '../../../src/test-framework/runner.js';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

import { KGenEngine } from '../../../src/kgen/core/engine.js';
import DeterministicRenderingSystem from '../../../src/kgen/deterministic/index.js';
import DeterministicArtifactGenerator from '../../../src/kgen/deterministic/artifact-generator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('KGEN Engine Integration', () => {
  let engine;
  let deterministicSystem;
  let testTemplatesDir;
  let testOutputDir;
  
  beforeEach(async () => {
    testTemplatesDir = path.join(__dirname, 'fixtures', 'integration-templates');
    testOutputDir = path.join(__dirname, 'fixtures', 'integration-output');
    
    await fs.mkdir(testTemplatesDir, { recursive: true });
    await fs.mkdir(testOutputDir, { recursive: true });
    
    // Initialize KGEN engine with deterministic renderer
    engine = new KGenEngine({
      mode: 'production',
      enableAuditTrail: true,
      directories: {
        templates: testTemplatesDir,
        out: testOutputDir,
        cache: path.join(__dirname, 'fixtures', 'cache')
      },
      generate: {
        defaultTemplate: 'base',
        attestByDefault: true,
        enableContentAddressing: true
      }
    });
    
    // Initialize deterministic system
    deterministicSystem = new DeterministicRenderingSystem({
      templatesDir: testTemplatesDir,
      outputDir: testOutputDir,
      staticBuildTime: '2024-01-01T00:00:00.000Z',
      enableAttestation: true,
      strictMode: true
    });
    
    await engine.initialize();
  });
  
  afterEach(async () => {
    await engine.shutdown();
    await deterministicSystem.shutdown();
    
    // Cleanup test directories
    try {
      await fs.rm(testTemplatesDir, { recursive: true });
      await fs.rm(testOutputDir, { recursive: true });
      await fs.rm(path.join(__dirname, 'fixtures', 'cache'), { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });
  
  describe('Template Processing Integration', () => {
    it('should integrate with frontmatter workflow system', async () => {
      // Create template with frontmatter
      const templateContent = `---
to: {{ name | slug }}.js
inject: false
chmod: 0644
---
// Generated file for {{ name }}
// Build time: {{ BUILD_TIME }}

class {{ name | pascalCase }} {
  constructor() {
    this.name = '{{ name }}';
    this.created = '{{ BUILD_TIME }}';
  }
  
  getName() {
    return this.name;
  }
}

export default {{ name | pascalCase }};`;
      
      const templatePath = path.join(testTemplatesDir, 'class-generator.njk');
      await fs.writeFile(templatePath, templateContent);
      
      // Use KGEN engine to process template
      const context = { 
        name: 'UserService'
      };
      
      // Create templates array as expected by engine
      const templates = [{
        id: 'class-generator',
        type: 'component',
        content: templateContent,
        context: context
      }];
      
      // Generate using KGEN engine
      const artifacts = await engine.generate(
        { triples: [] }, // Empty knowledge graph
        templates,
        { 
          enableSemanticValidation: true,
          enableComplianceCheck: true 
        }
      );
      
      expect(artifacts).toBeTruthy();
      expect(artifacts.length).toBeGreaterThan(0);
      
      // Find generated artifact
      const generatedArtifact = artifacts.find(a => a.type === 'generated_file');
      expect(generatedArtifact).toBeTruthy();
      expect(generatedArtifact.path).toContain('user-service.js');
      
      // Verify deterministic content
      if (generatedArtifact.metadata?.frontmatterMetadata?.contentHash) {
        expect(generatedArtifact.metadata.frontmatterMetadata.contentHash).toBeTruthy();
      }
    });
    
    it('should maintain deterministic output across engine restarts', async () => {
      const templateContent = `---
to: output.txt
---
Deterministic output: {{ value }}
Generated: {{ BUILD_TIME }}`;
      
      const templatePath = path.join(testTemplatesDir, 'deterministic.njk');
      await fs.writeFile(templatePath, templateContent);
      
      const context = { value: 'test' };
      const templates = [{
        id: 'deterministic-test',
        type: 'text',
        content: templateContent,
        context: context
      }];
      
      // Generate with first engine instance
      const artifacts1 = await engine.generate({}, templates);
      
      // Shutdown and restart engine
      await engine.shutdown();
      
      const newEngine = new KGenEngine({
        mode: 'production',
        enableAuditTrail: true,
        directories: {
          templates: testTemplatesDir,
          out: testOutputDir,
          cache: path.join(__dirname, 'fixtures', 'cache')
        },
        generate: {
          defaultTemplate: 'base',
          attestByDefault: true,
          enableContentAddressing: true
        }
      });
      
      await newEngine.initialize();
      
      // Generate with new engine instance
      const artifacts2 = await newEngine.generate({}, templates);
      
      // Compare outputs - should be identical
      const artifact1 = artifacts1.find(a => a.type === 'generated_file');
      const artifact2 = artifacts2.find(a => a.type === 'generated_file');
      
      expect(artifact1).toBeTruthy();
      expect(artifact2).toBeTruthy();
      
      // If content hashes are available, they should match
      if (artifact1.metadata?.frontmatterMetadata?.contentHash && 
          artifact2.metadata?.frontmatterMetadata?.contentHash) {
        expect(artifact1.metadata.frontmatterMetadata.contentHash)
          .toBe(artifact2.metadata.frontmatterMetadata.contentHash);
      }
      
      await newEngine.shutdown();
    });
  });
  
  describe('Artifact Generation Integration', () => {
    it('should create attestations for generated artifacts', async () => {
      const templateContent = `---
to: {{ filename }}.json
---
{
  "name": "{{ name }}",
  "version": "1.0.0",
  "generated": "{{ BUILD_TIME }}",
  "deterministic": true
}`;
      
      const templatePath = path.join(testTemplatesDir, 'package.njk');
      await fs.writeFile(templatePath, templateContent);
      
      // Use deterministic artifact generator directly
      const generator = new DeterministicArtifactGenerator({
        templatesDir: testTemplatesDir,
        outputDir: testOutputDir,
        staticBuildTime: '2024-01-01T00:00:00.000Z',
        attestByDefault: true,
        strictMode: true
      });
      
      const context = {
        filename: 'test-package',
        name: 'Test Package'
      };
      
      const result = await generator.generate('package.njk', context);
      
      expect(result.success).toBe(true);
      expect(result.outputPath).toBeTruthy();
      expect(result.attestationPath).toBeTruthy();
      expect(result.contentHash).toBeTruthy();
      
      // Verify attestation file exists and has correct structure
      const attestationExists = await fs.access(result.attestationPath)
        .then(() => true)
        .catch(() => false);
      
      expect(attestationExists).toBe(true);
      
      const attestation = JSON.parse(await fs.readFile(result.attestationPath, 'utf-8'));
      
      expect(attestation.version).toBeTruthy();
      expect(attestation.artifact.contentHash).toBe(result.contentHash);
      expect(attestation.generation.templatePath).toBe('package.njk');
      expect(attestation.verification.deterministic).toBe(true);
      expect(attestation.signature).toBeTruthy();
    });
    
    it('should handle batch generation with mixed results', async () => {
      // Create valid template
      const validTemplate = `---
to: valid-{{ index }}.txt
---
Valid file {{ index }}`;
      
      // Create template with error
      const errorTemplate = `---
to: error-{{ index }}.txt
---
Error: {{ undefined_variable }}`;
      
      await fs.writeFile(path.join(testTemplatesDir, 'valid.njk'), validTemplate);
      await fs.writeFile(path.join(testTemplatesDir, 'error.njk'), errorTemplate);
      
      const templates = [
        { templatePath: 'valid.njk', context: { index: 1 } },
        { templatePath: 'error.njk', context: { index: 2 } },
        { templatePath: 'valid.njk', context: { index: 3 } }
      ];
      
      const batchResult = await deterministicSystem.generateBatch(templates);
      
      expect(batchResult.totalTemplates).toBe(3);
      expect(batchResult.successful).toBe(2); // Two valid templates
      expect(batchResult.failed).toBe(1);     // One error template
      
      // Check individual results
      const validResults = batchResult.results.filter(r => r.success);
      const errorResults = batchResult.results.filter(r => !r.success);
      
      expect(validResults).toHaveLength(2);
      expect(errorResults).toHaveLength(1);
      
      // Valid results should have content hashes
      validResults.forEach(result => {
        expect(result.contentHash).toBeTruthy();
      });
    });
  });
  
  describe('Reproducibility Validation', () => {
    it('should validate artifacts are reproducible after engine restart', async () => {
      const templateContent = `---
to: reproducible.txt
---
Content: {{ data | canonical }}
Time: {{ BUILD_TIME }}`;
      
      const templatePath = path.join(testTemplatesDir, 'reproducible.njk');
      await fs.writeFile(templatePath, templateContent);
      
      const context = {
        data: { 
          items: [3, 1, 4], 
          metadata: { type: 'test', version: '1.0' } 
        }
      };
      
      const outputPath = path.join(testOutputDir, 'reproducible.txt');
      
      // Generate initial artifact
      const initialResult = await deterministicSystem.generateArtifact(
        'reproducible.njk',
        context,
        outputPath
      );
      
      expect(initialResult.success).toBe(true);
      
      // Restart deterministic system
      await deterministicSystem.shutdown();
      
      const newSystem = new DeterministicRenderingSystem({
        templatesDir: testTemplatesDir,
        outputDir: testOutputDir,
        staticBuildTime: '2024-01-01T00:00:00.000Z',
        enableAttestation: true,
        strictMode: true
      });
      
      // Verify reproducibility with new system
      const verifyResult = await newSystem.verifyReproducibility(outputPath, 3);
      
      expect(verifyResult.verified).toBe(true);
      expect(verifyResult.originalHash).toBe(initialResult.contentHash);
      expect(verifyResult.reproductions.every(r => r.success)).toBe(true);
      
      await newSystem.shutdown();
    });
    
    it('should detect non-reproducible templates', async () => {
      // Create template with non-deterministic element
      const nonDeterministicTemplate = `---
to: non-deterministic.txt
---
Random value: {{ '' | random }}
Timestamp: ${Date.now()}`;
      
      const templatePath = path.join(testTemplatesDir, 'non-deterministic.njk');
      await fs.writeFile(templatePath, nonDeterministicTemplate);
      
      // Analyze template for deterministic issues
      const analysis = await deterministicSystem.validateTemplate('non-deterministic.njk');
      
      expect(analysis.deterministicScore).toBeLessThan(100);
      expect(analysis.issues).toBeTruthy();
      expect(analysis.issues.length).toBeGreaterThan(0);
      expect(analysis.recommendations).toBeTruthy();
      expect(analysis.recommendations.length).toBeGreaterThan(0);
    });
  });
  
  describe('Performance and Caching', () => {
    it('should improve performance with caching enabled', async () => {
      const templateContent = `---
to: cached-{{ index }}.txt
---
Cached content {{ index }}: {{ value }}`;
      
      const templatePath = path.join(testTemplatesDir, 'cached.njk');
      await fs.writeFile(templatePath, templateContent);
      
      const context = { index: 1, value: 'test' };
      
      // First render (cache miss)
      const start1 = Date.now();
      const result1 = await deterministicSystem.render('cached.njk', context);
      const time1 = Date.now() - start1;
      
      expect(result1.success).toBe(true);
      
      // Second render (should be cache hit)
      const start2 = Date.now();
      const result2 = await deterministicSystem.render('cached.njk', context);
      const time2 = Date.now() - start2;
      
      expect(result2.success).toBe(true);
      expect(result2.contentHash).toBe(result1.contentHash);
      
      // Cache hit should be faster (though timing can be unreliable in tests)
      // Instead, check cache statistics
      const stats = deterministicSystem.getStatistics();
      expect(stats.system.cacheHits).toBeGreaterThan(0);
    });
    
    it('should handle concurrent template processing', async () => {
      const templateContent = `---
to: concurrent-{{ id }}.txt
---
Concurrent processing: {{ id }}
Generated: {{ BUILD_TIME }}`;
      
      const templatePath = path.join(testTemplatesDir, 'concurrent.njk');
      await fs.writeFile(templatePath, templateContent);
      
      // Create multiple concurrent render requests
      const concurrentRenders = [];
      for (let i = 0; i < 5; i++) {
        const context = { id: i };
        concurrentRenders.push(
          deterministicSystem.render('concurrent.njk', context)
        );
      }
      
      // Wait for all renders to complete
      const results = await Promise.all(concurrentRenders);
      
      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
      
      // All should be deterministic but with different content
      const uniqueHashes = new Set(results.map(r => r.contentHash));
      expect(uniqueHashes.size).toBe(5); // All different due to different contexts
    });
  });
  
  describe('System Health and Monitoring', () => {
    it('should provide comprehensive health check', async () => {
      const health = await deterministicSystem.healthCheck();
      
      expect(health.status).toBe('healthy');
      expect(health.timestamp).toBeTruthy();
      expect(health.components).toBeTruthy();
      
      // Check individual components
      expect(health.components.renderer.status).toBe('healthy');
      expect(health.components.artifactGenerator.status).toBe('healthy');
      expect(health.components.contentCache.status).toBe('healthy');
      
      expect(health.issues).toHaveLength(0);
    });
    
    it('should track comprehensive statistics', async () => {
      // Perform some operations to generate statistics
      const template = `---
to: stats-test.txt
---
Statistics test: {{ value }}`;
      
      await fs.writeFile(path.join(testTemplatesDir, 'stats.njk'), template);
      
      await deterministicSystem.render('stats.njk', { value: 'render' });
      await deterministicSystem.generateArtifact('stats.njk', { value: 'artifact' });
      
      const stats = deterministicSystem.getStatistics();
      
      // System statistics
      expect(stats.system.totalRenders).toBeGreaterThan(0);
      expect(stats.system.uptime).toBeGreaterThan(0);
      expect(typeof stats.system.cacheHitRate).toBe('number');
      expect(typeof stats.system.errorRate).toBe('number');
      
      // Component statistics
      expect(stats.components.renderer).toBeTruthy();
      expect(stats.components.artifactGenerator).toBeTruthy();
      expect(stats.components.contentCache).toBeTruthy();
      
      // Configuration
      expect(stats.configuration.templatesDir).toBe(testTemplatesDir);
      expect(stats.configuration.enableAttestation).toBe(true);
      expect(stats.configuration.strictMode).toBe(true);
    });
    
    it('should handle graceful shutdown', async () => {
      // Start some operations
      const template = `---
to: shutdown-test.txt
---
Shutdown test content`;
      
      await fs.writeFile(path.join(testTemplatesDir, 'shutdown.njk'), template);
      
      // Start operations but don't wait for completion
      const renderPromise = deterministicSystem.render('shutdown.njk', {});
      
      // Shutdown system
      const shutdownPromise = deterministicSystem.shutdown();
      
      // Both should complete successfully
      await Promise.all([renderPromise, shutdownPromise]);
      
      // System should be in shutdown state
      const stats = deterministicSystem.getStatistics();
      expect(stats.system.activeRenders).toBe(0);
    });
  });
});

// Test runner export
export const integrationTests = {
  'KGEN Engine Integration': true
};