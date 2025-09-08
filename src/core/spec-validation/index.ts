import { SpecificationValidator } from './validators/specification.validator.js';
import { MCPValidationIntegration } from './integration/mcp.integration.js';
import { EnterpriseComplianceChecker } from './compliance/enterprise.compliance.js';
import { ValidationReporter } from './reports/validation.reporter.js';
import { ValidationConfigManager, validationConfig } from './config/validation.config.js';
import type {
  ValidationContext,
  ValidationResult,
  ValidationOptions,
  ValidationIssue,
  AIValidationInsight,
  ComplianceStatus,
} from './types/validation.types.js';
import type { Specification } from './schemas/specification.schema.js';

/**
 * Main specification validation orchestrator
 */
export class SpecificationValidationPipeline {
  private validator: SpecificationValidator;
  private mcpIntegration?: MCPValidationIntegration;
  private complianceChecker: EnterpriseComplianceChecker;
  private reporter: ValidationReporter;
  private config: ValidationConfigManager;

  constructor() {
    this.config = validationConfig;
    this.validator = new SpecificationValidator();
    this.complianceChecker = new EnterpriseComplianceChecker();
    this.reporter = new ValidationReporter(this.config.getConfig().reports);

    // Initialize MCP integration if enabled
    const aiConfig = this.config.getConfig().ai;
    if (aiConfig && aiConfig.enabled) {
      this.mcpIntegration = new MCPValidationIntegration(aiConfig);
    }
  }

  /**
   * Validate a specification with full pipeline
   */
  async validateSpecification(
    specification: unknown,
    options: ValidationOptions = {}
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    
    // Create validation context
    const context: ValidationContext = {
      specificationId: options.specificationId || `spec-${Date.now()}`,
      validationId: `validation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      version: '1.0.0',
      environment: 'development',
      options,
    };

    const issues: ValidationIssue[] = [];
    let aiInsights: AIValidationInsight[] = [];
    let complianceStatus: ComplianceStatus[] = [];

    try {
      // Step 1: Format validation (always first)
      console.log('🔍 Running format validation...');
      const formatIssues = await this.validator.validateFormat(specification, context);
      issues.push(...formatIssues);

      // Only continue if format validation passes (no errors)
      const hasFormatErrors = formatIssues.some(issue => issue.severity === 'error');
      
      if (!hasFormatErrors) {
        const spec = specification as Specification;

        // Step 2: Completeness validation
        console.log('📋 Running completeness validation...');
        const completenessIssues = await this.validator.validateCompleteness(specification, context);
        issues.push(...completenessIssues);

        // Step 3: AI-powered validation (if enabled)
        if (this.mcpIntegration && (options.includeAI !== false)) {
          console.log('🤖 Running AI-powered validation...');
          try {
            await this.mcpIntegration.initialize();
            
            const [completenessInsights, consistencyInsights, qualityInsights, riskInsights] = 
              await Promise.allSettled([
                this.mcpIntegration.validateCompleteness(specification, context),
                this.mcpIntegration.validateConsistency(specification, context),
                this.mcpIntegration.assessQuality(specification, context),
                this.mcpIntegration.analyzeRisks(specification, context),
              ]);

            // Collect successful insights
            [completenessInsights, consistencyInsights, qualityInsights, riskInsights]
              .forEach(result => {
                if (result.status === 'fulfilled') {
                  aiInsights.push(...result.value);
                }
              });

            // Convert AI insights to validation issues
            const aiIssues = this.mcpIntegration.insightsToValidationIssues(aiInsights);
            issues.push(...aiIssues);

          } catch (error) {
            console.warn('AI validation failed, continuing without AI insights:', error);
          }
        }

        // Step 4: Compliance validation (if enabled)
        if (options.includeCompliance !== false) {
          console.log('⚖️ Running compliance validation...');
          try {
            complianceStatus = await this.complianceChecker.checkCompliance(spec, context);
            const complianceIssues = this.complianceChecker.complianceToValidationIssues(complianceStatus);
            issues.push(...complianceIssues);
          } catch (error) {
            console.warn('Compliance validation failed:', error);
          }
        }
      } else {
        console.log('⚠️ Format validation failed, skipping advanced validations');
      }

      // Generate metrics and result
      const executionTime = Date.now() - startTime;
      const metrics = this.validator.generateMetrics(
        issues, 
        executionTime, 
        hasFormatErrors ? undefined : specification as Specification
      );

      const summary = {
        errors: issues.filter(i => i.severity === 'error').length,
        warnings: issues.filter(i => i.severity === 'warning').length,
        info: issues.filter(i => i.severity === 'info').length,
        passed: issues.filter(i => i.severity === 'error').length === 0,
      };

      const status = summary.errors === 0 ? (summary.warnings === 0 ? 'passed' : 'warning') : 'failed';

      const result: ValidationResult = {
        id: context.validationId,
        context,
        status,
        issues,
        metrics,
        summary,
        recommendations: this.generateRecommendations(issues, aiInsights),
        aiInsights: aiInsights.length > 0 ? aiInsights : undefined,
        complianceStatus: complianceStatus.length > 0 ? complianceStatus : undefined,
      };

      // Generate report if requested
      if (!options.dryRun) {
        console.log('📄 Generating validation report...');
        await this.reporter.generateSingleReport(result);
      }

      return result;

    } catch (error) {
      // Handle unexpected errors
      const errorIssue: ValidationIssue = {
        id: `validation-error-${Date.now()}`,
        ruleId: 'validation-pipeline',
        severity: 'error',
        message: 'Validation pipeline failed',
        description: error instanceof Error ? error.message : String(error),
        path: '',
        autoFixable: false,
        metadata: { error: String(error) },
      };

      issues.push(errorIssue);

      return {
        id: context.validationId,
        context,
        status: 'failed',
        issues,
        metrics: this.validator.generateMetrics(issues, Date.now() - startTime),
        summary: {
          errors: 1,
          warnings: 0,
          info: 0,
          passed: false,
        },
        recommendations: [],
      };
    }
  }

  /**
   * Validate multiple specifications in batch
   */
  async validateBatch(
    specifications: Array<{ id: string; data: unknown }>,
    options: ValidationOptions = {}
  ): Promise<ValidationResult[]> {
    console.log(`🔄 Starting batch validation of ${specifications.length} specifications...`);
    
    const results: ValidationResult[] = [];
    
    if (options.parallel !== false) {
      // Parallel validation
      const promises = specifications.map(spec => 
        this.validateSpecification(spec.data, { ...options, specificationId: spec.id })
      );
      
      const settledResults = await Promise.allSettled(promises);
      
      settledResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          // Create error result for failed validation
          const errorResult: ValidationResult = {
            id: `error-${specifications[index].id}`,
            context: {
              specificationId: specifications[index].id,
              validationId: `validation-error-${Date.now()}`,
              timestamp: new Date(),
              version: '1.0.0',
              environment: 'development',
              options,
            },
            status: 'failed',
            issues: [{
              id: `batch-error-${Date.now()}`,
              ruleId: 'batch-validation',
              severity: 'error',
              message: 'Batch validation failed for specification',
              description: String(result.reason),
              path: '',
              autoFixable: false,
              metadata: { batchError: true },
            }],
            metrics: this.validator.generateMetrics([], 0),
            summary: { errors: 1, warnings: 0, info: 0, passed: false },
            recommendations: [],
          };
          results.push(errorResult);
        }
      });
      
    } else {
      // Sequential validation
      for (const spec of specifications) {
        try {
          const result = await this.validateSpecification(
            spec.data, 
            { ...options, specificationId: spec.id }
          );
          results.push(result);
        } catch (error) {
          console.error(`Failed to validate specification ${spec.id}:`, error);
        }
      }
    }

    // Generate combined report
    if (!options.dryRun) {
      console.log('📊 Generating batch validation report...');
      await this.reporter.generateReport(results);
    }

    return results;
  }

  /**
   * Generate recommendations from validation results
   */
  private generateRecommendations(
    issues: ValidationIssue[],
    aiInsights: AIValidationInsight[]
  ): ValidationResult['recommendations'] {
    const recommendations: ValidationResult['recommendations'] = [];

    // Recommendations from critical errors
    const criticalIssues = issues.filter(issue => issue.severity === 'error');
    if (criticalIssues.length > 0) {
      recommendations.push({
        type: 'fix',
        priority: 'high',
        title: 'Fix critical validation errors',
        description: `${criticalIssues.length} critical errors must be resolved`,
        impact: 'Specification cannot be considered valid until errors are fixed',
        effort: 'high',
        autoApplicable: false,
      });
    }

    // Recommendations from warnings
    const warnings = issues.filter(issue => issue.severity === 'warning');
    if (warnings.length > 5) {
      recommendations.push({
        type: 'improvement',
        priority: 'medium',
        title: 'Address validation warnings',
        description: `${warnings.length} warnings should be reviewed and resolved`,
        impact: 'Improving specification quality and reducing implementation risks',
        effort: 'medium',
        autoApplicable: false,
      });
    }

    // Recommendations from AI insights
    for (const insight of aiInsights) {
      if (insight.confidence >= 0.85 && insight.suggestions.length > 0) {
        recommendations.push({
          type: 'enhancement',
          priority: insight.category === 'risk' ? 'high' : 'medium',
          title: `${insight.category} improvement`,
          description: insight.finding,
          impact: insight.reasoning,
          effort: 'medium',
          autoApplicable: false,
        });
      }
    }

    return recommendations.slice(0, 10); // Limit to top 10 recommendations
  }

  /**
   * Get validation configuration
   */
  getConfig(): ValidationConfigManager {
    return this.config;
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<typeof this.config>): void {
    // Reinitialize components with new config if needed
    const newConfig = this.config.updateConfig(updates);
    
    this.reporter = new ValidationReporter(newConfig.reports);
    
    if (newConfig.ai && newConfig.ai.enabled && !this.mcpIntegration) {
      this.mcpIntegration = new MCPValidationIntegration(newConfig.ai);
    }
  }
}

// Export main classes and types
export {
  SpecificationValidator,
  MCPValidationIntegration,
  EnterpriseComplianceChecker,
  ValidationReporter,
  ValidationConfigManager,
  validationConfig,
};

export * from './types/validation.types.js';
export * from './schemas/specification.schema.js';
export * from './schemas/validation-config.schema.js';

// Export default instance
export const specValidation = new SpecificationValidationPipeline();