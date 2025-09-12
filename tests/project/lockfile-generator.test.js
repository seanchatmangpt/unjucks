/**
 * Tests for LockfileGenerator - Deterministic lockfile generation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { LockfileGenerator } from '../../packages/kgen-core/src/project/lockfile-generator.js';

describe('LockfileGenerator', () => {
  let generator;
  let tempDir;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lockfile-test-'));
    
    generator = new LockfileGenerator({
      lockfileName: 'test-lock.json',
      hashAlgorithm: 'sha256',
      sortDependencies: true
    });
  });

  afterEach(async () => {
    // Cleanup temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('generateLockfile', () => {
    it('should generate a deterministic lockfile', async () => {
      const projectContext = {
        projectName: 'test-project',
        projectVersion: '1.0.0',
        engineVersion: '1.0.0',
        usedTemplates: [
          {
            id: 'template-1',
            version: '1.0.0',
            name: 'Test Template',
            content: 'template content',
            dependencies: []
          }
        ],
        usedRules: [
          {
            id: 'rule-1',
            version: '1.0.0',
            name: 'Test Rule',
            type: 'validation',
            content: 'rule content'
          }
        ]
      };

      const lockfile = await generator.generateLockfile(projectContext);

      expect(lockfile).toHaveProperty('lockfileVersion');
      expect(lockfile).toHaveProperty('generatedAt');
      expect(lockfile).toHaveProperty('projectName', 'test-project');
      expect(lockfile).toHaveProperty('templates');
      expect(lockfile).toHaveProperty('rules');
      expect(lockfile).toHaveProperty('integrityHashes');
      expect(lockfile).toHaveProperty('lockfileHash');
      
      // Check template was locked correctly
      expect(lockfile.templates).toHaveProperty('template-1');
      expect(lockfile.templates['template-1']).toHaveProperty('version', '1.0.0');
      expect(lockfile.templates['template-1']).toHaveProperty('hash');
      
      // Check rule was locked correctly  
      expect(lockfile.rules).toHaveProperty('rule-1');
      expect(lockfile.rules['rule-1']).toHaveProperty('version', '1.0.0');
      expect(lockfile.rules['rule-1']).toHaveProperty('type', 'validation');
    });

    it('should generate identical lockfiles for same input', async () => {
      const projectContext = {
        projectName: 'test-project',
        projectVersion: '1.0.0',
        usedTemplates: [
          {
            id: 'template-1',
            version: '1.0.0',
            content: 'template content'
          }
        ]
      };

      const lockfile1 = await generator.generateLockfile(projectContext);
      const lockfile2 = await generator.generateLockfile(projectContext);

      // Remove timestamps for comparison
      delete lockfile1.generatedAt;
      delete lockfile2.generatedAt;

      expect(lockfile1).toEqual(lockfile2);
      expect(lockfile1.lockfileHash).toBe(lockfile2.lockfileHash);
    });

    it('should handle empty project context', async () => {
      const projectContext = {
        projectName: 'empty-project'
      };

      const lockfile = await generator.generateLockfile(projectContext);

      expect(lockfile).toHaveProperty('lockfileVersion');
      expect(lockfile.templates).toEqual({});
      expect(lockfile.rules).toEqual({});
      expect(lockfile.schemas).toEqual({});
    });
  });

  describe('validateLockfile', () => {
    it('should validate a valid lockfile', async () => {
      const validLockfile = {
        lockfileVersion: '1.0.0',
        generatedAt: this.getDeterministicDate().toISOString(),
        projectName: 'test-project',
        templates: {},
        rules: {},
        engine: { version: '1.0.0' },
        integrityHashes: {}
      };

      const projectContext = {
        projectName: 'test-project'
      };

      const validation = await generator.validateLockfile(validLockfile, projectContext);

      expect(validation.valid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should detect invalid lockfile structure', async () => {
      const invalidLockfile = {
        // Missing required fields
        projectName: 'test-project'
      };

      const projectContext = {
        projectName: 'test-project'
      };

      const validation = await generator.validateLockfile(invalidLockfile, projectContext);

      expect(validation.valid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
      expect(validation.issues.some(issue => issue.includes('Missing required field'))).toBe(true);
    });

    it('should detect version incompatibility', async () => {
      const incompatibleLockfile = {
        lockfileVersion: '0.9.0', // Incompatible version
        generatedAt: this.getDeterministicDate().toISOString(),
        projectName: 'test-project',
        templates: {},
        rules: {},
        engine: { version: '1.0.0' },
        integrityHashes: {}
      };

      const projectContext = {
        projectName: 'test-project'
      };

      const validation = await generator.validateLockfile(incompatibleLockfile, projectContext);

      expect(validation.valid).toBe(false);
      expect(validation.issues.some(issue => issue.includes('Incompatible lockfile version'))).toBe(true);
    });
  });

  describe('writeLockfile', () => {
    it('should write lockfile to disk', async () => {
      const lockfile = {
        lockfileVersion: '1.0.0',
        generatedAt: this.getDeterministicDate().toISOString(),
        projectName: 'test-project'
      };

      const outputPath = path.join(tempDir, 'test-lockfile.json');
      const writtenPath = await generator.writeLockfile(lockfile, outputPath);

      expect(writtenPath).toBe(outputPath);
      
      // Verify file was written
      const fileExists = await fs.access(outputPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
      
      // Verify content is correct
      const writtenContent = await fs.readFile(outputPath, 'utf8');
      const parsedContent = JSON.parse(writtenContent);
      expect(parsedContent.projectName).toBe('test-project');
    });
  });

  describe('readLockfile', () => {
    it('should read and parse lockfile from disk', async () => {
      const originalLockfile = {
        lockfileVersion: '1.0.0',
        generatedAt: this.getDeterministicDate().toISOString(),
        projectName: 'test-project',
        templates: {},
        rules: {},
        engine: { version: '1.0.0' }
      };

      const lockfilePath = path.join(tempDir, 'test-read-lockfile.json');
      await fs.writeFile(lockfilePath, JSON.stringify(originalLockfile, null, 2));

      const readLockfile = await generator.readLockfile(lockfilePath);

      expect(readLockfile.projectName).toBe('test-project');
      expect(readLockfile.lockfileVersion).toBe('1.0.0');
    });

    it('should throw error for invalid lockfile structure', async () => {
      const invalidLockfile = {
        // Missing required fields
        projectName: 'test-project'
      };

      const lockfilePath = path.join(tempDir, 'invalid-lockfile.json');
      await fs.writeFile(lockfilePath, JSON.stringify(invalidLockfile, null, 2));

      await expect(generator.readLockfile(lockfilePath)).rejects.toThrow('Invalid lockfile structure');
    });
  });

  describe('updateLockfile', () => {
    it('should update lockfile with new template', async () => {
      const originalLockfile = {
        lockfileVersion: '1.0.0',
        generatedAt: this.getDeterministicDate().toISOString(),
        templates: {
          'template-1': {
            id: 'template-1',
            version: '1.0.0',
            hash: 'hash1'
          }
        },
        rules: {},
        integrityHashes: {
          templates: 'original-hash'
        }
      };

      const updates = {
        templates: {
          'template-2': {
            action: 'add',
            template: {
              id: 'template-2',
              version: '1.0.0',
              hash: 'hash2'
            }
          }
        }
      };

      const updatedLockfile = await generator.updateLockfile(originalLockfile, updates);

      expect(updatedLockfile).toHaveProperty('updatedAt');
      expect(updatedLockfile).toHaveProperty('previousHash');
      expect(updatedLockfile.templates).toHaveProperty('template-1');
      expect(updatedLockfile.templates).toHaveProperty('template-2');
      expect(updatedLockfile.templates['template-2'].id).toBe('template-2');
      
      // Hash should be updated
      expect(updatedLockfile.integrityHashes.templates).not.toBe('original-hash');
    });

    it('should remove template from lockfile', async () => {
      const originalLockfile = {
        lockfileVersion: '1.0.0',
        templates: {
          'template-1': { id: 'template-1', version: '1.0.0' },
          'template-2': { id: 'template-2', version: '1.0.0' }
        },
        rules: {},
        integrityHashes: {}
      };

      const updates = {
        templates: {
          'template-2': {
            action: 'remove'
          }
        }
      };

      const updatedLockfile = await generator.updateLockfile(originalLockfile, updates);

      expect(updatedLockfile.templates).toHaveProperty('template-1');
      expect(updatedLockfile.templates).not.toHaveProperty('template-2');
    });
  });

  describe('integrity verification', () => {
    it('should maintain integrity hashes correctly', async () => {
      const projectContext = {
        projectName: 'test-project',
        usedTemplates: [
          {
            id: 'template-1',
            version: '1.0.0',
            content: 'template content'
          }
        ]
      };

      const lockfile = await generator.generateLockfile(projectContext);

      // Verify integrity hashes exist
      expect(lockfile.integrityHashes).toHaveProperty('templates');
      expect(typeof lockfile.integrityHashes.templates).toBe('string');
      expect(lockfile.integrityHashes.templates).toHaveLength(64); // SHA256 hex length
    });

    it('should detect integrity hash changes', async () => {
      const lockfile = {
        lockfileVersion: '1.0.0',
        templates: { 'template-1': { id: 'template-1', version: '1.0.0' } },
        rules: {},
        integrityHashes: {
          templates: 'incorrect-hash'
        }
      };

      const validation = await generator['_validateIntegrityHashes'](lockfile);

      expect(validation.valid).toBe(false);
      expect(validation.issues.some(issue => issue.includes('Integrity hash mismatch'))).toBe(true);
    });
  });

  describe('version resolution', () => {
    it('should handle dependency sorting when enabled', async () => {
      const sortingGenerator = new LockfileGenerator({
        sortDependencies: true
      });

      const projectContext = {
        projectName: 'test-project',
        usedTemplates: [
          { id: 'z-template', version: '1.0.0' },
          { id: 'a-template', version: '1.0.0' },
          { id: 'm-template', version: '1.0.0' }
        ]
      };

      const lockfile = await sortingGenerator.generateLockfile(projectContext);
      const templateKeys = Object.keys(lockfile.templates);

      // Should be sorted alphabetically
      expect(templateKeys).toEqual(['a-template', 'm-template', 'z-template']);
    });
  });
});