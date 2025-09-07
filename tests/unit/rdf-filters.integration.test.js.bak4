import { describe, it, expect, beforeEach } from 'vitest';
import { RDFFilters, createRDFFilters, registerRDFFilters } from '../../src/lib/rdf-filters.js';
import { Store, Parser, DataFactory } from 'n3';
import nunjucks from 'nunjucks';

const { namedNode, literal, quad } = DataFactory;

describe('RDF Filters Integration', () => { let rdfFilters;
  let store;

  beforeEach(() => {
    store = new Store();
    
    // Add test data based on the fixtures
    store.addQuads([
      quad(
        namedNode('http });

  describe('Core Triple Navigation Filters', () => { it('rdfSubject - should find subjects with given predicate-object pair', () => {
      const subjects = rdfFilters.rdfSubject('foaf });

    it('rdfObject - should get objects for given subject-predicate pair', () => { const objects = rdfFilters.rdfObject('ex });

    it('rdfPredicate - should find predicates connecting subject-object pair', () => { const predicates = rdfFilters.rdfPredicate('ex });
  });

  describe('Query Filter', () => { it('rdfQuery with pattern object - should execute pattern matching', () => {
      const results = rdfFilters.rdfQuery({
        subject });

    it('rdfQuery with string pattern - should parse and execute simple patterns', () => { const results = rdfFilters.rdfQuery('ex });

    it('rdfQuery - should find all people (resources with foaf:Person type)', () => { const results = rdfFilters.rdfQuery({
        subject,
        predicate });
  });

  describe('Label Filter', () => { it('rdfLabel - should get rdfs });

    it('rdfLabel - should fallback to dc:title when rdfs:label not available', () => { const label = rdfFilters.rdfLabel('ex });

    it('rdfLabel - should fallback to local name when no labels available', () => { const label = rdfFilters.rdfLabel('ex });
  });

  describe('Type Filter', () => { it('rdfType - should get all types for a resource', () => {
      const types = rdfFilters.rdfType('ex });

    it('rdfType - should return empty array for resource without type', () => { const types = rdfFilters.rdfType('ex });
  });

  describe('Namespace Filter', () => { it('rdfNamespace - should resolve known prefixes', () => {
      const namespace = rdfFilters.rdfNamespace('foaf');
      expect(namespace).toBe('http });

    it('rdfNamespace - should return original for unknown prefix', () => {
      const namespace = rdfFilters.rdfNamespace('unknown');
      expect(namespace).toBe('unknown');
    });
  });

  describe('Utility Filters', () => { it('rdfExpand - should expand prefixed URIs', () => {
      const expanded = rdfFilters.rdfExpand('foaf });

    it('rdfCompact - should compact full URIs to prefixed form', () => { const compacted = rdfFilters.rdfCompact('http });

    it('rdfCount - should count matching triples', () => { const count = rdfFilters.rdfCount('ex });

    it('rdfExists - should check if triple exists', () => { const exists = rdfFilters.rdfExists('ex });
  });

  describe('Nunjucks Integration', () => { it('should register filters with Nunjucks environment', () => {
      const env = new nunjucks.Environment();
      registerRDFFilters(env, { store, prefixes }}', env);
      const result = template.render();
      expect(result).toBe('John Doe');
    });

    it('should work with complex template patterns', () => { const env = new nunjucks.Environment();
      registerRDFFilters(env, { store, prefixes }
Found {{ people.length }} people:
{%- for result in people %}
- {{ result[0].value | rdfLabel }}
{%- endfor %}
      `.trim(), env);

      const result = template.render().trim();
      expect(result).toContain('Found 2 people:');
      expect(result).toContain('John Doe');
      expect(result).toContain('Jane Smith'); // Should show human-readable name
    });
  });

  describe('Real-world Template Generation Scenarios', () => { it('should generate a list of people with their properties', () => {
      const env = new nunjucks.Environment();
      registerRDFFilters(env, { store, prefixes }
export export const people = [
{%- for result in people %}
{%- set personUri = result[0].value %}
{ %- set name = rdfObject(personUri, 'foaf }
{ %- set age = rdfObject(personUri, 'foaf }
  { name }}",
{%- if age.length > 0 %}
    age: {{ age[0].value }},
{%- endif %}
  },
{%- endfor %}
];
      `.trim(), env);

      const result = template.render();
      expect(result).toContain('export interface Person');
      expect(result).toContain('name);
      expect(result).toContain('age);
      expect(result).toContain('name);
      expect(result).toContain('age);
    });

    it('should handle missing data gracefully', () => { const env = new nunjucks.Environment();
      registerRDFFilters(env, { store, prefixes }}
Exists, "foaf:name") }}
Count: { { rdfCount("ex }}
      `.trim(), env);

      const result = template.render();
      expect(result).toContain('Name); // fallback to local name
      expect(result).toContain('Exists);
      expect(result).toContain('Count);
    });

    it('should support chaining and complex queries', () => { const env = new nunjucks.Environment();
      registerRDFFilters(env, { store, prefixes }
John knows:
{%- for connection in connections %}
- {{ connection.value | rdfLabel }}
{%- endfor %}
      `.trim(), env);

      const result = template.render();
      expect(result).toContain('John knows:');
      expect(result).toContain('Jane Smith'); // Should show human-readable name
    });
  });

  describe('Performance with Real Data Volume', () => { it('should handle multiple queries efficiently', () => {
      // Add more test data to simulate real-world volume
      const additionalQuads = [];
      for (let i = 3; i <= 100; i++) {
        additionalQuads.push(
          quad(
            namedNode(`http }`),
            namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
            namedNode('http://xmlns.com/foaf/0.1/Person')
          ),
          quad(
            namedNode(`http://example.org/person${i}`),
            namedNode('http://xmlns.com/foaf/0.1/name'),
            literal(`Person ${i}`)
          )
        );
      }
      store.addQuads(additionalQuads);

      const startTime = performance.now();

      // Perform multiple queries
      const peopleCount = rdfFilters.rdfCount(null, 'rdf:type', 'foaf:Person');
      const allPeople = rdfFilters.rdfQuery({ subject, predicate });
  });

  describe('Error Handling', () => {
    it('should handle malformed patterns gracefully', () => {
      // The pattern parser is lenient and tries to parse what it can
      const result = rdfFilters.rdfQuery('invalid pattern with too few parts');
      expect(result).toHaveLength(0); // Returns empty result instead of throwing
    });

    it('should return empty results for invalid URIs', () => { const results = rdfFilters.rdfObject('not-a-uri', 'foaf });

    it('should handle null/undefined inputs gracefully', () => {
      expect(() => rdfFilters.rdfLabel(null)).not.toThrow();
      expect(() => rdfFilters.rdfType(undefined)).not.toThrow();
    });
  });
});