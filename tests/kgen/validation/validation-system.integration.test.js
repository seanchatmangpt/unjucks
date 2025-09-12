/**
 * KGEN Validation System Integration Tests
 * 
 * Comprehensive integration tests for the complete validation system including
 * SHACL, policy, SPARQL, gates, drift detection, and CLI integration.
 * 
 * Tests performance targets, exit codes, and end-to-end workflows.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { CLIValidator, CLIValidationCodes } from '../../../src/kgen/validation/cli-validator.js';
import { SHACLValidationEngine } from '../../../src/kgen/validation/shacl-validation-engine.js';
import { PolicyURIResolver, PolicyVerdict } from '../../../src/kgen/validation/policy-resolver.js';
import { SPARQLRuleEngine } from '../../../src/kgen/validation/sparql-rule-engine.js';
import { SemanticDriftAnalyzer, DriftSeverity } from '../../../src/kgen/validation/drift-analyzer.js';
import { SHACLGates } from '../../../src/kgen/validation/shacl-gates.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('KGEN Validation System Integration', () => {
  let testDir;
  let cliValidator;
  let tempFiles;

  beforeAll(async () => {
    // Setup test directory
    testDir = path.join(__dirname, '../../../.test-validation');
    await fs.ensureDir(testDir);
    
    // Setup subdirectories
    await fs.ensureDir(path.join(testDir, 'shapes'));
    await fs.ensureDir(path.join(testDir, 'data'));
    await fs.ensureDir(path.join(testDir, 'rules'));
    await fs.ensureDir(path.join(testDir, 'policies'));
    await fs.ensureDir(path.join(testDir, 'reports'));
    
    tempFiles = [];
  });

  beforeEach(async () => {
    // Initialize CLI validator for each test
    cliValidator = new CLIValidator({
      timeout: 30000,
      maxPerformanceTime: 20,
      enablePerformanceWarnings: true,
      exitOnFailure: false
    });
  });

  afterAll(async () => {
    // Cleanup temp files
    for (const file of tempFiles) {
      await fs.remove(file).catch(() => {});
    }
    
    // Cleanup test directory
    await fs.remove(testDir).catch(() => {});
  });

  describe('SHACL Validation Engine', () => {
    it('should validate simple RDF data against SHACL shapes', async () => {
      // Create test SHACL shapes
      const shapesContent = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        
        ex:PersonShape a sh:NodeShape ;
          sh:targetClass ex:Person ;
          sh:property [
            sh:path ex:name ;
            sh:datatype xsd:string ;
            sh:minCount 1 ;
            sh:maxCount 1 ;
          ] .
      `;
      
      // Create valid test data
      const validDataContent = `
        @prefix ex: <http://example.org/> .
        
        ex:john a ex:Person ;
          ex:name "John Doe" .
      `;
      
      const shapesFile = path.join(testDir, 'shapes', 'person.ttl');
      const dataFile = path.join(testDir, 'data', 'valid-person.ttl');
      
      await fs.writeFile(shapesFile, shapesContent);
      await fs.writeFile(dataFile, validDataContent);
      tempFiles.push(shapesFile, dataFile);
      
      // Initialize CLI validator
      await cliValidator.initialize({
        shapesPath: path.join(testDir, 'shapes'),
        enablePolicies: false,
        enableSPARQL: false
      });
      
      // Run validation
      const result = await cliValidator.validateSHACL(dataFile);
      
      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(CLIValidationCodes.SUCCESS);
      expect(result.summary.totalViolations).toBe(0);
      expect(result.summary.executionTime).toBeLessThan(100); // Should be fast
    });

    it('should detect SHACL violations and return appropriate exit code', async () => {
      // Create test SHACL shapes (same as above)
      const shapesContent = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        
        ex:PersonShape a sh:NodeShape ;
          sh:targetClass ex:Person ;
          sh:property [
            sh:path ex:name ;
            sh:datatype xsd:string ;
            sh:minCount 1 ;
            sh:maxCount 1 ;
          ] .
      `;
      
      // Create invalid test data (missing required property)
      const invalidDataContent = `
        @prefix ex: <http://example.org/> .
        
        ex:john a ex:Person .
      `;
      
      const shapesFile = path.join(testDir, 'shapes', 'person-required.ttl');
      const dataFile = path.join(testDir, 'data', 'invalid-person.ttl');
      
      await fs.writeFile(shapesFile, shapesContent);
      await fs.writeFile(dataFile, invalidDataContent);
      tempFiles.push(shapesFile, dataFile);
      
      // Initialize CLI validator
      await cliValidator.initialize({
        shapesPath: shapesFile,
        enablePolicies: false,
        enableSPARQL: false
      });
      
      // Run validation
      const result = await cliValidator.validateSHACL(dataFile);
      
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(CLIValidationCodes.VIOLATIONS);
      expect(result.summary.totalViolations).toBeGreaterThan(0);
      expect(result.results.shacl.violations).toBeDefined();
    });

    it('should meet performance target of ≤20ms for small graphs', async () => {
      // Create simple test data
      const shapesContent = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        
        ex:SimpleShape a sh:NodeShape ;
          sh:targetClass ex:Thing ;
          sh:property [
            sh:path ex:label ;
            sh:datatype xsd:string ;
          ] .
      `;
      
      const dataContent = `
        @prefix ex: <http://example.org/> .
        
        ex:item1 a ex:Thing ; ex:label "Item 1" .
        ex:item2 a ex:Thing ; ex:label "Item 2" .
      `;
      
      const shapesFile = path.join(testDir, 'shapes', 'simple.ttl');
      const dataFile = path.join(testDir, 'data', 'simple.ttl');
      
      await fs.writeFile(shapesFile, shapesContent);
      await fs.writeFile(dataFile, dataContent);
      tempFiles.push(shapesFile, dataFile);
      
      const engine = new SHACLValidationEngine();
      await engine.initialize(shapesContent);
      
      // Run validation and measure time
      const startTime = performance.now();
      const result = await engine.validate(dataContent);
      const executionTime = performance.now() - startTime;
      
      expect(executionTime).toBeLessThan(20); // ≤20ms target
      expect(result.conforms).toBe(true);
    });
  });

  describe('Policy URI Resolution', () => {
    it('should resolve policy URIs and return machine verdicts', async () => {
      const policyResolver = new PolicyURIResolver({
        shapesPath: path.join(testDir, 'shapes'),
        auditPath: path.join(testDir, 'audit')
      });
      
      await policyResolver.initialize();
      
      // Test template security policy
      const context = {
        templateContent: 'Hello {{ name }}!',
        templateName: 'greeting'
      };
      
      const result = await policyResolver.resolvePolicyURI(
        'policy://template-security/pass',
        context
      );
      
      expect(result.policyURI).toBe('policy://template-security/pass');
      expect(result.actualVerdict).toBe(PolicyVerdict.PASS);
      expect(result.passed).toBe(true);
      expect(result.metadata.resolver).toBe('KGenPolicyResolver');
    });

    it('should detect policy violations with proper verdict matching', async () => {
      const policyResolver = new PolicyURIResolver({
        auditPath: path.join(testDir, 'audit')
      });
      
      await policyResolver.initialize();
      
      // Test with dangerous template content
      const context = {
        templateContent: 'Hello {{ name }}! <script>eval("dangerous code")</script>',
        templateName: 'dangerous-template'
      };
      
      const result = await policyResolver.resolvePolicyURI(
        'policy://template-security/pass', // Expecting pass but should fail
        context
      );
      
      expect(result.actualVerdict).toBe(PolicyVerdict.FAIL);
      expect(result.expectedVerdict).toBe('pass');
      expect(result.verdictMatches).toBe(false);
      expect(result.passed).toBe(false);
    });

    it('should handle drift detection policy', async () => {
      const testFile = path.join(testDir, 'data', 'test-artifact.txt');
      const originalContent = 'Original content';
      const modifiedContent = 'Modified content';
      
      await fs.writeFile(testFile, modifiedContent);
      tempFiles.push(testFile);
      
      const policyResolver = new PolicyURIResolver({
        auditPath: path.join(testDir, 'audit')
      });
      
      await policyResolver.initialize();
      
      const context = {
        artifactPath: testFile,
        expectedContent: originalContent
      };
      
      const result = await policyResolver.resolvePolicyURI(
        'policy://artifact-drift/fail',
        context
      );
      
      expect(result.actualVerdict).toBe(PolicyVerdict.FAIL);
      expect(result.verdictMatches).toBe(true); // Expecting fail and got fail
      expect(result.passed).toBe(true);
      expect(result.ruleResult.summary.driftDetected).toBe(true);
    });
  });

  describe('SPARQL Rule Engine', () => {
    it('should execute SPARQL rules and return deterministic results', async () => {
      // Create a simple SPARQL rule
      const ruleContent = `
        # @title: Person Validation Rule
        # @description: Check that all persons have names
        # @priority: high
        # @expectation: no-results
        
        SELECT ?person WHERE {
          ?person a <http://example.org/Person> .
          FILTER NOT EXISTS { ?person <http://example.org/name> ?name }
        }
      `;
      
      const ruleFile = path.join(testDir, 'rules', 'person-name-required.sparql');
      await fs.writeFile(ruleFile, ruleContent);
      tempFiles.push(ruleFile);
      
      const sparqlEngine = new SPARQLRuleEngine({
        rulesPath: path.join(testDir, 'rules')
      });
      
      await sparqlEngine.initialize();
      
      // Test with valid data (person has name)
      const validData = `
        @prefix ex: <http://example.org/> .
        ex:john a ex:Person ; ex:name "John" .
      `;
      
      const result = await sparqlEngine.executeRule(
        'person-name-required',
        validData
      );
      
      expect(result.passed).toBe(true);
      expect(result.outcome).toBe('pass');
      expect(result.bindingsCount).toBe(0);
    });

    it('should execute batch rules with concurrency control', async () => {
      // Create multiple test rules
      const rule1 = `
        # @title: Class Check
        # @expectation: has-results
        SELECT ?thing WHERE { ?thing a ?class }
      `;
      
      const rule2 = `
        # @title: Property Check  
        # @expectation: no-results
        SELECT ?thing WHERE { ?thing <http://invalid.example/prop> ?value }
      `;
      
      const rule1File = path.join(testDir, 'rules', 'class-check.sparql');
      const rule2File = path.join(testDir, 'rules', 'property-check.sparql');
      
      await fs.writeFile(rule1File, rule1);
      await fs.writeFile(rule2File, rule2);
      tempFiles.push(rule1File, rule2File);
      
      const sparqlEngine = new SPARQLRuleEngine({
        rulesPath: path.join(testDir, 'rules'),
        maxConcurrentRules: 2
      });
      
      await sparqlEngine.initialize();
      
      const testData = `
        @prefix ex: <http://example.org/> .
        ex:item a ex:Thing .
      `;
      
      const result = await sparqlEngine.executeBatch(
        ['class-check', 'property-check'],
        testData
      );
      
      expect(result.totalRules).toBe(2);
      expect(result.passed + result.failed + result.errors).toBe(2);
      expect(result.executionTime).toBeLessThan(1000);
    });
  });

  describe('Validation Gates', () => {
    it('should run validation gates with proper blocking behavior', async () => {
      // Create test shapes for gates
      const shapesContent = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        
        ex:GateShape a sh:NodeShape ;
          sh:targetClass ex:Artifact ;
          sh:property [
            sh:path ex:valid ;
            sh:hasValue true ;
          ] .
      `;
      
      const shapesFile = path.join(testDir, 'shapes', 'gate-shapes.ttl');
      await fs.writeFile(shapesFile, shapesContent);
      tempFiles.push(shapesFile);
      
      const gates = new SHACLGates({
        shapesPath: shapesFile,
        reportPath: path.join(testDir, 'reports'),
        exitOnFailure: false
      });
      
      await gates.initialize();
      
      // Test with failing data
      const failingData = `
        @prefix ex: <http://example.org/> .
        ex:artifact1 a ex:Artifact ; ex:valid false .
      `;
      
      const gateResult = await gates.runGate('pre-build', failingData);
      
      expect(gateResult.blocked).toBe(true);
      expect(gateResult.passed).toBe(false);
      expect(gateResult.violations).toBeGreaterThan(0);
    });

    it('should run all gates in sequence with proper exit codes', async () => {
      await cliValidator.initialize({
        shapesPath: path.join(testDir, 'shapes'),
        enablePolicies: false,
        enableSPARQL: false
      });
      
      // Create test data for gates
      const validData = `
        @prefix ex: <http://example.org/> .
        ex:artifact1 a ex:Thing ; ex:label "Valid" .
      `;
      
      const gateData = {
        'pre-build': validData,
        'artifact-generation': validData,
        'post-build': validData
      };
      
      const result = await cliValidator.validateGates(gateData);
      
      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(CLIValidationCodes.SUCCESS);
      expect(result.results.gates).toBeDefined();
    });
  });

  describe('Semantic Drift Analysis', () => {
    it('should detect content drift with proper severity levels', async () => {
      const driftAnalyzer = new SemanticDriftAnalyzer({
        baselinePath: path.join(testDir, 'baselines')
      });
      
      await driftAnalyzer.initialize();
      
      const testFile = path.join(testDir, 'data', 'drift-test.txt');
      const originalContent = 'Original content line 1\nOriginal content line 2';
      const modifiedContent = 'Modified content line 1\nModified content line 2\nNew line 3';
      
      await fs.writeFile(testFile, modifiedContent);
      tempFiles.push(testFile);
      
      // Update baseline first
      await driftAnalyzer.updateBaseline(testFile, originalContent);
      
      // Analyze drift
      const analysis = await driftAnalyzer.analyzeDrift(testFile);
      
      expect(analysis.driftDetected).toBe(true);
      expect(analysis.severity).toBe(DriftSeverity.MODERATE);
      expect(analysis.analyses['content-hash']).toBeDefined();
      expect(analysis.analyses['structural']).toBeDefined();
      expect(analysis.recommendations).toBeDefined();
      expect(analysis.recommendations.length).toBeGreaterThan(0);
    });

    it('should detect security-related drift as critical', async () => {
      const driftAnalyzer = new SemanticDriftAnalyzer({
        baselinePath: path.join(testDir, 'baselines')
      });
      
      await driftAnalyzer.initialize();
      
      const testFile = path.join(testDir, 'data', 'security-drift.js');
      const safeContent = 'const greeting = "Hello World";';
      const unsafeContent = 'const greeting = "Hello World"; eval("dangerous code");';
      
      await fs.writeFile(testFile, unsafeContent);
      tempFiles.push(testFile);
      
      const analysis = await driftAnalyzer.analyzeDrift(testFile, safeContent);
      
      expect(analysis.driftDetected).toBe(true);
      expect(analysis.severity).toBe(DriftSeverity.CRITICAL);
      expect(analysis.analyses['security']).toBeDefined();
      expect(analysis.analyses['security'].changes).toBeDefined();
      
      const securityChanges = analysis.analyses['security'].changes;
      expect(securityChanges.some(c => c.type === 'security-risk-added')).toBe(true);
    });
  });

  describe('CLI Integration', () => {
    it('should provide comprehensive validation with proper JSON output', async () => {
      await cliValidator.initialize({
        enableSHACL: false, // Disable to focus on CLI structure
        enablePolicies: false,
        enableSPARQL: false,
        enableGates: false
      });
      
      const result = await cliValidator.validate({
        validationType: 'comprehensive'
      });
      
      // Check JSON Schema compliance
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('validationType');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('exitCode');
      
      expect(result.summary).toHaveProperty('totalViolations');
      expect(result.summary).toHaveProperty('executionTime');
      expect(result.summary).toHaveProperty('passed');
      
      expect(typeof result.exitCode).toBe('number');
      expect(result.exitCode).toBeGreaterThanOrEqual(0);
      expect(result.exitCode).toBeLessThanOrEqual(10);
    });

    it('should handle validation statistics correctly', async () => {
      await cliValidator.initialize({
        enableSHACL: false,
        enablePolicies: false,
        enableSPARQL: false
      });
      
      // Run multiple validations
      await cliValidator.validate({ validationType: 'test1' });
      await cliValidator.validate({ validationType: 'test2' });
      
      const stats = cliValidator.getStatistics();
      
      expect(stats.totalValidations).toBe(2);
      expect(stats.successfulValidations).toBe(2);
      expect(stats.failedValidations).toBe(0);
      expect(stats.successRate).toBe(100);
      expect(stats.averageExecutionTime).toBeGreaterThan(0);
    });

    it('should validate CLI output against JSON Schema', async () => {
      const cliValidatorWithSchema = new CLIValidator({
        enableJSONValidation: true,
        exitOnFailure: false
      });
      
      await cliValidatorWithSchema.initialize({
        enableSHACL: false,
        enablePolicies: false,
        enableSPARQL: false
      });
      
      const result = await cliValidatorWithSchema.validate({
        validationType: 'schema-test'
      });
      
      expect(result.outputValidation).toBeDefined();
      expect(result.outputValidation.valid).toBe(true);
    });
  });

  describe('Performance Requirements', () => {
    it('should complete standard validation within performance targets', async () => {
      // Create minimal test setup
      const shapesContent = `
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        @prefix ex: <http://example.org/> .
        
        ex:FastShape a sh:NodeShape ;
          sh:targetClass ex:FastThing .
      `;
      
      const dataContent = `
        @prefix ex: <http://example.org/> .
        ex:item1 a ex:FastThing .
      `;
      
      const shapesFile = path.join(testDir, 'shapes', 'fast-shapes.ttl');
      const dataFile = path.join(testDir, 'data', 'fast-data.ttl');
      
      await fs.writeFile(shapesFile, shapesContent);
      await fs.writeFile(dataFile, dataContent);
      tempFiles.push(shapesFile, dataFile);
      
      await cliValidator.initialize({
        shapesPath: shapesFile,
        enablePolicies: false,
        enableSPARQL: false,
        enableGates: false,
        maxPerformanceTime: 20
      });
      
      const startTime = performance.now();
      const result = await cliValidator.validateSHACL(dataFile);
      const executionTime = performance.now() - startTime;
      
      expect(executionTime).toBeLessThan(50); // Allow some overhead for full CLI
      expect(result.summary.executionTime).toBeLessThan(30);
      
      // Should not have performance warnings for simple validation
      expect(result.results.performanceWarnings?.length || 0).toBe(0);
    });

    it('should warn about performance issues when exceeding targets', async () => {
      const cliValidatorSlow = new CLIValidator({
        maxPerformanceTime: 1, // Very strict limit to trigger warnings
        enablePerformanceWarnings: true,
        exitOnFailure: false
      });
      
      await cliValidatorSlow.initialize({
        enableSHACL: false,
        enablePolicies: false,
        enableSPARQL: false
      });
      
      // Simulate slow validation by adding artificial delay
      const originalValidate = cliValidatorSlow.validate;
      cliValidatorSlow.validate = async function(options) {
        const result = await originalValidate.call(this, options);
        // Artificially increase reported execution time
        result.summary.executionTime = 50;
        return result;
      };
      
      const result = await cliValidatorSlow.validate({ validationType: 'slow-test' });
      
      expect(result.exitCode).toBe(CLIValidationCodes.PERFORMANCE_ISSUES);
    });
  });

  describe('Exit Code Behavior', () => {
    it('should return correct exit codes for different validation states', async () => {
      await cliValidator.initialize({
        enableSHACL: false,
        enablePolicies: false,
        enableSPARQL: false
      });
      
      // Test success case
      const successResult = await cliValidator.validate({});
      expect(successResult.exitCode).toBe(CLIValidationCodes.SUCCESS);
      
      // Test violations case (simulate)
      const violationResult = {
        success: false,
        summary: { totalViolations: 5, totalWarnings: 0 },
        results: {}
      };
      const violationExitCode = cliValidator.determineExitCode(violationResult);
      expect(violationExitCode).toBe(CLIValidationCodes.VIOLATIONS);
      
      // Test system error case
      const errorResult = {
        error: 'System error',
        summary: { totalViolations: 0, totalWarnings: 0 },
        results: {}
      };
      const errorExitCode = cliValidator.determineExitCode(errorResult);
      expect(errorExitCode).toBe(CLIValidationCodes.SYSTEM_ERRORS);
    });
  });
});