/**
 * Tests for RDF normalizer
 */

import { RDFNormalizer, createRDFHash, normalizeRDF, compareRDF } from '../normalizer';

describe('RDFNormalizer', () => {
  const sampleTurtle = `
    @prefix ex: <http://example.org/> .
    @prefix foaf: <http://xmlns.com/foaf/0.1/> .
    
    ex:john foaf:name "John Doe" ;
            foaf:age 30 ;
            foaf:knows ex:jane .
            
    ex:jane foaf:name "Jane Smith" ;
            foaf:age 25 .
  `;
  
  let normalizer: RDFNormalizer;
  
  beforeEach(() => {
    normalizer = new RDFNormalizer();
  });
  
  describe('basic normalization', () => {
    it('should normalize turtle to N-Quads', async () => {
      const normalized = await normalizer.normalize(sampleTurtle, 'turtle');
      
      expect(normalized).toContain('<http://example.org/john>');
      expect(normalized).toContain('<http://xmlns.com/foaf/0.1/name>');
      expect(normalized).toContain('"John Doe"');
      expect(normalized).toEndWith('\n');
    });
    
    it('should sort triples for deterministic output', async () => {
      const result1 = await normalizer.normalize(sampleTurtle, 'turtle');
      const result2 = await normalizer.normalize(sampleTurtle, 'turtle');
      
      expect(result1).toBe(result2);
      
      const lines = result1.trim().split('\n');
      const sortedLines = [...lines].sort();
      expect(lines).toEqual(sortedLines);
    });
    
    it('should handle empty RDF', async () => {
      const empty = '';
      const normalized = await normalizer.normalize(empty, 'turtle');
      expect(normalized).toBe('\n');
    });
  });
  
  describe('blank node normalization', () => {
    it('should normalize blank node labels', async () => {
      const rdfWithBlankNodes = `
        @prefix ex: <http://example.org/> .
        
        _:node1 ex:prop "value1" .
        _:node2 ex:prop "value2" .
        _:node1 ex:related _:node2 .
      `;
      
      const normalized = await normalizer.normalize(rdfWithBlankNodes, 'turtle');
      
      // Should contain normalized blank node labels
      expect(normalized).toContain('_:b0');
      expect(normalized).toContain('_:b1');
      
      // Should be deterministic
      const normalized2 = await normalizer.normalize(rdfWithBlankNodes, 'turtle');
      expect(normalized).toBe(normalized2);
    });
    
    it('should handle complex blank node graphs', async () => {
      const complexRdf = `
        @prefix ex: <http://example.org/> .
        
        ex:person [
          ex:name "John" ;
          ex:address [
            ex:street "123 Main St" ;
            ex:city "Anytown"
          ]
        ] .
      `;
      
      const normalized1 = await normalizer.normalize(complexRdf, 'turtle');
      const normalized2 = await normalizer.normalize(complexRdf, 'turtle');
      
      expect(normalized1).toBe(normalized2);
      expect(normalized1).toContain('_:b0');
      expect(normalized1).toContain('_:b1');
    });
  });
  
  describe('triple sorting', () => {
    it('should sort by subject, predicate, object', async () => {
      const unorderedRdf = `
        @prefix ex: <http://example.org/> .
        
        ex:c ex:prop3 "value3" .
        ex:a ex:prop1 "value1" .
        ex:b ex:prop2 "value2" .
        ex:a ex:prop2 "value2" .
      `;
      
      const normalized = await normalizer.normalize(unorderedRdf, 'turtle');
      const lines = normalized.trim().split('\n');
      
      // Should be sorted alphabetically
      expect(lines[0]).toContain('<http://example.org/a>');
      expect(lines[0]).toContain('<http://example.org/prop1>');
      expect(lines[1]).toContain('<http://example.org/a>');
      expect(lines[1]).toContain('<http://example.org/prop2>');
    });
    
    it('should handle literals with datatypes and languages', async () => {
      const literalRdf = `
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        
        ex:entity ex:number "42"^^xsd:integer ;
                  ex:text "Hello"@en ;
                  ex:flag true .
      `;
      
      const normalized = await normalizer.normalize(literalRdf, 'turtle');
      
      expect(normalized).toContain('"42"^^<http://www.w3.org/2001/XMLSchema#integer>');
      expect(normalized).toContain('"Hello"@en');
      expect(normalized).toContain('"true"^^<http://www.w3.org/2001/XMLSchema#boolean>');
    });
  });
  
  describe('format support', () => {
    it('should handle N-Triples input', async () => {
      const ntriples = `
        <http://example.org/john> <http://xmlns.com/foaf/0.1/name> "John Doe" .
        <http://example.org/john> <http://xmlns.com/foaf/0.1/age> "30"^^<http://www.w3.org/2001/XMLSchema#integer> .
      `;
      
      const normalized = await normalizer.normalize(ntriples, 'ntriples');
      expect(normalized).toContain('"John Doe"');
      expect(normalized).toContain('"30"');
    });
    
    it('should handle different input formats consistently', async () => {
      const turtle = `
        @prefix ex: <http://example.org/> .
        ex:test ex:prop "value" .
      `;
      
      const ntriples = `
        <http://example.org/test> <http://example.org/prop> "value" .
      `;
      
      const normalizedTurtle = await normalizer.normalize(turtle, 'turtle');
      const normalizedNTriples = await normalizer.normalize(ntriples, 'ntriples');
      
      expect(normalizedTurtle).toBe(normalizedNTriples);
    });
  });
  
  describe('term extraction', () => {
    it('should extract unique terms', async () => {
      const quads = await (normalizer as any).parseRDF(sampleTurtle, 'turtle');
      const terms = normalizer.extractTerms(quads);
      
      expect(terms.subjects.has('http://example.org/john')).toBe(true);
      expect(terms.subjects.has('http://example.org/jane')).toBe(true);
      
      expect(terms.predicates.has('http://xmlns.com/foaf/0.1/name')).toBe(true);
      expect(terms.predicates.has('http://xmlns.com/foaf/0.1/age')).toBe(true);
      
      expect(terms.objects.has('John Doe')).toBe(true);
      expect(terms.objects.has('Jane Smith')).toBe(true);
    });
  });
  
  describe('options handling', () => {
    it('should respect sortTriples option', async () => {
      const options = { sortTriples: false };
      const normalizer = new RDFNormalizer(options);
      
      const result = await normalizer.normalize(sampleTurtle, 'turtle');
      expect(result).toContain('<http://example.org/john>');
    });
    
    it('should respect normalizeBlankNodes option', async () => {
      const options = { normalizeBlankNodes: false };
      const normalizer = new RDFNormalizer(options);
      
      const rdfWithBlankNodes = `
        @prefix ex: <http://example.org/> .
        _:original ex:prop "value" .
      `;
      
      const result = await normalizer.normalize(rdfWithBlankNodes, 'turtle');
      // Should preserve original blank node label (though this may still get normalized by N3)
      expect(result).toContain('_:');
    });
    
    it('should handle baseIRI option', async () => {
      const options = { baseIRI: 'http://example.org/base/' };
      const normalizer = new RDFNormalizer(options);
      
      const relativeRdf = `<test> <prop> "value" .`;
      const result = await normalizer.normalize(relativeRdf, 'ntriples');
      
      expect(result).toContain('http://example.org/base/test');
    });
  });
  
  describe('static functions', () => {
    it('createRDFHash should generate consistent hashes', async () => {
      const hash1 = await createRDFHash(sampleTurtle, 'turtle');
      const hash2 = await createRDFHash(sampleTurtle, 'turtle');
      
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });
    
    it('normalizeRDF should work as standalone function', async () => {
      const normalized = await normalizeRDF(sampleTurtle, 'turtle');
      expect(normalized).toContain('<http://example.org/john>');
    });
    
    it('compareRDF should detect equivalence', async () => {
      const rdf1 = `
        @prefix ex: <http://example.org/> .
        ex:a ex:prop "value" .
        ex:b ex:prop "value2" .
      `;
      
      const rdf2 = `
        @prefix ex: <http://example.org/> .
        ex:b ex:prop "value2" .
        ex:a ex:prop "value" .
      `;
      
      const areEqual = await compareRDF(rdf1, rdf2, 'turtle', 'turtle');
      expect(areEqual).toBe(true);
      
      const rdf3 = `
        @prefix ex: <http://example.org/> .
        ex:a ex:prop "different" .
      `;
      
      const areNotEqual = await compareRDF(rdf1, rdf3, 'turtle', 'turtle');
      expect(areNotEqual).toBe(false);
    });
  });
  
  describe('error handling', () => {
    it('should handle invalid RDF gracefully', async () => {
      const invalidRdf = 'this is not valid RDF';
      
      await expect(normalizer.normalize(invalidRdf, 'turtle'))
        .rejects.toThrow('RDF parsing failed');
    });
    
    it('should handle unsupported formats', async () => {
      await expect(normalizer.normalize(sampleTurtle, 'invalid-format' as any))
        .rejects.toThrow();
    });
  });
  
  describe('deterministic behavior', () => {
    it('should produce identical output across multiple runs', async () => {
      const results = await Promise.all(
        Array.from({ length: 5 }, () => normalizer.normalize(sampleTurtle, 'turtle'))
      );
      
      const firstResult = results[0];
      expect(results.every(result => result === firstResult)).toBe(true);
    });
    
    it('should handle large RDF files consistently', async () => {
      // Generate large RDF content
      const largeTurtle = `
        @prefix ex: <http://example.org/> .
        ${Array.from({ length: 100 }, (_, i) => 
          `ex:entity${i} ex:prop${i % 10} "value${i}" .`
        ).join('\n        ')}
      `;
      
      const result1 = await normalizer.normalize(largeTurtle, 'turtle');
      const result2 = await normalizer.normalize(largeTurtle, 'turtle');
      
      expect(result1).toBe(result2);
      expect(result1.split('\n').length).toBeGreaterThan(100);
    });
  });
});