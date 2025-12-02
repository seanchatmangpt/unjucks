/**
 * CLI Functionality Tests
 * Tests core CLI functionality without process spawning
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolve } from 'path';
import { readFile, writeFile, mkdir, rmdir } from 'fs/promises';
import { mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';

describe('KGEN CLI Functionality', () => {
  let testDir;

  beforeEach(async () => {
    testDir = await mkdtemp(resolve(tmpdir(), 'kgen-test-'));
  });

  afterEach(async () => {
    try {
      const fs = await import('fs/promises');
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Module Structure', () => {
    it('should have correct package configuration', async () => {
      const packagePath = resolve(process.cwd(), 'package.json');
      const content = await readFile(packagePath, 'utf-8');
      const pkg = JSON.parse(content);

      expect(pkg.name).toBe('@kgen/cli/cli-entry');
      expect(pkg.version).toBe('1.0.0');
      expect(pkg.type).toBe('module');
      expect(pkg.bin.kgen).toBe('./src/cli.js');
    });

    it('should have executable CLI file', async () => {
      const cliPath = resolve(process.cwd(), 'src/cli.js');
      const content = await readFile(cliPath, 'utf-8');

      expect(content).toContain('#!/usr/bin/env node');
      expect(content).toContain('citty');
      expect(content).toContain('runMain');
    });

    it('should import required dependencies', async () => {
      // Test that all required dependencies can be imported
      const citty = await import('citty');
      const c12 = await import('c12');

      expect(citty.defineCommand).toBeDefined();
      expect(citty.runMain).toBeDefined();
      expect(c12.loadConfig).toBeDefined();
    });
  });

  describe('File Operations', () => {
    it('should be able to create test directories', async () => {
      const testSubDir = resolve(testDir, 'subdir');
      await mkdir(testSubDir, { recursive: true });

      // Verify directory creation
      const fs = await import('fs/promises');
      const stats = await fs.stat(testSubDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should be able to write and read test files', async () => {
      const testFile = resolve(testDir, 'test.txt');
      const testContent = 'Hello, KGEN!';

      await writeFile(testFile, testContent);
      const readContent = await readFile(testFile, 'utf-8');

      expect(readContent).toBe(testContent);
    });
  });

  describe('CLI Dependencies', () => {
    it('should load external modules successfully', async () => {
      // Test loading modules that the CLI depends on
      const modules = [
        'citty',
        'c12',
        'fs',
        'path',
        'crypto'
      ];

      for (const moduleName of modules) {
        const module = await import(moduleName);
        expect(module).toBeDefined();
      }
    });
  });

  describe('Version Information', () => {
    it('should provide version information from package.json', async () => {
      const packagePath = resolve(process.cwd(), 'package.json');
      const content = await readFile(packagePath, 'utf-8');
      const pkg = JSON.parse(content);

      expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(pkg.version).toBe('1.0.0');
    });
  });

  describe('Configuration Loading', () => {
    it('should be able to use c12 for configuration', async () => {
      const c12 = await import('c12');
      
      // Test basic c12 functionality
      const config = await c12.loadConfig({
        name: 'test',
        defaults: { test: true }
      });

      expect(config).toBeDefined();
      expect(config.config).toBeDefined();
    });
  });

  describe('Template Processing', () => {
    it('should create sample RDF data for testing', async () => {
      const sampleRDF = `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        ex:alice a foaf:Person ;
            foaf:name "Alice Johnson" ;
            foaf:email "alice@example.com" .
      `;

      const rdfFile = resolve(testDir, 'sample.ttl');
      await writeFile(rdfFile, sampleRDF);

      const content = await readFile(rdfFile, 'utf-8');
      expect(content).toContain('foaf:Person');
      expect(content).toContain('Alice Johnson');
    });

    it('should create sample template for testing', async () => {
      const sampleTemplate = `
        // Generated class for {{person.name}}
        export class {{person.name | replace(' ', '')}} {
          constructor() {
            this.name = "{{person.name}}";
            this.email = "{{person.email}}";
          }
        }
      `;

      const templateFile = resolve(testDir, 'template.njk');
      await writeFile(templateFile, sampleTemplate);

      const content = await readFile(templateFile, 'utf-8');
      expect(content).toContain('{{person.name}}');
      expect(content).toContain('export class');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing files gracefully', async () => {
      const nonExistentFile = resolve(testDir, 'does-not-exist.txt');

      await expect(readFile(nonExistentFile, 'utf-8')).rejects.toThrow();
    });

    it('should handle invalid paths gracefully', async () => {
      const invalidPath = '/invalid/path/that/does/not/exist';

      await expect(readFile(invalidPath, 'utf-8')).rejects.toThrow();
    });
  });
});