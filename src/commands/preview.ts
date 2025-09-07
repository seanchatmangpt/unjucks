import { defineCommand } from "citty";
import * as chalk from "chalk";
import { Generator } from "../lib/generator.js";
import { promptForGenerator, promptForTemplate } from "../lib/prompts.js";
import {
  validators,
  displayValidationResults,
  createCommandError,
} from "../lib/command-validation.js";
import type {
  GenerateCommandArgs,
  CommandResult,
} from "../types/commands.js";
import { CommandError, UnjucksCommandError } from "../types/commands.js";
import * as ora from "ora";
import * as path from "path";

/**
 * Format file size for human-readable display
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Preview command - Safe exploration of template generation
 * 
 * This command allows users to safely explore what would be generated without
 * creating any files. Provides detailed preview with content, size, and impact analysis.
 * 
 * Features:
 * - Complete dry-run analysis with no file system changes
 * - File size and impact calculation
 * - Content preview with syntax highlighting hints
 * - Conflict detection for existing files
 * - Variable substitution preview
 * - Migration and refactoring impact analysis
 * 
 * @example
 * ```bash
 * # Preview what would be created
 * unjucks preview component MyButton
 * unjucks preview api UserService --template graphql
 * 
 * # Interactive preview mode
 * unjucks preview
 * 
 * # Detailed analysis
 * unjucks preview component MyButton --detailed --analyze-conflicts
 * ```
 */
export const previewCommand = defineCommand({
  meta: {
    name: "preview", 
    description: "Preview what would be generated without creating files",
  },
  args: {
    template: {
      type: "positional",
      description: "Template to preview (e.g., component, api, model)",
      required: false,
    },
    name: {
      type: "positional",
      description: "Name for the generated entity (e.g., MyButton, UserService)", 
      required: false,
    },
    dest: {
      type: "string",
      description: "Target destination directory (default: current directory)",
      default: ".",
    },
    template_variant: {
      type: "string", 
      description: "Specific template variant (e.g., react, vue, angular)",
      alias: "template",
    },
    detailed: {
      type: "boolean",
      description: "Show detailed preview with content snippets",
      default: false,
      alias: "d",
    },
    analyze_conflicts: {
      type: "boolean",
      description: "Analyze potential conflicts with existing files",
      default: false,
      alias: "c",
    },
    show_variables: {
      type: "boolean",
      description: "Show template variables and their resolved values",
      default: false,
      alias: "vars",
    },
    interactive: {
      type: "boolean",
      description: "Interactive preview mode with template selection",
      default: false,
      alias: "i",
    },
    format: {
      type: "string",
      description: "Output format (table, json, simple)",
      default: "table",
      alias: "f",
    },
    verbose: {
      type: "boolean",
      description: "Show verbose analysis information",
      default: false,
      alias: "v",
    },
    quiet: {
      type: "boolean",
      description: "Minimal output mode",
      default: false,
      alias: "q",
    },
  },
  async run(context: any) {
    const { args } = context;
    const startTime = Date.now();
    const spinner = ora();

    try {
      if (!args.quiet) {
        console.log(chalk.blue("🔍 Unjucks Preview"));
        console.log(chalk.gray("   Safe exploration mode - no files will be created"));
      }

      const generator = new Generator();
      let templateChoice = args.template;
      let entityName = args.name;

      // Interactive mode when no arguments provided
      if (!templateChoice || args.interactive) {
        if (!args.quiet) {
          console.log(chalk.cyan("\n✨ Interactive Preview Mode"));
          console.log(chalk.gray("   Explore templates safely before generation"));
        }

        const availableGenerators = await generator.listGenerators();
        
        if (availableGenerators.length === 0) {
          const errorMessage = "No templates found to preview";
          const suggestions = [
            "Run 'unjucks init' to set up templates",
            "Create _templates directory with template files",
            "Check that templates have .ejs or .njk extensions"
          ];

          console.error(chalk.red(`\n❌ ${errorMessage}`));
          console.log(chalk.blue("\n💡 Quick fixes:"));
          suggestions.forEach(suggestion => {
            console.log(chalk.blue(`  • ${suggestion}`));
          });

          return {
            success: false,
            message: errorMessage, 
            suggestions,
            files: []
          };
        }

        const selected = await promptForGenerator(availableGenerators, {
          message: "What template would you like to preview?",
          filter: templateChoice,
        });

        templateChoice = selected.generator;
        if (selected.template) {
          templateChoice = `${templateChoice}/${selected.template}`;
        }

        // Get sample name if not provided
        if (!entityName) {
          entityName = "SampleName";
          if (!args.quiet) {
            console.log(chalk.gray(`   Using sample name: ${entityName} (you can specify your own)`));
          }
        }
      }

      // Validate we have what we need for preview
      if (!templateChoice) {
        const errorMessage = "Template is required for preview";
        const suggestions = [
          "Run 'unjucks preview' for interactive mode", 
          "Specify template: unjucks preview component MyButton",
          "List available: unjucks list",
        ];

        console.error(chalk.red(`\n❌ ${errorMessage}`));
        console.log(chalk.blue("\n💡 Try this:"));
        suggestions.forEach(suggestion => {
          console.log(chalk.blue(`  • ${suggestion}`));
        });

        return {
          success: false,
          message: errorMessage,
          suggestions,
          files: []
        };
      }

      if (!entityName) {
        entityName = "PreviewExample";
        if (!args.quiet) {
          console.log(chalk.yellow(`   Using example name: ${entityName}`));
        }
      }

      // Parse template choice
      const [generatorName, templateName] = templateChoice.includes('/') 
        ? templateChoice.split('/') 
        : [templateChoice, args.template_variant];

      if (!args.quiet) {
        console.log(chalk.cyan(`\n🎯 Previewing ${generatorName}${templateName ? `/${templateName}` : ''}`));
        console.log(chalk.gray(`   Sample name: ${entityName}`));
        console.log(chalk.gray(`   Target destination: ${args.dest}`)); 
        console.log(chalk.yellow("   📋 This is a preview - no files will be created"));
      }

      if (!args.quiet) {
        spinner.start("Analyzing template...");
      }

      // Run generation in dry mode 
      const result = await generator.generate({
        generator: generatorName,
        template: templateName || generatorName,
        dest: args.dest,
        force: false,
        dry: true, // Key: this enables preview mode
        variables: {
          name: entityName,
          // Extract additional variables from CLI flags
          ...Object.fromEntries(
            Object.entries(args).filter(([key]) => 
              !['template', 'name', 'dest', 'detailed', 'analyze_conflicts', 'show_variables', 
                'interactive', 'format', 'verbose', 'quiet', 'template_variant'].includes(key)
            )
          )
        },
      });

      if (!args.quiet) {
        spinner.stop();
      }

      const duration = Date.now() - startTime;

      // Enhanced preview analysis
      await displayPreviewResults(result, args, duration);

      return {
        success: true,
        message: `Preview completed for ${entityName}`,
        files: result.files.map((f: any) => f.path),
        duration,
      } as CommandResult;

    } catch (error) {
      if (!args.quiet) {
        spinner.stop();
      }

      // Enhanced error handling with context-aware suggestions
      if (error instanceof UnjucksCommandError) {
        console.error(chalk.red(`\n❌ Preview failed: ${error.message}`));
        
        if (error.suggestions && error.suggestions.length > 0) {
          console.log(chalk.blue("\n💡 Suggestions:"));
          error.suggestions.forEach((suggestion) => {
            console.log(chalk.blue(`  • ${suggestion}`));
          });
        }
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`\n❌ Preview failed: ${errorMessage}`));

        console.log(chalk.blue("\n💡 Try this:"));
        console.log(chalk.blue("  • Check template exists: unjucks list"));
        console.log(chalk.blue("  • Verify template syntax and variables"));
        console.log(chalk.blue("  • Use interactive mode: unjucks preview"));
        console.log(chalk.blue("  • Get help: unjucks help preview"));

        if (args.verbose && error instanceof Error && error.stack) {
          console.error(chalk.gray("\n📍 Technical details:"));
          console.error(chalk.gray(error.stack));
        }
      }

      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
        files: [],
        duration: Date.now() - startTime
      } as CommandResult;
    }
  },
});

/**
 * Display comprehensive preview results with analysis
 */
async function displayPreviewResults(result: any, args: any, duration: number): Promise<void> {
  const files = result.files || [];
  
  if (!args.quiet) {
    console.log(chalk.yellow("\n🔍 Preview Results - No files were created"));
    console.log(chalk.gray(`   Analysis completed in ${duration}ms`));
  }

  if (files.length === 0) {
    console.log(chalk.yellow("\n   No files would be generated"));
    return;
  }

  // Calculate summary statistics
  let totalSize = 0;
  const actionCounts = { created: 0, modified: 0, overwritten: 0, skipped: 0 };
  const conflicts: string[] = [];

  for (const file of files) {
    if (file.injectionResult?.size) {
      totalSize += file.injectionResult.size;
    }
    const action = file.injectionResult?.action || 'created';
    if (action in actionCounts) {
      actionCounts[action as keyof typeof actionCounts]++;
    }

    // Check for conflicts if analysis requested
    if (args.analyze_conflicts) {
      try {
        const fs = await import('fs');
        if (fs.existsSync(file.path)) {
          conflicts.push(file.path);
        }
      } catch (e) {
        // Ignore filesystem errors in preview mode
      }
    }
  }

  // Display summary
  if (!args.quiet) {
    console.log(chalk.blue(`\n📊 Generation Summary:`));
    if (actionCounts.created > 0) {
      console.log(chalk.green(`   + ${actionCounts.created} files would be created`));
    }
    if (actionCounts.modified > 0) {
      console.log(chalk.yellow(`   ~ ${actionCounts.modified} files would be modified`));
    }
    if (actionCounts.overwritten > 0) {
      console.log(chalk.red(`   ! ${actionCounts.overwritten} files would be overwritten`));
    }
    if (actionCounts.skipped > 0) {
      console.log(chalk.gray(`   - ${actionCounts.skipped} files would be skipped`));
    }
    console.log(chalk.blue(`   📏 Total size: ${formatFileSize(totalSize)}`));
  }

  // Conflict analysis
  if (args.analyze_conflicts && conflicts.length > 0) {
    console.log(chalk.red(`\n⚠️  Potential Conflicts (${conflicts.length} files):`));
    conflicts.forEach(conflict => {
      console.log(chalk.red(`   ! ${path.relative(process.cwd(), conflict)}`));
    });
    console.log(chalk.gray("   Use --force to overwrite existing files"));
  }

  // File details based on format
  if (args.format === 'json') {
    console.log(JSON.stringify({
      summary: { totalFiles: files.length, totalSize, actionCounts, conflicts },
      files: files.map((f: any) => ({
        path: f.path,
        size: f.injectionResult?.size || 0,
        action: f.injectionResult?.action || 'created',
        content: args.detailed ? f.content : undefined
      }))
    }, null, 2));
  } else if (args.format === 'simple') {
    files.forEach((file: any) => {
      console.log(file.path);
    });
  } else {
    // Table format (default)
    displayFileTable(files, args);
  }

  // Show variables if requested
  if (args.show_variables && result.variables) {
    console.log(chalk.blue(`\n🔧 Template Variables:`));
    Object.entries(result.variables).forEach(([key, value]) => {
      console.log(chalk.cyan(`   ${key}: `) + chalk.white(String(value)));
    });
  }

  // Next steps guidance
  if (!args.quiet) {
    console.log(chalk.blue("\n📝 Next Steps:"));
    console.log(chalk.gray("   • Run without preview to create the files:"));
    console.log(chalk.white(`     unjucks new ${args.template} ${args.name || 'YourName'}`));
    if (conflicts.length > 0) {
      console.log(chalk.gray("   • Add --force to overwrite existing files"));
    }
    console.log(chalk.gray("   • Use different --dest to change location"));
    console.log(chalk.gray("   • Modify template variables with --variable value"));
  }
}

/**
 * Display files in table format with enhanced information
 */
function displayFileTable(files: any[], args: any): void {
  console.log(chalk.blue(`\n📋 Files Preview (${files.length} files):`));
  
  files.forEach((file: any, index: number) => {
    const relativePath = path.relative(process.cwd(), file.path);
    const size = file.injectionResult?.size || (file.content ? file.content.length : 0);
    const action = file.injectionResult?.action || 'create';
    
    // Action indicator
    let actionIcon = '?';
    let actionColor = chalk.white;
    switch (action) {
      case 'created': case 'create':
        actionIcon = '+'; actionColor = chalk.green; break;
      case 'modified': case 'modify':
        actionIcon = '~'; actionColor = chalk.yellow; break;
      case 'overwritten': case 'overwrite':
        actionIcon = '!'; actionColor = chalk.red; break;
      case 'skipped': case 'skip':
        actionIcon = '-'; actionColor = chalk.gray; break;
    }
    
    console.log(actionColor(`   ${actionIcon} ${relativePath}`) + chalk.gray(` (${formatFileSize(size)})`));
    
    if (args.detailed && file.content) {
      // Show content preview
      const lines = file.content.split('\n');
      const preview = lines.slice(0, 5).join('\n');
      const indent = '     ';
      
      console.log(chalk.gray(`${indent}Content preview:`));
      preview.split('\n').forEach(line => {
        if (line.trim()) {
          console.log(chalk.gray(`${indent}│ ${line}`));
        }
      });
      
      if (lines.length > 5) {
        console.log(chalk.gray(`${indent}│ ... (${lines.length - 5} more lines)`));
      }
      console.log(chalk.gray(`${indent}└─`));
    }
    
    // Show frontmatter details if available and verbose
    if (args.verbose && file.frontmatter) {
      const fm = file.frontmatter;
      if (fm.inject || fm.append || fm.prepend) {
        console.log(chalk.gray(`     Mode: injection (${Object.keys(fm).filter(k => ['inject', 'append', 'prepend', 'before', 'after'].includes(k)).join(', ')})`));
      }
      if (fm.chmod) {
        console.log(chalk.gray(`     Permissions: ${fm.chmod}`));
      }
      if (fm.sh) {
        console.log(chalk.gray(`     Commands: ${Array.isArray(fm.sh) ? fm.sh.join(', ') : fm.sh}`));
      }
    }
  });
}