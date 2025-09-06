/**
 * Vitest-Cucumber Test Context
 * Replaces Cucumber World with lightweight context for BDD scenarios
 */
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { TestHelper, type CLIResult } from './TestHelper.js';

export interface TestContext {
  /** CLI execution helper */
  helper: TestHelper;
  
  /** Dynamic variables for storing data between steps */
  variables: Record<string, any>;
  
  /** Last CLI command result */
  lastResult?: CLIResult;
  
  /** Temporary directory for test operations */
  tempDirectory: string;
  
  /** Template paths and structures */
  templatePaths: string[];
  
  /** Generated files tracking */
  generatedFiles: string[];
  
  /** Current working directory for tests */
  workingDirectory: string;
}

/**
 * Creates a fresh test context for each scenario
 */
export const createTestContext = (): TestContext => {
  const tempDir = path.join(os.tmpdir(), `unjucks-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  
  console.log(`[createTestContext] Creating test context with tempDir: ${tempDir}`);
  
  const context = {
    helper: new TestHelper(process.cwd()), // Use project root, not temp dir for CLI commands
    variables: {},
    lastResult: undefined,
    tempDirectory: tempDir,
    templatePaths: [],
    generatedFiles: [],
    workingDirectory: process.cwd()
  };

  // Override the helper's executeCommand method to ensure proper CLI execution
  const originalExecuteCommand = context.helper.executeCommand.bind(context.helper);
  context.helper.executeCommand = async (command: string, options?: { cwd?: string; timeout?: number }) => {
    
    console.log(`[TestHelper.executeCommand] Executing: ${command}`);
    console.log(`[TestHelper.executeCommand] Working directory: ${options?.cwd || process.cwd()}`);
    
    const startTime = Date.now();
    const workingDir = options?.cwd || process.cwd();
    const timeout = options?.timeout || 30_000;

    try {
      // Create clean environment without NODE_ENV=test which interferes with CLI output
      const cleanEnv = { ...process.env };
      delete cleanEnv.NODE_ENV;
      
      const result = execSync(command, {
        cwd: workingDir,
        timeout: timeout,
        maxBuffer: 1024 * 1024,
        encoding: 'utf8',
        env: cleanEnv
      });

      const finalResult = {
        stdout: result.toString(),
        stderr: '',
        exitCode: 0,
        duration: Date.now() - startTime
      };

      console.log(`[TestHelper.executeCommand] Success:`, {
        exitCode: finalResult.exitCode,
        stdoutLength: finalResult.stdout.length,
        stdout: JSON.stringify(finalResult.stdout),
        stderr: JSON.stringify(finalResult.stderr)
      });

      return finalResult;
    } catch (error: any) {
      const finalResult = {
        stdout: error.stdout ? error.stdout.toString() : '',
        stderr: error.stderr ? error.stderr.toString() : error.message || '',
        exitCode: error.status || 1,
        duration: Date.now() - startTime
      };

      console.log(`[TestHelper.executeCommand] Error:`, {
        exitCode: finalResult.exitCode,
        stdout: JSON.stringify(finalResult.stdout),
        stderr: JSON.stringify(finalResult.stderr)
      });

      return finalResult;
    }
  };

  return context;
};

/**
 * Hook for test context setup
 */
export const useTestContext = (): TestContext => {
  return createTestContext();
};

/**
 * Cleanup utility for test context
 */
export const cleanupTestContext = async (context: TestContext): Promise<void> => {
  try {
    // Clean up temporary files and directories
    await context.helper.cleanup();
    
    // Reset working directory (only if not in worker thread)
    try {
      if (context.workingDirectory !== process.cwd()) {
        process.chdir(context.workingDirectory);
      }
    } catch (error: any) {
      if (error.code !== 'ERR_WORKER_UNSUPPORTED_OPERATION') {
        throw error;
      }
      // Silently ignore worker thread chdir errors
    }
    
    // Clear variables
    context.variables = {};
    context.generatedFiles = [];
    context.templatePaths = [];
  } catch (error) {
    // Ignore cleanup errors in tests
    console.warn('Test cleanup warning:', error);
  }
};