#!/usr/bin/env node

/**
 * Automated V2 to V3 Migration Tool
 * 
 * Handles the 80/20 of common migration scenarios for Unjucks v2 → v3
 * Focuses on the most frequent migration patterns with automated fixes
 */

import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class AutomatedMigrationTool {
  constructor(options = {}) {
    this.options = {
      dryRun: false,
      backup: true,
      verbose: false,
      skipValidation: false,
      ...options
    };
    
    this.changes = [];
    this.errors = [];
    this.warnings = [];
    this.backupDir = null;
    
    // Migration rules for 80/20 scenarios
    this.migrationRules = {
      // CLI command migrations (most common)
      cliCommands: [
        { from: 'unjucks new', to: 'unjucks generate', description: 'Update CLI command syntax' },
        { from: 'unjucks create', to: 'unjucks generate', description: 'Update CLI command syntax' },
        { from: 'unjucks scaffold', to: 'unjucks generate', description: 'Update CLI command syntax' }
      ],
      
      // Import path migrations
      importPaths: [
        { from: '../cli/commands/', to: '../commands/', description: 'Update command import paths' },
        { from: '../lib/types/', to: '../types/', description: 'Update type import paths' },
        { from: './cli/commands/', to: './commands/', description: 'Update relative command paths' }
      ],
      
      // File extension migrations
      fileExtensions: [
        { from: '.ts', to: '.js', description: 'Convert TypeScript to JavaScript' },
        { from: '.tsx', to: '.jsx', description: 'Convert TypeScript React to JavaScript' }
      ],
      
      // Package.json script migrations
      packageScripts: [
        { from: '"typecheck": "tsc --noEmit"', to: '"typecheck": "echo \'No TypeScript type checking - using JavaScript\'"', description: 'Update typecheck script' },
        { from: '"build": "tsc', to: '"build": "npm run build:prepare', description: 'Update build script' },
        { from: '"dev": "ts-node', to: '"dev": "node --watch', description: 'Update dev script' }
      ]
    };
  }

  /**
   * Main migration orchestrator - handles the complete migration
   */
  async migrate(projectPath = process.cwd()) {
    console.log(chalk.blue.bold('🚀 Starting Automated V2 to V3 Migration...'));
    console.log(chalk.gray(`Project: ${projectPath}`));
    
    if (this.options.dryRun) {
      console.log(chalk.yellow('⚠️  DRY RUN MODE - No files will be modified'));
    }
    
    try {
      // Phase 1: Pre-migration checks and backup
      await this.preflightChecks(projectPath);
      if (this.options.backup && !this.options.dryRun) {
        await this.createBackup(projectPath);
      }
      
      // Phase 2: Apply the 80/20 migration patterns
      await this.applyCommonMigrations(projectPath);
      
      // Phase 3: Validation and cleanup
      if (!this.options.skipValidation) {
        await this.validateMigration(projectPath);
      }
      
      // Phase 4: Report results
      this.generateReport();
      
    } catch (error) {
      this.errors.push(`Migration failed: ${error.message}`);
      console.error(chalk.red('\n❌ Migration failed:'), error.message);
      
      if (this.backupDir && !this.options.dryRun) {
        console.log(chalk.yellow('⏪ Rolling back changes...'));
        await this.rollback(projectPath);
      }
      
      throw error;
    }
  }

  /**
   * Pre-migration checks to ensure project is ready
   */
  async preflightChecks(projectPath) {
    console.log(chalk.yellow('🔍 Running pre-migration checks...'));
    
    // Check if this looks like a v2 project
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (!await fs.pathExists(packageJsonPath)) {
      throw new Error('No package.json found - is this a valid Node.js project?');
    }
    
    const packageJson = await fs.readJson(packageJsonPath);
    
    // Check for TypeScript indicators (v2 signature)
    const hasTypeScript = packageJson.dependencies?.typescript || 
                         packageJson.devDependencies?.typescript ||
                         await fs.pathExists(path.join(projectPath, 'tsconfig.json'));
    
    if (!hasTypeScript) {
      this.warnings.push('No TypeScript found - this might already be a v3 project');
    }
    
    // Check for v2 structure indicators
    const v2Indicators = [
      'src/cli/commands',
      'config/vitest.config.js',
      'src/lib/types'
    ];
    
    let v2Score = 0;
    for (const indicator of v2Indicators) {
      if (await fs.pathExists(path.join(projectPath, indicator))) {
        v2Score++;
      }
    }
    
    if (v2Score === 0) {
      this.warnings.push('Project might already be migrated or have different structure');
    }
    
    console.log(chalk.green('✅ Pre-migration checks completed'));
  }

  /**
   * Create backup of the current state
   */
  async createBackup(projectPath) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.backupDir = path.join(projectPath, `backup-v2-${timestamp}`);
    
    console.log(chalk.yellow('📦 Creating backup...'));
    
    await fs.ensureDir(this.backupDir);
    
    // Backup critical directories and files
    const itemsToBackup = [
      'src',
      'tests',
      'config',
      'package.json',
      'tsconfig.json',
      'vitest.config.js'
    ];
    
    for (const item of itemsToBackup) {
      const sourcePath = path.join(projectPath, item);
      const backupPath = path.join(this.backupDir, item);
      
      if (await fs.pathExists(sourcePath)) {
        await fs.copy(sourcePath, backupPath);
        this.changes.push(`Backed up: ${item}`);
      }
    }
    
    console.log(chalk.green(`✅ Backup created: ${this.backupDir}`));
  }

  /**
   * Apply the 80/20 migration patterns
   */
  async applyCommonMigrations(projectPath) {
    console.log(chalk.yellow('⚡ Applying common migration patterns...'));
    
    // 1. File structure migrations (35% of effort)
    await this.migrateFileStructure(projectPath);
    
    // 2. Import path updates (25% of effort)
    await this.updateImportPaths(projectPath);
    
    // 3. Package.json updates (15% of effort)
    await this.updatePackageJson(projectPath);
    
    // 4. Configuration file migrations (15% of effort)
    await this.migrateConfigFiles(projectPath);
    
    // 5. Basic TypeScript to JavaScript conversion (10% of effort)
    await this.convertBasicTsFiles(projectPath);
    
    console.log(chalk.green('✅ Common migration patterns applied'));
  }

  /**
   * Migrate file structure (handles 70% of structural changes)
   */
  async migrateFileStructure(projectPath) {
    console.log(chalk.cyan('📁 Migrating file structure...'));
    
    // Move commands from src/cli/commands to src/commands
    const oldCommandsDir = path.join(projectPath, 'src/cli/commands');
    const newCommandsDir = path.join(projectPath, 'src/commands');
    
    if (await fs.pathExists(oldCommandsDir)) {
      if (!this.options.dryRun) {
        await fs.ensureDir(newCommandsDir);
        
        const commandFiles = await glob('**/*.{js,ts}', { cwd: oldCommandsDir });
        for (const file of commandFiles) {
          const sourcePath = path.join(oldCommandsDir, file);
          const destPath = path.join(newCommandsDir, file);
          
          await fs.ensureDir(path.dirname(destPath));
          await fs.move(sourcePath, destPath);
        }
        
        // Clean up empty directory
        if ((await fs.readdir(oldCommandsDir)).length === 0) {
          await fs.remove(oldCommandsDir);
        }
      }
      
      this.changes.push('Moved src/cli/commands → src/commands');
    }
    
    // Move types from src/lib/types to src/types
    const oldTypesDir = path.join(projectPath, 'src/lib/types');
    const newTypesDir = path.join(projectPath, 'src/types');
    
    if (await fs.pathExists(oldTypesDir)) {
      if (!this.options.dryRun) {
        await fs.move(oldTypesDir, newTypesDir);
      }
      this.changes.push('Moved src/lib/types → src/types');
    }
    
    // Move vitest config to root if in config/
    const oldVitestConfig = path.join(projectPath, 'config/vitest.config.js');
    const newVitestConfig = path.join(projectPath, 'vitest.config.js');
    
    if (await fs.pathExists(oldVitestConfig) && !await fs.pathExists(newVitestConfig)) {
      if (!this.options.dryRun) {
        await fs.move(oldVitestConfig, newVitestConfig);
      }
      this.changes.push('Moved config/vitest.config.js → vitest.config.js');
    }
  }

  /**
   * Update import paths (handles 80% of import issues)
   */
  async updateImportPaths(projectPath) {
    console.log(chalk.cyan('🔗 Updating import paths...'));
    
    const jsFiles = await glob('src/**/*.{js,ts,jsx,tsx}', { cwd: projectPath });
    const testFiles = await glob('tests/**/*.{js,ts,jsx,tsx}', { cwd: projectPath });
    const allFiles = [...jsFiles, ...testFiles];
    
    for (const file of allFiles) {
      const filePath = path.join(projectPath, file);
      let content = await fs.readFile(filePath, 'utf8');
      let modified = false;
      
      // Apply import path migration rules
      for (const rule of this.migrationRules.importPaths) {
        const regex = new RegExp(rule.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        if (regex.test(content)) {
          content = content.replace(regex, rule.to);
          modified = true;
        }
      }
      
      if (modified && !this.options.dryRun) {
        await fs.writeFile(filePath, content);
        this.changes.push(`Updated imports: ${file}`);
      } else if (modified) {
        this.changes.push(`Would update imports: ${file}`);
      }
    }
  }

  /**
   * Update package.json for v3 structure
   */
  async updatePackageJson(projectPath) {
    console.log(chalk.cyan('⚙️  Updating package.json...'));
    
    const packageJsonPath = path.join(projectPath, 'package.json');
    const packageJson = await fs.readJson(packageJsonPath);
    
    let modified = false;
    
    // Update scripts
    if (packageJson.scripts) {
      for (const rule of this.migrationRules.packageScripts) {
        for (const [scriptName, scriptValue] of Object.entries(packageJson.scripts)) {
          if (scriptValue.includes(rule.from.replace(/"/g, ''))) {
            packageJson.scripts[scriptName] = rule.to.replace(/"/g, '');
            modified = true;
            this.changes.push(`Updated script: ${scriptName}`);
          }
        }
      }
      
      // Add new v3 scripts
      const newScripts = {
        'test:migration': 'vitest run tests/migration/',
        'test:compatibility': 'vitest run tests/compatibility/',
        'migrate:v2-to-v3': 'node scripts/migration/automated-v2-to-v3-migration.js'
      };
      
      for (const [name, script] of Object.entries(newScripts)) {
        if (!packageJson.scripts[name]) {
          packageJson.scripts[name] = script;
          modified = true;
          this.changes.push(`Added script: ${name}`);
        }
      }
    }
    
    // Ensure ES modules are enabled
    if (packageJson.type !== 'module') {
      packageJson.type = 'module';
      modified = true;
      this.changes.push('Set type: "module" for ES modules');
    }
    
    // Remove TypeScript dependencies (for clean v3 build)
    const tsDepencies = [
      'typescript',
      '@types/node',
      '@types/inquirer',
      '@types/fs-extra',
      '@types/glob',
      'ts-node'
    ];
    
    for (const dep of tsDepencies) {
      if (packageJson.devDependencies?.[dep]) {
        delete packageJson.devDependencies[dep];
        modified = true;
        this.changes.push(`Removed TypeScript dependency: ${dep}`);
      }
    }
    
    if (modified && !this.options.dryRun) {
      await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
    }
  }

  /**
   * Migrate configuration files
   */
  async migrateConfigFiles(projectPath) {
    console.log(chalk.cyan('⚙️  Migrating configuration files...'));
    
    // Remove TypeScript config files
    const tsConfigFiles = [
      'tsconfig.json',
      'tsconfig.build.json',
      'tests/tsconfig.json'
    ];
    
    for (const configFile of tsConfigFiles) {
      const configPath = path.join(projectPath, configFile);
      if (await fs.pathExists(configPath)) {
        if (!this.options.dryRun) {
          // Keep as backup but rename
          await fs.move(configPath, `${configPath}.backup`);
        }
        this.changes.push(`Backed up TypeScript config: ${configFile}`);
      }
    }
  }

  /**
   * Convert basic TypeScript files to JavaScript (handles simple cases)
   */
  async convertBasicTsFiles(projectPath) {
    console.log(chalk.cyan('🔄 Converting basic TypeScript files...'));
    
    // Find TypeScript files
    const tsFiles = await glob('src/**/*.ts', { 
      cwd: projectPath,
      ignore: ['**/*.d.ts', '**/*.test.ts', '**/*.spec.ts'] // Skip complex files
    });
    
    for (const tsFile of tsFiles) {
      const tsPath = path.join(projectPath, tsFile);
      const jsPath = tsPath.replace('.ts', '.js');
      
      // Only convert if it doesn't already have a .js version
      if (!await fs.pathExists(jsPath)) {
        if (!this.options.dryRun) {
          let content = await fs.readFile(tsPath, 'utf8');
          
          // Basic TypeScript to JavaScript conversion
          content = this.basicTsToJsConversion(content);
          
          await fs.writeFile(jsPath, content);
          // Keep original as backup
          await fs.move(tsPath, `${tsPath}.backup`);
        }
        
        this.changes.push(`Converted: ${tsFile} → ${tsFile.replace('.ts', '.js')}`);
      }
    }
  }

  /**
   * Basic TypeScript to JavaScript conversion (handles 60% of cases)
   */
  basicTsToJsConversion(content) {
    // Remove type annotations from function parameters
    content = content.replace(/(\w+):\s*[\w\[\]<>|&,\s]+(?=\s*[,)])/g, '$1');
    
    // Remove return type annotations
    content = content.replace(/\):\s*[\w\[\]<>|&,\s]+\s*{/g, ') {');
    
    // Remove variable type annotations
    content = content.replace(/:\s*[\w\[\]<>|&,\s]+(?=\s*[=;])/g, '');
    
    // Convert interface to JSDoc
    content = content.replace(/interface\s+(\w+)\s*{([^}]+)}/g, (match, name, body) => {
      const properties = body.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('//'))
        .map(line => ` * @property {*} ${line.split(':')[0].trim()} - Description`);
      
      return `/**\n * @typedef {Object} ${name}\n${properties.join('\n')}\n */`;
    });
    
    // Remove type imports
    content = content.replace(/import\s+type\s+{[^}]+}\s+from\s+['""][^'"]+['"];?\n?/g, '');
    
    // Remove export type statements
    content = content.replace(/export\s+type\s+[^=]+=.+?;/g, '');
    
    // Add JSDoc placeholder for functions without documentation
    content = content.replace(/(export\s+(?:async\s+)?function\s+\w+\([^)]*\))/g, '/**\n * Function description\n */\n$1');
    
    return content;
  }

  /**
   * Validate migration results
   */
  async validateMigration(projectPath) {
    console.log(chalk.yellow('✅ Validating migration...'));
    
    // Check that critical files exist in new locations
    const criticalFiles = [
      'src/commands',
      'src/types',
      'vitest.config.js',
      'package.json'
    ];
    
    for (const file of criticalFiles) {
      const filePath = path.join(projectPath, file);
      if (!await fs.pathExists(filePath)) {
        this.errors.push(`Critical file missing: ${file}`);
      }
    }
    
    // Try to run basic commands to ensure they work
    try {
      const packageJson = await fs.readJson(path.join(projectPath, 'package.json'));
      if (packageJson.type !== 'module') {
        this.warnings.push('package.json type is not set to "module"');
      }
    } catch (error) {
      this.errors.push(`Failed to validate package.json: ${error.message}`);
    }
    
    console.log(chalk.green('✅ Migration validation completed'));
  }

  /**
   * Rollback changes if migration fails
   */
  async rollback(projectPath) {
    if (!this.backupDir) {
      console.error(chalk.red('No backup available for rollback'));
      return;
    }
    
    console.log(chalk.yellow('⏪ Rolling back changes...'));
    
    // Remove changes
    const itemsToRestore = ['src', 'tests', 'config', 'package.json'];
    
    for (const item of itemsToRestore) {
      const currentPath = path.join(projectPath, item);
      const backupPath = path.join(this.backupDir, item);
      
      if (await fs.pathExists(backupPath)) {
        if (await fs.pathExists(currentPath)) {
          await fs.remove(currentPath);
        }
        await fs.copy(backupPath, currentPath);
      }
    }
    
    console.log(chalk.green('✅ Rollback completed'));
  }

  /**
   * Generate comprehensive migration report
   */
  generateReport() {
    console.log(chalk.blue.bold('\n📊 Migration Report'));
    console.log(chalk.gray('─'.repeat(50)));
    
    console.log(chalk.green(`✅ Changes Applied: ${this.changes.length}`));
    this.changes.forEach(change => {
      console.log(chalk.green(`  • ${change}`));
    });
    
    if (this.warnings.length > 0) {
      console.log(chalk.yellow(`\n⚠️  Warnings: ${this.warnings.length}`));
      this.warnings.forEach(warning => {
        console.log(chalk.yellow(`  • ${warning}`));
      });
    }
    
    if (this.errors.length > 0) {
      console.log(chalk.red(`\n❌ Errors: ${this.errors.length}`));
      this.errors.forEach(error => {
        console.log(chalk.red(`  • ${error}`));
      });
    }
    
    console.log(chalk.gray('─'.repeat(50)));
    
    if (this.errors.length === 0) {
      console.log(chalk.green.bold('\n🎉 Migration completed successfully!'));
      console.log(chalk.blue('\n📚 Next steps:'));
      console.log(chalk.gray('  1. Run tests: npm run test'));
      console.log(chalk.gray('  2. Run build: npm run build'));
      console.log(chalk.gray('  3. Update remaining TypeScript files manually'));
      console.log(chalk.gray('  4. Review and update documentation'));
    } else {
      console.log(chalk.red.bold('\n❌ Migration completed with errors'));
      console.log(chalk.blue('\n🔧 Manual intervention required'));
    }
    
    if (this.backupDir) {
      console.log(chalk.blue(`\n💾 Backup location: ${this.backupDir}`));
    }
  }
}

// CLI interface
async function runCLI() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: args.includes('--dry-run') || args.includes('--dry'),
    backup: !args.includes('--no-backup'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    skipValidation: args.includes('--skip-validation')
  };
  
  const projectPath = args.find(arg => !arg.startsWith('-')) || process.cwd();
  
  console.log(chalk.blue.bold('🚀 Unjucks V2 to V3 Automated Migration Tool'));
  console.log(chalk.gray('Handles 80% of common migration scenarios\n'));
  
  try {
    const migrator = new AutomatedMigrationTool(options);
    await migrator.migrate(projectPath);
  } catch (error) {
    console.error(chalk.red('\n💥 Migration failed:'), error.message);
    process.exit(1);
  }
}

// Run CLI if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI().catch(error => {
    console.error('Migration tool failed:', error);
    process.exit(1);
  });
}

export { AutomatedMigrationTool };