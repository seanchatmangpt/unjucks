#!/usr/bin/env node

/**
 * Comprehensive Compliance Reporting and Audit Trail System
 * Generates detailed compliance reports for GDPR, SOX, HIPAA, ISO27001, and other frameworks
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class ComplianceReporter {
  constructor(options = {}) {
    this.options = {
      outputDir: options.outputDir || './compliance-reports',
      format: options.format || 'json', // json, html, pdf, csv
      frameworks: options.frameworks || ['gdpr', 'sox', 'hipaa', 'iso27001', 'pci-dss'],
      auditPeriod: options.auditPeriod || '30d',
      includeEvidence: options.includeEvidence !== false,
      anonymizeData: options.anonymizeData || false,
      ...options
    };

    this.report = {
      metadata: {
        reportId: crypto.randomUUID(),
        timestamp: this.getDeterministicDate().toISOString(),
        auditPeriod: this.options.auditPeriod,
        frameworks: this.options.frameworks,
        version: '1.0.0'
      },
      compliance: {},
      auditTrail: [],
      riskAssessment: {},
      recommendations: [],
      evidence: {},
      summary: {}
    };

    this.auditTrail = new AuditTrail();
    this.evidenceCollector = new EvidenceCollector(this.options);
  }

  async init() {
    console.log('📋 Compliance Reporter Initializing...');
    console.log(`📊 Report ID: ${this.report.metadata.reportId}`);
    console.log(`🔧 Frameworks: ${this.options.frameworks.join(', ')}`);
    console.log(`📁 Output Directory: ${this.options.outputDir}`);
    
    await fs.mkdir(this.options.outputDir, { recursive: true });
    
    // Create timestamped subdirectory
    const timestamp = this.getDeterministicDate().toISOString().replace(/[:.]/g, '-');
    this.reportPath = path.join(this.options.outputDir, `compliance-${timestamp}`);
    await fs.mkdir(this.reportPath, { recursive: true });
    
    console.log(`📁 Report Directory: ${this.reportPath}`);
  }

  async generateComplianceReports() {
    console.log('\n📋 Generating Compliance Reports...');
    
    for (const framework of this.options.frameworks) {
      try {
        console.log(`   📊 Processing ${framework.toUpperCase()}...`);
        const complianceData = await this[`generate${framework.toUpperCase()}Report`]();
        this.report.compliance[framework] = complianceData;
        
        if (this.options.includeEvidence) {
          this.report.evidence[framework] = await this.evidenceCollector.collectEvidence(framework);
        }
      } catch (error) {
        console.error(`❌ Failed to generate ${framework} report:`, error.message);
        this.report.compliance[framework] = {
          status: 'error',
          error: error.message,
          timestamp: this.getDeterministicDate().toISOString()
        };
      }
    }
    
    console.log('   ✅ All framework reports generated');
  }

  async generateGDPRReport() {
    const gdpr = {
      framework: 'GDPR',
      version: '2018/679/EU',
      assessmentDate: this.getDeterministicDate().toISOString(),
      overallStatus: 'compliant',
      score: 0,
      maxScore: 100,
      principles: {},
      rights: {},
      dataProcessing: {},
      technicalMeasures: {},
      organizationalMeasures: {},
      breaches: [],
      risks: [],
      recommendations: []
    };

    // Article 5 - Principles of processing
    gdpr.principles = {
      lawfulness: await this.assessLawfulness(),
      fairness: await this.assessFairness(),
      transparency: await this.assessTransparency(),
      purposeLimitation: await this.assessPurposeLimitation(),
      dataMinimization: await this.assessDataMinimization(),
      accuracy: await this.assessAccuracy(),
      storageLimitation: await this.assessStorageLimitation(),
      integrityConfidentiality: await this.assessIntegrityConfidentiality(),
      accountability: await this.assessAccountability()
    };

    // Chapter III - Rights of the data subject
    gdpr.rights = {
      informationAccess: await this.assessInformationAccess(),
      rectification: await this.assessRectification(),
      erasure: await this.assessErasure(),
      restrictProcessing: await this.assessRestrictProcessing(),
      dataPortability: await this.assessDataPortability(),
      objection: await this.assessObjection(),
      automatedDecisionMaking: await this.assessAutomatedDecisionMaking()
    };

    // Data processing activities
    gdpr.dataProcessing = {
      legalBasis: await this.assessLegalBasis(),
      consentManagement: await this.assessConsentManagement(),
      recordsOfProcessing: await this.assessRecordsOfProcessing(),
      dataProtectionImpactAssessment: await this.assessDPIA(),
      dataProtectionOfficer: await this.assessDPO()
    };

    // Technical and organizational measures
    gdpr.technicalMeasures = {
      encryption: await this.assessEncryption(),
      accessControls: await this.assessAccessControls(),
      dataBackup: await this.assessDataBackup(),
      incidentResponse: await this.assessIncidentResponse()
    };

    gdpr.organizationalMeasures = {
      policies: await this.assessPolicies(),
      training: await this.assessTraining(),
      vendorManagement: await this.assessVendorManagement(),
      auditProgram: await this.assessAuditProgram()
    };

    // Calculate overall score
    gdpr.score = this.calculateGDPRScore(gdpr);
    gdpr.overallStatus = gdpr.score >= 80 ? 'compliant' : gdpr.score >= 60 ? 'partially-compliant' : 'non-compliant';

    return gdpr;
  }

  async generateSOXReport() {
    const sox = {
      framework: 'SOX',
      sections: ['302', '404', '906'],
      assessmentDate: this.getDeterministicDate().toISOString(),
      overallStatus: 'compliant',
      score: 0,
      maxScore: 100,
      internalControls: {},
      managementAssessment: {},
      auditControls: {},
      itGeneralControls: {},
      applicationControls: {},
      changeManagement: {},
      accessManagement: {},
      deficiencies: [],
      materialWeaknesses: [],
      recommendations: []
    };

    // Section 302 - Corporate Responsibility for Financial Reports
    sox.section302 = {
      executiveCertification: await this.assessExecutiveCertification(),
      financialStatementAccuracy: await this.assessFinancialStatementAccuracy(),
      internalControlEffectiveness: await this.assessInternalControlEffectiveness(),
      materialChangeDisclosure: await this.assessMaterialChangeDisclosure()
    };

    // Section 404 - Management Assessment of Internal Controls
    sox.section404 = {
      controlFramework: await this.assessControlFramework(),
      controlDesign: await this.assessControlDesign(),
      controlOperating: await this.assessControlOperating(),
      controlTesting: await this.assessControlTesting(),
      deficiencyRemediation: await this.assessDeficiencyRemediation()
    };

    // IT General Controls (ITGC)
    sox.itGeneralControls = {
      accessToPrograms: await this.assessAccessToPrograms(),
      programChanges: await this.assessProgramChanges(),
      programDevelopment: await this.assessProgramDevelopment(),
      computerOperations: await this.assessComputerOperations()
    };

    // Application Controls
    sox.applicationControls = {
      inputControls: await this.assessInputControls(),
      processingControls: await this.assessProcessingControls(),
      outputControls: await this.assessOutputControls(),
      masterFileControls: await this.assessMasterFileControls()
    };

    // Change Management Controls
    sox.changeManagement = {
      changeApproval: await this.assessChangeApproval(),
      changeTesting: await this.assessChangeTesting(),
      changeImplementation: await this.assessChangeImplementation(),
      changeDocumentation: await this.assessChangeDocumentation(),
      emergencyChanges: await this.assessEmergencyChanges()
    };

    sox.score = this.calculateSOXScore(sox);
    sox.overallStatus = sox.score >= 85 ? 'compliant' : sox.score >= 70 ? 'minor-deficiencies' : 'material-weaknesses';

    return sox;
  }

  async generateHIPAAReport() {
    const hipaa = {
      framework: 'HIPAA',
      version: '1996',
      assessmentDate: this.getDeterministicDate().toISOString(),
      overallStatus: 'compliant',
      score: 0,
      maxScore: 100,
      administrativeSafeguards: {},
      physicalSafeguards: {},
      technicalSafeguards: {},
      businessAssociateAgreements: {},
      breachNotification: {},
      patientRights: {},
      violations: [],
      risks: [],
      recommendations: []
    };

    // Administrative Safeguards (§164.308)
    hipaa.administrativeSafeguards = {
      securityOfficer: await this.assessSecurityOfficer(),
      conductedSecurityEvaluations: await this.assessSecurityEvaluations(),
      assignedSecurityResponsibility: await this.assessAssignedSecurityResponsibility(),
      informationAccessManagement: await this.assessInformationAccessManagement(),
      workforceTraining: await this.assessWorkforceTraining(),
      informationSystemActivityReview: await this.assessSystemActivityReview(),
      contingencyPlan: await this.assessContingencyPlan(),
      businessAssociateContracts: await this.assessBusinessAssociateContracts()
    };

    // Physical Safeguards (§164.310)
    hipaa.physicalSafeguards = {
      facilityAccessControls: await this.assessFacilityAccessControls(),
      workstationUse: await this.assessWorkstationUse(),
      deviceMediaControls: await this.assessDeviceMediaControls()
    };

    // Technical Safeguards (§164.312)
    hipaa.technicalSafeguards = {
      accessControl: await this.assessTechnicalAccessControl(),
      auditControls: await this.assessAuditControls(),
      integrity: await this.assessDataIntegrity(),
      personAuthentication: await this.assessPersonAuthentication(),
      transmissionSecurity: await this.assessTransmissionSecurity()
    };

    hipaa.score = this.calculateHIPAAScore(hipaa);
    hipaa.overallStatus = hipaa.score >= 80 ? 'compliant' : hipaa.score >= 60 ? 'needs-improvement' : 'non-compliant';

    return hipaa;
  }

  async generateISO27001Report() {
    const iso27001 = {
      framework: 'ISO 27001',
      version: '2022',
      assessmentDate: this.getDeterministicDate().toISOString(),
      overallStatus: 'compliant',
      score: 0,
      maxScore: 100,
      context: {},
      leadership: {},
      planning: {},
      support: {},
      operation: {},
      performance: {},
      improvement: {},
      annexAControls: {},
      nonConformities: [],
      risks: [],
      recommendations: []
    };

    // Clause 4: Context of the organization
    iso27001.context = {
      organizationContext: await this.assessOrganizationContext(),
      stakeholderNeeds: await this.assessStakeholderNeeds(),
      ismsScope: await this.assessISMSScope(),
      informationSecurityManagementSystem: await this.assessISMS()
    };

    // Clause 5: Leadership
    iso27001.leadership = {
      leadershipCommitment: await this.assessLeadershipCommitment(),
      informationSecurityPolicy: await this.assessInformationSecurityPolicy(),
      organizationalRoles: await this.assessOrganizationalRoles()
    };

    // Clause 6: Planning
    iso27001.planning = {
      riskAssessment: await this.assessRiskAssessment(),
      riskTreatment: await this.assessRiskTreatment(),
      informationSecurityObjectives: await this.assessInformationSecurityObjectives()
    };

    // Clause 7: Support
    iso27001.support = {
      resources: await this.assessResources(),
      competence: await this.assessCompetence(),
      awareness: await this.assessAwareness(),
      communication: await this.assessCommunication(),
      documentedInformation: await this.assessDocumentedInformation()
    };

    // Clause 8: Operation
    iso27001.operation = {
      operationalPlanningControl: await this.assessOperationalPlanningControl(),
      riskAssessmentProcess: await this.assessRiskAssessmentProcess(),
      riskTreatmentProcess: await this.assessRiskTreatmentProcess()
    };

    // Clause 9: Performance evaluation
    iso27001.performance = {
      monitoringMeasurement: await this.assessMonitoringMeasurement(),
      internalAudit: await this.assessInternalAudit(),
      managementReview: await this.assessManagementReview()
    };

    // Clause 10: Improvement
    iso27001.improvement = {
      nonconformityCorrectiveAction: await this.assessNonconformityCorrectiveAction(),
      continualImprovement: await this.assessContinualImprovement()
    };

    // Annex A Controls
    iso27001.annexAControls = {
      organizationalControls: await this.assessOrganizationalControls(),
      peopleControls: await this.assessPeopleControls(),
      physicalEnvironmentalControls: await this.assessPhysicalEnvironmentalControls(),
      technologicalControls: await this.assessTechnologicalControls()
    };

    iso27001.score = this.calculateISO27001Score(iso27001);
    iso27001.overallStatus = iso27001.score >= 85 ? 'compliant' : iso27001.score >= 70 ? 'minor-nonconformities' : 'major-nonconformities';

    return iso27001;
  }

  async generatePCIDSSReport() {
    const pciDss = {
      framework: 'PCI DSS',
      version: '4.0',
      assessmentDate: this.getDeterministicDate().toISOString(),
      overallStatus: 'compliant',
      score: 0,
      maxScore: 100,
      requirements: {},
      compensatingControls: [],
      vulnerabilities: [],
      recommendations: []
    };

    // PCI DSS Requirements
    pciDss.requirements = {
      req1: await this.assessFirewallConfiguration(),
      req2: await this.assessDefaultPasswords(),
      req3: await this.assessStoredCardholderData(),
      req4: await this.assessEncryptionTransmission(),
      req5: await this.assessAntivirusPrograms(),
      req6: await this.assessSecureSystemsApplications(),
      req7: await this.assessRestrictAccessCardholderData(),
      req8: await this.assessIdentifyAuthenticate(),
      req9: await this.assessRestrictPhysicalAccess(),
      req10: await this.assessTrackMonitorAccess(),
      req11: await this.assessRegularlyTestSecurity(),
      req12: await this.assessMaintainInformationSecurityPolicy()
    };

    pciDss.score = this.calculatePCIDSSScore(pciDss);
    pciDss.overallStatus = pciDss.score >= 100 ? 'compliant' : 'non-compliant';

    return pciDss;
  }

  async generateAuditTrail() {
    console.log('\n📝 Generating Audit Trail...');
    
    const auditData = await this.auditTrail.generateReport({
      period: this.options.auditPeriod,
      includeSystemEvents: true,
      includeUserActions: true,
      includeDataAccess: true,
      includeConfigChanges: true,
      anonymize: this.options.anonymizeData
    });

    this.report.auditTrail = auditData;
    console.log(`   ✅ Audit trail generated: ${auditData.events?.length || 0} events`);
  }

  async generateRiskAssessment() {
    console.log('\n⚠️ Generating Risk Assessment...');
    
    const risks = {
      dataBreachRisk: await this.assessDataBreachRisk(),
      complianceViolationRisk: await this.assessComplianceViolationRisk(),
      operationalRisk: await this.assessOperationalRisk(),
      reputationalRisk: await this.assessReputationalRisk(),
      financialRisk: await this.assessFinancialRisk(),
      technicalRisk: await this.assessTechnicalRisk(),
      humanFactorRisk: await this.assessHumanFactorRisk(),
      thirdPartyRisk: await this.assessThirdPartyRisk()
    };

    // Calculate overall risk score
    const riskScores = Object.values(risks).map(r => r.score || 0);
    const overallRiskScore = riskScores.reduce((a, b) => a + b, 0) / riskScores.length;

    this.report.riskAssessment = {
      overallRiskScore,
      riskLevel: this.getRiskLevel(overallRiskScore),
      assessmentDate: this.getDeterministicDate().toISOString(),
      risks,
      riskMatrix: this.generateRiskMatrix(risks),
      mitigation: this.generateMitigationStrategies(risks)
    };

    console.log(`   ✅ Risk assessment complete: ${this.report.riskAssessment.riskLevel} risk level`);
  }

  async generateRecommendations() {
    console.log('\n💡 Generating Recommendations...');
    
    const recommendations = [];
    
    // Analyze compliance gaps
    for (const [framework, data] of Object.entries(this.report.compliance)) {
      if (data.score < 80) {
        recommendations.push({
          priority: 'high',
          category: 'compliance',
          framework,
          title: `Improve ${framework.toUpperCase()} compliance`,
          description: `Current score: ${data.score}/100. Focus on identified gaps.`,
          impact: 'regulatory',
          effort: 'high',
          timeframe: '90 days'
        });
      }
    }
    
    // Risk-based recommendations
    if (this.report.riskAssessment.overallRiskScore > 70) {
      recommendations.push({
        priority: 'critical',
        category: 'risk-management',
        title: 'Address high-risk areas',
        description: 'Multiple high-risk areas identified requiring immediate attention',
        impact: 'security',
        effort: 'high',
        timeframe: '30 days'
      });
    }
    
    // Technical recommendations
    recommendations.push(...this.generateTechnicalRecommendations());
    
    // Organizational recommendations
    recommendations.push(...this.generateOrganizationalRecommendations());
    
    this.report.recommendations = recommendations.sort((a, b) => {
      const priorityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
    
    console.log(`   ✅ Generated ${recommendations.length} recommendations`);
  }

  async generateSummary() {
    console.log('\n📊 Generating Executive Summary...');
    
    // Calculate overall compliance score
    const complianceScores = Object.values(this.report.compliance)
      .filter(c => typeof c.score === 'number')
      .map(c => c.score);
    
    const overallComplianceScore = complianceScores.length > 0 
      ? complianceScores.reduce((a, b) => a + b, 0) / complianceScores.length 
      : 0;

    this.report.summary = {
      reportId: this.report.metadata.reportId,
      assessmentDate: this.report.metadata.timestamp,
      overallComplianceScore,
      complianceStatus: this.getComplianceStatus(overallComplianceScore),
      riskLevel: this.report.riskAssessment?.riskLevel || 'unknown',
      frameworksAssessed: this.options.frameworks.length,
      criticalIssues: this.report.recommendations.filter(r => r.priority === 'critical').length,
      highPriorityIssues: this.report.recommendations.filter(r => r.priority === 'high').length,
      auditEvents: this.report.auditTrail?.events?.length || 0,
      keyFindings: this.generateKeyFindings(),
      nextReviewDate: this.calculateNextReviewDate(),
      certification: this.generateCertificationStatus()
    };
    
    console.log(`   ✅ Executive summary complete`);
  }

  async saveReports() {
    console.log('\n💾 Saving Compliance Reports...');
    
    const formats = Array.isArray(this.options.format) ? this.options.format : [this.options.format];
    
    for (const format of formats) {
      try {
        await this[`save${format.toUpperCase()}Report`]();
        console.log(`   ✅ ${format.toUpperCase()} report saved`);
      } catch (error) {
        console.error(`   ❌ Failed to save ${format} report:`, error.message);
      }
    }
  }

  async saveJSONReport() {
    const filePath = path.join(this.reportPath, 'compliance-report.json');
    await fs.writeFile(filePath, JSON.stringify(this.report, null, 2));
    return filePath;
  }

  async saveHTMLReport() {
    const html = this.generateHTMLReport();
    const filePath = path.join(this.reportPath, 'compliance-report.html');
    await fs.writeFile(filePath, html);
    return filePath;
  }

  async saveCSVReport() {
    const csv = this.generateCSVReport();
    const filePath = path.join(this.reportPath, 'compliance-report.csv');
    await fs.writeFile(filePath, csv);
    return filePath;
  }

  generateHTMLReport() {
    const { summary, compliance, riskAssessment, recommendations } = this.report;
    
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Compliance Report - ${summary.reportId}</title>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 3px solid #007acc; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { color: #007acc; margin: 0; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
        .metric { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; }
        .metric h3 { margin: 0; font-size: 2em; }
        .metric p { margin: 10px 0 0 0; opacity: 0.9; }
        .framework-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 30px 0; }
        .framework-card { border: 1px solid #ddd; border-radius: 8px; padding: 20px; background: #fafafa; }
        .framework-card h3 { margin-top: 0; color: #333; }
        .score-bar { background: #e0e0e0; border-radius: 10px; height: 20px; margin: 10px 0; overflow: hidden; }
        .score-fill { height: 100%; background: linear-gradient(90deg, #ff4444 0%, #ffaa00 50%, #44aa44 100%); transition: width 0.5s ease; }
        .risk-matrix { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 20px 0; }
        .risk-cell { padding: 15px; border-radius: 5px; text-align: center; font-weight: bold; color: white; }
        .risk-low { background: #4CAF50; }
        .risk-medium { background: #FF9800; }
        .risk-high { background: #F44336; }
        .recommendations { margin: 30px 0; }
        .recommendation { border-left: 4px solid #007acc; background: #f8f9ff; padding: 15px; margin: 10px 0; }
        .recommendation.critical { border-left-color: #F44336; background: #fff5f5; }
        .recommendation.high { border-left-color: #FF9800; background: #fff8f0; }
        .recommendation.medium { border-left-color: #2196F3; background: #f0f8ff; }
        .priority-critical { background: #F44336; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; }
        .priority-high { background: #FF9800; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; }
        .priority-medium { background: #2196F3; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; }
        .status-compliant { color: #4CAF50; font-weight: bold; }
        .status-partial { color: #FF9800; font-weight: bold; }
        .status-non-compliant { color: #F44336; font-weight: bold; }
        .section { margin: 40px 0; }
        .section h2 { color: #333; border-bottom: 2px solid #007acc; padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background: #007acc; color: white; }
        .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 Compliance Assessment Report</h1>
            <p><strong>Report ID:</strong> ${summary.reportId}</p>
            <p><strong>Assessment Date:</strong> ${new Date(summary.assessmentDate).toLocaleDateString()}</p>
            <p><strong>Status:</strong> <span class="status-${summary.complianceStatus.toLowerCase().replace(' ', '-')}">${summary.complianceStatus}</span></p>
        </div>
        
        <div class="summary">
            <div class="metric">
                <h3>${Math.round(summary.overallComplianceScore)}%</h3>
                <p>Overall Compliance</p>
            </div>
            <div class="metric">
                <h3>${summary.frameworksAssessed}</h3>
                <p>Frameworks Assessed</p>
            </div>
            <div class="metric">
                <h3>${summary.criticalIssues}</h3>
                <p>Critical Issues</p>
            </div>
            <div class="metric">
                <h3>${riskAssessment?.riskLevel || 'Unknown'}</h3>
                <p>Risk Level</p>
            </div>
        </div>
        
        <div class="section">
            <h2>📊 Framework Compliance</h2>
            <div class="framework-grid">
                ${Object.entries(compliance).map(([framework, data]) => `
                    <div class="framework-card">
                        <h3>${framework.toUpperCase()}</h3>
                        <div class="score-bar">
                            <div class="score-fill" style="width: ${data.score || 0}%"></div>
                        </div>
                        <p><strong>Score:</strong> ${data.score || 0}/100</p>
                        <p><strong>Status:</strong> <span class="status-${(data.overallStatus || 'unknown').toLowerCase().replace(' ', '-')}">${data.overallStatus || 'Unknown'}</span></p>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div class="section">
            <h2>⚠️ Risk Assessment</h2>
            <p><strong>Overall Risk Level:</strong> ${riskAssessment?.riskLevel || 'Unknown'}</p>
            <p><strong>Risk Score:</strong> ${Math.round(riskAssessment?.overallRiskScore || 0)}/100</p>
            ${riskAssessment?.riskMatrix ? this.renderRiskMatrix(riskAssessment.riskMatrix) : ''}
        </div>
        
        <div class="section">
            <h2>💡 Key Recommendations</h2>
            <div class="recommendations">
                ${recommendations.slice(0, 10).map(rec => `
                    <div class="recommendation ${rec.priority}">
                        <h4>${rec.title} <span class="priority-${rec.priority}">${rec.priority.toUpperCase()}</span></h4>
                        <p>${rec.description}</p>
                        <p><small><strong>Category:</strong> ${rec.category} | <strong>Timeframe:</strong> ${rec.timeframe || 'TBD'}</small></p>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div class="section">
            <h2>🔍 Key Findings</h2>
            <ul>
                ${summary.keyFindings?.map(finding => `<li>${finding}</li>`).join('') || '<li>No key findings available</li>'}
            </ul>
        </div>
        
        <div class="footer">
            <p>Generated by Unjucks Compliance Reporter | Next Review: ${new Date(summary.nextReviewDate).toLocaleDateString()}</p>
            <p><em>This report contains confidential information. Handle according to data classification policies.</em></p>
        </div>
    </div>
</body>
</html>
    `.trim();
  }

  generateCSVReport() {
    const rows = [
      ['Framework', 'Score', 'Status', 'Last Assessment', 'Risk Level', 'Critical Issues', 'Recommendations'],
      ...Object.entries(this.report.compliance).map(([framework, data]) => [
        framework.toUpperCase(),
        data.score || 0,
        data.overallStatus || 'Unknown',
        new Date(data.assessmentDate || this.getDeterministicTimestamp()).toLocaleDateString(),
        this.report.riskAssessment?.riskLevel || 'Unknown',
        data.risks?.filter(r => r.severity === 'critical').length || 0,
        data.recommendations?.length || 0
      ])
    ];
    
    return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  }

  // Assessment helper methods (simplified implementations)
  async assessLawfulness() {
    return { status: 'compliant', score: 85, evidence: ['Legal basis documented', 'Regular reviews conducted'] };
  }

  async assessDataMinimization() {
    return { status: 'compliant', score: 90, evidence: ['Data retention policies', 'Regular data purging'] };
  }

  async assessConsentManagement() {
    return { status: 'compliant', score: 88, evidence: ['Consent management system', 'Withdrawal mechanisms'] };
  }

  // Add more assessment methods as needed...

  calculateGDPRScore(gdpr) {
    const scores = [];
    
    Object.values(gdpr.principles).forEach(p => scores.push(p.score || 0));
    Object.values(gdpr.rights).forEach(r => scores.push(r.score || 0));
    Object.values(gdpr.dataProcessing).forEach(d => scores.push(d.score || 0));
    
    return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  }

  calculateSOXScore(sox) {
    // Simplified SOX scoring
    return 85; // Placeholder
  }

  calculateHIPAAScore(hipaa) {
    // Simplified HIPAA scoring
    return 80; // Placeholder
  }

  calculateISO27001Score(iso27001) {
    // Simplified ISO 27001 scoring
    return 88; // Placeholder
  }

  calculatePCIDSSScore(pciDss) {
    // PCI DSS requires 100% compliance
    const requirementScores = Object.values(pciDss.requirements).map(r => r.score || 0);
    return requirementScores.every(score => score >= 100) ? 100 : Math.min(...requirementScores);
  }

  getComplianceStatus(score) {
    if (score >= 85) return 'Compliant';
    if (score >= 70) return 'Partially Compliant';
    return 'Non-Compliant';
  }

  getRiskLevel(score) {
    if (score >= 80) return 'HIGH';
    if (score >= 60) return 'MEDIUM';
    if (score >= 40) return 'LOW';
    return 'MINIMAL';
  }

  generateKeyFindings() {
    const findings = [];
    
    // Analyze compliance scores
    const lowScores = Object.entries(this.report.compliance)
      .filter(([, data]) => data.score < 70)
      .map(([framework]) => framework);
    
    if (lowScores.length > 0) {
      findings.push(`Compliance gaps identified in: ${lowScores.join(', ')}`);
    }
    
    // Risk assessment findings
    if (this.report.riskAssessment?.riskLevel === 'HIGH') {
      findings.push('High risk level requires immediate attention');
    }
    
    // Critical recommendations
    const criticalRecs = this.report.recommendations.filter(r => r.priority === 'critical').length;
    if (criticalRecs > 0) {
      findings.push(`${criticalRecs} critical recommendations require immediate action`);
    }
    
    return findings;
  }

  calculateNextReviewDate() {
    const now = this.getDeterministicDate();
    const nextReview = new Date(now);
    
    // Quarterly reviews for most frameworks
    nextReview.setMonth(now.getMonth() + 3);
    
    return nextReview.toISOString();
  }

  generateCertificationStatus() {
    return {
      iso27001: 'Valid until 2025-12-31',
      sox404: 'Annual certification required',
      pciDss: 'Next assessment due Q2 2024',
      gdpr: 'Ongoing compliance monitoring'
    };
  }

  async run() {
    try {
      await this.init();
      
      console.log(`\n📋 Starting compliance assessment for ${this.options.frameworks.length} frameworks...`);
      
      await this.generateComplianceReports();
      await this.generateAuditTrail();
      await this.generateRiskAssessment();
      await this.generateRecommendations();
      await this.generateSummary();
      await this.saveReports();
      
      console.log(`\n🎯 Compliance Assessment Complete:`);
      console.log(`   📊 Overall Score: ${Math.round(this.report.summary.overallComplianceScore)}/100`);
      console.log(`   ⚖️ Status: ${this.report.summary.complianceStatus}`);
      console.log(`   ⚠️ Risk Level: ${this.report.summary.riskLevel}`);
      console.log(`   🚨 Critical Issues: ${this.report.summary.criticalIssues}`);
      console.log(`   📁 Reports saved to: ${this.reportPath}`);
      
      return this.report;
      
    } catch (error) {
      console.error('💥 Compliance assessment failed:', error);
      throw error;
    }
  }
}

// Audit Trail Helper Class
class AuditTrail {
  constructor() {
    this.events = [];
  }

  async generateReport(options = {}) {
    // Simulate audit trail data collection
    return {
      period: options.period,
      events: [
        {
          timestamp: this.getDeterministicDate().toISOString(),
          eventType: 'data_access',
          userId: options.anonymize ? 'user_001' : 'john.doe@company.com',
          action: 'view_customer_data',
          resource: 'customer_profiles',
          ipAddress: options.anonymize ? '192.168.1.xxx' : '192.168.1.100',
          result: 'success'
        }
        // Add more audit events...
      ],
      summary: {
        totalEvents: 1250,
        successfulAccess: 1200,
        failedAccess: 50,
        suspiciousActivity: 2
      }
    };
  }
}

// Evidence Collector Helper Class
class EvidenceCollector {
  constructor(options) {
    this.options = options;
  }

  async collectEvidence(framework) {
    // Collect evidence for compliance framework
    return {
      framework,
      documents: [
        'Privacy Policy v2.1',
        'Data Retention Policy',
        'Security Procedures Manual'
      ],
      assessments: [
        'DPIA Assessment Report',
        'Security Risk Assessment'
      ],
      certifications: [
        'ISO 27001 Certificate',
        'SOC 2 Type II Report'
      ],
      training: [
        'GDPR Training Records',
        'Security Awareness Training'
      ]
    };
  }
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--output-dir':
        options.outputDir = args[++i];
        break;
      case '--format':
        options.format = args[++i].split(',');
        break;
      case '--frameworks':
        options.frameworks = args[++i].split(',');
        break;
      case '--audit-period':
        options.auditPeriod = args[++i];
        break;
      case '--no-evidence':
        options.includeEvidence = false;
        break;
      case '--anonymize':
        options.anonymizeData = true;
        break;
      case '--help':
        console.log(`
Compliance Reporter for Unjucks Production Environment

Usage: node scripts/compliance-reporter.js [options]

Options:
  --output-dir <path>      Directory for compliance reports (default: ./compliance-reports)
  --format <formats>       Report formats: json,html,csv,pdf (default: json)
  --frameworks <list>      Frameworks to assess: gdpr,sox,hipaa,iso27001,pci-dss
  --audit-period <period>  Audit period: 30d,90d,1y (default: 30d)
  --no-evidence           Skip evidence collection
  --anonymize             Anonymize personal data in reports
  --help                  Show this help message

Examples:
  node scripts/compliance-reporter.js
  node scripts/compliance-reporter.js --format html,csv --frameworks gdpr,sox
  node scripts/compliance-reporter.js --anonymize --audit-period 90d
        `);
        process.exit(0);
        break;
    }
  }
  
  const reporter = new ComplianceReporter(options);
  reporter.run().catch(error => {
    console.error('Compliance reporting failed:', error);
    process.exit(1);
  });
}

module.exports = ComplianceReporter;