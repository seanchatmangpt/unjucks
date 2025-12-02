/**
 * BDD Tests for Enhanced Ontology Project Parser
 * Tests class extraction, property extraction, relationships, and constraints
 */

import { describe, it, beforeEach, afterEach } from 'vitest';
import { expect } from 'chai';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { OntologyProjectParser } from '../../src/ontology/project-generator/ontology-parser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('OntologyProjectParser - London School BDD', () => {
  let parser;
  let tempDir;
  let testOntologyPath;

  beforeEach(async () => {
    parser = new OntologyProjectParser();
    tempDir = join(__dirname, '../temp/ontology-parser');
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup temp files
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  /**
   * Helper: Create test ontology file
   */
  async function createTestOntology(content) {
    testOntologyPath = join(tempDir, 'test-ontology.ttl');
    await fs.writeFile(testOntologyPath, content, 'utf8');
    return testOntologyPath;
  }

  describe('Class Extraction', () => {
    it('should extract owl:Class definitions', async () => {
      const ontology = `
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix ex: <http://example.org/> .

        ex:Person a owl:Class ;
          rdfs:label "Person"@en ;
          rdfs:comment "Represents a human being"@en .

        ex:Organization a owl:Class ;
          rdfs:label "Organization"@en ;
          rdfs:comment "A group or institution"@en .
      `;

      const path = await createTestOntology(ontology);
      const schema = await parser.parseOntology(path);

      expect(schema.classes).to.have.lengthOf(2);

      const person = schema.classes.find(c => c.name === 'Person');
      expect(person).to.exist;
      expect(person.label).to.equal('Person');
      expect(person.comment).to.equal('Represents a human being');
      expect(person.uri).to.equal('http://example.org/Person');
    });

    it('should extract rdfs:Class definitions', async () => {
      const ontology = `
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix ex: <http://example.org/> .

        ex:Product a rdfs:Class ;
          rdfs:label "Product"@en .
      `;

      const path = await createTestOntology(ontology);
      const schema = await parser.parseOntology(path);

      expect(schema.classes).to.have.lengthOf(1);
      expect(schema.classes[0].name).to.equal('Product');
    });

    it('should build class inheritance hierarchy', async () => {
      const ontology = `
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix ex: <http://example.org/> .

        ex:Person a owl:Class ;
          rdfs:label "Person"@en .

        ex:Employee a owl:Class ;
          rdfs:label "Employee"@en ;
          rdfs:subClassOf ex:Person .

        ex:Manager a owl:Class ;
          rdfs:label "Manager"@en ;
          rdfs:subClassOf ex:Employee .
      `;

      const path = await createTestOntology(ontology);
      const schema = await parser.parseOntology(path);

      const employee = schema.classes.find(c => c.name === 'Employee');
      expect(employee.subClassOf).to.include('http://example.org/Person');

      const manager = schema.classes.find(c => c.name === 'Manager');
      expect(manager.subClassOf).to.include('http://example.org/Employee');
    });

    it('should extract class metadata', async () => {
      const ontology = `
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix dcterms: <http://purl.org/dc/terms/> .
        @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
        @prefix ex: <http://example.org/> .

        ex:Person a owl:Class ;
          rdfs:label "Person"@en ;
          dcterms:description "A human being in the system"@en ;
          dcterms:created "2025-01-01"^^<http://www.w3.org/2001/XMLSchema#date> ;
          skos:example "John Doe, Jane Smith"@en .
      `;

      const path = await createTestOntology(ontology);
      const schema = await parser.parseOntology(path);

      const person = schema.classes.find(c => c.name === 'Person');
      expect(person.metadata.description).to.equal('A human being in the system');
      expect(person.metadata.created).to.equal('2025-01-01');
      expect(person.metadata.example).to.equal('John Doe, Jane Smith');
    });
  });

  describe('Property Extraction (DatatypeProperty)', () => {
    it('should extract datatype properties for classes', async () => {
      const ontology = `
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        @prefix ex: <http://example.org/> .

        ex:Person a owl:Class ;
          rdfs:label "Person"@en .

        ex:firstName a owl:DatatypeProperty ;
          rdfs:label "First Name"@en ;
          rdfs:comment "The person's first name"@en ;
          rdfs:domain ex:Person ;
          rdfs:range xsd:string .

        ex:age a owl:DatatypeProperty ;
          rdfs:label "Age"@en ;
          rdfs:domain ex:Person ;
          rdfs:range xsd:integer .
      `;

      const path = await createTestOntology(ontology);
      const schema = await parser.parseOntology(path);

      const person = schema.classes.find(c => c.name === 'Person');
      expect(person.properties).to.have.lengthOf(2);

      const firstName = person.properties.find(p => p.name === 'firstName');
      expect(firstName).to.exist;
      expect(firstName.label).to.equal('First Name');
      expect(firstName.comment).to.equal("The person's first name");
      expect(firstName.range).to.equal('http://www.w3.org/2001/XMLSchema#string');
    });

    it('should detect required properties (minCardinality > 0)', async () => {
      const ontology = `
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        @prefix ex: <http://example.org/> .

        ex:Person a owl:Class ;
          rdfs:label "Person"@en ;
          rdfs:subClassOf [
            a owl:Restriction ;
            owl:onProperty ex:email ;
            owl:minCardinality 1
          ] .

        ex:email a owl:DatatypeProperty ;
          rdfs:domain ex:Person ;
          rdfs:range xsd:string .
      `;

      const path = await createTestOntology(ontology);
      const schema = await parser.parseOntology(path);

      const person = schema.classes.find(c => c.name === 'Person');
      const email = person.properties.find(p => p.name === 'email');

      expect(email.required).to.be.true;
      expect(email.minCardinality).to.equal(1);
    });

    it('should extract cardinality constraints', async () => {
      const ontology = `
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        @prefix ex: <http://example.org/> .

        ex:Person a owl:Class ;
          rdfs:subClassOf [
            a owl:Restriction ;
            owl:onProperty ex:phoneNumber ;
            owl:minCardinality 1 ;
            owl:maxCardinality 5
          ] .

        ex:phoneNumber a owl:DatatypeProperty ;
          rdfs:domain ex:Person ;
          rdfs:range xsd:string .
      `;

      const path = await createTestOntology(ontology);
      const schema = await parser.parseOntology(path);

      const person = schema.classes.find(c => c.name === 'Person');
      const phone = person.properties.find(p => p.name === 'phoneNumber');

      expect(phone.minCardinality).to.equal(1);
      expect(phone.maxCardinality).to.equal(5);
    });
  });

  describe('Relationship Extraction (ObjectProperty)', () => {
    it('should extract object properties as relationships', async () => {
      const ontology = `
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix ex: <http://example.org/> .

        ex:Person a owl:Class ;
          rdfs:label "Person"@en .

        ex:Organization a owl:Class ;
          rdfs:label "Organization"@en .

        ex:worksFor a owl:ObjectProperty ;
          rdfs:label "works for"@en ;
          rdfs:comment "Person employment relationship"@en ;
          rdfs:domain ex:Person ;
          rdfs:range ex:Organization .
      `;

      const path = await createTestOntology(ontology);
      const schema = await parser.parseOntology(path);

      expect(schema.relationships).to.have.lengthOf(1);

      const worksFor = schema.relationships[0];
      expect(worksFor.name).to.equal('worksFor');
      expect(worksFor.from).to.equal('http://example.org/Person');
      expect(worksFor.to).to.equal('http://example.org/Organization');
      expect(worksFor.label).to.equal('works for');
    });

    it('should infer one-to-many cardinality', async () => {
      const ontology = `
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix ex: <http://example.org/> .

        ex:Person a owl:Class .
        ex:Organization a owl:Class .

        ex:worksFor a owl:ObjectProperty, owl:FunctionalProperty ;
          rdfs:domain ex:Person ;
          rdfs:range ex:Organization .
      `;

      const path = await createTestOntology(ontology);
      const schema = await parser.parseOntology(path);

      const worksFor = schema.relationships[0];
      expect(worksFor.cardinality).to.equal('many-to-one');
    });

    it('should infer one-to-one cardinality', async () => {
      const ontology = `
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix ex: <http://example.org/> .

        ex:Person a owl:Class .
        ex:PassportDocument a owl:Class .

        ex:hasPassport a owl:ObjectProperty,
                         owl:FunctionalProperty,
                         owl:InverseFunctionalProperty ;
          rdfs:domain ex:Person ;
          rdfs:range ex:PassportDocument .
      `;

      const path = await createTestOntology(ontology);
      const schema = await parser.parseOntology(path);

      const hasPassport = schema.relationships[0];
      expect(hasPassport.cardinality).to.equal('one-to-one');
    });

    it('should detect inverse relationships', async () => {
      const ontology = `
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix ex: <http://example.org/> .

        ex:Person a owl:Class .
        ex:Organization a owl:Class .

        ex:worksFor a owl:ObjectProperty ;
          rdfs:domain ex:Person ;
          rdfs:range ex:Organization ;
          owl:inverseOf ex:employs .

        ex:employs a owl:ObjectProperty ;
          rdfs:domain ex:Organization ;
          rdfs:range ex:Person .
      `;

      const path = await createTestOntology(ontology);
      const schema = await parser.parseOntology(path);

      const worksFor = schema.relationships.find(r => r.name === 'worksFor');
      expect(worksFor.inverse).to.equal('http://example.org/employs');
    });
  });

  describe('Constraint Extraction', () => {
    it('should extract owl:allValuesFrom constraints', async () => {
      const ontology = `
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix ex: <http://example.org/> .

        ex:Person a owl:Class ;
          rdfs:subClassOf [
            a owl:Restriction ;
            owl:onProperty ex:hasSkill ;
            owl:allValuesFrom ex:Skill
          ] .

        ex:Skill a owl:Class .
        ex:hasSkill a owl:ObjectProperty .
      `;

      const path = await createTestOntology(ontology);
      const schema = await parser.parseOntology(path);

      const constraint = schema.validation.find(
        v => v.constraint === 'allValuesFrom'
      );

      expect(constraint).to.exist;
      expect(constraint.property).to.equal('http://example.org/hasSkill');
      expect(constraint.value).to.equal('http://example.org/Skill');
    });

    it('should extract owl:someValuesFrom constraints', async () => {
      const ontology = `
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix ex: <http://example.org/> .

        ex:Employee a owl:Class ;
          rdfs:subClassOf [
            a owl:Restriction ;
            owl:onProperty ex:worksFor ;
            owl:someValuesFrom ex:Organization
          ] .

        ex:Organization a owl:Class .
        ex:worksFor a owl:ObjectProperty .
      `;

      const path = await createTestOntology(ontology);
      const schema = await parser.parseOntology(path);

      const constraint = schema.validation.find(
        v => v.constraint === 'someValuesFrom'
      );

      expect(constraint).to.exist;
      expect(constraint.value).to.equal('http://example.org/Organization');
    });

    it('should extract owl:hasValue constraints (enum patterns)', async () => {
      const ontology = `
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix ex: <http://example.org/> .

        ex:Admin a owl:Class ;
          rdfs:subClassOf [
            a owl:Restriction ;
            owl:onProperty ex:role ;
            owl:hasValue "administrator"
          ] .

        ex:role a owl:DatatypeProperty .
      `;

      const path = await createTestOntology(ontology);
      const schema = await parser.parseOntology(path);

      const constraint = schema.validation.find(
        v => v.constraint === 'hasValue'
      );

      expect(constraint).to.exist;
      expect(constraint.value).to.equal('administrator');
    });

    it('should extract XSD range constraints', async () => {
      const ontology = `
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        @prefix ex: <http://example.org/> .

        ex:age a owl:DatatypeProperty ;
          rdfs:domain ex:Person ;
          rdfs:range xsd:integer ;
          xsd:minInclusive 0 ;
          xsd:maxInclusive 150 .

        ex:Person a owl:Class .
      `;

      const path = await createTestOntology(ontology);
      const schema = await parser.parseOntology(path);

      const minConstraint = schema.validation.find(
        v => v.constraint === 'minInclusive'
      );
      const maxConstraint = schema.validation.find(
        v => v.constraint === 'maxInclusive'
      );

      expect(minConstraint).to.exist;
      expect(minConstraint.value).to.equal('0');
      expect(maxConstraint.value).to.equal('150');
    });
  });

  describe('Namespace Handling', () => {
    it('should extract namespace prefixes', async () => {
      const ontology = `
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        @prefix ex: <http://example.org/> .

        ex:Person a owl:Class .
      `;

      const path = await createTestOntology(ontology);
      const schema = await parser.parseOntology(path);

      expect(schema.namespaces).to.include.keys('owl', 'rdfs', 'foaf', 'ex');
      expect(schema.namespaces.foaf).to.equal('http://xmlns.com/foaf/0.1/');
    });

    it('should resolve prefixed names to full URIs', async () => {
      const ontology = `
        @prefix ex: <http://example.org/> .
        ex:Person a <http://www.w3.org/2002/07/owl#Class> .
      `;

      const path = await createTestOntology(ontology);
      await parser.parseOntology(path);

      const resolved = parser.resolveUri('ex:Person');
      expect(resolved).to.equal('http://example.org/Person');
    });

    it('should shorten URIs to prefixed form', async () => {
      const ontology = `
        @prefix ex: <http://example.org/> .
        ex:Person a <http://www.w3.org/2002/07/owl#Class> .
      `;

      const path = await createTestOntology(ontology);
      await parser.parseOntology(path);

      const shortened = parser.shortenUri('http://example.org/Person');
      expect(shortened).to.equal('ex:Person');
    });
  });

  describe('Ontology Metadata Extraction', () => {
    it('should extract ontology-level metadata', async () => {
      const ontology = `
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix dcterms: <http://purl.org/dc/terms/> .
        @prefix ex: <http://example.org/> .

        <http://example.org/ontology> a owl:Ontology ;
          dcterms:title "Example Ontology"@en ;
          dcterms:description "A test ontology for demonstration"@en ;
          dcterms:creator "Test Suite"@en ;
          dcterms:created "2025-01-01"^^<http://www.w3.org/2001/XMLSchema#date> ;
          owl:versionInfo "1.0.0"@en .

        ex:Person a owl:Class .
      `;

      const path = await createTestOntology(ontology);
      const schema = await parser.parseOntology(path);

      expect(schema.ontologyMetadata.title).to.equal('Example Ontology');
      expect(schema.ontologyMetadata.description).to.equal('A test ontology for demonstration');
      expect(schema.ontologyMetadata.creator).to.equal('Test Suite');
      expect(schema.ontologyMetadata.version).to.equal('1.0.0');
    });
  });

  describe('Complex Real-World Scenarios', () => {
    it('should parse a complete domain model (Person-Organization-Project)', async () => {
      const ontology = `
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        @prefix ex: <http://example.org/> .

        # Classes
        ex:Person a owl:Class ;
          rdfs:label "Person"@en ;
          rdfs:comment "A human being in the system"@en .

        ex:Organization a owl:Class ;
          rdfs:label "Organization"@en .

        ex:Project a owl:Class ;
          rdfs:label "Project"@en .

        # Person properties
        ex:firstName a owl:DatatypeProperty ;
          rdfs:label "First Name"@en ;
          rdfs:domain ex:Person ;
          rdfs:range xsd:string .

        ex:email a owl:DatatypeProperty ;
          rdfs:domain ex:Person ;
          rdfs:range xsd:string .

        # Relationships
        ex:worksFor a owl:ObjectProperty, owl:FunctionalProperty ;
          rdfs:label "works for"@en ;
          rdfs:domain ex:Person ;
          rdfs:range ex:Organization .

        ex:worksOn a owl:ObjectProperty ;
          rdfs:label "works on"@en ;
          rdfs:domain ex:Person ;
          rdfs:range ex:Project .

        ex:manages a owl:ObjectProperty ;
          rdfs:label "manages"@en ;
          rdfs:domain ex:Organization ;
          rdfs:range ex:Project .
      `;

      const path = await createTestOntology(ontology);
      const schema = await parser.parseOntology(path);

      // Verify classes
      expect(schema.classes).to.have.lengthOf(3);

      // Verify Person class
      const person = schema.classes.find(c => c.name === 'Person');
      expect(person.properties).to.have.lengthOf(2);
      expect(person.relationships).to.have.lengthOf(2);

      // Verify relationships
      expect(schema.relationships).to.have.lengthOf(3);
      const worksFor = schema.relationships.find(r => r.name === 'worksFor');
      expect(worksFor.cardinality).to.equal('many-to-one');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid Turtle syntax gracefully', async () => {
      const invalidOntology = `
        @prefix ex: <http://example.org/> .
        ex:Person a owl:Class
        # Missing period
      `;

      const path = await createTestOntology(invalidOntology);

      await expect(parser.parseOntology(path)).to.be.rejected;
    });

    it('should handle non-existent files gracefully', async () => {
      await expect(
        parser.parseOntology('/non/existent/file.ttl')
      ).to.be.rejected;
    });

    it('should handle ontologies with no classes', async () => {
      const ontology = `
        @prefix ex: <http://example.org/> .
        ex:someProperty a <http://www.w3.org/2002/07/owl#DatatypeProperty> .
      `;

      const path = await createTestOntology(ontology);
      const schema = await parser.parseOntology(path);

      expect(schema.classes).to.have.lengthOf(0);
      expect(schema.relationships).to.have.lengthOf(0);
    });
  });

  describe('Performance and Large Ontologies', () => {
    it('should handle ontologies with 100+ classes efficiently', async () => {
      // Generate a large ontology
      const classes = [];
      for (let i = 0; i < 100; i++) {
        classes.push(`
          ex:Class${i} a owl:Class ;
            rdfs:label "Class ${i}"@en ;
            rdfs:comment "Test class number ${i}"@en .
        `);
      }

      const ontology = `
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix ex: <http://example.org/> .

        ${classes.join('\n')}
      `;

      const path = await createTestOntology(ontology);
      const startTime = Date.now();
      const schema = await parser.parseOntology(path);
      const duration = Date.now() - startTime;

      expect(schema.classes).to.have.lengthOf(100);
      expect(duration).to.be.lessThan(5000); // Should complete in < 5 seconds
    });
  });
});
