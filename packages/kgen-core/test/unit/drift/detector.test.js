/**
 * Pure JavaScript Drift Detector Tests
 * Comprehensive test suite for the drift detection system
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import DriftDetector, { 
  detectDrift, 
  calculateDriftScore, 
  generateDriftReport,
  DriftSeverity,
  DriftTypes
} from '../../../src/drift/detector.js';

describe('DriftDetector', () => {
  let detector;

  beforeEach(async () => {
    detector = new DriftDetector({
      tolerance: 0.95,
      algorithm: 'semantic-hash'
    });
    await detector.initialize();
  });

  afterEach(() => {
    if (detector) {
      detector.reset();
    }
  });

  describe('Basic Functionality', () => {
    test('should initialize successfully', async () => {
      const newDetector = new DriftDetector();
      const result = await newDetector.initialize();
      
      expect(result.success).toBe(true);
      expect(result.status).toBe('ready');
      expect(newDetector.status).toBe('ready');
    });

    test('should detect no drift for identical content', async () => {
      const content = 'Hello, World!';
      const result = await detector.detectDrift(content, content);
      
      expect(result.hasDrift).toBe(false);
      expect(result.similarity).toBe(1.0);
      expect(result.driftScore).toBe(0);
      expect(result.differences).toHaveLength(0);
    });

    test('should detect drift for different content', async () => {
      const expected = 'Hello, World!';
      const actual = 'Hello, Universe!';
      const result = await detector.detectDrift(expected, actual);
      
      expect(result.hasDrift).toBe(true);
      expect(result.similarity).toBeLessThan(1.0);
      expect(result.driftScore).toBeGreaterThan(0);
      expect(result.differences.length).toBeGreaterThan(0);
    });

    test('should handle missing data gracefully', async () => {
      const result = await detector.detectDrift('content', null);
      
      expect(result.hasDrift).toBe(true);
      expect(result.driftScore).toBe(1.0);
      expect(result.similarity).toBe(0.0);
      expect(result.differences[0].type).toBe('actual-missing');
    });
  });

  describe('Content Type Detection and Hashing', () => {
    test('should detect JavaScript content type', async () => {
      const jsContent = 'function hello() { return "world"; }';
      const data = { content: jsContent, path: 'test.js' };
      const contentType = detector.detectContentType(data);
      
      expect(contentType).toBe('javascript');
    });

    test('should detect JSON content type', async () => {
      const jsonContent = '{"name": "test", "value": 42}';
      const data = { content: jsonContent, path: 'test.json' };
      const contentType = detector.detectContentType(data);
      
      expect(contentType).toBe('json');
    });

    test('should detect RDF/Turtle content type', async () => {
      const ttlContent = `@prefix ex: <http://example.org/> .
      ex:subject ex:predicate "object" .`;
      const data = { content: ttlContent, path: 'test.ttl' };
      const contentType = detector.detectContentType(data);
      
      expect(contentType).toBe('turtle');
    });

    test('should generate different hashes for different content', async () => {
      const content1 = 'Hello, World!';
      const content2 = 'Hello, Universe!';
      
      const hash1 = detector.generateHash(content1);
      const hash2 = detector.generateHash(content2);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Semantic Hashing', () => {
    test('should generate consistent RDF semantic hashes', async () => {
      const rdfContent1 = `@prefix ex: <http://example.org/> .
      ex:Alice ex:knows ex:Bob .
      ex:Bob ex:knows ex:Charlie .`;
      
      const rdfContent2 = `@prefix ex: <http://example.org/> .
      ex:Bob ex:knows ex:Charlie .
      ex:Alice ex:knows ex:Bob .`; // Different order, same triples
      
      const data1 = { content: rdfContent1, path: 'test1.ttl' };
      const data2 = { content: rdfContent2, path: 'test2.ttl' };
      
      const hash1 = await detector.generateRDFSemanticHash(rdfContent1);
      const hash2 = await detector.generateRDFSemanticHash(rdfContent2);
      
      expect(hash1).toBe(hash2); // Should be identical due to normalization
    });

    test('should normalize JSON structure for semantic hashing', async () => {
      const json1 = '{"b": 2, "a": 1}';
      const json2 = '{"a": 1, "b": 2}';
      
      const hash1 = await detector.generateJSONSemanticHash(json1);
      const hash2 = await detector.generateJSONSemanticHash(json2);
      
      expect(hash1).toBe(hash2); // Should be identical due to key sorting
    });

    test('should normalize code for semantic hashing', async () => {
      const code1 = `function test() {
        // This is a comment
        return 42;
      }`;
      
      const code2 = `function test(){return 42;}`;
      
      const hash1 = await detector.generateCodeSemanticHash(code1);
      const hash2 = await detector.generateCodeSemanticHash(code2);
      
      expect(hash1).toBe(hash2); // Should be identical after normalization
    });
  });

  describe('Drift Score Calculation', () => {
    test('should calculate drift score correctly for no changes', () => {
      const changes = [];
      const score = detector.calculateDriftScore(changes);
      
      expect(score).toBe(0);
    });

    test('should calculate drift score for critical changes', () => {
      const changes = [{
        type: 'semantic-change',
        severity: 'critical'
      }];
      const score = detector.calculateDriftScore(changes);
      
      expect(score).toBeGreaterThan(0.5);
    });

    test('should weight severity and type appropriately', () => {
      const criticalChange = [{
        type: 'semantic-change',
        severity: 'critical'
      }];
      
      const minorChange = [{
        type: 'size-changed',
        severity: 'minor'
      }];
      
      const criticalScore = detector.calculateDriftScore(criticalChange);
      const minorScore = detector.calculateDriftScore(minorChange);
      
      expect(criticalScore).toBeGreaterThan(minorScore);
    });
  });

  describe('File-like Object Handling', () => {
    test('should handle file-like objects with path and content', async () => {
      const expected = {
        path: 'test.js',
        content: 'console.log("hello");'
      };
      
      const actual = {
        path: 'test.js',
        content: 'console.log("goodbye");'
      };
      
      const result = await detector.detectDrift(expected, actual);
      
      expect(result.hasDrift).toBe(true);
      expect(result.differences.length).toBeGreaterThan(0);
    });

    test('should handle objects and serialize them for comparison', async () => {
      const expected = { name: 'John', age: 30 };
      const actual = { name: 'John', age: 31 };
      
      const result = await detector.detectDrift(expected, actual);
      
      expect(result.hasDrift).toBe(true);
      expect(result.differences.length).toBeGreaterThan(0);
    });
  });

  describe('Fingerprint Generation and Comparison', () => {
    test('should generate consistent fingerprints', async () => {
      const data = { content: 'test content', type: 'string', size: 12 };
      
      const fingerprint1 = await detector.generateFingerprint(data);
      const fingerprint2 = await detector.generateFingerprint(data);
      
      expect(fingerprint1.contentHash).toBe(fingerprint2.contentHash);
      expect(fingerprint1.semanticHash).toBe(fingerprint2.semanticHash);
    });

    test('should use cache for repeated fingerprint generation', async () => {
      const data = { content: 'cached content', type: 'string', size: 14 };
      
      // First call - cache miss
      await detector.generateFingerprint(data);
      expect(detector.stats.cacheMisses).toBe(1);
      expect(detector.stats.cacheHits).toBe(0);
      
      // Second call - cache hit
      await detector.generateFingerprint(data);
      expect(detector.stats.cacheHits).toBe(1);
    });

    test('should compare fingerprints accurately', async () => {
      const expected = { contentHash: 'abc123', semanticHash: 'def456', size: 100, type: 'string' };
      const actual = { contentHash: 'abc124', semanticHash: 'def456', size: 100, type: 'string' };
      
      const comparison = await detector.compareFingerprints(expected, actual);
      
      expect(comparison.identical).toBe(false);
      expect(comparison.similarity).toBeLessThan(1.0);
      expect(comparison.driftTypes.content).toBe(true);
      expect(comparison.driftTypes.semantic).toBe(false);
    });
  });

  describe('Report Generation', () => {
    test('should generate basic report', async () => {
      const driftResult = {
        detectionId: 'test-123',
        timestamp: '2025-01-01T00:00:00.000Z',
        hasDrift: true,
        driftScore: 0.3,
        similarity: 0.7,
        driftTypes: { content: true, semantic: false },
        differences: [{ type: 'content-changed', severity: 'major', description: 'Content modified' }],
        recommendations: [{ type: 'content-drift', priority: 'medium', message: 'Review changes' }],
        processingTime: 15.5
      };
      
      const report = detector.generateDriftReport(driftResult);
      
      expect(report.summary.status).toBe('DRIFT_DETECTED');
      expect(report.summary.driftScore).toBe(0.3);
      expect(report.details.differences).toHaveLength(1);
      expect(report.recommendations).toHaveLength(1);
    });

    test('should generate human-readable report', async () => {
      const driftResult = {
        detectionId: 'test-123',
        timestamp: '2025-01-01T00:00:00.000Z',
        hasDrift: true,
        driftScore: 0.3,
        similarity: 0.7,
        differences: [{ type: 'content-changed', severity: 'major', description: 'Content modified' }],
        recommendations: [{ type: 'content-drift', priority: 'medium', message: 'Review changes', action: 'Check diff' }],
        processingTime: 15.5
      };
      
      const report = detector.generateDriftReport(driftResult, { format: 'human' });
      
      expect(report.humanReadable).toContain('DRIFT DETECTION REPORT');
      expect(report.humanReadable).toContain('❌ DRIFT DETECTED');
      expect(report.humanReadable).toContain('DIFFERENCES DETECTED:');
      expect(report.humanReadable).toContain('RECOMMENDATIONS:');
    });

    test('should generate markdown report', async () => {
      const driftResult = {
        detectionId: 'test-123',
        timestamp: '2025-01-01T00:00:00.000Z',
        hasDrift: false,
        driftScore: 0,
        similarity: 1.0,
        differences: [],
        recommendations: [],
        processingTime: 5.2
      };
      
      const report = detector.generateDriftReport(driftResult, { format: 'markdown' });
      
      expect(report).toContain('# KGEN Drift Detection Report');
      expect(report).toContain('**Detection ID**');
      expect(report).toContain('✅ NO DRIFT');
    });
  });

  describe('Real Artifact Comparison Scenarios', () => {
    test('should detect drift in JavaScript code changes', async () => {
      const originalCode = `
        function calculateTotal(items) {
          let total = 0;
          for (const item of items) {
            total += item.price;
          }
          return total;
        }
      `;
      
      const modifiedCode = `
        function calculateTotal(items) {
          return items.reduce((sum, item) => sum + item.price, 0);
        }
      `;
      
      const result = await detector.detectDrift(
        { path: 'calculator.js', content: originalCode },
        { path: 'calculator.js', content: modifiedCode }
      );
      
      expect(result.hasDrift).toBe(true);
      expect(result.driftTypes.content).toBe(true);
      expect(result.driftTypes.semantic).toBe(true); // Logic changed
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    test('should detect minimal drift in whitespace-only changes', async () => {
      const original = `{"name":"test","value":42}`;
      const formatted = `{
  "name": "test",
  "value": 42
}`;
      
      const result = await detector.detectDrift(original, formatted);
      
      expect(result.hasDrift).toBe(true);
      expect(result.driftTypes.content).toBe(true);
      expect(result.driftTypes.semantic).toBe(false); // JSON semantic meaning unchanged
      expect(result.similarity).toBeGreaterThan(0.8); // Should be high similarity
    });

    test('should detect semantic drift in RDF data', async () => {
      const originalRDF = `
        @prefix ex: <http://example.org/> .
        ex:Alice ex:knows ex:Bob .
        ex:Bob ex:age "25"^^xsd:int .
      `;
      
      const modifiedRDF = `
        @prefix ex: <http://example.org/> .
        ex:Alice ex:knows ex:Bob .
        ex:Bob ex:age "30"^^xsd:int .
      `;
      
      const result = await detector.detectDrift(
        { path: 'data.ttl', content: originalRDF },
        { path: 'data.ttl', content: modifiedRDF }
      );
      
      expect(result.hasDrift).toBe(true);
      expect(result.driftTypes.semantic).toBe(true);
      expect(result.recommendations.some(r => r.type === 'semantic-drift')).toBe(true);
    });

    test('should handle configuration object comparison', async () => {
      const originalConfig = {
        database: {
          host: 'localhost',
          port: 5432,
          name: 'myapp'
        },
        cache: {
          enabled: true,
          ttl: 3600
        }
      };
      
      const modifiedConfig = {
        database: {
          host: 'localhost',
          port: 5432,
          name: 'myapp_prod'  // Changed database name
        },
        cache: {
          enabled: true,
          ttl: 7200  // Changed TTL
        }
      };
      
      const result = await detector.detectDrift(originalConfig, modifiedConfig);
      
      expect(result.hasDrift).toBe(true);
      expect(result.driftTypes.content).toBe(true);
      expect(result.driftTypes.semantic).toBe(true);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and Statistics', () => {
    test('should track performance statistics', async () => {
      await detector.detectDrift('content1', 'content2');
      await detector.detectDrift('content3', 'content4');
      
      const stats = detector.getStats();
      
      expect(stats.comparisons).toBe(2);
      expect(stats.driftDetected).toBe(2);
      expect(stats.totalProcessingTime).toBeGreaterThan(0);
      expect(stats.averageProcessingTime).toBeGreaterThan(0);
    });

    test('should calculate cache efficiency', async () => {
      const content = 'repeated content';
      
      // Generate some cache hits and misses
      await detector.detectDrift(content, content);
      await detector.detectDrift(content, content + ' modified');
      
      const stats = detector.getStats();
      
      expect(stats.cacheHits).toBeGreaterThanOrEqual(0);
      expect(stats.cacheMisses).toBeGreaterThan(0);
      expect(stats.cacheEfficiency).toBeGreaterThanOrEqual(0);
    });

    test('should provide health check information', () => {
      const health = detector.healthCheck();
      
      expect(health.status).toBe('ready');
      expect(health.stats).toBeDefined();
      expect(health.cacheSize).toBeDefined();
      expect(health.options).toBeDefined();
    });
  });

  describe('Recommendation System', () => {
    test('should recommend no action for identical content', async () => {
      const result = await detector.detectDrift('same', 'same');
      
      expect(result.recommendations).toHaveLength(1);
      expect(result.recommendations[0].type).toBe('no-action');
      expect(result.recommendations[0].priority).toBe('info');
    });

    test('should recommend high-priority actions for critical drift', async () => {
      // Mock a high-drift scenario
      const driftResult = {
        hasDrift: true,
        driftScore: 0.85,
        similarity: 0.15,
        driftTypes: { content: true, semantic: true }
      };
      
      const recommendations = detector.generateRecommendations(driftResult);
      
      expect(recommendations.some(r => r.priority === 'critical')).toBe(true);
      expect(recommendations.some(r => r.type === 'high-drift')).toBe(true);
    });
  });
});

describe('Utility Functions', () => {
  test('detectDrift utility function should work', async () => {
    const result = await detectDrift('hello', 'world');
    
    expect(result.hasDrift).toBe(true);
    expect(result.driftScore).toBeGreaterThan(0);
  });

  test('calculateDriftScore utility function should work', () => {
    const changes = [
      { type: 'content-changed', severity: 'major' },
      { type: 'size-changed', severity: 'minor' }
    ];
    
    const score = calculateDriftScore(changes);
    
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  test('generateDriftReport utility function should work', () => {
    const drift = {
      detectionId: 'test-456',
      timestamp: '2025-01-01T00:00:00.000Z',
      hasDrift: true,
      driftScore: 0.4,
      similarity: 0.6,
      differences: [],
      recommendations: []
    };
    
    const report = generateDriftReport(drift);
    
    expect(report.summary.status).toBe('DRIFT_DETECTED');
    expect(report.metadata.detectionId).toBe('test-456');
  });
});

describe('Constants and Enums', () => {
  test('should export DriftSeverity constants', () => {
    expect(DriftSeverity.CRITICAL).toBe('critical');
    expect(DriftSeverity.MAJOR).toBe('major');
    expect(DriftSeverity.MINOR).toBe('minor');
    expect(DriftSeverity.INFO).toBe('info');
  });

  test('should export DriftTypes constants', () => {
    expect(DriftTypes.CONTENT).toBe('content-changed');
    expect(DriftTypes.SEMANTIC).toBe('semantic-change');
    expect(DriftTypes.STRUCTURE).toBe('structure-changed');
    expect(DriftTypes.METADATA).toBe('metadata-changed');
    expect(DriftTypes.SIZE).toBe('size-changed');
    expect(DriftTypes.NEW_FILE).toBe('new-file');
    expect(DriftTypes.FILE_DELETED).toBe('file-deleted');
  });
});

describe('Error Handling', () => {
  test('should handle invalid JSON gracefully', async () => {
    const invalidJSON = '{ invalid json content }';
    const validJSON = '{"valid": true}';
    
    const result = await detectDrift(
      { path: 'test.json', content: validJSON },
      { path: 'test.json', content: invalidJSON }
    );
    
    expect(result.hasDrift).toBe(true);
    // Should fallback to content hash comparison
  });

  test('should handle empty content', async () => {
    const result = await detectDrift('', '');
    
    expect(result.hasDrift).toBe(false);
    expect(result.similarity).toBe(1.0);
  });

  test('should handle undefined/null inputs gracefully', async () => {
    const detector = new DriftDetector();
    await detector.initialize();
    
    const result1 = await detector.detectDrift(undefined, 'content');
    const result2 = await detector.detectDrift('content', null);
    
    expect(result1.hasDrift).toBe(true);
    expect(result2.hasDrift).toBe(true);
    expect(result1.driftScore).toBe(1.0);
    expect(result2.driftScore).toBe(1.0);
  });
});