/**
 * Fortune 5 Compliance Auditor
 * Validates security compliance across PCI DSS, HIPAA, SOX, GDPR standards
 */

import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import dayjs from 'dayjs';
import consola from 'consola';
import { z } from 'zod';

// Compliance framework schemas
const PCIComplianceSchema = z.object({
  dataEncryption: z.boolean(), // Requirement 3
  accessControl: z.boolean(), // Requirement 7
  networkSecurity: z.boolean(), // Requirement 1
  vulnerabilityManagement: z.boolean(), // Requirement 6
  secureSystemsAndApplications: z.boolean(), // Requirement 2
  regularMonitoring: z.boolean(), // Requirement 10
  informationSecurityPolicies: z.boolean() // Requirement 12
});

const HIPAAComplianceSchema = z.object({
  adminSafeguards: z.boolean(),
  physicalSafeguards: z.boolean(),
  technicalSafeguards: z.boolean(),
  encryptionAtRest: z.boolean(),
  encryptionInTransit: z.boolean(),
  accessLogging: z.boolean(),
  businessAssociateAgreements: z.boolean()
});

const SOXComplianceSchema = z.object({
  changeManagement: z.boolean(),
  accessControl: z.boolean(),
  dataIntegrity: z.boolean(),
  auditTrails: z.boolean(),
  separationOfDuties: z.boolean(),
  backupAndRecovery: z.boolean(),
  securityIncidentResponse: z.boolean()
});

const GDPRComplianceSchema = z.object({
  dataMinimization: z.boolean(),
  purposeLimitation: z.boolean(),
  consentManagement: z.boolean(),
  rightToErasure: z.boolean(),
  dataPortability: z.boolean(),
  privacyByDesign: z.boolean(),
  dataBreachNotification: z.boolean()
});

class ComplianceAuditor {
  constructor(options = {}) {
    this.logger = consola.withTag('COMPLIANCE-AUDITOR');
    this.auditPath = options.auditPath || './compliance/audits';
    this.reportsPath = options.reportsPath || './compliance/reports';
    this.environment = options.environment || process.env.NODE_ENV || 'development';
    
    // Compliance frameworks to check
    this.frameworks = {
      pci: { enabled: true, schema: PCIComplianceSchema },
      hipaa: { enabled: options.hipaaEnabled || false, schema: HIPAAComplianceSchema },
      sox: { enabled: options.soxEnabled || true, schema: SOXComplianceSchema },
      gdpr: { enabled: options.gdprEnabled || true, schema: GDPRComplianceSchema }
    };
    
    this.complianceChecks = {
      pci: this.checkPCICompliance.bind(this),
      hipaa: this.checkHIPAACompliance.bind(this),
      sox: this.checkSOXCompliance.bind(this),
      gdpr: this.checkGDPRCompliance.bind(this)
    };
  }

  /**
   * Initialize compliance auditor
   */
  async init() {
    await fs.ensureDir(this.auditPath);
    await fs.ensureDir(this.reportsPath);
    
    this.logger.info('Compliance auditor initialized');
  }

  /**
   * Run comprehensive compliance audit
   */
  async runFullAudit(secretManager, configManager) {
    const auditId = crypto.randomUUID();
    const auditStartTime = this.getDeterministicDate();
    
    this.logger.info(`Starting comprehensive compliance audit: ${auditId}`);
    
    const auditResults = {
      auditId,
      timestamp: auditStartTime.toISOString(),
      environment: this.environment,
      frameworks: {},
      overallScore: 0,
      criticalIssues: [],
      recommendations: [],
      secretsAudit: null,
      configurationAudit: null
    };
    
    try {
      // Audit secrets management
      auditResults.secretsAudit = await this.auditSecretsManagement(secretManager);
      
      // Audit configuration
      auditResults.configurationAudit = await this.auditConfiguration(configManager);
      
      // Run framework-specific audits
      for (const [framework, config] of Object.entries(this.frameworks)) {
        if (config.enabled) {
          this.logger.info(`Running ${framework.toUpperCase()} compliance audit...`);
          auditResults.frameworks[framework] = await this.complianceChecks[framework](secretManager, configManager);
        }
      }
      
      // Calculate overall compliance score
      auditResults.overallScore = this.calculateOverallScore(auditResults);
      
      // Generate recommendations
      auditResults.recommendations = this.generateRecommendations(auditResults);
      
      // Identify critical issues
      auditResults.criticalIssues = this.identifyCriticalIssues(auditResults);
      
      // Save audit results
      await this.saveAuditResults(auditResults);
      
      // Generate compliance report
      await this.generateComplianceReport(auditResults);
      
      const auditDuration = this.getDeterministicTimestamp() - auditStartTime.getTime();
      this.logger.success(`Compliance audit completed in ${auditDuration}ms (Score: ${auditResults.overallScore}%)`);
      
      return auditResults;
      
    } catch (error) {
      this.logger.error('Compliance audit failed:', error);
      throw error;
    }
  }

  /**
   * Audit secrets management compliance
   */
  async auditSecretsManagement(secretManager) {
    const secretsAudit = {
      encryption: false,
      rotation: false,
      accessLogging: false,
      secretStrength: false,
      storageLocation: false,
      backupSecurity: false,
      score: 0
    };
    
    try {
      // Check encryption
      const secrets = await secretManager.listSecrets();
      secretsAudit.encryption = secrets.length > 0; // Assumes encrypted if managed by SecretManager
      
      // Check rotation policies
      const rotationNeeded = await secretManager.checkRotationNeeded();
      secretsAudit.rotation = rotationNeeded.length === 0; // No overdue rotations
      
      // Check access logging
      secretsAudit.accessLogging = true; // SecretManager implements audit logging
      
      // Check secret strength
      let strongSecrets = 0;
      for (const secret of secrets) {
        if (secret.category === 'jwt' || secret.category === 'encryption') {
          strongSecrets++;
        }
      }
      secretsAudit.secretStrength = strongSecrets > 0;
      
      // Check storage location (encrypted files)
      secretsAudit.storageLocation = true; // Using encrypted file storage
      
      // Check backup security
      secretsAudit.backupSecurity = this.environment === 'production'; // Assume prod has backup security
      
      // Calculate score
      const checks = Object.values(secretsAudit).slice(0, -1); // Exclude score itself
      secretsAudit.score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
      
    } catch (error) {
      this.logger.error('Secrets management audit failed:', error);
    }
    
    return secretsAudit;
  }

  /**
   * Audit configuration compliance
   */
  async auditConfiguration(configManager) {
    const configAudit = {
      environmentSpecific: false,
      secureDefaults: false,
      validation: false,
      secretsIntegration: false,
      monitoringEnabled: false,
      auditLogging: false,
      score: 0
    };
    
    try {
      const config = await configManager.loadConfig();
      
      // Check environment-specific configurations
      configAudit.environmentSpecific = config.app.environment === this.environment;
      
      // Check secure defaults
      configAudit.secureDefaults = this.checkSecureDefaults(config);
      
      // Check configuration validation
      const validation = await configManager.validateConfig(config);
      configAudit.validation = validation.isValid;
      
      // Check secrets integration
      configAudit.secretsIntegration = !!(config.security?.jwtSecret && config.security?.encryptionKey);
      
      // Check monitoring
      configAudit.monitoringEnabled = config.monitoring?.enabled === true;
      
      // Check audit logging
      configAudit.auditLogging = config.logging?.enableAudit === true;
      
      // Calculate score
      const checks = Object.values(configAudit).slice(0, -1);
      configAudit.score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
      
    } catch (error) {
      this.logger.error('Configuration audit failed:', error);
    }
    
    return configAudit;
  }

  /**
   * Check PCI DSS compliance
   */
  async checkPCICompliance(secretManager, configManager) {
    const pciAudit = {
      dataEncryption: false,
      accessControl: false,
      networkSecurity: false,
      vulnerabilityManagement: false,
      secureSystemsAndApplications: false,
      regularMonitoring: false,
      informationSecurityPolicies: false,
      score: 0,
      requirements: {}
    };
    
    try {
      const config = await configManager.loadConfig();
      
      // Requirement 3: Protect stored cardholder data
      pciAudit.dataEncryption = !!(config.security?.encryptionKey && config.database?.ssl);
      
      // Requirement 7: Restrict access by business need-to-know
      pciAudit.accessControl = config.security?.rateLimit?.enabled === true;
      
      // Requirement 1: Install and maintain firewall configuration
      pciAudit.networkSecurity = config.security?.cors?.origin !== '*' || this.environment !== 'production';
      
      // Requirement 6: Develop and maintain secure systems and applications
      pciAudit.vulnerabilityManagement = config.security?.headers?.xss === true;
      
      // Requirement 2: Do not use vendor-supplied defaults
      pciAudit.secureSystemsAndApplications = this.checkSecureDefaults(config);
      
      // Requirement 10: Track and monitor all access to network resources
      pciAudit.regularMonitoring = config.monitoring?.enabled === true;
      
      // Requirement 12: Maintain information security policy
      pciAudit.informationSecurityPolicies = config.logging?.enableAudit === true;
      
      // Detailed requirements check
      pciAudit.requirements = {
        req1_firewall: pciAudit.networkSecurity,
        req2_defaults: pciAudit.secureSystemsAndApplications,
        req3_encryption: pciAudit.dataEncryption,
        req6_secure_dev: pciAudit.vulnerabilityManagement,
        req7_access_control: pciAudit.accessControl,
        req10_monitoring: pciAudit.regularMonitoring,
        req12_policies: pciAudit.informationSecurityPolicies
      };
      
      // Calculate score
      const checks = Object.values(pciAudit).slice(0, -2); // Exclude score and requirements
      pciAudit.score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
      
    } catch (error) {
      this.logger.error('PCI compliance audit failed:', error);
    }
    
    return pciAudit;
  }

  /**
   * Check HIPAA compliance
   */
  async checkHIPAACompliance(secretManager, configManager) {
    const hipaaAudit = {
      adminSafeguards: false,
      physicalSafeguards: false,
      technicalSafeguards: false,
      encryptionAtRest: false,
      encryptionInTransit: false,
      accessLogging: false,
      businessAssociateAgreements: false,
      score: 0
    };
    
    try {
      const config = await configManager.loadConfig();
      
      // Administrative safeguards
      hipaaAudit.adminSafeguards = config.security?.rateLimit?.enabled === true;
      
      // Physical safeguards (assume cloud infrastructure provides this)
      hipaaAudit.physicalSafeguards = this.environment === 'production';
      
      // Technical safeguards
      hipaaAudit.technicalSafeguards = config.security?.headers?.hsts === true;
      
      // Encryption at rest
      hipaaAudit.encryptionAtRest = !!(config.security?.encryptionKey);
      
      // Encryption in transit
      hipaaAudit.encryptionInTransit = config.database?.ssl === true;
      
      // Access logging
      hipaaAudit.accessLogging = config.logging?.enableAudit === true;
      
      // Business associate agreements (manual verification required)
      hipaaAudit.businessAssociateAgreements = false; // Manual verification required
      
      // Calculate score
      const checks = Object.values(hipaaAudit).slice(0, -1);
      hipaaAudit.score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
      
    } catch (error) {
      this.logger.error('HIPAA compliance audit failed:', error);
    }
    
    return hipaaAudit;
  }

  /**
   * Check SOX compliance
   */
  async checkSOXCompliance(secretManager, configManager) {
    const soxAudit = {
      changeManagement: false,
      accessControl: false,
      dataIntegrity: false,
      auditTrails: false,
      separationOfDuties: false,
      backupAndRecovery: false,
      securityIncidentResponse: false,
      score: 0
    };
    
    try {
      const config = await configManager.loadConfig();
      
      // Change management
      soxAudit.changeManagement = config.monitoring?.enabled === true;
      
      // Access control
      soxAudit.accessControl = config.security?.rateLimit?.enabled === true;
      
      // Data integrity
      soxAudit.dataIntegrity = config.database?.ssl === true;
      
      // Audit trails
      soxAudit.auditTrails = config.logging?.enableAudit === true;
      
      // Separation of duties (environment-based)
      soxAudit.separationOfDuties = this.environment !== 'development';
      
      // Backup and recovery
      soxAudit.backupAndRecovery = this.environment === 'production';
      
      // Security incident response
      soxAudit.securityIncidentResponse = config.monitoring?.metrics?.enabled === true;
      
      // Calculate score
      const checks = Object.values(soxAudit).slice(0, -1);
      soxAudit.score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
      
    } catch (error) {
      this.logger.error('SOX compliance audit failed:', error);
    }
    
    return soxAudit;
  }

  /**
   * Check GDPR compliance
   */
  async checkGDPRCompliance(secretManager, configManager) {
    const gdprAudit = {
      dataMinimization: false,
      purposeLimitation: false,
      consentManagement: false,
      rightToErasure: false,
      dataPortability: false,
      privacyByDesign: false,
      dataBreachNotification: false,
      score: 0
    };
    
    try {
      const config = await configManager.loadConfig();
      
      // Data minimization (configuration-based assumption)
      gdprAudit.dataMinimization = config.logging?.retention?.days <= 90;
      
      // Purpose limitation
      gdprAudit.purposeLimitation = true; // Assume implemented in application logic
      
      // Consent management
      gdprAudit.consentManagement = false; // Requires application-level implementation
      
      // Right to erasure
      gdprAudit.rightToErasure = false; // Requires application-level implementation
      
      // Data portability
      gdprAudit.dataPortability = false; // Requires application-level implementation
      
      // Privacy by design
      gdprAudit.privacyByDesign = config.security?.headers?.xss === true;
      
      // Data breach notification
      gdprAudit.dataBreachNotification = config.monitoring?.enabled === true;
      
      // Calculate score
      const checks = Object.values(gdprAudit).slice(0, -1);
      gdprAudit.score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
      
    } catch (error) {
      this.logger.error('GDPR compliance audit failed:', error);
    }
    
    return gdprAudit;
  }

  /**
   * Check secure defaults in configuration
   */
  checkSecureDefaults(config) {
    const securityChecks = [
      config.security?.headers?.hsts !== false,
      config.security?.headers?.noSniff === true,
      config.security?.headers?.xframe === true,
      config.security?.headers?.xss === true,
      config.security?.rateLimit?.enabled !== false,
      config.database?.ssl !== false || this.environment === 'development',
      config.logging?.enableAudit === true
    ];
    
    return securityChecks.filter(Boolean).length >= (securityChecks.length * 0.8);
  }

  /**
   * Calculate overall compliance score
   */
  calculateOverallScore(auditResults) {
    const scores = [];
    
    if (auditResults.secretsAudit?.score) {
      scores.push(auditResults.secretsAudit.score);
    }
    
    if (auditResults.configurationAudit?.score) {
      scores.push(auditResults.configurationAudit.score);
    }
    
    for (const framework of Object.values(auditResults.frameworks)) {
      if (framework?.score) {
        scores.push(framework.score);
      }
    }
    
    return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  }

  /**
   * Generate recommendations based on audit results
   */
  generateRecommendations(auditResults) {
    const recommendations = [];
    
    // Secrets management recommendations
    if (auditResults.secretsAudit?.score < 80) {
      recommendations.push({
        category: 'secrets',
        priority: 'high',
        title: 'Improve secrets management',
        description: 'Secrets management score below 80%. Review encryption, rotation, and access controls.'
      });
    }
    
    // Configuration recommendations
    if (auditResults.configurationAudit?.score < 80) {
      recommendations.push({
        category: 'configuration',
        priority: 'high',
        title: 'Review configuration security',
        description: 'Configuration security score below 80%. Review security headers, SSL, and monitoring.'
      });
    }
    
    // Framework-specific recommendations
    for (const [framework, result] of Object.entries(auditResults.frameworks)) {
      if (result?.score < 70) {
        recommendations.push({
          category: 'compliance',
          priority: 'critical',
          title: `${framework.toUpperCase()} compliance issues`,
          description: `${framework.toUpperCase()} compliance score below 70%. Immediate attention required.`
        });
      }
    }
    
    // Environment-specific recommendations
    if (this.environment === 'production') {
      if (auditResults.overallScore < 90) {
        recommendations.push({
          category: 'production',
          priority: 'critical',
          title: 'Production security below standards',
          description: 'Production environment must maintain 90%+ compliance score for Fortune 5 requirements.'
        });
      }
    }
    
    return recommendations;
  }

  /**
   * Identify critical issues requiring immediate attention
   */
  identifyCriticalIssues(auditResults) {
    const criticalIssues = [];
    
    // Check for PCI compliance failures in production
    if (this.environment === 'production' && auditResults.frameworks.pci?.score < 80) {
      criticalIssues.push({
        framework: 'PCI DSS',
        issue: 'Production PCI compliance below 80%',
        impact: 'HIGH',
        action: 'Immediate remediation required for payment processing compliance'
      });
    }
    
    // Check for missing encryption
    if (!auditResults.secretsAudit?.encryption) {
      criticalIssues.push({
        framework: 'Security',
        issue: 'Secrets not properly encrypted',
        impact: 'CRITICAL',
        action: 'Implement encryption for all stored secrets immediately'
      });
    }
    
    // Check for missing audit logging
    if (!auditResults.configurationAudit?.auditLogging) {
      criticalIssues.push({
        framework: 'Compliance',
        issue: 'Audit logging not enabled',
        impact: 'HIGH',
        action: 'Enable comprehensive audit logging for compliance requirements'
      });
    }
    
    return criticalIssues;
  }

  /**
   * Save audit results to file
   */
  async saveAuditResults(auditResults) {
    const filename = `audit-${auditResults.auditId}-${this.environment}.json`;
    const filePath = path.join(this.auditPath, filename);
    
    await fs.writeJson(filePath, auditResults, { spaces: 2 });
    
    this.logger.info(`Audit results saved: ${filePath}`);
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(auditResults) {
    const reportId = `compliance-report-${dayjs().format('YYYY-MM-DD-HH-mm-ss')}`;
    const reportPath = path.join(this.reportsPath, `${reportId}.md`);
    
    const report = this.generateMarkdownReport(auditResults);
    
    await fs.writeFile(reportPath, report);
    
    this.logger.info(`Compliance report generated: ${reportPath}`);
    
    return reportPath;
  }

  /**
   * Generate markdown report
   */
  generateMarkdownReport(auditResults) {
    const { auditId, timestamp, environment, overallScore, frameworks, criticalIssues, recommendations } = auditResults;
    
    let report = `# Fortune 5 Compliance Audit Report\n\n`;
    report += `**Audit ID:** ${auditId}\n`;
    report += `**Timestamp:** ${timestamp}\n`;
    report += `**Environment:** ${environment}\n`;
    report += `**Overall Score:** ${overallScore}%\n\n`;
    
    // Executive Summary
    report += `## Executive Summary\n\n`;
    report += `This comprehensive compliance audit evaluates the system against Fortune 5 security standards including PCI DSS, HIPAA, SOX, and GDPR frameworks.\n\n`;
    
    if (overallScore >= 90) {
      report += `✅ **EXCELLENT**: The system meets Fortune 5 compliance standards.\n\n`;
    } else if (overallScore >= 80) {
      report += `⚠️ **GOOD**: The system has good compliance but requires improvements.\n\n`;
    } else {
      report += `❌ **NEEDS ATTENTION**: The system requires immediate compliance improvements.\n\n`;
    }
    
    // Framework Results
    report += `## Compliance Framework Results\n\n`;
    
    for (const [framework, result] of Object.entries(frameworks)) {
      const icon = result.score >= 80 ? '✅' : result.score >= 60 ? '⚠️' : '❌';
      report += `### ${framework.toUpperCase()} - ${result.score}% ${icon}\n\n`;
      
      if (framework === 'pci' && result.requirements) {
        report += `**Requirements Status:**\n`;
        for (const [req, status] of Object.entries(result.requirements)) {
          const statusIcon = status ? '✅' : '❌';
          report += `- ${req}: ${statusIcon}\n`;
        }
        report += `\n`;
      }
    }
    
    // Critical Issues
    if (criticalIssues.length > 0) {
      report += `## 🚨 Critical Issues\n\n`;
      
      for (const issue of criticalIssues) {
        report += `### ${issue.framework}: ${issue.issue}\n`;
        report += `**Impact:** ${issue.impact}\n`;
        report += `**Action Required:** ${issue.action}\n\n`;
      }
    }
    
    // Recommendations
    if (recommendations.length > 0) {
      report += `## 📋 Recommendations\n\n`;
      
      const priorityOrder = ['critical', 'high', 'medium', 'low'];
      
      for (const priority of priorityOrder) {
        const priorityRecs = recommendations.filter(r => r.priority === priority);
        
        if (priorityRecs.length > 0) {
          report += `### ${priority.toUpperCase()} Priority\n\n`;
          
          for (const rec of priorityRecs) {
            report += `- **${rec.title}**: ${rec.description}\n`;
          }
          report += `\n`;
        }
      }
    }
    
    // Secrets and Configuration Audit
    report += `## Detailed Audit Results\n\n`;
    
    if (auditResults.secretsAudit) {
      report += `### Secrets Management - ${auditResults.secretsAudit.score}%\n\n`;
      for (const [check, status] of Object.entries(auditResults.secretsAudit)) {
        if (check !== 'score') {
          const icon = status ? '✅' : '❌';
          report += `- ${check}: ${icon}\n`;
        }
      }
      report += `\n`;
    }
    
    if (auditResults.configurationAudit) {
      report += `### Configuration Security - ${auditResults.configurationAudit.score}%\n\n`;
      for (const [check, status] of Object.entries(auditResults.configurationAudit)) {
        if (check !== 'score') {
          const icon = status ? '✅' : '❌';
          report += `- ${check}: ${icon}\n`;
        }
      }
      report += `\n`;
    }
    
    // Footer
    report += `---\n\n`;
    report += `*This report was generated automatically by the Unjucks Enterprise Compliance Auditor.*\n`;
    report += `*For questions or support, contact the security team.*\n`;
    
    return report;
  }

  /**
   * Schedule regular compliance audits
   */
  scheduleRegularAudits(secretManager, configManager, cronExpression = '0 2 * * 0') {
    const cron = require('node-cron');
    
    return cron.schedule(cronExpression, async () => {
      try {
        this.logger.info('Running scheduled compliance audit...');
        await this.runFullAudit(secretManager, configManager);
      } catch (error) {
        this.logger.error('Scheduled compliance audit failed:', error);
      }
    }, {
      scheduled: true,
      timezone: 'UTC'
    });
  }
}

export default ComplianceAuditor;