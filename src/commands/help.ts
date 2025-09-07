import { defineCommand } from "citty";
import * as chalk from "chalk";
import { cliParser } from "../lib/cli-parser.js";
import { Generator } from "../lib/generator.js";

/**
 * Enhanced help command with context-sensitive guidance
 * 
 * Features:
 * - Command-specific help with examples
 * - Template-specific help with variables
 * - Interactive guidance for common workflows
 * - Troubleshooting suggestions
 * - Migration guidance for legacy syntax
 * 
 * @example
 * ```bash
 * # General help
 * unjucks help
 * 
 * # Command-specific help
 * unjucks help new
 * unjucks help preview
 * 
 * # Template-specific help
 * unjucks help component
 * unjucks help api
 * ```
 */
export const helpCommand = defineCommand({
  meta: {
    name: "help",
    description: "Get contextual help and guidance for commands and templates",
  },
  args: {
    topic: {
      type: "positional",
      description: "Help topic (command name or template name)",
      required: false,
    },
    examples: {
      type: "boolean", 
      description: "Show practical examples",
      default: false,
      alias: "e",
    },
    troubleshooting: {
      type: "boolean",
      description: "Show troubleshooting guide",
      default: false,
      alias: "t",
    },
    migration: {
      type: "boolean",
      description: "Show migration guide from legacy syntax",
      default: false,
      alias: "m",
    },
    interactive: {
      type: "boolean",
      description: "Interactive help mode",
      default: false,
      alias: "i",
    },
  },
  async run(context: any) {
    const { args } = context;
    
    if (args.interactive) {
      return await showInteractiveHelp();
    }
    
    if (!args.topic) {
      return showGeneralHelp(args);
    }
    
    // Check if topic is a command
    const commandHelp = getCommandHelp(args.topic);
    if (commandHelp) {
      return showCommandHelp(args.topic, commandHelp, args);
    }
    
    // Check if topic is a template
    try {
      const generator = new Generator();
      const generators = await generator.listGenerators();
      const foundGenerator = generators.find(g => g.name === args.topic);
      
      if (foundGenerator) {
        return await showTemplateHelp(args.topic, args);
      }
    } catch (error) {
      // Template check failed, continue to general suggestions
    }
    
    // Topic not found - show suggestions
    const suggestions = cliParser.generateSuggestions(args.topic);
    showTopicSuggestions(args.topic, suggestions);
  },
});

function showGeneralHelp(args: any): void {
  console.log(chalk.blue("🚀 Unjucks - Unified Code Generation CLI"));
  console.log(chalk.gray("   Smart scaffolding with clear intent"));
  
  console.log(chalk.cyan("\n📋 Primary Commands:"));
  console.log(chalk.white("  unjucks new <template> [name]     ") + chalk.gray("Create files from templates"));
  console.log(chalk.white("  unjucks preview <template> [name] ") + chalk.gray("Preview what would be created"));
  console.log(chalk.white("  unjucks list [generator]          ") + chalk.gray("Show available templates"));
  console.log(chalk.white("  unjucks help [topic]              ") + chalk.gray("Get contextual help"));
  
  console.log(chalk.cyan("\n✨ Quick Start:"));
  console.log(chalk.gray("  1. Explore what's available:      ") + chalk.white("unjucks list"));
  console.log(chalk.gray("  2. Preview before creating:       ") + chalk.white("unjucks preview component MyButton"));
  console.log(chalk.gray("  3. Create with confidence:        ") + chalk.white("unjucks new component MyButton"));
  
  if (args.examples) {
    showExamples();
  }
  
  if (args.troubleshooting) {
    showTroubleshooting();
  }
  
  if (args.migration) {
    showMigrationGuide();
  }
  
  console.log(chalk.blue("\n💡 Pro Tips:"));
  console.log(chalk.gray("  • Use interactive mode:           ") + chalk.white("unjucks new"));
  console.log(chalk.gray("  • Preview first, create second:   ") + chalk.white("unjucks preview -> unjucks new"));
  console.log(chalk.gray("  • Get specific help:              ") + chalk.white("unjucks help new"));
  console.log(chalk.gray("  • Explore templates:              ") + chalk.white("unjucks help component"));
  
  console.log(chalk.blue("\n📚 More Help:"));
  console.log(chalk.gray("  • Command examples:               ") + chalk.white("unjucks help --examples"));
  console.log(chalk.gray("  • Troubleshooting guide:          ") + chalk.white("unjucks help --troubleshooting"));
  console.log(chalk.gray("  • Migration from legacy:          ") + chalk.white("unjucks help --migration"));
}

function getCommandHelp(command: string): string | null {
  const helpTexts: Record<string, string> = {
    new: `
${chalk.bold("unjucks new")} - Primary command for creating files

${chalk.blue("Purpose:")}
  Clear, intent-driven file generation with intelligent scaffolding.
  
${chalk.blue("Usage:")}
  unjucks new <template> [name] [options]
  unjucks new                     # Interactive mode
  
${chalk.blue("Examples:")}
  ${chalk.white("unjucks new component MyButton")}
    Creates a new component named MyButton using default template
    
  ${chalk.white("unjucks new api UserService --template graphql")}
    Creates a GraphQL API service
    
  ${chalk.white("unjucks new page AboutPage --dest src/pages --withLayout")}
    Creates a page with layout in specific directory
    
  ${chalk.white("unjucks new")}
    Interactive mode - guided template selection

${chalk.blue("Key Options:")}
  --dest <path>        Target directory (default: current)
  --template <variant> Specific template variant
  --force              Overwrite existing files
  --interactive        Force interactive mode
  
${chalk.blue("Pro Tips:")}
  • Start interactive: ${chalk.white("unjucks new")}
  • Preview first: ${chalk.white("unjucks preview component MyButton")}
  • Check templates: ${chalk.white("unjucks list")}`,

    preview: `
${chalk.bold("unjucks preview")} - Safe exploration before creation

${chalk.blue("Purpose:")}
  See exactly what would be generated without creating any files.
  Perfect for exploring templates and understanding impact.
  
${chalk.blue("Usage:")}
  unjucks preview <template> [name] [options]
  unjucks preview                    # Interactive mode
  
${chalk.blue("Examples:")}
  ${chalk.white("unjucks preview component MyButton")}
    Shows files and content that would be created
    
  ${chalk.white("unjucks preview api UserService --detailed")}
    Detailed preview with content snippets
    
  ${chalk.white("unjucks preview component MyButton --analyze-conflicts")}
    Check for potential conflicts with existing files
    
  ${chalk.white("unjucks preview")}
    Interactive preview mode

${chalk.blue("Key Options:")}
  --detailed           Show content previews
  --analyze-conflicts  Check for file conflicts
  --show-variables     Display template variables
  --format json        Output as JSON
  
${chalk.blue("Pro Tips:")}
  • Always preview complex generations
  • Use detailed mode to understand content
  • Check conflicts before overwriting`,

    list: `
${chalk.bold("unjucks list")} - Discover available templates

${chalk.blue("Purpose:")}
  Explore generators and templates with filtering and search capabilities.
  
${chalk.blue("Usage:")}
  unjucks list [generator] [options]
  
${chalk.blue("Examples:")}
  ${chalk.white("unjucks list")}
    Show all available generators
    
  ${chalk.white("unjucks list component")}
    Show templates for component generator
    
  ${chalk.white("unjucks list --search react")}
    Search for React-related templates
    
  ${chalk.white("unjucks list --detailed")}
    Show variables and descriptions

${chalk.blue("Key Options:")}
  --detailed          Show template variables
  --search <term>     Search generators/templates
  --format json       Output as JSON
  --category <cat>    Filter by category
  
${chalk.blue("Pro Tips:")}
  • Start here to explore what's available
  • Use search to find specific technologies
  • Detailed mode shows required variables`,

    help: `
${chalk.bold("unjucks help")} - Contextual guidance system

${chalk.blue("Purpose:")}
  Get specific help for commands, templates, and common workflows.
  
${chalk.blue("Usage:")}
  unjucks help [topic] [options]
  
${chalk.blue("Examples:")}
  ${chalk.white("unjucks help")}
    General help and overview
    
  ${chalk.white("unjucks help new")}
    Detailed help for new command
    
  ${chalk.white("unjucks help component")}
    Help for component template
    
  ${chalk.white("unjucks help --examples")}
    Show practical examples

${chalk.blue("Key Options:")}
  --examples          Show practical examples
  --troubleshooting   Show troubleshooting guide
  --migration         Show migration from legacy syntax
  --interactive       Interactive help mode`,
    
    generate: `
${chalk.bold("unjucks generate")} - Legacy command (deprecated)

${chalk.yellow("⚠️  This command uses legacy syntax")}

${chalk.blue("Migration:")}
  ${chalk.gray("Old:")} unjucks generate component react MyButton
  ${chalk.green("New:")} unjucks new component MyButton --template react
  
${chalk.blue("Benefits of new syntax:")}
  • Clearer intent with "new" verb
  • Simpler command structure
  • Better error messages
  • Enhanced interactive mode
  
${chalk.blue("Quick Migration:")}
  Replace "generate" with "new" and move template to --template flag
  Most other options remain the same`
  };
  
  return helpTexts[command] || null;
}

function showCommandHelp(command: string, helpText: string, args: any): void {
  console.log(helpText);
  
  if (args.examples) {
    showCommandExamples(command);
  }
}

function showCommandExamples(command: string): void {
  const examples: Record<string, string[]> = {
    new: [
      "# Quick component creation",
      "unjucks new component UserCard",
      "",
      "# API with specific template",
      "unjucks new api UserService --template rest",
      "",
      "# Interactive exploration", 
      "unjucks new",
      "",
      "# With custom destination",
      "unjucks new page HomePage --dest src/pages --withLayout"
    ],
    preview: [
      "# Safe exploration",
      "unjucks preview component UserCard --detailed",
      "",
      "# Check for conflicts",
      "unjucks preview api UserService --analyze-conflicts",
      "",
      "# Interactive preview",
      "unjucks preview"
    ],
    list: [
      "# Explore all templates",
      "unjucks list --detailed",
      "",
      "# Search for specific tech",
      "unjucks list --search react",
      "",
      "# Component templates only",
      "unjucks list component"
    ]
  };
  
  const commandExamples = examples[command];
  if (commandExamples) {
    console.log(chalk.blue("\n📝 More Examples:"));
    commandExamples.forEach(line => {
      if (line.startsWith('#')) {
        console.log(chalk.gray(line));
      } else if (line.startsWith('unjucks')) {
        console.log(chalk.white(`  ${line}`));
      } else {
        console.log(line);
      }
    });
  }
}

async function showTemplateHelp(templateName: string, args: any): Promise<void> {
  try {
    const generator = new Generator();
    const templates = await generator.listTemplates(templateName);
    
    console.log(chalk.blue(`🎯 ${templateName} Generator Help`));
    console.log(chalk.gray(`   Templates and usage for ${templateName}`));
    
    if (templates.length === 0) {
      console.log(chalk.yellow(`\n⚠️  No templates found for ${templateName}`));
      console.log(chalk.blue("\n💡 Try:"));
      console.log(chalk.blue("  • Check spelling: unjucks list"));
      console.log(chalk.blue("  • Create template directory: _templates/" + templateName));
      return;
    }
    
    console.log(chalk.cyan(`\n📋 Available Templates (${templates.length}):`));
    
    for (const template of templates) {
      console.log(chalk.green(`\n  • ${template.name}`));
      if (template.description) {
        console.log(chalk.gray(`    ${template.description}`));
      }
      
      // Show usage examples
      console.log(chalk.blue("    Usage:"));
      console.log(chalk.white(`      unjucks new ${templateName} MyExample`));
      console.log(chalk.white(`      unjucks preview ${templateName} MyExample`));
      
      if (template.name !== templateName) {
        console.log(chalk.white(`      unjucks new ${templateName} MyExample --template ${template.name}`));
      }
      
      // Show variables if available
      if (args.examples && (template as any).variables && (template as any).variables.length > 0) {
        console.log(chalk.blue("    Variables:"));
        (template as any).variables.forEach((variable: any) => {
          const required = variable.required ? "*" : "";
          const type = variable.type ? ` (${variable.type})` : "";
          console.log(chalk.gray(`      --${variable.name}${required}${type}`));
          if (variable.description) {
            console.log(chalk.gray(`        ${variable.description}`));
          }
        });
      }
    }
    
    console.log(chalk.blue(`\n💡 ${templateName} Tips:`));
    console.log(chalk.gray("  • Preview first: ") + chalk.white(`unjucks preview ${templateName} MyExample`));
    console.log(chalk.gray("  • Interactive mode: ") + chalk.white("unjucks new"));
    console.log(chalk.gray("  • See all templates: ") + chalk.white("unjucks list " + templateName));
    
    if (args.examples) {
      console.log(chalk.blue("\n📝 Common Patterns:"));
      console.log(chalk.white(`  # Basic ${templateName}`));
      console.log(chalk.white(`  unjucks new ${templateName} Basic${templateName}`));
      console.log(chalk.white(`  `));
      console.log(chalk.white(`  # With custom destination`));
      console.log(chalk.white(`  unjucks new ${templateName} Custom${templateName} --dest src/${templateName}s`));
      console.log(chalk.white(`  `));
      console.log(chalk.white(`  # Preview before creating`));
      console.log(chalk.white(`  unjucks preview ${templateName} Test${templateName} --detailed`));
    }
    
  } catch (error) {
    console.error(chalk.red(`\n❌ Error getting ${templateName} help:`));
    console.error(chalk.red(`   ${error instanceof Error ? error.message : String(error)}`));
    
    console.log(chalk.blue("\n💡 Try:"));
    console.log(chalk.blue("  • Check available templates: unjucks list"));
    console.log(chalk.blue("  • Verify template directory exists"));
    console.log(chalk.blue("  • Get general help: unjucks help"));
  }
}

function showTopicSuggestions(topic: string, suggestions: any[]): void {
  console.log(chalk.red(`\n❌ Help topic not found: ${topic}`));
  
  if (suggestions.length > 0) {
    console.log(chalk.blue("\n💡 Did you mean:"));
    suggestions.forEach(suggestion => {
      console.log(chalk.blue(`  • ${chalk.bold(suggestion.command)} - ${suggestion.description}`));
    });
  }
  
  console.log(chalk.blue("\n📚 Available Help Topics:"));
  console.log(chalk.gray("  Commands: ") + chalk.white("new, preview, list, help, generate"));
  console.log(chalk.gray("  Templates: ") + chalk.white("Use 'unjucks list' to see available templates"));
  console.log(chalk.gray("  Examples: ") + chalk.white("unjucks help --examples"));
  console.log(chalk.gray("  Troubleshooting: ") + chalk.white("unjucks help --troubleshooting"));
}

function showExamples(): void {
  console.log(chalk.blue("\n📝 Practical Examples:"));
  
  console.log(chalk.cyan("\n  🎯 Getting Started:"));
  console.log(chalk.white("  unjucks list                    ") + chalk.gray("# Explore what's available"));
  console.log(chalk.white("  unjucks new                     ") + chalk.gray("# Interactive mode"));
  console.log(chalk.white("  unjucks preview component MyBtn ") + chalk.gray("# Safe preview"));
  console.log(chalk.white("  unjucks new component MyBtn     ") + chalk.gray("# Create files"));
  
  console.log(chalk.cyan("\n  🔧 Advanced Usage:"));
  console.log(chalk.white("  unjucks new api UserService --template rest --dest src/api"));
  console.log(chalk.white("  unjucks preview page HomePage --detailed --analyze-conflicts"));
  console.log(chalk.white("  unjucks list --search react --detailed"));
  console.log(chalk.white("  unjucks new component Button --withTests --withStories"));
  
  console.log(chalk.cyan("\n  📋 Workflow Examples:"));
  console.log(chalk.gray("  1. Explore:    ") + chalk.white("unjucks list"));
  console.log(chalk.gray("  2. Preview:    ") + chalk.white("unjucks preview api UserService"));
  console.log(chalk.gray("  3. Create:     ") + chalk.white("unjucks new api UserService"));
  console.log(chalk.gray("  4. Customize:  ") + chalk.white("Edit generated files as needed"));
}

function showTroubleshooting(): void {
  console.log(chalk.blue("\n🔧 Troubleshooting Guide:"));
  
  console.log(chalk.cyan("\n  ❌ No templates found:"));
  console.log(chalk.gray("  • Run: ") + chalk.white("unjucks init"));
  console.log(chalk.gray("  • Create: ") + chalk.white("_templates directory"));
  console.log(chalk.gray("  • Check: ") + chalk.white("Template file extensions (.njk, .ejs)"));
  
  console.log(chalk.cyan("\n  ❌ Permission denied:"));
  console.log(chalk.gray("  • Check: ") + chalk.white("Directory permissions"));
  console.log(chalk.gray("  • Try: ") + chalk.white("Different destination --dest /tmp"));
  console.log(chalk.gray("  • Run: ") + chalk.white("With appropriate privileges"));
  
  console.log(chalk.cyan("\n  ❌ File already exists:"));
  console.log(chalk.gray("  • Use: ") + chalk.white("--force to overwrite"));
  console.log(chalk.gray("  • Try: ") + chalk.white("Different name or destination"));
  console.log(chalk.gray("  • Preview: ") + chalk.white("unjucks preview ... --analyze-conflicts"));
  
  console.log(chalk.cyan("\n  ❌ Template variables missing:"));
  console.log(chalk.gray("  • Check: ") + chalk.white("unjucks help <template>"));
  console.log(chalk.gray("  • Use: ") + chalk.white("Interactive mode"));
  console.log(chalk.gray("  • Preview: ") + chalk.white("With --show-variables"));
  
  console.log(chalk.blue("\n💡 Still stuck?"));
  console.log(chalk.gray("  • Try: ") + chalk.white("unjucks help --examples"));
  console.log(chalk.gray("  • Use: ") + chalk.white("Interactive mode for guidance"));
  console.log(chalk.gray("  • Report: ") + chalk.white("Issues at https://github.com/sachinraja/unjucks/issues"));
}

function showMigrationGuide(): void {
  console.log(chalk.blue("\n🔄 Migration from Legacy Syntax:"));
  
  console.log(chalk.cyan("\n  📋 Command Changes:"));
  console.log(chalk.gray("  Old: ") + chalk.red("unjucks generate component react MyButton"));
  console.log(chalk.gray("  New: ") + chalk.green("unjucks new component MyButton --template react"));
  
  console.log(chalk.gray("  Old: ") + chalk.red("unjucks generate api express UserService"));
  console.log(chalk.gray("  New: ") + chalk.green("unjucks new api UserService --template express"));
  
  console.log(chalk.cyan("\n  ✨ New Benefits:"));
  console.log(chalk.gray("  • Clearer intent with 'new' verb"));
  console.log(chalk.gray("  • Simplified command structure"));
  console.log(chalk.gray("  • Better error messages and suggestions"));
  console.log(chalk.gray("  • Enhanced interactive mode"));
  console.log(chalk.gray("  • Preview command for safe exploration"));
  
  console.log(chalk.cyan("\n  🔄 Migration Steps:"));
  console.log(chalk.gray("  1. Replace 'generate' with 'new'"));
  console.log(chalk.gray("  2. Move template name to --template flag"));
  console.log(chalk.gray("  3. Keep other options the same"));
  console.log(chalk.gray("  4. Try interactive mode: unjucks new"));
  
  console.log(chalk.cyan("\n  🎯 Quick Reference:"));
  console.log(chalk.white("  generate <gen> <template> <name>  →  new <gen> <name> --template <template>"));
  console.log(chalk.white("  generate <gen> <template>         →  new <gen> --template <template>"));
  console.log(chalk.white("  generate                          →  new"));
}

async function showInteractiveHelp(): Promise<void> {
  console.log(chalk.blue("🎯 Interactive Help Mode"));
  console.log(chalk.gray("   Let's find what you need"));
  
  try {
    const { default: inquirer } = await import("inquirer");
    
    const answers = await inquirer.prompt([
      {
        type: "list",
        name: "helpType",
        message: "What do you need help with?",
        choices: [
          { name: "🚀 Getting started with unjucks", value: "getting-started" },
          { name: "📋 Understanding commands", value: "commands" },
          { name: "🎯 Working with templates", value: "templates" },
          { name: "🔧 Troubleshooting issues", value: "troubleshooting" },
          { name: "🔄 Migrating from legacy syntax", value: "migration" },
          { name: "📝 Seeing examples", value: "examples" }
        ]
      }
    ]);
    
    switch (answers.helpType) {
      case "getting-started":
        showGettingStartedGuide();
        break;
      case "commands":
        await showInteractiveCommandHelp();
        break;
      case "templates":
        await showInteractiveTemplateHelp();
        break;
      case "troubleshooting":
        showTroubleshooting();
        break;
      case "migration":
        showMigrationGuide();
        break;
      case "examples":
        showExamples();
        break;
    }
  } catch (error) {
    console.error(chalk.red("Interactive help failed. Showing general help instead."));
    showGeneralHelp({ examples: false, troubleshooting: false, migration: false });
  }
}

function showGettingStartedGuide(): void {
  console.log(chalk.blue("\n🚀 Getting Started with Unjucks"));
  
  console.log(chalk.cyan("\n  Step 1: Explore what's available"));
  console.log(chalk.white("  unjucks list"));
  console.log(chalk.gray("  This shows all available templates in your project"));
  
  console.log(chalk.cyan("\n  Step 2: Preview before creating"));
  console.log(chalk.white("  unjucks preview component MyButton"));
  console.log(chalk.gray("  Safe exploration - see what would be created"));
  
  console.log(chalk.cyan("\n  Step 3: Create with confidence"));
  console.log(chalk.white("  unjucks new component MyButton"));
  console.log(chalk.gray("  Generate the actual files"));
  
  console.log(chalk.cyan("\n  Step 4: Customize as needed"));
  console.log(chalk.gray("  Edit the generated files to match your requirements"));
  
  console.log(chalk.blue("\n💡 Pro Tips for Beginners:"));
  console.log(chalk.gray("  • Start with interactive mode: ") + chalk.white("unjucks new"));
  console.log(chalk.gray("  • Always preview complex generations first"));
  console.log(chalk.gray("  • Use --help on any command for more details"));
  console.log(chalk.gray("  • Templates are in _templates/ directory"));
}

async function showInteractiveCommandHelp(): Promise<void> {
  try {
    const { default: inquirer } = await import("inquirer");
    
    const answers = await inquirer.prompt([
      {
        type: "list",
        name: "command",
        message: "Which command do you need help with?",
        choices: [
          { name: "🚀 new - Create files from templates", value: "new" },
          { name: "🔍 preview - Safe exploration mode", value: "preview" },
          { name: "📋 list - Show available templates", value: "list" },
          { name: "❓ help - Get contextual help", value: "help" },
          { name: "⚠️  generate - Legacy command (deprecated)", value: "generate" }
        ]
      }
    ]);
    
    const helpText = getCommandHelp(answers.command);
    if (helpText) {
      console.log(helpText);
      showCommandExamples(answers.command);
    }
  } catch (error) {
    console.error(chalk.red("Interactive command help failed."));
  }
}

async function showInteractiveTemplateHelp(): Promise<void> {
  try {
    const generator = new Generator();
    const generators = await generator.listGenerators();
    
    if (generators.length === 0) {
      console.log(chalk.yellow("\n⚠️  No templates found in your project"));
      console.log(chalk.blue("\n💡 To get started:"));
      console.log(chalk.blue("  • Run: unjucks init"));
      console.log(chalk.blue("  • Or create: _templates directory"));
      return;
    }
    
    const { default: inquirer } = await import("inquirer");
    
    const answers = await inquirer.prompt([
      {
        type: "list",
        name: "template",
        message: "Which template do you need help with?",
        choices: generators.map(gen => ({
          name: `${gen.name} - ${gen.description || 'No description'}`,
          value: gen.name
        }))
      }
    ]);
    
    await showTemplateHelp(answers.template, { examples: true });
  } catch (error) {
    console.error(chalk.red("Interactive template help failed."));
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
  }
}