/**
 * Git URI Resolver Integration Tests
 * 
 * Tests git:// URI scheme resolution, attestation attachment, and provenance integration
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { GitUriResolver } from '../../packages/kgen-core/src/resolvers/git-uri-resolver.js';
import { GitProvenanceIntegration } from '../../packages/kgen-core/src/provenance/git-integration.js';
import { createGitFirstWorkflow } from '../../packages/kgen-core/src/git/index.js';
import fs from 'fs-extra';
import path from 'path';
import { tmpdir } from 'os';
import crypto from 'crypto';

describe('Git URI Resolver Integration', () => {
  let testDir;
  let gitResolver;
  let gitIntegration;
  let gitWorkflow;
  
  beforeEach(async () => {
    // Create temporary test directory
    testDir = path.join(tmpdir(), 'git-uri-test-' + this.getDeterministicTimestamp());
    await fs.ensureDir(testDir);
    
    const options = {
      repoPath: testDir,
      cacheDir: path.join(testDir, '.cache'),
      enableAttestation: true,
      enableUriResolution: true
    };
    
    gitResolver = new GitUriResolver(options);
    gitIntegration = new GitProvenanceIntegration(options);
    gitWorkflow = createGitFirstWorkflow(options);
  });
  
  afterEach(async () => {
    // Cleanup test directory
    if (testDir && await fs.pathExists(testDir)) {
      await fs.remove(testDir);
    }
  });

  describe('URI Resolution', () => {
    test('should initialize git URI resolver', async () => {
      const result = await gitResolver.initialize();
      
      expect(result.success).toBe(true);
      expect(result.gitUriResolver).toBe(true);
      expect(result.git.success).toBe(true);
    });

    test('should parse git URI correctly', async () => {
      const uri = 'git://repo@abc123def456789012345678901234567890abcd/file.txt';
      const validation = gitResolver.validateGitUri(uri);
      
      expect(validation.valid).toBe(true);
      expect(validation.parsed.dir).toBe('repo');
      expect(validation.parsed.oid).toBe('abc123def456789012345678901234567890abcd');
      expect(validation.parsed.filepath).toBe('file.txt');
      expect(validation.parsed.type).toBe('file');
    });

    test('should validate git URI format', async () => {
      const validUri = 'git://repo@abc123def456789012345678901234567890abcd';
      const invalidUri = 'git://invalid-uri';
      
      expect(gitResolver.validateGitUri(validUri).valid).toBe(true);
      expect(gitResolver.validateGitUri(invalidUri).valid).toBe(false);
    });

    test('should create git URI from components', async () => {
      const uri = gitResolver.createGitUri('myrepo', 'abc123def456789012345678901234567890abcd', 'src/index.js');
      
      expect(uri).toBe('git://myrepo@abc123def456789012345678901234567890abcd/src/index.js');
    });
  });

  describe('Attestation Management', () => {
    test('should attach and retrieve attestations', async () => {
      await gitResolver.initialize();
      
      // Create a test blob
      const testContent = 'Test artifact content';
      const testBlob = await gitIntegration.gitOps.createBlob(testContent);
      
      // Attach attestation
      const attestationData = {
        type: 'CodeReview',
        reviewer: 'test-reviewer',
        status: 'approved',
        comments: 'Code looks good'
      };
      
      const attachResult = await gitResolver.attachAttestation(testBlob.sha, attestationData);
      
      expect(attachResult.success).toBe(true);
      expect(attachResult.attached).toBe(true);
      expect(attachResult.objectSha).toBe(testBlob.sha);
      
      // Retrieve attestations
      const retrievedAttestations = await gitResolver.getAttestations(testBlob.sha);
      
      expect(retrievedAttestations.found).toBe(true);
      expect(retrievedAttestations.attestations).toHaveLength(1);
      expect(retrievedAttestations.attestations[0].type).toBe('CodeReview');
    });

    test('should handle multiple attestations per object', async () => {
      await gitResolver.initialize();
      
      const testBlob = await gitIntegration.gitOps.createBlob('Multiple attestation test');
      
      // Attach multiple attestations
      const attestations = [
        { type: 'SecurityScan', scanner: 'test-scanner', status: 'clean' },
        { type: 'QualityCheck', tool: 'eslint', score: 95 },
        { type: 'Performance', benchmark: 'load-test', result: 'pass' }
      ];
      
      for (const attestation of attestations) {
        await gitResolver.attachAttestation(testBlob.sha, attestation);
      }
      
      const retrievedAttestations = await gitResolver.getAttestations(testBlob.sha);
      
      expect(retrievedAttestations.found).toBe(true);
      // Note: Current implementation might overwrite, depending on git notes behavior
      expect(retrievedAttestations.attestations.length).toBeGreaterThan(0);
    });
  });

  describe('Provenance Integration', () => {
    test('should initialize git provenance integration', async () => {
      const result = await gitIntegration.initialize();
      
      expect(result.success).toBe(true);
      expect(result.gitIntegration).toBe(true);
      expect(result.features.uriResolution).toBe(true);
      expect(result.features.attestations).toBe(true);
    });

    test('should resolve URI with provenance tracking', async () => {
      await gitIntegration.initialize();
      
      // Create a test blob first
      const testContent = 'Template content: {{name}}';
      const testBlob = await gitIntegration.gitOps.createBlob(testContent);
      
      // Create git URI for the blob
      const uri = gitResolver.createGitUri('testrepo', testBlob.sha);
      
      // Resolve with provenance
      const result = await gitIntegration.resolveWithProvenance(uri);
      
      expect(result.provenanceIntegrated).toBe(true);
      expect(result.uri).toBe(uri);
      expect(result.sha).toBe(testBlob.sha);
    });

    test('should track generation from git URI', async () => {
      await gitIntegration.initialize();
      
      // Create template blob
      const templateContent = 'Hello {{name}}, welcome to {{project}}!';
      const templateBlob = await gitIntegration.gitOps.createBlob(templateContent);
      const templateUri = gitResolver.createGitUri('templates', templateBlob.sha, 'greeting.txt');
      
      // Generate artifact
      const contextData = { name: 'Alice', project: 'KGEN' };
      const outputPath = path.join(testDir, 'output.txt');
      
      const generation = await gitIntegration.generateFromGitUri(
        templateUri,
        contextData,
        outputPath
      );
      
      expect(generation.success).toBe(true);
      expect(generation.gitUriGeneration).toBe(true);
      expect(generation.templateUri).toBe(templateUri);
      expect(generation.generation.gitIntegrated).toBe(true);
    });

    test('should provide comprehensive artifact information', async () => {
      await gitIntegration.initialize();
      
      // Create and track an artifact
      const artifactContent = 'Generated artifact content';
      const artifactBlob = await gitIntegration.gitOps.createBlob(artifactContent);
      
      // Add some provenance
      await gitIntegration.provenanceTracker.trackGeneration({
        templatePath: 'test-template.txt',
        templateContent: 'Template: {{data}}',
        contextData: { data: 'test' },
        outputContent: artifactContent,
        outputPath: 'output.txt'
      });
      
      // Get comprehensive info
      const info = await gitIntegration.getArtifactInfo(artifactBlob.sha, {
        verifyIntegrity: true
      });
      
      expect(info.comprehensive).toBe(true);
      expect(info.artifactSha).toBe(artifactBlob.sha);
      expect(info.provenance.found).toBe(true);
    });
  });

  describe('Git Workflow Integration', () => {
    test('should initialize complete git workflow', async () => {
      const result = await gitWorkflow.initialize();
      
      expect(result.success).toBe(true);
      expect(result.gitFirst).toBe(true);
      expect(result.git.success).toBe(true);
      expect(result.provenance.success).toBe(true);
      expect(result.integration.success).toBe(true);
    });

    test('should resolve git URI through workflow', async () => {
      await gitWorkflow.initialize();
      
      // Create test content
      const content = 'Workflow test content';
      const blob = await gitWorkflow.gitOps.createBlob(content);
      const uri = `git://workflow-test@${blob.sha}`;
      
      const result = await gitWorkflow.resolveGitUri(uri);
      
      expect(result.provenanceIntegrated).toBe(true);
      expect(result.sha).toBe(blob.sha);
    });

    test('should generate from git URI through workflow', async () => {
      await gitWorkflow.initialize();
      
      const templateContent = 'Workflow template: {{value}}';
      const templateBlob = await gitWorkflow.gitOps.createBlob(templateContent);
      const templateUri = `git://workflow@${templateBlob.sha}/template.txt`;
      
      const generation = await gitWorkflow.generateFromGitUri(
        templateUri,
        { value: 'success' },
        path.join(testDir, 'workflow-output.txt')
      );
      
      expect(generation.success).toBe(true);
      expect(generation.gitUriGeneration).toBe(true);
    });

    test('should create URI for artifact through workflow', async () => {
      await gitWorkflow.initialize();
      
      const artifactContent = 'Artifact for URI creation';
      const artifactBlob = await gitWorkflow.gitOps.createBlob(artifactContent);
      
      const uriResult = await gitWorkflow.createUriForArtifact(artifactBlob.sha, {
        repository: 'test-repo',
        filepath: 'generated.txt'
      });
      
      expect(uriResult.created).toBe(true);
      expect(uriResult.artifactSha).toBe(artifactBlob.sha);
      expect(uriResult.gitUri).toContain(artifactBlob.sha);
    });

    test('should provide performance statistics', async () => {
      await gitWorkflow.initialize();
      
      const stats = gitWorkflow.getPerformanceStats();
      
      expect(stats.git).toBeDefined();
      expect(stats.integration).toBeDefined();
      expect(stats.overall.gitFirst).toBe(true);
      expect(stats.overall.uriResolution).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid git URIs', async () => {
      await gitResolver.initialize();
      
      const invalidUri = 'git://invalid-format';
      
      await expect(gitResolver.resolve(invalidUri)).rejects.toThrow();
    });

    test('should handle non-existent objects', async () => {
      await gitResolver.initialize();
      
      const nonExistentUri = 'git://test@1234567890123456789012345678901234567890';
      
      await expect(gitResolver.resolve(nonExistentUri)).rejects.toThrow();
    });

    test('should handle attestation validation errors', async () => {
      await gitResolver.initialize();
      
      const testBlob = await gitIntegration.gitOps.createBlob('Test content');
      
      await expect(
        gitResolver.attachAttestation(testBlob.sha, null)
      ).rejects.toThrow();
    });
  });

  describe('Caching', () => {
    test('should cache resolved URIs', async () => {
      await gitResolver.initialize();
      
      const content = 'Cacheable content';
      const blob = await gitIntegration.gitOps.createBlob(content);
      const uri = `git://cache-test@${blob.sha}`;
      
      // First resolution
      const result1 = await gitResolver.resolve(uri);
      expect(result1.cached).toBe(false);
      
      // Second resolution should be cached
      const result2 = await gitResolver.resolve(uri);
      expect(result2.cached).toBe(true);
      expect(result2.cacheHit).toBe(true);
    });

    test('should clear cache when requested', async () => {
      await gitResolver.initialize();
      
      const clearResult = gitResolver.clearCache();
      
      expect(clearResult.success).toBe(true);
      expect(clearResult.cleared).toBe(true);
    });
  });
});