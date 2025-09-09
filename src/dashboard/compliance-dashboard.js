/**
 * Enterprise Compliance Dashboard
 * Real-time compliance monitoring and risk assessment
 */

/**
 * @typedef {'GDPR' | 'HIPAA' | 'SOX' | 'PCI-DSS' | 'Basel III' | 'CCPA' | 'PIPEDA' | 'LGPD'} RegulationType
 */

/**
 * @typedef {'Low' | 'Medium' | 'High' | 'Critical'} RiskLevelType
 */

/**
 * @typedef {'Pending' | 'In Progress' | 'Completed'} DeadlineStatusType
 */

/**
 * @typedef {'Open' | 'In Progress' | 'Resolved'} ViolationStatusType
 */

/**
 * @typedef {Object} ComplianceViolation
 * @property {string} id - Violation ID
 * @property {RiskLevelType} severity - Violation severity
 * @property {RegulationType} regulation - Related regulation
 * @property {string} article - Specific article/section
 * @property {string} description - Violation description
 * @property {string} remediation - Remediation steps
 * @property {Date} deadline - Resolution deadline
 * @property {ViolationStatusType} status - Current status
 */

/**
 * @typedef {Object} ComplianceStatus
 * @property {boolean} isCompliant - Whether currently compliant
 * @property {number} complianceScore - Score out of 100
 * @property {Date} lastAuditDate - Last audit date
 * @property {Date} nextAuditDue - Next audit due date
 * @property {ComplianceViolation[]} violations - Active violations
 * @property {string[]} recommendations - Compliance recommendations
 */

/**
 * @typedef {Object} RiskProfile
 * @property {RiskLevelType} overallRisk - Overall risk level
 * @property {number} regulatoryRisk - Regulatory risk score
 * @property {number} operationalRisk - Operational risk score
 * @property {number} reputationalRisk - Reputational risk score
 * @property {number} financialRisk - Financial risk score
 * @property {string[]} riskFactors - Key risk factors
 * @property {string[]} mitigationStrategies - Risk mitigation strategies
 */

/**
 * @typedef {Object} UsageStats
 * @property {string} templateId - Template ID
 * @property {number} usageCount - Usage count
 * @property {Date} lastUsed - Last usage date
 * @property {number} userFeedback - User feedback rating
 * @property {number} successRate - Success rate percentage
 * @property {number} averageImplementationTime - Average implementation time
 */

/**
 * @typedef {Object} ComplianceTrend
 * @property {RegulationType} regulation - Regulation type
 * @property {'weekly' | 'monthly' | 'quarterly' | 'yearly'} period - Trend period
 * @property {Array<{date: Date, score: number}>} complianceScoreHistory - Score history
 * @property {Array<{date: Date, count: number, severity: RiskLevelType}>} violationTrends - Violation trends
 */

/**
 * @typedef {Object} ComplianceDeadline
 * @property {string} id - Deadline ID
 * @property {RegulationType} regulation - Related regulation
 * @property {string} description - Deadline description
 * @property {Date} dueDate - Due date
 * @property {RiskLevelType} priority - Priority level
 * @property {string} assignedTo - Assigned team/person
 * @property {DeadlineStatusType} status - Current status
 */

/**
 * @typedef {Object} ComplianceDashboard
 * @property {string} organizationId - Organization ID
 * @property {Record<RegulationType, ComplianceStatus>} regulatoryCompliance - Compliance status by regulation
 * @property {number} auditReadiness - Audit readiness percentage
 * @property {RiskProfile} riskAssessment - Risk assessment profile
 * @property {UsageStats[]} templateUsage - Template usage statistics
 * @property {ComplianceTrend[]} complianceTrends - Compliance trends
 * @property {ComplianceDeadline[]} upcomingDeadlines - Upcoming deadlines
 */

export class ComplianceDashboardService {
  constructor() {
    this.validator = null; // ComplianceValidator would be imported if available
    /** @type {Map<string, ComplianceDashboard>} */
    this.dashboardData = new Map();
  }

  /**
   * Get comprehensive compliance dashboard for organization
   * @param {string} organizationId - Organization ID
   * @returns {Promise<ComplianceDashboard>} Compliance dashboard
   */
  async getDashboard(organizationId) {
    const existingDashboard = this.dashboardData.get(organizationId);
    
    if (existingDashboard) {
      return await this.refreshDashboard(existingDashboard);
    }

    const dashboard = await this.buildNewDashboard(organizationId);
    this.dashboardData.set(organizationId, dashboard);
    
    return dashboard;
  }

  /**
   * Get real-time compliance status
   * @param {string} organizationId - Organization ID
   * @param {RegulationType} [regulation] - Specific regulation
   * @returns {Promise<Record<RegulationType, ComplianceStatus>>} Compliance status
   */
  async getComplianceStatus(organizationId, regulation) {
    const dashboard = await this.getDashboard(organizationId);
    
    if (regulation) {
      return { [regulation]: dashboard.regulatoryCompliance[regulation] };
    }
    
    return dashboard.regulatoryCompliance;
  }

  /**
   * Get risk assessment with detailed breakdown
   * @param {string} organizationId - Organization ID
   * @returns {Promise<RiskProfile>} Risk profile
   */
  async getRiskAssessment(organizationId) {
    const dashboard = await this.getDashboard(organizationId);
    return dashboard.riskAssessment;
  }

  /**
   * Get compliance trends over time
   * @param {string} organizationId - Organization ID
   * @param {'weekly' | 'monthly' | 'quarterly' | 'yearly'} [period='monthly'] - Trend period
   * @param {RegulationType[]} [regulations] - Specific regulations
   * @returns {Promise<ComplianceTrend[]>} Compliance trends
   */
  async getComplianceTrends(organizationId, period = 'monthly', regulations) {
    const dashboard = await this.getDashboard(organizationId);
    
    let trends = dashboard.complianceTrends.filter(trend => trend.period === period);
    
    if (regulations) {
      trends = trends.filter(trend => regulations.includes(trend.regulation));
    }
    
    return trends;
  }

  /**
   * Get upcoming compliance deadlines
   * @param {string} organizationId - Organization ID
   * @param {number} [daysAhead=30] - Days ahead to look
   * @returns {Promise<ComplianceDeadline[]>} Upcoming deadlines
   */
  async getUpcomingDeadlines(organizationId, daysAhead = 30) {
    const dashboard = await this.getDashboard(organizationId);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + daysAhead);
    
    return dashboard.upcomingDeadlines
      .filter(deadline => deadline.dueDate <= cutoffDate)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }

  /**
   * Generate compliance report
   * @param {string} organizationId - Organization ID
   * @param {'summary' | 'detailed' | 'executive'} [format='summary'] - Report format
   * @returns {Promise<Object>} Compliance report
   */
  async generateComplianceReport(organizationId, format = 'summary') {
    const dashboard = await this.getDashboard(organizationId);
    const overallScore = this.calculateOverallComplianceScore(dashboard);
    const riskLevel = this.determineOverallRiskLevel(dashboard);
    
    const report = {
      reportId: this.generateReportId(),
      generatedAt: new Date(),
      organization: organizationId,
      overallScore,
      riskLevel,
      regulatoryCompliance: dashboard.regulatoryCompliance,
      keyFindings: await this.generateKeyFindings(dashboard),
      recommendations: await this.generateRecommendations(dashboard),
      actionItems: dashboard.upcomingDeadlines.filter(d => d.priority === 'High' || d.priority === 'Critical')
    };

    if (format === 'executive') {
      return {
        ...report,
        executiveSummary: await this.generateExecutiveSummary(dashboard, overallScore, riskLevel)
      };
    }

    if (format === 'detailed') {
      return {
        ...report,
        detailedAnalysis: await this.generateDetailedAnalysis(dashboard)
      };
    }

    return report;
  }

  /**
   * Set up automated compliance monitoring
   * @param {string} organizationId - Organization ID
   * @param {Object} settings - Monitoring settings
   * @returns {Promise<Object>} Monitoring setup result
   */
  async setupAutomatedMonitoring(organizationId, settings) {
    const monitoringId = this.generateMonitoringId();
    
    // Set up monitoring schedule
    const nextCheck = this.calculateNextCheckTime(settings.scheduleFrequency);
    
    // Store monitoring configuration
    await this.storeMonitoringConfig(organizationId, monitoringId, settings);
    
    return {
      monitoringId,
      status: 'active',
      nextCheck
    };
  }

  /**
   * Get compliance KPIs (Key Performance Indicators)
   * @param {string} organizationId - Organization ID
   * @returns {Promise<Object>} Compliance KPIs
   */
  async getComplianceKPIs(organizationId) {
    const dashboard = await this.getDashboard(organizationId);
    
    return {
      overallComplianceScore: this.calculateOverallComplianceScore(dashboard),
      auditReadiness: dashboard.auditReadiness,
      riskScore: dashboard.riskAssessment.overallRisk === 'Low' ? 25 : 
                 dashboard.riskAssessment.overallRisk === 'Medium' ? 50 :
                 dashboard.riskAssessment.overallRisk === 'High' ? 75 : 90,
      templatesUsed: dashboard.templateUsage.length,
      violationsResolved: await this.getResolvedViolationsCount(organizationId),
      averageResolutionTime: await this.getAverageResolutionTime(organizationId),
      complianceTrend: await this.determineComplianceTrend(organizationId),
      regulatoryUpdates: await this.getRegulatoryUpdatesCount(organizationId),
      costSavings: await this.calculateCostSavings(organizationId)
    };
  }

  /**
   * Run compliance health check
   * @param {string} organizationId - Organization ID
   * @returns {Promise<Object>} Health check result
   */
  async runHealthCheck(organizationId) {
    const checks = [];
    let passCount = 0;

    // Check audit readiness
    const dashboard = await this.getDashboard(organizationId);
    const auditCheck = {
      name: 'Audit Readiness',
      status: dashboard.auditReadiness >= 80 ? 'pass' : dashboard.auditReadiness >= 60 ? 'warning' : 'fail',
      message: `Audit readiness: ${dashboard.auditReadiness}%`,
      remediation: dashboard.auditReadiness < 80 ? 'Review and update compliance documentation' : undefined
    };
    checks.push(auditCheck);
    if (auditCheck.status === 'pass') passCount++;

    // Check for overdue deadlines
    const overdueDeadlines = dashboard.upcomingDeadlines.filter(
      d => d.dueDate < new Date() && d.status !== 'Completed'
    );
    const deadlineCheck = {
      name: 'Compliance Deadlines',
      status: overdueDeadlines.length === 0 ? 'pass' : overdueDeadlines.length <= 2 ? 'warning' : 'fail',
      message: overdueDeadlines.length === 0 
        ? 'All deadlines are current' 
        : `${overdueDeadlines.length} overdue deadline(s)`,
      remediation: overdueDeadlines.length > 0 ? 'Address overdue compliance deadlines immediately' : undefined
    };
    checks.push(deadlineCheck);
    if (deadlineCheck.status === 'pass') passCount++;

    // Check violation count
    const totalViolations = Object.values(dashboard.regulatoryCompliance)
      .reduce((sum, status) => sum + status.violations.length, 0);
    const violationCheck = {
      name: 'Active Violations',
      status: totalViolations === 0 ? 'pass' : totalViolations <= 5 ? 'warning' : 'fail',
      message: totalViolations === 0 
        ? 'No active violations' 
        : `${totalViolations} active violation(s)`,
      remediation: totalViolations > 0 ? 'Address active compliance violations' : undefined
    };
    checks.push(violationCheck);
    if (violationCheck.status === 'pass') passCount++;

    // Check risk level
    const riskCheck = {
      name: 'Risk Assessment',
      status: dashboard.riskAssessment.overallRisk === 'Low' ? 'pass' : 
              dashboard.riskAssessment.overallRisk === 'Medium' ? 'warning' : 'fail',
      message: `Overall risk level: ${dashboard.riskAssessment.overallRisk}`,
      remediation: dashboard.riskAssessment.overallRisk !== 'Low' 
        ? 'Implement risk mitigation strategies' : undefined
    };
    checks.push(riskCheck);
    if (riskCheck.status === 'pass') passCount++;

    const score = Math.round((passCount / checks.length) * 100);
    const status = score >= 80 ? 'healthy' : score >= 60 ? 'warning' : 'critical';

    return { status, checks, score };
  }

  // Private helper methods

  /**
   * @private
   */
  async buildNewDashboard(organizationId) {
    /** @type {Record<RegulationType, ComplianceStatus>} */
    const regulatoryCompliance = {
      'GDPR': await this.buildComplianceStatus('GDPR', organizationId),
      'HIPAA': await this.buildComplianceStatus('HIPAA', organizationId),
      'SOX': await this.buildComplianceStatus('SOX', organizationId),
      'PCI-DSS': await this.buildComplianceStatus('PCI-DSS', organizationId),
      'Basel III': await this.buildComplianceStatus('Basel III', organizationId),
      'CCPA': await this.buildComplianceStatus('CCPA', organizationId),
      'PIPEDA': await this.buildComplianceStatus('PIPEDA', organizationId),
      'LGPD': await this.buildComplianceStatus('LGPD', organizationId)
    };

    return {
      organizationId,
      regulatoryCompliance,
      auditReadiness: this.calculateAuditReadiness(regulatoryCompliance),
      riskAssessment: await this.buildRiskProfile(regulatoryCompliance),
      templateUsage: await this.getTemplateUsageStats(organizationId),
      complianceTrends: await this.buildComplianceTrends(organizationId),
      upcomingDeadlines: await this.buildUpcomingDeadlines(organizationId)
    };
  }

  /**
   * @private
   */
  async buildComplianceStatus(regulation, organizationId) {
    // Simulate compliance status - in production, this would query actual data
    const complianceScore = Math.floor(Math.random() * 30) + 70; // 70-100%
    const isCompliant = complianceScore >= 75;
    
    return {
      isCompliant,
      complianceScore,
      lastAuditDate: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000), // Last 90 days
      nextAuditDue: new Date(Date.now() + Math.random() * 180 * 24 * 60 * 60 * 1000), // Next 180 days
      violations: await this.generateSampleViolations(regulation),
      recommendations: this.getComplianceRecommendations(regulation)
    };
  }

  /**
   * @private
   */
  getComplianceRecommendations(regulation) {
    const recommendations = {
      'GDPR': ['Implement data mapping', 'Update privacy notices', 'Conduct DPIA'],
      'HIPAA': ['Review access controls', 'Update BAAs', 'Conduct risk assessment'],
      'SOX': ['Review financial controls', 'Update documentation', 'Test controls'],
      'PCI-DSS': ['Update cardholder data inventory', 'Review network security', 'Test incident response'],
      'Basel III': ['Review capital ratios', 'Update risk management', 'Assess liquidity'],
      'CCPA': ['Update privacy policy', 'Implement consumer rights', 'Review data sharing'],
      'PIPEDA': ['Review privacy practices', 'Update consent mechanisms', 'Assess data transfers'],
      'LGPD': ['Update data protection policies', 'Implement consent management', 'Review data processing']
    };
    
    return recommendations[regulation] || ['Review compliance requirements'];
  }

  /**
   * @private
   */
  async generateSampleViolations(regulation) {
    // Generate 0-3 sample violations
    const violationCount = Math.floor(Math.random() * 4);
    /** @type {ComplianceViolation[]} */
    const violations = [];
    
    for (let i = 0; i < violationCount; i++) {
      violations.push({
        id: `${regulation.toLowerCase()}-violation-${i + 1}`,
        severity: ['Low', 'Medium', 'High', 'Critical'][Math.floor(Math.random() * 4)],
        regulation,
        article: `Article ${Math.floor(Math.random() * 10) + 1}`,
        description: `Sample ${regulation} violation ${i + 1}`,
        remediation: `Remediate ${regulation} violation ${i + 1}`,
        deadline: new Date(Date.now() + Math.random() * 60 * 24 * 60 * 60 * 1000), // Next 60 days
        status: ['Open', 'In Progress', 'Resolved'][Math.floor(Math.random() * 3)]
      });
    }
    
    return violations;
  }

  /**
   * @private
   */
  calculateAuditReadiness(regulatoryCompliance) {
    const scores = Object.values(regulatoryCompliance)
      .map(status => status.complianceScore);
    
    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  }

  /**
   * @private
   */
  async buildRiskProfile(regulatoryCompliance) {
    const averageScore = this.calculateAuditReadiness(regulatoryCompliance);
    /** @type {RiskLevelType} */
    const overallRisk = 
      averageScore >= 90 ? 'Low' :
      averageScore >= 75 ? 'Medium' :
      averageScore >= 60 ? 'High' : 'Critical';

    return {
      overallRisk,
      regulatoryRisk: 100 - averageScore,
      operationalRisk: Math.floor(Math.random() * 20) + 10,
      reputationalRisk: Math.floor(Math.random() * 15) + 5,
      financialRisk: Math.floor(Math.random() * 25) + 15,
      riskFactors: [
        'Data processing complexity',
        'Multi-jurisdiction requirements',
        'Third-party integrations',
        'Manual compliance processes'
      ],
      mitigationStrategies: [
        'Automated compliance monitoring',
        'Regular staff training',
        'Third-party risk assessments',
        'Incident response procedures'
      ]
    };
  }

  /**
   * @private
   */
  async getTemplateUsageStats(organizationId) {
    // Simulate template usage stats
    const templates = ['gdpr-data-protection', 'hipaa-patient-data', 'sox-financial-controls'];
    
    return templates.map(templateId => ({
      templateId,
      usageCount: Math.floor(Math.random() * 50) + 10,
      lastUsed: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      userFeedback: Math.floor(Math.random() * 2) + 4, // 4-5 stars
      successRate: Math.floor(Math.random() * 10) + 90, // 90-100%
      averageImplementationTime: Math.floor(Math.random() * 120) + 30 // 30-150 minutes
    }));
  }

  /**
   * @private
   */
  async buildComplianceTrends(organizationId) {
    /** @type {RegulationType[]} */
    const regulations = ['GDPR', 'HIPAA', 'SOX'];
    
    return regulations.map(regulation => ({
      regulation,
      period: 'monthly',
      complianceScoreHistory: this.generateScoreHistory(),
      violationTrends: this.generateViolationTrends()
    }));
  }

  /**
   * @private
   */
  generateScoreHistory() {
    const history = [];
    let baseScore = 70 + Math.random() * 20;
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      
      baseScore += (Math.random() - 0.5) * 10;
      baseScore = Math.max(60, Math.min(100, baseScore));
      
      history.push({
        date,
        score: Math.round(baseScore)
      });
    }
    
    return history;
  }

  /**
   * @private
   */
  generateViolationTrends() {
    const trends = [];
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      
      trends.push({
        date,
        count: Math.floor(Math.random() * 8),
        severity: ['Low', 'Medium', 'High', 'Critical'][Math.floor(Math.random() * 4)]
      });
    }
    
    return trends;
  }

  /**
   * @private
   */
  async buildUpcomingDeadlines(organizationId) {
    /** @type {ComplianceDeadline[]} */
    const deadlines = [];
    /** @type {RegulationType[]} */
    const regulations = ['GDPR', 'HIPAA', 'SOX'];
    
    regulations.forEach(regulation => {
      const deadlineCount = Math.floor(Math.random() * 3) + 1;
      
      for (let i = 0; i < deadlineCount; i++) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + Math.floor(Math.random() * 90));
        
        deadlines.push({
          id: `${regulation.toLowerCase()}-deadline-${i + 1}`,
          regulation,
          description: `${regulation} compliance review ${i + 1}`,
          dueDate,
          priority: ['Low', 'Medium', 'High', 'Critical'][Math.floor(Math.random() * 4)],
          assignedTo: `team-${Math.floor(Math.random() * 3) + 1}`,
          status: ['Pending', 'In Progress', 'Completed'][Math.floor(Math.random() * 3)]
        });
      }
    });
    
    return deadlines.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }

  /**
   * @private
   */
  async refreshDashboard(dashboard) {
    // In production, this would refresh data from various sources
    dashboard.auditReadiness = this.calculateAuditReadiness(dashboard.regulatoryCompliance);
    return dashboard;
  }

  /**
   * @private
   */
  calculateOverallComplianceScore(dashboard) {
    const scores = Object.values(dashboard.regulatoryCompliance)
      .map(status => status.complianceScore);
    
    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  }

  /**
   * @private
   */
  determineOverallRiskLevel(dashboard) {
    return dashboard.riskAssessment.overallRisk;
  }

  /**
   * @private
   */
  async generateKeyFindings(dashboard) {
    const findings = [];
    const overallScore = this.calculateOverallComplianceScore(dashboard);
    
    if (overallScore >= 90) {
      findings.push('Excellent compliance posture with minimal risks');
    } else if (overallScore >= 75) {
      findings.push('Good compliance status with some areas for improvement');
    } else {
      findings.push('Compliance gaps identified requiring immediate attention');
    }
    
    const totalViolations = Object.values(dashboard.regulatoryCompliance)
      .reduce((sum, status) => sum + status.violations.length, 0);
    
    if (totalViolations > 0) {
      findings.push(`${totalViolations} active compliance violations require resolution`);
    }
    
    return findings;
  }

  /**
   * @private
   */
  async generateRecommendations(dashboard) {
    return [
      'Implement automated compliance monitoring',
      'Regular staff training on regulatory requirements',
      'Enhance documentation processes',
      'Establish continuous audit procedures',
      'Update incident response protocols'
    ];
  }

  /**
   * @private
   */
  async generateExecutiveSummary(dashboard, overallScore, riskLevel) {
    return `
Executive Summary:

Our organization maintains a ${overallScore}% compliance score across all regulatory frameworks, indicating a ${riskLevel.toLowerCase()} risk profile. 

Key highlights:
- Audit readiness at ${dashboard.auditReadiness}%
- ${dashboard.templateUsage.length} compliance templates actively in use
- ${dashboard.upcomingDeadlines.length} compliance deadlines tracked

The compliance program demonstrates strong governance with automated monitoring and regular assessments. Continued focus on process improvement and staff training will maintain our excellent compliance posture.
    `;
  }

  /**
   * @private
   */
  async generateDetailedAnalysis(dashboard) {
    return {
      regulatoryBreakdown: dashboard.regulatoryCompliance,
      riskAnalysis: dashboard.riskAssessment,
      templateEffectiveness: dashboard.templateUsage,
      trendAnalysis: dashboard.complianceTrends,
      deadlineManagement: dashboard.upcomingDeadlines
    };
  }

  /**
   * @private
   */
  generateReportId() {
    return `report_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * @private
   */
  generateMonitoringId() {
    return `monitor_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * @private
   */
  calculateNextCheckTime(frequency) {
    const next = new Date();
    switch (frequency) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
    }
    return next;
  }

  /**
   * @private
   */
  async storeMonitoringConfig(organizationId, monitoringId, settings) {
    // In production, store in database
    // Monitoring configuration stored successfully
  }

  /**
   * @private
   */
  async getResolvedViolationsCount(organizationId) {
    // Simulate resolved violations count
    return Math.floor(Math.random() * 20) + 10;
  }

  /**
   * @private
   */
  async getAverageResolutionTime(organizationId) {
    // Average resolution time in hours
    return Math.floor(Math.random() * 48) + 12;
  }

  /**
   * @private
   */
  async determineComplianceTrend(organizationId) {
    // Simulate trend analysis
    const trends = ['improving', 'stable', 'declining'];
    return trends[Math.floor(Math.random() * trends.length)];
  }

  /**
   * @private
   */
  async getRegulatoryUpdatesCount(organizationId) {
    return Math.floor(Math.random() * 5) + 2;
  }

  /**
   * @private
   */
  async calculateCostSavings(organizationId) {
    // Estimated cost savings from compliance automation
    return Math.floor(Math.random() * 500000) + 100000;
  }
}