/**
 * Command Types and Error Classes
 * 
 * Defines error types and command structures for the CLI system
 */

/**
 * Command error codes enumeration
 */
export const CommandError = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  TEMPLATE_ERROR: 'TEMPLATE_ERROR',
  PERMISSION_ERROR: 'PERMISSION_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  SYNTAX_ERROR: 'SYNTAX_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

/**
 * Custom error class for Unjucks commands
 */
export class UnjucksCommandError extends Error {
  constructor(message, code = CommandError.UNKNOWN_ERROR, suggestions = [], details = null) {
    super(message);
    this.name = 'UnjucksCommandError';
    this.code = code;
    this.suggestions = suggestions;
    this.details = details;
    this.timestamp = new Date().toISOString();
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, UnjucksCommandError);
    }
  }
}
