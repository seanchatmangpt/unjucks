/**
 * Graph Diff Edge Cases Tests
 * Tests graph difference computation with complex scenarios
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GraphDiffer } from '../../src/graph/differ.js';
import { GraphProcessor } from '../../src/graph/processor.js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Graph Diff Edge Cases', () => {
  let differ;
  let processor;
  let testGraphs;

  beforeEach(async () => {
    differ = new GraphDiffer({
      algorithm: 'canonical',
      includeMetadata: true,
      detectMoves: true
    });
    
    processor = new GraphProcessor();
    
    // Load test fixtures
    const simpleGraph = readFileSync(resolve(__TEST_FIXTURES__, 'graphs', 'simple-person.ttl'), 'utf-8');
    const complexGraph = readFileSync(resolve(__TEST_FIXTURES__, 'graphs', 'complex-hierarchy.ttl'), 'utf-8');
    
    testGraphs = {
      simple: (await processor.parseRDF(simpleGraph, 'text/turtle')).graph,
      complex: (await processor.parseRDF(complexGraph, 'text/turtle')).graph
    };
  });

  describe('basic diff operations', () => {
    it('should detect simple additions', async () => {
      const graph1 = await processor.parseRDF(`
        @prefix ex: <http://example.org/> .
        ex:person1 ex:name "John" .
      `, 'text/turtle');
      
      const graph2 = await processor.parseRDF(`
        @prefix ex: <http://example.org/> .
        ex:person1 ex:name "John" .
        ex:person1 ex:age 30 .
      `, 'text/turtle');
      
      const diff = await differ.computeDiff(graph1.graph, graph2.graph);
      
      expect(diff.added).toHaveLength(1);
      expect(diff.removed).toHaveLength(0);
      expect(diff.modified).toHaveLength(0);
      expect(diff.added[0].predicate.value).toContain('age');
      expect(diff.added[0].object.value).toBe('30');
    });

    it('should detect simple removals', async () => {
      const graph1 = await processor.parseRDF(`
        @prefix ex: <http://example.org/> .
        ex:person1 ex:name "John" .
        ex:person1 ex:age 30 .
        ex:person1 ex:email "john@example.com" .
      `, 'text/turtle');
      
      const graph2 = await processor.parseRDF(`
        @prefix ex: <http://example.org/> .
        ex:person1 ex:name "John" .
        ex:person1 ex:age 30 .
      `, 'text/turtle');
      
      const diff = await differ.computeDiff(graph1.graph, graph2.graph);
      
      expect(diff.added).toHaveLength(0);
      expect(diff.removed).toHaveLength(1);
      expect(diff.modified).toHaveLength(0);
      expect(diff.removed[0].predicate.value).toContain('email');
    });

    it('should detect value modifications', async () => {
      const graph1 = await processor.parseRDF(`
        @prefix ex: <http://example.org/> .
        ex:person1 ex:name "John Doe" .
        ex:person1 ex:age 30 .
      `, 'text/turtle');
      
      const graph2 = await processor.parseRDF(`
        @prefix ex: <http://example.org/> .
        ex:person1 ex:name "John Smith" .
        ex:person1 ex:age 31 .
      `, 'text/turtle');
      
      const diff = await differ.computeDiff(graph1.graph, graph2.graph);
      
      expect(diff.added).toHaveLength(2);
      expect(diff.removed).toHaveLength(2);
      expect(diff.modified).toHaveLength(2);
      
      // Check that modifications are properly paired
      const nameModification = diff.modified.find(m => m.predicate.value.includes('name'));
      expect(nameModification).toBeDefined();
      expect(nameModification.oldValue.value).toBe('John Doe');
      expect(nameModification.newValue.value).toBe('John Smith');
    });
  });

  describe('blank node handling', () => {
    it('should handle blank nodes correctly', async () => {
      const graph1 = await processor.parseRDF(`
        @prefix ex: <http://example.org/> .
        ex:person1 ex:address [
          ex:street "123 Main St" ;
          ex:city "Boston"
        ] .
      `, 'text/turtle');
      
      const graph2 = await processor.parseRDF(`
        @prefix ex: <http://example.org/> .
        ex:person1 ex:address [
          ex:street "456 Oak Ave" ;
          ex:city "Boston"
        ] .
      `, 'text/turtle');
      
      const diff = await differ.computeDiff(graph1.graph, graph2.graph);
      
      // Should detect street change
      const streetChanges = diff.modified.filter(m => m.predicate.value.includes('street'));
      expect(streetChanges).toHaveLength(1);
      expect(streetChanges[0].oldValue.value).toBe('123 Main St');
      expect(streetChanges[0].newValue.value).toBe('456 Oak Ave');
      
      // City should remain unchanged
      const cityInUnchanged = diff.unchanged.some(u => 
        u.predicate.value.includes('city') && u.object.value === 'Boston'
      );
      expect(cityInUnchanged).toBe(true);
    });

    it('should detect blank node structural changes', async () => {
      const graph1 = await processor.parseRDF(`
        @prefix ex: <http://example.org/> .
        ex:person1 ex:address [
          ex:street "123 Main St"
        ] .
      `, 'text/turtle');
      
      const graph2 = await processor.parseRDF(`
        @prefix ex: <http://example.org/> .
        ex:person1 ex:address [
          ex:street "123 Main St" ;
          ex:zipcode "02101"
        ] .
      `, 'text/turtle');
      
      const diff = await differ.computeDiff(graph1.graph, graph2.graph);
      
      // Should detect addition of zipcode
      const zipcodeAdditions = diff.added.filter(a => a.predicate.value.includes('zipcode'));
      expect(zipcodeAdditions).toHaveLength(1);
      expect(zipcodeAdditions[0].object.value).toBe('02101');
    });
  });

  describe('complex structural changes', () => {
    it('should detect hierarchy restructuring', async () => {
      const graph1 = await processor.parseRDF(`
        @prefix ex: <http://example.org/> .
        @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
        
        ex:root skos:narrower ex:child1, ex:child2 .
        ex:child1 skos:broader ex:root .
        ex:child2 skos:broader ex:root .
      `, 'text/turtle');
      
      const graph2 = await processor.parseRDF(`
        @prefix ex: <http://example.org/> .
        @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
        
        ex:root skos:narrower ex:child1 .
        ex:child1 skos:broader ex:root ;
                  skos:narrower ex:child2 .
        ex:child2 skos:broader ex:child1 .
      `, 'text/turtle');
      
      const diff = await differ.computeDiff(graph1.graph, graph2.graph);
      
      // Should detect the hierarchy change (child2 moved under child1)
      expect(diff.statistics.addedCount).toBe(2); // New relationships
      expect(diff.statistics.removedCount).toBe(2); // Old relationships removed
      
      // Verify specific changes
      const child1NarrowerChild2 = diff.added.find(a => 
        a.subject.value.includes('child1') && 
        a.predicate.value.includes('narrower') &&
        a.object.value.includes('child2')
      );
      expect(child1NarrowerChild2).toBeDefined();
      
      const rootNarrowerChild2 = diff.removed.find(r => 
        r.subject.value.includes('root') && 
        r.predicate.value.includes('narrower') &&
        r.object.value.includes('child2')
      );
      expect(rootNarrowerChild2).toBeDefined();
    });

    it('should detect entity merging', async () => {
      const graph1 = await processor.parseRDF(`
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        ex:person1 foaf:name "John Doe" ;
                   foaf:email "john@example.com" .
        ex:person2 foaf:name "J. Doe" ;
                   foaf:phone "555-1234" .
      `, 'text/turtle');
      
      const graph2 = await processor.parseRDF(`
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        
        ex:person1 foaf:name "John Doe" ;
                   foaf:email "john@example.com" ;
                   foaf:phone "555-1234" ;
                   owl:sameAs ex:person2 .
      `, 'text/turtle');
      
      const diff = await differ.computeDiff(graph1.graph, graph2.graph);
      
      // Should detect merge (sameAs relation and property consolidation)
      const sameAsRelation = diff.added.find(a => a.predicate.value.includes('sameAs'));
      expect(sameAsRelation).toBeDefined();
      
      const phoneAddition = diff.added.find(a => 
        a.subject.value.includes('person1') && 
        a.predicate.value.includes('phone')
      );
      expect(phoneAddition).toBeDefined();
    });

    it('should detect entity splitting', async () => {
      const graph1 = await processor.parseRDF(`
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        @prefix schema: <http://schema.org/> .
        
        ex:johnsmith foaf:name "John Smith" ;
                     foaf:email "john@example.com" ;
                     schema:jobTitle "Engineer" ;
                     schema:worksFor ex:company1 .
      `, 'text/turtle');
      
      const graph2 = await processor.parseRDF(`
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        @prefix schema: <http://schema.org/> .
        
        ex:john foaf:name "John Smith" ;
                foaf:email "john@example.com" .
        
        ex:position1 schema:jobTitle "Engineer" ;
                     schema:employee ex:john ;
                     schema:organization ex:company1 .
      `, 'text/turtle');
      
      const diff = await differ.computeDiff(graph1.graph, graph2.graph);
      
      // Should detect the split (removal of combined entity, addition of separate entities)
      expect(diff.statistics.removedCount).toBeGreaterThan(0);
      expect(diff.statistics.addedCount).toBeGreaterThan(0);
      
      // Verify person entity still exists but with fewer properties
      const johnExists = diff.added.some(a => a.subject.value.includes('john'));
      expect(johnExists).toBe(true);
      
      // Verify position entity was created
      const positionExists = diff.added.some(a => a.subject.value.includes('position1'));
      expect(positionExists).toBe(true);
    });
  });

  describe('datatype and language tag changes', () => {
    it('should detect datatype changes', async () => {
      const graph1 = await processor.parseRDF(`
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        
        ex:person1 ex:age "30"^^xsd:string .
      `, 'text/turtle');
      
      const graph2 = await processor.parseRDF(`
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        
        ex:person1 ex:age "30"^^xsd:integer .
      `, 'text/turtle');
      
      const diff = await differ.computeDiff(graph1.graph, graph2.graph);
      
      expect(diff.modified).toHaveLength(1);
      expect(diff.modified[0].changeType).toBe('datatype_change');
      expect(diff.modified[0].oldValue.datatype.value).toContain('string');
      expect(diff.modified[0].newValue.datatype.value).toContain('integer');
    });

    it('should detect language tag changes', async () => {
      const graph1 = await processor.parseRDF(`
        @prefix ex: <http://example.org/> .
        
        ex:person1 ex:name "John Doe"@en .
      `, 'text/turtle');
      
      const graph2 = await processor.parseRDF(`
        @prefix ex: <http://example.org/> .
        
        ex:person1 ex:name "John Doe"@en-US .
      `, 'text/turtle');
      
      const diff = await differ.computeDiff(graph1.graph, graph2.graph);
      
      expect(diff.modified).toHaveLength(1);
      expect(diff.modified[0].changeType).toBe('language_tag_change');
      expect(diff.modified[0].oldValue.language).toBe('en');
      expect(diff.modified[0].newValue.language).toBe('en-US');
    });

    it('should handle mixed datatype and value changes', async () => {
      const graph1 = await processor.parseRDF(`
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        
        ex:measurement ex:value "3.14"^^xsd:string .
      `, 'text/turtle');
      
      const graph2 = await processor.parseRDF(`
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        
        ex:measurement ex:value "3.141592"^^xsd:double .
      `, 'text/turtle');
      
      const diff = await differ.computeDiff(graph1.graph, graph2.graph);
      
      expect(diff.modified).toHaveLength(1);
      expect(diff.modified[0].changeType).toBe('value_and_datatype_change');
      expect(diff.modified[0].oldValue.value).toBe('3.14');
      expect(diff.modified[0].newValue.value).toBe('3.141592');
    });
  });

  describe('namespace and prefix changes', () => {
    it('should handle namespace URI changes', async () => {
      const graph1 = await processor.parseRDF(`
        @prefix ex: <http://example.org/> .
        
        ex:person1 ex:name "John" .
      `, 'text/turtle');
      
      const graph2 = await processor.parseRDF(`
        @prefix ex: <http://newexample.org/> .
        
        ex:person1 ex:name "John" .
      `, 'text/turtle');
      
      const diff = await differ.computeDiff(graph1.graph, graph2.graph);
      
      // Should be treated as completely different entities
      expect(diff.added).toHaveLength(1);
      expect(diff.removed).toHaveLength(1);
      expect(diff.unchanged).toHaveLength(0);
      
      expect(diff.added[0].subject.value).toContain('newexample.org');
      expect(diff.removed[0].subject.value).toContain('example.org');
    });

    it('should ignore prefix changes when URIs are the same', async () => {
      const graph1 = await processor.parseRDF(`
        @prefix ex: <http://example.org/> .
        
        ex:person1 ex:name "John" .
      `, 'text/turtle');
      
      const graph2 = await processor.parseRDF(`
        @prefix example: <http://example.org/> .
        
        example:person1 example:name "John" .
      `, 'text/turtle');
      
      const diff = await differ.computeDiff(graph1.graph, graph2.graph);
      
      // Should be identical despite prefix differences
      expect(diff.added).toHaveLength(0);
      expect(diff.removed).toHaveLength(0);
      expect(diff.unchanged).toHaveLength(1);
    });
  });

  describe('large graph performance', () => {
    it('should handle large graphs efficiently', async () => {
      // Generate large graphs
      const largeGraph1Ttl = `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        ${Array.from({ length: 1000 }, (_, i) => 
          `ex:person${i} foaf:name "Person ${i}" ; foaf:age ${20 + (i % 50)} .`
        ).join('\n        ')}
      `;
      
      const largeGraph2Ttl = `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        ${Array.from({ length: 1000 }, (_, i) => 
          `ex:person${i} foaf:name "Person ${i}" ; foaf:age ${21 + (i % 50)} .`
        ).join('\n        ')}
      `;
      
      const graph1 = await processor.parseRDF(largeGraph1Ttl, 'text/turtle');
      const graph2 = await processor.parseRDF(largeGraph2Ttl, 'text/turtle');
      
      const start = this.getDeterministicTimestamp();
      const diff = await differ.computeDiff(graph1.graph, graph2.graph);
      const duration = this.getDeterministicTimestamp() - start;
      
      expect(diff.statistics.modifiedCount).toBe(1000); // All ages changed
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    }, 10000);

    it('should provide progress callbacks for large diffs', async () => {
      const progressCallbacks = [];
      
      const largeGraph1Ttl = `
        @prefix ex: <http://example.org/> .
        ${Array.from({ length: 500 }, (_, i) => 
          `ex:item${i} ex:value ${i} .`
        ).join('\n        ')}
      `;
      
      const largeGraph2Ttl = `
        @prefix ex: <http://example.org/> .
        ${Array.from({ length: 600 }, (_, i) => 
          `ex:item${i} ex:value ${i + 1} .`
        ).join('\n        ')}
      `;
      
      const graph1 = await processor.parseRDF(largeGraph1Ttl, 'text/turtle');
      const graph2 = await processor.parseRDF(largeGraph2Ttl, 'text/turtle');
      
      const diff = await differ.computeDiff(graph1.graph, graph2.graph, {
        onProgress: (progress) => {
          progressCallbacks.push(progress);
        }
      });
      
      expect(progressCallbacks.length).toBeGreaterThan(0);
      expect(progressCallbacks[progressCallbacks.length - 1].percentage).toBe(100);
      expect(diff.statistics.addedCount).toBe(100); // Items 500-599 added
      expect(diff.statistics.modifiedCount).toBe(500); // Items 0-499 modified
    });
  });

  describe('edge cases and error conditions', () => {
    it('should handle empty graphs', async () => {
      const emptyGraph1 = await processor.parseRDF('@prefix ex: <http://example.org/> .', 'text/turtle');
      const emptyGraph2 = await processor.parseRDF('@prefix ex: <http://example.org/> .', 'text/turtle');
      
      const diff = await differ.computeDiff(emptyGraph1.graph, emptyGraph2.graph);
      
      expect(diff.added).toHaveLength(0);
      expect(diff.removed).toHaveLength(0);
      expect(diff.unchanged).toHaveLength(0);
      expect(diff.statistics.totalTriples).toBe(0);
    });

    it('should handle completely different graphs', async () => {
      const graph1 = await processor.parseRDF(`
        @prefix ex1: <http://example1.org/> .
        ex1:subject1 ex1:predicate1 ex1:object1 .
      `, 'text/turtle');
      
      const graph2 = await processor.parseRDF(`
        @prefix ex2: <http://example2.org/> .
        ex2:subject2 ex2:predicate2 ex2:object2 .
      `, 'text/turtle');
      
      const diff = await differ.computeDiff(graph1.graph, graph2.graph);
      
      expect(diff.added).toHaveLength(1);
      expect(diff.removed).toHaveLength(1);
      expect(diff.unchanged).toHaveLength(0);
      expect(diff.similarity).toBeLessThan(0.1); // Very low similarity
    });

    it('should handle malformed triples gracefully', async () => {
      const normalGraph = await processor.parseRDF(`
        @prefix ex: <http://example.org/> .
        ex:person1 ex:name "John" .
      `, 'text/turtle');
      
      // Create a graph with a manually constructed malformed triple
      const malformedGraph = {
        triples: [
          {
            subject: { value: 'http://example.org/person1' },
            predicate: { value: null }, // Malformed
            object: { value: 'John' }
          }
        ]
      };
      
      const diff = await differ.computeDiff(normalGraph.graph, malformedGraph);
      
      expect(diff.success).toBe(true);
      expect(diff.warnings).toContainEqual(
        expect.objectContaining({
          type: 'malformed_triple',
          message: expect.stringContaining('null predicate')
        })
      );
    });

    it('should detect circular references', async () => {
      const graph1 = await processor.parseRDF(`
        @prefix ex: <http://example.org/> .
        ex:a ex:relatedTo ex:b .
        ex:b ex:relatedTo ex:c .
        ex:c ex:relatedTo ex:a .
      `, 'text/turtle');
      
      const graph2 = await processor.parseRDF(`
        @prefix ex: <http://example.org/> .
        ex:a ex:relatedTo ex:b .
        ex:b ex:relatedTo ex:c .
        ex:c ex:relatedTo ex:d .
        ex:d ex:relatedTo ex:a .
      `, 'text/turtle');
      
      const diff = await differ.computeDiff(graph1.graph, graph2.graph);
      
      expect(diff.added).toHaveLength(2); // ex:c -> ex:d, ex:d -> ex:a
      expect(diff.removed).toHaveLength(1); // ex:c -> ex:a
      
      // Should detect the structural change in the cycle
      expect(diff.metadata.circularReferences.before).toBe(1);
      expect(diff.metadata.circularReferences.after).toBe(1);
      expect(diff.metadata.circularReferences.lengthChanged).toBe(true);
    });
  });
});
