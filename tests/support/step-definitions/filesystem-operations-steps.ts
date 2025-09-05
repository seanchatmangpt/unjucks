import { Given, When, Then } from '@cucumber/cucumber';
import { UnjucksWorld } from '../world';
import assert from 'node:assert';
import { promises as fs, constants } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { exec } from 'node:child_process';

const execAsync = promisify(exec);

/**
 * File System Operations Steps Library
 * Comprehensive step definitions for directory trees, file permissions,
 * symlinks, file watching, and advanced file system operations
 */

// Directory operations
Given('a directory structure:', async function (this: UnjucksWorld, directoryTree: string) {
  const lines = directoryTree.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    // Determine depth by counting leading spaces
    const depth = (line.length - trimmedLine.length) / 2;
    const isFile = trimmedLine.includes('.');
    
    if (isFile) {
      const filePath = path.join(this.context.tempDirectory!, trimmedLine);
      await this.helper.createFile(filePath, '// Generated file');
    } else {
      const dirPath = path.join(this.context.tempDirectory!, trimmedLine);
      await this.helper.createDirectory(dirPath);
    }
  }
});

Given('the following directories exist:', async function (this: UnjucksWorld, dirTable: any) {
  const directories = dirTable.hashes();
  
  for (const dir of directories) {
    const dirPath = path.join(this.context.tempDirectory!, dir.path);
    await this.helper.createDirectory(dirPath);
    
    // Set permissions if specified
    if (dir.permissions) {
      await fs.chmod(dirPath, parseInt(dir.permissions, 8));
    }
  }
});

Given('the following files exist:', async function (this: UnjucksWorld, fileTable: any) {
  const files = fileTable.hashes();
  
  for (const file of files) {
    const filePath = path.join(this.context.tempDirectory!, file.path);
    const content = file.content || '// Default content';
    
    await this.helper.createFile(filePath, content);
    
    // Set permissions if specified
    if (file.permissions) {
      await fs.chmod(filePath, parseInt(file.permissions, 8));
    }
    
    // Set timestamps if specified
    if (file.modified) {
      const modifiedTime = new Date(file.modified);
      await fs.utimes(filePath, modifiedTime, modifiedTime);
    }
  }
});

// File permissions
Given('the file {string} has permissions {string}', async function (this: UnjucksWorld, filePath: string, permissions: string) {
  const fullPath = path.join(this.context.tempDirectory!, filePath);
  await fs.chmod(fullPath, parseInt(permissions, 8));
});

Given('the directory {string} is read-only', async function (this: UnjucksWorld, dirPath: string) {
  const fullPath = path.join(this.context.tempDirectory!, dirPath);
  await fs.chmod(fullPath, 0o444);
});

Given('the file {string} is executable', async function (this: UnjucksWorld, filePath: string) {
  const fullPath = path.join(this.context.tempDirectory!, filePath);
  await fs.chmod(fullPath, 0o755);
});

// Symlinks
Given('a symbolic link from {string} to {string}', async function (this: UnjucksWorld, linkPath: string, targetPath: string) {
  const fullLinkPath = path.join(this.context.tempDirectory!, linkPath);
  const fullTargetPath = path.join(this.context.tempDirectory!, targetPath);
  
  await fs.symlink(fullTargetPath, fullLinkPath);
});

Given('a broken symbolic link {string}', async function (this: UnjucksWorld, linkPath: string) {
  const fullLinkPath = path.join(this.context.tempDirectory!, linkPath);
  const nonExistentTarget = path.join(this.context.tempDirectory!, 'nonexistent-target');
  
  await fs.symlink(nonExistentTarget, fullLinkPath);
});

// File system state
Given('the file system is being watched', async function (this: UnjucksWorld) {
  this.context.fileWatcher = {
    events: [],
    watching: true
  };
});

Given('file {string} is currently open for editing', async function (this: UnjucksWorld, filePath: string) {
  const fullPath = path.join(this.context.tempDirectory!, filePath);
  this.context.openFiles = this.context.openFiles || [];
  this.context.openFiles.push(fullPath);
});

Given('the disk is nearly full', async function (this: UnjucksWorld) {
  // Mock condition for testing disk full scenarios
  this.context.diskFull = true;
});

// File operations
When('I create directory {string}', async function (this: UnjucksWorld, dirPath: string) {
  try {
    await this.helper.createDirectory(dirPath);
    this.context.lastOperation = { type: 'create_directory', path: dirPath, success: true };
  } catch (error: any) {
    this.context.lastOperation = { type: 'create_directory', path: dirPath, success: false, error: error.message };
  }
});

When('I create directory {string} with permissions {string}', async function (this: UnjucksWorld, dirPath: string, permissions: string) {
  try {
    await this.helper.createDirectory(dirPath);
    const fullPath = path.join(this.context.tempDirectory!, dirPath);
    await fs.chmod(fullPath, parseInt(permissions, 8));
    this.context.lastOperation = { type: 'create_directory_with_permissions', path: dirPath, success: true };
  } catch (error: any) {
    this.context.lastOperation = { type: 'create_directory_with_permissions', path: dirPath, success: false, error: error.message };
  }
});

When('I delete file {string}', async function (this: UnjucksWorld, filePath: string) {
  try {
    const fullPath = path.join(this.context.tempDirectory!, filePath);
    await fs.unlink(fullPath);
    this.context.lastOperation = { type: 'delete_file', path: filePath, success: true };
  } catch (error: any) {
    this.context.lastOperation = { type: 'delete_file', path: filePath, success: false, error: error.message };
  }
});

When('I delete directory {string}', async function (this: UnjucksWorld, dirPath: string) {
  try {
    const fullPath = path.join(this.context.tempDirectory!, dirPath);
    await fs.rmdir(fullPath, { recursive: true });
    this.context.lastOperation = { type: 'delete_directory', path: dirPath, success: true };
  } catch (error: any) {
    this.context.lastOperation = { type: 'delete_directory', path: dirPath, success: false, error: error.message };
  }
});

When('I move file {string} to {string}', async function (this: UnjucksWorld, sourcePath: string, targetPath: string) {
  try {
    const fullSourcePath = path.join(this.context.tempDirectory!, sourcePath);
    const fullTargetPath = path.join(this.context.tempDirectory!, targetPath);
    await fs.rename(fullSourcePath, fullTargetPath);
    this.context.lastOperation = { type: 'move_file', source: sourcePath, target: targetPath, success: true };
  } catch (error: any) {
    this.context.lastOperation = { type: 'move_file', source: sourcePath, target: targetPath, success: false, error: error.message };
  }
});

When('I copy file {string} to {string}', async function (this: UnjucksWorld, sourcePath: string, targetPath: string) {
  try {
    const fullSourcePath = path.join(this.context.tempDirectory!, sourcePath);
    const fullTargetPath = path.join(this.context.tempDirectory!, targetPath);
    await fs.copyFile(fullSourcePath, fullTargetPath);
    this.context.lastOperation = { type: 'copy_file', source: sourcePath, target: targetPath, success: true };
  } catch (error: any) {
    this.context.lastOperation = { type: 'copy_file', source: sourcePath, target: targetPath, success: false, error: error.message };
  }
});

// File content operations
When('I append {string} to file {string}', async function (this: UnjucksWorld, content: string, filePath: string) {
  try {
    const fullPath = path.join(this.context.tempDirectory!, filePath);
    await fs.appendFile(fullPath, content);
    this.context.lastOperation = { type: 'append_file', path: filePath, content, success: true };
  } catch (error: any) {
    this.context.lastOperation = { type: 'append_file', path: filePath, content, success: false, error: error.message };
  }
});

When('I truncate file {string}', async function (this: UnjucksWorld, filePath: string) {
  try {
    const fullPath = path.join(this.context.tempDirectory!, filePath);
    await fs.truncate(fullPath);
    this.context.lastOperation = { type: 'truncate_file', path: filePath, success: true };
  } catch (error: any) {
    this.context.lastOperation = { type: 'truncate_file', path: filePath, success: false, error: error.message };
  }
});

When('I replace {string} with {string} in file {string}', async function (this: UnjucksWorld, searchText: string, replaceText: string, filePath: string) {
  try {
    const fullPath = path.join(this.context.tempDirectory!, filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    const newContent = content.replace(new RegExp(searchText, 'g'), replaceText);
    await fs.writeFile(fullPath, newContent);
    this.context.lastOperation = { type: 'replace_in_file', path: filePath, search: searchText, replace: replaceText, success: true };
  } catch (error: any) {
    this.context.lastOperation = { type: 'replace_in_file', path: filePath, search: searchText, replace: replaceText, success: false, error: error.message };
  }
});

// File system inspection
When('I list files in directory {string}', async function (this: UnjucksWorld, dirPath: string) {
  try {
    const fullPath = path.join(this.context.tempDirectory!, dirPath);
    const files = await fs.readdir(fullPath, { withFileTypes: true });
    this.context.directoryListing = files.map(dirent => ({
      name: dirent.name,
      isFile: dirent.isFile(),
      isDirectory: dirent.isDirectory(),
      isSymlink: dirent.isSymbolicLink()
    }));
    this.context.lastOperation = { type: 'list_files', path: dirPath, success: true };
  } catch (error: any) {
    this.context.lastOperation = { type: 'list_files', path: dirPath, success: false, error: error.message };
  }
});

When('I get file info for {string}', async function (this: UnjucksWorld, filePath: string) {
  try {
    const fullPath = path.join(this.context.tempDirectory!, filePath);
    const stats = await fs.stat(fullPath);
    this.context.fileInfo = {
      size: stats.size,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      isSymlink: stats.isSymbolicLink(),
      mode: stats.mode,
      mtime: stats.mtime,
      ctime: stats.ctime
    };
    this.context.lastOperation = { type: 'get_file_info', path: filePath, success: true };
  } catch (error: any) {
    this.context.lastOperation = { type: 'get_file_info', path: filePath, success: false, error: error.message };
  }
});

// File system assertions
Then('the directory {string} should exist', async function (this: UnjucksWorld, dirPath: string) {
  const fullPath = path.join(this.context.tempDirectory!, dirPath);
  try {
    const stats = await fs.stat(fullPath);
    assert.ok(stats.isDirectory(), `${dirPath} should be a directory`);
  } catch (error) {
    throw new Error(`Directory ${dirPath} should exist`);
  }
});

Then('the file {string} should exist', async function (this: UnjucksWorld, filePath: string) {
  const fullPath = path.join(this.context.tempDirectory!, filePath);
  try {
    const stats = await fs.stat(fullPath);
    assert.ok(stats.isFile(), `${filePath} should be a file`);
  } catch (error) {
    throw new Error(`File ${filePath} should exist`);
  }
});

Then('the file {string} should not exist', async function (this: UnjucksWorld, filePath: string) {
  const fullPath = path.join(this.context.tempDirectory!, filePath);
  try {
    await fs.access(fullPath);
    throw new Error(`File ${filePath} should not exist but it does`);
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
});

Then('the file {string} should have permissions {string}', async function (this: UnjucksWorld, filePath: string, expectedPermissions: string) {
  const fullPath = path.join(this.context.tempDirectory!, filePath);
  const stats = await fs.stat(fullPath);
  const actualPermissions = (stats.mode & parseInt('777', 8)).toString(8).padStart(3, '0');
  assert.strictEqual(actualPermissions, expectedPermissions, `File ${filePath} should have permissions ${expectedPermissions}, got ${actualPermissions}`);
});

Then('the file {string} should be a symbolic link', async function (this: UnjucksWorld, filePath: string) {
  const fullPath = path.join(this.context.tempDirectory!, filePath);
  const lstat = await fs.lstat(fullPath);
  assert.ok(lstat.isSymbolicLink(), `${filePath} should be a symbolic link`);
});

Then('the symbolic link {string} should point to {string}', async function (this: UnjucksWorld, linkPath: string, expectedTarget: string) {
  const fullLinkPath = path.join(this.context.tempDirectory!, linkPath);
  const actualTarget = await fs.readlink(fullLinkPath);
  const expectedFullTarget = path.join(this.context.tempDirectory!, expectedTarget);
  assert.strictEqual(path.resolve(path.dirname(fullLinkPath), actualTarget), expectedFullTarget);
});

Then('the file {string} should contain {string}', async function (this: UnjucksWorld, filePath: string, expectedContent: string) {
  const content = await this.helper.readFile(filePath);
  assert.ok(content.includes(expectedContent), `File ${filePath} should contain "${expectedContent}"`);
});

Then('the file {string} should be exactly {string}', async function (this: UnjucksWorld, filePath: string, expectedContent: string) {
  const content = await this.helper.readFile(filePath);
  assert.strictEqual(content.trim(), expectedContent.trim(), `File ${filePath} content mismatch`);
});

Then('the file {string} should be empty', async function (this: UnjucksWorld, filePath: string) {
  const fullPath = path.join(this.context.tempDirectory!, filePath);
  const stats = await fs.stat(fullPath);
  assert.strictEqual(stats.size, 0, `File ${filePath} should be empty`);
});

Then('the file {string} should have size {int} bytes', async function (this: UnjucksWorld, filePath: string, expectedSize: number) {
  const fullPath = path.join(this.context.tempDirectory!, filePath);
  const stats = await fs.stat(fullPath);
  assert.strictEqual(stats.size, expectedSize, `File ${filePath} should have size ${expectedSize} bytes`);
});

// Directory listing assertions
Then('the directory listing should contain:', function (this: UnjucksWorld, expectedTable: any) {
  const expectedFiles = expectedTable.hashes();
  const listing = this.context.directoryListing || [];
  
  for (const expected of expectedFiles) {
    const found = listing.find(item => item.name === expected.name);
    assert.ok(found, `Directory should contain ${expected.name}`);
    
    if (expected.type === 'file') {
      assert.ok(found.isFile, `${expected.name} should be a file`);
    } else if (expected.type === 'directory') {
      assert.ok(found.isDirectory, `${expected.name} should be a directory`);
    } else if (expected.type === 'symlink') {
      assert.ok(found.isSymlink, `${expected.name} should be a symbolic link`);
    }
  }
});

Then('the directory should be empty', function (this: UnjucksWorld) {
  const listing = this.context.directoryListing || [];
  assert.strictEqual(listing.length, 0, 'Directory should be empty');
});

Then('the directory should contain {int} items', function (this: UnjucksWorld, expectedCount: number) {
  const listing = this.context.directoryListing || [];
  assert.strictEqual(listing.length, expectedCount, `Directory should contain ${expectedCount} items`);
});

// Operation success/failure assertions
Then('the operation should succeed', function (this: UnjucksWorld) {
  const lastOp = this.context.lastOperation;
  assert.ok(lastOp?.success, `Operation should succeed, but failed with: ${lastOp?.error}`);
});

Then('the operation should fail', function (this: UnjucksWorld) {
  const lastOp = this.context.lastOperation;
  assert.ok(!lastOp?.success, 'Operation should fail');
});

Then('the operation should fail with {string} error', function (this: UnjucksWorld, expectedError: string) {
  const lastOp = this.context.lastOperation;
  assert.ok(!lastOp?.success, 'Operation should fail');
  assert.ok(lastOp?.error?.includes(expectedError), `Error should contain "${expectedError}", got: ${lastOp?.error}`);
});

// Advanced file system operations
When('I create a hard link from {string} to {string}', async function (this: UnjucksWorld, linkPath: string, targetPath: string) {
  try {
    const fullLinkPath = path.join(this.context.tempDirectory!, linkPath);
    const fullTargetPath = path.join(this.context.tempDirectory!, targetPath);
    await fs.link(fullTargetPath, fullLinkPath);
    this.context.lastOperation = { type: 'create_hard_link', source: targetPath, target: linkPath, success: true };
  } catch (error: any) {
    this.context.lastOperation = { type: 'create_hard_link', source: targetPath, target: linkPath, success: false, error: error.message };
  }
});

When('I check disk space in directory {string}', async function (this: UnjucksWorld, dirPath: string) {
  try {
    const fullPath = path.join(this.context.tempDirectory!, dirPath);
    // Mock disk space check - in real implementation would use statvfs
    this.context.diskSpace = { 
      free: this.context.diskFull ? 100 : 1000000,
      total: 1000000 
    };
    this.context.lastOperation = { type: 'check_disk_space', path: dirPath, success: true };
  } catch (error: any) {
    this.context.lastOperation = { type: 'check_disk_space', path: dirPath, success: false, error: error.message };
  }
});

Then('the available disk space should be less than {int} bytes', function (this: UnjucksWorld, threshold: number) {
  const diskSpace = this.context.diskSpace;
  assert.ok(diskSpace?.free < threshold, `Disk space should be less than ${threshold} bytes`);
});

Then('the available disk space should be more than {int} bytes', function (this: UnjucksWorld, threshold: number) {
  const diskSpace = this.context.diskSpace;
  assert.ok(diskSpace?.free > threshold, `Disk space should be more than ${threshold} bytes`);
});

// Factory function for creating file system steps
export function createFileSystemSteps(context?: any) {
  return {
    directoryStructure: Given,
    directoriesExist: Given,
    filesExist: Given,
    filePermissions: Given,
    readOnlyDirectory: Given,
    executableFile: Given,
    symbolicLink: Given,
    brokenSymlink: Given,
    createDirectory: When,
    createDirectoryWithPermissions: When,
    deleteFile: When,
    deleteDirectory: When,
    moveFile: When,
    copyFile: When,
    appendToFile: When,
    truncateFile: When,
    replaceInFile: When,
    listFiles: When,
    getFileInfo: When,
    directoryShouldExist: Then,
    fileShouldExist: Then,
    fileShouldNotExist: Then,
    filePermissionsShouldBe: Then,
    shouldBeSymlink: Then,
    symlinkShouldPointTo: Then,
    fileShouldContain: Then,
    fileShouldBeExactly: Then,
    fileShouldBeEmpty: Then,
    operationShouldSucceed: Then,
    operationShouldFail: Then
  };
}