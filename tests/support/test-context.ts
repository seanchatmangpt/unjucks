/**
 * Vitest-Cucumber Test Context
 * Replaces Cucumber World with lightweight context for BDD scenarios
 */
import path from 'node:path';
import os from 'node:os';
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
  
  return {
    helper: new TestHelper(process.cwd()), // Use project root, not temp dir for CLI commands
    variables: {},
    lastResult: undefined,
    tempDirectory: tempDir,
    templatePaths: [],
    generatedFiles: [],
    workingDirectory: process.cwd()
  };
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