/**
 * KGEN CLI Standardized JSON Output Contract
 * 
 * Ensures all CLI commands return consistent JSON structure for machine consumption
 * Implements SWARM ALPHA AGENT 5 standardization requirements
 */

import { randomUUID } from 'crypto';

/**
 * Standard JSON Contract for CLI Output
 */
export class StandardizedOutput {
  constructor() {
    this.operationId = randomUUID();
    this.startTime = performance.now();
  }

  /**
   * Create standardized success response
   */
  success(operation, result = {}, metadata = {}) {
    const duration = performance.now() - this.startTime;
    
    const response = {
      success: true,
      operation: operation,
      result: result,
      metadata: {
        timestamp: new Date().toISOString(),
        operationId: this.operationId,
        duration: Math.round(duration * 100) / 100, // Round to 2 decimal places
        ...metadata
      }
    };

    console.log(JSON.stringify(response, null, 2));
    return response;
  }

  /**
   * Create standardized error response
   */
  error(operation, errorCode, message, details = {}, metadata = {}) {
    const duration = performance.now() - this.startTime;
    
    const response = {
      success: false,
      operation: operation,
      error: {
        code: errorCode,
        message: message,
        details: details
      },
      metadata: {
        timestamp: new Date().toISOString(),
        operationId: this.operationId,
        duration: Math.round(duration * 100) / 100,
        ...metadata
      }
    };

    console.log(JSON.stringify(response, null, 2));
    return response;
  }

  /**
   * Create standardized partial success response (some operations succeeded, some failed)
   */
  partial(operation, successes = [], failures = [], metadata = {}) {
    const duration = performance.now() - this.startTime;
    
    const response = {
      success: failures.length === 0,
      operation: operation,
      result: {
        successes: successes,
        failures: failures,
        summary: {
          total: successes.length + failures.length,
          successful: successes.length,
          failed: failures.length,
          successRate: Math.round((successes.length / (successes.length + failures.length)) * 100)
        }
      },
      metadata: {
        timestamp: new Date().toISOString(),
        operationId: this.operationId,
        duration: Math.round(duration * 100) / 100,
        ...metadata
      }
    };

    console.log(JSON.stringify(response, null, 2));
    return response;
  }

  /**
   * Create standardized list response
   */
  list(operation, items = [], totalCount = null, metadata = {}) {
    const duration = performance.now() - this.startTime;
    
    const response = {
      success: true,
      operation: operation,
      result: {
        items: items,
        count: items.length,
        totalCount: totalCount || items.length
      },
      metadata: {
        timestamp: new Date().toISOString(),
        operationId: this.operationId,
        duration: Math.round(duration * 100) / 100,
        ...metadata
      }
    };

    console.log(JSON.stringify(response, null, 2));
    return response;
  }

  /**
   * Create standardized validation response
   */
  validation(operation, isValid, issues = [], details = {}, metadata = {}) {
    const duration = performance.now() - this.startTime;
    
    const response = {
      success: true,
      operation: operation,
      result: {
        valid: isValid,
        issues: issues,
        summary: {
          totalIssues: issues.length,
          errors: issues.filter(i => i.severity === 'error').length,
          warnings: issues.filter(i => i.severity === 'warning').length,
          infos: issues.filter(i => i.severity === 'info').length
        },
        details: details
      },
      metadata: {
        timestamp: new Date().toISOString(),
        operationId: this.operationId,
        duration: Math.round(duration * 100) / 100,
        ...metadata
      }
    };

    console.log(JSON.stringify(response, null, 2));
    return response;
  }

  /**
   * Create standardized health/status response
   */
  status(operation, status, details = {}, metrics = {}, metadata = {}) {
    const duration = performance.now() - this.startTime;
    
    const response = {
      success: true,
      operation: operation,
      result: {
        status: status, // 'healthy', 'degraded', 'unhealthy', 'unknown'
        details: details,
        metrics: metrics
      },
      metadata: {
        timestamp: new Date().toISOString(),
        operationId: this.operationId,
        duration: Math.round(duration * 100) / 100,
        ...metadata
      }
    };

    console.log(JSON.stringify(response, null, 2));
    return response;
  }
}

/**
 * Error codes for consistent error reporting
 */
export const ErrorCodes = {
  // File/Path Errors
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  PATH_NOT_FOUND: 'PATH_NOT_FOUND',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  
  // Configuration Errors
  CONFIG_INVALID: 'CONFIG_INVALID',
  CONFIG_NOT_FOUND: 'CONFIG_NOT_FOUND',
  CONFIG_PARSE_ERROR: 'CONFIG_PARSE_ERROR',
  
  // RDF/Graph Errors
  RDF_PARSE_ERROR: 'RDF_PARSE_ERROR',
  GRAPH_INVALID: 'GRAPH_INVALID',
  SPARQL_SYNTAX_ERROR: 'SPARQL_SYNTAX_ERROR',
  
  // Template Errors
  TEMPLATE_NOT_FOUND: 'TEMPLATE_NOT_FOUND',
  TEMPLATE_SYNTAX_ERROR: 'TEMPLATE_SYNTAX_ERROR',
  TEMPLATE_RENDER_ERROR: 'TEMPLATE_RENDER_ERROR',
  
  // Validation Errors
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  SCHEMA_VIOLATION: 'SCHEMA_VIOLATION',
  
  // System Errors
  INITIALIZATION_FAILED: 'INITIALIZATION_FAILED',
  DEPENDENCY_MISSING: 'DEPENDENCY_MISSING',
  RESOURCE_EXHAUSTED: 'RESOURCE_EXHAUSTED',
  
  // Generic
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  INVALID_ARGUMENT: 'INVALID_ARGUMENT',
  OPERATION_FAILED: 'OPERATION_FAILED'
};

/**
 * Issue severities for validation responses
 */
export const IssueSeverity = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

/**
 * Utility function to create standardized output instance
 */
export function createStandardOutput() {
  return new StandardizedOutput();
}

/**
 * Utility function to handle common error patterns
 */
export function handleStandardError(operation, error, output = null) {
  const standardOutput = output || createStandardOutput();
  
  // Map common error types to error codes
  let errorCode = ErrorCodes.INTERNAL_ERROR;
  const details = {};
  
  if (error.code === 'ENOENT') {
    errorCode = ErrorCodes.FILE_NOT_FOUND;
    details.path = error.path;
  } else if (error.code === 'EACCES') {
    errorCode = ErrorCodes.PERMISSION_DENIED;
    details.path = error.path;
  } else if (error.name === 'SyntaxError') {
    if (error.message.includes('RDF') || error.message.includes('Turtle')) {
      errorCode = ErrorCodes.RDF_PARSE_ERROR;
    } else if (error.message.includes('template')) {
      errorCode = ErrorCodes.TEMPLATE_SYNTAX_ERROR;
    } else {
      errorCode = ErrorCodes.CONFIG_PARSE_ERROR;
    }
  }
  
  details.originalError = error.message;
  details.stack = process.env.NODE_ENV === 'development' ? error.stack : undefined;
  
  return standardOutput.error(operation, errorCode, error.message, details);
}

/**
 * JSON Schema for validating standardized outputs
 */
export const StandardOutputSchema = {
  type: 'object',
  required: ['success', 'operation', 'metadata'],
  properties: {
    success: {
      type: 'boolean'
    },
    operation: {
      type: 'string',
      pattern: '^[a-z][a-z0-9]*:[a-z][a-z0-9]*$' // e.g., "graph:hash", "artifact:generate"
    },
    result: {
      type: 'object'
    },
    error: {
      type: 'object',
      required: ['code', 'message'],
      properties: {
        code: {
          type: 'string'
        },
        message: {
          type: 'string'
        },
        details: {
          type: 'object'
        }
      }
    },
    metadata: {
      type: 'object',
      required: ['timestamp', 'operationId', 'duration'],
      properties: {
        timestamp: {
          type: 'string',
          format: 'date-time'
        },
        operationId: {
          type: 'string',
          format: 'uuid'
        },
        duration: {
          type: 'number',
          minimum: 0
        }
      }
    }
  },
  oneOf: [
    {
      properties: {
        success: { const: true }
      },
      required: ['result'],
      not: {
        required: ['error']
      }
    },
    {
      properties: {
        success: { const: false }
      },
      required: ['error'],
      not: {
        required: ['result']
      }
    }
  ]
};

export default StandardizedOutput;