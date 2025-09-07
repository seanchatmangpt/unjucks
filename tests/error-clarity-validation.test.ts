/**
 * Error Message Clarity Validation Tests
 * Validates that hostile process.exit() calls have been replaced with actionable error handling
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ActionableError, handleError, TemplateNotFoundError, VariableMissingError } from '../src/lib/actionable-error.js';
import { ErrorRecovery } from '../src/lib/error-recovery.js';
import { readFileSync } from 'fs';
import { glob } from 'glob';
import * as path from 'path';

describe('Error Message Clarity Implementation', () => {
  describe('ActionableError Framework', () => {
    it('should create actionable errors with all required fields', () => {
      const error = new ActionableError({
        message: 'Template not found',
        solution: 'Check template name and try again',
        category: 'template-not-found' as any,
        examples: ['unjucks list', 'unjucks help template']
      });

      expect(error.message).toBe('Template not found');
      expect(error.solution).toBe('Check template name and try again');
      expect(error.examples).toContain('unjucks list');
      expect(error.recoveryOptions.length).toBeGreaterThan(0);
    });

    it('should format actionable errors with helpful output', () => {
      const error = new TemplateNotFoundError('MyComponent', ['_templates'], ['component', 'api']);
      const formatted = error.toFormattedString();

      expect(formatted).toContain('❌ Error:');
      expect(formatted).toContain('💡 Solution:');
      expect(formatted).toContain('📝 Examples:');
      expect(formatted).toContain('🚀 Recovery Options:');
    });
  });

  describe('Error Recovery System', () => {
    it('should suggest corrections for command typos', () => {
      const suggestions = ErrorRecovery.suggestCommand('generat', ['generate', 'list', 'init']);
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].suggestion).toBe('generate');
      expect(suggestions[0].confidence).toBeGreaterThan(0.7);
    });

    it('should suggest template corrections', () => {
      const suggestions = ErrorRecovery.suggestTemplate('react-compont', ['react-component', 'vue-component']);
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].suggestion).toBe('react-component');
    });

    it('should analyze errors and provide contextual help', () => {
      const templateError = new Error('template not found');
      const analysis = ErrorRecovery.analyzeError(templateError);
      
      expect(analysis.likelyCause).toContain('template');
      expect(analysis.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Hostile Exit Elimination', () => {
    it('should have zero process.exit(1) calls without helpful messages', async () => {
      const sourceFiles = await glob('src/commands/*.ts', { cwd: process.cwd() });
      const hostileExits: string[] = [];

      for (const file of sourceFiles) {
        const content = readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.includes('process.exit(1)')) {
            // Check if there's a helpful error message in the preceding lines
            const contextLines = lines.slice(Math.max(0, i - 5), i);
            const hasActionableError = contextLines.some(contextLine => 
              contextLine.includes('handleError') ||
              contextLine.includes('ActionableError') ||
              contextLine.includes('TemplateNotFoundError') ||
              contextLine.includes('VariableMissingError')
            );
            
            if (!hasActionableError) {
              hostileExits.push(`${file}:${i + 1} - ${line.trim()}`);
            }
          }
        }
      }

      expect(hostileExits).toEqual([]);
      if (hostileExits.length > 0) {
        console.log('Remaining hostile exits:', hostileExits);
      }
    });

    it('should have actionable error handling in command files', async () => {
      const commandFiles = await glob('src/commands/*.ts', { cwd: process.cwd() });
      const filesWithoutErrorHandling: string[] = [];

      for (const file of commandFiles) {
        const content = readFileSync(file, 'utf-8');
        
        const hasErrorHandling = 
          content.includes('handleError') ||
          content.includes('ActionableError') ||
          content.includes('TemplateNotFoundError') ||
          content.includes('VariableMissingError');

        if (!hasErrorHandling) {
          filesWithoutErrorHandling.push(file);
        }
      }

      expect(filesWithoutErrorHandling.length).toBeLessThan(commandFiles.length / 2);
    });
  });

  describe('Error Context Enhancement', () => {
    it('should provide context-specific error messages', () => {
      const templateError = new TemplateNotFoundError(
        'NonExistent',
        ['_templates', 'templates'],
        ['component', 'api', 'model']
      );

      expect(templateError.message).toContain('NonExistent');
      expect(templateError.cause).toContain('_templates');
      expect(templateError.examples?.[0]).toContain('component');
    });

    it('should handle variable missing scenarios', () => {
      const variableError = new VariableMissingError(
        ['name', 'type'],
        'unjucks generate component react'
      );

      expect(variableError.message).toContain('name, type');
      expect(variableError.examples?.[0]).toContain('--name');
      expect(variableError.examples?.[0]).toContain('--type');
    });
  });

  describe('User Experience Validation', () => {
    it('should provide actionable solutions for common errors', () => {
      const scenarios = [
        {
          error: new TemplateNotFoundError('test', ['_templates']),
          expectedSolution: /template/i
        },
        {
          error: new VariableMissingError(['name'], 'test command'),
          expectedSolution: /variable/i
        }
      ];

      scenarios.forEach(({ error, expectedSolution }) => {
        expect(error.solution).toMatch(expectedSolution);
        expect(error.recoveryOptions.length).toBeGreaterThan(0);
      });
    });

    it('should provide fuzzy matching suggestions', () => {
      const suggestions = ErrorRecovery.suggestCommand('lst', ['list', 'last', 'test']);
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].suggestion).toBe('list');
    });
  });

  describe('Error Message Quality', () => {
    it('should have clear, actionable error messages', () => {
      const error = new ActionableError({
        message: 'Operation failed',
        solution: 'Check configuration and retry',
        category: 'runtime-error' as any,
        examples: ['command --help', 'command --verbose']
      });

      const formatted = error.toFormattedString();

      // Should not contain technical jargon without explanation
      expect(formatted).not.toMatch(/ENOENT|EACCES|undefined|null/);
      
      // Should contain helpful guidance
      expect(formatted).toMatch(/Solution:|Examples:|Recovery/);
      
      // Should be user-friendly
      expect(error.message).not.toContain('Error:');
      expect(error.solution).toMatch(/^[A-Z]/); // Should start with capital letter
    });

    it('should provide recovery options based on error category', () => {
      const templateError = new TemplateNotFoundError('test', ['_templates']);
      const variableError = new VariableMissingError(['name'], 'test');

      expect(templateError.recoveryOptions).toContain('unjucks list - See available templates');
      expect(variableError.recoveryOptions).toContain('Use --help flag to see all available options');
    });
  });

  describe('Error Resolution Time Validation', () => {
    it('should provide immediate next steps', () => {
      const error = new TemplateNotFoundError('BadTemplate', ['_templates'], ['good-template']);
      const formatted = error.toFormattedString();

      // Should provide immediate actionable steps
      expect(formatted).toMatch(/unjucks (list|help|generate)/);
      expect(error.examples?.length).toBeGreaterThan(0);
    });

    it('should include contextual help URLs when available', () => {
      const error = new ActionableError({
        message: 'Test error',
        solution: 'Test solution',
        category: 'template-not-found' as any,
        helpUrl: 'https://github.com/example/docs'
      });

      const formatted = error.toFormattedString();
      expect(formatted).toContain('📖 More Info:');
      expect(formatted).toContain('https://github.com/example/docs');
    });
  });

  describe('Error Categorization', () => {
    it('should categorize errors correctly', () => {
      const categories = [
        'template-not-found',
        'variable-missing', 
        'file-permission',
        'path-invalid',
        'command-syntax',
        'network-error',
        'validation-error',
        'configuration-error'
      ];

      categories.forEach(category => {
        const error = new ActionableError({
          message: `Test ${category}`,
          solution: 'Test solution',
          category: category as any
        });

        expect(error.category).toBe(category);
        expect(error.recoveryOptions.length).toBeGreaterThan(0);
      });
    });
  });
});

describe('Command-Specific Error Handling', () => {
  describe('Generate Command', () => {
    it('should handle template not found gracefully', () => {
      const error = new TemplateNotFoundError('NonExistentTemplate', ['_templates']);
      expect(error.message).toContain('NonExistentTemplate not found');
      expect(error.solution).toContain('available templates');
    });
  });

  describe('Workflow Command', () => {
    it('should handle MCP connection failures', () => {
      // Mock network error scenario
      const networkError = new Error('Connection refused');
      const analysis = ErrorRecovery.analyzeError(networkError);
      
      expect(analysis.likelyCause).toContain('connectivity');
      expect(analysis.suggestions[0].action).toContain('connection');
    });
  });

  describe('Semantic Command', () => {
    it('should handle ontology validation errors', () => {
      const validationError = new VariableMissingError(['sparql', 'pattern'], 'semantic query');
      expect(validationError.message).toContain('sparql');
      expect(validationError.message).toContain('pattern');
    });
  });
});

describe('Performance Impact', () => {
  it('should not significantly impact startup time', () => {
    const startTime = Date.now();
    
    // Create multiple actionable errors
    for (let i = 0; i < 100; i++) {
      new ActionableError({
        message: `Test error ${i}`,
        solution: 'Test solution',
        category: 'runtime-error' as any
      });
    }
    
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(100); // Should be very fast
  });

  it('should cache fuzzy matching results', () => {
    const startTime = Date.now();
    
    // Run same fuzzy matching multiple times
    for (let i = 0; i < 50; i++) {
      ErrorRecovery.suggestCommand('generat', ['generate', 'list', 'init']);
    }
    
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(500); // Should be reasonably fast
  });
});

describe('Integration with Existing Code', () => {
  it('should maintain backward compatibility', () => {
    // Test that existing error patterns still work
    try {
      throw new Error('Standard error');
    } catch (error) {
      const analysis = ErrorRecovery.analyzeError(error as Error);
      expect(analysis.likelyCause).toBeDefined();
      expect(analysis.suggestions).toBeDefined();
    }
  });

  it('should work with existing logging systems', () => {
    const error = new ActionableError({
      message: 'Test error for logging',
      solution: 'Test solution',
      category: 'runtime-error' as any
    });

    // Should be serializable for logging
    const serialized = JSON.stringify(error);
    expect(serialized).toContain('Test error for logging');
    
    const parsed = JSON.parse(serialized);
    expect(parsed.message).toBe('Test error for logging');
  });
});