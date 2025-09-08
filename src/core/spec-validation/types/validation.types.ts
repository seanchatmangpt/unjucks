/**
 * Validation result types and interfaces
 */

export interface ValidationIssue {
  id: string;
  ruleId: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  description?: string;
  path: string;
  line?: number;
  column?: number;
  suggestion?: string;
  autoFixable: boolean;
  metadata: Record<string, unknown>;
}

export interface ValidationMetrics {
  totalRules: number;
  rulesExecuted: number;
  rulesPassed: number;
  rulesFailed: number;
  rulesSkipped: number;
  executionTime: number;
  coverage: {
    requirements: number;
    architecture: number;
    implementation: number;
    testing: number;
    documentation: number;
  };
  complexity: {
    score: number;
    factors: string[];
  };
}

export interface ValidationContext {
  specificationId: string;
  validationId: string;
  timestamp: Date;
  version: string;
  environment: 'development' | 'staging' | 'production';
  user?: string;
  options: ValidationOptions;
}

export interface ValidationOptions {
  rules?: string[];
  skipRules?: string[];
  severity?: 'error' | 'warning' | 'info';
  includeAI?: boolean;
  includeCompliance?: boolean;
  dryRun?: boolean;
  format?: 'json' | 'html' | 'pdf' | 'markdown';
  outputPath?: string;
  parallel?: boolean;
}

export interface ValidationResult {
  id: string;
  context: ValidationContext;
  status: 'passed' | 'failed' | 'warning';
  issues: ValidationIssue[];
  metrics: ValidationMetrics;
  summary: {
    errors: number;
    warnings: number;
    info: number;
    passed: boolean;
  };
  recommendations: Recommendation[];
  aiInsights?: AIValidationInsight[];
  complianceStatus?: ComplianceStatus[];
}

export interface Recommendation {
  type: 'improvement' | 'fix' | 'enhancement';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  autoApplicable: boolean;
}

export interface AIValidationInsight {
  category: 'completeness' | 'consistency' | 'quality' | 'risk';
  confidence: number;
  finding: string;
  reasoning: string;
  suggestions: string[];
  relatedRequirements: string[];
}

export interface ComplianceStatus {
  standardId: string;
  standardName: string;
  overallStatus: 'compliant' | 'non-compliant' | 'partial';
  requirements: ComplianceRequirementStatus[];
  gaps: ComplianceGap[];
}

export interface ComplianceRequirementStatus {
  requirementId: string;
  description: string;
  status: 'met' | 'not-met' | 'partial' | 'not-applicable';
  evidence: string[];
  gaps: string[];
}

export interface ComplianceGap {
  requirementId: string;
  description: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  remediation: string[];
}

export interface ValidationReport {
  metadata: {
    generated: Date;
    version: string;
    format: string;
  };
  summary: ValidationSummary;
  results: ValidationResult[];
  trends?: ValidationTrend[];
  appendices: {
    ruleDetails: RuleDetail[];
    complianceMatrix: ComplianceMatrix;
  };
}

export interface ValidationSummary {
  totalSpecifications: number;
  passRate: number;
  averageScore: number;
  commonIssues: IssueFrequency[];
  recommendations: Recommendation[];
}

export interface ValidationTrend {
  period: string;
  metrics: ValidationMetrics;
  improvement: number;
}

export interface RuleDetail {
  id: string;
  name: string;
  description: string;
  category: string;
  severity: string;
  executionCount: number;
  successRate: number;
}

export interface ComplianceMatrix {
  standards: string[];
  requirements: Array<{
    standardId: string;
    requirementId: string;
    coverage: number;
    status: string;
  }>;
}

export interface IssueFrequency {
  ruleId: string;
  ruleName: string;
  count: number;
  percentage: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export type ValidatorFunction = (
  specification: unknown,
  context: ValidationContext
) => Promise<ValidationIssue[]>;

export interface CustomValidator {
  name: string;
  version: string;
  description: string;
  categories: string[];
  validate: ValidatorFunction;
}

export interface ValidationPlugin {
  name: string;
  version: string;
  initialize: (config: Record<string, unknown>) => Promise<void>;
  cleanup: () => Promise<void>;
  getValidators: () => CustomValidator[];
}