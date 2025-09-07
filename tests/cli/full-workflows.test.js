/**
 * Full CLI Workflow Integration Tests
 * End-to-end testing of complete development workflows
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import { tmpdir } from 'os';

const execFileAsync = promisify(execFile);
const CLI_PATH = path.resolve(__dirname, '../../bin/unjucks.cjs');

async function runCLI(args = [], cwd) {
  try {
    const { stdout, stderr } = await execFileAsync('node', [CLI_PATH, ...args], { 
      cwd,
      timeout: 10000 
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (error) { 
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      exitCode: error.code || 1
    };
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function verifyFileContent(filePath, expectedContent) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return expectedContent.every(expected => content.includes(expected));
  } catch {
    return false;
  }
}

describe('Full CLI Workflow Integration Tests', () => {
  let tempDir;
  let originalCwd;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'unjucks-workflow-'));
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    if (tempDir) {
      try {
        await fs.rmdir(tempDir, { recursive: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('Workflow Command Tests', () => {
    it('should show workflow help', async () => {
      const result = await runCLI(['workflow', '--help']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('workflow');
      expect(result.stdout).toContain('create');
      expect(result.stdout).toContain('list');
    });

    it('should create a workflow', async () => {
      const result = await runCLI([
        'workflow', 'create',
        '--name', 'TestWorkflow',
        '--template', 'fullstack',
        '--agents', 'coder,tester'
      ]);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('TestWorkflow');
      expect(result.stdout).toContain('created successfully');
    });

    it('should list workflows', async () => {
      // First create a workflow
      await runCLI([
        'workflow', 'create',
        '--name', 'ListTestWorkflow',
        '--template', 'api'
      ]);

      // Then list workflows
      const result = await runCLI(['workflow', 'list']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('ListTestWorkflow');
    });

    it('should execute a workflow', async () => {
      // First create a workflow
      await runCLI([
        'workflow', 'create',
        '--name', 'ExecuteTestWorkflow',
        '--template', 'frontend'
      ]);

      // Then execute it
      const result = await runCLI(['workflow', 'execute', '--name', 'ExecuteTestWorkflow']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Executing');
    });
  });

  describe('Basic File Generation', () => {
    it('should create a simple component', async () => {
      const result = await runCLI(['generate', 'component', 'TestComponent']);
      
      expect(result.exitCode).toBe(0);
    });
  });
});