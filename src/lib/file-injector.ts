import fs from "fs-extra";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import type { FrontmatterConfig } from "./frontmatter-parser.js";

const execAsync = promisify(exec);

// Security constants
const MAX_TEMPLATE_DEPTH = 10;
const TEMPLATE_TIMEOUT = 30000; // 30 seconds
const FILE_OPERATION_TIMEOUT = 5000; // 5 seconds per file operation
const VALID_CHMOD_PATTERN = /^[0-7]{3,4}$/;
const MAX_FILE_SIZE = 100_000_000; // 100MB limit
const DANGEROUS_PATHS = [
  '/etc', '/root', '/sys', '/proc', '/dev', '/var/log',
  'C:\\Windows', 'C:\\Program Files', 'C:\\System32'
];

// File lock implementation with timeout
interface FileLock {
  promise: Promise<any>;
  timestamp: number;
  lockId: string;
}

export interface InjectionResult {
  success: boolean;
  message: string;
  changes: string[];
  skipped?: boolean;
}

export interface InjectionOptions {
  force: boolean;
  dry: boolean;
  backup?: boolean;
}

export class FileInjector {
  private templateDepth = 0;
  private fileLocks = new Map<string, FileLock>();
  private lockTimeouts = new Map<string, NodeJS.Timeout>();

  /**
   * Write or inject content based on frontmatter configuration
   */
  async processFile(
    filePath: string,
    content: string,
    frontmatter: FrontmatterConfig,
    options: InjectionOptions = { force: false, dry: false }
  ): Promise<InjectionResult> {
    // SECURITY: Validate and sanitize file path
    const securityCheck = this.validateFilePath(filePath);
    if (!securityCheck.valid) {
      return {
        success: false,
        message: `Security violation: ${securityCheck.reason}`,
        changes: []
      };
    }
    
    const sanitizedPath = securityCheck.sanitizedPath;
    // 1. SECURITY FIX: Infinite loop prevention
    this.templateDepth++;
    if (this.templateDepth > MAX_TEMPLATE_DEPTH) {
      this.templateDepth--;
      return {
        success: false,
        message: `Template depth limit exceeded (${MAX_TEMPLATE_DEPTH}). Possible infinite recursion detected.`,
        changes: [],
      };
    }
    
    // SECURITY: Check file size limits
    try {
      if (sanitizedPath && await fs.pathExists(sanitizedPath)) {
        const stats = await fs.stat(sanitizedPath);
        if (stats.size > MAX_FILE_SIZE) {
          this.templateDepth--;
          return {
            success: false,
            message: `File too large: ${stats.size} bytes exceeds ${MAX_FILE_SIZE} byte limit`,
            changes: []
          };
        }
      }
    } catch (error) {
      this.templateDepth--;
      return {
        success: false,
        message: `File access error: ${error}`,
        changes: []
      };
    }

    const timeoutPromise = new Promise<InjectionResult>((_, reject) =>
      setTimeout(() => reject(new Error("Template processing timeout")), TEMPLATE_TIMEOUT)
    );

    try {
      if (!sanitizedPath) {
        throw new Error('Sanitized path is required');
      }
      const processPromise = this.processFileInternal(sanitizedPath, content, frontmatter, options);
      const result = await Promise.race([processPromise, timeoutPromise]);
      return result;
    } finally {
      this.templateDepth--;
    }
  }

  private async processFileInternal(
    filePath: string,
    content: string,
    frontmatter: FrontmatterConfig,
    options: InjectionOptions
  ): Promise<InjectionResult> {
    try {
      const result: InjectionResult = {
        success: false,
        message: "",
        changes: [],
      };

      // Determine operation mode
      const { mode, target, lineNumber } = this.getOperationMode(frontmatter);

      // Check if file exists
      const fileExists = await fs.pathExists(filePath);

      if (mode === "write") {
        return await this.writeFile(filePath, content, frontmatter, options, fileExists);
      }

      if (!fileExists) {
        result.message = `Cannot inject into non-existent file: ${filePath}`;
        return result;
      }

      switch (mode) {
        case "inject": {
          return await this.injectContent(filePath, content, target, options);
        }
        case "append": {
          return await this.appendContent(filePath, content, options);
        }
        case "prepend": {
          return await this.prependContent(filePath, content, options);
        }
        case "lineAt": {
          return await this.injectAtLine(filePath, content, lineNumber!, options);
        }
        case "conditional": {
          return await this.conditionalInject(filePath, content, frontmatter, options);
        }
        default: {
          result.message = `Unknown operation mode: ${mode}`;
          return result;
        }
      }
    } catch (error) {
      return {
        success: false,
        message: `Error processing file: ${error}`,
        changes: [],
      };
    }
  }

  /**
   * Write file atomically with race condition prevention
   */
  private async writeFile(
    filePath: string,
    content: string,
    frontmatter: FrontmatterConfig,
    options: InjectionOptions,
    fileExists: boolean
  ): Promise<InjectionResult> {
    // 3. SECURITY FIX: Race condition prevention
    return this.withFileLock(filePath, async () => {
      const result: InjectionResult = {
        success: false,
        message: "",
        changes: [],
      };

      if (fileExists && !options.force) {
        result.message = `File already exists: ${filePath}. Use --force to overwrite.`;
        return result;
      }

      if (options.dry) {
        result.success = true;
        result.message = `Would write file: ${filePath}`;
        result.changes = [`write: ${filePath}`];
        return result;
      }

      // Ensure directory exists
      await fs.ensureDir(path.dirname(filePath));

      // Create backup if requested
      if (options.backup && fileExists) {
        await this.createBackup(filePath);
      }

      // SECURITY: Atomic write with proper error handling
      const tempFile = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;
      
      try {
        // Write to temporary file first
        await fs.writeFile(tempFile, content, { encoding: "utf-8", mode: 0o644 });
        
        // Atomic rename to final destination
        if (!fileExists) {
          // For new files, use rename which is atomic on most filesystems
          await fs.rename(tempFile, filePath);
        } else {
          // For existing files, ensure atomic replacement
          await fs.rename(tempFile, filePath);
        }
      } catch (error: any) {
        // Clean up temp file on failure
        try {
          await fs.unlink(tempFile);
        } catch {
          // Ignore cleanup errors
        }
        
        if (error.code === "EEXIST") {
          result.message = `File was created by another process: ${filePath}`;
          return result;
        }
        throw error;
      }

      result.success = true;
      result.message = `File written: ${filePath}`;
      result.changes = [`write: ${filePath}`];
      
      // SECURITY: Handle chmod permissions if specified
      if (frontmatter.chmod && !options.dry) {
        const chmodSuccess = await this.setPermissions(filePath, frontmatter.chmod);
        if (!chmodSuccess) {
          result.message += ` (warning: chmod ${frontmatter.chmod} failed)`;
          // Don't fail the whole operation for chmod issues
        }
      }
      
      return result;
    });
  }

  /**
   * Inject content at specific markers or positions
   */
  private async injectContent(
    filePath: string,
    content: string,
    target: string | undefined,
    options: InjectionOptions
  ): Promise<InjectionResult> {
    return this.withFileLock(filePath, async () => {
      const result: InjectionResult = {
        success: false,
        message: "",
        changes: [],
      };

      const existingContent = await fs.readFile(filePath, "utf8");
    
    // Check if content already exists (idempotent)
    if (existingContent.includes(content.trim())) {
      result.success = true;
      result.message = `Content already exists in: ${filePath}`;
      result.skipped = true;
      return result;
    }

    let newContent: string;

    if (target) {
      // Find target and inject before/after
      const lines = existingContent.split("\n");
      const targetLineIndex = lines.findIndex(line => line.includes(target));

      if (targetLineIndex === -1) {
        result.message = `Target not found in file: ${target}`;
        return result;
      }

      // Insert after the target line by default
      lines.splice(targetLineIndex + 1, 0, content);
      newContent = lines.join("\n");
    } else {
      // Simple append if no target specified
      newContent = existingContent + "\n" + content;
    }

    if (options.dry) {
      result.success = true;
      result.message = `Would inject content into: ${filePath}`;
      result.changes = [`inject: ${filePath} ${target ? `after "${target}"` : "at end"}`];
      return result;
    }

    // Create backup
    if (options.backup) {
      await this.createBackup(filePath);
    }

      await fs.writeFile(filePath, newContent, "utf-8");

      result.success = true;
      result.message = `Content injected into: ${filePath}`;
      result.changes = [`inject: ${filePath} ${target ? `after "${target}"` : "at end"}`];
      
      return result;
    });
  }

  /**
   * Append content to end of file
   */
  private async appendContent(
    filePath: string,
    content: string,
    options: InjectionOptions
  ): Promise<InjectionResult> {
    return this.withFileLock(filePath, async () => {
      const result: InjectionResult = {
        success: false,
        message: "",
        changes: [],
      };

      const existingContent = await fs.readFile(filePath, "utf8");
    
    // Check if content already exists at end (idempotent)
    if (existingContent.trimEnd().endsWith(content.trim())) {
      result.success = true;
      result.message = `Content already at end of: ${filePath}`;
      result.skipped = true;
      return result;
    }

    const newContent = existingContent + (existingContent.endsWith("\n") ? "" : "\n") + content;

    if (options.dry) {
      result.success = true;
      result.message = `Would append content to: ${filePath}`;
      result.changes = [`append: ${filePath}`];
      return result;
    }

    if (options.backup) {
      await this.createBackup(filePath);
    }

      await fs.writeFile(filePath, newContent, "utf-8");

      result.success = true;
      result.message = `Content appended to: ${filePath}`;
      result.changes = [`append: ${filePath}`];
      
      return result;
    });
  }

  /**
   * Prepend content to beginning of file
   */
  private async prependContent(
    filePath: string,
    content: string,
    options: InjectionOptions
  ): Promise<InjectionResult> {
    return this.withFileLock(filePath, async () => {
      const result: InjectionResult = {
        success: false,
        message: "",
        changes: [],
      };

      const existingContent = await fs.readFile(filePath, "utf8");
    
    // Check if content already exists at beginning (idempotent)
    if (existingContent.trimStart().startsWith(content.trim())) {
      result.success = true;
      result.message = `Content already at beginning of: ${filePath}`;
      result.skipped = true;
      return result;
    }

    const newContent = content + (content.endsWith("\n") ? "" : "\n") + existingContent;

    if (options.dry) {
      result.success = true;
      result.message = `Would prepend content to: ${filePath}`;
      result.changes = [`prepend: ${filePath}`];
      return result;
    }

    if (options.backup) {
      await this.createBackup(filePath);
    }

      await fs.writeFile(filePath, newContent, "utf-8");

      result.success = true;
      result.message = `Content prepended to: ${filePath}`;
      result.changes = [`prepend: ${filePath}`];
      
      return result;
    });
  }

  /**
   * Inject content at specific line number
   */
  private async injectAtLine(
    filePath: string,
    content: string,
    lineNumber: number,
    options: InjectionOptions
  ): Promise<InjectionResult> {
    return this.withFileLock(filePath, async () => {
      const result: InjectionResult = {
        success: false,
        message: "",
        changes: [],
      };

      const existingContent = await fs.readFile(filePath, "utf8");
    const lines = existingContent.split("\n");

    if (lineNumber > lines.length + 1) {
      result.message = `Line number ${lineNumber} exceeds file length (${lines.length} lines)`;
      return result;
    }

    // Check if content already exists at that line (idempotent)
    const targetIndex = lineNumber - 1; // Convert to 0-based
    if (lines[targetIndex] && lines[targetIndex].trim() === content.trim()) {
      result.success = true;
      result.message = `Content already at line ${lineNumber} in: ${filePath}`;
      result.skipped = true;
      return result;
    }

    // Insert at specified line (1-based line numbers)
    lines.splice(targetIndex, 0, content);
    const newContent = lines.join("\n");

    if (options.dry) {
      result.success = true;
      result.message = `Would inject content at line ${lineNumber} in: ${filePath}`;
      result.changes = [`lineAt: ${filePath}:${lineNumber}`];
      return result;
    }

    if (options.backup) {
      await this.createBackup(filePath);
    }

      await fs.writeFile(filePath, newContent, "utf-8");

      result.success = true;
      result.message = `Content injected at line ${lineNumber} in: ${filePath}`;
      result.changes = [`lineAt: ${filePath}:${lineNumber}`];
      
      return result;
    });
  }

  /**
   * Conditional injection with skipIf evaluation
   */
  private async conditionalInject(
    filePath: string,
    content: string,
    frontmatter: FrontmatterConfig,
    options: InjectionOptions
  ): Promise<InjectionResult> {
    const result: InjectionResult = {
      success: false,
      message: "",
      changes: [],
    };

    const existingContent = await fs.readFile(filePath, "utf8");
    
    // Check if content already exists (idempotent)
    if (existingContent.includes(content.trim())) {
      result.success = true;
      result.message = `Content already exists in: ${filePath}`;
      result.skipped = true;
      return result;
    }

    // For conditional mode, we'll use regular inject logic
    // The skipIf condition would be evaluated at a higher level
    return await this.injectContent(filePath, content, frontmatter.after || frontmatter.before, options);
  }

  /**
   * Set file permissions with enhanced validation and security checks
   */
  async setPermissions(filePath: string, chmod: string | number): Promise<boolean> {
    try {
      // SECURITY: Validate file path first
      const pathCheck = this.validateFilePath(filePath);
      if (!pathCheck.valid) {
        console.error(`Invalid file path for chmod: ${pathCheck.reason}`);
        return false;
      }
      
      let mode: number;
      
      if (typeof chmod === "string") {
        // Enhanced chmod string validation (supports 3-4 digit octal)
        if (!VALID_CHMOD_PATTERN.test(chmod)) {
          console.error(`Invalid chmod format: ${chmod}. Must be octal (000-7777)`);
          return false;
        }
        mode = Number.parseInt(chmod, 8);
      } else {
        mode = chmod;
      }

      // Enhanced numeric validation with security checks
      if (mode < 0 || mode > 0o7777) {
        console.error(`Invalid chmod value: ${mode}. Must be between 0 and 4095 (000-7777 octal)`);
        return false;
      }
      
      // SECURITY: Block dangerous permission combinations
      const stickyBit = (mode & 0o1000) !== 0;
      const setgidBit = (mode & 0o2000) !== 0;
      const setuidBit = (mode & 0o4000) !== 0;
      
      if (setuidBit || setgidBit) {
        console.warn(`Warning: Setting special bits (setuid/setgid) on ${filePath}`);
        // Allow but warn - may want to block entirely in production
      }
      
      // SECURITY: Verify file exists and we have permission to change it
      const sanitizedPath = pathCheck.sanitizedPath;
      if (!sanitizedPath) {
        console.error('Sanitized path is undefined');
        return false;
      }
      
      if (!(await fs.pathExists(sanitizedPath))) {
        console.error(`File does not exist: ${sanitizedPath}`);
        return false;
      }
      
      // Check if we can access the file before trying to change permissions
      try {
        await fs.access(sanitizedPath, fs.constants.F_OK);
      } catch (error) {
        console.error(`Cannot access file for chmod: ${sanitizedPath}`);
        return false;
      }

      await fs.chmod(sanitizedPath, mode);
      
      // SECURITY: Verify the permissions were actually set
      try {
        const stats = await fs.stat(sanitizedPath);
        const actualMode = stats.mode & 0o7777;
        
        // The actual mode might differ due to umask, but should include our bits
        if ((actualMode & mode) !== (actualMode & actualMode)) {
          console.warn(`Chmod verification: expected ${mode.toString(8)}, got ${actualMode.toString(8)}`);
        }
        
        return true;
      } catch (verifyError) {
        console.error(`Failed to verify chmod on ${pathCheck.sanitizedPath}:`, verifyError);
        return false;
      }
    } catch (error) {
      console.error(`Failed to set permissions on ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Execute shell commands
   */
  async executeCommands(
    commands: string | string[],
    workingDir?: string
  ): Promise<{ success: boolean; outputs: string[]; errors: string[] }> {
    const commandArray = Array.isArray(commands) ? commands : [commands];
    const outputs: string[] = [];
    const errors: string[] = [];

    for (const command of commandArray) {
      try {
        const { stdout, stderr } = await execAsync(command, {
          cwd: workingDir,
          timeout: 30_000, // 30 second timeout
        });
        
        if (stdout) outputs.push(stdout.trim());
        if (stderr) errors.push(stderr.trim());
      } catch (error) {
        errors.push(`Command failed: ${command} - ${error}`);
      }
    }

    return {
      success: errors.length === 0,
      outputs,
      errors,
    };
  }

  /**
   * Create backup of existing file
   */
  private async createBackup(filePath: string): Promise<string> {
    const backupPath = `${filePath}.bak.${Date.now()}`;
    await fs.copy(filePath, backupPath);
    return backupPath;
  }

  /**
   * Enhanced file locking mechanism with timeout to prevent race conditions
   */
  private async withFileLock<T>(filePath: string, operation: () => Promise<T>): Promise<T> {
    const normalizedPath = path.resolve(filePath);
    const lockId = createHash('sha256').update(`${normalizedPath}-${Date.now()}-${Math.random()}`).digest('hex').slice(0, 16);
    
    // Clean up expired locks
    this.cleanupExpiredLocks();
    
    // Wait for any existing lock on this file with timeout
    const maxWaitTime = FILE_OPERATION_TIMEOUT;
    const startTime = Date.now();
    
    while (this.fileLocks.has(normalizedPath)) {
      if (Date.now() - startTime > maxWaitTime) {
        throw new Error(`File lock timeout: ${filePath} (waited ${maxWaitTime}ms)`);
      }
      
      try {
        const existingLock = this.fileLocks.get(normalizedPath);
        if (existingLock) {
          await Promise.race([
            existingLock.promise,
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Lock wait timeout')), 1000)
            )
          ]);
        }
      } catch (error) {
        // If existing operation failed or timed out, remove the stale lock
        if (error && typeof error === 'object' && 'message' in error && typeof (error as any).message === 'string' && (error as any).message.includes('timeout')) {
          this.fileLocks.delete(normalizedPath);
          break;
        }
      }
      
      // Brief pause to prevent busy waiting
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Create new lock with timeout
    const lockPromise = (async () => {
      const operationTimeout = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(`Operation timeout: ${filePath}`)), FILE_OPERATION_TIMEOUT)
      );
      
      try {
        return await Promise.race([operation(), operationTimeout]);
      } finally {
        this.fileLocks.delete(normalizedPath);
        const timeout = this.lockTimeouts.get(normalizedPath);
        if (timeout) {
          clearTimeout(timeout);
          this.lockTimeouts.delete(normalizedPath);
        }
      }
    })();

    const lock: FileLock = {
      promise: lockPromise,
      timestamp: Date.now(),
      lockId
    };
    
    this.fileLocks.set(normalizedPath, lock);
    
    // Set cleanup timeout for this lock
    const cleanupTimeout = setTimeout(() => {
      if (this.fileLocks.get(normalizedPath)?.lockId === lockId) {
        this.fileLocks.delete(normalizedPath);
      }
    }, FILE_OPERATION_TIMEOUT * 2);
    
    this.lockTimeouts.set(normalizedPath, cleanupTimeout);
    
    return lockPromise;
  }

  /**
   * Clean up expired file locks
   */
  private cleanupExpiredLocks(): void {
    const now = Date.now();
    const expiredPaths: string[] = [];
    
    for (const [path, lock] of this.fileLocks) {
      if (now - lock.timestamp > FILE_OPERATION_TIMEOUT * 3) {
        expiredPaths.push(path);
      }
    }
    
    for (const path of expiredPaths) {
      this.fileLocks.delete(path);
      const timeout = this.lockTimeouts.get(path);
      if (timeout) {
        clearTimeout(timeout);
        this.lockTimeouts.delete(path);
      }
    }
  }
  
  /**
   * Validate and sanitize file paths to prevent security vulnerabilities
   */
  private validateFilePath(filePath: string): { valid: boolean; reason?: string; sanitizedPath?: string } {
    try {
      // SECURITY: Normalize path to prevent traversal attacks
      const normalized = path.normalize(filePath);
      const resolved = path.resolve(normalized);
      
      // SECURITY: Check for path traversal attempts
      if (normalized.includes('..') || resolved.includes('..')) {
        return { valid: false, reason: 'Path traversal detected (..)' };
      }
      
      // SECURITY: Block access to dangerous system paths
      for (const dangerousPath of DANGEROUS_PATHS) {
        if (resolved.toLowerCase().startsWith(dangerousPath.toLowerCase())) {
          return { valid: false, reason: `Access to system directory blocked: ${dangerousPath}` };
        }
      }
      
      // SECURITY: Check for null bytes (can bypass some security checks)
      if (filePath.includes('\0') || normalized.includes('\0')) {
        return { valid: false, reason: 'Null byte in path detected' };
      }
      
      // SECURITY: Check for excessively long paths
      if (resolved.length > 4096) {
        return { valid: false, reason: 'Path too long (>4096 characters)' };
      }
      
      // SECURITY: On Unix-like systems, check for symlink attacks
      if (process.platform !== 'win32') {
        try {
          const parentDir = path.dirname(resolved);
          if (fs.pathExistsSync(parentDir)) {
            const stats = fs.lstatSync(parentDir);
            if (stats.isSymbolicLink()) {
              const realPath = fs.realpathSync(parentDir);
              // Verify the real path is also safe
              for (const dangerousPath of DANGEROUS_PATHS) {
                if (realPath.toLowerCase().startsWith(dangerousPath.toLowerCase())) {
                  return { valid: false, reason: `Symlink points to dangerous path: ${realPath}` };
                }
              }
            }
          }
        } catch (error) {
          // If we can't check the symlink, be cautious
          // Continue with other validations
        }
      }
      
      // SECURITY: Windows-specific checks
      if (process.platform === 'win32') {
        // Block Windows device names
        const windowsDevices = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
        const fileName = path.basename(resolved).toUpperCase();
        const baseName = fileName.split('.')[0];
        
        if (windowsDevices.includes(baseName)) {
          return { valid: false, reason: `Windows device name detected: ${baseName}` };
        }
      }
      
      // SECURITY: Block hidden system files
      const fileName = path.basename(resolved);
      if (fileName.startsWith('.') && (fileName === '..' || fileName.startsWith('...'))) {
        return { valid: false, reason: 'Invalid hidden file pattern' };
      }
      
      return { valid: true, sanitizedPath: resolved };
    } catch (error) {
      return { valid: false, reason: `Path validation error: ${error}` };
    }
  }

  /**
   * Get operation mode from frontmatter
   */
  private getOperationMode(frontmatter: FrontmatterConfig): {
    mode: "write" | "inject" | "append" | "prepend" | "lineAt" | "conditional";
    target?: string;
    lineNumber?: number;
  } {
    // NEW: 6th mode - conditional injection with expression evaluation
    if (frontmatter.skipIf && frontmatter.inject) {
      return { mode: "conditional", target: frontmatter.before || frontmatter.after };
    }

    if (frontmatter.lineAt !== undefined) {
      return { mode: "lineAt", lineNumber: frontmatter.lineAt };
    }

    if (frontmatter.append) {
      return { mode: "append" };
    }

    if (frontmatter.prepend) {
      return { mode: "prepend" };
    }

    if (frontmatter.inject) {
      if (frontmatter.before) {
        return { mode: "inject", target: frontmatter.before };
      }
      if (frontmatter.after) {
        return { mode: "inject", target: frontmatter.after };
      }
      return { mode: "inject" };
    }

    return { mode: "write" };
  }
}