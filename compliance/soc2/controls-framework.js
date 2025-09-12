/**
 * SOC 2 Controls Framework Implementation
 * Trust Services Criteria (TSC) management for Type I and Type II audits
 */

class SOC2ControlsFramework {
  constructor(config = {}) {
    this.config = {
      organizationName: config.organizationName || 'Organization',
      auditPeriod: config.auditPeriod || 365, // days
      controlTestingFrequency: config.controlTestingFrequency || 'quarterly',
      ...config
    };
    
    this.controls = new Map();
    this.evidenceRepository = new Map();
    this.testResults = new Map();
    this.exceptions = new Map();
    this.remediationPlans = new Map();
    
    this.initializeSOC2Controls();
  }

  /**
   * Initialize standard SOC 2 controls based on Trust Services Criteria
   */
  initializeSOC2Controls() {
    // Security (Common Criteria)
    this.addControl('CC6.1', 'Security', 'Logical and Physical Access Controls', {
      description: 'The entity implements logical and physical access controls to protect against threats from sources outside its system boundaries.',
      riskLevel: 'high',
      testingProcedure: 'Review access control policies, test user provisioning/deprovisioning, validate multi-factor authentication',
      frequency: 'quarterly',
      owner: 'Security Team',
      implementationGuidance: 'Implement role-based access controls, regular access reviews, and strong authentication mechanisms'
    });

    this.addControl('CC6.2', 'Security', 'Transmission and Disposal of Information', {
      description: 'Prior to issuing system credentials and granting access, the entity registers and authorizes new internal and external users.',
      riskLevel: 'high',
      testingProcedure: 'Review user registration process, test authorization workflows, validate access approval documentation',
      frequency: 'quarterly',
      owner: 'IT Administration',
      implementationGuidance: 'Establish formal user registration and authorization procedures with documented approvals'
    });

    this.addControl('CC6.3', 'Security', 'User Access Provisioning', {
      description: 'The entity authorizes, modifies, or removes access to data, software, functions, and other system resources.',
      riskLevel: 'high',
      testingProcedure: 'Test access provisioning workflows, review access modification procedures, validate removal of access',
      frequency: 'quarterly',
      owner: 'IT Administration',
      implementationGuidance: 'Implement automated provisioning systems with approval workflows and regular access reviews'
    });

    // Availability
    this.addControl('A1.1', 'Availability', 'System Availability Monitoring', {
      description: 'The entity maintains, monitors, and evaluates current processing capacity and use of system resources.',
      riskLevel: 'medium',
      testingProcedure: 'Review capacity monitoring procedures, test alerting systems, validate capacity planning processes',
      frequency: 'monthly',
      owner: 'Operations Team',
      implementationGuidance: 'Implement comprehensive monitoring of system resources with automated alerting'
    });

    this.addControl('A1.2', 'Availability', 'System Backup and Recovery', {
      description: 'The entity authorizes, designs, develops, implements, operates, maintains, and monitors environmental protections.',
      riskLevel: 'high',
      testingProcedure: 'Test backup procedures, validate recovery capabilities, review backup retention policies',
      frequency: 'quarterly',
      owner: 'IT Operations',
      implementationGuidance: 'Establish automated backup procedures with regular recovery testing'
    });

    // Processing Integrity
    this.addControl('PI1.1', 'Processing Integrity', 'Data Processing Controls', {
      description: 'The entity implements controls over inputs, processing, and outputs to meet the entity\'s service commitments.',
      riskLevel: 'medium',
      testingProcedure: 'Review data validation controls, test processing procedures, validate output controls',
      frequency: 'quarterly',
      owner: 'Development Team',
      implementationGuidance: 'Implement comprehensive data validation and error handling throughout processing workflows'
    });

    // Confidentiality
    this.addControl('C1.1', 'Confidentiality', 'Confidential Information Protection', {
      description: 'The entity identifies and maintains confidential information to meet the entity\'s service commitments.',
      riskLevel: 'high',
      testingProcedure: 'Review data classification procedures, test encryption controls, validate access restrictions',
      frequency: 'quarterly',
      owner: 'Security Team',
      implementationGuidance: 'Implement data classification framework with appropriate protection controls'
    });

    // Privacy
    this.addControl('P1.1', 'Privacy', 'Personal Information Management', {
      description: 'The entity provides notice about its privacy practices to meet the entity\'s service commitments.',
      riskLevel: 'medium',
      testingProcedure: 'Review privacy notices, test consent mechanisms, validate notice updates',
      frequency: 'quarterly',
      owner: 'Legal/Compliance Team',
      implementationGuidance: 'Maintain current privacy notices and implement consent management systems'
    });
  }

  /**
   * Add a control to the framework
   */
  addControl(controlId, category, title, details) {
    const control = {
      id: controlId,
      category,
      title,
      description: details.description,
      riskLevel: details.riskLevel,
      testingProcedure: details.testingProcedure,
      frequency: details.frequency,
      owner: details.owner,
      implementationGuidance: details.implementationGuidance,
      status: 'designed',
      implementedDate: null,
      lastTested: null,
      nextTestDue: null,
      createdAt: this.getDeterministicDate().toISOString(),
      updatedAt: this.getDeterministicDate().toISOString()
    };

    this.controls.set(controlId, control);
    return controlId;
  }

  /**
   * Mark control as implemented
   */
  implementControl(controlId, implementationDetails = {}) {
    const control = this.controls.get(controlId);
    if (!control) {
      throw new Error(`Control ${controlId} not found`);
    }

    control.status = 'implemented';
    control.implementedDate = this.getDeterministicDate().toISOString();
    control.implementationDetails = implementationDetails;
    control.updatedAt = this.getDeterministicDate().toISOString();

    // Schedule next testing
    this.scheduleControlTesting(controlId);

    this.logEvent('control_implemented', {
      controlId,
      category: control.category,
      implementedBy: implementationDetails.implementedBy,
      timestamp: this.getDeterministicDate().toISOString()
    });

    return true;
  }

  /**
   * Schedule control testing
   */
  scheduleControlTesting(controlId) {
    const control = this.controls.get(controlId);
    if (!control) return;

    const now = this.getDeterministicDate();
    let nextTestDate;

    switch (control.frequency) {
      case 'monthly':
        nextTestDate = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
        break;
      case 'quarterly':
        nextTestDate = new Date(now.getTime() + (90 * 24 * 60 * 60 * 1000));
        break;
      case 'annually':
        nextTestDate = new Date(now.getTime() + (365 * 24 * 60 * 60 * 1000));
        break;
      default:
        nextTestDate = new Date(now.getTime() + (90 * 24 * 60 * 60 * 1000));
    }

    control.nextTestDue = nextTestDate.toISOString();
  }

  /**
   * Execute control testing
   */
  executeControlTest(controlId, testDetails = {}) {
    const testId = `test_${this.getDeterministicTimestamp()}_${Math.random().toString(36).substr(2, 9)}`;
    const control = this.controls.get(controlId);
    
    if (!control) {
      throw new Error(`Control ${controlId} not found`);
    }

    if (control.status !== 'implemented') {
      throw new Error(`Control ${controlId} is not implemented`);
    }

    const testResult = {
      id: testId,
      controlId,
      testDate: this.getDeterministicDate().toISOString(),
      tester: testDetails.tester || 'System',
      testProcedure: control.testingProcedure,
      testSteps: testDetails.testSteps || [],
      findings: testDetails.findings || [],
      evidence: testDetails.evidence || [],
      result: testDetails.result || 'pending', // pass, fail, exception
      riskRating: this.calculateRiskRating(testDetails.findings || []),
      recommendations: testDetails.recommendations || [],
      managementResponse: testDetails.managementResponse || '',
      remediationDeadline: testDetails.remediationDeadline || null
    };

    this.testResults.set(testId, testResult);

    // Update control
    control.lastTested = testResult.testDate;
    if (testResult.result === 'pass') {
      this.scheduleControlTesting(controlId);
    }

    this.logEvent('control_tested', {
      controlId,
      testId,
      result: testResult.result,
      riskRating: testResult.riskRating,
      timestamp: this.getDeterministicDate().toISOString()
    });

    return testId;
  }

  /**
   * Calculate risk rating based on findings
   */
  calculateRiskRating(findings) {
    if (findings.length === 0) return 'low';
    
    const highRiskFindings = findings.filter(f => f.severity === 'high').length;
    const mediumRiskFindings = findings.filter(f => f.severity === 'medium').length;
    
    if (highRiskFindings > 0) return 'high';
    if (mediumRiskFindings > 1) return 'medium';
    return 'low';
  }

  /**
   * Record control exception
   */
  recordException(controlId, exceptionDetails) {
    const exceptionId = `exc_${this.getDeterministicTimestamp()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const exception = {
      id: exceptionId,
      controlId,
      description: exceptionDetails.description,
      impact: exceptionDetails.impact,
      likelihood: exceptionDetails.likelihood,
      riskRating: exceptionDetails.riskRating,
      businessJustification: exceptionDetails.businessJustification,
      compensatingControls: exceptionDetails.compensatingControls || [],
      approvedBy: exceptionDetails.approvedBy,
      approvalDate: this.getDeterministicDate().toISOString(),
      expirationDate: exceptionDetails.expirationDate,
      status: 'active',
      createdAt: this.getDeterministicDate().toISOString()
    };

    this.exceptions.set(exceptionId, exception);

    this.logEvent('exception_recorded', {
      exceptionId,
      controlId,
      riskRating: exception.riskRating,
      approvedBy: exception.approvedBy,
      timestamp: this.getDeterministicDate().toISOString()
    });

    return exceptionId;
  }

  /**
   * Create remediation plan
   */
  createRemediationPlan(controlId, testId, planDetails) {
    const planId = `plan_${this.getDeterministicTimestamp()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const plan = {
      id: planId,
      controlId,
      testId,
      description: planDetails.description,
      rootCause: planDetails.rootCause,
      remediationSteps: planDetails.remediationSteps || [],
      owner: planDetails.owner,
      targetDate: planDetails.targetDate,
      priority: planDetails.priority || 'medium',
      status: 'planned',
      progress: 0,
      createdAt: this.getDeterministicDate().toISOString(),
      updatedAt: this.getDeterministicDate().toISOString()
    };

    this.remediationPlans.set(planId, plan);

    this.logEvent('remediation_planned', {
      planId,
      controlId,
      testId,
      owner: plan.owner,
      targetDate: plan.targetDate,
      timestamp: this.getDeterministicDate().toISOString()
    });

    return planId;
  }

  /**
   * Update remediation plan progress
   */
  updateRemediationProgress(planId, progress, statusUpdate = '') {
    const plan = this.remediationPlans.get(planId);
    if (!plan) {
      throw new Error(`Remediation plan ${planId} not found`);
    }

    plan.progress = Math.min(100, Math.max(0, progress));
    plan.lastUpdate = statusUpdate;
    plan.updatedAt = this.getDeterministicDate().toISOString();

    if (plan.progress >= 100) {
      plan.status = 'completed';
      plan.completedDate = this.getDeterministicDate().toISOString();
    } else if (plan.progress > 0) {
      plan.status = 'in_progress';
    }

    this.logEvent('remediation_updated', {
      planId,
      progress: plan.progress,
      status: plan.status,
      timestamp: this.getDeterministicDate().toISOString()
    });

    return true;
  }

  /**
   * Add evidence to repository
   */
  addEvidence(controlId, evidenceDetails) {
    const evidenceId = `ev_${this.getDeterministicTimestamp()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const evidence = {
      id: evidenceId,
      controlId,
      type: evidenceDetails.type, // document, screenshot, log, configuration
      title: evidenceDetails.title,
      description: evidenceDetails.description,
      source: evidenceDetails.source,
      collectedBy: evidenceDetails.collectedBy,
      collectedDate: this.getDeterministicDate().toISOString(),
      filePath: evidenceDetails.filePath,
      metadata: evidenceDetails.metadata || {},
      tags: evidenceDetails.tags || [],
      auditPeriod: evidenceDetails.auditPeriod
    };

    this.evidenceRepository.set(evidenceId, evidence);

    this.logEvent('evidence_collected', {
      evidenceId,
      controlId,
      type: evidence.type,
      collectedBy: evidence.collectedBy,
      timestamp: this.getDeterministicDate().toISOString()
    });

    return evidenceId;
  }

  /**
   * Get controls due for testing
   */
  getControlsDueForTesting() {
    const now = this.getDeterministicDate();
    const dueControls = [];

    for (const control of this.controls.values()) {
      if (control.status === 'implemented' && control.nextTestDue) {
        const dueDate = new Date(control.nextTestDue);
        if (dueDate <= now) {
          dueControls.push(control);
        }
      }
    }

    return dueControls;
  }

  /**
   * Get control effectiveness summary
   */
  getControlEffectiveness() {
    const summary = {
      totalControls: this.controls.size,
      implemented: 0,
      tested: 0,
      passed: 0,
      failed: 0,
      exceptions: 0,
      overdue: 0
    };

    const now = this.getDeterministicDate();

    for (const control of this.controls.values()) {
      if (control.status === 'implemented') {
        summary.implemented++;
      }

      if (control.lastTested) {
        summary.tested++;
      }

      if (control.nextTestDue && new Date(control.nextTestDue) < now) {
        summary.overdue++;
      }
    }

    // Count test results
    for (const test of this.testResults.values()) {
      if (test.result === 'pass') {
        summary.passed++;
      } else if (test.result === 'fail') {
        summary.failed++;
      }
    }

    summary.exceptions = this.exceptions.size;

    return summary;
  }

  /**
   * Generate SOC 2 readiness assessment
   */
  generateReadinessAssessment() {
    const effectiveness = this.getControlEffectiveness();
    const dueControls = this.getControlsDueForTesting();
    const activeExceptions = Array.from(this.exceptions.values())
      .filter(exc => exc.status === 'active');

    const readinessScore = this.calculateReadinessScore(effectiveness);

    return {
      assessmentDate: this.getDeterministicDate().toISOString(),
      organization: this.config.organizationName,
      readinessScore,
      summary: {
        controlsImplemented: effectiveness.implemented,
        controlsTested: effectiveness.tested,
        testPassRate: effectiveness.tested > 0 ? 
          (effectiveness.passed / effectiveness.tested * 100).toFixed(2) + '%' : '0%',
        activeExceptions: activeExceptions.length,
        overdueTests: dueControls.length
      },
      recommendations: this.generateReadinessRecommendations(effectiveness, dueControls, activeExceptions),
      gaps: this.identifyComplianceGaps(),
      timeline: this.estimateReadinessTimeline(effectiveness)
    };
  }

  /**
   * Calculate readiness score
   */
  calculateReadinessScore(effectiveness) {
    let score = 0;
    
    // Implementation score (40%)
    const implementationRate = effectiveness.implemented / effectiveness.totalControls;
    score += implementationRate * 40;

    // Testing score (30%)
    const testingRate = effectiveness.tested / Math.max(effectiveness.implemented, 1);
    score += testingRate * 30;

    // Pass rate score (20%)
    const passRate = effectiveness.tested > 0 ? effectiveness.passed / effectiveness.tested : 0;
    score += passRate * 20;

    // Exception penalty (10%)
    const exceptionPenalty = Math.min(effectiveness.exceptions * 2, 10);
    score += Math.max(0, 10 - exceptionPenalty);

    return Math.round(score);
  }

  /**
   * Generate readiness recommendations
   */
  generateReadinessRecommendations(effectiveness, dueControls, activeExceptions) {
    const recommendations = [];

    if (effectiveness.implemented < effectiveness.totalControls) {
      recommendations.push({
        priority: 'high',
        category: 'Implementation',
        recommendation: `Implement remaining ${effectiveness.totalControls - effectiveness.implemented} controls`,
        impact: 'Required for SOC 2 compliance'
      });
    }

    if (dueControls.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'Testing',
        recommendation: `Complete testing for ${dueControls.length} overdue controls`,
        impact: 'Evidence required for audit'
      });
    }

    if (activeExceptions.length > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'Risk Management',
        recommendation: `Address ${activeExceptions.length} active control exceptions`,
        impact: 'Reduces audit findings and risk exposure'
      });
    }

    return recommendations;
  }

  /**
   * Identify compliance gaps
   */
  identifyComplianceGaps() {
    const gaps = [];

    // Check for unimplemented controls by category
    const categories = ['Security', 'Availability', 'Processing Integrity', 'Confidentiality', 'Privacy'];
    
    for (const category of categories) {
      const categoryControls = Array.from(this.controls.values())
        .filter(control => control.category === category);
      
      const unimplemented = categoryControls.filter(control => control.status !== 'implemented');
      
      if (unimplemented.length > 0) {
        gaps.push({
          category,
          gap: `${unimplemented.length} unimplemented controls`,
          controls: unimplemented.map(c => c.id),
          riskLevel: this.assessCategoryRisk(unimplemented)
        });
      }
    }

    return gaps;
  }

  /**
   * Assess risk level for category
   */
  assessCategoryRisk(controls) {
    const highRiskControls = controls.filter(c => c.riskLevel === 'high').length;
    if (highRiskControls > 0) return 'high';
    
    const mediumRiskControls = controls.filter(c => c.riskLevel === 'medium').length;
    if (mediumRiskControls > 1) return 'medium';
    
    return 'low';
  }

  /**
   * Estimate readiness timeline
   */
  estimateReadinessTimeline(effectiveness) {
    const unimplementedControls = effectiveness.totalControls - effectiveness.implemented;
    const untestedControls = effectiveness.implemented - effectiveness.tested;
    
    // Estimate 1 week per control implementation, 1 day per test
    const implementationWeeks = unimplementedControls * 1;
    const testingDays = untestedControls * 1;
    
    const totalDays = (implementationWeeks * 7) + testingDays;
    
    return {
      estimatedDays: totalDays,
      estimatedWeeks: Math.ceil(totalDays / 7),
      readinessDate: new Date(this.getDeterministicTimestamp() + (totalDays * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
      phases: [
        {
          phase: 'Control Implementation',
          estimatedDays: implementationWeeks * 7,
          controls: unimplementedControls
        },
        {
          phase: 'Control Testing',
          estimatedDays: testingDays,
          controls: untestedControls
        },
        {
          phase: 'Evidence Collection',
          estimatedDays: 14,
          description: 'Finalize evidence repository'
        }
      ]
    };
  }

  /**
   * Log events
   */
  logEvent(eventType, data) {
    const logEntry = {
      timestamp: this.getDeterministicDate().toISOString(),
      eventType,
      data,
      organization: this.config.organizationName
    };

    console.log('[SOC 2 Audit Log]', JSON.stringify(logEntry, null, 2));
  }

  /**
   * Export controls for audit
   */
  exportControlsForAudit() {
    const controls = Array.from(this.controls.values());
    const testResults = Array.from(this.testResults.values());
    const evidence = Array.from(this.evidenceRepository.values());
    const exceptions = Array.from(this.exceptions.values());

    return {
      exportDate: this.getDeterministicDate().toISOString(),
      organization: this.config.organizationName,
      auditPeriod: this.config.auditPeriod,
      controls,
      testResults,
      evidence,
      exceptions,
      summary: this.getControlEffectiveness()
    };
  }
}

module.exports = SOC2ControlsFramework;