import { expect } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'node:path';

export interface FileAssertion {
  path: string;
  shouldExist: boolean;
  content?: string;
  contentContains?: string[];
  contentDoesNotContain?: string[];
  contentMatches?: RegExp;
  minSize?: number;
  maxSize?: number;
  permissions?: string;
  isExecutable?: boolean;
}

export interface DirectoryAssertion {
  path: string;
  shouldExist: boolean;
  isEmpty?: boolean;
  fileCount?: number;
  hasFiles?: string[];
  doesNotHaveFiles?: string[];
}

export interface CLIAssertion {
  exitCode?: number;
  stdout?: {
    contains?: string[];
    doesNotContain?: string[];
    matches?: RegExp[];
    isEmpty?: boolean;
    minLength?: number;
    maxLength?: number;
  };
  stderr?: {
    contains?: string[];
    doesNotContain?: string[];
    matches?: RegExp[];
    isEmpty?: boolean;
  };
  duration?: {
    lessThan?: number;
    greaterThan?: number;
  };
}

export class TestAssertions {
  /**
   * Assert file conditions
   */
  static async assertFile(baseDir: string, assertion: FileAssertion): Promise<void> {
    const fullPath = path.join(baseDir, assertion.path);
    const exists = await fs.pathExists(fullPath);

    // Check existence
    if (assertion.shouldExist) {
      expect(exists, `File '${assertion.path}' should exist`).toBe(true);
    } else {
      expect(exists, `File '${assertion.path}' should not exist`).toBe(false);
      return; // No point checking other properties if file shouldn't exist
    }

    // If file should exist, check other properties
    if (exists) {
      const stats = await fs.stat(fullPath);
      const content = await fs.readFile(fullPath, 'utf-8');

      // Check content
      if (assertion.content !== undefined) {
        expect(content, `File '${assertion.path}' content mismatch`)
          .toBe(assertion.content);
      }

      if (assertion.contentContains) {
        for (const substring of assertion.contentContains) {
          expect(content, `File '${assertion.path}' should contain '${substring}'`)
            .toContain(substring);
        }
      }

      if (assertion.contentDoesNotContain) {
        for (const substring of assertion.contentDoesNotContain) {
          expect(content, `File '${assertion.path}' should not contain '${substring}'`)
            .not.toContain(substring);
        }
      }

      if (assertion.contentMatches) {
        expect(content, `File '${assertion.path}' should match pattern ${assertion.contentMatches}`)
          .toMatch(assertion.contentMatches);
      }

      // Check size
      if (assertion.minSize !== undefined) {
        expect(stats.size, `File '${assertion.path}' size should be at least ${assertion.minSize} bytes`)
          .toBeGreaterThanOrEqual(assertion.minSize);
      }

      if (assertion.maxSize !== undefined) {
        expect(stats.size, `File '${assertion.path}' size should be at most ${assertion.maxSize} bytes`)
          .toBeLessThanOrEqual(assertion.maxSize);
      }

      // Check permissions (Unix-like systems only)
      if (assertion.permissions && process.platform !== 'win32') {
        const actualPerms = (stats.mode & parseInt('777', 8)).toString(8);
        expect(actualPerms, `File '${assertion.path}' permissions should be ${assertion.permissions}`)
          .toBe(assertion.permissions);
      }

      if (assertion.isExecutable !== undefined && process.platform !== 'win32') {
        const isExec = !!(stats.mode & parseInt('111', 8));
        expect(isExec, `File '${assertion.path}' executable status should be ${assertion.isExecutable}`)
          .toBe(assertion.isExecutable);
      }
    }
  }

  /**
   * Assert directory conditions
   */
  static async assertDirectory(baseDir: string, assertion: DirectoryAssertion): Promise<void> {
    const fullPath = path.join(baseDir, assertion.path);
    const exists = await fs.pathExists(fullPath);

    // Check existence
    if (assertion.shouldExist) {
      expect(exists, `Directory '${assertion.path}' should exist`).toBe(true);
      
      const stats = await fs.stat(fullPath);
      expect(stats.isDirectory(), `'${assertion.path}' should be a directory`).toBe(true);
    } else {
      expect(exists, `Directory '${assertion.path}' should not exist`).toBe(false);
      return;
    }

    // If directory should exist, check other properties
    if (exists) {
      const entries = await fs.readdir(fullPath);

      // Check if empty
      if (assertion.isEmpty !== undefined) {
        expect(entries.length === 0, `Directory '${assertion.path}' empty status should be ${assertion.isEmpty}`)
          .toBe(assertion.isEmpty);
      }

      // Check file count
      if (assertion.fileCount !== undefined) {
        expect(entries.length, `Directory '${assertion.path}' should have ${assertion.fileCount} entries`)
          .toBe(assertion.fileCount);
      }

      // Check has files
      if (assertion.hasFiles) {
        for (const fileName of assertion.hasFiles) {
          expect(entries, `Directory '${assertion.path}' should contain '${fileName}'`)
            .toContain(fileName);
        }
      }

      // Check does not have files
      if (assertion.doesNotHaveFiles) {
        for (const fileName of assertion.doesNotHaveFiles) {
          expect(entries, `Directory '${assertion.path}' should not contain '${fileName}'`)
            .not.toContain(fileName);
        }
      }
    }
  }

  /**
   * Assert CLI command results
   */
  static assertCLIResult(result: {
    exitCode: number;
    stdout: string;
    stderr: string;
    duration?: number;
  }, assertion: CLIAssertion): void {
    // Check exit code
    if (assertion.exitCode !== undefined) {
      expect(result.exitCode, `Command exit code should be ${assertion.exitCode}`)
        .toBe(assertion.exitCode);
    }

    // Check stdout
    if (assertion.stdout) {
      if (assertion.stdout.contains) {
        for (const text of assertion.stdout.contains) {
          expect(result.stdout, `Stdout should contain '${text}'`)
            .toContain(text);
        }
      }

      if (assertion.stdout.doesNotContain) {
        for (const text of assertion.stdout.doesNotContain) {
          expect(result.stdout, `Stdout should not contain '${text}'`)
            .not.toContain(text);
        }
      }

      if (assertion.stdout.matches) {
        for (const pattern of assertion.stdout.matches) {
          expect(result.stdout, `Stdout should match pattern ${pattern}`)
            .toMatch(pattern);
        }
      }

      if (assertion.stdout.isEmpty !== undefined) {
        const isEmpty = result.stdout.trim().length === 0;
        expect(isEmpty, `Stdout empty status should be ${assertion.stdout.isEmpty}`)
          .toBe(assertion.stdout.isEmpty);
      }

      if (assertion.stdout.minLength !== undefined) {
        expect(result.stdout.length, `Stdout length should be at least ${assertion.stdout.minLength}`)
          .toBeGreaterThanOrEqual(assertion.stdout.minLength);
      }

      if (assertion.stdout.maxLength !== undefined) {
        expect(result.stdout.length, `Stdout length should be at most ${assertion.stdout.maxLength}`)
          .toBeLessThanOrEqual(assertion.stdout.maxLength);
      }
    }

    // Check stderr
    if (assertion.stderr) {
      if (assertion.stderr.contains) {
        for (const text of assertion.stderr.contains) {
          expect(result.stderr, `Stderr should contain '${text}'`)
            .toContain(text);
        }
      }

      if (assertion.stderr.doesNotContain) {
        for (const text of assertion.stderr.doesNotContain) {
          expect(result.stderr, `Stderr should not contain '${text}'`)
            .not.toContain(text);
        }
      }

      if (assertion.stderr.matches) {
        for (const pattern of assertion.stderr.matches) {
          expect(result.stderr, `Stderr should match pattern ${pattern}`)
            .toMatch(pattern);
        }
      }

      if (assertion.stderr.isEmpty !== undefined) {
        const isEmpty = result.stderr.trim().length === 0;
        expect(isEmpty, `Stderr empty status should be ${assertion.stderr.isEmpty}`)
          .toBe(assertion.stderr.isEmpty);
      }
    }

    // Check duration
    if (assertion.duration && result.duration !== undefined) {
      if (assertion.duration.lessThan !== undefined) {
        expect(result.duration, `Command should complete in less than ${assertion.duration.lessThan}ms`)
          .toBeLessThan(assertion.duration.lessThan);
      }

      if (assertion.duration.greaterThan !== undefined) {
        expect(result.duration, `Command should take more than ${assertion.duration.greaterThan}ms`)
          .toBeGreaterThan(assertion.duration.greaterThan);
      }
    }
  }

  /**
   * Assert multiple files at once
   */
  static async assertFiles(baseDir: string, assertions: FileAssertion[]): Promise<void> {
    for (const assertion of assertions) {
      await this.assertFile(baseDir, assertion);
    }
  }

  /**
   * Assert multiple directories at once
   */
  static async assertDirectories(baseDir: string, assertions: DirectoryAssertion[]): Promise<void> {
    for (const assertion of assertions) {
      await this.assertDirectory(baseDir, assertion);
    }
  }

  /**
   * Assert template rendering results
   */
  static assertTemplateRendering(
    rendered: string,
    expected: {
      contains?: string[];
      doesNotContain?: string[];
      matches?: RegExp[];
      exactMatch?: string;
      minLength?: number;
      maxLength?: number;
      lineCount?: number;
    }
  ): void {
    if (expected.exactMatch !== undefined) {
      expect(rendered, 'Rendered template should match exactly')
        .toBe(expected.exactMatch);
      return; // No need to check other conditions if exact match is specified
    }

    if (expected.contains) {
      for (const text of expected.contains) {
        expect(rendered, `Rendered template should contain '${text}'`)
          .toContain(text);
      }
    }

    if (expected.doesNotContain) {
      for (const text of expected.doesNotContain) {
        expect(rendered, `Rendered template should not contain '${text}'`)
          .not.toContain(text);
      }
    }

    if (expected.matches) {
      for (const pattern of expected.matches) {
        expect(rendered, `Rendered template should match pattern ${pattern}`)
          .toMatch(pattern);
      }
    }

    if (expected.minLength !== undefined) {
      expect(rendered.length, `Rendered template length should be at least ${expected.minLength}`)
        .toBeGreaterThanOrEqual(expected.minLength);
    }

    if (expected.maxLength !== undefined) {
      expect(rendered.length, `Rendered template length should be at most ${expected.maxLength}`)
        .toBeLessThanOrEqual(expected.maxLength);
    }

    if (expected.lineCount !== undefined) {
      const lines = rendered.split('\n').length;
      expect(lines, `Rendered template should have ${expected.lineCount} lines`)
        .toBe(expected.lineCount);
    }
  }

  /**
   * Assert generator metadata
   */
  static assertGeneratorMetadata(
    metadata: any,
    expected: {
      hasVariables?: string[];
      hasRequiredVariables?: string[];
      hasOptionalVariables?: string[];
      hasValidation?: boolean;
      hasHooks?: boolean;
      outputPath?: string;
      injectMode?: boolean;
    }
  ): void {
    if (expected.hasVariables) {
      for (const varName of expected.hasVariables) {
        expect(metadata.variables, `Generator should have variable '${varName}'`)
          .toHaveProperty(varName);
      }
    }

    if (expected.hasRequiredVariables) {
      for (const varName of expected.hasRequiredVariables) {
        expect(metadata.variables[varName], `Variable '${varName}' should be required`)
          .toHaveProperty('required', true);
      }
    }

    if (expected.hasOptionalVariables) {
      for (const varName of expected.hasOptionalVariables) {
        expect(metadata.variables[varName]?.required, `Variable '${varName}' should be optional`)
          .not.toBe(true);
      }
    }

    if (expected.outputPath !== undefined) {
      expect(metadata.to || metadata.outputPath, 'Generator should have output path')
        .toBe(expected.outputPath);
    }

    if (expected.injectMode !== undefined) {
      expect(metadata.inject, `Generator inject mode should be ${expected.injectMode}`)
        .toBe(expected.injectMode);
    }
  }

  /**
   * Create fluent assertion builder
   */
  static expect(baseDir: string) {
    return {
      file: (path: string) => ({
        toExist: () => this.assertFile(baseDir, { path, shouldExist: true }),
        notToExist: () => this.assertFile(baseDir, { path, shouldExist: false }),
        toContain: (content: string) => this.assertFile(baseDir, { 
          path, 
          shouldExist: true, 
          contentContains: [content] 
        }),
        toHaveContent: (content: string) => this.assertFile(baseDir, { 
          path, 
          shouldExist: true, 
          content 
        }),
        toMatch: (pattern: RegExp) => this.assertFile(baseDir, { 
          path, 
          shouldExist: true, 
          contentMatches: pattern 
        }),
        toBeSmallerThan: (size: number) => this.assertFile(baseDir, { 
          path, 
          shouldExist: true, 
          maxSize: size 
        }),
        toBeLargerThan: (size: number) => this.assertFile(baseDir, { 
          path, 
          shouldExist: true, 
          minSize: size 
        })
      }),

      directory: (path: string) => ({
        toExist: () => this.assertDirectory(baseDir, { path, shouldExist: true }),
        notToExist: () => this.assertDirectory(baseDir, { path, shouldExist: false }),
        toBeEmpty: () => this.assertDirectory(baseDir, { 
          path, 
          shouldExist: true, 
          isEmpty: true 
        }),
        toContainFiles: (files: string[]) => this.assertDirectory(baseDir, { 
          path, 
          shouldExist: true, 
          hasFiles: files 
        }),
        toHaveFileCount: (count: number) => this.assertDirectory(baseDir, { 
          path, 
          shouldExist: true, 
          fileCount: count 
        })
      })
    };
  }

  /**
   * Snapshot testing for generated files
   */
  static async assertFileSnapshot(baseDir: string, filePath: string, snapshotName?: string): Promise<void> {
    const fullPath = path.join(baseDir, filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    
    // Use vitest's snapshot functionality
    expect(content).toMatchSnapshot(snapshotName || filePath.replace(/[\\/]/g, '-'));
  }

  /**
   * Assert performance characteristics
   */
  static assertPerformance(
    results: { duration: number; memoryUsage?: number }[],
    expected: {
      averageDuration?: { lessThan: number };
      maxDuration?: { lessThan: number };
      minDuration?: { greaterThan: number };
      memoryUsage?: { lessThan: number };
    }
  ): void {
    const durations = results.map(r => r.duration);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const maxDuration = Math.max(...durations);
    const minDuration = Math.min(...durations);

    if (expected.averageDuration) {
      expect(avgDuration, `Average duration should be less than ${expected.averageDuration.lessThan}ms`)
        .toBeLessThan(expected.averageDuration.lessThan);
    }

    if (expected.maxDuration) {
      expect(maxDuration, `Maximum duration should be less than ${expected.maxDuration.lessThan}ms`)
        .toBeLessThan(expected.maxDuration.lessThan);
    }

    if (expected.minDuration) {
      expect(minDuration, `Minimum duration should be greater than ${expected.minDuration.greaterThan}ms`)
        .toBeGreaterThan(expected.minDuration.greaterThan);
    }

    if (expected.memoryUsage) {
      const memoryUsages = results
        .map(r => r.memoryUsage)
        .filter(m => m !== undefined) as number[];
      
      if (memoryUsages.length > 0) {
        const maxMemory = Math.max(...memoryUsages);
        expect(maxMemory, `Memory usage should be less than ${expected.memoryUsage.lessThan} bytes`)
          .toBeLessThan(expected.memoryUsage.lessThan);
      }
    }
  }
}