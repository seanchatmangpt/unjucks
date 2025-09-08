/**
 * Spec Review Workflow - Automated validation and approval
 * Validates specifications for completeness, consistency, and compliance
 */

import type {
  WorkflowConfig,
  WorkflowState,
  WorkflowResult,
  SpecificationDocument,
  Requirement,
  AcceptanceCriterion
} from './types';

export interface SpecReviewConfig extends WorkflowConfig {
  validationRules: ValidationRule[];
  approvalThreshold: number;
  reviewerTypes: string[];
  automaticApproval: boolean;
}

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  type: 'structural' | 'semantic' | 'compliance' | 'quality';
  severity: 'error' | 'warning' | 'info';
  rule: (spec: SpecificationDocument) => ValidationResult;
}

export interface ValidationResult {
  passed: boolean;
  message: string;
  suggestions?: string[];
  line?: number;
  section?: string;
}

export interface ReviewResult {
  specId: string;
  overallScore: number;
  validationResults: ValidationResult[];
  recommendations: string[];
  approved: boolean;
  reviewerId: string;
  reviewedAt: Date;
}

export class SpecReviewWorkflow {
  private config: SpecReviewConfig;
  private state: WorkflowState;

  constructor(config: SpecReviewConfig) {
    this.config = config;
    this.state = {
      id: `spec-review-${Date.now()}`,
      status: 'pending',
      currentStep: 'initialization',
      progress: 0,
      startTime: new Date(),
      metadata: {}
    };
  }

  async execute(specification: SpecificationDocument): Promise<WorkflowResult<ReviewResult>> {
    const startTime = Date.now();
    
    try {
      this.updateState('in_progress', 'validation', 10);

      // Step 1: Structural validation
      const structuralResults = await this.validateStructure(specification);
      this.updateState('in_progress', 'semantic-analysis', 30);

      // Step 2: Semantic analysis
      const semanticResults = await this.analyzeSemantics(specification);
      this.updateState('in_progress', 'compliance-check', 50);

      // Step 3: Compliance checking
      const complianceResults = await this.checkCompliance(specification);
      this.updateState('in_progress', 'quality-assessment', 70);

      // Step 4: Quality assessment
      const qualityResults = await this.assessQuality(specification);
      this.updateState('in_progress', 'approval-decision', 90);

      // Step 5: Approval decision
      const reviewResult = await this.makeApprovalDecision(
        specification,
        [...structuralResults, ...semanticResults, ...complianceResults, ...qualityResults]
      );

      this.updateState('completed', 'finished', 100);

      return {
        success: true,
        data: reviewResult,
        metrics: {
          duration: Date.now() - startTime,
          stepsCompleted: 5,
          totalSteps: 5,
          resourcesUsed: { 'validation-rules': this.config.validationRules.length },
          agentsInvolved: ['spec-reviewer', 'compliance-checker', 'quality-assessor']
        }
      };

    } catch (error) {
      this.updateState('failed', 'error', this.state.progress);
      this.state.error = {
        code: 'SPEC_REVIEW_FAILED',
        message: error.message,
        stack: error.stack,
        recoverable: true
      };

      return {
        success: false,
        error: this.state.error,
        metrics: {
          duration: Date.now() - startTime,
          stepsCompleted: 0,
          totalSteps: 5,
          resourcesUsed: {},
          agentsInvolved: []
        }
      };
    }
  }

  private async validateStructure(spec: SpecificationDocument): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    // Check required fields
    const requiredFields = ['title', 'description', 'requirements', 'acceptanceCriteria'];
    for (const field of requiredFields) {
      if (!spec[field] || (Array.isArray(spec[field]) && spec[field].length === 0)) {
        results.push({
          passed: false,
          message: `Missing required field: ${field}`,
          suggestions: [`Add ${field} to the specification`]
        });
      }
    }

    // Validate requirements structure
    if (spec.requirements) {
      spec.requirements.forEach((req, index) => {
        if (!req.id || !req.title || !req.description) {
          results.push({
            passed: false,
            message: `Requirement ${index + 1} is missing required fields`,
            suggestions: ['Ensure all requirements have id, title, and description']
          });
        }
      });
    }

    // Validate acceptance criteria
    if (spec.acceptanceCriteria) {
      spec.acceptanceCriteria.forEach((criterion, index) => {
        if (!criterion.given || !criterion.when || !criterion.then) {
          results.push({
            passed: false,
            message: `Acceptance criterion ${index + 1} is incomplete`,
            suggestions: ['Use Given-When-Then format for all acceptance criteria']
          });
        }
      });
    }

    return results;
  }

  private async analyzeSemantics(spec: SpecificationDocument): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    // Check for ambiguous language
    const ambiguousTerms = ['should', 'might', 'could', 'possibly', 'maybe'];
    const specText = `${spec.description} ${spec.requirements.map(r => r.description).join(' ')}`;
    
    ambiguousTerms.forEach(term => {
      if (specText.toLowerCase().includes(term)) {
        results.push({
          passed: false,
          message: `Ambiguous language detected: "${term}"`,
          suggestions: ['Use precise, unambiguous language in specifications']
        });
      }
    });

    // Check for requirement traceability
    const requirementIds = new Set(spec.requirements.map(r => r.id));
    spec.acceptanceCriteria.forEach(criterion => {
      if (!requirementIds.has(criterion.requirementId)) {
        results.push({
          passed: false,
          message: `Acceptance criterion references non-existent requirement: ${criterion.requirementId}`,
          suggestions: ['Ensure all acceptance criteria reference valid requirements']
        });
      }
    });

    // Check for testability
    const untestableRequirements = spec.requirements.filter(r => !r.testable);
    if (untestableRequirements.length > 0) {
      results.push({
        passed: false,
        message: `${untestableRequirements.length} requirements are marked as not testable`,
        suggestions: ['Make requirements testable with specific, measurable criteria']
      });
    }

    return results;
  }

  private async checkCompliance(spec: SpecificationDocument): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    // Security compliance checks
    const securityKeywords = ['authentication', 'authorization', 'encryption', 'privacy', 'security'];
    const hasSecurityRequirements = spec.requirements.some(req => 
      securityKeywords.some(keyword => 
        req.description.toLowerCase().includes(keyword) || 
        req.title.toLowerCase().includes(keyword)
      )
    );

    if (!hasSecurityRequirements) {
      results.push({
        passed: false,
        message: 'No security requirements identified',
        suggestions: ['Consider adding security and privacy requirements']
      });
    }

    // Performance requirements
    const hasPerformanceRequirements = spec.requirements.some(req => 
      req.type === 'non-functional' && 
      req.description.toLowerCase().includes('performance')
    );

    if (!hasPerformanceRequirements) {
      results.push({
        passed: false,
        message: 'No performance requirements specified',
        suggestions: ['Add performance and scalability requirements']
      });
    }

    // Accessibility compliance
    const hasAccessibilityRequirements = spec.requirements.some(req =>
      req.description.toLowerCase().includes('accessibility') ||
      req.description.toLowerCase().includes('wcag')
    );

    if (!hasAccessibilityRequirements) {
      results.push({
        passed: false,
        message: 'No accessibility requirements specified',
        suggestions: ['Consider adding accessibility requirements (WCAG compliance)']
      });
    }

    return results;
  }

  private async assessQuality(spec: SpecificationDocument): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    // Check requirement priorities
    const priorityDistribution = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    spec.requirements.forEach(req => {
      priorityDistribution[req.priority]++;
    });

    if (priorityDistribution.critical + priorityDistribution.high > spec.requirements.length * 0.3) {
      results.push({
        passed: false,
        message: 'Too many high-priority requirements (>30%)',
        suggestions: ['Balance requirement priorities for realistic implementation']
      });
    }

    // Check for complexity indicators
    const complexityIndicators = ['complex', 'complicated', 'sophisticated', 'advanced'];
    const complexRequirements = spec.requirements.filter(req =>
      complexityIndicators.some(indicator =>
        req.description.toLowerCase().includes(indicator)
      )
    );

    if (complexRequirements.length > spec.requirements.length * 0.2) {
      results.push({
        passed: false,
        message: 'High complexity detected in multiple requirements',
        suggestions: ['Break down complex requirements into smaller, manageable pieces']
      });
    }

    // Check requirement coverage
    const functionalReqs = spec.requirements.filter(r => r.type === 'functional').length;
    const nonFunctionalReqs = spec.requirements.filter(r => r.type === 'non-functional').length;

    if (nonFunctionalReqs === 0) {
      results.push({
        passed: false,
        message: 'No non-functional requirements specified',
        suggestions: ['Add non-functional requirements (performance, security, usability)']
      });
    }

    return results;
  }

  private async makeApprovalDecision(
    spec: SpecificationDocument,
    validationResults: ValidationResult[]
  ): Promise<ReviewResult> {
    const errors = validationResults.filter(r => !r.passed).length;
    const totalChecks = validationResults.length;
    const score = totalChecks > 0 ? ((totalChecks - errors) / totalChecks) * 100 : 0;
    
    const approved = score >= this.config.approvalThreshold && errors === 0;
    
    const recommendations: string[] = [];
    
    if (!approved) {
      recommendations.push('Address all validation errors before resubmission');
      validationResults.filter(r => !r.passed).forEach(result => {
        if (result.suggestions) {
          recommendations.push(...result.suggestions);
        }
      });
    }

    return {
      specId: spec.id,
      overallScore: score,
      validationResults,
      recommendations: [...new Set(recommendations)], // Remove duplicates
      approved,
      reviewerId: 'automated-reviewer',
      reviewedAt: new Date()
    };
  }

  private updateState(status: WorkflowState['status'], step: string, progress: number): void {
    this.state.status = status;
    this.state.currentStep = step;
    this.state.progress = progress;
    
    if (status === 'completed' || status === 'failed') {
      this.state.endTime = new Date();
    }
  }

  getState(): WorkflowState {
    return { ...this.state };
  }

  // Predefined validation rules
  static getDefaultValidationRules(): ValidationRule[] {
    return [
      {
        id: 'req-001',
        name: 'Required Fields',
        description: 'Validates that all required fields are present',
        type: 'structural',
        severity: 'error',
        rule: (spec) => ({
          passed: !!(spec.title && spec.description && spec.requirements?.length),
          message: 'All required fields must be present'
        })
      },
      {
        id: 'req-002',
        name: 'Testable Requirements',
        description: 'Ensures requirements are testable',
        type: 'quality',
        severity: 'warning',
        rule: (spec) => ({
          passed: spec.requirements?.every(r => r.testable) ?? false,
          message: 'All requirements should be testable'
        })
      },
      {
        id: 'req-003',
        name: 'Acceptance Criteria Coverage',
        description: 'Validates that requirements have acceptance criteria',
        type: 'semantic',
        severity: 'error',
        rule: (spec) => {
          const reqIds = new Set(spec.requirements?.map(r => r.id) ?? []);
          const coveredReqs = new Set(spec.acceptanceCriteria?.map(c => c.requirementId) ?? []);
          return {
            passed: reqIds.size === coveredReqs.size && [...reqIds].every(id => coveredReqs.has(id)),
            message: 'All requirements must have acceptance criteria'
          };
        }
      }
    ];
  }
}