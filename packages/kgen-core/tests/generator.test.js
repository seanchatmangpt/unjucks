/**
 * Test Suite for Deterministic Artifact Generator
 */

import { test, describe, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { 
  DeterministicTemplateEnvironment,
  ContentAddressedGenerator,
  DeterministicArtifactGenerator 
} from '../src/artifacts/generator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDir = path.join(__dirname, 'fixtures');
const outputDir = path.join(testDir, 'output');

// Setup test fixtures
before(async () => {
  await fs.mkdir(testDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(path.join(testDir, '_templates'), { recursive: true });

  // Create test templates
  await fs.writeFile(
    path.join(testDir, '_templates', 'simple.njk'),
    'Hello {{ name }}!'
  );

  await fs.writeFile(
    path.join(testDir, '_templates', 'with-frontmatter.njk'),
    `---
to: "{{ name | lower }}.txt"
contentAddressed: true
---
Component: {{ name }}
Type: {{ type or "default" }}
Generated: {{ buildEnv.nodeVersion }}`
  );

  await fs.writeFile(
    path.join(testDir, '_templates', 'deterministic.njk'),
    `// {{ name }} Component
const {{ name }} = {
  name: "{{ name }}",
  hash: "{{ name | hash }}",
  id: "{{ name | contentId }}",
  sorted: {{ sortKeys(props) | dump }}
};`
  );

  // Create test context file
  await fs.writeFile(
    path.join(testDir, 'context.json'),
    JSON.stringify({
      name: "TestComponent",
      type: "React",
      props: { z: "last", a: "first", m: "middle" }
    }, null, 2)
  );
});

// Cleanup after tests
after(async () => {
  try {
    await fs.rm(testDir, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
});

describe('DeterministicTemplateEnvironment', () => {
  test('should create deterministic environment', async () => {
    const env = new DeterministicTemplateEnvironment({
      templatesDir: path.join(testDir, '_templates')
    });

    assert(env.env !== null, 'Environment should be created');
    assert.equal(env.options.templatesDir, path.join(testDir, '_templates'));
  });

  test('should render templates deterministically', async () => {
    const env = new DeterministicTemplateEnvironment({
      templatesDir: path.join(testDir, '_templates')
    });

    const context = { name: 'World' };
    
    const render1 = await env.renderTemplate('simple.njk', context);
    const render2 = await env.renderTemplate('simple.njk', context);

    assert.equal(render1, render2, 'Multiple renders should be identical');
    assert.equal(render1, 'Hello World!', 'Content should match expected output');
  });

  test('should provide deterministic global functions', async () => {
    const env = new DeterministicTemplateEnvironment({
      templatesDir: path.join(testDir, '_templates')
    });

    const context = {
      name: 'TestComponent',
      props: { z: 'last', a: 'first', m: 'middle' }
    };

    const rendered = await env.renderTemplate('deterministic.njk', context);
    
    // Check that hashes are deterministic
    const hashMatch = rendered.match(/hash: "([a-f0-9]+)"/);
    const idMatch = rendered.match(/id: "([a-f0-9]+)"/);
    
    assert(hashMatch, 'Should contain hash');
    assert(idMatch, 'Should contain content ID');
    assert.equal(hashMatch[1].length, 64, 'Hash should be SHA256');
    assert.equal(idMatch[1].length, 16, 'Content ID should be 16 chars');

    // Verify object sorting worked
    assert(rendered.includes('{"a":"first","m":"middle","z":"last"}'), 'Props should be sorted');
  });

  test('should reject non-deterministic operations', async () => {
    const env = new DeterministicTemplateEnvironment({
      templatesDir: path.join(testDir, '_templates')
    });

    // Create template with random filter
    await fs.writeFile(
      path.join(testDir, '_templates', 'random.njk'),
      '{{ name | random }}'
    );

    await assert.rejects(
      () => env.renderTemplate('random.njk', { name: 'test' }),
      /random filter is not allowed/,
      'Should reject random filter'
    );
  });

  test('should cache rendered results', async () => {
    const env = new DeterministicTemplateEnvironment({
      templatesDir: path.join(testDir, '_templates')
    });

    const context = { name: 'CacheTest' };
    
    await env.renderTemplate('simple.njk', context);
    await env.renderTemplate('simple.njk', context);
    
    const stats = env.getStats();
    assert.equal(stats.renders, 2, 'Should record 2 renders');
    assert.equal(stats.cacheHits, 1, 'Should have 1 cache hit');
  });
});

describe('ContentAddressedGenerator', () => {
  test('should generate content-addressed artifacts', async () => {
    const generator = new ContentAddressedGenerator({
      templatesDir: path.join(testDir, '_templates')
    });

    const context = { name: 'TestComponent', type: 'React' };
    const templatePath = path.join(testDir, '_templates', 'with-frontmatter.njk');
    const outputPath = path.join(outputDir, 'component.txt');

    const result = await generator.generateArtifact(templatePath, context, outputPath);

    assert(result.success, 'Generation should succeed');
    assert(result.contentHash, 'Should have content hash');
    assert(result.shortHash, 'Should have short hash');
    assert.equal(result.shortHash.length, 16, 'Short hash should be 16 chars');
    assert(result.outputPath.includes(result.shortHash), 'Output path should include hash');
  });

  test('should create attestation sidecars', async () => {
    const generator = new ContentAddressedGenerator({
      templatesDir: path.join(testDir, '_templates')
    });

    const context = { name: 'AttestTest' };
    const templatePath = path.join(testDir, '_templates', 'simple.njk');
    const outputPath = path.join(outputDir, 'attest-test.txt');

    const artifact = await generator.generateArtifact(templatePath, context, outputPath);
    const writeResult = await generator.writeArtifact(artifact);

    assert(writeResult.success, 'Write should succeed');
    
    // Check that attestation file exists
    const attestationExists = await fs.access(writeResult.attestationPath)
      .then(() => true)
      .catch(() => false);
    
    assert(attestationExists, 'Attestation file should exist');

    // Verify attestation content
    const attestationContent = await fs.readFile(writeResult.attestationPath, 'utf8');
    const attestation = JSON.parse(attestationContent);

    assert.equal(attestation.artifact.contentHash, artifact.contentHash, 'Hash should match');
    assert(attestation.generation.template, 'Should have template path');
    assert(attestation.generation.context, 'Should have context');
    assert(attestation.environment.nodeVersion, 'Should have environment info');
    assert.equal(attestation.verification.deterministic, true, 'Should be marked as deterministic');
  });

  test('should verify artifact integrity', async () => {
    const generator = new ContentAddressedGenerator({
      templatesDir: path.join(testDir, '_templates')
    });

    const context = { name: 'VerifyTest' };
    const templatePath = path.join(testDir, '_templates', 'simple.njk');
    const outputPath = path.join(outputDir, 'verify-test.txt');

    // Generate and write artifact
    const artifact = await generator.generateArtifact(templatePath, context, outputPath);
    await generator.writeArtifact(artifact);

    // Verify integrity
    const verification = await generator.verifyArtifact(artifact.outputPath);

    assert(verification.verified, 'Artifact should verify successfully');
    assert.equal(verification.currentHash, verification.expectedHash, 'Hashes should match');
  });

  test('should detect tampering', async () => {
    const generator = new ContentAddressedGenerator({
      templatesDir: path.join(testDir, '_templates')
    });

    const context = { name: 'TamperTest' };
    const templatePath = path.join(testDir, '_templates', 'simple.njk');
    const outputPath = path.join(outputDir, 'tamper-test.txt');

    // Generate and write artifact
    const artifact = await generator.generateArtifact(templatePath, context, outputPath);
    await generator.writeArtifact(artifact);

    // Tamper with the file
    await fs.writeFile(artifact.outputPath, 'Tampered content');

    // Verify should fail
    const verification = await generator.verifyArtifact(artifact.outputPath);

    assert(!verification.verified, 'Tampered artifact should not verify');
    assert.notEqual(verification.currentHash, verification.expectedHash, 'Hashes should differ');
  });
});

describe('DeterministicArtifactGenerator', () => {
  test('should generate deterministic artifacts', async () => {
    const generator = new DeterministicArtifactGenerator({
      templatesDir: path.join(testDir, '_templates'),
      outputDir: outputDir
    });

    const context = { name: 'MainTest' };
    const templatePath = path.join(testDir, '_templates', 'simple.njk');

    const result = await generator.generate(templatePath, context);

    assert(result.success, 'Generation should succeed');
    assert(result.outputPath, 'Should have output path');
    assert(result.contentHash, 'Should have content hash');

    // Verify file exists
    const fileExists = await fs.access(result.outputPath)
      .then(() => true)
      .catch(() => false);
    
    assert(fileExists, 'Generated file should exist');
  });

  test('should create and use lockfiles', async () => {
    const generator = new DeterministicArtifactGenerator({
      templatesDir: path.join(testDir, '_templates'),
      outputDir: outputDir
    });

    const templates = [
      {
        name: 'simple',
        templatePath: path.join(testDir, '_templates', 'simple.njk'),
        context: { name: 'LockTest1' },
        outputPath: 'lock-test-1.txt'
      },
      {
        name: 'deterministic',
        templatePath: path.join(testDir, '_templates', 'deterministic.njk'),
        context: { name: 'LockTest2', props: { b: 2, a: 1 } },
        outputPath: 'lock-test-2.js'
      }
    ];

    const lockfilePath = path.join(outputDir, 'test.lock');
    
    // Create lockfile
    const lockfile = await generator.createLockfile(templates, lockfilePath);
    
    assert(lockfile.templates, 'Lockfile should have templates');
    assert.equal(Object.keys(lockfile.templates).length, 2, 'Should have 2 templates');
    assert(lockfile.contextHash, 'Should have context hash');

    // Generate from lockfile
    const result = await generator.generateFromLockfile(lockfilePath, outputDir);
    
    assert(result.success, 'Lockfile generation should succeed');
    assert.equal(result.artifacts.length, 2, 'Should generate 2 artifacts');
  });

  test('should ensure byte-for-byte reproducibility', async () => {
    const generator1 = new DeterministicArtifactGenerator({
      templatesDir: path.join(testDir, '_templates'),
      outputDir: path.join(outputDir, 'repro1')
    });

    const generator2 = new DeterministicArtifactGenerator({
      templatesDir: path.join(testDir, '_templates'),
      outputDir: path.join(outputDir, 'repro2')
    });

    const context = { 
      name: 'ReproTest',
      props: { z: 'last', a: 'first', m: 'middle' }
    };
    const templatePath = path.join(testDir, '_templates', 'deterministic.njk');

    // Generate with both generators
    const result1 = await generator1.generate(templatePath, context);
    const result2 = await generator2.generate(templatePath, context);

    assert(result1.success && result2.success, 'Both generations should succeed');

    // Read both files and compare
    const content1 = await fs.readFile(result1.outputPath, 'utf8');
    const content2 = await fs.readFile(result2.outputPath, 'utf8');

    assert.equal(content1, content2, 'Generated content should be identical');
    assert.equal(result1.contentHash, result2.contentHash, 'Content hashes should match');
  });

  test('should provide generation statistics', async () => {
    const generator = new DeterministicArtifactGenerator({
      templatesDir: path.join(testDir, '_templates'),
      outputDir: outputDir
    });

    const context = { name: 'StatsTest' };
    const templatePath = path.join(testDir, '_templates', 'simple.njk');

    await generator.generate(templatePath, context);
    
    const stats = generator.getStats();
    
    assert(stats.generator, 'Should have generator stats');
    assert(stats.generator.templateEngineStats, 'Should have template engine stats');
    assert(stats.generator.totalArtifacts >= 1, 'Should have at least 1 artifact');
  });
});

describe('Edge Cases and Error Handling', () => {
  test('should handle missing templates gracefully', async () => {
    const generator = new DeterministicArtifactGenerator({
      templatesDir: path.join(testDir, '_templates'),
      outputDir: outputDir
    });

    const context = { name: 'MissingTest' };
    const templatePath = path.join(testDir, '_templates', 'nonexistent.njk');

    const result = await generator.generate(templatePath, context);

    assert(!result.success, 'Should fail for missing template');
    assert(result.error, 'Should have error message');
  });

  test('should handle invalid context gracefully', async () => {
    const env = new DeterministicTemplateEnvironment({
      templatesDir: path.join(testDir, '_templates')
    });

    // Test with circular reference
    const circular = { name: 'test' };
    circular.self = circular;

    await assert.rejects(
      () => env.renderTemplate('simple.njk', circular),
      'Should reject circular references'
    );
  });

  test('should handle concurrent generation', async () => {
    const generator = new DeterministicArtifactGenerator({
      templatesDir: path.join(testDir, '_templates'),
      outputDir: outputDir
    });

    const templatePath = path.join(testDir, '_templates', 'simple.njk');
    
    // Generate multiple artifacts concurrently
    const promises = Array.from({ length: 5 }, (_, i) => 
      generator.generate(templatePath, { name: `Concurrent${i}` })
    );

    const results = await Promise.all(promises);
    
    assert(results.every(r => r.success), 'All concurrent generations should succeed');
    
    // Verify all have unique content hashes (different contexts)
    const hashes = results.map(r => r.contentHash);
    const uniqueHashes = new Set(hashes);
    assert.equal(uniqueHashes.size, 5, 'Should have 5 unique hashes');
  });
});