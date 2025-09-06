import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TurtleParser } from '../../src/lib/turtle-parser.js';
import { readFileSync } from 'fs-extra';
import { join } from 'path';

vi.mock('fs-extra');
const mockedReadFileSync = vi.mocked(readFileSync);

describe('TurtleParser', () => {
  let parser: TurtleParser;
  
  beforeEach(() => {
    parser = new TurtleParser();
    vi.clearAllMocks();
  });

  describe('parseContent', () => {
    it('should parse basic Turtle content successfully', async () => {
      const turtleContent = `
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        <#person1>
          foaf:name "John Doe" ;
          foaf:email "john@example.com" .
      `;

      const result = await parser.parseContent(turtleContent);

      expect(result.success).toBe(true);
      expect(result.data.person1).toBeDefined();
      expect((result.data.person1 as any).name).toBe('John Doe');
      expect((result.data.person1 as any).email).toBe('john@example.com');
      expect(result.quadCount).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should extract variables from parsed data', async () => {
      const turtleContent = `
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        <#person1>
          foaf:name "John Doe" ;
          foaf:email "john@example.com" .
      `;

      const result = await parser.parseContent(turtleContent);

      expect(result.variables).toContain('person1');
      expect(result.variables).toContain('person1.name');
      expect(result.variables).toContain('person1.email');
    });

    it('should handle arrays for multiple values', async () => {
      const turtleContent = `
        @prefix ex: <http://example.org/> .
        
        <#person1>
          ex:skill "JavaScript" ;
          ex:skill "TypeScript" ;
          ex:skill "React" .
      `;

      const result = await parser.parseContent(turtleContent);

      expect(result.success).toBe(true);
      const skills = (result.data.person1 as any).skill;
      expect(Array.isArray(skills)).toBe(true);
      expect(skills).toContain('JavaScript');
      expect(skills).toContain('TypeScript');
      expect(skills).toContain('React');
    });

    it('should handle invalid Turtle syntax gracefully', async () => {
      const invalidTurtle = `
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        <#person1>
          foaf:name "John Doe" ;
          foaf:email "invalid-missing-quotes ;
      `;

      const result = await parser.parseContent(invalidTurtle);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.data).toEqual({});
      expect(result.quadCount).toBe(0);
    });

    it('should handle complex nested data structures', async () => {
      const turtleContent = `
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        @prefix schema: <https://schema.org/> .
        
        <#person1>
          foaf:name "John Doe" ;
          schema:worksFor <#company1> .
          
        <#company1>
          schema:name "TechCorp" ;
          schema:address "123 Tech Street" .
      `;

      const result = await parser.parseContent(turtleContent);

      expect(result.success).toBe(true);
      expect(result.data.person1).toBeDefined();
      expect(result.data.company1).toBeDefined();
      expect((result.data.company1 as any).name).toBe('TechCorp');
    });
  });

  describe('parseFile', () => {
    it('should parse Turtle file successfully', async () => {
      const turtleContent = `
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        <#person1> foaf:name "John Doe" .
      `;
      
      mockedReadFileSync.mockReturnValue(turtleContent);

      const result = await parser.parseFile('/path/to/test.ttl');

      expect(result.success).toBe(true);
      expect(result.data.person1).toBeDefined();
      expect(mockedReadFileSync).toHaveBeenCalledWith('/path/to/test.ttl', 'utf-8');
    });

    it('should handle file read errors', async () => {
      mockedReadFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      const result = await parser.parseFile('/nonexistent/file.ttl');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('File read error: File not found');
    });
  });

  describe('validateSyntax', () => {
    it('should validate correct Turtle syntax', async () => {
      const validTurtle = `
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        <#person1> foaf:name "John Doe" .
      `;

      const result = await parser.validateSyntax(validTurtle);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid Turtle syntax', async () => {
      const invalidTurtle = `
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        <#person1> foaf:name "John Doe ;
      `;

      const result = await parser.validateSyntax(invalidTurtle);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('with options', () => {
    it('should use custom baseIRI when provided', async () => {
      const customParser = new TurtleParser({ 
        baseIRI: 'http://example.org/base/' 
      });

      const turtleContent = `
        <person1> <name> "John Doe" .
      `;

      const result = await customParser.parseContent(turtleContent);
      expect(result.success).toBe(true);
    });

    it('should handle empty content gracefully', async () => {
      const result = await parser.parseContent('');
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({});
      expect(result.quadCount).toBe(0);
      expect(result.variables).toHaveLength(0);
    });
  });

  describe('performance considerations', () => {
    it('should handle moderately large datasets efficiently', async () => {
      // Generate larger turtle content
      let turtleContent = '@prefix ex: <http://example.org/> .\n';
      for (let i = 0; i < 100; i++) {
        turtleContent += `<#item${i}> ex:name "Item ${i}" ; ex:id "${i}" .\n`;
      }

      const startTime = performance.now();
      const result = await parser.parseContent(turtleContent);
      const endTime = performance.now();

      expect(result.success).toBe(true);
      expect(result.quadCount).toBe(200); // 2 quads per item
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('memory management', () => {
    it('should clear internal store when requested', async () => {
      const turtleContent = `
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        <#person1> foaf:name "John Doe" .
      `;

      await parser.parseContent(turtleContent);
      parser.clear();

      // After clearing, parsing new content should not include old data
      const newContent = '<#person2> <name> "Jane Doe" .';
      const result = await parser.parseContent(newContent);
      
      expect(result.data.person1).toBeUndefined();
      expect(result.data.person2).toBeDefined();
    });
  });
});