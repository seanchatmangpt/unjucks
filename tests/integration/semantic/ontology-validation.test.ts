import { describe, it, expect, beforeEach } from 'vitest';
import { promises as fs } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Unjucks } from '../../../src/index.js';
import { validateOwl } from '../../../src/lib/filters/semantic.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Ontology Generation Validation', () => {
  let unjucks: Unjucks;
  let testData: any;

  beforeEach(async () => {
    // Initialize Unjucks with fixtures directory
    unjucks = new Unjucks({
      templateDirs: [resolve(__dirname, '../../fixtures/ontologies')],
      outputDir: resolve(__dirname, '../../.tmp')
    });

    // Load test data
    const dataPath = resolve(__dirname, '../../fixtures/data/ontology-test-data.json');
    const dataContent = await fs.readFile(dataPath, 'utf-8');
    testData = JSON.parse(dataContent);
  });

  describe('Comprehensive Ontology Pattern Testing', () => {
    it('should generate valid basic ontology with all semantic filters', async () => {
      const result = await unjucks.render('basic-ontology.owl.njk', testData.basicOntology);
      
      // Validate overall structure
      const validation = validateOwl(result);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // Test rdfResource filter
      expect(result).toContain('<http://example.org/person/>');
      expect(result).toMatch(/person:Person.*rdf:type.*owl:Class/);
      
      // Test rdfLiteral filter with language tags
      expect(result).toContain('"Person"@en');
      expect(result).toContain('"A human being"@en');
      expect(result).toContain('"1.0.0"@en');
      
      // Test rdfClass filter with PascalCase conversion
      expect(result).toContain('person:Person');
      expect(result).toContain('person:Organization');
      expect(result).toContain('person:Employee');
      
      // Test rdfProperty filter with camelCase conversion
      expect(result).toContain('person:firstName');
      expect(result).toContain('person:worksFor');
      
      // Test rdfDatatype filter
      expect(result).toContain('xsd:string');
      
      // Test class hierarchy
      expect(result).toContain('rdfs:subClassOf foaf:Agent');
      expect(result).toContain('owl:disjointWith person:Person');
      
      // Test property characteristics
      expect(result).toContain('rdf:type owl:FunctionalProperty');
      expect(result).toContain('owl:inverseOf person:employs');
    });

    it('should generate domain ontology with complex restrictions', async () => {
      const result = await unjucks.render('domain-ontology.owl.njk', testData.ecommerceDomain);
      
      const validation = validateOwl(result);
      expect(validation.valid).toBe(true);
      
      // Test owlRestriction patterns
      expect(result).toContain('owl:onProperty ecom:hasPrice');
      expect(result).toContain('owl:someValuesFrom ecom:Price');
      expect(result).toContain('owl:minCardinality "1"^^xsd:nonNegativeInteger');
      expect(result).toContain('owl:allValuesFrom ecom:Address');
      
      // Test enumeration classes with owl:oneOf
      expect(result).toContain('owl:oneOf ( ecom:Pending ecom:Processing ecom:Shipped ecom:Delivered )');
      expect(result).toContain('ecom:Pending rdf:type owl:NamedIndividual');
      
      // Test Dublin Core metadata with isoDate filter
      expect(result).toContain('dcterms:created "2023-01-01T00:00:00.000Z"^^xsd:dateTime');
      expect(result).toContain('dcterms:modified "2023-12-01T00:00:00.000Z"^^xsd:dateTime');
      
      // Test namespace imports
      expect(result).toContain('owl:imports <http://xmlns.com/foaf/0.1/>');
      expect(result).toContain('owl:imports <http://purl.org/dc/terms/>');
    });

    it('should generate upper ontology with fundamental concepts', async () => {
      const upperData = {
        name: 'FoundationalOntology',
        nsPrefix: 'found',
        namespace: 'http://example.org/foundational',
        title: 'Foundational Upper Ontology',
        description: 'Top-level conceptual framework',
        version: '2.0.0'
      };

      const result = await unjucks.render('upper-ontology.owl.njk', upperData);
      
      const validation = validateOwl(result);
      expect(validation.valid).toBe(true);
      
      // Test top-level disjoint classes
      expect(result).toContain('found:Abstract rdf:type owl:Class');
      expect(result).toContain('found:Concrete rdf:type owl:Class');
      expect(result).toContain('owl:disjointWith found:Concrete');
      expect(result).toContain('owl:disjointWith found:Abstract');
      
      // Test transitive properties
      expect(result).toContain('found:partOf rdf:type owl:ObjectProperty');
      expect(result).toContain('rdf:type owl:TransitiveProperty');
      expect(result).toContain('owl:inverseOf found:hasPart');
      
      // Test functional properties
      expect(result).toContain('found:hasTemporalExtent rdf:type owl:ObjectProperty');
      expect(result).toContain('rdf:type owl:FunctionalProperty');
      
      // Test complex class definitions with restrictions
      expect(result).toContain('owl:equivalentClass [');
      expect(result).toContain('rdf:type owl:Restriction');
      expect(result).toContain('owl:onProperty found:hasTemporalExtent');
      expect(result).toContain('owl:someValuesFrom time:TemporalEntity');
    });

    it('should generate application ontology with business rules', async () => {
      const result = await unjucks.render('application-ontology.owl.njk', testData.taskManagerApp);
      
      const validation = validateOwl(result);
      expect(validation.valid).toBe(true);
      
      // Test SKOS vocabulary integration
      expect(result).toContain('skos:prefLabel "Task"@en');
      expect(result).toContain('skos:definition');
      
      // Test business rule restrictions
      expect(result).toContain('owl:onProperty task:assignedTo');
      expect(result).toContain('owl:someValuesFrom task:User');
      expect(result).toContain('"Every task must be assigned to a user"@en');
      
      // Test provenance with PROV ontology
      expect(result).toContain('prov:wasGeneratedBy [');
      expect(result).toContain('rdf:type prov:Activity');
      expect(result).toContain('prov:used "Unjucks Ontology Generator"@en');
      expect(result).toContain('prov:endedAtTime "2023-12-25T10:00:00.000Z"^^xsd:dateTime');
      
      // Test business process modeling
      expect(result).toContain('task:TaskCreationProcess rdf:type owl:Class');
      expect(result).toContain('task:ValidateInputStep rdf:type owl:Class');
      expect(result).toContain('task:hasPrecondition task:UserAuthenticatedCondition');
      
      // Test named individuals
      expect(result).toContain('task:DefaultProject rdf:type owl:NamedIndividual');
      expect(result).toContain('task:title "Default Tasks"@en');
      
      // Test module organization
      expect(result).toContain('dcterms:isPartOf task:CoreModule');
    });

    it('should generate complex mapping ontology with alignments', async () => {
      const result = await unjucks.render('mapping-ontology.owl.njk', testData.personAlignment);
      
      const validation = validateOwl(result);
      expect(validation.valid).toBe(true);
      
      // Test external namespace imports
      expect(result).toContain('@prefix foaf: <http://xmlns.com/foaf/0.1/> .');
      expect(result).toContain('@prefix schema: <https://schema.org/> .');
      
      // Test class equivalence mappings
      expect(result).toContain('person:Person owl:equivalentClass foaf:Person');
      expect(result).toContain('align:mappingConfidence "0.95"^^xsd:float');
      expect(result).toContain('align:mappingNotes "Direct conceptual alignment"@en');
      
      // Test property mappings with transformations
      expect(result).toContain('person:firstName owl:equivalentProperty foaf:givenName');
      expect(result).toContain('align:hasTransformation [');
      expect(result).toContain('align:transformationType "format"');
      expect(result).toContain('align:transformationPattern "^[A-Z].*"');
      expect(result).toContain('align:transformationFunction "capitalize"');
      
      // Test complex class expressions
      expect(result).toContain('align:EmployeeConcept rdf:type owl:Class');
      expect(result).toContain('owl:intersectionOf (');
      expect(result).toContain('person:Person person:Worker');
      expect(result).toContain('owl:equivalentClass schema:Employee');
      
      // Test bridge axioms with annotations
      expect(result).toContain('owl:annotatedSource person:Person');
      expect(result).toContain('owl:annotatedProperty owl:equivalentClass');
      expect(result).toContain('owl:annotatedTarget foaf:Person');
      expect(result).toContain('align:bridgeType "equivalence"');
      expect(result).toContain('align:bridgeConfidence "1"^^xsd:float');
      
      // Test SKOS alignment relations
      expect(result).toContain('skos:exactMatch');
      expect(result).toContain('skos:closeMatch');
      expect(result).toContain('skos:broadMatch');
      expect(result).toContain('skos:narrowMatch');
    });
  });

  describe('Advanced Semantic Filter Testing', () => {
    it('should test all RDF datatype mappings', async () => {
      const datatypeTest = {
        name: 'DatatypeTest',
        nsPrefix: 'dt',
        namespace: 'http://example.org/datatype',
        title: 'Datatype Test Ontology',
        description: 'Testing all XSD datatype mappings',
        classes: [{ name: 'TestClass', description: 'Test class for datatypes' }],
        properties: [
          { name: 'stringProp', type: 'datatype', domain: 'TestClass', range: 'string' },
          { name: 'intProp', type: 'datatype', domain: 'TestClass', range: 'integer' },
          { name: 'floatProp', type: 'datatype', domain: 'TestClass', range: 'float' },
          { name: 'boolProp', type: 'datatype', domain: 'TestClass', range: 'boolean' },
          { name: 'dateProp', type: 'datatype', domain: 'TestClass', range: 'dateTime' },
          { name: 'uriProp', type: 'datatype', domain: 'TestClass', range: 'anyURI' },
          { name: 'decimalProp', type: 'datatype', domain: 'TestClass', range: 'decimal' },
          { name: 'durationProp', type: 'datatype', domain: 'TestClass', range: 'duration' },
          { name: 'langProp', type: 'datatype', domain: 'TestClass', range: 'language' },
          { name: 'tokenProp', type: 'datatype', domain: 'TestClass', range: 'token' }
        ]
      };

      const result = await unjucks.render('basic-ontology.owl.njk', datatypeTest);
      
      // Test all XSD datatype mappings
      expect(result).toContain('rdfs:range xsd:string');
      expect(result).toContain('rdfs:range xsd:integer');
      expect(result).toContain('rdfs:range xsd:float');
      expect(result).toContain('rdfs:range xsd:boolean');
      expect(result).toContain('rdfs:range xsd:dateTime');
      expect(result).toContain('rdfs:range xsd:anyURI');
      expect(result).toContain('rdfs:range xsd:decimal');
      expect(result).toContain('rdfs:range xsd:duration');
      expect(result).toContain('rdfs:range xsd:language');
      expect(result).toContain('rdfs:range xsd:token');
    });

    it('should test property characteristics mappings', async () => {
      const characteristicsTest = {
        name: 'CharacteristicsTest',
        nsPrefix: 'char',
        namespace: 'http://example.org/characteristics',
        title: 'Property Characteristics Test',
        description: 'Testing all property characteristics',
        classes: [
          { name: 'Person', description: 'A person' },
          { name: 'Document', description: 'A document' }
        ],
        properties: [
          {
            name: 'hasSSN',
            type: 'datatype',
            domain: 'Person',
            range: 'string',
            characteristics: ['Functional', 'InverseFunctional']
          },
          {
            name: 'knows',
            type: 'object',
            domain: 'Person',
            range: 'Person',
            characteristics: ['Symmetric', 'Irreflexive']
          },
          {
            name: 'ancestorOf',
            type: 'object',
            domain: 'Person',
            range: 'Person',
            characteristics: ['Transitive', 'Asymmetric']
          }
        ]
      };

      const result = await unjucks.render('basic-ontology.owl.njk', characteristicsTest);
      
      // Test property characteristics
      expect(result).toContain('rdf:type owl:FunctionalProperty');
      expect(result).toContain('rdf:type owl:InverseFunctionalProperty');
      expect(result).toContain('rdf:type owl:SymmetricProperty');
      expect(result).toContain('rdf:type owl:IrreflexiveProperty');
      expect(result).toContain('rdf:type owl:TransitiveProperty');
      expect(result).toContain('rdf:type owl:AsymmetricProperty');
    });

    it('should test special character escaping in literals', async () => {
      const escapingTest = {
        name: 'EscapingTest',
        nsPrefix: 'esc',
        namespace: 'http://example.org/escaping',
        title: 'Literal Escaping Test',
        description: 'Testing special character escaping: quotes "test", newlines\nand tabs\t',
        classes: [
          {
            name: 'TestClass',
            description: 'A test class with "quotes" and\nnewlines and\ttabs'
          }
        ],
        properties: []
      };

      const result = await unjucks.render('basic-ontology.owl.njk', escapingTest);
      
      // Test character escaping
      expect(result).toContain('\\\"test\\\"');
      expect(result).toContain('\\n');
      expect(result).toContain('\\t');
      expect(result).not.toContain('"\n');
      expect(result).not.toContain('"\t');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty data gracefully', async () => {
      const emptyData = {
        name: 'EmptyTest',
        nsPrefix: 'empty',
        namespace: 'http://example.org/empty',
        title: 'Empty Ontology',
        description: 'Testing empty arrays',
        classes: [],
        properties: []
      };

      const result = await unjucks.render('basic-ontology.owl.njk', emptyData);
      
      // Should still have valid ontology structure
      expect(result).toContain('rdf:type owl:Ontology');
      expect(result).toContain('owl:versionInfo "1.0.0"@en');
      expect(result).toContain('rdfs:label "Empty Ontology"@en');
      
      const validation = validateOwl(result);
      expect(validation.valid).toBe(false); // Should be invalid due to no classes
      expect(validation.errors).toContain('No OWL classes found');
    });

    it('should handle missing optional fields', async () => {
      const minimalData = {
        name: 'MinimalTest',
        nsPrefix: 'min',
        namespace: 'http://example.org/minimal',
        classes: [
          { name: 'SimpleClass' } // No description, parentClass, etc.
        ],
        properties: [
          { name: 'simpleProp', type: 'datatype' } // No domain, range, etc.
        ]
      };

      const result = await unjucks.render('basic-ontology.owl.njk', minimalData);
      
      expect(result).toContain('min:SimpleClass rdf:type owl:Class');
      expect(result).toContain('min:simpleProp rdf:type owl:DatatypeProperty');
      
      const validation = validateOwl(result);
      expect(validation.valid).toBe(true);
    });

    it('should validate generated ontology structure', async () => {
      // Test validation with intentionally broken ontology
      const brokenOwl = `
        @prefix broken: <http://example.org/broken#> .
        # Missing required prefixes
        
        broken: rdf:type owl:Ontology .
        broken:UnterminatedStatement rdf:type owl:Class
        # Missing period
        
        broken:UnmatchedBrackets [
          rdf:type owl:Restriction ;
          # Missing closing bracket
      `;

      const validation = validateOwl(brokenOwl);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors).toContain('Missing OWL namespace declaration');
      expect(validation.errors).toContain('Missing RDFS namespace declaration');
      expect(validation.errors).toContain('Unmatched brackets in class expressions');
    });
  });
});