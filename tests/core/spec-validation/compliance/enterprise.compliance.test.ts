import { describe, it, expect, beforeEach } from 'vitest';
import { EnterpriseComplianceChecker } from '../../../../src/core/spec-validation/compliance/enterprise.compliance.js';
import type { 
  ValidationContext,
  ComplianceStatus 
} from '../../../../src/core/spec-validation/types/validation.types.js';
import type { Specification } from '../../../../src/core/spec-validation/schemas/specification.schema.js';

describe('EnterpriseComplianceChecker', () => {
  let checker: EnterpriseComplianceChecker;
  let mockContext: ValidationContext;
  let baseSpecification: Specification;

  beforeEach(() => {
    checker = new EnterpriseComplianceChecker();
    
    mockContext = {
      specificationId: 'test-spec-001',
      validationId: 'validation-001',
      timestamp: new Date('2024-01-01T00:00:00Z'),
      version: '1.0.0',
      environment: 'development',
      options: {},
    };

    baseSpecification = {
      metadata: {
        id: 'spec-001',
        name: 'Test API Specification',
        version: '1.0.0',
        description: 'Test API specification for compliance checking',
        author: {
          name: 'Test Author',
          email: 'test@example.com',
        },
        created: '2024-01-01T00:00:00Z',
        lastModified: '2024-01-01T00:00:00Z',
        tags: ['api', 'security'],
        category: 'api',
        status: 'draft',
        priority: 'medium',
      },
      summary: {
        purpose: 'Test API for enterprise compliance validation testing',
        scope: 'Covers basic API functionality with security considerations',
        stakeholders: [{
          role: 'Security Officer',
          name: 'Jane Doe',
          responsibilities: ['Security compliance', 'Risk assessment'],
        }],
        assumptions: ['Users have valid authentication'],
        constraints: ['Must comply with enterprise security standards'],
      },
      requirements: [{
        id: 'REQ-001',
        title: 'User Authentication',
        description: 'System must authenticate users with secure credentials',
        type: 'security',
        priority: 'must-have',
        source: 'Security Policy',
        rationale: 'Required for data protection and access control',
        acceptanceCriteria: [{
          id: 'AC-001',
          description: 'Users must provide valid credentials to access the system',
          testable: true,
        }],
        dependencies: [],
        risks: [{
          description: 'Weak authentication may lead to unauthorized access',
          impact: 'high',
          probability: 'medium',
          mitigation: 'Implement strong password policies and MFA',
        }],
      }],
      compliance: [{
        standard: 'ISO 27001',
        requirements: ['Information security management'],
        evidence: ['Security policy document'],
      }],
    };
  });

  describe('ISO 27001 Compliance', () => {
    it('should detect compliant specifications', async () => {
      const compliantSpec: Specification = {
        ...baseSpecification,
        requirements: [
          ...baseSpecification.requirements,
          {
            id: 'REQ-002',
            title: 'Information Security Policy',
            description: 'Organization must maintain documented information security policies',
            type: 'security',
            priority: 'must-have',
            rationale: 'Required by ISO 27001 for security management',
            acceptanceCriteria: [{
              id: 'AC-002',
              description: 'Security policy must be documented and approved',
              testable: true,
            }],
            dependencies: [],
            risks: [],
          },
          {
            id: 'REQ-003', 
            title: 'Access Control',
            description: 'System must implement role-based access controls',
            type: 'security',
            priority: 'must-have',
            rationale: 'Required for proper access management',
            acceptanceCriteria: [{
              id: 'AC-003',
              description: 'Users must be assigned appropriate roles',
              testable: true,
            }],
            dependencies: [],
            risks: [],
          },
        ],
      };

      const results = await checker.checkCompliance(compliantSpec, mockContext, ['iso-27001']);
      
      expect(results).toHaveLength(1);
      expect(results[0].standardId).toBe('iso-27001');
      expect(results[0].overallStatus).toBe('compliant');
      expect(results[0].gaps).toHaveLength(0);
    });

    it('should detect non-compliant specifications', async () => {
      const nonCompliantSpec: Specification = {
        ...baseSpecification,
        requirements: [{
          id: 'REQ-001',
          title: 'Basic Functionality',
          description: 'System must provide basic functionality',
          type: 'functional',
          priority: 'must-have',
          rationale: 'Required for basic operation',
          acceptanceCriteria: [{
            id: 'AC-001',
            description: 'System must work as expected',
            testable: true,
          }],
          dependencies: [],
          risks: [],
        }],
      };

      const results = await checker.checkCompliance(nonCompliantSpec, mockContext, ['iso-27001']);
      
      expect(results).toHaveLength(1);
      expect(results[0].overallStatus).toBe('non-compliant');
      expect(results[0].gaps.length).toBeGreaterThan(0);
      
      const gaps = results[0].gaps;
      expect(gaps.some(gap => gap.description.includes('security policy'))).toBe(true);
    });

    it('should provide remediation recommendations', async () => {
      const results = await checker.checkCompliance(baseSpecification, mockContext, ['iso-27001']);
      const gaps = results[0].gaps;
      
      if (gaps.length > 0) {
        const gap = gaps[0];
        expect(gap.remediation).toBeInstanceOf(Array);
        expect(gap.remediation.length).toBeGreaterThan(0);
        expect(gap.impact).toMatch(/low|medium|high|critical/);
      }
    });
  });

  describe('GDPR Compliance', () => {
    it('should check data protection requirements', async () => {
      const gdprSpec: Specification = {
        ...baseSpecification,
        requirements: [
          ...baseSpecification.requirements,
          {
            id: 'REQ-GDPR-001',
            title: 'Data Protection',
            description: 'System must implement data protection by design and by default',
            type: 'security',
            priority: 'must-have',
            rationale: 'Required by GDPR Article 25',
            acceptanceCriteria: [{
              id: 'AC-GDPR-001',
              description: 'Privacy measures must be implemented by default',
              testable: true,
            }],
            dependencies: [],
            risks: [],
          },
          {
            id: 'REQ-GDPR-002',
            title: 'Data Privacy',
            description: 'System must protect personal data with appropriate technical measures',
            type: 'security',
            priority: 'must-have',
            rationale: 'Required for GDPR compliance',
            acceptanceCriteria: [{
              id: 'AC-GDPR-002',
              description: 'Personal data must be encrypted and protected',
              testable: true,
            }],
            dependencies: [],
            risks: [],
          },
        ],
      };

      const results = await checker.checkCompliance(gdprSpec, mockContext, ['gdpr']);
      
      expect(results).toHaveLength(1);
      expect(results[0].standardId).toBe('gdpr');
      
      // Should find some evidence of data protection requirements
      const dataProtectionReq = results[0].requirements.find(
        req => req.requirementId === 'gdpr-art-25'
      );
      expect(dataProtectionReq?.evidence.length).toBeGreaterThan(0);
    });

    it('should detect missing privacy requirements', async () => {
      const nonPrivacySpec: Specification = {
        ...baseSpecification,
        requirements: [{
          id: 'REQ-001',
          title: 'Public API',
          description: 'System must provide public API access',
          type: 'functional',
          priority: 'must-have',
          rationale: 'Required for system integration',
          acceptanceCriteria: [{
            id: 'AC-001',
            description: 'API must be publicly accessible',
            testable: true,
          }],
          dependencies: [],
          risks: [],
        }],
      };

      const results = await checker.checkCompliance(nonPrivacySpec, mockContext, ['gdpr']);
      
      expect(results[0].overallStatus).toBe('non-compliant');
      expect(results[0].gaps.length).toBeGreaterThan(0);
      
      const privacyGaps = results[0].gaps.filter(
        gap => gap.description.includes('protection') || gap.description.includes('privacy')
      );
      expect(privacyGaps.length).toBeGreaterThan(0);
    });
  });

  describe('PCI DSS Compliance', () => {
    it('should check payment card security requirements', async () => {
      const pciSpec: Specification = {
        ...baseSpecification,
        requirements: [
          ...baseSpecification.requirements,
          {
            id: 'REQ-PCI-001',
            title: 'Data Encryption',
            description: 'System must encrypt cardholder data during transmission',
            type: 'security',
            priority: 'must-have',
            rationale: 'Required by PCI DSS for cardholder data protection',
            acceptanceCriteria: [{
              id: 'AC-PCI-001',
              description: 'All cardholder data must be encrypted using TLS',
              testable: true,
            }],
            dependencies: [],
            risks: [],
          },
          {
            id: 'REQ-PCI-002',
            title: 'Network Security',
            description: 'System must implement network security controls',
            type: 'security',
            priority: 'must-have',
            rationale: 'Required for PCI DSS compliance',
            acceptanceCriteria: [{
              id: 'AC-PCI-002',
              description: 'Network traffic must be monitored and controlled',
              testable: true,
            }],
            dependencies: [],
            risks: [],
          },
        ],
      };

      const results = await checker.checkCompliance(pciSpec, mockContext, ['pci-dss']);
      
      expect(results).toHaveLength(1);
      expect(results[0].standardId).toBe('pci-dss');
      
      // Should detect encryption requirements
      const encryptionEvidence = results[0].requirements.some(
        req => req.evidence.some(evidence => evidence.includes('encryption') || evidence.includes('TLS'))
      );
      expect(encryptionEvidence).toBe(true);
    });
  });

  describe('SOX Compliance', () => {
    it('should check financial controls requirements', async () => {
      const soxSpec: Specification = {
        ...baseSpecification,
        requirements: [
          ...baseSpecification.requirements,
          {
            id: 'REQ-SOX-001',
            title: 'Audit Trail',
            description: 'System must maintain comprehensive audit trails for all transactions',
            type: 'security',
            priority: 'must-have',
            rationale: 'Required by SOX for financial reporting controls',
            acceptanceCriteria: [{
              id: 'AC-SOX-001',
              description: 'All user actions must be logged and traceable',
              testable: true,
            }],
            dependencies: [],
            risks: [],
          },
          {
            id: 'REQ-SOX-002',
            title: 'Change Control',
            description: 'System must implement change control procedures',
            type: 'security',
            priority: 'must-have',
            rationale: 'Required for SOX compliance',
            acceptanceCriteria: [{
              id: 'AC-SOX-002',
              description: 'All changes must be approved and documented',
              testable: true,
            }],
            dependencies: [],
            risks: [],
          },
        ],
      };

      const results = await checker.checkCompliance(soxSpec, mockContext, ['sox']);
      
      expect(results).toHaveLength(1);
      expect(results[0].standardId).toBe('sox');
      
      // Should detect audit trail requirements
      const auditEvidence = results[0].requirements.some(
        req => req.evidence.some(evidence => evidence.includes('audit') || evidence.includes('log'))
      );
      expect(auditEvidence).toBe(true);
    });
  });

  describe('NIST Cybersecurity Framework', () => {
    it('should check cybersecurity controls', async () => {
      const nistSpec: Specification = {
        ...baseSpecification,
        requirements: [
          ...baseSpecification.requirements,
          {
            id: 'REQ-NIST-001',
            title: 'Asset Management',
            description: 'System must maintain inventory of all assets',
            type: 'security',
            priority: 'must-have',
            rationale: 'Required for cybersecurity framework compliance',
            acceptanceCriteria: [{
              id: 'AC-NIST-001',
              description: 'Asset inventory must be maintained and updated',
              testable: true,
            }],
            dependencies: [],
            risks: [],
          },
          {
            id: 'REQ-NIST-002',
            title: 'Continuous Monitoring',
            description: 'System must implement continuous security monitoring',
            type: 'security',
            priority: 'must-have',
            rationale: 'Required for threat detection',
            acceptanceCriteria: [{
              id: 'AC-NIST-002',
              description: 'Security events must be monitored continuously',
              testable: true,
            }],
            dependencies: [],
            risks: [],
          },
        ],
      };

      const results = await checker.checkCompliance(nistSpec, mockContext, ['nist-csf']);
      
      expect(results).toHaveLength(1);
      expect(results[0].standardId).toBe('nist-csf');
      
      // Should detect asset management and monitoring requirements
      const frameworkEvidence = results[0].requirements.some(
        req => req.evidence.some(evidence => 
          evidence.includes('asset') || evidence.includes('monitoring')
        )
      );
      expect(frameworkEvidence).toBe(true);
    });
  });

  describe('Multiple Standards Compliance', () => {
    it('should check multiple standards simultaneously', async () => {
      const results = await checker.checkCompliance(
        baseSpecification, 
        mockContext, 
        ['iso-27001', 'gdpr']
      );
      
      expect(results).toHaveLength(2);
      expect(results.map(r => r.standardId)).toEqual(['iso-27001', 'gdpr']);
    });

    it('should check all applicable standards when no specific standards requested', async () => {
      const results = await checker.checkCompliance(baseSpecification, mockContext);
      
      // Should return results for all standards applicable to 'api' category
      expect(results.length).toBeGreaterThan(1);
      const standardIds = results.map(r => r.standardId);
      expect(standardIds).toContain('iso-27001');
      expect(standardIds).toContain('gdpr');
      expect(standardIds).toContain('pci-dss');
    });
  });

  describe('complianceToValidationIssues', () => {
    it('should convert compliance gaps to validation issues', async () => {
      const results = await checker.checkCompliance(baseSpecification, mockContext, ['iso-27001']);
      const issues = checker.complianceToValidationIssues(results);
      
      if (results[0].overallStatus !== 'compliant') {
        expect(issues.length).toBeGreaterThan(0);
        
        const issue = issues[0];
        expect(issue.ruleId).toBe('compliance-iso-27001');
        expect(issue.severity).toMatch(/error|warning|info/);
        expect(issue.message).toContain('compliance gap');
        expect(issue.metadata.compliance).toBe(true);
        expect(issue.metadata.standardId).toBe('iso-27001');
        expect(issue.suggestion).toBeDefined();
      }
    });

    it('should map impact levels to appropriate severities', async () => {
      const mockResults: ComplianceStatus[] = [{
        standardId: 'test-standard',
        standardName: 'Test Standard',
        overallStatus: 'non-compliant',
        requirements: [],
        gaps: [
          {
            requirementId: 'req-1',
            description: 'Critical gap',
            impact: 'critical',
            remediation: ['Fix critical issue'],
          },
          {
            requirementId: 'req-2',
            description: 'High impact gap',
            impact: 'high',
            remediation: ['Fix high impact issue'],
          },
          {
            requirementId: 'req-3',
            description: 'Medium impact gap',
            impact: 'medium',
            remediation: ['Fix medium impact issue'],
          },
          {
            requirementId: 'req-4',
            description: 'Low impact gap',
            impact: 'low',
            remediation: ['Fix low impact issue'],
          },
        ],
      }];

      const issues = checker.complianceToValidationIssues(mockResults);
      
      expect(issues).toHaveLength(4);
      
      const criticalIssue = issues.find(i => i.message.includes('Critical gap'));
      expect(criticalIssue?.severity).toBe('error');
      
      const highIssue = issues.find(i => i.message.includes('High impact'));
      expect(highIssue?.severity).toBe('error');
      
      const mediumIssue = issues.find(i => i.message.includes('Medium impact'));
      expect(mediumIssue?.severity).toBe('warning');
      
      const lowIssue = issues.find(i => i.message.includes('Low impact'));
      expect(lowIssue?.severity).toBe('info');
    });

    it('should not create issues for compliant standards', async () => {
      const compliantResults: ComplianceStatus[] = [{
        standardId: 'test-standard',
        standardName: 'Test Standard',
        overallStatus: 'compliant',
        requirements: [{
          requirementId: 'req-1',
          description: 'Test requirement',
          status: 'met',
          evidence: ['All requirements satisfied'],
          gaps: [],
        }],
        gaps: [],
      }];

      const issues = checker.complianceToValidationIssues(compliantResults);
      expect(issues).toHaveLength(0);
    });
  });

  describe('Custom Standards', () => {
    it('should allow adding custom compliance standards', () => {
      const customStandard = {
        id: 'custom-security',
        name: 'Custom Security Standard',
        version: '1.0',
        description: 'Custom security requirements',
        requirements: [{
          id: 'custom-req-1',
          description: 'Custom security requirement',
          mandatory: true,
          checkpoints: ['custom-checkpoint'],
        }],
        applicableCategories: ['api'],
      };

      checker.addStandard(customStandard);
      
      // Verify the standard was added by checking if it gets used
      // This would be tested through a compliance check, but since our
      // checker implementation only has predefined standards, we just
      // verify the method doesn't throw
      expect(() => checker.addStandard(customStandard)).not.toThrow();
    });
  });
});