import { defineCommand } from "citty";
import chalk from "chalk";
import { initCommand } from './init.js';
import { planCommand } from './plan.js';
import { tasksCommand } from './tasks.js';
import { validateCommand } from './validate.js';

/**
 * Main specify command with subcommands for spec-driven development
 */
export const specifyCommand = defineCommand({
  meta: {
    name: "specify",
    description: "Specification-driven development tools for systematic project creation",
  },
  args: {
    help: {
      type: "boolean",
      description: "Show help information",
      alias: "h",
    },
    version: {
      type: "boolean",
      description: "Show version information",
      alias: "v",
    },
  },
  subCommands: {
    init: initCommand,
    plan: planCommand,
    tasks: tasksCommand,
    validate: validateCommand,
  },
  run({ args }) {
    // Handle version flag
    if (args.version) {
      console.log(chalk.blue("unjucks specify v1.0.0"));
      console.log(chalk.gray("Specification-driven development tools"));
      return { success: true, action: 'version' };
    }

    // Handle help flag or no subcommand
    if (args.help || Object.keys(args).length === 0) {
      console.log(chalk.blue.bold("🎯 Unjucks Specify"));
      console.log(chalk.gray("Specification-driven development tools for systematic project creation"));
      console.log();
      
      console.log(chalk.yellow("USAGE:"));
      console.log(chalk.gray("  unjucks specify <command> [options]"));
      console.log();
      
      console.log(chalk.yellow("COMMANDS:"));
      console.log(chalk.cyan("  init <project>     ") + chalk.gray("Initialize spec-driven project structure"));
      console.log(chalk.cyan("  plan               ") + chalk.gray("Generate technical development plan from specs"));
      console.log(chalk.cyan("  tasks              ") + chalk.gray("Break down specs into granular development tasks"));
      console.log(chalk.cyan("  validate           ") + chalk.gray("Validate specifications for quality and consistency"));
      console.log();
      
      console.log(chalk.yellow("OPTIONS:"));
      console.log(chalk.gray("  --help, -h         Show help information"));
      console.log(chalk.gray("  --version, -v      Show version information"));
      console.log();
      
      console.log(chalk.yellow("EXAMPLES:"));
      console.log(chalk.gray("  # Initialize a new spec-driven project"));
      console.log(chalk.cyan("  unjucks specify init my-api-project --type api --framework express"));
      console.log();
      console.log(chalk.gray("  # Generate development plan from specifications"));
      console.log(chalk.cyan("  unjucks specify plan --format markdown --output docs/plan.md"));
      console.log();
      console.log(chalk.gray("  # Break down plan into actionable tasks"));
      console.log(chalk.cyan("  unjucks specify tasks --granularity fine --format github"));
      console.log();
      console.log(chalk.gray("  # Validate all specifications"));
      console.log(chalk.cyan("  unjucks specify validate --strict --format markdown"));
      console.log();
      
      console.log(chalk.yellow("SPECIFICATION-DRIVEN WORKFLOW:"));
      console.log(chalk.gray("1. ") + chalk.cyan("unjucks specify init <project>    ") + chalk.gray("# Create project structure"));
      console.log(chalk.gray("2. ") + chalk.cyan("Edit specs/requirements/*.yaml    ") + chalk.gray("# Define requirements"));
      console.log(chalk.gray("3. ") + chalk.cyan("Edit specs/architecture/*.yaml    ") + chalk.gray("# Design architecture"));
      console.log(chalk.gray("4. ") + chalk.cyan("unjucks specify validate          ") + chalk.gray("# Validate specifications"));
      console.log(chalk.gray("5. ") + chalk.cyan("unjucks specify plan              ") + chalk.gray("# Generate development plan"));
      console.log(chalk.gray("6. ") + chalk.cyan("unjucks specify tasks             ") + chalk.gray("# Create actionable tasks"));
      console.log(chalk.gray("7. ") + chalk.cyan("unjucks generate <templates>      ") + chalk.gray("# Generate code from specs"));
      console.log();
      
      console.log(chalk.yellow("BENEFITS:"));
      console.log(chalk.gray("• ") + chalk.green("Systematic approach") + chalk.gray(" - Follow proven development methodology"));
      console.log(chalk.gray("• ") + chalk.green("Quality assurance") + chalk.gray(" - Built-in validation and consistency checks"));
      console.log(chalk.gray("• ") + chalk.green("Automated planning") + chalk.gray(" - Generate plans and tasks from specifications"));
      console.log(chalk.gray("• ") + chalk.green("Traceability") + chalk.gray(" - Link code back to requirements and architecture"));
      console.log(chalk.gray("• ") + chalk.green("Team alignment") + chalk.gray(" - Clear specifications reduce miscommunication"));
      console.log();
      
      console.log(chalk.blue("💡 Pro Tips:"));
      console.log(chalk.gray("• Use --dry flag to preview changes before applying"));
      console.log(chalk.gray("• Run validate frequently during specification development"));
      console.log(chalk.gray("• Version control your specifications alongside code"));
      console.log(chalk.gray("• Use plan output formats that integrate with your PM tools"));
      console.log();
      
      return { success: true, action: 'help' };
    }

    // If no subcommand was matched, show help
    console.log(chalk.red("❌ Unknown command or no command specified"));
    console.log(chalk.blue("💡 Run 'unjucks specify --help' for available commands"));
    
    return { 
      success: false, 
      action: 'unknown-command',
      message: "No valid subcommand specified"
    };
  },
});

// Export individual commands for direct use
export { initCommand, planCommand, tasksCommand, validateCommand };