import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';

const execAsync = promisify(exec);

export interface CLIResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

export interface TestContext {
  testDir: string;
  templatesPath?: string;
  lastCommand?: string;
  lastResult?: CLIResult;
  [key: string]: any;
}

const testContext: Map<any, TestContext> = new Map();

export function getTestContext(worldInstance: any, key?: string): any {
  const context = testContext.get(worldInstance);
  if (!context) {
    throw new Error('Test context not initialized');
  }
  return key ? context[key] : context;
}

export function setTestContext(worldInstance: any, key: string, value: any): void {
  let context = testContext.get(worldInstance);
  if (!context) {
    context = { testDir: '' };
    testContext.set(worldInstance, context);
  }
  context[key] = value;
}

export async function cleanTestDirectory(): Promise<string> {
  const testDir = path.join(tmpdir(), `unjucks-test-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`);
  await fs.mkdir(testDir, { recursive: true });
  return testDir;
}

export async function createTemplateStructure(templatesPath: string, structure: any[]): Promise<void> {
  for (const item of structure) {
    const fullPath = path.join(templatesPath, item.path);
    
    if (item.type === 'directory') {
      await fs.mkdir(fullPath, { recursive: true });
    } else if (item.type === 'file') {
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      
      let content = item.content || '';
      if (item.frontmatter) {
        content = `---\n${item.frontmatter}\n---\n${content}`;
      }
      
      await fs.writeFile(fullPath, content);
    }
  }
}

export async function executeCommand(command: string, options: { cwd: string }): Promise<CLIResult> {
  const startTime = Date.now();
  
  try {
    const result = await execAsync(command, {
      cwd: options.cwd,
      timeout: 30_000,
      maxBuffer: 1024 * 1024 // 1MB buffer
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

export async function verifyFileExists(filePath: string): Promise<void> {
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(`File ${filePath} does not exist`);
  }
}

export async function verifyFileContent(filePath: string, expectedContent: string): Promise<void> {
  try {
    const actualContent = await fs.readFile(filePath, 'utf8');
    
    if (!actualContent.includes(expectedContent)) {
      throw new Error(
        `File ${filePath} does not contain expected content.\n` +
        `Expected: ${expectedContent}\n` +
        `Actual: ${actualContent}`
      );
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`File ${filePath} does not exist`);
    }
    throw error;
  }
}

export async function verifyDirectoryExists(dirPath: string): Promise<void> {
  try {
    const stats = await fs.stat(dirPath);
    if (!stats.isDirectory()) {
      throw new Error(`${dirPath} is not a directory`);
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`Directory ${dirPath} does not exist`);
    }
    throw error;
  }
}

export async function getFileStats(filePath: string): Promise<any> {
  try {
    return await fs.stat(filePath);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`File ${filePath} does not exist`);
    }
    throw error;
  }
}

export async function listFiles(dirPath: string, recursive: boolean = false): Promise<string[]> {
  const files: string[] = [];
  
  async function walk(currentPath: string, relativePath: string = ''): Promise<void> {
    const entries = await fs.readdir(currentPath);
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry);
      const relativeEntryPath = relativePath ? path.join(relativePath, entry) : entry;
      const stats = await fs.stat(fullPath);
      
      if (stats.isDirectory()) {
        if (recursive) {
          await walk(fullPath, relativeEntryPath);
        }
      } else {
        files.push(relativeEntryPath);
      }
    }
  }
  
  await walk(dirPath);
  return files.sort();
}

export async function cleanupTestDirectory(testDir: string): Promise<void> {
  try {
    await fs.rm(testDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

export class FileSystemHelper {
  constructor(private baseDir: string) {}
  
  async createFile(relativePath: string, content: string): Promise<void> {
    const fullPath = path.join(this.baseDir, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content);
  }
  
  async createDirectory(relativePath: string): Promise<void> {
    const fullPath = path.join(this.baseDir, relativePath);
    await fs.mkdir(fullPath, { recursive: true });
  }
  
  async readFile(relativePath: string): Promise<string> {
    const fullPath = path.join(this.baseDir, relativePath);
    return await fs.readFile(fullPath, 'utf8');
  }
  
  async fileExists(relativePath: string): Promise<boolean> {
    try {
      const fullPath = path.join(this.baseDir, relativePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
  
  async directoryExists(relativePath: string): Promise<boolean> {
    try {
      const fullPath = path.join(this.baseDir, relativePath);
      const stats = await fs.stat(fullPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }
  
  async removeFile(relativePath: string): Promise<void> {
    const fullPath = path.join(this.baseDir, relativePath);
    await fs.unlink(fullPath);
  }
  
  async removeDirectory(relativePath: string): Promise<void> {
    const fullPath = path.join(this.baseDir, relativePath);
    await fs.rm(fullPath, { recursive: true });
  }
  
  async listFiles(relativePath: string = ''): Promise<string[]> {
    const fullPath = path.join(this.baseDir, relativePath);
    return await listFiles(fullPath, true);
  }
  
  getFullPath(relativePath: string): string {
    return path.join(this.baseDir, relativePath);
  }
}