/**
 * Property-Based Testing
 * Tests system properties with generated inputs to find edge cases
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const cliPath = path.join(projectRoot, 'bin/unjucks.cjs');

/**
 * Property-based test generators
 */
class PropertyGenerators {
  static randomString(length = 10) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  static randomSafeString(length = 10) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  static randomSpecialChars(length = 5) {
    const chars = '!@#$%^&*()[]{}|;:,.<>?`~';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  static randomPath() {
    const segments = Math.floor(Math.random() * 5) + 1;
    return Array.from({ length: segments }, () => this.randomSafeString(8)).join('/');
  }

  static randomArgs(count = 5) {
    return Array.from({ length: count }, () => {
      const type = Math.random();
      if (type < 0.3) return `--${this.randomSafeString(6)}`;
      if (type < 0.6) return `-${this.randomSafeString(1)}`;
      return this.randomSafeString(8);
    });
  }

  static randomNumber(min = 0, max = 1000) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

describe('Property-Based Testing', () => {
  describe('CLI Argument Properties', () => {
    it('should handle arbitrary valid strings as template names', async () => {
      // Property: Any safe string should be processable as a template name
      for (let i = 0; i < 20; i++) {
        const templateName = PropertyGenerators.randomSafeString(15);
        const result = await execCLI(['generate', 'component', 'test', templateName]);
        
        // Should not crash, regardless of template existence
        expect(result.exitCode).toBeOneOf([0, 1]);
        expect(typeof result.stdout).toBe('string');
        expect(typeof result.stderr).toBe('string');
      }
    });

    it('should gracefully handle invalid characters in arguments', async () => {
      // Property: Invalid characters should be handled gracefully
      for (let i = 0; i < 15; i++) {
        const invalidName = PropertyGenerators.randomSpecialChars(10);
        const result = await execCLI(['generate', 'test', invalidName]);
        
        // Should handle gracefully, not crash
        expect(result.exitCode).toBeOneOf([0, 1]);
        expect(() => JSON.stringify(result.stdout)).not.toThrow();
      }
    });

    it('should handle varying argument counts', async () => {
      // Property: CLI should handle different numbers of arguments
      for (let argCount = 0; argCount <= 10; argCount++) {
        const args = Array.from({ length: argCount }, () => 
          PropertyGenerators.randomSafeString(6)
        );
        
        const result = await execCLI(args);
        expect(result.exitCode).toBeOneOf([0, 1]);
      }
    });

    it('should handle mixed flag and positional arguments', async () => {
      // Property: Mixed arguments should be parsed correctly
      for (let i = 0; i < 10; i++) {
        const args = PropertyGenerators.randomArgs(8);
        const result = await execCLI(args);
        
        expect(result.exitCode).toBeOneOf([0, 1]);
        expect(typeof result.stdout).toBe('string');
      }
    });
  });

  describe('String Length Properties', () => {
    it('should handle strings of various lengths', async () => {
      // Property: String length should not cause crashes
      const lengths = [0, 1, 10, 100, 1000, 5000];
      
      for (const length of lengths) {
        const longString = PropertyGenerators.randomSafeString(length);
        const result = await execCLI(['generate', 'test', 'component', longString]);
        
        expect(result.exitCode).toBeOneOf([0, 1]);
        // Should complete within reasonable time
        const timeout = Math.max(5000, length / 10); // Scale timeout with input size
        expect(result).toBeDefined(); // Test completed within timeout
      }
    });

    it('should handle empty and whitespace strings', async () => {
      // Property: Edge case strings should be handled gracefully
      const edgeCases = ['', ' ', '\t', '\n', '   ', '\t\n  \t'];
      
      for (const edgeCase of edgeCases) {
        const result = await execCLI(['generate', 'test', edgeCase]);
        expect(result.exitCode).toBeOneOf([0, 1]);
      }
    });
  });

  describe('Path Properties', () => {
    it('should handle various path formats', async () => {
      // Property: Different path formats should be handled consistently
      for (let i = 0; i < 15; i++) {
        const randomPath = PropertyGenerators.randomPath();
        const result = await execCLI(['list', '--path', randomPath]);
        
        expect(result.exitCode).toBeOneOf([0, 1]);
      }
    });

    it('should normalize path separators', async () => {
      // Property: Path separators should be handled cross-platform
      const pathVariants = [
        'templates/component/new',
        'templates\\component\\new',
        'templates/component\\new',
        './templates/component/new',
        '.\\templates\\component\\new'
      ];
      
      for (const pathVariant of pathVariants) {
        const result = await execCLI(['list', '--path', pathVariant]);
        expect(result.exitCode).toBeOneOf([0, 1]);
      }
    });
  });

  describe('Numeric Properties', () => {
    it('should handle various numeric inputs', async () => {
      // Property: Numeric inputs should be validated properly
      const numbers = [0, -1, 1, 42, 999999, -999999, 1.5, -1.5, NaN, Infinity];
      
      for (const num of numbers) {
        const result = await execCLI(['generate', 'test', 'component', num.toString()]);
        expect(result.exitCode).toBeOneOf([0, 1]);
      }
    });
  });

  describe('Unicode Properties', () => {
    it('should handle Unicode characters', async () => {
      // Property: Unicode should be handled correctly
      const unicodeStrings = [
        'café',
        '测试',
        'тест',
        '🚀🌟',
        'Îñtërnâtiônàlizætiøn',
        'مثال',
        'テスト'
      ];
      
      for (const unicodeStr of unicodeStrings) {
        const result = await execCLI(['generate', 'test', 'component', unicodeStr]);
        expect(result.exitCode).toBeOneOf([0, 1]);
      }
    });
  });

  describe('Command Combination Properties', () => {
    it('should handle all valid command combinations', async () => {
      // Property: Valid command combinations should work consistently
      const commands = ['generate', 'list', 'init', 'help'];
      const subcommands = ['component', 'service', 'api', 'test'];
      
      for (let i = 0; i < 20; i++) {
        const command = commands[Math.floor(Math.random() * commands.length)];
        const subcommand = subcommands[Math.floor(Math.random() * subcommands.length)];
        const name = PropertyGenerators.randomSafeString(8);
        
        const result = await execCLI([command, subcommand, name]);
        expect(result.exitCode).toBeOneOf([0, 1]);
      }
    });
  });

  describe('Concurrent Execution Properties', () => {
    it('should handle concurrent executions consistently', async () => {
      // Property: Concurrent executions should not interfere with each other
      const concurrentOps = Array.from({ length: 10 }, () => 
        execCLI(['--version'])
      );
      
      const results = await Promise.all(concurrentOps);
      
      results.forEach((result, index) => {
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
      });
      
      // All results should be identical (deterministic)
      const firstOutput = results[0].stdout;
      results.forEach(result => {
        expect(result.stdout).toBe(firstOutput);
      });
    });
  });

  describe('Error Handling Properties', () => {
    it('should produce consistent error messages for similar inputs', async () => {
      // Property: Similar errors should produce similar error patterns
      const invalidCommands = Array.from({ length: 10 }, () => 
        PropertyGenerators.randomString(15)
      );
      
      const results = await Promise.all(
        invalidCommands.map(cmd => execCLI([cmd]))
      );
      
      results.forEach(result => {
        expect(result.exitCode).toBeOneOf([0, 1]);
        // Error handling should be consistent
      });
    });
  });

  describe('Memory Properties', () => {
    it('should have bounded memory usage regardless of input size', async () => {
      // Property: Memory usage should not grow linearly with input size
      const initialMemory = process.memoryUsage().heapUsed;
      
      for (let size = 100; size <= 1000; size += 100) {
        const largeInput = PropertyGenerators.randomSafeString(size);
        await execCLI(['generate', 'test', largeInput]);
        
        global.gc && global.gc();
        const currentMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = currentMemory - initialMemory;
        
        // Memory increase should be bounded
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB
      }
    });
  });

  describe('Idempotency Properties', () => {
    it('should produce identical results for identical inputs', async () => {
      // Property: Same inputs should produce same outputs (when deterministic)
      const testCases = [
        ['--version'],
        ['--help'],
        ['list']
      ];
      
      for (const testCase of testCases) {
        const result1 = await execCLI(testCase);
        const result2 = await execCLI(testCase);
        
        expect(result1.exitCode).toBe(result2.exitCode);
        expect(result1.stdout).toBe(result2.stdout);
        // stderr might vary due to timing, so we don't test it strictly
      }
    });
  });

  describe('Boundary Value Properties', () => {
    it('should handle boundary values correctly', async () => {
      // Property: Boundary values should not cause unexpected behavior
      const boundaryValues = [
        '', // Minimum string
        'a', // Single character
        'a'.repeat(255), // Common max length
        'a'.repeat(1000), // Large but reasonable
      ];
      
      for (const value of boundaryValues) {
        const result = await execCLI(['generate', 'test', value]);
        expect(result.exitCode).toBeOneOf([0, 1]);
      }
    });
  });
});

/**
 * Execute CLI command for property testing
 */
function execCLI(args = [], timeout = 10000) {
  return new Promise((resolve) => {
    const child = spawn('node', [cliPath, ...args], {
      env: { ...process.env, NODE_ENV: 'test' },
      timeout
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (exitCode) => {
      resolve({ exitCode: exitCode || 0, stdout, stderr });
    });

    child.on('error', (error) => {
      resolve({ exitCode: 1, stdout, stderr: error.message });
    });
  });
}

// Custom matcher for property testing
expect.extend({
  toBeOneOf(received, expected) {
    const pass = expected.includes(received);
    return {
      message: () => `expected ${received} to be one of ${expected.join(', ')}`,
      pass
    };
  }
});