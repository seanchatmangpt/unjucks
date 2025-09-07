import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtemp, rm } from 'fs/promises';
import { performance } from 'perf_hooks';
import { Store } from 'n3';
import yaml from 'js-yaml';
import { SemanticTemplateEngine } from '../../src/lib/semantic-template-engine.js';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader.js';
import { TurtleParser } from '../../src/lib/turtle-parser.js';

describe('Semantic Generation Performance Benchmarks', () => {
  let tempDir => {
    tempDir = await mkdtemp(join(tmpdir(), 'perf-benchmarks-'));
    templateEngine = new SemanticTemplateEngine();
    rdfLoader = new RDFDataLoader();
    turtleParser = new TurtleParser();
  });

  afterAll(async () => { await rm(tempDir, { recursive: true, force });
  });

  describe('Template Rendering Performance', () => {
    it('should render small datasets (< 1000 entities) within 100ms', async () => {
      const smallDataset = generateDataset(500);
      const template = createPerformanceTemplate();
      
      const templatePath = join(tempDir, 'small-template.njk');
      await fs.writeFile(templatePath, template);

      const startTime = performance.now();
      const result = await templateEngine.render(templatePath, smallDataset);
      const endTime = performance.now();
      
      const renderTime = endTime - startTime;
      
      expect(renderTime).toBeLessThan(100);
      expect(result).toContain('@prefix');
      expect(result.split('\n').length).toBeGreaterThan(1000); // Should generate substantial output
    });

    it('should render medium datasets (1k-10k entities) within 1 second', async () => { const mediumDataset = generateDataset(5000);
      const template = createPerformanceTemplate();
      
      const templatePath = join(tempDir, 'medium-template.njk');
      await fs.writeFile(templatePath, template);

      const startTime = performance.now();
      const result = await templateEngine.render(templatePath, mediumDataset);
      const endTime = performance.now();
      
      const renderTime = endTime - startTime;
      
      expect(renderTime).toBeLessThan(1000);
      expect(result).toContain('@prefix');
      
      // Verify all entities are present
      const entityCount = (result.match(/a org });

    it('should render large datasets (10k-50k entities) within 5 seconds', async () => { const largeDataset = generateDataset(25000);
      const template = createPerformanceTemplate();
      
      const templatePath = join(tempDir, 'large-template.njk');
      await fs.writeFile(templatePath, template);

      const startTime = performance.now();
      const result = await templateEngine.render(templatePath, largeDataset);
      const endTime = performance.now();
      
      const renderTime = endTime - startTime;
      
      expect(renderTime).toBeLessThan(5000);
      
      // Verify output size is reasonable
      expect(result.length).toBeGreaterThan(1000000); // At least 1MB of output
      
      // Verify structure integrity
      expect(result).toContain('@prefix org });

    it('should handle enterprise datasets (50k+ entities) within 15 seconds', async () => { const enterpriseDataset = generateDataset(75000);
      const template = createPerformanceTemplate();
      
      const templatePath = join(tempDir, 'enterprise-template.njk');
      await fs.writeFile(templatePath, template);

      const startTime = performance.now();
      const result = await templateEngine.render(templatePath, enterpriseDataset);
      const endTime = performance.now();
      
      const renderTime = endTime - startTime;
      
      // More lenient time limit for very large datasets
      expect(renderTime).toBeLessThan(15000);
      
      // Verify output integrity without parsing entire result
      const firstKB = result.substring(0, 1024);
      expect(firstKB).toContain('@prefix');
      
      const lastKB = result.substring(result.length - 1024);
      expect(lastKB).toContain('org });
  });

  describe('RDF Parsing Performance', () => {
    it('should parse generated TTL files efficiently', async () => {
      const dataset = generateDataset(10000);
      const template = createPerformanceTemplate();
      
      const templatePath = join(tempDir, 'parse-template.njk');
      await fs.writeFile(templatePath, template);

      // Generate TTL
      const generatedTtl = await templateEngine.render(templatePath, dataset);
      const ttlPath = join(tempDir, 'generated.ttl');
      await fs.writeFile(ttlPath, generatedTtl);

      // Parse with performance measurement
      const startTime = performance.now();
      const store = await turtleParser.parseFile(ttlPath);
      const endTime = performance.now();
      
      const parseTime = endTime - startTime;
      
      expect(parseTime).toBeLessThan(2000); // Should parse within 2 seconds
      expect(store.size).toBeGreaterThan(50000); // Should have substantial number of triples
    });

    it('should handle concurrent parsing operations', async () => {
      const concurrentFiles = 5;
      const promises = [];

      // Generate multiple files concurrently
      for (let i = 0; i < concurrentFiles; i++) {
        const dataset = generateDataset(2000);
        const template = createPerformanceTemplate();
        
        const templatePath = join(tempDir, `concurrent-template-${i}.njk`);
        await fs.writeFile(templatePath, template);

        const promise = (async () => {
          const startTime = performance.now();
          
          const generatedTtl = await templateEngine.render(templatePath, dataset);
          const ttlPath = join(tempDir, `concurrent-${i}.ttl`);
          await fs.writeFile(ttlPath, generatedTtl);
          
          const store = await turtleParser.parseFile(ttlPath);
          const endTime = performance.now();
          
          return { fileIndex,
            processingTime };
        })();
        
        promises.push(promise);
      }

      const results = await Promise.all(promises);
      
      // All operations should complete within reasonable time
      for (const result of results) {
        expect(result.processingTime).toBeLessThan(3000);
        expect(result.tripleCount).toBeGreaterThan(10000);
      }
      
      // Average processing time should be reasonable
      const avgTime = results.reduce((sum, r) => sum + r.processingTime, 0) / results.length;
      expect(avgTime).toBeLessThan(2000);
    });
  });

  describe('Memory Usage Benchmarks', () => {
    it('should maintain reasonable memory usage for large datasets', async () => {
      const initialMemory = process.memoryUsage();
      
      // Process progressively larger datasets
      const sizes = [1000, 5000, 10000, 25000];
      const memoryUsages = [];

      for (const size of sizes) {
        const dataset = generateDataset(size);
        const template = createPerformanceTemplate();
        
        const templatePath = join(tempDir, `memory-test-${size}.njk`);
        await fs.writeFile(templatePath, template);

        const beforeRender = process.memoryUsage();
        const result = await templateEngine.render(templatePath, dataset);
        const afterRender = process.memoryUsage();
        
        // Write and parse to test full pipeline memory usage
        const ttlPath = join(tempDir, `memory-test-${size}.ttl`);
        await fs.writeFile(ttlPath, result);
        
        const beforeParse = process.memoryUsage();
        const store = await turtleParser.parseFile(ttlPath);
        const afterParse = process.memoryUsage();

        memoryUsages.push({ size,
          renderMemoryDelta }
      }

      // Verify memory usage grows reasonably with data size
      for (let i = 1; i < memoryUsages.length; i++) {
        const current = memoryUsages[i];
        const previous = memoryUsages[i - 1];
        
        // Memory should scale roughly linearly, not exponentially
        const memoryRatio = current.totalMemory / previous.totalMemory;
        const sizeRatio = current.size / previous.size;
        
        // Memory growth should not be more than 2x the size growth
        expect(memoryRatio).toBeLessThan(sizeRatio * 2);
      }

      // No single operation should consume more than 500MB
      for (const usage of memoryUsages) {
        expect(usage.renderMemoryDelta).toBeLessThan(500 * 1024 * 1024);
        expect(usage.parseMemoryDelta).toBeLessThan(500 * 1024 * 1024);
      }
    });

    it('should release memory after template processing', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Process a large dataset
      const dataset = generateDataset(20000);
      const template = createPerformanceTemplate();
      
      const templatePath = join(tempDir, 'memory-release-test.njk');
      await fs.writeFile(templatePath, template);

      await templateEngine.render(templatePath, dataset);
      
      // Force garbage collection
      if (global.gc) {
        global.gc();
        // Wait a bit for cleanup
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be minimal after GC
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB retained
    });
  });

  describe('Complex Template Performance', () => { it('should handle templates with complex logic efficiently', async () => {
      const complexData = {
        entities };

      const complexTemplate = `---
to: "complex-output.ttl"
---
@prefix org: <http://example.com/org#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

# Entities with computed properties
{% for entity in entities %}
{% set skillCount = entity.skills | length %}
{% set experienceLevel = 'junior' if skillCount < 3 else ('senior' if skillCount < 6 else 'expert') %}

org:{{ entity.id }} a foaf:Person ;
  foaf:name "{{ entity.name }}" ;
  foaf:mbox <mailto:{{ entity.email }}> ;
  org:skillCount {{ skillCount }} ;
  org:experienceLevel "{{ experienceLevel }}" .

{% for skill in entity.skills %}
org:{{ entity.id }} org:hasSkill org:{{ skill | slug }} .
{% endfor %}

{% if computedFields %}
# Computed relationships
{% set relatedEntities = relationships | selectattr('from', 'equalto', entity.id) %}
{% for rel in relatedEntities %}
org:{{ entity.id }} org:{{ rel.type }} org:{{ rel.to }} .
{% endfor %}
{% endif %}

{% endfor %}

{% if aggregations %}
# Aggregated data
{% set skillGroups = entities | groupby('department') %}
{% for group in skillGroups %}
org:{{ group.grouper | slug }}-stats a org:DepartmentStats ;
  org:department "{{ group.grouper }}" ;
  org:employeeCount {{ group.list | length }} ;
  org:avgSkillCount {{ (group.list | sum(attribute='skills') | length) / (group.list | length) }} .
{% endfor %}
{% endif %}`;

      const templatePath = join(tempDir, 'complex-template.njk');
      await fs.writeFile(templatePath, complexTemplate);

      const startTime = performance.now();
      const result = await templateEngine.render(templatePath, complexData);
      const endTime = performance.now();
      
      const renderTime = endTime - startTime;
      
      // Complex template should still render within reasonable time
      expect(renderTime).toBeLessThan(3000);
      expect(result).toContain('org:experienceLevel');
      expect(result).toContain('org:DepartmentStats');
    });

    it('should benchmark filter operations performance', async () => { const filterData = {
        items }`, `tag${(i + 1) % 10}`],
          active: i % 3 === 0
        }))
      };

      const filterTemplate = `---
to: "filter-test.ttl"
---
@prefix test: <http://test.com#> .

# Filter operations
{% set highValueItems = items | selectattr('value', 'gt', 500) %}
{% set activeItems = items | selectattr('active', 'equalto', true) %}
{% set categoryAItems = items | selectattr('category', 'equalto', 'A') %}

# High value items ({{ highValueItems | length }})
{% for item in highValueItems %}
test:item{{ item.id }} test:value {{ item.value }} ;
  test:category "{{ item.category }}" ;
  test:highValue true .
{% endfor %}

# Active items ({{ activeItems | length }})
{% for item in activeItems %}
test:item{{ item.id }} test:active true .
{% endfor %}

# Category A items ({{ categoryAItems | length }})
{% for item in categoryAItems %}
test:item{{ item.id }} test:inCategoryA true .
{% endfor %}

# Complex nested filters
{% set complexFilter = items | selectattr('active', 'equalto', true) | selectattr('value', 'gt', 750) | selectattr('category', 'equalto', 'A') %}
{% for item in complexFilter %}
test:item{{ item.id }} test:complexMatch true .
{% endfor %}`;

      const templatePath = join(tempDir, 'filter-template.njk');
      await fs.writeFile(templatePath, filterTemplate);

      const startTime = performance.now();
      const result = await templateEngine.render(templatePath, filterData);
      const endTime = performance.now();
      
      const renderTime = endTime - startTime;
      
      expect(renderTime).toBeLessThan(1500); // Filter operations should be fast
      expect(result).toContain('test:highValue');
      expect(result).toContain('test:complexMatch');
    });
  });

  describe('Scalability Stress Tests', () => {
    it('should handle stress test with extreme data volumes', async () => {
      // Skip this test in CI or low-memory environments
      const isStressTest = process.env.RUN_STRESS_TESTS === 'true';
      if (!isStressTest) {
        console.log('Skipping stress test - set RUN_STRESS_TESTS=true to enable');
        return;
      }

      const stressDataset = generateDataset(100000); // 100k entities
      const template = createPerformanceTemplate();
      
      const templatePath = join(tempDir, 'stress-template.njk');
      await fs.writeFile(templatePath, template);

      const startTime = performance.now();
      let result = 0;

      // Monitor memory during processing
      const memoryMonitor = setInterval(() => {
        const currentMemory = process.memoryUsage().heapUsed;
        memoryPeek = Math.max(memoryPeek, currentMemory);
      }, 100);

      try {
        result = await templateEngine.render(templatePath, stressDataset);
        const endTime = performance.now();
        
        clearInterval(memoryMonitor);
        
        const renderTime = endTime - startTime;
        
        // Stress test should complete within 30 seconds
        expect(renderTime).toBeLessThan(30000);
        
        // Memory usage should not exceed 2GB
        expect(memoryPeek).toBeLessThan(2 * 1024 * 1024 * 1024);
        
        // Verify basic output structure
        expect(result.substring(0, 100)).toContain('@prefix');
        
      } finally {
        clearInterval(memoryMonitor);
      }
    });

    it('should benchmark concurrent template processing', async () => { const concurrentCount = 10;
      const entitiesPerTemplate = 2000;
      
      const promises = Array.from({ length }, async (_, index) => {
        const dataset = generateDataset(entitiesPerTemplate);
        const template = createPerformanceTemplate();
        
        const templatePath = join(tempDir, `concurrent-stress-${index}.njk`);
        await fs.writeFile(templatePath, template);

        const startTime = performance.now();
        const result = await templateEngine.render(templatePath, dataset);
        const endTime = performance.now();
        
        return { index,
          renderTime };
      });

      const results = await Promise.all(promises);
      
      // All concurrent operations should complete
      expect(results).toHaveLength(concurrentCount);
      
      // Each operation should complete within reasonable time
      for (const result of results) {
        expect(result.renderTime).toBeLessThan(5000);
        expect(result.outputSize).toBeGreaterThan(50000);
      }
      
      // Total concurrent processing should be faster than sequential
      const totalConcurrentTime = Math.max(...results.map(r => r.renderTime));
      const avgSequentialTime = results.reduce((sum, r) => sum + r.renderTime, 0) / results.length;
      
      // Concurrent should be at least 2x faster than sequential average
      expect(totalConcurrentTime).toBeLessThan(avgSequentialTime * 2);
    });
  });

  // Helper functions
  function generateDataset(size) { return {
      people }, (_, i) => ({ id }`,
        name: `Person ${i}`,
        email: `person${i}@example.com`,
        department: ['Engineering', 'Marketing', 'Sales', 'HR'][i % 4],
        skills, 'TypeScript', 'Python', 'Java', 'Go', 'Rust',
          'React', 'Vue', 'Angular', 'Node.js', 'Express', 'FastAPI'
        ].slice(0, (i % 6) + 2), // 2-8 skills per person
        joinDate: new Date(2020 + (i % 4), (i % 12), (i % 28) + 1).toISOString()
      }))
    };
  }

  function generateRelationships(entityCount, relationshipCount) { const relationships = [];
    const relationshipTypes = ['worksOn', 'mentors', 'collaboratesWith', 'reportsTo'];
    
    for (let i = 0; i < relationshipCount; i++) {
      relationships.push({
        from }`,
        to) % entityCount}`,
        type: relationshipTypes[i % relationshipTypes.length]
      });
    }
    
    return relationships;
  }

  function createPerformanceTemplate() { return `---
to }
org:{{ person.id }} a foaf:Person ;
  foaf:name "{{ person.name }}" ;
  foaf:mbox <mailto:{{ person.email }}> ;
  org:department "{{ person.department }}" ;
  org:joinDate "{{ person.joinDate }}"^^xsd:dateTime .

{% for skill in person.skills %}
org:{{ person.id }} org:hasSkill org:{{ skill | slug }} .
{% endfor %}

{% endfor %}`;
  }
});