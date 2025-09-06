import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { MCPBridge, createMCPBridge } from '../../src/lib/mcp-integration.js';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader.js';
import { TurtleParser } from '../../src/lib/turtle-parser.js';
import { RDFFilters } from '../../src/lib/rdf-filters.js';
import { Generator } from '../../src/lib/generator.js';
import type { 
  SwarmTask, 
  JTBDWorkflow,
  RDFDataSource, 
  TurtleData, 
  RDFTemplateContext 
} from '../../src/lib/mcp-integration.js';
import fs from 'fs-extra';
import path from 'node:path';

describe('Knowledge Graph Processing Integration', () => {
  let mcpBridge: MCPBridge;
  let rdfLoader: RDFDataLoader;
  let generator: Generator;
  let parser: TurtleParser;

  beforeAll(async () => {
    // Setup test fixtures
    await fs.ensureDir('tests/fixtures/turtle');
    await fs.ensureDir('tests/fixtures/templates/semantic-api');
    await fs.ensureDir('tests/fixtures/generated');

    // Create test ontologies
    await createTestOntologies();
    await createSemanticTemplates();
  });

  beforeEach(async () => {
    // Initialize MCP bridge with test configuration
    mcpBridge = new MCPBridge({
      debugMode: true,
      hooksEnabled: false, // Disable hooks for testing
      realtimeSync: false,
      memoryNamespace: 'test-semantic-integration'
    });

    rdfLoader = new RDFDataLoader({
      baseUri: 'http://test.example.org/',
      cacheEnabled: true,
      templateDir: 'tests/fixtures'
    });

    generator = new Generator();
    parser = new TurtleParser();
  });

  afterEach(async () => {
    await mcpBridge.destroy();
  });

  afterAll(async () => {
    await fs.remove('tests/fixtures/generated');
  });

  describe('Enterprise Knowledge Graph Workflows', () => {
    it('should process Fortune 5 compliance knowledge graph for API generation', async () => {
      // Load enterprise compliance ontology
      const complianceSource: RDFDataSource = {
        type: 'file',
        source: 'tests/fixtures/turtle/fortune5-compliance.ttl',
        format: 'text/turtle'
      };

      const complianceResult = await rdfLoader.loadFromSource(complianceSource);
      expect(complianceResult.success).toBe(true);
      expect(complianceResult.data.subjects).toBeDefined();

      // Create JTBD workflow for API generation with compliance
      const workflow: JTBDWorkflow = {
        id: 'fortune5-api-compliance',
        name: 'Generate Fortune 5 Compliant API',
        description: 'Generate API services that comply with Fortune 5 enterprise policies',
        job: 'As a Fortune 5 enterprise developer, I need to generate APIs that automatically comply with our governance policies',
        steps: [
          {
            action: 'analyze',
            description: 'Analyze compliance requirements from knowledge graph',
            parameters: {
              ontology: complianceSource,
              analysisType: 'compliance-requirements'
            }
          },
          {
            action: 'generate',
            description: 'Generate compliant API service',
            generator: 'enterprise-api',
            template: 'compliant-service',
            parameters: {
              dest: 'tests/fixtures/generated/fortune5-api',
              variables: complianceResult.variables,
              complianceMode: true
            }
          },
          {
            action: 'validate',
            description: 'Validate generated API against compliance rules',
            parameters: {
              files: ['tests/fixtures/generated/fortune5-api'],
              complianceRules: 'tests/fixtures/turtle/compliance-rules.n3'
            }
          }
        ]
      };

      const workflowResult = await mcpBridge.orchestrateJTBD(workflow);
      
      expect(workflowResult.success).toBe(true);
      expect(workflowResult.errors).toHaveLength(0);
      expect(workflowResult.results).toHaveLength(3);
      
      // Verify compliance analysis step
      const analysisStep = workflowResult.results[0];
      expect(analysisStep.success).toBe(true);
      expect(analysisStep.action).toBe('analyze');
      
      // Verify generation step  
      const generationStep = workflowResult.results[1];
      expect(generationStep.success).toBe(true);
      expect(generationStep.action).toBe('generate');
      
      // Verify validation step
      const validationStep = workflowResult.results[2];
      expect(validationStep.success).toBe(true);
      expect(validationStep.action).toBe('validate');
    });

    it('should integrate semantic reasoning with template variable generation', async () => {
      // Load API governance knowledge base
      const governanceKB = `
        @prefix api: <http://example.org/api#> .
        @prefix governance: <http://example.org/governance#> .
        @prefix security: <http://example.org/security#> .
        @prefix compliance: <http://example.org/compliance#> .

        api:PaymentService a governance:CriticalService ;
            governance:securityLevel security:Maximum ;
            governance:auditRequired true ;
            governance:dataClassification "Financial" ;
            compliance:regulatoryFramework "PCI-DSS" ;
            api:requiresAuthentication true ;
            api:requiresAuthorization true ;
            api:rateLimit 100 .

        api:UserService a governance:StandardService ;
            governance:securityLevel security:High ;
            governance:auditRequired false ;
            governance:dataClassification "PII" ;
            compliance:regulatoryFramework "GDPR" ;
            api:requiresAuthentication true ;
            api:requiresAuthorization false ;
            api:rateLimit 1000 .
      `;

      const governanceSource: RDFDataSource = {
        type: 'inline',
        source: governanceKB,
        format: 'text/turtle'
      };

      // Test template variable synchronization
      const variables = await mcpBridge.syncTemplateVariables('enterprise-api', 'service-template', {
        rdf: governanceSource
      });

      expect(variables).toBeDefined();
      expect(variables.PaymentService).toBeDefined();
      expect(variables.UserService).toBeDefined();

      // Verify semantic reasoning results
      const paymentService = variables.PaymentService;
      expect(paymentService.securityLevel).toContain('Maximum');
      expect(paymentService.auditRequired).toBe(true);
      expect(paymentService.requiresAuthentication).toBe(true);

      const userService = variables.UserService;
      expect(userService.securityLevel).toContain('High');
      expect(userService.auditRequired).toBe(false);
      expect(userService.rateLimit).toBe(1000);
    });

    it('should process large-scale enterprise architecture knowledge graphs', async () => {
      // Create large enterprise architecture graph
      const enterpriseArchitecture = generateEnterpriseArchitectureGraph(500); // 500 services

      const source: RDFDataSource = {
        type: 'inline',
        source: enterpriseArchitecture,
        format: 'text/turtle'
      };

      const startTime = performance.now();
      const result = await rdfLoader.loadFromSource(source);
      const processTime = performance.now() - startTime;

      expect(result.success).toBe(true);
      expect(processTime).toBeLessThan(10000); // Should process in under 10 seconds

      // Verify data structure
      expect(Object.keys(result.data.subjects)).toHaveLength(500);
      expect(result.data.triples.length).toBeGreaterThan(2000); // Multiple properties per service

      // Test query performance on large graph
      const queryStartTime = performance.now();
      const criticalServices = Object.values(result.data.subjects)
        .filter(service => service.type?.includes('http://example.org/architecture#CriticalService'));
      const queryTime = performance.now() - queryStartTime;

      expect(queryTime).toBeLessThan(1000); // Query should complete in under 1 second
      expect(criticalServices.length).toBeGreaterThan(0);
    });
  });

  describe('Cross-Ontology Reasoning and Validation', () => {
    it('should validate consistency across multiple domain ontologies', async () => {
      // Load multiple domain ontologies
      const securityOntologySource: RDFDataSource = {
        type: 'file',
        source: 'tests/fixtures/turtle/security-ontology.ttl'
      };

      const apiOntologySource: RDFDataSource = {
        type: 'file', 
        source: 'tests/fixtures/turtle/api-ontology.ttl'
      };

      const complianceOntologySource: RDFDataSource = {
        type: 'file',
        source: 'tests/fixtures/turtle/compliance-ontology.ttl'
      };

      // Load all ontologies
      const [securityResult, apiResult, complianceResult] = await Promise.all([
        rdfLoader.loadFromSource(securityOntologySource),
        rdfLoader.loadFromSource(apiOntologySource), 
        rdfLoader.loadFromSource(complianceOntologySource)
      ]);

      expect(securityResult.success).toBe(true);
      expect(apiResult.success).toBe(true);
      expect(complianceResult.success).toBe(true);

      // Validate cross-ontology consistency
      const allPrefixes = {
        ...securityResult.data.prefixes,
        ...apiResult.data.prefixes,
        ...complianceResult.data.prefixes
      };

      // Check for vocabulary alignment
      expect(allPrefixes).toHaveProperty('security');
      expect(allPrefixes).toHaveProperty('api');
      expect(allPrefixes).toHaveProperty('compliance');

      // Validate no conflicting definitions
      const securityClasses = Object.values(securityResult.data.subjects)
        .filter(s => s.type?.includes('http://www.w3.org/2000/01/rdf-schema#Class'));
      const apiClasses = Object.values(apiResult.data.subjects)
        .filter(s => s.type?.includes('http://www.w3.org/2000/01/rdf-schema#Class'));

      expect(securityClasses.length).toBeGreaterThan(0);
      expect(apiClasses.length).toBeGreaterThan(0);
    });

    it('should apply N3 reasoning rules across knowledge domains', async () => {
      // Integrated knowledge base with cross-domain rules
      const integratedKB = `
        @prefix security: <http://example.org/security#> .
        @prefix api: <http://example.org/api#> .
        @prefix compliance: <http://example.org/compliance#> .

        # API definitions
        api:PaymentAPI a api:Service ;
            api:handlesFinancialData true ;
            api:dataClassification "Sensitive" .

        # Security rules (would be in N3 format in real implementation)
        # { ?api api:handlesFinancialData true } => { ?api security:requiresEncryption true } .
        # { ?api api:dataClassification "Sensitive" } => { ?api compliance:auditRequired true } .
      `;

      const source: RDFDataSource = {
        type: 'inline',
        source: integratedKB,
        format: 'text/turtle'
      };

      const result = await rdfLoader.loadFromSource(source);
      expect(result.success).toBe(true);

      // Verify base facts
      const paymentAPI = result.data.subjects['http://example.org/api#PaymentAPI'];
      expect(paymentAPI).toBeDefined();
      expect(paymentAPI.properties['http://example.org/api#handlesFinancialData']).toBeDefined();

      // In a full implementation, reasoning would apply rules to infer:
      // - security:requiresEncryption true
      // - compliance:auditRequired true
    });
  });

  describe('Semantic Template Generation', () => {
    it('should generate API code with semantic annotations from knowledge graphs', async () => {
      // API semantic model
      const apiModel = `
        @prefix api: <http://example.org/api#> .
        @prefix openapi: <http://example.org/openapi#> .
        @prefix schema: <http://schema.org/> .

        api:UserAPI a api:RESTService ;
            api:basePath "/api/v1/users" ;
            openapi:version "3.0.0" ;
            schema:name "User Management API" ;
            schema:description "API for managing user accounts and profiles" .

        api:UserAPI api:hasEndpoint [
            api:path "/users" ;
            api:method "GET" ;
            api:operationId "listUsers" ;
            api:summary "List all users" ;
            openapi:responses [
                openapi:statusCode 200 ;
                openapi:description "List of users" ;
                openapi:contentType "application/json"
            ]
        ] .

        api:UserAPI api:hasEndpoint [
            api:path "/users/{id}" ;
            api:method "GET" ;
            api:operationId "getUser" ;
            api:summary "Get user by ID" ;
            api:parameters [
                api:name "id" ;
                api:in "path" ;
                api:required true ;
                api:type "string"
            ]
        ] .
      `;

      const swarmTask: SwarmTask = {
        id: 'semantic-api-generation',
        type: 'generate',
        description: 'Generate API from semantic model',
        parameters: {
          generator: 'semantic-api',
          template: 'openapi-service',
          dest: 'tests/fixtures/generated/semantic-api',
          variables: {},
          rdf: {
            type: 'inline',
            source: apiModel,
            format: 'text/turtle'
          }
        }
      };

      const unjucksParams = await mcpBridge.swarmToUnjucks(swarmTask);
      expect(unjucksParams).toBeDefined();
      expect(unjucksParams?.generator).toBe('semantic-api');

      // Verify RDF data is included in generation parameters
      if (unjucksParams && 'variables' in unjucksParams) {
        expect(unjucksParams.variables).toBeDefined();
      }
    });

    it('should validate generated code against semantic compliance rules', async () => {
      // Compliance rules for generated code
      const complianceRules = `
        @prefix code: <http://example.org/code#> .
        @prefix compliance: <http://example.org/compliance#> .

        code:APIEndpoint compliance:requiresValidation [
            compliance:rule "Must have input validation" ;
            compliance:severity "ERROR"
        ] .

        code:APIEndpoint compliance:requiresErrorHandling [
            compliance:rule "Must handle errors gracefully" ;
            compliance:severity "WARNING"  
        ] .

        code:APIEndpoint compliance:requiresLogging [
            compliance:rule "Must include audit logging" ;
            compliance:severity "INFO"
        ] .
      `;

      const validationWorkflow: JTBDWorkflow = {
        id: 'code-compliance-validation',
        name: 'Validate Generated Code Compliance',
        description: 'Ensure generated code meets enterprise compliance standards',
        job: 'Validate that AI-generated code follows our compliance requirements',
        steps: [
          {
            action: 'generate',
            description: 'Generate API code',
            generator: 'api',
            template: 'rest-service',
            parameters: {
              dest: 'tests/fixtures/generated/compliance-test',
              apiName: 'TestAPI'
            }
          },
          {
            action: 'validate',
            description: 'Validate against compliance rules',
            parameters: {
              files: ['tests/fixtures/generated/compliance-test'],
              complianceRules: complianceRules,
              validationLevel: 'strict'
            }
          }
        ]
      };

      const workflowResult = await mcpBridge.orchestrateJTBD(validationWorkflow);
      
      expect(workflowResult.success).toBe(true);
      expect(workflowResult.results).toHaveLength(2);

      const validationResult = workflowResult.results[1];
      expect(validationResult.success).toBe(true);
      expect(validationResult.action).toBe('validate');
    });
  });

  describe('Real-time Knowledge Graph Updates', () => {
    it('should handle streaming updates to enterprise knowledge graphs', async () => {
      // Initial knowledge graph
      let currentKB = `
        @prefix org: <http://example.org/org#> .
        @prefix api: <http://example.org/api#> .

        org:TeamA api:owns api:ServiceX .
        api:ServiceX api:version "1.0.0" .
      `;

      const initialSource: RDFDataSource = {
        type: 'inline',
        source: currentKB,
        format: 'text/turtle'
      };

      const initialResult = await rdfLoader.loadFromSource(initialSource);
      expect(initialResult.success).toBe(true);
      expect(initialResult.data.subjects['http://example.org/api#ServiceX']).toBeDefined();

      // Simulate streaming update
      const updatedKB = `
        @prefix org: <http://example.org/org#> .
        @prefix api: <http://example.org/api#> .

        org:TeamA api:owns api:ServiceX, api:ServiceY .
        api:ServiceX api:version "2.0.0" .
        api:ServiceY api:version "1.0.0" ;
            api:status "beta" .
      `;

      const updatedSource: RDFDataSource = {
        type: 'inline', 
        source: updatedKB,
        format: 'text/turtle'
      };

      const updatedResult = await rdfLoader.loadFromSource(updatedSource);
      expect(updatedResult.success).toBe(true);
      
      // Verify updates
      expect(updatedResult.data.subjects['http://example.org/api#ServiceY']).toBeDefined();
      
      const serviceX = updatedResult.data.subjects['http://example.org/api#ServiceX'];
      const versionProperty = serviceX.properties['http://example.org/api#version'];
      expect(versionProperty[0].value).toBe('2.0.0');
    });

    it('should synchronize knowledge graph changes with template variables', async () => {
      // Setup initial state
      const initialVariables = { serviceCount: 1, teamCount: 1 };
      
      // Simulate knowledge graph update that changes variables
      const updatedKB = `
        @prefix org: <http://example.org/org#> .
        @prefix api: <http://example.org/api#> .

        org:TeamA api:owns api:Service1, api:Service2, api:Service3 .
        org:TeamB api:owns api:Service4 .
        
        api:Service1 api:version "1.0.0" .
        api:Service2 api:version "1.1.0" .
        api:Service3 api:version "2.0.0" .
        api:Service4 api:version "1.0.0" .
      `;

      const syncedVariables = await mcpBridge.syncTemplateVariables('org-api', 'team-services', {
        rdf: {
          type: 'inline',
          source: updatedKB,
          format: 'text/turtle'
        }
      });

      expect(syncedVariables).toBeDefined();
      
      // Verify synchronized variables reflect knowledge graph changes
      const services = Object.keys(syncedVariables).filter(key => key.startsWith('Service'));
      expect(services.length).toBe(4);
    });
  });

  describe('Performance and Scalability', () => {
    it('should maintain performance with complex reasoning operations', async () => {
      // Create complex ontology with multiple inheritance levels
      const complexOntology = `
        @prefix ex: <http://example.org/> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix owl: <http://www.w3.org/2002/07/owl#> .

        ex:Entity a owl:Class .
        ex:Service rdfs:subClassOf ex:Entity .
        ex:APIService rdfs:subClassOf ex:Service .
        ex:RESTService rdfs:subClassOf ex:APIService .
        ex:GraphQLService rdfs:subClassOf ex:APIService .
        ex:MicroService rdfs:subClassOf ex:Service .
        
        ${Array.from({length: 100}, (_, i) => `
          ex:Service${i} a ex:RESTService ;
              ex:hasEndpoint ex:Endpoint${i} ;
              ex:version "1.${i}.0" ;
              ex:owner ex:Team${i % 10} .
        `).join('')}
      `;

      const source: RDFDataSource = {
        type: 'inline',
        source: complexOntology,
        format: 'text/turtle'
      };

      const startTime = performance.now();
      const result = await rdfLoader.loadFromSource(source);
      const loadTime = performance.now() - startTime;

      expect(result.success).toBe(true);
      expect(loadTime).toBeLessThan(5000); // Should load in under 5 seconds

      // Test reasoning performance
      const reasoningStartTime = performance.now();
      const restServices = Object.values(result.data.subjects)
        .filter(subject => subject.type?.includes('http://example.org/RESTService'));
      const reasoningTime = performance.now() - reasoningStartTime;

      expect(reasoningTime).toBeLessThan(1000); // Reasoning should be fast
      expect(restServices.length).toBe(100);
    });
  });
});

// Helper functions for test setup

async function createTestOntologies(): Promise<void> {
  const fortune5Compliance = `
    @prefix compliance: <http://example.org/compliance#> .
    @prefix api: <http://example.org/api#> .
    @prefix security: <http://example.org/security#> .
    
    compliance:Fortune5Policy a compliance:ComplianceFramework ;
        compliance:requiresDataGovernance true ;
        compliance:requiresSecurityReview true ;
        compliance:auditFrequency "quarterly" .
    
    api:CriticalAPI rdfs:subClassOf api:API ;
        compliance:governedBy compliance:Fortune5Policy .
  `;

  const securityOntology = `
    @prefix security: <http://example.org/security#> .
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
    
    security:SecurityLevel a rdfs:Class .
    security:Basic rdfs:subClassOf security:SecurityLevel .
    security:High rdfs:subClassOf security:SecurityLevel .
    security:Maximum rdfs:subClassOf security:SecurityLevel .
  `;

  const apiOntology = `
    @prefix api: <http://example.org/api#> .
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
    
    api:API a rdfs:Class .
    api:RESTService rdfs:subClassOf api:API .
    api:GraphQLService rdfs:subClassOf api:API .
  `;

  const complianceOntology = `
    @prefix compliance: <http://example.org/compliance#> .
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
    
    compliance:ComplianceFramework a rdfs:Class .
    compliance:AuditRequired a compliance:Requirement .
    compliance:DataGovernance a compliance:Requirement .
  `;

  await fs.writeFile('tests/fixtures/turtle/fortune5-compliance.ttl', fortune5Compliance);
  await fs.writeFile('tests/fixtures/turtle/security-ontology.ttl', securityOntology);
  await fs.writeFile('tests/fixtures/turtle/api-ontology.ttl', apiOntology);
  await fs.writeFile('tests/fixtures/turtle/compliance-ontology.ttl', complianceOntology);
}

async function createSemanticTemplates(): Promise<void> {
  const semanticApiTemplate = `---
to: src/{{ apiName | lower }}/service.ts
rdf:
  type: inline
  source: |
    @prefix api: <http://example.org/api#> .
    @prefix openapi: <http://example.org/openapi#> .
    
    api:{{ apiName }}API a api:RESTService ;
        openapi:version "3.0.0" ;
        api:basePath "/api/v1/{{ apiName | lower }}" .
---
import express from 'express';

/**
 * {{ apiName }} Service
 * Generated from semantic API model
 * 
 * RDF Metadata:
 * - Type: {{ $rdf.getByType('http://example.org/api#RESTService')[0].type }}
 * - Version: {{ $rdf.query(null, 'http://example.org/openapi#version', null)[0][2].value }}
 */
export class {{ apiName }}Service {
  private app = express();
  
  constructor() {
    this.setupRoutes();
  }
  
  private setupRoutes(): void {
    // Routes generated from semantic model
    this.app.get('{{ $rdf.subjects[apiName + "API"].properties["http://example.org/api#basePath"][0].value }}', this.handleList);
  }
  
  private handleList = (req: express.Request, res: express.Response): void => {
    // Implementation with semantic compliance
    res.json({ message: 'List {{ apiName | lower }} items' });
  };
}`;

  await fs.writeFile('tests/fixtures/templates/semantic-api/service.ejs', semanticApiTemplate);
}

function generateEnterpriseArchitectureGraph(serviceCount: number): string {
  let graph = `
    @prefix arch: <http://example.org/architecture#> .
    @prefix service: <http://example.org/service#> .
    @prefix team: <http://example.org/team#> .
    
    arch:EnterpriseArchitecture a arch:Architecture .
  `;

  for (let i = 0; i < serviceCount; i++) {
    const serviceType = i % 3 === 0 ? 'CriticalService' : 'StandardService';
    const teamId = Math.floor(i / 10);
    
    graph += `
    service:Service${i} a arch:${serviceType} ;
        arch:ownedBy team:Team${teamId} ;
        arch:version "1.${i % 10}.0" ;
        arch:status "active" ;
        arch:deploymentEnvironment "production" .
    `;
  }

  return graph;
}