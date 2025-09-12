/**
 * JSON Schema Validation for Standardized CLI Output
 * 
 * Validates all CLI command outputs conform to the standard JSON contract
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { StandardOutputSchema } from './standardized-output.js';

/**
 * Output validator for CLI responses
 */
export class OutputValidator {
  constructor() {
    this.ajv = new Ajv({ allErrors: true, verbose: true });
    addFormats(this.ajv);
    
    // Compile the schema
    this.validate = this.ajv.compile(StandardOutputSchema);
  }

  /**
   * Validate a CLI output against the standard schema
   */
  validateOutput(output) {
    const isValid = this.validate(output);
    
    return {
      valid: isValid,
      errors: this.validate.errors || [],
      schema: 'StandardOutputSchema'
    };
  }

  /**
   * Format validation errors for human consumption
   */
  formatValidationErrors(validationResult) {
    if (validationResult.valid) {
      return 'Output conforms to standard JSON contract ✅';
    }

    const errors = validationResult.errors.map(error => {
      const path = error.instancePath || 'root';
      return `${path}: ${error.message}`;
    });

    return `Schema validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`;
  }

  /**
   * Validate and throw if invalid (for testing)
   */
  validateOrThrow(output) {
    const result = this.validateOutput(output);
    if (!result.valid) {
      throw new Error(this.formatValidationErrors(result));
    }
    return result;
  }
}

/**
 * Global validator instance
 */
export const outputValidator = new OutputValidator();

/**
 * Validate CLI output helper function
 */
export function validateCliOutput(output) {
  return outputValidator.validateOutput(output);
}

/**
 * Test function to validate common output patterns
 */
export async function testOutputValidation() {
  const { createStandardOutput, ErrorCodes } = await import('./standardized-output.js');
  
  const tests = [
    {
      name: 'Success Response',
      fn: () => {
        const output = createStandardOutput();
        return output.success('test:operation', { data: 'test' });
      }
    },
    {
      name: 'Error Response',
      fn: () => {
        const output = createStandardOutput();
        return output.error('test:operation', ErrorCodes.FILE_NOT_FOUND, 'Test error', { test: true });
      }
    },
    {
      name: 'List Response',
      fn: () => {
        const output = createStandardOutput();
        return output.list('test:list', [{ id: 1 }, { id: 2 }]);
      }
    },
    {
      name: 'Validation Response',
      fn: () => {
        const output = createStandardOutput();
        return output.validation('test:validate', false, [
          { severity: 'error', message: 'Test error' }
        ]);
      }
    },
    {
      name: 'Status Response',
      fn: () => {
        const output = createStandardOutput();
        return output.status('test:status', 'healthy', { test: true });
      }
    },
    {
      name: 'Invalid Response (missing operation)',
      fn: () => ({
        success: true,
        result: { data: 'test' },
        metadata: { timestamp: new Date().toISOString() }
      }),
      shouldFail: true
    }
  ];

  const results = [];
  
  for (const test of tests) {
    try {
      const response = test.fn();
      const validation = outputValidator.validateOutput(response);
      
      results.push({
        name: test.name,
        passed: test.shouldFail ? !validation.valid : validation.valid,
        validation: validation,
        response: test.shouldFail ? undefined : response
      });
    } catch (error) {
      results.push({
        name: test.name,
        passed: false,
        error: error.message
      });
    }
  }

  return results;
}

export default OutputValidator;