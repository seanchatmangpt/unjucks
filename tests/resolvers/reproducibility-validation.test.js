/**
 * Reproducibility Validation Test Suite
 * 
 * Tests to ensure 99.9% reproducibility across 10 runs as required by Charter
 * Validates deterministic behavior across all URI schemes and operations
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { performance } from 'perf_hooks';
import crypto from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import { tmpdir } from 'os';

// Import all resolver classes
import { ContentUriResolver } from '../../src/kgen/cas/content-uri-resolver.js';
import { GitUriResolver } from '../../packages/kgen-core/src/resolvers/git-uri-resolver.js';
import { AttestResolver } from '../../src/kgen/attestation/attest-resolver.js';
import { DriftURIResolver } from '../../src/kgen/drift/drift-uri-resolver.js';
import { PolicyURIResolver } from '../../src/kgen/validation/policy-resolver.js';

describe('Reproducibility Validation Tests', () => {
  let testDir;
  let resolvers;
  
  beforeEach(async () => {
    testDir = path.join(tmpdir(), 'reproducibility-test-' + this.getDeterministicTimestamp());
    await fs.ensureDir(testDir);
    
    resolvers = {
      content: new ContentUriResolver({
        casDir: path.join(testDir, 'cas'),
        enableHardlinks: false, // Disable for deterministic testing
        enableExtensionPreservation: true,
        cacheSize: 10
      }),
      git: new GitUriResolver({
        cacheDir: path.join(testDir, 'git-cache'),
        enableAttestation: true,
        allowRemoteRepos: false
      }),
      attest: new AttestResolver({
        storageDir: path.join(testDir, 'attest'),
        cacheSize: 10,
        verificationEnabled: true
      }),
      drift: new DriftURIResolver({
        storage: {
          patchDirectory: path.join(testDir, 'patches'),
          maxPatchSize: 1024 * 1024
        }
      })
    };
    
    // Initialize resolvers
    for (const resolver of Object.values(resolvers)) {
      try {
        await resolver.initialize();
      } catch (error) {
        console.warn('Resolver initialization warning:', error.message);
      }
    }
  });
  
  afterEach(async () => {
    if (testDir && await fs.pathExists(testDir)) {
      await fs.remove(testDir);
    }
  });

  describe('Content URI Reproducibility', () => {
    test('should achieve 99.9% hash reproducibility across 10 runs', async () => {
      const testContent = 'Reproducibility test content with fixed timestamp: 2024-01-01T00:00:00Z';
      const runs = 10;
      const results = [];
      
      // Run the same content storage operation 10 times
      for (let i = 0; i < runs; i++) {
        const result = await resolvers.content.store(testContent, {
          algorithm: 'sha256',
          metadata: { run: i, timestamp: '2024-01-01T00:00:00Z' }
        });
        
        results.push({
          run: i,
          uri: result.uri,
          hash: result.hash,
          size: result.size
        });
      }
      
      // Validate all results are identical
      const firstResult = results[0];
      const identicalResults = results.filter(result => 
        result.uri === firstResult.uri &&
        result.hash === firstResult.hash &&
        result.size === firstResult.size
      );
      
      const reproducibilityRate = (identicalResults.length / runs) * 100;
      expect(reproducibilityRate).toBeGreaterThanOrEqual(99.9);
      
      // All hashes should be exactly the same
      const uniqueHashes = new Set(results.map(r => r.hash));
      expect(uniqueHashes.size).toBe(1);
      
      // All URIs should be exactly the same
      const uniqueUris = new Set(results.map(r => r.uri));
      expect(uniqueUris.size).toBe(1);
    });

    test('should produce deterministic hashes for complex objects', async () => {
      const complexObject = {
        id: 'test-entity-001',
        timestamp: '2024-01-01T00:00:00Z', // Fixed timestamp for determinism
        metadata: {
          version: '1.0.0',
          author: 'test-suite',
          tags: ['test', 'reproducibility', 'deterministic'].sort() // Ensure order
        },
        data: {
          numbers: [1, 2, 3, 4, 5],
          nested: {
            value: 42,
            flag: true,
            optional: null
          }
        }
      };
      
      const runs = 10;
      const hashes = [];
      
      for (let i = 0; i < runs; i++) {
        // Serialize with sorted keys for determinism
        const serialized = JSON.stringify(complexObject, Object.keys(complexObject).sort());
        const result = await resolvers.content.store(serialized);
        hashes.push(result.hash);
      }
      
      // All hashes must be identical
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(1);
      expect(hashes[0]).toMatch(/^[a-f0-9]{64}$/);
    });

    test('should handle concurrent storage with deterministic results', async () => {
      const baseContent = 'Concurrent reproducibility test';
      const runs = 10;
      
      // Start all operations concurrently
      const promises = Array(runs).fill().map(async (_, i) => {
        const content = `${baseContent} - run ${i}`;
        return await resolvers.content.store(content);
      });
      
      const results = await Promise.all(promises);
      
      // Each unique content should produce the same hash every time
      for (let i = 0; i < runs; i++) {
        const expectedHash = crypto.createHash('sha256')
          .update(`${baseContent} - run ${i}`)
          .digest('hex');
        
        expect(results[i].hash).toBe(expectedHash);
      }
    });
  });

  describe('Drift URI Reproducibility', () => {
    test('should generate identical patches for same data changes', async () => {
      const baseline = {
        id: 'entity-001',
        version: '1.0.0',
        data: { counter: 10, status: 'active' }
      };
      
      const modified = {
        id: 'entity-001', 
        version: '1.1.0',
        data: { counter: 15, status: 'updated', newField: 'added' }
      };
      
      const runs = 10;
      const patches = [];
      
      for (let i = 0; i < runs; i++) {
        const result = await resolvers.drift.storePatch(baseline, modified, {
          source: 'reproducibility-test',
          format: 'json'
        });
        
        patches.push({
          uri: result.uri,
          patchContent: JSON.stringify(result.patch),
          cid: result.metadata.cid
        });
      }
      
      // All patches should be identical
      const firstPatch = patches[0];
      const identicalPatches = patches.filter(patch =>
        patch.patchContent === firstPatch.patchContent &&
        patch.cid === firstPatch.cid
      );
      
      const reproducibilityRate = (identicalPatches.length / runs) * 100;
      expect(reproducibilityRate).toBeGreaterThanOrEqual(99.9);
    });

    test('should categorize operations consistently', async () => {
      const testPatch = {
        'name': ['Old Name', 'New Name'],          // Modification
        'email': ['new@example.com'],              // Addition
        'phone': ['+1234567890', 0, 0],           // Deletion  
        'addresses': {
          '_t': 'a',                              // Array change
          '0': ['123 New Street']
        },
        'tags': {
          '_t': 'a',
          '2': ['new-tag']                        // Array addition
        }
      };
      
      const runs = 10;
      const operationCounts = [];
      
      for (let i = 0; i < runs; i++) {
        const operations = resolvers.drift.categorizeOperations(testPatch);
        operationCounts.push(operations);
      }
      
      // All operation counts should be identical
      const firstCount = operationCounts[0];
      const identicalCounts = operationCounts.filter(count =>
        count.modifications === firstCount.modifications &&
        count.additions === firstCount.additions &&
        count.deletions === firstCount.deletions &&
        count.structural === firstCount.structural
      );
      
      expect(identicalCounts.length).toBe(runs);
    });

    test('should produce reproducible significance scores', async () => {
      const operations = {
        modifications: 2,
        additions: 3,
        deletions: 1,
        moves: 0,
        structural: 1,
        cosmetic: 0
      };
      
      const runs = 10;
      const scores = [];
      
      for (let i = 0; i < runs; i++) {
        const score = resolvers.drift.calculateHeuristicSignificance(operations);
        scores.push(score);
      }
      
      // All significance scores should be identical
      const uniqueScores = new Set(scores);
      expect(uniqueScores.size).toBe(1);
      expect(scores[0]).toBeGreaterThan(0);
      expect(scores[0]).toBeLessThanOrEqual(1);
    });
  });

  describe('Attestation Reproducibility', () => {
    test('should generate consistent attestation hashes', async () => {
      const testData = {
        subject: 'reproducibility-test-artifact',
        timestamp: '2024-01-01T00:00:00Z', // Fixed timestamp
        validator: 'test-suite',
        version: '1.0.0'
      };
      
      const runs = 10;
      const attestations = [];
      
      for (let i = 0; i < runs; i++) {
        const attestation = await resolvers.attest.createAttestation(testData, {
          issuer: 'test-issuer',
          contentType: 'application/json',
          includeContent: false // Exclude for determinism
        });
        
        // Remove non-deterministic fields
        const deterministicAttestation = {
          ...attestation,
          timestamp: testData.timestamp, // Use fixed timestamp
          provenance: {
            ...attestation.provenance,
            environment: undefined // Remove environment info
          }
        };
        
        const uri = await resolvers.attest.store(deterministicAttestation);
        attestations.push({
          uri,
          contentHash: attestation.content.hash
        });
      }
      
      // All URIs should be identical for deterministic content
      const uniqueUris = new Set(attestations.map(a => a.uri));
      expect(uniqueUris.size).toBe(1);
    });

    test('should verify attestations consistently', async () => {
      const testAttestation = {
        version: '1.0',
        timestamp: '2024-01-01T00:00:00Z',
        subject: 'consistent-verification-test',
        content: {
          type: 'application/json',
          hash: 'fixed-hash-for-testing'
        },
        claims: {
          'urn:test:deterministic': true,
          'urn:test:reproducible': true
        }
      };
      
      const attestationContent = JSON.stringify(testAttestation, Object.keys(testAttestation).sort());
      const expectedHash = crypto.createHash('sha256').update(attestationContent).digest('hex');
      
      const runs = 10;
      const verificationResults = [];
      
      for (let i = 0; i < runs; i++) {
        const verification = await resolvers.attest.verifyAttestation(testAttestation, expectedHash);
        verificationResults.push({
          valid: verification.valid,
          contentHashCheck: verification.checks.contentHash,
          timestampCheck: verification.checks.timestamp
        });
      }
      
      // All verification results should be identical
      const firstResult = verificationResults[0];
      const identicalResults = verificationResults.filter(result =>
        result.valid === firstResult.valid &&
        result.contentHashCheck === firstResult.contentHashCheck &&
        result.timestampCheck === firstResult.timestampCheck
      );
      
      expect(identicalResults.length).toBe(runs);
      expect(firstResult.valid).toBe(true);
      expect(firstResult.contentHashCheck).toBe(true);
    });
  });

  describe('Git URI Reproducibility', () => {
    test('should parse git URIs consistently', () => {
      const testUri = `git://test-repo@${'a'.repeat(40)}/src/main.js`;
      const runs = 10;
      const parseResults = [];
      
      for (let i = 0; i < runs; i++) {
        const parsed = resolvers.git._parseGitUri(testUri);
        parseResults.push({
          dir: parsed.dir,
          oid: parsed.oid,
          filepath: parsed.filepath,
          type: parsed.type
        });
      }
      
      // All parse results should be identical
      const firstResult = parseResults[0];
      const identicalResults = parseResults.filter(result =>
        result.dir === firstResult.dir &&
        result.oid === firstResult.oid &&
        result.filepath === firstResult.filepath &&
        result.type === firstResult.type
      );
      
      expect(identicalResults.length).toBe(runs);
      expect(firstResult.dir).toBe('test-repo');
      expect(firstResult.oid).toBe('a'.repeat(40));
      expect(firstResult.filepath).toBe('src/main.js');
      expect(firstResult.type).toBe('file');
    });

    test('should validate git URIs consistently', () => {
      const testCases = [
        `git://valid-repo@${'b'.repeat(40)}`,
        `git://valid-repo@${'c'.repeat(40)}/file.txt`,
        'git://invalid-uri',
        'git://repo@shortsha'
      ];
      
      const runs = 5;
      
      testCases.forEach(uri => {
        const validationResults = [];
        
        for (let i = 0; i < runs; i++) {
          const validation = resolvers.git.validateGitUri(uri);
          validationResults.push(validation.valid);
        }
        
        // All validation results should be identical
        const uniqueResults = new Set(validationResults);
        expect(uniqueResults.size).toBe(1);
      });
    });

    test('should generate cache keys deterministically', () => {
      const testUris = [
        `git://cache-test@${'d'.repeat(40)}/test.js`,
        `git://cache-test@${'e'.repeat(40)}/test.ts`,
        `git://cache-test@${'f'.repeat(40)}`
      ];
      
      const runs = 10;
      
      testUris.forEach(uri => {
        const cacheKeys = [];
        
        for (let i = 0; i < runs; i++) {
          const cacheKey = resolvers.git._generateCacheKey(uri);
          cacheKeys.push(cacheKey);
        }
        
        // All cache keys should be identical
        const uniqueKeys = new Set(cacheKeys);
        expect(uniqueKeys.size).toBe(1);
        expect(cacheKeys[0]).toMatch(/^[a-f0-9]{16}$/);
      });
    });
  });

  describe('Cross-Resolver Reproducibility', () => {
    test('should maintain consistency across different resolver instances', async () => {
      const testContent = 'Cross-resolver reproducibility test';
      const runs = 5;
      const results = [];
      
      for (let i = 0; i < runs; i++) {
        // Create new resolver instance for each run
        const newResolver = new ContentUriResolver({
          casDir: path.join(testDir, `cas-${i}`),
          enableHardlinks: false,
          cacheSize: 10
        });
        
        await newResolver.initialize();
        
        const result = await newResolver.store(testContent);
        results.push({
          hash: result.hash,
          uri: result.uri,
          size: result.size
        });
      }
      
      // All results should have the same hash (but different paths)
      const hashes = results.map(r => r.hash);
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(1);
      
      // URIs should be identical (same algorithm and hash)
      const uris = results.map(r => r.uri);
      const uniqueUris = new Set(uris);
      expect(uniqueUris.size).toBe(1);
    });

    test('should produce consistent results across different test environments', async () => {
      const testData = {
        schema: 'test-schema-v1',
        entities: [
          { id: 'e1', type: 'Type1', value: 100 },
          { id: 'e2', type: 'Type2', value: 200 }
        ],
        metadata: {
          created: '2024-01-01T00:00:00Z',
          version: '1.0.0'
        }
      };
      
      // Serialize with deterministic key ordering
      const deterministicContent = JSON.stringify(testData, Object.keys(testData).sort());
      
      const runs = 10;
      const environmentResults = [];
      
      for (let i = 0; i < runs; i++) {
        // Simulate different environment by using different temp directories
        const envTestDir = path.join(testDir, `env-${i}`);
        await fs.ensureDir(envTestDir);
        
        const envResolver = new ContentUriResolver({
          casDir: path.join(envTestDir, 'cas'),
          enableHardlinks: false
        });
        
        await envResolver.initialize();
        
        const result = await envResolver.store(deterministicContent);
        environmentResults.push({
          environment: i,
          hash: result.hash,
          uri: result.uri
        });
      }
      
      // All environments should produce the same hash
      const hashes = environmentResults.map(r => r.hash);
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(1);
      
      // Expected hash should be computable independently
      const expectedHash = crypto.createHash('sha256').update(deterministicContent).digest('hex');
      expect(hashes[0]).toBe(expectedHash);
    });
  });

  describe('Performance Consistency', () => {
    test('should maintain consistent performance across runs', async () => {
      const testContent = 'Performance consistency test content';
      const runs = 10;
      const performanceResults = [];
      
      for (let i = 0; i < runs; i++) {
        const startTime = performance.now();
        
        const storeResult = await resolvers.content.store(testContent);
        const resolveResult = await resolvers.content.resolve(storeResult.uri);
        
        const endTime = performance.now();
        const totalTime = endTime - startTime;
        
        performanceResults.push({
          run: i,
          storeAndResolveTime: totalTime,
          hash: storeResult.hash
        });
      }
      
      // All hashes should be identical
      const hashes = performanceResults.map(r => r.hash);
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(1);
      
      // Performance should be reasonably consistent
      const times = performanceResults.map(r => r.storeAndResolveTime);
      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      
      // Variance should not be excessive (within 2x of average)
      expect(maxTime).toBeLessThan(avgTime * 2);
      expect(minTime).toBeGreaterThan(avgTime / 2);
    });

    test('should handle identical operations with consistent timing', async () => {
      const operations = [
        () => resolvers.content.validateContentURI('content://sha256/' + 'a'.repeat(64)),
        () => resolvers.git.validateGitUri(`git://test@${'b'.repeat(40)}`),
        () => resolvers.drift.parseDriftURI('drift://hash/QmTestHash123'),
        () => resolvers.attest.parseAttestURI('attest://sha256/' + 'c'.repeat(64))
      ];
      
      const runs = 20;
      
      for (const operation of operations) {
        const times = [];
        
        for (let i = 0; i < runs; i++) {
          const startTime = performance.now();
          operation();
          const endTime = performance.now();
          times.push(endTime - startTime);
        }
        
        // Operations should complete quickly and consistently
        const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
        const maxTime = Math.max(...times);
        
        expect(avgTime).toBeLessThan(1); // Less than 1ms average
        expect(maxTime).toBeLessThan(10); // Less than 10ms maximum
      }
    });
  });

  describe('Charter Compliance Validation', () => {
    test('should achieve Charter-required 99.9% reproducibility target', async () => {
      // This is the master test that validates the Charter requirement
      const testContent = 'Charter compliance validation test';
      const requiredRuns = 10;
      const requiredReproducibilityRate = 99.9;
      
      const results = [];
      
      for (let i = 0; i < requiredRuns; i++) {
        const result = await resolvers.content.store(testContent, {
          metadata: { 
            run: i,
            timestamp: '2024-01-01T00:00:00Z' // Fixed for determinism
          }
        });
        
        results.push({
          run: i,
          hash: result.hash,
          uri: result.uri,
          size: result.size,
          algorithm: result.algorithm
        });
      }
      
      // Calculate reproducibility rate
      const firstResult = results[0];
      const reproducibleResults = results.filter(result =>
        result.hash === firstResult.hash &&
        result.uri === firstResult.uri &&
        result.size === firstResult.size &&
        result.algorithm === firstResult.algorithm
      );
      
      const actualReproducibilityRate = (reproducibleResults.length / requiredRuns) * 100;
      
      // Charter requirement: >= 99.9%
      expect(actualReproducibilityRate).toBeGreaterThanOrEqual(requiredReproducibilityRate);
      
      // All results must be identical for 100% reproducibility
      expect(reproducibleResults.length).toBe(requiredRuns);
    });
  });
});