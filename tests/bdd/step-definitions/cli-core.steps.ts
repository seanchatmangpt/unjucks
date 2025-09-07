import { Given, When, Then, Before, After } from '@amiceli/vitest-cucumber';
import { expect, vi } from 'vitest';
import { execSync, spawn, ChildProcess } from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Test environment setup
interface TestContext {
  workingDir: string;
  lastCommand: string;
  lastOutput: string;
  lastError: string;
  lastExitCode: number;
  tempFiles: string[];
  processes: ChildProcess[];
}

const testContext: TestContext = {
  workingDir: '',
  lastCommand: '',
  lastOutput: '',
  lastError: '',
  lastExitCode: 0,
  tempFiles: [],
  processes: []
};

// Helper functions
function getProjectRoot(): string {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../');
}

function getUnjucksBinary(): string {
  return path.join(getProjectRoot(), 'bin/unjucks.cjs');
}

function executeCommand(command: string): { stdout: string; stderr: string; exitCode: number } {
  try {
    const result = execSync(command, {
      cwd: testContext.workingDir,
      encoding: 'utf8',
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    return {
      stdout: result.toString(),
      stderr: '',
      exitCode: 0
    };
  } catch (error: any) {
    return {
      stdout: error.stdout?.toString() || '',
      stderr: error.stderr?.toString() || error.message || '',
      exitCode: error.status || 1
    };
  }
}

function createTestDirectory(): string {
  const testDir = path.join(process.cwd(), 'tmp', `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  fs.ensureDirSync(testDir);
  testContext.tempFiles.push(testDir);
  return testDir;
}

// Background steps
Given('I have a working Unjucks installation', async () => {
  const unjucksBinary = getUnjucksBinary();
  expect(fs.existsSync(unjucksBinary)).toBe(true);
  
  // Verify installation by checking version
  const result = executeCommand(`node ${unjucksBinary} --version`);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
});

Given('I have a clean test environment', async () => {
  testContext.workingDir = createTestDirectory();
  process.chdir(testContext.workingDir);
  
  // Reset context
  testContext.lastCommand = '';
  testContext.lastOutput = '';
  testContext.lastError = '';
  testContext.lastExitCode = 0;
});

Given(/^I have templates in "([^"]+)" directory$/, async (templateDir: string) => {
  const templatesPath = path.join(testContext.workingDir, templateDir);
  fs.ensureDirSync(templatesPath);
  
  // Create some sample templates
  fs.ensureDirSync(path.join(templatesPath, 'component'));
  fs.writeFileSync(
    path.join(templatesPath, 'component', 'index.ts.njk'),
    `---
to: src/{{ name }}.ts
---
export class {{ name }} {
  constructor() {
    console.log('{{ name }} created');
  }
}
`
  );
  
  fs.writeFileSync(
    path.join(templatesPath, 'component', '_template.yaml'),
    `name: component
description: Generate a TypeScript component
variables:
  - name: name
    description: Component name
    required: true
`
  );
});

Given(/^I have an empty "([^"]+)" directory$/, async (dirName: string) => {
  const dirPath = path.join(testContext.workingDir, dirName);
  fs.ensureDirSync(dirPath);
  
  // Ensure directory is empty
  fs.emptyDirSync(dirPath);
});

// When steps (command execution)
When(/^I run "([^"]+)"$/, async (command: string) => {
  testContext.lastCommand = command;
  
  // Replace 'unjucks' with the actual binary path
  const actualCommand = command.replace(/^unjucks/, `node ${getUnjucksBinary()}`);
  
  const result = executeCommand(actualCommand);
  testContext.lastOutput = result.stdout;
  testContext.lastError = result.stderr;
  testContext.lastExitCode = result.exitCode;
});

// Then steps (assertions)
Then(/^I should see "([^"]+)" message$/, async (expectedMessage: string) => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toContain(expectedMessage);
});

Then('I should see the current version number', async () => {
  expect(testContext.lastOutput).toMatch(/\d+\.\d+\.\d+/);
});

Then('I should see usage information', async () => {
  expect(testContext.lastOutput).toContain('Usage:');
});

Then('I should see available commands listed', async () => {
  const output = testContext.lastOutput;
  expect(output).toContain('Commands:');
  expect(output).toMatch(/generate|list|inject|semantic/);
});

Then('I should see a list of available generators', async () => {
  expect(testContext.lastOutput).toContain('component');
});

Then('each generator should show its description', async () => {
  expect(testContext.lastOutput).toContain('Generate a TypeScript component');
});

Then(/^I should see "([^"]+)" message$/, async (expectedMessage: string) => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toContain(expectedMessage);
});

Then('I should see an error message', async () => {
  expect(testContext.lastError.length > 0 || testContext.lastOutput.includes('error')).toBe(true);
});

Then('I should see suggested similar commands', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/did you mean|similar commands|suggestions/i);
});

Then('I should see usage help', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/usage|help|options/i);
});

Then(/^the exit code should be (\d+)$/, async (expectedCode: string) => {
  expect(testContext.lastExitCode).toBe(parseInt(expectedCode));
});

// Cleanup
Before(async () => {
  // Ensure we start with a clean process state
  testContext.processes.forEach(proc => {
    if (!proc.killed) {
      proc.kill();
    }
  });
  testContext.processes = [];
});

After(async () => {
  // Cleanup temporary files and directories
  try {
    for (const tempPath of testContext.tempFiles) {
      if (fs.existsSync(tempPath)) {
        fs.removeSync(tempPath);
      }
    }
    testContext.tempFiles = [];
    
    // Kill any remaining processes
    testContext.processes.forEach(proc => {
      if (!proc.killed) {
        proc.kill();
      }
    });
    testContext.processes = [];
    
    // Reset working directory
    process.chdir(getProjectRoot());
  } catch (error) {
    console.warn('Cleanup warning:', error);
  }
});

// Export context for other step files
export { testContext, executeCommand, createTestDirectory, getUnjucksBinary };
