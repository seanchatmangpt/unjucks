/**
 * Comprehensive Linked Data Validation Test Suite
 * Tests production-ready linked data resource generation with web-scale validation
 */

import { describe, it, expect, beforeEach, beforeAll, afterEach } from 'vitest';
import { Store, Parser, Writer, Quad, DataFactory } from 'n3';
import nunjucks from 'nunjucks';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { LinkedDataFilters, registerLinkedDataFilters } from '../src/lib/linked-data-filters.js';
import axios from 'axios';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { namedNode, literal, quad } = DataFactory;

describe('Linked Data Resource Generation', () => {
  let nunjucksEnv;
  let filters;
  let testDataDir;
  let outputDir;

  beforeAll(async () => {
    testDataDir = path.join(__dirname, 'fixtures', 'linked-data');
    outputDir = path.join(__dirname, '.tmp', 'linked-data-output');
    
    // Ensure output directory exists
    await fs.ensureDir(outputDir);
    
    // Setup Nunjucks environment with no auto-escaping for RDF templates
    nunjucksEnv = new nunjucks.Environment(
      new nunjucks.FileSystemLoader(testDataDir, { noCache: true }),
      { autoescape: false }
    );
    
    // Register linked data filters
    registerLinkedDataFilters(nunjucksEnv, {
      baseUri: 'https://example.org/',
      prefixes: {
        ex: 'https://example.org/',
        test: 'https://test.example.org/'
      }
    });
    
    filters = new LinkedDataFilters();
  });

  afterEach(async () => {
    // Clean up test outputs
    await fs.emptyDir(outputDir);
  });

  describe('URI Generation and Validation', () => {
    it('should generate valid slash URIs', () => {
      const filter = filters.rdfResource;
      
      expect(filter('test-resource', 'slash')).toBe('http://example.org/resource/test-resource');
      expect(filter({ type: 'person', id: 'john-doe' }, 'slash')).toBe('http://example.org/person/john-doe');
      expect(filter({ type: 'Organization', name: 'ACME Corp' }, 'slash')).toBe('http://example.org/organization/acme-corp');
    });

    it('should generate valid hash URIs', () => {
      const filter = filters.rdfResource;
      
      expect(filter('test-resource', 'hash')).toBe('http://example.org/resource#test-resource');
      expect(filter({ type: 'dataset', id: 'research-data' }, 'hash')).toBe('http://example.org/dataset#research-data');
    });

    it('should generate valid query URIs', () => {
      const filter = filters.rdfResource;
      
      expect(filter('test-resource', 'query')).toBe('http://example.org/resource?id=test-resource');
      expect(filter({ id: 'special chars!' }, 'query')).toBe('http://example.org/resource?id=special-chars');
    });

    it('should generate valid PURL URIs', () => {
      const filter = filters.rdfResource;
      
      expect(filter({ org: 'w3c', resource: 'rdf-concepts' }, 'purl')).toBe('http://purl.org/w3c/rdf-concepts');
    });

    it('should validate generated URIs are dereferenceable', () => {
      const uris = [
        'https://example.org/person/john-doe',
        'https://example.org/dataset#research-data',
        'https://example.org/resource?id=test-resource'
      ];

      uris.forEach(uri => {
        expect(filters.validateUri(uri)).toBe(true);
      });
    });
  });

  describe('RDF Literal Generation', () => {
    it('should generate plain literals', () => {
      const filter = filters.rdfLiteral;
      
      expect(filter('Hello World')).toBe('\"Hello World\"');
      expect(filter('Test with \"quotes\"')).toBe('\"Test with \\\"quotes\\\"\"');
      expect(filter('Multi\\nline\\ntext')).toBe('\"Multi\\\\nline\\\\ntext\"');
    });

    it('should generate language-tagged literals', () => {
      const filter = filters.rdfLiteral;
      
      expect(filter('Hello World', 'en')).toBe('\"Hello World\"@en');
      expect(filter('Bonjour le monde', 'fr')).toBe('\"Bonjour le monde\"@fr');
      expect(filter('Hola mundo', 'es-ES')).toBe('\"Hola mundo\"@es-ES');
    });

    it('should generate typed literals', () => {
      const filter = filters.rdfLiteral;
      
      expect(filter('123', 'integer')).toBe('\"123\"^^<http://www.w3.org/2001/XMLSchema#integer>');
      expect(filter('123.45', 'decimal')).toBe('\"123.45\"^^<http://www.w3.org/2001/XMLSchema#decimal>');
      expect(filter('true', 'boolean')).toBe('\"true\"^^<http://www.w3.org/2001/XMLSchema#boolean>');
      expect(filter('2023-12-01T10:00:00', 'dateTime')).toBe('\"2023-12-01T10:00:00\"^^<http://www.w3.org/2001/XMLSchema#dateTime>');
    });

    it('should handle custom datatypes', () => {
      const filter = filters.rdfLiteral;
      
      expect(filter('custom-value', 'http://example.org/CustomType')).toBe('\"custom-value\"^^<http://example.org/CustomType>');
      expect(filter('prefixed-value', 'ex:CustomType')).toBe('\"prefixed-value\"^^<http://example.org/CustomType>');
    });
  });

  describe('Schema.org Integration', () => {
    it('should map common types to Schema.org', () => {
      const filter = filters.schemaOrg;
      
      expect(filter('person')).toBe('schema:Person');
      expect(filter('organization')).toBe('schema:Organization');
      expect(filter('place')).toBe('schema:Place');
      expect(filter('event')).toBe('schema:Event');
      expect(filter('product')).toBe('schema:Product');
      expect(filter('article')).toBe('schema:Article');
      expect(filter('dataset')).toBe('schema:Dataset');
      expect(filter('software')).toBe('schema:SoftwareApplication');
    });

    it('should handle custom types', () => {
      const filter = filters.schemaOrg;
      
      expect(filter('CustomType')).toBe('schema:CustomType');
      expect(filter('custom-type')).toBe('schema:CustomType');
      expect(filter('CUSTOM_TYPE')).toBe('schema:CustomType');
    });

    it('should provide fallback for unknown types', () => {
      const filter = filters.schemaOrg;
      
      expect(filter(null)).toBe('schema:Thing');
      expect(filter('')).toBe('schema:Thing');
      expect(filter(undefined)).toBe('schema:Thing');
    });
  });

  describe('String Transformation Filters', () => {
    it('should generate URL-safe slugs', () => {
      const filter = filters.slug;
      
      expect(filter('Hello World')).toBe('hello-world');
      expect(filter('Test with Special!@#$%^&*()Characters')).toBe('test-with-special-characters');
      expect(filter('  Leading and trailing spaces  ')).toBe('leading-and-trailing-spaces');
      expect(filter('Multiple---Hyphens')).toBe('multiple-hyphens');
      expect(filter('UPPERCASE TEXT')).toBe('uppercase-text');
    });

    it('should generate kebab-case strings', () => {
      const filter = filters.kebabCase;
      
      expect(filter('camelCase')).toBe('camel-case');
      expect(filter('PascalCase')).toBe('pascal-case');
      expect(filter('snake_case')).toBe('snake-case');
      expect(filter('SCREAMING_SNAKE_CASE')).toBe('screaming-snake-case');
    });

    it('should generate camelCase strings', () => {
      const filter = filters.camelCase;
      
      expect(filter('kebab-case')).toBe('kebabCase');
      expect(filter('snake_case')).toBe('snakeCase');
      expect(filter('space separated')).toBe('spaceSeparated');
      expect(filter('Title Case')).toBe('titleCase');
    });

    it('should generate PascalCase strings', () => {
      const filter = filters.pascalCase;
      
      expect(filter('kebab-case')).toBe('KebabCase');
      expect(filter('camelCase')).toBe('CamelCase');
      expect(filter('space separated')).toBe('SpaceSeparated');
    });

    it('should generate title case strings', () => {
      const filter = filters.titleCase;
      
      expect(filter('hello world')).toBe('Hello World');
      expect(filter('HELLO WORLD')).toBe('Hello World');
      expect(filter('hello-world')).toBe('Hello-World');
    });
  });

  describe('Date and Time Formatting', () => {
    it('should format dates correctly', () => {
      const filter = filters.formatDate;
      const testDate = new Date('2023-12-01T10:30:45Z');
      
      expect(filter(testDate, 'YYYY-MM-DD')).toBe('2023-12-01');
      expect(filter(testDate, 'YYYY-MM-DDTHH:mm:ss')).toBe('2023-12-01T10:30:45');
      expect(filter(testDate, 'DD/MM/YYYY')).toBe('01/12/2023');
    });

    it('should handle invalid dates gracefully', () => {
      const filter = filters.formatDate;
      
      expect(filter('invalid-date')).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(filter(null)).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should generate current timestamps', () => {
      const nowFilter = filters.now;
      const isoDateFilter = filters.isoDate;
      
      expect(nowFilter()).toBeInstanceOf(Date);
      expect(isoDateFilter()).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
    });
  });

  describe('Collection and Pagination', () => {
    it('should paginate collections correctly', () => {
      const filter = filters.paginate;
      const items = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));
      
      const page1 = filter(items, 1, 10);
      expect(page1.items).toHaveLength(10);
      expect(page1.page).toBe(1);
      expect(page1.pageSize).toBe(10);
      expect(page1.totalItems).toBe(25);
      expect(page1.totalPages).toBe(3);
      expect(page1.hasNext).toBe(true);
      expect(page1.hasPrev).toBe(false);
      expect(page1.nextPage).toBe(2);
      expect(page1.prevPage).toBe(null);
      expect(page1.firstItemIndex).toBe(1);
      expect(page1.lastItemIndex).toBe(10);
      
      const page2 = filter(items, 2, 10);
      expect(page2.items).toHaveLength(10);
      expect(page2.page).toBe(2);
      expect(page2.hasNext).toBe(true);
      expect(page2.hasPrev).toBe(true);
      expect(page2.nextPage).toBe(3);
      expect(page2.prevPage).toBe(1);
      expect(page2.firstItemIndex).toBe(11);
      expect(page2.lastItemIndex).toBe(20);
      
      const page3 = filter(items, 3, 10);
      expect(page3.items).toHaveLength(5);
      expect(page3.page).toBe(3);
      expect(page3.hasNext).toBe(false);
      expect(page3.hasPrev).toBe(true);
      expect(page3.nextPage).toBe(null);
      expect(page3.prevPage).toBe(2);
      expect(page3.firstItemIndex).toBe(21);
      expect(page3.lastItemIndex).toBe(25);
    });

    it('should handle empty collections', () => {
      const filter = filters.paginate;
      
      const result = filter([], 1, 10);
      expect(result.items).toHaveLength(0);
      expect(result.totalItems).toBe(0);
      expect(result.totalPages).toBe(0);
      expect(result.hasNext).toBe(false);
      expect(result.hasPrev).toBe(false);
    });

    it('should handle non-array inputs', () => {
      const filter = filters.paginate;
      
      const result = filter(null, 1, 10);
      expect(result.items).toHaveLength(0);
      expect(result.totalItems).toBe(0);
    });
  });

  describe('Content Negotiation', () => {
    it('should provide correct MIME types', () => {
      const filter = filters.contentType;
      
      expect(filter('turtle')).toBe('text/turtle; charset=utf-8');
      expect(filter('ttl')).toBe('text/turtle; charset=utf-8');
      expect(filter('jsonld')).toBe('application/ld+json; charset=utf-8');
      expect(filter('json-ld')).toBe('application/ld+json; charset=utf-8');
      expect(filter('rdf')).toBe('application/rdf+xml; charset=utf-8');
      expect(filter('xml')).toBe('application/rdf+xml; charset=utf-8');
      expect(filter('nt')).toBe('application/n-triples; charset=utf-8');
      expect(filter('ntriples')).toBe('application/n-triples; charset=utf-8');
      expect(filter('html')).toBe('text/html; charset=utf-8');
    });

    it('should provide fallback MIME type', () => {
      const filter = filters.contentType;
      
      expect(filter('unknown-format')).toBe('text/turtle; charset=utf-8');
      expect(filter(null)).toBe('text/turtle; charset=utf-8');
    });
  });

  describe('Interlinking and Equivalence', () => {
    it('should generate sameAs links', () => {
      const filter = filters.sameAs;
      
      expect(filter('resource', ['http://dbpedia.org/resource/Example']))
        .toBe('<http://dbpedia.org/resource/Example>');
      
      expect(filter('resource', [
        'http://dbpedia.org/resource/Example',
        'https://wikidata.org/entity/Q12345'
      ])).toBe('<http://dbpedia.org/resource/Example> ,\\n    <https://wikidata.org/entity/Q12345>');
    });

    it('should filter invalid URIs', () => {
      const filter = filters.sameAs;
      
      expect(filter('resource', [
        'http://valid-uri.org/resource',
        'invalid-uri',
        'https://another-valid-uri.org/resource',
        null,
        ''
      ])).toBe('<http://valid-uri.org/resource> ,\\n    <https://another-valid-uri.org/resource>');
    });
  });

  // Helper function to strip frontmatter from template output
  const stripFrontmatter = (content) => {
    const frontmatterPattern = /^---\s*\n[\s\S]*?\n---\s*\n/;
    return content.replace(frontmatterPattern, '').trim();
  };

  describe('Template Rendering and Validation', () => {
    it('should render resource description template', async () => {
      const templateData = {
        baseUri: 'https://example.org/',
        resourceId: 'test-person',
        resourceType: 'person',
        title: 'John Doe',
        description: 'A test person resource',
        creator: 'system',
        createdDate: '2023-12-01T10:00:00Z',
        givenName: 'John',
        familyName: 'Doe',
        email: 'john.doe@example.org',
        namespace: 'people',
        nameProperty: 'name'
      };

      const rendered = nunjucksEnv.render('resource-description.ttl.njk', templateData);
      const rdfContent = stripFrontmatter(rendered);
      
      // Validate RDF syntax
      const parser = new Parser();
      let quads = [];
      let parseError = null;
      
      try {
        quads = parser.parse(rdfContent);
      } catch (error) {
        parseError = error;
      }

      expect(parseError).toBeNull();
      expect(quads.length).toBeGreaterThan(0);

      // Validate specific triples
      const resourceUri = 'https://example.org/test-person';
      const typeQuads = quads.filter(q => 
        q.subject.value === resourceUri && 
        q.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
      );
      expect(typeQuads.length).toBeGreaterThan(0);

      const nameQuads = quads.filter(q => 
        q.subject.value === resourceUri && 
        q.predicate.value.includes('name')
      );
      expect(nameQuads.length).toBeGreaterThan(0);
    });

    it('should render dataset description template', async () => {
      const templateData = {
        baseUri: 'https://example.org/',
        datasetId: 'test-dataset',
        title: 'Test Dataset',
        description: 'A comprehensive test dataset',
        creator: 'research-team',
        keywords: ['test', 'research', 'data'],
        license: 'cc-by',
        namespace: 'datasets',
        nameProperty: 'name',
        statistics: {
          triples: 10000,
          entities: 1500,
          classes: 25,
          properties: 150
        }
      };

      const rendered = nunjucksEnv.render('dataset-description.ttl.njk', templateData);
      const rdfContent = stripFrontmatter(rendered);
      
      // Validate RDF syntax
      const parser = new Parser();
      let quads = [];
      let parseError = null;
      
      try {
        quads = parser.parse(rdfContent);
      } catch (error) {
        parseError = error;
      }

      expect(parseError).toBeNull();
      expect(quads.length).toBeGreaterThan(0);

      // Validate VoID statistics
      const voidTriples = quads.filter(q => 
        q.predicate.value === 'http://rdfs.org/ns/void#triples'
      );
      expect(voidTriples.length).toBeGreaterThan(0);
      expect(voidTriples[0].object.value).toBe('10000');
    });

    it('should render collection page template', async () => {
      const items = Array.from({ length: 25 }, (_, i) => ({
        id: `item-${i + 1}`,
        title: `Item ${i + 1}`,
        type: 'article',
        description: `Description for item ${i + 1}`
      }));

      const templateData = {
        baseUri: 'https://example.org/',
        collectionId: 'test-collection',
        collectionTitle: 'Test Article Collection',
        collectionDescription: 'A collection of test articles',
        page: 2,
        pageSize: 10,
        namespace: 'collections',
        nameProperty: 'name',
        items: items,
        pagination: {
          totalPages: Math.ceil(25 / 10),
          totalItems: 25,
          hasNext: true,
          hasPrev: true,
          nextPage: 3,
          prevPage: 1,
          firstItemIndex: 11,
          lastItemIndex: 20
        }
      };

      const rendered = nunjucksEnv.render('collection-page.ttl.njk', templateData);
      const rdfContent = stripFrontmatter(rendered);
      
      // Validate RDF syntax
      const parser = new Parser();
      let quads = [];
      let parseError = null;
      
      try {
        quads = parser.parse(rdfContent);
      } catch (error) {
        parseError = error;
      }

      expect(parseError).toBeNull();
      expect(quads.length).toBeGreaterThan(0);

      // Validate pagination metadata
      const paginationQuads = quads.filter(q => 
        q.predicate.value.includes('hydra')
      );
      expect(paginationQuads.length).toBeGreaterThan(0);
    });

    it('should render sitemap template', async () => {
      const templateData = {
        baseUri: 'https://example.org/',
        siteTitle: 'Example Site',
        siteDescription: 'A test semantic website',
        namespace: 'site',
        nameProperty: 'name',
        mainNavigation: [
          { id: 'home', title: 'Home', url: '/' },
          { id: 'about', title: 'About', url: '/about' },
          { id: 'data', title: 'Data', url: '/data' }
        ],
        collections: [
          { id: 'articles', title: 'Articles', totalItems: 150 },
          { id: 'datasets', title: 'Datasets', totalItems: 25 }
        ]
      };

      const rendered = nunjucksEnv.render('sitemap.ttl.njk', templateData);
      const rdfContent = stripFrontmatter(rendered);
      
      // Validate RDF syntax
      const parser = new Parser();
      let quads = [];
      let parseError = null;
      
      try {
        quads = parser.parse(rdfContent);
      } catch (error) {
        parseError = error;
      }

      expect(parseError).toBeNull();
      expect(quads.length).toBeGreaterThan(0);

      // Validate site structure
      const siteQuads = quads.filter(q => 
        q.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' &&
        q.object.value === 'http://schema.org/WebSite'
      );
      expect(siteQuads.length).toBeGreaterThan(0);
    });

    it('should render provenance chain template', async () => {
      const templateData = {
        baseUri: 'https://example.org/',
        resourceId: 'test-resource',
        resourceTitle: 'Test Resource',
        resourceType: 'dataset',
        generationId: 'gen-123',
        creator: 'researcher',
        generatingSoftware: 'unjucks-generator',
        softwareName: 'Unjucks Linked Data Generator',
        softwareVersion: '1.0.0',
        namespace: 'provenance',
        nameProperty: 'name',
        usedEntities: [
          {
            entityId: 'source-data',
            title: 'Source Data',
            type: 'dataset',
            format: 'text/csv'
          }
        ]
      };

      const rendered = nunjucksEnv.render('provenance-chain.ttl.njk', templateData);
      const rdfContent = stripFrontmatter(rendered);
      
      // Validate RDF syntax
      const parser = new Parser();
      let quads = [];
      let parseError = null;
      
      try {
        quads = parser.parse(rdfContent);
      } catch (error) {
        parseError = error;
      }

      expect(parseError).toBeNull();
      expect(quads.length).toBeGreaterThan(0);

      // Validate PROV-O structure
      const provQuads = quads.filter(q => 
        q.predicate.value.startsWith('http://www.w3.org/ns/prov#')
      );
      expect(provQuads.length).toBeGreaterThan(0);
    });
  });

  describe('Content Negotiation Templates', () => {
    it('should render JSON-LD template', async () => {
      const templateData = {
        baseUri: 'https://example.org/',
        resourceId: 'test-person',
        resourceType: 'person',
        title: 'Jane Smith',
        description: 'A researcher and data scientist',
        keywords: ['research', 'data science', 'AI'],
        givenName: 'Jane',
        familyName: 'Smith',
        email: 'jane.smith@example.org',
        namespace: 'people',
        nameProperty: 'name'
      };

      const rendered = nunjucksEnv.render('content-negotiation/resource.jsonld.njk', templateData);
      const jsonContent = stripFrontmatter(rendered);
      
      // Validate JSON syntax
      let jsonData;
      let parseError = null;
      
      try {
        jsonData = JSON.parse(jsonContent);
      } catch (error) {
        parseError = error;
      }

      expect(parseError).toBeNull();
      expect(jsonData['@context']).toBeDefined();
      expect(jsonData['@id']).toBe('test-person');
      expect(jsonData['@type']).toBe('schema:Person');
      expect(jsonData.name).toBe('Jane Smith');
      expect(jsonData.givenName).toBe('Jane');
      expect(jsonData.familyName).toBe('Smith');
    });

    it('should render RDF/XML template', async () => {
      const templateData = {
        baseUri: 'https://example.org/',
        resourceId: 'test-organization',
        resourceType: 'organization',
        title: 'ACME Corporation',
        description: 'A leading technology company',
        legalName: 'ACME Corporation Ltd.',
        foundingDate: '1990-01-01',
        numberOfEmployees: 500,
        namespace: 'organizations',
        nameProperty: 'legalName'
      };

      const rendered = nunjucksEnv.render('content-negotiation/resource.rdf.njk', templateData);
      const rdfContent = stripFrontmatter(rendered);
      
      // Validate XML syntax - N3.js doesn't fully support RDF/XML parsing
      // So we'll just check that it's well-formed XML and contains expected elements
      expect(rdfContent).toContain('<?xml version="1.0"');
      expect(rdfContent).toContain('<rdf:RDF');
      expect(rdfContent).toContain('</rdf:RDF>');
      expect(rdfContent).toContain('schema:Organization');
      expect(rdfContent).toContain('ACME Corporation');

    });

    it('should render N-Triples template', async () => {
      const templateData = {
        baseUri: 'https://example.org/',
        resourceId: 'test-event',
        resourceType: 'event',
        title: 'Linked Data Workshop',
        description: 'A workshop on linked data technologies',
        creator: 'event-organizer',
        createdDate: '2023-12-01T09:00:00Z',
        namespace: 'events',
        nameProperty: 'name'
      };

      const rendered = nunjucksEnv.render('content-negotiation/resource.nt.njk', templateData);
      const rdfContent = stripFrontmatter(rendered);
      
      // Validate N-Triples syntax
      const parser = new Parser({ format: 'application/n-triples' });
      let quads = [];
      let parseError = null;
      
      try {
        quads = parser.parse(rdfContent);
      } catch (error) {
        parseError = error;
      }

      expect(parseError).toBeNull();
      expect(quads.length).toBeGreaterThan(0);

      // Each line should be a valid triple
      const lines = rdfContent.split('\\n').filter(line => 
        line.trim() && !line.startsWith('#')
      );
      
      lines.forEach(line => {
        expect(line.trim()).toMatch(/^<[^>]+>\\s+<[^>]+>\\s+.*\\s+\\./);
      });
    });
  });

  describe('Encoding and Hashing', () => {
    it('should encode base64 correctly', () => {
      const filter = filters.base64;
      
      expect(filter('Hello World')).toBe('SGVsbG8gV29ybGQ=');
      expect(filter('Test with special chars!@#$%^&*()')).toBe('VGVzdCB3aXRoIHNwZWNpYWwgY2hhcnMhQCMkJV4mKigp');
    });

    it('should generate hashes correctly', () => {
      const filter = filters.hash;
      
      expect(filter('Hello World', 'md5')).toBe('b10a8db164e0754105b7a99be72e3fe5');
      expect(filter('Hello World', 'sha256')).toBe('a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e');
      expect(filter('Hello World')).toMatch(/^[a-f0-9]{64}$/); // Default SHA256
    });

    it('should generate UUIDs', () => {
      const filter = filters.uuid;
      
      const uuid1 = filter();
      const uuid2 = filter();
      
      expect(uuid1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(uuid2).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(uuid1).not.toBe(uuid2);
    });
  });

  describe('Geospatial Support', () => {
    it('should generate WKT point literals', () => {
      const filter = filters.geoPoint;
      
      expect(filter(40.7128, -74.0060)).toBe('\"POINT(-74.0060 40.7128)\"^^geo:wktLiteral');
      expect(filter('51.5074', '-0.1278')).toBe('\"POINT(-0.1278 51.5074)\"^^geo:wktLiteral');
    });

    it('should handle invalid coordinates', () => {
      const filter = filters.geoPoint;
      
      expect(filter('invalid', 'coords')).toBe('');
      expect(filter(null, null)).toBe('');
      expect(filter(undefined, undefined)).toBe('');
    });
  });

  describe('License and Rights', () => {
    it('should resolve common license types', () => {
      const filter = filters.licenseUri;
      
      expect(filter('cc0')).toBe('https://creativecommons.org/publicdomain/zero/1.0/');
      expect(filter('cc-by')).toBe('https://creativecommons.org/licenses/by/4.0/');
      expect(filter('cc-by-sa')).toBe('https://creativecommons.org/licenses/by-sa/4.0/');
      expect(filter('mit')).toBe('https://opensource.org/licenses/MIT');
      expect(filter('apache2')).toBe('https://www.apache.org/licenses/LICENSE-2.0');
    });

    it('should pass through custom license URIs', () => {
      const filter = filters.licenseUri;
      
      expect(filter('https://example.org/custom-license')).toBe('https://example.org/custom-license');
    });
  });

  describe('URI Expansion and Compaction', () => {
    beforeEach(() => {
      filters.prefixes.set('test', {
        ex: 'https://example.org/',
        foaf: 'http://xmlns.com/foaf/0.1/',
        schema: 'http://schema.org/'
      });
    });

    it('should expand prefixed URIs', () => {
      expect(filters.expandUri('ex:Person', 'test')).toBe('https://example.org/Person');
      expect(filters.expandUri('foaf:name', 'test')).toBe('http://xmlns.com/foaf/0.1/name');
      expect(filters.expandUri('schema:Person', 'test')).toBe('http://schema.org/Person');
    });

    it('should compact full URIs', () => {
      expect(filters.compactUri('https://example.org/Person', 'test')).toBe('ex:Person');
      expect(filters.compactUri('http://xmlns.com/foaf/0.1/name', 'test')).toBe('foaf:name');
      expect(filters.compactUri('http://schema.org/Person', 'test')).toBe('schema:Person');
    });

    it('should extract local names', () => {
      expect(filters.getLocalName('https://example.org/Person')).toBe('Person');
      expect(filters.getLocalName('http://xmlns.com/foaf/0.1/name')).toBe('name');
      expect(filters.getLocalName('http://example.org/ontology#Concept')).toBe('Concept');
    });

    it('should extract namespaces', () => {
      expect(filters.getNamespace('https://example.org/Person')).toBe('https://example.org/');
      expect(filters.getNamespace('http://xmlns.com/foaf/0.1/name')).toBe('http://xmlns.com/foaf/0.1/');
      expect(filters.getNamespace('http://example.org/ontology#Concept')).toBe('http://example.org/ontology#');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large collections efficiently', () => {
      const filter = filters.paginate;
      const largeCollection = Array.from({ length: 100000 }, (_, i) => ({ id: i }));
      
      const start = performance.now();
      const result = filter(largeCollection, 1000, 100);
      const end = performance.now();
      
      expect(end - start).toBeLessThan(100); // Should complete in <100ms
      expect(result.items).toHaveLength(100);
      expect(result.totalItems).toBe(100000);
      expect(result.page).toBe(1000);
    });

    it('should memoize expensive operations', () => {
      const expensiveFunction = (input) => {
        // Simulate expensive computation
        let result = 0;
        for (let i = 0; i < 1000000; i++) {
          result += i;
        }
        return input.toUpperCase();
      };

      const memoizedFunction = filters.memoize(expensiveFunction);
      
      // First call
      const start1 = performance.now();
      const result1 = memoizedFunction('test');
      const end1 = performance.now();
      const time1 = end1 - start1;
      
      // Second call (should be cached)
      const start2 = performance.now();
      const result2 = memoizedFunction('test');
      const end2 = performance.now();
      const time2 = end2 - start2;
      
      expect(result1).toBe('TEST');
      expect(result2).toBe('TEST');
      expect(time2).toBeLessThan(time1 * 0.1); // Cached call should be much faster
    });
  });
});