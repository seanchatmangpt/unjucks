/**
 * Support helper utilities for Unjucks testing
 * Provides filesystem operations and test utilities
 */

import fs from 'fs-extra';
import path from 'node:path';
import { tmpdir } from 'node:os';

/**
 * FileSystemHelper class for file operations during testing
 */
export class FileSystemHelper {
  constructor(basePath = null) {
    this.basePath = basePath || process.cwd();
    this.tempPaths = [];
    this.originalFiles = new Map();
  }

  /**
   * Create a temporary directory
   */
  async createTempDir() {
    const tempDir = path.join(tmpdir(), 'unjucks-fs-test-' + this.getDeterministicTimestamp() + '-' + Math.random().toString(36).substring(2));
    await fs.ensureDir(tempDir);
    this.tempPaths.push(tempDir);
    return tempDir;
  }

  /**
   * Create a file with content
   */
  async createFile(relativePath, content) {
    const fullPath = path.resolve(this.basePath, relativePath);
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, content);
    this.tempPaths.push(fullPath);
    return fullPath;
  }

  /**
   * Read file content
   */
  async readFile(relativePath) {
    const fullPath = path.resolve(this.basePath, relativePath);
    try {
      return await fs.readFile(fullPath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Check if file exists
   */
  async exists(relativePath) {
    const fullPath = path.resolve(this.basePath, relativePath);
    return fs.pathExists(fullPath);
  }

  /**
   * Create directory structure from object
   */
  async createStructure(structure, basePath = this.basePath) {
    for (const [name, content] of Object.entries(structure)) {
      const fullPath = path.join(basePath, name);
      
      if (typeof content === 'string') {
        // It's a file
        await fs.ensureDir(path.dirname(fullPath));
        await fs.writeFile(fullPath, content);
        this.tempPaths.push(fullPath);
      } else if (typeof content === 'object' && content !== null) {
        // It's a directory
        await fs.ensureDir(fullPath);
        await this.createStructure(content, fullPath);
        this.tempPaths.push(fullPath);
      }
    }
  }

  /**
   * Read directory structure into object
   */
  async readStructure(relativePath = '.') {
    const fullPath = path.resolve(this.basePath, relativePath);
    const structure = {};
    
    try {
      const items = await fs.readdir(fullPath, { withFileTypes: true });
      
      for (const item of items) {
        const itemPath = path.join(fullPath, item.name);
        
        if (item.isDirectory()) {
          structure[item.name] = await this.readStructure(path.relative(this.basePath, itemPath));
        } else if (item.isFile()) {
          structure[item.name] = await fs.readFile(itemPath, 'utf8');
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
      return {};
    }
    
    return structure;
  }

  /**
   * Backup a file before modification
   */
  async backup(relativePath) {
    const fullPath = path.resolve(this.basePath, relativePath);
    if (await fs.pathExists(fullPath)) {
      const content = await fs.readFile(fullPath, 'utf8');
      this.originalFiles.set(fullPath, content);
    }
  }

  /**
   * Restore a backed up file
   */
  async restore(relativePath) {
    const fullPath = path.resolve(this.basePath, relativePath);
    if (this.originalFiles.has(fullPath)) {
      const originalContent = this.originalFiles.get(fullPath);
      await fs.writeFile(fullPath, originalContent);
      this.originalFiles.delete(fullPath);
    }
  }

  /**
   * Copy file or directory
   */
  async copy(src, dest) {
    const srcPath = path.resolve(this.basePath, src);
    const destPath = path.resolve(this.basePath, dest);
    
    await fs.ensureDir(path.dirname(destPath));
    await fs.copy(srcPath, destPath);
    this.tempPaths.push(destPath);
    return destPath;
  }

  /**
   * Move file or directory
   */
  async move(src, dest) {
    const srcPath = path.resolve(this.basePath, src);
    const destPath = path.resolve(this.basePath, dest);
    
    await fs.ensureDir(path.dirname(destPath));
    await fs.move(srcPath, destPath);
    this.tempPaths.push(destPath);
    return destPath;
  }

  /**
   * Remove file or directory
   */
  async remove(relativePath) {
    const fullPath = path.resolve(this.basePath, relativePath);
    await fs.remove(fullPath);
  }

  /**
   * Get file stats
   */
  async stat(relativePath) {
    const fullPath = path.resolve(this.basePath, relativePath);
    try {
      return await fs.stat(fullPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * List directory contents
   */
  async list(relativePath = '.') {
    const fullPath = path.resolve(this.basePath, relativePath);
    try {
      return await fs.readdir(fullPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Find files matching pattern
   */
  async find(pattern, relativePath = '.') {
    const fullPath = path.resolve(this.basePath, relativePath);
    const results = [];
    
    async function findRecursive(dir, currentPattern) {
      try {
        const items = await fs.readdir(dir, { withFileTypes: true });
        
        for (const item of items) {
          const itemPath = path.join(dir, item.name);
          const relativePath = path.relative(fullPath, itemPath);
          
          if (item.isDirectory()) {
            await findRecursive(itemPath, currentPattern);
          } else if (item.isFile()) {
            if (relativePath.includes(currentPattern) || item.name.includes(currentPattern)) {
              results.push(relativePath);
            }
          }
        }
      } catch (error) {
        // Ignore errors and continue
      }
    }
    
    await findRecursive(fullPath, pattern);
    return results;
  }

  /**
   * Change base path
   */
  setBasePath(newBasePath) {
    this.basePath = path.resolve(newBasePath);
  }

  /**
   * Get absolute path
   */
  resolvePath(relativePath) {
    return path.resolve(this.basePath, relativePath);
  }

  /**
   * Clean up all temporary files and restore backups
   */
  async cleanup() {
    // Remove temporary paths
    for (const tempPath of this.tempPaths) {
      try {
        await fs.remove(tempPath);
      } catch (error) {
        console.warn(`Failed to cleanup: ${tempPath}`, error);
      }
    }
    this.tempPaths = [];

    // Restore original files
    for (const [filePath, originalContent] of this.originalFiles) {
      try {
        await fs.writeFile(filePath, originalContent);
      } catch (error) {
        console.warn(`Failed to restore: ${filePath}`, error);
      }
    }
    this.originalFiles.clear();
  }
}

/**
 * Create a new FileSystemHelper instance
 */
export function createFileSystemHelper(basePath = null) {
  return new FileSystemHelper(basePath);
}

export default FileSystemHelper;