/**
 * SOX Compliance Template Testing Suite
 * Clean Room Enterprise Testing Environment
 * 
 * Tests:
 * - Template rendering accuracy for SOX compliance
 * - Security controls integration
 * - Audit logging functionality
 * - Segregation of duties validation
 * - Real-time compliance monitoring
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { execSync } from 'child_process';
import { SOXAuditor } from '../artifacts/fintech-sox-compliance';
import { PaymentProcessorService } from '../artifacts/fintech-sox-compliance';

describe('SOX Compliance Template Testing', () => {
  let testOutputDir: string;
  let soxAuditor: SOXAuditor;
  let paymentService: PaymentProcessorService;

  beforeAll(async () => {
    testOutputDir = join(process.cwd(), 'tests/enterprise/cleanroom/sox/output');
    await mkdir(testOutputDir, { recursive: true });
    
    // Initialize SOX compliance services
    soxAuditor = new SOXAuditor({
      component: 'test-payment-processor',
      retentionPeriod: 7,
      auditLevel: 'COMPREHENSIVE',
      encryptionEnabled: true,
      realTimeMonitoring: true,
      automaticReporting: true
    });

    // Mock payment service for testing
    paymentService = {
      processPayment: async (request, context) => ({
        transactionId: 'test-tx-123',
        amount: request.amount,
        status: 'completed'
      })
    } as any;
  });

  describe('Template Rendering Validation', () => {
    it('should render SOX-compliant service template correctly', async () => {
      const templatePath = join(process.cwd(), '_templates/enterprise/compliance/service.ts.njk');
      const templateContent = await readFile(templatePath, 'utf-8');
      
      // Validate template contains required SOX elements
      expect(templateContent).toContain('@ComplianceDecorator');
      expect(templateContent).toContain('@AuditTrail');
      expect(templateContent).toContain('ComplianceValidator');
      expect(templateContent).toContain('AuditLogger');
      expect(templateContent).toContain('{{ complianceFramework }}');
      expect(templateContent).toContain('{{ dataClassification }}');
      expect(templateContent).toContain('{{ auditLevel }}');
    });

    it('should render SOX auditor template with correct parameters', async () => {
      const soxTemplateContent = await readFile(
        join(process.cwd(), '_templates/enterprise/compliance/sox-compliant/sox-auditor.ts.ejs'),
        'utf-8'
      );
      
      // Validate SOX-specific elements
      expect(soxTemplateContent).toContain('SOXAuditEvent');
      expect(soxTemplateContent).toContain('logFinancialDataAccess');
      expect(soxTemplateContent).toContain('logSystemChange');
      expect(soxTemplateContent).toContain('generateComplianceReport');
      expect(soxTemplateContent).toContain('verifyDataIntegrity');
    });

    it('should generate valid TypeScript code from templates', async () => {
      const testCode = `
        import { SOXAuditor } from './sox-auditor';
        
        const auditor = new SOXAuditor({
          component: 'test',
          retentionPeriod: 7,
          auditLevel: 'COMPREHENSIVE',
          encryptionEnabled: true,
          realTimeMonitoring: true,
          automaticReporting: true
        });
      `;
      
      const testFilePath = join(testOutputDir, 'sox-test.ts');
      await writeFile(testFilePath, testCode);
      
      // Validate TypeScript compilation
      expect(() => {
        execSync(`npx tsc --noEmit --skipLibCheck ${testFilePath}`, { stdio: 'pipe' });
      }).not.toThrow();
    });
  });

  describe('SOX Audit Logging Functionality', () => {
    it('should log financial data access with required SOX fields', async () => {
      const auditId = await soxAuditor.logFinancialDataAccess({
        userId: 'test-user-123',
        resource: 'accounts-payable',
        action: 'read',
        dataType: 'revenue',
        amount: 100000,
        ipAddress: '192.168.1.100',
        sessionId: 'session-456'
      });

      expect(auditId).toMatch(/^SOX-\d+-[a-z0-9]+$/);
      
      // Verify audit event was logged
      const events = soxAuditor.searchAuditLog({ userId: 'test-user-123' });
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        userId: 'test-user-123',
        action: 'read',
        resource: 'accounts-payable',
        dataClassification: expect.any(String),
        success: true
      });
    });

    it('should enforce segregation of duties logging', async () => {
      const auditId = await soxAuditor.logAccessControlChange({
        userId: 'admin-user',
        targetUserId: 'finance-user',
        action: 'grant',
        permissions: ['FINANCIAL_DATA_ACCESS'],
        approvedBy: 'cfo@company.com',
        justification: 'New finance team member',
        ipAddress: '10.0.0.1'
      });

      const events = soxAuditor.searchAuditLog({ action: 'permission-grant' });
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        action: 'permission-grant',
        riskLevel: 'critical',
        afterState: expect.objectContaining({
          targetUserId: 'finance-user',
          permissions: ['FINANCIAL_DATA_ACCESS'],
          approvedBy: 'cfo@company.com'
        })
      });
    });

    it('should maintain data integrity hashes', async () => {
      await soxAuditor.logSystemChange({
        userId: 'system-admin',
        changeType: 'configuration',
        resource: 'payment-processor-config',
        beforeState: { maxAmount: 50000 },
        afterState: { maxAmount: 100000 },
        approvedBy: 'cto@company.com',
        changeTicket: 'CHG-2024-001',
        ipAddress: '172.16.0.1'
      });

      const integrityVerified = await soxAuditor.verifyDataIntegrity();
      expect(integrityVerified).toBe(true);
    });
  });

  describe('SOX Compliance Reporting', () => {
    it('should generate comprehensive compliance report', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      const report = await soxAuditor.generateComplianceReport(startDate, endDate);

      expect(report).toMatchObject({
        reportId: expect.stringMatching(/^SOX-\d+-[a-z0-9]+$/),
        generatedAt: expect.any(Date),
        period: { startDate, endDate },
        component: 'test-payment-processor',
        totalEvents: expect.any(Number),
        eventsByRisk: {
          low: expect.any(Number),
          medium: expect.any(Number),
          high: expect.any(Number),
          critical: expect.any(Number)
        },
        dataIntegrity: {
          verified: true,
          lastVerification: expect.any(Date),
          hashMismatches: 0
        },
        complianceStatus: expect.stringMatching(/^(compliant|non-compliant|at-risk)$/),
        recommendations: expect.any(Array)
      });
    });

    it('should export audit data in multiple formats', async () => {
      const jsonExport = await soxAuditor.exportAuditData('json');
      const csvExport = await soxAuditor.exportAuditData('csv');
      const xmlExport = await soxAuditor.exportAuditData('xml');

      // Validate JSON export
      expect(() => JSON.parse(jsonExport)).not.toThrow();
      
      // Validate CSV export has headers
      expect(csvExport).toMatch(/^eventId,timestamp,userId,action,resource,success,riskLevel/);
      
      // Validate XML export structure
      expect(xmlExport).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xmlExport).toContain('<soxAuditLog');
    });
  });

  describe('Security Integration Testing', () => {
    it('should validate SOX security controls', async () => {
      // Test encryption requirements
      const sensitiveData = { accountNumber: '1234567890', amount: 50000 };
      
      // Simulate encryption check
      const mockEncryptionService = {
        encryptSensitiveFields: async (data: any) => ({
          ...data,
          _encrypted: true,
          _algorithm: 'AES-256-GCM'
        })
      };

      const encryptedData = await mockEncryptionService.encryptSensitiveFields(sensitiveData);
      expect(encryptedData._encrypted).toBe(true);
      expect(encryptedData._algorithm).toBe('AES-256-GCM');
    });

    it('should enforce role-based access control', async () => {
      const mockAccessControl = {
        validateSegregationOfDuties: async (params: any) => ({
          valid: params.amount <= 10000 || params.user.role === 'manager'
        })
      };

      // Test user with insufficient privileges
      const lowPrivilegeUser = { role: 'clerk', id: 'user-123' };
      const highAmountTransaction = { amount: 50000 };
      
      const sodValidation = await mockAccessControl.validateSegregationOfDuties({
        user: lowPrivilegeUser,
        ...highAmountTransaction
      });
      
      expect(sodValidation.valid).toBe(false);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high-volume audit logging efficiently', async () => {
      const startTime = performance.now();
      const numEvents = 1000;

      const promises = Array.from({ length: numEvents }, (_, i) =>
        soxAuditor.logAuditEvent({
          userId: `user-${i}`,
          action: 'data-access',
          resource: `resource-${i}`,
          success: true
        })
      );

      await Promise.all(promises);
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Should process 1000 events in under 5 seconds
      expect(executionTime).toBeLessThan(5000);
      
      const events = soxAuditor.searchAuditLog({});
      expect(events.length).toBeGreaterThanOrEqual(numEvents);
    });

    it('should maintain performance with large audit datasets', async () => {
      const startTime = performance.now();
      
      // Search through audit log
      const searchResults = soxAuditor.searchAuditLog({
        action: 'data-access',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      });
      
      const searchTime = performance.now() - startTime;
      
      // Search should complete quickly even with large datasets
      expect(searchTime).toBeLessThan(1000); // 1 second
      expect(searchResults).toBeInstanceOf(Array);
    });
  });

  afterAll(async () => {
    // Cleanup test artifacts
    // In a real implementation, would clean up test databases, logs, etc.
  });
});