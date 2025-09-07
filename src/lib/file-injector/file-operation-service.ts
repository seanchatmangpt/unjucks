/**
 * FileOperationService - Basic file read/write/stat operations
 * Handles atomic file operations with proper error handling
 */

import fs from "fs-extra";
import path from "node:path";
import type { IFileOperationService } from "./interfaces.js";

export class FileOperationService implements IFileOperationService {

  /**
   * Check if a file or directory exists
   */
  async pathExists(filePath: string): Promise<boolean> {
    try {
      return await fs.pathExists(filePath);
    } catch (error) {
      return false;
    }
  }

  /**
   * Read file content as UTF-8 string
   */
  async readFile(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, "utf8");
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${filePath}`);
      }
      if (error.code === 'EACCES') {
        throw new Error(`Permission denied: ${filePath}`);
      }
      if (error.code === 'EISDIR') {
        throw new Error(`Path is a directory: ${filePath}`);
      }
      throw new Error(`Failed to read file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Write file content with atomic operations
   */
  async writeFile(filePath: string, content: string, options: { atomic?: boolean } = {}): Promise<void> {
    const { atomic = true } = options;
    
    try {
      if (atomic) {
        // Atomic write using temporary file
        const tempFile = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;
        
        try {
          // Write to temporary file first
          await fs.writeFile(tempFile, content, { encoding: "utf-8", mode: 0o644 });
          
          // Atomic rename to final destination
          await fs.rename(tempFile, filePath);
        } catch (error: any) {
          // Clean up temp file on failure
          try {
            await fs.unlink(tempFile);
          } catch {
            // Ignore cleanup errors
          }
          
          if (error.code === "EEXIST") {
            throw new Error(`File was created by another process: ${filePath}`);
          }
          throw error;
        }
      } else {
        // Direct write (non-atomic)
        await fs.writeFile(filePath, content, { encoding: "utf-8", mode: 0o644 });
      }
    } catch (error: any) {
      if (error.code === 'EACCES') {
        throw new Error(`Permission denied writing to: ${filePath}`);
      }
      if (error.code === 'ENOSPC') {
        throw new Error(`No space left on device writing to: ${filePath}`);
      }
      if (error.code === 'EMFILE' || error.code === 'ENFILE') {
        throw new Error(`Too many open files writing to: ${filePath}`);
      }
      throw error;
    }
  }

  /**
   * Ensure directory exists, creating parent directories as needed
   */
  async ensureDir(dirPath: string): Promise<void> {
    try {
      await fs.ensureDir(dirPath);
    } catch (error: any) {
      if (error.code === 'EACCES') {
        throw new Error(`Permission denied creating directory: ${dirPath}`);
      }
      if (error.code === 'ENOSPC') {
        throw new Error(`No space left on device creating directory: ${dirPath}`);
      }
      throw new Error(`Failed to create directory ${dirPath}: ${error.message}`);
    }
  }

  /**
   * Get file statistics
   */
  async stat(filePath: string): Promise<{ size: number; mode: number }> {
    try {
      const stats = await fs.stat(filePath);
      return {
        size: stats.size,
        mode: stats.mode
      };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found for stat: ${filePath}`);
      }
      if (error.code === 'EACCES') {
        throw new Error(`Permission denied accessing: ${filePath}`);
      }
      throw new Error(`Failed to stat file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Change file permissions
   */
  async chmod(filePath: string, mode: number): Promise<void> {
    try {
      await fs.chmod(filePath, mode);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found for chmod: ${filePath}`);
      }
      if (error.code === 'EACCES') {
        throw new Error(`Permission denied changing mode: ${filePath}`);
      }
      if (error.code === 'EPERM') {
        throw new Error(`Operation not permitted (chmod): ${filePath}`);
      }
      throw new Error(`Failed to chmod file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Create backup of existing file
   */
  async createBackup(filePath: string): Promise<string> {
    const backupPath = `${filePath}.bak.${Date.now()}`;
    
    try {
      await fs.copy(filePath, backupPath);
      return backupPath;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Source file not found for backup: ${filePath}`);
      }
      if (error.code === 'EACCES') {
        throw new Error(`Permission denied creating backup: ${filePath}`);
      }
      if (error.code === 'ENOSPC') {
        throw new Error(`No space left on device creating backup: ${filePath}`);
      }
      throw new Error(`Failed to create backup of ${filePath}: ${error.message}`);
    }
  }
}