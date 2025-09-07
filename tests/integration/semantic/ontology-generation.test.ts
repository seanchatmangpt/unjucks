import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Unjucks } from '../../../src/index.js';
import { validateOwl } from '../../../src/lib/filters/semantic.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Ontology Generation Integration', () => {
  let unjucks: Unjucks;
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory for generated ontologies
    tempDir = resolve(__dirname, '../../../tests/.tmp/ontologies-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
    
    // Initialize Unjucks with fixtures directory
    unjucks = new Unjucks({
      templateDirs: [resolve(__dirname, '../../fixtures/ontologies')],
      outputDir: tempDir
    });
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Basic Ontology Generation', () => {
    it('should generate valid basic ontology with classes and properties', async () => {
      const data = {
        name: 'PersonOntology',
        nsPrefix: 'person',
        namespace: 'http://example.org/person',
        title: 'Person Ontology',
        description: 'Basic ontology defining person-related concepts',
        version: '1.0.0',
        classes: [
          {
            name: 'Person',
            description: 'A human being',
            parentClass: 'foaf:Agent'
          },
          {
            name: 'Organization',
            description: 'A structured group of people',
            disjointWith: ['Person']
          },
          {
            name: 'Employee',
            description: 'A person employed by an organization',
            parentClass: 'Person'
          }
        ],
        properties: [
          {
            name: 'firstName',
            type: 'datatype',
            description: 'Given name of a person',
            domain: 'Person',
            range: 'string',
            characteristics: ['Functional']
          },
          {
            name: 'worksFor',
            type: 'object',
            description: 'Employment relationship',
            domain: 'Employee',
            range: 'Organization',
            inverseOf: 'employs'
          },
          {
            name: 'birthDate',
            type: 'datatype',
            description: 'Date of birth',
            domain: 'Person',
            range: 'date',
            characteristics: ['Functional']
          }
        ]
      };

      const result = await unjucks.render('basic-ontology.owl.njk', data);
      expect(result).toBeTruthy();

      // Validate generated ontology
      const validation = validateOwl(result);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // Check for key ontology elements
      expect(result).toContain('rdf:type owl:Ontology');
      expect(result).toContain('person:Person rdf:type owl:Class');
      expect(result).toContain('person:Organization rdf:type owl:Class');
      expect(result).toContain('person:Employee rdf:type owl:Class');
      expect(result).toContain('rdfs:subClassOf person:Person');
      expect(result).toContain('owl:disjointWith person:Person');
      expect(result).toContain('person:firstName rdf:type owl:DatatypeProperty');
      expect(result).toContain('person:worksFor rdf:type owl:ObjectProperty');
      expect(result).toContain('owl:inverseOf person:employs');
      expect(result).toContain('rdf:type owl:FunctionalProperty');
    });

    it('should handle empty classes and properties arrays', async () => {
      const data = {
        name: 'MinimalOntology',
        nsPrefix: 'min',
        namespace: 'http://example.org/minimal',
        title: 'Minimal Ontology',
        description: 'A minimal ontology for testing',
        classes: [],
        properties: []
      };

      const result = await unjucks.render('basic-ontology.owl.njk', data);
      expect(result).toBeTruthy();

      const validation = validateOwl(result);
      expect(validation.valid).toBe(false); // Should be invalid due to no classes
      expect(validation.errors).toContain('No OWL classes found');
    });
  });

  describe('Domain Ontology Generation', () => {
    it('should generate e-commerce domain ontology with restrictions', async () => {
      const data = {
        domain: 'ecommerce',
        nsPrefix: 'ecom',
        namespace: 'http://example.org/ecommerce',
        description: 'E-commerce domain vocabulary',
        version: '1.2.0',
        createdDate: new Date('2023-01-01'),
        modifiedDate: new Date('2023-12-01'),
        entities: [
          {
            name: 'Product',
            description: 'An item available for purchase',
            restrictions: [
              {
                property: 'hasPrice',
                type: 'someValuesFrom',
                value: 'Price'
              },
              {
                property: 'hasCategory',
                type: 'minCardinality',
                value: '1'
              }
            ]
          },
          {
            name: 'Customer',
            description: 'A person who purchases products',
            superClass: 'Person',
            restrictions: [
              {
                property: 'hasAddress',
                type: 'allValuesFrom',
                value: 'Address'
              }
            ]
          },
          {
            name: 'Order',
            description: 'A purchase transaction',
            restrictions: [
              {
                property: 'orderedBy',
                type: 'cardinality',
                value: '1'
              },
              {
                property: 'containsProduct',
                type: 'someValuesFrom',
                value: 'Product'
              }
            ]
          }
        ],
        relations: [
          {
            name: 'hasPrice',
            type: 'datatype',
            description: 'Monetary value of a product',
            domain: 'Product',
            range: 'decimal',
            characteristics: ['Functional']
          },
          {
            name: 'orderedBy',
            type: 'object',
            description: 'Customer who placed the order',
            domain: 'Order',
            range: 'Customer',
            characteristics: ['Functional']
          },
          {
            name: 'containsProduct',
            type: 'object',
            description: 'Products included in an order',
            domain: 'Order',
            range: 'Product'
          }
        ],
        enumerations: [
          {
            name: 'OrderStatus',
            values: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled']
          },
          {
            name: 'PaymentMethod',
            values: ['CreditCard', 'PayPal', 'BankTransfer']
          }
        ]
      };

      const result = await unjucks.render('domain-ontology.owl.njk', data);
      expect(result).toBeTruthy();

      const validation = validateOwl(result);
      expect(validation.valid).toBe(true);

      // Check domain-specific elements
      expect(result).toContain('ecom:Product rdf:type owl:Class');
      expect(result).toContain('ecom:Customer rdf:type owl:Class');
      expect(result).toContain('ecom:Order rdf:type owl:Class');
      expect(result).toContain('rdfs:subClassOf ecom:Person');
      
      // Check restrictions
      expect(result).toContain('owl:onProperty ecom:hasPrice');
      expect(result).toContain('owl:someValuesFrom ecom:Price');
      expect(result).toContain('owl:minCardinality "1"^^xsd:nonNegativeInteger');
      expect(result).toContain('owl:cardinality "1"^^xsd:nonNegativeInteger');
      
      // Check enumerations
      expect(result).toContain('ecom:OrderStatus rdf:type owl:Class');
      expect(result).toContain('owl:oneOf ( ecom:Pending ecom:Processing ecom:Shipped ecom:Delivered ecom:Cancelled )');
      expect(result).toContain('ecom:Pending rdf:type owl:NamedIndividual');
      
      // Check properties
      expect(result).toContain('ecom:hasPrice rdf:type owl:DatatypeProperty');
      expect(result).toContain('rdfs:range xsd:decimal');
      expect(result).toContain('ecom:orderedBy rdf:type owl:ObjectProperty');
      expect(result).toContain('rdf:type owl:FunctionalProperty');
    });
  });

  describe('Upper Ontology Generation', () => {
    it('should generate comprehensive upper ontology with abstract concepts', async () => {
      const data = {
        name: 'FoundationalOntology',
        nsPrefix: 'found',
        namespace: 'http://example.org/foundational',
        title: 'Foundational Upper Ontology',
        description: 'Top-level conceptual framework',
        version: '2.0.0'
      };

      const result = await unjucks.render('upper-ontology.owl.njk', data);
      expect(result).toBeTruthy();

      const validation = validateOwl(result);
      expect(validation.valid).toBe(true);

      // Check top-level classes
      expect(result).toContain('found:Entity rdf:type owl:Class');
      expect(result).toContain('found:Abstract rdf:type owl:Class');
      expect(result).toContain('found:Concrete rdf:type owl:Class');
      expect(result).toContain('owl:disjointWith found:Concrete');
      
      // Check temporal concepts
      expect(result).toContain('found:TemporalEntity rdf:type owl:Class');
      expect(result).toContain('found:Event rdf:type owl:Class');
      expect(result).toContain('found:Process rdf:type owl:Class');
      
      // Check fundamental relations
      expect(result).toContain('found:partOf rdf:type owl:ObjectProperty');
      expect(result).toContain('rdf:type owl:TransitiveProperty');
      expect(result).toContain('owl:inverseOf found:hasPart');
      expect(result).toContain('found:hasParticipant rdf:type owl:ObjectProperty');
      expect(result).toContain('found:dependsOn rdf:type owl:ObjectProperty');
      
      // Check quality relations
      expect(result).toContain('found:Quality rdf:type owl:Class');
      expect(result).toContain('found:Quantity rdf:type owl:Class');
      expect(result).toContain('found:hasNumericalValue rdf:type owl:DatatypeProperty');
      expect(result).toContain('rdf:type owl:FunctionalProperty');
    });
  });

  describe('Application Ontology Generation', () => {
    it('should generate application-specific ontology with business processes', async () => {
      const data = {
        appName: 'TaskManager',
        nsPrefix: 'task',
        namespace: 'http://example.org/taskmanager',
        description: 'Task management application ontology',
        version: '1.1.0',
        createdDate: new Date('2023-06-01'),
        modifiedDate: new Date('2023-12-01'),
        creator: 'Development Team',
        generationTool: 'Unjucks Ontology Generator',
        generationTime: new Date(),
        baseOntology: 'http://example.org/foundational',
        modules: [
          {
            name: 'Core',
            entities: [
              {
                name: 'Task',
                description: 'A unit of work to be completed',
                businessRules: [
                  {
                    property: 'assignedTo',
                    type: 'required',
                    valueClass: 'User',
                    description: 'Every task must be assigned to a user'
                  },
                  {
                    property: 'dueDate',
                    type: 'unique',
                    description: 'A task can have only one due date'
                  }
                ],
                lifecycle: 'task'
              },
              {
                name: 'Project',
                description: 'A collection of related tasks',
                interfaces: ['Trackable', 'Schedulable']
              }
            ]
          }
        ],
        propertyGroups: [
          {
            name: 'Core',
            properties: [
              {
                name: 'assignedTo',
                type: 'object',
                description: 'User responsible for completing the task',
                domain: 'Task',
                range: 'User',
                characteristics: ['Functional'],
                businessContext: 'Task Assignment'
              },
              {
                name: 'title',
                type: 'datatype',
                description: 'Human-readable task title',
                domain: 'Task',
                range: 'string',
                validation: {
                  minLength: 1,
                  maxLength: 200,
                  pattern: '^[\\w\\s\\-_.]+$'
                }
              }
            ]
          }
        ],
        businessProcesses: [
          {
            name: 'TaskCreation',
            description: 'Process of creating a new task',
            steps: [
              {
                name: 'ValidateInput',
                description: 'Validate task creation parameters',
                preconditions: ['UserAuthenticated'],
                postconditions: ['InputValid']
              },
              {
                name: 'CreateTask',
                description: 'Instantiate new task object',
                preconditions: ['InputValid'],
                postconditions: ['TaskCreated']
              }
            ],
            triggers: ['UserRequest', 'ScheduledEvent']
          }
        ],
        integrations: [
          {
            name: 'CalendarSystem',
            description: 'Integration with external calendar',
            externalOntology: 'http://example.org/calendar',
            mappings: [
              {
                externalClass: 'CalendarEvent'
              }
            ]
          }
        ],
        individuals: [
          {
            name: 'DefaultProject',
            type: 'Project',
            description: 'Default project for unassigned tasks',
            properties: {
              title: 'Default Tasks',
              createdAt: '2023-01-01T00:00:00Z'
            }
          }
        ]
      };

      const result = await unjucks.render('application-ontology.owl.njk', data);
      expect(result).toBeTruthy();

      const validation = validateOwl(result);
      expect(validation.valid).toBe(true);

      // Check application-specific elements
      expect(result).toContain('task:Task rdf:type owl:Class');
      expect(result).toContain('task:Project rdf:type owl:Class');
      expect(result).toContain('skos:prefLabel "Task"@en');
      
      // Check business rules as restrictions
      expect(result).toContain('owl:onProperty task:assignedTo');
      expect(result).toContain('owl:someValuesFrom task:User');
      expect(result).toContain('owl:maxCardinality "1"^^xsd:nonNegativeInteger');
      
      // Check business processes
      expect(result).toContain('task:TaskCreationProcess rdf:type owl:Class');
      expect(result).toContain('task:ValidateInputStep rdf:type owl:Class');
      expect(result).toContain('task:hasPrecondition task:UserAuthenticatedCondition');
      
      // Check integrations
      expect(result).toContain('task:CalendarSystemIntegration rdf:type owl:Class');
      expect(result).toContain('task:integratesWith <http://example.org/calendar>');
      
      // Check individuals
      expect(result).toContain('task:DefaultProject rdf:type owl:NamedIndividual');
      expect(result).toContain('task:title "Default Tasks"@en');
      
      // Check property validation metadata
      expect(result).toContain('owl:withRestrictions ( [ xsd:minLength 1 ] )');
      expect(result).toContain('owl:withRestrictions ( [ xsd:maxLength 200 ] )');
      expect(result).toContain('owl:withRestrictions ( [ xsd:pattern "^[\\w\\s\\-_.]+$" ] )');
    });
  });

  describe('Mapping Ontology Generation', () => {
    it('should generate complex cross-vocabulary mappings', async () => {
      const data = {
        mappingName: 'PersonAlignment',
        nsPrefix: 'align',
        namespace: 'http://example.org/alignment',
        description: 'Alignment between person vocabularies',
        version: '1.0.0',
        externalPrefixes: [
          { name: 'foaf', uri: 'http://xmlns.com/foaf/0.1/' },
          { name: 'vcard', uri: 'http://www.w3.org/2006/vcard/ns#' },
          { name: 'schema', uri: 'https://schema.org/' }
        ],
        sourceOntologies: ['http://example.org/person'],
        targetOntologies: ['http://xmlns.com/foaf/0.1/', 'https://schema.org/'],
        classMappings: [
          {
            sourceClass: 'Person',
            sourcePrefix: 'person',
            targetClass: 'Person',
            targetPrefix: 'foaf',
            relation: 'equivalent',
            confidence: 0.95,
            notes: 'Direct conceptual alignment'
          },
          {
            sourceClass: 'Organization',
            sourcePrefix: 'person',
            targetClass: 'Organization',
            targetPrefix: 'schema',
            relation: 'closeMatch',
            confidence: 0.85
          }
        ],
        propertyMappings: [
          {
            sourceProperty: 'firstName',
            sourcePrefix: 'person',
            targetProperty: 'givenName',
            targetPrefix: 'foaf',
            relation: 'equivalent',
            transformation: {
              type: 'format',
              pattern: '^[A-Z].*',
              function: 'capitalize'
            }
          },
          {
            sourceProperty: 'knows',
            sourcePrefix: 'person',
            targetProperty: 'knows',
            targetPrefix: 'foaf',
            relation: 'equivalent'
          }
        ],
        complexMappings: [
          {
            name: 'EmployeeConcept',
            description: 'Employee as intersection of Person and Worker',
            type: 'intersection',
            sourcePrefix: 'person',
            targetPrefix: 'schema',
            classes: ['Person', 'Worker'],
            targetEquivalent: 'Employee'
          },
          {
            name: 'HasEmailRestriction',
            description: 'Person with email address',
            type: 'restriction',
            sourcePrefix: 'person',
            targetPrefix: 'foaf',
            property: 'hasEmail',
            restrictionType: 'someValuesFrom',
            valueClass: 'EmailAddress'
          }
        ],
        bridgeAxioms: [
          {
            name: 'PersonIdentity',
            subject: 'person:Person',
            predicate: 'owl:equivalentClass',
            object: 'foaf:Person',
            type: 'equivalence',
            confidence: 1.0,
            justification: 'Both represent the concept of human beings'
          }
        ]
      };

      const result = await unjucks.render('mapping-ontology.owl.njk', data);
      expect(result).toBeTruthy();

      const validation = validateOwl(result);
      expect(validation.valid).toBe(true);

      // Check namespace declarations
      expect(result).toContain('@prefix foaf: <http://xmlns.com/foaf/0.1/> .');
      expect(result).toContain('@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .');
      expect(result).toContain('@prefix schema: <https://schema.org/> .');
      
      // Check class mappings
      expect(result).toContain('person:Person owl:equivalentClass foaf:Person');
      expect(result).toContain('person:Organization skos:closeMatch schema:Organization');
      expect(result).toContain('align:mappingConfidence "0.95"^^xsd:float');
      expect(result).toContain('align:mappingNotes "Direct conceptual alignment"@en');
      
      // Check property mappings
      expect(result).toContain('person:firstName owl:equivalentProperty foaf:givenName');
      expect(result).toContain('person:knows owl:equivalentProperty foaf:knows');
      
      // Check transformations
      expect(result).toContain('align:hasTransformation [');
      expect(result).toContain('align:transformationType "format"');
      expect(result).toContain('align:transformationPattern "^[A-Z].*"');
      expect(result).toContain('align:transformationFunction "capitalize"');
      
      // Check complex mappings
      expect(result).toContain('align:EmployeeConcept rdf:type owl:Class');
      expect(result).toContain('owl:intersectionOf (');
      expect(result).toContain('person:Person person:Worker');
      expect(result).toContain('owl:equivalentClass schema:Employee');
      
      expect(result).toContain('align:HasEmailRestriction');
      expect(result).toContain('owl:onProperty person:hasEmail');
      expect(result).toContain('owl:someValuesFrom foaf:EmailAddress');
      
      // Check bridge axioms
      expect(result).toContain('owl:annotatedSource person:Person');
      expect(result).toContain('owl:annotatedProperty owl:equivalentClass');
      expect(result).toContain('owl:annotatedTarget foaf:Person');
      expect(result).toContain('align:bridgeType "equivalence"');
      expect(result).toContain('align:bridgeConfidence "1"^^xsd:float');
      
      // Check mapping metadata classes
      expect(result).toContain('align:PropertyTransformation rdf:type owl:Class');
      expect(result).toContain('align:MappingAlignment rdf:type owl:Class');
    });
  });

  describe('Ontology Validation and Quality Checks', () => {
    it('should detect and report ontology quality issues', async () => {
      // Test with intentionally problematic ontology
      const problematicOwl = `
        @prefix ex: <http://example.org/> .
        # Missing owl and rdfs prefixes
        
        ex: rdf:type owl:Ontology .
        # Missing class declarations
      `;

      const validation = validateOwl(problematicOwl);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors).toContain('Missing OWL namespace declaration');
      expect(validation.errors).toContain('Missing RDFS namespace declaration');
      expect(validation.errors).toContain('No OWL classes found');
    });

    it('should validate complex ontology with all elements', async () => {
      const complexData = {
        name: 'ComplexTest',
        nsPrefix: 'test',
        namespace: 'http://example.org/test',
        title: 'Complex Test Ontology',
        description: 'Ontology with all possible elements for validation',
        classes: [
          {
            name: 'TestClass',
            description: 'A test class',
            equivalentClasses: ['AltTestClass'],
            disjointWith: ['OtherClass']
          }
        ],
        properties: [
          {
            name: 'testProperty',
            type: 'datatype',
            description: 'A test property',
            domain: 'TestClass',
            range: 'string',
            characteristics: ['Functional', 'InverseFunctional']
          }
        ]
      };

      const result = await unjucks.render('basic-ontology.owl.njk', complexData);
      const validation = validateOwl(result);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large ontologies with many classes and properties', async () => {
      const largeData = {
        name: 'LargeOntology',
        nsPrefix: 'large',
        namespace: 'http://example.org/large',
        title: 'Large Scale Ontology',
        description: 'Ontology with many classes for scalability testing',
        classes: Array.from({ length: 100 }, (_, i) => ({
          name: `Class${i}`,
          description: `Auto-generated class ${i}`,
          parentClass: i > 0 ? `Class${i - 1}` : undefined
        })),
        properties: Array.from({ length: 200 }, (_, i) => ({
          name: `property${i}`,
          type: i % 2 === 0 ? 'datatype' : 'object',
          description: `Auto-generated property ${i}`,
          domain: `Class${i % 100}`,
          range: i % 2 === 0 ? 'string' : `Class${(i + 1) % 100}`
        }))
      };

      const startTime = Date.now();
      const result = await unjucks.render('basic-ontology.owl.njk', largeData);
      const endTime = Date.now();

      expect(result).toBeTruthy();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Basic validation (full validation would be too slow for this size)
      expect(result).toContain('rdf:type owl:Ontology');
      expect(result).toContain('large:Class99 rdf:type owl:Class');
      expect(result).toContain('large:property199');

      // Count generated elements
      const classMatches = result.match(/large:Class\d+ rdf:type owl:Class/g);
      const propertyMatches = result.match(/large:property\d+ rdf:type owl:\w+Property/g);
      
      expect(classMatches).toHaveLength(100);
      expect(propertyMatches).toHaveLength(200);
    });
  });
});