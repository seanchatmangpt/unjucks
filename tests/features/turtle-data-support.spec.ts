/**
 * Turtle Data Support BDD Tests
 * Tests RDF/Turtle data integration with template generation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader.js';
import fs from 'fs-extra';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Turtle Data Support', () => {
  let testDir: string;
  let dataLoader: RDFDataLoader;

  beforeEach(() => {
    testDir = join(tmpdir(), `unjucks-turtle-test-${Date.now()}`);
    fs.ensureDirSync(testDir);
    dataLoader = new RDFDataLoader();
  });

  afterEach(() => {
    if (testDir && fs.existsSync(testDir)) {
      fs.removeSync(testDir);
    }
  });

  describe('Basic Turtle Data Parsing', () => {
    it('should parse Turtle data file with person information', async () => {
      // Given: I have a Turtle file with person data
      const turtleContent = `
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        @prefix schema: <https://schema.org/> .

        <#person1>
          foaf:name "John Doe" ;
          foaf:email "john.doe@example.com" ;
          foaf:age "30" ;
          schema:jobTitle "Software Engineer" .
      `;
      
      const turtleFilePath = join(testDir, 'person.ttl');
      fs.writeFileSync(turtleFilePath, turtleContent);

      // When: I parse the Turtle file
      const result = await parser.parseFile(turtleFilePath);

      // Then: the parsing should succeed
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);

      // And: I should get structured data with person information
      expect(result.data.person1).toBeDefined();
      expect(result.data.person1.name).toBe('John Doe');
      expect(result.data.person1.email).toBe('john.doe@example.com');
      expect(result.data.person1.jobTitle).toBe('Software Engineer');

      // And: I should get a list of available template variables
      expect(result.variables).toContain('person1');
      expect(result.variables).toContain('person1.name');
      expect(result.variables).toContain('person1.email');
      expect(result.variables).toContain('person1.age');
      expect(result.variables).toContain('person1.jobTitle');
    });
  });

  describe('Template Data Generation', () => {
    it('should generate template-ready data from project information', async () => {
      // Given: I have a Turtle file with project information
      const turtleContent = `
        @prefix proj: <http://example.org/project/> .
        
        proj:myproject
          proj:name "MyProject" ;
          proj:version "1.0.0" ;
          proj:description "A sample project" .
      `;
      
      const turtleFilePath = join(testDir, 'project.ttl');
      fs.writeFileSync(turtleFilePath, turtleContent);

      // When: I generate template data from the Turtle file
      const result = await parser.parseFile(turtleFilePath);

      // Then: the generated data should contain project information
      expect(result.success).toBe(true);
      expect(result.data.myproject).toBeDefined();
      expect(result.data.myproject.name).toBe('MyProject');
      expect(result.data.myproject.version).toBe('1.0.0');
      expect(result.data.myproject.description).toBe('A sample project');

      // And: template variables should be correctly identified
      expect(result.variables).toContain('myproject.name');
      expect(result.variables).toContain('myproject.version');
      expect(result.variables).toContain('myproject.description');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid Turtle syntax gracefully', async () => {
      // Given: I have a Turtle file with syntax errors
      const invalidTurtle = `
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        <#person1>
          foaf:name "John Doe" ;
          foaf:email "missing-quote-here ;
          # Syntax error above
      `;
      
      const turtleFilePath = join(testDir, 'invalid.ttl');
      fs.writeFileSync(turtleFilePath, invalidTurtle);

      // When: I try to parse the Turtle file
      const result = await parser.parseFile(turtleFilePath);

      // Then: the parsing should fail gracefully
      expect(result.success).toBe(false);
      expect(result.data).toEqual({});

      // And: I should get clear error messages about the syntax issues
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatch(/syntax|parse|error/i);
    });

    it('should handle missing files with clear error messages', async () => {
      // Given: I specify a non-existent Turtle data file
      const nonExistentFile = join(testDir, 'nonexistent.ttl');

      // When: I try to parse the missing file
      const result = await parser.parseFile(nonExistentFile);

      // Then: I should get a clear error message about the missing file
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatch(/file not found|not found/i);

      // And: the result should be empty
      expect(result.data).toEqual({});
      expect(result.quadCount).toBe(0);
    });
  });

  describe('Complex Data Structures', () => {
    it('should handle nested relationships and arrays', async () => {
      // Given: I have a Turtle file with nested relationships
      const turtleContent = `
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        @prefix ex: <http://example.org/> .
        
        <#person1>
          foaf:name "Alice Johnson" ;
          ex:skill "JavaScript" ;
          ex:skill "TypeScript" ;
          ex:skill "React" ;
          foaf:knows <#person2> .
          
        <#person2>
          foaf:name "Bob Smith" ;
          ex:role "Manager" .
      `;
      
      const result = await parser.parseContent(turtleContent);

      // Then: the nested data should be correctly accessible
      expect(result.success).toBe(true);
      expect(result.data.person1).toBeDefined();
      expect(result.data.person2).toBeDefined();
      expect(result.data.person1.name).toBe('Alice Johnson');
      expect(result.data.person2.name).toBe('Bob Smith');
      expect(result.data.person2.role).toBe('Manager');

      // And: arrays should be handled properly for multiple values
      const skills = result.data.person1.skill;
      expect(Array.isArray(skills)).toBe(true);
      expect(skills).toContain('JavaScript');
      expect(skills).toContain('TypeScript');
      expect(skills).toContain('React');
      expect(skills).toHaveLength(3);
    });
  });

  describe('Validation', () => {
    it('should validate Turtle syntax correctly', async () => {
      // Given: I have valid and invalid Turtle content
      const validTurtle = `
        @prefix ex: <http://example.org/> .
        <#test> ex:name "Valid" .
      `;
      
      const invalidTurtle = `
        @prefix ex: <http://example.org/> .
        <#test> ex:name "Invalid ;
      `;

      // When: I validate each file
      const validResult = await parser.validateSyntax(validTurtle);
      const invalidResult = await parser.validateSyntax(invalidTurtle);

      // Then: valid files should pass validation
      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      // And: invalid files should be rejected with specific error messages
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toHaveLength(1);
      expect(invalidResult.errors[0]).toMatch(/syntax|parse|error/i);
    });
  });

  describe('Performance', () => {
    it('should handle large Turtle datasets efficiently', async () => {
      // Given: I have a large Turtle file with 1000+ entities
      let turtleContent = '@prefix ex: <http://example.org/> .\\n';
      for (let i = 0; i < 1000; i++) {
        turtleContent += `<#entity${i}> ex:name "Entity ${i}" ; ex:id "${i}" .\\n`;
      }
      
      // When: I parse the large Turtle file
      const startTime = performance.now();
      const result = await parser.parseContent(turtleContent);
      const endTime = performance.now();
      const parseTime = endTime - startTime;

      // Then: the parsing should complete within reasonable time
      expect(result.success).toBe(true);
      expect(parseTime).toBeLessThan(5000); // Less than 5 seconds

      // And: memory usage should remain within acceptable limits
      expect(result.quadCount).toBe(2000); // 2 properties per entity
      expect(Object.keys(result.data)).toHaveLength(1000);
    });
  });

  describe('Variable Extraction', () => {
    it('should extract all template variables with proper paths', async () => {
      // Given: I have a Turtle file with various data types
      const turtleContent = `
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        
        <#config>
          ex:name "MyConfig" ;
          ex:count "42"^^xsd:integer ;
          ex:active "true"^^xsd:boolean ;
          ex:nested <#nested> .
          
        <#nested>
          ex:value "nested-value" ;
          ex:list "item1", "item2", "item3" .
      `;

      // When: I extract template variables from the Turtle data
      const result = await parser.parseContent(turtleContent);

      // Then: I should get all available variable names
      expect(result.variables).toContain('config');
      expect(result.variables).toContain('nested');

      // And: variables should include nested paths for complex data
      expect(result.variables).toContain('config.name');
      expect(result.variables).toContain('config.count');
      expect(result.variables).toContain('config.active');
      expect(result.variables).toContain('nested.value');

      // And: the variable list should be sorted and deduplicated
      const sortedVariables = [...result.variables].sort();
      expect(result.variables).toEqual(sortedVariables);
      
      // Check for duplicates
      const uniqueVariables = [...new Set(result.variables)];
      expect(result.variables).toEqual(uniqueVariables);
    });
  });

  describe('RDF Data Loader Direct Usage', () => {
    it('should work with RDFDataLoader directly', async () => {
      const loader = new RDFDataLoader({
        convertTypes: true,
        propertyMappings: {
          'http://example.org/customName': 'title'
        }
      });

      const turtleContent = `
        @prefix ex: <http://example.org/> .
        <#item> ex:customName "Custom Title" .
      `;

      const result = await loader.loadContent(turtleContent);

      expect(result.success).toBe(true);
      expect(result.data.item.title).toBe('Custom Title');
    });
  });
});