/**
 * Unit Tests for Security Components
 * 
 * Individual component testing for security modules
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { SecurityManager } from '../../../../packages/kgen-core/src/security/core/security-manager.js';
import { RBACManager } from '../../../../packages/kgen-core/src/security/rbac/manager.js';
import { PolicyEngine } from '../../../../packages/kgen-core/src/security/policies/engine.js';
import { ComplianceFramework } from '../../../../packages/kgen-core/src/security/compliance/framework.js';
import { AuditLogger } from '../../../../packages/kgen-core/src/security/audit/logger.js';
import { CryptoService } from '../../../../packages/kgen-core/src/security/crypto/service.js';
import { ValidationEngine } from '../../../../packages/kgen-core/src/security/validation/engine.js';
import { GovernanceEngine } from '../../../../packages/kgen-core/src/security/governance/engine.js';

describe('Security Manager', () => {
  let securityManager;
  
  beforeEach(async () => {
    securityManager = new SecurityManager({
      jwt: {
        secret: 'test-secret-key-for-unit-testing-security-manager-component'
      }
    });
    await securityManager.initialize();
  });
  
  afterEach(async () => {
    await securityManager.shutdown();
  });
  
  test('should initialize successfully', () => {
    expect(securityManager.getStatus().status).toBe('ready');
  });
  
  test('should authenticate valid credentials', async () => {
    const credentials = {
      username: 'admin',
      password: 'admin'
    };
    
    const context = {
      ip: '127.0.0.1',
      userAgent: 'Test Agent'
    };
    
    const result = await securityManager.authenticate(credentials, context);
    
    expect(result.sessionId).toBeDefined();
    expect(result.user.username).toBe('admin');
  });
  
  test('should reject invalid credentials', async () => {
    const credentials = {
      username: 'invalid',
      password: 'wrong'
    };
    
    await expect(
      securityManager.authenticate(credentials, {})
    ).rejects.toThrow(/invalid credentials/i);
  });
  
  test('should generate and verify tokens', async () => {
    const payload = {
      userId: 'test-user',
      roles: ['user']
    };
    
    const token = securityManager.generateToken(payload);
    expect(token).toBeDefined();
    
    const decoded = securityManager.verifyToken(token);
    expect(decoded.userId).toBe('test-user');
  });
});

describe('RBAC Manager', () => {
  let rbacManager;
  
  beforeEach(async () => {
    rbacManager = new RBACManager();
    await rbacManager.initialize();
  });
  
  afterEach(async () => {
    await rbacManager.shutdown();
  });
  
  test('should create and manage roles', async () => {
    const roleDefinition = {
      name: 'Test Role',
      description: 'A test role',
      permissions: ['test:read', 'test:write']
    };
    
    const role = await rbacManager.createRole(roleDefinition);
    
    expect(role.id).toBeDefined();
    expect(role.name).toBe('Test Role');
    expect(role.permissions).toContain('test:read');
  });
  
  test('should assign and revoke roles', async () => {
    const userId = 'test-user-123';
    const roleId = 'user'; // Default role
    
    const assignment = await rbacManager.assignRole(userId, roleId);
    expect(assignment.roleId).toBe(roleId);
    
    const revocation = await rbacManager.revokeRole(userId, roleId);
    expect(revocation.roleId).toBe(roleId);
  });
  
  test('should authorize user access', async () => {
    const user = {
      id: 'test-user',
      roles: ['user'],
      sessionId: 'session-123'
    };
    
    const resource = {
      type: 'template',
      id: 'test-template'
    };
    
    // Create a valid session for the test
    rbacManager.sessions.set('session-123', {
      sessionId: 'session-123',
      userId: user.id,
      createdAt: this.getDeterministicDate(),
      expiresAt: new Date(this.getDeterministicTimestamp() + 3600000)
    });
    
    const authResult = await rbacManager.authorize(user, 'read', resource);
    expect(authResult.authorized).toBe(true);
  });
});

describe('Policy Engine', () => {
  let policyEngine;
  
  beforeEach(async () => {
    policyEngine = new PolicyEngine();
    await policyEngine.initialize();
  });
  
  afterEach(async () => {
    await policyEngine.shutdown();
  });
  
  test('should evaluate policies correctly', async () => {
    const securityContext = {
      operationType: 'template_generation',
      user: { id: 'test-user' },
      context: { template: { content: '<h1>Safe content</h1>' } }
    };
    
    const result = await policyEngine.evaluateOperation(securityContext);
    
    expect(result.compliant).toBeDefined();
    expect(result.appliedPolicies).toBeInstanceOf(Array);
  });
  
  test('should detect policy violations', async () => {
    const violationContext = {
      operationType: 'template_generation',
      user: { id: 'test-user' },
      context: {
        template: {
          content: '<script>alert("XSS")</script>'
        }
      }
    };
    
    const result = await policyEngine.evaluateOperation(violationContext);
    
    expect(result.compliant).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });
});

describe('Compliance Framework', () => {
  let complianceFramework;
  
  beforeEach(async () => {
    complianceFramework = new ComplianceFramework({
      enabledFrameworks: ['GDPR', 'SOX']
    });
    await complianceFramework.initialize();
  });
  
  afterEach(async () => {
    await complianceFramework.shutdown();
  });
  
  test('should validate GDPR compliance', async () => {
    const securityContext = {
      operationType: 'data_processing',
      user: { id: 'test-user' },
      context: {
        personalData: true,
        legalBasis: 'consent',
        consentId: 'consent-123'
      }
    };
    
    const result = await complianceFramework.validateOperation(securityContext);
    
    expect(result.compliant).toBe(true);
    expect(result.frameworks).toContainEqual(
      expect.objectContaining({ name: 'GDPR' })
    );
  });
  
  test('should perform compliance assessment', async () => {
    const assessment = await complianceFramework.performAssessment('GDPR');
    
    expect(assessment.framework).toBe('GDPR');
    expect(assessment.score).toBeGreaterThanOrEqual(0);
    expect(assessment.requirementsMet).toBeGreaterThanOrEqual(0);
  });
});

describe('Audit Logger', () => {
  let auditLogger;
  
  beforeEach(async () => {
    auditLogger = new AuditLogger({
      auditPath: './test-logs/audit'
    });
    await auditLogger.initialize();
  });
  
  afterEach(async () => {
    await auditLogger.shutdown();
  });
  
  test('should log security events', async () => {
    const eventId = await auditLogger.logSecurityEvent(
      'AUTHENTICATION',
      'login_attempt',
      {
        userId: 'test-user',
        ip: '127.0.0.1',
        success: true
      }
    );
    
    expect(eventId).toBeDefined();
    
    const status = auditLogger.getStatus();
    expect(status.metrics.eventsLogged).toBeGreaterThan(0);
  });
  
  test('should generate audit summary', async () => {
    // Log some events first
    await auditLogger.logSecurityEvent('AUTHENTICATION', 'login', { userId: 'user1' });
    await auditLogger.logSecurityEvent('AUTHORIZATION', 'access_granted', { userId: 'user1' });
    
    const timeframe = {
      start: new Date(this.getDeterministicTimestamp() - 60000), // 1 minute ago
      end: this.getDeterministicDate()
    };
    
    const summary = await auditLogger.generateSummary(timeframe);
    
    expect(summary.timeframe).toEqual(timeframe);
    expect(summary.metrics).toBeDefined();
  });
});

describe('Crypto Service', () => {
  let cryptoService;
  
  beforeEach(async () => {
    cryptoService = new CryptoService();
    await cryptoService.initialize();
  });
  
  afterEach(async () => {
    await cryptoService.shutdown();
  });
  
  test('should encrypt and decrypt data', async () => {
    const originalData = { message: 'This is sensitive data' };
    
    const encrypted = await cryptoService.encryptSensitiveData(originalData);
    expect(encrypted.encrypted.data).toBeDefined();
    expect(encrypted.encrypted.keyId).toBeDefined();
    
    const decrypted = await cryptoService.decryptSensitiveData(encrypted.encrypted);
    expect(decrypted.data).toEqual(originalData);
  });
  
  test('should classify data sensitivity', async () => {
    const testData = {
      name: 'John Doe',
      email: 'john@example.com',
      ssn: '123-45-6789'
    };
    
    const classification = await cryptoService.classifyData(testData);
    
    expect(classification.level).toBe('CONFIDENTIAL');
    expect(classification.categories).toContain('PII');
  });
  
  test('should generate and manage keys', async () => {
    const keyResult = await cryptoService.generateKey('data');
    
    expect(keyResult.keyId).toBeDefined();
    expect(keyResult.metadata.type).toBe('data');
  });
});

describe('Validation Engine', () => {
  let validationEngine;
  
  beforeEach(async () => {
    validationEngine = new ValidationEngine();
    await validationEngine.initialize();
  });
  
  afterEach(async () => {
    await validationEngine.shutdown();
  });
  
  test('should validate safe templates', async () => {
    const safeTemplate = {
      name: 'safe-template',
      content: '<h1>{{title}}</h1><p>{{content}}</p>'
    };
    
    const result = await validationEngine.validateTemplate(safeTemplate);
    
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });
  
  test('should detect unsafe templates', async () => {
    const unsafeTemplate = {
      name: 'unsafe-template',
      content: '<script>alert("XSS")</script><h1>{{title}}</h1>'
    };
    
    const result = await validationEngine.validateTemplate(unsafeTemplate);
    
    expect(result.valid).toBe(false);
    expect(result.securityIssues.length).toBeGreaterThan(0);
  });
  
  test('should validate file paths', async () => {
    const safePath = '/src/templates/example.njk';
    const result = await validationEngine.validateFilePath(safePath);
    
    expect(result.valid).toBe(true);
    
    const unsafePath = '../../../etc/passwd';
    const unsafeResult = await validationEngine.validateFilePath(unsafePath);
    
    expect(unsafeResult.valid).toBe(false);
    expect(unsafeResult.securityIssues.length).toBeGreaterThan(0);
  });
});

describe('Governance Engine', () => {
  let governanceEngine;
  
  beforeEach(async () => {
    governanceEngine = new GovernanceEngine();
    await governanceEngine.initialize();
  });
  
  afterEach(async () => {
    await governanceEngine.shutdown();
  });
  
  test('should validate governance rules', async () => {
    const securityContext = {
      operationType: 'data_export',
      user: { id: 'test-user', roles: ['admin'] },
      context: { dataType: 'customer_data' }
    };
    
    const result = await governanceEngine.validateOperation(securityContext);
    
    expect(result.valid).toBeDefined();
    expect(result.violations).toBeInstanceOf(Array);
  });
  
  test('should create governance rules', async () => {
    const ruleDefinition = {
      name: 'Test Governance Rule',
      domain: 'data_governance',
      type: 'data_access',
      conditions: [
        {
          field: 'data.classification',
          operator: 'equals',
          value: 'CONFIDENTIAL'
        }
      ],
      actions: [
        {
          type: 'require_approval',
          parameters: { approverRoles: ['data_steward'] }
        }
      ],
      severity: 'HIGH'
    };
    
    const rule = await governanceEngine.createGovernanceRule(ruleDefinition);
    
    expect(rule.id).toBeDefined();
    expect(rule.name).toBe('Test Governance Rule');
  });
  
  test('should handle waiver requests', async () => {
    const waiverRequest = {
      requestedBy: 'test-user',
      ruleId: 'test-rule',
      reason: 'emergency',
      justification: 'Critical system maintenance'
    };
    
    const waiver = await governanceEngine.requestWaiver(waiverRequest);
    
    expect(waiver.id).toBeDefined();
    expect(waiver.status).toBeDefined();
  });
});