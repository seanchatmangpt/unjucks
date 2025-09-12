/**
 * KGEN Drift Detection System Tests
 * Comprehensive test suite for drift detection functionality
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs-extra';
import crypto from 'crypto';
import DriftDetector, { DriftExitCodes } from '../../packages/kgen-core/src/drift/detector.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testDir = join(__dirname, 'fixtures', 'drift-test');
const tempDir = join(__dirname, 'temp', 'drift-test');

describe('DriftDetector', () => {
  let detector;
  let config;

  beforeEach(async () => {
    // Clean up temp directory
    await fs.remove(tempDir);
    await fs.ensureDir(tempDir);

    // Setup test configuration
    config = {
      tolerance: 0.95,
      algorithm: 'semantic-hash',
      storage: {
        baselinePath: join(tempDir, 'baselines'),
        reportsPath: join(tempDir, 'reports'),
        fingerprintsPath: join(tempDir, 'fingerprints')
      },
      drift: {
        enableBaseline: true,
        includePatterns: ['*.js', '*.ttl', '*.json']
      },
      performance: {
        maxConcurrency: 2
      }
    };

    detector = new DriftDetector(config);
    await detector.initialize();
  });

  afterEach(async () => {
    if (detector) {
      await detector.shutdown();
    }
    await fs.remove(tempDir);
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', async () => {
      const defaultDetector = new DriftDetector();
      await defaultDetector.initialize();
      
      expect(defaultDetector.status).toBe('ready');
      expect(defaultDetector.config.drift.tolerance).toBe(0.95);
      expect(defaultDetector.config.drift.algorithm).toBe('semantic-hash');
      
      await defaultDetector.shutdown();
    });

    test('should create required directories', async () => {
      expect(await fs.pathExists(config.storage.baselinePath)).toBe(true);
      expect(await fs.pathExists(config.storage.reportsPath)).toBe(true);
      expect(await fs.pathExists(config.storage.fingerprintsPath)).toBe(true);
    });

    test('should load existing baselines on initialization', async () => {
      // Create a baseline file
      const baselineData = {
        'test-key': {
          path: '/test/file.js',
          fingerprint: { hash: 'test-hash', semanticHash: 'semantic-test' },
          timestamp: this.getDeterministicDate().toISOString()
        }
      };
      
      const baselinePath = join(config.storage.baselinePath, 'baselines.json');
      await fs.writeJson(baselinePath, baselineData);

      // Reinitialize detector
      const newDetector = new DriftDetector(config);
      await newDetector.initialize();

      expect(newDetector.baselines.size).toBe(1);
      expect(newDetector.baselines.has('test-key')).toBe(true);

      await newDetector.shutdown();
    });
  });

  describe('Fingerprint Generation', () => {
    test('should generate basic fingerprint for text file', async () => {
      const testContent = 'Hello, world!';
      const testFile = join(tempDir, 'test.txt');
      await fs.writeFile(testFile, testContent);

      const fingerprint = await detector.generateArtifactFingerprint(testFile);

      expect(fingerprint).toMatchObject({
        path: testFile,
        size: testContent.length,
        type: 'unknown',
        hash: expect.any(String),
        semanticHash: expect.any(String),
        timestamp: expect.any(String)
      });

      expect(fingerprint.hash).toBe(
        crypto.createHash('sha256').update(testContent).digest('hex')
      );
    });

    test('should generate semantic hash for RDF/Turtle file', async () => {
      const rdfContent = `
        @prefix ex: <http://example.org/> .
        ex:John ex:name "John Doe" .
        ex:John ex:age 30 .
      `;
      const testFile = join(tempDir, 'test.ttl');
      await fs.writeFile(testFile, rdfContent);

      const fingerprint = await detector.generateArtifactFingerprint(testFile);

      expect(fingerprint.type).toBe('rdf');
      expect(fingerprint.semanticHash).toBeTruthy();
      expect(fingerprint.semanticHash).not.toBe(fingerprint.hash);
    });

    test('should generate semantic hash for JSON file', async () => {
      const jsonContent = JSON.stringify({ name: 'John', age: 30, city: 'NYC' }, null, 2);
      const testFile = join(tempDir, 'test.json');
      await fs.writeFile(testFile, jsonContent);

      const fingerprint = await detector.generateArtifactFingerprint(testFile);

      expect(fingerprint.type).toBe('json');
      expect(fingerprint.semanticHash).toBeTruthy();

      // Test that semantically equivalent JSON produces same hash
      const reorderedJson = JSON.stringify({ age: 30, city: 'NYC', name: 'John' });
      const fingerprint2 = await detector.generateArtifactFingerprint(testFile, reorderedJson);
      
      expect(fingerprint2.semanticHash).toBe(fingerprint.semanticHash);
    });

    test('should handle non-existent file gracefully', async () => {
      const fingerprint = await detector.generateArtifactFingerprint('/nonexistent/file.txt');
      expect(fingerprint).toBeNull();
    });

    test('should cache fingerprints for performance', async () => {
      const testFile = join(tempDir, 'cache-test.txt');
      await fs.writeFile(testFile, 'test content');

      // First call
      const fingerprint1 = await detector.generateArtifactFingerprint(testFile);
      expect(detector.stats.cacheMisses).toBe(1);

      // Second call should hit cache
      const fingerprint2 = await detector.generateArtifactFingerprint(testFile);
      expect(detector.stats.cacheHits).toBe(1);
      expect(fingerprint1).toEqual(fingerprint2);
    });
  });

  describe('Fingerprint Comparison', () => {
    test('should detect identical files', () => {
      const fingerprint1 = {
        hash: 'abc123',
        semanticHash: 'def456',
        size: 100
      };
      const fingerprint2 = {
        hash: 'abc123',
        semanticHash: 'def456',
        size: 100
      };

      const comparison = detector.compareFingerprints(fingerprint1, fingerprint2);

      expect(comparison.identical).toBe(true);
      expect(comparison.similarity).toBe(1.0);
      expect(comparison.differences).toHaveLength(0);
    });

    test('should detect content changes', () => {
      const baseline = {
        hash: 'abc123',
        semanticHash: 'def456',
        size: 100
      };
      const current = {
        hash: 'xyz789',
        semanticHash: 'def456',
        size: 100
      };

      const comparison = detector.compareFingerprints(baseline, current);

      expect(comparison.identical).toBe(false);
      expect(comparison.differences).toContainEqual(
        expect.objectContaining({
          type: 'content-changed',
          severity: 'major'
        })
      );
    });

    test('should detect semantic changes', () => {
      const baseline = {
        hash: 'abc123',
        semanticHash: 'def456',
        size: 100
      };
      const current = {
        hash: 'abc123',
        semanticHash: 'ghi789',
        size: 100
      };

      const comparison = detector.compareFingerprints(baseline, current);

      expect(comparison.identical).toBe(false);
      expect(comparison.similarity).toBeLessThan(1.0);
      expect(comparison.differences).toContainEqual(
        expect.objectContaining({
          type: 'semantic-change',
          severity: 'critical'
        })
      );
    });

    test('should detect size changes', () => {
      const baseline = {
        hash: 'abc123',
        semanticHash: 'def456',
        size: 100
      };
      const current = {
        hash: 'abc123',
        semanticHash: 'def456',
        size: 200 // 100% size increase
      };

      const comparison = detector.compareFingerprints(baseline, current);

      expect(comparison.identical).toBe(false);
      expect(comparison.differences).toContainEqual(
        expect.objectContaining({
          type: 'size-changed',
          severity: 'major'
        })
      );
    });

    test('should handle missing baseline', () => {
      const current = {
        hash: 'abc123',
        semanticHash: 'def456',
        size: 100
      };

      const comparison = detector.compareFingerprints(null, current);

      expect(comparison.identical).toBe(false);
      expect(comparison.similarity).toBe(0);
      expect(comparison.differences).toContainEqual(
        expect.objectContaining({
          type: 'file-added',
          severity: 'major'
        })
      );
    });

    test('should handle missing current file', () => {
      const baseline = {
        hash: 'abc123',
        semanticHash: 'def456',
        size: 100
      };

      const comparison = detector.compareFingerprints(baseline, null);

      expect(comparison.identical).toBe(false);
      expect(comparison.similarity).toBe(0);
      expect(comparison.differences).toContainEqual(
        expect.objectContaining({
          type: 'file-deleted',
          severity: 'major'
        })
      );
    });
  });

  describe('Artifact Discovery', () => {
    beforeEach(async () => {
      // Create test file structure
      await fs.ensureDir(join(tempDir, 'src'));
      await fs.ensureDir(join(tempDir, 'tests'));
      await fs.ensureDir(join(tempDir, 'node_modules')); // Should be ignored
      await fs.ensureDir(join(tempDir, '.git')); // Should be ignored

      await fs.writeFile(join(tempDir, 'src', 'index.js'), 'console.log("hello");');
      await fs.writeFile(join(tempDir, 'src', 'utils.js'), 'export const add = (a, b) => a + b;');
      await fs.writeFile(join(tempDir, 'tests', 'test.js'), 'test("add", () => {});');
      await fs.writeFile(join(tempDir, 'package.json'), '{"name": "test"}');
      await fs.writeFile(join(tempDir, 'README.md'), '# Test Project');
      await fs.writeFile(join(tempDir, 'data.ttl'), '@prefix ex: <http://example.org/> .');
      await fs.writeFile(join(tempDir, 'node_modules', 'lib.js'), 'ignored');
      await fs.writeFile(join(tempDir, '.git', 'config'), 'ignored');
    });

    test('should discover single file', async () => {
      const testFile = join(tempDir, 'src', 'index.js');
      const artifacts = await detector.discoverArtifacts(testFile);

      expect(artifacts).toEqual([testFile]);
    });

    test('should discover directory recursively', async () => {
      const artifacts = await detector.discoverArtifacts(tempDir);

      expect(artifacts).toContain(join(tempDir, 'src', 'index.js'));
      expect(artifacts).toContain(join(tempDir, 'src', 'utils.js'));
      expect(artifacts).toContain(join(tempDir, 'tests', 'test.js'));
      expect(artifacts).toContain(join(tempDir, 'package.json')); // JSON included
      expect(artifacts).toContain(join(tempDir, 'data.ttl')); // TTL included

      // Should exclude ignored paths
      expect(artifacts).not.toContain(join(tempDir, 'node_modules', 'lib.js'));
      expect(artifacts).not.toContain(join(tempDir, '.git', 'config'));
      expect(artifacts).not.toContain(join(tempDir, 'README.md')); // MD not in include patterns
    });

    test('should respect include patterns', async () => {
      detector.config.drift.includePatterns = ['*.ttl', '*.json'];
      
      const artifacts = await detector.discoverArtifacts(tempDir);

      expect(artifacts).toContain(join(tempDir, 'package.json'));
      expect(artifacts).toContain(join(tempDir, 'data.ttl'));
      expect(artifacts).not.toContain(join(tempDir, 'src', 'index.js'));
      expect(artifacts).not.toContain(join(tempDir, 'tests', 'test.js'));
    });
  });

  describe('Baseline Management', () => {
    test('should create and update baselines', async () => {
      const testFile = join(tempDir, 'test.js');
      await fs.writeFile(testFile, 'console.log("test");');

      const fingerprint = await detector.generateArtifactFingerprint(testFile);
      await detector.updateBaseline(testFile, fingerprint);

      const key = detector.getBaselineKey(testFile);
      expect(detector.baselines.has(key)).toBe(true);

      const baseline = detector.baselines.get(key);
      expect(baseline.path).toBe(testFile);
      expect(baseline.fingerprint).toEqual(fingerprint);
      expect(baseline.timestamp).toBeTruthy();
    });

    test('should persist baselines to disk', async () => {
      const testFile = join(tempDir, 'persist-test.js');
      await fs.writeFile(testFile, 'test content');

      const fingerprint = await detector.generateArtifactFingerprint(testFile);
      await detector.updateBaseline(testFile, fingerprint);

      // Create new detector instance
      const newDetector = new DriftDetector(config);
      await newDetector.initialize();

      const key = detector.getBaselineKey(testFile);
      expect(newDetector.baselines.has(key)).toBe(true);

      await newDetector.shutdown();
    });

    test('should generate consistent baseline keys', () => {
      const path1 = '/some/file/path.js';
      const path2 = '/some/file/path.js';
      const path3 = '/different/path.js';

      const key1 = detector.getBaselineKey(path1);
      const key2 = detector.getBaselineKey(path2);
      const key3 = detector.getBaselineKey(path3);

      expect(key1).toBe(key2);
      expect(key1).not.toBe(key3);
      expect(key1).toMatch(/^[a-f0-9]{32}$/); // MD5 hash format
    });
  });

  describe('Drift Detection', () => {
    let testFiles;

    beforeEach(async () => {
      // Setup test files
      testFiles = {
        unchanged: join(tempDir, 'unchanged.js'),
        modified: join(tempDir, 'modified.js'),
        newFile: join(tempDir, 'new.js')
      };

      await fs.writeFile(testFiles.unchanged, 'const x = 1;');
      await fs.writeFile(testFiles.modified, 'const y = 2;');

      // Create baselines for existing files
      for (const [key, filePath] of Object.entries(testFiles)) {
        if (key !== 'newFile') {
          const fingerprint = await detector.generateArtifactFingerprint(filePath);
          await detector.updateBaseline(filePath, fingerprint);
        }
      }
    });

    test('should detect no drift for unchanged files', async () => {
      const results = await detector.detectArtifactDrift({
        targetPath: testFiles.unchanged
      });

      expect(results.driftDetected).toBe(false);
      expect(results.exitCode).toBe(DriftExitCodes.SUCCESS);
      expect(results.summary.filesWithDrift).toBe(0);
      expect(results.summary.totalFiles).toBe(1);
    });

    test('should detect drift for modified files', async () => {
      // Modify the file
      await fs.writeFile(testFiles.modified, 'const y = 3; // changed');

      const results = await detector.detectArtifactDrift({
        targetPath: testFiles.modified
      });

      expect(results.driftDetected).toBe(true);
      expect(results.exitCode).toBe(DriftExitCodes.DRIFT_DETECTED);
      expect(results.summary.filesWithDrift).toBe(1);
      expect(results.summary.modifiedFiles).toBe(1);

      const artifact = results.artifacts[0];
      expect(artifact.driftDetected).toBe(true);
      expect(artifact.status).toBe('modified');
      expect(artifact.differences.length).toBeGreaterThan(0);
    });

    test('should detect new files without baselines', async () => {
      // Create new file
      await fs.writeFile(testFiles.newFile, 'const z = 3;');

      const results = await detector.detectArtifactDrift({
        targetPath: testFiles.newFile
      });

      expect(results.driftDetected).toBe(true);
      expect(results.summary.newFiles).toBe(1);

      const artifact = results.artifacts[0];
      expect(artifact.status).toBe('new');
      expect(artifact.differences).toContainEqual(
        expect.objectContaining({
          type: 'new-file',
          severity: 'minor'
        })
      );
    });

    test('should process multiple files in directory', async () => {
      // Modify one file and create a new one
      await fs.writeFile(testFiles.modified, 'const y = 3;');
      await fs.writeFile(testFiles.newFile, 'const z = 3;');

      const results = await detector.detectArtifactDrift({
        targetPath: tempDir
      });

      expect(results.driftDetected).toBe(true);
      expect(results.summary.totalFiles).toBe(3);
      expect(results.summary.filesWithDrift).toBe(2);
      expect(results.summary.modifiedFiles).toBe(1);
      expect(results.summary.newFiles).toBe(1);
    });

    test('should compare against expected data when provided', async () => {
      const expectedData = {
        [testFiles.unchanged]: 'const x = 2; // different expected content'
      };

      const results = await detector.detectArtifactDrift({
        targetPath: testFiles.unchanged,
        expectedData
      });

      expect(results.driftDetected).toBe(true);
      expect(results.artifacts[0].differences).toContainEqual(
        expect.objectContaining({
          type: 'content-changed'
        })
      );
    });

    test('should respect similarity tolerance', async () => {
      detector.config.drift.tolerance = 0.99; // Very strict

      // Make a small change
      await fs.writeFile(testFiles.modified, 'const y = 2; // small change');

      const results = await detector.detectArtifactDrift({
        targetPath: testFiles.modified
      });

      expect(results.driftDetected).toBe(true);
      
      const artifact = results.artifacts[0];
      expect(artifact.differences).toContainEqual(
        expect.objectContaining({
          type: 'similarity-threshold'
        })
      );
    });

    test('should generate recommendations for drift', async () => {
      await fs.writeFile(testFiles.modified, 'const y = 3;');
      await fs.writeFile(testFiles.newFile, 'const z = 3;');

      const results = await detector.detectArtifactDrift({
        targetPath: tempDir
      });

      expect(results.recommendations).toContainEqual(
        expect.objectContaining({
          type: 'new-files',
          priority: 'medium'
        })
      );

      expect(results.recommendations).toContainEqual(
        expect.objectContaining({
          type: 'modified-files',
          priority: 'high'
        })
      );
    });
  });

  describe('Report Generation', () => {
    test('should generate comprehensive drift report', async () => {
      const testFile = join(tempDir, 'report-test.js');
      await fs.writeFile(testFile, 'console.log("test");');

      // Create baseline first
      const fingerprint = await detector.generateArtifactFingerprint(testFile);
      await detector.updateBaseline(testFile, fingerprint);

      // Modify file to create drift
      await fs.writeFile(testFile, 'console.log("modified");');

      const results = await detector.detectArtifactDrift({
        targetPath: testFile
      });

      expect(results.reportPath).toBeTruthy();
      expect(await fs.pathExists(results.reportPath)).toBe(true);

      const report = await fs.readJson(results.reportPath);
      expect(report).toMatchObject({
        metadata: expect.objectContaining({
          kgenVersion: '1.0.0',
          detectionId: results.detectionId,
          timestamp: expect.any(String)
        }),
        summary: results.summary,
        driftDetected: true,
        exitCode: DriftExitCodes.DRIFT_DETECTED,
        artifacts: expect.any(Array),
        differences: expect.any(Array),
        recommendations: expect.any(Array)
      });

      // Should also create text report
      const textReportPath = results.reportPath.replace('.json', '.txt');
      expect(await fs.pathExists(textReportPath)).toBe(true);

      const textReport = await fs.readFile(textReportPath, 'utf8');
      expect(textReport).toContain('KGEN ARTIFACT DRIFT DETECTION REPORT');
      expect(textReport).toContain(results.detectionId);
    });

    test('should include CI/CD integration information', async () => {
      const testFile = join(tempDir, 'cicd-test.js');
      await fs.writeFile(testFile, 'test');

      const results = await detector.detectArtifactDrift({
        targetPath: testFile
      });

      const report = await fs.readJson(results.reportPath);
      expect(report.cicdIntegration).toMatchObject({
        exitCode: expect.any(Number),
        shouldFail: expect.any(Boolean),
        message: expect.any(String)
      });

      if (results.driftDetected) {
        expect(report.cicdIntegration.message).toContain('Artifact drift detected');
      }
    });
  });

  describe('Performance and Caching', () => {
    test('should process files in parallel chunks', async () => {
      // Create multiple test files
      const fileCount = 10;
      const files = [];
      
      for (let i = 0; i < fileCount; i++) {
        const filePath = join(tempDir, `parallel-test-${i}.js`);
        await fs.writeFile(filePath, `const x${i} = ${i};`);
        files.push(filePath);
      }

      const startTime = this.getDeterministicTimestamp();
      const results = await detector.detectArtifactDrift({
        targetPath: tempDir
      });
      const duration = this.getDeterministicTimestamp() - startTime;

      expect(results.summary.totalFiles).toBe(fileCount);
      expect(duration).toBeLessThan(5000); // Should complete reasonably fast

      // Check stats
      expect(detector.stats.filesProcessed).toBe(fileCount);
    });

    test('should maintain cache efficiency', async () => {
      const testFile = join(tempDir, 'cache-efficiency-test.js');
      await fs.writeFile(testFile, 'test content');

      // Multiple calls should use cache
      await detector.generateArtifactFingerprint(testFile);
      await detector.generateArtifactFingerprint(testFile);
      await detector.generateArtifactFingerprint(testFile);

      const stats = detector.getStats();
      expect(stats.cacheEfficiency).toBeGreaterThan(50); // At least 50% cache hits
    });

    test('should evict cache when full', async () => {
      // Set very small cache size for testing
      detector.config.performance.cacheSize = 2;

      // Generate more fingerprints than cache can hold
      for (let i = 0; i < 5; i++) {
        const filePath = join(tempDir, `cache-evict-${i}.js`);
        await fs.writeFile(filePath, `content ${i}`);
        await detector.generateArtifactFingerprint(filePath);
      }

      expect(detector.cache.size).toBeLessThanOrEqual(2);
    });
  });

  describe('Error Handling', () => {
    test('should handle file system errors gracefully', async () => {
      const nonExistentFile = join(tempDir, 'does-not-exist.js');

      const results = await detector.detectArtifactDrift({
        targetPath: nonExistentFile
      });

      expect(results.error).toBeUndefined();
      expect(results.summary.totalFiles).toBe(0);
    });

    test('should handle invalid RDF content', async () => {
      const invalidRDF = join(tempDir, 'invalid.ttl');
      await fs.writeFile(invalidRDF, 'This is not valid Turtle syntax @#$%');

      const fingerprint = await detector.generateArtifactFingerprint(invalidRDF);

      expect(fingerprint).toBeTruthy();
      expect(fingerprint.error).toBeUndefined();
      // Should fallback to content hash
      expect(fingerprint.semanticHash).toBeTruthy();
    });

    test('should handle invalid JSON content', async () => {
      const invalidJSON = join(tempDir, 'invalid.json');
      await fs.writeFile(invalidJSON, '{ invalid json syntax');

      const fingerprint = await detector.generateArtifactFingerprint(invalidJSON);

      expect(fingerprint).toBeTruthy();
      // Should fallback to content hash
      expect(fingerprint.semanticHash).toBe(fingerprint.hash);
    });

    test('should continue processing after individual file errors', async () => {
      // Create mix of valid and problematic files
      await fs.writeFile(join(tempDir, 'valid1.js'), 'const x = 1;');
      await fs.writeFile(join(tempDir, 'valid2.js'), 'const y = 2;');
      
      // Create a directory with same name as expected file (should cause error)
      await fs.ensureDir(join(tempDir, 'problematic.js'));

      const results = await detector.detectArtifactDrift({
        targetPath: tempDir
      });

      // Should process valid files despite errors
      expect(results.summary.totalFiles).toBeGreaterThan(0);
      expect(results.artifacts.length).toBeGreaterThan(0);
    });
  });

  describe('Integration with SHACL Validation', () => {
    test('should reuse SHACL validation engine for RDF parsing', async () => {
      const rdfContent = `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        ex:john a foaf:Person ;
                foaf:name "John Doe" ;
                foaf:age 30 .
      `;

      const testFile = join(tempDir, 'person.ttl');
      await fs.writeFile(testFile, rdfContent);

      const fingerprint = await detector.generateArtifactFingerprint(testFile);

      expect(fingerprint.type).toBe('rdf');
      expect(fingerprint.semanticHash).toBeTruthy();
      
      // Semantic hash should be different from content hash due to normalization
      expect(fingerprint.semanticHash).not.toBe(fingerprint.hash);
    });

    test('should normalize RDF for semantic comparison', async () => {
      const rdf1 = `
        @prefix ex: <http://example.org/> .
        ex:john ex:name "John" .
        ex:john ex:age 30 .
      `;

      const rdf2 = `
        @prefix example: <http://example.org/> .
        example:john example:age 30 .
        example:john example:name "John" .
      `;

      const file1 = join(tempDir, 'rdf1.ttl');
      const file2 = join(tempDir, 'rdf2.ttl');
      
      await fs.writeFile(file1, rdf1);
      await fs.writeFile(file2, rdf2);

      const fingerprint1 = await detector.generateArtifactFingerprint(file1);
      const fingerprint2 = await detector.generateArtifactFingerprint(file2);

      // Content hashes should be different
      expect(fingerprint1.hash).not.toBe(fingerprint2.hash);
      
      // But semantic hashes should be the same (same triples, different syntax)
      expect(fingerprint1.semanticHash).toBe(fingerprint2.semanticHash);
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should track processing statistics', async () => {
      const testFile = join(tempDir, 'stats-test.js');
      await fs.writeFile(testFile, 'test content');

      await detector.detectArtifactDrift({ targetPath: testFile });

      const stats = detector.getStats();
      expect(stats).toMatchObject({
        filesProcessed: expect.any(Number),
        driftDetected: expect.any(Number),
        baselinesCreated: expect.any(Number),
        baselinesUpdated: expect.any(Number),
        totalProcessingTime: expect.any(Number),
        cacheHits: expect.any(Number),
        cacheMisses: expect.any(Number),
        cacheEfficiency: expect.any(Number),
        averageProcessingTime: expect.any(Number)
      });

      expect(stats.filesProcessed).toBeGreaterThan(0);
    });

    test('should emit events during processing', async () => {
      const events = [];
      
      detector.on('initialized', (data) => events.push({ type: 'initialized', data }));
      detector.on('drift-detection-completed', (data) => events.push({ type: 'completed', data }));
      detector.on('baseline-updated', (data) => events.push({ type: 'baseline', data }));

      const testFile = join(tempDir, 'events-test.js');
      await fs.writeFile(testFile, 'test content');

      await detector.updateBaseline(testFile, 
        await detector.generateArtifactFingerprint(testFile)
      );

      await detector.detectArtifactDrift({ targetPath: testFile });

      expect(events).toContainEqual(
        expect.objectContaining({ type: 'baseline' })
      );
      expect(events).toContainEqual(
        expect.objectContaining({ type: 'completed' })
      );
    });
  });

  describe('Health Check', () => {
    test('should provide comprehensive health status', async () => {
      const health = await detector.healthCheck();

      expect(health).toMatchObject({
        status: 'ready',
        stats: expect.any(Object),
        config: expect.any(Object),
        baselinesLoaded: expect.any(Number),
        fingerprintsLoaded: expect.any(Number),
        cacheSize: expect.any(Number)
      });

      expect(['ready', 'initializing', 'error']).toContain(health.status);
    });
  });
});