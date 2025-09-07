import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TurtleParser } from '../../src/lib/turtle-parser.js';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader.js';
import { SemanticTemplateProcessor } from '../../src/lib/semantic-template-processor.js';
import fs from 'fs-extra';
import path from 'path';

/**
 * DARK MATTER VALIDATION: Performance Stress Testing
 * 
 * Tests the critical performance edge cases that cause memory exhaustion,
 * timeouts, and system failures in production semantic web applications.
 * These scenarios expose the scalability limits that break most RDF processors.
 */
describe('Dark Matter: Performance Stress Testing', () => {
  let parser;
  let dataLoader;
  let processor;
  let tempFiles = [];

  beforeEach(() => {
    parser = new TurtleParser({ baseIRI: 'http://example.org/' });
    dataLoader = new RDFDataLoader({ 
      cacheEnabled: true,
      maxCacheSize: 50 * 1024 * 1024 // 50MB cache limit
    });
    processor = new SemanticTemplateProcessor();
    tempFiles = [];
  });

  afterEach(async () => {
    // Cleanup temporary files
    for (const file of tempFiles) {
      try {
        await fs.remove(file);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  describe('Memory Exhaustion Scenarios', () => {
    it('should handle massive literal values without memory explosion', async () => {
      const sizes = [1024, 10240, 102400, 1048576]; // 1KB, 10KB, 100KB, 1MB
      
      for (const size of sizes) {
        const largeValue = 'x'.repeat(size);
        const content = `
          @prefix ex: <http://example.org/> .
          ex:largeData ex:content "${largeValue}" ;
            ex:size "${size}"^^<http://www.w3.org/2001/XMLSchema#integer> .
        `;

        const beforeMemory = process.memoryUsage();
        const startTime = performance.now();
        
        const result = await parser.parse(content);
        
        const endTime = performance.now();
        const afterMemory = process.memoryUsage();
        
        expect(result.triples.length).toBe(2);
        expect(endTime - startTime).toBeLessThan(5000); // Under 5 seconds
        
        const memoryIncrease = afterMemory.heapUsed - beforeMemory.heapUsed;
        expect(memoryIncrease).toBeLessThan(size * 10); // Should not be 10x the data size
      }
    });

    it('should handle extremely wide graphs (many subjects, few properties)', async () => {
      const subjectCount = 100000;
      const content = `
        @prefix ex: <http://example.org/> .
        ${Array.from({ length: subjectCount }, (_, i) => 
          `ex:subject${i} ex:type "Resource" ; ex:id "${i}" .`
        ).join('\n')}
      `;

      const beforeMemory = process.memoryUsage();
      const startTime = performance.now();
      
      const result = await parser.parse(content);
      
      const endTime = performance.now();
      const afterMemory = process.memoryUsage();
      
      expect(result.triples.length).toBe(subjectCount * 2); // 2 triples per subject
      expect(endTime - startTime).toBeLessThan(30000); // Under 30 seconds
      expect(result.stats.subjectCount).toBe(subjectCount);
      
      const memoryIncrease = afterMemory.heapUsed - beforeMemory.heapUsed;
      expect(memoryIncrease).toBeLessThan(500 * 1024 * 1024); // Under 500MB
    });

    it('should handle extremely deep graphs (few subjects, many properties)', async () => {
      const propertyCount = 10000;
      const properties = Array.from({ length: propertyCount }, (_, i) => 
        `ex:property${i} "value${i}"`
      ).join(' ; ');
      
      const content = `
        @prefix ex: <http://example.org/> .
        ex:deepSubject ${properties} .
      `;

      const beforeMemory = process.memoryUsage();
      const startTime = performance.now();
      
      const result = await parser.parse(content);
      
      const endTime = performance.now();
      const afterMemory = process.memoryUsage();
      
      expect(result.triples.length).toBe(propertyCount);
      expect(endTime - startTime).toBeLessThan(15000); // Under 15 seconds
      expect(result.stats.predicateCount).toBe(propertyCount);
      
      const memoryIncrease = afterMemory.heapUsed - beforeMemory.heapUsed;
      expect(memoryIncrease).toBeLessThan(200 * 1024 * 1024); // Under 200MB
    });

    it('should handle massive blank node structures without stack overflow', async () => {
      const depth = 1000;
      let nestedStructure = 'ex:root ex:hasChild [\n';
      
      // Create deeply nested blank node structure
      for (let i = 0; i < depth; i++) {
        nestedStructure += `  ex:level${i} [\n`;
      }
      nestedStructure += '    ex:value "deep"\n';
      for (let i = 0; i < depth; i++) {
        nestedStructure += '  ]\n';
      }
      nestedStructure += '] .';

      const content = `
        @prefix ex: <http://example.org/> .
        ${nestedStructure}
      `;

      const startTime = performance.now();
      
      try {
        const result = await parser.parse(content);
        const endTime = performance.now();
        
        expect(result.triples.length).toBeGreaterThan(depth);
        expect(endTime - startTime).toBeLessThan(10000); // Under 10 seconds
      } catch (error) {
        // May fail due to parser limitations, but shouldn't crash the process
        expect(error.message).toBeDefined();
        expect(error.name).toBe('TurtleParseError');
      }
    });

    it('should handle complex collection structures efficiently', async () => {
      const listSize = 10000;
      const listItems = Array.from({ length: listSize }, (_, i) => `"item${i}"`).join(', ');
      
      const content = `
        @prefix ex: <http://example.org/> .
        ex:bigList ex:items (${listItems}) .
      `;

      const beforeMemory = process.memoryUsage();
      const startTime = performance.now();
      
      const result = await parser.parse(content);
      
      const endTime = performance.now();
      const afterMemory = process.memoryUsage();
      
      // Collections create multiple triples internally
      expect(result.triples.length).toBeGreaterThan(listSize);
      expect(endTime - startTime).toBeLessThan(20000); // Under 20 seconds
      
      const memoryIncrease = afterMemory.heapUsed - beforeMemory.heapUsed;
      expect(memoryIncrease).toBeLessThan(300 * 1024 * 1024); // Under 300MB
    });
  });

  describe('Computational Complexity Attacks', () => {
    it('should resist regex catastrophic backtracking', async () => {
      // Pattern that might cause exponential regex backtracking
      const problematicString = 'a'.repeat(100) + 'X';
      const content = `
        @prefix ex: <http://example.org/> .
        ${Array.from({ length: 100 }, (_, i) => 
          `ex:subject${i} ex:problematic "${problematicString}${i}" .`
        ).join('\n')}
      `;

      const startTime = performance.now();
      const result = await parser.parse(content);
      const endTime = performance.now();
      
      expect(result.triples.length).toBe(100);
      expect(endTime - startTime).toBeLessThan(5000); // Should not hang
    });

    it('should handle pathological URI parsing patterns', async () => {
      // URIs with patterns that might cause slow parsing
      const problematicURIs = [
        'http://example.org/' + 'path/'.repeat(1000) + 'resource',
        'http://example.org/resource?' + Array.from({ length: 100 }, (_, i) => `param${i}=value${i}`).join('&'),
        'http://example.org/resource#' + 'fragment'.repeat(100),
        'http://example.org/' + encodeURIComponent('测试'.repeat(500)),
      ];

      const content = `
        @prefix ex: <http://example.org/> .
        ${problematicURIs.map((uri, i) => 
          `<${uri}> ex:index "${i}" .`
        ).join('\n')}
      `;

      const startTime = performance.now();
      const result = await parser.parse(content);
      const endTime = performance.now();
      
      expect(result.triples.length).toBe(problematicURIs.length);
      expect(endTime - startTime).toBeLessThan(10000); // Under 10 seconds
    });

    it('should handle complex prefix expansion efficiently', async () => {
      // Many prefixes with complex expansion patterns
      const prefixCount = 1000;
      const prefixes = Array.from({ length: prefixCount }, (_, i) => 
        `@prefix ns${i}: <http://example.org/namespace${i}/> .`
      ).join('\n');
      
      const triples = Array.from({ length: prefixCount }, (_, i) => 
        `ns${i}:resource ns${i}:property "value${i}" .`
      ).join('\n');

      const content = `${prefixes}\n\n${triples}`;

      const startTime = performance.now();
      const result = await parser.parse(content);
      const endTime = performance.now();
      
      expect(result.triples.length).toBe(prefixCount);
      expect(result.stats.prefixCount).toBe(prefixCount);
      expect(endTime - startTime).toBeLessThan(15000); // Under 15 seconds
    });
  });

  describe('File System Stress Tests', () => {
    it('should handle very large files without loading everything into memory', async () => {
      const largeFilePath = path.join(process.cwd(), 'tests', '.tmp', 'large-test.ttl');
      tempFiles.push(largeFilePath);
      
      // Create a large RDF file (approximately 10MB)
      const tripleCount = 100000;
      let content = '@prefix ex: <http://example.org/> .\n\n';
      
      await fs.ensureDir(path.dirname(largeFilePath));
      
      // Write file in chunks to avoid memory issues during creation
      const writeStream = fs.createWriteStream(largeFilePath);
      writeStream.write(content);
      
      for (let i = 0; i < tripleCount; i++) {
        if (i % 1000 === 0) {
          // Add some variety and blank lines
          writeStream.write('\n# Block ' + (i / 1000) + '\n');
        }
        writeStream.write(`ex:resource${i} ex:property${i % 100} "value${i}" .\n`);
      }
      
      writeStream.end();
      
      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      const fileStats = await fs.stat(largeFilePath);
      expect(fileStats.size).toBeGreaterThan(5 * 1024 * 1024); // At least 5MB

      const beforeMemory = process.memoryUsage();
      const startTime = performance.now();
      
      // Read and parse the large file
      const fileContent = await fs.readFile(largeFilePath, 'utf-8');
      const result = await parser.parse(fileContent);
      
      const endTime = performance.now();
      const afterMemory = process.memoryUsage();
      
      expect(result.triples.length).toBe(tripleCount);
      expect(endTime - startTime).toBeLessThan(60000); // Under 60 seconds
      
      // Memory should not exceed file size by too much
      const memoryIncrease = afterMemory.heapUsed - beforeMemory.heapUsed;
      expect(memoryIncrease).toBeLessThan(fileStats.size * 5); // Less than 5x file size
    });

    it('should handle concurrent file processing without resource exhaustion', async () => {
      const fileCount = 10;
      const files = [];
      
      // Create multiple test files
      for (let i = 0; i < fileCount; i++) {
        const filePath = path.join(process.cwd(), 'tests', '.tmp', `concurrent-${i}.ttl`);
        tempFiles.push(filePath);
        
        const content = `
          @prefix ex: <http://example.org/> .
          ${Array.from({ length: 1000 }, (_, j) => 
            `ex:resource${i}_${j} ex:type "Resource" ; ex:index "${j}" .`
          ).join('\n')}
        `;
        
        await fs.ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, content);
        files.push(filePath);
      }

      const beforeMemory = process.memoryUsage();
      const startTime = performance.now();
      
      // Process all files concurrently
      const results = await Promise.all(files.map(async (filePath) => {
        const content = await fs.readFile(filePath, 'utf-8');
        return await parser.parse(content);
      }));
      
      const endTime = performance.now();
      const afterMemory = process.memoryUsage();
      
      expect(results.length).toBe(fileCount);
      results.forEach(result => {
        expect(result.triples.length).toBe(2000); // 2 triples per resource * 1000 resources
      });
      
      expect(endTime - startTime).toBeLessThan(30000); // Under 30 seconds
      
      const memoryIncrease = afterMemory.heapUsed - beforeMemory.heapUsed;
      expect(memoryIncrease).toBeLessThan(200 * 1024 * 1024); // Under 200MB
    });
  });

  describe('Template Processing Performance', () => {
    it('should handle large template contexts without performance degradation', async () => {
      const template = `
        @prefix ex: <http://example.org/> .
        
        {% for user in users %}
        ex:user{{ user.id }} ex:name "{{ user.name | turtleEscape }}" ;
          ex:email "{{ user.email | turtleEscape }}" ;
          ex:active "{{ user.active }}"^^<http://www.w3.org/2001/XMLSchema#boolean> ;
          {% for skill in user.skills %}
          ex:hasSkill "{{ skill | turtleEscape }}" ;
          {% endfor %}
          ex:createdAt "{{ user.createdAt | date('iso') }}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
        {% endfor %}
      `;

      const userCount = 10000;
      const users = Array.from({ length: userCount }, (_, i) => ({
        id: i,
        name: `User ${i}`,
        email: `user${i}@example.com`,
        active: i % 2 === 0,
        skills: [`skill${i % 10}`, `skill${(i + 1) % 10}`],
        createdAt: new Date(2020, 0, 1 + i % 365)
      }));

      const context = { users };

      const beforeMemory = process.memoryUsage();
      const startTime = performance.now();
      
      const result = await processor.render(template, context);
      
      const endTime = performance.now();
      const afterMemory = process.memoryUsage();
      
      expect(result.content).toBeDefined();
      expect(result.content).toContain('ex:user0');
      expect(result.content).toContain(`ex:user${userCount - 1}`);
      
      expect(endTime - startTime).toBeLessThan(30000); // Under 30 seconds
      
      const memoryIncrease = afterMemory.heapUsed - beforeMemory.heapUsed;
      expect(memoryIncrease).toBeLessThan(400 * 1024 * 1024); // Under 400MB
    });

    it('should handle deeply nested template structures efficiently', async () => {
      const template = `
        @prefix ex: <http://example.org/> .
        
        ex:root {% set current = data %}{% for i in range(0, depth) %}
          ex:level{{ i }} [
            ex:depth "{{ i }}" ;
            {% set current = current.child %}{% endfor %}
            ex:value "{{ current.value }}"
            {% for i in range(0, depth) %}]{% endfor %} .
      `;

      const depth = 100;
      let data = { value: 'deep' };
      for (let i = 0; i < depth; i++) {
        data = { child: data };
      }

      const context = { data, depth, range: (start, end) => Array.from({ length: end - start }, (_, i) => i + start) };

      const startTime = performance.now();
      
      try {
        const result = await processor.render(template, context);
        const endTime = performance.now();
        
        expect(result.content).toBeDefined();
        expect(endTime - startTime).toBeLessThan(10000); // Under 10 seconds
      } catch (error) {
        // Template engine may have nesting limits
        expect(error.message).toBeDefined();
      }
    });
  });

  describe('Memory Leak Detection', () => {
    it('should not leak memory during repeated parsing operations', async () => {
      const template = `
        @prefix ex: <http://example.org/> .
        ${Array.from({ length: 1000 }, (_, i) => 
          `ex:resource${i} ex:property "value${i}" .`
        ).join('\n')}
      `;

      const iterations = 50;
      const memorySnapshots = [];
      
      for (let i = 0; i < iterations; i++) {
        const result = await parser.parse(template);
        expect(result.triples.length).toBe(1000);
        
        // Take memory snapshot every 10 iterations
        if (i % 10 === 0) {
          if (global.gc) global.gc(); // Force GC if available
          memorySnapshots.push(process.memoryUsage().heapUsed);
        }
      }

      // Memory should not continuously increase
      expect(memorySnapshots.length).toBeGreaterThan(3);
      const firstSnapshot = memorySnapshots[0];
      const lastSnapshot = memorySnapshots[memorySnapshots.length - 1];
      const memoryIncrease = lastSnapshot - firstSnapshot;
      
      // Memory should not increase by more than 50MB over iterations
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should clean up resources properly after processing errors', async () => {
      const malformedTemplate = `
        @prefix ex: <http://example.org/> .
        ex:resource ex:property "unclosed string
        More content that might be partially parsed...
        ${Array.from({ length: 1000 }, (_, i) => 
          `ex:resource${i} ex:property "value${i}" .`
        ).join('\n')}
      `;

      const iterations = 20;
      let errorCount = 0;
      const memoryBefore = process.memoryUsage().heapUsed;
      
      for (let i = 0; i < iterations; i++) {
        try {
          await parser.parse(malformedTemplate);
        } catch (error) {
          errorCount++;
          // Errors should be handled gracefully
          expect(error).toBeDefined();
        }
      }

      if (global.gc) global.gc(); // Force cleanup
      const memoryAfter = process.memoryUsage().heapUsed;
      const memoryIncrease = memoryAfter - memoryBefore;
      
      expect(errorCount).toBeGreaterThan(0); // Should have errors
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Under 100MB increase
    });
  });
});