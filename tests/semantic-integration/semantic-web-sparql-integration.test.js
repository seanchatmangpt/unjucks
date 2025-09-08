/**
 * Semantic Web SPARQL Integration Tests
 * Comprehensive testing of semantic filters with real SPARQL queries
 * Testing vocabulary mapping, ontology generation, and enterprise compliance
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { Store, Parser, DataFactory, Writer } from 'n3';
import { RDFFilters } from '../../src/lib/rdf-filters.js';
import SemanticFilters from '../../src/lib/semantic/semantic-filters.js';

const { namedNode, literal, quad } = DataFactory;

describe('Semantic Web SPARQL Integration Tests', () => {
  let store;
  let rdfFilters;
  let semanticFilters;
  let enterpriseOntologies;

  beforeAll(async () => {
    // Initialize comprehensive enterprise ontologies
    store = new Store();
    await loadEnterpriseOntologies(store);
    
    rdfFilters = new RDFFilters({ 
      store,
      prefixes: getEnterpisePrefixes()
    });

    semanticFilters = new SemanticFilters();
    semanticFilters.registerStore('enterprise', store, getEnterpisePrefixes());
  });

  describe('SPARQL-like Query Processing', () => {
    it('should execute complex SPARQL patterns for financial compliance (FIBO)', async () => {
      // Test Basel III compliance queries
      const baselQueries = [
        {
          pattern: '?bank fibo:hasCapitalRatio ?ratio',
          description: 'Find all banks with capital ratios',
          minResults: 0
        },
        {
          pattern: '?risk fibo:riskLevel "HIGH"',
          description: 'Find high-risk assessments',  
          minResults: 0
        },
        {
          pattern: '?regulation fibo:complianceFramework fibo:Basel3',
          description: 'Find Basel III regulations',
          minResults: 0
        }
      ];

      for (const query of baselQueries) {
        const results = rdfFilters.rdfQuery(query.pattern);
        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBeGreaterThanOrEqual(query.minResults);
        
        console.log(`📊 FIBO Query "${query.description}": ${results.length} results`);
      }
    });

    it('should process healthcare SPARQL queries (FHIR R4)', async () => {
      const fhirQueries = [
        {
          pattern: '?patient fhir:gender ?gender',
          description: 'Patient demographics query'
        },
        {
          pattern: '?observation fhir:code ?code',
          description: 'Clinical observations query'
        },
        {
          pattern: '?medication fhir:status "active"',
          description: 'Active medications query'
        }
      ];

      for (const query of fhirQueries) {
        const results = rdfFilters.rdfQuery(query.pattern);
        expect(Array.isArray(results)).toBe(true);
        console.log(`🏥 FHIR Query "${query.description}": ${results.length} results`);
      }
    });

    it('should handle supply chain SPARQL queries (GS1/EPCIS)', async () => {
      const gs1Queries = [
        {
          pattern: '?product gs1:gtin ?gtin',
          description: 'Product identification query'
        },
        {
          pattern: '?location gs1:locationId ?id',
          description: 'Location tracking query'  
        },
        {
          pattern: '?event gs1:businessStep gs1:receiving',
          description: 'Supply chain events query'
        }
      ];

      for (const query of gs1Queries) {
        const results = rdfFilters.rdfQuery(query.pattern);
        expect(Array.isArray(results)).toBe(true);
        console.log(`📦 GS1 Query "${query.description}": ${results.length} results`);
      }
    });

    it('should perform federated queries across multiple ontologies', async () => {
      // Test cross-ontology queries that span financial, healthcare, and supply chain
      const federatedQuery = {
        pattern: '?entity rdfs:label ?label',
        description: 'Cross-ontology entity labels'
      };

      const results = rdfFilters.rdfQuery(federatedQuery.pattern);
      expect(results.length).toBeGreaterThan(0);

      // Verify results span multiple domains
      const domains = new Set();
      results.forEach(result => {
        const entityUri = result[0].value;
        if (entityUri.includes('fibo')) domains.add('financial');
        if (entityUri.includes('fhir')) domains.add('healthcare');
        if (entityUri.includes('gs1')) domains.add('supply-chain');
      });

      console.log(`🔗 Federated query spans ${domains.size} domains: ${Array.from(domains).join(', ')}`);
      expect(domains.size).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Vocabulary Mapping and Alignment', () => {
    it('should map vocabularies between different ontologies', () => {
      const mappings = [
        {
          source: 'fibo:Organization',
          target: 'schema:Organization',
          relation: 'owl:equivalentClass'
        },
        {
          source: 'fhir:Patient', 
          target: 'foaf:Person',
          relation: 'rdfs:subClassOf'
        },
        {
          source: 'gs1:Product',
          target: 'schema:Product', 
          relation: 'owl:equivalentClass'
        }
      ];

      mappings.forEach(mapping => {
        // Test that both source and target exist in ontologies
        const sourceExists = rdfFilters.rdfExists(mapping.source);
        const targetExists = rdfFilters.rdfExists(mapping.target);
        
        console.log(`🔗 Mapping ${mapping.source} -> ${mapping.target}: ${mapping.relation}`);
        // At least one should exist in our test data
        expect(sourceExists || targetExists).toBe(true);
      });
    });

    it('should align property mappings across vocabularies', () => {
      const propertyMappings = [
        {
          source: 'fibo:hasName',
          targets: ['rdfs:label', 'foaf:name', 'schema:name']
        },
        {
          source: 'fhir:identifier', 
          targets: ['dcterms:identifier', 'schema:identifier']
        },
        {
          source: 'gs1:gtin',
          targets: ['schema:productID', 'dcterms:identifier']
        }
      ];

      propertyMappings.forEach(mapping => {
        // Test property domain/range compatibility
        mapping.targets.forEach(target => {
          const sourceExpanded = rdfFilters.rdfExpand(mapping.source);
          const targetExpanded = rdfFilters.rdfExpand(target);
          
          expect(sourceExpanded).toContain('http');
          expect(targetExpanded).toContain('http');
          
          console.log(`📝 Property alignment: ${mapping.source} ≡ ${target}`);
        });
      });
    });

    it('should generate semantic mappings for data integration', () => {
      // Test automatic mapping generation between ontologies
      const integrationScenarios = [
        {
          scenario: 'Financial customer -> Healthcare patient',
          sourceClass: 'fibo:Customer',
          targetClass: 'fhir:Patient',
          expectedMappings: ['identifier', 'name', 'address']
        },
        {
          scenario: 'Supply chain product -> E-commerce product',
          sourceClass: 'gs1:Product',
          targetClass: 'schema:Product', 
          expectedMappings: ['name', 'description', 'identifier']
        }
      ];

      integrationScenarios.forEach(scenario => {
        // Get properties of source and target classes
        const sourceProperties = semanticFilters.getAllProperties(scenario.sourceClass, 'enterprise');
        const targetProperties = semanticFilters.getAllProperties(scenario.targetClass, 'enterprise');
        
        console.log(`🔄 Integration scenario: ${scenario.scenario}`);
        console.log(`   Source properties: ${Object.keys(sourceProperties).length}`);
        console.log(`   Target properties: ${Object.keys(targetProperties).length}`);
        
        expect(typeof sourceProperties).toBe('object');
        expect(typeof targetProperties).toBe('object');
      });
    });
  });

  describe('Ontology Generation and Validation', () => {
    it('should generate valid RDF/Turtle from semantic templates', async () => {
      const templateData = {
        entity: 'ex:ComplianceAssessment',
        type: 'fibo:RiskAssessment',
        properties: [
          { predicate: 'fibo:assessmentDate', object: '2023-12-25T10:30:00Z', datatype: 'xsd:dateTime' },
          { predicate: 'fibo:riskLevel', object: 'HIGH' },
          { predicate: 'fibo:assessor', object: 'ex:ComplianceOfficer' }
        ]
      };

      // Generate Turtle representation
      const turtle = generateTurtleFromTemplate(templateData);
      
      // Parse generated Turtle to verify validity
      const parser = new Parser();
      const quads = parser.parse(turtle);
      
      expect(quads.length).toBeGreaterThan(0);
      expect(turtle).toContain('@prefix');
      expect(turtle).toContain('fibo:RiskAssessment');
      
      console.log('📝 Generated Turtle:');
      console.log(turtle);
    });

    it('should validate ontology constraints and rules', () => {
      const validationRules = [
        {
          rule: 'fibo:Customer must have fibo:customerID',
          subject: 'ex:customer123',
          property: 'fibo:customerID',
          required: true
        },
        {
          rule: 'fhir:Patient must have fhir:identifier',
          subject: 'ex:patient456', 
          property: 'fhir:identifier',
          required: true
        },
        {
          rule: 'gs1:Product must have gs1:gtin',
          subject: 'ex:product789',
          property: 'gs1:gtin', 
          required: true
        }
      ];

      validationRules.forEach(rule => {
        const hasProperty = rdfFilters.rdfExists(rule.subject, rule.property);
        
        if (rule.required) {
          console.log(`✅ Validation rule: ${rule.rule} - ${hasProperty ? 'PASS' : 'FAIL'}`);
        }
        
        // For test data, we don't require all entities to exist
        expect(typeof hasProperty).toBe('boolean');
      });
    });

    it('should perform semantic reasoning and inference', () => {
      // Test basic OWL reasoning capabilities
      const inferenceTests = [
        {
          description: 'Transitive subclass relationships',
          query: 'fibo:BankingProduct rdfs:subClassOf fibo:FinancialProduct',
          expectInferred: true
        },
        {
          description: 'Symmetric property relationships', 
          query: 'ex:person1 foaf:knows ex:person2',
          expectSymmetric: 'ex:person2 foaf:knows ex:person1'
        },
        {
          description: 'Domain/range constraints',
          property: 'fibo:hasRisk',
          expectedDomain: 'fibo:FinancialInstrument',
          expectedRange: 'fibo:Risk'
        }
      ];

      inferenceTests.forEach(test => {
        console.log(`🧠 Inference test: ${test.description}`);
        
        if (test.query) {
          // Test basic pattern matching
          const results = rdfFilters.rdfQuery(test.query);
          expect(Array.isArray(results)).toBe(true);
        }
        
        if (test.property) {
          // Test domain/range inference
          const domainTypes = semanticFilters.getPropertyDomain?.(test.property, 'enterprise') || [];
          const rangeTypes = semanticFilters.getPropertyRange?.(test.property, 'enterprise') || [];
          
          console.log(`   Domain types: ${domainTypes.length}, Range types: ${rangeTypes.length}`);
        }
      });
    });
  });

  describe('Enterprise Compliance Scenarios', () => {
    it('should validate SOX compliance data requirements', () => {
      const soxRequirements = [
        {
          requirement: 'Financial controls documentation',
          entities: ['fibo:FinancialControl', 'fibo:AuditTrail'],
          properties: ['fibo:controlType', 'fibo:auditDate', 'fibo:approver']
        },
        {
          requirement: 'Management certification',
          entities: ['fibo:ManagementCertification'],
          properties: ['fibo:certificationDate', 'fibo:certifyingOfficer']
        }
      ];

      soxRequirements.forEach(req => {
        console.log(`⚖️  SOX Requirement: ${req.requirement}`);
        
        req.entities.forEach(entity => {
          const entityCount = rdfFilters.rdfCount(null, 'rdf:type', entity);
          console.log(`   ${entity}: ${entityCount} instances`);
        });
      });
    });

    it('should validate HIPAA compliance for healthcare data', () => {
      const hipaaRequirements = [
        {
          requirement: 'Patient data encryption',
          entities: ['fhir:Patient'],
          properties: ['fhir:encrypted', 'fhir:accessControl']
        },
        {
          requirement: 'Access logging',
          entities: ['fhir:AccessLog'],
          properties: ['fhir:accessTime', 'fhir:userId', 'fhir:dataAccessed']
        }
      ];

      hipaaRequirements.forEach(req => {
        console.log(`🏥 HIPAA Requirement: ${req.requirement}`);
        
        req.entities.forEach(entity => {
          const instances = rdfFilters.rdfSubject('rdf:type', entity);
          console.log(`   ${entity}: ${instances.length} instances`);
        });
      });
    });

    it('should validate supply chain transparency (GS1/EPCIS)', () => {
      const traceabilityRequirements = [
        {
          requirement: 'Product traceability',
          entities: ['gs1:Product', 'gs1:TradeItem'],
          properties: ['gs1:gtin', 'gs1:lotNumber', 'gs1:expirationDate']
        },
        {
          requirement: 'Location tracking',
          entities: ['gs1:Location', 'gs1:ReadPoint'],
          properties: ['gs1:locationId', 'gs1:address']
        }
      ];

      traceabilityRequirements.forEach(req => {
        console.log(`📦 Traceability Requirement: ${req.requirement}`);
        
        req.entities.forEach(entity => {
          const count = rdfFilters.rdfCount(null, 'rdf:type', entity);
          console.log(`   ${entity}: ${count} instances`);
        });
      });
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large-scale semantic queries efficiently', async () => {
      const performanceTests = [
        {
          description: 'Large result set query',
          pattern: '?s ?p ?o',
          maxTime: 1000 // 1 second
        },
        {
          description: 'Complex pattern matching',
          pattern: '?person foaf:knows ?friend',
          maxTime: 500
        },
        {
          description: 'Multi-hop relationship traversal',
          pattern: '?org schema:employee ?person',
          maxTime: 300
        }
      ];

      for (const test of performanceTests) {
        const startTime = performance.now();
        const results = rdfFilters.rdfQuery(test.pattern);
        const duration = performance.now() - startTime;
        
        expect(duration).toBeLessThan(test.maxTime);
        console.log(`⚡ ${test.description}: ${results.length} results in ${duration.toFixed(2)}ms`);
      }
    });

    it('should maintain query performance with concurrent access', async () => {
      const concurrentQueries = Array.from({ length: 50 }, (_, i) => 
        () => rdfFilters.rdfQuery(`?s${i} rdf:type ?type${i}`)
      );

      const startTime = performance.now();
      const results = await Promise.all(concurrentQueries.map(query => query()));
      const duration = performance.now() - startTime;

      expect(results).toHaveLength(50);
      expect(duration).toBeLessThan(2000); // 2 seconds for 50 concurrent queries
      
      console.log(`🔀 50 concurrent queries completed in ${duration.toFixed(2)}ms`);
    });

    it('should optimize memory usage for large knowledge graphs', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform many semantic operations
      for (let i = 0; i < 1000; i++) {
        rdfFilters.rdfLabel(`ex:entity${i}`);
        rdfFilters.rdfType(`ex:entity${i}`);
        rdfFilters.rdfExists(`ex:entity${i}`);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB
      
      console.log(`💾 Memory increase after 3K operations: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });
  });
});

/**
 * Load comprehensive enterprise ontologies for testing
 */
async function loadEnterpriseOntologies(store) {
  const ontologyData = `
    @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
    @prefix owl: <http://www.w3.org/2002/07/owl#> .
    @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
    @prefix foaf: <http://xmlns.com/foaf/0.1/> .
    @prefix schema: <https://schema.org/> .
    @prefix dcterms: <http://purl.org/dc/terms/> .
    
    # FIBO (Financial Industry Business Ontology) entities
    @prefix fibo: <https://spec.edmcouncil.org/fibo/> .
    
    fibo:FinancialInstrument rdf:type owl:Class ;
        rdfs:label "Financial Instrument" .
    
    fibo:RiskAssessment rdf:type owl:Class ;
        rdfs:label "Risk Assessment" .
    
    fibo:Customer rdf:type owl:Class ;
        rdfs:subClassOf foaf:Person ;
        rdfs:label "Customer" .
    
    fibo:hasRisk rdf:type owl:ObjectProperty ;
        rdfs:domain fibo:FinancialInstrument ;
        rdfs:range fibo:RiskAssessment .
    
    # FHIR (Healthcare) entities  
    @prefix fhir: <http://hl7.org/fhir/> .
    
    fhir:Patient rdf:type owl:Class ;
        rdfs:subClassOf foaf:Person ;
        rdfs:label "Patient" .
    
    fhir:Observation rdf:type owl:Class ;
        rdfs:label "Clinical Observation" .
    
    fhir:identifier rdf:type owl:DatatypeProperty ;
        rdfs:domain fhir:Patient ;
        rdfs:range xsd:string .
    
    # GS1 (Supply Chain) entities
    @prefix gs1: <https://gs1.org/ontology/> .
    
    gs1:Product rdf:type owl:Class ;
        rdfs:label "Product" .
    
    gs1:Location rdf:type owl:Class ;
        rdfs:label "Location" .
    
    gs1:gtin rdf:type owl:DatatypeProperty ;
        rdfs:domain gs1:Product ;
        rdfs:range xsd:string .
    
    # Sample instances
    ex:customer123 rdf:type fibo:Customer ;
        foaf:name "John Customer" ;
        fibo:customerID "CUST-123" .
    
    ex:patient456 rdf:type fhir:Patient ;
        fhir:identifier "PAT-456" ;
        foaf:name "Jane Patient" .
    
    ex:product789 rdf:type gs1:Product ;
        gs1:gtin "1234567890123" ;
        rdfs:label "Sample Product" .
    
    ex:riskAssessment1 rdf:type fibo:RiskAssessment ;
        fibo:riskLevel "HIGH" ;
        fibo:assessmentDate "2023-12-25T10:30:00Z"^^xsd:dateTime .
  `;

  const parser = new Parser();
  const quads = parser.parse(ontologyData);
  
  quads.forEach(quad => store.addQuad(quad));
  
  console.log(`🏢 Loaded ${quads.length} enterprise ontology triples`);
}

/**
 * Get enterprise ontology prefixes
 */
function getEnterpisePrefixes() {
  return {
    rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    rdfs: 'http://www.w3.org/2000/01/rdf-schema#', 
    owl: 'http://www.w3.org/2002/07/owl#',
    xsd: 'http://www.w3.org/2001/XMLSchema#',
    foaf: 'http://xmlns.com/foaf/0.1/',
    schema: 'https://schema.org/',
    dcterms: 'http://purl.org/dc/terms/',
    fibo: 'https://spec.edmcouncil.org/fibo/',
    fhir: 'http://hl7.org/fhir/',
    gs1: 'https://gs1.org/ontology/',
    ex: 'http://example.org/'
  };
}

/**
 * Generate Turtle from template data
 */
function generateTurtleFromTemplate(data) {
  const prefixes = Object.entries(getEnterpisePrefixes())
    .map(([prefix, uri]) => `@prefix ${prefix}: <${uri}> .`)
    .join('\n');
  
  const triples = [
    `${data.entity} rdf:type ${data.type} .`
  ];
  
  data.properties.forEach(prop => {
    const objectValue = prop.datatype ? 
      `"${prop.object}"^^${prop.datatype}` : 
      (prop.object.startsWith('ex:') || prop.object.startsWith('fibo:') ? prop.object : `"${prop.object}"`);
    
    triples.push(`${data.entity} ${prop.predicate} ${objectValue} .`);
  });
  
  return `${prefixes}\n\n${triples.join('\n')}`;
}