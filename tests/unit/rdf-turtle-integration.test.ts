/**
 * Unit Tests for RDF/Turtle Data Loading Integration
 * Tests semantic data processing, N3.js integration, and template generation with RDF schemas
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ClaudeFlowConnector } from '../../src/mcp/claude-flow-connector.js';
import { JTBDWorkflows } from '../../src/mcp/jtbd-workflows.js';
import { SharedMemoryInterface } from '../../src/mcp/shared-memory-interface.js';
import { TaskOrchestrator } from '../../src/mcp/task-orchestrator.js';
import { Fortune5CompanyProfile } from '../../src/lib/types/index.js';

// Mock RDF/Turtle data for testing
const mockApiStandardsTTL = `
@prefix api: <http://enterprise.com/api#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

# API Standard Classes
api:APIStandard rdf:type rdfs:Class ;
  rdfs:label "API Standard" ;
  api:version "3.1" ;
  api:protocol "REST" ;
  api:format "JSON" .

api:SecurityRequirement rdf:type rdfs:Class ;
  rdfs:label "Security Requirement" ;
  api:authMethod "OAuth2" ;
  api:encryption "TLS1.3" ;
  api:rateLimit "1000/hour" .

api:ResponseFormat rdf:type rdfs:Class ;
  rdfs:label "Response Format" ;
  api:mediaType "application/json" ;
  api:schema "OpenAPI3.1" ;
  api:compression "gzip" .

# Specific API Standards
api:UserAPI rdf:type api:APIStandard ;
  rdfs:label "User Management API" ;
  api:endpoint "/users" ;
  api:methods "GET,POST,PUT,DELETE" ;
  api:authentication api:OAuth2 ;
  api:versioning "header" .

api:PaymentAPI rdf:type api:APIStandard ;
  rdfs:label "Payment Processing API" ;
  api:endpoint "/payments" ;
  api:methods "POST,GET" ;
  api:authentication api:JWT ;
  api:compliance "PCI-DSS" ;
  api:encryption "AES-256" .
`;

const mockComplianceRequirementsTTL = `
@prefix compliance: <http://enterprise.com/compliance#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

# Compliance Requirement Classes
compliance:ComplianceRequirement rdf:type rdfs:Class ;
  rdfs:label "Compliance Requirement" ;
  compliance:framework "SOX" ;
  compliance:severity "critical" ;
  compliance:auditRequired true .

compliance:AuditPolicy rdf:type rdfs:Class ;
  rdfs:label "Audit Policy" ;
  compliance:retention "7 years" ;
  compliance:immutable true ;
  compliance:encryption true .

compliance:DataProtection rdf:type rdfs:Class ;
  rdfs:label "Data Protection" ;
  compliance:framework "GDPR" ;
  compliance:rightToErasure true ;
  compliance:dataPortability true ;
  compliance:consentRequired true .

# Specific Requirements
compliance:FinancialReporting rdf:type compliance:ComplianceRequirement ;
  rdfs:label "Financial Reporting Compliance" ;
  compliance:framework "SOX" ;
  compliance:section "404" ;
  compliance:controls "ITGC,ELC" ;
  compliance:frequency "quarterly" .

compliance:PersonalDataHandling rdf:type compliance:ComplianceRequirement ;
  rdfs:label "Personal Data Handling" ;
  compliance:framework "GDPR" ;
  compliance:lawfulBasis "consent" ;
  compliance:retentionPeriod "2 years" ;
  compliance:dataSubjects "EU residents" .
`;

const mockSchemaMetadataTTL = `
@prefix schema: <http://enterprise.com/schema#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

# Schema Metadata Classes
schema:DatabaseSchema rdf:type rdfs:Class ;
  rdfs:label "Database Schema" ;
  schema:version "1.0" ;
  schema:engine "PostgreSQL" ;
  schema:charset "UTF8" .

schema:Table rdf:type rdfs:Class ;
  rdfs:label "Database Table" ;
  schema:primaryKey "id" ;
  schema:indexes "btree" ;
  schema:constraints "foreign_key" .

schema:Column rdf:type rdfs:Class ;
  rdfs:label "Table Column" ;
  schema:dataType "VARCHAR" ;
  schema:nullable false ;
  schema:defaultValue "" .

# Specific Schema Elements
schema:UserTable rdf:type schema:Table ;
  rdfs:label "User Table" ;
  schema:tableName "users" ;
  schema:primaryKey "user_id" ;
  schema:columns "user_id,email,created_at,updated_at" ;
  schema:indexes "email_idx,created_at_idx" .

schema:PaymentTable rdf:type schema:Table ;
  rdfs:label "Payment Table" ;
  schema:tableName "payments" ;
  schema:primaryKey "payment_id" ;
  schema:foreignKeys "user_id->users.user_id" ;
  schema:encryption "payment_amount,card_number" .
`;

describe('RDF/Turtle Data Loading Integration', () => {
  let connector: ClaudeFlowConnector;
  let workflows: JTBDWorkflows;
  let memoryInterface: SharedMemoryInterface;
  let orchestrator: TaskOrchestrator;
  let testWorkspace: string;
  let rdfDataDir: string;
  let testCompany: Fortune5CompanyProfile;

  beforeEach(async () => {
    testWorkspace = join(tmpdir(), `rdf-test-${Date.now()}`);
    rdfDataDir = join(testWorkspace, 'rdf-data');
    
    // Create test workspace and RDF data directory
    mkdirSync(testWorkspace, { recursive: true });
    mkdirSync(rdfDataDir, { recursive: true });
    
    // Create test RDF/Turtle files
    writeFileSync(join(rdfDataDir, 'api-standards.ttl'), mockApiStandardsTTL);
    writeFileSync(join(rdfDataDir, 'compliance-requirements.ttl'), mockComplianceRequirementsTTL);
    writeFileSync(join(rdfDataDir, 'schema-metadata.ttl'), mockSchemaMetadataTTL);
    
    testCompany = {
      id: 'rdf-test-company',
      name: 'RDF Integration Corp',
      industry: 'Financial Services',
      revenue: 200000000000,
      employees: 400000,
      regions: ['North America', 'Europe'],
      complianceRequirements: ['SOX', 'GDPR'],
      techStack: {
        languages: ['TypeScript', 'Java'],
        frameworks: ['Spring Boot', 'React'],
        databases: ['PostgreSQL', 'Redis'],
        cloud: ['AWS'],
        cicd: ['Jenkins']
      },
      constraints: {
        security: 'enterprise',
        performance: 'high',
        scalability: 'global',
        availability: '99.99%'
      }
    };

    memoryInterface = new SharedMemoryInterface({ persistToDisk: false });
    orchestrator = new TaskOrchestrator({
      memoryInterface,
      workspace: testWorkspace,
      maxConcurrent: 3
    });
    
    connector = new ClaudeFlowConnector({
      workspace: testWorkspace,
      rdfDataPath: rdfDataDir
    });
    
    workflows = new JTBDWorkflows({
      memoryInterface,
      orchestrator,
      workspace: testWorkspace,
      rdfDataPath: rdfDataDir
    });

    await memoryInterface.initialize();
    await orchestrator.initialize();
    await connector.initialize();
    await workflows.initialize();
  });

  afterEach(async () => {
    if (workflows) await workflows.cleanup();
    if (connector) await connector.cleanup();
    if (orchestrator) await orchestrator.cleanup();
    if (memoryInterface) await memoryInterface.cleanup();
    
    if (existsSync(testWorkspace)) {
      rmSync(testWorkspace, { recursive: true, force: true });
    }
  });

  describe('RDF Data Loading and Parsing', () => {
    it('should load and parse RDF/Turtle files successfully', async () => {
      const rdfLoader = await connector.getRDFLoader();
      
      const apiStandards = await rdfLoader.loadTurtleFile(
        join(rdfDataDir, 'api-standards.ttl')
      );
      
      expect(apiStandards.success).toBe(true);
      expect(apiStandards.data.triples.length).toBeGreaterThan(0);
      expect(apiStandards.data.namespaces).toHaveProperty('api');
      expect(apiStandards.data.namespaces).toHaveProperty('rdf');
      expect(apiStandards.data.namespaces).toHaveProperty('rdfs');
    });

    it('should extract semantic entities from RDF data', async () => {
      const rdfLoader = await connector.getRDFLoader();
      
      const complianceData = await rdfLoader.loadTurtleFile(
        join(rdfDataDir, 'compliance-requirements.ttl')
      );
      
      expect(complianceData.success).toBe(true);
      
      const entities = await rdfLoader.extractEntities(complianceData.data.triples, {
        entityType: 'http://enterprise.com/compliance#ComplianceRequirement'
      });
      
      expect(entities.length).toBeGreaterThan(0);
      
      const financialReporting = entities.find(
        e => e.label === 'Financial Reporting Compliance'
      );
      expect(financialReporting).toBeDefined();
      expect(financialReporting?.properties).toHaveProperty('framework', 'SOX');
      expect(financialReporting?.properties).toHaveProperty('section', '404');
    });

    it('should handle RDF query operations using SPARQL-like syntax', async () => {
      const rdfLoader = await connector.getRDFLoader();
      
      await rdfLoader.loadTurtleFile(join(rdfDataDir, 'api-standards.ttl'));
      
      const queryResult = await rdfLoader.query({
        select: ['?api', '?endpoint', '?method'],
        where: [
          '?api rdf:type api:APIStandard',
          '?api api:endpoint ?endpoint',
          '?api api:methods ?method'
        ]
      });
      
      expect(queryResult.success).toBe(true);
      expect(queryResult.data.bindings.length).toBeGreaterThan(0);
      
      const userApi = queryResult.data.bindings.find(
        b => b.endpoint?.value === '/users'
      );
      expect(userApi).toBeDefined();
      expect(userApi?.method?.value).toContain('GET');
    });

    it('should validate RDF data against expected schemas', async () => {
      const rdfLoader = await connector.getRDFLoader();
      
      const validationResult = await rdfLoader.validateTurtleFile(
        join(rdfDataDir, 'schema-metadata.ttl'),
        {
          requiredClasses: [
            'http://enterprise.com/schema#DatabaseSchema',
            'http://enterprise.com/schema#Table',
            'http://enterprise.com/schema#Column'
          ],
          requiredProperties: [
            'http://enterprise.com/schema#tableName',
            'http://enterprise.com/schema#dataType'
          ]
        }
      );
      
      expect(validationResult.isValid).toBe(true);
      expect(validationResult.errors.length).toBe(0);
      expect(validationResult.warnings.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle malformed RDF data gracefully', async () => {
      const malformedTTL = `
        @prefix invalid: <http://invalid> .
        # Missing closing bracket
        invalid:BadTriple rdf:type rdfs:Class
        invalid:MissingProperty .
      `;
      
      const malformedFile = join(rdfDataDir, 'malformed.ttl');
      writeFileSync(malformedFile, malformedTTL);
      
      const rdfLoader = await connector.getRDFLoader();
      const result = await rdfLoader.loadTurtleFile(malformedFile);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toMatch(/parse|syntax|malformed/i);
    });
  });

  describe('Template Generation with RDF Integration', () => {
    it('should generate API templates using RDF metadata', async () => {
      const result = await workflows.executeAPIStandardization(
        testCompany,
        {
          useRDFMetadata: true,
          rdfSources: ['api-standards.ttl'],
          microserviceCount: 5
        }
      );
      
      expect(result.success).toBe(true);
      expect(result.deliverables.length).toBeGreaterThan(0);
      
      // Check that RDF data influenced template generation
      const apiTemplates = result.deliverables.filter(d => d.type === 'api-template');
      expect(apiTemplates.length).toBeGreaterThan(0);
      
      const userApiTemplate = apiTemplates.find(
        t => t.content.includes('/users') || t.name.includes('user')
      );
      expect(userApiTemplate).toBeDefined();
      expect(userApiTemplate?.content).toMatch(/OAuth2|authentication/i);
      expect(userApiTemplate?.metadata?.rdfSource).toBe('api-standards.ttl');
    });

    it('should generate compliance scaffolding using RDF requirements', async () => {
      const result = await workflows.executeComplianceScaffolding(
        testCompany,
        {
          useRDFMetadata: true,
          rdfSources: ['compliance-requirements.ttl'],
          complianceLevel: 'MULTI'
        }
      );
      
      expect(result.success).toBe(true);
      
      // Verify RDF-driven compliance features
      const complianceTemplates = result.deliverables.filter(d => 
        d.type === 'compliance-template' || d.type === 'audit-logger'
      );
      expect(complianceTemplates.length).toBeGreaterThan(0);
      
      const soxCompliance = complianceTemplates.find(
        t => t.content.includes('SOX') || t.content.includes('financial')
      );
      expect(soxCompliance).toBeDefined();
      expect(soxCompliance?.content).toMatch(/audit|immutable|retention/i);
      
      const gdprCompliance = complianceTemplates.find(
        t => t.content.includes('GDPR') || t.content.includes('consent')
      );
      expect(gdprCompliance).toBeDefined();
      expect(gdprCompliance?.content).toMatch(/erasure|portability|consent/i);
    });

    it('should generate database schemas using RDF metadata', async () => {
      const result = await workflows.executeDatabaseMigrations(
        testCompany,
        {
          useRDFMetadata: true,
          rdfSources: ['schema-metadata.ttl'],
          databaseMigrations: {
            sourceSystem: 'Oracle',
            targetSystem: 'PostgreSQL',
            migrationStrategy: 'schema-first'
          }
        }
      );
      
      expect(result.success).toBe(true);
      
      const schemaTemplates = result.deliverables.filter(d => 
        d.type === 'schema-migration' || d.type === 'table-definition'
      );
      expect(schemaTemplates.length).toBeGreaterThan(0);
      
      const userTable = schemaTemplates.find(
        t => t.content.includes('users') || t.name.includes('user')
      );
      expect(userTable).toBeDefined();
      expect(userTable?.content).toMatch(/user_id|email|created_at/i);
      expect(userTable?.content).toMatch(/PRIMARY KEY|INDEX/i);
      
      const paymentTable = schemaTemplates.find(
        t => t.content.includes('payments') || t.name.includes('payment')
      );
      expect(paymentTable).toBeDefined();
      expect(paymentTable?.content).toMatch(/encryption|payment_amount/i);
    });

    it('should support cross-referencing between multiple RDF sources', async () => {
      const result = await workflows.executeAPIStandardization(
        testCompany,
        {
          useRDFMetadata: true,
          rdfSources: ['api-standards.ttl', 'compliance-requirements.ttl', 'schema-metadata.ttl'],
          enableCrossReferencing: true
        }
      );
      
      expect(result.success).toBe(true);
      
      // Check for cross-referenced templates
      const crossReferencedTemplates = result.deliverables.filter(d => 
        d.metadata?.crossReferences && d.metadata.crossReferences.length > 0
      );
      expect(crossReferencedTemplates.length).toBeGreaterThan(0);
      
      const paymentApiTemplate = crossReferencedTemplates.find(
        t => t.content.includes('payment') || t.name.includes('payment')
      );
      expect(paymentApiTemplate).toBeDefined();
      
      // Should reference both API standards and compliance requirements
      expect(paymentApiTemplate?.metadata?.crossReferences).toContain('compliance-requirements.ttl');
      expect(paymentApiTemplate?.content).toMatch(/PCI-DSS|encryption/i);
    });
  });

  describe('Dynamic RDF Filtering and Processing', () => {
    it('should filter RDF data based on company profile', async () => {
      const rdfLoader = await connector.getRDFLoader();
      
      await rdfLoader.loadTurtleFile(join(rdfDataDir, 'compliance-requirements.ttl'));
      
      const filteredData = await rdfLoader.filterByCompanyProfile(testCompany, {
        includeFrameworks: testCompany.complianceRequirements,
        includeIndustry: testCompany.industry,
        excludeRegions: ['Asia Pacific'] // Company not in APAC
      });
      
      expect(filteredData.success).toBe(true);
      expect(filteredData.data.entities.length).toBeGreaterThan(0);
      
      // Should include SOX and GDPR requirements
      const frameworks = filteredData.data.entities.map(e => e.properties?.framework).filter(Boolean);
      expect(frameworks).toContain('SOX');
      expect(frameworks).toContain('GDPR');
      
      // Should not include APAC-specific requirements (if any)
      const regions = filteredData.data.entities.map(e => e.properties?.region).filter(Boolean);
      expect(regions).not.toContain('Asia Pacific');
    });

    it('should apply tech stack filters to RDF API standards', async () => {
      const rdfLoader = await connector.getRDFLoader();
      
      await rdfLoader.loadTurtleFile(join(rdfDataDir, 'api-standards.ttl'));
      
      const filteredApis = await rdfLoader.filterByTechStack(testCompany.techStack, {
        includeLanguages: ['TypeScript', 'Java'],
        includeFrameworks: ['React', 'Spring Boot'],
        excludeDeprecated: true
      });
      
      expect(filteredApis.success).toBe(true);
      expect(filteredApis.data.entities.length).toBeGreaterThan(0);
      
      // Check that APIs are relevant to tech stack
      const apiEntities = filteredApis.data.entities;
      const hasRelevantApis = apiEntities.some(api => 
        api.properties?.framework === 'Spring Boot' || 
        api.properties?.clientFramework === 'React'
      );
      expect(hasRelevantApis).toBe(true);
    });

    it('should support runtime RDF query execution', async () => {
      const rdfLoader = await connector.getRDFLoader();
      
      // Load multiple RDF sources
      await rdfLoader.loadTurtleFile(join(rdfDataDir, 'api-standards.ttl'));
      await rdfLoader.loadTurtleFile(join(rdfDataDir, 'compliance-requirements.ttl'));
      
      // Execute complex query across multiple sources
      const queryResult = await rdfLoader.query({
        select: ['?api', '?compliance', '?requirement'],
        where: [
          '?api rdf:type api:APIStandard',
          '?api api:compliance ?complianceType',
          '?compliance compliance:framework ?complianceType',
          '?compliance compliance:controls ?requirement'
        ]
      });
      
      expect(queryResult.success).toBe(true);
      expect(queryResult.data.bindings.length).toBeGreaterThan(0);
      
      // Should find APIs with compliance requirements
      const pciCompliantApis = queryResult.data.bindings.filter(
        b => b.complianceType?.value === 'PCI-DSS'
      );
      expect(pciCompliantApis.length).toBeGreaterThan(0);
    });

    it('should cache RDF parsing results for performance', async () => {
      const rdfLoader = await connector.getRDFLoader();
      
      // First load (should parse)
      const startTime1 = Date.now();
      const result1 = await rdfLoader.loadTurtleFile(
        join(rdfDataDir, 'api-standards.ttl')
      );
      const duration1 = Date.now() - startTime1;
      
      expect(result1.success).toBe(true);
      
      // Second load (should use cache)
      const startTime2 = Date.now();
      const result2 = await rdfLoader.loadTurtleFile(
        join(rdfDataDir, 'api-standards.ttl')
      );
      const duration2 = Date.now() - startTime2;
      
      expect(result2.success).toBe(true);
      expect(result2.data.triples.length).toBe(result1.data.triples.length);
      
      // Cached load should be significantly faster
      expect(duration2).toBeLessThan(duration1 * 0.5); // At least 50% faster
      expect(result2.data.fromCache).toBe(true);
    });
  });

  describe('RDF-Driven Template Customization', () => {
    it('should customize templates based on RDF entity properties', async () => {
      const result = await workflows.executeAPIStandardization(
        testCompany,
        {
          useRDFMetadata: true,
          rdfSources: ['api-standards.ttl'],
          customizationRules: {
            'api:authentication': 'OAuth2',
            'api:encryption': 'TLS1.3',
            'api:rateLimit': '1000/hour'
          }
        }
      );
      
      expect(result.success).toBe(true);
      
      const customizedTemplates = result.deliverables.filter(d => 
        d.metadata?.customizedFromRDF === true
      );
      expect(customizedTemplates.length).toBeGreaterThan(0);
      
      const oauthTemplate = customizedTemplates.find(
        t => t.content.includes('OAuth2')
      );
      expect(oauthTemplate).toBeDefined();
      expect(oauthTemplate?.content).toMatch(/authentication.*OAuth2/i);
      expect(oauthTemplate?.content).toMatch(/TLS1\.3|encryption/i);
    });

    it('should generate documentation from RDF annotations', async () => {
      // Add RDF documentation data
      const documentationTTL = `
        @prefix doc: <http://enterprise.com/docs#> .
        @prefix api: <http://enterprise.com/api#> .
        
        api:UserAPI doc:description "Comprehensive user management API" ;
          doc:examples "POST /users, GET /users/{id}" ;
          doc:responseFormats "JSON, XML" ;
          doc:errorCodes "400, 401, 403, 404, 500" .
      `;
      
      writeFileSync(join(rdfDataDir, 'api-documentation.ttl'), documentationTTL);
      
      const result = await workflows.executeDocumentationGeneration(
        testCompany,
        {
          useRDFMetadata: true,
          rdfSources: ['api-standards.ttl', 'api-documentation.ttl'],
          documentationTypes: ['API'],
          includeExamples: true
        }
      );
      
      expect(result.success).toBe(true);
      
      const apiDocs = result.deliverables.filter(d => d.type === 'api-docs');
      expect(apiDocs.length).toBeGreaterThan(0);
      
      const userApiDoc = apiDocs.find(
        d => d.content.includes('user') || d.content.includes('User')
      );
      expect(userApiDoc).toBeDefined();
      expect(userApiDoc?.content).toContain('Comprehensive user management API');
      expect(userApiDoc?.content).toMatch(/POST \/users|GET \/users/i);
      expect(userApiDoc?.content).toMatch(/400|401|403|404|500/);
    });

    it('should support conditional template generation based on RDF rules', async () => {
      // Add conditional rules RDF
      const rulesTTL = `
        @prefix rule: <http://enterprise.com/rules#> .
        @prefix api: <http://enterprise.com/api#> .
        
        rule:PaymentAPIRule rdf:type rule:ConditionalRule ;
          rule:condition "api:compliance = 'PCI-DSS'" ;
          rule:action "include encryption middleware" ;
          rule:priority "high" .
          
        rule:EuropeanDataRule rdf:type rule:ConditionalRule ;
          rule:condition "compliance:framework = 'GDPR'" ;
          rule:action "add consent management" ;
          rule:requiredForRegions "Europe" .
      `;
      
      writeFileSync(join(rdfDataDir, 'conditional-rules.ttl'), rulesTTL);
      
      const result = await workflows.executeAPIStandardization(
        testCompany,
        {
          useRDFMetadata: true,
          rdfSources: ['api-standards.ttl', 'compliance-requirements.ttl', 'conditional-rules.ttl'],
          applyConditionalRules: true
        }
      );
      
      expect(result.success).toBe(true);
      
      // Check for conditionally generated templates
      const ruleBasedTemplates = result.deliverables.filter(d => 
        d.metadata?.generatedByRules && d.metadata.generatedByRules.length > 0
      );
      expect(ruleBasedTemplates.length).toBeGreaterThan(0);
      
      // Should include encryption middleware for payment APIs
      const encryptionMiddleware = ruleBasedTemplates.find(
        t => t.content.includes('encryption') && t.content.includes('middleware')
      );
      expect(encryptionMiddleware).toBeDefined();
      
      // Should include consent management for European operations
      const consentManagement = ruleBasedTemplates.find(
        t => t.content.includes('consent') && t.content.includes('management')
      );
      expect(consentManagement).toBeDefined();
    });
  });

  describe('RDF Integration Performance and Scalability', () => {
    it('should handle large RDF datasets efficiently', async () => {
      // Generate large RDF dataset
      let largeTTL = `@prefix test: <http://test.com#> .\n`;
      for (let i = 0; i < 1000; i++) {
        largeTTL += `test:Entity${i} rdf:type test:TestEntity ;\n`;
        largeTTL += `  test:property1 "value${i}" ;\n`;
        largeTTL += `  test:property2 ${i} .\n\n`;
      }
      
      writeFileSync(join(rdfDataDir, 'large-dataset.ttl'), largeTTL);
      
      const rdfLoader = await connector.getRDFLoader();
      
      const startTime = Date.now();
      const result = await rdfLoader.loadTurtleFile(
        join(rdfDataDir, 'large-dataset.ttl')
      );
      const loadTime = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(result.data.triples.length).toBeGreaterThan(2500); // 3 triples per entity
      expect(loadTime).toBeLessThan(5000); // Should load in under 5 seconds
      
      // Test querying performance
      const queryStart = Date.now();
      const queryResult = await rdfLoader.query({
        select: ['?entity', '?value'],
        where: [
          '?entity rdf:type test:TestEntity',
          '?entity test:property1 ?value'
        ],
        limit: 100
      });
      const queryTime = Date.now() - queryStart;
      
      expect(queryResult.success).toBe(true);
      expect(queryResult.data.bindings.length).toBe(100);
      expect(queryTime).toBeLessThan(1000); // Query should be fast
    });

    it('should support incremental RDF updates', async () => {
      const rdfLoader = await connector.getRDFLoader();
      
      // Load initial data
      await rdfLoader.loadTurtleFile(join(rdfDataDir, 'api-standards.ttl'));
      
      const initialCount = (await rdfLoader.query({
        select: ['?api'],
        where: ['?api rdf:type api:APIStandard']
      })).data.bindings.length;
      
      // Add incremental update
      const updateTTL = `
        @prefix api: <http://enterprise.com/api#> .
        
        api:NotificationAPI rdf:type api:APIStandard ;
          rdfs:label "Notification API" ;
          api:endpoint "/notifications" ;
          api:methods "GET,POST" .
      `;
      
      writeFileSync(join(rdfDataDir, 'api-updates.ttl'), updateTTL);
      
      // Apply incremental update
      const updateResult = await rdfLoader.applyIncrementalUpdate(
        join(rdfDataDir, 'api-updates.ttl')
      );
      
      expect(updateResult.success).toBe(true);
      
      // Verify update was applied
      const updatedCount = (await rdfLoader.query({
        select: ['?api'],
        where: ['?api rdf:type api:APIStandard']
      })).data.bindings.length;
      
      expect(updatedCount).toBe(initialCount + 1);
      
      // Verify new API is queryable
      const notificationApi = await rdfLoader.query({
        select: ['?endpoint'],
        where: [
          'api:NotificationAPI api:endpoint ?endpoint'
        ]
      });
      
      expect(notificationApi.data.bindings[0]?.endpoint?.value).toBe('/notifications');
    });

    it('should optimize memory usage with RDF streaming', async () => {
      const rdfLoader = await connector.getRDFLoader();
      
      const initialMemoryStats = await memoryInterface.getStats();
      
      // Load large dataset with streaming enabled
      const streamResult = await rdfLoader.loadTurtleFileStreaming(
        join(rdfDataDir, 'api-standards.ttl'),
        {
          batchSize: 100,
          enableCompression: true,
          memoryLimit: 5 * 1024 * 1024 // 5MB limit
        }
      );
      
      expect(streamResult.success).toBe(true);
      
      const finalMemoryStats = await memoryInterface.getStats();
      const memoryGrowth = finalMemoryStats.memoryUsage - initialMemoryStats.memoryUsage;
      
      // Memory growth should be minimal due to streaming
      expect(memoryGrowth).toBeLessThan(5 * 1024 * 1024); // Less than 5MB growth
      expect(streamResult.data.processedInBatches).toBe(true);
    });
  });

  describe('RDF Error Handling and Validation', () => {
    it('should validate RDF consistency across multiple files', async () => {
      // Create inconsistent RDF data
      const inconsistentTTL = `
        @prefix api: <http://enterprise.com/api#> .
        
        api:InvalidAPI rdf:type api:APIStandard ;
          api:endpoint "/invalid" ;
          api:invalidProperty "should not exist" ;
          api:authentication "InvalidAuth" .  # References non-existent auth type
      `;
      
      writeFileSync(join(rdfDataDir, 'inconsistent.ttl'), inconsistentTTL);
      
      const rdfLoader = await connector.getRDFLoader();
      
      const validationResult = await rdfLoader.validateConsistency([
        join(rdfDataDir, 'api-standards.ttl'),
        join(rdfDataDir, 'inconsistent.ttl')
      ]);
      
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors.length).toBeGreaterThan(0);
      expect(validationResult.errors.some(e => e.includes('invalidProperty'))).toBe(true);
      expect(validationResult.errors.some(e => e.includes('InvalidAuth'))).toBe(true);
    });

    it('should provide helpful error messages for RDF parsing failures', async () => {
      const invalidTTL = `
        @prefix api: <http://enterprise.com/api#
        # Missing closing > in prefix declaration
        
        api:BrokenAPI rdf:type api:APIStandard
        # Missing semicolon
        api:endpoint "/broken"
      `;
      
      writeFileSync(join(rdfDataDir, 'invalid.ttl'), invalidTTL);
      
      const rdfLoader = await connector.getRDFLoader();
      const result = await rdfLoader.loadTurtleFile(
        join(rdfDataDir, 'invalid.ttl')
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.parseErrors).toBeDefined();
      expect(result.parseErrors?.length).toBeGreaterThan(0);
      
      // Should include line numbers and helpful descriptions
      const firstError = result.parseErrors![0];
      expect(firstError.line).toBeGreaterThan(0);
      expect(firstError.description).toMatch(/prefix|syntax|expected/i);
    });

    it('should handle RDF namespace conflicts gracefully', async () => {
      const conflictingTTL = `
        @prefix api: <http://different.com/api#> .  # Different namespace URI
        
        api:ConflictingAPI rdf:type api:APIStandard ;
          api:endpoint "/conflict" .
      `;
      
      writeFileSync(join(rdfDataDir, 'conflicting.ttl'), conflictingTTL);
      
      const rdfLoader = await connector.getRDFLoader();
      
      // Load original API standards first
      await rdfLoader.loadTurtleFile(join(rdfDataDir, 'api-standards.ttl'));
      
      // Load conflicting namespace
      const conflictResult = await rdfLoader.loadTurtleFile(
        join(rdfDataDir, 'conflicting.ttl')
      );
      
      expect(conflictResult.success).toBe(true); // Should succeed with namespace resolution
      expect(conflictResult.warnings).toBeDefined();
      expect(conflictResult.warnings?.some(w => w.includes('namespace'))).toBe(true);
      
      // Both namespaces should be available with different prefixes
      const namespaces = await rdfLoader.getNamespaces();
      expect(Object.keys(namespaces).filter(k => k.startsWith('api')).length).toBeGreaterThan(1);
    });
  });
});
