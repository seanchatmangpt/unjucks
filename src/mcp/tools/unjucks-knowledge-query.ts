/**
 * MCP Tool: unjucks_knowledge_query
 * Query enterprise knowledge graphs using SPARQL-like patterns and N3 reasoning
 */

import type { MCPTool, MCPRequest, MCPResponse } from '../types.js';
import { SemanticServer } from '../semantic-server.js';
import { createMCPError, MCPErrorCode } from '../utils.js';
import type { KnowledgeQuery } from '../semantic-server.js';

export interface KnowledgeQueryRequest {
  query: {
    sparql?: string;
    pattern?: {
      subject?: string;
      predicate?: string;
      object?: string;
    };
    reasoning?: boolean;
    limit?: number;
    offset?: number;
  };
  knowledgeBase?: string[];
  reasoning?: {
    enabled?: boolean;
    depth?: number;
    rules?: string[];
  };
  outputFormat?: 'json' | 'turtle' | 'csv' | 'table';
  includeMeta?: boolean;
}

/**
 * Enterprise knowledge graph query tool implementation
 */
export const unjucksKnowledgeQuery: MCPTool = {
  name: 'unjucks_knowledge_query',
  description: 'Query enterprise knowledge graphs for template generation context',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'object',
        properties: {
          sparql: {
            type: 'string',
            description: 'SPARQL query string (simplified syntax supported)'
          },
          pattern: {
            type: 'object',
            properties: {
              subject: { type: 'string' },
              predicate: { type: 'string' },
              object: { type: 'string' }
            },
            description: 'Triple pattern for basic queries'
          },
          reasoning: {
            type: 'boolean',
            description: 'Enable reasoning over query results',
            default: false
          },
          limit: {
            type: 'integer',
            description: 'Maximum number of results',
            minimum: 1,
            maximum: 1000,
            default: 100
          },
          offset: {
            type: 'integer',
            description: 'Number of results to skip',
            minimum: 0,
            default: 0
          }
        },
        anyOf: [
          { required: ['sparql'] },
          { required: ['pattern'] }
        ]
      },
      knowledgeBase: {
        type: 'array',
        items: { type: 'string' },
        description: 'Paths to TTL/N3 knowledge base files to query',
        default: []
      },
      reasoning: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', default: false },
          depth: { type: 'integer', minimum: 1, maximum: 5, default: 2 },
          rules: {
            type: 'array',
            items: { type: 'string' },
            description: 'N3 rule files for reasoning'
          }
        }
      },
      outputFormat: {
        type: 'string',
        enum: ['json', 'turtle', 'csv', 'table'],
        description: 'Output format for query results',
        default: 'json'
      },
      includeMeta: {
        type: 'boolean',
        description: 'Include query metadata in results',
        default: true
      }
    },
    required: ['query']
  },

  async execute(request: MCPRequest<KnowledgeQueryRequest>): Promise<MCPResponse> {
    try {
      const {
        query,
        knowledgeBase = [],
        reasoning = { enabled: false },
        outputFormat = 'json',
        includeMeta = true
      } = request.params;

      // Validate query parameters
      if (!query.sparql && !query.pattern) {
        return createMCPError(
          request.id,
          MCPErrorCode.InvalidParams,
          'Either sparql or pattern query must be provided'
        );
      }

      // Initialize semantic server and load knowledge base
      const semanticServer = new SemanticServer();

      // Load enterprise knowledge if provided
      if (knowledgeBase.length > 0) {
        // In a real implementation, you'd load the knowledge base files
        console.log(`Loading knowledge base files: ${knowledgeBase.join(', ')}`);
      }

      // Execute knowledge query
      const queryResult = await semanticServer.queryKnowledge(
        query as KnowledgeQuery,
        { useReasoning: reasoning.enabled }
      );

      // Format results based on requested output format
      let formattedResults: any;

      switch (outputFormat) {
        case 'table':
          formattedResults = formatAsTable(queryResult.results);
          break;

        case 'csv':
          formattedResults = formatAsCsv(queryResult.results);
          break;

        case 'turtle':
          formattedResults = await formatAsTurtle(queryResult.results);
          break;

        case 'json':
        default:
          formattedResults = queryResult.results;
          break;
      }

      // Build response
      const result: any = {
        success: true,
        results: formattedResults,
        resultCount: queryResult.results.length
      };

      if (includeMeta) {
        result.metadata = {
          ...queryResult.metadata,
          query: query.sparql || query.pattern,
          knowledgeBaseSize: knowledgeBase.length,
          reasoningEnabled: reasoning.enabled,
          outputFormat,
          executionTime: Date.now()
        };
      }

      // Add enterprise insights if available
      if (queryResult.results.length > 0) {
        result.insights = await generateKnowledgeInsights(queryResult.results, query);
      }

      return {
        jsonrpc: '2.0',
        id: request.id,
        result
      };

    } catch (error) {
      console.error('[MCP] Knowledge query error:', error);
      
      return createMCPError(
        request.id,
        MCPErrorCode.InternalError,
        `Knowledge query failed: ${error.message}`,
        { originalError: error.stack }
      );
    }
  }
};

/**
 * Format results as ASCII table
 */
function formatAsTable(results: Array<Record<string, any>>): string {
  if (results.length === 0) {
    return 'No results found.';
  }

  const headers = Object.keys(results[0]);
  const columnWidths = headers.map(header => 
    Math.max(header.length, ...results.map(row => String(row[header] || '').length))
  );

  const separator = '+' + columnWidths.map(w => '-'.repeat(w + 2)).join('+') + '+';
  const headerRow = '|' + headers.map((h, i) => ` ${h.padEnd(columnWidths[i])} `).join('|') + '|';

  const dataRows = results.map(row =>
    '|' + headers.map((h, i) => ` ${String(row[h] || '').padEnd(columnWidths[i])} `).join('|') + '|'
  );

  return [separator, headerRow, separator, ...dataRows, separator].join('\n');
}

/**
 * Format results as CSV
 */
function formatAsCsv(results: Array<Record<string, any>>): string {
  if (results.length === 0) {
    return '';
  }

  const headers = Object.keys(results[0]);
  const csvRows = [headers.join(',')];

  for (const row of results) {
    const csvRow = headers.map(header => {
      const value = row[header] || '';
      // Escape CSV values that contain commas or quotes
      if (String(value).includes(',') || String(value).includes('"')) {
        return `"${String(value).replace(/"/g, '""')}"`;
      }
      return String(value);
    }).join(',');
    csvRows.push(csvRow);
  }

  return csvRows.join('\n');
}

/**
 * Format results as Turtle/RDF
 */
async function formatAsTurtle(results: Array<Record<string, any>>): Promise<string> {
  const prefixes = `
@prefix result: <http://unjucks.dev/query/result/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

`;

  if (results.length === 0) {
    return prefixes + '# No results found\n';
  }

  const triples: string[] = [];

  results.forEach((result, index) => {
    const resultUri = `result:item_${index}`;
    triples.push(`${resultUri} a result:QueryResult ;`);

    Object.entries(result).forEach(([key, value]) => {
      const predicate = `result:${key}`;
      let objectValue: string;

      if (typeof value === 'string' && value.startsWith('http')) {
        objectValue = `<${value}>`;
      } else if (typeof value === 'number') {
        objectValue = `"${value}"^^xsd:decimal`;
      } else if (typeof value === 'boolean') {
        objectValue = `"${value}"^^xsd:boolean`;
      } else {
        objectValue = `"${String(value).replace(/"/g, '\\"')}"`;
      }

      triples.push(`  ${predicate} ${objectValue} ;`);
    });

    // Remove trailing semicolon and add period
    const lastIndex = triples.length - 1;
    triples[lastIndex] = triples[lastIndex].slice(0, -1) + ' .';
    triples.push('');
  });

  return prefixes + triples.join('\n');
}

/**
 * Generate insights about query results for template generation
 */
async function generateKnowledgeInsights(
  results: Array<Record<string, any>>,
  query: any
): Promise<{
  patterns: string[];
  recommendations: Array<{ type: string; message: string; }>;
  templateSuggestions: string[];
}> {
  const patterns: string[] = [];
  const recommendations: Array<{ type: string; message: string; }> = [];
  const templateSuggestions: string[] = [];

  // Analyze result patterns
  if (results.length > 0) {
    const firstResult = results[0];
    
    // Check for common enterprise patterns
    const hasApiData = Object.values(firstResult).some(value =>
      String(value).toLowerCase().includes('api') ||
      String(value).toLowerCase().includes('endpoint')
    );

    if (hasApiData) {
      patterns.push('API_RELATED');
      recommendations.push({
        type: 'api',
        message: 'Query results contain API-related information suitable for API template generation'
      });
      templateSuggestions.push('Generate API documentation templates');
      templateSuggestions.push('Create REST endpoint scaffolding');
    }

    // Check for database-related content
    const hasDbData = Object.values(firstResult).some(value =>
      String(value).toLowerCase().includes('table') ||
      String(value).toLowerCase().includes('database') ||
      String(value).toLowerCase().includes('schema')
    );

    if (hasDbData) {
      patterns.push('DATABASE_RELATED');
      recommendations.push({
        type: 'database',
        message: 'Results suggest database schema information for ORM/migration templates'
      });
      templateSuggestions.push('Generate database migration files');
      templateSuggestions.push('Create ORM model classes');
    }

    // Check for compliance-related information
    const hasComplianceData = Object.values(firstResult).some(value =>
      String(value).toLowerCase().includes('compliance') ||
      String(value).toLowerCase().includes('audit') ||
      String(value).toLowerCase().includes('gdpr') ||
      String(value).toLowerCase().includes('sox')
    );

    if (hasComplianceData) {
      patterns.push('COMPLIANCE_RELATED');
      recommendations.push({
        type: 'compliance',
        message: 'Compliance-related data found - consider governance templates'
      });
      templateSuggestions.push('Generate audit trail implementations');
      templateSuggestions.push('Create compliance documentation');
    }

    // Analyze result diversity
    if (results.length > 10) {
      recommendations.push({
        type: 'scalability',
        message: 'Large result set suggests need for pagination or filtering in templates'
      });
    }

    // Check for hierarchical data
    const hasHierarchy = results.some(result =>
      Object.keys(result).some(key => 
        key.includes('parent') || key.includes('child') || key.includes('hierarchy')
      )
    );

    if (hasHierarchy) {
      patterns.push('HIERARCHICAL');
      recommendations.push({
        type: 'structure',
        message: 'Hierarchical data detected - consider tree-view or recursive templates'
      });
      templateSuggestions.push('Generate recursive component templates');
    }
  }

  return {
    patterns,
    recommendations,
    templateSuggestions
  };
}

/**
 * Pre-defined knowledge graph queries for common enterprise scenarios
 */
export const PREDEFINED_QUERIES = {
  API_ENDPOINTS: {
    pattern: {
      predicate: 'http://unjucks.dev/api/hasEndpoint'
    },
    description: 'Find all API endpoints in the knowledge base'
  },

  COMPLIANCE_REQUIREMENTS: {
    pattern: {
      predicate: 'http://unjucks.dev/compliance/requires'
    },
    description: 'Find compliance requirements for templates'
  },

  SECURITY_POLICIES: {
    pattern: {
      predicate: 'http://unjucks.dev/security/hasPolicy'
    },
    description: 'Query security policies and requirements'
  },

  DATA_SCHEMAS: {
    pattern: {
      subject: 'http://unjucks.dev/data/schema'
    },
    description: 'Find data schema definitions'
  }
};