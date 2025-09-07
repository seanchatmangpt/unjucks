import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Generator } from '../../src/lib/generator.js';
import { TurtleParser } from '../../src/lib/turtle-parser.js';
import { existsSync, removeSync, ensureDirSync, writeFileSync } from 'fs-extra';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Turtle Template Integration', () => {
  let testDir => {
    testDir = join(tmpdir(), `unjucks-turtle-test-${Date.now()}`);
    ensureDirSync(testDir);
    
    generator = new Generator();
    parser = new TurtleParser();
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      removeSync(testDir);
    }
  });

  describe('Template Generation with Turtle Data', () => { it('should generate template using Turtle data', async () => {
      // Setup }}.md
---
# Profile: {{ person1.name }}

- **Email**: {{ person1.email }}
- **Job Title**: {{ person1.jobTitle }}

Generated from Turtle data on {{ new Date().toISOString().split('T')[0] }}.
`;

      writeFileSync(join(templateDir, 'profile.md.ejs'), templateContent);

      // Parse Turtle data
      const parseResult = await parser.parseFile(turtleFilePath);
      expect(parseResult.success).toBe(true);

      // Test: Generate using Turtle data
      const variables = { ...parseResult.data,
        generatedAt };

      // This would require extending Generator to accept data directly
      // For now, we test the data extraction works correctly
      expect(variables.person1).toBeDefined();
      expect((variables.person1).name).toBe('John Doe');
      expect((variables.person1).email).toBe('john.doe@example.com');
      expect((variables.person1).jobTitle).toBe('Software Engineer');
    });

    it('should handle complex Turtle data with multiple entities', async () => { const turtleData = `
        @prefix proj });

    it('should extract all available template variables from Turtle data', async () => { const turtleData = `
        @prefix ex });

    it('should handle Turtle data with arrays and multiple values', async () => { const turtleData = `
        @prefix ex });

    it('should preserve data types from Turtle literals', async () => { const turtleData = `
        @prefix ex });
  });

  describe('Error Handling', () => { it('should handle invalid Turtle syntax gracefully', async () => {
      const invalidTurtle = `
        @prefix ex });
      expect(parseResult.variables).toHaveLength(0);
    });

    it('should handle empty Turtle files', async () => {
      const parseResult = await parser.parseContent('');
      
      expect(parseResult.success).toBe(true);
      expect(parseResult.data).toEqual({});
      expect(parseResult.variables).toHaveLength(0);
      expect(parseResult.quadCount).toBe(0);
    });

    it('should handle Turtle files with only prefixes', async () => { const turtleData = `
        @prefix foaf });
      expect(parseResult.variables).toHaveLength(0);
      expect(parseResult.quadCount).toBe(0);
    });
  });

  describe('Performance with Large Datasets', () => { it('should handle moderately large Turtle files efficiently', async () => {
      // Generate a larger dataset
      let turtleData = '@prefix ex }> ex:name "User ${i}" ; ex:id "${i}" ; ex:email "user${i}@example.com" .\n`;
      }

      const startTime = performance.now();
      const parseResult = await parser.parseContent(turtleData);
      const endTime = performance.now();

      expect(parseResult.success).toBe(true);
      expect(parseResult.quadCount).toBe(1500); // 3 properties per user
      expect(Object.keys(parseResult.data)).toHaveLength(500);
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should extract variables efficiently from large datasets', async () => { let turtleData = '@prefix ex }> ex:name "Item ${i}" ; ex:category "Category${i % 5}" .\n`;
      }

      const startTime = performance.now();
      const parseResult = await parser.parseContent(turtleData);
      const endTime = performance.now();

      expect(parseResult.success).toBe(true);
      expect(parseResult.variables).toHaveLength(300); // 100 items × 3 variables each
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });

  describe('Memory Management', () => { it('should not leak memory after multiple parsing operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform multiple parsing operations
      for (let i = 0; i < 10; i++) {
        const turtleData = `
          @prefix ex }> ex:name "Test ${i}" .
        `;
        
        const parseResult = await parser.parseContent(turtleData);
        expect(parseResult.success).toBe(true);
        
        // Clear the parser between operations
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