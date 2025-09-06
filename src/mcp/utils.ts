/**
 * Utility functions for the Unjucks MCP server
 */

import { MCPError, MCPErrorCode, MCPResponse, ToolResult } from './types.js';
import path from 'node:path';
import fs from 'fs-extra';

/**
 * Create a standardized MCP error response
 */
export function createMCPError(
  id: string | number,
  code: MCPErrorCode,
  message: string,
  data?: any
): MCPResponse {
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
 */
export function createMCPResponse(
  id: string | number,
  result: any
): MCPResponse {
  return {
    jsonrpc: "2.0",
    id,
    result
  };
}

/**
 * Create a tool result with text content
 */
export function createTextToolResult(text: string, isError = false): ToolResult {
  return {
    content: [
      {
        type: "text",
        text
      }
    ],
    isError
  };
}

/**
 * Create a tool result with formatted JSON content
 */
export function createJSONToolResult(data: any, isError = false): ToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2)
      }
    ],
    isError
  };
}

/**
 * Validate required parameters
 */
export function validateRequiredParams(
  params: Record<string, any>,
  required: string[]
): string[] {
  const missing = required.filter(key => 
    params[key] === undefined || 
    params[key] === null || 
    (typeof params[key] === 'string' && params[key].trim() === '')
  );
  return missing;
}

/**
 * Sanitize file path to prevent directory traversal
 */
export function sanitizeFilePath(inputPath: string, basePath?: string): string {
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
 */
export function validateDestination(dest: string): string {
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
 */
export function formatFileSize(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

/**
 * Safely execute async operation with timeout
 */
export async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number = 30000,
  errorMessage?: string
): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(errorMessage || `Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([operation, timeout]);
}

/**
 * Deep clone an object safely
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj) as T;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as T;
  if (typeof obj === 'object') {
    const clonedObj = {} as { [key: string]: any };
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj as T;
  }
  return obj;
}

/**
 * Check if a directory exists and is accessible
 */
export async function isAccessibleDirectory(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Ensure directory exists, creating it if necessary
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await fs.ensureDir(dirPath);
  } catch (error) {
    throw new Error(`Failed to create directory "${dirPath}": ${error}`);
  }
}

/**
 * Get relative path from base to target
 */
export function getRelativePath(from: string, to: string): string {
  try {
    return path.relative(from, to);
  } catch (error) {
    throw new Error(`Failed to calculate relative path: ${error}`);
  }
}

/**
 * Validate generator and template names
 */
export function validateGeneratorName(name: string): void {
  if (!name || typeof name !== 'string') {
    throw new Error('Generator name must be a non-empty string');
  }
  
  // Only allow alphanumeric, hyphens, underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new Error('Generator name can only contain letters, numbers, hyphens, and underscores');
  }
}

export function validateTemplateName(name: string): void {
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
 */
export interface FileOperationSummary {
  created: number;
  updated: number;
  skipped: number;
  injected: number;
  totalFiles: number;
  totalSize: number;
}

export function createFileOperationSummary(
  files: Array<{ action: string; size?: number }>
): FileOperationSummary {
  const summary: FileOperationSummary = {
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
 */
export interface PerformanceMetrics {
  operation: string;
  duration: number;
  filesProcessed: number;
  memoryUsed?: number;
}

export function logPerformance(metrics: PerformanceMetrics): void {
  if (process.env.DEBUG_UNJUCKS || process.env.NODE_ENV === 'development') {
    console.log(`[PERF] ${metrics.operation}: ${formatDuration(metrics.duration)}, ` +
                `files: ${metrics.filesProcessed}` +
                (metrics.memoryUsed ? `, memory: ${formatFileSize(metrics.memoryUsed)}` : ''));
  }
}

/**
 * Error handling utilities
 */
export function handleToolError(error: unknown, toolName: string, context?: string): ToolResult {
  let message = `Error in ${toolName}`;
  if (context) message += ` (${context})`;
  
  if (error instanceof Error) {
    message += `: ${error.message}`;
  } else if (typeof error === 'string') {
    message += `: ${error}`;
  } else {
    message += ': Unknown error occurred';
  }

  return createTextToolResult(message, true);
}

/**
 * Validate JSON schema-like object
 */
export function validateObjectSchema(
  obj: any,
  schema: { type: string; properties: Record<string, any>; required?: string[] }
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

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