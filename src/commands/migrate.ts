import { defineCommand } from "citty";
import chalk from "chalk";
import { promises as fs } from "fs";
import path from "path";
import { EJSToNunjucksConverter } from "../lib/ejs-to-nunjucks.js";
import { MigrationValidator } from "../lib/migration-validator.js";
import { MigrationReporter } from "../lib/migration-reporter.js";
import { DirectoryMigrator } from "../lib/directory-migrator.js";
import { ConfigMigrator } from "../lib/config-migrator.js";

export interface MigrateOptions {
  source?: string;
  target?: string;
  dry?: boolean;
  backup?: boolean;
  verbose?: boolean;
  force?: boolean;
  validate?: boolean;
  report?: boolean;
}

export const migrateCommand = defineCommand({
  meta: {
    name: "migrate",
    description: "Migrate Hygen templates to Unjucks format with 95% compatibility",
  },
  args: {
    source: {
      type: "string",
      alias: "s",
      description: "Source directory containing Hygen templates (default: _templates)",
      default: "_templates",
    },
    target: {
      type: "string",
      alias: "t", 
      description: "Target directory for Unjucks templates (default: templates)",
      default: "templates",
    },
    dry: {
      type: "boolean",
      alias: "d",
      description: "Dry run - show what would be migrated without making changes",
    },
    backup: {
      type: "boolean",
      alias: "b",
      description: "Create backup of original templates",
    },
    verbose: {
      type: "boolean",
      alias: "v", 
      description: "Enable verbose output with detailed conversion logs",
    },
    force: {
      type: "boolean",
      alias: "f",
      description: "Force migration even if target directory exists",
    },
    validate: {
      type: "boolean",
      description: "Validate migrated templates after conversion",
      default: true,
    },
    report: {
      type: "boolean",
      alias: "r",
      description: "Generate detailed migration report",
      default: true,
    },
  },
  async run(context: any) {
    const { args } = context;
    console.log(chalk.blue.bold("🔄 Unjucks Migration Tool"));
    console.log(chalk.gray("Migrating Hygen templates to Unjucks format..."));
    console.log();

    const startTime = Date.now();
    
    try {
      // Initialize migration components
      const converter = new EJSToNunjucksConverter();
      const validator = new MigrationValidator();
      const reporter = new MigrationReporter();
      const directoryMigrator = new DirectoryMigrator();
      const configMigrator = new ConfigMigrator();

      // Validate source directory exists
      const sourcePath = path.resolve(args.source || "_templates");
      const targetPath = path.resolve(args.target || "templates");

      if (!(await fs.stat(sourcePath).catch(() => false))) {
        throw new Error(`Source directory does not exist: ${sourcePath}`);
      }

      console.log(chalk.cyan(`📂 Source: ${sourcePath}`));
      console.log(chalk.cyan(`📂 Target: ${targetPath}`));
      console.log();

      // Step 1: Scan and analyze source templates
      console.log(chalk.yellow("🔍 Scanning Hygen templates..."));
      const scanResult = await directoryMigrator.scanTemplates(sourcePath);
      
      if (args.verbose) {
        console.log(chalk.gray(`Found ${scanResult.templates.length} templates in ${scanResult.generators.length} generators`));
        scanResult.generators.forEach(gen => {
          console.log(chalk.gray(`  - ${gen.name} (${gen.templates.length} templates)`));
        });
      }

      // Step 2: Create target directory structure
      if (!args.dry) {
        console.log(chalk.yellow("📁 Creating target directory structure..."));
        await directoryMigrator.createTargetStructure(targetPath, scanResult.generators, {
          force: args.force,
          backup: args.backup,
        });
      }

      // Step 3: Convert templates
      console.log(chalk.yellow("🔄 Converting EJS templates to Nunjucks..."));
      const conversionResults = [];
      
      for (const template of scanResult.templates) {
        const result = await converter.convertTemplate(
          template.path,
          template.content,
          {
            dry: args.dry,
            verbose: args.verbose,
          }
        );
        
        conversionResults.push({
          ...result,
          originalPath: template.path,
          targetPath: path.join(targetPath, path.relative(sourcePath, template.path)),
        });

        if (!args.dry && result.success) {
          const targetFilePath = path.join(targetPath, path.relative(sourcePath, template.path));
          await fs.mkdir(path.dirname(targetFilePath), { recursive: true });
          await fs.writeFile(targetFilePath, result.convertedContent || "", "utf-8");
        }

        if (args.verbose) {
          const status = result.success ? chalk.green("✓") : chalk.red("✗");
          console.log(`  ${status} ${template.relativePath}`);
          if (!result.success && result.errors.length > 0) {
            result.errors.forEach(error => console.log(chalk.red(`    Error: ${error}`)));
          }
        }
      }

      // Step 4: Migrate configuration files
      console.log(chalk.yellow("⚙️ Migrating configuration..."));
      const configResult = await configMigrator.migrateConfig(sourcePath, targetPath, {
        dry: args.dry,
        force: args.force,
      });

      // Step 5: Validation
      if (args.validate && !args.dry) {
        console.log(chalk.yellow("✅ Validating migrated templates..."));
        const validationResults = await validator.validateMigration(targetPath, conversionResults);
        
        if (args.verbose) {
          console.log(chalk.gray(`Validation completed: ${validationResults.passed}/${validationResults.total} tests passed`));
        }
      }

      // Step 6: Generate report
      if (args.report) {
        console.log(chalk.yellow("📊 Generating migration report..."));
        const reportPath = path.join(process.cwd(), "migration-report.json");
        await reporter.generateReport({
          sourcePath,
          targetPath,
          scanResult,
          conversionResults,
          configResult,
          validationResults: args.validate ? await validator.validateMigration(targetPath, conversionResults) : null,
          options: args,
          duration: Date.now() - startTime,
        }, reportPath);

        console.log(chalk.green(`📄 Migration report saved: ${reportPath}`));
      }

      // Summary
      const successful = conversionResults.filter(r => r.success).length;
      const total = conversionResults.length;
      const compatibilityRate = total > 0 ? Math.round((successful / total) * 100) : 100;

      console.log();
      console.log(chalk.green.bold("✨ Migration Summary"));
      console.log(chalk.cyan(`Templates converted: ${successful}/${total}`));
      console.log(chalk.cyan(`Compatibility rate: ${compatibilityRate}%`));
      console.log(chalk.cyan(`Duration: ${Math.round((Date.now() - startTime) / 1000)}s`));

      if (args.dry) {
        console.log(chalk.yellow("🔍 Dry run completed - no files were modified"));
      } else {
        console.log(chalk.green("🎉 Migration completed successfully!"));
        console.log();
        console.log(chalk.blue("Next steps:"));
        console.log(chalk.gray("1. Review the migration report for any issues"));
        console.log(chalk.gray("2. Test your migrated templates with: unjucks list"));
        console.log(chalk.gray("3. Generate code with: unjucks generate <generator> <template>"));
      }

      // Exit with appropriate code based on success rate
      if (compatibilityRate < 95) {
        console.log(chalk.yellow(`⚠️ Warning: Compatibility rate ${compatibilityRate}% is below 95%`));
        process.exit(1);
      }

    } catch (error: any) {
      console.error(chalk.red.bold("❌ Migration failed"));
      console.error(chalk.red(error.message));
      
      if (args.verbose && error.stack) {
        console.error(chalk.gray(error.stack));
      }
      
      process.exit(1);
    }
  },
});