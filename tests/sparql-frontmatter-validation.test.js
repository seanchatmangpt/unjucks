/**
 * SPARQL Frontmatter Validation Test Suite
 * 
 * Comprehensive validation of SPARQL template frontmatter parsing functionality.
 * This test verifies that the frontmatter parser correctly handles SPARQL/RDF
 * content in template files without parsing errors.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FrontmatterParser } from '../src/lib/frontmatter-parser.js';
import fs from 'fs-extra';
import path from 'path';

describe('SPARQL Frontmatter Validation', () => {
  let parser;
  const sparqlFixturesDir = path.join(__dirname, 'fixtures/sparql');

  beforeEach(() => {
    parser = new FrontmatterParser();
  });

  describe('SPARQL Template Frontmatter Parsing', () => {
    const sparqlTemplateFiles = [
      'complex-query.sparql.njk',
      'federated-query.sparql.njk',
      'construct-query.sparql.njk',
      'select-query.sparql.njk',
      'update-query.sparql.njk'
    ];

    sparqlTemplateFiles.forEach(filename => {
      it(`should parse frontmatter from ${filename} without errors`, async () => {
        const filePath = path.join(sparqlFixturesDir, filename);
        
        // Verify file exists
        expect(await fs.pathExists(filePath)).toBe(true);
        
        // Read file content
        const content = await fs.readFile(filePath, 'utf-8');
        expect(content).toBeTruthy();
        expect(content.trim().length).toBeGreaterThan(0);

        // Parse frontmatter
        const result = await parser.parse(content);
        
        // Verify successful parsing
        expect(result).toBeDefined();
        expect(result.hasValidFrontmatter).toBe(true);
        expect(result.frontmatter).toBeDefined();
        expect(result.content).toBeDefined();
        
        // Verify expected frontmatter structure
        expect(result.frontmatter.to).toBeTruthy();
        expect(typeof result.frontmatter.to).toBe('string');
        expect(result.frontmatter.inject).toBe(false);
        
        // Verify template variables are preserved in frontmatter
        expect(result.frontmatter.to).toContain('{{');
        expect(result.frontmatter.to).toContain('}}');
        
        // Verify content contains SPARQL keywords
        const sparqlKeywords = ['PREFIX', 'SELECT', 'WHERE', 'FILTER', 'CONSTRUCT'];
        const containsSparqlKeywords = sparqlKeywords.some(keyword => 
          result.content.toUpperCase().includes(keyword)
        );
        expect(containsSparqlKeywords).toBe(true);
      });
    });

    it('should handle SPARQL template with RDF configuration in frontmatter', async () => {
      const sparqlWithRdfConfig = `---
to: "{{ dest }}/queries/{{ queryName }}.sparql"
inject: false
rdf:
  prefixes:
    - "PREFIX foaf: <http://xmlns.com/foaf/0.1/>"
    - "PREFIX schema: <http://schema.org/>"
  baseUri: "{{ baseUri }}"
sparql: |
  SELECT ?person ?name WHERE {
    ?person foaf:name ?name .
    ?person a foaf:Person .
  }
---
PREFIX ex: <{{ baseUri }}/>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>

SELECT {{ variables | map('sparqlVar') | join(' ') }}
WHERE {
  {% for pattern in patterns %}
  {{ pattern.subject | sparqlVar }} {{ pattern.predicate | rdfPropertyFilter }} {{ pattern.object | sparqlValue }} .
  {% endfor %}
}`;

      const result = await parser.parse(sparqlWithRdfConfig);
      
      expect(result.hasValidFrontmatter).toBe(true);
      expect(result.frontmatter.rdf).toBeDefined();
      expect(result.frontmatter.rdf.prefixes).toBeInstanceOf(Array);
      expect(result.frontmatter.rdf.prefixes).toHaveLength(2);
      expect(result.frontmatter.sparql).toBeDefined();
      expect(result.frontmatter.sparql).toContain('SELECT ?person ?name');
      
      // Verify RDF validation
      const validation = parser.validate(result.frontmatter);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should handle malformed SPARQL frontmatter gracefully', async () => {
      const malformedSparql = `---
to: "{{ dest }}/queries/broken.sparql"
inject: false
sparql: |
  SELECT ?invalid syntax here
  WHERE {
    invalid triple pattern
---
Content here`;

      const result = await parser.parse(malformedSparql);
      
      // Should still parse frontmatter structure successfully
      expect(result.hasValidFrontmatter).toBe(true);
      expect(result.frontmatter.to).toBe('{{ dest }}/queries/broken.sparql');
      expect(result.frontmatter.sparql).toBeDefined();
      
      // Validation should catch the invalid SPARQL
      const validation = parser.validate(result.frontmatter);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(error => error.includes('SPARQL'))).toBe(true);
    });

    it('should preserve multiline SPARQL queries with complex syntax', async () => {
      const complexSparql = `---
to: "{{ dest }}/queries/complex.sparql"
inject: false
sparql: |
  PREFIX ex: <http://example.org/>
  PREFIX foaf: <http://xmlns.com/foaf/0.1/>
  PREFIX schema: <http://schema.org/>
  
  SELECT ?person ?name ?age ?workplace
  WHERE {
    ?person a foaf:Person ;
            foaf:name ?name ;
            foaf:age ?age .
    
    OPTIONAL {
      ?person schema:worksFor ?workplace .
    }
    
    FILTER(?age > 25)
    
    SERVICE <http://dbpedia.org/sparql> {
      ?person foaf:knows ?friend .
      ?friend foaf:name ?friendName .
    }
  }
  ORDER BY ?name
  LIMIT 100
---
Generated SPARQL query content`;

      const result = await parser.parse(complexSparql);
      
      expect(result.hasValidFrontmatter).toBe(true);
      expect(result.frontmatter.sparql).toBeDefined();
      
      const sparql = result.frontmatter.sparql;
      expect(sparql).toContain('PREFIX ex:');
      expect(sparql).toContain('SELECT ?person ?name ?age ?workplace');
      expect(sparql).toContain('OPTIONAL {');
      expect(sparql).toContain('FILTER(?age > 25)');
      expect(sparql).toContain('SERVICE <http://dbpedia.org/sparql>');
      expect(sparql).toContain('ORDER BY ?name');
      expect(sparql).toContain('LIMIT 100');
    });

    it('should validate RDF configuration schema', async () => {
      const validRdfConfig = {
        rdf: {
          source: 'data.ttl',
          type: 'file',
          prefixes: ['PREFIX foaf: <http://xmlns.com/foaf/0.1/>']
        }
      };

      const invalidRdfConfig = {
        rdf: {
          // Missing required 'source' property
          type: 'invalid-type',
          prefixes: 'not-an-array'
        }
      };

      const validResult = parser.validate(validRdfConfig);
      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      const invalidResult = parser.validate(invalidRdfConfig);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
      expect(invalidResult.errors.some(error => error.includes('source'))).toBe(true);
      expect(invalidResult.errors.some(error => error.includes('type'))).toBe(true);
      expect(invalidResult.errors.some(error => error.includes('array'))).toBe(true);
    });

    it('should detect SPARQL-like content correctly', async () => {
      const sparqlContent = 'SELECT ?s ?p ?o WHERE { ?s ?p ?o }';
      const nonSparqlContent = 'This is just regular text without query syntax';
      const constructContent = 'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }';
      
      expect(parser.isSparqlLikeContent(sparqlContent)).toBe(true);
      expect(parser.isSparqlLikeContent(nonSparqlContent)).toBe(false);
      expect(parser.isSparqlLikeContent(constructContent)).toBe(true);
    });

    it('should handle RDF configuration extraction', async () => {
      const frontmatterWithRdf = {
        rdf: {
          source: 'data.ttl',
          type: 'file'
        }
      };

      const frontmatterWithTurtle = {
        turtle: 'inline-data.ttl'
      };

      const frontmatterWithTurtleData = {
        turtleData: '@prefix ex: <http://example.org/> .'
      };

      const rdfConfig1 = parser.getRDFConfig(frontmatterWithRdf);
      expect(rdfConfig1).toEqual({
        source: 'data.ttl',
        type: 'file'
      });

      const rdfConfig2 = parser.getRDFConfig(frontmatterWithTurtle);
      expect(rdfConfig2).toEqual({
        type: 'file',
        source: 'inline-data.ttl',
        format: 'text/turtle'
      });

      const rdfConfig3 = parser.getRDFConfig(frontmatterWithTurtleData);
      expect(rdfConfig3).toEqual({
        type: 'inline',
        source: '@prefix ex: <http://example.org/> .',
        format: 'text/turtle'
      });
    });
  });

  describe('Error Recovery and Graceful Fallbacks', () => {
    it('should handle completely malformed YAML gracefully', async () => {
      const malformedYaml = `---
to: {{ dest }}/output.sparql
invalid: [unclosed array without bracket
inject: true but with syntax error
broken yaml: {
---
PREFIX ex: <http://example.org/>
SELECT ?s WHERE { ?s ?p ?o }`;

      // Should not throw an error
      expect(async () => {
        await parser.parse(malformedYaml);
      }).not.toThrow();

      const result = await parser.parse(malformedYaml);
      
      // Should return fallback result
      expect(result).toBeDefined();
      expect(result.hasValidFrontmatter).toBe(false);
      expect(result.frontmatter).toEqual({});
      expect(result.content).toBe(malformedYaml);
    });

    it('should handle empty frontmatter gracefully', async () => {
      const emptyFrontmatter = `---
---
PREFIX ex: <http://example.org/>
SELECT ?s WHERE { ?s ?p ?o }`;

      const result = await parser.parse(emptyFrontmatter);
      
      expect(result.hasValidFrontmatter).toBe(true);
      expect(result.frontmatter).toEqual({});
      expect(result.content.trim()).toBe('PREFIX ex: <http://example.org/>\nSELECT ?s WHERE { ?s ?p ?o }');
    });

    it('should handle templates without frontmatter', async () => {
      const noFrontmatter = `PREFIX ex: <http://example.org/>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>

SELECT {{ variables | map('sparqlVar') | join(' ') }}
WHERE {
  ?person foaf:name "{{ personName }}" .
}`;

      const result = await parser.parse(noFrontmatter);
      
      expect(result.hasValidFrontmatter).toBe(false);
      expect(result.frontmatter).toEqual({});
      expect(result.content).toBe(noFrontmatter);
    });

    it('should preserve template variables in SPARQL content', async () => {
      const sparqlWithVars = `---
to: "{{ dest }}/queries/{{ queryName }}.sparql"
inject: false
---
PREFIX ex: <{{ baseUri }}/>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>

SELECT {% for var in variables %}{{ var | sparqlVar }}{% if not loop.last %} {% endif %}{% endfor %}
WHERE {
  {% for pattern in patterns %}
  {{ pattern.subject | sparqlVar }} {{ pattern.predicate | rdfPropertyFilter }} {{ pattern.object | sparqlValue }} .
  {% endfor %}
}
LIMIT {{ limit | default(100) }}`;

      const result = await parser.parse(sparqlWithVars);
      
      expect(result.hasValidFrontmatter).toBe(true);
      expect(result.content).toContain('{{ baseUri }}');
      expect(result.content).toContain('{% for var in variables %}');
      expect(result.content).toContain('{{ pattern.subject | sparqlVar }}');
      expect(result.content).toContain('{{ limit | default(100) }}');
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large SPARQL queries efficiently', async () => {
      // Create a large SPARQL query with many patterns
      const largePatterns = Array.from({ length: 1000 }, (_, i) => 
        `  ?entity${i} foaf:name ?name${i} .`
      ).join('\n');

      const largeSparql = `---
to: "{{ dest }}/queries/large.sparql"
inject: false
---
PREFIX foaf: <http://xmlns.com/foaf/0.1/>

SELECT *
WHERE {
${largePatterns}
}`;

      const startTime = this.getDeterministicTimestamp();
      const result = await parser.parse(largeSparql);
      const endTime = this.getDeterministicTimestamp();

      expect(result.hasValidFrontmatter).toBe(true);
      expect(result.content).toContain('?entity999');
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
    });

    it('should handle Unicode characters in SPARQL content', async () => {
      const unicodeSparql = `---
to: "{{ dest }}/queries/unicode.sparql"
inject: false
description: "Query with émojis 🚀 and unicode ñáéíóú"
---
PREFIX ex: <http://example.org/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?resource ?label
WHERE {
  ?resource rdfs:label "Niño García" .
  ?resource ex:description "Contains émojis 🎉 and special chars ñáéíóú" .
}`;

      const result = await parser.parse(unicodeSparql);
      
      expect(result.hasValidFrontmatter).toBe(true);
      expect(result.frontmatter.description).toContain('émojis 🚀');
      expect(result.content).toContain('Niño García');
      expect(result.content).toContain('émojis 🎉');
    });

    it('should validate URI formats correctly', async () => {
      const validUris = [
        'http://example.org/',
        'https://schema.org/Person',
        'urn:isbn:1234567890',
        'file:///path/to/file',
        'ex:resource',
        '/relative/path'
      ];

      const invalidUris = [
        'not-a-uri',
        'http://',
        ''
      ];

      validUris.forEach(uri => {
        expect(parser.isValidUri(uri)).toBe(true);
      });

      invalidUris.forEach(uri => {
        expect(parser.isValidUri(uri)).toBe(false);
      });
    });
  });
});