/**
 * Comprehensive Test Suite for KGEN Deterministic Renderer
 * 
 * Tests all aspects of deterministic template rendering:
 * - Byte-for-byte reproducibility 
 * - Non-deterministic element elimination
 * - Caching and performance
 * - Error handling and recovery
 * - RDF integration
 */

import { describe, it, expect, beforeEach, afterEach } from '../../../src/test-framework/runner.js';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import DeterministicRenderingSystem from '../../../src/kgen/deterministic/index.js';
import { DeterministicRenderer } from '../../../src/kgen/deterministic/core-renderer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Deterministic Renderer Core', () => {
  let renderer;
  let testTemplatesDir;
  
  beforeEach(async () => {
    testTemplatesDir = path.join(__dirname, 'fixtures', 'templates');
    await fs.mkdir(testTemplatesDir, { recursive: true });
    
    renderer = new DeterministicRenderer({
      templatesDir: testTemplatesDir,
      staticBuildTime: '2024-01-01T00:00:00.000Z',
      enableCaching: true,
      strictMode: true
    });
  });
  
  afterEach(async () => {
    renderer.clearCache();
    // Cleanup test templates
    try {
      await fs.rm(testTemplatesDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });
  
  describe('Reproducibility Tests', () => {
    it('should produce identical output for same inputs', async () => {
      const template = `Hello {{ name }}!`;
      const templatePath = 'hello.njk';
      const context = { name: 'World' };
      
      await fs.writeFile(path.join(testTemplatesDir, templatePath), template);
      
      // Render multiple times
      const results = [];
      for (let i = 0; i < 5; i++) {
        const result = await renderer.render(templatePath, context);
        results.push(result);
      }
      
      // All results should be identical
      const firstHash = results[0].contentHash;
      results.forEach(result => {
        expect(result.contentHash).toBe(firstHash);
        expect(result.content).toBe('Hello World!');
        expect(result.deterministic).toBe(true);
      });
    });
    
    it('should handle object key ordering deterministically', async () => {
      const template = `{{ data | canonical }}`;
      const templatePath = 'object-keys.njk';
      
      await fs.writeFile(path.join(testTemplatesDir, templatePath), template);
      
      // Same data with different key orders
      const context1 = { data: { b: 2, a: 1, c: 3 } };
      const context2 = { data: { a: 1, c: 3, b: 2 } };
      const context3 = { data: { c: 3, b: 2, a: 1 } };
      
      const results = await Promise.all([
        renderer.render(templatePath, context1),
        renderer.render(templatePath, context2),
        renderer.render(templatePath, context3)
      ]);
      
      // All should produce identical output
      const firstHash = results[0].contentHash;
      results.forEach(result => {
        expect(result.contentHash).toBe(firstHash);
      });
      
      // Verify output is sorted
      expect(results[0].content).toContain('"a": 1');
      expect(results[0].content).toMatch(/"a": 1.*"b": 2.*"c": 3/s);
    });
    
    it('should eliminate timestamps and use static build time', async () => {
      const template = `Generated at: {{ BUILD_TIME }}
Current time: {{ now | date }}`;
      const templatePath = 'timestamps.njk';
      
      await fs.writeFile(path.join(testTemplatesDir, templatePath), template);
      
      const results = [];
      for (let i = 0; i < 3; i++) {
        const result = await renderer.render(templatePath, {});
        results.push(result);
        
        // Add delay to ensure timestamp would be different if not static
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // All should be identical
      const firstHash = results[0].contentHash;
      results.forEach(result => {
        expect(result.contentHash).toBe(firstHash);
        expect(result.content).toContain('2024-01-01T00:00:00.000Z');
      });
    });
    
    it('should use hash-based randomness instead of Math.random', async () => {
      const template = `Random 1: {{ 'seed1' | hash | slice(0, 8) }}
Random 2: {{ 'seed2' | hash | slice(0, 8) }}
Random 3: {{ 'seed1' | hash | slice(0, 8) }}`;
      const templatePath = 'random.njk';
      
      await fs.writeFile(path.join(testTemplatesDir, templatePath), template);
      
      const results = [];
      for (let i = 0; i < 3; i++) {
        const result = await renderer.render(templatePath, {});
        results.push(result);
      }
      
      // All should be identical
      const firstHash = results[0].contentHash;
      results.forEach(result => {
        expect(result.contentHash).toBe(firstHash);
      });
      
      // Same seed should produce same output
      const content = results[0].content;
      const lines = content.split('\n');
      expect(lines[0].split(': ')[1]).toBe(lines[2].split(': ')[1]); // seed1 appears twice
    });
  });
  
  describe('Deterministic Filters', () => {
    it('should provide deterministic hash filter', async () => {
      const template = `{{ 'test' | hash }}
{{ 'test' | hash(16) }}
{{ data | hash }}`;
      const templatePath = 'hash-filter.njk';
      
      await fs.writeFile(path.join(testTemplatesDir, templatePath), template);
      
      const context = { data: { key: 'value' } };
      const result = await renderer.render(templatePath, context);
      
      const lines = result.content.split('\n');
      
      // Hash should be deterministic
      expect(lines[0]).toMatch(/^[a-f0-9]+$/);
      expect(lines[1]).toMatch(/^[a-f0-9]{16}$/);
      expect(lines[2]).toMatch(/^[a-f0-9]+$/);
      
      // Multiple renders should produce same hash
      const result2 = await renderer.render(templatePath, context);
      expect(result2.contentHash).toBe(result.contentHash);
    });
    
    it('should provide deterministic slug filter', async () => {
      const template = `{{ 'Hello World!' | slug }}
{{ 'Test  123  Special!@#' | slug }}`;
      const templatePath = 'slug-filter.njk';
      
      await fs.writeFile(path.join(testTemplatesDir, templatePath), template);
      
      const result = await renderer.render(templatePath, {});
      const lines = result.content.split('\n');
      
      expect(lines[0]).toBe('hello-world');
      expect(lines[1]).toBe('test-123-special');
    });
    
    it('should sort arrays deterministically', async () => {
      const template = `{{ items | sort }}
{{ people | sort('name') }}`;
      const templatePath = 'sort-filter.njk';
      
      await fs.writeFile(path.join(testTemplatesDir, templatePath), template);
      
      const context = {
        items: [3, 1, 4, 1, 5, 9, 2, 6],
        people: [
          { name: 'Charlie', age: 30 },
          { name: 'Alice', age: 25 },
          { name: 'Bob', age: 35 }
        ]
      };
      
      const result = await renderer.render(templatePath, context);
      const lines = result.content.split('\n');
      
      expect(lines[0]).toBe('1,1,2,3,4,5,6,9');
      expect(lines[1]).toContain('Alice'); // Should be first after sorting
    });
  });
  
  describe('Caching System', () => {
    it('should cache template renders', async () => {
      const template = `Hello {{ name }}!`;
      const templatePath = 'cached.njk';
      const context = { name: 'Cache Test' };
      
      await fs.writeFile(path.join(testTemplatesDir, templatePath), template);
      
      // First render (cache miss)
      const result1 = await renderer.render(templatePath, context);
      expect(result1.deterministic).toBe(true);
      
      // Second render (should be cache hit)
      const result2 = await renderer.render(templatePath, context);
      expect(result2.contentHash).toBe(result1.contentHash);
      
      // Verify cache statistics
      const stats = renderer.getStatistics();
      expect(stats.cacheSize).toBeGreaterThan(0);
    });
    
    it('should invalidate cache when template changes', async () => {
      const templatePath = 'dynamic.njk';
      const context = { name: 'Test' };
      
      // Create first template
      await fs.writeFile(path.join(testTemplatesDir, templatePath), 'Hello {{ name }}!');
      const result1 = await renderer.render(templatePath, context);
      
      // Change template
      await fs.writeFile(path.join(testTemplatesDir, templatePath), 'Hi {{ name }}!');
      const result2 = await renderer.render(templatePath, context);
      
      // Should produce different output
      expect(result2.contentHash).not.toBe(result1.contentHash);
      expect(result1.content).toBe('Hello Test!');
      expect(result2.content).toBe('Hi Test!');
    });
  });
  
  describe('Error Handling', () => {
    it('should handle missing templates gracefully', async () => {
      const result = await renderer.render('nonexistent.njk', {});
      
      expect(result.error).toBeTruthy();
      expect(result.deterministic).toBe(false);
      expect(result.content).toBe('');
    });
    
    it('should handle template syntax errors in strict mode', async () => {
      const template = `Hello {{ name }!`; // Missing closing brace
      const templatePath = 'syntax-error.njk';
      
      await fs.writeFile(path.join(testTemplatesDir, templatePath), template);
      
      await expect(async () => {
        await renderer.render(templatePath, {});
      }).rejects.toThrow();
    });
    
    it('should handle missing variables gracefully in non-strict mode', async () => {
      const template = `Hello {{ undefined_var }}!`;
      const templatePath = 'missing-var.njk';
      
      await fs.writeFile(path.join(testTemplatesDir, templatePath), template);
      
      // Create non-strict renderer
      const nonStrictRenderer = new DeterministicRenderer({
        templatesDir: testTemplatesDir,
        staticBuildTime: '2024-01-01T00:00:00.000Z',
        strictMode: false
      });
      
      const result = await nonStrictRenderer.render(templatePath, {});
      expect(result.content).toBe('Hello !'); // Empty variable
    });
  });
  
  describe('Template Analysis', () => {
    it('should analyze templates for non-deterministic patterns', async () => {
      const template = `Generated: {{ now }}
Random: {{ random() }}
Process: {{ process.env.HOME }}
Date: {{ this.getDeterministicDate() }}
Math: Math.random()`;
      const templatePath = 'non-deterministic.njk';
      
      await fs.writeFile(path.join(testTemplatesDir, templatePath), template);
      
      const analysis = await renderer.analyzeTemplate(templatePath);
      
      expect(analysis.deterministicScore).toBeLessThan(100);
      expect(analysis.issues).toHaveLength(4); // Should find 4 issues
      expect(analysis.recommendations).toBeTruthy();
      expect(analysis.recommendations.length).toBeGreaterThan(0);
    });
    
    it('should extract template variables correctly', async () => {
      const template = `Hello {{ name }}!
Age: {{ user.age }}
{% for item in items %}
  {{ item.title }}
{% endfor %}
{% if isActive %}
  Active user
{% endif %}`;
      const templatePath = 'variables.njk';
      
      await fs.writeFile(path.join(testTemplatesDir, templatePath), template);
      
      const analysis = await renderer.analyzeTemplate(templatePath);
      
      expect(analysis.variables).toContain('name');
      expect(analysis.variables).toContain('user');
      expect(analysis.variables).toContain('items');
      expect(analysis.variables).toContain('isActive');
      expect(analysis.variables).toBeSorted(); // Should be sorted
    });
  });
  
  describe('Reproducibility Validation', () => {
    it('should validate template reproducibility', async () => {
      const template = `Hello {{ name }}! Generated at: {{ BUILD_TIME }}`;
      const templatePath = 'reproducible.njk';
      const context = { name: 'Validation' };
      
      await fs.writeFile(path.join(testTemplatesDir, templatePath), template);
      
      const validation = await renderer.validateReproducibility(templatePath, context, 5);
      
      expect(validation.reproducible).toBe(true);
      expect(validation.iterations).toBe(5);
      expect(validation.variations).toBe(0);
      expect(validation.renders).toHaveLength(5);
      
      // All renders should have same hash
      const firstHash = validation.renders[0].contentHash;
      validation.renders.forEach(render => {
        expect(render.contentHash).toBe(firstHash);
      });
    });
  });
});

describe('Content-Addressed Cache', () => {
  let ContentAddressedCache;
  let cache;
  let tempCacheDir;
  
  beforeEach(async () => {
    const module = await import('../../../src/kgen/deterministic/content-cache.js');
    ContentAddressedCache = module.default;
    
    tempCacheDir = path.join(__dirname, 'fixtures', 'cache');
    await fs.mkdir(tempCacheDir, { recursive: true });
    
    cache = new ContentAddressedCache({
      cacheDir: tempCacheDir,
      enablePersistence: true,
      maxCacheSize: 1024 * 100, // 100KB for testing
      maxEntries: 10
    });
  });
  
  afterEach(async () => {
    await cache.clear();
    try {
      await fs.rm(tempCacheDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });
  
  it('should store and retrieve content by hash', async () => {
    const content = 'Hello, deterministic world!';
    const metadata = { type: 'text', created: '2024-01-01' };
    
    const storeResult = await cache.store(content, metadata);
    
    expect(storeResult.hash).toBeTruthy();
    expect(storeResult.cached).toBe(false); // First time
    expect(storeResult.size).toBe(Buffer.byteLength(content));
    
    const retrieveResult = await cache.retrieve(storeResult.hash);
    
    expect(retrieveResult.found).toBe(true);
    expect(retrieveResult.content).toBe(content);
    expect(retrieveResult.metadata.type).toBe('text');
  });
  
  it('should generate consistent hashes for identical content', async () => {
    const content = 'Same content';
    
    const result1 = await cache.store(content);
    const result2 = await cache.store(content);
    
    expect(result1.hash).toBe(result2.hash);
    expect(result2.cached).toBe(true); // Should be cached
  });
  
  it('should generate different hashes for different content', async () => {
    const content1 = 'Content 1';
    const content2 = 'Content 2';
    
    const result1 = await cache.store(content1);
    const result2 = await cache.store(content2);
    
    expect(result1.hash).not.toBe(result2.hash);
  });
  
  it('should handle object content deterministically', async () => {
    const obj1 = { b: 2, a: 1, c: 3 };
    const obj2 = { a: 1, c: 3, b: 2 }; // Same data, different order
    
    const result1 = await cache.store(obj1);
    const result2 = await cache.store(obj2);
    
    // Should generate same hash despite different key order
    expect(result1.hash).toBe(result2.hash);
    expect(result2.cached).toBe(true);
  });
  
  it('should persist cache entries to disk', async () => {
    const content = 'Persistent content';
    const storeResult = await cache.store(content);
    
    // Create new cache instance to test persistence
    const newCache = new ContentAddressedCache({
      cacheDir: tempCacheDir,
      enablePersistence: true
    });
    
    const exists = await newCache.exists(storeResult.hash);
    expect(exists).toBe(true);
    
    const retrieveResult = await newCache.retrieve(storeResult.hash);
    expect(retrieveResult.found).toBe(true);
    expect(retrieveResult.content).toBe(content);
  });
  
  it('should evict entries when cache limits are exceeded', async () => {
    // Fill cache beyond max entries
    const entries = [];
    for (let i = 0; i < 15; i++) {
      const content = `Content ${i}`;
      const result = await cache.store(content);
      entries.push(result);
    }
    
    const stats = cache.getStatistics();
    expect(stats.memoryEntries).toBeLessThanOrEqual(10); // Should respect maxEntries
    expect(stats.evictions).toBeGreaterThan(0);
  });
  
  it('should cleanup expired entries', async () => {
    // Create cache with very short TTL
    const shortTTLCache = new ContentAddressedCache({
      cacheDir: path.join(tempCacheDir, 'short-ttl'),
      enablePersistence: true,
      ttl: 1 // 1ms TTL
    });
    
    const content = 'Expiring content';
    await shortTTLCache.store(content);
    
    // Wait for expiry
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const cleanupResult = await shortTTLCache.cleanup();
    expect(cleanupResult.expired).toBeGreaterThan(0);
  });
});

describe('Error Handling System', () => {
  let DeterministicErrorHandler;
  let errorHandler;
  
  beforeEach(async () => {
    const module = await import('../../../src/kgen/deterministic/error-handler.js');
    DeterministicErrorHandler = module.default;
    
    errorHandler = new DeterministicErrorHandler({
      enableRecovery: true,
      maxRetryAttempts: 2,
      retryDelay: 10, // Short delay for tests
      staticErrorTime: '2024-01-01T00:00:00.000Z'
    });
  });
  
  afterEach(() => {
    errorHandler.reset();
  });
  
  it('should classify errors correctly', async () => {
    const syntaxError = new SyntaxError('Unexpected token');
    const typeError = new TypeError('Cannot read property');
    const fileError = Object.assign(new Error('File not found'), { code: 'ENOENT' });
    
    const syntaxResult = await errorHandler.handleError(syntaxError, { templatePath: 'test.njk' });
    const typeResult = await errorHandler.handleError(typeError, { templatePath: 'test.njk' });
    const fileResult = await errorHandler.handleError(fileError, { templatePath: 'test.njk' });
    
    expect(syntaxResult.classification.category).toBe('syntax-error');
    expect(syntaxResult.classification.recoverable).toBe(true);
    
    expect(typeResult.classification.category).toBe('type-error');
    expect(typeResult.classification.recoverable).toBe(false);
    
    expect(fileResult.classification.category).toBe('filesystem-error');
    expect(fileResult.classification.recoverable).toBe(true);
  });
  
  it('should generate deterministic error IDs', async () => {
    const error = new Error('Test error');
    const context = { templatePath: 'test.njk' };
    
    const result1 = await errorHandler.handleError(error, context);
    const result2 = await errorHandler.handleError(error, context);
    
    // Same error and context should generate same ID
    expect(result1.errorId).toBe(result2.errorId);
  });
  
  it('should attempt error recovery', async () => {
    const missingVarError = new Error('name is undefined');
    const context = { templatePath: 'test.njv' };
    
    const result = await errorHandler.handleError(missingVarError, context);
    
    expect(result.recovery).toBeTruthy();
    expect(result.recovery.attempts).toBeGreaterThan(0);
  });
  
  it('should track error statistics', async () => {
    const errors = [
      new SyntaxError('Syntax error 1'),
      new SyntaxError('Syntax error 2'),
      new TypeError('Type error'),
      new Error('Generic error')
    ];
    
    for (const error of errors) {
      await errorHandler.handleError(error, { templatePath: 'test.njk' });
    }
    
    const stats = errorHandler.getStatistics();
    
    expect(stats.totalErrors).toBe(4);
    expect(stats.errorsByCategory['syntax-error']).toBe(2);
    expect(stats.errorsByCategory['type-error']).toBe(1);
  });
  
  it('should register custom recovery strategies', async () => {
    const customStrategy = async (error, context) => {
      return { success: true, strategy: 'custom-fix' };
    };
    
    errorHandler.registerRecoveryStrategy('custom-error', customStrategy);
    
    const customError = Object.assign(new Error('Custom error'), { category: 'custom-error' });
    const result = await errorHandler.handleError(customError, {});
    
    // Should use default classification, but we can test strategy registration
    expect(typeof errorHandler.recoveryStrategies.get('custom-error')).toBe('function');
  });
});

describe('Integrated System Tests', () => {
  let system;
  let testTemplatesDir;
  let testOutputDir;
  
  beforeEach(async () => {
    testTemplatesDir = path.join(__dirname, 'fixtures', 'system-templates');
    testOutputDir = path.join(__dirname, 'fixtures', 'system-output');
    
    await fs.mkdir(testTemplatesDir, { recursive: true });
    await fs.mkdir(testOutputDir, { recursive: true });
    
    system = new DeterministicRenderingSystem({
      templatesDir: testTemplatesDir,
      outputDir: testOutputDir,
      staticBuildTime: '2024-01-01T00:00:00.000Z',
      enableCaching: true,
      enableRDF: false,
      enableAttestation: true,
      strictMode: true
    });
  });
  
  afterEach(async () => {
    await system.shutdown();
    
    // Cleanup test directories
    try {
      await fs.rm(testTemplatesDir, { recursive: true });
      await fs.rm(testOutputDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });
  
  it('should render templates end-to-end', async () => {
    const template = `# {{ title }}

Generated at: {{ BUILD_TIME }}
Author: {{ author }}
Version: {{ version }}`;
    
    const templatePath = 'readme.njk';
    await fs.writeFile(path.join(testTemplatesDir, templatePath), template);
    
    const context = {
      title: 'My Project',
      author: 'Test Author',
      version: '1.0.0'
    };
    
    const result = await system.render(templatePath, context);
    
    expect(result.success).toBe(true);
    expect(result.content).toContain('# My Project');
    expect(result.content).toContain('2024-01-01T00:00:00.000Z');
    expect(result.metadata.deterministic).toBe(true);
    expect(result.contentHash).toBeTruthy();
  });
  
  it('should generate artifacts with attestations', async () => {
    const template = `console.log('Hello {{ name }}!');`;
    const templatePath = 'hello.js.njk';
    const outputPath = path.join(testOutputDir, 'hello.js');
    
    await fs.writeFile(path.join(testTemplatesDir, templatePath), template);
    
    const context = { name: 'World' };
    const result = await system.generateArtifact(templatePath, context, outputPath);
    
    expect(result.success).toBe(true);
    expect(result.outputPath).toBe(outputPath);
    expect(result.attestationPath).toBeTruthy();
    
    // Check that files were created
    const artifactExists = await fs.access(outputPath).then(() => true).catch(() => false);
    const attestationExists = await fs.access(result.attestationPath).then(() => true).catch(() => false);
    
    expect(artifactExists).toBe(true);
    expect(attestationExists).toBe(true);
    
    // Verify attestation content
    const attestation = JSON.parse(await fs.readFile(result.attestationPath, 'utf-8'));
    expect(attestation.artifact.contentHash).toBe(result.contentHash);
    expect(attestation.verification.deterministic).toBe(true);
  });
  
  it('should perform batch generation', async () => {
    const templates = [
      { templatePath: 'file1.txt.njk', context: { name: 'File 1' } },
      { templatePath: 'file2.txt.njk', context: { name: 'File 2' } },
      { templatePath: 'file3.txt.njk', context: { name: 'File 3' } }
    ];
    
    // Create template files
    for (const template of templates) {
      const content = `This is {{ name }}`;
      await fs.writeFile(
        path.join(testTemplatesDir, template.templatePath),
        content
      );
    }
    
    const globalContext = { timestamp: 'static' };
    const batchResult = await system.generateBatch(templates, globalContext);
    
    expect(batchResult.successful).toBe(3);
    expect(batchResult.failed).toBe(0);
    expect(batchResult.totalTemplates).toBe(3);
    expect(batchResult.batchHash).toBeTruthy();
  });
  
  it('should verify artifact reproducibility', async () => {
    const template = `Generated content: {{ data | canonical }}`;
    const templatePath = 'reproducible.txt.njk';
    const outputPath = path.join(testOutputDir, 'reproducible.txt');
    
    await fs.writeFile(path.join(testTemplatesDir, templatePath), template);
    
    const context = { data: { key: 'value', number: 42 } };
    
    // Generate initial artifact
    const generateResult = await system.generateArtifact(templatePath, context, outputPath);
    expect(generateResult.success).toBe(true);
    
    // Verify reproducibility
    const verifyResult = await system.verifyReproducibility(outputPath, 3);
    
    expect(verifyResult.verified).toBe(true);
    expect(verifyResult.iterations).toBe(3);
    expect(verifyResult.reproductions.every(r => r.success)).toBe(true);
  });
  
  it('should validate templates for deterministic patterns', async () => {
    const deterministicTemplate = `Hello {{ name }}! Build: {{ BUILD_TIME }}`;
    const nonDeterministicTemplate = `Hello {{ name }}! Time: {{ now }}`;
    
    await fs.writeFile(
      path.join(testTemplatesDir, 'good.njk'),
      deterministicTemplate
    );
    await fs.writeFile(
      path.join(testTemplatesDir, 'bad.njk'),
      nonDeterministicTemplate
    );
    
    const goodAnalysis = await system.validateTemplate('good.njk');
    const badAnalysis = await system.validateTemplate('bad.njk');
    
    expect(goodAnalysis.deterministicScore).toBeGreaterThan(badAnalysis.deterministicScore);
    expect(badAnalysis.issues.length).toBeGreaterThan(0);
    expect(badAnalysis.recommendations.length).toBeGreaterThan(0);
  });
  
  it('should provide comprehensive system statistics', async () => {
    // Perform some operations to generate statistics
    const template = `Test {{ value }}`;
    await fs.writeFile(path.join(testTemplatesDir, 'stats.njk'), template);
    
    await system.render('stats.njv', { value: 'data' });
    await system.generateArtifact('stats.njk', { value: 'artifact' });
    
    const stats = system.getStatistics();
    
    expect(stats.system).toBeTruthy();
    expect(stats.components).toBeTruthy();
    expect(stats.configuration).toBeTruthy();
    
    expect(stats.system.totalRenders).toBeGreaterThan(0);
    expect(stats.components.renderer).toBeTruthy();
    expect(stats.components.artifactGenerator).toBeTruthy();
    expect(stats.components.contentCache).toBeTruthy();
  });
  
  it('should perform health check', async () => {
    const health = await system.healthCheck();
    
    expect(health.status).toBe('healthy');
    expect(health.components.renderer.status).toBe('healthy');
    expect(health.components.artifactGenerator.status).toBe('healthy');
    expect(health.components.contentCache.status).toBe('healthy');
    expect(health.issues).toHaveLength(0);
  });
});

// Test runner export
export const tests = {
  'Deterministic Renderer Core': true,
  'Content-Addressed Cache': true,
  'Error Handling System': true,
  'Integrated System Tests': true
};