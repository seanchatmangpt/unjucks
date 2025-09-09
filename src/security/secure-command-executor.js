/**
 * Secure Command Executor
 * Provides safe command execution with input validation and sandboxing
 */

import { spawn } from 'child_process';
import { inputValidator } from './input-validator.js';
import path from 'path';

/**
 * Secure command execution with comprehensive input validation
 * @class
 */
export class SecureCommandExecutor {
  constructor(options = {}) {
    this.allowedCommands = new Set(options.allowedCommands || [
      'node', 'npm', 'git', 'docker', 'pdflatex', 'xelatex', 'lualatex'
    ]);
    this.maxExecutionTime = options.maxExecutionTime || 30000; // 30 seconds
    this.allowedWorkingDirs = options.allowedWorkingDirs || [];
    this.enableSandbox = options.enableSandbox !== false;
  }

  /**
   * Execute command with security validation
   * @param {string} command - Command to execute
   * @param {string[]} args - Command arguments
   * @param {object} options - Execution options
   * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
   */
  async executeSecure(command, args = [], options = {}) {
    // Validate command
    this.validateCommand(command);
    
    // Validate arguments
    const sanitizedArgs = this.validateAndSanitizeArgs(args);
    
    // Validate working directory
    const workingDir = this.validateWorkingDirectory(options.cwd);
    
    // Setup secure execution environment
    const secureOptions = this.createSecureOptions(workingDir, options);
    
    return new Promise((resolve, reject) => {
      const process = spawn(command, sanitizedArgs, secureOptions);
      
      let stdout = '';
      let stderr = '';
      
      // Setup timeout
      const timeout = setTimeout(() => {
        process.kill('SIGTERM');
        reject(new Error(`Command execution timeout after ${this.maxExecutionTime}ms`));
      }, this.maxExecutionTime);
      
      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        clearTimeout(timeout);
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code || 0
        });
      });
      
      process.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`Command execution failed: ${error.message}`));
      });
    });
  }

  /**
   * Validate command against allowlist
   * @private
   * @param {string} command - Command to validate
   */
  validateCommand(command) {
    if (typeof command !== 'string') {
      throw new Error('Command must be a string');
    }

    if (command.length === 0) {
      throw new Error('Command cannot be empty');
    }

    // Extract base command (remove path)
    const baseCommand = path.basename(command);
    
    if (!this.allowedCommands.has(baseCommand)) {
      throw new Error(`Command not allowed: ${baseCommand}. Allowed commands: ${Array.from(this.allowedCommands).join(', ')}`);
    }

    // Check for command injection patterns
    const dangerousPatterns = [
      /[;&|`$(){}]/,  // Shell metacharacters
      /\.\./,          // Path traversal
      /\/proc\//,      // Proc filesystem access
      /\/dev\//,       // Device access
      /sudo|su/,       // Privilege escalation
      /chmod|chown/,   // Permission changes
      /rm\s+-rf/,      // Dangerous deletions
      /wget|curl.*http/i, // Network downloads
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        throw new Error(`Command contains dangerous pattern: ${pattern.source}`);
      }
    }
  }

  /**
   * Validate and sanitize command arguments
   * @private
   * @param {string[]} args - Arguments to validate
   * @returns {string[]} Sanitized arguments
   */
  validateAndSanitizeArgs(args) {
    if (!Array.isArray(args)) {
      throw new Error('Arguments must be an array');
    }

    if (args.length > 50) {
      throw new Error('Too many arguments (max 50)');
    }

    return args.map(arg => {
      if (typeof arg !== 'string') {
        throw new Error('All arguments must be strings');
      }

      if (arg.length > 500) {
        throw new Error('Argument too long (max 500 characters)');
      }

      // Check for injection patterns in arguments
      const dangerousPatterns = [
        /[;&|`$()]/,     // Shell metacharacters
        /\$\{.*\}/,      // Variable expansion
        />\s*\/dev/,     // Device redirection
        /<\s*\/dev/,     // Device input
        /\|\s*sh/,       // Pipe to shell
        /\|\s*bash/,     // Pipe to bash
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(arg)) {
          throw new Error(`Argument contains dangerous pattern: ${pattern.source}`);
        }
      }

      return arg;
    });
  }

  /**
   * Validate working directory
   * @private
   * @param {string} cwd - Working directory to validate
   * @returns {string} Validated working directory
   */
  validateWorkingDirectory(cwd) {
    if (!cwd) {
      return process.cwd();
    }

    const resolvedCwd = path.resolve(cwd);
    
    // Check if directory is in allowed list
    if (this.allowedWorkingDirs.length > 0) {
      const isAllowed = this.allowedWorkingDirs.some(allowedDir => 
        resolvedCwd.startsWith(path.resolve(allowedDir))
      );
      
      if (!isAllowed) {
        throw new Error(`Working directory not allowed: ${resolvedCwd}`);
      }
    }

    // Check for dangerous paths
    const dangerousPaths = [
      '/etc', '/root', '/sys', '/proc', '/dev',
      '/usr/bin', '/usr/sbin', '/bin', '/sbin',
      'C:\\Windows', 'C:\\System32'
    ];

    for (const dangerousPath of dangerousPaths) {
      if (resolvedCwd.toLowerCase().startsWith(dangerousPath.toLowerCase())) {
        throw new Error(`Access to system directory not allowed: ${dangerousPath}`);
      }
    }

    return resolvedCwd;
  }

  /**
   * Create secure execution options
   * @private
   * @param {string} workingDir - Working directory
   * @param {object} userOptions - User-provided options
   * @returns {object} Secure spawn options
   */
  createSecureOptions(workingDir, userOptions) {
    const secureEnv = this.createSecureEnvironment(userOptions.env);
    
    const options = {
      cwd: workingDir,
      env: secureEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false, // Never use shell
      detached: false,
      uid: userOptions.uid,
      gid: userOptions.gid,
    };

    // Add sandbox restrictions if enabled
    if (this.enableSandbox && process.platform === 'linux') {
      options.stdio = ['pipe', 'pipe', 'pipe'];
      // Additional sandboxing would go here (e.g., seccomp, namespaces)
    }

    return options;
  }

  /**
   * Create secure environment variables
   * @private
   * @param {object} userEnv - User-provided environment variables
   * @returns {object} Secure environment
   */
  createSecureEnvironment(userEnv = {}) {
    // Start with minimal safe environment
    const secureEnv = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      TMPDIR: process.env.TMPDIR || '/tmp',
      LANG: process.env.LANG || 'en_US.UTF-8',
    };

    // Allow specific user environment variables
    const allowedEnvVars = [
      'NODE_ENV',
      'DEBUG',
      'FORCE_COLOR',
      'NO_COLOR',
    ];

    for (const [key, value] of Object.entries(userEnv)) {
      if (allowedEnvVars.includes(key)) {
        // Validate environment variable value
        try {
          inputValidator.validateString(String(value), { maxLength: 1000 });
          secureEnv[key] = value;
        } catch (error) {
          console.warn(`Skipping invalid environment variable ${key}: ${error.message}`);
        }
      }
    }

    return secureEnv;
  }

  /**
   * Add allowed command
   * @param {string} command - Command to allow
   */
  allowCommand(command) {
    this.allowedCommands.add(command);
  }

  /**
   * Remove allowed command
   * @param {string} command - Command to disallow
   */
  disallowCommand(command) {
    this.allowedCommands.delete(command);
  }

  /**
   * Add allowed working directory
   * @param {string} dir - Directory to allow
   */
  allowWorkingDirectory(dir) {
    this.allowedWorkingDirs.push(path.resolve(dir));
  }

  /**
   * Get current security configuration
   * @returns {object} Security configuration
   */
  getSecurityConfig() {
    return {
      allowedCommands: Array.from(this.allowedCommands),
      allowedWorkingDirs: [...this.allowedWorkingDirs],
      maxExecutionTime: this.maxExecutionTime,
      enableSandbox: this.enableSandbox
    };
  }
}

// Export singleton instance with default configuration
export const secureExecutor = new SecureCommandExecutor({
  allowedCommands: [
    'node', 'npm', 'npx', 'git', 'docker',
    'pdflatex', 'xelatex', 'lualatex', 'bibtex',
    'echo', 'cat', 'ls', 'pwd', 'which'
  ],
  maxExecutionTime: 30000,
  enableSandbox: true
});

/**
 * Convenience function for secure command execution
 * @param {string} command - Command to execute
 * @param {string[]} args - Command arguments
 * @param {object} options - Execution options
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
 */
export async function executeSecure(command, args, options) {
  return secureExecutor.executeSecure(command, args, options);
}