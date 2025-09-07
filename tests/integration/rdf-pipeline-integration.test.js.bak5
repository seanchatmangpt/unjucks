import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolve, join } from 'path';
import { readFileSync } from 'fs';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader.js';
import { TurtleParser } from '../../src/lib/turtle-parser.js';
import { RDFFilters } from '../../src/lib/rdf-filters.js';
import { Generator } from '../../src/lib/generator.js';
import nunjucks from 'nunjucks';
/**
 * RDF Pipeline Integration Tests
 * Tests the complete end-to-end workflow:
 * 1. Load RDF data from fixtures → Parse with N3.js → Query with filters → Generate templates
 * 2. Validate with real fixture files
 * 3. Test error handling and graceful degradation  
 * 4. Verify caching and performance
 */
describe('RDF Pipeline Integration Tests', () => { let dataLoader;
  let rdfFilters;
  let nunjucksEnv = resolve(__dirname, '../fixtures/turtle');
  const templateFixturesPath = resolve(__dirname, '../fixtures/turtle-templates');

  beforeEach(() => {
    const loaderOptions = {
      cacheEnabled,
      cacheTTL };
    
    dataLoader = new RDFDataLoader(loaderOptions);
    rdfFilters = new RDFFilters({ prefixes }
    );
    
    // Register all RDF filters
    const filters = rdfFilters.getAllFilters();
    for (const [name, filter] of Object.entries(filters)) {
      nunjucksEnv.addFilter(name, filter);
    }
    
    generator = new Generator({
      templatesPath,
      targetPath, '../tmp/rdf-integration'),
      nunjucksEnv
    });
  });

  afterEach(() => {
    dataLoader.clearCache();
    rdfFilters.clearStore();
  });

  describe('End-to-End RDF Pipeline', () => { it('should complete full pipeline, async () => {
      // 1. Load RDF data from basic-person.ttl fixture
      const dataSource = {
        type };

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
{ %- for person in $rdf.getByType('http }
Person: {{ person.uri | rdfLabel }}
Email: { { (person.uri | rdfObject('foaf }}
Age: { { (person.uri | rdfObject('foaf }}
{%- endfor -%}
      `.trim();

      const rendered = nunjucksEnv.renderString(template, templateContext);
      expect(rendered).toContain('Person);
      expect(rendered).toContain('Email);
      expect(rendered).toContain('Age);
    });

    it('should handle complex schema data with multiple relationships', async () => { const dataSource = {
        type };

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
      for (const project of projects) { const budget = rdfFilters.rdfObject(project.value, 'ex }
      }
      
      const totalBudget = budgets.reduce((sum, budget) => sum + budget, 0);
      expect(totalBudget).toBe(125000); // 50000 + 75000

      // Test template generation with complex data
      const templateContext = dataLoader.createTemplateContext(loadResult.data, loadResult.variables);
      
      const template = `
Organization: \{ { "ex }}
Total Projects: \{ { ("ex }}
Projects:
{ %- for project in ("ex }
- \{{ project.value | rdfLabel }}: $\{ { (project.value | rdfObject("ex }}
{%- endfor %}
      `.trim();

      const rendered = nunjucksEnv.renderString(template, templateContext);
      expect(rendered).toContain('Organization);
      expect(rendered).toContain('Total Projects);
      expect(rendered).toContain('Website Redesign);
      expect(rendered).toContain('Database Migration);
    });

    it('should generate actual templates from RDF data', async () => { const dataSource = {
        type };

      const loadResult = await dataLoader.loadFromSource(dataSource);
      rdfFilters.updateStore(loadResult.data.triples);
      
      const templateContext = dataLoader.createTemplateContext(loadResult.data, loadResult.variables);
      
      // Test with actual template file if it exists
      try { const profileTemplate = readFileSync(
          join(templateFixturesPath, '_templates/person/profile.tsx.ejs'), 
          'utf-8'
        );
        
        const rendered = nunjucksEnv.renderString(profileTemplate, {
          ...templateContext,
          // Add some template-specific variables
          componentName } catch (error) {
        // Template file doesn't exist, create a simple inline test
        const template = `
export const {{ componentName }} = () => { const persons = [
    {%- for person in $rdf.getByType('http }
    { name }}",
      email: "{ { (person.uri | rdfObject('foaf }}",
      age: { { (person.uri | rdfObject('foaf }}
    },
    {%- endfor -%}
  ];
  
  return (
    
      {persons.map(person => (
        <div key={person.email}>
          {person.name}</h3>
          Email: {person.email}</p>
          Age))}
    </div>
  );
};
        `.trim();

        const rendered = nunjucksEnv.renderString(template, {
          ...templateContext,
          componentName);
        
        expect(rendered).toContain('export const PersonProfile');
        expect(rendered).toContain('name);
        expect(rendered).toContain('email);
        expect(rendered).toContain('age);
      }
    });
  });

  describe('Error Handling and Graceful Degradation', () => { it('should handle invalid Turtle syntax gracefully', async () => {
      const dataSource = {
        type };

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

    it('should handle missing files gracefully', async () => { const dataSource = {
        type };

      const loadResult = await dataLoader.loadFromSource(dataSource);
      
      expect(loadResult.success).toBe(false);
      expect(loadResult.errors.length).toBeGreaterThan(0);
      expect(loadResult.errors[0]).toContain('Failed to read RDF file');
    });

    it('should handle malicious RDF content safely', async () => { const dataSource = {
        type };

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

    it('should provide meaningful error messages for debugging', async () => { const dataSource = {
        type };

      const loadResult = await dataLoader.loadFromSource(dataSource);
      
      if (!loadResult.success) {
        expect(loadResult.metadata.error).toBeDefined();
        expect(typeof loadResult.metadata.error).toBe('string');
        expect(loadResult.metadata.loadTime).toBeGreaterThan(0);
      }
    });

    it('should handle template rendering errors gracefully', async () => { const dataSource = {
        type };

      const loadResult = await dataLoader.loadFromSource(dataSource);
      rdfFilters.updateStore(loadResult.data.triples);
      
      const templateContext = dataLoader.createTemplateContext(loadResult.data, loadResult.variables);
      
      // Template with deliberate error (non-existent filter)
      const badTemplate = `{ { "ex }}`;
      
      expect(() => {
        nunjucksEnv.renderString(badTemplate, templateContext);
      }).toThrow(); // Should throw for non-existent filter
      
      // Template with safe fallback
      const safeTemplate = `{ { ("ex }}`;
      
      const rendered = nunjucksEnv.renderString(safeTemplate, templateContext);
      expect(rendered).toBe('N/A');
    });
  });

  describe('Caching and Performance', () => { it('should cache RDF data and improve subsequent loads', async () => {
      const dataSource = {
        type };

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

    it('should clean up expired cache entries', async () => { // Create loader with very short TTL
      const shortTTLLoader = new RDFDataLoader({
        cacheEnabled,
        cacheTTL };

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

    it('should handle large datasets efficiently', async () => { const dataSource = {
        type };

      const start = performance.now();
      const result = await dataLoader.loadFromSource(dataSource);
      const loadTime = performance.now() - start;
      
      if (result.success) {
        // Should load within reasonable time (adjust threshold)
        expect(loadTime).toBeLessThan(5000); // 5 seconds max
        expect(result.data.triples.length).toBeGreaterThan(0);
        
        // Memory usage should be reasonable
        const usedMemory = process.memoryUsage().heapUsed / 1024 / 1024; // MB
        expect(usedMemory).toBeLessThan(500); // 500MB max
      }
    });
  });

  describe('Realistic Usage Scenarios', () => { it('should handle person profile generation workflow', async () => {
      const dataSource = {
        type };

      const result = await dataLoader.loadFromSource(dataSource);
      expect(result.success).toBe(true);
      
      rdfFilters.updateStore(result.data.triples);
      
      // Simulate CLI arguments derived from RDF schema
      const cliArgs = await dataLoader.generateCliArgsFromSchema(dataSource);
      expect(typeof cliArgs).toBe('object');
      
      // Test template variables integration
      const mockTemplateVars = [
        { name },
        { name }
      ];
      
      const mergedVars = dataLoader.mergeWithTemplateVariables(result.variables, mockTemplateVars);
      expect(mergedVars).toHaveProperty('person1');
      expect(mergedVars).toHaveProperty('componentName');
    });

    it('should handle organization project management workflow', async () => { const dataSource = {
        type };

      const result = await dataLoader.loadFromSource(dataSource);
      rdfFilters.updateStore(result.data.triples);
      
      const templateContext = dataLoader.createTemplateContext(result.data, result.variables);
      
      // Test project management dashboard template
      const dashboardTemplate = `
# Project Dashboard

**Organization:** \{ { "ex }}

## Projects Overview
{ %- for project in ("ex }

### \{{ project.value | rdfLabel }}
- **Budget:** $\{ { (project.value | rdfObject("ex }}
- **Priority:** \{ { (project.value | rdfObject("ex }}
- **Start Date:** \{ { (project.value | rdfObject("ex }}
- **Description:** \{ { project.value | rdfObject("rdfs }}
{%- endfor %}

**Total Budget:** $\{ { ("ex }}
      `.trim();

      const rendered = nunjucksEnv.renderString(dashboardTemplate, templateContext);
      
      expect(rendered).toContain('Project Dashboard');
      expect(rendered).toContain('ACME Corporation');
      expect(rendered).toContain('Website Redesign');
      expect(rendered).toContain('Database Migration');
      expect(rendered).toContain('Budget);
      expect(rendered).toContain('Budget);
      expect(rendered).toContain('Priority);
      expect(rendered).toContain('Priority);
    });

    it('should validate data integrity during template generation', async () => { const dataSource = {
        type };

      const result = await dataLoader.loadFromSource(dataSource);
      rdfFilters.updateStore(result.data.triples);
      
      // Test data validation template
      const validationTemplate = `
{ %- set persons = $rdf.getByType('http }
{%- set validPersons = [] -%}
{%- set invalidPersons = [] -%}

{%- for person in persons -%}
  { %- set name = person.uri | rdfObject('foaf }
  { %- set email = person.uri | rdfObject('foaf }
  { %- set age = person.uri | rdfObject('foaf }
  
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
      
      expect(rendered).toContain('Valid Persons);
      expect(rendered).toContain('Invalid Persons);
      expect(rendered).toContain('Total);
    });

    it('should demonstrate full integration with multiple data sources', async () => { // Test loading from multiple RDF sources
      const frontmatter = {
        rdfSources },
          { type }
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

  describe('Query Performance and Optimization', () => { it('should execute complex queries efficiently', async () => {
      const dataSource = {
        type };

      const result = await dataLoader.loadFromSource(dataSource);
      rdfFilters.updateStore(result.data.triples);
      
      const start = performance.now();
      
      // Complex query combining multiple filters
      const highPriorityProjects = rdfFilters.rdfQuery({ subject,
        predicate });

    it('should handle concurrent query operations', async () => { const dataSource = {
        type };

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