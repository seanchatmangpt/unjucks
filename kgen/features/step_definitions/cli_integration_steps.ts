/**
 * CLI Integration Step Definitions for KGEN E2E Testing
 * 
 * Tests actual KGEN CLI processes with real subprocess execution,
 * validating command-line interfaces and their integration with core engines.
 */

import { Given, When, Then, Before, After } from '@cucumber/cucumber';
import { expect } from 'chai';
import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';

interface CLITestContext {
  // CLI process management
  currentProcess: ChildProcess | null;
  processHistory: Array<{
    command: string;
    args: string[];
    exitCode: number | null;
    stdout: string[];
    stderr: string[];
    duration: number;
    startTime: number;
  }>;
  
  // Test environment
  testWorkspace: string;
  kgenBinary: string;
  configFile: string;
  
  // CLI output capture
  currentStdout: string[];
  currentStderr: string[];
  currentExitCode: number | null;
  
  // Command execution state
  lastCommand: {
    command: string;
    args: string[];
    startTime: number;
    endTime?: number;
    duration?: number;
  } | null;
  
  // Performance tracking
  commandMetrics: Array<{
    command: string;
    duration: number;
    memoryUsage: number;
    timestamp: number;
  }>;
  
  // Multi-command workflows
  workflowCommands: Array<{
    step: string;
    command: string;
    args: string[];
    expectedExitCode: number;
    completed: boolean;
    error?: string;
  }>;
}

// Global CLI test context
let cliContext: CLITestContext = {
  currentProcess: null,
  processHistory: [],
  testWorkspace: '',
  kgenBinary: '',
  configFile: '',
  currentStdout: [],
  currentStderr: [],
  currentExitCode: null,
  lastCommand: null,
  commandMetrics: [],
  workflowCommands: []
};

// =============================================================================
// CLI SETUP AND CLEANUP
// =============================================================================

Before(async function() {
  // Setup test workspace for each scenario
  cliContext.testWorkspace = path.join(__dirname, '../../../test-workspace', 
    `cli-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  
  cliContext.kgenBinary = path.resolve(__dirname, '../../../bin/kgen.mjs');
  cliContext.configFile = path.join(cliContext.testWorkspace, 'kgen.config.js');
  
  await fs.mkdir(cliContext.testWorkspace, { recursive: true });
  
  // Create basic config file
  const config = `
export default {
  templateDirs: ['_templates', 'templates'],
  outputDir: 'generated',
  deterministic: true,
  enableMetrics: true,
  performance: {
    renderTimeTarget: 150, // ms
    cacheHitRateTarget: 0.90
  }
};`;
  
  await fs.writeFile(cliContext.configFile, config, 'utf-8');
  
  // Clear state
  cliContext.currentStdout = [];
  cliContext.currentStderr = [];
  cliContext.currentExitCode = null;
  cliContext.lastCommand = null;
  cliContext.processHistory = [];
  cliContext.commandMetrics = [];
  cliContext.workflowCommands = [];
});

After(async function() {
  // Kill any running processes
  if (cliContext.currentProcess) {
    cliContext.currentProcess.kill('SIGTERM');
    
    // Wait for process to exit gracefully or force kill
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        if (cliContext.currentProcess && !cliContext.currentProcess.killed) {
          cliContext.currentProcess.kill('SIGKILL');
        }
        resolve();
      }, 5000);
      
      cliContext.currentProcess.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }
  
  // Cleanup test workspace
  try {
    await fs.rm(cliContext.testWorkspace, { recursive: true, force: true });
  } catch (error) {
    console.warn('Could not clean up CLI test workspace:', error.message);
  }
});

// Helper function to execute KGEN CLI command
async function executeKgenCommand(command: string, args: string[] = [], options: {
  timeout?: number;
  cwd?: string;
  env?: Record<string, string>;
  expectFailure?: boolean;
} = {}): Promise<{
  exitCode: number;
  stdout: string[];
  stderr: string[];
  duration: number;
}> {
  
  return new Promise((resolve, reject) => {
    const startTime = performance.now();
    const cwd = options.cwd || cliContext.testWorkspace;
    const timeout = options.timeout || 30000; // 30 second default timeout
    
    // Track command start
    cliContext.lastCommand = {
      command,
      args,
      startTime
    };
    
    const fullArgs = [command, ...args];
    const env = { 
      ...process.env, 
      NODE_ENV: 'test',
      KGEN_CONFIG: cliContext.configFile,
      ...options.env
    };
    
    cliContext.currentProcess = spawn('node', [cliContext.kgenBinary, ...fullArgs], {
      cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    const stdout: string[] = [];
    const stderr: string[] = [];
    
    // Capture stdout
    cliContext.currentProcess.stdout?.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      stdout.push(...lines);
      cliContext.currentStdout.push(...lines);
    });
    
    // Capture stderr
    cliContext.currentProcess.stderr?.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      stderr.push(...lines);
      cliContext.currentStderr.push(...lines);
    });
    
    // Handle process exit
    cliContext.currentProcess.on('exit', (exitCode) => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      cliContext.currentExitCode = exitCode;
      
      if (cliContext.lastCommand) {
        cliContext.lastCommand.endTime = endTime;
        cliContext.lastCommand.duration = duration;
      }
      
      // Record command metrics
      cliContext.commandMetrics.push({
        command: `${command} ${args.join(' ')}`,
        duration,
        memoryUsage: process.memoryUsage().heapUsed / (1024 * 1024),
        timestamp: Date.now()
      });
      
      // Add to process history
      cliContext.processHistory.push({
        command,
        args,
        exitCode,
        stdout,
        stderr,
        duration,
        startTime
      });
      
      cliContext.currentProcess = null;
      
      resolve({
        exitCode: exitCode || 0,
        stdout,
        stderr,
        duration
      });
    });
    
    // Handle process errors
    cliContext.currentProcess.on('error', (error) => {
      reject(new Error(`Process error: ${error.message}`));
    });
    
    // Set timeout
    const timeoutId = setTimeout(() => {
      if (cliContext.currentProcess) {
        cliContext.currentProcess.kill('SIGTERM');
        reject(new Error(`Command timed out after ${timeout}ms`));
      }
    }, timeout);
    
    cliContext.currentProcess.on('exit', () => {
      clearTimeout(timeoutId);
    });
  });
}

// =============================================================================
// CLI COMMAND EXECUTION
// =============================================================================

Given('I have the KGEN CLI available', async function() {
  // Verify KGEN binary exists and is executable
  try {
    await fs.access(cliContext.kgenBinary, fs.constants.F_OK | fs.constants.R_OK);
  } catch (error) {
    throw new Error(`KGEN binary not accessible at ${cliContext.kgenBinary}: ${error.message}`);
  }
  
  // Test basic CLI functionality
  const result = await executeKgenCommand('--version', [], { timeout: 10000 });
  expect(result.exitCode).to.equal(0, 'KGEN CLI should execute --version successfully');
  expect(result.stdout.length).to.be.greaterThan(0, 'Version command should produce output');
});

When('I run the KGEN command {string}', async function(commandLine: string) {
  const parts = commandLine.trim().split(/\s+/);
  const command = parts[0];
  const args = parts.slice(1);
  
  const result = await executeKgenCommand(command, args);
  
  // Store results for assertions
  cliContext.currentStdout = result.stdout;
  cliContext.currentStderr = result.stderr;
  cliContext.currentExitCode = result.exitCode;
});

When('I run KGEN command {string} with args:', async function(command: string, argsTable) {
  const args: string[] = [];
  
  for (const row of argsTable.rows()) {
    const [flag, value] = row;
    args.push(flag);
    if (value && value !== '') {
      args.push(value);
    }
  }
  
  const result = await executeKgenCommand(command, args);
  
  cliContext.currentStdout = result.stdout;
  cliContext.currentStderr = result.stderr;
  cliContext.currentExitCode = result.exitCode;
});

When('I execute the KGEN workflow:', async function(workflowTable) {
  cliContext.workflowCommands = [];
  
  // Parse workflow steps
  for (const row of workflowTable.rows()) {
    const [step, command, argsStr, expectedExitCode] = row;
    const args = argsStr ? argsStr.split(/\s+/).filter(arg => arg.trim()) : [];
    
    cliContext.workflowCommands.push({
      step,
      command,
      args,
      expectedExitCode: parseInt(expectedExitCode) || 0,
      completed: false
    });
  }
  
  // Execute workflow steps sequentially
  for (const workflowStep of cliContext.workflowCommands) {
    try {
      const result = await executeKgenCommand(workflowStep.command, workflowStep.args);
      
      if (result.exitCode === workflowStep.expectedExitCode) {
        workflowStep.completed = true;
      } else {
        workflowStep.error = `Expected exit code ${workflowStep.expectedExitCode}, got ${result.exitCode}`;
        break;
      }
      
    } catch (error) {
      workflowStep.error = error.message;
      break;
    }
  }
});

When('I run KGEN with timeout {int}ms', async function(timeoutMs: number) {
  const command = cliContext.lastCommand?.command || 'help';
  const args = cliContext.lastCommand?.args || [];
  
  try {
    const result = await executeKgenCommand(command, args, { timeout: timeoutMs });
    cliContext.currentStdout = result.stdout;
    cliContext.currentStderr = result.stderr;
    cliContext.currentExitCode = result.exitCode;
  } catch (error) {
    if (error.message.includes('timed out')) {
      cliContext.currentExitCode = -1; // Timeout exit code
      cliContext.currentStderr = [error.message];
    } else {
      throw error;
    }
  }
});

// =============================================================================
// CLI OUTPUT ASSERTIONS
// =============================================================================

Then('the command should exit with code {int}', function(expectedExitCode: number) {
  expect(cliContext.currentExitCode).to.equal(expectedExitCode,
    `Expected exit code ${expectedExitCode}, got ${cliContext.currentExitCode}\nStderr: ${cliContext.currentStderr.join('\n')}`);
});

Then('the output should contain {string}', function(expectedContent: string) {
  const allOutput = [...cliContext.currentStdout, ...cliContext.currentStderr].join('\n');
  expect(allOutput).to.include(expectedContent,
    `Output should contain "${expectedContent}"\nActual output:\n${allOutput}`);
});

Then('the output should match pattern {string}', function(pattern: string) {
  const allOutput = [...cliContext.currentStdout, ...cliContext.currentStderr].join('\n');
  const regex = new RegExp(pattern);
  expect(regex.test(allOutput)).to.be.true,
    `Output should match pattern "${pattern}"\nActual output:\n${allOutput}`);
});

Then('stderr should contain {string}', function(expectedError: string) {
  const stderrOutput = cliContext.currentStderr.join('\n');
  expect(stderrOutput).to.include(expectedError,
    `Stderr should contain "${expectedError}"\nActual stderr:\n${stderrOutput}`);
});

Then('stdout should contain {string}', function(expectedOutput: string) {
  const stdoutOutput = cliContext.currentStdout.join('\n');
  expect(stdoutOutput).to.include(expectedOutput,
    `Stdout should contain "${expectedOutput}"\nActual stdout:\n${stdoutOutput}`);
});

Then('the command should complete within {int}ms', function(maxDuration: number) {
  const lastCommand = cliContext.lastCommand;
  expect(lastCommand).to.not.be.null, 'No command execution recorded');
  expect(lastCommand.duration).to.not.be.undefined, 'Command duration not recorded');
  expect(lastCommand.duration).to.be.lessThan(maxDuration,
    `Command took ${lastCommand.duration}ms, expected under ${maxDuration}ms`);
});

Then('all workflow steps should complete successfully', function() {
  for (const step of cliContext.workflowCommands) {
    expect(step.completed).to.be.true,
      `Workflow step "${step.step}" failed: ${step.error || 'Unknown error'}`);
  }
  
  expect(cliContext.workflowCommands.length).to.be.greaterThan(0,
    'No workflow steps were defined');
});

Then('the workflow should complete in under {int}ms total', function(maxTotalDuration: number) {
  const totalDuration = cliContext.commandMetrics
    .filter(metric => cliContext.workflowCommands.some(cmd => 
      metric.command.startsWith(cmd.command)))
    .reduce((total, metric) => total + metric.duration, 0);
  
  expect(totalDuration).to.be.lessThan(maxTotalDuration,
    `Total workflow duration ${totalDuration}ms exceeds limit ${maxTotalDuration}ms`);
});

// =============================================================================
// FILE SYSTEM INTEGRATION
// =============================================================================

Given('I have a template directory with {int} templates', async function(templateCount: number) {
  const templatesDir = path.join(cliContext.testWorkspace, '_templates');
  await fs.mkdir(templatesDir, { recursive: true });
  
  for (let i = 1; i <= templateCount; i++) {
    const templateDir = path.join(templatesDir, `template-${i}`);
    await fs.mkdir(templateDir, { recursive: true });
    
    const templateContent = `---
to: output-{{ name }}-${i}.txt
inject: false
---
Template ${i}: {{ name }}
Generated at: {{ timestamp }}
Index: ${i}`;
    
    await fs.writeFile(path.join(templateDir, 'index.njk'), templateContent, 'utf-8');
  }
});

Then('files should be generated in the output directory', async function() {
  const outputDir = path.join(cliContext.testWorkspace, 'generated');
  
  try {
    const files = await fs.readdir(outputDir);
    expect(files.length).to.be.greaterThan(0, 'No files generated in output directory');
    
    // Verify files have content
    for (const file of files) {
      const filePath = path.join(outputDir, file);
      const stats = await fs.stat(filePath);
      expect(stats.size).to.be.greaterThan(0, `Generated file ${file} is empty`);
    }
    
  } catch (error) {
    throw new Error(`Output directory not accessible: ${error.message}`);
  }
});

Then('file {string} should exist with content matching {string}', async function(fileName: string, pattern: string) {
  const outputDir = path.join(cliContext.testWorkspace, 'generated');
  const filePath = path.join(outputDir, fileName);
  
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const regex = new RegExp(pattern);
    expect(regex.test(content)).to.be.true,
      `File ${fileName} content does not match pattern "${pattern}"\nActual content:\n${content}`);
      
  } catch (error) {
    throw new Error(`Could not read file ${fileName}: ${error.message}`);
  }
});

// =============================================================================
// PERFORMANCE AND MONITORING
// =============================================================================

Then('command execution should use less than {int}MB memory', function(maxMemoryMB: number) {
  const latestMetric = cliContext.commandMetrics[cliContext.commandMetrics.length - 1];
  expect(latestMetric).to.not.be.undefined, 'No command metrics recorded');
  
  expect(latestMetric.memoryUsage).to.be.lessThan(maxMemoryMB,
    `Command used ${latestMetric.memoryUsage.toFixed(2)}MB, expected under ${maxMemoryMB}MB`);
});

Then('average command time should be under {int}ms', function(maxAverage: number) {
  expect(cliContext.commandMetrics.length).to.be.greaterThan(0, 'No command metrics recorded');
  
  const averageTime = cliContext.commandMetrics
    .reduce((total, metric) => total + metric.duration, 0) / cliContext.commandMetrics.length;
  
  expect(averageTime).to.be.lessThan(maxAverage,
    `Average command time ${averageTime.toFixed(2)}ms exceeds limit ${maxAverage}ms`);
});

// =============================================================================
// ERROR SCENARIOS AND RECOVERY
// =============================================================================

Given('the output directory is read-only', async function() {
  const outputDir = path.join(cliContext.testWorkspace, 'generated');
  await fs.mkdir(outputDir, { recursive: true });
  await fs.chmod(outputDir, 0o444); // Read-only
});

Given('the config file is missing', async function() {
  try {
    await fs.unlink(cliContext.configFile);
  } catch (error) {
    // File already doesn't exist
  }
});

Given('I have an invalid template with syntax error', async function() {
  const templatesDir = path.join(cliContext.testWorkspace, '_templates');
  const invalidTemplateDir = path.join(templatesDir, 'invalid');
  await fs.mkdir(invalidTemplateDir, { recursive: true });
  
  const invalidTemplate = `---
to: output.txt
---
{{ invalid.syntax.with.missing.end`;
  
  await fs.writeFile(path.join(invalidTemplateDir, 'index.njk'), invalidTemplate, 'utf-8');
});

When('I run the command expecting failure', async function() {
  const command = 'generate';
  const args = ['invalid', '--name', 'test'];
  
  try {
    const result = await executeKgenCommand(command, args, { expectFailure: true });
    cliContext.currentStdout = result.stdout;
    cliContext.currentStderr = result.stderr;
    cliContext.currentExitCode = result.exitCode;
  } catch (error) {
    // Expected to fail
    cliContext.currentExitCode = 1;
    cliContext.currentStderr = [error.message];
  }
});

Then('the command should fail gracefully', function() {
  expect(cliContext.currentExitCode).to.not.equal(0, 'Command should have failed');
  
  // Should have meaningful error message
  const errorOutput = cliContext.currentStderr.join('\n');
  expect(errorOutput.length).to.be.greaterThan(0, 'Should have error message');
  expect(errorOutput).to.not.include('undefined'), 'Error message should not contain undefined';
});

// =============================================================================
// CLI HELP AND DOCUMENTATION
// =============================================================================

Then('help output should contain usage information', function() {
  const helpOutput = cliContext.currentStdout.join('\n');
  expect(helpOutput).to.include('Usage:', 'Help should contain usage information');
  expect(helpOutput).to.include('Commands:', 'Help should list commands');
  expect(helpOutput).to.include('Options:', 'Help should list options');
});

Then('command list should include {string}', function(commandName: string) {
  const output = cliContext.currentStdout.join('\n');
  expect(output).to.include(commandName, `Command list should include "${commandName}"`);
});

// =============================================================================
// INTEGRATION WITH CORE ENGINES
// =============================================================================

Then('CAS storage should be utilized', function() {
  const output = [...cliContext.currentStdout, ...cliContext.currentStderr].join('\n');
  
  // Look for CAS-related output or evidence of content addressing
  const casIndicators = [
    'sha256:', 'content-addressed', 'CAS store', 'hash:', 'storing content'
  ];
  
  const hasCasEvidence = casIndicators.some(indicator => 
    output.toLowerCase().includes(indicator.toLowerCase()));
  
  expect(hasCasEvidence).to.be.true,
    'Should show evidence of CAS storage usage in output');
});

Then('provenance information should be generated', function() {
  const output = [...cliContext.currentStdout, ...cliContext.currentStderr].join('\n');
  
  // Look for provenance-related output
  const provenanceIndicators = [
    'provenance', 'attestation', 'signature', 'generated by', 'timestamp'
  ];
  
  const hasProvenanceEvidence = provenanceIndicators.some(indicator => 
    output.toLowerCase().includes(indicator.toLowerCase()));
  
  expect(hasProvenanceEvidence).to.be.true,
    'Should show evidence of provenance generation in output');
});

export { cliContext, executeKgenCommand };