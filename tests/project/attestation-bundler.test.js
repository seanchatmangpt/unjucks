/**
 * Tests for AttestationBundler - Attestation package creation and verification
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { AttestationBundler } from '../../packages/kgen-core/src/project/attestation-bundler.js';

// Mock external dependencies
vi.mock('archiver', () => ({
  default: vi.fn(() => ({
    pipe: vi.fn(),
    directory: vi.fn(),
    finalize: vi.fn()
  }))
}));

vi.mock('node-stream-zip', () => ({
  default: {
    async: vi.fn()
  }
}));

describe('AttestationBundler', () => {
  let bundler;
  let tempDir;
  let testArtifacts;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bundle-test-'));
    
    bundler = new AttestationBundler({
      bundleFormat: 'zip',
      compressionLevel: 6,
      signBundle: false,
      encryptBundle: false
    });

    // Create test artifacts
    testArtifacts = await createTestArtifacts(tempDir);
  });

  afterEach(async () => {
    // Cleanup temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function createTestArtifacts(dir) {
    const artifacts = [];
    
    // Create test files
    const file1Path = path.join(dir, 'test-file-1.js');
    const file1Content = 'console.log("test file 1");';
    await fs.writeFile(file1Path, file1Content);
    
    const file2Path = path.join(dir, 'test-file-2.json');
    const file2Content = JSON.stringify({ test: 'data' }, null, 2);
    await fs.writeFile(file2Path, file2Content);

    artifacts.push(file1Path, file2Path);

    // Create attestation files
    const attestation1 = {
      artifactPath: file1Path,
      artifactHash: 'hash1',
      generatedAt: this.getDeterministicDate().toISOString(),
      templateId: 'template-1',
      operationId: 'op-1'
    };
    
    const attestation1Path = `${file1Path}.attest.json`;
    await fs.writeFile(attestation1Path, JSON.stringify(attestation1, null, 2));

    const attestation2 = {
      artifactPath: file2Path,
      artifactHash: 'hash2',
      generatedAt: this.getDeterministicDate().toISOString(),
      templateId: 'template-2',
      operationId: 'op-2'
    };
    
    const attestation2Path = `${file2Path}.attest.json`;
    await fs.writeFile(attestation2Path, JSON.stringify(attestation2, null, 2));

    return artifacts;
  }

  describe('createAttestationBundle', () => {
    it('should create attestation bundle with all artifacts', async () => {
      const bundleRequest = {
        bundleId: 'test-bundle-1',
        purpose: 'testing',
        description: 'Test bundle creation',
        artifactPaths: testArtifacts,
        createdBy: 'test-user'
      };

      // Mock the actual archive creation since we can't test real archiving easily
      bundler['_createBundleArchive'] = vi.fn().mockResolvedValue('/path/to/bundle.zip');
      bundler['_calculateFileHash'] = vi.fn().mockResolvedValue('bundle-hash');

      const result = await bundler.createAttestationBundle(bundleRequest);

      expect(result).toHaveProperty('bundleId', 'test-bundle-1');
      expect(result).toHaveProperty('bundlePath');
      expect(result).toHaveProperty('bundleHash');
      expect(result).toHaveProperty('manifest');
      expect(result.manifest).toHaveProperty('bundleId', 'test-bundle-1');
      expect(result.manifest).toHaveProperty('purpose', 'testing');
      expect(result.manifest.artifacts).toHaveLength(2);
      expect(result.manifest.attestations).toHaveLength(2);
    });

    it('should handle bundle creation with minimal request', async () => {
      const bundleRequest = {
        artifactPaths: [testArtifacts[0]] // Only one artifact
      };

      bundler['_createBundleArchive'] = vi.fn().mockResolvedValue('/path/to/minimal-bundle.zip');
      bundler['_calculateFileHash'] = vi.fn().mockResolvedValue('minimal-hash');

      const result = await bundler.createAttestationBundle(bundleRequest);

      expect(result.manifest.artifacts).toHaveLength(1);
      expect(result.manifest.attestations).toHaveLength(1);
      expect(result.manifest).toHaveProperty('bundleId');
      expect(result.manifest).toHaveProperty('createdAt');
    });

    it('should calculate bundle integrity correctly', async () => {
      const bundleRequest = {
        artifactPaths: testArtifacts
      };

      bundler['_createBundleArchive'] = vi.fn().mockResolvedValue('/path/to/bundle.zip');
      bundler['_calculateFileHash'] = vi.fn().mockResolvedValue('test-hash');

      const result = await bundler.createAttestationBundle(bundleRequest);

      expect(result.manifest.integrity).toHaveProperty('artifactHashes');
      expect(result.manifest.integrity).toHaveProperty('manifestHash');
      expect(Object.keys(result.manifest.integrity.artifactHashes)).toHaveLength(2);
    });
  });

  describe('verifyAttestationBundle', () => {
    it('should verify valid bundle successfully', async () => {
      const bundlePath = path.join(tempDir, 'test-bundle.zip');
      
      // Mock bundle verification methods
      bundler['_extractManifest'] = vi.fn().mockResolvedValue({
        bundleId: 'test-bundle',
        bundleHash: 'test-hash',
        artifacts: [
          { name: 'test-file.js', hash: 'file-hash' }
        ],
        signed: false
      });
      
      bundler['_calculateFileHash'] = vi.fn().mockResolvedValue('test-hash');
      bundler['_extractBundle'] = vi.fn().mockResolvedValue();
      bundler['_verifyArtifactIntegrity'] = vi.fn().mockResolvedValue({ valid: true, issues: [], warnings: [] });
      bundler['_verifyAttestationCompleteness'] = vi.fn().mockResolvedValue({ valid: true, issues: [] });
      bundler['_verifyProvenanceConsistency'] = vi.fn().mockResolvedValue({ valid: true, warnings: [] });

      const verification = await bundler.verifyAttestationBundle(bundlePath);

      expect(verification.valid).toBe(true);
      expect(verification.issues).toHaveLength(0);
      expect(verification).toHaveProperty('verifiedAt');
    });

    it('should detect bundle hash mismatch', async () => {
      const bundlePath = path.join(tempDir, 'test-bundle.zip');
      
      bundler['_extractManifest'] = vi.fn().mockResolvedValue({
        bundleId: 'test-bundle',
        bundleHash: 'expected-hash',
        artifacts: [],
        signed: false
      });
      
      bundler['_calculateFileHash'] = vi.fn().mockResolvedValue('actual-hash'); // Different hash
      bundler['_extractBundle'] = vi.fn().mockResolvedValue();
      bundler['_verifyArtifactIntegrity'] = vi.fn().mockResolvedValue({ valid: true, issues: [], warnings: [] });
      bundler['_verifyAttestationCompleteness'] = vi.fn().mockResolvedValue({ valid: true, issues: [] });
      bundler['_verifyProvenanceConsistency'] = vi.fn().mockResolvedValue({ valid: true, warnings: [] });

      const verification = await bundler.verifyAttestationBundle(bundlePath);

      expect(verification.valid).toBe(false);
      expect(verification.issues.some(issue => issue.includes('Bundle hash mismatch'))).toBe(true);
    });

    it('should handle missing manifest gracefully', async () => {
      const bundlePath = path.join(tempDir, 'invalid-bundle.zip');
      
      bundler['_extractManifest'] = vi.fn().mockResolvedValue(null);

      const verification = await bundler.verifyAttestationBundle(bundlePath);

      expect(verification.valid).toBe(false);
      expect(verification.issues.some(issue => issue.includes('Bundle manifest not found'))).toBe(true);
    });
  });

  describe('extractFromBundle', () => {
    it('should extract specific files by pattern', async () => {
      const bundlePath = path.join(tempDir, 'test-bundle.zip');
      const outputDir = path.join(tempDir, 'extracted');
      
      // Mock StreamZip
      const mockEntries = {
        'artifacts/test-file.js': { isDirectory: false },
        'attestations/test-file.js.attest.json': { isDirectory: false },
        'manifest.json': { isDirectory: false },
        'other-file.txt': { isDirectory: false }
      };

      const mockZip = {
        entries: vi.fn().mockResolvedValue(mockEntries),
        entryData: vi.fn().mockResolvedValue(Buffer.from('file content')),
        close: vi.fn().mockResolvedValue()
      };

      vi.doMock('node-stream-zip', () => ({
        default: {
          async: vi.fn().mockReturnValue(mockZip)
        }
      }));

      const filePatterns = ['*.js', '*.json'];
      const extractedFiles = await bundler.extractFromBundle(bundlePath, filePatterns, outputDir);

      expect(extractedFiles).toHaveLength(3); // Should match 3 files
      expect(extractedFiles.some(file => file.includes('test-file.js'))).toBe(true);
      expect(extractedFiles.some(file => file.includes('manifest.json'))).toBe(true);
    });
  });

  describe('listBundleContents', () => {
    it('should list bundle contents correctly', async () => {
      const bundlePath = path.join(tempDir, 'test-bundle.zip');
      
      const mockEntries = {
        'artifacts/': { isDirectory: true },
        'artifacts/test-file.js': { isDirectory: false, size: 100, compressedSize: 80, time: this.getDeterministicDate() },
        'manifest.json': { isDirectory: false, size: 200, compressedSize: 150, time: this.getDeterministicDate() }
      };

      const mockZip = {
        entries: vi.fn().mockResolvedValue(mockEntries),
        entryData: vi.fn().mockResolvedValue(Buffer.from(JSON.stringify({ bundleId: 'test' }))),
        close: vi.fn().mockResolvedValue()
      };

      vi.doMock('node-stream-zip', () => ({
        default: {
          async: vi.fn().mockReturnValue(mockZip)
        }
      }));

      const contents = await bundler.listBundleContents(bundlePath);

      expect(contents.totalFiles).toBe(2);
      expect(contents.directories).toHaveLength(1);
      expect(contents.files).toHaveLength(2);
      expect(contents.manifest).toHaveProperty('bundleId', 'test');
    });
  });

  describe('compareBuildOutputs', () => {
    it('should compare two build outputs correctly', async () => {
      // Create two build directories
      const build1Dir = path.join(tempDir, 'build1');
      const build2Dir = path.join(tempDir, 'build2');
      
      await fs.mkdir(build1Dir, { recursive: true });
      await fs.mkdir(build2Dir, { recursive: true });

      // Create identical files in both builds
      const sharedFile = 'shared.js';
      const sharedContent = 'console.log("shared");';
      
      await fs.writeFile(path.join(build1Dir, sharedFile), sharedContent);
      await fs.writeFile(path.join(build2Dir, sharedFile), sharedContent);

      // Create unique files in each build
      await fs.writeFile(path.join(build1Dir, 'unique1.js'), 'console.log("unique1");');
      await fs.writeFile(path.join(build2Dir, 'unique2.js'), 'console.log("unique2");');

      const comparison = await bundler.compareBuildOutputs(build1Dir, build2Dir);

      expect(comparison.identical).toBe(false);
      expect(comparison.commonFiles).toContain(sharedFile);
      expect(comparison.onlyInBuild1).toContain('unique1.js');
      expect(comparison.onlyInBuild2).toContain('unique2.js');
      expect(comparison.differences).toHaveLength(2); // Two unique files
    });

    it('should detect identical build outputs', async () => {
      const build1Dir = path.join(tempDir, 'build1');
      const build2Dir = path.join(tempDir, 'build2');
      
      await fs.mkdir(build1Dir, { recursive: true });
      await fs.mkdir(build2Dir, { recursive: true });

      // Create identical files
      const files = ['file1.js', 'file2.json'];
      for (const file of files) {
        const content = `content for ${file}`;
        await fs.writeFile(path.join(build1Dir, file), content);
        await fs.writeFile(path.join(build2Dir, file), content);
      }

      const comparison = await bundler.compareBuildOutputs(build1Dir, build2Dir);

      expect(comparison.identical).toBe(true);
      expect(comparison.differences).toHaveLength(0);
      expect(comparison.commonFiles).toHaveLength(2);
    });
  });

  describe('file operations', () => {
    it('should calculate file hashes correctly', async () => {
      const testFile = path.join(tempDir, 'hash-test.txt');
      const content = 'test content for hashing';
      await fs.writeFile(testFile, content);

      const hash1 = await bundler['_calculateFileHash'](testFile);
      const hash2 = await bundler['_calculateFileHash'](testFile);

      expect(hash1).toBe(hash2); // Should be deterministic
      expect(typeof hash1).toBe('string');
      expect(hash1).toHaveLength(64); // SHA256 hex length
    });

    it('should detect MIME types correctly', () => {
      const testCases = [
        { file: 'test.js', expected: 'application/javascript' },
        { file: 'test.json', expected: 'application/json' },
        { file: 'test.md', expected: 'text/markdown' },
        { file: 'test.unknown', expected: 'application/octet-stream' }
      ];

      for (const testCase of testCases) {
        const mimeType = bundler['_getMimeType'](testCase.file);
        expect(mimeType).toBe(testCase.expected);
      }
    });
  });

  describe('integrity and security', () => {
    it('should handle bundle signing when enabled', async () => {
      const signingBundler = new AttestationBundler({
        signBundle: true
      });

      const bundlePath = '/path/to/bundle.zip';
      const manifest = { bundleId: 'test' };

      const signature = await signingBundler['_signBundle'](bundlePath, manifest);

      expect(signature).toHaveProperty('algorithm');
      expect(signature).toHaveProperty('hash');
      expect(signature).toHaveProperty('signature');
      expect(signature).toHaveProperty('signedAt');
      expect(signature).toHaveProperty('signer');
    });

    it('should verify bundle signatures when present', async () => {
      const bundlePath = '/path/to/signed-bundle.zip';
      const manifest = {
        signed: true,
        signature: {
          algorithm: 'RS256',
          hash: 'bundle-hash',
          signature: 'signature-data'
        }
      };

      const verification = await bundler['_verifyBundleSignature'](bundlePath, manifest);

      expect(verification).toHaveProperty('valid');
      expect(verification).toHaveProperty('algorithm');
      expect(verification).toHaveProperty('verifiedAt');
    });
  });

  describe('error handling', () => {
    it('should handle missing artifact files gracefully', async () => {
      const bundleRequest = {
        artifactPaths: ['/non/existent/file.js']
      };

      bundler['_createBundleArchive'] = vi.fn().mockResolvedValue('/path/to/bundle.zip');
      bundler['_calculateFileHash'] = vi.fn().mockResolvedValue('hash');

      const result = await bundler.createAttestationBundle(bundleRequest);

      // Should still create bundle but with warnings
      expect(result).toHaveProperty('bundlePath');
      expect(result.manifest.artifacts).toHaveLength(0); // No artifacts collected
    });

    it('should handle bundle creation failures', async () => {
      const bundleRequest = {
        artifactPaths: testArtifacts
      };

      // Mock archive creation failure
      bundler['_createBundleArchive'] = vi.fn().mockRejectedValue(new Error('Archive creation failed'));

      await expect(bundler.createAttestationBundle(bundleRequest)).rejects.toThrow('Archive creation failed');
    });
  });
});