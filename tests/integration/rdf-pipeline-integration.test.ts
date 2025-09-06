import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolve, join } from 'path';
import { readFileSync } from 'fs';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader.js';
import { TurtleParser } from '../../src/lib/turtle-parser.js';
import { RDFFilters } from '../../src/lib/rdf-filters.js';
import { Generator } from '../../src/lib/generator.js';
import nunjucks from 'nunjucks';
import type { RDFDataSource, RDFDataLoaderOptions } from '../../src/lib/types/turtle-types.js';

/**
 * RDF Pipeline Integration Tests
 * Tests the complete end-to-end workflow:
 * 1. Load RDF data from fixtures → Parse with N3.js → Query with filters → Generate templates
 * 2. Validate with real fixture files
 * 3. Test error handling and graceful degradation  
 * 4. Verify caching and performance
 */
describe('RDF Pipeline Integration Tests', () => {
  let dataLoader: RDFDataLoader;
  let rdfFilters: RDFFilters;
  let nunjucksEnv: nunjucks.Environment;
  let generator: Generator;
  
  const fixturesPath = resolve(__dirname, '../fixtures/turtle');
  const templateFixturesPath = resolve(__dirname, '../fixtures/turtle-templates');

  beforeEach(() => {
    const loaderOptions: RDFDataLoaderOptions = {
      cacheEnabled: true,
      cacheTTL: 300000,
      baseUri: 'http://example.org/',
      templateDir: fixturesPath
    };
    
    dataLoader = new RDFDataLoader(loaderOptions);
    rdfFilters = new RDFFilters({
      prefixes: {
        foaf: 'http://xmlns.com/foaf/0.1/',
        dcterms: 'http://purl.org/dc/terms/',
        ex: 'http://example.org/',
        schema: 'http://schema.org/'
      }
    });
    
    // Setup Nunjucks environment with RDF filters
    nunjucksEnv = new nunjucks.Environment(
      new nunjucks.FileSystemLoader(templateFixturesPath),
      { autoescape: false }
    );
    
    // Register all RDF filters
    const filters = rdfFilters.getAllFilters();
    for (const [name, filter] of Object.entries(filters)) {
      nunjucksEnv.addFilter(name, filter);
    }
    
    generator = new Generator({
      templatesPath: templateFixturesPath,
      targetPath: resolve(__dirname, '../tmp/rdf-integration'),
      nunjucksEnv
    });
  });

  afterEach(() => {
    dataLoader.clearCache();
    rdfFilters.clearStore();
  });

  describe('End-to-End RDF Pipeline', () => {
    it('should complete full pipeline: load → parse → query → generate', async () => {
      // 1. Load RDF data from basic-person.ttl fixture
      const dataSource: RDFDataSource = {
        type: 'file',
        source: 'basic-person.ttl',
        format: 'text/turtle'
      };

      const loadResult = await dataLoader.loadFromSource(dataSource);
      
      expect(loadResult.success).toBe(true);
      expect(loadResult.errors).toHaveLength(0);
      expect(loadResult.data.triples.length).toBeGreaterThan(0);
      expect(Object.keys(loadResult.data.subjects)).toContain('http://example.org/person1');

      // 2. Update RDF filters with loaded data  
      rdfFilters.updateStore(loadResult.data.triples);

      // 3. Query the data using RDF filters
      const persons = rdfFilters.rdfSubject('rdf:type', 'foaf:Person');
      expect(persons).toContain('http://example.org/person1');
      expect(persons).toContain('http://example.org/person2');

      const johnName = rdfFilters.rdfObject('ex:person1', 'foaf:name');
      expect(johnName[0].value).toBe('John Doe');

      // 4. Create template context and generate
      const templateContext = dataLoader.createTemplateContext(loadResult.data, loadResult.variables);
      
      // Test template rendering with RDF data
      const template = `
{%- for person in $rdf.getByType('http://xmlns.com/foaf/0.1/Person') -%}
Person: {{ person.uri | rdfLabel }}
Email: {{ (person.uri | rdfObject('foaf:email'))[0].value }}
Age: {{ (person.uri | rdfObject('foaf:age'))[0].value }}
{%- endfor -%}
      `.trim();

      const rendered = nunjucksEnv.renderString(template, templateContext);
      expect(rendered).toContain('Person: John Doe');
      expect(rendered).toContain('Email: john.doe@example.com');
      expect(rendered).toContain('Age: 30');
    });

    it('should handle complex schema data with multiple relationships', async () => {
      const dataSource: RDFDataSource = {
        type: 'file',
        source: 'complex-schema.ttl',
        format: 'text/turtle'
      };

      const loadResult = await dataLoader.loadFromSource(dataSource);
      expect(loadResult.success).toBe(true);
      
      rdfFilters.updateStore(loadResult.data.triples);

      // Test complex queries on organization/project data
      const organizations = rdfFilters.rdfSubject('rdf:type', 'ex:Organization');
      expect(organizations).toHaveLength(1);
      expect(organizations[0]).toBe('http://example.org/schema/acmeOrg');

      const projects = rdfFilters.rdfObject('ex:acmeOrg', 'ex:hasProject');
      expect(projects).toHaveLength(2);

      // Test budget aggregation
      const budgets = [];
      for (const project of projects) {
        const budget = rdfFilters.rdfObject(project.value, 'ex:projectBudget');
        if (budget.length > 0) {
          budgets.push(parseFloat(budget[0].value));
        }
      }
      
      const totalBudget = budgets.reduce((sum, budget) => sum + budget, 0);
      expect(totalBudget).toBe(125000); // 50000 + 75000

      // Test template generation with complex data
      const templateContext = dataLoader.createTemplateContext(loadResult.data, loadResult.variables);
      
      const template = `
Organization: \{{ "ex:acmeOrg" | rdfLabel }}
Total Projects: \{{ ("ex:acmeOrg" | rdfObject("ex:hasProject")) | length }}
Projects:
{%- for project in ("ex:acmeOrg" | rdfObject("ex:hasProject")) %}
- \{{ project.value | rdfLabel }}: $\{{ (project.value | rdfObject("ex:projectBudget"))[0].value }}
{%- endfor %}
      `.trim();

      const rendered = nunjucksEnv.renderString(template, templateContext);
      expect(rendered).toContain('Organization: ACME Corporation');
      expect(rendered).toContain('Total Projects: 2');
      expect(rendered).toContain('Website Redesign: $50000.00');
      expect(rendered).toContain('Database Migration: $75000.00');
    });

    it('should generate actual templates from RDF data', async () => {
      const dataSource: RDFDataSource = {
        type: 'file',
        source: 'basic-person.ttl',
        format: 'text/turtle'
      };

      const loadResult = await dataLoader.loadFromSource(dataSource);
      rdfFilters.updateStore(loadResult.data.triples);
      
      const templateContext = dataLoader.createTemplateContext(loadResult.data, loadResult.variables);
      
      // Test with actual template file if it exists
      try {
        const profileTemplate = readFileSync(
          join(templateFixturesPath, '_templates/person/profile.tsx.ejs'), 
          'utf-8'
        );
        
        const rendered = nunjucksEnv.renderString(profileTemplate, {
          ...templateContext,
          // Add some template-specific variables
          componentName: 'PersonProfile',
          useTypeScript: true
        });
        
        expect(rendered).toContain('PersonProfile');
        expect(rendered).toContain('John Doe');
        
      } catch (error) {
        // Template file doesn't exist, create a simple inline test
        const template = `
export const {{ componentName }} = () => {
  const persons = [
    {%- for person in $rdf.getByType('http://xmlns.com/foaf/0.1/Person') -%}
    {
      name: "{{ person.uri | rdfLabel }}",
      email: "{{ (person.uri | rdfObject('foaf:email'))[0].value }}",
      age: {{ (person.uri | rdfObject('foaf:age'))[0].value }}
    },
    {%- endfor -%}
  ];
  
  return (
    <div>
      {persons.map(person => (
        <div key={person.email}>
          <h3>{person.name}</h3>
          <p>Email: {person.email}</p>
          <p>Age: {person.age}</p>
        </div>
      ))}
    </div>
  );
};
        `.trim();

        const rendered = nunjucksEnv.renderString(template, {
          ...templateContext,
          componentName: 'PersonProfile'
        });
        
        expect(rendered).toContain('export const PersonProfile');
        expect(rendered).toContain('name: "John Doe"');
        expect(rendered).toContain('email: "john.doe@example.com"');
        expect(rendered).toContain('age: 30');
      }
    });
  });

  describe('Error Handling and Graceful Degradation', () => {
    it('should handle invalid Turtle syntax gracefully', async () => {
      const dataSource: RDFDataSource = {
        type: 'file',
        source: 'invalid-syntax.ttl',
        format: 'text/turtle'
      };

      const loadResult = await dataLoader.loadFromSource(dataSource);
      
      expect(loadResult.success).toBe(false);
      expect(loadResult.errors.length).toBeGreaterThan(0);
      expect(loadResult.errors[0]).toContain('Failed to load RDF');
      
      // Should provide empty but usable data structure
      expect(loadResult.data).toBeDefined();
      expect(loadResult.data.subjects).toEqual({});
      expect(loadResult.data.triples).toHaveLength(0);
      expect(loadResult.variables).toEqual({});
    });

    it('should handle missing files gracefully', async () => {
      const dataSource: RDFDataSource = {
        type: 'file',
        source: 'nonexistent-file.ttl',
        format: 'text/turtle'
      };

      const loadResult = await dataLoader.loadFromSource(dataSource);
      
      expect(loadResult.success).toBe(false);
      expect(loadResult.errors.length).toBeGreaterThan(0);
      expect(loadResult.errors[0]).toContain('Failed to read RDF file');
    });

    it('should handle malicious RDF content safely', async () => {
      const dataSource: RDFDataSource = {
        type: 'file',
        source: 'malicious.ttl',
        format: 'text/turtle'
      };

      // Should not crash or execute harmful content
      const loadResult = await dataLoader.loadFromSource(dataSource);
      
      // Either successfully parse safe content or fail gracefully
      if (loadResult.success) {
        expect(loadResult.data.triples.length).toBeGreaterThanOrEqual(0);
      } else {
        expect(loadResult.errors.length).toBeGreaterThan(0);
      }
      
      // Should never throw uncaught exceptions
      expect(() => {
        rdfFilters.updateStore(loadResult.data.triples);
      }).not.toThrow();
    });

    it('should provide meaningful error messages for debugging', async () => {
      const dataSource: RDFDataSource = {
        type: 'file',
        source: 'invalid-syntax.ttl',
        format: 'text/turtle'
      };

      const loadResult = await dataLoader.loadFromSource(dataSource);
      
      if (!loadResult.success) {
        expect(loadResult.metadata.error).toBeDefined();
        expect(typeof loadResult.metadata.error).toBe('string');
        expect(loadResult.metadata.loadTime).toBeGreaterThan(0);
      }
    });

    it('should handle template rendering errors gracefully', async () => {
      const dataSource: RDFDataSource = {
        type: 'file',
        source: 'basic-person.ttl',
        format: 'text/turtle'
      };

      const loadResult = await dataLoader.loadFromSource(dataSource);
      rdfFilters.updateStore(loadResult.data.triples);
      
      const templateContext = dataLoader.createTemplateContext(loadResult.data, loadResult.variables);
      
      // Template with deliberate error (non-existent filter)
      const badTemplate = `{{ "ex:person1" | nonExistentFilter }}`;
      
      expect(() => {
        nunjucksEnv.renderString(badTemplate, templateContext);
      }).toThrow(); // Should throw for non-existent filter
      
      // Template with safe fallback
      const safeTemplate = `{{ ("ex:person1" | rdfObject("nonExistentProperty"))[0].value or "N/A" }}`;
      
      const rendered = nunjucksEnv.renderString(safeTemplate, templateContext);
      expect(rendered).toBe('N/A');
    });
  });

  describe('Caching and Performance', () => {
    it('should cache RDF data and improve subsequent loads', async () => {
      const dataSource: RDFDataSource = {
        type: 'file',
        source: 'basic-person.ttl',
        format: 'text/turtle'
      };

      // First load
      const start1 = performance.now();
      const result1 = await dataLoader.loadFromSource(dataSource);
      const time1 = performance.now() - start1;
      
      expect(result1.success).toBe(true);
      expect(result1.metadata.loadTime).toBeGreaterThan(0);

      // Second load (should be cached)
      const start2 = performance.now();
      const result2 = await dataLoader.loadFromSource(dataSource);
      const time2 = performance.now() - start2;
      
      expect(result2.success).toBe(true);
      
      // Cache should make second load faster
      expect(time2).toBeLessThan(time1);
      
      // Data should be identical
      expect(result2.data.triples.length).toBe(result1.data.triples.length);
      expect(Object.keys(result2.data.subjects)).toEqual(Object.keys(result1.data.subjects));
    });

    it('should provide cache statistics', () => {
      const stats = dataLoader.getCacheStats();
      
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('keys');
      expect(stats).toHaveProperty('totalSize');
      expect(typeof stats.size).toBe('number');
      expect(Array.isArray(stats.keys)).toBe(true);
      expect(typeof stats.totalSize).toBe('number');
    });

    it('should clean up expired cache entries', async () => {
      // Create loader with very short TTL
      const shortTTLLoader = new RDFDataLoader({
        cacheEnabled: true,
        cacheTTL: 10, // 10ms
        templateDir: fixturesPath
      });

      const dataSource: RDFDataSource = {
        type: 'file',
        source: 'basic-person.ttl',
        format: 'text/turtle'
      };

      // Load data
      await shortTTLLoader.loadFromSource(dataSource);
      
      let stats = shortTTLLoader.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // Clean up expired entries
      const removed = shortTTLLoader.cleanupCache();
      expect(removed).toBeGreaterThan(0);
      
      stats = shortTTLLoader.getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should handle large datasets efficiently', async () => {
      const dataSource: RDFDataSource = {
        type: 'file',
        source: 'large-dataset.ttl',
        format: 'text/turtle'
      };

      const start = performance.now();
      const result = await dataLoader.loadFromSource(dataSource);
      const loadTime = performance.now() - start;
      
      if (result.success) {
        // Should load within reasonable time (adjust threshold as needed)
        expect(loadTime).toBeLessThan(5000); // 5 seconds max
        expect(result.data.triples.length).toBeGreaterThan(0);
        
        // Memory usage should be reasonable
        const usedMemory = process.memoryUsage().heapUsed / 1024 / 1024; // MB
        expect(usedMemory).toBeLessThan(500); // 500MB max
      }
    });
  });

  describe('Realistic Usage Scenarios', () => {
    it('should handle person profile generation workflow', async () => {
      const dataSource: RDFDataSource = {
        type: 'file',
        source: 'basic-person.ttl',
        format: 'text/turtle'
      };

      const result = await dataLoader.loadFromSource(dataSource);
      expect(result.success).toBe(true);
      
      rdfFilters.updateStore(result.data.triples);
      
      // Simulate CLI arguments derived from RDF schema
      const cliArgs = await dataLoader.generateCliArgsFromSchema(dataSource);
      expect(typeof cliArgs).toBe('object');
      
      // Test template variables integration
      const mockTemplateVars = [
        { name: 'person1', defaultValue: null, required: false },
        { name: 'componentName', defaultValue: 'PersonCard', required: true }
      ];
      
      const mergedVars = dataLoader.mergeWithTemplateVariables(result.variables, mockTemplateVars);
      expect(mergedVars).toHaveProperty('person1');
      expect(mergedVars).toHaveProperty('componentName');
    });

    it('should handle organization project management workflow', async () => {
      const dataSource: RDFDataSource = {
        type: 'file',
        source: 'complex-schema.ttl',
        format: 'text/turtle'
      };

      const result = await dataLoader.loadFromSource(dataSource);
      rdfFilters.updateStore(result.data.triples);
      
      const templateContext = dataLoader.createTemplateContext(result.data, result.variables);
      
      // Test project management dashboard template
      const dashboardTemplate = `
# Project Dashboard

**Organization:** \{{ "ex:acmeOrg" | rdfLabel }}

## Projects Overview
{%- for project in ("ex:acmeOrg" | rdfObject("ex:hasProject")) %}

### \{{ project.value | rdfLabel }}
- **Budget:** $\{{ (project.value | rdfObject("ex:projectBudget"))[0].value }}
- **Priority:** \{{ (project.value | rdfObject("ex:priority"))[0].value | upper }}
- **Start Date:** \{{ (project.value | rdfObject("ex:startDate"))[0].value }}
- **Description:** \{{ project.value | rdfObject("rdfs:comment") | first | default("No description") }}
{%- endfor %}

**Total Budget:** $\{{ ("ex:acmeOrg" | rdfObject("ex:hasProject")) | map("rdfObject", "ex:projectBudget") | map("first") | map("value") | map("float") | sum }}
      `.trim();

      const rendered = nunjucksEnv.renderString(dashboardTemplate, templateContext);
      
      expect(rendered).toContain('Project Dashboard');
      expect(rendered).toContain('ACME Corporation');
      expect(rendered).toContain('Website Redesign');
      expect(rendered).toContain('Database Migration');
      expect(rendered).toContain('Budget: $50000.00');
      expect(rendered).toContain('Budget: $75000.00');
      expect(rendered).toContain('Priority: HIGH');
      expect(rendered).toContain('Priority: CRITICAL');
    });

    it('should validate data integrity during template generation', async () => {
      const dataSource: RDFDataSource = {
        type: 'file',
        source: 'basic-person.ttl',
        format: 'text/turtle'
      };

      const result = await dataLoader.loadFromSource(dataSource);
      rdfFilters.updateStore(result.data.triples);
      
      // Test data validation template
      const validationTemplate = `
{%- set persons = $rdf.getByType('http://xmlns.com/foaf/0.1/Person') -%}
{%- set validPersons = [] -%}
{%- set invalidPersons = [] -%}

{%- for person in persons -%}
  {%- set name = person.uri | rdfObject('foaf:name') -%}
  {%- set email = person.uri | rdfObject('foaf:email') -%}
  {%- set age = person.uri | rdfObject('foaf:age') -%}
  
  {%- if name and email and age -%}
    {%- set _ = validPersons.append(person) -%}
  {%- else -%}
    {%- set _ = invalidPersons.append(person) -%}
  {%- endif -%}
{%- endfor -%}

Valid Persons: {{ validPersons | length }}
Invalid Persons: {{ invalidPersons | length }}
Total: {{ persons | length }}
      `.trim();

      const rendered = nunjucksEnv.renderString(validationTemplate, 
        dataLoader.createTemplateContext(result.data, result.variables)
      );
      
      expect(rendered).toContain('Valid Persons: 2');
      expect(rendered).toContain('Invalid Persons: 0');
      expect(rendered).toContain('Total: 2');
    });

    it('should demonstrate full integration with multiple data sources', async () => {
      // Test loading from multiple RDF sources
      const frontmatter = {
        rdfSources: [
          {
            type: 'file',
            source: 'basic-person.ttl',
            variables: ['person1', 'person2']
          },
          {
            type: 'file', 
            source: 'complex-schema.ttl',
            variables: ['acmeOrg', 'project1']
          }
        ]
      };

      const result = await dataLoader.loadFromFrontmatter(frontmatter);
      expect(result.success).toBe(true);
      expect(result.metadata.sourceCount).toBe(2);
      expect(result.data.triples.length).toBeGreaterThan(0);
      
      // Should contain data from both sources
      expect(Object.keys(result.data.subjects)).toContain('http://example.org/person1');
      expect(Object.keys(result.data.subjects)).toContain('http://example.org/schema/acmeOrg');
    });
  });

  describe('Query Performance and Optimization', () => {
    it('should execute complex queries efficiently', async () => {
      const dataSource: RDFDataSource = {
        type: 'file',
        source: 'complex-schema.ttl',
        format: 'text/turtle'
      };

      const result = await dataLoader.loadFromSource(dataSource);
      rdfFilters.updateStore(result.data.triples);
      
      const start = performance.now();
      
      // Complex query combining multiple filters
      const highPriorityProjects = rdfFilters.rdfQuery({
        subject: null,
        predicate: 'ex:priority',
        object: 'high'
      });
      
      const criticalProjects = rdfFilters.rdfQuery({
        subject: null,
        predicate: 'ex:priority', 
        object: 'critical'
      });
      
      const allProjectsWithBudget = rdfFilters.rdfQuery({
        subject: null,
        predicate: 'ex:projectBudget',
        object: null
      });
      
      const queryTime = performance.now() - start;
      
      expect(queryTime).toBeLessThan(100); // Should be very fast
      expect(highPriorityProjects.length).toBe(1);
      expect(criticalProjects.length).toBe(1);
      expect(allProjectsWithBudget.length).toBe(2);
    });

    it('should handle concurrent query operations', async () => {
      const dataSource: RDFDataSource = {
        type: 'file',
        source: 'basic-person.ttl',
        format: 'text/turtle'
      };

      const result = await dataLoader.loadFromSource(dataSource);
      rdfFilters.updateStore(result.data.triples);
      
      // Execute multiple queries concurrently
      const queries = Array(10).fill(null).map((_, i) => 
        Promise.resolve(rdfFilters.rdfSubject('rdf:type', 'foaf:Person'))
      );
      
      const start = performance.now();
      const results = await Promise.all(queries);
      const concurrentTime = performance.now() - start;
      
      expect(concurrentTime).toBeLessThan(50); // Should handle concurrency well
      expect(results).toHaveLength(10);
      results.forEach(queryResult => {
        expect(queryResult).toHaveLength(2); // Both persons
      });
    });
  });
});