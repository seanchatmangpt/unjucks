// Removed Cucumber-specific import for vitest-cucumber compatibility
import { execSync } from 'node:child_process';
import * as fs from 'fs-extra';
import * as path from 'node:path';
import * as os from 'node:os';
import { TestHelper, type CLIResult } from './TestHelper';

export interface UnjucksWorldParameters {
  baseUrl: string;
  timeout: number;
  testDataPath: string;
}

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  duration?: number;
}

export interface TestContext {
  workingDirectory: string;
  tempDirectory: string;
  lastCommandOutput: string;
  lastCommandError: string;
  lastCommandCode: number | null;
  generatedFiles: string[];
  templateVariables: Record<string, any>;
  fixtures: Record<string, any>;
  lastCommandResult?: CLIResult;
}

export class UnjucksWorld {
  public helper: TestHelper;

  // Re-export for backward compatibility with existing step definitions
  public CustomWorld = UnjucksWorld;
  public context: TestContext;
  
  // Additional properties for hooks compatibility
  public debugMode: boolean = false;
  public testCaseStartedId?: string;
  public lastResult?: CLIResult;
  public variables: Record<string, any> = {};
  public tempDir?: string;

  public parameters: UnjucksWorldParameters;

  constructor(parameters?: Partial<UnjucksWorldParameters>) {
    
    // Set default parameters
    this.parameters = {
      baseUrl: 'http://localhost:3000',
      timeout: 30000,
      testDataPath: './tests/fixtures',
      ...parameters
    };
    
    this.context = {
      workingDirectory: process.cwd(),
      tempDirectory: '',
      lastCommandOutput: '',
      lastCommandError: '',
      lastCommandCode: null,
      generatedFiles: [],
      templateVariables: {},
      fixtures: {},
    };
    
    // Initialize helper with a placeholder directory (will be updated in createTempDirectory)
    this.helper = new TestHelper('');
  }

  /**
   * Create a temporary directory for test isolation
   */
  async createTempDirectory(): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'unjucks-test-'));
    this.context.tempDirectory = tempDir;
    
    // Update helper with the new temp directory
    this.helper = new TestHelper(tempDir);
    
    return tempDir;
  }

  /**
   * Clean up temporary directory
   */
  async cleanupTempDirectory(): Promise<void> {
    if (this.context.tempDirectory && await fs.pathExists(this.context.tempDirectory)) {
      await fs.remove(this.context.tempDirectory);
      this.context.tempDirectory = '';
    }
  }

  /**
   * Setup temporary directory
   */
  async setupTempDir(): Promise<void> {
    this.tempDir = await this.createTempDirectory();
  }

  /**
   * Clear variables
   */
  clearVariables(): void {
    this.variables = {};
    this.context.templateVariables = {};
  }

  /**
   * Set a variable
   */
  setVariable(key: string, value: any): void {
    this.variables[key] = value;
    this.context.templateVariables[key] = value;
  }

  /**
   * Get a variable
   */
  getVariable(key: string): any {
    return this.variables[key] || this.context.templateVariables[key];
  }

  /**
   * Execute unjucks command with arguments
   */
  async executeUnjucksCommand(args: string[], cwd?: string): Promise<void> {
    const workingDir = cwd || this.context.tempDirectory || this.context.workingDirectory;
    const cliPath = path.resolve(process.cwd(), 'dist/cli.mjs');
    const command = `node "${cliPath}" ${args.join(' ')}`;
    
    console.log(`Executing unjucks command: ${command}`);
    
    try {
      // Create clean environment without NODE_ENV=test which interferes with CLI output
      const cleanEnv = { ...process.env };
      delete cleanEnv.NODE_ENV;
      
      const result = execSync(command, { 
        cwd: workingDir, 
        encoding: 'utf8',
        timeout: this.parameters.timeout || 30000,
        env: cleanEnv
      });
      
      this.context.lastCommandOutput = result.toString();
      this.context.lastCommandError = '';
      this.context.lastCommandCode = 0;
      
      console.log(`Unjucks command result: { exitCode: 0, stdout: '${this.context.lastCommandOutput}', stderr: '' }`);
    } catch (error: any) {
      this.context.lastCommandOutput = error.stdout ? error.stdout.toString() : '';
      this.context.lastCommandError = error.stderr ? error.stderr.toString() : error.message || '';
      this.context.lastCommandCode = error.status || 1;
      
      console.log(`Unjucks command error: { exitCode: ${this.context.lastCommandCode}, stdout: '${this.context.lastCommandOutput}', stderr: '${this.context.lastCommandError}' }`);
    }
  }

  /**
   * Execute shell command for setup/teardown
   */
  async executeShellCommand(command: string, cwd?: string): Promise<void> {
    const workingDir = cwd || this.context.tempDirectory || this.context.workingDirectory;
    
    try {
      const result = execSync(command, { 
        cwd: workingDir, 
        encoding: 'utf8',
        timeout: this.parameters.timeout 
      });
      
      this.context.lastCommandOutput = result.toString();
      this.context.lastCommandError = '';
      this.context.lastCommandCode = 0;
    } catch (error: any) {
      this.context.lastCommandOutput = error.stdout || '';
      this.context.lastCommandError = error.stderr || error.message || '';
      this.context.lastCommandCode = error.status || 1;
    }
  }

  /**
   * Copy fixture files to temp directory
   */
  async copyFixtures(fixtureName: string, targetDir?: string): Promise<void> {
    const fixturesPath = path.join(this.parameters.testDataPath, fixtureName);
    const targetPath = targetDir || this.context.tempDirectory;
    
    if (await fs.pathExists(fixturesPath)) {
      await fs.copy(fixturesPath, targetPath);
    } else {
      throw new Error(`Fixture not found: ${fixtureName}`);
    }
  }

  /**
   * Create a template file structure
   */
  async createTemplateStructure(templates: Record<string, string>): Promise<void> {
    const templatesDir = path.join(this.context.tempDirectory, '_templates');
    await fs.ensureDir(templatesDir);

    for (const [filePath, content] of Object.entries(templates)) {
      const fullPath = path.join(templatesDir, filePath);
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, content);
    }
  }

  /**
   * Read generated file content
   */
  async readGeneratedFile(filePath: string): Promise<string> {
    const fullPath = path.resolve(this.context.tempDirectory, filePath);
    
    if (await fs.pathExists(fullPath)) {
      return fs.readFile(fullPath, 'utf8');
    } else {
      throw new Error(`Generated file not found: ${filePath}`);
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    const fullPath = path.resolve(this.context.tempDirectory, filePath);
    return fs.pathExists(fullPath);
  }

  /**
   * Set template variables for testing
   */
  setTemplateVariables(variables: Record<string, any>): void {
    this.context.templateVariables = { ...this.context.templateVariables, ...variables };
  }

  /**
   * Get template variables
   */
  getTemplateVariables(): Record<string, any> {
    return this.context.templateVariables;
  }

  /**
   * Track generated files for cleanup
   */
  trackGeneratedFile(filePath: string): void {
    this.context.generatedFiles.push(filePath);
  }

  /**
   * Get last command output
   */
  getLastOutput(): string {
    return this.context.lastCommandOutput;
  }

  /**
   * Get last command error
   */
  getLastError(): string {
    return this.context.lastCommandError;
  }

  /**
   * Get last command exit code
   */
  getLastExitCode(): number | null {
    return this.context.lastCommandCode;
  }

  /**
   * Set last command result for compatibility with CommandResult interface
   */
  setCommandResult(result: CommandResult): void {
    this.context.lastCommandOutput = result.stdout;
    this.context.lastCommandError = result.stderr;
    this.context.lastCommandCode = result.exitCode;
    if (result.duration) {
      this.context.fixtures.commandDuration = result.duration;
    }
  }

  /**
   * Get last command result for compatibility with CommandResult interface
   */
  getCommandResult(): CommandResult {
    return {
      exitCode: this.context.lastCommandCode || 0,
      stdout: this.context.lastCommandOutput,
      stderr: this.context.lastCommandError,
      duration: this.context.fixtures.commandDuration as number
    };
  }

  /**
   * Get last command result in CLIResult format
   */
  getLastCommandResult(): CLIResult {
    return {
      exitCode: this.context.lastCommandCode || 0,
      stdout: this.context.lastCommandOutput,
      stderr: this.context.lastCommandError,
      duration: this.context.fixtures.commandDuration as number || 0
    };
  }

  /**
   * Set last command result from CLIResult
   */
  setLastCommandResult(result: CLIResult): void {
    this.context.lastCommandOutput = result.stdout;
    this.context.lastCommandError = result.stderr;
    this.context.lastCommandCode = result.exitCode;
    if (result.duration) {
      this.context.fixtures.commandDuration = result.duration;
    }
  }

  /**
   * Assert command succeeded
   */
  assertCommandSucceeded(): void {
    if (this.context.lastCommandCode !== 0) {
      throw new Error(
        `Command failed with exit code ${this.context.lastCommandCode}:\n` +
        `Error: ${this.context.lastCommandError}\n` +
        `Output: ${this.context.lastCommandOutput}`
      );
    }
  }

  /**
   * Assert command failed
   */
  assertCommandFailed(): void {
    if (this.context.lastCommandCode === 0) {
      throw new Error(
        `Expected command to fail, but it succeeded:\n` +
        `Output: ${this.context.lastCommandOutput}`
      );
    }
  }

  // =========================================================================
  // Enhanced methods combining both patterns
  // =========================================================================

  /**
   * Enhanced command result setter that combines both approaches
   */
  setEnhancedCommandResult(result: CLIResult): void {
    this.context.lastCommandResult = result;
    this.context.lastCommandOutput = result.stdout;
    this.context.lastCommandError = result.stderr;
    this.context.lastCommandCode = result.exitCode;
  }

  /**
   * Create directory (alias for helper method)
   */
  async createDirectory(relativePath: string): Promise<void> {
    await this.helper.createDirectory(relativePath);
  }

  /**
   * Write file (alias for helper method)
   */
  async writeFile(relativePath: string, content: string): Promise<void> {
    await this.helper.createFile(relativePath, content);
  }

  /**
   * Read file (alias for helper method)
   */
  async readFile(relativePath: string): Promise<string> {
    return await this.helper.readFile(relativePath);
  }

  /**
   * Change to temp directory (for compatibility)
   */
  async changeToTempDir(): Promise<void> {
    // Already working in temp directory
    process.chdir(this.context.tempDirectory);
  }

  /**
   * Run CLI command using helper
   */
  async runCli(command: string): Promise<CLIResult> {
    const result = await this.helper.runCli(command);
    this.setLastCommandResult(result);
    return result;
  }

  /**
   * List files in current directory
   */
  async listFiles(): Promise<string[]> {
    return await this.helper.listFiles();
  }

  /**
   * Helper method for nested property access in template variables
   */
  getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }
}

// Export aliases for backward compatibility
export { UnjucksWorld as CustomWorld };