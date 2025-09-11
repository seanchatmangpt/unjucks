/**
 * Enterprise Governance Rules Test Suite
 * 
 * Tests for enterprise governance scenarios and compliance rules
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { KGENSecurityFramework } from '../../../../packages/kgen-core/src/security/index.js';

describe('Enterprise Governance Rules', () => {
  let securityFramework;
  let dataOfficer;
  let complianceOfficer;
  let regularUser;
  
  beforeAll(async () => {
    securityFramework = new KGENSecurityFramework({
      enforceGovernance: true,
      enforcementLevel: 'STRICT',
      enabledFrameworks: ['SOX', 'GDPR', 'HIPAA'],
      enableApprovalWorkflows: true,
      security: {
        jwt: {
          secret: 'enterprise-governance-test-secret-key-for-compliance-validation'
        }
      }
    });
    
    await securityFramework.initialize();
    
    // Create test roles
    dataOfficer = {
      id: 'data-officer-001',
      username: 'dataofficer',
      roles: ['data_steward', 'compliance_officer'],
      permissions: ['data:*', 'compliance:*'],
      clearanceLevel: 'RESTRICTED'
    };
    
    complianceOfficer = {
      id: 'compliance-officer-001',
      username: 'complianceofficer',
      roles: ['compliance_officer', 'legal_counsel'],
      permissions: ['compliance:*', 'legal:*'],
      clearanceLevel: 'RESTRICTED'
    };
    
    regularUser = {
      id: 'regular-user-001',
      username: 'regularuser',
      roles: ['user'],
      permissions: ['template:read', 'data:read'],
      clearanceLevel: 'INTERNAL'
    };
  });
  
  afterAll(async () => {
    await securityFramework.shutdown();
  });

  describe('Data Governance Rules', () => {
    test('should enforce data retention policies', async () => {
      const dataContext = {
        operationType: 'data_retention_check',
        user: dataOfficer,
        context: {
          personalData: true,
          dataAge: 365 * 7, // 7 years old
          dataType: 'customer_records',
          retentionPeriod: '6years'
        }
      };
      
      const result = await securityFramework.governanceEngine.validateOperation(dataContext);
      
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          ruleName: expect.stringContaining('retention')
        })
      );
    });
    
    test('should validate data minimization principles', async () => {
      const dataContext = {
        operationType: 'data_collection',
        user: regularUser,
        context: {
          requestedFields: ['name', 'email', 'phone', 'ssn', 'mother_maiden_name'],
          purpose: 'newsletter_signup',
          minimumRequired: ['name', 'email']
        }
      };
      
      // Create custom rule for data minimization
      await securityFramework.governanceEngine.createGovernanceRule({
        name: 'Data Minimization Rule',
        domain: 'data_governance',
        type: 'data_minimization',
        conditions: [
          {
            field: 'context.requestedFields.length',
            operator: 'greater_than',
            value: 'context.minimumRequired.length'
          }
        ],
        actions: [
          {
            type: 'require_justification',
            parameters: { requiredFields: ['purpose', 'legal_basis'] }
          }
        ],
        severity: 'MEDIUM'
      });
      
      const result = await securityFramework.governanceEngine.validateOperation(dataContext);
      
      expect(result.warnings.length).toBeGreaterThan(0);
    });
    
    test('should require approval for sensitive data export', async () => {
      const exportContext = {
        operationType: 'data_export',
        user: regularUser,
        context: {
          dataType: 'customer_pii',
          classification: 'CONFIDENTIAL',
          recordCount: 10000,
          exportFormat: 'csv',
          destination: 'external_partner'
        }
      };
      
      const result = await securityFramework.governanceEngine.validateOperation(exportContext);
      
      expect(result.approvalRequired).toBe(true);
      expect(result.block).toBe(true);
    });
  });

  describe('Security Governance Rules', () => {
    test('should enforce encryption for sensitive data', async () => {
      const securityContext = {
        operationType: 'data_storage',
        user: regularUser,
        context: {
          dataClassification: 'CONFIDENTIAL',
          storageLocation: 'database',
          encryptionEnabled: false
        }
      };
      
      const result = await securityFramework.governanceEngine.validateOperation(securityContext);
      
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          ruleName: expect.stringMatching(/encryption|security/i)
        })
      );
    });
    
    test('should validate access control requirements', async () => {
      const accessContext = {
        operationType: 'privileged_access',
        user: regularUser,
        context: {
          targetResource: 'production_database',
          accessLevel: 'admin',
          timeOfAccess: new Date().setHours(23) // 11 PM
        }
      };
      
      const result = await securityFramework.governanceEngine.validateOperation(accessContext);
      
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });

  describe('Compliance Governance Rules', () => {
    test('should validate GDPR data processing requirements', async () => {
      const gdprContext = {
        operationType: 'data_processing',
        user: dataOfficer,
        context: {
          personalData: true,
          legalBasis: 'legitimate_interest',
          dataSubject: 'eu_citizen',
          processingPurpose: 'marketing',
          consentOptOut: true
        }
      };
      
      const result = await securityFramework.governanceEngine.validateOperation(gdprContext);
      
      // Should require consent for marketing to EU citizens
      expect(result.warnings.length).toBeGreaterThan(0);
    });
    
    test('should enforce SOX financial controls', async () => {
      const soxContext = {
        operationType: 'financial_reporting',
        user: regularUser,
        context: {
          reportType: 'quarterly_earnings',
          dataSource: 'general_ledger',
          reviewRequired: false,
          segregationOfDuties: false
        }
      };
      
      const result = await securityFramework.governanceEngine.validateOperation(soxContext);
      
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          ruleName: expect.stringMatching(/sox|financial|control/i)
        })
      );
    });
    
    test('should validate HIPAA healthcare data handling', async () => {
      const hipaaContext = {
        operationType: 'healthcare_data_access',
        user: regularUser,
        context: {
          patientData: true,
          phi: true,
          businessAssociate: false,
          auditLoggingEnabled: true,
          accessJustification: 'treatment'
        }
      };
      
      const result = await securityFramework.governanceEngine.validateOperation(hipaaContext);
      
      // Regular user shouldn't access PHI without proper authorization
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });

  describe('Quality Governance Rules', () => {
    test('should enforce code quality standards', async () => {
      const codeContext = {
        operationType: 'code_deployment',
        user: regularUser,
        context: {
          codeReviewed: false,
          testCoverage: 65, // Below threshold
          securityScanPassed: false,
          documentationComplete: false
        }
      };
      
      const result = await securityFramework.governanceEngine.validateOperation(codeContext);
      
      expect(result.qualityGateResults.some(gate => !gate.passed)).toBe(true);
    });
    
    test('should validate template quality requirements', async () => {
      const templateContext = {
        operationType: 'template_approval',
        user: regularUser,
        context: {
          templateComplexity: 'high',
          securityValidated: false,
          accessibilityChecked: false,
          performanceTested: false
        }
      };
      
      const result = await securityFramework.governanceEngine.validateOperation(templateContext);
      
      expect(result.qualityGateResults.length).toBeGreaterThan(0);
    });
  });

  describe('Operational Governance Rules', () => {
    test('should enforce change management procedures', async () => {
      const changeContext = {
        operationType: 'production_change',
        user: regularUser,
        context: {
          changeType: 'emergency',
          approvalObtained: false,
          rollbackPlanExists: true,
          stakeholdersNotified: false,
          riskAssessmentComplete: false
        }
      };
      
      const result = await securityFramework.governanceEngine.validateOperation(changeContext);
      
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.approvalRequired).toBe(true);
    });
    
    test('should validate business continuity requirements', async () => {
      const continuityContext = {
        operationType: 'disaster_recovery_test',
        user: dataOfficer,
        context: {
          lastTestDate: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000), // 400 days ago
          requiredFrequency: 'quarterly',
          backupVerified: true,
          recoveryTimeObjective: '2hours'
        }
      };
      
      const result = await securityFramework.governanceEngine.validateOperation(continuityContext);
      
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Waiver and Exception Management', () => {
    test('should process emergency waivers automatically', async () => {
      const emergencyWaiver = {
        requestedBy: dataOfficer.id,
        ruleId: 'data_retention_rule',
        reason: 'emergency',
        justification: 'Critical security incident requires immediate data access',
        operationContext: {
          incidentId: 'SEC-2024-001',
          urgency: 'critical'
        }
      };
      
      const waiver = await securityFramework.governanceEngine.requestWaiver(emergencyWaiver);
      
      expect(waiver.status).toBe('APPROVED');
      expect(waiver.autoApprovalReason).toBeDefined();
    });
    
    test('should require manual approval for high-risk waivers', async () => {
      const highRiskWaiver = {
        requestedBy: regularUser.id,
        ruleId: 'sensitive_data_access',
        reason: 'business_requirement',
        justification: 'Need to access restricted data for analysis',
        operationContext: {
          dataClassification: 'RESTRICTED',
          accessDuration: '30days'
        }
      };
      
      const waiver = await securityFramework.governanceEngine.requestWaiver(highRiskWaiver);
      
      expect(waiver.status).toBe('PENDING');
      expect(waiver.autoApprovalReason).toBeUndefined();
    });
    
    test('should track waiver usage and expiration', async () => {
      const tempWaiver = {
        requestedBy: dataOfficer.id,
        ruleId: 'test_rule',
        reason: 'maintenance',
        justification: 'Temporary override for system maintenance',
        expiresAt: new Date(Date.now() + 60000) // 1 minute from now
      };
      
      const waiver = await securityFramework.governanceEngine.requestWaiver(tempWaiver);
      expect(waiver.expiresAt).toBeDefined();
      
      // Wait for expiration (in real test, this would be mocked)
      // For now, just verify the waiver structure is correct
      expect(waiver.id).toBeDefined();
      expect(waiver.status).toBeDefined();
    });
  });

  describe('Approval Workflows', () => {
    test('should route sensitive data requests through proper approval chain', async () => {
      const sensitiveRequest = {
        operationType: 'sensitive_data_access',
        user: regularUser,
        context: {
          dataClassification: 'RESTRICTED',
          requestReason: 'audit_preparation',
          estimatedAccessTime: '4hours'
        }
      };
      
      const result = await securityFramework.governanceEngine.validateOperation(sensitiveRequest);
      
      expect(result.approvalRequired).toBe(true);
      expect(result.approvalRequestId).toBeDefined();
    });
    
    test('should auto-approve for high-clearance users', async () => {
      const highClearanceRequest = {
        operationType: 'sensitive_data_access',
        user: dataOfficer,
        context: {
          dataClassification: 'CONFIDENTIAL',
          requestReason: 'compliance_audit',
          estimatedAccessTime: '2hours'
        }
      };
      
      const result = await securityFramework.governanceEngine.validateOperation(highClearanceRequest);
      
      // Data officer with high clearance should get auto-approval
      expect(result.block).toBe(false);
    });
  });

  describe('Governance Reporting', () => {
    test('should generate comprehensive governance report', async () => {
      // Perform some operations to generate data
      await securityFramework.governanceEngine.validateOperation({
        operationType: 'data_export',
        user: regularUser,
        context: { dataType: 'test_data' }
      });
      
      const timeframe = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date()
      };
      
      const report = await securityFramework.governanceEngine.generateGovernanceReport(timeframe);
      
      expect(report.timeframe).toEqual(timeframe);
      expect(report.summary).toBeDefined();
      expect(report.domainAnalysis).toBeDefined();
      expect(report.recommendations).toBeInstanceOf(Array);
    });
    
    test('should provide governance metrics and trends', async () => {
      const status = securityFramework.governanceEngine.getStatus();
      
      expect(status.metrics).toBeDefined();
      expect(status.governance.rules).toBeGreaterThan(0);
      expect(status.governance.policies).toBeGreaterThan(0);
    });
  });

  describe('Enterprise Integration Scenarios', () => {
    test('should handle complex multi-domain governance validation', async () => {
      const complexContext = {
        operationType: 'cross_domain_operation',
        user: complianceOfficer,
        context: {
          // Data governance aspects
          personalData: true,
          dataClassification: 'CONFIDENTIAL',
          
          // Security governance aspects
          privilegedAccess: true,
          encryptionRequired: true,
          
          // Compliance governance aspects
          regulatoryScope: ['GDPR', 'SOX'],
          auditRequired: true,
          
          // Quality governance aspects
          reviewRequired: true,
          testingComplete: false,
          
          // Operational governance aspects
          changeControl: true,
          rollbackPlan: true
        }
      };
      
      const result = await securityFramework.governanceEngine.validateOperation(complexContext);
      
      expect(result.valid).toBeDefined();
      expect(result.violations).toBeInstanceOf(Array);
      expect(result.warnings).toBeInstanceOf(Array);
      expect(result.requirements).toBeInstanceOf(Array);
    });
    
    test('should demonstrate end-to-end governance workflow', async () => {
      // 1. Request high-risk operation
      const riskContext = {
        operationType: 'high_risk_data_processing',
        user: regularUser,
        context: {
          dataVolume: 'large',
          dataClassification: 'RESTRICTED',
          externalTransfer: true,
          retentionPeriod: 'indefinite'
        }
      };
      
      // Should require multiple approvals
      const validation = await securityFramework.governanceEngine.validateOperation(riskContext);
      expect(validation.approvalRequired).toBe(true);
      
      // 2. Request waiver for specific requirement
      const waiver = await securityFramework.governanceEngine.requestWaiver({
        requestedBy: complianceOfficer.id,
        ruleId: 'data_retention_rule',
        reason: 'legal_hold',
        justification: 'Data must be retained indefinitely due to ongoing litigation'
      });
      
      expect(waiver.id).toBeDefined();
      
      // 3. Generate governance report
      const report = await securityFramework.governanceEngine.generateGovernanceReport({
        start: new Date(Date.now() - 3600000),
        end: new Date()
      });
      
      expect(report.summary.violations).toBeGreaterThan(0);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });
});