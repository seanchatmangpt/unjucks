/**
 * Enterprise Security Integration Tests
 * 
 * Comprehensive test suite for KGEN enterprise security framework
 * including RBAC, compliance, governance, and cryptographic operations.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { KGENSecurityFramework } from '../../../../packages/kgen-core/src/security/index.js';

describe('KGEN Enterprise Security Framework', () => {
  let securityFramework;
  let testUser;
  let testAdmin;
  
  beforeAll(async () => {
    // Initialize security framework with test configuration
    securityFramework = new KGENSecurityFramework({
      enforceAuthentication: true,
      enforceAuthorization: true,
      enforceCompliance: true,
      enforceGovernance: true,
      securityLevel: 'ENTERPRISE',
      enabledFrameworks: ['SOX', 'GDPR', 'HIPAA', 'PCI_DSS'],
      security: {
        jwt: {
          secret: 'test-super-secret-key-for-enterprise-security-framework-testing-only'
        }
      }
    });
    
    await securityFramework.initialize();
    
    // Create test users
    testUser = {
      id: 'test-user-123',
      username: 'testuser',
      email: 'test@example.com',
      roles: ['user'],
      permissions: ['template:read', 'data:read'],
      clearanceLevel: 'INTERNAL'
    };
    
    testAdmin = {
      id: 'test-admin-456',
      username: 'testadmin',
      email: 'admin@example.com',
      roles: ['admin'],
      permissions: ['*'],
      clearanceLevel: 'RESTRICTED'
    };
  });
  
  afterAll(async () => {
    await securityFramework.shutdown();
  });

  describe('Security Framework Initialization', () => {
    test('should initialize all security components', async () => {
      const status = securityFramework.getStatus();
      
      expect(status.status).toBe('ready');
      expect(status.securityLevel).toBe('ENTERPRISE');
      expect(status.enabledFrameworks).toContain('SOX');
      expect(status.enabledFrameworks).toContain('GDPR');
      expect(status.enabledFrameworks).toContain('HIPAA');
      expect(status.components).toBeDefined();
    });
    
    test('should have all required security components', () => {
      const status = securityFramework.getStatus();
      const components = status.components;
      
      expect(components.securityManager).toBeDefined();
      expect(components.rbacManager).toBeDefined();
      expect(components.cryptoService).toBeDefined();
      expect(components.auditLogger).toBeDefined();
      expect(components.policyEngine).toBeDefined();
      expect(components.complianceFramework).toBeDefined();
      expect(components.validationEngine).toBeDefined();
      expect(components.governanceEngine).toBeDefined();
    });
  });

  describe('Template Security Validation', () => {
    test('should validate secure template successfully', async () => {
      const secureTemplate = {
        name: 'secure-template',
        content: '<h1>Welcome {{username}}</h1><p>This is a secure template.</p>',
        variables: {
          username: 'John Doe'
        }
      };
      
      const result = await securityFramework.secureTemplateGeneration(
        secureTemplate,
        secureTemplate.variables,
        testUser
      );
      
      expect(result.secured).toBe(true);
      expect(result.sensitiveDataEncrypted).toBe(false);
    });
    
    test('should detect and encrypt sensitive data in templates', async () => {
      const sensitiveTemplate = {
        name: 'sensitive-template',
        content: '<h1>User Details</h1><p>Email: {{email}}</p><p>SSN: {{ssn}}</p>',
        variables: {
          email: 'john.doe@example.com',
          ssn: '123-45-6789',
          name: 'John Doe'
        }
      };
      
      const result = await securityFramework.secureTemplateGeneration(
        sensitiveTemplate,
        sensitiveTemplate.variables,
        testUser
      );
      
      expect(result.secured).toBe(true);
      expect(result.sensitiveDataEncrypted).toBe(true);
      expect(result.encryptedFields).toContain('email');
      expect(result.encryptedFields).toContain('ssn');
    });
    
    test('should reject template with security vulnerabilities', async () => {
      const maliciousTemplate = {
        name: 'malicious-template',
        content: '<script>alert("XSS")</script><h1>{{title}}</h1>',
        variables: {
          title: 'Test Title'
        }
      };
      
      await expect(
        securityFramework.secureTemplateGeneration(
          maliciousTemplate,
          maliciousTemplate.variables,
          testUser
        )
      ).rejects.toThrow(/security validation failed/i);
    });
  });

  describe('File Operation Security', () => {
    test('should validate safe file operations', async () => {
      const result = await securityFramework.secureFileOperation(
        'write',
        '/src/templates/example.njk',
        '<h1>Hello {{name}}</h1>',
        testUser
      );
      
      expect(result.secured).toBe(true);
      expect(result.classification).toBeDefined();
    });
    
    test('should block path traversal attacks', async () => {
      await expect(
        securityFramework.secureFileOperation(
          'read',
          '../../../etc/passwd',
          null,
          testUser
        )
      ).rejects.toThrow(/path validation failed/i);
    });
    
    test('should require higher clearance for restricted files', async () => {
      const restrictedContent = 'CLASSIFIED: This is highly sensitive information';
      
      await expect(
        securityFramework.secureFileOperation(
          'write',
          '/src/classified/secret.txt',
          restrictedContent,
          testUser
        )
      ).rejects.toThrow(/authorization/i);
    });
  });

  describe('Access Control and Authorization', () => {
    test('should authorize user with appropriate permissions', async () => {
      const result = await securityFramework.secureOperation(
        'template_read',
        { type: 'template', id: 'test-template' },
        testUser
      );
      
      expect(result.secured).toBe(true);
    });
    
    test('should deny access for insufficient permissions', async () => {
      await expect(
        securityFramework.secureOperation(
          'admin_operation',
          { type: 'system', id: 'critical-config' },
          testUser
        )
      ).rejects.toThrow(/unauthorized/i);
    });
    
    test('should allow admin access to all resources', async () => {
      const result = await securityFramework.secureOperation(
        'admin_operation',
        { type: 'system', id: 'critical-config' },
        testAdmin
      );
      
      expect(result.secured).toBe(true);
    });
  });

  describe('Compliance Framework', () => {
    test('should validate GDPR compliance for personal data', async () => {
      const personalDataContext = {
        operationType: 'data_processing',
        user: testUser,
        context: {
          personalData: true,
          dataType: 'customer_info',
          legalBasis: 'consent',
          consentId: 'consent-123'
        }
      };
      
      const result = await securityFramework.secureOperation(
        personalDataContext.operationType,
        personalDataContext.context,
        personalDataContext.user
      );
      
      expect(result.secured).toBe(true);
    });
    
    test('should detect GDPR violation for missing consent', async () => {
      const violationContext = {
        operationType: 'data_processing',
        user: testUser,
        context: {
          personalData: true,
          dataType: 'customer_info',
          legalBasis: 'consent'
          // Missing consentId
        }
      };
      
      await expect(
        securityFramework.secureOperation(
          violationContext.operationType,
          violationContext.context,
          violationContext.user
        )
      ).rejects.toThrow(/compliance violation/i);
    });
    
    test('should validate SOX compliance for financial data', async () => {
      const financialContext = {
        operationType: 'financial_transaction',
        user: testAdmin,
        context: {
          transactionType: 'audit_log',
          financialData: true,
          controlsApplied: ['segregation_of_duties', 'approval_workflow'],
          approver: 'financial-officer-789'
        }
      };
      
      const result = await securityFramework.secureOperation(
        financialContext.operationType,
        financialContext.context,
        financialContext.user
      );
      
      expect(result.secured).toBe(true);
    });
  });

  describe('Cryptographic Security', () => {
    test('should encrypt and decrypt sensitive data', async () => {
      const sensitiveData = {
        customerName: 'John Doe',
        ssn: '123-45-6789',
        creditCard: '4532-1234-5678-9012'
      };
      
      // Encrypt the data
      const encryptionResult = await securityFramework.cryptoService.encryptSensitiveData(
        sensitiveData,
        { classification: 'CONFIDENTIAL' }
      );
      
      expect(encryptionResult.encrypted).toBeDefined();
      expect(encryptionResult.encrypted.data).toBeDefined();
      expect(encryptionResult.encrypted.keyId).toBeDefined();
      
      // Decrypt the data
      const decryptionResult = await securityFramework.cryptoService.decryptSensitiveData(
        encryptionResult.encrypted
      );
      
      expect(decryptionResult.data).toEqual(sensitiveData);
    });
    
    test('should classify data sensitivity correctly', async () => {
      const testData = {
        name: 'John Doe',
        email: 'john@example.com',
        ssn: '123-45-6789',
        publicInfo: 'This is public information'
      };
      
      const classification = await securityFramework.cryptoService.classifyData(testData);
      
      expect(classification.level).toBe('CONFIDENTIAL');
      expect(classification.categories).toContain('PII');
      expect(classification.sensitiveFields).toContain('email');
      expect(classification.sensitiveFields).toContain('ssn');
    });
  });

  describe('Policy Enforcement', () => {
    test('should enforce template security policies', async () => {
      const securityContext = {
        operationType: 'template_generation',
        user: testUser,
        context: {
          template: {
            content: '<h1>{{title}}</h1><p>{{content}}</p>'
          }
        }
      };
      
      const result = await securityFramework.policyEngine.evaluateOperation(securityContext);
      
      expect(result.compliant).toBe(true);
      expect(result.appliedPolicies.length).toBeGreaterThan(0);
    });
    
    test('should detect policy violations', async () => {
      const violationContext = {
        operationType: 'code_generation',
        user: testUser,
        context: {
          generated: {
            code: 'const password = "hardcoded-secret-123";'
          }
        }
      };
      
      const result = await securityFramework.policyEngine.evaluateOperation(violationContext);
      
      expect(result.compliant).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });

  describe('Governance Engine', () => {
    test('should validate governance rules for data operations', async () => {
      const governanceContext = {
        operationType: 'data_export',
        user: testAdmin,
        context: {
          dataType: 'customer_records',
          classification: 'CONFIDENTIAL',
          exportFormat: 'csv'
        }
      };
      
      const result = await securityFramework.governanceEngine.validateOperation(governanceContext);
      
      expect(result.valid).toBe(true);
    });
    
    test('should require approval for sensitive operations', async () => {
      const sensitiveContext = {
        operationType: 'data_export',
        user: testUser,
        context: {
          dataType: 'financial_records',
          classification: 'RESTRICTED',
          exportFormat: 'json'
        }
      };
      
      const result = await securityFramework.governanceEngine.validateOperation(sensitiveContext);
      
      expect(result.approvalRequired).toBe(true);
    });
  });

  describe('Audit Logging', () => {
    test('should log security events', async () => {
      await securityFramework.auditLogger.logSecurityEvent(
        'AUTHENTICATION',
        'login_success',
        {
          userId: testUser.id,
          ip: '192.168.1.100',
          userAgent: 'Test Agent'
        }
      );
      
      const status = securityFramework.auditLogger.getStatus();
      expect(status.metrics.eventsLogged).toBeGreaterThan(0);
    });
    
    test('should generate audit summary', async () => {
      const timeframe = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
        end: new Date()
      };
      
      const summary = await securityFramework.auditLogger.generateSummary(timeframe);
      
      expect(summary.timeframe).toEqual(timeframe);
      expect(summary.totalEvents).toBeDefined();
      expect(summary.metrics).toBeDefined();
    });
  });

  describe('Compliance Reporting', () => {
    test('should generate comprehensive compliance report', async () => {
      const timeframe = {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        end: new Date()
      };
      
      const report = await securityFramework.generateComplianceReport(timeframe);
      
      expect(report.timeframe).toEqual(timeframe);
      expect(report.securityMetrics).toBeDefined();
      expect(report.complianceStatus).toBeDefined();
      expect(report.auditSummary).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.riskAssessment).toBeDefined();
    });
  });

  describe('Integration Security Scenarios', () => {
    test('should handle complete secure workflow', async () => {
      // 1. Secure template generation with sensitive data
      const template = {
        name: 'customer-report',
        content: `
          <h1>Customer Report</h1>
          <p>Name: {{customerName}}</p>
          <p>Email: {{customerEmail}}</p>
          <p>Account: {{accountNumber}}</p>
        `
      };
      
      const variables = {
        customerName: 'Jane Smith',
        customerEmail: 'jane.smith@example.com',
        accountNumber: 'ACC-789123'
      };
      
      const templateResult = await securityFramework.secureTemplateGeneration(
        template,
        variables,
        testAdmin
      );
      
      expect(templateResult.secured).toBe(true);
      
      // 2. Secure file operation
      const fileResult = await securityFramework.secureFileOperation(
        'write',
        '/src/reports/customer-report.html',
        'Generated report content',
        testAdmin
      );
      
      expect(fileResult.secured).toBe(true);
      
      // 3. Verify audit trail
      const auditStatus = securityFramework.auditLogger.getStatus();
      expect(auditStatus.metrics.eventsLogged).toBeGreaterThan(0);
    });
    
    test('should demonstrate enterprise governance workflow', async () => {
      // 1. Request waiver for emergency operation
      const waiverRequest = {
        requestedBy: testAdmin.id,
        ruleId: 'data_retention_rule',
        reason: 'emergency',
        justification: 'Critical system maintenance requires temporary policy override',
        operationContext: {
          operation: 'emergency_data_export',
          urgency: 'critical'
        }
      };
      
      const waiver = await securityFramework.governanceEngine.requestWaiver(waiverRequest);
      expect(waiver.status).toBe('APPROVED'); // Should be auto-approved for emergency
      
      // 2. Generate governance report
      const governanceReport = await securityFramework.governanceEngine.generateGovernanceReport({
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date()
      });
      
      expect(governanceReport.summary).toBeDefined();
      expect(governanceReport.domainAnalysis).toBeDefined();
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle multiple concurrent security operations', async () => {
      const operations = [];
      const operationCount = 10;
      
      for (let i = 0; i < operationCount; i++) {
        operations.push(
          securityFramework.secureOperation(
            'template_read',
            { type: 'template', id: `template-${i}` },
            testUser
          )
        );
      }
      
      const results = await Promise.all(operations);
      
      expect(results.length).toBe(operationCount);
      results.forEach(result => {
        expect(result.secured).toBe(true);
      });
    });
    
    test('should maintain performance under load', async () => {
      const startTime = Date.now();
      
      // Perform 50 security validations
      const operations = Array.from({ length: 50 }, (_, i) =>
        securityFramework.secureOperation(
          'data_read',
          { type: 'data', id: `record-${i}` },
          testUser
        )
      );
      
      await Promise.all(operations);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (< 5 seconds)
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle invalid user gracefully', async () => {
      const invalidUser = null;
      
      await expect(
        securityFramework.secureOperation(
          'template_read',
          { type: 'template', id: 'test' },
          invalidUser
        )
      ).rejects.toThrow(/authentication required/i);
    });
    
    test('should handle malformed data gracefully', async () => {
      await expect(
        securityFramework.cryptoService.encryptSensitiveData(
          null,
          { classification: 'CONFIDENTIAL' }
        )
      ).rejects.toThrow(/cannot be empty/i);
    });
    
    test('should maintain security during error conditions', async () => {
      // Even with errors, audit logging should continue
      try {
        await securityFramework.secureOperation(
          'invalid_operation',
          { type: 'invalid' },
          testUser
        );
      } catch (error) {
        // Expected to fail
      }
      
      const auditStatus = securityFramework.auditLogger.getStatus();
      expect(auditStatus.status).toBe('ready');
    });
  });
});