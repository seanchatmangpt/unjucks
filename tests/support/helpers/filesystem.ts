import * as fs from 'fs-extra';
import * as path from 'node:path';
import * as os from 'node:os';
import { randomBytes } from 'node:crypto';

export interface FileSystemState {
  baseDir: string;
  files: Map<string, string>;
  directories: Set<string>;
  permissions: Map<string, string>;
}

export interface FileTestCase {
  name: string;
  setup: { path: string; content: string; permissions?: string }[];
  operation: () => Promise<void>;
  expected: { path: string; content?: string; shouldExist: boolean }[];
  cleanup?: () => Promise<void>;
}

export class FileSystemTestHelper {
  private states: Map<string, FileSystemState> = new Map();
  private tempDirs: string[] = [];

  /**
   * Create an isolated temporary directory for testing
   */
  async createTempDirectory(prefix: string = 'unjucks-test-'): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
    this.tempDirs.push(tempDir);
    
    // Initialize state tracking
    this.states.set(tempDir, {
      baseDir: tempDir,
      files: new Map(),
      directories: new Set(),
      permissions: new Map()
    });
    
    return tempDir;
  }

  /**
   * Clean up all temporary directories
   */
  async cleanup(): Promise<void> {
    for (const tempDir of this.tempDirs) {
      try {
        await fs.remove(tempDir);
      } catch (error) {
        console.warn(`Failed to remove temp dir ${tempDir}:`, error);
      }
    }
    this.tempDirs = [];
    this.states.clear();
  }

  /**
   * Capture the current state of a directory
   */
  async captureState(baseDir: string): Promise<FileSystemState> {
    const state: FileSystemState = {
      baseDir,
      files: new Map(),
      directories: new Set(),
      permissions: new Map()
    };

    const scanDirectory = async (dir: string) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(baseDir, fullPath);
          
          if (entry.isDirectory()) {
            state.directories.add(relativePath);
            await scanDirectory(fullPath);
          } else if (entry.isFile()) {
            const content = await fs.readFile(fullPath, 'utf-8');
            state.files.set(relativePath, content);
            
            // Capture permissions on Unix-like systems
            if (process.platform !== 'win32') {
              try {
                const stats = await fs.stat(fullPath);
                const perms = (stats.mode & parseInt('777', 8)).toString(8);
                state.permissions.set(relativePath, perms);
              } catch {
                // Ignore permission errors
              }
            }
          }
        }
      } catch (error) {
        // Directory might not exist or be accessible
      }
    };

    await scanDirectory(baseDir);
    this.states.set(baseDir, state);
    return state;
  }

  /**
   * Compare two filesystem states and return differences
   */
  compareStates(
    before: FileSystemState,
    after: FileSystemState
  ): {
    addedFiles: string[];
    removedFiles: string[];
    modifiedFiles: string[];
    addedDirectories: string[];
    removedDirectories: string[];
    permissionChanges: { path: string; before: string; after: string }[];
  } {
    const addedFiles: string[] = [];
    const removedFiles: string[] = [];
    const modifiedFiles: string[] = [];
    const addedDirectories: string[] = [];
    const removedDirectories: string[] = [];
    const permissionChanges: { path: string; before: string; after: string }[] = [];

    // Compare files
    for (const [path, content] of after.files) {
      if (!before.files.has(path)) {
        addedFiles.push(path);
      } else if (before.files.get(path) !== content) {
        modifiedFiles.push(path);
      }
    }

    for (const path of before.files.keys()) {
      if (!after.files.has(path)) {
        removedFiles.push(path);
      }
    }

    // Compare directories
    for (const dir of after.directories) {
      if (!before.directories.has(dir)) {
        addedDirectories.push(dir);
      }
    }

    for (const dir of before.directories) {
      if (!after.directories.has(dir)) {
        removedDirectories.push(dir);
      }
    }

    // Compare permissions
    for (const [path, afterPerms] of after.permissions) {
      const beforePerms = before.permissions.get(path);
      if (beforePerms && beforePerms !== afterPerms) {
        permissionChanges.push({ path, before: beforePerms, after: afterPerms });
      }
    }

    return {
      addedFiles,
      removedFiles,
      modifiedFiles,
      addedDirectories,
      removedDirectories,
      permissionChanges
    };
  }

  /**
   * Set up a file system scenario for testing
   */
  async setupScenario(
    baseDir: string,
    files: { path: string; content: string; permissions?: string }[]
  ): Promise<void> {
    for (const file of files) {
      const fullPath = path.join(baseDir, file.path);
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, file.content, 'utf-8');
      
      if (file.permissions && process.platform !== 'win32') {
        await fs.chmod(fullPath, file.permissions);
      }
    }
  }

  /**
   * Validate file system expectations
   */
  async validateExpectations(
    baseDir: string,
    expectations: { path: string; content?: string; shouldExist: boolean }[]
  ): Promise<{ passed: boolean; errors: string[] }> {
    const errors: string[] = [];

    for (const expectation of expectations) {
      const fullPath = path.join(baseDir, expectation.path);
      const exists = await fs.pathExists(fullPath);

      if (expectation.shouldExist && !exists) {
        errors.push(`Expected file '${expectation.path}' to exist, but it doesn't`);
        continue;
      }

      if (!expectation.shouldExist && exists) {
        errors.push(`Expected file '${expectation.path}' not to exist, but it does`);
        continue;
      }

      if (exists && expectation.content !== undefined) {
        try {
          const actualContent = await fs.readFile(fullPath, 'utf-8');
          if (actualContent !== expectation.content) {
            errors.push(
              `File '${expectation.path}' content mismatch.\n` +
              `Expected: ${JSON.stringify(expectation.content)}\n` +
              `Actual: ${JSON.stringify(actualContent)}`
            );
          }
        } catch (error) {
          errors.push(`Failed to read file '${expectation.path}': ${error}`);
        }
      }
    }

    return {
      passed: errors.length === 0,
      errors
    };
  }

  /**
   * Run a complete file system test case
   */
  async runTestCase(testCase: FileTestCase): Promise<{
    passed: boolean;
    errors: string[];
    state: {
      before: FileSystemState;
      after: FileSystemState;
      changes: ReturnType<typeof this.compareStates>;
    };
  }> {
    const tempDir = await this.createTempDirectory(`test-${testCase.name}-`);

    try {
      // Setup
      await this.setupScenario(tempDir, testCase.setup);
      const beforeState = await this.captureState(tempDir);

      // Execute operation
      await testCase.operation();

      // Capture state after operation
      const afterState = await this.captureState(tempDir);
      const changes = this.compareStates(beforeState, afterState);

      // Validate expectations
      const validation = await this.validateExpectations(tempDir, testCase.expected);

      // Cleanup if provided
      if (testCase.cleanup) {
        await testCase.cleanup();
      }

      return {
        passed: validation.passed,
        errors: validation.errors,
        state: {
          before: beforeState,
          after: afterState,
          changes
        }
      };
    } catch (error) {
      return {
        passed: false,
        errors: [`Test case execution failed: ${error}`],
        state: {
          before: { baseDir: tempDir, files: new Map(), directories: new Set(), permissions: new Map() },
          after: { baseDir: tempDir, files: new Map(), directories: new Set(), permissions: new Map() },
          changes: {
            addedFiles: [],
            removedFiles: [],
            modifiedFiles: [],
            addedDirectories: [],
            removedDirectories: [],
            permissionChanges: []
          }
        }
      };
    }
  }

  /**
   * Create standard test scenarios for file operations
   */
  static createStandardScenarios(): FileTestCase[] {
    return [
      {
        name: 'Create new file',
        setup: [],
        operation: async () => {
          // This would be implemented by the actual test
        },
        expected: [
          { path: 'newfile.txt', content: 'Hello World', shouldExist: true }
        ]
      },
      {
        name: 'Overwrite existing file',
        setup: [
          { path: 'existing.txt', content: 'Original content' }
        ],
        operation: async () => {
          // This would be implemented by the actual test
        },
        expected: [
          { path: 'existing.txt', content: 'New content', shouldExist: true }
        ]
      },
      {
        name: 'Create nested directories',
        setup: [],
        operation: async () => {
          // This would be implemented by the actual test
        },
        expected: [
          { path: 'deep/nested/directory/file.txt', content: 'Content', shouldExist: true }
        ]
      },
      {
        name: 'Preserve file permissions',
        setup: [
          { path: 'script.sh', content: '#!/bin/bash\necho "Hello"', permissions: '755' }
        ],
        operation: async () => {
          // This would be implemented by the actual test
        },
        expected: [
          { path: 'script.sh', shouldExist: true }
        ]
      }
    ];
  }

  /**
   * Generate large file for performance testing
   */
  async createLargeFile(baseDir: string, fileName: string, sizeInMB: number): Promise<string> {
    const filePath = path.join(baseDir, fileName);
    const chunkSize = 1024 * 1024; // 1MB chunks
    const chunk = randomBytes(chunkSize);
    
    const writeStream = fs.createWriteStream(filePath);
    
    for (let i = 0; i < sizeInMB; i++) {
      writeStream.write(chunk);
    }
    
    writeStream.end();
    
    return new Promise((resolve, reject) => {
      writeStream.on('finish', () => resolve(filePath));
      writeStream.on('error', reject);
    });
  }

  /**
   * Simulate concurrent file operations
   */
  async simulateConcurrentOperations(
    baseDir: string,
    operationCount: number = 10
  ): Promise<{ successful: number; failed: number; errors: Error[] }> {
    const operations: Promise<void>[] = [];
    const errors: Error[] = [];
    let successful = 0;
    let failed = 0;

    for (let i = 0; i < operationCount; i++) {
      const operation = async () => {
        try {
          const fileName = `concurrent-${i}.txt`;
          const content = `Content for file ${i} - ${Date.now()}`;
          await fs.writeFile(path.join(baseDir, fileName), content);
          successful++;
        } catch (error) {
          errors.push(error as Error);
          failed++;
        }
      };
      
      operations.push(operation());
    }

    await Promise.all(operations);

    return { successful, failed, errors };
  }

  /**
   * Create symbolic links for testing
   */
  async createSymbolicLinks(
    baseDir: string,
    links: { source: string; target: string }[]
  ): Promise<void> {
    if (process.platform === 'win32') {
      // Skip on Windows due to permission requirements
      return;
    }

    for (const link of links) {
      const sourcePath = path.join(baseDir, link.source);
      const targetPath = path.join(baseDir, link.target);
      
      // Ensure source exists
      await fs.ensureFile(sourcePath);
      await fs.writeFile(sourcePath, 'Source file content');
      
      // Create symbolic link
      try {
        await fs.symlink(sourcePath, targetPath);
      } catch (error) {
        console.warn(`Failed to create symbolic link ${targetPath}:`, error);
      }
    }
  }

  /**
   * Test edge cases with special file names
   */
  static getSpecialFileNameCases(): { name: string; fileName: string; shouldSucceed: boolean }[] {
    return [
      { name: 'Empty filename', fileName: '', shouldSucceed: false },
      { name: 'Dot filename', fileName: '.', shouldSucceed: false },
      { name: 'Double dot filename', fileName: '..', shouldSucceed: false },
      { name: 'Hidden file', fileName: '.hidden', shouldSucceed: true },
      { name: 'File with spaces', fileName: 'file with spaces.txt', shouldSucceed: true },
      { name: 'File with unicode', fileName: 'café-résumé.txt', shouldSucceed: true },
      { name: 'File with emoji', fileName: 'file-😀.txt', shouldSucceed: true },
      { name: 'Very long filename', fileName: 'a'.repeat(255), shouldSucceed: true },
      { name: 'Extremely long filename', fileName: 'a'.repeat(1000), shouldSucceed: false },
      { name: 'File with special chars', fileName: 'file!@#$%^&*().txt', shouldSucceed: true },
      { name: 'File with quotes', fileName: 'file"with\'quotes.txt', shouldSucceed: true },
      { name: 'File with backslashes', fileName: 'file\\with\\backslashes.txt', shouldSucceed: true }
    ];
  }
}