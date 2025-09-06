/**
 * MCP Tool: unjucks_compliance_check
 * Semantic compliance validation using enterprise ontologies and governance rules
 */

import type { MCPTool, MCPRequest, MCPResponse } from '../types.js';
import { SemanticServer } from '../semantic-server.js';
import { createMCPError, MCPErrorCode } from '../utils.js';

export interface ComplianceCheckRequest {
  templatePath: string;
  policies: string[];
  strictMode?: boolean;
  generateReport?: boolean;
  outputFormat?: 'json' | 'html' | 'markdown' | 'pdf';
  includeRecommendations?: boolean;
  customOntologies?: string[];
}

/**
 * Enterprise compliance validation tool implementation
 */
export const unjucksComplianceCheck: MCPTool = {
  name: 'unjucks_compliance_check',
  description: 'Validate template compliance with enterprise governance policies using semantic reasoning',
  inputSchema: {
    type: 'object',
    properties: {
      templatePath: {
        type: 'string',
        description: 'Path to template file for compliance checking'
      },
      policies: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['SOX', 'GDPR', 'HIPAA', 'API_GOVERNANCE', 'CODE_QUALITY', 'SECURITY']
        },
        description: 'Enterprise policies to validate against',
        minItems: 1
      },
      strictMode: {
        type: 'boolean',
        description: 'Enable strict compliance mode (fail on warnings)',
        default: false
      },
      generateReport: {
        type: 'boolean',
        description: 'Generate detailed compliance report',
        default: true
      },
      outputFormat: {
        type: 'string',
        enum: ['json', 'html', 'markdown', 'pdf'],
        description: 'Output format for compliance report',
        default: 'json'
      },
      includeRecommendations: {
        type: 'boolean',
        description: 'Include remediation recommendations',
        default: true
      },
      customOntologies: {
        type: 'array',
        items: { type: 'string' },
        description: 'Paths to custom compliance ontology files',
        default: []
      }
    },
    required: ['templatePath', 'policies']
  },

  async execute(request: MCPRequest<ComplianceCheckRequest>): Promise<MCPResponse> {
    try {
      const {
        templatePath,
        policies,
        strictMode = false,
        generateReport = true,
        outputFormat = 'json',
        includeRecommendations = true,
        customOntologies = []
      } = request.params;

      // Validate input parameters
      if (!templatePath) {
        return createMCPError(
          request.id,
          MCPErrorCode.InvalidParams,
          'templatePath is required'
        );
      }

      if (!policies || policies.length === 0) {
        return createMCPError(
          request.id,
          MCPErrorCode.InvalidParams,
          'At least one policy must be specified'
        );
      }

      // Initialize semantic server
      const semanticServer = new SemanticServer();

      // Load custom ontologies if provided
      if (customOntologies.length > 0) {
        console.log(`Loading custom ontologies: ${customOntologies.join(', ')}`);
        // In a real implementation, load the ontology files
      }

      // Perform compliance check
      const complianceResult = await semanticServer.checkCompliance(
        templatePath,
        policies,
        { strictMode }
      );

      // Generate detailed compliance report if requested
      let report: any = null;
      if (generateReport) {
        report = await generateComplianceReport(
          complianceResult,
          templatePath,
          policies,
          outputFormat,
          includeRecommendations
        );
      }

      // Build response
      const result: any = {
        success: true,
        compliance: {
          valid: complianceResult.valid,
          score: complianceResult.score,
          violations: complianceResult.violations,
          summary: generateComplianceSummary(complianceResult, policies)
        }
      };

      if (report) {
        result.report = report;
      }

      if (includeRecommendations) {
        result.recommendations = await generateRecommendations(
          complianceResult,
          templatePath,
          policies
        );
      }

      // Add metadata
      result.metadata = {
        templatePath,
        policies,
        strictMode,
        customOntologies,
        ...complianceResult.metadata,
        executionTime: Date.now()
      };

      return {
        jsonrpc: '2.0',
        id: request.id,
        result
      };

    } catch (error) {
      console.error('[MCP] Compliance check error:', error);
      
      return createMCPError(
        request.id,
        MCPErrorCode.InternalError,
        `Compliance check failed: ${error.message}`,
        { originalError: error.stack }
      );
    }
  }
};

/**
 * Generate compliance summary
 */
function generateComplianceSummary(
  complianceResult: any,
  policies: string[]
): {
  overallStatus: string;
  policyResults: Array<{ policy: string; status: string; issues: number; }>;
  criticalIssues: number;
  recommendations: number;
} {
  const violations = complianceResult.violations;
  const errors = violations.filter(v => v.severity === 'error').length;
  const warnings = violations.filter(v => v.severity === 'warning').length;

  // Determine overall status
  let overallStatus: string;
  if (errors > 0) {
    overallStatus = 'NON_COMPLIANT';
  } else if (warnings > 0) {
    overallStatus = 'COMPLIANT_WITH_WARNINGS';
  } else {
    overallStatus = 'FULLY_COMPLIANT';
  }

  // Analyze policy-specific results
  const policyResults = policies.map(policy => {
    const policyViolations = violations.filter(v => 
      v.rule.includes(policy) || v.message.toLowerCase().includes(policy.toLowerCase())
    );
    const policyErrors = policyViolations.filter(v => v.severity === 'error').length;
    
    let status: string;
    if (policyErrors > 0) {
      status = 'FAILED';
    } else if (policyViolations.length > 0) {
      status = 'PASSED_WITH_WARNINGS';
    } else {
      status = 'PASSED';
    }

    return {
      policy,
      status,
      issues: policyViolations.length
    };
  });

  return {
    overallStatus,
    policyResults,
    criticalIssues: errors,
    recommendations: violations.filter(v => v.suggestion).length
  };
}

/**
 * Generate detailed compliance report in various formats
 */
async function generateComplianceReport(
  complianceResult: any,
  templatePath: string,
  policies: string[],
  format: string,
  includeRecommendations: boolean
): Promise<any> {
  const summary = generateComplianceSummary(complianceResult, policies);
  
  switch (format) {
    case 'html':
      return generateHtmlReport(complianceResult, templatePath, policies, summary, includeRecommendations);
    
    case 'markdown':
      return generateMarkdownReport(complianceResult, templatePath, policies, summary, includeRecommendations);
    
    case 'pdf':
      // In a real implementation, you'd generate a PDF
      return { 
        format: 'pdf',
        message: 'PDF generation would be implemented here',
        htmlContent: await generateHtmlReport(complianceResult, templatePath, policies, summary, includeRecommendations)
      };
    
    case 'json':
    default:
      return {
        format: 'json',
        templatePath,
        policies,
        summary,
        violations: complianceResult.violations,
        score: complianceResult.score,
        timestamp: new Date().toISOString(),
        recommendations: includeRecommendations ? 
          await generateRecommendations(complianceResult, templatePath, policies) : null
      };
  }
}

/**
 * Generate HTML compliance report
 */
async function generateHtmlReport(
  complianceResult: any,
  templatePath: string,
  policies: string[],
  summary: any,
  includeRecommendations: boolean
): Promise<string> {
  const { violations } = complianceResult;
  const errors = violations.filter(v => v.severity === 'error');
  const warnings = violations.filter(v => v.severity === 'warning');
  
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Compliance Report - ${templatePath}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .status { font-size: 24px; font-weight: bold; margin: 10px 0; }
        .compliant { color: #28a745; }
        .warning { color: #ffc107; }
        .error { color: #dc3545; }
        .section { margin: 20px 0; }
        .violation { margin: 10px 0; padding: 10px; border-left: 4px solid; }
        .violation.error { border-color: #dc3545; background: #f8d7da; }
        .violation.warning { border-color: #ffc107; background: #fff3cd; }
        .score { font-size: 18px; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Enterprise Compliance Report</h1>
        <p><strong>Template:</strong> ${templatePath}</p>
        <p><strong>Policies:</strong> ${policies.join(', ')}</p>
        <p><strong>Generated:</strong> ${new Date().toISOString()}</p>
    </div>

    <div class="section">
        <h2>Compliance Summary</h2>
        <div class="status ${summary.overallStatus.toLowerCase().replace(/_/g, ' ')}">${summary.overallStatus.replace(/_/g, ' ')}</div>
        <div class="score">Compliance Score: ${complianceResult.score}/100</div>
        
        <table>
            <tr><th>Policy</th><th>Status</th><th>Issues</th></tr>
            ${summary.policyResults.map(p => 
              `<tr><td>${p.policy}</td><td class="${p.status.toLowerCase()}">${p.status}</td><td>${p.issues}</td></tr>`
            ).join('')}
        </table>
    </div>

    ${errors.length > 0 ? `
    <div class="section">
        <h2>Critical Issues (${errors.length})</h2>
        ${errors.map(v => `
        <div class="violation error">
            <strong>${v.rule}</strong><br>
            ${v.message}
            ${v.suggestion ? `<br><em>Suggestion: ${v.suggestion}</em>` : ''}
        </div>
        `).join('')}
    </div>
    ` : ''}

    ${warnings.length > 0 ? `
    <div class="section">
        <h2>Warnings (${warnings.length})</h2>
        ${warnings.map(v => `
        <div class="violation warning">
            <strong>${v.rule}</strong><br>
            ${v.message}
            ${v.suggestion ? `<br><em>Suggestion: ${v.suggestion}</em>` : ''}
        </div>
        `).join('')}
    </div>
    ` : ''}

    <div class="section">
        <h2>Validation Details</h2>
        <p>Total violations: ${violations.length}</p>
        <p>Critical issues: ${summary.criticalIssues}</p>
        <p>Recommendations available: ${summary.recommendations}</p>
    </div>
</body>
</html>
`;
}

/**
 * Generate Markdown compliance report
 */
async function generateMarkdownReport(
  complianceResult: any,
  templatePath: string,
  policies: string[],
  summary: any,
  includeRecommendations: boolean
): Promise<string> {
  const { violations } = complianceResult;
  const errors = violations.filter(v => v.severity === 'error');
  const warnings = violations.filter(v => v.severity === 'warning');

  return `# Enterprise Compliance Report

**Template:** ${templatePath}  
**Policies:** ${policies.join(', ')}  
**Generated:** ${new Date().toISOString()}

## Compliance Summary

**Status:** ${summary.overallStatus.replace(/_/g, ' ')}  
**Score:** ${complianceResult.score}/100

| Policy | Status | Issues |
|--------|--------|--------|
${summary.policyResults.map(p => `| ${p.policy} | ${p.status} | ${p.issues} |`).join('\n')}

${errors.length > 0 ? `
## Critical Issues (${errors.length})

${errors.map(v => `
### ${v.rule}

**Message:** ${v.message}
${v.suggestion ? `**Suggestion:** ${v.suggestion}` : ''}
${v.resource ? `**Resource:** ${v.resource}` : ''}

`).join('')}
` : ''}

${warnings.length > 0 ? `
## Warnings (${warnings.length})

${warnings.map(v => `
### ${v.rule}

**Message:** ${v.message}
${v.suggestion ? `**Suggestion:** ${v.suggestion}` : ''}

`).join('')}
` : ''}

## Validation Summary

- **Total violations:** ${violations.length}
- **Critical issues:** ${summary.criticalIssues}
- **Recommendations available:** ${summary.recommendations}

---
*Generated by Unjucks Semantic Compliance Engine*
`;
}

/**
 * Generate remediation recommendations
 */
async function generateRecommendations(
  complianceResult: any,
  templatePath: string,
  policies: string[]
): Promise<Array<{
  category: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  implementation: string[];
  resources?: string[];
}>> {
  const { violations } = complianceResult;
  const recommendations: Array<{
    category: string;
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    implementation: string[];
    resources?: string[];
  }> = [];

  // Generate recommendations based on violations
  const errorViolations = violations.filter(v => v.severity === 'error');
  const warningViolations = violations.filter(v => v.severity === 'warning');

  // API-related recommendations
  const apiViolations = violations.filter(v => v.rule.includes('API'));
  if (apiViolations.length > 0) {
    recommendations.push({
      category: 'API Governance',
      priority: 'high',
      title: 'Implement API Compliance Standards',
      description: 'Template generates API endpoints that require governance compliance',
      implementation: [
        'Add version parameter to all API endpoints',
        'Implement authentication middleware',
        'Add input validation schemas',
        'Include rate limiting configuration',
        'Generate API documentation automatically'
      ],
      resources: [
        'OpenAPI specification template',
        'Authentication middleware examples',
        'Rate limiting best practices'
      ]
    });
  }

  // GDPR-related recommendations
  const gdprViolations = violations.filter(v => v.rule.includes('GDPR'));
  if (gdprViolations.length > 0) {
    recommendations.push({
      category: 'Data Privacy',
      priority: 'high',
      title: 'Implement GDPR Data Protection',
      description: 'Template processes personal data requiring GDPR compliance',
      implementation: [
        'Add consent collection mechanisms',
        'Implement data deletion capabilities',
        'Add data portability features',
        'Include privacy notices in templates',
        'Add data retention policies'
      ],
      resources: [
        'GDPR compliance checklist',
        'Data processing agreement templates',
        'Privacy notice generators'
      ]
    });
  }

  // Security recommendations
  const securityViolations = violations.filter(v => 
    v.rule.includes('SECURITY') || v.rule.includes('AUTH')
  );
  if (securityViolations.length > 0) {
    recommendations.push({
      category: 'Security',
      priority: 'high',
      title: 'Enhance Security Implementation',
      description: 'Template requires additional security measures',
      implementation: [
        'Add input sanitization',
        'Implement proper authentication',
        'Add authorization checks',
        'Include security headers',
        'Add audit logging'
      ],
      resources: [
        'OWASP security guidelines',
        'Security testing frameworks',
        'Authentication best practices'
      ]
    });
  }

  // General quality recommendations
  if (warningViolations.length > 0) {
    recommendations.push({
      category: 'Code Quality',
      priority: 'medium',
      title: 'Address Code Quality Issues',
      description: 'Template has opportunities for quality improvements',
      implementation: [
        'Add comprehensive error handling',
        'Implement logging and monitoring',
        'Add performance optimizations',
        'Include automated testing',
        'Add documentation generation'
      ],
      resources: [
        'Code quality standards',
        'Testing frameworks',
        'Performance monitoring tools'
      ]
    });
  }

  return recommendations;
}