import fs from "fs-extra";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { FrontmatterConfig } from "./frontmatter-parser.js";

const execAsync = promisify(exec);

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
  /**
   * Write or inject content based on frontmatter configuration
   */
  async processFile(
    filePath: string,
    content: string,
    frontmatter: FrontmatterConfig,
    options: InjectionOptions = { force: false, dry: false }
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
        return await this.writeFile(filePath, content, options, fileExists);
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
   * Write file atomically
   */
  private async writeFile(
    filePath: string,
    content: string,
    options: InjectionOptions,
    fileExists: boolean
  ): Promise<InjectionResult> {
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

    // Write file
    await fs.writeFile(filePath, content, "utf-8");

    result.success = true;
    result.message = `File written: ${filePath}`;
    result.changes = [`write: ${filePath}`];
    
    return result;
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
  }

  /**
   * Append content to end of file
   */
  private async appendContent(
    filePath: string,
    content: string,
    options: InjectionOptions
  ): Promise<InjectionResult> {
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
  }

  /**
   * Prepend content to beginning of file
   */
  private async prependContent(
    filePath: string,
    content: string,
    options: InjectionOptions
  ): Promise<InjectionResult> {
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
  }

  /**
   * Set file permissions
   */
  async setPermissions(filePath: string, chmod: string | number): Promise<boolean> {
    try {
      const mode = typeof chmod === "string" ? Number.parseInt(chmod, 8) : chmod;
      await fs.chmod(filePath, mode);
      return true;
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
   * Get operation mode from frontmatter
   */
  private getOperationMode(frontmatter: FrontmatterConfig): {
    mode: "write" | "inject" | "append" | "prepend" | "lineAt";
    target?: string;
    lineNumber?: number;
  } {
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