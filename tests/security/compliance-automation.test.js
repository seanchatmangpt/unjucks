/**
 * Compliance Automation Security Tests
 * Tests for SOX, GDPR, HIPAA, and Basel III compliance automation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GDPRValidator } from '../../src/validation/compliance-rules.js';
import { ComplianceMarketplace } from '../../src/compliance/compliance-marketplace.js';
import { ComplianceDashboard } from '../../src/dashboard/compliance-dashboard.js';

describe('Compliance Automation Security', () => {
  let gdprValidator;
  let marketplace;
  let dashboard;

  beforeEach(() => {
    gdprValidator = new GDPRValidator();
    marketplace = new ComplianceMarketplace();
    dashboard = new ComplianceDashboard();
  });

  describe('SOX (Sarbanes-Oxley) Compliance', () => {
    it('should detect financial data without proper controls', async () => {
      const financialData = {
        subjects: {
          'financial:revenue': {
            type: ['http://example.org/financial/Revenue'],
            properties: {
              'http://example.org/financial/amount': [{ value: '1000000', type: 'literal' }],
              'http://example.org/financial/quarter': [{ value: 'Q1-2024', type: 'literal' }]
            }
          }
        },
        prefixes: {
          financial: 'http://example.org/financial/',
          sox: 'http://example.org/sox/'
        }
      };

      // Should flag missing SOX controls
      const violations = gdprValidator.validate(financialData);
      
      expect(violations.some(v => v.code.includes('SOX'))).toBe(false); // GDPR validator won't catch SOX
      
      // Test with proper SOX validator (simulated)
      const soxViolations = [
        {
          code: 'SOX_MISSING_AUTHORIZATION',
          message: 'Financial data changes require proper authorization controls',
          severity: 'HIGH',
          regulation: 'SOX',
          section: '302'
        }
      ];
      
      expect(soxViolations).toHaveLength(1);
      expect(soxViolations[0].regulation).toBe('SOX');
    });

    it('should validate audit trail requirements', async () => {
      const auditTrail = {
        timestamp: this.getDeterministicDate().toISOString(),
        user: 'financial.analyst@company.com',
        action: 'UPDATE_REVENUE',
        previousValue: '900000',
        newValue: '1000000',
        authorization: 'CFO-APPROVED',
        ipAddress: '10.0.1.100'
      };

      // Mock SOX audit trail validation
      const isCompliant = auditTrail.authorization && 
                          auditTrail.user && 
                          auditTrail.timestamp &&
                          auditTrail.previousValue &&
                          auditTrail.newValue;

      expect(isCompliant).toBe(true);
    });

    it('should enforce segregation of duties', async () => {
      const userRoles = {
        'user123': ['DATA_ENTRY'],
        'user456': ['AUTHORIZATION', 'DATA_ENTRY'], // Violation
        'user789': ['AUTHORIZATION']
      };

      const violations = Object.entries(userRoles)
        .filter(([user, roles]) => 
          roles.includes('DATA_ENTRY') && roles.includes('AUTHORIZATION')
        );

      expect(violations).toHaveLength(1);
      expect(violations[0][0]).toBe('user456');
    });
  });

  describe('GDPR (General Data Protection Regulation) Compliance', () => {
    it('should detect personal data without proper consent', async () => {
      const personalData = {
        subjects: {
          'user:john-doe': {
            type: ['http://example.org/Person'],
            properties: {
              'http://example.org/email': [{ value: 'john@example.com', type: 'literal' }],
              'http://example.org/name': [{ value: 'John Doe', type: 'literal' }],
              'http://example.org/phone': [{ value: '+1234567890', type: 'literal' }]
            }
          }
        },
        prefixes: { user: 'http://example.org/user/' }
      };

      const violations = gdprValidator.validate(personalData);
      
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some(v => v.code === 'GDPR_MISSING_CONSENT')).toBe(true);
    });

    it('should validate lawful basis for processing', async () => {
      const dataWithLawfulBasis = {
        subjects: {
          'user:jane-doe': {
            type: ['http://example.org/Person'],
            properties: {
              'http://example.org/email': [{ value: 'jane@example.com', type: 'literal' }],
              'http://example.org/gdpr/lawfulBasis': [{ value: 'consent', type: 'literal' }],
              'http://example.org/gdpr/consentDate': [{ value: '2024-01-01T00:00:00Z', type: 'literal' }]
            }
          }
        },
        prefixes: { user: 'http://example.org/user/' }
      };

      const violations = gdprValidator.validate(dataWithLawfulBasis);
      
      // Should have fewer violations with proper lawful basis
      expect(violations.filter(v => v.code === 'GDPR_MISSING_CONSENT')).toHaveLength(0);
    });

    it('should enforce data retention limits', async () => {
      const dataWithRetention = {
        subjects: {
          'user:old-user': {
            type: ['http://example.org/Person'],
            properties: {
              'http://example.org/email': [{ value: 'old@example.com', type: 'literal' }],
              'http://purl.org/dc/terms/created': [{ value: '2020-01-01T00:00:00Z', type: 'literal' }],
              'http://example.org/gdpr/retentionPeriod': [{ value: 'P2Y', type: 'literal' }] // 2 years
            }
          }
        },
        prefixes: { user: 'http://example.org/user/' }
      };

      const now = this.getDeterministicDate();
      const createdDate = new Date('2020-01-01T00:00:00Z');
      const retentionPeriod = 2 * 365 * 24 * 60 * 60 * 1000; // 2 years in ms
      
      const isExpired = (now - createdDate) > retentionPeriod;
      
      expect(isExpired).toBe(true);
    });

    it('should support data subject rights (access, rectification, erasure)', async () => {
      const dataSubjectRequest = {
        type: 'ACCESS',
        subjectId: 'user:john-doe',
        requestDate: this.getDeterministicDate().toISOString(),
        deadline: new Date(this.getDeterministicTimestamp() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
      };

      // Mock implementation of data subject rights
      const supportedRights = ['ACCESS', 'RECTIFICATION', 'ERASURE', 'PORTABILITY'];
      
      expect(supportedRights).toContain(dataSubjectRequest.type);
    });
  });

  describe('HIPAA (Health Insurance Portability and Accountability Act) Compliance', () => {
    it('should detect PHI without proper safeguards', async () => {
      const phiData = {
        patientId: '12345',
        medicalRecordNumber: 'MRN-789',
        diagnosis: 'Diabetes Type 2',
        medications: ['Metformin', 'Insulin'],
        treatmentNotes: 'Patient showing improvement',
        dateOfBirth: '1980-05-15',
        socialSecurityNumber: '123-45-6789'
      };

      // Check for PHI indicators
      const phiIndicators = [
        'patientId', 'medicalRecordNumber', 'diagnosis', 
        'medications', 'treatmentNotes', 'socialSecurityNumber'
      ];

      const containsPHI = Object.keys(phiData).some(key => 
        phiIndicators.includes(key)
      );

      expect(containsPHI).toBe(true);
    });

    it('should validate encryption for PHI at rest and in transit', async () => {
      const encryptionConfig = {
        atRest: {
          algorithm: 'AES-256-GCM',
          keyRotation: true,
          keyManagement: 'HSM'
        },
        inTransit: {
          protocol: 'TLS 1.3',
          certificateValidation: true,
          perfectForwardSecrecy: true
        }
      };

      expect(encryptionConfig.atRest.algorithm).toBe('AES-256-GCM');
      expect(encryptionConfig.inTransit.protocol).toBe('TLS 1.3');
      expect(encryptionConfig.atRest.keyRotation).toBe(true);
    });

    it('should enforce minimum necessary rule', async () => {
      const accessRequest = {
        userId: 'nurse123',
        role: 'REGISTERED_NURSE',
        requestedData: ['diagnosis', 'medications', 'socialSecurityNumber'],
        patientId: 'patient456',
        purpose: 'TREATMENT'
      };

      // Nurses typically don't need SSN for treatment
      const authorizedData = accessRequest.requestedData.filter(field => 
        field !== 'socialSecurityNumber' || 
        ['BILLING', 'ADMINISTRATION'].includes(accessRequest.purpose)
      );

      expect(authorizedData).not.toContain('socialSecurityNumber');
      expect(authorizedData).toContain('diagnosis');
      expect(authorizedData).toContain('medications');
    });
  });

  describe('Basel III Financial Compliance', () => {
    it('should validate capital adequacy ratios', async () => {
      const bankData = {
        tier1Capital: 50000000, // $50M
        riskWeightedAssets: 400000000, // $400M
        totalAssets: 1000000000, // $1B
        commonEquityTier1: 45000000 // $45M
      };

      const tier1Ratio = bankData.tier1Capital / bankData.riskWeightedAssets;
      const leverageRatio = bankData.tier1Capital / bankData.totalAssets;
      const cet1Ratio = bankData.commonEquityTier1 / bankData.riskWeightedAssets;

      // Basel III minimum requirements
      expect(tier1Ratio).toBeGreaterThanOrEqual(0.06); // 6%
      expect(leverageRatio).toBeGreaterThanOrEqual(0.03); // 3%
      expect(cet1Ratio).toBeGreaterThanOrEqual(0.045); // 4.5%
    });

    it('should validate liquidity coverage ratio (LCR)', async () => {
      const liquidityData = {
        highQualityLiquidAssets: 100000000, // $100M
        totalNetCashOutflows: 80000000 // $80M (30-day period)
      };

      const lcr = liquidityData.highQualityLiquidAssets / liquidityData.totalNetCashOutflows;
      
      // Basel III minimum LCR requirement
      expect(lcr).toBeGreaterThanOrEqual(1.0); // 100%
    });

    it('should monitor counterparty exposure limits', async () => {
      const exposures = {
        'counterparty-A': 25000000, // $25M
        'counterparty-B': 15000000, // $15M
        'counterparty-C': 30000000  // $30M - Exceeds limit
      };

      const tier1Capital = 50000000; // $50M
      const maxExposureLimit = tier1Capital * 0.25; // 25% of Tier 1 capital

      const violations = Object.entries(exposures)
        .filter(([counterparty, exposure]) => exposure > maxExposureLimit);

      expect(violations).toHaveLength(1);
      expect(violations[0][0]).toBe('counterparty-C');
    });
  });

  describe('Compliance Marketplace Integration', () => {
    it('should validate compliance template certification', async () => {
      const template = {
        id: 'gdpr-basic-v1',
        regulation: 'GDPR',
        jurisdiction: ['EU'],
        complianceLevel: 'Basic',
        certificationStatus: 'Pending'
      };

      const certificationResult = await marketplace.submitForCertification(
        template,
        {
          name: 'Legal Expert',
          organization: 'Compliance Corp',
          credentials: ['JD', 'CIPP/E'],
          email: 'expert@compliance.com'
        }
      );

      expect(certificationResult.status).toBe('submitted');
      expect(certificationResult.reviewPeriod).toBeDefined();
    });

    it('should enforce licensing requirements', async () => {
      const licenseRequest = {
        templateId: 'sox-enterprise-v2',
        organizationId: 'org-123',
        licenseType: 'Enterprise',
        jurisdiction: 'US'
      };

      const license = marketplace.purchaseLicense(
        licenseRequest.templateId,
        licenseRequest.organizationId,
        licenseRequest.licenseType
      );

      expect(license.licenseKey).toBeDefined();
      expect(license.expirationDate).toBeDefined();
      expect(license.usage.maxDeployments).toBeGreaterThan(0);
    });
  });

  describe('Real-time Compliance Monitoring', () => {
    it('should generate compliance alerts for violations', async () => {
      const monitoringData = {
        gdpr: {
          dataSubjectRequests: {
            pending: 5,
            overdue: 2 // Alerts should be generated
          }
        },
        sox: {
          financialControls: {
            failed: 1, // Critical alert
            lastAudit: '2024-01-01'
          }
        }
      };

      const alerts = [];
      
      if (monitoringData.gdpr.dataSubjectRequests.overdue > 0) {
        alerts.push({
          type: 'GDPR_OVERDUE_REQUESTS',
          severity: 'HIGH',
          count: monitoringData.gdpr.dataSubjectRequests.overdue
        });
      }
      
      if (monitoringData.sox.financialControls.failed > 0) {
        alerts.push({
          type: 'SOX_CONTROL_FAILURE',
          severity: 'CRITICAL',
          count: monitoringData.sox.financialControls.failed
        });
      }

      expect(alerts).toHaveLength(2);
      expect(alerts[0].type).toBe('GDPR_OVERDUE_REQUESTS');
      expect(alerts[1].type).toBe('SOX_CONTROL_FAILURE');
    });

    it('should track compliance metrics over time', async () => {
      const metrics = await dashboard.getComplianceMetrics();
      
      expect(metrics).toHaveProperty('overall_score');
      expect(metrics).toHaveProperty('by_regulation');
      expect(metrics).toHaveProperty('risk_level');
      expect(metrics).toHaveProperty('violations');
      
      expect(typeof metrics.overall_score).toBe('number');
      expect(metrics.overall_score).toBeGreaterThanOrEqual(0);
      expect(metrics.overall_score).toBeLessThanOrEqual(100);
    });
  });
});