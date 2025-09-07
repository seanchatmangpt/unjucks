import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'node:path';
import { TurtleParser, TurtleUtils } from '../../src/lib/turtle-parser.js';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader.js';
import { RDFFilters } from '../../src/lib/rdf-filters.js';
import { FrontmatterParser } from '../../src/lib/frontmatter-parser.js';
import nunjucks from 'nunjucks';
/**
 * Comprehensive RDF Pipeline Integration Tests
 * 
 * These tests validate the complete RDF processing pipeline:
 * - Load RDF -> Parse -> Query -> Generate Templates -> Render Output
 * - Multi-source data merging -> Template context -> Code generation
 * - Error scenarios -> Graceful degradation -> Fallback handling
 * - Real-world scenarios with complex data transformations
 */
describe('RDF Full Integration Tests', () => { let parser;
  let dataLoader;
  let rdfFilters;
  let frontmatterParser;
  let nunjucksEnv => {
    // Initialize components
    parser = new TurtleParser({
      baseIRI }
    
    // Setup temporary directories
    tempDir = path.resolve(__dirname, '../temp/rdf-integration');
    fixturesDir = path.resolve(__dirname, '../fixtures/turtle');
    await fs.ensureDir(tempDir);
  });

  afterEach(async () => {
    // Clean up
    await fs.remove(tempDir);
    dataLoader.clearCache();
  });

  describe('End-to-End Workflows', () => { it('should complete full RDF -> Parse -> Query -> Generate -> Render pipeline', async () => {
      // 1. Load RDF data from file
      const rdfSource = {
        type };
      
      const loadResult = await dataLoader.loadFromSource(rdfSource);
      expect(loadResult.success).toBe(true);
      expect(loadResult.errors).toHaveLength(0);
      
      // 2. Parse RDF data
      const rdfData = loadResult.data;
      expect(rdfData.subjects).toBeDefined();
      expect(Object.keys(rdfData.subjects)).toHaveLength(2); // person1, person2
      
      // 3. Update RDF filters with parsed data
      rdfFilters.updateStore(rdfData.triples);
      
      // 4. Query RDF data using filters
      const persons = rdfFilters.rdfSubject('http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://xmlns.com/foaf/0.1/Person');
      expect(persons).toHaveLength(2);
      
      // 5. Generate template with RDF context
      const templateContent = [
        '---',
        'to: "src/models/{{ person1.name | kebabCase }}.ts"',
        'rdf: basic-person.ttl',
        '---',
        '// Generated from RDF data',
        'export interface {{ person1.name | pascalCase }} { ',
        '  name }',
        '  homepage: string;',
        '  {%- endif %}',
        '}',
        '',
        'export const {{ person1.name | camelCase }}Data = { ',
        '  name }}",',
        '  age: {{ person1.age }},',
        '  email: "{{ person1.email }}",',
        '  {% if person1.homepage -%}',
        '  homepage: "{{ person1.homepage }}",',
        '  {%- endif %}',
        '};'
      ].join('\n');
      
      // 6. Parse frontmatter and render template
      const parsed = frontmatterParser.parse(templateContent);
      expect(parsed.hasValidFrontmatter).toBe(true);
      
      const context = dataLoader.createTemplateContext(rdfData, loadResult.variables);
      
      // Add kebab-case, pascal-case, camel-case filters for template rendering
      nunjucksEnv.addFilter('kebabCase', (str) => 
        str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      );
      nunjucksEnv.addFilter('pascalCase', (str) => 
        str.replace(/(?:^|[-_\s])(\w)/g, (_, char) => char.toUpperCase()).replace(/[-_\s]/g, '')
      );
      nunjucksEnv.addFilter('camelCase', (str) => { const pascal = str.replace(/(? });
      
      const rendered = nunjucksEnv.renderString(parsed.content, context);
      
      // 7. Validate generated output
      expect(rendered).toContain('export interface JohnDoe');
      expect(rendered).toContain('name);
      expect(rendered).toContain('age);
      expect(rendered).toContain('email);
      expect(rendered).toContain('homepage);
    });

    it('should handle multi-source data merging and template generation', async () => { // Create multiple RDF sources
      const personRdf = `
@prefix foaf },
          { type }
        ]
      };

      const result = await dataLoader.loadFromFrontmatter(frontmatter);
      
      expect(result.success).toBe(true);
      expect(result.metadata.sources).toBe(2);
      expect(result.data.subjects['http://example.org/john']).toBeDefined();
      expect(result.data.subjects['http://example.org/project1']).toBeDefined();

      // Verify merged data includes both persons and projects
      rdfFilters.updateStore(result.data.triples);
      
      const persons = rdfFilters.rdfSubject('http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://xmlns.com/foaf/0.1/Person');
      const projects = rdfFilters.rdfSubject('http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://schema.org/Project');
      
      expect(persons).toHaveLength(1);
      expect(projects).toHaveLength(1);
    });

    it('should generate TypeScript models from OWL ontologies', async () => { // Use the ontology fixture
      const ontologySource = {
        type };

      const result = await dataLoader.loadFromSource(ontologySource);
      expect(result.success).toBe(true);

      rdfFilters.updateStore(result.data.triples);

      // Query for classes defined in the ontology
      const classes = rdfFilters.rdfSubject(
        'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 
        'http://www.w3.org/2002/07/owl#Class'
      );
      
      expect(classes.length).toBeGreaterThan(0);

      // Generate TypeScript interface template
      const template = [
        '{%- for classUri in classes -%}',
        '{ %- set className = classUri | rdfCompact | split(" }',
        '{%- set label = classUri | rdfLabel -%}',
        '',
        '/**',
        ' * {{ label }}',
        ' * Generated from OWL ontology',
        ' */',
        'export interface {{ className }} { ',
        '  {%- for prop in classUri | rdfObject("http }',
        '  { %- set propName = prop.value | rdfCompact | split(" }',
        '  {{ propName }}?: any; // TODO: Infer proper type',
        '  {%- endfor %}',
        '}',
        '',
        '{%- endfor %}'
      ].join('\n');

      // Add required template filters
      nunjucksEnv.addFilter('split', (str, delimiter) => str.split(delimiter));
      nunjucksEnv.addFilter('last', (arr) => arr[arr.length - 1]);
      nunjucksEnv.addFilter('pascalCase', (str) => 
        str.replace(/(?:^|[-_\s])(\w)/g, (_, char) => char.toUpperCase()).replace(/[-_\s]/g, '')
      );
      nunjucksEnv.addFilter('camelCase', (str) => { const pascal = str.replace(/(? });

      const context = { classes };
      const rendered = nunjucksEnv.renderString(template, context);

      expect(rendered).toContain('export interface');
      expect(rendered).toContain('Generated from OWL ontology');
    });

    it('should create API clients from Hydra specifications', async () => { // Create a simple Hydra API specification
      const hydraSpec = `
@prefix hydra }
      expect(result.success).toBe(true);
      
      rdfFilters.updateStore(result.data.triples);

      // Generate API client template
      const clientTemplate = [
        '/**',
        ' * Generated API Client',
        ' */',
        'export class ApiClient {',
        '  constructor(private baseUrl) {}',
        '',
        '  {%- for collection in collections %}',
        '  { %- set collectionName = collection | rdfCompact | split(" }',
        '  ',
        '  async get{{ collectionName | pascalCase }}() {',
        '    const response = await fetch(`${this.baseUrl}/{{ collectionName }}`);',
        '    return response.json();',
        '  }',
        '  {%- endfor %}',
        '}'
      ].join('\n');

      const collections = rdfFilters.rdfSubject(
        'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        'http://www.w3.org/ns/hydra/core#Collection'
      );

      const context = { collections };
      const rendered = nunjucksEnv.renderString(clientTemplate, context);

      expect(rendered).toContain('export class ApiClient');
      expect(rendered).toContain('async getUserCollection()');
    });
  });

  describe('Error Scenarios and Graceful Degradation', () => { it('should handle parsing errors gracefully', async () => {
      const invalidRdf = `
@prefix foaf });
    });

    it('should fallback when RDF source is unavailable', async () => { const frontmatter = {
        rdf }
      };

      const result = await dataLoader.loadFromFrontmatter(frontmatter);
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Template should still render with fallback data
      const template = [
        'Name: {{ fallbackData.name or "Unknown" }}',
        'Email: {{ fallbackData.email or "no-email@example.com" }}'
      ].join('\n');

      const context = { ...frontmatter };
      const rendered = nunjucksEnv.renderString(template, context);
      
      expect(rendered).toContain('Name);
      expect(rendered).toContain('Email);
    });

    it('should handle network timeouts for remote RDF sources', async () => { vi.spyOn(global, 'fetch').mockImplementation(() =>
        new Promise((resolve) => {
          setTimeout(() => resolve({
            ok,
            status })
      );

      const result = await dataLoader.loadFromSource({ type });

    it('should validate RDF syntax and provide detailed error messages', async () => { const invalidTurtle = `
@prefix  });
  });

  describe('Cross-Component Integration Validation', () => { it('should integrate TurtleParser + RDFDataLoader seamlessly', async () => {
      const turtleData = `
@prefix ex });

    it('should integrate RDFFilters + Nunjucks template rendering', async () => { const rdfData = `
@prefix ex }',
        '# Product Catalog',
        '',
        '{% for productUri in products -%}',
        '{ %- set name = productUri | rdfObject(\'http }',
        '{ %- set price = productUri | rdfObject(\'http }',
        '{ %- set category = productUri | rdfObject(\'http }',
        '',
        '## {{ name.value }}',
        '- **Price**: ${{ price.value }}',
        '- **Category**: {{ category.value }}',
        '',
        '{% endfor %}'
      ].join('\n');

      // Add filter for accessing first element
      nunjucksEnv.addFilter('first', (arr) => arr[0]);

      const rendered = nunjucksEnv.renderString(template, {});

      expect(rendered).toContain('# Product Catalog');
      expect(rendered).toContain('## Laptop Computer');
      expect(rendered).toContain('**Price**);
      expect(rendered).toContain('**Category**);
      expect(rendered).toContain('## Office Chair');
      expect(rendered).toContain('**Price**);
    });

    it('should integrate Frontmatter parsing + RDF configuration', async () => { const templateWithRdf = [
        '---',
        'to }}.ts"',
        'rdf:',
        '  type: file',
        '  source: complex-schema.ttl',
        '  variables: ["acmeOrg", "project1", "project2"]',
        'rdfPrefixes:',
        '  company: "http://company.example.org/"',
        '  project: "http://project.example.org/"',
        'skipIf: "!acmeOrg"',
        '---',
        'export const {{ organizationName | camelCase }}Config = { ',
        '  name }}",',
        '  projects: [',
        '    {%- for project in [project1, project2] %}',
        '    { ',
        '      name }}",',
        '      budget: {{ project.projectBudget }},',
        '      startDate: "{{ project.startDate }}"',
        '    }{% if not loop.last %},{% endif %}',
        '    {%- endfor %}',
        '  ]',
        '};'
      ].join('\n');

      const parsed = frontmatterParser.parse(templateWithRdf);
      expect(parsed.hasValidFrontmatter).toBe(true);
      expect(frontmatterParser.hasRDFConfig(parsed.frontmatter)).toBe(true);

      const rdfConfig = frontmatterParser.getRDFConfig(parsed.frontmatter);
      expect(rdfConfig).toBeDefined();
      expect(rdfConfig!.type).toBe('file');
      expect(rdfConfig!.source).toBe('complex-schema.ttl');

      // Validate the frontmatter
      const validation = frontmatterParser.validate(parsed.frontmatter);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should handle caching across multiple requests', async () => { const rdfData = `@prefix ex };

      // First request
      const start1 = performance.now();
      const result1 = await dataLoader.loadFromSource(source);
      const time1 = performance.now() - start1;

      if (!result1.success) { console.log('Cache test result1 errors }
      expect(result1.success).toBe(true);

      // Second request (should be cached)
      const start2 = performance.now();
      const result2 = await dataLoader.loadFromSource(source);
      const time2 = performance.now() - start2;

      expect(result2.success).toBe(true);
      expect(time2).toBeLessThan(time1); // Cached request should be faster
      
      // Verify cache stats
      const stats = dataLoader.getCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.keys.length).toBe(1);
    });
  });

  describe('Real-World Code Generation Scenarios', () => { it('should generate complete CRUD operations from RDF schema', async () => {
      const schemaRdf = `
@prefix rdfs } from "@nestjs/common";',
        'import { Repository } from "typeorm";',
        '{ %- set classes = "http }',
        '',
        '{%- for classUri in classes -%}',
        '{ %- set className = classUri | rdfCompact | split(" }',
        '{ %- set properties = classUri | rdfObject("http }',
        '',
        '@Injectable()',
        'export class {{ className }}Service {',
        '  constructor(',
        '    private {{ className | lower }}Repository,
        '  ) {}',
        '',
        '  async create(data) {',
        '    const entity = this.{{ className | lower }}Repository.create(data);',
        '    return this.{{ className | lower }}Repository.save(entity);',
        '  }',
        '',
        '  async findAll() {',
        '    return this.{{ className | lower }}Repository.find();',
        '  }',
        '',
        '  async findOne(id) {',
        '    return this.{{ className | lower }}Repository.findOne({ where);',
        '  }',
        '',
        '  async update(id, data) {',
        '    await this.{{ className | lower }}Repository.update(id, data);',
        '    return this.findOne(id);',
        '  }',
        '',
        '  async remove(id) {',
        '    await this.{{ className | lower }}Repository.delete(id);',
        '  }',
        '}',
        '',
        '{% endfor %}'
      ].join('\n');

      nunjucksEnv.addFilter('lower', (str) => str.toLowerCase());
      nunjucksEnv.addFilter('split', (str, delimiter) => str.split(delimiter));

      const rendered = nunjucksEnv.renderString(serviceTemplate, {});

      expect(rendered).toContain('@Injectable()');
      expect(rendered).toContain('export class UserService');
      expect(rendered).toContain('async create(');
      expect(rendered).toContain('async findAll()');
      expect(rendered).toContain('async findOne(');
      expect(rendered).toContain('async update(');
      expect(rendered).toContain('async remove(');
    });

    it('should generate configuration files from RDF metadata', async () => { const configRdf = `
@prefix config }}",',
        '  version: "{{ app.version }}",',
        '  port: {{ app.port }},',
        '  debug: {{ app.debug }},',
        '  database: { ',
        '    host }}",',
        '    port: {{ app.database.port }},',
        '    name: "{{ app.database.name }}"',
        '  }',
        '};'
      ].join('\n');

      const context = dataLoader.createTemplateContext(result.data, result.variables);
      const rendered = nunjucksEnv.renderString(configTemplate, context);

      expect(rendered).toContain('name);
      expect(rendered).toContain('version);
      expect(rendered).toContain('port);
      expect(rendered).toContain('debug);
    });

    it('should generate documentation from RDF comments and labels', async () => { const docRdf = `
@prefix rdfs }',
        '',
        '# API Documentation',
        '',
        '{% for endpointUri in endpoints -%}',
        '{%- set label = endpointUri | rdfLabel -%}',
        '{ %- set comment = endpointUri | rdfObject("http }',
        '{ %- set path = endpointUri | rdfObject("http }',
        '{ %- set methods = endpointUri | rdfObject("http }',
        '',
        '## {{ label }}',
        '',
        '{{ comment.value }}',
        '',
        '**Endpoint**: `{{ path.value }}`',
        '',
        '**Methods**:',
        '{%- for method in methods %}',
        '- {{ method.value }}',
        '{%- endfor %}',
        '',
        '{% endfor %}'
      ].join('\n');

      const rendered = nunjucksEnv.renderString(docTemplate, {});

      expect(rendered).toContain('# API Documentation');
      expect(rendered).toContain('## User Management Endpoint');
      expect(rendered).toContain('Endpoints for managing user accounts');
      expect(rendered).toContain('**Endpoint**);
      expect(rendered).toContain('- GET');
      expect(rendered).toContain('- POST');
    });
  });

  describe('Performance and Scalability', () => { it('should handle large RDF datasets efficiently', async () => {
      // Use the large dataset fixture
      const result = await dataLoader.loadFromSource({
        type });

      const startTime = performance.now();
      
      expect(result.success).toBe(true);
      expect(result.metadata.loadTime).toBeLessThan(2000); // Should load within 2 seconds
      
      // Test query performance on large dataset
      rdfFilters.updateStore(result.data.triples);
      
      const queryStart = performance.now();
      const subjects = rdfFilters.rdfSubject('http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://xmlns.com/foaf/0.1/Person');
      const queryTime = performance.now() - queryStart;
      
      expect(queryTime).toBeLessThan(100); // Queries should be fast
      expect(subjects.length).toBeGreaterThan(0);
    });

    it('should maintain cache efficiency with multiple sources', async () => { const sources = [
        'basic-person.ttl',
        'complex-schema.ttl',
        'ontology.ttl'
      ].map(file => ({
        type }));

      // Load all sources
      for (const source of sources) {
        await dataLoader.loadFromSource(source);
      }

      const stats = dataLoader.getCacheStats();
      expect(stats.size).toBeGreaterThanOrEqual(2); // Some files might not exist
      expect(stats.totalSize).toBeGreaterThan(0);

      // Cleanup should work
      const cleaned = dataLoader.cleanupCache();
      expect(cleaned).toBe(0); // Nothing expired yet
    });
  });

  describe('Regression Testing', () => { it('should maintain backwards compatibility with existing templates', async () => {
      // Test that existing non-RDF templates still work
      const simpleTemplate = [
        '---',
        'to });
      expect(rendered).toContain('export const message = "Hello World";');
    });

    it('should preserve existing frontmatter functionality', async () => { const templateWithInjection = [
        '---',
        'to });

    it('should handle edge cases without breaking', async () => { // Test various edge cases
      const edgeCases = [
        '', // Empty string
        '---\n---\n', // Empty frontmatter
        'No frontmatter here', // No frontmatter
        '---\ninvalid }
    });
  });
});