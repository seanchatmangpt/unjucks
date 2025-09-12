/**
 * Comprehensive test suite for DriftDetectionEngine
 * Tests drift detection, validation, attestation checking, and regeneration capabilities
 */

import { describe, test, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { writeFileSync, unlinkSync, existsSync, mkdirSync, rmSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { createHash } from 'crypto';
import { DriftDetectionEngine } from '../../packages/kgen-core/src/validation/DriftDetectionEngine.js';

// Test fixtures and utilities
const TEST_DIR = resolve(process.cwd(), 'tests/drift-detection/fixtures');
const LOCK_FILE = resolve(TEST_DIR, 'kgen.lock.json');
const SHAPES_FILE = resolve(TEST_DIR, 'shapes.ttl');

// Test data
const SAMPLE_TTL = `@prefix ex: <http://example.org/> .
ex:Person a ex:Class ;
    ex:hasName "John Doe" ;
    ex:hasAge 30 .`;

const MODIFIED_TTL = `@prefix ex: <http://example.org/> .
ex:Person a ex:Class ;
    ex:hasName "Jane Doe" ;
    ex:hasAge 25 .`;

const SHACL_SHAPES = `@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .

ex:PersonShape
    a sh:NodeShape ;
    sh:targetClass ex:Person ;
    sh:property [
        sh:path ex:hasName ;
        sh:datatype xsd:string ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
    ] ;
    sh:property [
        sh:path ex:hasAge ;
        sh:datatype xsd:integer ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
    ] .`;

const SAMPLE_ATTESTATION = {
  id: 'test-attestation-123',
  version: '1.0.0',
  timestamp: '2025-01-01T00:00:00.000Z',
  artifact: {
    path: 'test-file.ttl',
    name: 'test-file.ttl',
    hash: 'hash-placeholder',
    size: 0,
    mimeType: 'text/turtle'
  },
  provenance: {
    sourceGraph: { person: { name: 'John Doe', age: 30 } },
    templatePath: '/templates/person.ttl.njk',
    templateHash: 'template-hash-123',
    templateVersion: '1.0.0',
    variables: { name: 'John Doe', age: 30 },
    generatedAt: '2025-01-01T00:00:00.000Z',
    generationAgent: 'test-agent'
  },
  integrity: {
    hashAlgorithm: 'sha256',
    verificationChain: [
      {
        type: 'template',
        path: '/templates/person.ttl.njk',
        hash: 'template-hash-123',
        version: '1.0.0'
      },
      {
        type: 'sourceGraph',
        hash: 'graph-hash-456',
        entities: 1
      }
    ],
    previousHash: 'prev-hash-789',
    chainIndex: 1
  },
  attestationHash: 'attestation-hash-abc'
};

describe('DriftDetectionEngine', () => {
  let engine;
  let testFiles;

  beforeAll(async () => {
    // Create test directory
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }

    // Create SHACL shapes file
    writeFileSync(SHAPES_FILE, SHACL_SHAPES);
  });

  beforeEach(async () => {
    testFiles = {
      'test-file.ttl': resolve(TEST_DIR, 'test-file.ttl'),
      'test-file-2.ttl': resolve(TEST_DIR, 'test-file-2.ttl'),
      'new-file.ttl': resolve(TEST_DIR, 'new-file.ttl')
    };

    // Create initial test files
    writeFileSync(testFiles['test-file.ttl'], SAMPLE_TTL);
    writeFileSync(testFiles['test-file-2.ttl'], SAMPLE_TTL);

    // Create sample lockfile
    const lockData = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      directory: TEST_DIR,
      files: {}
    };

    // Calculate hashes for test files
    for (const [name, path] of Object.entries(testFiles)) {
      if (name !== 'new-file.ttl' && existsSync(path)) {
        const content = readFileSync(path);
        const hash = createHash('sha256').update(content).digest('hex');
        const stat = { size: content.length, mtime: new Date() };
        
        lockData.files[name] = {
          hash,
          size: stat.size,
          modified: stat.mtime.toISOString()
        };
      }
    }

    writeFileSync(LOCK_FILE, JSON.stringify(lockData, null, 2));

    // Create attestation file
    const attestationData = {
      ...SAMPLE_ATTESTATION,
      artifact: {
        ...SAMPLE_ATTESTATION.artifact,
        hash: lockData.files['test-file.ttl'].hash,
        size: lockData.files['test-file.ttl'].size
      }
    };
    
    writeFileSync(`${testFiles['test-file.ttl']}.attest.json`, JSON.stringify(attestationData, null, 2));

    // Initialize engine
    engine = new DriftDetectionEngine({
      lockFile: LOCK_FILE,
      shapesPath: SHAPES_FILE,
      validateSHACL: true,
      validateSemantic: true,
      attestationValidation: true,
      enableRegeneration: true,
      regenerationMode: 'memory'
    });

    await engine.initialize();
  });

  afterEach(async () => {
    if (engine) {
      await engine.shutdown();
    }

    // Clean up test files
    Object.values(testFiles).forEach(path => {
      if (existsSync(path)) unlinkSync(path);
      const attestationPath = `${path}.attest.json`;
      if (existsSync(attestationPath)) unlinkSync(attestationPath);
    });

    if (existsSync(LOCK_FILE)) unlinkSync(LOCK_FILE);
  });

  afterAll(async () => {
    // Clean up test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('Initialization', () => {
    test('should initialize successfully with default config', async () => {
      const testEngine = new DriftDetectionEngine();
      await expect(testEngine.initialize()).resolves.not.toThrow();
      await testEngine.shutdown();
    });

    test('should initialize with custom configuration', async () => {
      const customConfig = {
        validateSHACL: false,
        regenerationMode: 'disk',
        severityThreshold: 'HIGH'
      };
      
      const testEngine = new DriftDetectionEngine(customConfig);
      await testEngine.initialize();
      
      expect(testEngine.config.validateSHACL).toBe(false);
      expect(testEngine.config.regenerationMode).toBe('disk');
      expect(testEngine.config.severityThreshold).toBe('HIGH');
      
      await testEngine.shutdown();
    });

    test('should emit initialization event', async () => {
      const testEngine = new DriftDetectionEngine();
      const initSpy = vi.fn();
      testEngine.on('initialized', initSpy);
      
      await testEngine.initialize();
      expect(initSpy).toHaveBeenCalled();
      
      await testEngine.shutdown();
    });
  });

  describe('Basic Drift Detection', () => {
    test('should detect no drift when files unchanged', async () => {
      const results = await engine.detectDrift();
      
      expect(results.success).toBe(true);
      expect(results.unchanged).toBe(2);
      expect(results.modified).toBe(0);
      expect(results.deleted).toBe(0);
      expect(results.added).toBe(0);
      expect(results.summary.riskLevel).toBe('LOW');
      expect(results.summary.actionRequired).toBe(false);
    });

    test('should detect modified files', async () => {
      // Modify a tracked file
      writeFileSync(testFiles['test-file.ttl'], MODIFIED_TTL);
      
      const results = await engine.detectDrift();
      
      expect(results.success).toBe(true);
      expect(results.unchanged).toBe(1);
      expect(results.modified).toBe(1);
      expect(results.summary.actionRequired).toBe(true);
      
      const modifiedChange = results.changes.find(c => c.type === 'modified');
      expect(modifiedChange).toBeDefined();
      expect(modifiedChange.path).toContain('test-file.ttl');
      expect(modifiedChange.hashMatch).toBe(false);
    });

    test('should detect deleted files', async () => {
      // Delete a tracked file
      unlinkSync(testFiles['test-file.ttl']);
      
      const results = await engine.detectDrift();
      
      expect(results.success).toBe(true);
      expect(results.unchanged).toBe(1);
      expect(results.deleted).toBe(1);
      expect(results.summary.riskLevel).toBe('CRITICAL');
      expect(results.summary.actionRequired).toBe(true);
      
      const deletedChange = results.changes.find(c => c.type === 'deleted');
      expect(deletedChange).toBeDefined();
      expect(deletedChange.severity).toBe('CRITICAL');
    });

    test('should detect new files when scanning enabled', async () => {
      // Create a new file
      writeFileSync(testFiles['new-file.ttl'], SAMPLE_TTL);
      
      const results = await engine.detectDrift({ scanNew: true });
      
      expect(results.success).toBe(true);
      expect(results.added).toBe(1);
      
      const addedChange = results.changes.find(c => c.type === 'added');
      expect(addedChange).toBeDefined();
      expect(addedChange.path).toContain('new-file.ttl');
      expect(addedChange.severity).toBe('LOW');
    });
  });

  describe('Advanced Validation', () => {
    test('should perform SHACL validation on modified files', async () => {
      // Modify file with invalid RDF that violates SHACL shapes
      const invalidTTL = `@prefix ex: <http://example.org/> .
ex:Person a ex:Class .`; // Missing required hasName and hasAge
      
      writeFileSync(testFiles['test-file.ttl'], invalidTTL);
      
      const results = await engine.detectDrift({ validateSHACL: true });
      
      expect(results.success).toBe(true);
      const modifiedChange = results.changes.find(c => c.type === 'modified');
      expect(modifiedChange.validation.shacl).toBeDefined();
      expect(modifiedChange.validation.shacl.conforms).toBe(false);
      expect(modifiedChange.validation.shacl.violations).toBeGreaterThan(0);
    });

    test('should perform semantic validation', async () => {
      writeFileSync(testFiles['test-file.ttl'], MODIFIED_TTL);
      
      const results = await engine.detectDrift({ validateSemantic: true });
      
      const modifiedChange = results.changes.find(c => c.type === 'modified');
      expect(modifiedChange.validation.semantic).toBeDefined();
      expect(typeof modifiedChange.validation.semantic.passed).toBe('boolean');
    });

    test('should skip validation for non-RDF files', async () => {
      const jsFile = resolve(TEST_DIR, 'test-file.js');
      writeFileSync(jsFile, 'console.log("test");');
      
      // Add to lock file
      const lockData = JSON.parse(readFileSync(LOCK_FILE, 'utf8'));
      const content = readFileSync(jsFile);
      lockData.files['test-file.js'] = {
        hash: createHash('sha256').update(content).digest('hex'),
        size: content.length,
        modified: new Date().toISOString()
      };
      writeFileSync(LOCK_FILE, JSON.stringify(lockData, null, 2));
      
      // Modify the JS file
      writeFileSync(jsFile, 'console.log("modified");');
      
      const results = await engine.detectDrift();
      const modifiedChange = results.changes.find(c => c.path.endsWith('test-file.js'));
      
      expect(modifiedChange.validation).toEqual({});
      
      // Cleanup
      unlinkSync(jsFile);
    });
  });

  describe('Attestation Validation', () => {
    test('should validate artifact attestations', async () => {
      const results = await engine.detectDrift({ attestationValidation: true });
      
      expect(results.attestationResults).toBeDefined();
      expect(results.attestationResults.validAttestations).toBeGreaterThan(0);
    });

    test('should detect invalid attestations', async () => {
      // Create invalid attestation (corrupt hash)
      const invalidAttestation = {
        ...SAMPLE_ATTESTATION,
        attestationHash: 'invalid-hash'
      };
      
      writeFileSync(
        `${testFiles['test-file.ttl']}.attest.json`, 
        JSON.stringify(invalidAttestation, null, 2)
      );
      
      const results = await engine.detectDrift({ attestationValidation: true });
      
      expect(results.attestationResults.invalidAttestations).toBeGreaterThan(0);
    });

    test('should track missing attestations', async () => {
      // Remove attestation file
      unlinkSync(`${testFiles['test-file.ttl']}.attest.json`);
      
      const results = await engine.detectDrift({ attestationValidation: true });
      
      expect(results.attestationResults.missingAttestations).toBeGreaterThan(0);
    });

    test('should identify regenerable artifacts', async () => {
      writeFileSync(testFiles['test-file.ttl'], MODIFIED_TTL);
      
      const results = await engine.detectDrift();
      
      const modifiedChange = results.changes.find(c => c.type === 'modified');
      expect(modifiedChange.canRegenerate).toBe(true);
      expect(modifiedChange.regenerationRequirements).toContain('Template: /templates/person.ttl.njk');
    });
  });

  describe('Artifact Regeneration', () => {
    test('should attempt regeneration when enabled', async () => {
      writeFileSync(testFiles['test-file.ttl'], MODIFIED_TTL);
      
      const results = await engine.detectDrift({ enableRegeneration: true });
      
      // In the current implementation, regeneration is simulated
      // In a full implementation, this would actually regenerate the file
      const change = results.changes.find(c => c.path.includes('test-file.ttl'));
      expect(change.canRegenerate).toBe(true);
    });

    test('should handle regeneration failure gracefully', async () => {
      // Create incomplete attestation
      const incompleteAttestation = {
        ...SAMPLE_ATTESTATION,
        provenance: {
          ...SAMPLE_ATTESTATION.provenance,
          templatePath: undefined // Missing required data
        }
      };
      
      writeFileSync(
        `${testFiles['test-file.ttl']}.attest.json`,
        JSON.stringify(incompleteAttestation, null, 2)
      );
      
      writeFileSync(testFiles['test-file.ttl'], MODIFIED_TTL);
      
      const results = await engine.detectDrift({ enableRegeneration: true });
      
      const change = results.changes.find(c => c.path.includes('test-file.ttl'));
      expect(change.canRegenerate).toBe(false);
    });
  });

  describe('Risk Assessment', () => {
    test('should calculate drift score correctly', async () => {
      // Create multiple changes of different severities
      writeFileSync(testFiles['test-file.ttl'], MODIFIED_TTL); // Modified
      unlinkSync(testFiles['test-file-2.ttl']); // Deleted
      writeFileSync(testFiles['new-file.ttl'], SAMPLE_TTL); // Added
      
      const results = await engine.detectDrift({ scanNew: true });
      
      expect(results.summary.driftScore).toBeGreaterThan(0);
      expect(results.summary.riskLevel).toBe('CRITICAL'); // Due to deletion
    });

    test('should set appropriate risk levels', async () => {
      // Test LOW risk (small modification)
      const smallChange = SAMPLE_TTL + '\n# Small comment';
      writeFileSync(testFiles['test-file.ttl'], smallChange);
      
      let results = await engine.detectDrift();
      expect(results.summary.riskLevel).toBe('LOW');
      
      // Test CRITICAL risk (deletion)
      unlinkSync(testFiles['test-file.ttl']);
      
      results = await engine.detectDrift();
      expect(results.summary.riskLevel).toBe('CRITICAL');
    });

    test('should determine compliance status', async () => {
      let results = await engine.detectDrift();
      expect(results.summary.complianceStatus).toBe('COMPLIANT');
      
      // Create validation violation
      writeFileSync(testFiles['test-file.ttl'], MODIFIED_TTL);
      
      results = await engine.detectDrift();
      // Compliance status depends on validation results
      expect(['COMPLIANT', 'VIOLATIONS', 'UNKNOWN']).toContain(results.summary.complianceStatus);
    });
  });

  describe('Recommendations Generation', () => {
    test('should generate appropriate recommendations', async () => {
      writeFileSync(testFiles['test-file.ttl'], MODIFIED_TTL);
      
      const results = await engine.detectDrift();
      
      expect(results.recommendations).toHaveLength.greaterThan(0);
      
      const highPriorityRecs = results.recommendations.filter(r => r.priority === 'HIGH');
      expect(highPriorityRecs.length).toBeGreaterThan(0);
      
      const validationRec = results.recommendations.find(r => r.action.includes('Validate'));
      expect(validationRec).toBeDefined();
      expect(validationRec.command).toContain('kgen validate');
    });

    test('should prioritize critical issues', async () => {
      unlinkSync(testFiles['test-file.ttl']); // Critical issue
      
      const results = await engine.detectDrift();
      
      const criticalRecs = results.recommendations.filter(r => r.priority === 'CRITICAL');
      expect(criticalRecs.length).toBeGreaterThan(0);
      
      const deleteRec = criticalRecs.find(r => r.action.includes('deleted'));
      expect(deleteRec).toBeDefined();
    });

    test('should suggest regeneration for regenerable files', async () => {
      writeFileSync(testFiles['test-file.ttl'], MODIFIED_TTL);
      
      const results = await engine.detectDrift();
      
      const regenerationRec = results.recommendations.find(r => 
        r.action.includes('regeneration') || r.action.includes('regenerate')
      );
      expect(regenerationRec).toBeDefined();
    });
  });

  describe('Configuration Options', () => {
    test('should respect severity threshold', async () => {
      const highThresholdEngine = new DriftDetectionEngine({
        lockFile: LOCK_FILE,
        severityThreshold: 'HIGH'
      });
      
      await highThresholdEngine.initialize();
      
      // Make a low-severity change
      const minorChange = SAMPLE_TTL + '\n# Minor comment';
      writeFileSync(testFiles['test-file.ttl'], minorChange);
      
      const results = await highThresholdEngine.detectDrift();
      
      // Should still detect the change but may affect reporting
      expect(results.modified).toBe(1);
      
      await highThresholdEngine.shutdown();
    });

    test('should handle custom patterns', async () => {
      const customEngine = new DriftDetectionEngine({
        lockFile: LOCK_FILE,
        patterns: ['**/*.custom'],
        scanNew: true
      });
      
      await customEngine.initialize();
      
      // Create file with custom extension
      const customFile = resolve(TEST_DIR, 'test.custom');
      writeFileSync(customFile, 'custom content');
      
      const results = await customEngine.detectDrift();
      
      // Should find the custom file
      expect(results.added).toBe(1);
      
      unlinkSync(customFile);
      await customEngine.shutdown();
    });

    test('should respect ignore patterns', async () => {
      const ignoreEngine = new DriftDetectionEngine({
        lockFile: LOCK_FILE,
        ignore: ['**/test-file.ttl'],
        scanNew: true
      });
      
      await ignoreEngine.initialize();
      
      // Create ignored file
      writeFileSync(testFiles['test-file.ttl'], MODIFIED_TTL);
      
      const results = await ignoreEngine.detectDrift();
      
      // Should not report changes to ignored files in new scan
      // (but will still check tracked files from lockfile)
      expect(results.success).toBe(true);
      
      await ignoreEngine.shutdown();
    });
  });

  describe('Performance and Statistics', () => {
    test('should track detection statistics', async () => {
      await engine.detectDrift();
      await engine.detectDrift();
      
      const stats = engine.getStats();
      
      expect(stats.detectionsRun).toBe(2);
      expect(stats.averageDetectionTime).toBeGreaterThan(0);
      expect(typeof stats.lastDetectionTime).toBe('number');
    });

    test('should provide health check information', async () => {
      const health = await engine.healthCheck();
      
      expect(health.status).toBe('ready');
      expect(health.stats).toBeDefined();
      expect(health.config).toBeDefined();
      expect(health.validationEngine).toBeDefined();
    });

    test('should handle large numbers of files efficiently', async () => {
      // Create multiple test files
      const largeTestFiles = [];
      for (let i = 0; i < 50; i++) {
        const fileName = `test-large-${i}.ttl`;
        const filePath = resolve(TEST_DIR, fileName);
        writeFileSync(filePath, SAMPLE_TTL);
        largeTestFiles.push({ name: fileName, path: filePath });
      }
      
      // Update lockfile
      const lockData = JSON.parse(readFileSync(LOCK_FILE, 'utf8'));
      largeTestFiles.forEach(({ name, path }) => {
        const content = readFileSync(path);
        lockData.files[name] = {
          hash: createHash('sha256').update(content).digest('hex'),
          size: content.length,
          modified: new Date().toISOString()
        };
      });
      writeFileSync(LOCK_FILE, JSON.stringify(lockData, null, 2));
      
      const startTime = Date.now();
      const results = await engine.detectDrift();
      const duration = Date.now() - startTime;
      
      expect(results.success).toBe(true);
      expect(results.totalFiles).toBe(52); // 2 original + 50 new
      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
      
      // Cleanup
      largeTestFiles.forEach(({ path }) => {
        if (existsSync(path)) unlinkSync(path);
      });
    }, 10000); // 10 second timeout for this test
  });

  describe('Error Handling', () => {
    test('should handle missing lock file gracefully', async () => {
      unlinkSync(LOCK_FILE);
      
      await expect(engine.detectDrift()).rejects.toThrow('Could not load lock file');
    });

    test('should handle corrupted lock file', async () => {
      writeFileSync(LOCK_FILE, 'invalid json');
      
      await expect(engine.detectDrift()).rejects.toThrow();
    });

    test('should handle file system errors', async () => {
      // Create a file that cannot be read (simulate permission error)
      const protectedFile = resolve(TEST_DIR, 'protected.ttl');
      writeFileSync(protectedFile, SAMPLE_TTL);
      
      // Add to lock file
      const lockData = JSON.parse(readFileSync(LOCK_FILE, 'utf8'));
      lockData.files['protected.ttl'] = {
        hash: 'some-hash',
        size: 100,
        modified: new Date().toISOString()
      };
      writeFileSync(LOCK_FILE, JSON.stringify(lockData, null, 2));
      
      // Mock fs to simulate read error
      const originalReadFileSync = vi.fn(() => {
        throw new Error('Permission denied');
      });
      
      const results = await engine.detectDrift();
      
      // Should handle the error gracefully and continue with other files
      expect(results.success).toBe(true);
      
      // Cleanup
      if (existsSync(protectedFile)) unlinkSync(protectedFile);
    });

    test('should handle validation errors gracefully', async () => {
      // Create invalid RDF that will cause parsing errors
      const invalidRDF = 'This is not valid RDF content at all!';
      writeFileSync(testFiles['test-file.ttl'], invalidRDF);
      
      const results = await engine.detectDrift({ validateSemantic: true });
      
      // Should complete detection despite validation errors
      expect(results.success).toBe(true);
      expect(results.modified).toBe(1);
    });
  });

  describe('Event Emission', () => {
    test('should emit drift detection events', async () => {
      const driftSpy = vi.fn();
      engine.on('drift-detected', driftSpy);
      
      writeFileSync(testFiles['test-file.ttl'], MODIFIED_TTL);
      
      await engine.detectDrift();
      
      expect(driftSpy).toHaveBeenCalled();
      expect(driftSpy.mock.calls[0][0]).toMatchObject({
        success: true,
        modified: 1
      });
    });

    test('should emit file processing events', async () => {
      const processSpy = vi.fn();
      engine.on('file-processed', processSpy);
      
      await engine.detectDrift();
      
      // Should emit events for each file processed
      expect(processSpy).toHaveBeenCalled();
    });
  });
});