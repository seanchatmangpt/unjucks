/**
 * MCP Tool: unjucks_reasoning_apply
 * Apply N3 rule-based reasoning to enhance template context and generate intelligent code
 */

import type { MCPTool, MCPRequest, MCPResponse } from '../types.js';
import { SemanticServer } from '../semantic-server.js';
import { createMCPError, MCPErrorCode } from '../utils.js';
import type { ReasoningConfig } from '../semantic-server.js';

export interface ReasoningApplyRequest {
  templateVars: Record<string, any>;
  rules: string[];
  premises: string[];
  depth?: number;
  mode?: 'forward' | 'backward' | 'hybrid';
  outputInferences?: boolean;
  enhanceContext?: boolean;
}

/**
 * N3 reasoning application tool implementation
 */
export const unjucksReasoningApply: MCPTool = {
  name: 'unjucks_reasoning_apply',
  description: 'Apply N3 rule-based reasoning to template variables for intelligent code generation',
  inputSchema: {
    type: 'object',
    properties: {
      templateVars: {
        type: 'object',
        description: 'Template variables to be enhanced through reasoning',
        additionalProperties: true
      },
      rules: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of N3 rule file paths or inline N3 rules',
        minItems: 1
      },
      premises: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of TTL/N3 premise file paths for knowledge base',
        default: []
      },
      depth: {
        type: 'integer',
        description: 'Maximum reasoning depth (number of inference cycles)',
        minimum: 1,
        maximum: 10,
        default: 3
      },
      mode: {
        type: 'string',
        enum: ['forward', 'backward', 'hybrid'],
        description: 'Reasoning mode',
        default: 'forward'
      },
      outputInferences: {
        type: 'boolean',
        description: 'Include derived inferences in output',
        default: true
      },
      enhanceContext: {
        type: 'boolean',
        description: 'Enhance template context with inferred facts',
        default: true
      }
    },
    required: ['templateVars', 'rules']
  },

  async execute(request: MCPRequest<ReasoningApplyRequest>): Promise<MCPResponse> {
    try {
      const {
        templateVars,
        rules,
        premises = [],
        depth = 3,
        mode = 'forward',
        outputInferences = true,
        enhanceContext = true
      } = request.params;

      // Validate input parameters
      if (!templateVars || typeof templateVars !== 'object') {
        return createMCPError(
          request.id,
          MCPErrorCode.InvalidParams,
          'templateVars must be a valid object'
        );
      }

      if (!rules || !Array.isArray(rules) || rules.length === 0) {
        return createMCPError(
          request.id,
          MCPErrorCode.InvalidParams,
          'rules array is required and must not be empty'
        );
      }

      // Initialize semantic server
      const semanticServer = new SemanticServer();

      // Configure reasoning
      const reasoningConfig: ReasoningConfig = {
        rules,
        premises,
        depth,
        mode
      };

      // Apply reasoning to template variables
      const reasoningResult = await semanticServer.applyReasoning(
        reasoningConfig,
        templateVars
      );

      // Build response based on options
      const result: any = {
        success: true,
        enhancedContext: enhanceContext ? reasoningResult.templateContext : templateVars
      };

      if (outputInferences) {
        result.inferences = reasoningResult.derivedFacts.map(quad => ({
          subject: quad.subject.value,
          predicate: quad.predicate.value,
          object: quad.object.value,
          type: quad.object.termType
        }));
      }

      // Add reasoning metadata
      result.metadata = {
        ...reasoningResult.metadata,
        reasoningConfig: {
          depth,
          mode,
          rulesCount: rules.length,
          premisesCount: premises.length
        },
        executionTime: Date.now()
      };

      // Generate reasoning insights for template authors
      result.insights = await generateReasoningInsights(
        templateVars,
        reasoningResult.templateContext,
        reasoningResult.derivedFacts
      );

      return {
        jsonrpc: '2.0',
        id: request.id,
        result
      };

    } catch (error) {
      console.error('[MCP] Reasoning application error:', error);
      
      return createMCPError(
        request.id,
        MCPErrorCode.InternalError,
        `Reasoning application failed: ${error.message}`,
        { originalError: error.stack }
      );
    }
  }
};

/**
 * Generate insights about the reasoning process for template authors
 */
async function generateReasoningInsights(
  originalVars: Record<string, any>,
  enhancedVars: Record<string, any>,
  derivedFacts: any[]
): Promise<{
  newVariables: string[];
  modifiedVariables: string[];
  recommendations: Array<{
    type: string;
    message: string;
    variable?: string;
  }>;
}> {
  const newVariables: string[] = [];
  const modifiedVariables: string[] = [];
  const recommendations: Array<{ type: string; message: string; variable?: string; }> = [];

  // Identify new and modified variables
  for (const [key, value] of Object.entries(enhancedVars)) {
    if (!(key in originalVars)) {
      newVariables.push(key);
    } else if (JSON.stringify(originalVars[key]) !== JSON.stringify(value)) {
      modifiedVariables.push(key);
    }
  }

  // Generate recommendations based on reasoning results
  if (newVariables.length > 0) {
    recommendations.push({
      type: 'enhancement',
      message: `Reasoning inferred ${newVariables.length} new template variables that can enhance code generation`
    });
  }

  if (modifiedVariables.length > 0) {
    recommendations.push({
      type: 'optimization',
      message: `${modifiedVariables.length} existing variables were enhanced with additional context`
    });
  }

  // Check for specific patterns in derived facts
  const hasSecurityInferences = derivedFacts.some(fact => 
    fact.predicate.includes('security') || fact.predicate.includes('auth')
  );
  
  if (hasSecurityInferences) {
    recommendations.push({
      type: 'security',
      message: 'Reasoning identified security-related requirements for this template'
    });
  }

  const hasComplianceInferences = derivedFacts.some(fact =>
    fact.predicate.includes('compliance') || fact.predicate.includes('audit')
  );

  if (hasComplianceInferences) {
    recommendations.push({
      type: 'compliance',
      message: 'Template may need compliance-specific code generation features'
    });
  }

  // Check for API-related inferences
  const hasApiInferences = derivedFacts.some(fact =>
    fact.predicate.includes('api') || fact.predicate.includes('endpoint')
  );

  if (hasApiInferences) {
    recommendations.push({
      type: 'api',
      message: 'Consider adding API documentation generation to this template'
    });
  }

  return {
    newVariables,
    modifiedVariables,
    recommendations
  };
}

/**
 * Default N3 rules for common template patterns
 */
export const DEFAULT_REASONING_RULES = {
  API_PATTERNS: `
@prefix template: <http://unjucks.dev/template/> .
@prefix api: <http://unjucks.dev/api/> .
@prefix security: <http://unjucks.dev/security/> .

# Infer API security requirements
{ ?ctx template:hasApiEndpoints true }
=> 
{ ?ctx api:requiresAuthentication true ;
        api:requiresValidation true ;
        security:requiresRateLimiting true } .

# Infer documentation needs
{ ?ctx template:hasPublicApi true }
=>
{ ?ctx api:requiresDocumentation true ;
        api:requiresVersioning true } .
`,

  DATABASE_PATTERNS: `
@prefix template: <http://unjucks.dev/template/> .
@prefix db: <http://unjucks.dev/database/> .
@prefix migration: <http://unjucks.dev/migration/> .

# Infer database migration needs
{ ?ctx template:createsTables true }
=>
{ ?ctx db:requiresMigration true ;
        migration:requiresRollback true } .

# Infer indexing requirements
{ ?ctx template:hasQueries true }
=>
{ ?ctx db:requiresIndexes true ;
        db:requiresQueryOptimization true } .
`,

  TESTING_PATTERNS: `
@prefix template: <http://unjucks.dev/template/> .
@prefix test: <http://unjucks.dev/test/> .

# Infer testing requirements
{ ?ctx template:hasBusinessLogic true }
=>
{ ?ctx test:requiresUnitTests true ;
        test:requiresIntegrationTests true } .

# Infer security testing
{ ?ctx template:hasUserInput true }
=>
{ ?ctx test:requiresSecurityTests true ;
        test:requiresInputValidation true } .
`
};