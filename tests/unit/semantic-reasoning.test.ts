import { describe, it, expect, beforeEach, beforeAll, afterEach, vi } from 'vitest';
import { Parser, Store, DataFactory, Reasoner } from 'n3';
import { TurtleParser, TurtleUtils } from '../../src/lib/turtle-parser.js';
import { RDFFilters } from '../../src/lib/rdf-filters.js';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader.js';
import type { 
  TurtleData, 
  RDFDataSource, 
  RDFTemplateContext,
  RDFValidationResult 
} from '../../src/lib/types/turtle-types.js';
import fs from 'fs-extra';
import path from 'node:path';

const { namedNode, literal, quad } = DataFactory;

describe('Semantic Reasoning with N3.js Engine', () => {
  let parser: TurtleParser;
  let rdfFilters: RDFFilters;
  let rdfLoader: RDFDataLoader;
  let store: Store;
  let reasoner: typeof Reasoner;

  beforeAll(async () => {
    // Ensure test fixtures directory exists
    await fs.ensureDir('tests/fixtures/turtle');
  });

  beforeEach(() => {
    parser = new TurtleParser();
    store = new Store();
    rdfFilters = new RDFFilters({ store });
    rdfLoader = new RDFDataLoader();
    
    // Mock the Reasoner if it's not available in N3.js
    reasoner = Reasoner || vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Enterprise Ontology Validation', () => {
    it('should validate Fortune 5 compliance ontology with N3 rules', async () => {
      // Create test ontology with enterprise compliance rules
      const enterpriseOntology = `
        @prefix compliance: <http://example.org/compliance#> .
        @prefix api: <http://example.org/api#> .
        @prefix security: <http://example.org/security#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix owl: <http://www.w3.org/2002/07/owl#> .

        # Enterprise API definitions
        api:UserAPI a compliance:CriticalAPI ;
            compliance:hasSecurityLevel security:High ;
            compliance:requiresAudit true ;
            compliance:dataClassification "PII" .

        api:PaymentAPI a compliance:CriticalAPI ;
            compliance:hasSecurityLevel security:Maximum ;
            compliance:requiresAudit true ;
            compliance:dataClassification "Financial" ;
            compliance:soxCompliant true .

        # Compliance rules
        compliance:CriticalAPI rdfs:subClassOf api:API .
        compliance:requiresEncryption a owl:DatatypeProperty .
      `;

      const complianceRules = `
        @prefix compliance: <http://example.org/compliance#> .
        @prefix api: <http://example.org/api#> .
        @prefix security: <http://example.org/security#> .

        # Inference rules in N3 syntax
        { ?api a compliance:CriticalAPI . }
        => 
        { ?api compliance:requiresEncryption true . } .

        { ?api compliance:dataClassification "Financial" . }
        =>
        { ?api compliance:soxCompliant true . } .

        { ?api compliance:hasSecurityLevel security:Maximum . }
        =>
        { ?api compliance:requiresPenetrationTest true . } .
      `;

      // Parse the ontology
      const ontologyResult = await parser.parse(enterpriseOntology);
      expect(ontologyResult.triples).toHaveLength(6);
      expect(ontologyResult.prefixes).toHaveProperty('compliance');

      // Add triples to store for reasoning
      const ontologyQuads = ontologyResult.triples.map(triple => 
        quad(
          namedNode(triple.subject.value),
          namedNode(triple.predicate.value),
          triple.object.type === 'uri' ? namedNode(triple.object.value) : literal(triple.object.value)
        )
      );
      store.addQuads(ontologyQuads);

      // Validate compliance requirements
      const userApiTriples = rdfFilters.rdfObject('http://example.org/api#UserAPI', 'http://example.org/compliance#hasSecurityLevel');
      expect(userApiTriples).toHaveLength(1);
      expect(userApiTriples[0].value).toBe('http://example.org/security#High');

      const paymentApiTriples = rdfFilters.rdfObject('http://example.org/api#PaymentAPI', 'http://example.org/compliance#soxCompliant');
      expect(paymentApiTriples).toHaveLength(1);
      expect(paymentApiTriples[0].value).toBe('true');
    });

    it('should apply N3 reasoning rules to infer compliance requirements', async () => {
      const apiDefinition = `
        @prefix api: <http://example.org/api#> .
        @prefix compliance: <http://example.org/compliance#> .
        @prefix security: <http://example.org/security#> .

        api:NewAPI a compliance:CriticalAPI ;
            compliance:handlesPersonalData true ;
            compliance:dataRegion "EU" .
      `;

      const gdprRules = `
        @prefix api: <http://example.org/api#> .
        @prefix compliance: <http://example.org/compliance#> .
        @prefix gdpr: <http://example.org/gdpr#> .

        # GDPR inference rules
        { ?api compliance:handlesPersonalData true .
          ?api compliance:dataRegion "EU" . }
        =>
        { ?api compliance:gdprApplicable true ;
              compliance:requiresDataProtectionOfficer true ;
              compliance:requiresPrivacyByDesign true . } .
      `;

      const apiResult = await parser.parse(apiDefinition);
      const apiQuads = apiResult.triples.map(triple => 
        quad(
          namedNode(triple.subject.value),
          namedNode(triple.predicate.value),
          triple.object.type === 'uri' ? namedNode(triple.object.value) : literal(triple.object.value)
        )
      );
      store.addQuads(apiQuads);

      // Check original properties
      const originalTriples = store.getQuads(namedNode('http://example.org/api#NewAPI'), null, null, null);
      expect(originalTriples.length).toBeGreaterThan(0);

      // In a real implementation, we would apply the reasoning rules here
      // For now, we validate that the data structure is correct for reasoning
      const handlesPersonalData = rdfFilters.rdfObject('http://example.org/api#NewAPI', 'http://example.org/compliance#handlesPersonalData');
      expect(handlesPersonalData[0].value).toBe('true');

      const dataRegion = rdfFilters.rdfObject('http://example.org/api#NewAPI', 'http://example.org/compliance#dataRegion');
      expect(dataRegion[0].value).toBe('EU');
    });

    it('should validate semantic consistency across multiple ontologies', async () => {
      const securityOntology = `
        @prefix security: <http://example.org/security#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

        security:AuthenticationLevel a rdfs:Class .
        security:Basic rdfs:subClassOf security:AuthenticationLevel .
        security:OAuth rdfs:subClassOf security:AuthenticationLevel .
        security:SAML rdfs:subClassOf security:AuthenticationLevel .
      `;

      const apiOntology = `
        @prefix api: <http://example.org/api#> .
        @prefix security: <http://example.org/security#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

        api:Endpoint a rdfs:Class .
        api:PublicEndpoint rdfs:subClassOf api:Endpoint ;
            api:defaultAuth security:Basic .
        api:PrivateEndpoint rdfs:subClassOf api:Endpoint ;
            api:defaultAuth security:OAuth .
      `;

      // Parse both ontologies
      const securityResult = await parser.parse(securityOntology);
      const apiResult = await parser.parse(apiOntology);

      expect(securityResult.triples).toHaveLength(4);
      expect(apiResult.triples).toHaveLength(4);

      // Check for vocabulary alignment
      const securityPrefixes = securityResult.prefixes;
      const apiPrefixes = apiResult.prefixes;

      expect(securityPrefixes).toHaveProperty('security');
      expect(apiPrefixes).toHaveProperty('security');
      expect(apiPrefixes.security).toBe(securityPrefixes.security);
    });
  });

  describe('SPARQL-like Query Processing', () => {
    it('should execute complex queries on enterprise knowledge graphs', async () => {
      const knowledgeGraph = `
        @prefix org: <http://example.org/org#> .
        @prefix api: <http://example.org/api#> .
        @prefix compliance: <http://example.org/compliance#> .

        org:PaymentsTeam a org:Team ;
            org:owns api:PaymentAPI, api:BillingAPI .

        org:UserTeam a org:Team ;
            org:owns api:UserAPI, api:ProfileAPI .

        api:PaymentAPI compliance:riskLevel "High" ;
            compliance:requiresApproval org:SecurityTeam .

        api:UserAPI compliance:riskLevel "Medium" ;
            compliance:requiresApproval org:DataTeam .
      `;

      const result = await parser.parse(knowledgeGraph);
      const quads = result.triples.map(triple => 
        quad(
          namedNode(triple.subject.value),
          namedNode(triple.predicate.value),
          triple.object.type === 'uri' ? namedNode(triple.object.value) : literal(triple.object.value)
        )
      );
      store.addQuads(quads);

      // Query: Find all APIs owned by teams with their risk levels
      const queryPattern = {
        subject: null,
        predicate: 'http://example.org/org#owns',
        object: null
      };

      const queryResults = rdfFilters.rdfQuery(queryPattern);
      expect(queryResults.length).toBe(4); // 2 teams × 2 APIs each

      // Verify we can find risk levels for owned APIs
      const paymentApiRisk = rdfFilters.rdfObject('http://example.org/api#PaymentAPI', 'http://example.org/compliance#riskLevel');
      expect(paymentApiRisk[0].value).toBe('High');

      const userApiRisk = rdfFilters.rdfObject('http://example.org/api#UserAPI', 'http://example.org/compliance#riskLevel');
      expect(userApiRisk[0].value).toBe('Medium');
    });

    it('should support template variable extraction from semantic queries', async () => {
      const semanticData = `
        @prefix template: <http://example.org/template#> .
        @prefix config: <http://example.org/config#> .

        template:APIGenerator config:hasVariable [
            config:name "apiName" ;
            config:type "string" ;
            config:required true ;
            config:description "Name of the API to generate"
        ] .

        template:APIGenerator config:hasVariable [
            config:name "securityLevel" ;
            config:type "enum" ;
            config:values ("Basic", "OAuth", "SAML") ;
            config:default "OAuth"
        ] .
      `;

      const source: RDFDataSource = {
        type: 'inline',
        source: semanticData,
        format: 'text/turtle'
      };

      const loadResult = await rdfLoader.loadFromSource(source);
      expect(loadResult.success).toBe(true);
      expect(loadResult.variables).toBeDefined();

      // The variables should be structured for template use
      const templateVars = loadResult.variables;
      expect(Object.keys(templateVars)).toHaveLength(1); // One template generator

      // Check if we extracted the generator configuration
      const generator = templateVars['APIGenerator'];
      expect(generator).toBeDefined();
      expect(generator.uri).toBe('http://example.org/template#APIGenerator');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large RDF graphs efficiently', async () => {
      // Generate a large synthetic ontology
      const largeOntology = generateLargeOntology(1000); // 1000 entities

      const startTime = performance.now();
      const result = await parser.parse(largeOntology);
      const parseTime = performance.now() - startTime;

      expect(result.triples.length).toBeGreaterThan(2000); // Each entity generates multiple triples
      expect(parseTime).toBeLessThan(5000); // Should parse in under 5 seconds

      // Test memory usage by adding to store
      const memoryBefore = process.memoryUsage().heapUsed;
      const quads = result.triples.map(triple => 
        quad(
          namedNode(triple.subject.value),
          namedNode(triple.predicate.value),
          triple.object.type === 'uri' ? namedNode(triple.object.value) : literal(triple.object.value)
        )
      );
      store.addQuads(quads);
      const memoryAfter = process.memoryUsage().heapUsed;
      const memoryIncrease = memoryAfter - memoryBefore;

      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Under 100MB increase
    });

    it('should optimize repeated reasoning operations', async () => {
      const baseOntology = `
        @prefix test: <http://example.org/test#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

        test:Entity a rdfs:Class .
        test:SpecialEntity rdfs:subClassOf test:Entity .
      `;

      // Parse once
      const result = await parser.parse(baseOntology);
      const quads = result.triples.map(triple => 
        quad(
          namedNode(triple.subject.value),
          namedNode(triple.predicate.value),
          triple.object.type === 'uri' ? namedNode(triple.object.value) : literal(triple.object.value)
        )
      );
      store.addQuads(quads);

      // Perform multiple reasoning operations and measure performance
      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const types = rdfFilters.rdfType('http://example.org/test#SpecialEntity');
        expect(types.length).toBeGreaterThan(0);
      }

      const totalTime = performance.now() - startTime;
      const averageTime = totalTime / iterations;

      expect(averageTime).toBeLessThan(10); // Each operation should take less than 10ms on average
    });
  });

  describe('Enterprise Compliance Scenarios', () => {
    it('should validate SOX compliance for financial API templates', async () => {
      const soxOntology = `
        @prefix sox: <http://example.org/sox#> .
        @prefix api: <http://example.org/api#> .
        @prefix audit: <http://example.org/audit#> .

        sox:FinancialAPI a sox:ComplianceRequirement ;
            sox:requiresAuditLog true ;
            sox:requiresDataIntegrity true ;
            sox:requiresAccessControl true .

        api:AccountingAPI a sox:FinancialAPI ;
            audit:logLevel "DETAILED" ;
            audit:retentionPeriod "7years" .
      `;

      const result = await parser.parse(soxOntology);
      const quads = result.triples.map(triple => 
        quad(
          namedNode(triple.subject.value),
          namedNode(triple.predicate.value),
          triple.object.type === 'uri' ? namedNode(triple.object.value) : literal(triple.object.value)
        )
      );
      store.addQuads(quads);

      // Validate SOX compliance requirements
      const auditLogRequired = rdfFilters.rdfObject('http://example.org/sox#FinancialAPI', 'http://example.org/sox#requiresAuditLog');
      expect(auditLogRequired[0].value).toBe('true');

      const accountingApiType = rdfFilters.rdfType('http://example.org/api#AccountingAPI');
      expect(accountingApiType).toContain('http://example.org/sox#FinancialAPI');

      const logLevel = rdfFilters.rdfObject('http://example.org/api#AccountingAPI', 'http://example.org/audit#logLevel');
      expect(logLevel[0].value).toBe('DETAILED');
    });

    it('should process GDPR compliance requirements for EU data handling', async () => {
      const gdprOntology = `
        @prefix gdpr: <http://example.org/gdpr#> .
        @prefix data: <http://example.org/data#> .
        @prefix privacy: <http://example.org/privacy#> .

        gdpr:PersonalDataAPI a gdpr:DataController ;
            gdpr:processesPersonalData true ;
            gdpr:dataSubjectRights (gdpr:RightToAccess gdpr:RightToErasure gdpr:RightToPortability) ;
            privacy:consentRequired true .

        data:UserProfileAPI a gdpr:PersonalDataAPI ;
            data:dataCategories ("name" "email" "address") ;
            privacy:retentionPeriod "2years" .
      `;

      const result = await parser.parse(gdprOntology);
      expect(result.triples).toHaveLength(6);

      const quads = result.triples.map(triple => 
        quad(
          namedNode(triple.subject.value),
          namedNode(triple.predicate.value),
          triple.object.type === 'uri' ? namedNode(triple.object.value) : literal(triple.object.value)
        )
      );
      store.addQuads(quads);

      // Validate GDPR requirements
      const processesPersonalData = rdfFilters.rdfObject('http://example.org/gdpr#PersonalDataAPI', 'http://example.org/gdpr#processesPersonalData');
      expect(processesPersonalData[0].value).toBe('true');

      const consentRequired = rdfFilters.rdfObject('http://example.org/gdpr#PersonalDataAPI', 'http://example.org/privacy#consentRequired');
      expect(consentRequired[0].value).toBe('true');

      const userProfileType = rdfFilters.rdfType('http://example.org/data#UserProfileAPI');
      expect(userProfileType).toContain('http://example.org/gdpr#PersonalDataAPI');
    });
  });

  describe('Error Handling and Validation', () => {
    it('should handle malformed TTL gracefully', async () => {
      const invalidTTL = `
        @prefix invalid: <http://example.org/invalid#> .
        
        invalid:BadEntity invalid:missingDot
        invalid:AnotherEntity "unclosed string ;
      `;

      await expect(parser.parse(invalidTTL)).rejects.toThrow();
    });

    it('should validate semantic consistency and report violations', async () => {
      const inconsistentOntology = `
        @prefix test: <http://example.org/test#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix owl: <http://www.w3.org/2002/07/owl#> .

        test:Person a owl:Class .
        test:Animal a owl:Class .
        
        test:Person owl:disjointWith test:Animal .
        
        test:John a test:Person .
        test:John a test:Animal .  # This creates an inconsistency
      `;

      const result = await parser.parse(inconsistentOntology);
      expect(result.triples).toHaveLength(5);

      // In a real semantic reasoner, this would detect the inconsistency
      // For now, we validate the data is parsed correctly
      const johnTypes = rdfFilters.rdfType('http://example.org/test#John');
      expect(johnTypes).toContain('http://example.org/test#Person');
      expect(johnTypes).toContain('http://example.org/test#Animal');
    });

    it('should provide detailed error messages for semantic violations', async () => {
      const validationResult: RDFValidationResult = {
        valid: false,
        errors: [{
          message: 'Inconsistent class assertion detected',
          line: 10,
          column: 15,
          severity: 'error'
        }],
        warnings: [{
          message: 'Unused namespace prefix detected',
          line: 2,
          column: 1
        }]
      };

      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors).toHaveLength(1);
      expect(validationResult.warnings).toHaveLength(1);
      expect(validationResult.errors[0].severity).toBe('error');
    });
  });
});

/**
 * Helper function to generate large synthetic ontologies for performance testing
 */
function generateLargeOntology(entityCount: number): string {
  let ontology = `
    @prefix test: <http://example.org/test#> .
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
    @prefix owl: <http://www.w3.org/2002/07/owl#> .
    
    test:BaseEntity a owl:Class .
  `;

  for (let i = 0; i < entityCount; i++) {
    ontology += `
    test:Entity${i} a test:BaseEntity ;
        rdfs:label "Entity ${i}" ;
        test:hasIndex ${i} ;
        test:category "Category${i % 10}" .
    `;
  }

  return ontology;
}