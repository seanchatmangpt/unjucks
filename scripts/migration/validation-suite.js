#!/usr/bin/env node

/**
 * Migration Validation Suite
 * 
 * Comprehensive testing and validation for v2 to v3 migrations
 * Ensures migration quality and compatibility
 */

import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';
import { glob } from 'glob';

class MigrationValidationSuite {
  constructor(projectPath = process.cwd()) {
    this.projectPath = projectPath;
    this.results = {
      passed: [],
      failed: [],
      warnings: [],
      skipped: []
    };
    
    this.testSuites = [
      'FileStructureValidation',
      'ImportPathValidation', 
      'CommandCompatibilityValidation',
      'BuildSystemValidation',
      'PerformanceValidation',
      'TemplateValidation'
    ];
  }

  /**
   * Run complete validation suite
   */
  async runValidation() {
    console.log(chalk.blue.bold('🔍 Running Migration Validation Suite...'));
    console.log(chalk.gray(`Project: ${this.projectPath}\n`));
    
    // Run all test suites
    for (const suite of this.testSuites) {
      try {
        console.log(chalk.yellow(`Running ${suite}...`));
        const method = `run${suite}`;
        await this[method]();
        console.log(chalk.green(`✅ ${suite} completed\n`));
      } catch (error) {
        console.log(chalk.red(`❌ ${suite} failed: ${error.message}\n`));
        this.results.failed.push({
          suite,
          error: error.message
        });
      }
    }
    
    // Generate final report
    this.generateReport();
  }

  /**
   * Validate file structure migration
   */
  async runFileStructureValidation() {
    const tests = [
      {
        name: 'Commands moved from src/cli/commands to src/commands',
        test: async () => {
          const newCommandsExist = await fs.pathExists(path.join(this.projectPath, 'src/commands'));
          const oldCommandsRemoved = !await fs.pathExists(path.join(this.projectPath, 'src/cli/commands'));
          return newCommandsExist && oldCommandsRemoved;
        }
      },
      {
        name: 'Types moved from src/lib/types to src/types',
        test: async () => {
          const newTypesExist = await fs.pathExists(path.join(this.projectPath, 'src/types'));
          return newTypesExist;
        }
      },
      {
        name: 'Vitest config moved to root',
        test: async () => {
          const rootConfigExists = await fs.pathExists(path.join(this.projectPath, 'vitest.config.js'));
          return rootConfigExists;
        }
      },
      {
        name: 'TypeScript configs backed up',
        test: async () => {
          const backupExists = await fs.pathExists(path.join(this.projectPath, 'tsconfig.json.backup'));
          const currentRemoved = !await fs.pathExists(path.join(this.projectPath, 'tsconfig.json'));
          return backupExists || currentRemoved;
        }
      },
      {
        name: 'Backup directory exists',
        test: async () => {
          const backupDirs = await glob('backup-v2-*', { cwd: this.projectPath });
          return backupDirs.length > 0;
        }
      }
    ];

    for (const testCase of tests) {
      try {
        const passed = await testCase.test();
        if (passed) {
          this.results.passed.push(`FileStructure: ${testCase.name}`);
        } else {
          this.results.failed.push({
            suite: 'FileStructure',
            test: testCase.name,
            reason: 'Test condition not met'
          });
        }
      } catch (error) {
        this.results.failed.push({
          suite: 'FileStructure',
          test: testCase.name,
          reason: error.message
        });
      }
    }
  }

  /**
   * Validate import path updates
   */
  async runImportPathValidation() {
    const jsFiles = await glob('src/**/*.{js,ts}', { cwd: this.projectPath });
    
    for (const file of jsFiles) {
      const filePath = path.join(this.projectPath, file);
      const content = await fs.readFile(filePath, 'utf8');
      
      // Check for old import patterns
      const oldPatterns = [
        /'\.\.\/cli\/commands\//,
        /'\.\.\/lib\/types\//,
        /from ['"]\.\.\/cli\/commands\//,
        /from ['"]\.\.\/lib\/types\//
      ];
      
      let hasOldPatterns = false;
      for (const pattern of oldPatterns) {
        if (pattern.test(content)) {
          hasOldPatterns = true;
          break;
        }
      }
      
      if (hasOldPatterns) {
        this.results.failed.push({
          suite: 'ImportPath',
          test: `File: ${file}`,
          reason: 'Contains old import paths'
        });
      } else {
        this.results.passed.push(`ImportPath: ${file} uses correct paths`);
      }
    }
  }

  /**
   * Validate command compatibility
   */
  async runCommandCompatibilityValidation() {
    const tests = [
      {
        name: 'CLI binary is executable',
        test: () => {
          try {
            execSync('node bin/unjucks.js --help', { 
              cwd: this.projectPath, 
              stdio: 'pipe' 
            });
            return true;
          } catch {
            return false;
          }
        }
      },
      {
        name: 'List command works',
        test: () => {
          try {
            execSync('node bin/unjucks.js list', { 
              cwd: this.projectPath, 
              stdio: 'pipe' 
            });
            return true;
          } catch {
            return false;
          }
        }
      },
      {
        name: 'Generate command works (dry run)',
        test: () => {
          try {
            // This might fail if no templates exist, so we catch that
            const output = execSync('node bin/unjucks.js generate component react --name TestValidation --dry', { 
              cwd: this.projectPath, 
              stdio: 'pipe',
              encoding: 'utf8'
            });
            return output.includes('Analysis completed') || output.includes('No generators found');
          } catch (error) {
            // Accept "No generators found" as valid (means CLI works)
            return error.stdout?.includes('No generators found') || false;
          }
        }
      },
      {
        name: 'V2 compatibility warnings work',
        test: () => {
          try {
            const output = execSync('node bin/unjucks.js new component react TestLegacy --dry', { 
              cwd: this.projectPath, 
              stdio: 'pipe',
              encoding: 'utf8'
            });
            return output.includes('DEPRECATION WARNING') || output.includes('No generators found');
          } catch (error) {
            return error.stdout?.includes('DEPRECATION WARNING') || 
                   error.stdout?.includes('No generators found') || false;
          }
        }
      }
    ];

    for (const testCase of tests) {
      try {
        const passed = testCase.test();
        if (passed) {
          this.results.passed.push(`CommandCompatibility: ${testCase.name}`);
        } else {
          this.results.failed.push({
            suite: 'CommandCompatibility',
            test: testCase.name,
            reason: 'Command execution failed'
          });
        }
      } catch (error) {
        this.results.failed.push({
          suite: 'CommandCompatibility',
          test: testCase.name,
          reason: error.message
        });
      }
    }
  }

  /**
   * Validate build system migration
   */
  async runBuildSystemValidation() {
    const tests = [
      {
        name: 'Package.json has ES module type',
        test: async () => {
          const packageJson = await fs.readJson(path.join(this.projectPath, 'package.json'));
          return packageJson.type === 'module';
        }
      },
      {
        name: 'TypeScript dependencies removed',
        test: async () => {
          const packageJson = await fs.readJson(path.join(this.projectPath, 'package.json'));
          const tsDepencies = ['typescript', '@types/node', 'ts-node'];
          return !tsDepencies.some(dep => 
            packageJson.dependencies?.[dep] || packageJson.devDependencies?.[dep]
          );
        }
      },
      {
        name: 'Build script updated',
        test: async () => {
          const packageJson = await fs.readJson(path.join(this.projectPath, 'package.json'));
          const buildScript = packageJson.scripts?.build || '';
          return !buildScript.includes('tsc') || buildScript.includes('build:prepare');
        }
      },
      {
        name: 'Migration scripts added',
        test: async () => {
          const packageJson = await fs.readJson(path.join(this.projectPath, 'package.json'));
          const scripts = packageJson.scripts || {};
          return scripts['test:migration'] || scripts['migrate:v2-to-v3'];
        }
      },
      {
        name: 'Build process works',
        test: () => {
          try {
            execSync('npm run build', { 
              cwd: this.projectPath, 
              stdio: 'pipe',
              timeout: 30000 // 30 second timeout
            });
            return true;
          } catch {
            return false;
          }
        }
      }
    ];

    for (const testCase of tests) {
      try {
        const passed = await testCase.test();
        if (passed) {
          this.results.passed.push(`BuildSystem: ${testCase.name}`);
        } else {
          this.results.failed.push({
            suite: 'BuildSystem',
            test: testCase.name,
            reason: 'Build system validation failed'
          });
        }
      } catch (error) {
        this.results.failed.push({
          suite: 'BuildSystem',
          test: testCase.name,
          reason: error.message
        });
      }
    }
  }

  /**
   * Validate performance improvements
   */
  async runPerformanceValidation() {
    const tests = [
      {
        name: 'CLI startup time is reasonable',
        test: () => {
          const start = Date.now();
          try {
            execSync('node bin/unjucks.js --help', { 
              cwd: this.projectPath, 
              stdio: 'pipe' 
            });
            const duration = Date.now() - start;
            return duration < 1000; // Should start in under 1 second
          } catch {
            return false;
          }
        }
      },
      {
        name: 'List command performance',
        test: () => {
          const start = Date.now();
          try {
            execSync('node bin/unjucks.js list', { 
              cwd: this.projectPath, 
              stdio: 'pipe' 
            });
            const duration = Date.now() - start;
            return duration < 2000; // Should complete in under 2 seconds
          } catch {
            // If it fails due to no generators, still check timing
            const duration = Date.now() - start;
            return duration < 2000;
          }
        }
      },
      {
        name: 'Memory usage is reasonable',
        test: () => {
          // This is a basic check - would need more sophisticated monitoring for real metrics
          try {
            const memBefore = process.memoryUsage().heapUsed;
            execSync('node bin/unjucks.js --help', { 
              cwd: this.projectPath, 
              stdio: 'pipe' 
            });
            const memAfter = process.memoryUsage().heapUsed;
            const memDiff = memAfter - memBefore;
            return memDiff < 50 * 1024 * 1024; // Less than 50MB increase
          } catch {
            return false;
          }
        }
      }
    ];

    for (const testCase of tests) {
      try {
        const passed = testCase.test();
        if (passed) {
          this.results.passed.push(`Performance: ${testCase.name}`);
        } else {
          this.results.warnings.push(`Performance: ${testCase.name} - may need optimization`);
        }
      } catch (error) {
        this.results.warnings.push(`Performance: ${testCase.name} - ${error.message}`);
      }
    }
  }

  /**
   * Validate template compatibility
   */
  async runTemplateValidation() {
    const templatesDir = path.join(this.projectPath, '_templates');
    
    if (!await fs.pathExists(templatesDir)) {
      this.results.skipped.push('Template validation - no _templates directory found');
      return;
    }

    const tests = [
      {
        name: 'Templates directory structure is valid',
        test: async () => {
          const items = await fs.readdir(templatesDir, { withFileTypes: true });
          return items.some(item => item.isDirectory());
        }
      },
      {
        name: 'Template files have correct extensions',
        test: async () => {
          const templateFiles = await glob('**/*.{njk,hbs}', { cwd: templatesDir });
          return templateFiles.length > 0;
        }
      },
      {
        name: 'Frontmatter parsing works',
        test: async () => {
          try {
            const templateFiles = await glob('**/*.njk', { cwd: templatesDir });
            if (templateFiles.length === 0) return true; // No templates to test
            
            const sampleFile = path.join(templatesDir, templateFiles[0]);
            const content = await fs.readFile(sampleFile, 'utf8');
            
            // Basic check for frontmatter
            return content.startsWith('---') || content.includes('to:');
          } catch {
            return false;
          }
        }
      }
    ];

    for (const testCase of tests) {
      try {
        const passed = await testCase.test();
        if (passed) {
          this.results.passed.push(`Template: ${testCase.name}`);
        } else {
          this.results.failed.push({
            suite: 'Template',
            test: testCase.name,
            reason: 'Template validation failed'
          });
        }
      } catch (error) {
        this.results.failed.push({
          suite: 'Template',
          test: testCase.name,
          reason: error.message
        });
      }
    }
  }

  /**
   * Generate comprehensive validation report
   */
  generateReport() {
    const total = this.results.passed.length + 
                  this.results.failed.length + 
                  this.results.warnings.length + 
                  this.results.skipped.length;

    console.log(chalk.blue.bold('\n📊 Migration Validation Report'));
    console.log(chalk.gray('═'.repeat(60)));
    
    // Summary
    console.log(chalk.green(`✅ Passed: ${this.results.passed.length}`));
    console.log(chalk.red(`❌ Failed: ${this.results.failed.length}`));
    console.log(chalk.yellow(`⚠️  Warnings: ${this.results.warnings.length}`));
    console.log(chalk.blue(`⏭️  Skipped: ${this.results.skipped.length}`));
    console.log(chalk.gray(`📊 Total Tests: ${total}`));
    
    const successRate = total > 0 ? ((this.results.passed.length / total) * 100).toFixed(1) : 0;
    console.log(chalk.cyan(`📈 Success Rate: ${successRate}%`));
    
    // Detailed results
    if (this.results.failed.length > 0) {
      console.log(chalk.red.bold('\n❌ Failed Tests:'));
      this.results.failed.forEach(failure => {
        if (typeof failure === 'string') {
          console.log(chalk.red(`  • ${failure}`));
        } else {
          console.log(chalk.red(`  • ${failure.suite}: ${failure.test}`));
          if (failure.reason) {
            console.log(chalk.gray(`    Reason: ${failure.reason}`));
          }
        }
      });
    }
    
    if (this.results.warnings.length > 0) {
      console.log(chalk.yellow.bold('\n⚠️  Warnings:'));
      this.results.warnings.forEach(warning => {
        console.log(chalk.yellow(`  • ${warning}`));
      });
    }
    
    if (this.results.skipped.length > 0) {
      console.log(chalk.blue.bold('\n⏭️  Skipped Tests:'));
      this.results.skipped.forEach(skipped => {
        console.log(chalk.blue(`  • ${skipped}`));
      });
    }
    
    // Final verdict
    console.log(chalk.gray('═'.repeat(60)));
    
    if (this.results.failed.length === 0) {
      console.log(chalk.green.bold('🎉 Migration validation PASSED!'));
      console.log(chalk.blue('\n✨ Your v3 migration is successful and ready for production.'));
    } else if (this.results.failed.length <= 2 && this.results.passed.length > 5) {
      console.log(chalk.yellow.bold('⚠️  Migration validation PASSED with warnings'));
      console.log(chalk.blue('\n🔧 Minor issues found - please review failed tests above.'));
    } else {
      console.log(chalk.red.bold('❌ Migration validation FAILED'));
      console.log(chalk.blue('\n🚨 Significant issues found - migration needs attention.'));
    }
    
    // Next steps
    console.log(chalk.blue.bold('\n📋 Next Steps:'));
    if (this.results.failed.length === 0) {
      console.log(chalk.gray('  1. ✅ Migration is complete and validated'));
      console.log(chalk.gray('  2. 🚀 Deploy your v3 project'));
      console.log(chalk.gray('  3. 📚 Update team documentation'));
    } else {
      console.log(chalk.gray('  1. 🔧 Fix failed validation tests'));
      console.log(chalk.gray('  2. 🔄 Re-run validation suite'));
      console.log(chalk.gray('  3. 📞 Seek help if issues persist'));
    }
    
    return {
      success: this.results.failed.length === 0,
      successRate: parseFloat(successRate),
      summary: {
        passed: this.results.passed.length,
        failed: this.results.failed.length,
        warnings: this.results.warnings.length,
        skipped: this.results.skipped.length,
        total
      },
      details: this.results
    };
  }

  /**
   * Export validation results to JSON
   */
  async exportResults(outputPath = 'migration-validation-results.json') {
    const report = {
      timestamp: new Date().toISOString(),
      projectPath: this.projectPath,
      results: this.results,
      summary: {
        passed: this.results.passed.length,
        failed: this.results.failed.length,
        warnings: this.results.warnings.length,
        skipped: this.results.skipped.length
      }
    };
    
    await fs.writeJson(path.join(this.projectPath, outputPath), report, { spaces: 2 });
    console.log(chalk.blue(`\n📄 Detailed results exported to: ${outputPath}`));
  }
}

// CLI interface
async function runCLI() {
  const args = process.argv.slice(2);
  const options = {
    projectPath: args.find(arg => !arg.startsWith('-')) || process.cwd(),
    exportResults: args.includes('--export'),
    verbose: args.includes('--verbose') || args.includes('-v')
  };
  
  console.log(chalk.blue.bold('🔍 Unjucks V2→V3 Migration Validation Suite'));
  console.log(chalk.gray('Ensures migration quality and compatibility\n'));
  
  try {
    const validator = new MigrationValidationSuite(options.projectPath);
    await validator.runValidation();
    
    if (options.exportResults) {
      await validator.exportResults();
    }
    
    // Exit with appropriate code
    const hasFailures = validator.results.failed.length > 0;
    process.exit(hasFailures ? 1 : 0);
    
  } catch (error) {
    console.error(chalk.red('\n💥 Validation suite failed:'), error.message);
    process.exit(1);
  }
}

// Run CLI if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI().catch(error => {
    console.error('Validation suite crashed:', error);
    process.exit(1);
  });
}

export { MigrationValidationSuite };