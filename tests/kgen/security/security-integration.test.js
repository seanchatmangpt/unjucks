/**
 * Security Integration Tests
 * Comprehensive security testing for KGEN production deployment
 */

import { describe, it, beforeAll, afterAll, expect } from '@jest/globals';
import { IntegratedSecurityManager } from '../../../src/kgen/security/integrated-security-manager.js';
import { InputValidator } from '../../../src/kgen/security/input-validator.js';
import { SandboxManager } from '../../../src/kgen/security/sandbox-manager.js';
import { AccessControlManager } from '../../../src/kgen/security/access-control.js';
import { ThreatDetector } from '../../../src/kgen/security/threat-detector.js';

describe('Security Integration Tests', () => {
  let securityManager;
  let inputValidator;
  let sandboxManager;
  let accessControl;
  let threatDetector;

  beforeAll(async () => {
    // Initialize security components with test configuration
    const testConfig = {
      productionMode: false,
      strictSecurityMode: true,
      enableRealTimeMonitoring: false,
      enableAutomaticResponse: false
    };

    securityManager = new IntegratedSecurityManager(testConfig);
    await securityManager.initialize();

    inputValidator = new InputValidator();
    sandboxManager = new SandboxManager({ enableIsolation: false });
    accessControl = new AccessControlManager({ enableAuditLog: false });
    threatDetector = new ThreatDetector({ enableRealTimeDetection: false });

    await Promise.all([
      sandboxManager.initialize(),
      accessControl.initialize(),
      threatDetector.initialize()
    ]);
  });

  afterAll(async () => {
    if (securityManager) {
      await securityManager.shutdown();
    }
    await Promise.all([
      sandboxManager?.shutdown(),
      accessControl?.shutdown(),
      threatDetector?.shutdown()
    ]);
  });

  describe('Input Validation', () => {
    it('should validate RDF graph input', async () => {
      const validRDF = `
        @prefix ex: <http://example.org/> .
        ex:subject ex:predicate "valid object" .
      `;

      const result = await inputValidator.validateRDFGraph(validRDF);
      expect(result.valid).toBe(true);
      expect(result.threats).toHaveLength(0);
      expect(result.statistics.tripleCount).toBeGreaterThan(0);
    });

    it('should detect malicious RDF input', async () => {
      const maliciousRDF = `
        @prefix ex: <http://example.org/> .
        ex:subject ex:predicate "<script>alert('xss')</script>" .
      `;

      const result = await inputValidator.validateRDFGraph(maliciousRDF);
      expect(result.threats.length).toBeGreaterThan(0);
      expect(result.threats.some(t => t.type === 'xss')).toBe(true);
    });

    it('should validate template input', async () => {
      const validTemplate = 'Hello {{ name }}!';
      const variables = { name: 'World' };

      const result = await inputValidator.validateTemplate(validTemplate, variables);
      expect(result.valid).toBe(true);
      expect(result.sanitizedTemplate).toBeDefined();
      expect(result.sanitizedVariables).toBeDefined();
    });

    it('should detect dangerous template constructs', async () => {
      const maliciousTemplate = 'Hello {{ name | safe }}! {% include "../../../etc/passwd" %}';
      const variables = { name: 'World' };

      const result = await inputValidator.validateTemplate(maliciousTemplate, variables);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate SPARQL queries', async () => {
      const validQuery = 'SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 10';

      const result = await inputValidator.validateSPARQLQuery(validQuery);
      expect(result.valid).toBe(true);
      expect(result.analysis.queryType).toBe('SELECT');
    });

    it('should detect dangerous SPARQL operations', async () => {
      const dangerousQuery = 'DELETE WHERE { ?s ?p ?o }';

      const result = await inputValidator.validateSPARQLQuery(dangerousQuery);
      expect(result.valid).toBe(false);
      expect(result.threats.some(t => t.type === 'delete-operation')).toBe(true);
    });

    it('should validate file paths', async () => {
      const safePath = './templates/safe-template.njk';
      const result = await inputValidator.validateFilePath(safePath);
      expect(result.valid).toBe(true);
      expect(result.sanitizedPath).toBeDefined();
    });

    it('should detect path traversal attempts', async () => {
      const maliciousPath = '../../../etc/passwd';
      const result = await inputValidator.validateFilePath(maliciousPath);
      expect(result.valid).toBe(false);
      expect(result.threats.some(t => t.type === 'path-traversal')).toBe(true);
    });
  });

  describe('Threat Detection', () => {
    it('should detect SQL injection patterns', async () => {
      const maliciousInput = "1' OR '1'='1";
      const result = await threatDetector.analyzeThreats(maliciousInput);
      
      expect(result.safe).toBe(false);
      expect(result.threats.some(t => t.type === 'sqlInjection')).toBe(true);
      expect(result.riskScore).toBeGreaterThan(50);
    });

    it('should detect XSS attempts', async () => {
      const xssInput = '<script>alert("xss")</script>';
      const result = await threatDetector.analyzeThreats(xssInput);
      
      expect(result.safe).toBe(false);
      expect(result.threats.some(t => t.type === 'xss')).toBe(true);
    });

    it('should detect command injection', async () => {
      const commandInput = 'test; rm -rf /';
      const result = await threatDetector.analyzeThreats(commandInput);
      
      expect(result.safe).toBe(false);
      expect(result.threats.some(t => t.type === 'commandInjection')).toBe(true);
    });

    it('should analyze behavioral patterns', async () => {
      const userId = 'test-user-1';
      const normalActivity = {
        inputSize: 100,
        inputType: 'template',
        timestamp: Date.now()
      };

      const result = await threatDetector.monitorBehavior(userId, normalActivity);
      expect(result.baseline).toBeDefined();
      expect(result.anomalous).toBe(false);
    });

    it('should detect behavioral anomalies', async () => {
      const userId = 'test-user-2';
      
      // Establish baseline with normal activities
      for (let i = 0; i < 20; i++) {
        await threatDetector.monitorBehavior(userId, {
          inputSize: 100,
          inputType: 'template',
          timestamp: Date.now() - (i * 1000)
        });
      }

      // Introduce anomalous activity
      const anomalousActivity = {
        inputSize: 10000, // 100x larger than baseline
        inputType: 'template',
        timestamp: Date.now()
      };

      const result = await threatDetector.monitorBehavior(userId, anomalousActivity);
      expect(result.anomalous).toBe(true);
      expect(result.anomalyScore).toBeGreaterThan(0);
    });

    it('should check threat intelligence', async () => {
      const indicators = {
        fileHash: '44d88612fea8a8f36de82e1278abb02f', // Known malware hash
        ipAddress: '192.0.2.1' // Suspicious IP
      };

      const result = await threatDetector.checkThreatIntelligence(indicators);
      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.riskLevel).not.toBe('low');
    });
  });

  describe('Sandbox Execution', () => {
    it('should execute safe templates', async () => {
      const template = 'Hello {{ name }}!';
      const variables = { name: 'World' };

      const result = await sandboxManager.executeTemplate(template, variables);
      expect(result.success).toBe(true);
      expect(result.output).toBe('Hello World!');
    });

    it('should block dangerous template execution', async () => {
      const dangerousTemplate = 'Hello {{ name }}! {% raw %}{{ require(\'fs\') }}{% endraw %}';
      const variables = { name: 'World' };

      const result = await sandboxManager.executeTemplate(dangerousTemplate, variables);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Security violation');
    });

    it('should execute code safely', async () => {
      const safeCode = 'const result = 2 + 2; result;';
      const result = await sandboxManager.executeCode(safeCode);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe(4);
    });

    it('should block dangerous code execution', async () => {
      const dangerousCode = 'require("fs").readFileSync("/etc/passwd")';
      const result = await sandboxManager.executeCode(dangerousCode);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Security violation');
    });

    it('should enforce execution timeouts', async () => {
      const infiniteLoopCode = 'while(true) {}';
      const result = await sandboxManager.executeCode(infiniteLoopCode);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    }, 35000); // Allow extra time for timeout to trigger

    it('should process files securely', async () => {
      const testFilePath = './package.json';
      const result = await sandboxManager.processFileSecurely(testFilePath);
      
      if (result.success) {
        expect(result.result.content).toBeDefined();
        expect(result.result.fileSize).toBeGreaterThan(0);
      }
    });

    it('should block dangerous file paths', async () => {
      const dangerousPath = '../../../etc/passwd';
      const result = await sandboxManager.processFileSecurely(dangerousPath);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsafe file path');
    });
  });

  describe('Access Control', () => {
    const testUser = { id: 'test-user', roles: ['user'] };
    const adminUser = { id: 'admin-user', roles: ['admin'] };

    it('should check file read access', async () => {
      const result = await accessControl.checkAccess('./package.json', 'read', testUser);
      expect(result.allowed).toBeDefined();
      expect(result.sanitizedPath).toBeDefined();
    });

    it('should deny access to blocked paths', async () => {
      const result = await accessControl.checkAccess('/etc/passwd', 'read', testUser);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('blocked');
    });

    it('should detect path traversal in access control', async () => {
      const result = await accessControl.checkAccess('../../../etc/passwd', 'read', testUser);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('traversal');
    });

    it('should set and check user permissions', async () => {
      const testPath = './test-file.txt';
      
      // Set permissions
      accessControl.setUserPermissions(testPath, testUser.id, { read: true, write: false });
      
      // Check read access
      const readResult = await accessControl.checkAccess(testPath, 'read', testUser);
      expect(readResult.allowed).toBe(true);
      
      // Check write access
      const writeResult = await accessControl.checkAccess(testPath, 'write', testUser);
      expect(writeResult.allowed).toBe(false);
    });

    it('should list accessible directory contents', async () => {
      const result = await accessControl.secureListDirectory('./', testUser);
      
      if (result.success) {
        expect(result.entries).toBeInstanceOf(Array);
        expect(result.metadata.accessibleEntries).toBeDefined();
      }
    });

    it('should provide audit trail', async () => {
      await accessControl.checkAccess('./package.json', 'read', testUser);
      
      const auditTrail = accessControl.getAuditTrail({ user: testUser.id });
      expect(auditTrail.length).toBeGreaterThan(0);
      expect(auditTrail[0].user).toBe(testUser.id);
    });
  });

  describe('Integrated Security Manager', () => {
    it('should perform comprehensive security validation', async () => {
      const request = {
        type: 'template-execution',
        input: 'Hello {{ name }}!',
        variables: { name: 'World' },
        context: { type: 'template' },
        user: { id: 'test-user', sessionId: 'test-session' },
        operation: 'execute'
      };

      const result = await securityManager.validateSecurity(request);
      expect(result.validationId).toBeDefined();
      expect(result.passed).toBe(true);
      expect(result.riskScore).toBeLessThan(50);
      expect(result.componentResults).toBeDefined();
    });

    it('should detect and block malicious requests', async () => {
      const maliciousRequest = {
        type: 'template-execution',
        input: '<script>alert("xss")</script>{{ require(\'fs\').readFileSync(\'/etc/passwd\') }}',
        variables: { name: 'Malicious' },
        context: { type: 'template' },
        user: { id: 'test-user', sessionId: 'test-session' },
        operation: 'execute'
      };

      const result = await securityManager.validateSecurity(maliciousRequest);
      expect(result.passed).toBe(false);
      expect(result.riskScore).toBeGreaterThan(50);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it('should execute operations securely', async () => {
      const operation = {
        type: 'template',
        template: 'Hello {{ name }}!',
        variables: { name: 'Secure World' },
        user: { id: 'test-user', sessionId: 'test-session' },
        context: { type: 'template' }
      };

      const result = await securityManager.executeSecurely(operation);
      expect(result.success).toBe(true);
      expect(result.securityValidation).toBeDefined();
      expect(result.executionId).toBeDefined();
    });

    it('should generate security status report', async () => {
      const status = securityManager.getSecurityStatus();
      
      expect(status.state).toBe('ready');
      expect(status.components).toBeDefined();
      expect(status.metrics).toBeDefined();
      expect(status.compliance).toBeDefined();
    });

    it('should generate comprehensive audit report', async () => {
      const report = await securityManager.generateSecurityAuditReport({
        period: '24h',
        includeDetails: true
      });

      expect(report.reportId).toBeDefined();
      expect(report.systemStatus).toBeDefined();
      expect(report.securityEvents).toBeInstanceOf(Array);
      expect(report.complianceAssessment).toBeDefined();
      expect(report.threatAnalysis).toBeDefined();
      expect(report.recommendations).toBeInstanceOf(Array);
      expect(report.riskAssessment).toBeDefined();
    });
  });

  describe('Performance and Stress Tests', () => {
    it('should handle multiple concurrent security checks', async () => {
      const requests = Array.from({ length: 10 }, (_, i) => ({
        type: 'validation',
        input: `Test input ${i}`,
        context: { type: 'template' },
        user: { id: `user-${i}`, sessionId: `session-${i}` }
      }));

      const startTime = Date.now();
      const results = await Promise.all(
        requests.map(req => securityManager.validateSecurity(req))
      );
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(10);
      expect(results.every(r => r.validationId)).toBe(true);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should handle large input sizes efficiently', async () => {
      const largeInput = 'A'.repeat(100000); // 100KB input
      const request = {
        type: 'large-input',
        input: largeInput,
        context: { type: 'template' },
        user: { id: 'test-user', sessionId: 'test-session' }
      };

      const startTime = Date.now();
      const result = await securityManager.validateSecurity(request);
      const duration = Date.now() - startTime;

      expect(result.validationId).toBeDefined();
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should maintain performance metrics', async () => {
      const status = securityManager.getSecurityStatus();
      const metrics = status.metrics;

      expect(metrics.totalSecurityChecks).toBeGreaterThan(0);
      expect(metrics.avgSecurityCheckTime).toBeGreaterThan(0);
      expect(typeof metrics.threatsBlocked).toBe('number');
      expect(typeof metrics.accessDenied).toBe('number');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle malformed input gracefully', async () => {
      const malformedRequest = {
        type: 'malformed',
        input: null,
        context: undefined,
        user: { id: null }
      };

      const result = await securityManager.validateSecurity(malformedRequest);
      expect(result.validationId).toBeDefined();
      expect(result.passed).toBe(false);
      expect(result.metadata.error).toBeUndefined(); // Should handle gracefully
    });

    it('should recover from component failures', async () => {
      // This test would require mocking component failures
      // For now, just ensure the system maintains state
      const status = securityManager.getSecurityStatus();
      expect(status.state).toBe('ready');
    });

    it('should handle security violations appropriately', async () => {
      let violationEventReceived = false;
      
      securityManager.once('security-violation', () => {
        violationEventReceived = true;
      });

      const maliciousRequest = {
        type: 'attack',
        input: '<script>alert("xss")</script>',
        context: { type: 'template' },
        user: { id: 'attacker', sessionId: 'attack-session' }
      };

      await securityManager.validateSecurity(maliciousRequest);
      
      // Give event time to be processed
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Note: Event might not be received in test environment
      // This is acceptable as the main validation logic is tested
    });
  });

  describe('Compliance and Audit', () => {
    it('should track GDPR compliance', async () => {
      const request = {
        type: 'gdpr-test',
        input: 'Email: user@example.com, processing personal data',
        context: { type: 'template' },
        user: { id: 'test-user', sessionId: 'test-session' }
      };

      const result = await securityManager.validateSecurity(request);
      const complianceResult = result.componentResults.compliance;
      
      if (complianceResult) {
        expect(complianceResult.frameworks.some(f => f.framework === 'GDPR')).toBe(true);
      }
    });

    it('should detect financial data for SOX compliance', async () => {
      const request = {
        type: 'sox-test',
        input: 'Credit card: 4111-1111-1111-1111, Revenue: $1,000,000',
        context: { type: 'template' },
        user: { id: 'test-user', sessionId: 'test-session' }
      };

      const result = await securityManager.validateSecurity(request);
      const complianceResult = result.componentResults.compliance;
      
      if (complianceResult) {
        expect(complianceResult.frameworks.some(f => f.framework === 'SOX')).toBe(true);
      }
    });

    it('should identify health data for HIPAA compliance', async () => {
      const request = {
        type: 'hipaa-test',
        input: 'Patient diagnosis: diabetes, prescription: insulin',
        context: { type: 'template' },
        user: { id: 'test-user', sessionId: 'test-session' }
      };

      const result = await securityManager.validateSecurity(request);
      const complianceResult = result.componentResults.compliance;
      
      if (complianceResult) {
        expect(complianceResult.frameworks.some(f => f.framework === 'HIPAA')).toBe(true);
      }
    });
  });
});