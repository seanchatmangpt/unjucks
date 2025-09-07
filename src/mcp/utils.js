/**
 * Utility functions for the Unjucks MCP server
 */

import { MCPErrorCode } from './types.js';
import path from 'node:path';
import fs from 'fs-extra';

/**
 * Create a standardized MCP error response
 * @param {string|number} id - Request ID
 * @param {number} code - Error code
 * @param {string} message - Error message
 * @param {any} [data] - Additional error data
 * @returns {import('./types.js').MCPResponse}
 */
export function createMCPError(id, code, message, data) {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
      ...(data && { data })
    }
  };
}

/**
 * Create a successful MCP response
 * @param {string|number} id - Request ID
 * @param {any} result - Response result
 * @returns {import('./types.js').MCPResponse}
 */
export function createMCPResponse(id, result) {
  return {
    jsonrpc: "2.0",
    id,
    result
  };
}

/**
 * Create a tool result with text content
 * @param {string} text - Text content
 * @param {Record<string, any>} [meta] - Optional metadata
 * @param {boolean} [isError=false] - Whether this is an error result
 * @returns {import('./types.js').ToolResult}
 */
export function createTextToolResult(text, meta = {}, isError = false) {
  return {
    content: [
      {
        type: "text",
        text
      }
    ],
    isError,
    _meta: meta
  };
}

/**
 * Create a tool result with formatted JSON content
 * @param {any} data - Data to format as JSON
 * @param {Record<string, any>} [meta] - Optional metadata
 * @param {boolean} [isError=false] - Whether this is an error result
 * @returns {import('./types.js').ToolResult}
 */
export function createJSONToolResult(data, meta = {}, isError = false) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2)
      }
    ],
    isError,
    _meta: meta
  };
}

/**
 * Validate required parameters
 * @param {Record<string, any>} params - Parameters to validate
 * @param {string[]} required - Required parameter names
 * @throws {Error} If required parameters are missing
 */
export function validateRequiredParams(params, required) {
  const missing = required.filter(key => 
    params[key] === undefined || 
    params[key] === null || 
    (typeof params[key] === 'string' && params[key].trim() === '')
  );
  
  if (missing.length > 0) {
    throw new Error(`Missing required parameters: ${missing.join(', ')}`);
  }
}

/**
 * Sanitize file path to prevent directory traversal
 * @param {string} inputPath - Input file path
 * @param {string} [basePath] - Base path to restrict to
 * @returns {string} Sanitized path
 */
export function sanitizeFilePath(inputPath, basePath) {
  if (!inputPath) {
    throw new Error('File path cannot be empty');
  }

  // Normalize path separators and resolve relative paths
  const normalized = path.normalize(inputPath.replace(/[/\\]+/g, path.sep));
  
  // Remove any leading path separators
  const cleaned = normalized.replace(/^[/\\]+/, '');
  
  // If basePath is provided, ensure the resolved path stays within it
  if (basePath) {
    const resolved = path.resolve(basePath, cleaned);
    const normalizedBase = path.resolve(basePath);
    
    if (!resolved.startsWith(normalizedBase + path.sep) && resolved !== normalizedBase) {
      throw new Error(`Path "${inputPath}" is outside the allowed base directory`);
    }
    
    return resolved;
  }
  
  return cleaned;
}

/**
 * Validate and sanitize destination directory
 * @param {string} dest - Destination path
 * @returns {string} Validated destination path
 */
export function validateDestination(dest) {
  if (!dest || typeof dest !== 'string') {
    throw new Error('Destination must be a non-empty string');
  }

  // Resolve to absolute path
  const absoluteDest = path.resolve(dest);
  
  // Ensure the path is safe (no suspicious patterns)
  if (absoluteDest.includes('..') || absoluteDest.match(/[<>:"|?*]/)) {
    throw new Error('Invalid characters in destination path');
  }
  
  return absoluteDest;
}

/**
 * Format file size in human-readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
export function formatFileSize(bytes) {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format duration in human-readable format
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 */
export function formatDuration(ms) {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

/**
 * Safely execute async operation with timeout
 * @param {Promise<T>} operation - Operation to execute
 * @param {number} [timeoutMs=30000] - Timeout in milliseconds
 * @param {string} [errorMessage] - Custom timeout error message
 * @returns {Promise<T>}
 * @template T
 */
export async function withTimeout(operation, timeoutMs = 30000, errorMessage) {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(errorMessage || `Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([operation, timeout]);
}

/**
 * Deep clone an object safely
 * @param {T} obj - Object to clone
 * @returns {T}
 * @template T
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj);
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  if (typeof obj === 'object') {
    const clonedObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
  return obj;
}

/**
 * Check if a directory exists and is accessible
 * @param {string} dirPath - Directory path to check
 * @returns {Promise<boolean>}
 */
export async function isAccessibleDirectory(dirPath) {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Ensure directory exists, creating it if necessary
 * @param {string} dirPath - Directory path
 * @returns {Promise<void>}
 */
export async function ensureDirectory(dirPath) {
  try {
    await fs.ensureDir(dirPath);
  } catch (error) {
    throw new Error(`Failed to create directory "${dirPath}": ${error}`);
  }
}

/**
 * Get relative path from base to target
 * @param {string} from - Base path
 * @param {string} to - Target path
 * @returns {string} Relative path
 */
export function getRelativePath(from, to) {
  try {
    return path.relative(from, to);
  } catch (error) {
    throw new Error(`Failed to calculate relative path: ${error}`);
  }
}

/**
 * Validate generator and template names
 * @param {string} name - Generator name
 */
export function validateGeneratorName(name) {
  if (!name || typeof name !== 'string') {
    throw new Error('Generator name must be a non-empty string');
  }
  
  // Only allow alphanumeric, hyphens, underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new Error('Generator name can only contain letters, numbers, hyphens, and underscores');
  }
}

/**
 * @param {string} name - Template name
 */
export function validateTemplateName(name) {
  if (!name || typeof name !== 'string') {
    throw new Error('Template name must be a non-empty string');
  }
  
  // Only allow alphanumeric, hyphens, underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new Error('Template name can only contain letters, numbers, hyphens, and underscores');
  }
}

/**
 * Create a summary of file operations
 * @param {Array<{action: string, size?: number}>} files - File operations
 * @returns {FileOperationSummary}
 */
export function createFileOperationSummary(files) {
  /** @type {FileOperationSummary} */
  const summary = {
    created: 0,
    updated: 0,
    skipped: 0,
    injected: 0,
    totalFiles: files.length,
    totalSize: 0
  };

  for (const file of files) {
    switch (file.action) {
      case 'created':
        summary.created++;
        break;
      case 'updated':
        summary.updated++;
        break;
      case 'skipped':
        summary.skipped++;
        break;
      case 'injected':
        summary.injected++;
        break;
    }
    
    if (file.size) {
      summary.totalSize += file.size;
    }
  }

  return summary;
}

/**
 * Log performance metrics
 * @param {PerformanceMetrics} metrics - Performance metrics
 */
export function logPerformance(metrics) {
  if (process.env.DEBUG_UNJUCKS || process.env.NODE_ENV === 'development') {
    console.log(`[PERF] ${metrics.operation}: ${formatDuration(metrics.duration)}, ` +
                `files: ${metrics.filesProcessed}` +
                (metrics.memoryUsed ? `, memory: ${formatFileSize(metrics.memoryUsed)}` : ''));
  }
}

/**
 * Error handling utilities
 * @param {unknown} error - The error to handle
 * @param {string} toolName - Name of the tool
 * @param {string} [context] - Additional context
 * @returns {import('./types.js').ToolResult}
 */
export function handleToolError(error, toolName, context) {
  let message = `Error in ${toolName}`;
  if (context) message += ` (${context})`;
  
  if (error instanceof Error) {
    message += `: ${error.message}`;
  } else if (typeof error === 'string') {
    message += `: ${error}`;
  } else {
    message += ': Unknown error occurred';
  }

  return createTextToolResult(message, {}, true);
}

/**
 * Validate JSON schema-like object
 * @param {any} obj - Object to validate
 * @param {Object} schema - Schema to validate against
 * @param {string} schema.type - Expected type
 * @param {Record<string, any>} schema.properties - Property definitions
 * @param {string[]} [schema.required] - Required properties
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateObjectSchema(obj, schema) {
  const errors = [];

  if (!obj || typeof obj !== 'object') {
    errors.push('Input must be an object');
    return { valid: false, errors };
  }

  // Check required fields
  if (schema.required) {
    for (const field of schema.required) {
      if (!(field in obj) || obj[field] === undefined || obj[field] === null) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }

  // Validate field types (basic validation)
  for (const [field, value] of Object.entries(obj)) {
    if (schema.properties[field]) {
      const expectedType = schema.properties[field].type;
      const actualType = typeof value;
      
      if (expectedType === 'object' && actualType !== 'object') {
        errors.push(`Field "${field}" must be an object, got ${actualType}`);
      } else if (expectedType !== 'object' && expectedType !== actualType) {
        errors.push(`Field "${field}" must be ${expectedType}, got ${actualType}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * @typedef {Object} FileOperationSummary
 * @property {number} created
 * @property {number} updated
 * @property {number} skipped
 * @property {number} injected
 * @property {number} totalFiles
 * @property {number} totalSize
 */

/**
 * @typedef {Object} PerformanceMetrics
 * @property {string} operation
 * @property {number} duration
 * @property {number} filesProcessed
 * @property {number} [memoryUsed]
 */

export { MCPErrorCode };