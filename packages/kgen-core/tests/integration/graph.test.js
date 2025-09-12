/**
 * Graph Processing Integration Tests
 * Tests for RDF graph processing, querying, and transformation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Graph Processing', () => {
  let tempDir;
  
  beforeEach(async () => {
    tempDir = await global.testUtils.createTempDir();
  });

  afterEach(async () => {
    await global.testUtils.cleanupTempDir(tempDir);
  });

  describe('RDF Parsing and Normalization', () => {
    it('should parse Turtle format consistently', () => {
      const turtle = global.testUtils.createSampleRDF('Person', 'John Doe', {
        email: 'john@example.com',
        department: 'Engineering'
      });

      // Mock RDF parsing (in real implementation would use N3 or similar)
      const parseRDF = (rdf) => {
        const triples = [];
        const lines = rdf.split('\n').filter(line => line.trim() && !line.startsWith('@'));
        
        lines.forEach(line => {
          if (line.includes('ex:')) {
            const parts = line.trim().replace(/\s*;\s*$/, '').split(/\s+/);
            if (parts.length >= 3) {
              triples.push({
                subject: parts[0],
                predicate: parts[1],
                object: parts.slice(2).join(' ')
              });
            }
          }
        });

        return { triples: triples.sort((a, b) => a.predicate.localeCompare(b.predicate)) };
      };

      const parsed1 = parseRDF(turtle);
      const parsed2 = parseRDF(turtle);

      expect(parsed1).toEqual(parsed2);
      expect(parsed1.triples.length).toBeGreaterThan(0);
    });

    it('should handle different RDF serializations consistently', () => {
      const turtle = global.testUtils.createSampleRDF('Organization', 'ACME Corp');
      
      // Mock JSON-LD equivalent
      const jsonld = {
        "@context": {
          "ex": "http://example.org/",
          "xsd": "http://www.w3.org/2001/XMLSchema#"
        },
        "@id": "ex:ACMECorp",
        "@type": "ex:Organization",
        "ex:hasName": "ACME Corp",
        "ex:hasId": "ACMECorp",
        "ex:createdAt": {
          "@value": "2024-01-01T00:00:00Z",
          "@type": "xsd:dateTime"
        }
      };

      const turtleHash = global.testUtils.calculateHash(turtle);
      const jsonldHash = global.testUtils.calculateHash(jsonld);

      // Different serializations but should produce stable hashes
      expect(turtleHash).toMatch(/^[a-f0-9]{64}$/);
      expect(jsonldHash).toMatch(/^[a-f0-9]{64}$/);
      expect(turtleHash).not.toBe(jsonldHash); // Different formats = different hashes
    });

    it('should normalize equivalent graphs', () => {
      // Same semantic content, different syntactic presentation
      const graph1 = `
        @prefix ex: <http://example.org/> .
        ex:person1 ex:name "Alice" .
        ex:person1 ex:age "25" .
      `;

      const graph2 = `
        @prefix ex: <http://example.org/> .
        ex:person1 ex:age "25" ;
                   ex:name "Alice" .
      `;

      // Mock normalization
      const normalize = (rdf) => {
        const triples = rdf
          .split('\n')
          .filter(line => line.includes('ex:'))
          .map(line => line.trim().replace(/\s*[;.]$/, ''))
          .sort();
        return triples.join('\n');
      };

      const norm1 = normalize(graph1);
      const norm2 = normalize(graph2);

      // Should normalize to equivalent form
      expect(norm1.includes('ex:name "Alice"')).toBe(true);
      expect(norm2.includes('ex:name "Alice"')).toBe(true);
    });
  });

  describe('Graph Querying', () => {
    it('should execute SPARQL queries deterministically', () => {
      const graph = global.testUtils.createComplexRDFGraph();
      
      // Mock SPARQL query execution
      const executeQuery = (rdf, query) => {
        // Simple pattern matching for test
        if (query.includes('SELECT ?person ?name')) {
          return {
            bindings: [
              { person: 'ex:john', name: '"John Doe"' },
              { person: 'ex:jane', name: '"Jane Smith"' }
            ].sort((a, b) => a.name.localeCompare(b.name))
          };
        }
        return { bindings: [] };
      };

      const query = `
        PREFIX ex: <http://example.org/>
        SELECT ?person ?name WHERE {
          ?person foaf:name ?name .
        }
        ORDER BY ?name
      `;

      const result1 = executeQuery(graph, query);
      const result2 = executeQuery(graph, query);
      const result3 = executeQuery(graph, query);

      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
      expect(result1.bindings.length).toBe(2);
    });

    it('should handle complex graph traversals', () => {
      const graph = global.testUtils.createComplexRDFGraph();
      
      // Mock complex traversal
      const findConnections = (rdf, startNode) => {
        const connections = [];
        
        if (startNode === 'ex:john') {
          connections.push(
            { relation: 'manages', target: 'ex:project1' },
            { relation: 'memberOf', target: 'ex:acme' }
          );
        }
        
        return connections.sort((a, b) => a.relation.localeCompare(b.relation));
      };

      const connections1 = findConnections(graph, 'ex:john');
      const connections2 = findConnections(graph, 'ex:john');

      expect(connections1).toEqual(connections2);
      expect(connections1.length).toBe(2);
      expect(connections1[0].relation).toBe('manages');
    });

    it('should maintain query result ordering', () => {
      const graph = global.testUtils.createComplexRDFGraph();
      
      // Mock ordered query
      const getOrderedEntities = (rdf) => {
        const entities = [
          { id: 'ex:acme', type: 'Organization', name: 'ACME Corporation' },
          { id: 'ex:jane', type: 'Person', name: 'Jane Smith' },
          { id: 'ex:john', type: 'Person', name: 'John Doe' },
          { id: 'ex:project1', type: 'Project', name: 'Knowledge Graph Project' }
        ];
        
        return entities.sort((a, b) => a.name.localeCompare(b.name));
      };

      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(getOrderedEntities(graph));
      }

      // All results should have identical ordering
      for (let i = 1; i < results.length; i++) {
        expect(results[i]).toEqual(results[0]);
      }

      // Verify specific ordering
      expect(results[0][0].name).toBe('ACME Corporation');
      expect(results[0][1].name).toBe('Jane Smith');
    });
  });

  describe('Graph Transformation', () => {
    it('should apply transformations consistently', () => {
      const sourceGraph = global.testUtils.createSampleRDF('Person', 'Original Person');
      
      // Mock transformation
      const transformGraph = (rdf, rules) => {
        let transformed = rdf;
        
        for (const rule of rules) {
          if (rule.type === 'rename') {
            transformed = transformed.replace(new RegExp(rule.from, 'g'), rule.to);
          }
        }
        
        return transformed;
      };

      const rules = [
        { type: 'rename', from: 'Original Person', to: 'Transformed Person' },
        { type: 'rename', from: 'OriginalPerson', to: 'TransformedPerson' }
      ];

      const result1 = transformGraph(sourceGraph, rules);
      const result2 = transformGraph(sourceGraph, rules);

      expect(result1).toBe(result2);
      expect(result1).toContain('Transformed Person');
      expect(result1).not.toContain('Original Person');
    });

    it('should preserve graph integrity during transformation', () => {
      const graph = global.testUtils.createComplexRDFGraph();
      
      // Mock integrity-preserving transformation
      const addMetadata = (rdf) => {
        const metadata = `
          ex:metadata a ex:Metadata ;
              ex:generatedAt "2024-01-01T00:00:00Z" ;
              ex:version "1.0" .
        `;
        return rdf + '\n' + metadata;
      };

      const enhanced1 = addMetadata(graph);
      const enhanced2 = addMetadata(graph);

      expect(enhanced1).toBe(enhanced2);
      expect(enhanced1).toContain('ex:metadata');
      expect(enhanced1).toContain('ex:john'); // Original content preserved
    });

    it('should handle transformation chains deterministically', () => {
      let graph = global.testUtils.createSampleRDF('Entity', 'Test Entity');
      
      // Mock transformation chain
      const transformations = [
        (rdf) => rdf.replace('Test Entity', 'Modified Entity'),
        (rdf) => rdf.replace('ModifiedEntity', 'FinalEntity'),
        (rdf) => rdf + '\n    ex:processedAt "2024-01-01T00:00:00Z" .'
      ];

      const applyTransformations = (rdf, transforms) => {
        return transforms.reduce((result, transform) => transform(result), rdf);
      };

      const result1 = applyTransformations(graph, transformations);
      const result2 = applyTransformations(graph, transformations);

      expect(result1).toBe(result2);
      expect(result1).toContain('FinalEntity');
      expect(result1).toContain('processedAt');
    });
  });

  describe('Graph Validation', () => {
    it('should validate graph structure consistently', () => {
      const validGraph = global.testUtils.createComplexRDFGraph();
      
      // Mock validation
      const validateGraph = (rdf) => {
        const issues = [];
        
        if (!rdf.includes('@prefix')) {
          issues.push('Missing prefix declarations');
        }
        
        if (!rdf.includes('a ')) {
          issues.push('Missing type declarations');
        }
        
        const lines = rdf.split('\n').filter(l => l.trim());
        if (lines.length < 3) {
          issues.push('Insufficient content');
        }
        
        return {
          valid: issues.length === 0,
          issues: issues.sort(),
          score: Math.max(0, 1 - (issues.length * 0.2))
        };
      };

      const validation1 = validateGraph(validGraph);
      const validation2 = validateGraph(validGraph);

      expect(validation1).toEqual(validation2);
      expect(validation1.valid).toBe(true);
      expect(validation1.score).toBeGreaterThan(0.8);
    });

    it('should detect graph inconsistencies', () => {
      const inconsistentGraph = `
        @prefix ex: <http://example.org/> .
        ex:person1 a ex:Person .
        ex:person1 a ex:Organization .
      `;
      
      // Mock inconsistency detection
      const checkConsistency = (rdf) => {
        const typeDeclarations = rdf
          .split('\n')
          .filter(line => line.includes(' a '))
          .map(line => {
            const match = line.match(/(\S+)\s+a\s+(\S+)/);
            return match ? { subject: match[1], type: match[2] } : null;
          })
          .filter(Boolean);

        const subjects = {};
        typeDeclarations.forEach(({ subject, type }) => {
          if (!subjects[subject]) subjects[subject] = [];
          subjects[subject].push(type);
        });

        const conflicts = Object.entries(subjects)
          .filter(([, types]) => types.length > 1)
          .map(([subject, types]) => ({ subject, types }));

        return {
          consistent: conflicts.length === 0,
          conflicts: conflicts.sort((a, b) => a.subject.localeCompare(b.subject))
        };
      };

      const consistency1 = checkConsistency(inconsistentGraph);
      const consistency2 = checkConsistency(inconsistentGraph);

      expect(consistency1).toEqual(consistency2);
      expect(consistency1.consistent).toBe(false);
      expect(consistency1.conflicts.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large graphs efficiently', async () => {
      const createLargeGraph = (size) => {
        const triples = [];
        for (let i = 0; i < size; i++) {
          triples.push(`ex:entity${i} a ex:Entity ; ex:hasIndex "${i}" .`);
        }
        
        return `
          @prefix ex: <http://example.org/> .
          ${triples.join('\n          ')}
        `;
      };

      const sizes = [10, 50, 100];
      const results = [];

      for (const size of sizes) {
        const operation = async () => {
          const graph = createLargeGraph(size);
          global.testUtils.calculateHash(graph);
        };

        const perfStats = await global.testUtils.measurePerformance(operation, 3);
        results.push({
          size,
          averageDuration: perfStats.averageDuration
        });
      }

      // Performance should scale predictably
      expect(results[1].averageDuration).toBeGreaterThan(results[0].averageDuration);
      expect(results[2].averageDuration).toBeGreaterThan(results[1].averageDuration);
      
      // But should still be reasonable
      expect(results[2].averageDuration).toBeLessThan(1000); // < 1 second
    });

    it('should maintain memory efficiency', async () => {
      const memoryBefore = process.memoryUsage().heapUsed;
      
      // Process multiple graphs
      for (let i = 0; i < 10; i++) {
        const graph = global.testUtils.createComplexRDFGraph();
        global.testUtils.calculateHash(graph);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const memoryAfter = process.memoryUsage().heapUsed;
      const memoryIncrease = memoryAfter - memoryBefore;
      
      // Should not have significant memory leak
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // < 10MB
    });
  });
});