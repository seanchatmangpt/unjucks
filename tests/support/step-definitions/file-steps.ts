/**
 * File System Step Definitions for Vitest-Cucumber
 * Modular step definitions for file and directory operations
 */
import { expect } from 'vitest';
import type { TestContext } from '../test-context.js';

export const createFileSteps = (context: TestContext) => ({
  /**
   * Create a directory
   */
  'I have a directory "([^"]*)"': async (dirPath: string) => {
    await context.helper.createDirectory(dirPath);
  },

  /**
   * Create a file with content
   */
  'I have a file "([^"]*)" with content:': async (filePath: string, content: string) => {
    await context.helper.createFile(filePath, content);
  },

  /**
   * Create an empty file
   */
  'I have an empty file "([^"]*)"': async (filePath: string) => {
    await context.helper.createFile(filePath, '');
  },

  /**
   * Check file exists
   */
  'the file "([^"]*)" should exist': async (filePath: string) => {
    const exists = await context.helper.fileExists(filePath);
    expect(exists).toBe(true);
  },

  /**
   * Check file does not exist
   */
  'the file "([^"]*)" should not exist': async (filePath: string) => {
    const exists = await context.helper.fileExists(filePath);
    expect(exists).toBe(false);
  },

  /**
   * Check directory exists
   */
  'the directory "([^"]*)" should exist': async (dirPath: string) => {
    const exists = await context.helper.directoryExists(dirPath);
    expect(exists).toBe(true);
  },

  /**
   * Check directory does not exist
   */
  'the directory "([^"]*)" should not exist': async (dirPath: string) => {
    const exists = await context.helper.directoryExists(dirPath);
    expect(exists).toBe(false);
  },

  /**
   * Check file contains text
   */
  'the file "([^"]*)" should contain "([^"]*)"': async (filePath: string, expectedText: string) => {
    await context.helper.verifyFileExists(filePath);
    const content = await context.helper.readFile(filePath);
    expect(content).toContain(expectedText);
  },

  /**
   * Check file content matches exactly
   */
  'the file "([^"]*)" should have content:': async (filePath: string, expectedContent: string) => {
    await context.helper.verifyFileExists(filePath);
    const content = await context.helper.readFile(filePath);
    expect(content.trim()).toBe(expectedContent.trim());
  },

  /**
   * Check file content matches pattern
   */
  'the file "([^"]*)" should match /([^/]+)/': async (filePath: string, pattern: string) => {
    await context.helper.verifyFileExists(filePath);
    const content = await context.helper.readFile(filePath);
    expect(content).toMatch(new RegExp(pattern));
  },

  /**
   * Remove a file
   */
  'I remove the file "([^"]*)"': async (filePath: string) => {
    await context.helper.removeFile(filePath);
  },

  /**
   * Remove a directory
   */
  'I remove the directory "([^"]*)"': async (dirPath: string) => {
    await context.helper.removeDirectory(dirPath);
  },

  /**
   * Change to directory
   */
  'I change to directory "([^"]*)"': async (dirPath: string) => {
    const fullPath = context.helper.getFullPath(dirPath);
    process.chdir(fullPath);
  },

  /**
   * Change to temp directory
   */
  'I change to the temp directory': async () => {
    await context.helper.changeToTempDir();
  },

  /**
   * List files in directory
   */
  'I list files in "([^"]*)"': async (dirPath: string) => {
    const files = await context.helper.listFiles(dirPath);
    context.variables.fileList = files;
  },

  /**
   * Check number of files in directory
   */
  'the directory "([^"]*)" should contain (\\d+) files?': async (dirPath: string, count: string) => {
    const files = await context.helper.listFiles(dirPath);
    expect(files.length).toBe(parseInt(count, 10));
  },

  /**
   * Check specific files exist in directory
   */
  'the directory "([^"]*)" should contain files:': async (dirPath: string, expectedFiles: string) => {
    const files = await context.helper.listFiles(dirPath);
    const expectedFileList = expectedFiles.split('\n').map(f => f.trim()).filter(f => f);
    
    for (const expectedFile of expectedFileList) {
      expect(files).toContain(expectedFile);
    }
  }
});