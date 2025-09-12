/**
 * KGEN Policy Gates Test Suite
 * 
 * Tests policy:// URI resolution, machine verdicts, and automated governance.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { PolicyURIResolver, PolicyURISchemes, PolicyVerdict } from '../src/kgen/validation/policy-resolver.js';
import { PolicyGates, PolicyGateConfig } from '../src/kgen/validation/policy-gates.js';
import { SHACLValidationEngine } from '../src/kgen/validation/shacl-validation-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Policy Gates System', () => {
  let tempDir;
  let resolver;
  let gates;
  
  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = path.join(__dirname, 'temp', `test-${this.getDeterministicTimestamp()}`);
    await fs.ensureDir(tempDir);
    await fs.ensureDir(path.join(tempDir, 'shapes'));
    await fs.ensureDir(path.join(tempDir, 'rules'));
    await fs.ensureDir(path.join(tempDir, 'audit'));
    
    // Copy test SHACL shapes
    await fs.copy(
      path.join(__dirname, '../src/kgen/validation/shapes'),
      path.join(tempDir, 'shapes')
    );
  });
  
  afterEach(async () => {
    // Cleanup
    if (tempDir && await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  describe('PolicyURIResolver', () => {
    beforeEach(async () => {
      resolver = new PolicyURIResolver({
        shapesPath: path.join(tempDir, 'shapes'),
        rulesPath: path.join(tempDir, 'rules'),
        auditPath: path.join(tempDir, 'audit')
      });
      
      await resolver.initialize();
    });
    
    describe('URI Parsing', () => {
      it('should parse valid policy URIs', () => {
        const testCases = [
          'policy://template-security/pass',
          'policy://attestation-integrity/fail',
          'policy://shacl-validation/pending'
        ];
        
        for (const uri of testCases) {
          const result = resolver.parsePolicyURI(uri);
          expect(result.isValid).toBe(true);
          expect(result.scheme).toBe('policy');
          expect(result.ruleId).toBeDefined();
          expect(result.expectedVerdict).toBeDefined();
        }
      });
      
      it('should reject invalid policy URIs', () => {
        const testCases = [
          'invalid://template-security/pass',
          'policy://invalid-rule/invalid-verdict',
          'policy://template-security',
          'not-a-uri'
        ];
        
        for (const uri of testCases) {
          const result = resolver.parsePolicyURI(uri);
          expect(result.isValid).toBe(false);
          expect(result.error).toBeDefined();
        }
      });
    });
    
    describe('Template Security Policy', () => {
      it('should pass for secure templates', async () => {
        const context = {
          templateContent: `
            <h1>{{ title }}</h1>
            <p>{{ description }}</p>
          `,
          templateName: 'safe-template'
        };
        
        const result = await resolver.resolvePolicyURI('policy://template-security/pass', context);
        
        expect(result.passed).toBe(true);
        expect(result.actualVerdict).toBe(PolicyVerdict.PASS);
        expect(result.verdictMatches).toBe(true);
      });
      
      it('should fail for insecure templates', async () => {
        const context = {
          templateContent: `
            <script>eval({{ userInput }})</script>
            {{ dangerousFunction() }}
          `,
          templateName: 'unsafe-template'
        };
        
        const result = await resolver.resolvePolicyURI('policy://template-security/fail', context);
        
        expect(result.actualVerdict).toBe(PolicyVerdict.FAIL);
        expect(result.verdictMatches).toBe(true);
      });
    });
    
    describe('SHACL Validation Policy', () => {
      it('should validate RDF data against SHACL shapes', async () => {
        const validRDF = `
          @prefix kgen: <https://kgen.io/ontology#> .
          @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
          
          <#artifact> a kgen:Artifact ;
            kgen:hasIdentifier "test-artifact" ;
            kgen:hasChecksum "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890" .
        `;
        
        const context = { dataGraph: validRDF };
        
        const result = await resolver.resolvePolicyURI('policy://shacl-validation/pass', context);
        
        expect(result.actualVerdict).toBe(PolicyVerdict.PASS);
        expect(result.verdictMatches).toBe(true);
      });
      
      it('should detect SHACL violations', async () => {
        const invalidRDF = `
          @prefix kgen: <https://kgen.io/ontology#> .
          
          <#artifact> a kgen:Artifact ;
            kgen:hasIdentifier "" ;
            kgen:hasChecksum "invalid-checksum" .
        `;
        
        const context = { dataGraph: invalidRDF };
        
        const result = await resolver.resolvePolicyURI('policy://shacl-validation/fail', context);
        
        expect(result.actualVerdict).toBe(PolicyVerdict.FAIL);
        expect(result.verdictMatches).toBe(true);
        expect(result.ruleResult.violations).toHaveLength.greaterThan(0);
      });
    });
    
    describe('Attestation Integrity Policy', () => {
      it('should pass for artifacts with valid attestations', async () => {
        const artifactPath = path.join(tempDir, 'test-artifact.txt');
        const attestationPath = `${artifactPath}.attest.json`;
        
        await fs.writeFile(artifactPath, 'test content');
        await fs.writeJson(attestationPath, {
          signature: 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890',
          generatedAt: this.getDeterministicDate().toISOString(),
          contentHash: 'test-hash'
        });
        
        const context = { artifactPath };
        
        const result = await resolver.resolvePolicyURI('policy://attestation-integrity/pass', context);
        
        expect(result.actualVerdict).toBe(PolicyVerdict.PASS);
        expect(result.verdictMatches).toBe(true);
      });
      
      it('should fail for artifacts without attestations', async () => {
        const artifactPath = path.join(tempDir, 'no-attest-artifact.txt');
        await fs.writeFile(artifactPath, 'test content');
        
        const context = { artifactPath };
        
        const result = await resolver.resolvePolicyURI('policy://attestation-integrity/fail', context);
        
        expect(result.actualVerdict).toBe(PolicyVerdict.FAIL);
        expect(result.verdictMatches).toBe(true);
      });
    });
    
    describe('Custom Rules', () => {
      it('should execute custom SHACL rules', async () => {
        const customRule = `
          @prefix sh: <http://www.w3.org/ns/shacl#> .
          @prefix kgen: <https://kgen.io/ontology#> .
          
          [] a sh:NodeShape ;
            sh:targetClass kgen:CustomClass ;
            sh:property [
              sh:path kgen:customProperty ;
              sh:minCount 1 ;
              sh:message "Custom property is required" ;
            ] .
        `;
        
        const customRulePath = path.join(tempDir, 'rules', 'custom-test-rule.ttl');
        await fs.writeFile(customRulePath, customRule);
        
        const testData = `
          @prefix kgen: <https://kgen.io/ontology#> .
          
          <#test> a kgen:CustomClass .
        `;
        
        const context = { dataGraph: testData };
        
        const result = await resolver.resolvePolicyURI('policy://custom-test-rule/fail', context);
        
        expect(result.actualVerdict).toBe(PolicyVerdict.FAIL);
        expect(result.verdictMatches).toBe(true);
        expect(result.ruleResult.customRule).toBe(true);
      });
    });
    
    describe('Verdict Tracking', () => {
      it('should track policy verdicts for audit', async () => {
        const context = { templateContent: '<p>Safe template</p>', templateName: 'test' };
        
        await resolver.resolvePolicyURI('policy://template-security/pass', context);
        
        const stats = resolver.getVerdictStatistics();
        expect(stats.totalResolutions).toBe(1);
        expect(stats.passRate).toBe('100.00');
        expect(stats.byRule['template-security']).toBeDefined();
      });
      
      it('should export audit trail', async () => {
        const context = { templateContent: '<p>Test</p>', templateName: 'test' };
        
        await resolver.resolvePolicyURI('policy://template-security/pass', context);
        
        const exportPath = await resolver.exportAuditTrail('json');
        expect(await fs.pathExists(exportPath)).toBe(true);
        
        const auditData = await fs.readJson(exportPath);
        expect(auditData.trail).toHaveLength(1);
        expect(auditData.statistics).toBeDefined();
      });
    });
  });

  describe('PolicyGates', () => {
    beforeEach(async () => {
      gates = new PolicyGates({
        environment: 'development',
        auditPath: path.join(tempDir, 'audit'),
        reportsPath: path.join(tempDir, 'reports'),
        exitOnFailure: false
      });
      
      await gates.initialize();
    });
    
    describe('Gate Configuration', () => {
      it('should load correct configuration for development environment', () => {
        const config = gates.getGateConfiguration();
        expect(config.name).toBe('development');
        expect(config.strictMode).toBe(false);
        expect(config.blockOnPolicyFailure).toBe(false);
      });
      
      it('should load correct configuration for production environment', () => {
        const prodGates = new PolicyGates({ environment: 'production' });
        const config = prodGates.getGateConfiguration();
        expect(config.name).toBe('production');
        expect(config.strictMode).toBe(true);
        expect(config.blockOnPolicyFailure).toBe(true);
      });
    });
    
    describe('Gate Execution', () => {
      it('should execute gate with passing policies', async () => {
        const context = {
          templateContent: '<p>{{ message }}</p>',
          templateName: 'safe-template',
          dataGraph: `
            @prefix kgen: <https://kgen.io/ontology#> .
            <#test> a kgen:Artifact ;
              kgen:hasIdentifier "test" ;
              kgen:hasChecksum "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890" .
          `
        };
        
        const result = await gates.executeGate('test-gate', context);
        
        expect(result.passed).toBe(true);
        expect(result.blocked).toBe(false);
        expect(result.policyVerdicts).toHaveLength.greaterThan(0);
        expect(result.auditEntry).toBeDefined();
      });
      
      it('should block gate on policy failures in strict mode', async () => {
        const strictGates = new PolicyGates({
          environment: 'production',
          auditPath: path.join(tempDir, 'audit'),
          exitOnFailure: false
        });
        await strictGates.initialize();
        
        const context = {
          templateContent: '<script>eval(userInput)</script>',
          templateName: 'unsafe-template'
        };
        
        const result = await strictGates.executeGate('security-gate', context);
        
        expect(result.passed).toBe(false);
        expect(result.blocked).toBe(true);
        expect(result.decision.policyFailures).toHaveLength.greaterThan(0);
      });
    });
    
    describe('Audit Trail', () => {
      it('should create audit entries for gate executions', async () => {
        const context = { templateContent: '<p>Test</p>', templateName: 'test' };
        
        const result = await gates.executeGate('audit-test', context);
        
        expect(result.auditEntry).toBeDefined();
        expect(result.auditEntry.id).toBeDefined();
        expect(result.auditEntry.gateName).toBe('audit-test');
        expect(result.auditEntry.machineReadable).toBeDefined();
      });
      
      it('should save gate reports', async () => {
        const context = { templateContent: '<p>Test</p>', templateName: 'test' };
        
        const result = await gates.executeGate('report-test', context);
        
        const reportFiles = await fs.readdir(path.join(tempDir, 'reports'));
        const gateReports = reportFiles.filter(f => f.startsWith('gate-report-test'));
        expect(gateReports).toHaveLength.greaterThan(0);
      });
      
      it('should export comprehensive audit reports', async () => {
        const context = { templateContent: '<p>Test</p>', templateName: 'test' };
        
        await gates.executeGate('export-test', context);
        
        const exportPath = await gates.exportAuditReport('json');
        expect(await fs.pathExists(exportPath)).toBe(true);
        
        const reportData = await fs.readJson(exportPath);
        expect(reportData.system).toBe('KGEN Policy Gates');
        expect(reportData.auditTrail).toBeDefined();
        expect(reportData.statistics).toBeDefined();
      });
    });
    
    describe('Statistics', () => {
      it('should calculate gate execution statistics', async () => {
        const context1 = { templateContent: '<p>Test 1</p>', templateName: 'test1' };
        const context2 = { templateContent: '<p>Test 2</p>', templateName: 'test2' };
        
        await gates.executeGate('stats-test-1', context1);
        await gates.executeGate('stats-test-2', context2);
        
        const stats = gates.getStatistics();
        expect(stats.totalGatesExecuted).toBe(2);
        expect(stats.passedGates).toBeGreaterThan(0);
        expect(stats.averageExecutionTime).toBeGreaterThan(0);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should handle complex policy scenarios', async () => {
      const resolver = new PolicyURIResolver({
        shapesPath: path.join(tempDir, 'shapes'),
        auditPath: path.join(tempDir, 'audit')
      });
      await resolver.initialize();
      
      // Test multiple policy resolutions
      const contexts = [
        {
          templateContent: '<h1>{{ title }}</h1>',
          templateName: 'safe',
          dataGraph: `@prefix kgen: <https://kgen.io/ontology#> . <#test> a kgen:Artifact ; kgen:hasIdentifier "test" .`
        },
        {
          templateContent: '<script>eval(input)</script>',
          templateName: 'unsafe'
        }
      ];
      
      const results = [];
      for (const context of contexts) {
        const result = await resolver.resolvePolicyURI('policy://template-security/pass', context);
        results.push(result);
      }
      
      // First should pass, second should fail
      expect(results[0].passed).toBe(true);
      expect(results[1].passed).toBe(false);
      
      const stats = resolver.getVerdictStatistics();
      expect(stats.totalResolutions).toBe(2);
      expect(parseFloat(stats.passRate)).toBe(50);
    });
    
    it('should handle policy gates in different environments', async () => {
      const environments = ['development', 'staging', 'production'];
      const context = {
        templateContent: '<script>console.log("test")</script>',
        templateName: 'console-template'
      };
      
      for (const env of environments) {
        const envGates = new PolicyGates({
          environment: env,
          auditPath: path.join(tempDir, `audit-${env}`),
          exitOnFailure: false
        });
        await envGates.initialize();
        
        const result = await envGates.executeGate(`${env}-gate`, context);
        
        // Different environments should have different blocking behavior
        if (env === 'development') {
          expect(result.blocked).toBe(false);
        } else {
          // Staging and production should be more strict
          expect(result.passed).toBeDefined();
        }
      }
    });
  });
});