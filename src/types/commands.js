/**
 * Command types and error classes
 */

export const CommandError = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  DIRECTORY_NOT_EMPTY: 'DIRECTORY_NOT_EMPTY',
  TEMPLATE_ERROR: 'TEMPLATE_ERROR',
};

export class UnjucksCommandError extends Error {
  constructor(message, type, suggestions = []) {
    super(message);
    this.name = 'UnjucksCommandError';
    this.type = type;
    this.suggestions = suggestions;
  }
}