import * as fs from 'fs-extra';
import * as path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export interface CLIResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

/**
 * TestHelper class for unified CLI command execution and file system operations
 */
export class TestHelper {
  private baseDir: string;
  private lastCommand: string = '';

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  /**
   * Get the temporary directory path
   */
  get tempDir(): string {
    return this.baseDir;
  }

  // =========================================================================
  // CLI Command Execution
  // =========================================================================

  /**
   * Execute unjucks CLI command
   */
  async runCli(command: string): Promise<CLIResult> {
    const startTime = Date.now();
    
    // Store the last command for potential re-use
    this.lastCommand = command;
    
    // Parse command - remove 'unjucks' prefix if present
    const cleanCommand = command.replace(/^unjucks\s*/, '').trim();
    const args = cleanCommand.split(' ').filter(arg => arg.length > 0);
    
    // Build the CLI command - assumes dist/cli.mjs exists
    const cliPath = path.join(process.cwd(), 'dist/cli.mjs');
    const fullCommand = `node "${cliPath}" ${args.join(' ')}`;
    
    try {
      const result = await execAsync(fullCommand, {
        cwd: this.baseDir,
        timeout: 30_000,
        maxBuffer: 1024 * 1024,
        encoding: 'utf8'
      });

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: 0,
        duration: Date.now() - startTime
      };
    } catch (error: any) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || error.message || '',
        exitCode: error.code || 1,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Execute any shell command
   */
  async executeCommand(command: string, options?: { cwd?: string; timeout?: number }): Promise<CLIResult> {
    const startTime = Date.now();
    const workingDir = options?.cwd || this.baseDir;
    const timeout = options?.timeout || 30_000;

    try {
      const result = await execAsync(command, {
        cwd: workingDir,
        timeout,
        maxBuffer: 1024 * 1024,
        encoding: 'utf8'
      });

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: 0,
        duration: Date.now() - startTime
      };
    } catch (error: any) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || error.message || '',
        exitCode: error.code || 1,
        duration: Date.now() - startTime
      };
    }
  }

  // =========================================================================
  // File System Operations
  // =========================================================================

  /**
   * Create a directory
   */
  async createDirectory(relativePath: string): Promise<void> {
    const fullPath = path.join(this.baseDir, relativePath);
    await fs.ensureDir(fullPath);
  }

  /**
   * Create a file with content
   */
  async createFile(relativePath: string, content: string): Promise<void> {
    const fullPath = path.join(this.baseDir, relativePath);
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, content, 'utf8');
  }

  /**
   * Read file content
   */
  async readFile(relativePath: string): Promise<string> {
    const fullPath = path.join(this.baseDir, relativePath);
    return await fs.readFile(fullPath, 'utf8');
  }

  /**
   * Check if file exists
   */
  async fileExists(relativePath: string): Promise<boolean> {
    try {
      const fullPath = path.join(this.baseDir, relativePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if directory exists
   */
  async directoryExists(relativePath: string): Promise<boolean> {
    try {
      const fullPath = path.join(this.baseDir, relativePath);
      const stats = await fs.stat(fullPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Remove file
   */
  async removeFile(relativePath: string): Promise<void> {
    const fullPath = path.join(this.baseDir, relativePath);
    await fs.remove(fullPath);
  }

  /**
   * Remove directory
   */
  async removeDirectory(relativePath: string): Promise<void> {
    const fullPath = path.join(this.baseDir, relativePath);
    await fs.remove(fullPath);
  }

  /**
   * List files in directory
   */
  async listFiles(relativePath: string = '', recursive: boolean = true): Promise<string[]> {
    const fullPath = path.join(this.baseDir, relativePath);
    const files: string[] = [];
    
    async function walk(currentPath: string, currentRelative: string = ''): Promise<void> {
      try {
        const entries = await fs.readdir(currentPath);
        
        for (const entry of entries) {
          const fullEntryPath = path.join(currentPath, entry);
          const relativeEntryPath = currentRelative ? path.join(currentRelative, entry) : entry;
          const stats = await fs.stat(fullEntryPath);
          
          if (stats.isDirectory()) {
            if (recursive) {
              await walk(fullEntryPath, relativeEntryPath);
            }
          } else {
            files.push(relativeEntryPath);
          }
        }
      } catch {
        // Ignore errors for directories that don't exist or can't be read
      }
    }
    
    await walk(fullPath, relativePath);
    return files.sort();
  }

  /**
   * Get full path for a relative path
   */
  getFullPath(relativePath: string): string {
    return path.join(this.baseDir, relativePath);
  }

  /**
   * Change to temp directory
   */
  async changeToTempDir(): Promise<void> {
    process.chdir(this.baseDir);
  }

  // =========================================================================
  // Template Management
  // =========================================================================

  /**
   * Create template structure for testing
   */
  async createTemplateStructure(templates: Record<string, string>): Promise<void> {
    const templatesDir = path.join(this.baseDir, '_templates');
    await fs.ensureDir(templatesDir);

    for (const [filePath, content] of Object.entries(templates)) {
      const fullPath = path.join(templatesDir, filePath);
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, content, 'utf8');
    }
  }

  /**
   * Create structured template files from array format
   */
  async createStructuredTemplates(structure: Array<{
    type: 'file' | 'directory';
    path: string;
    content?: string;
    frontmatter?: string;
  }>): Promise<void> {
    const templatesPath = path.join(this.baseDir, '_templates');
    await fs.ensureDir(templatesPath);

    for (const item of structure) {
      const fullPath = path.join(templatesPath, item.path);
      
      if (item.type === 'directory') {
        await fs.ensureDir(fullPath);
      } else if (item.type === 'file') {
        await fs.ensureDir(path.dirname(fullPath));
        
        let content = item.content || '';
        if (item.frontmatter) {
          content = `---\n${item.frontmatter}\n---\n${content}`;
        }
        
        await fs.writeFile(fullPath, content, 'utf8');
      }
    }
  }

  // =========================================================================
  // Assertion Helpers
  // =========================================================================

  /**
   * Verify file exists and throw descriptive error if not
   */
  async verifyFileExists(relativePath: string): Promise<void> {
    const fullPath = this.getFullPath(relativePath);
    if (!await this.fileExists(relativePath)) {
      throw new Error(`File ${relativePath} does not exist at ${fullPath}`);
    }
  }

  /**
   * Verify file contains expected content
   */
  async verifyFileContent(relativePath: string, expectedContent: string): Promise<void> {
    await this.verifyFileExists(relativePath);
    const actualContent = await this.readFile(relativePath);
    
    if (!actualContent.includes(expectedContent)) {
      throw new Error(
        `File ${relativePath} does not contain expected content.\n` +
        `Expected: ${expectedContent}\n` +
        `Actual content: ${actualContent}`
      );
    }
  }

  /**
   * Verify directory exists
   */
  async verifyDirectoryExists(relativePath: string): Promise<void> {
    const fullPath = this.getFullPath(relativePath);
    if (!await this.directoryExists(relativePath)) {
      throw new Error(`Directory ${relativePath} does not exist at ${fullPath}`);
    }
  }

  // =========================================================================
  // Cleanup Utilities
  // =========================================================================

  /**
   * Clean up the test directory
   */
  async cleanup(): Promise<void> {
    try {
      if (this.baseDir && await fs.pathExists(this.baseDir)) {
        await fs.remove(this.baseDir);
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Empty the test directory without removing it
   */
  async emptyDirectory(): Promise<void> {
    try {
      if (this.baseDir && await fs.pathExists(this.baseDir)) {
        await fs.emptyDir(this.baseDir);
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Get file stats
   */
  async getFileStats(relativePath: string): Promise<fs.Stats> {
    const fullPath = this.getFullPath(relativePath);
    return await fs.stat(fullPath);
  }

  /**
   * Copy fixture files to test directory
   */
  async copyFixtures(sourcePath: string, targetRelativePath: string = ''): Promise<void> {
    const targetPath = targetRelativePath ? 
      path.join(this.baseDir, targetRelativePath) : 
      this.baseDir;
      
    await fs.copy(sourcePath, targetPath);
  }

  /**
   * Get the last executed command
   */
  getLastCommand(): string {
    return this.lastCommand;
  }

  /**
   * Reset the last command
   */
  resetLastCommand(): void {
    this.lastCommand = '';
  }
}