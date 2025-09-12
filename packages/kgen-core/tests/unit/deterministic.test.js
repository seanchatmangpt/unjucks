/**
 * Deterministic Generation Tests
 * Ensures byte-for-byte reproducible output generation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHash } from 'crypto';
import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { KGenEngine } from '../../src/engine.js';
import { TemplateProcessor } from '../../src/templating/processor.js';

describe('Deterministic Generation', () => {
  let engine;
  let processor;
  let outputDir;
  let testGraphs;
  let testTemplates;

  beforeEach(() => {
    outputDir = testUtils.createTempDir();
    
    engine = new KGenEngine({
      mode: 'test',
      enableCache: false,
      deterministicMode: true,
      outputDir
    });
    
    processor = new TemplateProcessor({
      deterministicMode: true,
      sortKeys: true,
      normalizeWhitespace: true
    });

    // Load test fixtures
    testGraphs = {
      simple: readFileSync(resolve(__TEST_FIXTURES__, 'graphs', 'simple-person.ttl'), 'utf-8'),
      complex: readFileSync(resolve(__TEST_FIXTURES__, 'graphs', 'complex-hierarchy.ttl'), 'utf-8')
    };
    
    testTemplates = {
      person: JSON.parse(readFileSync(resolve(__TEST_FIXTURES__, 'templates', 'person-template.json'), 'utf-8')),
      hierarchy: JSON.parse(readFileSync(resolve(__TEST_FIXTURES__, 'templates', 'hierarchy-template.json'), 'utf-8'))
    };
  });

  afterEach(() => {
    testUtils.cleanupTempDir(outputDir);
  });

  describe('byte-for-byte reproducibility', () => {
    it('should generate identical output for same input', async () => {
      await engine.initialize();
      
      // First generation
      const result1 = await engine.generate({
        graph: testGraphs.simple,
        template: testTemplates.person,
        outputPath: resolve(outputDir, 'output1.ts')
      });
      
      // Second generation
      const result2 = await engine.generate({
        graph: testGraphs.simple,
        template: testTemplates.person,
        outputPath: resolve(outputDir, 'output2.ts')
      });
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      
      const content1 = readFileSync(resolve(outputDir, 'output1.ts'), 'utf-8');
      const content2 = readFileSync(resolve(outputDir, 'output2.ts'), 'utf-8');
      
      // Byte-for-byte identical
      expect(content1).toBe(content2);
      
      // Same hash
      const hash1 = createHash('sha256').update(content1).digest('hex');
      const hash2 = createHash('sha256').update(content2).digest('hex');
      expect(hash1).toBe(hash2);
    });

    it('should generate identical output across multiple runs', async () => {
      await engine.initialize();
      
      const hashes = [];
      const outputs = [];
      
      // Generate same output 5 times
      for (let i = 0; i < 5; i++) {
        const result = await engine.generate({
          graph: testGraphs.complex,
          template: testTemplates.hierarchy,
          outputPath: resolve(outputDir, `run${i}.ts`)
        });
        
        expect(result.success).toBe(true);
        
        const content = readFileSync(resolve(outputDir, `run${i}.ts`), 'utf-8');
        const hash = createHash('sha256').update(content).digest('hex');
        
        outputs.push(content);
        hashes.push(hash);
      }
      
      // All outputs should be identical
      for (let i = 1; i < outputs.length; i++) {
        expect(outputs[i]).toBe(outputs[0]);
        expect(hashes[i]).toBe(hashes[0]);
      }
    });

    it('should handle empty graphs deterministically', async () => {
      await engine.initialize();
      
      const emptyGraph = '@prefix ex: <http://example.org/> .';
      
      const results = [];
      for (let i = 0; i < 3; i++) {
        const result = await engine.generate({
          graph: emptyGraph,
          template: testTemplates.person,
          outputPath: resolve(outputDir, `empty${i}.ts`)
        });
        
        expect(result.success).toBe(true);
        
        const content = readFileSync(resolve(outputDir, `empty${i}.ts`), 'utf-8');
        results.push(content);
      }
      
      // All empty results should be identical
      expect(results[1]).toBe(results[0]);
      expect(results[2]).toBe(results[0]);
    });
  });

  describe('checksum verification', () => {
    it('should generate consistent checksums', async () => {
      await engine.initialize();
      
      const result = await engine.generate({
        graph: testGraphs.simple,
        template: testTemplates.person,
        outputPath: resolve(outputDir, 'checksum-test.ts'),
        generateChecksum: true
      });
      
      expect(result.success).toBe(true);
      expect(result.checksum).toBeDefined();
      expect(result.checksum.algorithm).toBe('sha256');
      expect(result.checksum.value).toMatch(/^[a-f0-9]{64}$/);
      
      // Verify checksum matches actual file content
      const content = readFileSync(resolve(outputDir, 'checksum-test.ts'), 'utf-8');
      const actualChecksum = createHash('sha256').update(content).digest('hex');
      
      expect(result.checksum.value).toBe(actualChecksum);
    });

    it('should detect changes in generated output', async () => {
      await engine.initialize();
      
      // Generate initial file
      const result1 = await engine.generate({
        graph: testGraphs.simple,
        template: testTemplates.person,
        outputPath: resolve(outputDir, 'change-test.ts'),
        generateChecksum: true
      });
      
      // Manually modify the file
      const filePath = resolve(outputDir, 'change-test.ts');
      let content = readFileSync(filePath, 'utf-8');
      content += '\n// Manual modification';
      writeFileSync(filePath, content);
      
      // Regenerate and compare checksums
      const result2 = await engine.generate({
        graph: testGraphs.simple,
        template: testTemplates.person,
        outputPath: resolve(outputDir, 'change-test-new.ts'),
        generateChecksum: true
      });
      
      expect(result1.checksum.value).not.toBe(result2.checksum.value);
    });
  });

  describe('template processing determinism', () => {
    it('should sort object keys consistently', async () => {
      const template = {
        name: 'sort-test',
        outputTemplate: {
          template: JSON.stringify({
            zebra: '{{#each results}}{{name}}{{/each}}',
            alpha: '{{#each results}}{{email}}{{/each}}',
            beta: '{{#each results}}{{id}}{{/each}}'
          }, null, 2)
        }
      };
      
      const results = [];
      for (let i = 0; i < 3; i++) {
        const result = await processor.process({
          template,
          data: {
            results: [
              { name: 'John', email: 'john@example.com', id: '1' },
              { name: 'Jane', email: 'jane@example.com', id: '2' }
            ]
          }
        });
        
        results.push(result.output);
      }
      
      // All should be identical with sorted keys
      expect(results[1]).toBe(results[0]);
      expect(results[2]).toBe(results[0]);
      
      // Verify keys are actually sorted
      const parsed = JSON.parse(results[0]);
      const keys = Object.keys(parsed);
      expect(keys).toEqual(['alpha', 'beta', 'zebra']);
    });

    it('should normalize whitespace consistently', async () => {
      const template = {
        name: 'whitespace-test',
        outputTemplate: {
          template: `
            export const data = {
              \t\tname: "{{name}}",
              \n\n\n    age: {{age}}
            };
          `
        }
      };
      
      const results = [];
      for (let i = 0; i < 3; i++) {
        const result = await processor.process({
          template,
          data: { name: 'Test', age: 25 }
        });
        
        results.push(result.output);
      }
      
      // All normalized whitespace should be identical
      expect(results[1]).toBe(results[0]);
      expect(results[2]).toBe(results[0]);
      
      // Verify whitespace is normalized (no excessive newlines/tabs)
      expect(results[0]).not.toContain('\n\n\n');
      expect(results[0]).not.toContain('\t\t\t');
    });
  });

  describe('date/time determinism', () => {
    it('should use deterministic timestamps when configured', async () => {
      await engine.initialize();
      
      // Configure deterministic timestamps
      engine.config.deterministicTimestamps = true;
      engine.config.fixedTimestamp = '2024-01-01T00:00:00.000Z';
      
      const template = {
        ...testTemplates.person,
        outputTemplate: {
          template: `// Generated at {{timestamp}}\nexport const data = {{json results}};`
        }
      };
      
      const results = [];
      for (let i = 0; i < 3; i++) {
        const result = await engine.generate({
          graph: testGraphs.simple,
          template,
          outputPath: resolve(outputDir, `timestamp${i}.ts`)
        });
        
        expect(result.success).toBe(true);
        
        const content = readFileSync(resolve(outputDir, `timestamp${i}.ts`), 'utf-8');
        results.push(content);
      }
      
      // All should have same timestamp
      expect(results[1]).toBe(results[0]);
      expect(results[2]).toBe(results[0]);
      
      // Verify fixed timestamp is used
      expect(results[0]).toContain('2024-01-01T00:00:00.000Z');
    });

    it('should handle timezone normalization', async () => {
      await engine.initialize();
      
      // Test with different timezone settings
      const originalTZ = process.env.TZ;
      
      try {
        const results = [];
        const timezones = ['UTC', 'America/New_York', 'Asia/Tokyo'];
        
        for (const tz of timezones) {
          process.env.TZ = tz;
          
          const result = await engine.generate({
            graph: testGraphs.simple,
            template: {
              ...testTemplates.person,
              outputTemplate: {
                template: `// TZ: ${tz}\nexport const data = {{json results}};`
              }
            },
            outputPath: resolve(outputDir, `tz-${tz.replace('/', '-')}.ts`),
            deterministicMode: true,
            normalizeTimezone: true
          });
          
          expect(result.success).toBe(true);
          
          const content = readFileSync(resolve(outputDir, `tz-${tz.replace('/', '-')}.ts`), 'utf-8');
          results.push(content.replace(`// TZ: ${tz}`, '// TZ: NORMALIZED'));
        }
        
        // Content should be identical after timezone normalization
        expect(results[1]).toBe(results[0]);
        expect(results[2]).toBe(results[0]);
        
      } finally {
        process.env.TZ = originalTZ;
      }
    });
  });

  describe('floating point determinism', () => {
    it('should handle floating point numbers consistently', async () => {
      const graphWithFloats = `
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        
        ex:measurement1 ex:value "3.141592653589793"^^xsd:double .
        ex:measurement2 ex:value "2.718281828459045"^^xsd:double .
        ex:measurement3 ex:value "1.4142135623730951"^^xsd:double .
      `;
      
      const template = {
        name: 'float-test',
        sparqlQuery: 'SELECT ?measurement ?value WHERE { ?measurement ex:value ?value }',
        outputTemplate: {
          template: `{{#each results}}{{measurement}}: {{value}}\n{{/each}}`
        }
      };
      
      await engine.initialize();
      
      const results = [];
      for (let i = 0; i < 5; i++) {
        const result = await engine.generate({
          graph: graphWithFloats,
          template,
          outputPath: resolve(outputDir, `float${i}.txt`)
        });
        
        expect(result.success).toBe(true);
        
        const content = readFileSync(resolve(outputDir, `float${i}.txt`), 'utf-8');
        results.push(content);
      }
      
      // All floating point representations should be identical
      for (let i = 1; i < results.length; i++) {
        expect(results[i]).toBe(results[0]);
      }
    });
  });

  describe('sort order determinism', () => {
    it('should sort query results consistently', async () => {
      await engine.initialize();
      
      const template = {
        ...testTemplates.hierarchy,
        sparqlQuery: 'PREFIX skos: <http://www.w3.org/2004/02/skos/core#> SELECT ?concept ?label WHERE { ?concept skos:prefLabel ?label } ORDER BY ?label',
        outputTemplate: {
          template: `{{#each results}}{{concept}}: {{label}}\n{{/each}}`
        }
      };
      
      const results = [];
      for (let i = 0; i < 3; i++) {
        const result = await engine.generate({
          graph: testGraphs.complex,
          template,
          outputPath: resolve(outputDir, `sorted${i}.txt`)
        });
        
        expect(result.success).toBe(true);
        
        const content = readFileSync(resolve(outputDir, `sorted${i}.txt`), 'utf-8');
        results.push(content);
      }
      
      // All should have identical sort order
      expect(results[1]).toBe(results[0]);
      expect(results[2]).toBe(results[0]);
      
      // Verify results are actually sorted
      const lines = results[0].trim().split('\n');
      const labels = lines.map(line => line.split(': ')[1]);
      const sortedLabels = [...labels].sort();
      expect(labels).toEqual(sortedLabels);
    });
  });

  describe('cross-platform determinism', () => {
    it('should generate identical output across different line endings', async () => {
      await engine.initialize();
      
      const template = {
        name: 'lineending-test',
        outputTemplate: {
          template: `line1\nline2\r\nline3\rline4`
        }
      };
      
      const result = await engine.generate({
        graph: testGraphs.simple,
        template,
        outputPath: resolve(outputDir, 'lineending.txt'),
        normalizeLineEndings: true
      });
      
      expect(result.success).toBe(true);
      
      const content = readFileSync(resolve(outputDir, 'lineending.txt'), 'utf-8');
      
      // Should normalize to LF only
      expect(content).not.toContain('\r\n');
      expect(content).not.toContain('\r');
      expect(content.split('\n')).toHaveLength(5); // 4 lines + empty at end
    });
  });
});
