/**
 * ContentInjector - Injection modes (append, prepend, lineAt, after, before)
 * Handles all content injection strategies with idempotent operations
 */

import path from "node:path";
import type { 
  IContentInjector, 
  IFileOperationService, 
  IFileLockManager,
  InjectionResult, 
  InjectionOptions, 
  OperationMode 
} from "./interfaces.js";
import type { FrontmatterConfig } from "../frontmatter-parser.js";
import { SECURITY_CONSTANTS } from "./interfaces.js";

export class ContentInjector implements IContentInjector {
  constructor(
    private fileOps: IFileOperationService,
    private lockManager: IFileLockManager
  ) {}

  /**
   * Main content processing dispatcher
   */
  async processContent(
    filePath: string,
    content: string,
    mode: OperationMode,
    frontmatter: FrontmatterConfig,
    options: InjectionOptions
  ): Promise<InjectionResult> {
    // Check if file exists
    const fileExists = await this.fileOps.pathExists(filePath);

    if (mode.mode === "write") {
      return await this.writeFile(filePath, content, frontmatter, options, fileExists);
    }

    if (!fileExists) {
      return {
        success: false,
        message: `Cannot inject into non-existent file: ${filePath}`,
        changes: []
      };
    }

    switch (mode.mode) {
      case "inject": {
        return await this.injectContent(filePath, content, mode.target, frontmatter, options);
      }
      case "append": {
        return await this.appendContent(filePath, content, options);
      }
      case "prepend": {
        return await this.prependContent(filePath, content, options);
      }
      case "lineAt": {
        return await this.injectAtLine(filePath, content, mode.lineNumber!, options);
      }
      case "conditional": {
        return await this.conditionalInject(filePath, content, frontmatter, options);
      }
      default: {
        return {
          success: false,
          message: `Unknown operation mode: ${mode.mode}`,
          changes: []
        };
      }
    }
  }

  /**
   * Write file atomically with race condition prevention
   */
  async writeFile(
    filePath: string,
    content: string,
    frontmatter: FrontmatterConfig,
    options: InjectionOptions,
    fileExists: boolean
  ): Promise<InjectionResult> {
    return this.lockManager.withLock(filePath, async () => {
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
      await this.fileOps.ensureDir(path.dirname(filePath));

      // Create backup if requested
      if (options.backup && fileExists) {
        await this.fileOps.createBackup(filePath);
      }

      // Write file atomically
      await this.fileOps.writeFile(filePath, content, { atomic: true });

      result.success = true;
      result.message = `File written: ${filePath}`;
      result.changes = [`write: ${filePath}`];
      
      // Handle chmod permissions if specified
      if (frontmatter.chmod && !options.dry) {
        try {
          let mode: number;
          
          if (typeof frontmatter.chmod === "string") {
            // Validate chmod string format
            if (!SECURITY_CONSTANTS.VALID_CHMOD_PATTERN.test(frontmatter.chmod)) {
              result.message += ` (warning: invalid chmod format ${frontmatter.chmod})`;
              return result;
            }
            mode = Number.parseInt(frontmatter.chmod, 8);
          } else {
            mode = frontmatter.chmod;
          }

          // Validate numeric value
          if (mode < 0 || mode > 0o7777) {
            result.message += ` (warning: invalid chmod value ${mode})`;
            return result;
          }

          await this.fileOps.chmod(filePath, mode);
        } catch (error) {
          result.message += ` (warning: chmod ${frontmatter.chmod} failed: ${error})`;
          // Don't fail the whole operation for chmod issues
        }
      }
      
      return result;
    });
  }

  /**
   * Inject content at specific markers or positions
   */
  async injectContent(
    filePath: string,
    content: string,
    target: string | undefined,
    frontmatter: FrontmatterConfig,
    options: InjectionOptions
  ): Promise<InjectionResult> {
    return this.lockManager.withLock(filePath, async () => {
      const result: InjectionResult = {
        success: false,
        message: "",
        changes: [],
      };

      const existingContent = await this.fileOps.readFile(filePath);
    
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

        // Determine injection position based on frontmatter
        if (frontmatter.before) {
          // Insert before the target line
          lines.splice(targetLineIndex, 0, content);
        } else {
          // Insert after the target line (default)
          lines.splice(targetLineIndex + 1, 0, content);
        }
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
        await this.fileOps.createBackup(filePath);
      }

      await this.fileOps.writeFile(filePath, newContent, { atomic: true });

      result.success = true;
      result.message = `Content injected into: ${filePath}`;
      result.changes = [`inject: ${filePath} ${target ? `after "${target}"` : "at end"}`];
      
      return result;
    });
  }

  /**
   * Append content to end of file
   */
  async appendContent(
    filePath: string,
    content: string,
    options: InjectionOptions
  ): Promise<InjectionResult> {
    return this.lockManager.withLock(filePath, async () => {
      const result: InjectionResult = {
        success: false,
        message: "",
        changes: [],
      };

      const existingContent = await this.fileOps.readFile(filePath);
    
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
        await this.fileOps.createBackup(filePath);
      }

      await this.fileOps.writeFile(filePath, newContent, { atomic: true });

      result.success = true;
      result.message = `Content appended to: ${filePath}`;
      result.changes = [`append: ${filePath}`];
      
      return result;
    });
  }

  /**
   * Prepend content to beginning of file
   */
  async prependContent(
    filePath: string,
    content: string,
    options: InjectionOptions
  ): Promise<InjectionResult> {
    return this.lockManager.withLock(filePath, async () => {
      const result: InjectionResult = {
        success: false,
        message: "",
        changes: [],
      };

      const existingContent = await this.fileOps.readFile(filePath);
    
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
        await this.fileOps.createBackup(filePath);
      }

      await this.fileOps.writeFile(filePath, newContent, { atomic: true });

      result.success = true;
      result.message = `Content prepended to: ${filePath}`;
      result.changes = [`prepend: ${filePath}`];
      
      return result;
    });
  }

  /**
   * Inject content at specific line number
   */
  async injectAtLine(
    filePath: string,
    content: string,
    lineNumber: number,
    options: InjectionOptions
  ): Promise<InjectionResult> {
    return this.lockManager.withLock(filePath, async () => {
      const result: InjectionResult = {
        success: false,
        message: "",
        changes: [],
      };

      const existingContent = await this.fileOps.readFile(filePath);
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
        await this.fileOps.createBackup(filePath);
      }

      await this.fileOps.writeFile(filePath, newContent, { atomic: true });

      result.success = true;
      result.message = `Content injected at line ${lineNumber} in: ${filePath}`;
      result.changes = [`lineAt: ${filePath}:${lineNumber}`];
      
      return result;
    });
  }

  /**
   * Conditional injection with skipIf evaluation
   */
  async conditionalInject(
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

    const existingContent = await this.fileOps.readFile(filePath);
    
    // Check if content already exists (idempotent)
    if (existingContent.includes(content.trim())) {
      result.success = true;
      result.message = `Content already exists in: ${filePath}`;
      result.skipped = true;
      return result;
    }

    // For conditional mode, we'll use regular inject logic
    // The skipIf condition would be evaluated at a higher level
    return await this.injectContent(filePath, content, frontmatter.after || frontmatter.before, frontmatter, options);
  }
}