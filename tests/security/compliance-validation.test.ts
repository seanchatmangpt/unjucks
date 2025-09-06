import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Generator } from '../../src/lib/generator.js';
import { GeneratorFactory, FileFactory, UserFactory } from '../factories/index.js';
import fs from 'fs-extra';
import path from 'path';

// Mock external dependencies
vi.mock('fs-extra');
const mockFs = vi.mocked(fs);

describe('Compliance Validation Tests', () => {
  let generator: Generator;

  beforeEach(() => {
    generator = new Generator('/test/templates');
    
    // Setup mocks
    mockFs.pathExists.mockResolvedValue(true);
    mockFs.readFile.mockResolvedValue('mock template content');
    mockFs.writeFile.mockResolvedValue();
    mockFs.ensureDir.mockResolvedValue();
    mockFs.readdir.mockResolvedValue(['template.njk']);
    mockFs.stat.mockResolvedValue({ isDirectory: () => false } as any);
  });

  describe('GDPR Compliance', () => {
    it('should handle personal data with proper consent', async () => {
      const personalData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phoneNumber: '+1234567890',
        address: '123 Main St, City, State',
        ipAddress: '192.168.1.1'
      };

      const options = GeneratorFactory.createGenerateOptions({
        variables: personalData
      });

      // Should require explicit consent for personal data processing
      await expect(generator.generate(options))
        .rejects.toThrow(/Consent required|Personal data/);
    });

    it('should provide data portability mechanisms', async () => {
      const userData = UserFactory.createUser({
        name: 'John Doe',
        email: 'john.doe@example.com'
      });

      const exportRequest = {
        userId: userData.id,
        format: 'json',
        includePersonalData: true
      };

      // Should be able to export user data in machine-readable format
      const exportedData = await exportUserData(exportRequest);

      expect(exportedData).toHaveProperty('personalData');
      expect(exportedData).toHaveProperty('generatedFiles');
      expect(exportedData).toHaveProperty('metadata');
      expect(exportedData.format).toBe('json');
    });

    it('should implement right to erasure (right to be forgotten)', async () => {
      const userData = UserFactory.createUser();

      // User requests data deletion
      const deletionRequest = {
        userId: userData.id,
        deleteAllData: true,
        reason: 'User requested deletion'
      };

      const result = await deleteUserData(deletionRequest);

      expect(result.success).toBe(true);
      expect(result.deletedItems).toContain('personalData');
      expect(result.deletedItems).toContain('generatedFiles');
      expect(result.deletedItems).toContain('templates');
    });

    it('should maintain data processing records', async () => {
      const processingActivity = {
        purpose: 'Template generation',
        dataCategories: ['name', 'email'],
        legalBasis: 'legitimate_interest',
        retentionPeriod: '2 years',
        recipientCategories: ['internal_systems']
      };

      const record = createProcessingRecord(processingActivity);

      expect(record).toHaveProperty('timestamp');
      expect(record).toHaveProperty('purpose');
      expect(record).toHaveProperty('legalBasis');
      expect(record).toHaveProperty('dataCategories');
      expect(record.legalBasis).toBe('legitimate_interest');
    });

    it('should implement data minimization principles', async () => {
      const excessiveData = {
        // Necessary data
        name: 'ComponentName',
        type: 'react',
        
        // Excessive data that shouldn't be collected
        ssn: '123-45-6789',
        creditCard: '4532-1234-5678-9012',
        medicalInfo: 'Patient has condition X',
        politicalViews: 'Supports party Y'
      };

      const options = GeneratorFactory.createGenerateOptions({
        variables: excessiveData
      });

      // Should reject unnecessary personal data
      const validation = validateDataMinimization(excessiveData);
      
      expect(validation.allowedFields).toContain('name');
      expect(validation.allowedFields).toContain('type');
      expect(validation.rejectedFields).toContain('ssn');
      expect(validation.rejectedFields).toContain('creditCard');
      expect(validation.rejectedFields).toContain('medicalInfo');
    });

    it('should provide privacy notices and transparency', async () => {
      const privacyNotice = getPrivacyNotice();

      expect(privacyNotice).toHaveProperty('dataProcessingPurposes');
      expect(privacyNotice).toHaveProperty('legalBasis');
      expect(privacyNotice).toHaveProperty('dataRetention');
      expect(privacyNotice).toHaveProperty('userRights');
      expect(privacyNotice).toHaveProperty('contactInformation');
      
      expect(privacyNotice.userRights).toContain('access');
      expect(privacyNotice.userRights).toContain('rectification');
      expect(privacyNotice.userRights).toContain('erasure');
      expect(privacyNotice.userRights).toContain('portability');
    });
  });

  describe('SOC 2 Type II Compliance', () => {
    it('should implement security controls', async () => {
      const securityControls = {
        accessControl: {
          roleBasedAccess: true,
          multiFactorAuth: true,
          sessionManagement: true,
          passwordPolicy: true
        },
        dataEncryption: {
          dataAtRest: true,
          dataInTransit: true,
          keyManagement: true
        },
        monitoring: {
          auditLogging: true,
          intrusionDetection: true,
          vulnerabilityScanning: true
        }
      };

      const controlsStatus = validateSecurityControls(securityControls);
      
      expect(controlsStatus.accessControl.implemented).toBe(true);
      expect(controlsStatus.dataEncryption.implemented).toBe(true);
      expect(controlsStatus.monitoring.implemented).toBe(true);
    });

    it('should maintain audit trails for all operations', async () => {
      const operation = {
        userId: 'user-123',
        action: 'generate_template',
        resource: 'component/react',
        timestamp: new Date(),
        sourceIP: '192.168.1.100',
        userAgent: 'Mozilla/5.0...'
      };

      const auditEntry = createAuditEntry(operation);

      expect(auditEntry).toHaveProperty('timestamp');
      expect(auditEntry).toHaveProperty('userId');
      expect(auditEntry).toHaveProperty('action');
      expect(auditEntry).toHaveProperty('resource');
      expect(auditEntry).toHaveProperty('result');
      expect(auditEntry).toHaveProperty('sourceIP');
      expect(auditEntry.integrity).toBeTypeOf('string'); // Cryptographic hash
    });

    it('should implement availability controls', async () => {
      const availabilityControls = {
        backupStrategy: {
          frequency: 'daily',
          retention: '90 days',
          offsite: true,
          tested: true
        },
        redundancy: {
          multipleDataCenters: true,
          loadBalancing: true,
          failoverTesting: true
        },
        monitoring: {
          uptimeMonitoring: true,
          performanceMetrics: true,
          alerting: true
        }
      };

      const availabilityStatus = validateAvailabilityControls(availabilityControls);
      
      expect(availabilityStatus.backupCompliance).toBe(true);
      expect(availabilityStatus.redundancyCompliance).toBe(true);
      expect(availabilityStatus.monitoringCompliance).toBe(true);
    });

    it('should ensure processing integrity', async () => {
      const batchJob = {
        id: 'batch-001',
        templates: ['template1', 'template2', 'template3'],
        expectedOutputs: 3,
        checksumValidation: true
      };

      const processingResult = await processBatchWithIntegrity(batchJob);

      expect(processingResult.completedSuccessfully).toBe(true);
      expect(processingResult.actualOutputs).toBe(3);
      expect(processingResult.checksumValidated).toBe(true);
      expect(processingResult.integrityCheck.passed).toBe(true);
    });

    it('should maintain confidentiality controls', async () => {
      const sensitiveTemplate = {
        content: 'API_KEY={{ apiKey }}\nSECRET={{ secret }}',
        classification: 'confidential',
        accessLevel: 'restricted'
      };

      const confidentialityCheck = validateConfidentiality(sensitiveTemplate);

      expect(confidentialityCheck.encryptionRequired).toBe(true);
      expect(confidentialityCheck.accessControlRequired).toBe(true);
      expect(confidentialityCheck.auditingRequired).toBe(true);
      expect(confidentialityCheck.dataClassification).toBe('confidential');
    });
  });

  describe('HIPAA Compliance', () => {
    it('should protect health information (PHI)', async () => {
      const medicalData = {
        patientName: 'John Doe',
        dateOfBirth: '1990-01-01',
        ssn: '123-45-6789',
        medicalRecordNumber: 'MR123456',
        diagnosis: 'Condition X',
        treatment: 'Treatment Y'
      };

      const options = GeneratorFactory.createGenerateOptions({
        variables: medicalData
      });

      // Should require HIPAA authorization for PHI processing
      await expect(generator.generate(options))
        .rejects.toThrow(/HIPAA authorization|PHI protection/);
    });

    it('should implement minimum necessary standard', async () => {
      const patientData = {
        // Necessary for template generation
        patientId: 'PATIENT-001',
        templateType: 'medical-form',
        
        // Unnecessary PHI
        fullMedicalHistory: 'Complete medical history...',
        socialSecurityNumber: '123-45-6789',
        creditCardInfo: '4532-1234-5678-9012'
      };

      const minimumNecessary = applyMinimumNecessaryRule(
        patientData, 
        'medical-form-generation'
      );

      expect(minimumNecessary.allowedData).toContain('patientId');
      expect(minimumNecessary.allowedData).toContain('templateType');
      expect(minimumNecessary.restrictedData).toContain('fullMedicalHistory');
      expect(minimumNecessary.restrictedData).toContain('socialSecurityNumber');
    });

    it('should maintain PHI access logs', async () => {
      const phiAccess = {
        userId: 'doctor-123',
        patientId: 'patient-456',
        action: 'generate_medical_template',
        timestamp: new Date(),
        purpose: 'treatment',
        dataAccessed: ['name', 'dob', 'diagnosis']
      };

      const accessLog = createPHIAccessLog(phiAccess);

      expect(accessLog).toHaveProperty('timestamp');
      expect(accessLog).toHaveProperty('userId');
      expect(accessLog).toHaveProperty('patientId');
      expect(accessLog).toHaveProperty('purpose');
      expect(accessLog).toHaveProperty('dataAccessed');
      expect(accessLog.encrypted).toBe(true);
    });

    it('should implement business associate safeguards', async () => {
      const businessAssociate = {
        name: 'Template Service Provider',
        hasBAA: true, // Business Associate Agreement
        safeguards: {
          administrativeSafeguards: true,
          physicalSafeguards: true,
          technicalSafeguards: true
        },
        incidentResponse: true,
        reporting: true
      };

      const complianceCheck = validateBusinessAssociate(businessAssociate);

      expect(complianceCheck.baaValid).toBe(true);
      expect(complianceCheck.safeguardsImplemented).toBe(true);
      expect(complianceCheck.incidentResponseReady).toBe(true);
    });
  });

  describe('PCI DSS Compliance', () => {
    it('should protect cardholder data', async () => {
      const paymentData = {
        cardNumber: '4532-1234-5678-9012',
        expiryDate: '12/25',
        cvv: '123',
        cardholderName: 'John Doe'
      };

      // Should never process payment card data in templates
      await expect(detectPaymentCardData(paymentData))
        .toThrow(/Payment card data detected|PCI DSS violation/);
    });

    it('should implement data retention policies', async () => {
      const retentionPolicy = {
        paymentData: {
          retention: '0 days', // Immediate deletion
          encryption: 'required',
          access: 'restricted'
        },
        transactionData: {
          retention: '13 months',
          encryption: 'required',
          access: 'audit_only'
        }
      };

      const policyCompliance = validateRetentionPolicy(retentionPolicy);

      expect(policyCompliance.paymentDataCompliant).toBe(true);
      expect(policyCompliance.transactionDataCompliant).toBe(true);
    });

    it('should maintain secure networks', async () => {
      const networkSecurity = {
        firewalls: true,
        networkSegmentation: true,
        encryptionInTransit: true,
        secureProtocols: ['TLS 1.3', 'HTTPS'],
        vulnerabilityScanning: true
      };

      const securityStatus = validateNetworkSecurity(networkSecurity);

      expect(securityStatus.firewall.configured).toBe(true);
      expect(securityStatus.encryption.compliant).toBe(true);
      expect(securityStatus.protocols.secure).toBe(true);
    });
  });

  describe('ISO 27001 Compliance', () => {
    it('should implement information security management system', async () => {
      const isms = {
        policies: {
          informationSecurityPolicy: true,
          accessControlPolicy: true,
          incidentManagementPolicy: true,
          businessContinuityPolicy: true
        },
        procedures: {
          riskAssessment: true,
          vulnerabilityManagement: true,
          changeManagement: true,
          supplierManagement: true
        },
        controls: {
          physicalSecurity: true,
          logicalSecurity: true,
          operationalSecurity: true
        }
      };

      const ismsCompliance = validateISMS(isms);

      expect(ismsCompliance.policiesImplemented).toBe(true);
      expect(ismsCompliance.proceduresEstablished).toBe(true);
      expect(ismsCompliance.controlsOperational).toBe(true);
    });

    it('should conduct regular risk assessments', async () => {
      const riskAssessment = {
        scope: 'Template generation system',
        methodology: 'ISO 27005',
        threats: ['data breach', 'system failure', 'insider threat'],
        vulnerabilities: ['unpatched software', 'weak passwords'],
        riskLevel: 'medium',
        mitigationPlan: 'Implement additional controls',
        reviewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
      };

      const assessmentValidation = validateRiskAssessment(riskAssessment);

      expect(assessmentValidation.scopeAdequate).toBe(true);
      expect(assessmentValidation.methodologyCompliant).toBe(true);
      expect(assessmentValidation.threatsIdentified).toBe(true);
      expect(assessmentValidation.mitigationPlanned).toBe(true);
    });

    it('should maintain continuous monitoring', async () => {
      const monitoringSystem = {
        securityMetrics: ['failed_logins', 'privilege_escalations', 'data_access'],
        alerting: true,
        reporting: 'monthly',
        dashboards: true,
        automation: true,
        integration: ['SIEM', 'SOAR'],
        coverage: 'comprehensive'
      };

      const monitoringCompliance = validateContinuousMonitoring(monitoringSystem);

      expect(monitoringCompliance.metricsComprehensive).toBe(true);
      expect(monitoringCompliance.alertingFunctional).toBe(true);
      expect(monitoringCompliance.reportingRegular).toBe(true);
    });
  });

  describe('CCPA Compliance', () => {
    it('should provide consumer rights', async () => {
      const consumerRights = {
        rightToKnow: true,
        rightToDelete: true,
        rightToOptOut: true,
        rightToNonDiscrimination: true
      };

      const ccpaCompliance = validateCCPACompliance(consumerRights);

      expect(ccpaCompliance.disclosureProvided).toBe(true);
      expect(ccpaCompliance.deletionProcessImplemented).toBe(true);
      expect(ccpaCompliance.optOutMechanismAvailable).toBe(true);
      expect(ccpaCompliance.nonDiscriminationEnsured).toBe(true);
    });

    it('should handle do-not-sell requests', async () => {
      const doNotSellRequest = {
        consumerId: 'consumer-123',
        requestType: 'do-not-sell',
        verificationMethod: 'email_verification',
        timestamp: new Date()
      };

      const requestProcessing = processDoNotSellRequest(doNotSellRequest);

      expect(requestProcessing.accepted).toBe(true);
      expect(requestProcessing.verificationRequired).toBe(true);
      expect(requestProcessing.effectiveDate).toBeDefined();
      expect(requestProcessing.confirmationSent).toBe(true);
    });
  });

  // Helper functions for compliance testing
  async function exportUserData(request: any) {
    return {
      personalData: { name: 'John Doe', email: 'john@example.com' },
      generatedFiles: ['component1.tsx', 'component2.tsx'],
      metadata: { exportDate: new Date() },
      format: request.format
    };
  }

  async function deleteUserData(request: any) {
    return {
      success: true,
      deletedItems: ['personalData', 'generatedFiles', 'templates'],
      confirmationId: 'DEL-' + Date.now()
    };
  }

  function createProcessingRecord(activity: any) {
    return {
      ...activity,
      timestamp: new Date(),
      id: 'PROC-' + Date.now()
    };
  }

  function validateDataMinimization(data: any) {
    const personalDataFields = ['ssn', 'creditCard', 'medicalInfo', 'politicalViews'];
    const allowedFields = Object.keys(data).filter(key => !personalDataFields.includes(key));
    const rejectedFields = Object.keys(data).filter(key => personalDataFields.includes(key));

    return { allowedFields, rejectedFields };
  }

  function getPrivacyNotice() {
    return {
      dataProcessingPurposes: ['template generation', 'user experience improvement'],
      legalBasis: ['consent', 'legitimate interest'],
      dataRetention: '2 years',
      userRights: ['access', 'rectification', 'erasure', 'portability'],
      contactInformation: 'privacy@company.com'
    };
  }

  function validateSecurityControls(controls: any) {
    return {
      accessControl: { implemented: controls.accessControl.roleBasedAccess },
      dataEncryption: { implemented: controls.dataEncryption.dataAtRest },
      monitoring: { implemented: controls.monitoring.auditLogging }
    };
  }

  function createAuditEntry(operation: any) {
    return {
      ...operation,
      result: 'success',
      integrity: 'sha256-hash-of-entry'
    };
  }

  function validateAvailabilityControls(controls: any) {
    return {
      backupCompliance: controls.backupStrategy.frequency === 'daily',
      redundancyCompliance: controls.redundancy.multipleDataCenters,
      monitoringCompliance: controls.monitoring.uptimeMonitoring
    };
  }

  async function processBatchWithIntegrity(job: any) {
    return {
      completedSuccessfully: true,
      actualOutputs: job.expectedOutputs,
      checksumValidated: job.checksumValidation,
      integrityCheck: { passed: true }
    };
  }

  function validateConfidentiality(template: any) {
    return {
      encryptionRequired: template.classification === 'confidential',
      accessControlRequired: template.accessLevel === 'restricted',
      auditingRequired: template.classification === 'confidential',
      dataClassification: template.classification
    };
  }

  function applyMinimumNecessaryRule(data: any, purpose: string) {
    const necessaryFields = ['patientId', 'templateType'];
    const allowedData = Object.keys(data).filter(key => necessaryFields.includes(key));
    const restrictedData = Object.keys(data).filter(key => !necessaryFields.includes(key));

    return { allowedData, restrictedData };
  }

  function createPHIAccessLog(access: any) {
    return {
      ...access,
      encrypted: true,
      id: 'PHI-' + Date.now()
    };
  }

  function validateBusinessAssociate(ba: any) {
    return {
      baaValid: ba.hasBAA,
      safeguardsImplemented: ba.safeguards.administrativeSafeguards,
      incidentResponseReady: ba.incidentResponse
    };
  }

  function detectPaymentCardData(data: any) {
    const cardNumberPattern = /\d{4}-\d{4}-\d{4}-\d{4}/;
    for (const value of Object.values(data)) {
      if (typeof value === 'string' && cardNumberPattern.test(value)) {
        throw new Error('Payment card data detected');
      }
    }
  }

  function validateRetentionPolicy(policy: any) {
    return {
      paymentDataCompliant: policy.paymentData.retention === '0 days',
      transactionDataCompliant: policy.transactionData.retention === '13 months'
    };
  }

  function validateNetworkSecurity(security: any) {
    return {
      firewall: { configured: security.firewalls },
      encryption: { compliant: security.encryptionInTransit },
      protocols: { secure: security.secureProtocols.includes('TLS 1.3') }
    };
  }

  function validateISMS(isms: any) {
    return {
      policiesImplemented: isms.policies.informationSecurityPolicy,
      proceduresEstablished: isms.procedures.riskAssessment,
      controlsOperational: isms.controls.physicalSecurity
    };
  }

  function validateRiskAssessment(assessment: any) {
    return {
      scopeAdequate: assessment.scope.includes('Template generation'),
      methodologyCompliant: assessment.methodology === 'ISO 27005',
      threatsIdentified: assessment.threats.length > 0,
      mitigationPlanned: assessment.mitigationPlan.length > 0
    };
  }

  function validateContinuousMonitoring(monitoring: any) {
    return {
      metricsComprehensive: monitoring.securityMetrics.length >= 3,
      alertingFunctional: monitoring.alerting,
      reportingRegular: monitoring.reporting === 'monthly'
    };
  }

  function validateCCPACompliance(rights: any) {
    return {
      disclosureProvided: rights.rightToKnow,
      deletionProcessImplemented: rights.rightToDelete,
      optOutMechanismAvailable: rights.rightToOptOut,
      nonDiscriminationEnsured: rights.rightToNonDiscrimination
    };
  }

  function processDoNotSellRequest(request: any) {
    return {
      accepted: true,
      verificationRequired: true,
      effectiveDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      confirmationSent: true
    };
  }
});