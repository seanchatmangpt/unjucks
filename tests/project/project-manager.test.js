/**
 * Tests for ProjectManager - Main project command interface
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { ProjectManager } from '../../packages/kgen-core/src/project/index.js';

describe('ProjectManager', () => {
  let projectManager;
  let tempDir;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'project-test-'));
    
    projectManager = new ProjectManager({
      projectRoot: tempDir,
      lockfileName: 'test.lock.json',
      lockfileConfig: {
        hashAlgorithm: 'sha256'
      },
      bundlerConfig: {
        signBundle: false,
        encryptBundle: false
      },
      versionConfig: {
        registryPath: path.join(tempDir, 'registry.json')
      },
      verifierConfig: {
        timeoutMs: 10000
      }
    });
  });

  afterEach(async () => {
    // Cleanup temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('initialization', () => {
    it('should initialize project manager successfully', async () => {
      const result = await projectManager.initialize();

      expect(result.status).toBe('success');
      expect(result.components).toContain('lockfileGenerator');
      expect(result.components).toContain('attestationBundler');
      expect(result.components).toContain('versionManager');
      expect(result.components).toContain('reproducibilityVerifier');
      expect(projectManager.initialized).toBe(true);
    });

    it('should handle initialization errors gracefully', async () => {
      // Mock version manager to fail initialization
      projectManager.versionManager.initialize = vi.fn().mockRejectedValue(new Error('Init failed'));

      await expect(projectManager.initialize()).rejects.toThrow('Init failed');
      expect(projectManager.initialized).toBe(false);
    });
  });

  describe('lock command', () => {
    it('should generate lockfile successfully', async () => {
      const options = {
        projectName: 'test-project',
        projectVersion: '1.0.0',
        templates: [
          {
            id: 'template-1',
            version: '1.0.0',
            content: 'template content'
          }
        ]
      };

      const result = await projectManager.lock(options);

      expect(result.command).toBe('lock');
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('lockfilePath');
      expect(result).toHaveProperty('lockfile');
      expect(result.lockfile.templates).toHaveProperty('template-1');

      // Verify lockfile was written to disk
      const lockfileExists = await fs.access(result.lockfilePath).then(() => true).catch(() => false);
      expect(lockfileExists).toBe(true);
    });

    it('should auto-initialize if not initialized', async () => {
      expect(projectManager.initialized).toBe(false);

      const options = {
        projectName: 'test-project'
      };

      const result = await projectManager.lock(options);

      expect(projectManager.initialized).toBe(true);
      expect(result.success).toBe(true);
    });

    it('should use custom output path when specified', async () => {
      const customPath = path.join(tempDir, 'custom-lockfile.json');
      const options = {
        projectName: 'test-project',
        output: customPath
      };

      const result = await projectManager.lock(options);

      expect(result.lockfilePath).toBe(customPath);
      
      const fileExists = await fs.access(customPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    });
  });

  describe('attest command', () => {
    it('should create attestation bundle successfully', async () => {
      // Create test artifacts
      const artifact1 = path.join(tempDir, 'artifact1.js');
      const artifact2 = path.join(tempDir, 'artifact2.json');
      
      await fs.writeFile(artifact1, 'console.log("artifact 1");');
      await fs.writeFile(artifact2, JSON.stringify({ test: 'data' }));

      // Create attestation files
      const attestation1 = { artifactPath: artifact1, artifactHash: 'hash1' };
      const attestation2 = { artifactPath: artifact2, artifactHash: 'hash2' };
      
      await fs.writeFile(`${artifact1}.attest.json`, JSON.stringify(attestation1));
      await fs.writeFile(`${artifact2}.attest.json`, JSON.stringify(attestation2));

      // Mock the bundle creation since we can't test actual archiving easily
      projectManager.attestationBundler.createAttestationBundle = vi.fn().mockResolvedValue({
        bundleId: 'test-bundle',
        bundlePath: '/path/to/bundle.zip',
        bundleHash: 'bundle-hash',
        signature: null,
        manifest: { bundleId: 'test-bundle' },
        size: 1024,
        createdAt: new Date().toISOString()
      });

      const options = {
        paths: [artifact1, artifact2],
        purpose: 'testing',
        description: 'Test attestation bundle',
        user: 'test-user'
      };

      const result = await projectManager.attest(options);

      expect(result.command).toBe('attest');
      expect(result.success).toBe(true);
      expect(result.bundleId).toBe('test-bundle');
      expect(result.bundlePath).toBe('/path/to/bundle.zip');
      expect(result).toHaveProperty('bundleHash');
      expect(result).toHaveProperty('manifest');
    });

    it('should handle attestation with custom options', async () => {
      projectManager.attestationBundler.createAttestationBundle = vi.fn().mockResolvedValue({
        bundleId: 'custom-bundle',
        bundlePath: '/path/to/custom-bundle.zip',
        bundleHash: 'custom-hash',
        manifest: { purpose: 'custom-purpose' },
        size: 2048,
        createdAt: new Date().toISOString()
      });

      const options = {
        bundleId: 'custom-bundle',
        purpose: 'custom-purpose',
        description: 'Custom bundle description',
        framework: 'GDPR',
        standards: ['ISO-27001'],
        includeProvenance: true,
        user: 'custom-user'
      };

      const result = await projectManager.attest(options);

      expect(result.bundleId).toBe('custom-bundle');
      expect(result.manifest.purpose).toBe('custom-purpose');
    });
  });

  describe('verify command', () => {
    it('should verify build reproducibility', async () => {
      // Create a mock lockfile
      const lockfilePath = path.join(tempDir, 'test.lock.json');
      const lockfile = {
        lockfileVersion: '1.0.0',
        projectName: 'test-project',
        templates: {},
        rules: {}
      };
      await fs.writeFile(lockfilePath, JSON.stringify(lockfile, null, 2));

      // Mock the verification result
      const mockVerification = {
        verificationId: 'test-verification',
        reproducible: true,
        confidence: 1.0,
        totalBuilds: 2,
        successfulBuilds: 2,
        identicalBuilds: 2,
        issues: [],
        warnings: []
      };

      projectManager.reproducibilityVerifier.verifyReproducibility = vi.fn().mockResolvedValue(mockVerification);

      const options = {
        type: 'build',
        lockfile: lockfilePath,
        command: 'test-build'
      };

      const result = await projectManager.verify(options);

      expect(result.command).toBe('verify');
      expect(result.type).toBe('build');
      expect(result.success).toBe(true);
      expect(result.verification.reproducible).toBe(true);
      expect(result.verification.confidence).toBe(1.0);
    });

    it('should verify artifact reproducibility', async () => {
      const artifactPath = path.join(tempDir, 'test-artifact.js');
      const attestationPath = `${artifactPath}.attest.json`;
      
      await fs.writeFile(artifactPath, 'console.log("test");');
      
      const attestation = {
        artifactPath,
        artifactHash: 'test-hash',
        templateId: 'template-1'
      };
      await fs.writeFile(attestationPath, JSON.stringify(attestation));

      const mockVerification = {
        artifactPath,
        reproducible: true,
        hashMatch: true,
        contentMatch: true
      };

      projectManager.reproducibilityVerifier.verifyArtifactReproducibility = vi.fn().mockResolvedValue(mockVerification);

      const options = {
        type: 'artifact',
        artifact: artifactPath
      };

      const result = await projectManager.verify(options);

      expect(result.type).toBe('artifact');
      expect(result.verification.reproducible).toBe(true);
    });

    it('should verify bundle integrity', async () => {
      const bundlePath = path.join(tempDir, 'test-bundle.zip');
      
      const mockVerification = {
        bundlePath,
        valid: true,
        issues: [],
        warnings: []
      };

      projectManager.attestationBundler.verifyAttestationBundle = vi.fn().mockResolvedValue(mockVerification);

      const options = {
        type: 'bundle',
        bundle: bundlePath
      };

      const result = await projectManager.verify(options);

      expect(result.type).toBe('bundle');
      expect(result.verification.valid).toBe(true);
    });

    it('should verify lockfile determinism', async () => {
      const lockfilePath = path.join(tempDir, 'test.lock.json');
      
      const mockVerification = {
        lockfilePath,
        deterministic: true,
        identical: true,
        differences: []
      };

      projectManager.reproducibilityVerifier.verifyLockfileDeterminism = vi.fn().mockResolvedValue(mockVerification);

      const options = {
        type: 'lockfile',
        lockfile: lockfilePath
      };

      const result = await projectManager.verify(options);

      expect(result.type).toBe('lockfile');
      expect(result.verification.deterministic).toBe(true);
    });

    it('should throw error for unknown verification type', async () => {
      const options = {
        type: 'unknown'
      };

      await expect(projectManager.verify(options)).rejects.toThrow('Unknown verification type: unknown');
    });
  });

  describe('version command', () => {
    it('should list component versions', async () => {
      const options = {
        action: 'list',
        component: 'template-1'
      };

      const mockHistory = [
        { version: '1.0.0', registeredAt: '2023-01-01T00:00:00.000Z' },
        { version: '1.1.0', registeredAt: '2023-02-01T00:00:00.000Z' }
      ];

      projectManager.versionManager.getVersionHistory = vi.fn().mockReturnValue(mockHistory);
      projectManager.versionManager.getLatestVersion = vi.fn().mockReturnValue('1.1.0');

      const result = await projectManager.version(options);

      expect(result.command).toBe('version');
      expect(result.action).toBe('list');
      expect(result.componentId).toBe('template-1');
      expect(result.latest).toBe('1.1.0');
      expect(result.history).toHaveLength(2);
    });

    it('should register component version', async () => {
      const options = {
        action: 'register',
        componentType: 'template',
        componentInfo: {
          id: 'new-template',
          version: '1.0.0',
          name: 'New Template',
          content: 'template content'
        }
      };

      const mockRegistration = {
        id: 'new-template',
        version: '1.0.0',
        templateKey: 'new-template@1.0.0'
      };

      projectManager.versionManager.registerTemplate = vi.fn().mockResolvedValue(mockRegistration);

      const result = await projectManager.version(options);

      expect(result.action).toBe('register');
      expect(result.componentType).toBe('template');
      expect(result.registrationResult.id).toBe('new-template');
    });

    it('should resolve component versions', async () => {
      const options = {
        action: 'resolve',
        constraints: {
          templates: {
            'template-1': '^1.0.0',
            'template-2': '>=2.0.0'
          }
        }
      };

      const mockResolution = {
        templates: {
          'template-1': '1.2.0',
          'template-2': '2.1.0'
        },
        rules: {},
        schemas: {},
        conflicts: [],
        warnings: []
      };

      projectManager.versionManager.resolveVersions = vi.fn().mockResolvedValue(mockResolution);

      const result = await projectManager.version(options);

      expect(result.action).toBe('resolve');
      expect(result.resolution.templates).toHaveProperty('template-1', '1.2.0');
      expect(result.resolution.templates).toHaveProperty('template-2', '2.1.0');
    });

    it('should get upgrade path', async () => {
      const options = {
        action: 'upgrade',
        componentId: 'template-1',
        fromVersion: '1.0.0',
        toVersion: '2.0.0'
      };

      const mockUpgradePath = {
        componentId: 'template-1',
        fromVersion: '1.0.0',
        targetVersion: '2.0.0',
        path: ['1.0.0', '1.1.0', '2.0.0'],
        breakingChanges: [],
        estimatedEffort: 'medium'
      };

      projectManager.versionManager.getUpgradePath = vi.fn().mockResolvedValue(mockUpgradePath);

      const result = await projectManager.version(options);

      expect(result.action).toBe('upgrade');
      expect(result.upgradePath.componentId).toBe('template-1');
      expect(result.upgradePath.path).toHaveLength(3);
    });

    it('should check version compatibility', async () => {
      const options = {
        action: 'check',
        components: {
          'template-1': '1.0.0',
          'rule-1': '2.0.0'
        }
      };

      const mockCompatibility = {
        compatible: true,
        issues: [],
        warnings: [],
        matrix: {}
      };

      projectManager.versionManager.checkCompatibility = vi.fn().mockResolvedValue(mockCompatibility);

      const result = await projectManager.version(options);

      expect(result.action).toBe('check');
      expect(result.compatibility.compatible).toBe(true);
    });

    it('should throw error for unknown version action', async () => {
      const options = {
        action: 'unknown'
      };

      await expect(projectManager.version(options)).rejects.toThrow('Unknown version action: unknown');
    });
  });

  describe('status and configuration', () => {
    it('should return project status', () => {
      const status = projectManager.getStatus();

      expect(status).toHaveProperty('initialized');
      expect(status).toHaveProperty('projectRoot', tempDir);
      expect(status).toHaveProperty('lockfileName', 'test.lock.json');
      expect(status).toHaveProperty('components');
      expect(status.components).toHaveProperty('lockfileGenerator', 'ready');
      expect(status.components).toHaveProperty('attestationBundler', 'ready');
      expect(status.components).toHaveProperty('reproducibilityVerifier', 'ready');
    });

    it('should handle different configuration options', () => {
      const customManager = new ProjectManager({
        projectRoot: '/custom/path',
        lockfileName: 'custom.lock.json',
        attestationDir: './custom-attestations'
      });

      const status = customManager.getStatus();

      expect(status.projectRoot).toBe('/custom/path');
      expect(status.lockfileName).toBe('custom.lock.json');
    });
  });

  describe('error handling', () => {
    it('should handle lock command errors', async () => {
      projectManager.lockfileGenerator.generateLockfile = vi.fn().mockRejectedValue(new Error('Lockfile generation failed'));

      const options = {
        projectName: 'test-project'
      };

      await expect(projectManager.lock(options)).rejects.toThrow('Lockfile generation failed');
    });

    it('should handle attestation command errors', async () => {
      projectManager.attestationBundler.createAttestationBundle = vi.fn().mockRejectedValue(new Error('Bundle creation failed'));

      const options = {
        paths: ['/nonexistent/file.js']
      };

      await expect(projectManager.attest(options)).rejects.toThrow('Bundle creation failed');
    });

    it('should handle verification command errors', async () => {
      projectManager.reproducibilityVerifier.verifyReproducibility = vi.fn().mockRejectedValue(new Error('Verification failed'));

      const options = {
        type: 'build',
        lockfile: '/nonexistent/lockfile.json'
      };

      await expect(projectManager.verify(options)).rejects.toThrow('Verification failed');
    });
  });

  describe('private method functionality', () => {
    it('should gather project context correctly', async () => {
      const options = {
        projectName: 'test-project',
        projectVersion: '1.0.0',
        templates: [{ id: 'template-1', version: '1.0.0' }],
        rules: [{ id: 'rule-1', version: '1.0.0' }]
      };

      const context = await projectManager['_gatherProjectContext'](options);

      expect(context.projectName).toBe('test-project');
      expect(context.projectVersion).toBe('1.0.0');
      expect(context.usedTemplates).toHaveLength(1);
      expect(context.usedRules).toHaveLength(1);
      expect(context).toHaveProperty('environmentVariables');
    });

    it('should gather environment variables correctly', () => {
      // Set some test environment variables
      process.env.NODE_VERSION = 'v18.0.0';
      process.env.NODE_ENV = 'test';

      const envVars = projectManager['_gatherEnvironmentVariables']({});

      expect(envVars).toHaveProperty('NODE_VERSION', 'v18.0.0');
      expect(envVars).toHaveProperty('NODE_ENV', 'test');
    });

    it('should discover artifacts when requested', async () => {
      const options = {
        discover: true,
        patterns: ['**/*.js']
      };

      // Mock artifact discovery (returns empty for now)
      const artifacts = await projectManager['_discoverArtifacts'](options);

      expect(Array.isArray(artifacts)).toBe(true);
    });
  });
});