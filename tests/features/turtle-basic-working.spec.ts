/**
 * Working Turtle Data Support BDD Test
 * Demonstrates vitest-cucumber infrastructure with RDFDataLoader
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader.js';
import fs from 'fs-extra';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Working Turtle Data Support', () => {
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

  describe('Basic RDF Data Loading', () => {
    it('should successfully load and validate simple Turtle data', async () => {
      // Given: I have a simple Turtle file with person data
      const turtleContent = `
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        @prefix ex: <http://example.org/> .
        
        ex:person1 a foaf:Person ;
          foaf:name "John Doe" ;
          foaf:email "john.doe@example.com" .
      `;
      
      const turtleFilePath = join(testDir, 'person.ttl');
      fs.writeFileSync(turtleFilePath, turtleContent);

      // When: I load the RDF data using RDFDataLoader
      const source = { type: 'file' as const, path: turtleFilePath };
      const result = await dataLoader.loadFromSource(source);

      // Then: the loading should succeed
      expect(result.success).toBe(true);

      // And: I should get structured RDF data
      expect(result.data).toBeDefined();
      expect(result.data.triples.length).toBeGreaterThan(0);
      
      // And: I should get proper prefixes
      expect(result.data.prefixes).toHaveProperty('foaf');
      expect(result.data.prefixes['foaf']).toBe('http://xmlns.com/foaf/0.1/');
      
      // And: I should get RDF resources
      expect(result.data.resources).toBeDefined();
      expect(Object.keys(result.data.resources).length).toBeGreaterThan(0);

      // And: Template variables should be extracted
      expect(result.variables).toBeDefined();
    });

    it('should handle validation of RDF syntax', async () => {
      // Given: I have valid Turtle syntax
      const validTurtle = `
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        ex:person foaf:name "Test" .
      `;

      // When: I validate the syntax
      const validationResult = await dataLoader.validateRDF(validTurtle, 'turtle');

      // Then: validation should pass
      expect(validationResult.valid).toBe(true);
      expect(validationResult.errors).toHaveLength(0);
    });

    it('should detect invalid RDF syntax', async () => {
      // Given: I have invalid Turtle syntax
      const invalidTurtle = `
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        ex:person foaf:name "Unclosed quote ;
      `;

      // When: I validate the syntax
      const validationResult = await dataLoader.validateRDF(invalidTurtle, 'turtle');

      // Then: validation should fail
      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors.length).toBeGreaterThan(0);
    });

    it('should provide template context for rendering', async () => {
      // Given: I have RDF data with template-relevant information
      const turtleContent = `
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        @prefix ex: <http://example.org/> .
        
        ex:project1 ex:name "Website Redesign" ;
          ex:budget "50000" ;
          ex:status "active" .
      `;
      
      const turtleFilePath = join(testDir, 'project.ttl');
      fs.writeFileSync(turtleFilePath, turtleContent);

      // When: I load the data and create template context
      const source = { type: 'file' as const, path: turtleFilePath };
      const result = await dataLoader.loadFromSource(source);
      const templateContext = dataLoader.createTemplateContext(result.data, result.variables);

      // Then: I should get a context suitable for template rendering
      expect(templateContext).toBeDefined();
      expect(templateContext.data).toBeDefined();
      expect(templateContext.variables).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should gracefully handle non-existent files', async () => {
      // Given: I have a path to a non-existent file
      const nonExistentFile = join(testDir, 'does-not-exist.ttl');

      // When: I try to load from the non-existent file
      const source = { type: 'file' as const, path: nonExistentFile };
      
      // Then: it should handle the error gracefully
      await expect(dataLoader.loadFromSource(source)).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle moderately-sized RDF datasets efficiently', async () => {
      // Given: I have a moderately-sized Turtle dataset
      const lines = [];
      for (let i = 1; i <= 100; i++) {
        lines.push(`ex:person${i} foaf:name "Person ${i}" ; foaf:age ${20 + i % 50} .`);
      }
      
      const turtleContent = `
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        @prefix ex: <http://example.org/> .
        
        ${lines.join('\n')}
      `;
      
      const turtleFilePath = join(testDir, 'large-dataset.ttl');
      fs.writeFileSync(turtleFilePath, turtleContent);

      // When: I load the dataset and measure performance
      const startTime = Date.now();
      const source = { type: 'file' as const, path: turtleFilePath };
      const result = await dataLoader.loadFromSource(source);
      const endTime = Date.now();
      
      const processingTime = endTime - startTime;

      // Then: processing should complete reasonably quickly
      expect(processingTime).toBeLessThan(1000); // Less than 1 second
      expect(result.success).toBe(true);
      expect(result.data.triples.length).toBe(300); // 100 people * 3 triples each
    });
  });
});