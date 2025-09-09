import { describe, it, expect } from 'vitest';
import { fc, test } from 'fast-check';
import { execSync } from 'child_process';
import path from 'path';

// Fix CLI path to point to actual CLI entry point
const CLI_PATH = path.resolve('./bin/unjucks.cjs');

describe('CLI Command Property Tests', () => {
  const runCLI = (args = []) => {
    try {
      const result = execSync(`node ${CLI_PATH} ${args.join(' ')}`, {
        encoding: 'utf8',
        timeout: 5000,
        stdio: 'pipe'
      });
      return { stdout: result, stderr: '', exitCode: 0 };
    } catch (error) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        exitCode: error.status || 1
      };
    }
  };

  describe('Command Consistency', () => {
    it('should produce consistent output for same inputs', () => {
      test(fc.constantFrom('list', 'version', '--help'), (command) => {
        const result1 = runCLI([command]);
        const result2 = runCLI([command]);
        
        expect(result1.stdout).toBe(result2.stdout);
        expect(result1.exitCode).toBe(result2.exitCode);
      });
    });

    it('should handle argument variations correctly', () => {
      test(fc.constantFrom(['--version'], ['-v'], ['version']), (args) => {
        const result = runCLI(args);
        
        // Version should always be returned successfully
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
      });
    });
  });

  describe('Help Command Consistency', () => {
    it('should show consistent help output', () => {
      test(fc.constantFrom(['--help'], ['-h'], ['help']), (args) => {
        const result = runCLI(args);
        
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('Unjucks CLI');
        expect(result.stdout).toContain('Usage:');
      });
    });
  });

  describe('List Command Properties', () => {
    it('should list generators consistently', () => {
      test(fc.array(fc.constantFrom('list'), { minLength: 1, maxLength: 1 }), (args) => {
        const result = runCLI(args);
        
        // List command should succeed or fail consistently
        expect([0, 1]).toContain(result.exitCode);
        
        if (result.exitCode === 0) {
          // If successful, should contain generator information
          expect(result.stdout).toMatch(/generator|template|available/i);
        }
      });
    });
  });

  describe('Version Command Properties', () => {
    it('should show consistent version information', () => {
      const result = runCLI(['version']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    });
  });

  describe('Error Handling Properties', () => {
    it('should handle invalid commands gracefully', () => {
      test(fc.string({ minLength: 1, maxLength: 20 }).filter(s => 
        !['list', 'version', 'help', 'generate', 'new', 'preview', 'init', 'inject'].includes(s) &&
        !s.startsWith('-')
      ), (invalidCommand) => {
        const result = runCLI([invalidCommand]);
        
        // Should exit with error for invalid commands
        expect(result.exitCode).toBe(1);
        expect(result.stderr || result.stdout).toContain('Unknown command');
      });
    });
  });

  describe('Argument Validation Properties', () => {
    it('should validate flag arguments correctly', () => {
      test(fc.array(fc.string({ minLength: 1, maxLength: 10 }).map(s => `--${s}`)), (flags) => {
        const result = runCLI(flags);
        
        // Should either succeed or provide meaningful error
        expect([0, 1]).toContain(result.exitCode);
      });
    });
  });
});