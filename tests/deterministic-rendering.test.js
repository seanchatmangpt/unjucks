/**
 * Comprehensive Deterministic Rendering Test Suite
 * 
 * Tests that guarantee byte-identical outputs across:
 * - Multiple renders of the same template
 * - Cross-platform execution
 * - Different process restarts
 * - Various input combinations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { HardenedDeterministicRenderer } from '../src/kgen/deterministic/hardened-renderer.js';

describe('Deterministic Rendering', () => {
  let renderer;
  let testTemplatesDir;

  beforeEach(async () => {
    // Create temporary templates directory
    testTemplatesDir = path.join(process.cwd(), 'tests/fixtures/deterministic-templates');
    await fs.mkdir(testTemplatesDir, { recursive: true });

    // Initialize renderer with deterministic settings
    renderer = new HardenedDeterministicRenderer({
      templatesDir: testTemplatesDir,
      deterministicSeed: 'test-seed-12345',
      staticBuildTime: '2024-01-01T00:00:00.000Z',
      strictMode: true,
      validateDeterminism: true,
      useGitHash: false // Disable git for testing
    });

    // Create test templates
    await createTestTemplates();
  });

  afterEach(async () => {
    // Clean up test templates
    try {
      await fs.rm(testTemplatesDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  async function createTestTemplates() {
    // Simple template
    await fs.writeFile(
      path.join(testTemplatesDir, 'simple.njk'),
      'Hello {{ name }}!\nGenerated at: {{ BUILD_TIME }}\n'
    );

    // Template with frontmatter
    await fs.writeFile(
      path.join(testTemplatesDir, 'with-frontmatter.njk'),
      `---
title: Test Document
version: 1.0
---
# {{ title }}

Version: {{ version }}
User: {{ user.name }}
Hash: {{ user.name | hash }}
`
    );

    // Complex template with loops and conditions
    await fs.writeFile(
      path.join(testTemplatesDir, 'complex.njk'),
      `---
items:
  - id: 1
    name: "First Item"
  - id: 2
    name: "Second Item"
---
# Items List

{% for item in items | sort('id') %}
{{ loop.index }}. {{ item.name }} (ID: {{ item.id }})
   Hash: {{ item.name | hash }}
   UUID: {{ item.name | uuid('item') }}
{% endfor %}

{% if items.length > 1 %}
Total items: {{ items.length }}
{% endif %}

Build info:
- Time: {{ BUILD_TIME }}
- Hash: {{ BUILD_HASH }}
`
    );

    // Template with various filters
    await fs.writeFile(
      path.join(testTemplatesDir, 'filters.njk'),
      `# Filter Tests

Random (seeded): {{ "test-seed" | random }}
Slug: {{ "Test Title With Spaces!" | slug }}
Base64: {{ "deterministic content" | base64 }}
Content ID: {{ data | contentId }}
UUID: {{ "namespace" | uuid }}
Sorted keys: {{ data | sortKeys | canonical }}
Normalized path: {{ "path\\\\to\\\\file.txt" | normalizePath }}
`
    );
  }

  describe('Basic Deterministic Rendering', () => {
    it('should produce identical output for identical input', async () => {
      const context = { name: 'World' };
      
      const result1 = await renderer.render('simple.njk', context);
      const result2 = await renderer.render('simple.njk', context);
      const result3 = await renderer.render('simple.njk', context);

      // Content should be identical
      expect(result1.content).toBe(result2.content);
      expect(result2.content).toBe(result3.content);

      // Hashes should be identical
      expect(result1.contentHash).toBe(result2.contentHash);
      expect(result2.contentHash).toBe(result3.contentHash);

      // Verify actual content
      expect(result1.content).toBe('Hello World!\nGenerated at: 2024-01-01T00:00:00.000Z\n');
    });

    it('should produce different output for different input', async () => {
      const result1 = await renderer.render('simple.njk', { name: 'Alice' });
      const result2 = await renderer.render('simple.njk', { name: 'Bob' });

      expect(result1.content).not.toBe(result2.content);
      expect(result1.contentHash).not.toBe(result2.contentHash);
    });

    it('should handle empty context deterministically', async () => {
      const result1 = await renderer.render('simple.njk', {});
      const result2 = await renderer.render('simple.njk', {});

      expect(result1.content).toBe(result2.content);
      expect(result1.contentHash).toBe(result2.contentHash);
    });
  });

  describe('100-Iteration Determinism Test', () => {
    it('should produce identical output across 100 renders', async () => {
      const context = {
        name: 'DeterministicTest',
        user: { name: 'TestUser', id: 12345 }
      };

      const testResult = await renderer.testDeterministicRendering(
        'with-frontmatter.njk',
        context,
        100
      );

      expect(testResult.deterministic).toBe(true);
      expect(testResult.uniqueHashes).toBe(1);
      expect(testResult.validation.passed).toBe(true);
      expect(testResult.iterations).toBe(100);

      // Verify content hash is consistent
      expect(testResult.contentHash).toBeDefined();
      expect(typeof testResult.contentHash).toBe('string');
      expect(testResult.contentHash.length).toBe(64); // SHA-256 hex length
    });

    it('should maintain determinism with complex templates', async () => {
      const context = {
        data: {
          complex: 'value',
          nested: { key: 'nested-value' },
          array: [3, 1, 2] // Will be sorted deterministically
        }
      };

      const testResult = await renderer.testDeterministicRendering(
        'complex.njk',
        context,
        50
      );

      expect(testResult.deterministic).toBe(true);
      expect(testResult.uniqueHashes).toBe(1);
      expect(testResult.validation.passed).toBe(true);
    });
  });

  describe('Deterministic Filters', () => {
    it('should produce consistent hash outputs', async () => {
      const context = {
        data: { key: 'value', nested: { inner: 'data' } }
      };

      const result1 = await renderer.render('filters.njk', context);
      const result2 = await renderer.render('filters.njk', context);

      expect(result1.content).toBe(result2.content);
      expect(result1.contentHash).toBe(result2.contentHash);

      // Verify deterministic filter outputs
      const content = result1.content;
      
      // Random should be consistent with seed
      expect(content).toMatch(/Random \(seeded\): 0\.\d+/);
      
      // Slug should be normalized
      expect(content).toContain('Slug: test-title-with-spaces');
      
      // Base64 should be consistent
      expect(content).toContain('Base64: ZGV0ZXJtaW5pc3RpYyBjb250ZW50');
      
      // Path normalization
      expect(content).toContain('Normalized path: path/to/file.txt');
    });

    it('should produce deterministic UUIDs', async () => {
      const context = { test: 'uuid-generation' };

      const results = [];
      for (let i = 0; i < 10; i++) {
        renderer.clearCache(); // Force fresh render
        const result = await renderer.render('filters.njk', context);
        results.push(result.content);
      }

      // All results should be identical
      const uniqueResults = new Set(results);
      expect(uniqueResults.size).toBe(1);

      // Verify UUID format
      const content = results[0];
      const uuidMatch = content.match(/UUID: ([a-f0-9-]+)/);
      expect(uuidMatch).toBeTruthy();
      
      const uuid = uuidMatch[1];
      expect(uuid).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[a-f0-9]{4}-[a-f0-9]{12}$/);
    });
  });

  describe('Cross-Platform Consistency', () => {
    it('should normalize paths consistently', async () => {
      const windowsPath = 'C:\\Users\\test\\file.txt';
      const unixPath = '/home/test/file.txt';
      const mixedPath = 'relative\\path/to/file.txt';

      const templates = [
        `Path: {{ "${windowsPath}" | normalizePath }}`,
        `Path: {{ "${unixPath}" | normalizePath }}`,
        `Path: {{ "${mixedPath}" | normalizePath }}`
      ];

      for (let i = 0; i < templates.length; i++) {
        await fs.writeFile(
          path.join(testTemplatesDir, `path-test-${i}.njk`),
          templates[i]
        );

        const result1 = await renderer.render(`path-test-${i}.njk`, {});
        const result2 = await renderer.render(`path-test-${i}.njk`, {});

        expect(result1.content).toBe(result2.content);
        expect(result1.contentHash).toBe(result2.contentHash);
      }
    });

    it('should handle line ending normalization', async () => {
      // Create template with mixed line endings
      const templateContent = 'Line 1\r\nLine 2\rLine 3\nEnd';
      await fs.writeFile(
        path.join(testTemplatesDir, 'line-endings.njk'),
        templateContent
      );

      const result1 = await renderer.render('line-endings.njk', {});
      const result2 = await renderer.render('line-endings.njk', {});

      expect(result1.content).toBe(result2.content);
      expect(result1.contentHash).toBe(result2.contentHash);

      // Should normalize to Unix line endings
      expect(result1.content).toBe('Line 1\nLine 2\nLine 3\nEnd\n');
    });
  });

  describe('Performance Benchmarking', () => {
    it('should maintain consistent performance', async () => {
      const context = {
        user: { name: 'PerformanceTest', id: 98765 },
        data: { large: 'x'.repeat(1000) }
      };

      const benchmark = await renderer.benchmarkDeterministicRendering(
        'complex.njk',
        context,
        20
      );

      expect(benchmark.deterministic).toBe(true);
      expect(benchmark.iterations).toBe(20);
      expect(benchmark.performance.averageTime).toBeGreaterThan(0);
      expect(benchmark.performance.minTime).toBeGreaterThan(0);
      expect(benchmark.performance.maxTime).toBeGreaterThan(0);
      expect(benchmark.validation.uniqueOutputs).toBe(1);

      // Performance should be reasonable (less than 100ms average)
      expect(benchmark.performance.averageTime).toBeLessThan(100);
    });
  });

  describe('Context Canonicalization', () => {
    it('should produce identical output for equivalent contexts', async () => {
      const context1 = {
        b: 2,
        a: 1,
        nested: { y: 'second', x: 'first' }
      };

      const context2 = {
        a: 1,
        b: 2,
        nested: { x: 'first', y: 'second' }
      };

      const result1 = await renderer.render('simple.njk', context1);
      const result2 = await renderer.render('simple.njk', context2);

      // Should be identical despite different key ordering
      expect(result1.contentHash).toBe(result2.contentHash);
    });

    it('should strip temporal data from context', async () => {
      const contextWithTemporal = {
        name: 'Test',
        timestamp: this.getDeterministicTimestamp(),
        createdAt: this.getDeterministicDate().toISOString(),
        id: Math.random().toString(36),
        validData: 'keep-this'
      };

      const contextWithoutTemporal = {
        name: 'Test',
        validData: 'keep-this'
      };

      const result1 = await renderer.render('simple.njk', contextWithTemporal);
      const result2 = await renderer.render('simple.njk', contextWithoutTemporal);

      // Should be identical after stripping temporal data
      expect(result1.contentHash).toBe(result2.contentHash);
    });
  });

  describe('Cache Behavior', () => {
    it('should use cache for identical renders', async () => {
      const context = { name: 'CacheTest' };

      // Clear cache and render
      renderer.clearCache();
      const result1 = await renderer.render('simple.njk', context);
      
      // Second render should use cache
      const result2 = await renderer.render('simple.njk', context);

      expect(result1.content).toBe(result2.content);
      expect(result1.contentHash).toBe(result2.contentHash);

      // Verify cache is being used
      const stats1 = renderer.getStatistics();
      expect(stats1.renderCacheSize).toBeGreaterThan(0);
    });

    it('should invalidate cache for different contexts', async () => {
      const result1 = await renderer.render('simple.njk', { name: 'Alice' });
      const result2 = await renderer.render('simple.njk', { name: 'Bob' });

      expect(result1.contentHash).not.toBe(result2.contentHash);

      const stats = renderer.getStatistics();
      expect(stats.renderCacheSize).toBe(2); // Both results cached
    });
  });

  describe('Error Handling', () => {
    it('should handle missing templates gracefully in strict mode', async () => {
      await expect(
        renderer.render('nonexistent.njk', {})
      ).rejects.toThrow('Template not found: nonexistent.njk');
    });

    it('should handle template syntax errors', async () => {
      await fs.writeFile(
        path.join(testTemplatesDir, 'syntax-error.njk'),
        '{{ unclosed variable'
      );

      await expect(
        renderer.render('syntax-error.njk', {})
      ).rejects.toThrow();
    });
  });

  describe('Hash Verification', () => {
    it('should produce consistent SHA-256 hashes', async () => {
      const context = { name: 'HashTest' };
      const result = await renderer.render('simple.njk', context);

      // Verify hash format
      expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);

      // Verify hash matches content
      const expectedHash = crypto.createHash('sha256')
        .update(result.content, 'utf8')
        .digest('hex');
      
      expect(result.contentHash).toBe(expectedHash);
    });

    it('should detect non-deterministic output', async () => {
      // Create a template that would be non-deterministic
      await fs.writeFile(
        path.join(testTemplatesDir, 'non-deterministic.njk'),
        'Current time: {{ "now" | date }}\nRandom: {{ "seed" | random }}\n'
      );

      // This should still be deterministic due to our hardened filters
      const testResult = await renderer.testDeterministicRendering(
        'non-deterministic.njk',
        {},
        10
      );

      expect(testResult.deterministic).toBe(true);
      expect(testResult.uniqueHashes).toBe(1);
    });
  });

  describe('Frontmatter Processing', () => {
    it('should process frontmatter deterministically', async () => {
      const context = { user: { name: 'FrontmatterTest' } };

      const result1 = await renderer.render('with-frontmatter.njk', context);
      const result2 = await renderer.render('with-frontmatter.njk', context);

      expect(result1.content).toBe(result2.content);
      expect(result1.contentHash).toBe(result2.contentHash);

      // Verify frontmatter was processed
      expect(result1.frontmatter).toBeDefined();
      expect(result1.frontmatter.title).toBe('Test Document');
      expect(result1.frontmatter.version).toBe(1.0);

      // Frontmatter should have consistent hash
      const frontmatterHash1 = result1.metadata.frontmatterHash;
      const frontmatterHash2 = result2.metadata.frontmatterHash;
      expect(frontmatterHash1).toBe(frontmatterHash2);
    });

    it('should handle frontmatter key ordering', async () => {
      const frontmatterTemplate1 = `---
title: Test
version: 1.0
author: TestUser
---
Content: {{ title }} v{{ version }} by {{ author }}`;

      const frontmatterTemplate2 = `---
version: 1.0
author: TestUser
title: Test
---
Content: {{ title }} v{{ version }} by {{ author }}`;

      await fs.writeFile(
        path.join(testTemplatesDir, 'frontmatter-1.njk'),
        frontmatterTemplate1
      );

      await fs.writeFile(
        path.join(testTemplatesDir, 'frontmatter-2.njk'),
        frontmatterTemplate2
      );

      const result1 = await renderer.render('frontmatter-1.njk', {});
      const result2 = await renderer.render('frontmatter-2.njk', {});

      // Should produce identical output despite different key ordering in frontmatter
      expect(result1.content).toBe(result2.content);
      expect(result1.contentHash).toBe(result2.contentHash);
    });
  });
});