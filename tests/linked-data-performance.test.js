/**
 * Performance Benchmarks for Web-Scale Linked Data Generation
 * Tests scalability, memory usage, and throughput for production deployments
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { performance } from 'perf_hooks';
import nunjucks from 'nunjucks';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { LinkedDataFilters, registerLinkedDataFilters } from '../src/lib/linked-data-filters.js';
import { Parser } from 'n3';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Performance test configuration
const PERFORMANCE_CONFIG = {
  // Resource generation scale tests
  SMALL_SCALE: 1000,      // 1K resources
  MEDIUM_SCALE: 10000,    // 10K resources  
  LARGE_SCALE: 100000,    // 100K resources
  XL_SCALE: 1000000,      // 1M resources
  
  // Benchmarking parameters
  MAX_RENDER_TIME_MS: 1000,     // Maximum time for template rendering
  MAX_MEMORY_MB: 500,           // Maximum memory usage in MB
  MIN_THROUGHPUT_RPS: 100,      // Minimum resources per second
  
  // Collection pagination limits
  MAX_PAGE_SIZE: 1000,
  DEFAULT_PAGE_SIZE: 50,
  
  // Template complexity levels
  SIMPLE_TEMPLATE: 'basic resource with minimal properties',
  COMPLEX_TEMPLATE: 'full resource with all optional properties',
  NESTED_TEMPLATE: 'resource with nested structures and collections'
};

describe('Linked Data Performance Benchmarks', () => {
  let nunjucksEnv;
  let filters;
  let testDataDir;
  let performanceResults = {};

  beforeAll(async () => {
    testDataDir = path.join(__dirname, 'fixtures', 'linked-data');
    
    // Setup high-performance Nunjucks environment
    nunjucksEnv = new nunjucks.Environment(
      new nunjucks.FileSystemLoader(testDataDir, { 
        noCache: false,  // Enable caching for performance
        watch: false     // Disable file watching
      }),
      {
        autoescape: false,
        throwOnUndefined: false,
        trimBlocks: true,
        lstripBlocks: true
      }
    );
    
    // Register optimized filters
    registerLinkedDataFilters(nunjucksEnv, {
      baseUri: 'https://example.org/',
      prefixes: {
        ex: 'https://example.org/',
        test: 'https://test.example.org/'
      }
    });
    
    filters = new LinkedDataFilters();
    
    console.log('🚀 Starting Linked Data Performance Benchmarks');
    console.log(`📊 Test Scales: ${PERFORMANCE_CONFIG.SMALL_SCALE.toLocaleString()}, ${PERFORMANCE_CONFIG.MEDIUM_SCALE.toLocaleString()}, ${PERFORMANCE_CONFIG.LARGE_SCALE.toLocaleString()}, ${PERFORMANCE_CONFIG.XL_SCALE.toLocaleString()} resources`);
  });

  afterAll(() => {
    console.log('\\n📈 Performance Benchmark Results:');
    console.table(performanceResults);
  });

  describe('URI Generation Performance', () => {
    it('should generate URIs at scale efficiently', () => {
      const scales = [
        PERFORMANCE_CONFIG.SMALL_SCALE,
        PERFORMANCE_CONFIG.MEDIUM_SCALE,
        PERFORMANCE_CONFIG.LARGE_SCALE
      ];

      scales.forEach(scale => {
        const startTime = performance.now();
        const startMemory = process.memoryUsage().heapUsed;
        
        const uris = [];
        for (let i = 0; i < scale; i++) {
          uris.push(filters.rdfResource({
            type: 'person',
            id: `person-${i}`,
            org: 'example'
          }, 'slash'));
        }
        
        const endTime = performance.now();
        const endMemory = process.memoryUsage().heapUsed;
        
        const duration = endTime - startTime;
        const memoryUsed = (endMemory - startMemory) / 1024 / 1024; // MB
        const throughput = scale / (duration / 1000); // URIs per second
        
        performanceResults[`URI Generation ${scale.toLocaleString()}`] = {
          'Time (ms)': Math.round(duration),
          'Memory (MB)': Math.round(memoryUsed * 100) / 100,
          'Throughput (URIs/s)': Math.round(throughput)
        };
        
        expect(duration).toBeLessThan(PERFORMANCE_CONFIG.MAX_RENDER_TIME_MS * (scale / 1000));
        expect(memoryUsed).toBeLessThan(PERFORMANCE_CONFIG.MAX_MEMORY_MB / 4);
        expect(throughput).toBeGreaterThan(PERFORMANCE_CONFIG.MIN_THROUGHPUT_RPS * 10);
        expect(uris).toHaveLength(scale);
        expect(new Set(uris).size).toBe(scale); // All URIs should be unique
      });
    });

    it('should handle different URI schemes with consistent performance', () => {
      const schemes = ['slash', 'hash', 'query', 'purl'];
      const testSize = PERFORMANCE_CONFIG.MEDIUM_SCALE;
      
      schemes.forEach(scheme => {
        const startTime = performance.now();
        
        const uris = [];
        for (let i = 0; i < testSize; i++) {
          uris.push(filters.rdfResource(`resource-${i}`, scheme));
        }
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        const throughput = testSize / (duration / 1000);
        
        performanceResults[`URI Scheme ${scheme}`] = {
          'Time (ms)': Math.round(duration),
          'Throughput (URIs/s)': Math.round(throughput)
        };
        
        expect(duration).toBeLessThan(500);
        expect(throughput).toBeGreaterThan(10000);
      });
    });
  });

  describe('RDF Literal Generation Performance', () => {
    it('should generate literals efficiently at scale', () => {
      const testCases = [
        { scale: PERFORMANCE_CONFIG.SMALL_SCALE, type: 'plain' },
        { scale: PERFORMANCE_CONFIG.MEDIUM_SCALE, type: 'language-tagged' },
        { scale: PERFORMANCE_CONFIG.LARGE_SCALE, type: 'datatyped' }
      ];
      
      testCases.forEach(({ scale, type }) => {
        const startTime = performance.now();
        const startMemory = process.memoryUsage().heapUsed;
        
        const literals = [];
        for (let i = 0; i < scale; i++) {
          let literal;
          switch (type) {
            case 'plain':
              literal = filters.rdfLiteral(`Value ${i}`);
              break;
            case 'language-tagged':
              literal = filters.rdfLiteral(`Value ${i}`, 'en');
              break;
            case 'datatyped':
              literal = filters.rdfLiteral(i.toString(), 'integer');
              break;
          }
          literals.push(literal);
        }
        
        const endTime = performance.now();
        const endMemory = process.memoryUsage().heapUsed;
        
        const duration = endTime - startTime;
        const memoryUsed = (endMemory - startMemory) / 1024 / 1024;
        const throughput = scale / (duration / 1000);
        
        performanceResults[`Literals ${type} ${scale.toLocaleString()}`] = {
          'Time (ms)': Math.round(duration),
          'Memory (MB)': Math.round(memoryUsed * 100) / 100,
          'Throughput (literals/s)': Math.round(throughput)
        };
        
        expect(duration).toBeLessThan(PERFORMANCE_CONFIG.MAX_RENDER_TIME_MS);
        expect(memoryUsed).toBeLessThan(PERFORMANCE_CONFIG.MAX_MEMORY_MB / 2);
        expect(throughput).toBeGreaterThan(PERFORMANCE_CONFIG.MIN_THROUGHPUT_RPS * 20);
      });
    });
  });

  describe('Template Rendering Performance', () => {
    it('should render simple templates efficiently at scale', async () => {
      const scales = [
        PERFORMANCE_CONFIG.SMALL_SCALE,
        PERFORMANCE_CONFIG.MEDIUM_SCALE,
        PERFORMANCE_CONFIG.LARGE_SCALE
      ];
      
      for (const scale of scales) {
        const startTime = performance.now();
        const startMemory = process.memoryUsage().heapUsed;
        
        const renderedResources = [];
        
        for (let i = 0; i < scale; i++) {
          const templateData = {
            baseUri: 'https://example.org/',
            resourceId: `person-${i}`,
            resourceType: 'person',
            title: `Person ${i}`,
            description: `Description for person ${i}`,
            creator: 'system',
            createdDate: this.getDeterministicDate().toISOString()
          };
          
          const rendered = nunjucksEnv.render('resource-description.ttl.njk', templateData);
          renderedResources.push(rendered);
        }
        
        const endTime = performance.now();
        const endMemory = process.memoryUsage().heapUsed;
        
        const duration = endTime - startTime;
        const memoryUsed = (endMemory - startMemory) / 1024 / 1024;
        const throughput = scale / (duration / 1000);
        const avgSizeKB = renderedResources.reduce((sum, r) => sum + r.length, 0) / scale / 1024;
        
        performanceResults[`Template Render ${scale.toLocaleString()}`] = {
          'Time (ms)': Math.round(duration),
          'Memory (MB)': Math.round(memoryUsed * 100) / 100,
          'Throughput (res/s)': Math.round(throughput),
          'Avg Size (KB)': Math.round(avgSizeKB * 100) / 100
        };
        
        // Performance assertions
        expect(duration).toBeLessThan(PERFORMANCE_CONFIG.MAX_RENDER_TIME_MS * (scale / 1000));
        expect(memoryUsed).toBeLessThan(PERFORMANCE_CONFIG.MAX_MEMORY_MB);
        expect(throughput).toBeGreaterThan(PERFORMANCE_CONFIG.MIN_THROUGHPUT_RPS);
        
        // Validate rendered content
        expect(renderedResources).toHaveLength(scale);
        renderedResources.slice(0, 10).forEach(rendered => {
          expect(rendered).toContain('@base');
          expect(rendered).toContain('@prefix');
          expect(rendered).toContain('schema:Person');
        });
      }
    });

    it('should render complex templates with acceptable performance', async () => {
      const scale = PERFORMANCE_CONFIG.MEDIUM_SCALE;
      const startTime = performance.now();
      
      const complexTemplateData = {
        baseUri: 'https://example.org/',
        resourceId: 'complex-resource',
        resourceType: 'dataset',
        title: 'Complex Dataset',
        description: 'A dataset with many properties and relationships',
        keywords: Array.from({ length: 20 }, (_, i) => `keyword-${i}`),
        creator: 'research-team',
        contributors: Array.from({ length: 10 }, (_, i) => `contributor-${i}`),
        license: 'cc-by',
        customProperties: Object.fromEntries(
          Array.from({ length: 50 }, (_, i) => [`prop${i}`, [`value${i}a`, `value${i}b`]])
        ),
        externalLinks: Array.from({ length: 5 }, (_, i) => 
          `https://external.example.org/resource-${i}`
        ),
        relatedResources: Array.from({ length: 20 }, (_, i) => ({
          uri: `related-resource-${i}`,
          relation: 'schema:relatedLink'
        }))
      };
      
      const renderedResources = [];
      for (let i = 0; i < scale; i++) {
        const data = { ...complexTemplateData, resourceId: `complex-resource-${i}` };
        const rendered = nunjucksEnv.render('resource-description.ttl.njk', data);
        renderedResources.push(rendered);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      const throughput = scale / (duration / 1000);
      
      performanceResults[`Complex Template ${scale.toLocaleString()}`] = {
        'Time (ms)': Math.round(duration),
        'Throughput (res/s)': Math.round(throughput)
      };
      
      expect(duration).toBeLessThan(PERFORMANCE_CONFIG.MAX_RENDER_TIME_MS * 10);
      expect(throughput).toBeGreaterThan(50); // Lower threshold for complex templates
    });

    it('should render different serialization formats efficiently', async () => {
      const formats = [
        { template: 'resource-description.ttl.njk', format: 'Turtle' },
        { template: 'content-negotiation/resource.jsonld.njk', format: 'JSON-LD' },
        { template: 'content-negotiation/resource.rdf.njk', format: 'RDF/XML' },
        { template: 'content-negotiation/resource.nt.njk', format: 'N-Triples' }
      ];
      
      const testSize = 1000;
      
      for (const { template, format } of formats) {
        const startTime = performance.now();
        
        const templateData = {
          baseUri: 'https://example.org/',
          resourceId: 'test-resource',
          resourceType: 'person',
          title: 'Test Person',
          description: 'A test person for performance benchmarking',
          givenName: 'Test',
          familyName: 'Person',
          email: 'test@example.org'
        };
        
        const renderedResources = [];
        for (let i = 0; i < testSize; i++) {
          const data = { ...templateData, resourceId: `test-resource-${i}` };
          const rendered = nunjucksEnv.render(template, data);
          renderedResources.push(rendered);
        }
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        const throughput = testSize / (duration / 1000);
        const avgSize = renderedResources.reduce((sum, r) => sum + r.length, 0) / testSize;
        
        performanceResults[`Format ${format}`] = {
          'Time (ms)': Math.round(duration),
          'Throughput (res/s)': Math.round(throughput),
          'Avg Size (bytes)': Math.round(avgSize)
        };
        
        expect(duration).toBeLessThan(2000);
        expect(throughput).toBeGreaterThan(200);
        
        // Validate format-specific structure
        if (format === 'JSON-LD') {
          renderedResources.slice(0, 3).forEach(rendered => {
            expect(() => JSON.parse(rendered)).not.toThrow();
          });
        }
      }
    });
  });

  describe('Collection and Pagination Performance', () => {
    it('should handle large collection pagination efficiently', () => {
      const collectionSizes = [10000, 100000, 1000000];
      const pageSizes = [10, 50, 100, 500];
      
      collectionSizes.forEach(collectionSize => {
        pageSizes.forEach(pageSize => {
          const items = Array.from({ length: collectionSize }, (_, i) => ({
            id: `item-${i}`,
            title: `Item ${i}`,
            type: 'article'
          }));
          
          const startTime = performance.now();
          const startMemory = process.memoryUsage().heapUsed;
          
          // Test different page positions
          const results = [];
          const testPages = [1, Math.floor(collectionSize / pageSize / 2), Math.floor(collectionSize / pageSize)];
          
          testPages.forEach(pageNumber => {
            const result = filters.paginate(items, pageNumber, pageSize);
            results.push(result);
          });
          
          const endTime = performance.now();
          const endMemory = process.memoryUsage().heapUsed;
          
          const duration = endTime - startTime;
          const memoryUsed = (endMemory - startMemory) / 1024 / 1024;
          
          // Performance should be O(1) regardless of collection size due to Array.slice
          expect(duration).toBeLessThan(100);
          expect(memoryUsed).toBeLessThan(50);
          
          // Validate pagination results
          results.forEach(result => {
            expect(result.items).toHaveLength(Math.min(pageSize, collectionSize));
            expect(result.totalItems).toBe(collectionSize);
            expect(result.pageSize).toBe(pageSize);
          });
        });
      });
    });

    it('should render paginated collection templates efficiently', async () => {
      const collectionSize = PERFORMANCE_CONFIG.MEDIUM_SCALE;
      const pageSize = 100;
      
      // Generate test collection
      const items = Array.from({ length: collectionSize }, (_, i) => ({
        id: `article-${i}`,
        title: `Article ${i}`,
        type: 'article',
        description: `Description for article ${i}`,
        creator: `author-${i % 100}`,
        created: new Date(this.getDeterministicTimestamp() - Math.random() * 1000 * 60 * 60 * 24 * 365).toISOString()
      }));
      
      const totalPages = Math.ceil(collectionSize / pageSize);
      const testPages = Math.min(totalPages, 50); // Test up to 50 pages
      
      const startTime = performance.now();
      
      const renderedPages = [];
      for (let page = 1; page <= testPages; page++) {
        const templateData = {
          baseUri: 'https://example.org/',
          collectionId: 'test-articles',
          collectionTitle: 'Test Article Collection',
          collectionDescription: 'A large collection of test articles',
          page: page,
          pageSize: pageSize,
          items: items
        };
        
        const rendered = nunjucksEnv.render('collection-page.ttl.njk', templateData);
        renderedPages.push(rendered);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      const throughput = testPages / (duration / 1000);
      
      performanceResults[`Collection Pages (${testPages})`] = {
        'Time (ms)': Math.round(duration),
        'Throughput (pages/s)': Math.round(throughput),
        'Collection Size': collectionSize.toLocaleString(),
        'Page Size': pageSize
      };
      
      expect(duration).toBeLessThan(PERFORMANCE_CONFIG.MAX_RENDER_TIME_MS * testPages / 10);
      expect(throughput).toBeGreaterThan(5); // Should render at least 5 pages per second
      expect(renderedPages).toHaveLength(testPages);
    });
  });

  describe('String Processing Performance', () => {
    it('should process string transformations at scale', () => {
      const testStrings = [
        'Simple String',
        'Complex String with MANY different CASES and special-chars!@#$%^&*()',
        'Very-Long-String-With-Many-Hyphens-And-Numbers-123456789-And-More-Text-To-Process',
        'Unicode String with émojis 🚀 and spëcial châractérs',
        'Multi\nLine\nString\nWith\nMany\nLine\nBreaks\nAnd\nContent'
      ];
      
      const transformations = [
        { name: 'slug', filter: filters.slug },
        { name: 'kebabCase', filter: filters.kebabCase },
        { name: 'camelCase', filter: filters.camelCase },
        { name: 'pascalCase', filter: filters.pascalCase },
        { name: 'titleCase', filter: filters.titleCase }
      ];
      
      const iterations = PERFORMANCE_CONFIG.MEDIUM_SCALE;
      
      transformations.forEach(({ name, filter }) => {
        const startTime = performance.now();
        
        const results = [];
        for (let i = 0; i < iterations; i++) {
          const testString = testStrings[i % testStrings.length] + ` ${i}`;
          results.push(filter(testString));
        }
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        const throughput = iterations / (duration / 1000);
        
        performanceResults[`String ${name}`] = {
          'Time (ms)': Math.round(duration),
          'Throughput (ops/s)': Math.round(throughput)
        };
        
        expect(duration).toBeLessThan(500);
        expect(throughput).toBeGreaterThan(10000);
        expect(results).toHaveLength(iterations);
      });
    });
  });

  describe('Memory Usage and Leak Detection', () => {
    it('should not leak memory during large-scale operations', () => {
      const iterations = 5;
      const resourcesPerIteration = PERFORMANCE_CONFIG.MEDIUM_SCALE;
      const memoryMeasurements = [];
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      for (let iteration = 0; iteration < iterations; iteration++) {
        const startMemory = process.memoryUsage();
        
        // Generate resources
        const resources = [];
        for (let i = 0; i < resourcesPerIteration; i++) {
          const templateData = {
            baseUri: 'https://example.org/',
            resourceId: `resource-${iteration}-${i}`,
            resourceType: 'person',
            title: `Person ${i}`,
            description: `Description for person ${i}`,
            keywords: [`keyword1-${i}`, `keyword2-${i}`, `keyword3-${i}`],
            creator: 'system'
          };
          
          const rendered = nunjucksEnv.render('resource-description.ttl.njk', templateData);
          resources.push(rendered);
        }
        
        // Clear resources to test cleanup
        resources.length = 0;
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
        
        const endMemory = process.memoryUsage();
        memoryMeasurements.push({
          iteration,
          heapUsed: endMemory.heapUsed / 1024 / 1024,
          heapTotal: endMemory.heapTotal / 1024 / 1024,
          external: endMemory.external / 1024 / 1024
        });
      }
      
      // Check for memory leaks (heap should not grow significantly)
      const firstHeap = memoryMeasurements[0].heapUsed;
      const lastHeap = memoryMeasurements[memoryMeasurements.length - 1].heapUsed;
      const heapGrowth = lastHeap - firstHeap;
      const heapGrowthPercent = (heapGrowth / firstHeap) * 100;
      
      performanceResults['Memory Leak Test'] = {
        'Initial Heap (MB)': Math.round(firstHeap),
        'Final Heap (MB)': Math.round(lastHeap),
        'Growth (MB)': Math.round(heapGrowth),
        'Growth (%)': Math.round(heapGrowthPercent)
      };
      
      // Memory growth should be minimal (less than 50% increase)
      expect(heapGrowthPercent).toBeLessThan(50);
      
      console.log('\\n📊 Memory Usage by Iteration:');
      console.table(memoryMeasurements);
    });
  });

  describe('Concurrent Processing Simulation', () => {
    it('should handle concurrent template rendering efficiently', async () => {
      const concurrentRequests = 50;
      const resourcesPerRequest = 100;
      
      const startTime = performance.now();
      const startMemory = process.memoryUsage().heapUsed;
      
      // Simulate concurrent requests
      const promises = [];
      for (let request = 0; request < concurrentRequests; request++) {
        const promise = new Promise((resolve) => {
          const results = [];
          for (let i = 0; i < resourcesPerRequest; i++) {
            const templateData = {
              baseUri: 'https://example.org/',
              resourceId: `concurrent-${request}-${i}`,
              resourceType: 'article',
              title: `Article ${request}-${i}`,
              description: `Concurrent processing test article`,
              creator: `user-${request}`
            };
            
            const rendered = nunjucksEnv.render('resource-description.ttl.njk', templateData);
            results.push(rendered);
          }
          resolve(results);
        });
        promises.push(promise);
      }
      
      const allResults = await Promise.all(promises);
      
      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed;
      
      const duration = endTime - startTime;
      const totalResources = concurrentRequests * resourcesPerRequest;
      const throughput = totalResources / (duration / 1000);
      const memoryUsed = (endMemory - startMemory) / 1024 / 1024;
      
      performanceResults[`Concurrent Processing`] = {
        'Requests': concurrentRequests,
        'Resources': totalResources.toLocaleString(),
        'Time (ms)': Math.round(duration),
        'Throughput (res/s)': Math.round(throughput),
        'Memory (MB)': Math.round(memoryUsed * 100) / 100
      };
      
      expect(duration).toBeLessThan(5000);
      expect(throughput).toBeGreaterThan(500);
      expect(memoryUsed).toBeLessThan(200);
      expect(allResults.flat()).toHaveLength(totalResources);
    });
  });

  describe('RDF Validation Performance', () => {
    it('should validate generated RDF efficiently', async () => {
      const testSize = 1000;
      const parser = new Parser();
      
      const startTime = performance.now();
      
      let totalQuads = 0;
      let validationErrors = 0;
      
      for (let i = 0; i < testSize; i++) {
        const templateData = {
          baseUri: 'https://example.org/',
          resourceId: `validation-test-${i}`,
          resourceType: 'dataset',
          title: `Validation Test Dataset ${i}`,
          description: `Dataset for RDF validation performance testing`,
          creator: 'validation-system',
          keywords: [`validation`, `test`, `dataset-${i}`],
          statistics: {
            triples: Math.floor(Math.random() * 10000),
            entities: Math.floor(Math.random() * 1000),
            classes: Math.floor(Math.random() * 50)
          }
        };
        
        const rendered = nunjucksEnv.render('resource-description.ttl.njk', templateData);
        
        try {
          const quads = parser.parse(rendered);
          totalQuads += quads.length;
        } catch (error) {
          validationErrors++;
        }
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      const throughput = testSize / (duration / 1000);
      
      performanceResults['RDF Validation'] = {
        'Resources': testSize.toLocaleString(),
        'Time (ms)': Math.round(duration),
        'Throughput (res/s)': Math.round(throughput),
        'Total Quads': totalQuads.toLocaleString(),
        'Avg Quads/Resource': Math.round(totalQuads / testSize),
        'Validation Errors': validationErrors
      };
      
      expect(duration).toBeLessThan(2000);
      expect(throughput).toBeGreaterThan(200);
      expect(validationErrors).toBe(0);
      expect(totalQuads).toBeGreaterThan(testSize * 5); // At least 5 quads per resource
    });
  });

  describe('Filter Chain Performance', () => {
    it('should process complex filter chains efficiently', () => {
      const testSize = PERFORMANCE_CONFIG.MEDIUM_SCALE;
      
      const startTime = performance.now();
      
      const results = [];
      for (let i = 0; i < testSize; i++) {
        const input = `Complex Input String ${i} with VARIOUS cases and special-chars!@#$%`;
        
        // Chain multiple filters together
        const processed = filters.titleCase(
          filters.slug(
            filters.camelCase(
              filters.kebabCase(
                filters.upper(input)
              )
            )
          )
        );
        
        results.push(processed);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      const throughput = testSize / (duration / 1000);
      
      performanceResults['Filter Chain'] = {
        'Operations': (testSize * 5).toLocaleString(), // 5 filters per item
        'Time (ms)': Math.round(duration),
        'Throughput (ops/s)': Math.round(throughput * 5)
      };
      
      expect(duration).toBeLessThan(1000);
      expect(throughput).toBeGreaterThan(5000);
      expect(results).toHaveLength(testSize);
      expect(new Set(results).size).toBeGreaterThan(testSize * 0.9); // Most results should be unique
    });
  });
});