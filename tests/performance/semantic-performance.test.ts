import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { performance } from 'node:perf_hooks';
import { TurtleParser } from '../../src/lib/turtle-parser.js';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader.js';
import { RDFFilters } from '../../src/lib/rdf-filters.js';
import { Store, DataFactory } from 'n3';
import type { RDFDataSource, TurtleData } from '../../src/lib/types/turtle-types.js';
import fs from 'fs-extra';

const { namedNode, literal, quad } = DataFactory;

describe('Semantic Reasoning Performance Tests', () => {
  let parser: TurtleParser;
  let rdfLoader: RDFDataLoader;
  let rdfFilters: RDFFilters;
  let store: Store;

  beforeAll(async () => {
    await fs.ensureDir('tests/fixtures/performance');
    await generatePerformanceTestData();
  });

  beforeEach(() => {
    parser = new TurtleParser();
    rdfLoader = new RDFDataLoader({ cacheEnabled: true });
    store = new Store();
    rdfFilters = new RDFFilters({ store });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Large RDF Graph Processing Performance', () => {
    it('should parse large TTL files efficiently', async () => {
      // Generate large enterprise ontology (10K+ triples)
      const largeOntology = generateLargeEnterpriseOntology(2000); // 2000 entities = ~10K triples

      const startTime = performance.now();
      const parseResult = await parser.parse(largeOntology);
      const parseTime = performance.now() - startTime;

      // Performance assertions
      expect(parseTime).toBeLessThan(5000); // Should parse in under 5 seconds
      expect(parseResult.triples.length).toBeGreaterThan(8000); // Should have many triples
      expect(parseResult.stats.tripleCount).toBeGreaterThan(8000);

      // Memory usage check
      const memoryUsage = process.memoryUsage();
      expect(memoryUsage.heapUsed).toBeLessThan(500 * 1024 * 1024); // Under 500MB

      // Verify parsing accuracy
      expect(parseResult.prefixes).toHaveProperty('enterprise');
      expect(parseResult.prefixes).toHaveProperty('api');
      expect(parseResult.prefixes).toHaveProperty('security');
    });

    it('should handle massive knowledge graphs with streaming processing', async () => {
      // Generate a very large knowledge graph (50K+ triples)
      const massiveGraph = generateMassiveKnowledgeGraph(10000); // 10K entities

      const startTime = performance.now();
      const parseResult = await parser.parse(massiveGraph);
      const parseTime = performance.now() - startTime;

      // Performance requirements for massive graphs
      expect(parseTime).toBeLessThan(30000); // Should complete in under 30 seconds
      expect(parseResult.triples.length).toBeGreaterThan(40000);

      // Memory efficiency check
      const memoryAfterParsing = process.memoryUsage();
      expect(memoryAfterParsing.heapUsed).toBeLessThan(1024 * 1024 * 1024); // Under 1GB

      // Test incremental processing
      const quads = parseResult.triples.slice(0, 1000).map(triple => 
        quad(
          namedNode(triple.subject.value),
          namedNode(triple.predicate.value),
          triple.object.type === 'uri' ? namedNode(triple.object.value) : literal(triple.object.value)
        )
      );

      const storeStartTime = performance.now();
      store.addQuads(quads);
      const storeTime = performance.now() - storeStartTime;

      expect(storeTime).toBeLessThan(1000); // Adding quads should be fast
    });

    it('should optimize repeated reasoning operations', async () => {
      // Setup test data for repeated operations
      const testOntology = `
        @prefix test: <http://example.org/test#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

        ${Array.from({length: 1000}, (_, i) => `
          test:Entity${i} a test:BaseEntity ;
              test:hasProperty test:Property${i} ;
              test:hasValue ${i} ;
              rdfs:label "Entity ${i}" .
        `).join('')}
      `;

      const parseResult = await parser.parse(testOntology);
      const quads = parseResult.triples.map(triple => 
        quad(
          namedNode(triple.subject.value),
          namedNode(triple.predicate.value),
          triple.object.type === 'uri' ? namedNode(triple.object.value) : literal(triple.object.value)
        )
      );
      store.addQuads(quads);

      // Benchmark repeated queries
      const iterations = 1000;
      const queryTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        const results = rdfFilters.rdfObject(`http://example.org/test#Entity${i % 100}`, 'http://example.org/test#hasValue');
        const queryTime = performance.now() - startTime;
        queryTimes.push(queryTime);
        
        expect(results.length).toBeGreaterThan(0);
      }

      const averageQueryTime = queryTimes.reduce((sum, time) => sum + time, 0) / queryTimes.length;
      const maxQueryTime = Math.max(...queryTimes);

      expect(averageQueryTime).toBeLessThan(5); // Average query under 5ms
      expect(maxQueryTime).toBeLessThan(50); // Max query under 50ms

      // Test query optimization - subsequent queries should be faster
      const firstHalfAvg = queryTimes.slice(0, 500).reduce((sum, time) => sum + time, 0) / 500;
      const secondHalfAvg = queryTimes.slice(500).reduce((sum, time) => sum + time, 0) / 500;

      // Expect some performance improvement due to caching/optimization
      expect(secondHalfAvg).toBeLessThanOrEqual(firstHalfAvg * 1.1); // Allow for some variance
    });
  });

  describe('N3 Reasoning Engine Performance', () => {
    it('should apply complex reasoning rules efficiently', async () => {
      const complexOntologyWithRules = `
        @prefix enterprise: <http://example.org/enterprise#> .
        @prefix api: <http://example.org/api#> .
        @prefix security: <http://example.org/security#> .
        @prefix compliance: <http://example.org/compliance#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

        # Class hierarchy
        enterprise:Service a rdfs:Class .
        api:APIService rdfs:subClassOf enterprise:Service .
        api:RESTService rdfs:subClassOf api:APIService .
        api:GraphQLService rdfs:subClassOf api:APIService .

        # Properties
        enterprise:hasSecurityLevel a enterprise:Property .
        enterprise:requiresCompliance a enterprise:Property .

        # Generate many instances for reasoning
        ${Array.from({length: 500}, (_, i) => `
          api:Service${i} a api:RESTService ;
              enterprise:handlesPersonalData ${i % 2 === 0 ? 'true' : 'false'} ;
              enterprise:dataClassification "${i % 3 === 0 ? 'sensitive' : 'standard'}" ;
              enterprise:deploymentRegion "${i % 4 === 0 ? 'EU' : 'US'}" .
        `).join('')}

        # Rules would be applied here in N3 format:
        # { ?service enterprise:handlesPersonalData true ; enterprise:deploymentRegion "EU" } 
        # => { ?service compliance:gdprApplicable true } .
      `;

      const startTime = performance.now();
      const parseResult = await parser.parse(complexOntologyWithRules);
      const parseTime = performance.now() - startTime;

      expect(parseTime).toBeLessThan(3000); // Parse complex rules in under 3 seconds
      expect(parseResult.triples.length).toBeGreaterThan(2000); // Many triples from instances

      // Simulate reasoning by querying inferred properties
      const quads = parseResult.triples.map(triple => 
        quad(
          namedNode(triple.subject.value),
          namedNode(triple.predicate.value),
          triple.object.type === 'uri' ? namedNode(triple.object.value) : literal(triple.object.value)
        )
      );
      store.addQuads(quads);

      // Test reasoning performance on classification queries
      const reasoningStartTime = performance.now();
      
      // Find services that handle personal data in EU (would trigger GDPR rules)
      const euPersonalDataServices = [];
      for (let i = 0; i < 500; i++) {
        const serviceUri = `http://example.org/api#Service${i}`;
        const handlesPersonalData = rdfFilters.rdfObject(serviceUri, 'http://example.org/enterprise#handlesPersonalData');
        const deploymentRegion = rdfFilters.rdfObject(serviceUri, 'http://example.org/enterprise#deploymentRegion');
        
        if (handlesPersonalData[0]?.value === 'true' && deploymentRegion[0]?.value === 'EU') {
          euPersonalDataServices.push(serviceUri);
        }
      }

      const reasoningTime = performance.now() - reasoningStartTime;
      
      expect(reasoningTime).toBeLessThan(1000); // Reasoning should complete in under 1 second
      expect(euPersonalDataServices.length).toBeGreaterThan(0); // Should find some matching services
    });

    it('should handle concurrent reasoning operations', async () => {
      const testData = `
        @prefix concurrent: <http://example.org/concurrent#> .
        
        ${Array.from({length: 200}, (_, i) => `
          concurrent:Entity${i} a concurrent:TestEntity ;
              concurrent:value ${i} ;
              concurrent:category "Category${i % 10}" .
        `).join('')}
      `;

      const parseResult = await parser.parse(testData);
      const quads = parseResult.triples.map(triple => 
        quad(
          namedNode(triple.subject.value),
          namedNode(triple.predicate.value),
          triple.object.type === 'uri' ? namedNode(triple.object.value) : literal(triple.object.value)
        )
      );
      store.addQuads(quads);

      // Run concurrent queries
      const concurrentQueries = Array.from({length: 20}, (_, i) => 
        async () => {
          const startTime = performance.now();
          const results = rdfFilters.rdfObject(`http://example.org/concurrent#Entity${i * 10}`, 'http://example.org/concurrent#value');
          const queryTime = performance.now() - startTime;
          return { results, queryTime };
        }
      );

      const startTime = performance.now();
      const concurrentResults = await Promise.all(concurrentQueries.map(query => query()));
      const totalTime = performance.now() - startTime;

      expect(totalTime).toBeLessThan(1000); // All concurrent queries in under 1 second
      expect(concurrentResults).toHaveLength(20);
      
      concurrentResults.forEach(result => {
        expect(result.results.length).toBeGreaterThan(0);
        expect(result.queryTime).toBeLessThan(100); // Individual queries should be fast
      });
    });
  });

  describe('Template Variable Extraction Performance', () => {
    it('should extract variables from large RDF datasets efficiently', async () => {
      const largeVariableDataset = `
        @prefix var: <http://example.org/var#> .
        @prefix template: <http://example.org/template#> .
        
        ${Array.from({length: 1000}, (_, i) => `
          var:Variable${i} a template:TemplateVariable ;
              template:name "variable${i}" ;
              template:type "string" ;
              template:defaultValue "default${i}" ;
              template:description "Description for variable ${i}" ;
              template:required ${i % 2 === 0 ? 'true' : 'false'} .
        `).join('')}
      `;

      const source: RDFDataSource = {
        type: 'inline',
        source: largeVariableDataset,
        format: 'text/turtle'
      };

      const startTime = performance.now();
      const result = await rdfLoader.loadFromSource(source);
      const loadTime = performance.now() - startTime;

      expect(result.success).toBe(true);
      expect(loadTime).toBeLessThan(5000); // Load and extract variables in under 5 seconds
      expect(Object.keys(result.variables)).toHaveLength(1000); // Should extract all variables

      // Verify variable structure
      const firstVariable = result.variables['Variable0'];
      expect(firstVariable).toBeDefined();
      expect(firstVariable.name).toBe('variable0');
      expect(firstVariable.type).toBe('string');
    });

    it('should cache and reuse parsed results for performance', async () => {
      const cacheTestData = `
        @prefix cache: <http://example.org/cache#> .
        
        cache:TestEntity a cache:Entity ;
            cache:property "value" ;
            cache:count 42 .
      `;

      const source: RDFDataSource = {
        type: 'inline',
        source: cacheTestData,
        format: 'text/turtle'
      };

      // First load - should parse and cache
      const firstLoadStart = performance.now();
      const firstResult = await rdfLoader.loadFromSource(source);
      const firstLoadTime = performance.now() - firstLoadStart;

      expect(firstResult.success).toBe(true);

      // Second load - should use cache
      const secondLoadStart = performance.now();
      const secondResult = await rdfLoader.loadFromSource(source);
      const secondLoadTime = performance.now() - secondLoadStart;

      expect(secondResult.success).toBe(true);
      expect(secondLoadTime).toBeLessThan(firstLoadTime * 0.5); // Should be at least 50% faster

      // Verify cache statistics
      const cacheStats = rdfLoader.getCacheStats();
      expect(cacheStats.size).toBeGreaterThan(0);
    });
  });

  describe('Memory Management and Garbage Collection', () => {
    it('should manage memory efficiently during large-scale processing', async () => {
      const initialMemory = process.memoryUsage();
      
      // Process multiple large datasets
      for (let batch = 0; batch < 5; batch++) {
        const batchData = generateLargeEnterpriseOntology(500);
        
        const parseResult = await parser.parse(batchData);
        expect(parseResult.success).toBe(true);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
        
        const currentMemory = process.memoryUsage();
        const memoryIncrease = currentMemory.heapUsed - initialMemory.heapUsed;
        
        // Memory should not increase unboundedly
        expect(memoryIncrease).toBeLessThan(200 * 1024 * 1024); // Under 200MB increase
      }
    });

    it('should clean up resources after processing completion', async () => {
      const memoryBefore = process.memoryUsage();
      
      // Create and destroy multiple loaders
      for (let i = 0; i < 10; i++) {
        const loader = new RDFDataLoader();
        const tempData = `
          @prefix temp: <http://example.org/temp#> .
          temp:Entity${i} temp:value ${i} .
        `;
        
        const source: RDFDataSource = {
          type: 'inline',
          source: tempData,
          format: 'text/turtle'
        };
        
        await loader.loadFromSource(source);
        loader.clearCache();
      }
      
      // Force garbage collection
      if (global.gc) {
        global.gc();
      }
      
      const memoryAfter = process.memoryUsage();
      const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed;
      
      // Should not leak significant memory
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Under 50MB increase
    });
  });

  describe('Scalability Benchmarks', () => {
    it('should maintain performance as dataset size increases', async () => {
      const sizes = [100, 500, 1000, 2000];
      const performanceMetrics: Array<{ size: number; parseTime: number; queryTime: number }> = [];

      for (const size of sizes) {
        const testData = generateLargeEnterpriseOntology(size);
        
        // Measure parsing performance
        const parseStart = performance.now();
        const parseResult = await parser.parse(testData);
        const parseTime = performance.now() - parseStart;

        // Setup store for querying
        const quads = parseResult.triples.slice(0, 1000).map(triple => 
          quad(
            namedNode(triple.subject.value),
            namedNode(triple.predicate.value),
            triple.object.type === 'uri' ? namedNode(triple.object.value) : literal(triple.object.value)
          )
        );
        
        const localStore = new Store();
        localStore.addQuads(quads);
        const localFilters = new RDFFilters({ store: localStore });

        // Measure query performance
        const queryStart = performance.now();
        const queryResults = localFilters.rdfQuery({ 
          predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' 
        });
        const queryTime = performance.now() - queryStart;

        performanceMetrics.push({ size, parseTime, queryTime });
        
        expect(parseResult.success).toBe(true);
        expect(queryResults.length).toBeGreaterThan(0);
      }

      // Analyze performance scaling
      for (let i = 1; i < performanceMetrics.length; i++) {
        const current = performanceMetrics[i];
        const previous = performanceMetrics[i - 1];
        
        const sizeRatio = current.size / previous.size;
        const parseTimeRatio = current.parseTime / previous.parseTime;
        const queryTimeRatio = current.queryTime / previous.queryTime;

        // Performance should scale reasonably with size
        expect(parseTimeRatio).toBeLessThan(sizeRatio * 2); // Parse time should scale better than O(n²)
        expect(queryTimeRatio).toBeLessThan(sizeRatio * 1.5); // Query time should scale well
      }
    });

    it('should handle enterprise-scale knowledge graphs', async () => {
      // Simulate enterprise-scale graph (Fortune 500 company size)
      const enterpriseScale = 5000; // 5K services = ~25K triples
      const enterpriseGraph = generateLargeEnterpriseOntology(enterpriseScale);

      const benchmarkStart = performance.now();
      
      // Parse enterprise graph
      const parseResult = await parser.parse(enterpriseGraph);
      const parseTime = performance.now() - benchmarkStart;

      expect(parseResult.success).toBe(true);
      expect(parseTime).toBeLessThan(20000); // Should handle enterprise scale in under 20 seconds
      expect(parseResult.triples.length).toBeGreaterThan(20000);

      // Test enterprise-scale queries
      const queryBenchmarkStart = performance.now();
      
      // Simulate complex enterprise queries
      const criticalServices = parseResult.triples.filter(triple => 
        triple.object.value === 'http://example.org/enterprise#CriticalService'
      );
      
      const queryTime = performance.now() - queryBenchmarkStart;
      
      expect(queryTime).toBeLessThan(2000); // Complex queries should complete in under 2 seconds
      expect(criticalServices.length).toBeGreaterThan(0);
    });
  });
});

// Helper functions for generating test data

function generateLargeEnterpriseOntology(entityCount: number): string {
  let ontology = `
    @prefix enterprise: <http://example.org/enterprise#> .
    @prefix api: <http://example.org/api#> .
    @prefix security: <http://example.org/security#> .
    @prefix team: <http://example.org/team#> .
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
    
    # Base classes
    enterprise:Service a rdfs:Class .
    enterprise:CriticalService rdfs:subClassOf enterprise:Service .
    enterprise:StandardService rdfs:subClassOf enterprise:Service .
    api:RESTService rdfs:subClassOf enterprise:Service .
    api:GraphQLService rdfs:subClassOf enterprise:Service .
  `;

  for (let i = 0; i < entityCount; i++) {
    const serviceType = i % 3 === 0 ? 'CriticalService' : 'StandardService';
    const apiType = i % 2 === 0 ? 'RESTService' : 'GraphQLService';
    const teamId = Math.floor(i / 20);
    const securityLevel = ['Basic', 'Standard', 'High', 'Maximum'][i % 4];

    ontology += `
    enterprise:Service${i} a enterprise:${serviceType}, api:${apiType} ;
        rdfs:label "Service ${i}" ;
        enterprise:owner team:Team${teamId} ;
        enterprise:version "1.${i % 100}.${i % 10}" ;
        security:level "${securityLevel}" ;
        enterprise:status "active" ;
        enterprise:created "2024-01-${(i % 28) + 1}T00:00:00Z"^^xsd:dateTime ;
        enterprise:endpoint "https://api.company.com/service${i}" ;
        enterprise:description "Enterprise service number ${i}" .
    `;

    // Add team information
    if (i % 20 === 0) {
      ontology += `
      team:Team${teamId} a team:DevelopmentTeam ;
          team:name "Team ${teamId}" ;
          team:size ${5 + (teamId % 10)} ;
          team:budget ${100000 + (teamId * 50000)} .
      `;
    }
  }

  return ontology;
}

function generateMassiveKnowledgeGraph(entityCount: number): string {
  let graph = `
    @prefix massive: <http://example.org/massive#> .
    @prefix org: <http://example.org/org#> .
    @prefix data: <http://example.org/data#> .
    @prefix compliance: <http://example.org/compliance#> .
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
    
    # Massive enterprise knowledge graph
    massive:Enterprise a org:Organization ;
        org:employees ${entityCount * 5} ;
        org:revenue "50000000000" ;
        org:industry "Technology" .
  `;

  for (let i = 0; i < entityCount; i++) {
    const departmentId = Math.floor(i / 100);
    const projectId = Math.floor(i / 50);
    
    graph += `
    massive:Entity${i} a massive:DataEntity ;
        massive:identifier "entity-${i}" ;
        massive:department org:Department${departmentId} ;
        massive:project org:Project${projectId} ;
        data:classification "${['public', 'internal', 'confidential', 'restricted'][i % 4]}" ;
        compliance:owner "owner${i % 1000}@company.com" ;
        massive:lastModified "2024-01-${(i % 28) + 1}T${(i % 24)}:${(i % 60)}:00Z"^^xsd:dateTime ;
        massive:tags ("tag${i % 50}", "category${i % 20}", "type${i % 10}") ;
        massive:metadata [
            data:size ${1000 + (i * 100)} ;
            data:checksum "hash${i}" ;
            data:version "v${i % 10}.${i % 100}"
        ] .
    `;

    // Add organizational structure
    if (i % 100 === 0) {
      graph += `
      org:Department${departmentId} a org:Department ;
          org:name "Department ${departmentId}" ;
          org:budget ${1000000 + (departmentId * 500000)} ;
          org:headCount ${50 + (departmentId * 10)} .
      `;
    }

    if (i % 50 === 0) {
      graph += `
      org:Project${projectId} a org:Project ;
          org:name "Project ${projectId}" ;
          org:status "${['planning', 'active', 'completed', 'cancelled'][projectId % 4]}" ;
          org:startDate "2024-01-${(projectId % 28) + 1}T00:00:00Z"^^xsd:dateTime .
      `;
    }
  }

  return graph;
}

async function generatePerformanceTestData(): Promise<void> {
  // Create large test files for performance testing
  const largeApiOntology = generateLargeEnterpriseOntology(1000);
  const massiveEnterpriseGraph = generateMassiveKnowledgeGraph(5000);

  await fs.writeFile('tests/fixtures/performance/large-api-ontology.ttl', largeApiOntology);
  await fs.writeFile('tests/fixtures/performance/massive-enterprise-graph.ttl', massiveEnterpriseGraph);
}