/**
 * MCP Tool: unjucks_semantic_validate
 * RDF-based template validation using N3 reasoning and enterprise compliance schemas
 */

import type { MCPTool, MCPRequest, MCPResponse } from '../types.js';
import { SemanticServer } from '../semantic-server.js';
import { createMCPError, MCPErrorCode } from '../utils.js';

export interface SemanticValidateRequest {
  templatePath: string;
  schemaPath?: string;
  compliance?: string[];
  strictMode?: boolean;
  customRules?: string[];
  outputFormat?: 'json' | 'turtle' | 'summary';
}

/**
 * Semantic validation tool implementation
 */
export const unjucksSemanticValidate: MCPTool = {
  name: 'unjucks_semantic_validate',
  description: 'Validate templates using RDF-based semantic schemas and N3 reasoning',
  inputSchema: {
    type: 'object',
    properties: {
      templatePath: {
        type: 'string',
        description: 'Path to template file for validation'
      },
      schemaPath: {
        type: 'string',
        description: 'Optional path to custom validation schema'
      },
      compliance: {
        type: 'array',
        items: { type: 'string' },
        description: 'Compliance frameworks to validate against (SOX, GDPR, HIPAA, API_GOVERNANCE)',
        default: ['API_GOVERNANCE']
      },
      strictMode: {
        type: 'boolean',
        description: 'Enable strict validation mode (fail on warnings)',
        default: false
      },
      customRules: {
        type: 'array',
        items: { type: 'string' },
        description: 'Additional N3 rule files to apply'
      },
      outputFormat: {
        type: 'string',
        enum: ['json', 'turtle', 'summary'],
        description: 'Output format for validation results',
        default: 'json'
      }
    },
    required: ['templatePath']
  },

  async execute(request: MCPRequest<SemanticValidateRequest>): Promise<MCPResponse> {
    try {
      const { templatePath, schemaPath, compliance, strictMode, customRules, outputFormat } = request.params;

      // Validate input parameters
      if (!templatePath) {
        return createMCPError(
          request.id,
          MCPErrorCode.InvalidParams,
          'templatePath is required'
        );
      }

      // Initialize semantic server
      const semanticServer = new SemanticServer();

      // Perform semantic validation
      const validationResult = await semanticServer.validateTemplate(
        templatePath,
        schemaPath,
        {
          strictMode: strictMode || false,
          compliance: compliance || ['API_GOVERNANCE'],
          customRules: customRules || []
        }
      );

      // Format output based on requested format
      let formattedResult: any;

      switch (outputFormat) {
        case 'summary':
          formattedResult = {
            valid: validationResult.valid,
            score: validationResult.score,
            errorCount: validationResult.violations.filter(v => v.severity === 'error').length,
            warningCount: validationResult.violations.filter(v => v.severity === 'warning').length,
            topViolations: validationResult.violations
              .filter(v => v.severity === 'error')
              .slice(0, 3)
              .map(v => ({ rule: v.rule, message: v.message }))
          };
          break;

        case 'turtle':
          // Convert violations to RDF/Turtle format
          formattedResult = await convertValidationToTurtle(validationResult, templatePath);
          break;

        case 'json':
        default:
          formattedResult = validationResult;
          break;
      }

      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          success: true,
          validation: formattedResult,
          metadata: {
            templatePath,
            compliance: compliance || ['API_GOVERNANCE'],
            strictMode: strictMode || false,
            executionTime: Date.now()
          }
        }
      };

    } catch (error) {
      console.error('[MCP] Semantic validation error:', error);
      
      return createMCPError(
        request.id,
        MCPErrorCode.InternalError,
        `Semantic validation failed: ${error.message}`,
        { originalError: error.stack }
      );
    }
  }
};

/**
 * Convert validation results to Turtle/RDF format
 */
async function convertValidationToTurtle(
  validation: any,
  templatePath: string
): Promise<string> {
  const turtle = `
@prefix validation: <http://unjucks.dev/validation/> .
@prefix template: <http://unjucks.dev/template/> .
@prefix compliance: <http://unjucks.dev/compliance/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<${templatePath.replace(/[^a-zA-Z0-9]/g, '_')}> 
  a template:Template ;
  validation:isValid "${validation.valid}"^^xsd:boolean ;
  validation:complianceScore "${validation.score}"^^xsd:decimal ;
  validation:hasValidationReport [
    validation:errorCount "${validation.violations.filter(v => v.severity === 'error').length}"^^xsd:integer ;
    validation:warningCount "${validation.violations.filter(v => v.severity === 'warning').length}"^^xsd:integer ;
    validation:infoCount "${validation.violations.filter(v => v.severity === 'info').length}"^^xsd:integer
  ] .

${validation.violations.map((violation, index) => `
<${templatePath.replace(/[^a-zA-Z0-9]/g, '_')}_violation_${index}>
  a validation:Violation ;
  validation:severity "${violation.severity}" ;
  validation:rule "${violation.rule}" ;
  validation:message "${violation.message.replace(/"/g, '\\"')}" ;
  validation:appliesTo <${templatePath.replace(/[^a-zA-Z0-9]/g, '_')}> .
`).join('\n')}
`;

  return turtle.trim();
}