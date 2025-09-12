/**
 * Semantic Web/RDF Filters Test Suite (20+ filters)
 * Comprehensive testing of RDF resource generation, SPARQL, and semantic web vocabularies
 */

import { describe, it, expect, beforeAll } from 'vitest';
import nunjucks from 'nunjucks';
import { addCommonFilters } from '../../../src/lib/nunjucks-filters.js';

describe('Semantic Web/RDF Filters (20+ filters)', () => {
  let env;

  beforeAll(() => {
    env = new nunjucks.Environment();
    addCommonFilters(env);
  });

  describe('Core RDF Resource Generation', () => {
    it('should generate RDF resource URIs', () => {
      expect(env.renderString('{{ "Person" | rdfResource }}')).toBe('http://example.org/Person');
      expect(env.renderString('{{ "User" | rdfResource("foaf") }}')).toBe('http://xmlns.com/foaf/0.1/User');
      expect(env.renderString('{{ "Document" | rdfResource("schema") }}')).toBe('https://schema.org/Document');
      
      // Should handle full URIs as-is
      expect(env.renderString('{{ "http://example.com/resource" | rdfResource }}')).toBe('http://example.com/resource');
    });

    it('should generate RDF property URIs', () => {
      expect(env.renderString('{{ "user_name" | rdfProperty }}')).toBe('http://example.org/userName');
      expect(env.renderString('{{ "has_friend" | rdfProperty("foaf") }}')).toBe('http://xmlns.com/foaf/0.1/hasFriend');
      expect(env.renderString('{{ "created_date" | rdfProperty("dct") }}')).toBe('http://purl.org/dc/terms/createdDate');
    });

    it('should generate RDF class URIs', () => {
      expect(env.renderString('{{ "person" | rdfClass }}')).toBe('http://example.org/Person');
      expect(env.renderString('{{ "user_profile" | rdfClass("foaf") }}')).toBe('http://xmlns.com/foaf/0.1/UserProfile');
      expect(env.renderString('{{ "creative_work" | rdfClass("schema") }}')).toBe('https://schema.org/CreativeWork');
    });
  });

  describe('RDF Datatypes and Literals', () => {
    it('should add RDF datatype annotations', () => {
      expect(env.renderString('{{ "John Doe" | rdfDatatype("xsd:string") }}')).toBe('"John Doe"^^xsd:string');
      expect(env.renderString('{{ 42 | rdfDatatype("integer") }}')).toBe('"42"^^xsd:integer');
      expect(env.renderString('{{ "2024-01-15" | rdfDatatype("date") }}')).toBe('"2024-01-15"^^xsd:date');
      expect(env.renderString('{{ true | rdfDatatype("boolean") }}')).toBe('"true"^^xsd:boolean');
    });

    it('should handle common datatype aliases', () => {
      expect(env.renderString('{{ "text" | rdfDatatype("string") }}')).toBe('"text"^^xsd:string');
      expect(env.renderString('{{ 3.14 | rdfDatatype("double") }}')).toBe('"3.14"^^xsd:double');
      expect(env.renderString('{{ "http://example.com" | rdfDatatype("anyuri") }}')).toBe('"http://example.com"^^xsd:anyURI');
    });

    it('should create language-tagged literals', () => {
      expect(env.renderString('{{ "Hello" | rdfLiteral("en") }}')).toBe('"Hello"@en');
      expect(env.renderString('{{ "Bonjour" | rdfLiteral("fr") }}')).toBe('"Bonjour"@fr');
      expect(env.renderString('{{ "Guten Tag" | rdfLiteral("de") }}')).toBe('"Guten Tag"@de');
      
      // Without language tag
      expect(env.renderString('{{ "Simple text" | rdfLiteral }}')).toBe('"Simple text"');
    });

    it('should escape Turtle special characters', () => {
      expect(env.renderString('{{ "Quote: \\"Hello\\"" | turtleEscape }}')).toBe('Quote: \\\\"Hello\\\\"');
      expect(env.renderString('{{ "Line 1\\nLine 2" | turtleEscape }}')).toBe('Line 1\\\\nLine 2');
      expect(env.renderString('{{ "Tab\\there" | turtleEscape }}')).toBe('Tab\\\\there');
    });
  });

  describe('SPARQL Support', () => {
    it('should format SPARQL variable names', () => {
      expect(env.renderString('{{ "person" | sparqlVar }}')).toBe('?person');
      expect(env.renderString('{{ "user_name" | sparqlVar }}')).toBe('?userName');
      expect(env.renderString('{{ "has_friend" | sparqlVar }}')).toBe('?hasFriend');
    });

    it('should format SPARQL FILTER expressions', () => {
      expect(env.renderString('{{ "?age > 18" | sparqlFilter }}')).toBe('FILTER(?age > 18)');
      expect(env.renderString('{{ "REGEX(?name, \\"John\\")" | sparqlFilter }}')).toBe('FILTER(REGEX(?name, "John"))');
    });
  });

  describe('Ontology Naming Conventions', () => {
    it('should apply ontology naming conventions', () => {
      expect(env.renderString('{{ "user_account" | ontologyName("class") }}')).toBe('UserAccount');
      expect(env.renderString('{{ "has_friend" | ontologyName("property") }}')).toBe('hasFriend');
      expect(env.renderString('{{ "john_doe" | ontologyName("individual") }}')).toBe('johnDoe');
      expect(env.renderString('{{ "max_count" | ontologyName("constant") }}')).toBe('MAX_COUNT');
    });

    it('should generate namespace prefixes', () => {
      expect(env.renderString('{{ "http://xmlns.com/foaf/0.1/" | namespacePrefix }}')).toBe('foaf');
      expect(env.renderString('{{ "https://schema.org/" | namespacePrefix }}')).toBe('schema');
      expect(env.renderString('{{ "http://purl.org/dc/terms/" | namespacePrefix }}')).toBe('dcterms');
    });

    it('should generate RDF UUIDs', () => {
      const uuid1 = env.renderString('{{ rdfUuid() }}');
      const uuid2 = env.renderString('{{ rdfUuid() }}');
      
      expect(uuid1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(uuid2).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(uuid1).not.toBe(uuid2);
    });
  });

  describe('Schema.org Integration', () => {
    it('should map to Schema.org types', () => {
      expect(env.renderString('{{ "person" | schemaOrg }}')).toBe('schema:Person');
      expect(env.renderString('{{ "organization" | schema }}')).toBe('schema:Organization');
      expect(env.renderString('{{ "article" | schemaOrg }}')).toBe('schema:Article');
      expect(env.renderString('{{ "custom_type" | schemaOrg }}')).toBe('schema:CustomType');
    });

    it('should handle Schema.org property mappings', () => {
      const schemaTypes = [
        'person', 'organization', 'place', 'event', 'product', 
        'article', 'blogposting', 'webpage', 'book', 'recipe'
      ];
      
      schemaTypes.forEach(type => {
        const result = env.renderString(`{{ "${type}" | schemaOrg }}`);
        expect(result).toContain('schema:');
        expect(result).toMatch(/^schema:[A-Z]/);
      });
    });
  });

  describe('Dublin Core Integration', () => {
    it('should map to Dublin Core properties', () => {
      expect(env.renderString('{{ "title" | dublinCore }}')).toBe('dcterms:title');
      expect(env.renderString('{{ "creator" | dct }}')).toBe('dcterms:creator');
      expect(env.renderString('{{ "description" | dublinCore }}')).toBe('dcterms:description');
      expect(env.renderString('{{ "date_created" | dublinCore }}')).toBe('dcterms:dateCreated');
    });

    it('should handle extended Dublin Core terms', () => {
      const dcTerms = [
        'abstract', 'available', 'bibliographiccitation', 'conformsto',
        'dateaccepted', 'datecopyrighted', 'educationlevel', 'extent'
      ];
      
      dcTerms.forEach(term => {
        const result = env.renderString(`{{ "${term}" | dublinCore }}`);
        expect(result).toContain('dcterms:');
      });
    });
  });

  describe('FOAF Integration', () => {
    it('should map to FOAF vocabulary', () => {
      expect(env.renderString('{{ "name" | foaf }}')).toBe('foaf:name');
      expect(env.renderString('{{ "email" | foaf }}')).toBe('foaf:mbox');
      expect(env.renderString('{{ "homepage" | foaf }}')).toBe('foaf:homepage');
      expect(env.renderString('{{ "knows" | foaf }}')).toBe('foaf:knows');
    });

    it('should handle FOAF person properties', () => {
      const foafProps = [
        'givenname', 'familyname', 'nick', 'age', 'birthday',
        'gender', 'interest', 'currentproject', 'pastproject'
      ];
      
      foafProps.forEach(prop => {
        const result = env.renderString(`{{ "${prop}" | foaf }}`);
        expect(result).toContain('foaf:');
      });
    });
  });

  describe('SKOS Integration', () => {
    it('should map to SKOS concepts', () => {
      expect(env.renderString('{{ "concept" | skos }}')).toBe('skos:Concept');
      expect(env.renderString('{{ "preflabel" | skos }}')).toBe('skos:prefLabel');
      expect(env.renderString('{{ "broader" | skos }}')).toBe('skos:broader');
      expect(env.renderString('{{ "narrower" | skos }}')).toBe('skos:narrower');
    });

    it('should handle SKOS hierarchical relationships', () => {
      const skosTerms = [
        'broader', 'narrower', 'related', 'broadertransitive',
        'narrowertransitive', 'exactmatch', 'closematch'
      ];
      
      skosTerms.forEach(term => {
        const result = env.renderString(`{{ "${term}" | skos }}`);
        expect(result).toContain('skos:');
      });
    });
  });

  describe('OWL Integration', () => {
    it('should map to OWL constructs', () => {
      expect(env.renderString('{{ "class" | owl }}')).toBe('owl:Class');
      expect(env.renderString('{{ "objectproperty" | owl }}')).toBe('owl:ObjectProperty');
      expect(env.renderString('{{ "datatypeproperty" | owl }}')).toBe('owl:DatatypeProperty');
      expect(env.renderString('{{ "sameas" | owl }}')).toBe('owl:sameAs');
    });

    it('should handle OWL property characteristics', () => {
      const owlProps = [
        'functionalproperty', 'inversefunctionalproperty', 'transitiveproperty',
        'symmetricproperty', 'asymmetricproperty', 'reflexiveproperty'
      ];
      
      owlProps.forEach(prop => {
        const result = env.renderString(`{{ "${prop}" | owl }}`);
        expect(result).toContain('owl:');
      });
    });
  });

  describe('RDF Advanced Utilities', () => {
    it('should generate named graph URIs', () => {
      expect(env.renderString('{{ "user_data" | rdfGraph }}')).toBe('http://example.org/graphs/user-data');
      expect(env.renderString('{{ "metadata" | rdfGraph("schema") }}')).toBe('https://schema.org/graphs/metadata');
    });

    it('should generate RDF lists', () => {
      expect(env.renderString('{{ ["apple", "banana", "orange"] | rdfList }}')).toBe('( "apple" "banana" "orange" )');
      expect(env.renderString('{{ ["http://ex.org/1", "http://ex.org/2"] | rdfList("resource") }}')).toBe('( <http://ex.org/1> <http://ex.org/2> )');
      expect(env.renderString('{{ [] | rdfList }}')).toBe('rdf:nil');
    });

    it('should generate blank node identifiers', () => {
      const bnode1 = env.renderString('{{ blankNode() }}');
      const bnode2 = env.renderString('{{ blankNode("person") }}');
      
      expect(bnode1).toMatch(/^_:b[a-z0-9]{8}$/);
      expect(bnode2).toMatch(/^_:person[a-z0-9]{8}$/);
      expect(bnode1).not.toBe(bnode2);
    });

    it('should create compact URIs (CURIEs)', () => {
      expect(env.renderString('{{ "http://xmlns.com/foaf/0.1/Person" | curie }}')).toBe('foaf:Person');
      expect(env.renderString('{{ "https://schema.org/Person" | curie }}')).toBe('schema:Person');
      expect(env.renderString('{{ "http://www.w3.org/1999/02/22-rdf-syntax-ns#type" | curie }}')).toBe('rdf:type');
    });
  });

  describe('Namespace Shortcut Filters', () => {
    it('should provide namespace shortcuts', () => {
      expect(env.renderString('{{ "type" | rdfs }}')).toBe('rdfs:type');
      expect(env.renderString('{{ "Dataset" | void }}')).toBe('void:Dataset');
      expect(env.renderString('{{ "Entity" | prov }}')).toBe('prov:Entity');
      expect(env.renderString('{{ "string" | xsd }}')).toBe('xsd:string');
    });
  });

  describe('Global Namespace Access', () => {
    it('should provide global namespace mappings', () => {
      const namespaces = env.renderString('{{ rdfNamespaces.foaf }}');
      expect(namespaces).toBe('http://xmlns.com/foaf/0.1/');
      
      const schemaNamespace = env.renderString('{{ rdfNamespaces.schema }}');
      expect(schemaNamespace).toBe('https://schema.org/');
    });

    it('should provide global type mappings', () => {
      const personType = env.renderString('{{ schemaTypes.person }}');
      expect(personType).toBe('Person');
      
      const orgType = env.renderString('{{ schemaTypes.organization }}');
      expect(orgType).toBe('Organization');
    });

    it('should provide global property mappings', () => {
      const foafName = env.renderString('{{ foafProperties.name }}');
      expect(foafName).toBe('name');
      
      const dcTitle = env.renderString('{{ dctermsProperties.title }}');
      expect(dcTitle).toBe('title');
    });
  });

  describe('Complex RDF Template Generation', () => {
    it('should generate complete RDF triples', () => {
      const template = `
        {{ "john_doe" | rdfResource }} {{ "name" | rdfProperty("foaf") }} {{ "John Doe" | rdfLiteral("en") }} .
        {{ "john_doe" | rdfResource }} {{ "age" | rdfProperty("foaf") }} {{ 30 | rdfDatatype("integer") }} .
        {{ "john_doe" | rdfResource }} {{ "knows" | rdfProperty("foaf") }} {{ "jane_doe" | rdfResource }} .
      `;
      
      const result = env.renderString(template);
      expect(result).toContain('http://example.org/john_doe');
      expect(result).toContain('http://xmlns.com/foaf/0.1/name');
      expect(result).toContain('"John Doe"@en');
      expect(result).toContain('"30"^^xsd:integer');
    });

    it('should generate SPARQL queries', () => {
      const template = `
        SELECT {{ "name" | sparqlVar }} {{ "age" | sparqlVar }}
        WHERE {
          {{ "person" | sparqlVar }} {{ "name" | rdfProperty("foaf") }} {{ "name" | sparqlVar }} .
          {{ "person" | sparqlVar }} {{ "age" | rdfProperty("foaf") }} {{ "age" | sparqlVar }} .
          {{ "?age > 21" | sparqlFilter }}
        }
      `;
      
      const result = env.renderString(template);
      expect(result).toContain('SELECT ?name ?age');
      expect(result).toContain('?person');
      expect(result).toContain('FILTER(?age > 21)');
    });
  });

  describe('Error Handling', () => {
    it('should handle null/undefined values', () => {
      expect(env.renderString('{{ null | rdfResource }}')).toBe('');
      expect(env.renderString('{{ undefined | sparqlVar }}')).toBe('');
      expect(env.renderString('{{ null | schemaOrg }}')).toBe('null');
    });

    it('should handle invalid inputs gracefully', () => {
      expect(env.renderString('{{ 123 | rdfResource }}')).toBe('123');
      expect(env.renderString('{{ [] | sparqlVar }}')).toBe('');
      expect(env.renderString('{{ {} | turtleEscape }}')).toBe('[object Object]');
    });
  });

  describe('Performance Tests', () => {
    it('should handle bulk RDF generation efficiently', () => {
      const start = this.getDeterministicTimestamp();
      
      for (let i = 0; i < 100; i++) {
        env.renderString(`
          {{ "person_${i}" | rdfResource }} {{ "name" | rdfProperty("foaf") }} {{ "Person ${i}" | rdfLiteral("en") }} .
        `);
      }
      
      const end = this.getDeterministicTimestamp();
      expect(end - start).toBeLessThan(1000);
    });

    it('should handle complex semantic transformations efficiently', () => {
      const template = `
        {{ "user_profile" | rdfClass | curie }} {{ "type" | rdfs }} {{ "class" | owl }} .
        {{ "has_name" | rdfProperty("foaf") }} {{ "domain" | rdfs }} {{ "person" | rdfClass("foaf") }} .
        {{ "john" | rdfResource }} {{ "name" | foaf }} {{ "John Doe" | rdfLiteral("en") }} .
      `;
      
      const start = this.getDeterministicTimestamp();
      for (let i = 0; i < 50; i++) {
        env.renderString(template);
      }
      const end = this.getDeterministicTimestamp();
      
      expect(end - start).toBeLessThan(500);
    });
  });
});