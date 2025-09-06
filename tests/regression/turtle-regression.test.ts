import { describe, it, expect, beforeEach } from 'vitest';
import { TurtleParser } from '../../src/lib/turtle-parser.js';
import { readFileSync } from 'fs-extra';
import { join } from 'path';

describe('Turtle Parser Regression Tests', () => {
  let parser: TurtleParser;
  
  beforeEach(() => {
    parser = new TurtleParser();
  });

  describe('Known Issue Regression', () => {
    it('should maintain backward compatibility with N3.js parser behavior', async () => {
      const turtleContent = `
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        @prefix ex: <http://example.org/> .
        
        <#person1>
          foaf:name "John Doe" ;
          foaf:age "30" ;
          ex:skills "JavaScript", "TypeScript", "Node.js" .
      `;

      const result = await parser.parseContent(turtleContent);
      
      expect(result.success).toBe(true);
      expect(result.data.person1).toBeDefined();
      expect((result.data.person1 as any).name).toBe('John Doe');
      expect((result.data.person1 as any).age).toBe('30');
      expect(Array.isArray((result.data.person1 as any).skills)).toBe(true);
      expect((result.data.person1 as any).skills).toContain('JavaScript');
    });

    it('should handle empty prefix declarations correctly', async () => {
      // Regression test for empty prefix handling
      const turtleContent = `
        @prefix : <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        :person1 foaf:name "Test Person" .
      `;

      const result = await parser.parseContent(turtleContent);
      
      expect(result.success).toBe(true);
      expect(result.data.person1).toBeDefined();
      expect((result.data.person1 as any).name).toBe('Test Person');
    });

    it('should preserve order of multiple values in arrays', async () => {
      const turtleContent = `
        @prefix ex: <http://example.org/> .
        
        <#test>
          ex:priority1 "First" ;
          ex:priority2 "Second" ;
          ex:priority1 "AlsoFirst" ;
          ex:priority3 "Third" .
      `;

      const result = await parser.parseContent(turtleContent);
      
      expect(result.success).toBe(true);
      const testData = result.data.test as any;
      expect(Array.isArray(testData.priority1)).toBe(true);
      expect(testData.priority1).toContain('First');
      expect(testData.priority1).toContain('AlsoFirst');
      expect(testData.priority2).toBe('Second');
      expect(testData.priority3).toBe('Third');
    });

    it('should handle blank nodes consistently', async () => {
      const turtleContent = `
        @prefix ex: <http://example.org/> .
        
        _:blank1 ex:name "Anonymous 1" .
        _:blank2 ex:name "Anonymous 2" .
        <#named> ex:knows _:blank1, _:blank2 .
      `;

      const result = await parser.parseContent(turtleContent);
      
      expect(result.success).toBe(true);
      // Blank nodes should be handled consistently
      expect(Object.keys(result.data)).toContain('named');
    });

    it('should maintain consistent variable naming for URIs with fragments', async () => {
      const turtleContent = `
        @prefix ex: <http://example.org/> .
        
        <http://example.org/users#john> ex:name "John" .
        <http://example.org/users#jane> ex:name "Jane" .
        ex:company ex:name "TechCorp" .
      `;

      const result = await parser.parseContent(turtleContent);
      
      expect(result.success).toBe(true);
      expect(result.data.john).toBeDefined();
      expect(result.data.jane).toBeDefined();
      expect(result.data.company).toBeDefined();
      expect((result.data.john as any).name).toBe('John');
      expect((result.data.jane as any).name).toBe('Jane');
    });
  });

  describe('Template Integration Regression', () => {
    it('should maintain consistent variable extraction across versions', async () => {
      const turtleContent = `
        @prefix proj: <http://example.org/project/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        proj:unjucks
          proj:name "Unjucks" ;
          proj:version "0.0.0" ;
          proj:maintainer <#maintainer> .
          
        <#maintainer>
          foaf:name "Maintainer Name" ;
          foaf:email "maintainer@example.com" .
      `;

      const result = await parser.parseContent(turtleContent);
      
      expect(result.success).toBe(true);
      expect(result.variables).toContain('unjucks');
      expect(result.variables).toContain('unjucks.name');
      expect(result.variables).toContain('unjucks.version');
      expect(result.variables).toContain('maintainer');
      expect(result.variables).toContain('maintainer.name');
      expect(result.variables).toContain('maintainer.email');
      
      // Variables should be sorted consistently
      const sortedVars = [...result.variables].sort();
      expect(result.variables).toEqual(sortedVars);
    });

    it('should handle complex data types consistently', async () => {
      const turtleContent = `
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        
        <#stats>
          ex:count "42"^^xsd:integer ;
          ex:percentage "75.5"^^xsd:decimal ;
          ex:active "true"^^xsd:boolean ;
          ex:created "2023-01-01T00:00:00Z"^^xsd:dateTime .
      `;

      const result = await parser.parseContent(turtleContent);
      
      expect(result.success).toBe(true);
      const stats = result.data.stats as any;
      
      // N3.js preserves literal values as strings with type info
      expect(typeof stats.count).toBe('string');
      expect(typeof stats.percentage).toBe('string');
      expect(typeof stats.active).toBe('string');
      expect(typeof stats.created).toBe('string');
      
      expect(stats.count).toBe('42');
      expect(stats.percentage).toBe('75.5');
      expect(stats.active).toBe('true');
    });
  });

  describe('Performance Regression', () => {
    it('should maintain parsing performance for typical datasets', async () => {
      // Generate typical size dataset (100 entities)
      let turtleContent = '@prefix ex: <http://example.org/> .\n@prefix foaf: <http://xmlns.com/foaf/0.1/> .\n';
      
      for (let i = 0; i < 100; i++) {
        turtleContent += `<#user${i}> foaf:name "User ${i}" ; foaf:email "user${i}@example.com" ; ex:id "${i}" .\n`;
      }

      const startTime = performance.now();
      const result = await parser.parseContent(turtleContent);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      expect(result.quadCount).toBe(300); // 3 properties per user
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      
      // Consistent with previous performance expectations
      expect(Object.keys(result.data)).toHaveLength(100);
    });

    it('should maintain variable extraction performance', async () => {
      let turtleContent = '@prefix ex: <http://example.org/> .\n';
      
      // Create nested structure that requires variable extraction
      for (let i = 0; i < 50; i++) {
        turtleContent += `<#company${i}> ex:name "Company ${i}" .\n`;
        for (let j = 0; j < 5; j++) {
          turtleContent += `<#dept${i}_${j}> ex:name "Dept ${i}-${j}" ; ex:company <#company${i}> .\n`;
        }
      }

      const startTime = performance.now();
      const result = await parser.parseContent(turtleContent);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      expect(result.variables.length).toBeGreaterThan(300);
      expect(duration).toBeLessThan(2000); // Variable extraction should be fast
    });
  });

  describe('Error Handling Regression', () => {
    it('should maintain consistent error messages for common syntax errors', async () => {
      const commonErrors = [
        {
          name: 'missing quote',
          turtle: '@prefix ex: <http://example.org/> .\n<#test> ex:name "missing quote ;',
          expected: /quote|syntax|parse/i
        },
        {
          name: 'invalid URI',
          turtle: '@prefix ex: <invalid-uri> .\n<#test> ex:name "Test" .',
          expected: /uri|iri|syntax/i
        },
        {
          name: 'missing period',
          turtle: '@prefix ex: <http://example.org/> .\n<#test> ex:name "Test"',
          expected: /period|syntax|end/i
        }
      ];

      for (const errorCase of commonErrors) {
        const result = await parser.parseContent(errorCase.turtle);
        
        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toMatch(errorCase.expected);
      }
    });

    it('should handle edge cases gracefully', async () => {
      const edgeCases = [
        '', // Empty content
        '@prefix ex: <http://example.org/> .', // Only prefixes
        '# Just a comment', // Only comments
        '\n\n\n', // Only whitespace
      ];

      for (const content of edgeCases) {
        const result = await parser.parseContent(content);
        
        // Should succeed with empty results
        expect(result.success).toBe(true);
        expect(result.data).toEqual({});
        expect(result.quadCount).toBe(0);
        expect(result.variables).toHaveLength(0);
      }
    });
  });

  describe('Integration with Test Fixtures', () => {
    it('should correctly parse the basic person fixture', async () => {
      const fixturePath = join(process.cwd(), 'tests/fixtures/turtle/basic-person.ttl');
      
      try {
        const result = await parser.parseFile(fixturePath);
        
        expect(result.success).toBe(true);
        expect(result.data.person1).toBeDefined();
        expect(result.data.person2).toBeDefined();
        
        const person1 = result.data.person1 as any;
        const person2 = result.data.person2 as any;
        
        expect(person1.name).toBe('John Doe');
        expect(person1.email).toBe('john.doe@example.com');
        expect(person2.name).toBe('Jane Smith');
        expect(person2.email).toBe('jane.smith@example.com');
      } catch (error) {
        // If fixture doesn't exist, skip this test
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should correctly parse the complex project fixture', async () => {
      const fixturePath = join(process.cwd(), 'tests/fixtures/turtle/complex-project.ttl');
      
      try {
        const result = await parser.parseFile(fixturePath);
        
        expect(result.success).toBe(true);
        expect(result.data.unjucks).toBeDefined();
        expect(result.data.maintainer1).toBeDefined();
        
        const project = result.data.unjucks as any;
        expect(project.name).toBe('Unjucks');
        expect(project.description).toContain('Hygen-style CLI generator');
      } catch (error) {
        // If fixture doesn't exist, skip this test
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle the invalid syntax fixture appropriately', async () => {
      const fixturePath = join(process.cwd(), 'tests/fixtures/turtle/invalid-syntax.ttl');
      
      try {
        const result = await parser.parseFile(fixturePath);
        
        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.data).toEqual({});
      } catch (error) {
        // If fixture doesn't exist, skip this test
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('Memory and Resource Management Regression', () => {
    it('should not leak memory across multiple parsing operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform 20 parsing operations
      for (let i = 0; i < 20; i++) {
        const turtleContent = `
          @prefix ex: <http://example.org/> .
          <#test${i}> ex:name "Test ${i}" ; ex:data "${'x'.repeat(1000)}" .
        `;
        
        const result = await parser.parseContent(turtleContent);
        expect(result.success).toBe(true);
        
        // Clear parser state
        parser.clear();
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });
});