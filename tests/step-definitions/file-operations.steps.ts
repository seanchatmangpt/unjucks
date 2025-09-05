import { loadFeature, defineFeature } from 'vitest-cucumber';
import { expect } from 'vitest';
import { UnjucksWorld } from '../support/world';
import * as path from 'node:path';
import * as fs from 'fs-extra';

export const fileOperationsStepDefinitions = {
  // File creation and setup steps
  'I create a file {string} with content:': async (world: UnjucksWorld, filePath: string, content: string) => {
    if (!world.context.tempDirectory) {
      await world.createTempDirectory();
    }
    await world.helper.createFile(filePath, content.trim());
    world.trackGeneratedFile(filePath);
  },

  'I create an empty file {string}': async (world: UnjucksWorld, filePath: string) => {
    if (!world.context.tempDirectory) {
      await world.createTempDirectory();
    }
    await world.helper.createFile(filePath, '');
    world.trackGeneratedFile(filePath);
  },

  'I create a directory {string}': async (world: UnjucksWorld, dirPath: string) => {
    if (!world.context.tempDirectory) {
      await world.createTempDirectory();
    }
    await world.helper.createDirectory(dirPath);
  },

  'I create the following files:': async (world: UnjucksWorld, dataTable: any) => {
    if (!world.context.tempDirectory) {
      await world.createTempDirectory();
    }
    
    for (const row of dataTable.hashes()) {
      const filePath = row.file || row.path;
      const content = row.content || row.body || '';
      await world.helper.createFile(filePath, content);
      world.trackGeneratedFile(filePath);
    }
  },

  'I create the following directory structure:': async (world: UnjucksWorld, dataTable: any) => {
    if (!world.context.tempDirectory) {
      await world.createTempDirectory();
    }
    
    for (const row of dataTable.hashes()) {
      const type = row.type.toLowerCase();
      const pathValue = row.path;
      
      if (type === 'directory' || type === 'dir') {
        await world.helper.createDirectory(pathValue);
      } else if (type === 'file') {
        const content = row.content || '';
        await world.helper.createFile(pathValue, content);
        world.trackGeneratedFile(pathValue);
      }
    }
  },

  // File reading and verification steps
  'I read the file {string}': async (world: UnjucksWorld, filePath: string) => {
    const content = await world.readGeneratedFile(filePath);
    world.setVariable('fileContent', content);
    world.setVariable('lastReadFile', filePath);
  },

  'the file {string} should contain {string}': async (world: UnjucksWorld, filePath: string, expectedContent: string) => {
    const content = await world.readGeneratedFile(filePath);
    if (!content.includes(expectedContent)) {
      throw new Error(`File '${filePath}' does not contain expected content.\nExpected: ${expectedContent}\nActual content: ${content}`);
    }
    expect(content).toContain(expectedContent);
  },

  'the file {string} should not contain {string}': async (world: UnjucksWorld, filePath: string, unexpectedContent: string) => {
    const content = await world.readGeneratedFile(filePath);
    expect(content).not.toContain(unexpectedContent);
  },

  'the file {string} should match the pattern {string}': async (world: UnjucksWorld, filePath: string, pattern: string) => {
    const content = await world.readGeneratedFile(filePath);
    const regex = new RegExp(pattern, 'i');
    expect(content).toMatch(regex);
  },

  'the file {string} should be exactly:': async (world: UnjucksWorld, filePath: string, expectedContent: string) => {
    const content = await world.readGeneratedFile(filePath);
    const normalizedExpected = expectedContent.trim().replace(/\r\n/g, '\n');
    const normalizedActual = content.trim().replace(/\r\n/g, '\n');
    expect(normalizedActual).toBe(normalizedExpected);
  },

  'the file {string} should have {int} lines': async (world: UnjucksWorld, filePath: string, expectedLines: number) => {
    const content = await world.readGeneratedFile(filePath);
    const lines = content.split('\n').length;
    expect(lines).toBe(expectedLines);
  },

  'the file {string} should be empty': async (world: UnjucksWorld, filePath: string) => {
    const content = await world.readGeneratedFile(filePath);
    expect(content.trim()).toBe('');
  },

  'the file {string} should not be empty': async (world: UnjucksWorld, filePath: string) => {
    const content = await world.readGeneratedFile(filePath);
    expect(content.trim()).not.toBe('');
  },

  // File modification steps
  'I append {string} to file {string}': async (world: UnjucksWorld, contentToAppend: string, filePath: string) => {
    const existingContent = await world.readGeneratedFile(filePath);
    const newContent = existingContent + contentToAppend;
    await world.helper.createFile(filePath, newContent);
  },

  'I prepend {string} to file {string}': async (world: UnjucksWorld, contentToPrepend: string, filePath: string) => {
    const existingContent = await world.readGeneratedFile(filePath);
    const newContent = contentToPrepend + existingContent;
    await world.helper.createFile(filePath, newContent);
  },

  'I replace {string} with {string} in file {string}': async (world: UnjucksWorld, searchText: string, replaceText: string, filePath: string) => {
    const content = await world.readGeneratedFile(filePath);
    const newContent = content.replace(new RegExp(searchText, 'g'), replaceText);
    await world.helper.createFile(filePath, newContent);
  },

  // File deletion and cleanup steps
  'I delete the file {string}': async (world: UnjucksWorld, filePath: string) => {
    const fullPath = path.resolve(world.context.tempDirectory, filePath);
    await fs.remove(fullPath);
  },

  'I delete the directory {string}': async (world: UnjucksWorld, dirPath: string) => {
    const fullPath = path.resolve(world.context.tempDirectory, dirPath);
    await fs.remove(fullPath);
  },

  'I clean up all generated files': async (world: UnjucksWorld) => {
    for (const filePath of world.context.generatedFiles) {
      try {
        const fullPath = path.resolve(world.context.tempDirectory, filePath);
        await fs.remove(fullPath);
      } catch (error) {
        // Ignore errors when cleaning up
      }
    }
    world.context.generatedFiles = [];
  },

  // File properties and attributes
  'the file {string} should be executable': async (world: UnjucksWorld, filePath: string) => {
    const fullPath = path.resolve(world.context.tempDirectory, filePath);
    const stats = await fs.stat(fullPath);
    const isExecutable = !!(stats.mode & parseInt('111', 8));
    expect(isExecutable).toBe(true);
  },

  'the file {string} should not be executable': async (world: UnjucksWorld, filePath: string) => {
    const fullPath = path.resolve(world.context.tempDirectory, filePath);
    const stats = await fs.stat(fullPath);
    const isExecutable = !!(stats.mode & parseInt('111', 8));
    expect(isExecutable).toBe(false);
  },

  'the file {string} should be readable': async (world: UnjucksWorld, filePath: string) => {
    const fullPath = path.resolve(world.context.tempDirectory, filePath);
    const accessible = await fs.access(fullPath, fs.constants.R_OK).then(() => true).catch(() => false);
    expect(accessible).toBe(true);
  },

  'the file {string} should be writable': async (world: UnjucksWorld, filePath: string) => {
    const fullPath = path.resolve(world.context.tempDirectory, filePath);
    const accessible = await fs.access(fullPath, fs.constants.W_OK).then(() => true).catch(() => false);
    expect(accessible).toBe(true);
  },

  'the file {string} size should be {int} bytes': async (world: UnjucksWorld, filePath: string, expectedSize: number) => {
    const fullPath = path.resolve(world.context.tempDirectory, filePath);
    const stats = await fs.stat(fullPath);
    expect(stats.size).toBe(expectedSize);
  },

  'the file {string} size should be greater than {int} bytes': async (world: UnjucksWorld, filePath: string, minSize: number) => {
    const fullPath = path.resolve(world.context.tempDirectory, filePath);
    const stats = await fs.stat(fullPath);
    expect(stats.size).toBeGreaterThan(minSize);
  },

  'the file {string} size should be less than {int} bytes': async (world: UnjucksWorld, filePath: string, maxSize: number) => {
    const fullPath = path.resolve(world.context.tempDirectory, filePath);
    const stats = await fs.stat(fullPath);
    expect(stats.size).toBeLessThan(maxSize);
  },

  // Directory operations
  'the directory {string} should contain {int} files': async (world: UnjucksWorld, dirPath: string, expectedCount: number) => {
    const fullPath = path.resolve(world.context.tempDirectory, dirPath);
    const files = await fs.readdir(fullPath);
    const fileStats = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(fullPath, file);
        const stat = await fs.stat(filePath);
        return stat.isFile();
      })
    );
    const fileCount = fileStats.filter(Boolean).length;
    expect(fileCount).toBe(expectedCount);
  },

  'the directory {string} should contain {int} subdirectories': async (world: UnjucksWorld, dirPath: string, expectedCount: number) => {
    const fullPath = path.resolve(world.context.tempDirectory, dirPath);
    const files = await fs.readdir(fullPath);
    const dirStats = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(fullPath, file);
        const stat = await fs.stat(filePath);
        return stat.isDirectory();
      })
    );
    const dirCount = dirStats.filter(Boolean).length;
    expect(dirCount).toBe(expectedCount);
  },

  'the directory {string} should be empty': async (world: UnjucksWorld, dirPath: string) => {
    const fullPath = path.resolve(world.context.tempDirectory, dirPath);
    const files = await fs.readdir(fullPath);
    expect(files.length).toBe(0);
  },

  'the directory {string} should not be empty': async (world: UnjucksWorld, dirPath: string) => {
    const fullPath = path.resolve(world.context.tempDirectory, dirPath);
    const files = await fs.readdir(fullPath);
    expect(files.length).toBeGreaterThan(0);
  },

  // File listing and discovery
  'I list files in directory {string}': async (world: UnjucksWorld, dirPath: string) => {
    const fullPath = path.resolve(world.context.tempDirectory, dirPath);
    const files = await fs.readdir(fullPath);
    world.setVariable('listedFiles', files);
    world.context.lastCommandOutput = files.join('\n');
  },

  'I should see the file {string} in the list': (world: UnjucksWorld, fileName: string) => {
    const listedFiles = world.getVariable('listedFiles') as string[] || [];
    expect(listedFiles).toContain(fileName);
  },

  'I should not see the file {string} in the list': (world: UnjucksWorld, fileName: string) => {
    const listedFiles = world.getVariable('listedFiles') as string[] || [];
    expect(listedFiles).not.toContain(fileName);
  },

  // File comparison
  'the file {string} should be identical to {string}': async (world: UnjucksWorld, filePath1: string, filePath2: string) => {
    const content1 = await world.readGeneratedFile(filePath1);
    const content2 = await world.readGeneratedFile(filePath2);
    expect(content1).toBe(content2);
  },

  'the file {string} should be different from {string}': async (world: UnjucksWorld, filePath1: string, filePath2: string) => {
    const content1 = await world.readGeneratedFile(filePath1);
    const content2 = await world.readGeneratedFile(filePath2);
    expect(content1).not.toBe(content2);
  },

  // File backup and restore operations
  'I create a backup of file {string}': async (world: UnjucksWorld, filePath: string) => {
    const content = await world.readGeneratedFile(filePath);
    const backupPath = `${filePath}.backup`;
    await world.helper.createFile(backupPath, content);
    world.setVariable('backupPath', backupPath);
  },

  'I restore the backup for file {string}': async (world: UnjucksWorld, filePath: string) => {
    const backupPath = world.getVariable('backupPath') as string || `${filePath}.backup`;
    const backupContent = await world.readGeneratedFile(backupPath);
    await world.helper.createFile(filePath, backupContent);
  },

  // Path and filename validation
  'the filename {string} should be valid': (world: UnjucksWorld, fileName: string) => {
    // Check for invalid characters in filename
    const invalidChars = /[<>:"/\\|?*]/;
    expect(invalidChars.test(fileName)).toBe(false);
    
    // Check for reserved names (Windows)
    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    expect(reservedNames.includes(fileName.toUpperCase())).toBe(false);
  },

  'the file extension should be {string}': async (world: UnjucksWorld, expectedExtension: string) => {
    const files = await world.listFiles();
    const generatedFile = files[0];
    
    if (generatedFile) {
      const extension = path.extname(generatedFile);
      expect(extension).toBe(expectedExtension.startsWith('.') ? expectedExtension : `.${expectedExtension}`);
    }
  },

  // Symbolic links and special files (Unix-like systems)
  'I create a symbolic link from {string} to {string}': async (world: UnjucksWorld, linkPath: string, targetPath: string) => {
    if (process.platform !== 'win32') {
      const fullLinkPath = path.resolve(world.context.tempDirectory, linkPath);
      const fullTargetPath = path.resolve(world.context.tempDirectory, targetPath);
      await fs.symlink(fullTargetPath, fullLinkPath);
    }
  },

  'the file {string} should be a symbolic link': async (world: UnjucksWorld, filePath: string) => {
    if (process.platform !== 'win32') {
      const fullPath = path.resolve(world.context.tempDirectory, filePath);
      const stats = await fs.lstat(fullPath);
      expect(stats.isSymbolicLink()).toBe(true);
    }
  },

  'the symbolic link {string} should point to {string}': async (world: UnjucksWorld, linkPath: string, expectedTarget: string) => {
    if (process.platform !== 'win32') {
      const fullLinkPath = path.resolve(world.context.tempDirectory, linkPath);
      const actualTarget = await fs.readlink(fullLinkPath);
      const fullExpectedTarget = path.resolve(world.context.tempDirectory, expectedTarget);
      expect(path.resolve(path.dirname(fullLinkPath), actualTarget)).toBe(fullExpectedTarget);
    }
  }
};