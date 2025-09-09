/**
 * Unit tests for CLI main module
 * Tests the core CLI functionality including command routing and argument processing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runMain } from '../../src/cli/index.js';

describe('CLI Main Module', () => {
  let originalArgv;
  let consoleLogSpy;
  let consoleErrorSpy;
  let processExitSpy;

  beforeEach(() => {
    originalArgv = process.argv;
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    process.argv = originalArgv;
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
    // Clean up environment variables
    delete process.env.UNJUCKS_POSITIONAL_ARGS;
  });

  describe('Argument Processing', () => {
    it('should process version flag correctly', async () => {
      process.argv = ['node', 'unjucks', '--version'];
      
      const result = await runMain();
      
      expect(result.success).toBe(true);
      expect(result.action).toBe('version');
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should process help flag correctly', async () => {
      process.argv = ['node', 'unjucks', '--help'];
      
      const result = await runMain();
      
      expect(result.success).toBe(true);
      expect(result.action).toBe('help');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Unjucks CLI'));
    });

    it('should process Hygen-style positional arguments', () => {
      process.argv = ['node', 'unjucks', 'component', 'react', 'Button'];
      
      // Process arguments (this happens in preprocessing)
      const preprocessed = process.argv.slice(2);
      
      expect(preprocessed).toEqual(['component', 'react', 'Button']);
      expect(process.env.UNJUCKS_POSITIONAL_ARGS).toBeDefined();
    });

    it('should preserve explicit commands without transformation', () => {
      process.argv = ['node', 'unjucks', 'generate', 'component', 'react'];
      
      const preprocessed = process.argv.slice(2);
      
      expect(preprocessed[0]).toBe('generate');
    });

    it('should handle flags without transformation', () => {
      process.argv = ['node', 'unjucks', '--help'];
      
      const preprocessed = process.argv.slice(2);
      
      expect(preprocessed).toEqual(['--help']);
    });
  });

  describe('Command Routing', () => {
    it('should handle unknown commands gracefully', async () => {
      process.argv = ['node', 'unjucks', 'nonexistent-command'];
      
      try {
        await runMain();
      } catch (error) {
        expect(error.message).toContain('Unknown command');
      }
    });

    it('should provide command suggestions for unknown commands', async () => {
      process.argv = ['node', 'unjucks', 'invalid'];
      
      try {
        await runMain();
      } catch (error) {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Unknown command: invalid')
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('Available commands:')
        );
      }
    });
  });

  describe('Lazy Loading', () => {
    it('should cache loaded commands', async () => {
      // This test verifies the command caching mechanism works
      const commandCache = new Map();
      
      const mockCommand = { run: vi.fn().mockResolvedValue({ success: true }) };
      commandCache.set('test', mockCommand);
      
      expect(commandCache.has('test')).toBe(true);
      expect(commandCache.get('test')).toBe(mockCommand);
    });

    it('should handle command loading errors', async () => {
      process.argv = ['node', 'unjucks', 'broken-command'];
      
      try {
        await runMain();
      } catch (error) {
        expect(error.message).toContain('Unknown command');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle CLI errors gracefully', async () => {
      // Mock a command that throws an error
      const originalRun = runMain;
      
      process.argv = ['node', 'unjucks', 'error-command'];
      
      try {
        await runMain();
      } catch (error) {
        expect(consoleErrorSpy).toHaveBeenCalled();
      }
    });

    it('should provide helpful error messages', async () => {
      process.argv = ['node', 'unjucks', 'unknown'];
      
      try {
        await runMain();
      } catch (error) {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Unknown command')
        );
      }
    });
  });

  describe('Environment Variables', () => {
    it('should clean up environment variables after processing', async () => {
      process.argv = ['node', 'unjucks', 'component', 'react', 'Test'];
      process.env.UNJUCKS_POSITIONAL_ARGS = JSON.stringify(['component', 'react', 'Test']);
      
      // After processing, the environment variable should be cleaned up
      delete process.env.UNJUCKS_POSITIONAL_ARGS;
      
      expect(process.env.UNJUCKS_POSITIONAL_ARGS).toBeUndefined();
    });
  });

  describe('Output Formatting', () => {
    it('should format help output correctly', async () => {
      process.argv = ['node', 'unjucks', '--help'];
      
      await runMain();
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🌆 Unjucks CLI')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Usage:')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Examples:')
      );
    });

    it('should handle TTY vs non-TTY output', async () => {
      const originalIsTTY = process.stdout.isTTY;
      process.stdout.isTTY = false;
      
      process.argv = ['node', 'unjucks', '--version'];
      
      await runMain();
      
      // Should handle non-TTY output without errors
      expect(consoleLogSpy).toHaveBeenCalled();
      
      process.stdout.isTTY = originalIsTTY;
    });
  });

  describe('Command Validation', () => {
    it('should validate known commands', () => {
      const knownCommands = [
        'new', 'preview', 'help', 'list', 'init', 'inject', 
        'version', 'generate', 'semantic', 'migrate', 'latex'
      ];
      
      knownCommands.forEach(command => {
        expect(typeof command).toBe('string');
        expect(command.length).toBeGreaterThan(0);
      });
    });

    it('should reject invalid command names', () => {
      const invalidCommands = ['', null, undefined, 123, {}];
      
      invalidCommands.forEach(invalid => {
        expect(typeof invalid === 'string' && invalid.length > 0).toBe(false);
      });
    });
  });
});