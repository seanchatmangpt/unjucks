/**
 * File operations test helper for Unjucks testing
 * Provides utilities for testing file injection, reading, and writing
 */

import fs from 'fs-extra';
import path from 'node:path';
import { tmpdir } from 'node:os';

export class FileTestHelper {
  constructor() {
    this.tempFiles = [];
    this.tempDirs = [];
    this.originalFiles = new Map(); // Store original file contents for restoration
  }

  /**
   * Create a temporary file with content
   */
  async createTempFile(content, extension = '.js', basePath = null) {
    const tempDir = basePath || tmpdir();
    const filename = `test-${this.getDeterministicTimestamp()}-${Math.random().toString(36).substring(2)}${extension}`;
    const filePath = path.join(tempDir, filename);
    
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, content);
    
    this.tempFiles.push(filePath);
    return filePath;
  }

  /**
   * Create a temporary directory
   */
  async createTempDir() {
    const tempDir = path.join(tmpdir(), `unjucks-file-test-${this.getDeterministicTimestamp()}-${Math.random().toString(36).substring(2)}`);
    await fs.ensureDir(tempDir);
    this.tempDirs.push(tempDir);
    return tempDir;
  }

  /**
   * Create a test file structure
   */
  async createFileStructure(structure, basePath = null) {
    const baseDir = basePath || await this.createTempDir();
    
    for (const [relativePath, content] of Object.entries(structure)) {
      const fullPath = path.join(baseDir, relativePath);
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, content);
      this.tempFiles.push(fullPath);
    }
    
    return baseDir;
  }

  /**
   * Read file content safely
   */
  async readFile(filePath) {
    try {
      return await fs.readFile(filePath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Write file content safely
   */
  async writeFile(filePath, content) {
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, content);
    this.tempFiles.push(filePath);
    return filePath;
  }

  /**
   * Copy file safely
   */
  async copyFile(srcPath, destPath) {
    await fs.ensureDir(path.dirname(destPath));
    await fs.copy(srcPath, destPath);
    this.tempFiles.push(destPath);
    return destPath;
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath) {
    return fs.pathExists(filePath);
  }

  /**
   * Get file stats
   */
  async getFileStats(filePath) {
    try {
      return await fs.stat(filePath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Backup original file before modification
   */
  async backupFile(filePath) {
    if (await this.fileExists(filePath)) {
      const content = await this.readFile(filePath);
      this.originalFiles.set(filePath, content);
    }
  }

  /**
   * Restore original file content
   */
  async restoreFile(filePath) {
    if (this.originalFiles.has(filePath)) {
      const originalContent = this.originalFiles.get(filePath);
      await this.writeFile(filePath, originalContent);
      this.originalFiles.delete(filePath);
    }
  }

  /**
   * Create a mock file with injection markers
   */
  async createMockFileWithMarkers(filePath, content, markers = {}) {
    const defaultMarkers = {
      before: '// INJECT BEFORE',
      after: '// INJECT AFTER',
      at: '// INJECT AT',
      append: '// INJECT APPEND',
      prepend: '// INJECT PREPEND'
    };
    
    const allMarkers = { ...defaultMarkers, ...markers };
    
    let mockContent = content;
    for (const [type, marker] of Object.entries(allMarkers)) {
      if (!mockContent.includes(marker)) {
        if (type === 'prepend') {
          mockContent = marker + '\n' + mockContent;
        } else if (type === 'append') {
          mockContent = mockContent + '\n' + marker;
        } else {
          // Insert somewhere in the middle
          const lines = mockContent.split('\n');
          const midPoint = Math.floor(lines.length / 2);
          lines.splice(midPoint, 0, marker);
          mockContent = lines.join('\n');
        }
      }
    }
    
    await this.writeFile(filePath, mockContent);
    return filePath;
  }

  /**
   * Assert file content contains text
   */
  async assertFileContains(filePath, expectedText) {
    const content = await this.readFile(filePath);
    if (!content) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    if (!content.includes(expectedText)) {
      throw new Error(`File ${filePath} does not contain expected text: "${expectedText}"`);
    }
    return true;
  }

  /**
   * Assert file content matches exactly
   */
  async assertFileEquals(filePath, expectedContent) {
    const actualContent = await this.readFile(filePath);
    if (actualContent === null) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    if (actualContent.trim() !== expectedContent.trim()) {
      throw new Error(`File content mismatch in ${filePath}:\nExpected:\n${expectedContent}\nActual:\n${actualContent}`);
    }
    return true;
  }

  /**
   * Assert file does not contain text
   */
  async assertFileDoesNotContain(filePath, unexpectedText) {
    const content = await this.readFile(filePath);
    if (content && content.includes(unexpectedText)) {
      throw new Error(`File ${filePath} unexpectedly contains: "${unexpectedText}"`);
    }
    return true;
  }

  /**
   * Assert file exists
   */
  async assertFileExists(filePath) {
    const exists = await this.fileExists(filePath);
    if (!exists) {
      throw new Error(`Expected file to exist: ${filePath}`);
    }
    return true;
  }

  /**
   * Assert file does not exist
   */
  async assertFileDoesNotExist(filePath) {
    const exists = await this.fileExists(filePath);
    if (exists) {
      throw new Error(`Expected file to not exist: ${filePath}`);
    }
    return true;
  }

  /**
   * Get line at specific position
   */
  async getLineAt(filePath, lineNumber) {
    const content = await this.readFile(filePath);
    if (!content) {
      return null;
    }
    const lines = content.split('\n');
    return lines[lineNumber - 1] || null;
  }

  /**
   * Count lines in file
   */
  async countLines(filePath) {
    const content = await this.readFile(filePath);
    if (!content) {
      return 0;
    }
    return content.split('\n').length;
  }

  /**
   * Find line number containing text
   */
  async findLineContaining(filePath, searchText) {
    const content = await this.readFile(filePath);
    if (!content) {
      return -1;
    }
    const lines = content.split('\n');
    return lines.findIndex(line => line.includes(searchText));
  }

  /**
   * Clean up all temporary files and directories
   */
  async cleanup() {
    // Clean up temporary files
    for (const filePath of this.tempFiles) {
      try {
        await fs.remove(filePath);
      } catch (error) {
        console.warn(`Failed to cleanup temp file: ${filePath}`, error);
      }
    }
    this.tempFiles = [];

    // Clean up temporary directories
    for (const dirPath of this.tempDirs) {
      try {
        await fs.remove(dirPath);
      } catch (error) {
        console.warn(`Failed to cleanup temp directory: ${dirPath}`, error);
      }
    }
    this.tempDirs = [];

    // Restore original files
    for (const [filePath, originalContent] of this.originalFiles) {
      try {
        await this.restoreFile(filePath);
      } catch (error) {
        console.warn(`Failed to restore original file: ${filePath}`, error);
      }
    }
    this.originalFiles.clear();
  }
}

export default FileTestHelper;