import { describe, it, expect } from 'vitest';
import {
  rdfResource,
  rdfLiteral,
  rdfDatatype,
  rdfClass,
  rdfProperty,
  isoDate,
  sparqlSafe,
  blankNode,
  owlRestriction,
  owlClassExpression,
  skosConcept,
  dublinCore,
  validateOwl
} from '../../../src/lib/filters/semantic.js';

describe('Semantic Web Filters', () => {
  describe('rdfResource', () => {
    it('should create valid RDF resource URIs', () => {
      expect(rdfResource('example')).toBe('example');
      expect(rdfResource('My Resource', 'http://example.org/')).toBe('http://example.org/MyResource');
      expect(rdfResource('http://example.org/test')).toBe('http://example.org/test');
    });

    it('should handle special characters', () => {
      expect(rdfResource('test@#$%')).toBe('test');
      expect(rdfResource('snake_case-value')).toBe('snake_case-value');
    });
  });

  describe('rdfLiteral', () => {
    it('should create plain literals', () => {
      expect(rdfLiteral('simple text')).toBe('"simple text"');
      expect(rdfLiteral('')).toBe('""');
    });

    it('should create language-tagged literals', () => {
      expect(rdfLiteral('Hello World', 'en')).toBe('"Hello World"@en');
      expect(rdfLiteral('Bonjour', 'fr')).toBe('"Bonjour"@fr');
    });

    it('should create datatype literals', () => {
      expect(rdfLiteral('2023-12-25T10:00:00Z', 'xsd:dateTime')).toBe('"2023-12-25T10:00:00Z"^^xsd:dateTime');
      expect(rdfLiteral('42', 'xsd:integer')).toBe('"42"^^xsd:integer');
    });

    it('should escape special characters', () => {
      expect(rdfLiteral('He said "Hello"')).toBe('"He said \\"Hello\\""');
      expect(rdfLiteral('Line 1\nLine 2')).toBe('"Line 1\\nLine 2"');
      expect(rdfLiteral('Tab\tSeparated')).toBe('"Tab\\tSeparated"');
    });
  });

  describe('rdfDatatype', () => {
    it('should map common types to XSD', () => {
      expect(rdfDatatype('string')).toBe('xsd:string');
      expect(rdfDatatype('integer')).toBe('xsd:integer');
      expect(rdfDatatype('boolean')).toBe('xsd:boolean');
      expect(rdfDatatype('dateTime')).toBe('xsd:dateTime');
      expect(rdfDatatype('float')).toBe('xsd:float');
    });

    it('should handle qualified types', () => {
      expect(rdfDatatype('xsd:custom')).toBe('xsd:custom');
      expect(rdfDatatype('ex:customType')).toBe('ex:customType');
    });

    it('should handle unknown types', () => {
      expect(rdfDatatype('unknownType')).toBe('xsd:unknownType');
    });
  });

  describe('rdfClass', () => {
    it('should format class names', () => {
      expect(rdfClass('person')).toBe('Person');
      expect(rdfClass('user account')).toBe('UserAccount');
      expect(rdfClass('organization', 'foaf')).toBe('foaf:Organization');
    });

    it('should handle empty inputs', () => {
      expect(rdfClass('')).toBe('');
      expect(rdfClass('test', '')).toBe('Test');
    });
  });

  describe('rdfProperty', () => {
    it('should format property names', () => {
      expect(rdfProperty('first name')).toBe('firstName');
      expect(rdfProperty('HAS_EMAIL')).toBe('hasEmail');
      expect(rdfProperty('knows', 'foaf')).toBe('foaf:knows');
    });

    it('should handle empty inputs', () => {
      expect(rdfProperty('')).toBe('');
      expect(rdfProperty('test', '')).toBe('test');
    });
  });

  describe('isoDate', () => {
    it('should format dates to ISO string', () => {
      const date = new Date('2023-12-25T10:00:00.000Z');
      expect(isoDate(date)).toBe('2023-12-25T10:00:00.000Z');
    });

    it('should handle string dates', () => {
      expect(isoDate('2023-12-25')).toMatch(/2023-12-25T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
    });

    it('should handle empty input', () => {
      expect(isoDate('')).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
    });
  });

  describe('sparqlSafe', () => {
    it('should create SPARQL-safe identifiers', () => {
      expect(sparqlSafe('hello world')).toBe('hello_world');
      expect(sparqlSafe('test@#$%123')).toBe('test____123');
      expect(sparqlSafe('valid_identifier')).toBe('valid_identifier');
    });
  });

  describe('blankNode', () => {
    it('should create blank node identifiers', () => {
      expect(blankNode('test')).toBe('_:test');
      expect(blankNode('complex id')).toBe('_:complex_id');
    });

    it('should generate random blank nodes', () => {
      const blank1 = blankNode();
      const blank2 = blankNode();
      expect(blank1).toMatch(/^_:bn[a-z0-9]{9}$/);
      expect(blank2).toMatch(/^_:bn[a-z0-9]{9}$/);
      expect(blank1).not.toBe(blank2);
    });
  });

  describe('owlRestriction', () => {
    it('should create someValuesFrom restrictions', () => {
      const result = owlRestriction('hasValue', 'someValuesFrom', 'ex:Value', 'ex');
      expect(result).toBe('[ rdf:type owl:Restriction ; owl:onProperty ex:hasValue ; owl:someValuesFrom ex:Value ]');
    });

    it('should create cardinality restrictions', () => {
      const result = owlRestriction('hasChild', 'cardinality', '3', 'family');
      expect(result).toBe('[ rdf:type owl:Restriction ; owl:onProperty family:hasChild ; owl:cardinality "3"^^xsd:nonNegativeInteger ]');
    });

    it('should handle hasValue restrictions', () => {
      const result = owlRestriction('color', 'hasValue', 'red', 'color');
      expect(result).toBe('[ rdf:type owl:Restriction ; owl:onProperty color:color ; owl:hasValue red ]');
    });
  });

  describe('owlClassExpression', () => {
    it('should create union expressions', () => {
      const result = owlClassExpression(['Person', 'Organization'], 'union', 'ex');
      expect(result).toBe('[ rdf:type owl:Class ; owl:unionOf ( ex:Person ex:Organization ) ]');
    });

    it('should create intersection expressions', () => {
      const result = owlClassExpression(['Student', 'Employee'], 'intersection', 'ex');
      expect(result).toBe('[ rdf:type owl:Class ; owl:intersectionOf ( ex:Student ex:Employee ) ]');
    });

    it('should create complement expressions', () => {
      const result = owlClassExpression(['Person'], 'complement', 'ex');
      expect(result).toBe('[ rdf:type owl:Class ; owl:complementOf ex:Person ]');
    });

    it('should handle empty arrays', () => {
      expect(owlClassExpression([], 'union')).toBe('');
    });
  });

  describe('skosConcept', () => {
    it('should create basic SKOS concepts', () => {
      const result = skosConcept('Animal', 'LivingThing', ['Mammal', 'Bird'], 'bio');
      expect(result).toContain('bio:Animal rdf:type skos:Concept');
      expect(result).toContain('skos:broader bio:LivingThing');
      expect(result).toContain('skos:narrower bio:Mammal , bio:Bird');
    });

    it('should handle concepts without broader/narrower', () => {
      const result = skosConcept('TopConcept', undefined, undefined, 'ex');
      expect(result).toBe('ex:TopConcept rdf:type skos:Concept ;');
    });
  });

  describe('dublinCore', () => {
    it('should create Dublin Core metadata', () => {
      const result = dublinCore('Test Title', 'John Doe', '2023-12-25', 'Test description');
      expect(result).toContain('dcterms:title "Test Title"@en');
      expect(result).toContain('dcterms:creator "John Doe"@en');
      expect(result).toContain('dcterms:created "2023-12-25T00:00:00.000Z"^^xsd:dateTime');
      expect(result).toContain('dcterms:description "Test description"@en');
    });

    it('should handle partial metadata', () => {
      const result = dublinCore('Title Only');
      expect(result).toBe('dcterms:title "Title Only"@en');
    });

    it('should handle Date objects', () => {
      const date = new Date('2023-12-25T10:00:00.000Z');
      const result = dublinCore(undefined, undefined, date);
      expect(result).toBe('dcterms:created "2023-12-25T10:00:00.000Z"^^xsd:dateTime');
    });
  });

  describe('validateOwl', () => {
    it('should validate correct OWL ontology', () => {
      const validOwl = `
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix ex: <http://example.org/> .
        
        ex: rdf:type owl:Ontology .
        ex:Person rdf:type owl:Class .
      `;
      
      const result = validateOwl(validOwl);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing ontology declaration', () => {
      const invalidOwl = `
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        ex:Person rdf:type owl:Class .
      `;
      
      const result = validateOwl(invalidOwl);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing ontology declaration');
    });

    it('should detect missing namespace declarations', () => {
      const invalidOwl = `
        ex: rdf:type owl:Ontology .
        ex:Person rdf:type owl:Class .
      `;
      
      const result = validateOwl(invalidOwl);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing OWL namespace declaration');
      expect(result.errors).toContain('Missing RDFS namespace declaration');
    });

    it('should detect missing classes', () => {
      const invalidOwl = `
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        ex: rdf:type owl:Ontology .
      `;
      
      const result = validateOwl(invalidOwl);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('No OWL classes found');
    });

    it('should detect unmatched brackets', () => {
      const invalidOwl = `
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        ex: rdf:type owl:Ontology .
        ex:Person rdf:type owl:Class ;
          rdfs:subClassOf [ rdf:type owl:Restriction .
      `;
      
      const result = validateOwl(invalidOwl);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unmatched brackets in class expressions');
    });
  });
});