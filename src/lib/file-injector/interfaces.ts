/**
 * Core interfaces and types for the File Injector atomic services
 */

import type { FrontmatterConfig } from "../frontmatter-parser.js";

// Thread-safe depth tracking context
export interface RequestContext {
  templateDepth: number;
  requestId: string;
  startTime: number;
}

// File lock with versioning for ABA prevention
export interface FileLock {
  promise: Promise<any>;
  timestamp: number;
  lockId: string;
  version: number;
  processId: number;
  acquired: boolean;
}

// Injection results and options
export interface InjectionResult {
  success: boolean;
  message: string;
  changes: string[];
  skipped?: boolean;
  size?: number;
  exists?: boolean;
  action?: string;
}

export interface InjectionOptions {
  force: boolean;
  dry: boolean;
  backup?: boolean;
}

// Security validation result
export interface SecurityValidationResult {
  valid: boolean;
  reason?: string;
  sanitizedPath?: string;
}

// Command validation and execution results
export interface CommandValidationResult {
  valid: boolean;
  reason?: string;
}

export interface CommandExecutionResult {
  success: boolean;
  outputs: string[];
  errors: string[];
}

export interface ParsedCommand {
  executable: string;
  args: string[];
}

// Operation mode detection
export interface OperationMode {
  mode: "write" | "inject" | "append" | "prepend" | "lineAt" | "conditional";
  target?: string;
  lineNumber?: number;
  direction?: "before" | "after";
}

// Service interfaces
export interface ISecurityValidator {
  validateFilePath(filePath: string): SecurityValidationResult;
  validateCommand(command: string): CommandValidationResult;
  escapeShellArg(arg: string): string;
  parseCommand(command: string): ParsedCommand | null;
}

export interface IFileOperationService {
  pathExists(filePath: string): Promise<boolean>;
  readFile(filePath: string): Promise<string>;
  writeFile(filePath: string, content: string, options?: { atomic?: boolean }): Promise<void>;
  ensureDir(dirPath: string): Promise<void>;
  stat(filePath: string): Promise<{ size: number; mode: number }>;
  chmod(filePath: string, mode: number): Promise<void>;
  createBackup(filePath: string): Promise<string>;
}

export interface IFileLockManager {
  withLock<T>(filePath: string, operation: () => Promise<T>): Promise<T>;
  cleanup(): void;
}

export interface IContentInjector {
  processContent(
    filePath: string,
    content: string,
    mode: OperationMode,
    frontmatter: FrontmatterConfig,
    options: InjectionOptions
  ): Promise<InjectionResult>;
  
  writeFile(
    filePath: string,
    content: string,
    frontmatter: FrontmatterConfig,
    options: InjectionOptions,
    fileExists: boolean
  ): Promise<InjectionResult>;
  
  injectContent(
    filePath: string,
    content: string,
    target: string | undefined,
    frontmatter: FrontmatterConfig,
    options: InjectionOptions
  ): Promise<InjectionResult>;
  
  appendContent(filePath: string, content: string, options: InjectionOptions): Promise<InjectionResult>;
  prependContent(filePath: string, content: string, options: InjectionOptions): Promise<InjectionResult>;
  injectAtLine(filePath: string, content: string, lineNumber: number, options: InjectionOptions): Promise<InjectionResult>;
  conditionalInject(filePath: string, content: string, frontmatter: FrontmatterConfig, options: InjectionOptions): Promise<InjectionResult>;
}

export interface ICommandExecutor {
  executeCommands(commands: string | string[], workingDir?: string): Promise<CommandExecutionResult>;
  executeCommandSecure(executable: string, args: string[], workingDir?: string): Promise<{ stdout: string; stderr: string }>;
}

export interface IFileInjectorOrchestrator {
  processFile(
    filePath: string,
    content: string,
    frontmatter: FrontmatterConfig,
    options?: InjectionOptions
  ): Promise<InjectionResult>;
  
  setPermissions(filePath: string, chmod: string | number): Promise<boolean>;
  executeCommands(commands: string | string[], workingDir?: string): Promise<CommandExecutionResult>;
}

// Security constants
export const SECURITY_CONSTANTS = {
  MAX_TEMPLATE_DEPTH: 10,
  TEMPLATE_TIMEOUT: 30000, // 30 seconds
  FILE_OPERATION_TIMEOUT: 5000, // 5 seconds per file operation
  VALID_CHMOD_PATTERN: /^[0-7]{3,4}$/,
  MAX_FILE_SIZE: 100_000_000, // 100MB limit
  DANGEROUS_PATHS: [
    '/etc', '/root', '/sys', '/proc', '/dev', '/var/log',
    'C:\\Windows', 'C:\\Program Files', 'C:\\System32'
  ],
  COMMAND_TIMEOUT: 30000, // 30 seconds
  MAX_COMMAND_LENGTH: 1000,
  ALLOWED_EXECUTABLES: new Set([
    'npm', 'yarn', 'pnpm', 'bun', 'node', 'deno',
    'git', 'echo', 'ls', 'cat', 'touch', 'mkdir', 'cp', 'mv',
    'chmod', 'chown', 'find', 'grep', 'sed', 'awk',
    'tsc', 'tsx', 'eslint', 'prettier', 'jest', 'mocha', 'vitest',
    'docker', 'docker-compose', 'kubectl',
    'python', 'pip', 'poetry', 'pipenv',
    'cargo', 'rustc', 'go', 'java', 'javac', 'mvn', 'gradle'
  ]),
  DANGEROUS_COMMAND_PATTERNS: [
    /[;&|`$(){}[\]]/,           // Shell metacharacters
    /\.\./,                     // Path traversal
    /rm\s+-rf?\s+\//,           // Dangerous rm commands
    /sudo|su\s/,                // Privilege escalation
    /wget|curl.*\|/,            // Command injection via pipes
    /eval|exec/,                // Code execution
    />/,                        // Output redirection
    /</,                        // Input redirection
    /\|\s*sh/,                  // Pipe to shell
    /nc|netcat/,                // Network utilities
    /\/dev\/tcp/,               // Network redirection
  ],
  SHELL_METACHARACTERS: /[|&;()$`\\"\s<>{}[\]*?~]/g,
};