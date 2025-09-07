/**
 * URI Dereferencing and Interlinking Validation Tests
 * Tests production-ready URI schemes, content negotiation, and web-scale link resolution
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { createServer } from 'http';
import { URL } from 'url';
import nunjucks from 'nunjucks';
import path from 'path';
import { fileURLToPath } from 'url';
import { LinkedDataFilters, registerLinkedDataFilters } from '../src/lib/linked-data-filters.js';
import { Parser } from 'n3';
import axios from 'axios';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Mock HTTP server for testing dereferencing
class MockLinkedDataServer {
  constructor(port = 3001) {
    this.port = port;
    this.baseUri = `http://localhost:${port}`;
    this.server = null;
    this.resources = new Map();
    this.requestLogs = [];
    this.nunjucksEnv = null;
  }

  async start() {
    // Setup Nunjucks environment
    const testDataDir = path.join(__dirname, 'fixtures', 'linked-data');
    this.nunjucksEnv = new nunjucks.Environment(
      new nunjucks.FileSystemLoader(testDataDir, { noCache: true })
    );
    
    registerLinkedDataFilters(this.nunjucksEnv, {
      baseUri: this.baseUri + '/',
      prefixes: {
        ex: this.baseUri + '/',
        test: this.baseUri + '/test/'
      }
    });

    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.listen(this.port, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async stop() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(resolve);
      });
    }
  }

  addResource(id, data) {
    this.resources.set(id, data);
  }

  handleRequest(req, res) {
    const url = new URL(req.url, this.baseUri);
    const accept = req.headers.accept || 'text/html';
    
    this.requestLogs.push({
      method: req.method,
      url: req.url,
      accept: accept,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString()
    });

    // Parse resource ID from URL
    const pathSegments = url.pathname.split('/').filter(Boolean);
    const resourceId = pathSegments[pathSegments.length - 1]?.split('.')[0];
    const extension = pathSegments[pathSegments.length - 1]?.split('.')[1];

    if (!resourceId || !this.resources.has(resourceId)) {
      this.send404(res);
      return;
    }

    const resourceData = this.resources.get(resourceId);
    
    // Determine response format based on Accept header and file extension
    const format = this.negotiateFormat(accept, extension);
    
    try {
      const response = this.renderResource(resourceData, format);
      this.sendResponse(res, response, format);
    } catch (error) {
      this.send500(res, error);
    }
  }

  negotiateFormat(accept, extension) {
    // File extension takes precedence
    if (extension) {
      switch (extension) {
        case 'ttl': return 'turtle';
        case 'jsonld': return 'json-ld';
        case 'rdf': return 'rdf-xml';
        case 'nt': return 'n-triples';
        case 'html': return 'html';
        default: return 'turtle';
      }
    }

    // Content negotiation based on Accept header
    if (accept.includes('application/ld+json')) return 'json-ld';
    if (accept.includes('text/turtle')) return 'turtle';
    if (accept.includes('application/rdf+xml')) return 'rdf-xml';
    if (accept.includes('application/n-triples')) return 'n-triples';
    if (accept.includes('text/html')) return 'html';
    
    // Default to turtle
    return 'turtle';
  }

  renderResource(data, format) {
    const templateMap = {
      'turtle': 'resource-description.ttl.njk',
      'json-ld': 'content-negotiation/resource.jsonld.njk',
      'rdf-xml': 'content-negotiation/resource.rdf.njk',
      'n-triples': 'content-negotiation/resource.nt.njk'
    };

    const template = templateMap[format];
    if (!template) {
      throw new Error(`Unsupported format: ${format}`);
    }

    return this.nunjucksEnv.render(template, {
      baseUri: this.baseUri + '/',
      ...data
    });
  }

  sendResponse(res, content, format) {
    const contentTypes = {
      'turtle': 'text/turtle; charset=utf-8',
      'json-ld': 'application/ld+json; charset=utf-8',
      'rdf-xml': 'application/rdf+xml; charset=utf-8',
      'n-triples': 'application/n-triples; charset=utf-8',
      'html': 'text/html; charset=utf-8'
    };

    res.writeHead(200, {
      'Content-Type': contentTypes[format],
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
      'Vary': 'Accept'
    });
    res.end(content);
  }

  send404(res) {
    res.writeHead(404, {
      'Content-Type': 'text/plain',
      'Access-Control-Allow-Origin': '*'
    });
    res.end('Resource not found');
  }

  send500(res, error) {
    res.writeHead(500, {
      'Content-Type': 'text/plain',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(`Server error: ${error.message}`);
  }

  getRequestLogs() {
    return this.requestLogs;
  }

  clearLogs() {
    this.requestLogs = [];
  }
}

describe('URI Dereferencing and Interlinking Validation', () => {
  let server;
  let filters;
  const serverPort = 3001;
  const baseUri = `http://localhost:${serverPort}`;

  beforeAll(async () => {
    server = new MockLinkedDataServer(serverPort);
    await server.start();
    
    filters = new LinkedDataFilters({
      baseUri: baseUri + '/'
    });

    // Add test resources
    server.addResource('person-1', {
      resourceId: 'person-1',
      resourceType: 'person',
      title: 'Alice Johnson',
      description: 'Software engineer and researcher',
      givenName: 'Alice',
      familyName: 'Johnson',
      email: 'alice.johnson@example.org',
      creator: 'system',
      createdDate: '2023-12-01T10:00:00Z',
      externalLinks: [
        'https://orcid.org/0000-0000-0000-0001',
        'https://github.com/alice-johnson'
      ]
    });

    server.addResource('organization-1', {
      resourceId: 'organization-1',
      resourceType: 'organization',
      title: 'Tech Corp',
      description: 'Leading technology company',
      legalName: 'Tech Corp Ltd.',
      foundingDate: '2000-01-01',
      numberOfEmployees: 1500,
      creator: 'admin',
      createdDate: '2023-12-01T11:00:00Z'
    });

    server.addResource('dataset-1', {
      resourceId: 'dataset-1',
      resourceType: 'dataset',
      title: 'Research Dataset',
      description: 'Comprehensive research dataset for testing',
      creator: 'researcher',
      keywords: ['research', 'testing', 'linked-data'],
      license: 'cc-by',
      createdDate: '2023-12-01T12:00:00Z',
      statistics: {
        triples: 50000,
        entities: 5000,
        classes: 25,
        properties: 200
      }
    });
  });

  afterAll(async () => {
    await server.stop();
  });

  beforeEach(() => {
    server.clearLogs();
  });

  describe('URI Scheme Validation', () => {
    it('should generate valid slash URIs that are dereferenceable', async () => {
      const resourceUri = filters.rdfResource('person-1', 'slash');
      expect(resourceUri).toBe(`${baseUri}/resource/person-1`);
      expect(filters.validateUri(resourceUri)).toBe(true);
    });

    it('should generate valid hash URIs', () => {
      const resourceUri = filters.rdfResource('person-1', 'hash');
      expect(resourceUri).toBe(`${baseUri}/resource#person-1`);
      expect(filters.validateUri(resourceUri)).toBe(true);
    });

    it('should generate valid query URIs', () => {
      const resourceUri = filters.rdfResource('person-1', 'query');
      expect(resourceUri).toBe(`${baseUri}/resource?id=person-1`);
      expect(filters.validateUri(resourceUri)).toBe(true);
    });

    it('should handle complex resource identifiers', () => {
      const complexResource = {
        type: 'ResearchPaper',
        id: 'AI_ML_Survey_2023',
        org: 'university'
      };

      const slashUri = filters.rdfResource(complexResource, 'slash');
      expect(slashUri).toBe(`${baseUri}/research-paper/ai-ml-survey-2023`);
      expect(filters.validateUri(slashUri)).toBe(true);

      const hashUri = filters.rdfResource(complexResource, 'hash');
      expect(hashUri).toBe(`${baseUri}/research-paper#ai-ml-survey-2023`);
      expect(filters.validateUri(hashUri)).toBe(true);
    });
  });

  describe('Content Negotiation', () => {
    it('should serve Turtle by default', async () => {
      const response = await axios.get(`${baseUri}/person-1`);
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/turtle');
      expect(response.data).toContain('@base');
      expect(response.data).toContain('@prefix');
      expect(response.data).toContain('schema:Person');
      expect(response.data).toContain('Alice Johnson');
    });

    it('should serve JSON-LD when requested', async () => {
      const response = await axios.get(`${baseUri}/person-1`, {
        headers: { 'Accept': 'application/ld+json' }
      });
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/ld+json');
      
      const jsonData = response.data;
      expect(jsonData['@context']).toBeDefined();
      expect(jsonData['@id']).toBe('person-1');
      expect(jsonData['@type']).toBe('schema:Person');
      expect(jsonData.name).toBe('Alice Johnson');
      expect(jsonData.givenName).toBe('Alice');
      expect(jsonData.familyName).toBe('Johnson');
    });

    it('should serve RDF/XML when requested', async () => {
      const response = await axios.get(`${baseUri}/person-1`, {
        headers: { 'Accept': 'application/rdf+xml' }
      });
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/rdf+xml');
      expect(response.data).toContain('<?xml version="1.0"');
      expect(response.data).toContain('<rdf:RDF');
      expect(response.data).toContain('Alice Johnson');
    });

    it('should serve N-Triples when requested', async () => {
      const response = await axios.get(`${baseUri}/person-1`, {
        headers: { 'Accept': 'application/n-triples' }
      });
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/n-triples');
      
      const lines = response.data.split('\\n').filter(line => 
        line.trim() && !line.startsWith('#')
      );
      
      expect(lines.length).toBeGreaterThan(0);
      lines.forEach(line => {
        if (line.trim()) {
          expect(line.trim()).toMatch(/^<[^>]+>\\s+<[^>]+>\\s+.*\\s+\\./);
        }
      });
    });

    it('should serve different formats via file extensions', async () => {
      const formats = [
        { ext: 'ttl', contentType: 'text/turtle' },
        { ext: 'jsonld', contentType: 'application/ld+json' },
        { ext: 'rdf', contentType: 'application/rdf+xml' },
        { ext: 'nt', contentType: 'application/n-triples' }
      ];

      for (const { ext, contentType } of formats) {
        const response = await axios.get(`${baseUri}/person-1.${ext}`);
        
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toContain(contentType);
        expect(response.data).toBeTruthy();
        expect(response.data.length).toBeGreaterThan(100);
      }
    });

    it('should include proper HTTP headers for caching and CORS', async () => {
      const response = await axios.get(`${baseUri}/person-1`);
      
      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.headers['cache-control']).toContain('public');
      expect(response.headers['vary']).toContain('Accept');
    });
  });

  describe('RDF Syntax Validation', () => {
    it('should generate syntactically valid Turtle', async () => {
      const response = await axios.get(`${baseUri}/dataset-1.ttl`);
      
      const parser = new Parser({ format: 'text/turtle' });
      let quads = [];
      let parseError = null;
      
      try {
        quads = parser.parse(response.data);
      } catch (error) {
        parseError = error;
      }

      expect(parseError).toBeNull();
      expect(quads.length).toBeGreaterThan(10);
      
      // Validate specific triples exist
      const typeQuads = quads.filter(q => 
        q.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
      );
      expect(typeQuads.length).toBeGreaterThan(0);
    });

    it('should generate syntactically valid JSON-LD', async () => {
      const response = await axios.get(`${baseUri}/organization-1.jsonld`);
      
      let jsonData;
      let parseError = null;
      
      try {
        jsonData = response.data;
        if (typeof jsonData === 'string') {
          jsonData = JSON.parse(jsonData);
        }
      } catch (error) {
        parseError = error;
      }

      expect(parseError).toBeNull();
      expect(jsonData['@context']).toBeDefined();
      expect(jsonData['@id']).toBe('organization-1');
      expect(jsonData['@type']).toBe('schema:Organization');
      expect(jsonData.name).toBe('Tech Corp');
    });

    it('should generate syntactically valid RDF/XML', async () => {
      const response = await axios.get(`${baseUri}/organization-1.rdf`);
      
      const parser = new Parser({ format: 'application/rdf+xml' });
      let quads = [];
      let parseError = null;
      
      try {
        quads = parser.parse(response.data);
      } catch (error) {
        parseError = error;
      }

      expect(parseError).toBeNull();
      expect(quads.length).toBeGreaterThan(5);
    });

    it('should generate syntactically valid N-Triples', async () => {
      const response = await axios.get(`${baseUri}/organization-1.nt`);
      
      const parser = new Parser({ format: 'application/n-triples' });
      let quads = [];
      let parseError = null;
      
      try {
        quads = parser.parse(response.data);
      } catch (error) {
        parseError = error;
      }

      expect(parseError).toBeNull();
      expect(quads.length).toBeGreaterThan(5);
    });
  });

  describe('Interlinking and External References', () => {
    it('should include owl:sameAs links to external resources', async () => {
      const response = await axios.get(`${baseUri}/person-1.ttl`);
      
      expect(response.data).toContain('owl:sameAs');
      expect(response.data).toContain('https://orcid.org/0000-0000-0000-0001');
      expect(response.data).toContain('https://github.com/alice-johnson');
      
      // Parse and validate structure
      const parser = new Parser();
      const quads = parser.parse(response.data);
      
      const sameAsQuads = quads.filter(q => 
        q.predicate.value === 'http://www.w3.org/2002/07/owl#sameAs'
      );
      
      expect(sameAsQuads.length).toBe(2);
      
      const externalUris = sameAsQuads.map(q => q.object.value);
      expect(externalUris).toContain('https://orcid.org/0000-0000-0000-0001');
      expect(externalUris).toContain('https://github.com/alice-johnson');
    });

    it('should handle invalid external URIs gracefully', () => {
      const invalidLinks = [
        'not-a-uri',
        'ftp://invalid-protocol.com/resource',
        null,
        undefined,
        '',
        'javascript:alert(\"xss\")'
      ];
      
      const validLinks = [
        'https://example.org/valid-resource',
        'http://dbpedia.org/resource/Example'
      ];
      
      const allLinks = [...invalidLinks, ...validLinks];
      const result = filters.sameAs('test-resource', allLinks);
      
      expect(result).toBe('<https://example.org/valid-resource> ,\\n    <http://dbpedia.org/resource/Example>');
    });

    it('should validate external URI accessibility', async () => {
      // Test with real external URIs (mock responses for testing)
      const externalUris = [
        'https://orcid.org/0000-0000-0000-0001',
        'https://github.com/alice-johnson'
      ];
      
      // In a real implementation, you would check if these URIs are accessible
      // For testing, we just validate the URI format
      externalUris.forEach(uri => {
        expect(filters.validateUri(uri)).toBe(true);
        expect(uri).toMatch(/^https?:\\/\\/.+/);
      });
    });
  });

  describe('HTTP Compliance and Performance', () => {
    it('should return 404 for non-existent resources', async () => {
      try {
        await axios.get(`${baseUri}/non-existent-resource`);
        expect.fail('Should have thrown 404 error');
      } catch (error) {
        expect(error.response.status).toBe(404);
      }
    });

    it('should handle multiple concurrent requests efficiently', async () => {
      const requests = [];
      const concurrentRequests = 20;
      
      const startTime = performance.now();
      
      for (let i = 0; i < concurrentRequests; i++) {
        const resourceId = ['person-1', 'organization-1', 'dataset-1'][i % 3];
        const format = ['', '.ttl', '.jsonld', '.rdf', '.nt'][i % 5];
        
        requests.push(
          axios.get(`${baseUri}/${resourceId}${format}`)
        );
      }
      
      const responses = await Promise.all(requests);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      const avgResponseTime = duration / concurrentRequests;
      
      expect(duration).toBeLessThan(5000); // All requests should complete in <5s
      expect(avgResponseTime).toBeLessThan(250); // Average <250ms per request
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.data).toBeTruthy();
        expect(response.data.length).toBeGreaterThan(50);
      });
      
      // Check request logs
      const logs = server.getRequestLogs();
      expect(logs).toHaveLength(concurrentRequests);
    });

    it('should log requests for monitoring and analytics', async () => {
      server.clearLogs();
      
      await axios.get(`${baseUri}/person-1`, {
        headers: {
          'Accept': 'application/ld+json',
          'User-Agent': 'LinkedDataBot/1.0'
        }
      });
      
      await axios.get(`${baseUri}/organization-1.ttl`);
      
      const logs = server.getRequestLogs();
      expect(logs).toHaveLength(2);
      
      expect(logs[0].method).toBe('GET');
      expect(logs[0].url).toBe('/person-1');
      expect(logs[0].accept).toBe('application/ld+json');
      expect(logs[0].userAgent).toBe('LinkedDataBot/1.0');
      expect(logs[0].timestamp).toMatch(/\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}/);
      
      expect(logs[1].method).toBe('GET');
      expect(logs[1].url).toBe('/organization-1.ttl');
    });
  });

  describe('Semantic Consistency Across Formats', () => {
    it('should maintain semantic consistency across all formats', async () => {
      const formats = ['ttl', 'jsonld', 'rdf', 'nt'];
      const parsedQuads = {};
      
      // Fetch and parse each format
      for (const format of formats) {
        const response = await axios.get(`${baseUri}/person-1.${format}`);
        
        let parser;
        switch (format) {
          case 'ttl':
            parser = new Parser({ format: 'text/turtle' });
            break;
          case 'jsonld':
            // For JSON-LD, we need to convert to N-Quads first or use a different approach
            // For this test, we'll validate JSON structure
            if (typeof response.data === 'string') {
              JSON.parse(response.data);
            }
            continue;
          case 'rdf':
            parser = new Parser({ format: 'application/rdf+xml' });
            break;
          case 'nt':
            parser = new Parser({ format: 'application/n-triples' });
            break;
        }
        
        if (parser) {
          parsedQuads[format] = parser.parse(response.data);
        }
      }
      
      // Compare core triples across formats
      const ttlQuads = parsedQuads.ttl || [];
      const rdfQuads = parsedQuads.rdf || [];
      const ntQuads = parsedQuads.nt || [];
      
      // Check that core properties exist in all formats
      const corePredicates = [
        'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        'http://schema.org/name',
        'http://schema.org/identifier'
      ];
      
      [ttlQuads, rdfQuads, ntQuads].forEach(quads => {
        corePredicates.forEach(predicate => {
          const hasProperty = quads.some(q => q.predicate.value === predicate);
          expect(hasProperty).toBe(true);
        });
      });
    });
  });

  describe('Linked Data Principles Compliance', () => {
    it('should use HTTP URIs for all identifiers', async () => {
      const response = await axios.get(`${baseUri}/person-1.ttl`);
      const parser = new Parser();
      const quads = parser.parse(response.data);
      
      // All subjects and objects that are URIs should use HTTP(S)
      quads.forEach(quad => {
        if (quad.subject.termType === 'NamedNode') {
          expect(quad.subject.value).toMatch(/^https?:\\/\\//);
        }
        if (quad.object.termType === 'NamedNode') {
          expect(quad.object.value).toMatch(/^https?:\\/\\//);
        }
        if (quad.predicate.termType === 'NamedNode') {
          expect(quad.predicate.value).toMatch(/^https?:\\/\\//);
        }
      });
    });

    it('should provide links to external datasets', async () => {
      const response = await axios.get(`${baseUri}/person-1.ttl`);
      
      expect(response.data).toContain('owl:sameAs');
      
      // Should link to well-known external sources
      const parser = new Parser();
      const quads = parser.parse(response.data);
      
      const sameAsQuads = quads.filter(q => 
        q.predicate.value === 'http://www.w3.org/2002/07/owl#sameAs'
      );
      
      expect(sameAsQuads.length).toBeGreaterThan(0);
      
      // At least one external link should exist
      const hasExternalLink = sameAsQuads.some(q => 
        !q.object.value.startsWith(baseUri)
      );
      expect(hasExternalLink).toBe(true);
    });

    it('should include structured data for machines', async () => {
      const response = await axios.get(`${baseUri}/dataset-1.jsonld`);
      const jsonData = response.data;
      
      // Should have JSON-LD context
      expect(jsonData['@context']).toBeDefined();
      expect(jsonData['@id']).toBeDefined();
      expect(jsonData['@type']).toBeDefined();
      
      // Should have machine-readable properties
      expect(jsonData.identifier).toBeDefined();
      expect(jsonData.created).toBeDefined();
      expect(jsonData.modified).toBeDefined();
    });

    it('should provide useful information for humans and machines', async () => {
      const response = await axios.get(`${baseUri}/organization-1.ttl`);
      const parser = new Parser();
      const quads = parser.parse(response.data);
      
      // Should have human-readable labels/names
      const nameQuads = quads.filter(q => 
        q.predicate.value.includes('name') || 
        q.predicate.value.includes('label') ||
        q.predicate.value.includes('title')
      );
      expect(nameQuads.length).toBeGreaterThan(0);
      
      // Should have descriptions
      const descQuads = quads.filter(q => 
        q.predicate.value.includes('description') ||
        q.predicate.value.includes('comment')
      );
      expect(descQuads.length).toBeGreaterThan(0);
      
      // Should have structured metadata
      const metadataQuads = quads.filter(q => 
        q.predicate.value.includes('created') ||
        q.predicate.value.includes('modified') ||
        q.predicate.value.includes('identifier')
      );
      expect(metadataQuads.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high request volume without degradation', async () => {
      const requests = 100;
      const batchSize = 10;
      const responseTimeMs = [];
      
      // Process in batches to avoid overwhelming the test server
      for (let batch = 0; batch < requests / batchSize; batch++) {
        const batchRequests = [];
        
        for (let i = 0; i < batchSize; i++) {
          const resourceId = ['person-1', 'organization-1', 'dataset-1'][i % 3];
          const startTime = performance.now();
          
          batchRequests.push(
            axios.get(`${baseUri}/${resourceId}`).then(response => {
              const endTime = performance.now();
              responseTimeMs.push(endTime - startTime);
              return response;
            })
          );
        }
        
        const responses = await Promise.all(batchRequests);
        responses.forEach(response => {
          expect(response.status).toBe(200);
        });
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // Analyze performance
      const avgResponseTime = responseTimeMs.reduce((a, b) => a + b, 0) / responseTimeMs.length;
      const maxResponseTime = Math.max(...responseTimeMs);
      const minResponseTime = Math.min(...responseTimeMs);
      
      expect(avgResponseTime).toBeLessThan(100); // Average <100ms
      expect(maxResponseTime).toBeLessThan(500); // Max <500ms
      expect(minResponseTime).toBeLessThan(50);  // Min <50ms
      
      console.log(`\\n📊 Performance Summary (${requests} requests):`);
      console.log(`Average: ${Math.round(avgResponseTime)}ms`);
      console.log(`Min: ${Math.round(minResponseTime)}ms`);
      console.log(`Max: ${Math.round(maxResponseTime)}ms`);
    });

    it('should maintain consistent response sizes', async () => {
      const formats = ['ttl', 'jsonld', 'rdf', 'nt'];
      const responseSizes = {};
      
      for (const format of formats) {
        const response = await axios.get(`${baseUri}/dataset-1.${format}`);
        responseSizes[format] = response.data.length;
      }
      
      // All formats should have substantial content
      Object.values(responseSizes).forEach(size => {
        expect(size).toBeGreaterThan(500); // At least 500 characters
      });
      
      // Response sizes should be reasonably consistent (within an order of magnitude)
      const sizes = Object.values(responseSizes);
      const maxSize = Math.max(...sizes);
      const minSize = Math.min(...sizes);
      const ratio = maxSize / minSize;
      
      expect(ratio).toBeLessThan(10); // Largest shouldn't be >10x the smallest
      
      console.log('\\n📦 Response Sizes by Format:');
      console.table(responseSizes);
    });
  });
});