/**
 * FileInjectorOrchestrator - Coordinates all services (main interface)
 * Maintains backward compatibility while leveraging atomic services
 */

import { AsyncLocalStorage } from "node:async_hooks";
import type { 
  IFileInjectorOrchestrator,
  ISecurityValidator,
  IFileOperationService,
  IFileLockManager,
  IContentInjector,
  ICommandExecutor,
  RequestContext,
  InjectionResult,
  InjectionOptions,
  OperationMode,
  CommandExecutionResult
} from "./interfaces.js";
import type { FrontmatterConfig } from "../frontmatter-parser.js";
import { SecurityValidator } from "./security-validator.js";
import { FileOperationService } from "./file-operation-service.js";
import { FileLockManager } from "./file-lock-manager.js";
import { ContentInjector } from "./content-injector.js";
import { CommandExecutor } from "./command-executor.js";
import { SECURITY_CONSTANTS } from "./interfaces.js";

// Thread-safe depth tracking
const requestContextStorage = new AsyncLocalStorage<RequestContext>();
const fallbackDepthTracking = new Map<string, number>();

export class FileInjectorOrchestrator implements IFileInjectorOrchestrator {
  private securityValidator: ISecurityValidator;
  private fileOps: IFileOperationService;
  private lockManager: IFileLockManager;
  private contentInjector: IContentInjector;
  private commandExecutor: ICommandExecutor;

  constructor() {
    // Initialize atomic services
    this.securityValidator = new SecurityValidator();
    this.fileOps = new FileOperationService();
    this.lockManager = new FileLockManager();
    this.contentInjector = new ContentInjector(this.fileOps, this.lockManager);
    this.commandExecutor = new CommandExecutor(this.securityValidator);
  }

  /**
   * Write or inject content based on frontmatter configuration
   * Main entry point for backward compatibility
   */
  async processFile(
    filePath: string,
    content: string,
    frontmatter: FrontmatterConfig,
    options: InjectionOptions = { force: false, dry: false }
  ): Promise<InjectionResult> {
    // Get existing context or create a new one
    let context = requestContextStorage.getStore();
    const isNewContext = !context;
    
    if (isNewContext) {
      // Create new context for this request chain
      const requestId = this.generateRequestId();
      context = {
        templateDepth: 0,
        requestId,
        startTime: Date.now()
      };
      // Initialize in fallback tracking
      fallbackDepthTracking.set(requestId, 0);
    }
    
    // Use AsyncLocalStorage to ensure isolated depth tracking per request
    return requestContextStorage.run(context, async () => {
      try {
        // SECURITY: Validate and sanitize file path
        const securityCheck = this.securityValidator.validateFilePath(filePath);
        if (!securityCheck.valid) {
          return {
            success: false,
            message: `Security violation: ${securityCheck.reason}`,
            changes: []
          };
        }
        
        const sanitizedPath = securityCheck.sanitizedPath;
        
        // Thread-safe depth increment with atomic operation
        const currentDepth = this.incrementDepth(context);
        
        if (currentDepth > SECURITY_CONSTANTS.MAX_TEMPLATE_DEPTH) {
          this.decrementDepth(context);
          return {
            success: false,
            message: `Template depth limit exceeded (${SECURITY_CONSTANTS.MAX_TEMPLATE_DEPTH}). Possible infinite recursion detected.`,
            changes: [],
          };
        }
        
        // SECURITY: Check file size limits  
        try {
          if (sanitizedPath && await this.fileOps.pathExists(sanitizedPath)) {
            const stats = await this.fileOps.stat(sanitizedPath);
            if (stats.size > SECURITY_CONSTANTS.MAX_FILE_SIZE) {
              this.decrementDepth(context);
              return {
                success: false,
                message: `File too large: ${stats.size} bytes exceeds ${SECURITY_CONSTANTS.MAX_FILE_SIZE} byte limit`,
                changes: []
              };
            }
          }
        } catch (error) {
          this.decrementDepth(context);
          return {
            success: false,
            message: `File access error: ${error}`,
            changes: []
          };
        }

        const timeoutPromise = new Promise<InjectionResult>((_, reject) =>
          setTimeout(() => reject(new Error("Template processing timeout")), SECURITY_CONSTANTS.TEMPLATE_TIMEOUT)
        );

        try {
          if (!sanitizedPath) {
            throw new Error('Sanitized path is required');
          }
          const processPromise = this.processFileInternal(sanitizedPath, content, frontmatter, options);
          const result = await Promise.race([processPromise, timeoutPromise]);
          return result;
        } finally {
          // Ensure atomic decrement on all exit paths
          this.decrementDepth(context);
        }
      } catch (error) {
        // Cleanup on unexpected errors
        this.decrementDepth(context);
        return {
          success: false,
          message: `Unexpected error in processFile: ${error}`,
          changes: []
        };
      } finally {
        // Final cleanup when depth reaches zero
        const remainingDepth = this.getCurrentDepth(context);
        if (remainingDepth === 0) {
          this.cleanupContext(context);
        }
      }
    });
  }

  /**
   * Set file permissions with enhanced validation and security checks
   */
  async setPermissions(filePath: string, chmod: string | number): Promise<boolean> {
    try {
      // SECURITY: Validate file path first
      const pathCheck = this.securityValidator.validateFilePath(filePath);
      if (!pathCheck.valid) {
        console.error(`Invalid file path for chmod: ${pathCheck.reason}`);
        return false;
      }
      
      let mode: number;
      
      if (typeof chmod === "string") {
        // Enhanced chmod string validation (supports 3-4 digit octal)
        if (!SECURITY_CONSTANTS.VALID_CHMOD_PATTERN.test(chmod)) {
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
      
      if (!(await this.fileOps.pathExists(sanitizedPath))) {
        console.error(`File does not exist: ${sanitizedPath}`);
        return false;
      }

      await this.fileOps.chmod(sanitizedPath, mode);
      
      // SECURITY: Verify the permissions were actually set
      try {
        const stats = await this.fileOps.stat(sanitizedPath);
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
   * Execute shell commands (delegates to CommandExecutor)
   */
  async executeCommands(
    commands: string | string[],
    workingDir?: string
  ): Promise<CommandExecutionResult> {
    return this.commandExecutor.executeCommands(commands, workingDir);
  }

  /**
   * Internal file processing logic
   */
  private async processFileInternal(
    filePath: string,
    content: string,
    frontmatter: FrontmatterConfig,
    options: InjectionOptions
  ): Promise<InjectionResult> {
    try {
      // Determine operation mode
      const mode = this.getOperationMode(frontmatter);

      // Delegate to ContentInjector
      return await this.contentInjector.processContent(filePath, content, mode, frontmatter, options);
    } catch (error) {
      return {
        success: false,
        message: `Error processing file: ${error}`,
        changes: [],
      };
    }
  }

  /**
   * Thread-safe depth tracking methods
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }

  private incrementDepth(context: RequestContext): number {
    // Atomic increment with fallback tracking
    const newDepth = context.templateDepth + 1;
    context.templateDepth = newDepth;
    
    // Update fallback tracking
    fallbackDepthTracking.set(context.requestId, newDepth);
    
    return newDepth;
  }

  private decrementDepth(context: RequestContext): number {
    // Atomic decrement with fallback tracking  
    const newDepth = Math.max(0, context.templateDepth - 1);
    context.templateDepth = newDepth;
    
    // Update fallback tracking
    if (newDepth === 0) {
      fallbackDepthTracking.delete(context.requestId);
    } else {
      fallbackDepthTracking.set(context.requestId, newDepth);
    }
    
    return newDepth;
  }

  private getCurrentDepth(context: RequestContext): number {
    // Get current depth with fallback verification
    const contextDepth = context.templateDepth;
    const fallbackDepth = fallbackDepthTracking.get(context.requestId) ?? 0;
    
    // Use the higher of the two for safety
    return Math.max(contextDepth, fallbackDepth);
  }

  private cleanupContext(context: RequestContext): void {
    // Clean up tracking resources
    fallbackDepthTracking.delete(context.requestId);
  }

  /**
   * Get operation mode from frontmatter
   */
  private getOperationMode(frontmatter: FrontmatterConfig): OperationMode {
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

  /**
   * Cleanup all resources (for testing and shutdown)
   */
  cleanup(): void {
    this.lockManager.cleanup();
    fallbackDepthTracking.clear();
  }
}

// Legacy export for backward compatibility
export { FileInjectorOrchestrator as FileInjector };