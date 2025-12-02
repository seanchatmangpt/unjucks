/**
 * @fileoverview Tests for deterministic TAR package builder
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { DeterministicTarBuilder, buildPackage, analyzePackage, verifyPackageIntegrity } from '../../src/pack/builder.js';
import { exampleKPackManifest } from '../../src/types/kpack.js';

describe('DeterministicTarBuilder', () => {
  let tempDir: string;
  let testDir: string;
  let outputPath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kgen-test-'));
    testDir = path.join(tempDir, 'test-package');
    outputPath = path.join(tempDir, 'test-package.tar');

    // Create test directory structure
    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(path.join(testDir, 'src'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'templates'), { recursive: true });

    // Create test files
    await fs.writeFile(
      path.join(testDir, 'README.md'),
      '# Test Package\n\nThis is a test package for KGEN.'
    );
    
    await fs.writeFile(
      path.join(testDir, 'src', 'index.ts'),
      'export const hello = "world";'
    );
    
    await fs.writeFile(
      path.join(testDir, 'templates', 'component.njk'),
      '<div>{{ name }}</div>'
    );

    // Create a hidden file
    await fs.writeFile(
      path.join(testDir, '.gitignore'),
      'node_modules/\n*.log'
    );
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Basic Functionality', () => {
    it('should create a TAR package', async () => {
      const builder = new DeterministicTarBuilder({
        baseDir: testDir,
        outputPath,
        manifest: exampleKPackManifest
      });

      const result = await builder.build();

      expect(result.packagePath).toBe(outputPath);
      expect(result.contentAddress.type).toBe('sha256');
      expect(result.contentAddress.value).toMatch(/^[a-f0-9]{64}$/);
      expect(result.size).toBeGreaterThan(0);
      expect(result.buildTime).toBeGreaterThan(0);

      // Verify file exists
      const stats = await fs.stat(outputPath);
      expect(stats.isFile()).toBe(true);
      expect(stats.size).toBe(result.size);
    });

    it('should include manifest as first entry', async () => {
      const builder = new DeterministicTarBuilder({
        baseDir: testDir,
        outputPath,
        manifest: exampleKPackManifest
      });

      const result = await builder.build();

      // First entry should be manifest
      expect(result.entries[0].path).toBe('kpack.json');
      expect(result.entries[0].content).toBeDefined();

      const manifestContent = JSON.parse(result.entries[0].content!.toString());
      expect(manifestContent.name).toBe(exampleKPackManifest.name);
      expect(manifestContent.version).toBe(exampleKPackManifest.version);
    });

    it('should sort entries alphabetically', async () => {
      const builder = new DeterministicTarBuilder({
        baseDir: testDir,
        outputPath,
        manifest: exampleKPackManifest
      });

      const result = await builder.build();

      // Skip manifest (first entry) and check file order
      const fileEntries = result.entries.slice(1);
      const paths = fileEntries.map(e => e.path);
      
      // Verify alphabetical ordering
      const sortedPaths = [...paths].sort();
      expect(paths).toEqual(sortedPaths);
    });

    it('should exclude hidden files by default', async () => {
      const builder = new DeterministicTarBuilder({
        baseDir: testDir,
        outputPath,
        manifest: exampleKPackManifest
      });

      const result = await builder.build();

      const hiddenFiles = result.entries.filter(e => 
        e.path.includes('.gitignore') || e.path.startsWith('.')
      );
      
      expect(hiddenFiles).toHaveLength(0);
    });

    it('should include hidden files when specified', async () => {
      const builder = new DeterministicTarBuilder({
        baseDir: testDir,
        outputPath,
        manifest: exampleKPackManifest,
        includeHidden: true
      });

      const result = await builder.build();

      const gitignoreEntry = result.entries.find(e => 
        e.path === '.gitignore'
      );
      
      expect(gitignoreEntry).toBeDefined();
    });
  });

  describe('Determinism', () => {
    it('should produce identical packages for same inputs', async () => {
      const builder1 = new DeterministicTarBuilder({
        baseDir: testDir,
        outputPath: path.join(tempDir, 'package1.tar'),
        manifest: exampleKPackManifest
      });

      const builder2 = new DeterministicTarBuilder({
        baseDir: testDir,
        outputPath: path.join(tempDir, 'package2.tar'),
        manifest: exampleKPackManifest
      });

      const [result1, result2] = await Promise.all([
        builder1.build(),
        builder2.build()
      ]);

      // Content addresses should be identical
      expect(result1.contentAddress.value).toBe(result2.contentAddress.value);
      expect(result1.size).toBe(result2.size);

      // File contents should be identical
      const [content1, content2] = await Promise.all([
        fs.readFile(result1.packagePath),
        fs.readFile(result2.packagePath)
      ]);

      expect(content1.equals(content2)).toBe(true);
    });

    it('should validate determinism with static method', async () => {
      const validation = await DeterministicTarBuilder.validateDeterminism({
        baseDir: testDir,
        outputPath: path.join(tempDir, 'validation-test.tar'),
        manifest: exampleKPackManifest
      }, 3);

      expect(validation.deterministic).toBe(true);
      expect(validation.hashes).toHaveLength(3);
      expect(new Set(validation.hashes).size).toBe(1); // All hashes should be same
      expect(validation.error).toBeUndefined();
    });

    it('should use fixed timestamps for determinism', async () => {
      const fixedDate = new Date('2025-01-01T00:00:00Z');
      
      const builder = new DeterministicTarBuilder({
        baseDir: testDir,
        outputPath,
        manifest: exampleKPackManifest,
        fixedTimestamp: fixedDate
      });

      const result = await builder.build();

      // All entries should have the fixed timestamp
      result.entries.forEach(entry => {
        expect(entry.mtime).toEqual(fixedDate);
      });
    });
  });

  describe('Exclude Patterns', () => {
    beforeEach(async () => {
      // Create additional test files
      await fs.writeFile(path.join(testDir, 'temp.log'), 'log content');
      await fs.writeFile(path.join(testDir, 'src', 'test.spec.ts'), 'test content');
      await fs.mkdir(path.join(testDir, 'node_modules'), { recursive: true });
      await fs.writeFile(path.join(testDir, 'node_modules', 'package.json'), '{}');
    });

    it('should exclude files matching patterns', async () => {
      const builder = new DeterministicTarBuilder({
        baseDir: testDir,
        outputPath,
        manifest: exampleKPackManifest,
        exclude: ['*.log', 'node_modules/**', '**/*.spec.ts']
      });

      const result = await builder.build();

      const excludedFiles = result.entries.filter(e => 
        e.path.includes('.log') || 
        e.path.includes('node_modules') ||
        e.path.includes('.spec.ts')
      );

      expect(excludedFiles).toHaveLength(0);
    });

    it('should support glob patterns', async () => {
      const builder = new DeterministicTarBuilder({
        baseDir: testDir,
        outputPath,
        manifest: exampleKPackManifest,
        exclude: ['**/*.spec.*', 'node_modules']
      });

      const result = await builder.build();

      const specFiles = result.entries.filter(e => e.path.includes('.spec.'));
      const nodeModules = result.entries.filter(e => e.path.includes('node_modules'));

      expect(specFiles).toHaveLength(0);
      expect(nodeModules).toHaveLength(0);
    });
  });

  describe('Utility Functions', () => {
    it('should build package with single function call', async () => {
      const result = await buildPackage({
        baseDir: testDir,
        outputPath,
        manifest: exampleKPackManifest
      });

      expect(result.packagePath).toBe(outputPath);
      expect(result.contentAddress.type).toBe('sha256');
      expect(await fs.stat(outputPath)).toBeTruthy();
    });

    it('should analyze package without building', async () => {
      const analysis = await analyzePackage(testDir);

      expect(analysis.fileCount).toBeGreaterThan(0);
      expect(analysis.totalSize).toBeGreaterThan(0);
      expect(analysis.entries).toHaveLength(analysis.fileCount);
      
      analysis.entries.forEach(entry => {
        expect(entry.path).toMatch(/^[^/].*$/); // No leading slash
        expect(entry.size).toBeGreaterThanOrEqual(0);
        expect(entry.hash).toMatch(/^[a-f0-9]{64}$/);
      });
    });

    it('should verify package integrity', async () => {
      const result = await buildPackage({
        baseDir: testDir,
        outputPath,
        manifest: exampleKPackManifest
      });

      const verification = await verifyPackageIntegrity(
        outputPath,
        result.contentAddress
      );

      expect(verification.valid).toBe(true);
      expect(verification.actualHash).toBe(result.contentAddress.value);
      expect(verification.expectedHash).toBe(result.contentAddress.value);
    });

    it('should detect corrupted packages', async () => {
      const result = await buildPackage({
        baseDir: testDir,
        outputPath,
        manifest: exampleKPackManifest
      });

      // Corrupt the package
      const content = await fs.readFile(outputPath);
      const corruptedContent = Buffer.concat([content, Buffer.from('corruption')]);
      await fs.writeFile(outputPath, corruptedContent);

      const verification = await verifyPackageIntegrity(
        outputPath,
        result.contentAddress
      );

      expect(verification.valid).toBe(false);
      expect(verification.actualHash).not.toBe(result.contentAddress.value);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid base directory', async () => {
      const builder = new DeterministicTarBuilder({
        baseDir: '/nonexistent/directory',
        outputPath,
        manifest: exampleKPackManifest
      });

      await expect(builder.build()).rejects.toThrow('Failed to build package');
    });

    it('should handle invalid output path', async () => {
      const builder = new DeterministicTarBuilder({
        baseDir: testDir,
        outputPath: '/root/invalid/path/package.tar', // Should fail on most systems
        manifest: exampleKPackManifest
      });

      await expect(builder.build()).rejects.toThrow();
    });

    it('should handle empty directory', async () => {
      const emptyDir = path.join(tempDir, 'empty');
      await fs.mkdir(emptyDir);

      const builder = new DeterministicTarBuilder({
        baseDir: emptyDir,
        outputPath,
        manifest: exampleKPackManifest
      });

      const result = await builder.build();

      // Should only contain manifest
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].path).toBe('kpack.json');
    });
  });
});