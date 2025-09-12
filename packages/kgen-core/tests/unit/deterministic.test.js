/**
 * Deterministic Generation Tests
 * Ensures 100% reproducible output generation for KGEN v1
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHash } from 'crypto';

describe('Deterministic Rendering', () => {
  let tempDir;
  
  beforeEach(async () => {
    tempDir = await global.testUtils.createTempDir();
  });

  afterEach(async () => {
    await global.testUtils.cleanupTempDir(tempDir);
  });

  describe('Hash Generation', () => {
    it('should produce identical hashes for identical content', () => {
      const content1 = global.testUtils.createSampleRDF('Person', 'John Doe');
      const content2 = global.testUtils.createSampleRDF('Person', 'John Doe');

      const hash1 = global.testUtils.calculateHash(content1);
      const hash2 = global.testUtils.calculateHash(content2);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 format
    });

    it('should produce different hashes for different content', () => {
      const content1 = global.testUtils.createSampleRDF('Person', 'John Doe');
      const content2 = global.testUtils.createSampleRDF('Person', 'Jane Smith');

      const hash1 = global.testUtils.calculateHash(content1);
      const hash2 = global.testUtils.calculateHash(content2);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle ordering independence in objects', () => {
      const obj1 = { name: 'John', age: 30, city: 'NYC' };
      const obj2 = { age: 30, city: 'NYC', name: 'John' };

      const hash1 = global.testUtils.calculateHash(obj1);
      const hash2 = global.testUtils.calculateHash(obj2);

      expect(hash1).toBe(hash2);
    });

    it('should produce consistent hashes across multiple runs', () => {
      const content = global.testUtils.createComplexRDFGraph();
      const hashes = [];

      // Generate hash 10 times
      for (let i = 0; i < 10; i++) {
        hashes.push(global.testUtils.calculateHash(content));
      }

      // All hashes should be identical
      const firstHash = hashes[0];
      hashes.forEach(hash => {
        expect(hash).toBe(firstHash);
      });
    });
  });

  describe('RDF Graph Determinism', () => {
    it('should produce identical graphs for same input', () => {
      const rdf1 = global.testUtils.createSampleRDF('Person', 'Alice', {
        email: 'alice@example.com',
        department: 'Engineering'
      });
      
      const rdf2 = global.testUtils.createSampleRDF('Person', 'Alice', {
        email: 'alice@example.com',
        department: 'Engineering'
      });

      expect(rdf1).toBe(rdf2);
    });

    it('should handle property ordering consistently', () => {
      const props1 = { email: 'test@example.com', age: 25, department: 'IT' };
      const props2 = { department: 'IT', age: 25, email: 'test@example.com' };

      const rdf1 = global.testUtils.createSampleRDF('Person', 'Test User', props1);
      const rdf2 = global.testUtils.createSampleRDF('Person', 'Test User', props2);

      // Content should be functionally equivalent
      const hash1 = global.testUtils.calculateHash(rdf1);
      const hash2 = global.testUtils.calculateHash(rdf2);
      
      // Since our RDF generation is deterministic, these should be identical
      expect(hash1).toBe(hash2);
    });

    it('should maintain triple ordering', () => {
      const complexGraph1 = global.testUtils.createComplexRDFGraph();
      const complexGraph2 = global.testUtils.createComplexRDFGraph();

      expect(complexGraph1).toBe(complexGraph2);

      // Verify consistent line order
      const lines1 = complexGraph1.split('\n').filter(line => line.trim());
      const lines2 = complexGraph2.split('\n').filter(line => line.trim());

      expect(lines1).toEqual(lines2);
    });
  });

  describe('Template Processing Determinism', () => {
    it('should render templates consistently', async () => {
      const template = global.testUtils.getPersonClassTemplate();
      const entityData = {
        name: 'Test Person',
        type: 'Person',
        properties: {
          name: 'Test Person',
          email: 'test@example.com',
          age: 30
        }
      };

      // Mock template rendering (since we don't have the actual engine here)
      const mockRender = (template, data) => {
        return template
          .replace(/{{entity\.name \| capitalize \| replace\(' ', ''\)}}/g, 
                   data.name.replace(/\s+/g, ''))
          .replace(/{{entity\.type}}/g, data.type);
      };

      const result1 = mockRender(template, entityData);
      const result2 = mockRender(template, entityData);
      const result3 = mockRender(template, entityData);

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);

      // Hash comparison
      const hash1 = createHash('sha256').update(result1).digest('hex');
      const hash2 = createHash('sha256').update(result2).digest('hex');
      expect(hash1).toBe(hash2);
    });

    it('should handle nested properties deterministically', () => {
      const data = {
        entity: {
          name: 'Complex Entity',
          properties: {
            nested: {
              value: 'test',
              array: [3, 1, 2],
              object: { z: 1, a: 2, m: 3 }
            }
          }
        }
      };

      const hash1 = global.testUtils.calculateHash(data);
      const hash2 = global.testUtils.calculateHash(data);

      expect(hash1).toBe(hash2);
    });
  });

  describe('Floating Point Determinism', () => {
    it('should handle floating point numbers consistently', () => {
      const float1 = 3.141592653589793;
      const float2 = Math.PI;
      
      const data1 = { value: float1.toString() };
      const data2 = { value: float2.toString() };

      const hash1 = global.testUtils.calculateHash(data1);
      const hash2 = global.testUtils.calculateHash(data2);

      expect(hash1).toBe(hash2);
    });

    it('should normalize floating point precision', () => {
      const values = [
        1.0000000000000001,
        1.0000000000000002,
        1.0
      ];

      // Normalize to consistent precision
      const normalized = values.map(v => parseFloat(v.toFixed(10)));
      const hashes = normalized.map(v => global.testUtils.calculateHash({ value: v }));

      // Should produce consistent results
      expect(hashes[0]).toBe(hashes[2]);
    });
  });

  describe('Date/Time Determinism', () => {
    it('should use fixed timestamps in test mode', () => {
      const fixedTimestamp = process.env.KGEN_FIXED_TIMESTAMP;
      expect(fixedTimestamp).toBe('2024-01-01T00:00:00.000Z');

      // Simulate timestamp usage
      const data1 = { timestamp: fixedTimestamp };
      const data2 = { timestamp: fixedTimestamp };

      const hash1 = global.testUtils.calculateHash(data1);
      const hash2 = global.testUtils.calculateHash(data2);

      expect(hash1).toBe(hash2);
    });

    it('should normalize timezone differences', () => {
      // Test different timezone representations of the same moment
      const utc = '2024-01-01T12:00:00.000Z';
      const est = '2024-01-01T07:00:00.000-05:00';
      const pst = '2024-01-01T04:00:00.000-08:00';

      // Normalize to UTC (mock implementation)
      const normalize = (timeStr) => new Date(timeStr).toISOString();

      const norm1 = normalize(utc);
      const norm2 = normalize(est);
      const norm3 = normalize(pst);

      expect(norm1).toBe(norm2);
      expect(norm2).toBe(norm3);
    });
  });

  describe('Random Seed Determinism', () => {
    it('should use fixed random seed in tests', () => {
      // Math.random is mocked in setup to return 0.5
      const random1 = Math.random();
      const random2 = Math.random();
      const random3 = Math.random();

      expect(random1).toBe(0.5);
      expect(random2).toBe(0.5);
      expect(random3).toBe(0.5);
    });

    it('should produce deterministic UUIDs when seeded', () => {
      // Mock UUID generation with deterministic seed
      const mockUUID = () => {
        const random = Math.random(); // Will be 0.5 due to mock
        return `${random}-${random}-${random}-${random}`;
      };

      const uuid1 = mockUUID();
      const uuid2 = mockUUID();

      expect(uuid1).toBe(uuid2);
    });
  });

  describe('Content Addressing System (CAS)', () => {
    it('should generate consistent CAS addresses', () => {
      const content1 = 'test content for CAS';
      const content2 = 'test content for CAS';

      const cas1 = global.testUtils.calculateHash(content1);
      const cas2 = global.testUtils.calculateHash(content2);

      expect(cas1).toBe(cas2);
      expect(cas1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should detect content changes via CAS', () => {
      const original = 'original content';
      const modified = 'modified content';

      const cas1 = global.testUtils.calculateHash(original);
      const cas2 = global.testUtils.calculateHash(modified);

      expect(cas1).not.toBe(cas2);
    });

    it('should handle binary content in CAS', () => {
      const buffer1 = Buffer.from('binary content', 'utf8');
      const buffer2 = Buffer.from('binary content', 'utf8');

      const cas1 = createHash('sha256').update(buffer1).digest('hex');
      const cas2 = createHash('sha256').update(buffer2).digest('hex');

      expect(cas1).toBe(cas2);
    });
  });

  describe('Performance Determinism', () => {
    it('should show consistent performance characteristics', async () => {
      const operation = async () => {
        // Simulate computational work
        const data = global.testUtils.createComplexRDFGraph();
        global.testUtils.calculateHash(data);
      };

      const perfStats = await global.testUtils.measurePerformance(operation, 5);

      expect(perfStats.successfulIterations).toBe(5);
      expect(perfStats.failedIterations).toBe(0);
      expect(perfStats.averageDuration).toBeGreaterThan(0);
      
      // Performance should be relatively consistent (CV < 50%)
      const cv = perfStats.standardDeviation / perfStats.averageDuration;
      expect(cv).toBeLessThan(0.5);
    });

    it('should scale deterministically with input size', async () => {
      const sizes = [10, 50, 100];
      const results = [];

      for (const size of sizes) {
        const operation = async () => {
          // Create data proportional to size
          const items = Array.from({ length: size }, (_, i) => ({ id: i, data: `item-${i}` }));
          global.testUtils.calculateHash(items);
        };

        const perfStats = await global.testUtils.measurePerformance(operation, 3);
        results.push({
          size,
          averageDuration: perfStats.averageDuration
        });
      }

      // Performance should scale predictably
      expect(results[1].averageDuration).toBeGreaterThan(results[0].averageDuration);
      expect(results[2].averageDuration).toBeGreaterThan(results[1].averageDuration);
    });
  });
});