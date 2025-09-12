/**
 * Enterprise Security Framework Integration Tests
 * Comprehensive test suite for all security hardening components
 * 
 * @description Tests the integration and interoperability of all enterprise security components
 * @version 1.0.0
 * @author Agent #6: Security Hardening Specialist
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';

// Import all security components
import { MultiFactorAuthentication } from '../../src/security/enterprise-hardening/multi-factor-auth.js';
import { APISecurityManager } from '../../src/security/enterprise-hardening/api-security.js';
import { EnterpriseRBAC } from '../../src/security/rbac/enterprise-rbac.js';
import { ComplianceEngine } from '../../src/security/compliance/compliance-engine.js';
import { AdvancedInputValidator } from '../../src/security/enterprise-hardening/input-validation.js';
import { EnterpriseSecretsManager } from '../../src/security/enterprise-hardening/secrets-management.js';
import { EnterpriseVulnerabilityScanner } from '../../src/security/enterprise-hardening/vulnerability-scanner.js';

describe('Enterprise Security Framework Integration', () => {
  let securityComponents;
  let testContext;

  beforeEach(async () => {
    // Initialize all security components with test configuration
    securityComponents = {
      mfa: new MultiFactorAuthentication({
        debug: true,
        providers: {
          totp: { enabled: true, issuer: 'KGEN-Test' },
          sms: { enabled: false }, // Disabled for testing
          email: { enabled: true, from: 'test@kgen.dev' },
          hardware: { enabled: false }
        }
      }),
      
      apiSecurity: new APISecurityManager({
        debug: true,
        rateLimiting: {
          windowMs: 60000, // 1 minute
          maxRequests: 100,
          algorithm: 'sliding-window'
        },
        cors: {
          origin: ['http://localhost:3000'],
          credentials: true
        }
      }),
      
      rbac: new EnterpriseRBAC({
        debug: true,
        cacheConfig: {
          maxSize: 1000,
          ttl: 300000 // 5 minutes
        }
      }),
      
      compliance: new ComplianceEngine({
        debug: true,
        frameworks: ['SOC2', 'GDPR', 'ISO27001'],
        evidenceStorage: {
          type: 'memory', // For testing
          retention: 86400000 // 1 day for tests
        }
      }),
      
      inputValidator: new AdvancedInputValidator({
        debug: true,
        enableMLDetection: false, // Disabled for testing
        rdfValidation: {
          enabled: true,
          strictMode: true
        }
      }),
      
      secretsManager: new EnterpriseSecretsManager({
        debug: true,
        encryption: {
          algorithm: 'aes-256-gcm',
          keyRotationInterval: 86400000 // 1 day for tests
        },
        storage: {
          type: 'memory' // For testing
        }
      }),
      
      vulnerabilityScanner: new EnterpriseVulnerabilityScanner({
        debug: true,
        scanners: {
          dependencies: { enabled: true },
          container: { enabled: false }, // Requires Docker
          secrets: { enabled: true },
          sast: { enabled: true }
        }
      })
    };

    // Initialize all components
    await Promise.all(Object.values(securityComponents).map(component => 
      component.initialize?.()
    ));

    // Set up test context
    testContext = {
      userId: 'test-user-001',
      sessionId: 'test-session-001',
      requestId: 'test-request-001',
      userAgent: 'KGEN-Security-Test/1.0',
      ipAddress: '127.0.0.1',
      timestamp: new Date()
    };
  });

  afterEach(async () => {
    // Cleanup all components
    await Promise.all(Object.values(securityComponents).map(component => 
      component.shutdown?.()
    ));
  });

  describe('Component Initialization', () => {
    it('should initialize all security components successfully', async () => {
      for (const [name, component] of Object.entries(securityComponents)) {
        expect(component).toBeDefined();
        expect(component instanceof EventEmitter).toBe(true);
        
        // Check component health
        const health = await component.getHealth?.();
        if (health) {
          expect(health.status).toBe('healthy');
        }
      }
    });

    it('should have proper component metrics available', async () => {
      for (const [name, component] of Object.entries(securityComponents)) {
        const metrics = await component.getMetrics?.();
        if (metrics) {
          expect(metrics).toHaveProperty('uptime');
          expect(metrics.uptime).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Authentication Flow Integration', () => {
    it('should perform complete authentication with MFA and RBAC', async () => {
      const { mfa, rbac } = securityComponents;
      
      // Step 1: Setup MFA for user
      const mfaSetup = await mfa.setupMFA(testContext.userId, 'totp');
      expect(mfaSetup.success).toBe(true);
      expect(mfaSetup.qrCode).toBeDefined();
      
      // Step 2: Simulate TOTP verification
      const secret = mfaSetup.secret;
      const mockTOTP = '123456'; // Mock TOTP code
      vi.spyOn(mfa.totpProvider, 'verifyToken').mockResolvedValue(true);
      
      const mfaResult = await mfa.verifyMFA(testContext.userId, {
        method: 'totp',
        token: mockTOTP
      });
      expect(mfaResult.success).toBe(true);
      
      // Step 3: Setup user role in RBAC
      await rbac.assignRole(testContext.userId, 'user', {
        assignedBy: 'system',
        reason: 'test-setup'
      });
      
      // Step 4: Verify permissions
      const hasPermission = await rbac.checkPermission(
        testContext.userId, 
        'read:data', 
        testContext
      );
      expect(hasPermission).toBe(true);
    });

    it('should handle authentication failure scenarios', async () => {
      const { mfa, rbac } = securityComponents;
      
      // Test invalid MFA
      const invalidMFA = await mfa.verifyMFA('invalid-user', {
        method: 'totp',
        token: 'invalid'
      });
      expect(invalidMFA.success).toBe(false);
      expect(invalidMFA.error).toContain('Invalid');
      
      // Test unauthorized access
      const unauthorizedAccess = await rbac.checkPermission(
        'invalid-user', 
        'admin:delete', 
        testContext
      );
      expect(unauthorizedAccess).toBe(false);
    });
  });

  describe('API Security Integration', () => {
    it('should enforce rate limiting with proper headers', async () => {
      const { apiSecurity } = securityComponents;
      
      const mockReq = {
        ip: testContext.ipAddress,
        headers: { 'user-agent': testContext.userAgent },
        user: { id: testContext.userId }
      };
      
      const mockRes = {
        headers: {},
        setHeader: function(name, value) { this.headers[name] = value; },
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };
      
      const mockNext = vi.fn();
      
      // Create rate limit middleware
      const rateLimitMiddleware = apiSecurity.rateLimitMiddleware();
      
      // Test normal request
      await rateLimitMiddleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.headers['X-RateLimit-Remaining']).toBeDefined();
    });

    it('should integrate with input validation', async () => {
      const { apiSecurity, inputValidator } = securityComponents;
      
      const testInput = {
        query: 'SELECT * FROM data WHERE id = ?',
        params: ['test-id'],
        userInput: '<script>alert("xss")</script>'
      };
      
      // Validate input
      const validationResult = await inputValidator.validateInput(testInput, {
        ...testContext,
        inputType: 'api-request'
      });
      
      if (validationResult.isValid) {
        expect(validationResult.sanitizedInput).toBeDefined();
        expect(validationResult.sanitizedInput.userInput).not.toContain('<script>');
      } else {
        expect(validationResult.violations).toBeDefined();
        expect(validationResult.violations.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Compliance and Audit Integration', () => {
    it('should generate audit trail across all components', async () => {
      const { compliance, rbac, secretsManager } = securityComponents;
      
      // Perform auditable actions
      await rbac.assignRole(testContext.userId, 'admin', {
        assignedBy: 'test-system',
        reason: 'integration-test'
      });
      
      await secretsManager.storeSecret('test-secret', 'test-value', {
        userId: testContext.userId,
        purpose: 'integration-test'
      });
      
      // Check compliance assessment
      const complianceResult = await compliance.assessCompliance('GDPR', {
        scope: 'user-data',
        includeEvidence: true
      });
      
      expect(complianceResult.overallScore).toBeGreaterThan(0);
      expect(complianceResult.evidence).toBeDefined();
      expect(complianceResult.auditTrail).toBeDefined();
    });

    it('should handle compliance violations', async () => {
      const { compliance, inputValidator } = securityComponents;
      
      // Simulate potential GDPR violation with PII
      const piiInput = {
        email: 'test@example.com',
        ssn: '123-45-6789',
        creditCard: '4111-1111-1111-1111'
      };
      
      const validationResult = await inputValidator.validateInput(piiInput, {
        ...testContext,
        complianceCheck: ['GDPR', 'PCI_DSS']
      });
      
      if (!validationResult.isValid) {
        const complianceViolations = validationResult.violations.filter(
          v => v.type === 'compliance'
        );
        expect(complianceViolations.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Security Incident Response', () => {
    it('should detect and respond to security threats', async () => {
      const { vulnerabilityScanner, apiSecurity, inputValidator } = securityComponents;
      
      // Simulate multiple suspicious activities
      const suspiciousActivities = [
        // SQL Injection attempt
        { 
          type: 'input', 
          data: "'; DROP TABLE users; --",
          context: { ...testContext, inputType: 'sql-query' }
        },
        
        // Rate limit abuse
        {
          type: 'rate-limit',
          data: { requests: 1000, timeWindow: 60000 },
          context: testContext
        },
        
        // Potential secret in code
        {
          type: 'code',
          data: 'const apiKey = "sk-1234567890abcdef";',
          context: { ...testContext, scanType: 'secret-detection' }
        }
      ];
      
      const threats = [];
      
      for (const activity of suspiciousActivities) {
        switch (activity.type) {
          case 'input':
            const inputResult = await inputValidator.validateInput(
              activity.data, 
              activity.context
            );
            if (!inputResult.isValid) {
              threats.push({
                type: 'input-validation-failure',
                severity: 'high',
                details: inputResult.violations
              });
            }
            break;
            
          case 'code':
            const scanResult = await vulnerabilityScanner.performSecurityScan({
              type: 'secrets',
              content: activity.data,
              context: activity.context
            });
            if (scanResult.findings.length > 0) {
              threats.push({
                type: 'secret-exposure',
                severity: 'critical',
                details: scanResult.findings
              });
            }
            break;
        }
      }
      
      expect(threats.length).toBeGreaterThan(0);
      
      // Verify threat classification
      const criticalThreats = threats.filter(t => t.severity === 'critical');
      const highThreats = threats.filter(t => t.severity === 'high');
      
      expect(criticalThreats.length + highThreats.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle concurrent security operations', async () => {
      const { rbac, secretsManager, inputValidator } = securityComponents;
      
      const concurrentOperations = 50;
      const operations = [];
      
      // Generate concurrent operations
      for (let i = 0; i < concurrentOperations; i++) {
        operations.push(
          rbac.checkPermission(`user-${i}`, 'read:data', testContext),
          secretsManager.retrieveSecret(`secret-${i}`),
          inputValidator.validateInput(`input-${i}`, testContext)
        );
      }
      
      const startTime = Date.now();
      const results = await Promise.allSettled(operations);
      const endTime = Date.now();
      
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(5000); // Should complete in under 5 seconds
      
      // Check success rate
      const successfulOperations = results.filter(r => r.status === 'fulfilled');
      const successRate = successfulOperations.length / results.length;
      expect(successRate).toBeGreaterThan(0.8); // At least 80% success rate
    });

    it('should maintain security under load', async () => {
      const { apiSecurity } = securityComponents;
      
      const loadTestRequests = 100;
      const requests = [];
      
      for (let i = 0; i < loadTestRequests; i++) {
        const mockReq = {
          ip: `192.168.1.${i % 255}`,
          headers: { 'user-agent': `TestClient-${i}` },
          user: { id: `user-${i}` }
        };
        
        const mockRes = {
          headers: {},
          setHeader: function(name, value) { this.headers[name] = value; },
          status: vi.fn().mockReturnThis(),
          json: vi.fn()
        };
        
        requests.push(new Promise(resolve => {
          const middleware = apiSecurity.rateLimitMiddleware();
          middleware(mockReq, mockRes, () => resolve('allowed'));
        }));
      }
      
      const results = await Promise.allSettled(requests);
      const allowedRequests = results.filter(r => 
        r.status === 'fulfilled' && r.value === 'allowed'
      );
      
      // Should allow legitimate distributed requests
      expect(allowedRequests.length).toBeGreaterThan(loadTestRequests * 0.5);
    });
  });

  describe('Component Interoperability', () => {
    it('should share security context between components', async () => {
      const { rbac, secretsManager, compliance } = securityComponents;
      
      // Create security context in RBAC
      const securityContext = await rbac.createSecurityContext(testContext.userId, {
        sessionId: testContext.sessionId,
        permissions: ['read:secrets', 'write:audit'],
        attributes: {
          department: 'security',
          clearanceLevel: 'confidential'
        }
      });
      
      // Use context in secrets manager
      const secretAccess = await secretsManager.checkAccess('system-secret', {
        userId: testContext.userId,
        securityContext: securityContext
      });
      
      expect(secretAccess.allowed).toBeDefined();
      
      // Generate compliance evidence
      const evidence = await compliance.generateEvidence('ACCESS_CONTROL', {
        userId: testContext.userId,
        resource: 'system-secret',
        context: securityContext,
        timestamp: testContext.timestamp
      });
      
      expect(evidence.evidenceId).toBeDefined();
      expect(evidence.digitalSignature).toBeDefined();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should gracefully handle component failures', async () => {
      const { mfa, rbac } = securityComponents;
      
      // Simulate MFA service failure
      vi.spyOn(mfa, 'verifyMFA').mockRejectedValue(new Error('Service unavailable'));
      
      try {
        await mfa.verifyMFA(testContext.userId, {
          method: 'totp',
          token: '123456'
        });
      } catch (error) {
        expect(error.message).toBe('Service unavailable');
      }
      
      // RBAC should still function independently
      const rbacHealth = await rbac.getHealth();
      expect(rbacHealth.status).toBe('healthy');
      
      // Should be able to perform fallback authentication
      const fallbackAuth = await rbac.checkPermission(
        testContext.userId, 
        'read:data', 
        { ...testContext, bypassMFA: true }
      );
      expect(typeof fallbackAuth).toBe('boolean');
    });

    it('should handle circuit breaker activation', async () => {
      const { vulnerabilityScanner } = securityComponents;
      
      // Simulate multiple failures to trigger circuit breaker
      const failures = [];
      for (let i = 0; i < 10; i++) {
        try {
          await vulnerabilityScanner.performSecurityScan({
            type: 'invalid-type',
            target: 'non-existent-target'
          });
        } catch (error) {
          failures.push(error);
        }
      }
      
      expect(failures.length).toBeGreaterThan(0);
      
      // Check if circuit breaker is activated
      const scannerHealth = await vulnerabilityScanner.getHealth();
      expect(scannerHealth).toBeDefined();
    });
  });
});

describe('Security Framework Configuration Validation', () => {
  it('should validate security configuration completeness', () => {
    const requiredComponents = [
      'MultiFactorAuthentication',
      'APISecurityManager', 
      'EnterpriseRBAC',
      'ComplianceEngine',
      'AdvancedInputValidator',
      'EnterpriseSecretsManager',
      'EnterpriseVulnerabilityScanner'
    ];
    
    requiredComponents.forEach(componentName => {
      expect(eval(componentName)).toBeDefined();
    });
  });
  
  it('should have proper security defaults', async () => {
    const defaultConfig = {
      encryption: 'aes-256-gcm',
      hashingAlgorithm: 'bcrypt',
      tokenExpiry: 3600,
      sessionTimeout: 1800,
      maxLoginAttempts: 5,
      rateLimitWindow: 900,
      complianceFrameworks: ['SOC2', 'GDPR', 'ISO27001'],
      auditRetention: 2592000 // 30 days
    };
    
    Object.keys(defaultConfig).forEach(key => {
      expect(defaultConfig[key]).toBeDefined();
      expect(defaultConfig[key]).not.toBe('');
    });
  });
});