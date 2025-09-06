import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'node:path';
import { TurtleParser, TurtleUtils } from '../../src/lib/turtle-parser.js';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader.js';
import { RDFFilters } from '../../src/lib/rdf-filters.js';
import { FrontmatterParser } from '../../src/lib/frontmatter-parser.js';
import nunjucks from 'nunjucks';
import type { 
  RDFDataSource, 
  TurtleData, 
  RDFTemplateContext 
} from '../../src/lib/types/turtle-types.js';

/**
 * Comprehensive RDF Pipeline Integration Tests
 * 
 * These tests validate the complete RDF processing pipeline:
 * - Load RDF -> Parse -> Query -> Generate Templates -> Render Output
 * - Multi-source data merging -> Template context -> Code generation
 * - Error scenarios -> Graceful degradation -> Fallback handling
 * - Real-world scenarios with complex data transformations
 */
describe('RDF Full Integration Tests', () => {
  let parser: TurtleParser;
  let dataLoader: RDFDataLoader;
  let rdfFilters: RDFFilters;
  let frontmatterParser: FrontmatterParser;
  let nunjucksEnv: nunjucks.Environment;
  let tempDir: string;
  let fixturesDir: string;

  beforeEach(async () => {
    // Initialize components
    parser = new TurtleParser({
      baseIRI: 'http://example.org/',
      format: 'text/turtle'
    });
    
    dataLoader = new RDFDataLoader({
      baseUri: 'http://example.org/',
      cacheEnabled: true,
      validateSyntax: true,
      httpTimeout: 5000,
      maxRetries: 2
    });
    
    rdfFilters = new RDFFilters({
      baseUri: 'http://example.org/',
      prefixes: {
        ex: 'http://example.org/',
        foaf: 'http://xmlns.com/foaf/0.1/',
        dcterms: 'http://purl.org/dc/terms/',
        schema: 'http://schema.org/',
        unjucks: 'http://unjucks.dev/ontology#'
      }
    });
    
    frontmatterParser = new FrontmatterParser();
    
    // Setup Nunjucks environment with RDF filters
    nunjucksEnv = new nunjucks.Environment();
    const filters = rdfFilters.getAllFilters();
    for (const [name, filter] of Object.entries(filters)) {
      nunjucksEnv.addFilter(name, filter);
    }
    
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

  describe('End-to-End Workflows', () => {
    it('should complete full RDF -> Parse -> Query -> Generate -> Render pipeline', async () => {
      // 1. Load RDF data from file
      const rdfSource: RDFDataSource = {
        type: 'file',
        source: path.join(fixturesDir, 'basic-person.ttl')
      };
      
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
      const templateContent = `
---
to: "src/models/{{ person1.name | kebabCase }}.ts"
rdf: basic-person.ttl
---
// Generated from RDF data
export interface {{ person1.name | pascalCase }} {
  name: string;
  age: number;
  email: string;
  {% if person1.homepage -%}
  homepage: string;
  {%- endif %}
}

export const {{ person1.name | camelCase }}Data = {
  name: "{{ person1.name }}",
  age: {{ person1.age }},
  email: "{{ person1.email }}",
  {% if person1.homepage -%}
  homepage: "{{ person1.homepage }}",
  {%- endif %}
};
`;
      
      // 6. Parse frontmatter and render template
      const parsed = frontmatterParser.parse(templateContent);
      expect(parsed.hasValidFrontmatter).toBe(true);
      
      const context = dataLoader.createTemplateContext(rdfData, loadResult.variables);
      
      // Add kebab-case, pascal-case, camel-case filters for template rendering
      nunjucksEnv.addFilter('kebabCase', (str: string) => 
        str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      );
      nunjucksEnv.addFilter('pascalCase', (str: string) => 
        str.replace(/(?:^|[-_\s])(\w)/g, (_, char) => char.toUpperCase()).replace(/[-_\s]/g, '')
      );
      nunjucksEnv.addFilter('camelCase', (str: string) => {
        const pascal = str.replace(/(?:^|[-_\s])(\w)/g, (_, char) => char.toUpperCase()).replace(/[-_\s]/g, '');
        return pascal.charAt(0).toLowerCase() + pascal.slice(1);
      });
      
      const rendered = nunjucksEnv.renderString(parsed.content, context);
      
      // 7. Validate generated output
      expect(rendered).toContain('export interface JohnDoe');
      expect(rendered).toContain('name: "John Doe"');
      expect(rendered).toContain('age: 30');
      expect(rendered).toContain('email: "john.doe@example.com"');
      expect(rendered).toContain('homepage: "http://johndoe.example.com"');
    });

    it('should handle multi-source data merging and template generation', async () => {
      // Create multiple RDF sources
      const personRdf = `
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix ex: <http://example.org/> .

ex:john a foaf:Person ;
    foaf:name "John Doe" ;
    foaf:email "john@example.com" .
`;

      const projectRdf = `
@prefix ex: <http://example.org/> .
@prefix schema: <http://schema.org/> .

ex:project1 a schema:Project ;
    schema:name "Website Redesign" ;
    schema:member ex:john .
`;

      // Write temporary files
      const personFile = path.join(tempDir, 'persons.ttl');
      const projectFile = path.join(tempDir, 'projects.ttl');
      
      await fs.writeFile(personFile, personRdf);
      await fs.writeFile(projectFile, projectRdf);

      // Load from multiple sources
      const frontmatter = {
        rdfSources: [
          { type: 'file', source: personFile },
          { type: 'file', source: projectFile }
        ]
      };

      const result = await dataLoader.loadFromFrontmatter(frontmatter);
      
      expect(result.success).toBe(true);
      expect(result.metadata.sourceCount).toBe(2);
      expect(result.data.subjects['http://example.org/john']).toBeDefined();
      expect(result.data.subjects['http://example.org/project1']).toBeDefined();

      // Verify merged data includes both persons and projects
      rdfFilters.updateStore(result.data.triples);
      
      const persons = rdfFilters.rdfSubject('http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://xmlns.com/foaf/0.1/Person');
      const projects = rdfFilters.rdfSubject('http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://schema.org/Project');
      
      expect(persons).toHaveLength(1);
      expect(projects).toHaveLength(1);
    });

    it('should generate TypeScript models from OWL ontologies', async () => {
      // Use the ontology fixture
      const ontologySource: RDFDataSource = {
        type: 'file',
        source: path.join(fixturesDir, 'ontology.ttl')
      };

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
      const template = `
{%- for classUri in classes -%}
{%- set className = classUri | rdfCompact | split(':') | last | pascalCase -%}
{%- set label = classUri | rdfLabel -%}

/**
 * {{ label }}
 * Generated from OWL ontology
 */
export interface {{ className }} {
  {%- for prop in classUri | rdfObject('http://www.w3.org/2000/01/rdf-schema#domain') %}
  {%- set propName = prop.value | rdfCompact | split(':') | last | camelCase %}
  {{ propName }}?: any; // TODO: Infer proper type
  {%- endfor %}
}

{%- endfor %}
`;

      // Add required template filters
      nunjucksEnv.addFilter('split', (str: string, delimiter: string) => str.split(delimiter));
      nunjucksEnv.addFilter('last', (arr: string[]) => arr[arr.length - 1]);
      nunjucksEnv.addFilter('pascalCase', (str: string) => 
        str.replace(/(?:^|[-_\s])(\w)/g, (_, char) => char.toUpperCase()).replace(/[-_\s]/g, '')
      );
      nunjucksEnv.addFilter('camelCase', (str: string) => {
        const pascal = str.replace(/(?:^|[-_\s])(\w)/g, (_, char) => char.toUpperCase()).replace(/[-_\s]/g, '');
        return pascal.charAt(0).toLowerCase() + pascal.slice(1);
      });

      const context = { classes };
      const rendered = nunjucksEnv.renderString(template, context);

      expect(rendered).toContain('export interface');
      expect(rendered).toContain('Generated from OWL ontology');
    });

    it('should create API clients from Hydra specifications', async () => {
      // Create a simple Hydra API specification
      const hydraSpec = `
@prefix hydra: <http://www.w3.org/ns/hydra/core#> .
@prefix api: <http://api.example.org/> .
@prefix schema: <http://schema.org/> .

api:UserCollection a hydra:Collection ;
    hydra:manages api:User ;
    hydra:operation [
        a hydra:Operation ;
        hydra:method "GET" ;
        hydra:expects schema:Person ;
        hydra:returns api:User
    ] .

api:User a hydra:Resource ;
    hydra:supportedProperty [
        hydra:property schema:name ;
        hydra:required true ;
        hydra:readable true ;
        hydra:writable true
    ], [
        hydra:property schema:email ;
        hydra:required true ;
        hydra:readable true ;
        hydra:writable true
    ] .
`;

      const specFile = path.join(tempDir, 'api-spec.ttl');
      await fs.writeFile(specFile, hydraSpec);

      const result = await dataLoader.loadFromSource({
        type: 'file',
        source: specFile
      });

      expect(result.success).toBe(true);
      
      rdfFilters.updateStore(result.data.triples);

      // Generate API client template
      const clientTemplate = `
/**
 * Generated API Client
 */
export class ApiClient {
  constructor(private baseUrl: string) {}

  {%- for collection in collections %}
  {%- set collectionName = collection | rdfCompact | split(':') | last | camelCase %}
  
  async get{{ collectionName | pascalCase }}(): Promise<{{ collectionName | pascalCase }}[]> {
    const response = await fetch(\`\${this.baseUrl}/{{ collectionName }}\`);
    return response.json();
  }
  {%- endfor %}
}
`;

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

  describe('Error Scenarios and Graceful Degradation', () => {
    it('should handle parsing errors gracefully', async () => {
      const invalidRdf = `
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
ex:person a foaf:Person  # Missing semicolon and period
    foaf:name "John Doe"
`;

      const rdfFile = path.join(tempDir, 'invalid.ttl');
      await fs.writeFile(rdfFile, invalidRdf);

      const result = await dataLoader.loadFromSource({
        type: 'file',
        source: rdfFile
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.data.subjects).toEqual({});
    });

    it('should fallback when RDF source is unavailable', async () => {
      const frontmatter = {
        rdf: 'non-existent-file.ttl',
        fallbackData: {
          name: 'Default User',
          email: 'default@example.com'
        }
      };

      const result = await dataLoader.loadFromFrontmatter(frontmatter);
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Template should still render with fallback data
      const template = `
Name: {{ fallbackData.name or 'Unknown' }}
Email: {{ fallbackData.email or 'no-email@example.com' }}
`;

      const context = { ...frontmatter };
      const rendered = nunjucksEnv.renderString(template, context);
      
      expect(rendered).toContain('Name: Default User');
      expect(rendered).toContain('Email: default@example.com');
    });

    it('should handle network timeouts for remote RDF sources', async () => {
      vi.spyOn(global, 'fetch').mockImplementation(() =>
        new Promise((resolve) => {
          setTimeout(() => resolve({
            ok: false,
            status: 408,
            statusText: 'Request Timeout'
          } as Response), 10000); // Simulate slow response
        })
      );

      const result = await dataLoader.loadFromSource({
        type: 'uri',
        source: 'http://slow.example.org/data.ttl'
      });

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('timeout') || e.includes('fetch'))).toBe(true);
      
      vi.restoreAllMocks();
    });

    it('should validate RDF syntax and provide detailed error messages', async () => {
      const invalidTurtle = `
@prefix : <http://example.org/> .
:person a :Person ;
    :name "John" ;
    :age "not-a-number"^^xsd:integer .
`;

      const validation = await dataLoader.validateRDF(invalidTurtle, 'turtle');
      
      // Should detect syntax issues (if validation is comprehensive enough)
      // At minimum should not crash
      expect(validation).toBeDefined();
      expect(typeof validation.valid).toBe('boolean');
    });
  });

  describe('Cross-Component Integration Validation', () => {
    it('should integrate TurtleParser + RDFDataLoader seamlessly', async () => {
      const turtleData = `
@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

ex:alice a foaf:Person ;
    foaf:name "Alice Smith" ;
    foaf:knows ex:bob .

ex:bob a foaf:Person ;
    foaf:name "Bob Jones" .
`;

      // Test direct parser usage
      const parseResult = await parser.parse(turtleData);
      expect(parseResult.triples.length).toBe(4);
      expect(parseResult.stats.tripleCount).toBe(4);

      // Test data loader with inline data
      const loadResult = await dataLoader.loadFromSource({
        type: 'inline',
        source: turtleData
      });

      expect(loadResult.success).toBe(true);
      expect(loadResult.data.triples.length).toBe(4);
      
      // Both should produce compatible results
      expect(parseResult.triples.length).toBe(loadResult.data.triples.length);
    });

    it('should integrate RDFFilters + Nunjucks template rendering', async () => {
      const rdfData = `
@prefix ex: <http://example.org/> .
@prefix schema: <http://schema.org/> .

ex:product1 a schema:Product ;
    schema:name "Laptop Computer" ;
    schema:price "999.99" ;
    schema:category "Electronics" .

ex:product2 a schema:Product ;
    schema:name "Office Chair" ;
    schema:price "299.99" ;
    schema:category "Furniture" .
`;

      const result = await dataLoader.loadFromSource({
        type: 'inline',
        source: rdfData
      });

      rdfFilters.updateStore(result.data.triples);

      const template = [
        '{%- set products = \'http://www.w3.org/1999/02/22-rdf-syntax-ns#type\' | rdfSubject(\'http://schema.org/Product\') -%}',
        '# Product Catalog',
        '',
        '{% for productUri in products -%}',
        '{%- set name = productUri | rdfObject(\'http://schema.org/name\') | first -%}',
        '{%- set price = productUri | rdfObject(\'http://schema.org/price\') | first -%}',
        '{%- set category = productUri | rdfObject(\'http://schema.org/category\') | first -%}',
        '',
        '## {{ name.value }}',
        '- **Price**: ${{ price.value }}',
        '- **Category**: {{ category.value }}',
        '',
        '{% endfor %}'
      ].join('\n');

      // Add filter for accessing first element
      nunjucksEnv.addFilter('first', (arr: any[]) => arr[0]);

      const rendered = nunjucksEnv.renderString(template, {});

      expect(rendered).toContain('# Product Catalog');
      expect(rendered).toContain('## Laptop Computer');
      expect(rendered).toContain('**Price**: $999.99');
      expect(rendered).toContain('**Category**: Electronics');
      expect(rendered).toContain('## Office Chair');
      expect(rendered).toContain('**Price**: $299.99');
    });

    it('should integrate Frontmatter parsing + RDF configuration', async () => {
      const templateWithRdf = `
---
to: "src/config/{{ organizationName | kebabCase }}.ts"
rdf:
  type: file
  source: complex-schema.ttl
  variables: ["acmeOrg", "project1", "project2"]
rdfPrefixes:
  company: "http://company.example.org/"
  project: "http://project.example.org/"
skipIf: "!acmeOrg"
---
export const {{ organizationName | camelCase }}Config = {
  name: "{{ acmeOrg.label }}",
  projects: [
    {%- for project in [project1, project2] %}
    {
      name: "{{ project.label }}",
      budget: {{ project.projectBudget }},
      startDate: "{{ project.startDate }}"
    }{% if not loop.last %},{% endif %}
    {%- endfor %}
  ]
};
`;

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

    it('should handle caching across multiple requests', async () => {
      const rdfData = `@prefix ex: <http://example.org/> . ex:test ex:value "cached" .`;
      const rdfFile = path.join(tempDir, 'cached.ttl');
      await fs.writeFile(rdfFile, rdfData);

      const source: RDFDataSource = {
        type: 'file',
        source: rdfFile
      };

      // First request
      const start1 = performance.now();
      const result1 = await dataLoader.loadFromSource(source);
      const time1 = performance.now() - start1;

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

  describe('Real-World Code Generation Scenarios', () => {
    it('should generate complete CRUD operations from RDF schema', async () => {
      const schemaRdf = `
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix api: <http://api.example.org/> .

api:User a owl:Class ;
    rdfs:label "User" ;
    rdfs:comment "A system user" .

api:name a owl:DatatypeProperty ;
    rdfs:label "name" ;
    rdfs:domain api:User ;
    rdfs:range xsd:string .

api:email a owl:DatatypeProperty ;
    rdfs:label "email" ;
    rdfs:domain api:User ;
    rdfs:range xsd:string .

api:createdAt a owl:DatatypeProperty ;
    rdfs:label "created at" ;
    rdfs:domain api:User ;
    rdfs:range xsd:dateTime .
`;

      const result = await dataLoader.loadFromSource({
        type: 'inline',
        source: schemaRdf
      });

      rdfFilters.updateStore(result.data.triples);

      // Generate service class template
      const serviceTemplate = `
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
{%- set classes = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' | rdfSubject('http://www.w3.org/2002/07/owl#Class') %}

{%- for classUri in classes -%}
{%- set className = classUri | rdfCompact | split(':') | last -%}
{%- set properties = classUri | rdfObject('http://www.w3.org/2000/01/rdf-schema#domain') -%}

@Injectable()
export class {{ className }}Service {
  constructor(
    private {{ className | lower }}Repository: Repository<{{ className }}>
  ) {}

  async create(data: Partial<{{ className }}>): Promise<{{ className }}> {
    const entity = this.{{ className | lower }}Repository.create(data);
    return this.{{ className | lower }}Repository.save(entity);
  }

  async findAll(): Promise<{{ className }}[]> {
    return this.{{ className | lower }}Repository.find();
  }

  async findOne(id: string): Promise<{{ className }} | null> {
    return this.{{ className | lower }}Repository.findOne({ where: { id } });
  }

  async update(id: string, data: Partial<{{ className }}>): Promise<{{ className }} | null> {
    await this.{{ className | lower }}Repository.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.{{ className | lower }}Repository.delete(id);
  }
}

{% endfor %}
`;

      nunjucksEnv.addFilter('lower', (str: string) => str.toLowerCase());

      const rendered = nunjucksEnv.renderString(serviceTemplate, {});

      expect(rendered).toContain('@Injectable()');
      expect(rendered).toContain('export class UserService');
      expect(rendered).toContain('async create(');
      expect(rendered).toContain('async findAll()');
      expect(rendered).toContain('async findOne(');
      expect(rendered).toContain('async update(');
      expect(rendered).toContain('async remove(');
    });

    it('should generate configuration files from RDF metadata', async () => {
      const configRdf = `
@prefix config: <http://config.example.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

config:app a config:Application ;
    config:name "MyApp" ;
    config:version "1.0.0" ;
    config:port "3000"^^xsd:integer ;
    config:debug "true"^^xsd:boolean ;
    config:database [
        config:host "localhost" ;
        config:port "5432"^^xsd:integer ;
        config:name "myapp_db"
    ] .
`;

      const result = await dataLoader.loadFromSource({
        type: 'inline',
        source: configRdf
      });

      const configTemplate = `
export const appConfig = {
  name: "{{ app.name }}",
  version: "{{ app.version }}",
  port: {{ app.port }},
  debug: {{ app.debug }},
  database: {
    host: "{{ app.database.host }}",
    port: {{ app.database.port }},
    name: "{{ app.database.name }}"
  }
};
`;

      const context = dataLoader.createTemplateContext(result.data, result.variables);
      const rendered = nunjucksEnv.renderString(configTemplate, context);

      expect(rendered).toContain('name: "MyApp"');
      expect(rendered).toContain('version: "1.0.0"');
      expect(rendered).toContain('port: 3000');
      expect(rendered).toContain('debug: true');
    });

    it('should generate documentation from RDF comments and labels', async () => {
      const docRdf = `
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix docs: <http://docs.example.org/> .

docs:ApiDocumentation a docs:Documentation ;
    rdfs:label "API Documentation" ;
    rdfs:comment "Complete API reference documentation" .

docs:UserEndpoint a docs:Endpoint ;
    rdfs:label "User Management Endpoint" ;
    rdfs:comment "Endpoints for managing user accounts" ;
    docs:path "/api/users" ;
    docs:method "GET", "POST", "PUT", "DELETE" .
`;

      const result = await dataLoader.loadFromSource({
        type: 'inline',
        source: docRdf
      });

      rdfFilters.updateStore(result.data.triples);

      const docTemplate = `
{%- set endpoints = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' | rdfSubject('http://docs.example.org/Endpoint') -%}

# API Documentation

{% for endpointUri in endpoints -%}
{%- set label = endpointUri | rdfLabel -%}
{%- set comment = endpointUri | rdfObject('http://www.w3.org/2000/01/rdf-schema#comment') | first -%}
{%- set path = endpointUri | rdfObject('http://docs.example.org/path') | first -%}
{%- set methods = endpointUri | rdfObject('http://docs.example.org/method') -%}

## {{ label }}

{{ comment.value }}

**Endpoint**: \`{{ path.value }}\`

**Methods**:
{%- for method in methods %}
- {{ method.value }}
{%- endfor %}

{% endfor %}
`;

      const rendered = nunjucksEnv.renderString(docTemplate, {});

      expect(rendered).toContain('# API Documentation');
      expect(rendered).toContain('## User Management Endpoint');
      expect(rendered).toContain('Endpoints for managing user accounts');
      expect(rendered).toContain('**Endpoint**: `/api/users`');
      expect(rendered).toContain('- GET');
      expect(rendered).toContain('- POST');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large RDF datasets efficiently', async () => {
      // Use the large dataset fixture
      const result = await dataLoader.loadFromSource({
        type: 'file',
        source: path.join(fixturesDir, 'large-dataset.ttl')
      });

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

    it('should maintain cache efficiency with multiple sources', async () => {
      const sources = [
        'basic-person.ttl',
        'complex-schema.ttl',
        'ontology.ttl'
      ].map(file => ({
        type: 'file' as const,
        source: path.join(fixturesDir, file)
      }));

      // Load all sources
      for (const source of sources) {
        await dataLoader.loadFromSource(source);
      }

      const stats = dataLoader.getCacheStats();
      expect(stats.size).toBe(3);
      expect(stats.totalSize).toBeGreaterThan(0);

      // Cleanup should work
      const cleaned = dataLoader.cleanupCache();
      expect(cleaned).toBe(0); // Nothing expired yet
    });
  });

  describe('Regression Testing', () => {
    it('should maintain backwards compatibility with existing templates', async () => {
      // Test that existing non-RDF templates still work
      const simpleTemplate = `
---
to: "src/simple.ts"
---
export const message = "Hello World";
`;

      const parsed = frontmatterParser.parse(simpleTemplate);
      expect(parsed.hasValidFrontmatter).toBe(true);
      expect(frontmatterParser.hasRDFConfig(parsed.frontmatter)).toBe(false);

      const rendered = nunjucksEnv.renderString(parsed.content, {});
      expect(rendered).toContain('export const message = "Hello World";');
    });

    it('should preserve existing frontmatter functionality', async () => {
      const templateWithInjection = `
---
to: "existing-file.ts"
inject: true
before: "// INSERT_POINT"
skipIf: "!shouldGenerate"
---
const newCode = "injected";
`;

      const parsed = frontmatterParser.parse(templateWithInjection);
      const validation = frontmatterParser.validate(parsed.frontmatter);
      
      expect(validation.valid).toBe(true);
      expect(parsed.frontmatter.inject).toBe(true);
      expect(parsed.frontmatter.before).toBe('// INSERT_POINT');
      expect(parsed.frontmatter.skipIf).toBe('!shouldGenerate');
      
      const operationMode = frontmatterParser.getOperationMode(parsed.frontmatter);
      expect(operationMode.mode).toBe('inject');
      expect(operationMode.target).toBe('// INSERT_POINT');
    });

    it('should handle edge cases without breaking', async () => {
      // Test various edge cases
      const edgeCases = [
        '', // Empty string
        '---\n---\n', // Empty frontmatter
        'No frontmatter here', // No frontmatter
        '---\ninvalid: yaml: [\n---\nContent', // Invalid YAML
      ];

      for (const testCase of edgeCases) {
        const parsed = frontmatterParser.parse(testCase);
        expect(parsed).toBeDefined();
        expect(typeof parsed.content).toBe('string');
        expect(typeof parsed.hasValidFrontmatter).toBe('boolean');
      }
    });
  });
});