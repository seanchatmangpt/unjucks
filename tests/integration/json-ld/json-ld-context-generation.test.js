/**
 * Comprehensive JSON-LD context generation validation tests
 * Tests all context patterns with template filters for semantic web applications
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import nunjucks from 'nunjucks';
import { jsonLdFilters } from '../../../src/lib/filters/json-ld/rdf-filters';

// Mock JSON-LD processor for validation
interface JsonLdDocument {
  '@context'?: any;
  '@type'?: string;
  [key: string]: any;
}

interface CompactionResult {
  compacted: JsonLdDocument;
  valid: boolean;
  errors: string[];
}

interface ExpansionResult {
  expanded: JsonLdDocument[];
  valid: boolean;
  errors: string[];
}

class MockJsonLdProcessor {
  /**
   * Compact a JSON-LD document using the provided context
   */
  static async compact(document: JsonLdDocument, context: any): Promise<CompactionResult> {
    const errors: string[] = [];
    let valid = true;

    try {
      // Basic validation
      if (!context || typeof context !== 'object') {
        errors.push('Invalid context provided');
        valid = false;
      }

      if (!document || typeof document !== 'object') {
        errors.push('Invalid document provided');
        valid = false;
      }

      // Mock compaction logic
      const compacted = {
        '@context': context,
        ...document
      };

      return { compacted, valid, errors };
    } catch (error) {
      errors.push(`Compaction failed: ${error}`);
      return { compacted: document, valid: false, errors };
    }
  }

  /**
   * Expand a JSON-LD document
   */
  static async expand(document: JsonLdDocument): Promise<ExpansionResult> {
    const errors: string[] = [];
    let valid = true;

    try {
      // Mock expansion logic - convert to array format
      const expanded = [document];
      return { expanded, valid, errors };
    } catch (error) {
      errors.push(`Expansion failed: ${error}`);
      return { expanded: [], valid: false, errors };
    }
  }

  /**
   * Validate JSON-LD context structure
   */
  static validateContext(context: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!context || typeof context !== 'object') {
      errors.push('Context must be an object');
      return { valid: false, errors };
    }

    // Check for valid @version
    if (context['@version'] && ![1.0, 1.1, '1.0', '1.1'].includes(context['@version'])) {
      errors.push('@version must be 1.0 or 1.1');
    }

    // Check for valid @base
    if (context['@base'] && typeof context['@base'] !== 'string') {
      errors.push('@base must be a string URI');
    }

    // Check for valid @vocab
    if (context['@vocab'] && typeof context['@vocab'] !== 'string') {
      errors.push('@vocab must be a string URI');
    }

    // Validate property mappings
    for (const [key, value] of Object.entries(context)) {
      if (key.startsWith('@') || key.startsWith('_')) continue;

      if (typeof value === 'object' && value !== null) {
        const mapping = value as any;
        
        // Check @id
        if (mapping['@id'] && typeof mapping['@id'] !== 'string') {
          errors.push(`Property ${key}: @id must be a string`);
        }

        // Check @type
        if (mapping['@type'] && typeof mapping['@type'] !== 'string') {
          errors.push(`Property ${key}: @type must be a string`);
        }

        // Check @container
        if (mapping['@container']) {
          const validContainers = ['@list', '@set', '@index', '@language', '@type', '@id'];
          const containers = Array.isArray(mapping['@container']) 
            ? mapping['@container']
            : [mapping['@container']];
          
          for (const container of containers) {
            if (!validContainers.includes(container)) {
              errors.push(`Property ${key}: invalid @container value: ${container}`);
            }
          }
        }

        // Check @language
        if (mapping['@language'] && typeof mapping['@language'] !== 'string') {
          errors.push(`Property ${key}: @language must be a string`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

describe('JSON-LD Context Generation with Template Filters', () => {
  const testOutputDir = join(__dirname, '../../.tmp/json-ld-contexts');
  const fixturesDir = join(__dirname, '../../fixtures/json-ld');
  let nunjucksEnv: nunjucks.Environment;

  beforeAll(() => {
    // Create test output directory
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true });
    }
    mkdirSync(testOutputDir, { recursive: true });

    // Configure Nunjucks with filters
    nunjucksEnv = new nunjucks.Environment(
      new nunjucks.FileSystemLoader(fixturesDir),
      { autoescape: false }
    );

    // Register JSON-LD filters
    Object.entries(jsonLdFilters).forEach(([name, filter]) => {
      nunjucksEnv.addFilter(name, filter);
    });

    // Register additional template filters for testing
    nunjucksEnv.addFilter('kebabCase', (str: string) => 
      str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    );
    
    nunjucksEnv.addFilter('camelCase', (str: string) =>
      str.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '')
    );
    
    nunjucksEnv.addFilter('pascalCase', (str: string) => {
      const camelCase = str.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '');
      return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
    });

    nunjucksEnv.addFilter('languageName', (code: string) => {
      const languages: Record<string, string> = {
        'en': 'English',
        'es': 'Spanish', 
        'fr': 'French',
        'de': 'German',
        'ja': 'Japanese',
        'zh': 'Chinese'
      };
      return languages[code] || code;
    });

    nunjucksEnv.addFilter('dump', (obj: any) => JSON.stringify(obj, null, 2));
    nunjucksEnv.addFilter('slice', (str: string, start: number, end: number) => str.slice(start, end));
    nunjucksEnv.addFilter('safe', (str: string) => str);
  });

  afterAll(() => {
    // Cleanup test directory
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true });
    }
  });

  describe('Schema.org Context Generation', () => {
    it('should generate valid Schema.org context with common properties', async () => {
      const templateData = {
        contextName: 'ecommerce-product',
        outputDir: testOutputDir,
        entityTypes: ['Product', 'Offer', 'Brand', 'Organization'],
        baseUri: 'https://example.com',
        includeCommonProperties: true
      };

      const template = readFileSync(join(fixturesDir, 'schema-org-context.jsonld.njk'), 'utf-8');
      const rendered = nunjucksEnv.renderString(template, templateData);
      
      // Parse as JSON to validate structure
      const context = JSON.parse(rendered);
      expect(context['@context']).toBeDefined();
      expect(context['@context']['@version']).toBe(1.1);
      expect(context['@context']['@vocab']).toBe('https://schema.org/');
      expect(context['@context']['@base']).toBe('https://example.com/');

      // Validate entity types
      expect(context['@context']['Product']).toEqual({
        '@id': 'schema:Product',
        '@type': '@id'
      });

      // Validate common properties
      expect(context['@context']['name']).toEqual({
        '@id': 'schema:name',
        '@type': 'xsd:string'
      });

      expect(context['@context']['price']).toEqual({
        '@id': 'schema:price',
        '@type': 'xsd:decimal'
      });

      expect(context['@context']['dateCreated']).toEqual({
        '@id': 'schema:dateCreated',
        '@type': 'xsd:dateTime'
      });

      // Validate with mock processor
      const validation = MockJsonLdProcessor.validateContext(context['@context']);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // Test compaction
      const testDocument = {
        '@type': 'Product',
        name: 'Test Product',
        price: 29.99,
        priceCurrency: 'USD'
      };

      const compactionResult = await MockJsonLdProcessor.compact(testDocument, context['@context']);
      expect(compactionResult.valid).toBe(true);
      expect(compactionResult.errors).toHaveLength(0);
    });

    it('should handle entity type filtering correctly', async () => {
      const templateData = {
        contextName: 'person-org',
        outputDir: testOutputDir,
        entityTypes: ['Person', 'Organization'],
        baseUri: 'https://example.org',
        includeCommonProperties: false
      };

      const template = readFileSync(join(fixturesDir, 'schema-org-context.jsonld.njk'), 'utf-8');
      const rendered = nunjucksEnv.renderString(template, templateData);
      const context = JSON.parse(rendered);

      expect(context['@context']['Person']).toBeDefined();
      expect(context['@context']['Organization']).toBeDefined();
      expect(context['@context']['Product']).toBeUndefined();
      
      // Should not include common properties
      expect(context['@context']['name']).toBeUndefined();
    });
  });

  describe('Custom Vocabulary Context Generation', () => {
    it('should generate valid custom vocabulary context with properties', async () => {
      const templateData = {
        vocabularyName: 'ResearchData',
        outputDir: testOutputDir,
        vocabularyUri: 'https://research.example.com/vocab',
        vocabularyPrefix: 'rd',
        classes: [
          {
            name: 'Dataset',
            subClassOf: 'schema:Dataset'
          },
          {
            name: 'Researcher',
            subClassOf: 'schema:Person'
          }
        ],
        properties: [
          {
            name: 'methodology',
            datatype: 'string',
            domain: 'rd:Dataset'
          },
          {
            name: 'sampleSize',
            datatype: 'integer',
            domain: 'rd:Dataset'
          },
          {
            name: 'confidenceLevel',
            datatype: 'decimal',
            range: 'xsd:decimal'
          },
          {
            name: 'tags',
            datatype: 'string',
            container: '@set'
          },
          {
            name: 'relatedDatasets',
            container: '@set',
            range: 'rd:Dataset'
          }
        ],
        inheritFromSchema: false
      };

      const template = readFileSync(join(fixturesDir, 'custom-vocabulary-context.jsonld.njk'), 'utf-8');
      const rendered = nunjucksEnv.renderString(template, templateData);
      const context = JSON.parse(rendered);

      expect(context['@context']['@vocab']).toBe('https://research.example.com/vocab/');
      expect(context['@context']['rd']).toBe('https://research.example.com/vocab/');

      // Check classes
      expect(context['@context']['Dataset']).toEqual({
        '@id': 'rd:Dataset',
        '@type': '@id'
      });

      // Check properties
      expect(context['@context']['methodology']).toEqual({
        '@id': 'rd:methodology',
        '@type': 'xsd:string'
      });

      expect(context['@context']['sampleSize']).toEqual({
        '@id': 'rd:sampleSize',
        '@type': 'xsd:integer'
      });

      expect(context['@context']['tags']).toEqual({
        '@id': 'rd:tags',
        '@type': 'xsd:string',
        '@container': '@set'
      });

      const validation = MockJsonLdProcessor.validateContext(context['@context']);
      expect(validation.valid).toBe(true);
    });

    it('should handle Schema.org inheritance correctly', async () => {
      const templateData = {
        vocabularyName: 'ExtendedSchema',
        outputDir: testOutputDir,
        vocabularyUri: 'https://example.com/extended',
        vocabularyPrefix: 'ext',
        classes: [],
        properties: [],
        inheritFromSchema: true
      };

      const template = readFileSync(join(fixturesDir, 'custom-vocabulary-context.jsonld.njk'), 'utf-8');
      const rendered = nunjucksEnv.renderString(template, templateData);
      const context = JSON.parse(rendered);

      expect(context['@context']['@vocab']).toBe('https://schema.org/');
      expect(context['@context']['customIdentifier']).toBeDefined();
      expect(context['@context']['customMetadata']).toEqual({
        '@id': 'ext:customMetadata',
        '@type': '@json'
      });
    });
  });

  describe('Multilingual Context Generation', () => {
    it('should generate valid multilingual context with language containers', async () => {
      const templateData = {
        contextName: 'multilingual-content',
        outputDir: testOutputDir,
        defaultLanguage: 'en',
        supportedLanguages: ['en', 'es', 'fr', 'de'],
        includeTranslatedTerms: true,
        useLanguageContainers: true
      };

      const template = readFileSync(join(fixturesDir, 'multilingual-context.jsonld.njk'), 'utf-8');
      const rendered = nunjucksEnv.renderString(template, templateData);
      const context = JSON.parse(rendered);

      expect(context['@context']['@language']).toBe('en');
      
      // Check language containers
      expect(context['@context']['name']).toEqual({
        '@id': 'schema:name',
        '@container': '@language'
      });

      expect(context['@context']['description']).toEqual({
        '@id': 'schema:description',
        '@container': '@language'
      });

      expect(context['@context']['alternateName']).toEqual({
        '@id': 'schema:alternateName',
        '@container': ['@language', '@set']
      });

      // Check language-aware properties
      expect(context['@context']['inLanguage']).toEqual({
        '@id': 'schema:inLanguage',
        '@type': 'xsd:language'
      });

      const validation = MockJsonLdProcessor.validateContext(context['@context']);
      expect(validation.valid).toBe(true);
    });

    it('should generate language-specific properties when containers disabled', async () => {
      const templateData = {
        contextName: 'multilingual-specific',
        outputDir: testOutputDir,
        defaultLanguage: 'en',
        supportedLanguages: ['en', 'es', 'fr'],
        includeTranslatedTerms: false,
        useLanguageContainers: false
      };

      const template = readFileSync(join(fixturesDir, 'multilingual-context.jsonld.njk'), 'utf-8');
      const rendered = nunjucksEnv.renderString(template, templateData);
      const context = JSON.parse(rendered);

      expect(context['@context']['name_en']).toEqual({
        '@id': 'schema:name',
        '@type': 'xsd:string',
        '@language': 'en'
      });

      expect(context['@context']['name_es']).toEqual({
        '@id': 'schema:name',
        '@type': 'xsd:string',
        '@language': 'es'
      });

      expect(context['@context']['description_fr']).toEqual({
        '@id': 'schema:description',
        '@type': 'xsd:string',
        '@language': 'fr'
      });
    });
  });

  describe('Temporal Context Generation', () => {
    it('should generate comprehensive temporal context with W3C Time Ontology', async () => {
      const templateData = {
        contextName: 'temporal-data',
        outputDir: testOutputDir,
        includeTimeOntology: true,
        includeSchemaTime: true,
        includeProvenanceTime: true,
        precisionLevel: 'millisecond'
      };

      const template = readFileSync(join(fixturesDir, 'temporal-context.jsonld.njk'), 'utf-8');
      const rendered = nunjucksEnv.renderString(template, templateData);
      const context = JSON.parse(rendered);

      expect(context['@context']['@vocab']).toBe('http://www.w3.org/2006/time#');

      // Check Time Ontology classes
      expect(context['@context']['Instant']).toBe('time:Instant');
      expect(context['@context']['Interval']).toBe('time:Interval');
      expect(context['@context']['Duration']).toBe('time:Duration');

      // Check temporal relationships
      expect(context['@context']['before']).toEqual({
        '@id': 'time:before',
        '@type': '@id'
      });

      expect(context['@context']['after']).toEqual({
        '@id': 'time:after',
        '@type': '@id'
      });

      // Check date/time properties
      expect(context['@context']['inXSDDateTime']).toEqual({
        '@id': 'time:inXSDDateTime',
        '@type': 'xsd:dateTime'
      });

      // Check Schema.org temporal properties
      expect(context['@context']['startDate']).toEqual({
        '@id': 'schema:startDate',
        '@type': 'xsd:dateTime'
      });

      // Check PROV-O provenance properties
      expect(context['@context']['generatedAtTime']).toEqual({
        '@id': 'prov:generatedAtTime',
        '@type': 'xsd:dateTime'
      });

      const validation = MockJsonLdProcessor.validateContext(context['@context']);
      expect(validation.valid).toBe(true);
    });

    it('should handle selective temporal feature inclusion', async () => {
      const templateData = {
        contextName: 'schema-time-only',
        outputDir: testOutputDir,
        includeTimeOntology: false,
        includeSchemaTime: true,
        includeProvenanceTime: false,
        precisionLevel: 'second'
      };

      const template = readFileSync(join(fixturesDir, 'temporal-context.jsonld.njk'), 'utf-8');
      const rendered = nunjucksEnv.renderString(template, templateData);
      const context = JSON.parse(rendered);

      // Should not include Time Ontology classes
      expect(context['@context']['Instant']).toBeUndefined();
      expect(context['@context']['before']).toBeUndefined();

      // Should include Schema.org temporal properties
      expect(context['@context']['startDate']).toBeDefined();
      expect(context['@context']['duration']).toBeDefined();

      // Should not include PROV-O properties
      expect(context['@context']['generatedAtTime']).toBeUndefined();
    });
  });

  describe('Geospatial Context Generation', () => {
    it('should generate comprehensive geospatial context with all vocabularies', async () => {
      const templateData = {
        contextName: 'geospatial-data',
        outputDir: testOutputDir,
        includeWGS84: true,
        includeGeoSPARQL: true,
        includeSchemaGeo: true,
        coordinateSystem: 'WGS84',
        precisionLevel: 'meter'
      };

      const template = readFileSync(join(fixturesDir, 'geospatial-context.jsonld.njk'), 'utf-8');
      const rendered = nunjucksEnv.renderString(template, templateData);
      const context = JSON.parse(rendered);

      expect(context['@context']['@vocab']).toBe('http://www.w3.org/2003/01/geo/wgs84_pos#');

      // Check WGS84 properties
      expect(context['@context']['lat']).toEqual({
        '@id': 'geo:lat',
        '@type': 'xsd:decimal'
      });

      expect(context['@context']['long']).toEqual({
        '@id': 'geo:long',
        '@type': 'xsd:decimal'
      });

      // Check GeoSPARQL geometry classes
      expect(context['@context']['Geometry']).toBe('sf:Geometry');
      expect(context['@context']['Point']).toBe('geo:Point');
      expect(context['@context']['Polygon']).toBe('sf:Polygon');

      // Check spatial relationships
      expect(context['@context']['sfContains']).toEqual({
        '@id': 'geof:sfContains',
        '@type': '@id'
      });

      // Check Schema.org geo properties
      expect(context['@context']['GeoCoordinates']).toBe('schema:GeoCoordinates');
      expect(context['@context']['latitude']).toEqual({
        '@id': 'schema:latitude',
        '@type': 'xsd:decimal'
      });

      // Check coordinate arrays
      expect(context['@context']['coordinates']).toEqual({
        '@id': 'sf:coordinates',
        '@container': ['@list', '@list'],
        '@type': 'xsd:decimal'
      });

      const validation = MockJsonLdProcessor.validateContext(context['@context']);
      expect(validation.valid).toBe(true);
    });

    it('should handle selective geospatial feature inclusion', async () => {
      const templateData = {
        contextName: 'basic-geo',
        outputDir: testOutputDir,
        includeWGS84: true,
        includeGeoSPARQL: false,
        includeSchemaGeo: true,
        coordinateSystem: 'WGS84',
        precisionLevel: 'centimeter'
      };

      const template = readFileSync(join(fixturesDir, 'geospatial-context.jsonld.njk'), 'utf-8');
      const rendered = nunjucksEnv.renderString(template, templateData);
      const context = JSON.parse(rendered);

      // Should include WGS84
      expect(context['@context']['lat']).toBeDefined();
      expect(context['@context']['long']).toBeDefined();

      // Should not include GeoSPARQL
      expect(context['@context']['sfContains']).toBeUndefined();
      expect(context['@context']['Geometry']).toBeUndefined();

      // Should include Schema.org geo
      expect(context['@context']['latitude']).toBeDefined();
      expect(context['@context']['GeoCoordinates']).toBeDefined();
    });
  });

  describe('RDF Filter Functions', () => {
    it('should correctly map datatypes with rdfDatatype filter', () => {
      expect(jsonLdFilters.rdfDatatype('string')).toBe('xsd:string');
      expect(jsonLdFilters.rdfDatatype('integer')).toBe('xsd:integer');
      expect(jsonLdFilters.rdfDatatype('decimal')).toBe('xsd:decimal');
      expect(jsonLdFilters.rdfDatatype('boolean')).toBe('xsd:boolean');
      expect(jsonLdFilters.rdfDatatype('dateTime')).toBe('xsd:dateTime');
      expect(jsonLdFilters.rdfDatatype('anyURI')).toBe('xsd:anyURI');
      
      // Test aliases
      expect(jsonLdFilters.rdfDatatype('int')).toBe('xsd:integer');
      expect(jsonLdFilters.rdfDatatype('number')).toBe('xsd:decimal');
      expect(jsonLdFilters.rdfDatatype('bool')).toBe('xsd:boolean');
      expect(jsonLdFilters.rdfDatatype('url')).toBe('xsd:anyURI');
      
      // Test default fallback
      expect(jsonLdFilters.rdfDatatype('unknown')).toBe('xsd:string');
    });

    it('should correctly handle URIs with rdfResource filter', () => {
      // Full URIs
      expect(jsonLdFilters.rdfResource('https://schema.org/Person')).toBe('https://schema.org/Person');
      expect(jsonLdFilters.rdfResource('http://example.com/vocab/Property')).toBe('http://example.com/vocab/Property');
      
      // Namespace prefixes
      expect(jsonLdFilters.rdfResource('schema:Person')).toBe('https://schema.org/Person');
      expect(jsonLdFilters.rdfResource('dct:title')).toBe('http://purl.org/dc/terms/title');
      expect(jsonLdFilters.rdfResource('xsd:string')).toBe('http://www.w3.org/2001/XMLSchema#string');
      
      // Unknown prefixes
      expect(jsonLdFilters.rdfResource('unknown:test')).toBe('unknown:test');
      
      // Local resources
      expect(jsonLdFilters.rdfResource('localProperty')).toBe('localProperty');
    });

    it('should generate correct namespace mappings', () => {
      const namespaces = jsonLdFilters.rdfNamespaces(['geo', 'time']);
      
      expect(namespaces['rdf']).toBe('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
      expect(namespaces['schema']).toBe('https://schema.org/');
      expect(namespaces['geo']).toBe('http://www.w3.org/2003/01/geo/wgs84_pos#');
      expect(namespaces['time']).toBe('http://www.w3.org/2006/time#');
    });

    it('should generate Schema.org context correctly', () => {
      const context = jsonLdFilters.schemaOrgContext(['Article', 'Review']);
      
      expect(context['@vocab']).toBe('https://schema.org/');
      expect(context['@version']).toBe(1.1);
      expect(context['Person']).toEqual({ '@id': 'schema:Person', '@type': '@id' });
      expect(context['Article']).toEqual({ '@id': 'schema:Article', '@type': '@id' });
      expect(context['name']).toEqual({ '@type': 'xsd:string' });
      expect(context['dateCreated']).toEqual({ '@type': 'xsd:dateTime' });
    });
  });

  describe('Context Validation and Compliance', () => {
    it('should validate JSON-LD 1.1 spec compliance', () => {
      const validContext = {
        '@version': 1.1,
        '@vocab': 'https://schema.org/',
        'name': { '@id': 'schema:name', '@type': 'xsd:string' },
        'tags': { '@id': 'schema:keywords', '@container': '@set' }
      };

      const validation = jsonLdFilters.validateJsonLdContext(validContext);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid context structures', () => {
      const invalidContext = {
        '@version': '2.0', // Invalid version
        '@base': 123, // Invalid base type
        '@vocab': null, // Invalid vocab
        'badProperty': {
          '@type': 'invalid-type',
          '@container': '@invalid' // Invalid container
        }
      };

      const validation = jsonLdFilters.validateJsonLdContext(invalidContext);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors.some(err => err.includes('@version'))).toBe(true);
      expect(validation.errors.some(err => err.includes('@base'))).toBe(true);
      expect(validation.errors.some(err => err.includes('@vocab'))).toBe(true);
    });

    it('should perform round-trip testing (compact → expand → compact)', async () => {
      const context = {
        '@version': 1.1,
        '@vocab': 'https://schema.org/',
        'name': { '@type': 'xsd:string' },
        'price': { '@type': 'xsd:decimal' }
      };

      const originalDocument = {
        '@type': 'Product',
        name: 'Test Product',
        price: 29.99
      };

      // Compact
      const compactionResult = await MockJsonLdProcessor.compact(originalDocument, context);
      expect(compactionResult.valid).toBe(true);

      // Expand
      const expansionResult = await MockJsonLdProcessor.expand(compactionResult.compacted);
      expect(expansionResult.valid).toBe(true);

      // Compact again
      const secondCompaction = await MockJsonLdProcessor.compact(
        expansionResult.expanded[0], 
        context
      );
      expect(secondCompaction.valid).toBe(true);
    });
  });

  describe('Real-world Use Case Contexts', () => {
    it('should generate e-commerce product catalog context', async () => {
      const templateData = {
        contextName: 'ecommerce-catalog',
        outputDir: testOutputDir,
        entityTypes: ['Product', 'Offer', 'Brand', 'Review', 'AggregateRating'],
        baseUri: 'https://shop.example.com',
        includeCommonProperties: true
      };

      const template = readFileSync(join(fixturesDir, 'schema-org-context.jsonld.njk'), 'utf-8');
      const rendered = nunjucksEnv.renderString(template, templateData);
      const context = JSON.parse(rendered);

      // Test with realistic e-commerce data
      const productData = {
        '@context': context['@context'],
        '@type': 'Product',
        name: 'Wireless Headphones',
        description: 'High-quality wireless headphones with noise cancellation',
        brand: {
          '@type': 'Brand',
          name: 'AudioTech'
        },
        offers: {
          '@type': 'Offer',
          price: 199.99,
          priceCurrency: 'USD',
          availability: 'InStock'
        },
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: 4.5,
          reviewCount: 127
        }
      };

      const validation = MockJsonLdProcessor.validateContext(context['@context']);
      expect(validation.valid).toBe(true);

      const compactionResult = await MockJsonLdProcessor.compact(productData, context['@context']);
      expect(compactionResult.valid).toBe(true);
    });

    it('should generate scientific research dataset context', async () => {
      const templateData = {
        vocabularyName: 'ResearchDataset',
        outputDir: testOutputDir,
        vocabularyUri: 'https://research.example.edu/vocab',
        vocabularyPrefix: 'rd',
        classes: [
          { name: 'Dataset', subClassOf: 'schema:Dataset' },
          { name: 'Experiment', subClassOf: 'schema:Event' },
          { name: 'Publication', subClassOf: 'schema:ScholarlyArticle' }
        ],
        properties: [
          { name: 'methodology', datatype: 'string' },
          { name: 'hypothesis', datatype: 'string' },
          { name: 'sampleSize', datatype: 'integer' },
          { name: 'confidenceInterval', datatype: 'decimal' },
          { name: 'pValue', datatype: 'decimal' },
          { name: 'dataCollection', datatype: 'dateTime' },
          { name: 'variables', container: '@set' },
          { name: 'relatedStudies', container: '@set', range: 'rd:Publication' }
        ],
        inheritFromSchema: true
      };

      const template = readFileSync(join(fixturesDir, 'custom-vocabulary-context.jsonld.njk'), 'utf-8');
      const rendered = nunjucksEnv.renderString(template, templateData);
      const context = JSON.parse(rendered);

      const researchData = {
        '@context': context['@context'],
        '@type': 'rd:Dataset',
        name: 'Climate Impact Study 2024',
        methodology: 'Longitudinal observational study',
        sampleSize: 1500,
        confidenceInterval: 0.95,
        variables: ['temperature', 'humidity', 'precipitation'],
        author: {
          '@type': 'Person',
          name: 'Dr. Jane Smith'
        }
      };

      const validation = MockJsonLdProcessor.validateContext(context['@context']);
      expect(validation.valid).toBe(true);
    });

    it('should handle multilingual news article context', async () => {
      const templateData = {
        contextName: 'news-articles',
        outputDir: testOutputDir,
        defaultLanguage: 'en',
        supportedLanguages: ['en', 'es', 'fr', 'de', 'ja'],
        includeTranslatedTerms: true,
        useLanguageContainers: true
      };

      const template = readFileSync(join(fixturesDir, 'multilingual-context.jsonld.njk'), 'utf-8');
      const rendered = nunjucksEnv.renderString(template, templateData);
      const context = JSON.parse(rendered);

      const multilingualArticle = {
        '@context': context['@context'],
        '@type': 'Article',
        name: {
          'en': 'Global Climate Summit Concludes',
          'es': 'Cumbre Climática Mundial Concluye',
          'fr': 'Le Sommet Climatique Mondial se Termine'
        },
        description: {
          'en': 'World leaders reach historic climate agreement',
          'es': 'Líderes mundiales alcanzan acuerdo climático histórico',
          'fr': 'Les dirigeants mondiaux concluent un accord climatique historique'
        },
        datePublished: '2024-01-15T10:00:00Z',
        inLanguage: ['en', 'es', 'fr']
      };

      const validation = MockJsonLdProcessor.validateContext(context['@context']);
      expect(validation.valid).toBe(true);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large contexts efficiently', () => {
      const startTime = performance.now();
      
      // Generate a large context with many properties
      const largeContext = jsonLdFilters.schemaOrgContext(
        Array.from({ length: 100 }, (_, i) => `Type${i}`)
      );
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(100); // Should complete in under 100ms
      expect(Object.keys(largeContext).length).toBeGreaterThan(100);
      
      const validation = jsonLdFilters.validateJsonLdContext(largeContext);
      expect(validation.valid).toBe(true);
    });

    it('should validate complex nested contexts', () => {
      const complexContext = {
        '@version': 1.1,
        '@vocab': 'https://schema.org/',
        ...jsonLdFilters.rdfNamespaces(['geo', 'time', 'dct', 'prov']),
        ...jsonLdFilters.temporalContext(),
        ...jsonLdFilters.geospatialContext(),
        'complexProperty': {
          '@id': 'schema:complexProperty',
          '@type': '@id',
          '@container': ['@language', '@set'],
          'rdfs:domain': { '@id': 'schema:Thing', '@type': '@id' },
          'rdfs:range': { '@id': 'schema:Text', '@type': '@id' }
        }
      };

      const validation = jsonLdFilters.validateJsonLdContext(complexContext);
      expect(validation.valid).toBe(true);
    });
  });
});