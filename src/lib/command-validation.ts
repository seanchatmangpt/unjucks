/**
 * Validation utilities for Unjucks CLI commands
 * Provides comprehensive input validation with user-friendly error messages
 */

import fs from 'fs-extra';
import path from 'node:path';
import chalk from 'chalk';
import type { 
  ValidationResult, 
  CommandError, 
  UnjucksCommandError,
  ProjectType,
  OutputFormat,
  SortOption,
  SortDirection,
  InjectionMode
} from '../types/commands.js';

/**
 * Validates a file or directory path
 */
export function validatePath(filePath: string, options?: { 
  mustExist?: boolean; 
  mustBeFile?: boolean; 
  mustBeDirectory?: boolean;
  allowCreate?: boolean;
}): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!filePath) {
    errors.push('Path cannot be empty');
    return { valid: false, errors, warnings };
  }

  // Normalize and resolve path
  const normalizedPath = path.resolve(filePath);
  
  // Check for path traversal attempts
  if (filePath.includes('..') || filePath.includes('\\..') || filePath.includes('/..')) {
    errors.push('Path traversal detected - relative paths with ".." are not allowed');
  }

  // Check if path exists when required
  if (options?.mustExist) {
    if (!fs.pathExistsSync(normalizedPath)) {
      errors.push(`Path does not exist: ${filePath}`);
      return { valid: false, errors, warnings };
    }

    // Check file vs directory requirements
    const stats = fs.statSync(normalizedPath);
    if (options.mustBeFile && !stats.isFile()) {
      errors.push(`Expected a file, but path is a directory: ${filePath}`);
    }
    if (options.mustBeDirectory && !stats.isDirectory()) {
      errors.push(`Expected a directory, but path is a file: ${filePath}`);
    }
  }

  // Check if parent directory exists for new files
  if (options?.allowCreate && !fs.pathExistsSync(normalizedPath)) {
    const parentDir = path.dirname(normalizedPath);
    if (!fs.pathExistsSync(parentDir)) {
      errors.push(`Parent directory does not exist: ${parentDir}`);
    }
  }

  // Security checks
  if (process.platform === 'win32') {
    // Windows device names
    const deviceNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    const filename = path.basename(normalizedPath).toUpperCase().split('.')[0];
    if (deviceNames.includes(filename)) {
      errors.push(`Invalid filename - cannot use Windows device name: ${filename}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    sanitized: normalizedPath
  };
}

/**
 * Validates generator name
 */
export function validateGeneratorName(name?: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!name) {
    return { valid: true, errors, warnings }; // Optional parameter
  }

  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
    errors.push('Generator name must start with a letter and contain only letters, numbers, hyphens, and underscores');
  }

  if (name.length > 50) {
    errors.push('Generator name cannot exceed 50 characters');
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validates template name
 */
export function validateTemplateName(name?: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!name) {
    return { valid: true, errors, warnings }; // Optional parameter
  }

  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
    errors.push('Template name must start with a letter and contain only letters, numbers, hyphens, and underscores');
  }

  if (name.length > 50) {
    errors.push('Template name cannot exceed 50 characters');
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validates project type
 */
export function validateProjectType(type?: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const validTypes: ProjectType[] = [
    'node-library', 'node-cli', 'express-api', 'fastify-api', 'react-app',
    'vue-app', 'svelte-app', 'next-app', 'nuxt-app', 'astro-app',
    'typescript-lib', 'vite-app', 'electron-app', 'nestjs-api', 'hono-api',
    'tauri-app', 'custom'
  ];

  if (!type) {
    return { valid: true, errors, warnings }; // Optional parameter
  }

  if (!validTypes.includes(type as ProjectType)) {
    errors.push(`Invalid project type: ${type}. Valid types are: ${validTypes.join(', ')}`);
  }

  return { valid: errors.length === 0, errors, warnings, sanitized: type };
}

/**
 * Validates output format
 */
export function validateOutputFormat(format: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const validFormats: OutputFormat[] = ['table', 'json', 'yaml', 'simple'];

  if (!validFormats.includes(format as OutputFormat)) {
    errors.push(`Invalid output format: ${format}. Valid formats are: ${validFormats.join(', ')}`);
  }

  return { valid: errors.length === 0, errors, warnings, sanitized: format };
}

/**
 * Validates sort options
 */
export function validateSortOption(sort: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const validSorts: SortOption[] = ['name', 'modified', 'created', 'usage'];

  if (!validSorts.includes(sort as SortOption)) {
    errors.push(`Invalid sort option: ${sort}. Valid options are: ${validSorts.join(', ')}`);
  }

  return { valid: errors.length === 0, errors, warnings, sanitized: sort };
}

/**
 * Validates sort direction
 */
export function validateSortDirection(direction: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const validDirections: SortDirection[] = ['asc', 'desc'];

  if (!validDirections.includes(direction as SortDirection)) {
    errors.push(`Invalid sort direction: ${direction}. Valid directions are: ${validDirections.join(', ')}`);
  }

  return { valid: errors.length === 0, errors, warnings, sanitized: direction };
}

/**
 * Validates injection mode
 */
export function validateInjectionMode(mode: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const validModes: InjectionMode[] = ['inject', 'append', 'prepend', 'before', 'after', 'replace'];

  if (!validModes.includes(mode as InjectionMode)) {
    errors.push(`Invalid injection mode: ${mode}. Valid modes are: ${validModes.join(', ')}`);
  }

  return { valid: errors.length === 0, errors, warnings, sanitized: mode };
}

/**
 * Validates line number for line-based injection
 */
export function validateLineNumber(line?: number): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (line === undefined || line === null) {
    return { valid: true, errors, warnings }; // Optional parameter
  }

  if (!Number.isInteger(line) || line < 1) {
    errors.push('Line number must be a positive integer starting from 1');
  }

  if (line > 100000) {
    warnings.push('Line number is very large (>100,000) - this may not be practical');
  }

  return { valid: errors.length === 0, errors, warnings, sanitized: line };
}

/**
 * Validates template variables object
 */
export function validateTemplateVariables(vars?: Record<string, any>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!vars) {
    return { valid: true, errors, warnings }; // Optional parameter
  }

  if (typeof vars !== 'object' || Array.isArray(vars)) {
    errors.push('Template variables must be an object');
    return { valid: false, errors, warnings };
  }

  // Check for valid variable names
  for (const key of Object.keys(vars)) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
      errors.push(`Invalid variable name: ${key}. Variable names must start with a letter or underscore and contain only letters, numbers, and underscores`);
    }
  }

  return { valid: errors.length === 0, errors, warnings, sanitized: vars };
}

/**
 * Validates that required arguments are provided
 */
export function validateRequiredArgs(args: Record<string, any>, required: string[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const field of required) {
    if (!args[field]) {
      errors.push(`Required argument missing: ${field}`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Displays validation errors and warnings in a user-friendly format
 */
export function displayValidationResults(results: ValidationResult[], command: string): boolean {
  let hasErrors = false;

  for (const result of results) {
    if (result.errors.length > 0) {
      hasErrors = true;
      console.error(chalk.red(`❌ Validation failed for ${command} command:`));
      for (const error of result.errors) {
        console.error(chalk.red(`  • ${error}`));
      }
    }

    if (result.warnings.length > 0) {
      console.warn(chalk.yellow(`⚠️  Warnings for ${command} command:`));
      for (const warning of result.warnings) {
        console.warn(chalk.yellow(`  • ${warning}`));
      }
    }
  }

  return !hasErrors;
}

/**
 * Creates an UnjucksCommandError with suggestions
 */
export function createCommandError(
  message: string, 
  code: CommandError, 
  suggestions: string[] = [],
  details?: any
): UnjucksCommandError {
  return new UnjucksCommandError(message, code, details, suggestions);
}

/**
 * Common validation helpers
 */
export const validators = {
  path: validatePath,
  generator: validateGeneratorName,
  template: validateTemplateName,
  projectType: validateProjectType,
  outputFormat: validateOutputFormat,
  sortOption: validateSortOption,
  sortDirection: validateSortDirection,
  injectionMode: validateInjectionMode,
  lineNumber: validateLineNumber,
  variables: validateTemplateVariables,
  required: validateRequiredArgs
} as const;

/**
 * Quick validation helper for common patterns
 */
export function quickValidate(
  value: any,
  type: keyof typeof validators,
  options?: any
): ValidationResult {
  const validator = validators[type];
  if (typeof validator === 'function') {
    return validator(value, options);
  }
  
  return {
    valid: false,
    errors: [`Unknown validation type: ${type}`],
    warnings: []
  };
}