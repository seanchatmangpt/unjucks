/**
 * CommandExecutor - Shell command execution with security
 * Handles secure command execution with proper validation and sandboxing
 */

import { spawn } from "node:child_process";
import type { 
  ICommandExecutor, 
  ISecurityValidator,
  CommandExecutionResult 
} from "./interfaces.js";
import { SECURITY_CONSTANTS } from "./interfaces.js";

export class CommandExecutor implements ICommandExecutor {
  constructor(private securityValidator: ISecurityValidator) {}

  /**
   * Execute shell commands with comprehensive security validation
   */
  async executeCommands(
    commands: string | string[],
    workingDir?: string
  ): Promise<CommandExecutionResult> {
    const commandArray = Array.isArray(commands) ? commands : [commands];
    const outputs: string[] = [];
    const errors: string[] = [];

    // Validate working directory if provided
    if (workingDir) {
      const pathValidation = this.securityValidator.validateFilePath(workingDir);
      if (!pathValidation.valid) {
        errors.push(`Invalid working directory: ${pathValidation.reason}`);
        return { success: false, outputs, errors };
      }
    }

    for (const command of commandArray) {
      try {
        // Step 1: Validate the command for security vulnerabilities
        const validation = this.securityValidator.validateCommand(command);
        if (!validation.valid) {
          errors.push(`Command rejected: ${validation.reason} - Command: ${command}`);
          continue;
        }

        // Step 2: Parse command into executable and arguments
        const parsed = this.securityValidator.parseCommand(command);
        if (!parsed) {
          errors.push(`Failed to parse command: ${command}`);
          continue;
        }

        // Step 3: Escape arguments to prevent injection
        const escapedArgs = parsed.args.map(arg => this.securityValidator.escapeShellArg(arg));

        // Step 4: Execute using spawn (more secure than exec)
        const { stdout, stderr } = await this.executeCommandSecure(
          parsed.executable, 
          escapedArgs, 
          workingDir
        );
        
        if (stdout) outputs.push(stdout.trim());
        if (stderr) {
          // For some commands, stderr might contain warnings rather than errors
          // We'll add it to outputs but also track it
          outputs.push(`[stderr] ${stderr.trim()}`);
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`Command execution failed: ${command} - ${errorMessage}`);
      }
    }

    return {
      success: errors.length === 0,
      outputs,
      errors,
    };
  }

  /**
   * Execute command using spawn for better security
   */
  async executeCommandSecure(
    executable: string, 
    args: string[], 
    workingDir?: string
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(executable, args, {
        cwd: workingDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        shell: false // Important: don't use shell to prevent injection
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (error) => {
        reject(new Error(`Failed to start process: ${error.message}`));
      });

      child.on('close', (code, signal) => {
        if (signal) {
          reject(new Error(`Command terminated by signal ${signal}`));
        } else if (code !== 0) {
          reject(new Error(`Command failed with exit code ${code}: ${stderr || 'Unknown error'}`));
        } else {
          resolve({ stdout, stderr });
        }
      });

      // Kill process if it exceeds timeout
      const timeoutHandle = setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGTERM');
          setTimeout(() => {
            if (!child.killed) {
              child.kill('SIGKILL');
            }
          }, 5000); // Give 5 seconds for graceful shutdown
        }
      }, SECURITY_CONSTANTS.COMMAND_TIMEOUT);

      // Clear timeout when process completes
      child.on('close', () => {
        clearTimeout(timeoutHandle);
      });

      child.on('error', () => {
        clearTimeout(timeoutHandle);
      });
    });
  }
}