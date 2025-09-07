import { TestHelper } from '../support/TestHelper.js';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { describe, test, expect, beforeEach, afterEach } from 'vitest';

/**
 * Smoke tests to verify the CLI is working and ready for BDD testing
 */
describe('CLI Smoke Tests', () => {
  let testHelper;
  let tempDir;

  beforeEach(async () => {
    // Create a unique temporary directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'unjucks-smoke-'));
    testHelper = new TestHelper(tempDir);
  });

  afterEach(async () => {
    await testHelper.cleanup();
  });

  describe('Basic CLI Functionality', () => {
    test('should show version', async () => {
      const result = await testHelper.runCli('--version');
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe('0.0.0');
      expect(result.stderr).toBe('');
    });

    test('should show help', async () => {
      const result = await testHelper.runCli('--help');
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('A Hygen-style CLI generator');
      expect(result.stdout).toContain('USAGE unjucks');
      expect(result.stdout).toContain('generate');
      expect(result.stdout).toContain('list');
      expect(result.stdout).toContain('init');
      expect(result.stderr).toBe('');
    });

    test('should handle list command with no templates', async () => {
      const result = await testHelper.runCli('list');
      
      expect(result.exitCode).toBe(0);
      // Should handle the case where no templates exist gracefully
    });

    test('should handle generate command with no arguments', async () => {
      const result = await testHelper.runCli('generate');
      
      // Should either show help or prompt for generator selection
      expect([0, 1]).toContain(result.exitCode);
    });

    test('should handle init command', async () => {
      const result = await testHelper.runCli('init --help');
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('init');
    });
  });

  describe('CLI Path and Execution', () => {
    test('should execute CLI from correct path', async () => {
      const cliPath = path.join(process.cwd(), 'dist/cli.mjs');
      expect(await fs.pathExists(cliPath)).toBe(true);
      
      const result = await testHelper.executeCommand(`node "${cliPath}" --version`);
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe('0.0.0');
    });

    test('should handle command parsing correctly', async () => {
      // Test that our command parsing in TestHelper works
      const result1 = await testHelper.runCli('unjucks --version');
      const result2 = await testHelper.runCli('--version');
      
      expect(result1.exitCode).toBe(result2.exitCode);
      expect(result1.stdout).toBe(result2.stdout);
    });
  });

  describe('File System Operations', () => {
    test('should create and read files', async () => {
      await testHelper.createFile('test.txt', 'Hello World');
      
      const exists = await testHelper.fileExists('test.txt');
      expect(exists).toBe(true);
      
      const content = await testHelper.readFile('test.txt');
      expect(content).toBe('Hello World');
    });

    test('should create and verify directories', async () => {
      await testHelper.createDirectory('test-dir');
      
      const exists = await testHelper.directoryExists('test-dir');
      expect(exists).toBe(true);
    });

    test('should create template structure', async () => {
      await testHelper.createTemplateStructure({
        'component/new/hello.ts.hbs': 'export const {{ name }} = "hello";',
        'component/new/package.json.hbs': '{"name": "{{ name }}"}'
      });
      
      const exists1 = await testHelper.fileExists('_templates/component/new/hello.ts.hbs');
      const exists2 = await testHelper.fileExists('_templates/component/new/package.json.hbs');
      
      expect(exists1).toBe(true);
      expect(exists2).toBe(true);
    });
  });

  describe('Performance and Reliability', () => {
    test('should execute commands within reasonable time', async () => {
      const startTime = Date.now();
      const result = await testHelper.runCli('--version');
      const duration = Date.now() - startTime;
      
      expect(result.exitCode).toBe(0);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should handle multiple commands sequentially', async () => {
      const commands = ['--version', '--help', 'list'];
      
      for (const command of commands) {
        const result = await testHelper.runCli(command);
        expect([0, 1]).toContain(result.exitCode); // Allow success or expected failures
      }
    });
  });
});