import { describe, it, expect, beforeEach } from 'vitest';
import { TurtleParser } from '../../src/lib/turtle-parser.js';
import { writeFileSync, removeSync, ensureDirSync } from 'fs-extra';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Turtle Parser Performance Tests', () => {
  let parser: TurtleParser;
  let testDir: string;

  beforeEach(() => {
    parser = new TurtleParser();
    testDir = join(tmpdir(), `turtle-perf-test-${Date.now()}`);
    ensureDirSync(testDir);
  });

  describe('Large Dataset Performance', () => {
    it('should parse 1000 entities within 2 seconds', async () => {
      // Generate large Turtle dataset
      let turtleContent = '@prefix ex: <http://example.org/> .\n';
      for (let i = 0; i < 1000; i++) {
        turtleContent += `<#user${i}> ex:name "User ${i}" ; ex:id "${i}" ; ex:email "user${i}@example.com" .\n`;
      }

      const filePath = join(testDir, 'large-1000.ttl');
      writeFileSync(filePath, turtleContent);

      const startTime = performance.now();
      const result = await parser.parseFile(filePath);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      expect(result.quadCount).toBe(3000); // 3 properties per user
      expect(duration).toBeLessThan(2000); // Less than 2 seconds
      expect(Object.keys(result.data)).toHaveLength(1000);

      console.log(`Parsed 1000 entities in ${duration.toFixed(2)}ms`);
      removeSync(filePath);
    });

    it('should parse 5000 entities within 10 seconds', async () => {
      // Generate very large dataset
      let turtleContent = '@prefix ex: <http://example.org/> .\n@prefix foaf: <http://xmlns.com/foaf/0.1/> .\n';
      for (let i = 0; i < 5000; i++) {
        turtleContent += `<#entity${i}> `;
        turtleContent += `ex:name "Entity ${i}" ; `;
        turtleContent += `ex:id "${i}" ; `;
        turtleContent += `foaf:email "entity${i}@example.com" ; `;
        turtleContent += `ex:category "Category${i % 10}" ; `;
        turtleContent += `ex:active "true" .\n`;
      }

      const filePath = join(testDir, 'large-5000.ttl');
      writeFileSync(filePath, turtleContent);

      const startTime = performance.now();
      const result = await parser.parseFile(filePath);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      expect(result.quadCount).toBe(25000); // 5 properties per entity
      expect(duration).toBeLessThan(10000); // Less than 10 seconds
      expect(Object.keys(result.data)).toHaveLength(5000);

      console.log(`Parsed 5000 entities in ${duration.toFixed(2)}ms`);
      removeSync(filePath);
    });

    it('should handle complex nested structures efficiently', async () => {
      // Generate complex nested data
      let turtleContent = '@prefix ex: <http://example.org/> .\n@prefix foaf: <http://xmlns.com/foaf/0.1/> .\n';
      
      // Create projects with multiple developers
      for (let i = 0; i < 100; i++) {
        turtleContent += `<#project${i}> ex:name "Project ${i}" ; ex:lead <#dev${i}> .\n`;
        
        // Each project has 5 developers
        for (let j = 0; j < 5; j++) {
          const devId = i * 5 + j;
          turtleContent += `<#dev${devId}> foaf:name "Developer ${devId}" ; `;
          turtleContent += `foaf:email "dev${devId}@example.com" ; `;
          turtleContent += `ex:worksOn <#project${i}> ; `;
          turtleContent += `ex:skill "Skill${devId % 10}" .\n`;
        }
      }

      const filePath = join(testDir, 'complex-nested.ttl');
      writeFileSync(filePath, turtleContent);

      const startTime = performance.now();
      const result = await parser.parseFile(filePath);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(3000); // Less than 3 seconds for complex structure
      expect(Object.keys(result.data)).toHaveLength(600); // 100 projects + 500 developers

      console.log(`Parsed complex nested structure in ${duration.toFixed(2)}ms`);
      removeSync(filePath);
    });
  });

  describe('Memory Usage Performance', () => {
    it('should not leak memory with repeated parsing', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Parse multiple files in sequence
      for (let i = 0; i < 50; i++) {
        let turtleContent = '@prefix ex: <http://example.org/> .\n';
        for (let j = 0; j < 20; j++) {
          turtleContent += `<#item${j}> ex:name "Item ${j}" ; ex:batch "${i}" .\n`;
        }

        const result = await parser.parseContent(turtleContent);
        expect(result.success).toBe(true);
        
        // Clear parser between iterations
        parser.clear();
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      
      console.log(`Memory increase after 50 parsing operations: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });

    it('should handle large single-entity datasets efficiently', async () => {
      // Single entity with many properties
      let turtleContent = '@prefix ex: <http://example.org/> .\n<#megaEntity> ';
      
      for (let i = 0; i < 1000; i++) {
        turtleContent += `ex:property${i} "Value ${i}" ; `;
      }
      turtleContent = turtleContent.slice(0, -3) + ' .\n'; // Remove last semicolon

      const startTime = performance.now();
      const result = await parser.parseContent(turtleContent);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      expect(result.quadCount).toBe(1000);
      expect(Object.keys(result.data)).toHaveLength(1);
      expect(duration).toBeLessThan(1000); // Less than 1 second

      // Check that all properties are accessible
      const entity = result.data.megaEntity as any;
      expect(entity.property0).toBe('Value 0');
      expect(entity.property999).toBe('Value 999');

      console.log(`Parsed entity with 1000 properties in ${duration.toFixed(2)}ms`);
    });
  });

  describe('Variable Extraction Performance', () => {
    it('should extract variables from large datasets efficiently', async () => {
      // Generate complex hierarchy
      let turtleContent = '@prefix ex: <http://example.org/> .\n';
      
      // Create hierarchical data: companies -> departments -> employees
      for (let c = 0; c < 10; c++) {
        turtleContent += `<#company${c}> ex:name "Company ${c}" .\n`;
        
        for (let d = 0; d < 10; d++) {
          const deptId = `${c}_${d}`;
          turtleContent += `<#dept${deptId}> ex:name "Department ${deptId}" ; ex:company <#company${c}> .\n`;
          
          for (let e = 0; e < 10; e++) {
            const empId = `${c}_${d}_${e}`;
            turtleContent += `<#emp${empId}> ex:name "Employee ${empId}" ; ex:department <#dept${deptId}> .\n`;
          }
        }
      }

      const startTime = performance.now();
      const result = await parser.parseContent(turtleContent);
      const extractTime = performance.now();
      const variables = result.variables;
      const endTime = performance.now();

      const parseTime = extractTime - startTime;
      const variableTime = endTime - extractTime;

      expect(result.success).toBe(true);
      expect(variables.length).toBeGreaterThan(3000); // Lots of variables from hierarchy
      expect(parseTime).toBeLessThan(2000); // Parse time under 2s
      expect(variableTime).toBeLessThan(500); // Variable extraction under 0.5s

      console.log(`Parse time: ${parseTime.toFixed(2)}ms, Variable extraction: ${variableTime.toFixed(2)}ms`);
      console.log(`Extracted ${variables.length} variables`);
    });

    it('should handle deep nesting efficiently', async () => {
      // Create deeply nested structure
      let turtleContent = '@prefix ex: <http://example.org/> .\n';
      
      // Create chain: level0 -> level1 -> level2 ... -> level10
      for (let depth = 0; depth < 10; depth++) {
        for (let i = 0; i < 10; i++) {
          const currentId = `level${depth}_${i}`;
          turtleContent += `<#${currentId}> ex:name "Level ${depth} Item ${i}" `;
          
          if (depth < 9) {
            const nextId = `level${depth + 1}_${i}`;
            turtleContent += `; ex:child <#${nextId}> `;
          }
          
          turtleContent += '.\n';
        }
      }

      const startTime = performance.now();
      const result = await parser.parseContent(turtleContent);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(1500); // Should handle deep nesting efficiently
      
      // Verify deep nesting is properly parsed
      const variables = result.variables;
      expect(variables.some(v => v.includes('level0'))).toBe(true);
      expect(variables.some(v => v.includes('level9'))).toBe(true);

      console.log(`Parsed deep nested structure (10 levels) in ${duration.toFixed(2)}ms`);
    });
  });

  describe('Concurrent Parsing Performance', () => {
    it('should handle multiple concurrent parsing operations', async () => {
      const concurrentCount = 10;
      const promises: Promise<any>[] = [];

      const startTime = performance.now();

      // Create multiple parsing operations
      for (let i = 0; i < concurrentCount; i++) {
        let turtleContent = '@prefix ex: <http://example.org/> .\n';
        for (let j = 0; j < 100; j++) {
          turtleContent += `<#item${i}_${j}> ex:name "Item ${i}-${j}" ; ex:batch "${i}" .\n`;
        }

        promises.push(new TurtleParser().parseContent(turtleContent));
      }

      const results = await Promise.all(promises);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // All operations should succeed
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.quadCount).toBe(200); // 2 properties per 100 items
        expect(Object.keys(result.data)).toHaveLength(100);
      });

      expect(duration).toBeLessThan(3000); // All concurrent operations under 3s

      console.log(`Completed ${concurrentCount} concurrent parsing operations in ${duration.toFixed(2)}ms`);
    });
  });

  describe('Error Handling Performance', () => {
    it('should fail fast with invalid syntax', async () => {
      const invalidTurtle = `
        @prefix ex: <http://example.org/> .
        <#broken> ex:name "This will fail ;
        # Missing quote and period
      `;

      const startTime = performance.now();
      const result = await parser.parseContent(invalidTurtle);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(duration).toBeLessThan(100); // Should fail quickly

      console.log(`Failed fast with invalid syntax in ${duration.toFixed(2)}ms`);
    });

    it('should handle validation of large invalid files efficiently', async () => {
      // Create large file with error at the end
      let invalidTurtle = '@prefix ex: <http://example.org/> .\n';
      
      // Add 1000 valid triples
      for (let i = 0; i < 1000; i++) {
        invalidTurtle += `<#valid${i}> ex:name "Valid ${i}" .\n`;
      }
      
      // Add invalid syntax at the end
      invalidTurtle += '<#broken> ex:name "This will break ;';

      const startTime = performance.now();
      const result = await parser.validateSyntax(invalidTurtle);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(duration).toBeLessThan(2000); // Should complete validation reasonably fast

      console.log(`Validated large invalid file in ${duration.toFixed(2)}ms`);
    });
  });

  // Cleanup
  afterEach(() => {
    if (testDir) {
      removeSync(testDir);
    }
  });
});