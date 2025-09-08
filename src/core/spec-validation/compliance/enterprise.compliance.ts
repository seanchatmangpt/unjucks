import type { 
  ComplianceStatus, 
  ComplianceRequirementStatus, 
  ComplianceGap,
  ValidationContext,
  ValidationIssue 
} from '../types/validation.types.js';
import type { ComplianceStandard } from '../schemas/validation-config.schema.js';
import type { Specification } from '../schemas/specification.schema.js';

/**
 * Enterprise compliance checker for various standards
 */
export class EnterpriseComplianceChecker {
  private standards: Map<string, ComplianceStandard> = new Map();

  constructor() {
    this.initializeStandards();
  }

  /**
   * Add a compliance standard
   */
  addStandard(standard: ComplianceStandard): void {
    this.standards.set(standard.id, standard);
  }

  /**
   * Check specification against all applicable standards
   */
  async checkCompliance(
    specification: Specification,
    context: ValidationContext,
    standardIds?: string[]
  ): Promise<ComplianceStatus[]> {
    const results: ComplianceStatus[] = [];
    const applicableStandards = this.getApplicableStandards(specification, standardIds);

    for (const standard of applicableStandards) {
      const status = await this.checkStandardCompliance(specification, standard, context);
      results.push(status);
    }

    return results;
  }

  /**
   * Generate validation issues from compliance status
   */
  complianceToValidationIssues(complianceResults: ComplianceStatus[]): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const result of complianceResults) {
      if (result.overallStatus === 'non-compliant' || result.overallStatus === 'partial') {
        // Add issues for gaps
        for (const gap of result.gaps) {
          issues.push({
            id: `compliance-gap-${result.standardId}-${gap.requirementId}`,
            ruleId: `compliance-${result.standardId}`,
            severity: this.mapImpactToSeverity(gap.impact),
            message: `${result.standardName} compliance gap: ${gap.description}`,
            description: `Requirement ${gap.requirementId} is not met. Impact: ${gap.impact}`,
            path: this.extractPathFromGap(gap),
            suggestion: gap.remediation.join('\n'),
            autoFixable: false,
            metadata: {
              compliance: true,
              standardId: result.standardId,
              standardName: result.standardName,
              requirementId: gap.requirementId,
              impact: gap.impact,
              remediation: gap.remediation,
            },
          });
        }
      }
    }

    return issues;
  }

  /**
   * Private methods
   */
  private initializeStandards(): void {
    // ISO 27001 - Information Security Management
    this.addStandard({
      id: 'iso-27001',
      name: 'ISO/IEC 27001:2022',
      version: '2022',
      description: 'Information Security Management Systems',
      requirements: [
        {
          id: 'iso-27001-a5.1',
          description: 'Information security policies',
          mandatory: true,
          checkpoints: ['security-policy-documented', 'security-roles-defined'],
        },
        {
          id: 'iso-27001-a5.2',
          description: 'Information security risk management',
          mandatory: true,
          checkpoints: ['risk-assessment', 'risk-treatment', 'risk-monitoring'],
        },
        {
          id: 'iso-27001-a8.1',
          description: 'Asset management',
          mandatory: true,
          checkpoints: ['asset-inventory', 'asset-classification', 'asset-handling'],
        },
        {
          id: 'iso-27001-a8.2',
          description: 'Information classification',
          mandatory: true,
          checkpoints: ['classification-scheme', 'labeling', 'handling-requirements'],
        },
      ],
      applicableCategories: ['api', 'service', 'system'],
    });

    // SOX - Sarbanes-Oxley Act
    this.addStandard({
      id: 'sox',
      name: 'Sarbanes-Oxley Act',
      version: '2002',
      description: 'Financial reporting and internal controls',
      requirements: [
        {
          id: 'sox-302',
          description: 'Corporate responsibility for financial reports',
          mandatory: true,
          checkpoints: ['audit-trails', 'change-controls', 'access-controls'],
        },
        {
          id: 'sox-404',
          description: 'Management assessment of internal controls',
          mandatory: true,
          checkpoints: ['control-documentation', 'control-testing', 'deficiency-reporting'],
        },
        {
          id: 'sox-409',
          description: 'Real-time disclosure',
          mandatory: true,
          checkpoints: ['real-time-monitoring', 'incident-reporting', 'disclosure-procedures'],
        },
      ],
      applicableCategories: ['api', 'service', 'system'],
    });

    // GDPR - General Data Protection Regulation
    this.addStandard({
      id: 'gdpr',
      name: 'General Data Protection Regulation',
      version: '2018',
      description: 'Data protection and privacy regulation',
      requirements: [
        {
          id: 'gdpr-art-5',
          description: 'Principles of processing personal data',
          mandatory: true,
          checkpoints: ['lawfulness', 'purpose-limitation', 'data-minimization', 'accuracy'],
        },
        {
          id: 'gdpr-art-25',
          description: 'Data protection by design and by default',
          mandatory: true,
          checkpoints: ['privacy-by-design', 'privacy-by-default', 'technical-measures'],
        },
        {
          id: 'gdpr-art-32',
          description: 'Security of processing',
          mandatory: true,
          checkpoints: ['encryption', 'pseudonymization', 'resilience', 'restoration'],
        },
        {
          id: 'gdpr-art-33',
          description: 'Notification of data breach',
          mandatory: true,
          checkpoints: ['breach-detection', 'breach-notification', 'breach-documentation'],
        },
      ],
      applicableCategories: ['api', 'service', 'system'],
    });

    // PCI DSS - Payment Card Industry Data Security Standard
    this.addStandard({
      id: 'pci-dss',
      name: 'PCI DSS',
      version: '4.0',
      description: 'Payment Card Industry Data Security Standard',
      requirements: [
        {
          id: 'pci-req-1',
          description: 'Install and maintain network security controls',
          mandatory: true,
          checkpoints: ['firewall-configuration', 'network-segmentation', 'traffic-monitoring'],
        },
        {
          id: 'pci-req-3',
          description: 'Protect stored account data',
          mandatory: true,
          checkpoints: ['data-encryption', 'key-management', 'secure-deletion'],
        },
        {
          id: 'pci-req-4',
          description: 'Protect cardholder data with strong cryptography during transmission',
          mandatory: true,
          checkpoints: ['transmission-encryption', 'certificate-management', 'protocol-security'],
        },
        {
          id: 'pci-req-8',
          description: 'Identify users and authenticate access',
          mandatory: true,
          checkpoints: ['user-identification', 'authentication-controls', 'mfa-implementation'],
        },
      ],
      applicableCategories: ['api', 'service'],
    });

    // NIST Cybersecurity Framework
    this.addStandard({
      id: 'nist-csf',
      name: 'NIST Cybersecurity Framework',
      version: '1.1',
      description: 'Framework for improving critical infrastructure cybersecurity',
      requirements: [
        {
          id: 'nist-id',
          description: 'Identify - Asset Management, Business Environment, Governance',
          mandatory: true,
          checkpoints: ['asset-inventory', 'business-context', 'governance-structure'],
        },
        {
          id: 'nist-pr',
          description: 'Protect - Access Control, Awareness, Data Security',
          mandatory: true,
          checkpoints: ['access-controls', 'security-awareness', 'data-protection'],
        },
        {
          id: 'nist-de',
          description: 'Detect - Anomalies, Security Monitoring',
          mandatory: true,
          checkpoints: ['continuous-monitoring', 'detection-processes', 'anomaly-detection'],
        },
        {
          id: 'nist-rs',
          description: 'Respond - Response Planning, Communications, Analysis',
          mandatory: true,
          checkpoints: ['response-planning', 'incident-communications', 'forensic-analysis'],
        },
        {
          id: 'nist-rc',
          description: 'Recover - Recovery Planning, Improvements, Communications',
          mandatory: true,
          checkpoints: ['recovery-procedures', 'backup-restoration', 'lessons-learned'],
        },
      ],
      applicableCategories: ['system', 'service', 'api'],
    });
  }

  private getApplicableStandards(
    specification: Specification, 
    standardIds?: string[]
  ): ComplianceStandard[] {
    if (standardIds) {
      return standardIds
        .map(id => this.standards.get(id))
        .filter((standard): standard is ComplianceStandard => standard !== undefined);
    }

    // Return all standards applicable to the specification category
    const category = specification.metadata.category;
    return Array.from(this.standards.values()).filter(standard =>
      standard.applicableCategories.includes(category)
    );
  }

  private async checkStandardCompliance(
    specification: Specification,
    standard: ComplianceStandard,
    context: ValidationContext
  ): Promise<ComplianceStatus> {
    const requirementStatuses: ComplianceRequirementStatus[] = [];
    const gaps: ComplianceGap[] = [];

    for (const requirement of standard.requirements) {
      const status = await this.checkRequirementCompliance(
        specification,
        requirement,
        context
      );
      
      requirementStatuses.push(status);

      if (status.status === 'not-met' || status.status === 'partial') {
        gaps.push(...this.generateGaps(requirement, status));
      }
    }

    const overallStatus = this.determineOverallStatus(requirementStatuses);

    return {
      standardId: standard.id,
      standardName: standard.name,
      overallStatus,
      requirements: requirementStatuses,
      gaps,
    };
  }

  private async checkRequirementCompliance(
    specification: Specification,
    requirement: ComplianceStandard['requirements'][0],
    context: ValidationContext
  ): Promise<ComplianceRequirementStatus> {
    const evidence: string[] = [];
    const gaps: string[] = [];

    // Check each checkpoint
    for (const checkpoint of requirement.checkpoints) {
      const checkResult = this.checkCheckpoint(specification, checkpoint);
      if (checkResult.met) {
        evidence.push(...checkResult.evidence);
      } else {
        gaps.push(...checkResult.gaps);
      }
    }

    // Determine status based on evidence and gaps
    let status: ComplianceRequirementStatus['status'];
    if (gaps.length === 0) {
      status = 'met';
    } else if (evidence.length > 0) {
      status = 'partial';
    } else {
      status = 'not-met';
    }

    return {
      requirementId: requirement.id,
      description: requirement.description,
      status,
      evidence,
      gaps,
    };
  }

  private checkCheckpoint(
    specification: Specification,
    checkpoint: string
  ): { met: boolean; evidence: string[]; gaps: string[] } {
    const evidence: string[] = [];
    const gaps: string[] = [];
    let met = false;

    // This would contain the actual compliance checking logic
    // For now, we'll implement basic checks based on specification content
    
    switch (checkpoint) {
      case 'security-policy-documented':
        if (specification.requirements.some(req => 
          req.type === 'security' && req.title.toLowerCase().includes('policy')
        )) {
          met = true;
          evidence.push('Security policy requirements found');
        } else {
          gaps.push('No documented security policy requirements');
        }
        break;

      case 'access-controls':
        if (specification.requirements.some(req => 
          req.description.toLowerCase().includes('access control') ||
          req.description.toLowerCase().includes('authentication')
        )) {
          met = true;
          evidence.push('Access control requirements identified');
        } else {
          gaps.push('No access control requirements specified');
        }
        break;

      case 'encryption':
        if (specification.requirements.some(req => 
          req.description.toLowerCase().includes('encrypt') ||
          req.description.toLowerCase().includes('tls') ||
          req.description.toLowerCase().includes('ssl')
        )) {
          met = true;
          evidence.push('Encryption requirements found');
        } else {
          gaps.push('No encryption requirements specified');
        }
        break;

      case 'audit-trails':
        if (specification.requirements.some(req => 
          req.description.toLowerCase().includes('audit') ||
          req.description.toLowerCase().includes('log') ||
          req.description.toLowerCase().includes('trail')
        )) {
          met = true;
          evidence.push('Audit trail requirements found');
        } else {
          gaps.push('No audit trail requirements specified');
        }
        break;

      case 'data-protection':
        if (specification.requirements.some(req => 
          req.type === 'security' && (
            req.description.toLowerCase().includes('data protection') ||
            req.description.toLowerCase().includes('privacy') ||
            req.description.toLowerCase().includes('confidential')
          )
        )) {
          met = true;
          evidence.push('Data protection requirements found');
        } else {
          gaps.push('No data protection requirements specified');
        }
        break;

      default:
        // For other checkpoints, perform basic keyword matching
        const keywords = checkpoint.split('-');
        if (this.hasKeywords(specification, keywords)) {
          met = true;
          evidence.push(`Requirements found for ${checkpoint}`);
        } else {
          gaps.push(`No requirements found for ${checkpoint}`);
        }
        break;
    }

    return { met, evidence, gaps };
  }

  private hasKeywords(specification: Specification, keywords: string[]): boolean {
    const searchText = JSON.stringify(specification).toLowerCase();
    return keywords.some(keyword => searchText.includes(keyword.toLowerCase()));
  }

  private determineOverallStatus(
    requirements: ComplianceRequirementStatus[]
  ): ComplianceStatus['overallStatus'] {
    const metCount = requirements.filter(req => req.status === 'met').length;
    const totalCount = requirements.length;

    if (metCount === totalCount) {
      return 'compliant';
    } else if (metCount === 0) {
      return 'non-compliant';
    } else {
      return 'partial';
    }
  }

  private generateGaps(
    requirement: ComplianceStandard['requirements'][0],
    status: ComplianceRequirementStatus
  ): ComplianceGap[] {
    return status.gaps.map(gap => ({
      requirementId: requirement.id,
      description: gap,
      impact: requirement.mandatory ? 'high' : 'medium',
      remediation: this.generateRemediation(requirement.id, gap),
    }));
  }

  private generateRemediation(requirementId: string, gap: string): string[] {
    // This would contain specific remediation guidance
    // For now, provide generic guidance
    const remediations: string[] = [];

    if (gap.includes('security')) {
      remediations.push('Add security requirements section');
      remediations.push('Define security controls and measures');
      remediations.push('Include threat modeling and risk assessment');
    }

    if (gap.includes('access')) {
      remediations.push('Define authentication and authorization requirements');
      remediations.push('Specify role-based access controls');
      remediations.push('Include multi-factor authentication requirements');
    }

    if (gap.includes('audit')) {
      remediations.push('Add logging and monitoring requirements');
      remediations.push('Define audit trail specifications');
      remediations.push('Include compliance reporting procedures');
    }

    if (gap.includes('encryption')) {
      remediations.push('Specify encryption requirements for data at rest');
      remediations.push('Define encryption requirements for data in transit');
      remediations.push('Include key management procedures');
    }

    if (remediations.length === 0) {
      remediations.push('Review and add appropriate requirements');
      remediations.push('Consult compliance documentation');
    }

    return remediations;
  }

  private mapImpactToSeverity(impact: ComplianceGap['impact']): ValidationIssue['severity'] {
    switch (impact) {
      case 'critical':
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
      default:
        return 'info';
    }
  }

  private extractPathFromGap(gap: ComplianceGap): string {
    // Extract logical path based on requirement ID and gap description
    if (gap.description.includes('security')) {
      return 'requirements[type="security"]';
    }
    if (gap.description.includes('requirements')) {
      return 'requirements';
    }
    return 'compliance';
  }
}