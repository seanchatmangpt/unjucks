import { readFile } from 'fs/promises';
import { z } from 'zod';
import { ValidationConfigSchema, type ValidationConfig } from '../schemas/validation-config.schema.js';

/**
 * Configuration manager for validation settings
 */
export class ValidationConfigManager {
  private config: ValidationConfig | null = null;
  private configPath: string | null = null;

  /**
   * Load configuration from file
   */
  async loadFromFile(path: string): Promise<ValidationConfig> {
    try {
      const content = await readFile(path, 'utf-8');
      const rawConfig = JSON.parse(content);
      
      // Validate configuration with Zod
      const config = ValidationConfigSchema.parse(rawConfig);
      
      this.config = config;
      this.configPath = path;
      
      return config;
    } catch (error) {
      throw new Error(`Failed to load validation configuration from ${path}: ${error}`);
    }
  }

  /**
   * Load configuration from object
   */
  loadFromObject(config: unknown): ValidationConfig {
    try {
      const validatedConfig = ValidationConfigSchema.parse(config);
      this.config = validatedConfig;
      return validatedConfig;
    } catch (error) {
      throw new Error(`Invalid validation configuration: ${error}`);
    }
  }

  /**
   * Get current configuration or create default
   */
  getConfig(): ValidationConfig {
    if (!this.config) {
      return this.createDefaultConfig();
    }
    return this.config;
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<ValidationConfig>): ValidationConfig {
    if (!this.config) {
      this.config = this.createDefaultConfig();
    }

    this.config = { ...this.config, ...updates };
    return this.config;
  }

  /**
   * Create default configuration
   */
  private createDefaultConfig(): ValidationConfig {
    return {
      version: '1.0.0',
      rules: this.getDefaultRules(),
      compliance: this.getDefaultComplianceStandards(),
      ai: this.getDefaultAIConfig(),
      reports: {
        formats: ['json', 'html'],
        includeDetails: true,
        includeSuggestions: true,
        includeMetrics: true,
        outputPath: './validation-reports',
      },
      performance: {
        timeout: 30000,
        retries: 2,
        parallelism: 5,
        caching: {
          enabled: true,
          ttl: 3600,
        },
      },
      customValidators: [],
      integrations: {
        mcp: {
          enabled: true,
          endpoints: [],
        },
        github: {
          enabled: false,
          webhooks: false,
        },
        jira: {
          enabled: false,
          projectKeys: [],
        },
      },
    };
  }

  /**
   * Get default validation rules
   */
  private getDefaultRules(): ValidationConfig['rules'] {
    return [
      {
        id: 'schema-validation',
        name: 'Schema Validation',
        description: 'Validates specification against Zod schema',
        category: 'format',
        severity: 'error',
        enabled: true,
        parameters: {},
      },
      {
        id: 'requirement-completeness',
        name: 'Requirement Completeness',
        description: 'Ensures requirements have adequate detail and acceptance criteria',
        category: 'completeness',
        severity: 'warning',
        enabled: true,
        parameters: {
          minAcceptanceCriteria: 1,
          requireRationale: true,
        },
      },
      {
        id: 'requirement-traceability',
        name: 'Requirement Traceability',
        description: 'Validates requirement dependencies and uniqueness',
        category: 'consistency',
        severity: 'error',
        enabled: true,
        parameters: {},
      },
      {
        id: 'architecture-consistency',
        name: 'Architecture Consistency',
        description: 'Validates architecture component relationships and data flows',
        category: 'consistency',
        severity: 'warning',
        enabled: true,
        parameters: {},
      },
      {
        id: 'implementation-alignment',
        name: 'Implementation Alignment',
        description: 'Checks alignment between implementation and other sections',
        category: 'consistency',
        severity: 'info',
        enabled: true,
        parameters: {},
      },
      {
        id: 'testing-coverage',
        name: 'Testing Coverage',
        description: 'Validates testing strategy completeness',
        category: 'completeness',
        severity: 'warning',
        enabled: true,
        parameters: {
          requiredLevels: ['unit', 'integration'],
        },
      },
      {
        id: 'ai-completeness-check',
        name: 'AI Completeness Analysis',
        description: 'AI-powered analysis of specification completeness',
        category: 'quality',
        severity: 'info',
        enabled: true,
        parameters: {
          confidenceThreshold: 0.8,
        },
      },
      {
        id: 'ai-consistency-check',
        name: 'AI Consistency Analysis',
        description: 'AI-powered analysis of cross-section consistency',
        category: 'quality',
        severity: 'info',
        enabled: true,
        parameters: {
          confidenceThreshold: 0.8,
        },
      },
      {
        id: 'compliance-iso-27001',
        name: 'ISO 27001 Compliance',
        description: 'Validates against ISO 27001 requirements',
        category: 'compliance',
        severity: 'warning',
        enabled: false,
        parameters: {
          standardVersion: '2022',
        },
      },
      {
        id: 'compliance-gdpr',
        name: 'GDPR Compliance',
        description: 'Validates against GDPR requirements',
        category: 'compliance',
        severity: 'warning',
        enabled: false,
        parameters: {},
      },
    ];
  }

  /**
   * Get default compliance standards
   */
  private getDefaultComplianceStandards(): ValidationConfig['compliance'] {
    return [
      {
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
            id: 'iso-27001-a8.1',
            description: 'Asset management',
            mandatory: true,
            checkpoints: ['asset-inventory', 'asset-classification'],
          },
        ],
        applicableCategories: ['api', 'service', 'system'],
      },
      {
        id: 'gdpr',
        name: 'General Data Protection Regulation',
        version: '2018',
        description: 'Data protection and privacy regulation',
        requirements: [
          {
            id: 'gdpr-art-5',
            description: 'Principles of processing personal data',
            mandatory: true,
            checkpoints: ['lawfulness', 'purpose-limitation', 'data-minimization'],
          },
          {
            id: 'gdpr-art-25',
            description: 'Data protection by design and by default',
            mandatory: true,
            checkpoints: ['privacy-by-design', 'technical-measures'],
          },
        ],
        applicableCategories: ['api', 'service', 'system'],
      },
    ];
  }

  /**
   * Get default AI configuration
   */
  private getDefaultAIConfig(): ValidationConfig['ai'] {
    return {
      enabled: true,
      models: [
        {
          provider: 'claude',
          model: 'claude-3-sonnet',
          temperature: 0.1,
          maxTokens: 2000,
        },
      ],
      prompts: {
        completenessCheck: `
Analyze the following specification for completeness:

1. Are all sections adequately detailed?
2. Are requirements clear and testable?
3. Are there any missing critical components?
4. What additional information would improve this specification?

Provide specific, actionable feedback with confidence scoring.
`,
        consistencyCheck: `
Analyze the following specification for internal consistency:

1. Do requirements align with architecture?
2. Are component dependencies properly defined?
3. Does the implementation plan match the requirements?
4. Are there any contradictions or conflicts?

Identify specific inconsistencies with suggested resolutions.
`,
        qualityAssessment: `
Assess the overall quality of this specification:

1. Clarity and precision of language
2. Completeness of coverage
3. Testability of requirements
4. Overall professional quality

Provide quality scoring and improvement suggestions.
`,
        riskAnalysis: `
Identify potential risks in this specification:

1. Implementation complexity risks
2. Dependency risks
3. Timeline feasibility
4. Technical feasibility concerns

Provide risk assessment with mitigation recommendations.
`,
      },
      confidence: {
        threshold: 0.8,
        requireHuman: false,
      },
    };
  }

  /**
   * Validate configuration structure
   */
  validateConfig(config: unknown): { valid: boolean; errors: string[] } {
    try {
      ValidationConfigSchema.parse(config);
      return { valid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`),
        };
      }
      return {
        valid: false,
        errors: [String(error)],
      };
    }
  }

  /**
   * Get enabled rules
   */
  getEnabledRules(): ValidationConfig['rules'] {
    const config = this.getConfig();
    return config.rules.filter(rule => rule.enabled);
  }

  /**
   * Get rule by ID
   */
  getRule(ruleId: string): ValidationConfig['rules'][0] | undefined {
    const config = this.getConfig();
    return config.rules.find(rule => rule.id === ruleId);
  }

  /**
   * Enable/disable rule
   */
  toggleRule(ruleId: string, enabled: boolean): boolean {
    const config = this.getConfig();
    const rule = config.rules.find(r => r.id === ruleId);
    
    if (rule) {
      rule.enabled = enabled;
      return true;
    }
    
    return false;
  }

  /**
   * Add custom rule
   */
  addRule(rule: ValidationConfig['rules'][0]): void {
    const config = this.getConfig();
    const existingIndex = config.rules.findIndex(r => r.id === rule.id);
    
    if (existingIndex >= 0) {
      config.rules[existingIndex] = rule;
    } else {
      config.rules.push(rule);
    }
  }

  /**
   * Remove rule
   */
  removeRule(ruleId: string): boolean {
    const config = this.getConfig();
    const index = config.rules.findIndex(r => r.id === ruleId);
    
    if (index >= 0) {
      config.rules.splice(index, 1);
      return true;
    }
    
    return false;
  }
}

/**
 * Export singleton instance
 */
export const validationConfig = new ValidationConfigManager();