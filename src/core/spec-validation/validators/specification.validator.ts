import { z } from 'zod';
import { SpecificationSchema } from '../schemas/specification.schema.js';
import type { 
  ValidationIssue, 
  ValidationContext, 
  ValidationResult,
  ValidationMetrics 
} from '../types/validation.types.js';

/**
 * Core specification validator that handles format and completeness validation
 */
export class SpecificationValidator {
  private schema = SpecificationSchema;

  /**
   * Validates a specification against the Zod schema
   */
  async validateFormat(
    specification: unknown, 
    context: ValidationContext
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    const startTime = Date.now();

    try {
      // Parse with Zod schema
      const result = this.schema.safeParse(specification);
      
      if (!result.success) {
        // Convert Zod errors to validation issues
        for (const error of result.error.issues) {
          issues.push({
            id: `format-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            ruleId: 'schema-validation',
            severity: 'error',
            message: error.message,
            description: `Schema validation failed: ${error.message}`,
            path: error.path.join('.'),
            autoFixable: false,
            metadata: {
              zodError: error,
              code: error.code,
              expected: error.expected,
              received: error.received,
              executionTime: Date.now() - startTime,
            },
          });
        }
      }
    } catch (error) {
      issues.push({
        id: `format-error-${Date.now()}`,
        ruleId: 'schema-parsing',
        severity: 'error',
        message: 'Failed to parse specification',
        description: error instanceof Error ? error.message : 'Unknown parsing error',
        path: '',
        autoFixable: false,
        metadata: { error: String(error) },
      });
    }

    return issues;
  }

  /**
   * Validates specification completeness beyond basic schema validation
   */
  async validateCompleteness(
    specification: unknown,
    context: ValidationContext
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // First, ensure the spec passes basic format validation
    const formatIssues = await this.validateFormat(specification, context);
    if (formatIssues.some(issue => issue.severity === 'error')) {
      return formatIssues; // Can't check completeness if format is invalid
    }

    const spec = specification as z.infer<typeof SpecificationSchema>;

    // Check requirement completeness
    issues.push(...this.checkRequirementsCompleteness(spec));
    
    // Check architecture completeness
    if (spec.architecture) {
      issues.push(...this.checkArchitectureCompleteness(spec));
    }

    // Check implementation completeness
    if (spec.implementation) {
      issues.push(...this.checkImplementationCompleteness(spec));
    }

    // Check testing completeness
    if (spec.testing) {
      issues.push(...this.checkTestingCompleteness(spec));
    }

    // Check cross-section consistency
    issues.push(...this.checkConsistency(spec));

    return issues;
  }

  /**
   * Check requirements section completeness
   */
  private checkRequirementsCompleteness(spec: z.infer<typeof SpecificationSchema>): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check for requirement traceability
    const requirementIds = spec.requirements.map(req => req.id);
    const duplicateIds = requirementIds.filter((id, index) => requirementIds.indexOf(id) !== index);
    
    for (const duplicateId of duplicateIds) {
      issues.push({
        id: `req-duplicate-${duplicateId}`,
        ruleId: 'requirement-uniqueness',
        severity: 'error',
        message: `Duplicate requirement ID: ${duplicateId}`,
        description: 'Each requirement must have a unique identifier',
        path: `requirements[id="${duplicateId}"]`,
        autoFixable: false,
        metadata: { duplicateId },
      });
    }

    // Check for orphaned dependencies
    for (const req of spec.requirements) {
      for (const depId of req.dependencies) {
        if (!requirementIds.includes(depId)) {
          issues.push({
            id: `req-orphan-${req.id}-${depId}`,
            ruleId: 'requirement-dependency',
            severity: 'warning',
            message: `Requirement ${req.id} depends on non-existent requirement ${depId}`,
            description: 'All requirement dependencies must reference existing requirements',
            path: `requirements[id="${req.id}"].dependencies`,
            autoFixable: false,
            metadata: { requirementId: req.id, missingDependency: depId },
          });
        }
      }
    }

    // Check for adequate acceptance criteria coverage
    for (const req of spec.requirements) {
      if (req.acceptanceCriteria.length === 0) {
        issues.push({
          id: `req-no-acceptance-${req.id}`,
          ruleId: 'requirement-acceptance-criteria',
          severity: 'warning',
          message: `Requirement ${req.id} has no acceptance criteria`,
          description: 'Requirements should have clear acceptance criteria for validation',
          path: `requirements[id="${req.id}"].acceptanceCriteria`,
          autoFixable: false,
          metadata: { requirementId: req.id },
        });
      }
    }

    return issues;
  }

  /**
   * Check architecture section completeness
   */
  private checkArchitectureCompleteness(spec: z.infer<typeof SpecificationSchema>): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const architecture = spec.architecture!;

    // Check component dependencies
    const componentIds = architecture.components.map(comp => comp.id);
    
    for (const component of architecture.components) {
      for (const depId of component.dependencies) {
        if (!componentIds.includes(depId)) {
          issues.push({
            id: `arch-orphan-${component.id}-${depId}`,
            ruleId: 'architecture-dependency',
            severity: 'warning',
            message: `Component ${component.id} depends on non-existent component ${depId}`,
            description: 'All component dependencies must reference existing components',
            path: `architecture.components[id="${component.id}"].dependencies`,
            autoFixable: false,
            metadata: { componentId: component.id, missingDependency: depId },
          });
        }
      }
    }

    // Check data flow consistency
    for (const flow of architecture.dataFlow) {
      if (!componentIds.includes(flow.from)) {
        issues.push({
          id: `arch-flow-from-${flow.from}`,
          ruleId: 'architecture-dataflow',
          severity: 'error',
          message: `Data flow references non-existent source component: ${flow.from}`,
          path: 'architecture.dataFlow',
          autoFixable: false,
          metadata: { flow, missingComponent: flow.from },
        });
      }
      
      if (!componentIds.includes(flow.to)) {
        issues.push({
          id: `arch-flow-to-${flow.to}`,
          ruleId: 'architecture-dataflow',
          severity: 'error',
          message: `Data flow references non-existent target component: ${flow.to}`,
          path: 'architecture.dataFlow',
          autoFixable: false,
          metadata: { flow, missingComponent: flow.to },
        });
      }
    }

    return issues;
  }

  /**
   * Check implementation section completeness
   */
  private checkImplementationCompleteness(spec: z.infer<typeof SpecificationSchema>): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const implementation = spec.implementation!;

    // Check if build process is defined for source files
    const hasSourceFiles = implementation.structure.files.some(file => file.type === 'source');
    if (hasSourceFiles && !implementation.buildProcess) {
      issues.push({
        id: 'impl-missing-build',
        ruleId: 'implementation-build-process',
        severity: 'warning',
        message: 'Implementation has source files but no build process defined',
        description: 'Source files typically require a build process specification',
        path: 'implementation.buildProcess',
        autoFixable: false,
        metadata: { hasSourceFiles },
      });
    }

    // Check for test files if testing section exists
    if (spec.testing) {
      const hasTestFiles = implementation.structure.files.some(file => file.type === 'test');
      if (!hasTestFiles) {
        issues.push({
          id: 'impl-missing-test-files',
          ruleId: 'implementation-test-files',
          severity: 'info',
          message: 'Testing section exists but no test files defined in implementation',
          description: 'Consider adding test files to the implementation structure',
          path: 'implementation.structure.files',
          autoFixable: false,
          metadata: { hasTesting: true },
        });
      }
    }

    return issues;
  }

  /**
   * Check testing section completeness
   */
  private checkTestingCompleteness(spec: z.infer<typeof SpecificationSchema>): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const testing = spec.testing!;

    // Check for balanced test coverage across levels
    const testLevels = testing.levels.map(level => level.type);
    const recommendedLevels = ['unit', 'integration'];
    
    for (const level of recommendedLevels) {
      if (!testLevels.includes(level as any)) {
        issues.push({
          id: `test-missing-${level}`,
          ruleId: 'testing-coverage-levels',
          severity: 'info',
          message: `No ${level} testing level defined`,
          description: `Consider adding ${level} testing for comprehensive coverage`,
          path: 'testing.levels',
          autoFixable: false,
          metadata: { missingLevel: level, recommendedLevels },
        });
      }
    }

    // Check automation setup for CI/CD
    if (testing.automation.cicd && (!testing.automation.triggers || testing.automation.triggers.length === 0)) {
      issues.push({
        id: 'test-cicd-no-triggers',
        ruleId: 'testing-automation',
        severity: 'warning',
        message: 'CI/CD automation enabled but no triggers defined',
        description: 'Define triggers for automated test execution',
        path: 'testing.automation.triggers',
        autoFixable: false,
        metadata: { automation: testing.automation },
      });
    }

    return issues;
  }

  /**
   * Check cross-section consistency
   */
  private checkConsistency(spec: z.infer<typeof SpecificationSchema>): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check requirement-architecture alignment
    if (spec.architecture) {
      const functionalReqs = spec.requirements.filter(req => req.type === 'functional');
      const components = spec.architecture.components;

      // Warn if many functional requirements but few components
      if (functionalReqs.length > components.length * 3) {
        issues.push({
          id: 'consistency-req-arch-ratio',
          ruleId: 'cross-section-consistency',
          severity: 'info',
          message: 'High ratio of functional requirements to architectural components',
          description: 'Consider if the architecture adequately addresses all functional requirements',
          path: 'requirements,architecture.components',
          autoFixable: false,
          metadata: { 
            functionalRequirements: functionalReqs.length, 
            components: components.length 
          },
        });
      }
    }

    // Check implementation-testing alignment
    if (spec.implementation && spec.testing) {
      const sourceFiles = spec.implementation.structure.files.filter(f => f.type === 'source');
      const testLevels = spec.testing.levels;

      if (sourceFiles.length > 10 && !testLevels.some(l => l.type === 'unit')) {
        issues.push({
          id: 'consistency-impl-test-unit',
          ruleId: 'cross-section-consistency',
          severity: 'warning',
          message: 'Large codebase without unit testing strategy',
          description: 'Consider adding unit testing for maintainability',
          path: 'implementation.structure.files,testing.levels',
          autoFixable: false,
          metadata: { sourceFiles: sourceFiles.length },
        });
      }
    }

    return issues;
  }

  /**
   * Generate validation metrics
   */
  generateMetrics(
    issues: ValidationIssue[], 
    executionTime: number,
    spec?: z.infer<typeof SpecificationSchema>
  ): ValidationMetrics {
    const totalRules = this.getTotalRulesCount();
    const rulesExecuted = new Set(issues.map(issue => issue.ruleId)).size;
    const rulesFailed = new Set(
      issues.filter(issue => issue.severity === 'error').map(issue => issue.ruleId)
    ).size;
    
    return {
      totalRules,
      rulesExecuted,
      rulesPassed: rulesExecuted - rulesFailed,
      rulesFailed,
      rulesSkipped: totalRules - rulesExecuted,
      executionTime,
      coverage: this.calculateCoverage(spec),
      complexity: this.calculateComplexity(spec),
    };
  }

  private getTotalRulesCount(): number {
    // This would be dynamically calculated based on enabled rules
    return 15; // Placeholder - implement based on actual rule registry
  }

  private calculateCoverage(spec?: z.infer<typeof SpecificationSchema>): ValidationMetrics['coverage'] {
    if (!spec) {
      return { requirements: 0, architecture: 0, implementation: 0, testing: 0, documentation: 0 };
    }

    return {
      requirements: spec.requirements.length > 0 ? 100 : 0,
      architecture: spec.architecture ? 100 : 0,
      implementation: spec.implementation ? 100 : 0,
      testing: spec.testing ? 100 : 0,
      documentation: spec.documentation ? 75 : 0, // Based on documentation flags
    };
  }

  private calculateComplexity(spec?: z.infer<typeof SpecificationSchema>): ValidationMetrics['complexity'] {
    if (!spec) {
      return { score: 0, factors: [] };
    }

    const factors: string[] = [];
    let score = 1;

    // Add complexity based on requirements
    if (spec.requirements.length > 10) {
      factors.push('High number of requirements');
      score += 1;
    }

    // Add complexity based on architecture
    if (spec.architecture && spec.architecture.components.length > 5) {
      factors.push('Complex architecture');
      score += 1;
    }

    // Add complexity based on dependencies
    const totalDependencies = spec.requirements.reduce(
      (acc, req) => acc + req.dependencies.length, 0
    );
    if (totalDependencies > spec.requirements.length) {
      factors.push('High dependency coupling');
      score += 1;
    }

    return { score: Math.min(score, 5), factors };
  }
}