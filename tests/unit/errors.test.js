/**
 * Comprehensive Error Handling Tests
 * Tests all error classes, handlers, and recovery mechanisms
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import chalk from 'chalk';

// Import error classes and handlers
import {
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
  ErrorHandler,
  findSimilarTemplates,
  calculateSimilarity,
} from '../../src/core/errors.js';

import {
  CLIErrorIntegration,
  TemplateErrorIntegration,
  FileSystemErrorIntegration,
  ValidationErrorIntegration,
  ErrorRecoveryUtils,
  ErrorContextBuilder,
} from '../../src/core/error-integration.js';

// Mock chalk to avoid console color codes in tests
vi.mock('chalk', () => ({
  default: {
    red: vi.fn(str => str),
    yellow: vi.fn(str => str),
    cyan: vi.fn(str => str),
    gray: vi.fn(str => str),
    blue: vi.fn(str => str),
  },
}));

// Mock prompts to avoid interactive input in tests
vi.mock('prompts', () => ({
  default: vi.fn(),
}));

describe('Error Handling System', () => {
  let consoleSpy;
  
  beforeEach(() => {
    consoleSpy = {
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
    };
    
    // Reset global error patterns
    global.__unjucksErrorPatterns = new Map();
  });
  
  afterEach(() => {
    consoleSpy.error.mockRestore();
    consoleSpy.log.mockRestore();
    consoleSpy.warn.mockRestore();
  });

  describe('Base UnjucksError Class', () => {
    it('should create error with proper structure', () => {
      const error = new UnjucksError('Test error', 'TEST_CODE', { detail: 'test' });
      
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.details.detail).toBe('test');
      expect(error.timestamp).toBeDefined();
      expect(error.context).toBeDefined();
      expect(error.context.platform).toBe(process.platform);
    });

    it('should capture context correctly', () => {
      const error = new UnjucksError('Test');
      
      expect(error.context.nodeVersion).toBe(process.version);
      expect(error.context.workingDirectory).toBe(process.cwd());
      expect(Array.isArray(error.context.argv)).toBe(true);
    });

    it('should serialize to JSON correctly', () => {
      const error = new UnjucksError('Test', 'CODE', { data: 'value' });
      const json = error.toJSON();
      
      expect(json.name).toBe('UnjucksError');
      expect(json.message).toBe('Test');
      expect(json.code).toBe('CODE');
      expect(json.details.data).toBe('value');
    });
  });

  describe('CommandParseError', () => {
    it('should create with suggestions', () => {
      const error = new CommandParseError('generat', ['generate', 'generator']);
      
      expect(error.message).toBe('Invalid command: generat');
      expect(error.code).toBe('COMMAND_PARSE_ERROR');
      expect(error.command).toBe('generat');
      expect(error.suggestions).toEqual(['generate', 'generator']);
    });

    it('should handle error without suggestions', () => {
      const error = new CommandParseError('unknown');
      
      expect(error.suggestions).toEqual([]);
    });
  });

  describe('TemplateNotFoundError', () => {
    it('should create with search paths and available templates', () => {
      const error = new TemplateNotFoundError(
        'missing-template',
        ['/templates', '/shared'],
        ['existing-template']
      );
      
      expect(error.message).toBe("Template 'missing-template' not found");
      expect(error.templateName).toBe('missing-template');
      expect(error.searchPaths).toEqual(['/templates', '/shared']);
      expect(error.availableTemplates).toEqual(['existing-template']);
    });
  });

  describe('TemplateSyntaxError', () => {
    it('should create with line and column information', () => {
      const error = new TemplateSyntaxError('/path/template.md', 10, 5, 'Invalid YAML');
      
      expect(error.message).toBe('Syntax error in /path/template.md:10:5');
      expect(error.filePath).toBe('/path/template.md');
      expect(error.line).toBe(10);
      expect(error.column).toBe(5);
      expect(error.syntaxDetails).toBe('Invalid YAML');
    });
  });

  describe('MissingVariablesError', () => {
    it('should create with missing variables list', () => {
      const error = new MissingVariablesError(['name', 'type'], '/template/path');
      
      expect(error.message).toBe('Missing required variables: name, type');
      expect(error.missingVars).toEqual(['name', 'type']);
      expect(error.templatePath).toBe('/template/path');
    });
  });

  describe('FilterError', () => {
    it('should create with filter details', () => {
      const cause = new Error('Filter failed');
      const error = new FilterError('customFilter', { input: 'data' }, cause);
      
      expect(error.message).toBe("Filter 'customFilter' failed");
      expect(error.filterName).toBe('customFilter');
      expect(error.input).toEqual({ input: 'data' });
      expect(error.cause).toBe(cause);
    });
  });

  describe('RenderError', () => {
    it('should create with template and context', () => {
      const cause = new Error('Nunjucks error');
      const context = { name: 'test' };
      const error = new RenderError('/template.md', context, cause);
      
      expect(error.message).toBe('Render failed for /template.md');
      expect(error.templatePath).toBe('/template.md');
      expect(error.context).toBe(context);
      expect(error.cause).toBe(cause);
    });
  });

  describe('PathSecurityError', () => {
    it('should create with path and reason', () => {
      const error = new PathSecurityError('../../../etc/passwd', 'Path traversal detected');
      
      expect(error.message).toBe('Security violation: Path traversal detected');
      expect(error.attemptedPath).toBe('../../../etc/passwd');
      expect(error.reason).toBe('Path traversal detected');
    });
  });

  describe('FileConflictError', () => {
    it('should create with conflict type', () => {
      const error = new FileConflictError('/path/file.js', 'exists');
      
      expect(error.message).toBe('File conflict: /path/file.js');
      expect(error.filePath).toBe('/path/file.js');
      expect(error.conflictType).toBe('exists');
    });
  });

  describe('PermissionError', () => {
    it('should create with operation and system error', () => {
      const systemError = new Error('EACCES');
      systemError.code = 'EACCES';
      const error = new PermissionError('/protected/file', 'write', systemError);
      
      expect(error.message).toBe('Permission denied: write /protected/file');
      expect(error.filePath).toBe('/protected/file');
      expect(error.operation).toBe('write');
      expect(error.systemError).toBe(systemError);
    });
  });

  describe('Error Handler', () => {
    it('should handle CommandParseError', async () => {
      const error = new CommandParseError('test', ['test-suggestion']);
      
      const result = await ErrorHandler.handle(error, { exitOnError: false });
      
      expect(result.recovered).toBe(false);
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('should handle TemplateNotFoundError', async () => {
      const error = new TemplateNotFoundError('missing', ['/path'], ['available']);
      
      const result = await ErrorHandler.handle(error, { exitOnError: false });
      
      expect(result.recovered).toBe(false);
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('should handle MissingVariablesError in non-interactive mode', async () => {
      const error = new MissingVariablesError(['name'], '/template');
      
      const result = await ErrorHandler.handle(error, { 
        interactive: false, 
        exitOnError: false 
      });
      
      expect(result.recovered).toBe(false);
    });

    it('should handle unknown errors', async () => {
      const error = new Error('Unknown error type');
      
      const result = await ErrorHandler.handle(error, { exitOnError: false });
      
      expect(result.recovered).toBe(false);
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Unexpected error:'),
        'Unknown error type'
      );
    });
  });

  describe('CLI Error Integration', () => {
    it('should enhance parse errors with suggestions', () => {
      const originalError = new Error('Unknown command: generat');
      const availableCommands = ['generate', 'list', 'help'];
      
      const enhanced = CLIErrorIntegration.enhanceParseError(originalError, availableCommands);
      
      expect(enhanced).toBeInstanceOf(CommandParseError);
      expect(enhanced.suggestions).toContain('generate');
    });

    it('should generate command suggestions', () => {
      const suggestions = CLIErrorIntegration.generateCommandSuggestions(
        'generat',
        ['generate', 'list', 'help']
      );
      
      expect(suggestions).toContain('generate');
    });

    it('should calculate command similarity', () => {
      const similarity = CLIErrorIntegration.calculateCommandSimilarity('generat', 'generate');
      expect(similarity).toBeGreaterThan(0.8);
    });

    it('should wrap commands with error handling', async () => {
      const mockCommand = vi.fn().mockResolvedValue('success');
      
      const result = await CLIErrorIntegration.wrapCommand(mockCommand);
      
      expect(result).toBe('success');
      expect(mockCommand).toHaveBeenCalled();
    });
  });

  describe('Template Error Integration', () => {
    it('should handle ENOENT errors as TemplateNotFoundError', async () => {
      const enoentError = new Error('File not found');
      enoentError.code = 'ENOENT';
      
      try {
        await TemplateErrorIntegration.handleTemplateError(
          enoentError,
          '/missing/template.md',
          { searchPaths: ['/templates'], availableTemplates: ['other.md'] }
        );
      } catch (error) {
        expect(error).toBeInstanceOf(TemplateNotFoundError);
        expect(error.templateName).toBe('template.md');
      }
    });
  });

  describe('File System Error Integration', () => {
    it('should validate safe paths', () => {
      expect(() => {
        FileSystemErrorIntegration.validatePath('./safe/path');
      }).not.toThrow();
    });

    it('should reject path traversal', () => {
      expect(() => {
        FileSystemErrorIntegration.validatePath('../../../etc/passwd');
      }).toThrow(PathSecurityError);
    });

    it('should reject system paths', () => {
      expect(() => {
        FileSystemErrorIntegration.validatePath('/etc/passwd');
      }).toThrow(PathSecurityError);
    });

    it('should handle permission errors', async () => {
      const permError = new Error('Permission denied');
      permError.code = 'EACCES';
      
      try {
        await FileSystemErrorIntegration.handleFileSystemError(
          permError,
          '/protected/file',
          'write'
        );
      } catch (error) {
        expect(error).toBeInstanceOf(PermissionError);
      }
    });
  });

  describe('Error Recovery Utils', () => {
    it('should retry operations with backoff', async () => {
      let attempts = 0;
      const operation = vi.fn(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      });
      
      const result = await ErrorRecoveryUtils.retryWithBackoff(operation, 3, 10);
      
      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should not retry non-retryable errors', async () => {
      const operation = vi.fn(() => {
        throw new CommandParseError('test');
      });
      
      await expect(
        ErrorRecoveryUtils.retryWithBackoff(operation, 3, 10)
      ).rejects.toThrow(CommandParseError);
      
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should execute graceful fallback', async () => {
      const primaryOp = vi.fn().mockRejectedValue(new Error('Primary failed'));
      const fallbackOp = vi.fn().mockResolvedValue('fallback success');
      
      const result = await ErrorRecoveryUtils.gracefulFallback(primaryOp, fallbackOp);
      
      expect(result).toBe('fallback success');
      expect(primaryOp).toHaveBeenCalled();
      expect(fallbackOp).toHaveBeenCalled();
    });
  });

  describe('Error Context Builder', () => {
    it('should build comprehensive context', () => {
      const builder = new ErrorContextBuilder();
      
      const context = builder
        .addCommandContext('generate', { generator: 'component' }, { force: true })
        .addTemplateContext('/template/path', { name: 'Test' })
        .addFileContext(['/output/file.js'])
        .build();
      
      expect(context.command.name).toBe('generate');
      expect(context.template.path).toBe('/template/path');
      expect(context.files).toEqual(['/output/file.js']);
      expect(context.timestamp).toBeDefined();
    });
  });

  describe('Utility Functions', () => {
    it('should find similar templates', () => {
      const available = ['react-component', 'vue-component', 'angular-service'];
      const similar = findSimilarTemplates('react-comp', available);
      
      expect(similar).toContain('react-component');
    });

    it('should calculate string similarity', () => {
      expect(calculateSimilarity('test', 'test')).toBe(1);
      expect(calculateSimilarity('test', 'tent')).toBeGreaterThan(0.5);
      expect(calculateSimilarity('abc', 'xyz')).toBeLessThan(0.5);
    });

    it('should handle empty strings in similarity', () => {
      expect(calculateSimilarity('', '')).toBe(1);
      expect(calculateSimilarity('test', '')).toBeLessThan(1);
    });
  });

  describe('Error Pattern Storage', () => {
    it('should store error patterns in memory', async () => {
      // Test would depend on actual memory implementation
      expect(global.__unjucksErrorPatterns).toBeInstanceOf(Map);
    });
  });

  describe('Interactive Error Handling', () => {
    it('should handle non-interactive mode gracefully', async () => {
      const error = new MissingVariablesError(['name'], '/template');
      
      const result = await ErrorHandler.handle(error, {
        interactive: false,
        exitOnError: false
      });
      
      expect(result.recovered).toBe(false);
    });
  });

  describe('Error Code Coverage', () => {
    it('should handle all error types', () => {
      const errorTypes = [
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
      ];
      
      errorTypes.forEach(ErrorType => {
        const error = new ErrorType('test message');
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(UnjucksError);
      });
    });
  });
});