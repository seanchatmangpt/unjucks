import * as chalk from "chalk";
import type { CommandSuggestion } from "./cli-parser.js";

export interface ErrorRecoveryOptions {
  showSuggestions?: boolean;
  showNextSteps?: boolean;
  includeDocumentation?: boolean;
  verbose?: boolean;
}

export interface RecoveryContext {
  command?: string;
  args?: string[];
  error: Error | string;
  context?: string;
  suggestions?: CommandSuggestion[];
}

/**
 * Centralized error recovery system that replaces process.exit(1) with helpful guidance
 */
export class ErrorRecoverySystem {
  private readonly commonErrors = new Map<RegExp, string>();
  private readonly contextualSuggestions = new Map<string, string[]>();

  constructor() {
    this.initializeErrorPatterns();
    this.initializeContextualSuggestions();
  }

  private initializeErrorPatterns(): void {
    // Common error patterns and their user-friendly messages
    this.commonErrors.set(
      /template.*not found|no such file.*template/i,
      "Template not found"
    );
    this.commonErrors.set(
      /generator.*not found|no.*generator/i,
      "Generator not found"
    );
    this.commonErrors.set(
      /permission denied|eacces/i,
      "Permission denied"
    );
    this.commonErrors.set(
      /file.*exists|eexist/i,
      "File already exists"
    );
    this.commonErrors.set(
      /no space left|enospc/i,
      "Disk space full"
    );
    this.commonErrors.set(
      /invalid.*variable|undefined.*variable/i,
      "Template variable issue"
    );
    this.commonErrors.set(
      /syntax.*error|parse.*error/i,
      "Template syntax error"
    );
    this.commonErrors.set(
      /network.*error|fetch.*failed|timeout/i,
      "Network connectivity issue"
    );
  }

  private initializeContextualSuggestions(): void {
    this.contextualSuggestions.set("new", [
      "Run 'unjucks new' for interactive mode",
      "Check available templates: unjucks list",
      "Get help: unjucks help new",
      "Try preview mode: unjucks preview component MyExample"
    ]);

    this.contextualSuggestions.set("preview", [
      "Run 'unjucks preview' for interactive mode", 
      "Check template exists: unjucks list",
      "Try a different template name",
      "Get help: unjucks help preview"
    ]);

    this.contextualSuggestions.set("list", [
      "Check that _templates directory exists",
      "Initialize templates: unjucks init",
      "Verify template file extensions (.njk, .ejs)",
      "Get help: unjucks help list"
    ]);

    this.contextualSuggestions.set("generate", [
      "Use new syntax: unjucks new component MyButton",
      "Run interactive mode: unjucks new",
      "Preview first: unjucks preview component MyButton",
      "Check available templates: unjucks list"
    ]);

    this.contextualSuggestions.set("general", [
      "Check that you're in the right directory",
      "Verify project setup: unjucks init",
      "Get help: unjucks help",
      "Report issues: https://github.com/sachinraja/unjucks/issues"
    ]);
  }

  /**
   * Handle error with intelligent recovery suggestions
   */
  handleError(context: RecoveryContext, options: ErrorRecoveryOptions = {}): never {
    const errorMessage = context.error instanceof Error ? context.error.message : String(context.error);
    const friendlyMessage = this.getFriendlyErrorMessage(errorMessage);

    console.error(chalk.red(`\n❌ ${friendlyMessage}`));
    
    if (errorMessage !== friendlyMessage && options.verbose) {
      console.error(chalk.gray(`   Technical: ${errorMessage}`));
    }

    if (options.showSuggestions !== false) {
      this.showSuggestions(context);
    }

    if (options.showNextSteps !== false) {
      this.showNextSteps(context);
    }

    if (options.includeDocumentation) {
      this.showDocumentation(context);
    }

    if (options.verbose && context.error instanceof Error && context.error.stack) {
      console.error(chalk.gray("\n📍 Technical Details:"));
      console.error(chalk.gray(context.error.stack));
    }

    // Graceful exit with status code but no abrupt termination
    process.exit(1);
  }

  /**
   * Handle error with return value instead of exit (for testing and recovery)
   */
  recoverFromError(context: RecoveryContext, options: ErrorRecoveryOptions = {}): {
    success: false;
    message: string;
    suggestions: string[];
    canRecover: boolean;
  } {
    const errorMessage = context.error instanceof Error ? context.error.message : String(context.error);
    const friendlyMessage = this.getFriendlyErrorMessage(errorMessage);
    const suggestions = this.generateSuggestions(context);
    
    if (options.showSuggestions !== false) {
      console.error(chalk.red(`\n❌ ${friendlyMessage}`));
      this.showSuggestions(context);
    }

    return {
      success: false,
      message: friendlyMessage,
      suggestions,
      canRecover: this.canRecover(context)
    };
  }

  private getFriendlyErrorMessage(error: string): string {
    for (const [pattern, message] of this.commonErrors) {
      if (pattern.test(error)) {
        return message;
      }
    }
    return error;
  }

  private generateSuggestions(context: RecoveryContext): string[] {
    const suggestions: string[] = [];
    const errorMessage = context.error instanceof Error ? context.error.message : String(context.error);

    // Context-specific suggestions
    if (context.command) {
      const contextSuggestions = this.contextualSuggestions.get(context.command) || [];
      suggestions.push(...contextSuggestions);
    }

    // Error-specific suggestions
    if (/template.*not found|no such file.*template/i.test(errorMessage)) {
      suggestions.push(
        "Check template name spelling",
        "List available templates: unjucks list",
        "Initialize project: unjucks init",
        "Verify _templates directory exists"
      );
    } else if (/generator.*not found|no.*generator/i.test(errorMessage)) {
      suggestions.push(
        "Check generator name spelling",
        "See available generators: unjucks list",
        "Create generator directory in _templates/",
        "Use interactive mode to discover: unjucks new"
      );
    } else if (/permission denied|eacces/i.test(errorMessage)) {
      suggestions.push(
        "Check directory permissions",
        "Try different destination: --dest /tmp/test",
        "Run with appropriate privileges",
        "Verify write access to target directory"
      );
    } else if (/file.*exists|eexist/i.test(errorMessage)) {
      suggestions.push(
        "Use --force to overwrite existing files",
        "Choose different name or destination",
        "Preview first: unjucks preview <template> <name>",
        "Back up existing files before overwriting"
      );
    } else if (/invalid.*variable|undefined.*variable/i.test(errorMessage)) {
      suggestions.push(
        "Check template variable names",
        "Provide required variables as CLI flags",
        "Review template documentation",
        "Use preview mode to see required variables"
      );
    } else if (/syntax.*error|parse.*error/i.test(errorMessage)) {
      suggestions.push(
        "Check template file syntax",
        "Verify Nunjucks/EJS template format",
        "Review frontmatter YAML syntax",
        "Test template with simple variables first"
      );
    }

    // Command suggestions from CLI parser
    if (context.suggestions) {
      suggestions.push(
        ...context.suggestions.map(s => `Try: unjucks ${s.command} - ${s.description}`)
      );
    }

    // Fallback suggestions
    if (suggestions.length === 0) {
      suggestions.push(...(this.contextualSuggestions.get("general") || []));
    }

    return [...new Set(suggestions)]; // Remove duplicates
  }

  private showSuggestions(context: RecoveryContext): void {
    const suggestions = this.generateSuggestions(context);
    
    if (suggestions.length > 0) {
      console.log(chalk.blue("\n💡 Try this:"));
      suggestions.slice(0, 4).forEach(suggestion => {
        console.log(chalk.blue(`  • ${suggestion}`));
      });

      if (suggestions.length > 4) {
        console.log(chalk.gray(`  • ... and ${suggestions.length - 4} more suggestions`));
        console.log(chalk.gray("    Run with --verbose for all suggestions"));
      }
    }
  }

  private showNextSteps(context: RecoveryContext): void {
    const command = context.command;
    let nextSteps: string[] = [];

    switch (command) {
      case "new":
        nextSteps = [
          "Start with interactive mode: unjucks new",
          "Preview before creating: unjucks preview <template> <name>",
          "Check what's available: unjucks list"
        ];
        break;
      case "preview":
        nextSteps = [
          "Try interactive preview: unjucks preview",
          "Check available templates: unjucks list",
          "Get command help: unjucks help preview"
        ];
        break;
      case "list":
        nextSteps = [
          "Initialize project templates: unjucks init",
          "Create _templates directory manually",
          "Check project documentation"
        ];
        break;
      default:
        nextSteps = [
          "Get general help: unjucks help",
          "Start with basics: unjucks new",
          "Explore templates: unjucks list"
        ];
    }

    if (nextSteps.length > 0) {
      console.log(chalk.blue("\n📝 Next Steps:"));
      nextSteps.forEach(step => {
        console.log(chalk.gray(`  • ${step}`));
      });
    }
  }

  private showDocumentation(context: RecoveryContext): void {
    console.log(chalk.blue("\n📚 Documentation:"));
    console.log(chalk.gray("  • Command Guide: unjucks help"));
    console.log(chalk.gray("  • Template Creation: unjucks help templates"));
    console.log(chalk.gray("  • Examples: unjucks help examples"));
    console.log(chalk.gray("  • Online Docs: https://github.com/sachinraja/unjucks"));
  }

  private canRecover(context: RecoveryContext): boolean {
    const errorMessage = context.error instanceof Error ? context.error.message : String(context.error);
    
    // Non-recoverable errors
    const fatalPatterns = [
      /disk.*full|enospc/i,
      /out of memory|enomem/i,
      /system.*error/i
    ];

    return !fatalPatterns.some(pattern => pattern.test(errorMessage));
  }

  /**
   * Provide migration guidance for legacy syntax
   */
  suggestMigration(oldSyntax: string, newSyntax: string): void {
    console.log(chalk.yellow("\n⚠️  Legacy Syntax Detected"));
    console.log(chalk.gray(`   Old: ${oldSyntax}`));
    console.log(chalk.green(`   New: ${newSyntax}`));
    console.log(chalk.blue("\n💡 Migration Benefits:"));
    console.log(chalk.gray("   • Clearer intent and simpler commands"));
    console.log(chalk.gray("   • Better error messages and suggestions"));
    console.log(chalk.gray("   • Improved interactive experience"));
    console.log(chalk.gray("   • Future-proof syntax"));
  }

  /**
   * Show contextual help for specific situations
   */
  showContextualHelp(command: string, situation: string): void {
    const helpTexts: Record<string, Record<string, string>> = {
      new: {
        noTemplates: "It looks like you don't have any templates set up yet. Run 'unjucks init' to get started with some basic templates.",
        invalidName: "Names should start with a letter and contain only letters, numbers, underscores, and hyphens.",
        noPermissions: "Make sure you have write permissions to the destination directory."
      },
      preview: {
        firstTime: "Preview mode lets you see what would be generated without creating files. It's perfect for exploring templates safely.",
        noChanges: "No files would be modified. This template creates completely new files."
      }
    };

    const commandHelp = helpTexts[command];
    if (commandHelp && commandHelp[situation]) {
      console.log(chalk.cyan(`\nℹ️  ${commandHelp[situation]}`));
    }
  }
}

export const errorRecovery = new ErrorRecoverySystem();