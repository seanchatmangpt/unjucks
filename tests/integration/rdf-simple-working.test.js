import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve, join } from 'path';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader.js';
import { TurtleParser } from '../../src/lib/turtle-parser.js';
import { RDFFilters } from '../../src/lib/rdf-filters.js';
import { KnowledgeGraphProcessor } from '../../src/lib/knowledge-graph-processor.js';

/**
 * Working RDF Integration Tests - Fixed Version
 * Tests that demonstrate the complete semantic web pipeline works correctly
 */
describe('Working RDF Integration Tests', () => {
  let dataLoader;
  let parser;
  let rdfFilters;
  let kgProcessor;
  
  const fixturesPath = resolve(process.cwd(), 'tests/fixtures/turtle');

  beforeEach(() => {
    dataLoader = new RDFDataLoader({
      cacheEnabled: true,
      templateDir: fixturesPath
    });
    
    parser = new TurtleParser();
    rdfFilters = new RDFFilters();
    kgProcessor = new KnowledgeGraphProcessor();
  });

  afterEach(() => {
    dataLoader.clearCache();
    rdfFilters.clearStore();
    kgProcessor.clear();
  });

  describe('Basic RDF Processing', () => {
    it('should load and parse basic person data from inline turtle', async () => {
      const turtleData = `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        @prefix schema: <http://schema.org/> .
        
        ex:person1 a foaf:Person ;
                   foaf:name "John Doe" ;
                   foaf:age "30"^^<http://www.w3.org/2001/XMLSchema#integer> ;
                   foaf:email "john@example.com" .
                   
        ex:person2 a foaf:Person ;
                   foaf:name "Jane Smith" ;
                   foaf:age "25"^^<http://www.w3.org/2001/XMLSchema#integer> ;
                   foaf:email "jane@example.com" .
      `;

      const dataSource = {
        type: 'inline',
        content: turtleData
      };

      const result = await dataLoader.loadFromSource(dataSource);
      
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data.triples.length).toBeGreaterThan(0);
      expect(result.data.subjects).toBeDefined();
      expect(Object.keys(result.data.subjects)).toContain('http://example.org/person1');
      
      console.log(`✅ Parsed ${result.data.triples.length} triples successfully`);
    });

    it('should execute basic RDF queries after loading data', async () => {
      const simpleData = `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        ex:john a foaf:Person ;
                foaf:name "John Doe" ;
                foaf:age "30"^^<http://www.w3.org/2001/XMLSchema#integer> .
      `;

      const dataSource = {
        type: 'inline',
        content: simpleData
      };

      const result = await dataLoader.loadFromSource(dataSource);
      expect(result.success).toBe(true);
      
      rdfFilters.updateStore(result.data.triples);
      
      const persons = rdfFilters.rdfSubject('rdf:type', 'foaf:Person');
      expect(persons).toHaveLength(1);
      expect(persons[0]).toBe('http://example.org/john');
      
      const johnName = rdfFilters.rdfObject('ex:john', 'foaf:name');
      expect(johnName[0]?.value).toBe('John Doe');
      
      console.log(`✅ Found ${persons.length} person(s) with RDF queries`);
    });

    it('should handle parsing errors gracefully', async () => {
      const invalidData = `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        ex:invalid a foaf:Person ;
                   foaf:name "Missing end quote ;
                   foaf:age ;;; invalid triple structure
      `;

      const dataSource = {
        type: 'inline',
        content: invalidData
      };

      const result = await dataLoader.loadFromSource(dataSource);
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.data.subjects).toEqual({});
      
      console.log(`✅ Gracefully handled ${result.errors.length} parsing error(s)`);
    });
  });

  describe('Template Context Integration', () => {
    it('should create working template context with $rdf helpers', async () => {
      const turtleData = `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        ex:person1 a foaf:Person ;
                   foaf:name "Alice Johnson" ;
                   foaf:email "alice@example.com" .
                   
        ex:person2 a foaf:Person ;
                   foaf:name "Bob Wilson" ;
                   foaf:email "bob@example.com" .
      `;

      const dataSource = {
        type: 'inline',
        content: turtleData
      };

      const result = await dataLoader.loadFromSource(dataSource);
      expect(result.success).toBe(true);
      
      const templateContext = dataLoader.createTemplateContext(result.data, result.variables);
      
      expect(templateContext).toHaveProperty('$rdf');
      expect(templateContext.$rdf).toHaveProperty('subjects');
      expect(templateContext.$rdf).toHaveProperty('getByType');
      
      // Test the $rdf.getByType function
      const persons = templateContext.$rdf.getByType('foaf:Person');
      expect(persons).toHaveLength(2);
      expect(persons[0]).toHaveProperty('uri');
      expect(persons[0].uri).toContain('person');
      
      console.log(`✅ Template context created with ${persons.length} person(s) accessible via $rdf.getByType`);
    });
  });

  describe('Knowledge Graph Processing', () => {
    it('should process RDF data through knowledge graph with semantic reasoning', async () => {
      const turtleData = `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        @prefix org: <http://www.w3.org/ns/org#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        
        # Type hierarchy - creates transitive chain for inference
        ex:Employee rdfs:subClassOf ex:Person .
        ex:Person rdfs:subClassOf foaf:Agent .
        
        # Additional hierarchy for more inference
        ex:Manager rdfs:subClassOf ex:Employee .
        ex:SeniorManager rdfs:subClassOf ex:Manager .
        
        # Individual with type that should trigger inference
        ex:john a ex:Employee ;
                foaf:name "John Smith" ;
                org:memberOf ex:company .
                
        ex:alice a ex:Manager ;
               foaf:name "Alice Johnson" .
      `;

      const dataSource = {
        type: 'inline',
        content: turtleData
      };

      const result = await dataLoader.loadFromSource(dataSource);
      expect(result.success).toBe(true);
      
      kgProcessor.loadTriples(result.data.triples);
      const inferenceCount = kgProcessor.runInference();
      
      expect(inferenceCount).toBeGreaterThan(0);
      
      const johnTypes = kgProcessor.getEntityTypes('http://example.org/john');
      expect(johnTypes).toContain('http://example.org/Employee');
      expect(johnTypes).toContain('http://example.org/Person'); // Inferred
      expect(johnTypes).toContain('http://xmlns.com/foaf/0.1/Agent'); // Inferred
      
      console.log(`✅ Knowledge graph inference created ${inferenceCount} new relations`);
      console.log(`✅ John has ${johnTypes.length} types: ${johnTypes.map(t => t.split('/').pop()).join(', ')}`);
    });
  });

  describe('Performance and Caching', () => {
    it('should cache data and improve subsequent loads', async () => {
      const turtleData = `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        
        ex:person1 a foaf:Person ;
                   foaf:name "Cache Test Person" ;
                   foaf:email "test@example.com" .
      `;

      const dataSource = {
        type: 'inline',
        content: turtleData
      };

      // Cold cache load
      dataLoader.clearCache();
      const start1 = performance.now();
      const result1 = await dataLoader.loadFromSource(dataSource);
      const time1 = performance.now() - start1;
      
      expect(result1.success).toBe(true);

      // Warm cache load
      const start2 = performance.now();
      const result2 = await dataLoader.loadFromSource(dataSource);
      const time2 = performance.now() - start2;
      
      expect(result2.success).toBe(true);
      expect(time2).toBeLessThan(time1); // Should be faster due to caching
      
      console.log(`✅ Cache performance: ${time1.toFixed(2)}ms → ${time2.toFixed(2)}ms (${((time1 - time2) / time1 * 100).toFixed(1)}% improvement)`);
    });

    it('should provide cache statistics', () => {
      const stats = dataLoader.getCacheStats();
      
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('keys');
      expect(stats).toHaveProperty('totalSize');
      expect(typeof stats.size).toBe('number');
      
      console.log(`✅ Cache stats: ${stats.size} entries, ${stats.totalSize} bytes`);
    });
  });

  describe('Integration Test Summary', () => {
    it('should validate complete RDF pipeline works end-to-end', async () => {
      console.log('\n🎯 RDF Pipeline End-to-End Test');
      console.log('═'.repeat(50));

      const testData = `
        @prefix ex: <http://example.org/> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        @prefix schema: <http://schema.org/> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        
        # Class hierarchy that will trigger inference
        ex:Employee rdfs:subClassOf schema:Person .
        schema:Person rdfs:subClassOf foaf:Agent .
        ex:Manager rdfs:subClassOf ex:Employee .
        
        # Data with types that should trigger type inheritance
        ex:alice a ex:Employee ;
                 foaf:name "Alice Cooper" ;
                 foaf:email "alice@company.com" ;
                 schema:worksFor ex:company .
                 
        ex:bob a ex:Manager ;
               foaf:name "Bob Smith" ;
               schema:worksFor ex:company .
                 
        ex:company a schema:Organization ;
                   schema:name "Test Company" .
      `;

      // Step 1: Parse RDF
      const parseStart = performance.now();
      const result = await dataLoader.loadFromSource({
        type: 'inline',
        content: testData
      });
      const parseTime = performance.now() - parseStart;
      
      expect(result.success).toBe(true);
      console.log(`✅ 1. RDF Parsing: ${parseTime.toFixed(2)}ms, ${result.data.triples.length} triples`);

      // Step 2: RDF Filtering
      const filterStart = performance.now();
      rdfFilters.updateStore(result.data.triples);
      const employees = rdfFilters.rdfSubject('rdf:type', 'ex:Employee');
      const filterTime = performance.now() - filterStart;
      
      expect(employees).toHaveLength(1);
      console.log(`✅ 2. RDF Filtering: ${filterTime.toFixed(2)}ms, found ${employees.length} employee(s)`);

      // Step 3: Template Context
      const contextStart = performance.now();
      const templateContext = dataLoader.createTemplateContext(result.data, result.variables);
      const contextTime = performance.now() - contextStart;
      
      expect(templateContext.$rdf.getByType('ex:Employee')).toHaveLength(1);
      console.log(`✅ 3. Template Context: ${contextTime.toFixed(2)}ms`);

      // Step 4: Knowledge Graph
      const kgStart = performance.now();
      kgProcessor.loadTriples(result.data.triples);
      const inferences = kgProcessor.runInference();
      const kgTime = performance.now() - kgStart;
      
      expect(inferences).toBeGreaterThan(0);
      console.log(`✅ 4. Knowledge Graph: ${kgTime.toFixed(2)}ms, ${inferences} inference(s)`);

      const totalTime = parseTime + filterTime + contextTime + kgTime;
      console.log(`\n🚀 Total Pipeline Time: ${totalTime.toFixed(2)}ms`);
      console.log('═'.repeat(50));

      // Validate performance requirements
      expect(totalTime).toBeLessThan(1000); // Should complete in under 1 second
      expect(result.data.triples.length).toBeGreaterThan(0);
      expect(employees.length).toBeGreaterThan(0);
      expect(inferences).toBeGreaterThan(0);

      console.log('🎯 All RDF integration tests passed! ✅');
    });
  });
});