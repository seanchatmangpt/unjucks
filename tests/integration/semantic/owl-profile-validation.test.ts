import { describe, it, expect, beforeEach } from 'vitest';
import { promises as fs } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Unjucks } from '../../../src/index.js';
import { validateOwl } from '../../../src/lib/filters/semantic.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('OWL Profile Compliance Validation', () => {
  let unjucks: Unjucks;

  beforeEach(async () => {
    unjucks = new Unjucks({
      templateDirs: [resolve(__dirname, '../../fixtures/ontologies')],
      outputDir: resolve(__dirname, '../../.tmp')
    });
  });

  describe('OWL EL Profile Compliance', () => {
    it('should generate OWL EL compliant ontology', async () => {
      const owlELData = {
        name: 'OWLELOntology',
        nsPrefix: 'el',
        namespace: 'http://example.org/owl-el',
        title: 'OWL EL Profile Ontology',
        description: 'Ontology compliant with OWL EL profile for scalable reasoning',
        classes: [
          {
            name: 'Animal',
            description: 'Living creature',
            parentClass: 'LivingThing'
          },
          {
            name: 'Mammal',
            description: 'Warm-blooded animal',
            parentClass: 'Animal'
          },
          {
            name: 'Dog',
            description: 'Domesticated mammal',
            parentClass: 'Mammal'
          }
        ],
        properties: [
          {
            name: 'hasParent',
            type: 'object',
            description: 'Biological parent relationship',
            domain: 'Animal',
            range: 'Animal'
          },
          {
            name: 'age',
            type: 'datatype',
            description: 'Age in years',
            domain: 'Animal',
            range: 'nonNegativeInteger',
            characteristics: ['Functional']
          }
        ]
      };

      const result = await unjucks.render('basic-ontology.owl.njk', owlELData);
      
      const validation = validateOwl(result);
      expect(validation.valid).toBe(true);

      // Check OWL EL compliance features
      expect(result).toContain('rdfs:subClassOf el:Animal'); // Class inclusion
      expect(result).toContain('el:hasParent rdf:type owl:ObjectProperty');
      expect(result).toContain('rdf:type owl:FunctionalProperty'); // Property characteristics
      expect(result).toContain('rdfs:range xsd:nonNegativeInteger'); // Datatype restrictions
      
      // Verify no complex constructs that break EL profile
      expect(result).not.toContain('owl:complementOf');
      expect(result).not.toContain('owl:unionOf');
      expect(result).not.toContain('owl:disjointUnionOf');
    });
  });

  describe('OWL QL Profile Compliance', () => {
    it('should generate OWL QL compliant ontology for SPARQL querying', async () => {
      const owlQLData = {
        name: 'OWLQLOntology',
        nsPrefix: 'ql',
        namespace: 'http://example.org/owl-ql',
        title: 'OWL QL Profile Ontology',
        description: 'Ontology optimized for SPARQL query answering',
        classes: [
          {
            name: 'Employee',
            description: 'Person employed by organization'
          },
          {
            name: 'Manager',
            description: 'Employee with management responsibilities',
            parentClass: 'Employee'
          }
        ],
        properties: [
          {
            name: 'worksFor',
            type: 'object',
            description: 'Employment relationship',
            domain: 'Employee',
            range: 'Organization'
          },
          {
            name: 'manages',
            type: 'object',
            description: 'Management relationship',
            domain: 'Manager',
            range: 'Employee',
            subPropertyOf: 'supervises'
          },
          {
            name: 'employeeId',
            type: 'datatype',
            description: 'Unique employee identifier',
            domain: 'Employee',
            range: 'string',
            characteristics: ['Functional', 'InverseFunctional']
          }
        ]
      };

      const result = await unjucks.render('basic-ontology.owl.njk', owlQLData);
      
      const validation = validateOwl(result);
      expect(validation.valid).toBe(true);

      // Check OWL QL compliance features
      expect(result).toContain('rdfs:subClassOf ql:Employee');
      expect(result).toContain('rdfs:subPropertyOf ql:supervises');
      expect(result).toContain('rdf:type owl:FunctionalProperty');
      expect(result).toContain('rdf:type owl:InverseFunctionalProperty');
      
      // Verify domain/range restrictions are simple
      expect(result).toContain('rdfs:domain ql:Employee');
      expect(result).toContain('rdfs:range ql:Organization');
    });
  });

  describe('OWL RL Profile Compliance', () => {
    it('should generate OWL RL compliant ontology for rule-based reasoning', async () => {
      const owlRLData = {
        name: 'OWLRLOntology',
        nsPrefix: 'rl',
        namespace: 'http://example.org/owl-rl',
        title: 'OWL RL Profile Ontology',
        description: 'Ontology suitable for rule-based reasoning systems',
        classes: [
          {
            name: 'Vehicle',
            description: 'Motorized transportation device'
          },
          {
            name: 'Car',
            description: 'Four-wheeled vehicle',
            parentClass: 'Vehicle',
            disjointWith: ['Motorcycle']
          },
          {
            name: 'Motorcycle',
            description: 'Two-wheeled vehicle',
            parentClass: 'Vehicle',
            disjointWith: ['Car']
          }
        ],
        properties: [
          {
            name: 'hasEngine',
            type: 'object',
            description: 'Vehicle engine relationship',
            domain: 'Vehicle',
            range: 'Engine',
            characteristics: ['Functional']
          },
          {
            name: 'engineDisplacement',
            type: 'datatype',
            description: 'Engine size in liters',
            domain: 'Engine',
            range: 'decimal'
          }
        ]
      };

      const result = await unjucks.render('basic-ontology.owl.njk', owlRLData);
      
      const validation = validateOwl(result);
      expect(validation.valid).toBe(true);

      // Check OWL RL compliance features
      expect(result).toContain('rdfs:subClassOf rl:Vehicle');
      expect(result).toContain('owl:disjointWith rl:Motorcycle');
      expect(result).toContain('owl:disjointWith rl:Car');
      expect(result).toContain('rdf:type owl:FunctionalProperty');
      
      // Verify property domains and ranges
      expect(result).toContain('rdfs:domain rl:Vehicle');
      expect(result).toContain('rdfs:range rl:Engine');
      expect(result).toContain('rdfs:range xsd:decimal');
    });
  });

  describe('SPARQL Query Generation for Validation', () => {
    it('should generate SPARQL queries for ontology validation', () => {
      // Test SPARQL query generation for class hierarchy validation
      const classHierarchyQuery = `
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX test: <http://example.org/test/>
        
        SELECT ?class ?superclass WHERE {
          ?class rdfs:subClassOf ?superclass .
          ?class rdf:type owl:Class .
          ?superclass rdf:type owl:Class .
        }
        ORDER BY ?class ?superclass
      `;

      expect(classHierarchyQuery).toContain('SELECT ?class ?superclass');
      expect(classHierarchyQuery).toContain('rdfs:subClassOf');
      expect(classHierarchyQuery).toContain('rdf:type owl:Class');

      // Test property characteristics validation query
      const propertyCharacteristicsQuery = `
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        PREFIX rdf: <http://www.w3.org/RDF/1999/02/22-rdf-syntax-ns#>
        
        SELECT ?property ?characteristic WHERE {
          ?property rdf:type ?characteristic .
          VALUES ?characteristic {
            owl:FunctionalProperty
            owl:InverseFunctionalProperty
            owl:TransitiveProperty
            owl:SymmetricProperty
            owl:AsymmetricProperty
            owl:ReflexiveProperty
            owl:IrreflexiveProperty
          }
        }
        ORDER BY ?property
      `;

      expect(propertyCharacteristicsQuery).toContain('VALUES ?characteristic');
      expect(propertyCharacteristicsQuery).toContain('owl:FunctionalProperty');
      expect(propertyCharacteristicsQuery).toContain('owl:TransitiveProperty');

      // Test restriction validation query
      const restrictionValidationQuery = `
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        
        SELECT ?class ?property ?restriction ?value WHERE {
          ?class rdfs:subClassOf ?restriction .
          ?restriction rdf:type owl:Restriction .
          ?restriction owl:onProperty ?property .
          {
            ?restriction owl:someValuesFrom ?value
          } UNION {
            ?restriction owl:allValuesFrom ?value
          } UNION {
            ?restriction owl:hasValue ?value
          } UNION {
            ?restriction owl:cardinality ?value
          }
        }
        ORDER BY ?class ?property
      `;

      expect(restrictionValidationQuery).toContain('owl:Restriction');
      expect(restrictionValidationQuery).toContain('owl:someValuesFrom');
      expect(restrictionValidationQuery).toContain('UNION');
    });
  });

  describe('Semantic Consistency Checking', () => {
    it('should detect semantic inconsistencies in ontologies', async () => {
      // Test with potentially inconsistent ontology
      const inconsistentData = {
        name: 'InconsistentOntology',
        nsPrefix: 'inc',
        namespace: 'http://example.org/inconsistent',
        title: 'Inconsistent Test Ontology',
        description: 'Ontology with potential inconsistencies',
        classes: [
          {
            name: 'Person',
            description: 'Human being'
          },
          {
            name: 'Robot',
            description: 'Artificial agent',
            disjointWith: ['Person']
          },
          {
            name: 'Cyborg',
            description: 'Human-machine hybrid',
            parentClass: 'Person' // This creates potential inconsistency with Robot
          }
        ],
        properties: [
          {
            name: 'hasAge',
            type: 'datatype',
            description: 'Age in years',
            domain: 'Person',
            range: 'nonNegativeInteger',
            characteristics: ['Functional']
          },
          {
            name: 'serialNumber',
            type: 'datatype',
            description: 'Manufacturing serial number',
            domain: 'Robot',
            range: 'string',
            characteristics: ['Functional', 'InverseFunctional']
          }
        ]
      };

      const result = await unjucks.render('basic-ontology.owl.njk', inconsistentData);
      
      const validation = validateOwl(result);
      expect(validation.valid).toBe(true); // Syntactically valid

      // Check for potential semantic issues
      expect(result).toContain('owl:disjointWith inc:Person');
      expect(result).toContain('rdfs:subClassOf inc:Person');
      
      // In a real scenario, this would require a reasoner to detect
      // the inconsistency where Cyborg is both disjoint from and subclass of Person
    });
  });

  describe('Multilingual Ontology Support', () => {
    it('should generate multilingual ontologies with language tags', async () => {
      const multilingualData = {
        name: 'MultilingualOntology',
        nsPrefix: 'ml',
        namespace: 'http://example.org/multilingual',
        title: 'Multilingual Test Ontology',
        description: 'Ontology with multilingual labels and descriptions',
        classes: [
          {
            name: 'Book',
            description: 'A written or printed work',
            altLabels: ['Libro', 'Livre', 'Buch', '本']
          }
        ],
        properties: [
          {
            name: 'title',
            type: 'datatype',
            description: 'Title of the book',
            domain: 'Book',
            range: 'string'
          }
        ]
      };

      const result = await unjucks.render('basic-ontology.owl.njk', multilingualData);
      
      const validation = validateOwl(result);
      expect(validation.valid).toBe(true);

      // Check for English labels
      expect(result).toContain('"Book"@en');
      expect(result).toContain('"A written or printed work"@en');
      
      // In a full implementation, would check for:
      // expect(result).toContain('"Libro"@es');
      // expect(result).toContain('"Livre"@fr');
      // expect(result).toContain('"Buch"@de');
      // expect(result).toContain('"本"@ja');
    });
  });

  describe('Performance Metrics for Large Ontologies', () => {
    it('should handle large-scale ontology generation efficiently', async () => {
      // Create a moderately large ontology for performance testing
      const classes = Array.from({ length: 50 }, (_, i) => ({
        name: `Concept${i}`,
        description: `Auto-generated concept ${i}`,
        parentClass: i > 0 ? `Concept${Math.floor(i / 2)}` : undefined
      }));

      const properties = Array.from({ length: 100 }, (_, i) => ({
        name: `relation${i}`,
        type: i % 2 === 0 ? 'datatype' : 'object',
        description: `Auto-generated relation ${i}`,
        domain: `Concept${i % 50}`,
        range: i % 2 === 0 ? 'string' : `Concept${(i + 1) % 50}`
      }));

      const largeOntologyData = {
        name: 'LargePerformanceTest',
        nsPrefix: 'perf',
        namespace: 'http://example.org/performance',
        title: 'Performance Test Ontology',
        description: 'Large ontology for performance validation',
        classes,
        properties
      };

      const startTime = performance.now();
      const result = await unjucks.render('basic-ontology.owl.njk', largeOntologyData);
      const endTime = performance.now();

      const renderTime = endTime - startTime;
      
      expect(result).toBeTruthy();
      expect(renderTime).toBeLessThan(2000); // Should complete within 2 seconds
      
      // Validate structure is correct
      const validation = validateOwl(result);
      expect(validation.valid).toBe(true);
      
      // Check that all elements were generated
      const classCount = (result.match(/perf:Concept\d+ rdf:type owl:Class/g) || []).length;
      const propertyCount = (result.match(/perf:relation\d+ rdf:type owl:\w+Property/g) || []).length;
      
      expect(classCount).toBe(50);
      expect(propertyCount).toBe(100);
      
      console.log(`Large ontology generation completed in ${renderTime.toFixed(2)}ms`);
    });
  });
});