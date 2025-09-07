/**
 * SecurityValidator - Path traversal, permission, and command validation
 * Handles all security-related validations with comprehensive protection
 */

import fs from "fs-extra";
import path from "node:path";
import { tmpdir } from "node:os";
import type { 
  ISecurityValidator, 
  SecurityValidationResult, 
  CommandValidationResult, 
  ParsedCommand 
} from "./interfaces.js";
import { SECURITY_CONSTANTS } from "./interfaces.js";

export class SecurityValidator implements ISecurityValidator {
  
  /**
   * Validate and sanitize file paths to prevent security vulnerabilities
   */
  validateFilePath(filePath: string): SecurityValidationResult {
    try {
      // SECURITY: Check for null bytes and encoded characters first
      if (filePath.includes('\0') || filePath.includes('%00') || filePath.includes('\u0000')) {
        return { valid: false, reason: 'Null byte or encoded null detected in path' };
      }
      
      // SECURITY: Check for URL encoded path traversal attempts
      const decodedPath = decodeURIComponent(filePath);
      if (decodedPath !== filePath && (decodedPath.includes('..') || decodedPath.includes('\0'))) {
        return { valid: false, reason: 'URL encoded path traversal detected' };
      }
      
      // SECURITY: Use path.resolve() to get canonical path - this handles .. and symlinks
      let resolved: string;
      let realPath: string;
      
      try {
        // Get canonical resolved path
        resolved = path.resolve(filePath);
        
        // For file creation, check if file exists first
        if (fs.pathExistsSync(resolved)) {
          // File exists, get real path to handle symlinks
          realPath = fs.realpathSync.native ? fs.realpathSync.native(resolved) : fs.realpathSync(resolved);
        } else {
          // File doesn't exist yet - validate parent directory instead
          const parentDir = path.dirname(resolved);
          if (fs.pathExistsSync(parentDir)) {
            const realParent = fs.realpathSync.native ? fs.realpathSync.native(parentDir) : fs.realpathSync(parentDir);
            realPath = path.join(realParent, path.basename(resolved));
          } else {
            // Parent directory doesn't exist either - use resolved path
            realPath = resolved;
          }
        }
        
        // Verify both resolved and real paths don't contain traversal patterns
        if (resolved.includes('..') || realPath.includes('..')) {
          return { valid: false, reason: 'Path traversal detected in resolved/real path' };
        }
        
      } catch (symlinkError) {
        // SECURITY FIX: Handle symlink validation errors gracefully for non-existent files
        return { valid: false, reason: `Path validation failed: ${symlinkError}` };
      }
      
      // SECURITY: Validate against parent directory traversal using realpath
      const cwd = process.cwd();
      const realCwd = fs.realpathSync(cwd);
      
      // Define explicitly allowed directories
      const allowedPrefixes = [
        realCwd,                              // Current working directory
        fs.realpathSync('/tmp'),             // System temp directory
        path.resolve('./tmp'),               // Project temp directory
        tmpdir()                             // OS temp directory
      ];
      
      // Check if path is within any allowed directory
      const isAllowed = allowedPrefixes.some(allowedPath => {
        try {
          const resolvedAllowed = fs.realpathSync(allowedPath);
          return realPath.startsWith(resolvedAllowed);
        } catch {
          // If we can't resolve the allowed path, skip it
          return false;
        }
      });
      
      if (!isAllowed) {
        return { valid: false, reason: `Path outside allowed directories: ${realPath}` };
      }
      
      // SECURITY: Block access to dangerous system paths (check both resolved and real paths)
      for (const dangerousPath of SECURITY_CONSTANTS.DANGEROUS_PATHS) {
        if (resolved.toLowerCase().startsWith(dangerousPath.toLowerCase()) || 
            realPath.toLowerCase().startsWith(dangerousPath.toLowerCase())) {
          return { valid: false, reason: `Access to system directory blocked: ${dangerousPath}` };
        }
      }
      
      // SECURITY: Check for excessively long paths
      if (resolved.length > 4096 || realPath.length > 4096) {
        return { valid: false, reason: 'Path too long (>4096 characters)' };
      }
      
      // SECURITY: Additional symlink validation for Unix-like systems
      if (process.platform !== 'win32') {
        // Check each component of the path for malicious symlinks
        const pathComponents = realPath.split(path.sep);
        let currentPath = path.sep === '\\' ? 'C:\\' : path.sep;
        
        for (const component of pathComponents.slice(1)) {
          currentPath = path.join(currentPath, component);
          
          try {
            if (fs.pathExistsSync(currentPath)) {
              const stats = fs.lstatSync(currentPath);
              if (stats.isSymbolicLink()) {
                const linkTarget = fs.readlinkSync(currentPath);
                
                // Block relative symlinks that could escape
                if (linkTarget.startsWith('../') || linkTarget.includes('../')) {
                  return { valid: false, reason: `Malicious symlink detected: ${currentPath} -> ${linkTarget}` };
                }
                
                // Block absolute symlinks to dangerous paths
                if (path.isAbsolute(linkTarget)) {
                  for (const dangerousPath of SECURITY_CONSTANTS.DANGEROUS_PATHS) {
                    if (linkTarget.toLowerCase().startsWith(dangerousPath.toLowerCase())) {
                      return { valid: false, reason: `Symlink points to dangerous absolute path: ${linkTarget}` };
                    }
                  }
                }
              }
            }
          } catch (componentError) {
            // If we can't validate a component, fail securely
            return { valid: false, reason: `Path component validation failed: ${componentError}` };
          }
        }
      }
      
      // SECURITY: Windows-specific checks
      if (process.platform === 'win32') {
        // Block Windows device names for both resolved and real paths
        const windowsDevices = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
        
        const resolvedFileName = path.basename(resolved).toUpperCase();
        const realFileName = path.basename(realPath).toUpperCase();
        const resolvedBaseName = resolvedFileName.split('.')[0];
        const realBaseName = realFileName.split('.')[0];
        
        if (windowsDevices.includes(resolvedBaseName) || windowsDevices.includes(realBaseName)) {
          return { valid: false, reason: `Windows device name detected: ${resolvedBaseName || realBaseName}` };
        }
        
        // Block paths with reserved characters
        const reservedChars = /[<>:"|?*]/;
        if (reservedChars.test(resolved) || reservedChars.test(realPath)) {
          return { valid: false, reason: 'Windows reserved characters detected in path' };
        }
      }
      
      // SECURITY: Block hidden system files and invalid patterns
      const resolvedFileName = path.basename(resolved);
      const realFileName = path.basename(realPath);
      
      // Block dangerous hidden file patterns
      if ((resolvedFileName.startsWith('.') && (resolvedFileName === '..' || resolvedFileName.startsWith('...'))) ||
          (realFileName.startsWith('.') && (realFileName === '..' || realFileName.startsWith('...')))) {
        return { valid: false, reason: 'Invalid hidden file pattern detected' };
      }
      
      // SECURITY: Final validation - ensure real path is the canonical form we expect
      try {
        const finalRealPath = fs.realpathSync(path.dirname(realPath));
        if (finalRealPath !== path.dirname(realPath)) {
          // Additional symlink found in parent directories
          for (const dangerousPath of SECURITY_CONSTANTS.DANGEROUS_PATHS) {
            if (finalRealPath.toLowerCase().startsWith(dangerousPath.toLowerCase())) {
              return { valid: false, reason: `Parent directory symlink points to dangerous path: ${finalRealPath}` };
            }
          }
        }
      } catch (finalError) {
        // Directory doesn't exist yet, which is acceptable for file creation
        // But we still validate the parent structure where it exists
      }
      
      // Return the real path as the sanitized path for maximum security
      return { valid: true, sanitizedPath: realPath };
    } catch (error) {
      return { valid: false, reason: `Path validation error: ${error}` };
    }
  }

  /**
   * Validate command for security vulnerabilities
   */
  validateCommand(command: string): CommandValidationResult {
    // Check command length
    if (command.length > SECURITY_CONSTANTS.MAX_COMMAND_LENGTH) {
      return { valid: false, reason: 'Command too long' };
    }

    // Check for dangerous patterns
    for (const pattern of SECURITY_CONSTANTS.DANGEROUS_COMMAND_PATTERNS) {
      if (pattern.test(command)) {
        return { valid: false, reason: `Dangerous pattern detected: ${pattern.source}` };
      }
    }

    // Extract the executable from the command
    const parts = command.trim().split(/\s+/);
    if (parts.length === 0) {
      return { valid: false, reason: 'Empty command' };
    }

    const executable = path.basename(parts[0]);
    
    // Check if executable is in whitelist
    if (!SECURITY_CONSTANTS.ALLOWED_EXECUTABLES.has(executable)) {
      return { valid: false, reason: `Executable '${executable}' not in whitelist` };
    }

    return { valid: true };
  }

  /**
   * Escape shell arguments to prevent injection
   */
  escapeShellArg(arg: string): string {
    // For simple cases, use single quotes which prevent most expansion
    if (/^[a-zA-Z0-9_\/\-\.]+$/.test(arg)) {
      return arg; // Safe characters, no escaping needed
    }
    
    // Escape single quotes and wrap in single quotes
    return `'${arg.replace(/'/g, "'\"'\"'")}'`;
  }

  /**
   * Parse and sanitize command into executable and arguments
   */
  parseCommand(command: string): ParsedCommand | null {
    const trimmed = command.trim();
    if (!trimmed) return null;

    // Simple parsing - split on spaces but respect quoted arguments
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < trimmed.length; i++) {
      const char = trimmed[i];
      
      if (!inQuotes && (char === '"' || char === "'")) {
        inQuotes = true;
        quoteChar = char;
      } else if (inQuotes && char === quoteChar) {
        inQuotes = false;
        quoteChar = '';
      } else if (!inQuotes && char === ' ') {
        if (current) {
          parts.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }
    
    if (current) {
      parts.push(current);
    }

    if (parts.length === 0) return null;

    return {
      executable: parts[0],
      args: parts.slice(1)
    };
  }
}