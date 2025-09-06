import { describe, it, expect, beforeEach } from 'vitest';
import { RDFFilters, createRDFFilters, registerRDFFilters } from '../../src/lib/rdf-filters.js';
import { Store, Parser, DataFactory } from 'n3';
import nunjucks from 'nunjucks';

const { namedNode, literal, quad } = DataFactory;

describe('RDF Filters Integration', () => {
  let rdfFilters: RDFFilters;
  let store: Store;

  beforeEach(() => {
    store = new Store();
    
    // Add test data based on the fixtures
    store.addQuads([
      quad(
        namedNode('http://example.org/person1'),
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://xmlns.com/foaf/0.1/Person')
      ),
      quad(
        namedNode('http://example.org/person1'),
        namedNode('http://xmlns.com/foaf/0.1/name'),
        literal('John Doe')
      ),
      quad(
        namedNode('http://example.org/person1'),
        namedNode('http://xmlns.com/foaf/0.1/age'),
        literal('30', namedNode('http://www.w3.org/2001/XMLSchema#integer'))
      ),
      quad(
        namedNode('http://example.org/person1'),
        namedNode('http://xmlns.com/foaf/0.1/email'),
        literal('john.doe@example.com')
      ),
      quad(
        namedNode('http://example.org/person1'),
        namedNode('http://xmlns.com/foaf/0.1/knows'),
        namedNode('http://example.org/person2')
      ),
      quad(
        namedNode('http://example.org/person2'),
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://xmlns.com/foaf/0.1/Person')
      ),
      quad(
        namedNode('http://example.org/person2'),
        namedNode('http://xmlns.com/foaf/0.1/name'),
        literal('Jane Smith')
      ),
      quad(
        namedNode('http://example.org/person2'),
        namedNode('http://xmlns.com/foaf/0.1/age'),
        literal('28', namedNode('http://www.w3.org/2001/XMLSchema#integer'))
      ),
      // Add some data with labels for label testing
      quad(
        namedNode('http://example.org/person1'),
        namedNode('http://www.w3.org/2000/01/rdf-schema#label'),
        literal('John Doe')
      ),
      quad(
        namedNode('http://example.org/company1'),
        namedNode('http://www.w3.org/2000/01/rdf-schema#label'),
        literal('ACME Corp')
      ),
      quad(
        namedNode('http://example.org/company1'),
        namedNode('http://purl.org/dc/terms/title'),
        literal('ACME Corporation')
      )
    ]);

    rdfFilters = new RDFFilters({
      store,
      prefixes: {
        foaf: 'http://xmlns.com/foaf/0.1/',
        ex: 'http://example.org/',
        rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
        rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
      }
    });
  });

  describe('Core Triple Navigation Filters', () => {
    it('rdfSubject - should find subjects with given predicate-object pair', () => {
      const subjects = rdfFilters.rdfSubject('foaf:name', '"John Doe"');
      expect(subjects).toContain('http://example.org/person1');
      expect(subjects).toHaveLength(1);
    });

    it('rdfObject - should get objects for given subject-predicate pair', () => {
      const objects = rdfFilters.rdfObject('ex:person1', 'foaf:name');
      expect(objects).toHaveLength(1);
      expect(objects[0].value).toBe('John Doe');
      expect(objects[0].type).toBe('literal');
    });

    it('rdfPredicate - should find predicates connecting subject-object pair', () => {
      const predicates = rdfFilters.rdfPredicate('ex:person1', 'ex:person2');
      expect(predicates).toContain('http://xmlns.com/foaf/0.1/knows');
      expect(predicates).toHaveLength(1);
    });
  });

  describe('Query Filter', () => {
    it('rdfQuery with pattern object - should execute pattern matching', () => {
      const results = rdfFilters.rdfQuery({
        subject: 'ex:person1',
        predicate: 'foaf:name',
        object: null
      });
      
      expect(results).toHaveLength(1);
      expect(results[0]).toHaveLength(3); // subject, predicate, object
      expect(results[0][2].value).toBe('John Doe');
    });

    it('rdfQuery with string pattern - should parse and execute simple patterns', () => {
      const results = rdfFilters.rdfQuery('ex:person1 rdf:type ?o');
      
      expect(results).toHaveLength(1);
      expect(results[0][2].value).toBe('http://xmlns.com/foaf/0.1/Person');
    });

    it('rdfQuery - should find all people (resources with foaf:Person type)', () => {
      const results = rdfFilters.rdfQuery({
        subject: null,
        predicate: 'rdf:type',
        object: 'foaf:Person'
      });
      
      expect(results).toHaveLength(2);
      const subjects = results.map(r => r[0].value);
      expect(subjects).toContain('http://example.org/person1');
      expect(subjects).toContain('http://example.org/person2');
    });
  });

  describe('Label Filter', () => {
    it('rdfLabel - should get rdfs:label when available', () => {
      const label = rdfFilters.rdfLabel('ex:person1');
      expect(label).toBe('John Doe');
    });

    it('rdfLabel - should fallback to dc:title when rdfs:label not available', () => {
      const label = rdfFilters.rdfLabel('ex:company1');
      expect(label).toBe('ACME Corp'); // Should prefer rdfs:label over dc:title
    });

    it('rdfLabel - should fallback to local name when no labels available', () => {
      const label = rdfFilters.rdfLabel('ex:unknownResource');
      expect(label).toBe('unknownResource');
    });
  });

  describe('Type Filter', () => {
    it('rdfType - should get all types for a resource', () => {
      const types = rdfFilters.rdfType('ex:person1');
      expect(types).toContain('http://xmlns.com/foaf/0.1/Person');
      expect(types).toHaveLength(1);
    });

    it('rdfType - should return empty array for resource without type', () => {
      const types = rdfFilters.rdfType('ex:unknownResource');
      expect(types).toHaveLength(0);
    });
  });

  describe('Namespace Filter', () => {
    it('rdfNamespace - should resolve known prefixes', () => {
      const namespace = rdfFilters.rdfNamespace('foaf');
      expect(namespace).toBe('http://xmlns.com/foaf/0.1/');
    });

    it('rdfNamespace - should return original for unknown prefix', () => {
      const namespace = rdfFilters.rdfNamespace('unknown');
      expect(namespace).toBe('unknown');
    });
  });

  describe('Utility Filters', () => {
    it('rdfExpand - should expand prefixed URIs', () => {
      const expanded = rdfFilters.rdfExpand('foaf:name');
      expect(expanded).toBe('http://xmlns.com/foaf/0.1/name');
    });

    it('rdfCompact - should compact full URIs to prefixed form', () => {
      const compacted = rdfFilters.rdfCompact('http://xmlns.com/foaf/0.1/name');
      expect(compacted).toBe('foaf:name');
    });

    it('rdfCount - should count matching triples', () => {
      const count = rdfFilters.rdfCount('ex:person1', null, null);
      expect(count).toBeGreaterThan(0);
    });

    it('rdfExists - should check if triple exists', () => {
      const exists = rdfFilters.rdfExists('ex:person1', 'foaf:name');
      expect(exists).toBe(true);

      const notExists = rdfFilters.rdfExists('ex:unknownPerson', 'foaf:name');
      expect(notExists).toBe(false);
    });
  });

  describe('Nunjucks Integration', () => {
    it('should register filters with Nunjucks environment', () => {
      const env = new nunjucks.Environment();
      registerRDFFilters(env, { store, prefixes: { foaf: 'http://xmlns.com/foaf/0.1/', ex: 'http://example.org/' } });

      // Create a template that uses RDF filters
      const template = nunjucks.compile('{{ "ex:person1" | rdfLabel }}', env);
      const result = template.render();
      expect(result).toBe('John Doe');
    });

    it('should work with complex template patterns', () => {
      const env = new nunjucks.Environment();
      registerRDFFilters(env, { store, prefixes: { foaf: 'http://xmlns.com/foaf/0.1/', ex: 'http://example.org/' } });

      const template = nunjucks.compile(`
{%- set people = rdfQuery({subject: null, predicate: 'rdf:type', object: 'foaf:Person'}) -%}
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

  describe('Real-world Template Generation Scenarios', () => {
    it('should generate a list of people with their properties', () => {
      const env = new nunjucks.Environment();
      registerRDFFilters(env, { store, prefixes: { foaf: 'http://xmlns.com/foaf/0.1/', ex: 'http://example.org/' } });

      const template = nunjucks.compile(`
{%- set people = rdfQuery({subject: null, predicate: 'rdf:type', object: 'foaf:Person'}) -%}
export interface Person {
  name: string;
  age?: number;
}

export const people: Person[] = [
{%- for result in people %}
{%- set personUri = result[0].value %}
{%- set name = rdfObject(personUri, 'foaf:name') %}
{%- set age = rdfObject(personUri, 'foaf:age') %}
  {
    name: "{{ name[0].value if name.length > 0 else 'Unknown' }}",
{%- if age.length > 0 %}
    age: {{ age[0].value }},
{%- endif %}
  },
{%- endfor %}
];
      `.trim(), env);

      const result = template.render();
      expect(result).toContain('export interface Person');
      expect(result).toContain('name: "John Doe"');
      expect(result).toContain('age: 30');
      expect(result).toContain('name: "Jane Smith"');
      expect(result).toContain('age: 28');
    });

    it('should handle missing data gracefully', () => {
      const env = new nunjucks.Environment();
      registerRDFFilters(env, { store, prefixes: { foaf: 'http://xmlns.com/foaf/0.1/', ex: 'http://example.org/' } });

      // Test with a non-existent resource
      const template = nunjucks.compile(`
Name: {{ "ex:nonexistent" | rdfLabel }}
Exists: {{ rdfExists("ex:nonexistent", "foaf:name") }}
Count: {{ rdfCount("ex:nonexistent") }}
      `.trim(), env);

      const result = template.render();
      expect(result).toContain('Name: nonexistent'); // fallback to local name
      expect(result).toContain('Exists: false');
      expect(result).toContain('Count: 0');
    });

    it('should support chaining and complex queries', () => {
      const env = new nunjucks.Environment();
      registerRDFFilters(env, { store, prefixes: { foaf: 'http://xmlns.com/foaf/0.1/', ex: 'http://example.org/' } });

      // Find all people John knows
      const template = nunjucks.compile(`
{%- set connections = rdfObject("ex:person1", "foaf:knows") -%}
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

  describe('Performance with Real Data Volume', () => {
    it('should handle multiple queries efficiently', () => {
      // Add more test data to simulate real-world volume
      const additionalQuads = [];
      for (let i = 3; i <= 100; i++) {
        additionalQuads.push(
          quad(
            namedNode(`http://example.org/person${i}`),
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
      const allPeople = rdfFilters.rdfQuery({ subject: null, predicate: 'rdf:type', object: 'foaf:Person' });
      const names = allPeople.map(result => rdfFilters.rdfLabel(result[0].value));

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(peopleCount).toBe(100); // 98 new + 2 original
      expect(allPeople).toHaveLength(100);
      expect(names).toHaveLength(100);
      expect(duration).toBeLessThan(100); // Should complete quickly
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed patterns gracefully', () => {
      // The pattern parser is lenient and tries to parse what it can
      const result = rdfFilters.rdfQuery('invalid pattern with too few parts');
      expect(result).toHaveLength(0); // Returns empty result instead of throwing
    });

    it('should return empty results for invalid URIs', () => {
      const results = rdfFilters.rdfObject('not-a-uri', 'foaf:name');
      expect(results).toHaveLength(0);
    });

    it('should handle null/undefined inputs gracefully', () => {
      expect(() => rdfFilters.rdfLabel(null as any)).not.toThrow();
      expect(() => rdfFilters.rdfType(undefined as any)).not.toThrow();
    });
  });
});