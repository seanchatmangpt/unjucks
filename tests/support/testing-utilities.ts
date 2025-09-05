import * as assert from 'assert';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/**
 * Utility functions for testing unjucks functionality
 */

export interface AssertionOptions {
  timeout?: number;
  retries?: number;
  interval?: number;
}

/**
 * Enhanced file assertion utilities
 */
export class FileAssertions {
  constructor(private baseDir: string) {}

  async assertFileExists(filePath: string, options?: AssertionOptions): Promise<void> {
    const fullPath = path.join(this.baseDir, filePath);
    const { timeout = 5000, retries = 3, interval = 100 } = options || {};
    
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        await fs.access(fullPath);
        return; // File exists
      } catch (error: any) {
        lastError = error;
        if (attempt < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, interval));
        }
      }
    }
    
    throw new Error(`File ${filePath} does not exist after ${retries} attempts. Last error: ${lastError?.message}`);
  }

  async assertFileNotExists(filePath: string): Promise<void> {
    const fullPath = path.join(this.baseDir, filePath);
    
    try {
      await fs.access(fullPath);
      throw new Error(`File ${filePath} should not exist but it does`);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      // File doesn't exist - this is what we want
    }
  }

  async assertFileContent(filePath: string, expectedContent: string, options?: { partial?: boolean }): Promise<void> {
    const fullPath = path.join(this.baseDir, filePath);
    
    try {
      const actualContent = await fs.readFile(fullPath, 'utf8');
      
      if (options?.partial) {
        assert.ok(actualContent.includes(expectedContent), `Expected file content to contain: ${expectedContent}`);
      } else {
        assert.strictEqual(actualContent.trim(), expectedContent.trim(), 'File content should match expected content');
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Cannot verify content of ${filePath} - file does not exist`);
      }
      throw error;
    }
  }

  async assertFileMatches(filePath: string, pattern: RegExp): Promise<void> {
    const fullPath = path.join(this.baseDir, filePath);
    
    try {
      const content = await fs.readFile(fullPath, 'utf8');
      assert.ok(pattern.test(content), `Expected file content to match pattern: ${pattern}`);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Cannot verify pattern match for ${filePath} - file does not exist`);
      }
      throw error;
    }
  }

  async assertFileSize(filePath: string, expectedSize: number, tolerance: number = 0): Promise<void> {
    const fullPath = path.join(this.baseDir, filePath);
    
    try {
      const stats = await fs.stat(fullPath);
      const actualSize = stats.size;
      
      if (tolerance === 0) {
        assert.strictEqual(actualSize, expectedSize, `Expected file size to be ${expectedSize}, got ${actualSize}`);
      } else {
        assert.ok(actualSize >= expectedSize - tolerance, `Expected file size to be >= ${expectedSize - tolerance}, got ${actualSize}`);
        assert.ok(actualSize <= expectedSize + tolerance, `Expected file size to be <= ${expectedSize + tolerance}, got ${actualSize}`);
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Cannot verify size of ${filePath} - file does not exist`);
      }
      throw error;
    }
  }

  async assertDirectoryExists(dirPath: string): Promise<void> {
    const fullPath = path.join(this.baseDir, dirPath);
    
    try {
      const stats = await fs.stat(fullPath);
      assert.ok(stats.isDirectory(), `Expected ${dirPath} to be a directory`);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Directory ${dirPath} does not exist`);
      }
      throw error;
    }
  }

  async assertDirectoryContains(dirPath: string, expectedFiles: string[]): Promise<void> {
    const fullPath = path.join(this.baseDir, dirPath);
    
    try {
      const entries = await fs.readdir(fullPath);
      
      for (const expectedFile of expectedFiles) {
        assert.ok(entries.includes(expectedFile), `Expected directory ${dirPath} to contain file: ${expectedFile}`);
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Cannot verify contents of ${dirPath} - directory does not exist`);
      }
      throw error;
    }
  }
}

/**
 * CLI output assertion utilities
 */
export class OutputAssertions {
  constructor(private output: { stdout: string; stderr: string; exitCode: number }) {}

  assertSuccess(): this {
    assert.strictEqual(this.output.exitCode, 0, `Expected exit code 0, got ${this.output.exitCode}`);
    return this;
  }

  assertFailure(): this {
    assert.notStrictEqual(this.output.exitCode, 0, 'Expected command to fail (non-zero exit code)');
    return this;
  }

  assertExitCode(expectedCode: number): this {
    assert.strictEqual(this.output.exitCode, expectedCode, `Expected exit code ${expectedCode}, got ${this.output.exitCode}`);
    return this;
  }

  assertStdoutContains(...expectedStrings: string[]): this {
    for (const str of expectedStrings) {
      assert.ok(this.output.stdout.includes(str), `Expected stdout to contain: ${str}`);
    }
    return this;
  }

  assertStdoutMatches(pattern: RegExp): this {
    assert.ok(pattern.test(this.output.stdout), `Expected stdout to match pattern: ${pattern}`);
    return this;
  }

  assertStderrContains(...expectedStrings: string[]): this {
    for (const str of expectedStrings) {
      assert.ok(this.output.stderr.includes(str), `Expected stderr to contain: ${str}`);
    }
    return this;
  }

  assertStderrEmpty(): this {
    assert.strictEqual(this.output.stderr.trim(), '', 'Expected stderr to be empty');
    return this;
  }

  assertOutputLines(expectedLineCount: number, stream: 'stdout' | 'stderr' = 'stdout'): this {
    const lines = this.output[stream].split('\n').filter(line => line.trim() !== '');
    assert.strictEqual(lines.length, expectedLineCount, `Expected ${expectedLineCount} lines in ${stream}, got ${lines.length}`);
    return this;
  }
}

/**
 * Template testing utilities
 */
export const TemplateTestUtils = {
  createSimpleTemplate(content: string, frontmatter?: any): string {
    if (!frontmatter) {
      return content;
    }
    
    const yamlFrontmatter = Object.entries(frontmatter)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join('\n');
      
    return `---\n${yamlFrontmatter}\n---\n${content}`;
  },

  createComplexTemplate(options: {
    to?: string;
    inject?: boolean;
    after?: string;
    before?: string;
    lineAt?: number;
    append?: boolean;
    prepend?: boolean;
    skipIf?: string;
    variables?: { [key: string]: any };
    content: string;
  }): string {
    const { content, ...frontmatter } = options;
    return this.createSimpleTemplate(content, frontmatter);
  },

  extractVariablesFromTemplate(template: string): string[] {
    // Simple regex to find EJS variables - could be enhanced
    const variableRegex = /<%=\s*(\w+)(?:\s*\|\s*\w+)*\s*%>/g;
    const conditionalRegex = /<%\s*if\s*\(\s*(\w+)\s*\)/g;
    const loopRegex = /<%\s*\w+\.forEach\s*\(\s*(\w+)\s*=>/g;
    
    const variables = new Set<string>();
    
    let match;
    while ((match = variableRegex.exec(template)) !== null) {
      if (match[1] && match[1]) variables.add(match[1]);
    }
    
    while ((match = conditionalRegex.exec(template)) !== null) {
      if (match[1] && match[1]) variables.add(match[1]);
    }
    
    // Reset regex lastIndex
    variableRegex.lastIndex = 0;
    conditionalRegex.lastIndex = 0;
    loopRegex.lastIndex = 0;
    
    return [...variables];
  },

  validateFrontmatter(template: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!template.startsWith('---\n')) {
      return { isValid: true, errors: [] }; // No frontmatter is valid
    }
    
    const frontmatterEndIndex = template.indexOf('\n---\n', 4);
    if (frontmatterEndIndex === -1) {
      errors.push('Frontmatter is not properly closed with ---');
    }
    
    const frontmatterSection = template.substring(4, frontmatterEndIndex);
    
    // Basic YAML validation
    const lines = frontmatterSection.split('\n');
    for (const [index, line] of lines.entries()) {
      const trimmedLine = line.trim();
      if (trimmedLine === '') continue;
      
      if (!trimmedLine.includes(':') && !trimmedLine.startsWith('-')) {
        errors.push(`Line ${index + 1} in frontmatter is not valid YAML`);
      }
    }
    
    return { isValid: errors.length === 0, errors };
  },
};

/**
 * Data generation utilities for testing
 */
export const TestDataGenerator = {
  randomString(length: number = 8, charset: string = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'): string {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return result;
  },

  randomEmail(): string {
    return `${this.randomString(5)}@${this.randomString(5)}.com`;
  },

  randomUrl(): string {
    return `https://${this.randomString(8)}.com`;
  },

  randomPort(): number {
    return Math.floor(Math.random() * (65_535 - 1024)) + 1024;
  },

  randomBoolean(): boolean {
    return Math.random() < 0.5;
  },

  randomChoice<T>(choices: T[]): T {
    if (choices.length === 0) {
      throw new Error('Cannot choose from empty array');
    }
    return choices[Math.floor(Math.random() * choices.length)]!;
  },

  generateComponentName(): string {
    const adjectives = ['Smart', 'Quick', 'Dynamic', 'Flexible', 'Modern', 'Advanced'];
    const nouns = ['Button', 'Card', 'Form', 'List', 'Modal', 'Panel', 'Widget'];
    
    return `${this.randomChoice(adjectives)}${this.randomChoice(nouns)}`;
  },

  generateServiceName(): string {
    const domains = ['User', 'Auth', 'Payment', 'Email', 'File', 'Cache', 'Logger'];
    return `${this.randomChoice(domains)}Service`;
  },

  generateModelName(): string {
    const entities = ['User', 'Product', 'Order', 'Category', 'Comment', 'Article', 'Tag'];
    return this.randomChoice(entities);
  },
};

/**
 * Retry utility for flaky operations
 */
export const RetryHelper = {
  async retry<T>(
    operation: () => Promise<T>,
    options: {
      maxAttempts?: number;
      delay?: number;
      backoff?: boolean;
      condition?: (error: Error) => boolean;
    } = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      delay = 100,
      backoff = false,
      condition = () => true
    } = options;

    let lastError: Error;
    let currentDelay = delay;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        if (attempt === maxAttempts || !condition(error)) {
          throw error;
        }

        await new Promise(resolve => setTimeout(resolve, currentDelay));
        
        if (backoff) {
          currentDelay *= 2;
        }
      }
    }

    throw lastError!;
  },
};

/**
 * Performance testing utilities
 */
export const PerformanceHelper = {
  async measureOperation<T>(operation: () => Promise<T>): Promise<{ result: T; duration: number; memoryUsage: NodeJS.MemoryUsage }> {
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage();

    const result = await operation();

    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage();

    const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
    const memoryUsage = {
      rss: endMemory.rss - startMemory.rss,
      heapTotal: endMemory.heapTotal - startMemory.heapTotal,
      heapUsed: endMemory.heapUsed - startMemory.heapUsed,
      external: endMemory.external - startMemory.external,
      arrayBuffers: endMemory.arrayBuffers - startMemory.arrayBuffers,
    };

    return { result, duration, memoryUsage };
  },

  assertPerformance(measurement: { duration: number; memoryUsage: NodeJS.MemoryUsage }, constraints: {
    maxDuration?: number;
    maxMemoryIncrease?: number;
  }): void {
    if (constraints.maxDuration && measurement.duration > constraints.maxDuration) {
      throw new Error(`Operation took ${measurement.duration}ms, expected < ${constraints.maxDuration}ms`);
    }

    if (constraints.maxMemoryIncrease && measurement.memoryUsage.heapUsed > constraints.maxMemoryIncrease) {
      throw new Error(`Memory usage increased by ${measurement.memoryUsage.heapUsed} bytes, expected < ${constraints.maxMemoryIncrease} bytes`);
    }
  },
};

/**
 * Snapshot testing utilities
 */
export const SnapshotHelper = {
  normalizeOutput(output: string): string {
    return output
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\\/g, '/') // Normalize path separators
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, 'TIMESTAMP') // Normalize timestamps
      .replace(/temp-\w+/g, 'temp-RANDOM') // Normalize temp directory names
      .replace(/test-\w+/g, 'test-RANDOM') // Normalize test directory names
      .trim();
  },

  normalizeFilePaths(content: string): string {
    return content
      .replace(/\/Users\/[^\/]+/g, '/Users/USER') // Normalize user home directories
      .replace(/C:\\Users\\[^\\]+/g, String.raw`C:\Users\USER`) // Normalize Windows user directories
      .replace(/\/tmp\/[^\/]+/g, '/tmp/TEMP') // Normalize temp directories
      .replace(/\\tmp\\[^\\]+/g, String.raw`\tmp\TEMP`); // Normalize Windows temp directories
  },
};

/**
 * Fixture management utilities
 */
export class FixtureManager {
  constructor(private fixturesPath: string) {}

  async loadFixture<T = any>(name: string): Promise<T> {
    const fixturePath = path.join(this.fixturesPath, `${name}.json`);
    
    try {
      const content = await fs.readFile(fixturePath, 'utf8');
      return JSON.parse(content);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Fixture ${name} not found at ${fixturePath}`);
      }
      throw error;
    }
  }

  async saveFixture(name: string, data: any): Promise<void> {
    const fixturePath = path.join(this.fixturesPath, `${name}.json`);
    await fs.mkdir(path.dirname(fixturePath), { recursive: true });
    await fs.writeFile(fixturePath, JSON.stringify(data, null, 2));
  }

  async fixtureExists(name: string): Promise<boolean> {
    const fixturePath = path.join(this.fixturesPath, `${name}.json`);
    
    try {
      await fs.access(fixturePath);
      return true;
    } catch {
      return false;
    }
  }
}