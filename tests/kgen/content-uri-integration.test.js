/**
 * Content URI Integration Tests
 * 
 * Tests for content:// URI scheme integration with KGEN CAS system:
 * - Content URI resolver functionality
 * - Provenance integration with content URIs
 * - CLI commands for content management
 * - Migration of existing attestations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
import { ContentUriResolver } from '../../src/kgen/cas/content-uri-resolver.js';
import { ContentProvenanceIntegration } from '../../src/kgen/cas/provenance-integration.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('Content URI Integration', () => {
  let tempDir;
  let resolver;
  let integration;

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = await fs.mkdtemp(join(tmpdir(), 'content-uri-test-'));
    
    // Initialize resolver with temp directory
    resolver = new ContentUriResolver({
      casDir: join(tempDir, '.kgen/cas'),
      enableHardlinks: true,
      enableExtensionPreservation: true,
      enableDriftDetection: true
    });
    
    // Initialize integration
    integration = new ContentProvenanceIntegration({
      enableContentURIs: true,
      enableProvenanceLinks: true,
      enableDriftTracking: true,
      resolver: resolver // Use the same resolver instance
    });

    await resolver.initialize();
    await integration.initialize();
  });

  afterEach(async () => {
    // Cleanup temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('ContentUriResolver', () => {
    it('should store and resolve content with correct URI format', async () => {
      const content = 'Hello, content-addressed world!';
      
      // Store content
      const storeResult = await resolver.store(content, {
        algorithm: 'sha256',
        extension: '.txt',
        metadata: { test: true }
      });

      expect(storeResult.uri).toMatch(/^content:\/\/sha256\/[a-f0-9]{64}$/);
      expect(storeResult.stored).toBe(true);
      expect(storeResult.hash).toHaveLength(64);
      expect(storeResult.extension).toBe('.txt');

      // Resolve content
      const resolveResult = await resolver.resolve(storeResult.uri);
      
      expect(resolveResult.uri).toBe(storeResult.uri);
      expect(resolveResult.hash).toBe(storeResult.hash);
      expect(resolveResult.path).toBe(storeResult.path);
      expect(resolveResult.metadata.test).toBe(true);

      // Verify content integrity
      const retrievedContent = await resolver.getContentAsString(storeResult.uri);
      expect(retrievedContent).toBe(content);
    });

    it('should handle file system storage with sharding', async () => {
      const content = Buffer.from('Test content for sharding');
      
      const result = await resolver.store(content, {
        algorithm: 'sha256'
      });

      // Verify sharding (first 2 characters of hash)
      const expectedShard = result.hash.substring(0, 2);
      expect(result.path).toContain(expectedShard);

      // Verify file exists in correct shard directory
      const casPath = join(tempDir, '.kgen/cas', expectedShard, result.hash);
      const fileExists = await fs.access(casPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    });

    it('should detect content drift', async () => {
      const originalContent = 'Original content';
      const modifiedContent = 'Modified content';
      
      // Store original content
      const result = await resolver.store(originalContent);
      
      // Manually modify the stored file to simulate drift
      await fs.writeFile(result.path, modifiedContent);
      
      // Resolve with integrity checking should detect drift
      try {
        await resolver.resolve(result.uri, { allowCorrupted: false });
        expect.fail('Should have detected content drift');
      } catch (error) {
        expect(error.message).toContain('integrity verification failed');
      }

      // Resolve with allowCorrupted should succeed
      const resolveResult = await resolver.resolve(result.uri, { allowCorrupted: true });
      expect(resolveResult.integrity.valid).toBe(false);
    });

    it('should create hardlinks when source provided', async () => {
      const testFile = join(tempDir, 'test-file.txt');
      const content = 'Content for hardlink test';
      
      await fs.writeFile(testFile, content);
      
      const result = await resolver.store(content, {
        source: testFile,
        extension: '.txt'
      });

      expect(result.hardlinked).toBe(true);
      
      // Verify hardlink by checking inode numbers
      const originalStat = await fs.stat(testFile);
      const casStat = await fs.stat(result.path);
      expect(originalStat.ino).toBe(casStat.ino);
    });

    it('should validate URI formats correctly', async () => {
      // Valid URIs
      expect(resolver.validateContentURI('content://sha256/abc123def456')).toEqual({
        valid: false, // Invalid hash length
        error: expect.stringContaining('Invalid hash length')
      });
      
      const validHash = 'a'.repeat(64);
      expect(resolver.validateContentURI(`content://sha256/${validHash}`)).toEqual({
        valid: true,
        parsed: {
          algorithm: 'sha256',
          hash: validHash,
          uri: `content://sha256/${validHash}`
        }
      });

      // Invalid URIs
      expect(resolver.validateContentURI('invalid://sha256/hash')).toEqual({
        valid: false,
        error: expect.stringContaining('Invalid content URI format')
      });

      expect(resolver.validateContentURI('content://invalid/abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890')).toEqual({
        valid: false,
        error: expect.stringContaining('Unsupported hash algorithm')
      });
    });

    it('should list stored content with filtering', async () => {
      // Store multiple files with different extensions
      await resolver.store('JavaScript content', { extension: '.js' });
      await resolver.store('TypeScript content', { extension: '.ts' });
      await resolver.store('Text content', { extension: '.txt' });
      await resolver.store(Buffer.alloc(1024), { extension: '.bin' }); // 1KB file

      // List all content
      const allContent = await resolver.list();
      expect(allContent).toHaveLength(4);

      // Filter by extension
      const jsFiles = await resolver.list({ extension: '.js' });
      expect(jsFiles).toHaveLength(1);
      expect(jsFiles[0].extension).toBe('.js');

      // Filter by minimum size
      const largeFiles = await resolver.list({ minSize: 500 });
      expect(largeFiles).toHaveLength(1);
      expect(largeFiles[0].size).toBeGreaterThan(500);
    });
  });

  describe('ContentProvenanceIntegration', () => {
    it('should generate content attestations with URIs', async () => {
      const testFile = join(tempDir, 'test-artifact.js');
      const content = 'console.log("Generated artifact");';
      await fs.writeFile(testFile, content);

      const operation = {
        operationId: 'test-op-123',
        type: 'template-generation',
        startTime: new Date(this.getDeterministicTimestamp() - 5000),
        endTime: this.getDeterministicDate(),
        agent: { id: 'test-agent', name: 'Test Agent' },
        templateId: 'test-template',
        templateVersion: '1.0.0',
        ruleIds: ['rule1', 'rule2'],
        inputs: [],
        reasoningChain: []
      };

      const artifact = {
        id: 'artifact-123',
        filePath: testFile,
        hash: 'test-hash',
        size: content.length
      };

      const attestation = await integration.generateContentAttestation(operation, artifact);

      expect(attestation['@type']).toBe('ContentAttestation');
      expect(attestation.version).toBe('2.0');
      expect(attestation.subject.contentAddressing).toBeDefined();
      expect(attestation.subject.contentAddressing.uri).toMatch(/^content:\/\/sha256\/[a-f0-9]{64}$/);
      expect(attestation.provenance.contentProvenance).toBeDefined();
      expect(attestation.integrity.contentURI).toBe(attestation.subject.contentAddressing.uri);
      expect(attestation.compliance.frameworks).toContain('KGEN-CAS');
      expect(attestation.contentUriSupport).toBe(true);
    });

    it('should verify content attestations with URI checks', async () => {
      const testFile = join(tempDir, 'verify-test.txt');
      const content = 'Content for verification test';
      await fs.writeFile(testFile, content);

      // Generate attestation
      const operation = {
        operationId: 'verify-op',
        type: 'test-generation',
        startTime: new Date(this.getDeterministicTimestamp() - 1000),
        endTime: this.getDeterministicDate(),
        agent: { id: 'verify-agent', name: 'Verify Agent' },
        inputs: [],
        reasoningChain: []
      };

      const artifact = {
        filePath: testFile,
        hash: 'verify-hash',
        size: content.length
      };

      const attestation = await integration.generateContentAttestation(operation, artifact);

      // Verify attestation
      const verification = await integration.verifyContentAttestation(attestation);

      expect(verification.valid).toBe(true);
      expect(verification.checks.contentIntegrity).toBe(true);
      expect(verification.checks.attestationIntegrity).toBe(true);
      expect(verification.contentURI).toBe(attestation.subject.contentAddressing.uri);
      expect(verification.errors).toHaveLength(0);
    });

    it('should migrate existing attestations to content URIs', async () => {
      // Create test artifact and old-style attestation
      const artifactFile = join(tempDir, 'migrate-test.js');
      const content = '// Test file for migration';
      await fs.writeFile(artifactFile, content);

      const oldAttestation = {
        version: '1.0',
        artifact: {
          path: artifactFile,
          contentHash: 'old-hash',
          size: content.length
        },
        subject: {
          path: artifactFile,
          hash: 'old-hash',
          size: content.length
        },
        generation: {
          templatePath: 'test-template.njk',
          operationId: 'migration-test'
        },
        timestamp: this.getDeterministicDate().toISOString()
      };

      const attestationFile = join(tempDir, 'migrate-test.js.attest.json');
      await fs.writeFile(attestationFile, JSON.stringify(oldAttestation, null, 2));

      // Migrate attestation
      const migrationResult = await integration.migrateAttestationToContentURI(attestationFile);

      expect(migrationResult.migrated).toBe(true);
      expect(migrationResult.contentURI).toMatch(/^content:\/\/sha256\/[a-f0-9]{64}$/);

      // Verify migrated file
      const migratedContent = await fs.readFile(attestationFile, 'utf8');
      const migratedAttestation = JSON.parse(migratedContent);

      expect(migratedAttestation.version).toBe('2.0');
      expect(migratedAttestation.subject.contentAddressing).toBeDefined();
      expect(migratedAttestation.subject.contentAddressing.uri).toBe(migrationResult.contentURI);
      expect(migratedAttestation.integrity.contentURI).toBe(migrationResult.contentURI);
      expect(migratedAttestation.migration).toBeDefined();
      expect(migratedAttestation.migration.contentURIAdded).toBe(true);
    });

    it('should handle drift detection in attestations', async () => {
      const testFile = join(tempDir, 'drift-test.txt');
      const originalContent = 'Original content';
      const modifiedContent = 'Modified content';
      
      await fs.writeFile(testFile, originalContent);

      // Generate attestation with drift detection enabled
      const operation = {
        operationId: 'drift-op',
        type: 'drift-test',
        startTime: new Date(this.getDeterministicTimestamp() - 1000),
        endTime: this.getDeterministicDate(),
        agent: { id: 'drift-agent' },
        inputs: [],
        reasoningChain: []
      };

      const artifact = {
        filePath: testFile,
        hash: 'drift-hash',
        size: originalContent.length
      };

      const attestation = await integration.generateContentAttestation(operation, artifact);

      expect(attestation.driftDetection).toBeDefined();
      expect(attestation.driftDetection.enabled).toBe(true);
      expect(attestation.driftDetection.contentURI).toBe(attestation.subject.contentAddressing.uri);

      // Modify the stored content to simulate drift
      const contentURI = attestation.subject.contentAddressing.uri;
      const resolved = await resolver.resolve(contentURI);
      await fs.writeFile(resolved.path, modifiedContent);

      // Verify should detect drift
      const verification = await integration.verifyContentAttestation(attestation);

      expect(verification.valid).toBe(false);
      expect(verification.errors.some(e => e.includes('drift detected'))).toBe(true);
      expect(verification.details.driftDetection.driftDetected).toBe(true);
    });
  });

  describe('Integration Statistics', () => {
    it('should track usage statistics correctly', async () => {
      // Generate some activity
      await resolver.store('Test content 1');
      await resolver.store('Test content 2');
      await resolver.store('Test content 3');

      const stats = resolver.getStats();

      expect(stats.resolver.stores).toBe(3);
      expect(stats.resolver.resolves).toBe(0);
      expect(stats.cache.contentCacheSize).toBe(3);

      // Resolve some content to generate cache hits
      const content1 = await resolver.store('Test for resolve');
      await resolver.resolve(content1.uri); // Cache hit (stored during store operation)
      await resolver.resolve(content1.uri); // Also cache hit

      const updatedStats = resolver.getStats();
      expect(updatedStats.resolver.resolves).toBe(2);
      expect(updatedStats.resolver.cacheHits).toBe(2); // Both are cache hits
      expect(updatedStats.cache.hitRate).toBe(1.0); // 100% hit rate
    });

    it('should track integration statistics', async () => {
      const testFile = join(tempDir, 'stats-test.txt');
      await fs.writeFile(testFile, 'Stats test content');

      const operation = {
        operationId: 'stats-op',
        type: 'stats-test',
        startTime: new Date(this.getDeterministicTimestamp() - 1000),
        endTime: this.getDeterministicDate(),
        agent: { id: 'stats-agent' },
        inputs: [],
        reasoningChain: []
      };

      const artifact = {
        filePath: testFile,
        size: 18
      };

      await integration.generateContentAttestation(operation, artifact);

      const stats = integration.getStats();

      expect(stats.integration.attestationsWithContentURIs).toBe(1);
      expect(stats.integration.contentItemsStored).toBe(1);
      expect(stats.performance.contentUriUsageRate).toBe(1.0);
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent content URIs gracefully', async () => {
      const nonExistentURI = 'content://sha256/0000000000000000000000000000000000000000000000000000000000000000';

      await expect(resolver.resolve(nonExistentURI)).rejects.toThrow('Content not found');
      
      const exists = await resolver.exists(nonExistentURI);
      expect(exists).toBe(false);
    });

    it('should handle corrupted CAS storage', async () => {
      const content = 'Test content for corruption';
      const result = await resolver.store(content);

      // Corrupt the stored file
      await fs.writeFile(result.path, 'Corrupted content');

      // Should detect corruption during integrity check
      await expect(resolver.resolve(result.uri, { allowCorrupted: false }))
        .rejects.toThrow('integrity verification failed');

      // But should work with allowCorrupted
      const corruptedResult = await resolver.resolve(result.uri, { allowCorrupted: true });
      expect(corruptedResult.integrity.valid).toBe(false);
    });

    it('should handle invalid URI formats', async () => {
      const invalidURIs = [
        'invalid-uri',
        'content://invalid-algorithm/hash',
        'content://sha256/short-hash',
        'content://sha256/',
        'http://example.com/file'
      ];

      for (const uri of invalidURIs) {
        const validation = resolver.validateContentURI(uri);
        expect(validation.valid).toBe(false);
        expect(validation.error).toBeDefined();
      }
    });
  });
});

describe('Content URI CLI Integration', () => {
  // These would be integration tests for the CLI commands
  // Testing the actual CLI would require spawning processes
  
  it('should validate CLI command exports exist', async () => {
    const { contentCommand } = await import('../../src/kgen/cli/content-uri-commands.js');
    
    expect(contentCommand).toBeDefined();
    expect(contentCommand.subCommands).toBeDefined();
    expect(contentCommand.subCommands.store).toBeDefined();
    expect(contentCommand.subCommands.resolve).toBeDefined();
    expect(contentCommand.subCommands.list).toBeDefined();
    expect(contentCommand.subCommands.migrate).toBeDefined();
    expect(contentCommand.subCommands.stats).toBeDefined();
  });
});