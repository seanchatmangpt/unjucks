/**
 * Unjucks Error Handling System
 * Comprehensive error classes and handlers with recovery mechanisms
 * Based on v3 architecture specification for robust user experience
 */

import chalk from 'chalk';
import prompts from 'prompts';
import { performance } from 'perf_hooks';

/**
 * Base error class for all Unjucks errors
 * Provides common functionality and error reporting
 */
export class UnjucksError extends Error {
  constructor(message, code = 'UNJUCKS_ERROR', details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    this.context = this.captureContext();
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  captureContext() {
    return {
      platform: process.platform,
      nodeVersion: process.version,
      workingDirectory: process.cwd(),
      argv: process.argv.slice(2),
    };
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp,
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * Command parsing errors (ERR1)
 * Invalid command syntax, unknown flags, malformed arguments
 */
export class CommandParseError extends UnjucksError {
  constructor(command, suggestions = [], details = {}) {
    super(`Invalid command: ${command}`, 'COMMAND_PARSE_ERROR', {
      command,
      suggestions,
      ...details,
    });
    this.command = command;
    this.suggestions = suggestions;
  }
}

/**
 * Template discovery errors (ERR2)
 * Template not found, ambiguous names, missing directories
 */
export class TemplateNotFoundError extends UnjucksError {
  constructor(templateName, searchPaths = [], availableTemplates = [], details = {}) {
    super(`Template '${templateName}' not found`, 'TEMPLATE_NOT_FOUND_ERROR', {
      templateName,
      searchPaths,
      availableTemplates,
      ...details,
    });
    this.templateName = templateName;
    this.searchPaths = searchPaths;
    this.availableTemplates = availableTemplates;
  }
}

/**
 * Template loading errors (ERR3)
 * Invalid frontmatter, corrupted files, encoding issues
 */
export class TemplateSyntaxError extends UnjucksError {
  constructor(filePath, line = 0, column = 0, syntaxDetails = '', details = {}) {
    super(`Syntax error in ${filePath}:${line}:${column}`, 'TEMPLATE_SYNTAX_ERROR', {
      filePath,
      line,
      column,
      syntaxDetails,
      ...details,
    });
    this.filePath = filePath;
    this.line = line;
    this.column = column;
    this.syntaxDetails = syntaxDetails;
  }
}

/**
 * Variable validation errors (ERR4)
 * Missing required variables, invalid types, failed validation
 */
export class MissingVariablesError extends UnjucksError {
  constructor(missingVars = [], templatePath = '', availableVars = [], details = {}) {
    super(`Missing required variables: ${missingVars.join(', ')}`, 'MISSING_VARIABLES_ERROR', {
      missingVars,
      templatePath,
      availableVars,
      ...details,
    });
    this.missingVars = missingVars;
    this.templatePath = templatePath;
    this.availableVars = availableVars;
  }
}

/**
 * Filter processing errors (ERR5)
 * Custom filter failures, invalid chains, runtime errors
 */
export class FilterError extends UnjucksError {
  constructor(filterName, input, cause, details = {}) {
    super(`Filter '${filterName}' failed`, 'FILTER_ERROR', {
      filterName,
      input,
      cause: cause?.message || cause,
      ...details,
    });
    this.filterName = filterName;
    this.input = input;
    this.cause = cause;
  }
}

/**
 * Template rendering errors (ERR6)
 * Nunjucks syntax errors, undefined variables, logic errors
 */
export class RenderError extends UnjucksError {
  constructor(templatePath, context = {}, cause, details = {}) {
    super(`Render failed for ${templatePath}`, 'RENDER_ERROR', {
      templatePath,
      context,
      cause: cause?.message || cause,
      ...details,
    });
    this.templatePath = templatePath;
    this.context = context;
    this.cause = cause;
  }
}

/**
 * Path security errors (ERR7)
 * Path traversal attempts, invalid paths, security violations
 */
export class PathSecurityError extends UnjucksError {
  constructor(attemptedPath, reason, details = {}) {
    super(`Security violation: ${reason}`, 'PATH_SECURITY_ERROR', {
      attemptedPath,
      reason,
      ...details,
    });
    this.attemptedPath = attemptedPath;
    this.reason = reason;
  }
}

/**
 * File conflict errors (ERR8)
 * File exists, merge conflicts, permission issues
 */
export class FileConflictError extends UnjucksError {
  constructor(filePath, conflictType = 'exists', details = {}) {
    super(`File conflict: ${filePath}`, 'FILE_CONFLICT_ERROR', {
      filePath,
      conflictType,
      ...details,
    });
    this.filePath = filePath;
    this.conflictType = conflictType;
  }
}

/**
 * Permission errors (ERR9)
 * Write denied, read-only filesystem, access control
 */
export class PermissionError extends UnjucksError {
  constructor(filePath, operation = 'write', systemError = null, details = {}) {
    super(`Permission denied: ${operation} ${filePath}`, 'PERMISSION_ERROR', {
      filePath,
      operation,
      systemError: systemError?.code || systemError,
      ...details,
    });
    this.filePath = filePath;
    this.operation = operation;
    this.systemError = systemError;
  }
}

/**
 * Error handler functions with recovery mechanisms
 */

/**
 * Handle command parsing errors with suggestions
 */
async function handleParseError(error) {
  console.error(chalk.red(`❌ ${error.message}`));
  
  if (error.suggestions && error.suggestions.length > 0) {
    console.log(chalk.yellow('\n💡 Did you mean:'));
    error.suggestions.forEach(s => console.log(chalk.gray(`  • ${s}`)));
  }
  
  console.log(chalk.cyan('\n📖 Run `unjucks help` for full documentation'));
  
  // Store error pattern for learning
  await storeErrorPattern('command_parse', {
    command: error.command,
    suggestions: error.suggestions,
    timestamp: error.timestamp,
  });
}

/**
 * Handle template not found errors with helpful suggestions
 */
async function handleTemplateNotFound(error) {
  console.error(chalk.red(`❌ ${error.message}`));
  
  if (error.searchPaths && error.searchPaths.length > 0) {
    console.log(chalk.yellow('\n🔍 Searched in:'));
    error.searchPaths.forEach(p => console.log(chalk.gray(`  • ${p}`)));
  }
  
  if (error.availableTemplates && error.availableTemplates.length > 0) {
    console.log(chalk.yellow('\n📋 Available templates:'));
    error.availableTemplates.slice(0, 10).forEach(t => console.log(chalk.gray(`  • ${t}`)));
    
    if (error.availableTemplates.length > 10) {
      console.log(chalk.gray(`  ... and ${error.availableTemplates.length - 10} more`));
    }
  } else {
    console.log(chalk.cyan('\n💡 Run `unjucks init` to create templates directory'));
  }

  // Suggest similar templates using fuzzy matching
  const similar = findSimilarTemplates(error.templateName, error.availableTemplates);
  if (similar.length > 0) {
    console.log(chalk.yellow('\n🎯 Similar templates:'));
    similar.forEach(t => console.log(chalk.gray(`  • ${t}`)));
  }
  
  await storeErrorPattern('template_not_found', {
    templateName: error.templateName,
    searchPaths: error.searchPaths,
    availableTemplates: error.availableTemplates,
    timestamp: error.timestamp,
  });
}

/**
 * Handle template syntax errors with detailed feedback
 */
async function handleSyntaxError(error) {
  console.error(chalk.red(`❌ ${error.message}`));
  
  if (error.syntaxDetails) {
    console.log(chalk.yellow(`   ${error.syntaxDetails}`));
  }
  
  console.log(chalk.yellow('\n🔧 Check template syntax:'));
  console.log(chalk.gray('  • YAML frontmatter delimiters (---)'));
  console.log(chalk.gray('  • Proper indentation'));
  console.log(chalk.gray('  • Valid YAML syntax'));
  console.log(chalk.gray('  • Nunjucks template syntax'));
  
  if (error.line && error.column) {
    console.log(chalk.cyan(`\n📍 Error location: line ${error.line}, column ${error.column}`));
  }
  
  await storeErrorPattern('template_syntax', {
    filePath: error.filePath,
    line: error.line,
    column: error.column,
    syntaxDetails: error.syntaxDetails,
    timestamp: error.timestamp,
  });
}

/**
 * Handle missing variables with interactive prompts
 */
async function handleMissingVariables(error, interactive = true) {
  console.error(chalk.red(`❌ ${error.message}`));
  console.log(chalk.gray(`   Template: ${error.templatePath}`));
  
  if (!interactive) {
    console.log(chalk.yellow('\n📝 Required variables:'));
    error.missingVars.forEach(varName => {
      console.log(chalk.gray(`  • ${varName}`));
    });
    return null;
  }
  
  console.log(chalk.yellow('\n📝 Please provide values:'));
  
  const answers = {};
  for (const varName of error.missingVars) {
    try {
      const response = await prompts({
        type: 'text',
        name: varName,
        message: `Enter ${varName}:`,
        validate: value => value && value.trim() ? true : 'This field is required',
      });
      
      if (response[varName] !== undefined) {
        answers[varName] = response[varName];
      } else {
        // User cancelled
        console.log(chalk.yellow('\n⚠️  Operation cancelled'));
        return null;
      }
    } catch (err) {
      console.log(chalk.yellow('\n⚠️  Interactive input failed'));
      return null;
    }
  }
  
  await storeErrorPattern('missing_variables', {
    missingVars: error.missingVars,
    templatePath: error.templatePath,
    providedAnswers: Object.keys(answers),
    timestamp: error.timestamp,
  });
  
  return answers;
}

/**
 * Handle filter processing errors
 */
async function handleFilterError(error) {
  console.error(chalk.red(`❌ ${error.message}`));
  console.log(chalk.yellow(`   Input: ${JSON.stringify(error.input)}`));
  
  if (error.cause) {
    console.log(chalk.yellow(`   Cause: ${error.cause.message || error.cause}`));
  }
  
  console.log(chalk.cyan('\n🔧 Check filter implementation and input data'));
  
  await storeErrorPattern('filter_error', {
    filterName: error.filterName,
    input: error.input,
    cause: error.cause?.message || error.cause,
    timestamp: error.timestamp,
  });
}

/**
 * Handle template rendering errors
 */
async function handleRenderError(error) {
  console.error(chalk.red(`❌ ${error.message}`));
  
  if (error.cause) {
    console.log(chalk.yellow(`   Cause: ${error.cause.message || error.cause}`));
  }
  
  console.log(chalk.yellow('\n🔍 Debug context:'));
  console.log(chalk.gray(JSON.stringify(error.context, null, 2)));
  console.log(chalk.cyan('\n💡 Check template syntax and variable references'));
  
  await storeErrorPattern('render_error', {
    templatePath: error.templatePath,
    context: error.context,
    cause: error.cause?.message || error.cause,
    timestamp: error.timestamp,
  });
}

/**
 * Handle path security errors
 */
async function handlePathSecurity(error) {
  console.error(chalk.red(`🚨 ${error.message}`));
  console.log(chalk.yellow(`   Attempted path: ${error.attemptedPath}`));
  
  console.log(chalk.yellow('\n🛡️  Security policies:'));
  console.log(chalk.gray('  • No path traversal (../) allowed'));
  console.log(chalk.gray('  • Output must be within project directory'));
  console.log(chalk.gray('  • System paths are forbidden'));
  console.log(chalk.gray('  • Absolute paths outside project are blocked'));
  
  await storeErrorPattern('path_security', {
    attemptedPath: error.attemptedPath,
    reason: error.reason,
    timestamp: error.timestamp,
  });
}

/**
 * Handle file conflict errors with recovery options
 */
async function handleFileConflict(error, interactive = true) {
  console.error(chalk.yellow(`⚠️  ${error.message}`));
  console.log(chalk.gray(`   Conflict type: ${error.conflictType}`));
  
  if (!interactive) {
    console.log(chalk.cyan('\n💡 Use --force to overwrite or --backup to create backup'));
    return 'abort';
  }
  
  try {
    const choice = await prompts({
      type: 'select',
      name: 'action',
      message: 'How would you like to proceed?',
      choices: [
        { title: 'Backup existing and overwrite', value: 'backup' },
        { title: 'Skip this file', value: 'skip' },
        { title: 'Abort operation', value: 'abort' },
        { title: 'Show diff', value: 'diff' },
      ],
    });
    
    await storeErrorPattern('file_conflict', {
      filePath: error.filePath,
      conflictType: error.conflictType,
      resolution: choice.action,
      timestamp: error.timestamp,
    });
    
    return choice.action || 'abort';
  } catch (err) {
    return 'abort';
  }
}

/**
 * Handle permission errors
 */
async function handlePermissionError(error) {
  console.error(chalk.red(`🔒 ${error.message}`));
  
  if (error.systemError) {
    console.log(chalk.yellow(`   System error: ${error.systemError.code || error.systemError}`));
  }
  
  console.log(chalk.yellow('\n🔧 Possible solutions:'));
  console.log(chalk.gray('  • Check file permissions'));
  console.log(chalk.gray('  • Run with appropriate privileges'));
  console.log(chalk.gray('  • Choose different output directory'));
  console.log(chalk.gray('  • Ensure parent directory exists'));
  
  await storeErrorPattern('permission_error', {
    filePath: error.filePath,
    operation: error.operation,
    systemError: error.systemError?.code || error.systemError,
    timestamp: error.timestamp,
  });
}

/**
 * Global error handler with unified reporting
 */
export class ErrorHandler {
  static async handle(error, options = {}) {
    const { interactive = true, exitOnError = true } = options;
    
    // Track error for performance monitoring
    const startTime = performance.now();
    
    try {
      if (error instanceof CommandParseError) {
        await handleParseError(error);
      } else if (error instanceof TemplateNotFoundError) {
        await handleTemplateNotFound(error);
      } else if (error instanceof TemplateSyntaxError) {
        await handleSyntaxError(error);
      } else if (error instanceof MissingVariablesError) {
        const result = await handleMissingVariables(error, interactive);
        if (result) {
          // Return the collected variables for retry
          return { recovered: true, data: result };
        }
      } else if (error instanceof FilterError) {
        await handleFilterError(error);
      } else if (error instanceof RenderError) {
        await handleRenderError(error);
      } else if (error instanceof PathSecurityError) {
        await handlePathSecurity(error);
      } else if (error instanceof FileConflictError) {
        const action = await handleFileConflict(error, interactive);
        if (action !== 'abort') {
          return { recovered: true, action };
        }
      } else if (error instanceof PermissionError) {
        await handlePermissionError(error);
      } else {
        // Unknown error - provide debugging information
        console.error(chalk.red('💥 Unexpected error:'), error.message);
        console.log(chalk.yellow('\n🐛 Please report this issue with:'));
        console.log(chalk.gray('  • Command that failed'));
        console.log(chalk.gray('  • Template being used'));
        console.log(chalk.gray('  • Full error stack trace'));
        console.log(chalk.yellow('\nStack trace:'));
        console.log(chalk.gray(error.stack));
        
        await storeErrorPattern('unknown_error', {
          message: error.message,
          stack: error.stack,
          name: error.name,
          timestamp: new Date().toISOString(),
        });
      }
      
      // Store global error metrics
      const duration = performance.now() - startTime;
      await storeErrorPattern('error_handling_metrics', {
        errorType: error.constructor.name,
        handlingDuration: duration,
        recovered: false,
        timestamp: new Date().toISOString(),
      });
      
    } catch (handlingError) {
      console.error(chalk.red('💥 Error in error handler:'), handlingError.message);
      console.log(chalk.gray('Original error:'), error.message);
    }
    
    if (exitOnError) {
      process.exit(1);
    }
    
    return { recovered: false };
  }
}

/**
 * Store error patterns for learning and improvement
 */
async function storeErrorPattern(type, data) {
  try {
    // This would integrate with the memory system
    const pattern = {
      type,
      data,
      frequency: 1,
      timestamp: new Date().toISOString(),
    };
    
    // For now, we'll use a simple in-memory store
    // In production, this would use the actual memory system
    if (!global.__unjucksErrorPatterns) {
      global.__unjucksErrorPatterns = new Map();
    }
    
    const key = `${type}:${JSON.stringify(data).slice(0, 100)}`;
    const existing = global.__unjucksErrorPatterns.get(key);
    
    if (existing) {
      existing.frequency++;
      existing.lastSeen = new Date().toISOString();
    } else {
      global.__unjucksErrorPatterns.set(key, pattern);
    }
    
    // Store in hive memory with the requested key
    if (typeof global.storeInMemory === 'function') {
      await global.storeInMemory('hive/errors/handling', {
        patterns: Array.from(global.__unjucksErrorPatterns.entries()).map(([key, value]) => ({
          key,
          ...value,
        })),
        lastUpdated: new Date().toISOString(),
      });
    }
    
  } catch (err) {
    // Silently fail to avoid error loops
    console.debug('Failed to store error pattern:', err.message);
  }
}

/**
 * Find similar templates using simple string similarity
 */
function findSimilarTemplates(target, available) {
  if (!available || available.length === 0) return [];
  
  return available
    .map(template => ({
      template,
      similarity: calculateSimilarity(target.toLowerCase(), template.toLowerCase()),
    }))
    .filter(item => item.similarity > 0.3)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5)
    .map(item => item.template);
}

/**
 * Calculate simple string similarity using Levenshtein distance
 */
function calculateSimilarity(a, b) {
  const matrix = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  const maxLength = Math.max(a.length, b.length);
  return maxLength === 0 ? 1 : (maxLength - matrix[b.length][a.length]) / maxLength;
}

/**
 * Export all error classes and utilities
 */
export {
  handleParseError,
  handleTemplateNotFound,
  handleSyntaxError,
  handleMissingVariables,
  handleFilterError,
  handleRenderError,
  handlePathSecurity,
  handleFileConflict,
  handlePermissionError,
  storeErrorPattern,
  findSimilarTemplates,
  calculateSimilarity,
};

/**
 * Default export for convenience
 */
export default {
  // Error classes
  UnjucksError,
  CommandParseError,
  TemplateNotFoundError,
  TemplateSyntaxError,
  MissingVariablesError,
  FilterError,
  RenderError,
  PathSecurityError,
  FileConflictError,
  PermissionError,
  
  // Error handler
  ErrorHandler,
  
  // Utilities
  storeErrorPattern,
  findSimilarTemplates,
  calculateSimilarity,
};