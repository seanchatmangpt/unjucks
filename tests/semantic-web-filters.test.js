/**
 * Tests for Semantic Web Filters
 * Verifies RDF/Turtle template processing capabilities
 */

import { describe, it, expect } from 'vitest';
import nunjucks from 'nunjucks';
import { addCommonFilters } from '../src/lib/nunjucks-filters.js';
import {
  rdfResource,
  rdfProperty,
  rdfClass,
  rdfDatatype,
  rdfLiteral,
  sparqlVar,
  turtleEscape,
  ontologyName,
  namespacePrefix,
  rdfUuid,
  schemaOrg,
  dublinCore,
  foaf,
  skos,
  owl,
  rdfGraph,
  sparqlFilter,
  rdfList,
  blankNode,
  curie,
  COMMON_NAMESPACES
} from '../src/lib/semantic-web-filters.js';

describe('Semantic Web Filters', () => {
  let env;

  beforeEach(() => {
    env = new nunjucks.Environment();
    addCommonFilters(env);
  });

  describe('Core RDF/Turtle Filters', () => {
    it('should generate RDF resource URIs', () => {
      expect(rdfResource('Person', 'ex')).toBe('http://example.org/Person');
      expect(rdfResource('User', 'schema')).toBe('http://schema.org/User');
      expect(rdfResource('http://example.com/resource')).toBe('http://example.com/resource');
    });

    it('should generate RDF property URIs', () => {
      expect(rdfProperty('full_name', 'ex')).toBe('http://example.org/fullName');
      expect(rdfProperty('email_address', 'foaf')).toBe('http://xmlns.com/foaf/0.1/emailAddress');
    });

    it('should generate RDF class URIs', () => {
      expect(rdfClass('user_account', 'ex')).toBe('http://example.org/UserAccount');
      expect(rdfClass('person', 'schema')).toBe('http://schema.org/Person');
    });

    it('should add RDF datatype annotations', () => {
      expect(rdfDatatype('John Doe', 'string')).toBe('"John Doe"^^xsd:string');
      expect(rdfDatatype('2024-01-01', 'date')).toBe('"2024-01-01"^^xsd:date');
      expect(rdfDatatype('2024-01-01T10:00:00Z', 'xsd:dateTime')).toBe('"2024-01-01T10:00:00Z"^^xsd:dateTime');
      expect(rdfDatatype(42, 'integer')).toBe('"42"^^xsd:integer');
      expect(rdfDatatype(true, 'boolean')).toBe('"true"^^xsd:boolean');
    });

    it('should create language-tagged literals', () => {
      expect(rdfLiteral('Hello World', 'en')).toBe('"Hello World"@en');
      expect(rdfLiteral('Bonjour le monde', 'fr')).toBe('"Bonjour le monde"@fr');
      expect(rdfLiteral('Hola Mundo', 'es')).toBe('"Hola Mundo"@es');
      expect(rdfLiteral('Simple string')).toBe('"Simple string"');
    });

    it('should format SPARQL variables', () => {
      expect(sparqlVar('person_name')).toBe('?personName');
      expect(sparqlVar('email')).toBe('?email');
      expect(sparqlVar('user_id')).toBe('?userId');
    });

    it('should escape Turtle special characters', () => {
      expect(turtleEscape('Line 1\\nLine 2')).toBe('Line 1\\\\nLine 2');
      expect(turtleEscape('Quote: "Hello"')).toBe('Quote: \\"Hello\\"');
      expect(turtleEscape('Tab\\tSeparated')).toBe('Tab\\\\tSeparated');
    });

    it('should generate RDF UUIDs', () => {
      const uuid = rdfUuid();
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
  });

  describe('Ontology Naming Conventions', () => {
    it('should format names according to ontology conventions', () => {
      expect(ontologyName('user_account', 'class')).toBe('UserAccount');
      expect(ontologyName('has_email', 'property')).toBe('hasEmail');
      expect(ontologyName('john_doe', 'individual')).toBe('johnDoe');
      expect(ontologyName('max_count', 'constant')).toBe('MAX_COUNT');
    });

    it('should extract namespace prefixes from URIs', () => {
      expect(namespacePrefix('http://schema.org/Person')).toBe('schema');
      expect(namespacePrefix('http://xmlns.com/foaf/0.1/Person')).toBe('foaf');
      expect(namespacePrefix('http://example.com/ontology#Class')).toBe('example');
    });
  });

  describe('Semantic Vocabularies', () => {
    it('should map to Schema.org types', () => {
      expect(schemaOrg('person')).toBe('schema:Person');
      expect(schemaOrg('organization')).toBe('schema:Organization');
      expect(schemaOrg('CustomType')).toBe('schema:CustomType');
    });

    it('should map to Dublin Core properties', () => {
      expect(dublinCore('title')).toBe('dcterms:title');
      expect(dublinCore('creator')).toBe('dcterms:creator');
      expect(dublinCore('custom_prop')).toBe('dcterms:customProp');
    });

    it('should map to FOAF vocabulary', () => {
      expect(foaf('name')).toBe('foaf:name');
      expect(foaf('email')).toBe('foaf:mbox');
      expect(foaf('custom_property')).toBe('foaf:customProperty');
    });

    it('should map to SKOS concepts', () => {
      expect(skos('concept')).toBe('skos:Concept');
      expect(skos('preflabel')).toBe('skos:prefLabel');
      expect(skos('broader')).toBe('skos:broader');
    });

    it('should map to OWL constructs', () => {
      expect(owl('class')).toBe('owl:Class');
      expect(owl('objectproperty')).toBe('owl:ObjectProperty');
      expect(owl('sameas')).toBe('owl:sameAs');
    });
  });

  describe('Advanced RDF Utilities', () => {
    it('should generate named graph URIs', () => {
      expect(rdfGraph('user data')).toBe('http://example.org/graphs/user-data');
      expect(rdfGraph('metadata', 'schema')).toBe('http://schema.org/graphs/metadata');
    });

    it('should format SPARQL FILTER expressions', () => {
      expect(sparqlFilter('?age > 18')).toBe('FILTER(?age > 18)');
      expect(sparqlFilter('LANG(?name) = "en"')).toBe('FILTER(LANG(?name) = "en")');
    });

    it('should generate RDF list structures', () => {
      expect(rdfList(['apple', 'banana', 'cherry'])).toBe('( "apple" "banana" "cherry" )');
      expect(rdfList(['http://ex.org/a', 'http://ex.org/b'], 'resource')).toBe('( <http://ex.org/a> <http://ex.org/b> )');
      expect(rdfList([])).toBe('rdf:nil');
    });

    it('should generate blank node identifiers', () => {
      const bnode = blankNode();
      expect(bnode).toMatch(/^_:b[a-z0-9]{8}$/);
      
      const customBnode = blankNode('person');
      expect(customBnode).toMatch(/^_:person[a-z0-9]{8}$/);
    });

    it('should create compact URIs (CURIEs)', () => {
      expect(curie('http://schema.org/Person')).toBe('schema:Person');
      expect(curie('http://xmlns.com/foaf/0.1/name')).toBe('foaf:name');
      expect(curie('http://unknown.org/property')).toBe('http://unknown.org/property');
    });
  });

  describe('Template Integration', () => {
    it('should work in Nunjucks templates for RDF generation', () => {
      const template = `
@prefix ex: <{{ baseUri | rdfResource }}/> .
@prefix schema: <http://schema.org/> .

ex:{{ entityName | kebabCase | rdfResource }} a {{ entityType | schemaOrg }} ;
    schema:{{ propName | camelCase }} {{ value | rdfLiteral('en') }} ;
    {{ 'created' | dublinCore }} {{ now() | rdfDatatype('xsd:dateTime') }} .
      `.trim();

      const result = env.renderString(template, {
        baseUri: 'http://example.org',
        entityName: 'john-doe',
        entityType: 'person',
        propName: 'full name',
        value: 'John Doe'
      });

      expect(result).toContain('ex:http://example.org/john-doe a schema:Person');
      expect(result).toContain('schema:fullName &quot;John Doe&quot;@en');
      expect(result).toContain('dcterms:created');
    });

    it('should generate SPARQL queries with variables', () => {
      const template = `
SELECT {{ 'person' | sparqlVar }} {{ 'name' | sparqlVar }} {{ 'email' | sparqlVar }}
WHERE {
  {{ 'person' | sparqlVar }} a {{ 'Person' | schemaOrg }} ;
             {{ 'name' | foaf }} {{ 'name' | sparqlVar }} ;
             {{ 'email' | foaf }} {{ 'email' | sparqlVar }} .
  {{ 'LANG(?name) = "en"' | sparqlFilter }}
}
      `.trim();

      const result = env.renderString(template);
      
      expect(result).toContain('SELECT ?person ?name ?email');
      expect(result).toContain('?person a schema:Person');
      expect(result).toContain('foaf:name ?name');
      expect(result).toContain('foaf:mbox ?email');
      expect(result).toContain('FILTER(LANG(?name) = &quot;en&quot;)');
    });

    it('should chain with existing case conversion filters', () => {
      const template = `{{ name | pascalCase | rdfClass('schema') }}`;
      const result = env.renderString(template, { name: 'user_account' });
      expect(result).toBe('http://schema.org/UserAccount');
    });

    it('should integrate with date formatting', () => {
      const template = `{{ now() | formatDate() | rdfDatatype('xsd:date') }}`;
      const result = env.renderString(template);
      expect(result).toContain('xsd:date');
      expect(result).toContain('2025-09-07');
    });

    it('should work with faker integration', () => {
      const template = `
ex:{{ fakeUuid() | rdfResource }} a {{ 'Person' | schemaOrg }} ;
    {{ 'name' | foaf }} {{ fakeName() | rdfLiteral('en') }} ;
    {{ 'email' | foaf }} <mailto:{{ fakeEmail() }}> .
      `.trim();

      const result = env.renderString(template);
      expect(result).toContain('a schema:Person');
      expect(result).toContain('foaf:name');
      expect(result).toContain('foaf:mbox <mailto:');
    });
  });

  describe('Complex RDF/Turtle Templates', () => {
    it('should generate complete ontology definitions', () => {
      const template = `
@prefix ex: <http://example.org/ontology#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:{{ className | pascalCase | ontologyName('class') }} a {{ 'class' | owl }} ;
    {{ 'label' | rdfs }} {{ label | rdfLiteral('en') }} ;
    {{ 'comment' | rdfs }} {{ comment | rdfLiteral('en') }} .

ex:{{ propertyName | camelCase | ontologyName('property') }} a {{ 'objectproperty' | owl }} ;
    {{ 'label' | rdfs }} {{ propertyLabel | rdfLiteral('en') }} ;
    {{ 'domain' | rdfs }} ex:{{ className | pascalCase | ontologyName('class') }} ;
    {{ 'range' | rdfs }} {{ rangeClass | schemaOrg }} .
      `.trim();

      const result = env.renderString(template, {
        className: 'person_profile',
        label: 'Person Profile',
        comment: 'Represents a person profile information',
        propertyName: 'has_contact_info',
        propertyLabel: 'has contact information',
        rangeClass: 'contactpoint'
      });

      expect(result).toContain('ex:PersonProfile a owl:Class');
      expect(result).toContain('&quot;Person Profile&quot;@en');
      expect(result).toContain('ex:hasContactInfo a owl:ObjectProperty');
      expect(result).toContain('rdfs:range schema:ContactPoint');
    });

    it('should generate SKOS concept schemes', () => {
      const template = `
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix ex: <http://example.org/concepts/> .

ex:{{ schemeName | kebabCase }} a {{ 'conceptscheme' | skos }} ;
    {{ 'title' | dublinCore }} {{ schemeTitle | rdfLiteral('en') }} ;
    {{ 'hastopconcept' | skos }} ex:{{ topConcept | kebabCase }} .

ex:{{ topConcept | kebabCase }} a {{ 'concept' | skos }} ;
    {{ 'preflabel' | skos }} {{ topConceptLabel | rdfLiteral('en') }} ;
    {{ 'inscheme' | skos }} ex:{{ schemeName | kebabCase }} ;
    {{ 'narrower' | skos }} (
{% for concept in narrowerConcepts %}
      ex:{{ concept | kebabCase }}{% if not loop.last %} {% endif %}
{% endfor %}
    ) .
      `.trim();

      const result = env.renderString(template, {
        schemeName: 'programming_languages',
        schemeTitle: 'Programming Languages Classification',
        topConcept: 'programming_language',
        topConceptLabel: 'Programming Language',
        narrowerConcepts: ['functional_language', 'object_oriented_language', 'scripting_language']
      });

      expect(result).toContain('ex:programming-languages a skos:ConceptScheme');
      expect(result).toContain('skos:hasTopConcept ex:programming-language');
      expect(result).toContain('&quot;Programming Languages Classification&quot;@en');
      expect(result).toContain('ex:functional-language');
      expect(result).toContain('ex:object-oriented-language');
    });

    it('should generate JSON-LD with semantic web filters', () => {
      const template = `{
  "@context": {
    "schema": "http://schema.org/",
    "ex": "http://example.org/"
  },
  "@id": "ex:{{ id | kebabCase }}",
  "@type": "{{ type | pascalCase }}",
  "{{ 'name' | camelCase }}": {{ name | rdfLiteral('en') | dump }},
  "{{ 'email' | camelCase }}": "mailto:{{ email }}",
  "{{ 'created' | camelCase }}": {{ createdDate | rdfDatatype('xsd:dateTime') | dump }},
  "{{ 'tags' | camelCase }}": {{ tags | rdfList | dump }}
}`;

      const result = env.renderString(template, {
        id: 'john_doe_profile',
        type: 'person',
        name: 'John Doe',
        email: 'john@example.com',
        createdDate: '2024-01-01T10:00:00Z',
        tags: ['developer', 'javascript', 'nodejs']
      });

      // JSON output will be HTML escaped, so test for content instead
      expect(result).toContain('ex:john-doe-profile');
      expect(result).toContain('Person');
      expect(result).toContain('John Doe');
      expect(result).toContain('2024-01-01T10:00:00Z');
      expect(result).toContain('developer');
    });
  });

  describe('Error Handling', () => {
    it('should handle null and undefined values gracefully', () => {
      expect(rdfResource(null)).toBeNull();
      expect(rdfProperty(undefined)).toBeUndefined();
      expect(rdfDatatype(null, 'string')).toBeNull();
      expect(rdfLiteral(undefined, 'en')).toBeUndefined();
    });

    it('should handle non-string inputs', () => {
      expect(rdfResource(123)).toBe(123);
      expect(sparqlVar({})).toEqual({});
      expect(ontologyName([])).toEqual([]);
    });

    it('should provide fallbacks for invalid URIs', () => {
      expect(namespacePrefix('invalid-uri')).toBe('invalidu');
      expect(namespacePrefix('')).toBe('ns');
    });
  });
});