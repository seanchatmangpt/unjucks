#!/usr/bin/env node

/**
 * Production Validation Script
 * Final validation of the npm package in a clean environment
 */

import { promises as fs } from 'fs';
import { execSync, spawn } from 'child_process';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

class ProductionValidator {
  constructor() {
    this.testResults = [];
    this.tempDir = null;
  }

  log(message, type = 'info') {
    const colors = {
      info: chalk.blue,
      success: chalk.green,
      warning: chalk.yellow,
      error: chalk.red
    };
    console.log(colors[type](`[VALIDATE] ${message}`));
  }

  async createTempWorkspace() {
    this.tempDir = path.join(os.tmpdir(), `unjucks-validation-${Date.now()}`);
    await fs.mkdir(this.tempDir, { recursive: true });
    this.log(`Created temp workspace: ${this.tempDir}`, 'info');
    return this.tempDir;
  }

  async testGlobalInstallation() {
    this.log('🌍 Testing global installation...', 'info');
    
    const tests = [
      {
        name: 'Global Binary Available',
        test: () => {
          try {
            const result = execSync('which unjucks', { encoding: 'utf-8', timeout: 5000 });
            return { passed: true, output: result.trim() };
          } catch {
            return { passed: false, error: 'unjucks binary not found in PATH' };
          }
        }
      },
      {
        name: 'Version Command',
        test: () => {
          try {
            const result = execSync('unjucks --version', { encoding: 'utf-8', timeout: 5000 });
            const hasVersion = /\d+\.\d+/.test(result);
            return { 
              passed: hasVersion, 
              output: result.trim(),
              error: hasVersion ? null : 'Version output invalid'
            };
          } catch (error) {
            return { passed: false, error: error.message };
          }
        }
      },
      {
        name: 'Help Command',
        test: () => {
          try {
            const result = execSync('unjucks --help', { encoding: 'utf-8', timeout: 5000 });
            const hasUsage = /usage|USAGE|help|commands/i.test(result);
            return { 
              passed: hasUsage, 
              output: result.substring(0, 200) + '...',
              error: hasUsage ? null : 'Help output invalid'
            };
          } catch (error) {
            return { passed: false, error: error.message };
          }
        }
      },
      {
        name: 'List Command',
        test: () => {
          try {
            const result = execSync('unjucks list', { encoding: 'utf-8', timeout: 10000 });
            return { 
              passed: true, 
              output: result.substring(0, 200) + '...',
            };
          } catch (error) {
            // List command might fail if no templates, but shouldn't crash
            const isGracefulFailure = error.message.includes('No generators found') || 
                                      error.message.includes('templates') ||
                                      error.status === 0;
            return { 
              passed: isGracefulFailure, 
              error: isGracefulFailure ? null : error.message 
            };
          }
        }
      }
    ];

    for (const test of tests) {
      const result = test.test();
      this.testResults.push({ ...result, name: test.name });
      
      if (result.passed) {
        this.log(`✅ ${test.name}: PASSED`, 'success');
        if (result.output) {
          this.log(`   Output: ${result.output}`, 'info');
        }
      } else {
        this.log(`❌ ${test.name}: FAILED - ${result.error}`, 'error');
      }
    }
  }

  async testPackageIntegrity() {
    this.log('🔍 Testing package integrity...', 'info');
    
    const packageFile = await this.findPackageFile();
    
    if (!packageFile) {
      this.testResults.push({ 
        name: 'Package File Exists', 
        passed: false, 
        error: 'No .tgz package file found' 
      });
      return;
    }

    const tests = [
      {
        name: 'Package File Exists',
        test: async () => {
          try {
            const stats = await fs.stat(path.resolve(rootDir, packageFile));
            return { 
              passed: true, 
              output: `Size: ${(stats.size / 1024 / 1024).toFixed(2)}MB` 
            };
          } catch {
            return { passed: false, error: 'Package file not accessible' };
          }
        }
      },
      {
        name: 'Package Contents Valid',
        test: async () => {
          try {
            const output = execSync(`tar -tzf ${packageFile}`, { 
              cwd: rootDir, 
              encoding: 'utf-8',
              timeout: 5000
            });
            const files = output.split('\n').filter(Boolean);
            const hasMainFiles = files.some(f => f.includes('package.json')) &&
                               files.some(f => f.includes('bin/')) &&
                               files.some(f => f.includes('src/'));
            return { 
              passed: hasMainFiles, 
              output: `${files.length} files`,
              error: hasMainFiles ? null : 'Missing essential files' 
            };
          } catch (error) {
            return { passed: false, error: error.message };
          }
        }
      },
      {
        name: 'No Sensitive Files',
        test: async () => {
          try {
            const output = execSync(`tar -tzf ${packageFile}`, { 
              cwd: rootDir, 
              encoding: 'utf-8' 
            });
            const sensitivePatterns = ['.env', '.key', '.pem', 'secret', 'private'];
            const sensitiveFiles = output.split('\n').filter(line => 
              sensitivePatterns.some(pattern => 
                line.toLowerCase().includes(pattern) && !line.includes('.example')
              )
            );
            return { 
              passed: sensitiveFiles.length === 0,
              output: sensitiveFiles.length ? `Found: ${sensitiveFiles.join(', ')}` : 'Clean',
              error: sensitiveFiles.length ? 'Sensitive files detected in package' : null
            };
          } catch (error) {
            return { passed: false, error: error.message };
          }
        }
      }
    ];

    for (const test of tests) {
      const result = await test.test();
      this.testResults.push({ ...result, name: test.name });
      
      if (result.passed) {
        this.log(`✅ ${test.name}: PASSED`, 'success');
        if (result.output) {
          this.log(`   ${result.output}`, 'info');
        }
      } else {
        this.log(`❌ ${test.name}: FAILED - ${result.error}`, 'error');
      }
    }
  }

  async testFreshInstallation() {
    this.log('📦 Testing fresh installation in clean environment...', 'info');
    
    await this.createTempWorkspace();
    
    const tests = [
      {
        name: 'Fresh Install from Tarball',
        test: async () => {
          try {
            const packageFile = await this.findPackageFile();
            const packagePath = path.resolve(rootDir, packageFile);
            
            // Initialize temp package.json
            execSync('npm init -y', { cwd: this.tempDir, stdio: 'pipe' });
            
            // Install from tarball
            execSync(`npm install ${packagePath}`, { 
              cwd: this.tempDir, 
              stdio: 'pipe',
              timeout: 30000
            });
            
            return { passed: true, output: 'Installation completed' };
          } catch (error) {
            return { passed: false, error: error.message };
          }
        }
      },
      {
        name: 'Node Modules Structure',
        test: async () => {
          try {
            const moduleDir = path.join(this.tempDir, 'node_modules', '@seanchatmangpt', 'unjucks');
            const exists = await fs.access(moduleDir).then(() => true).catch(() => false);
            
            if (!exists) {
              return { passed: false, error: 'Module not found in node_modules' };
            }
            
            // Check for essential files
            const essentialFiles = ['package.json', 'bin/unjucks.cjs', 'src/cli/index.js'];
            for (const file of essentialFiles) {
              const exists = await fs.access(path.join(moduleDir, file)).then(() => true).catch(() => false);
              if (!exists) {
                return { passed: false, error: `Missing essential file: ${file}` };
              }
            }
            
            return { passed: true, output: 'All essential files present' };
          } catch (error) {
            return { passed: false, error: error.message };
          }
        }
      },
      {
        name: 'Local Binary Execution',
        test: async () => {
          try {
            const binaryPath = path.join(this.tempDir, 'node_modules', '.bin', 'unjucks');
            const result = execSync(`${binaryPath} --version`, { 
              encoding: 'utf-8',
              timeout: 5000
            });
            
            const hasVersion = /\d+\.\d+/.test(result);
            return { 
              passed: hasVersion, 
              output: result.trim(),
              error: hasVersion ? null : 'Version output invalid'
            };
          } catch (error) {
            return { passed: false, error: error.message };
          }
        }
      }
    ];

    for (const test of tests) {
      const result = await test.test();
      this.testResults.push({ ...result, name: test.name });
      
      if (result.passed) {
        this.log(`✅ ${test.name}: PASSED`, 'success');
        if (result.output) {
          this.log(`   ${result.output}`, 'info');
        }
      } else {
        this.log(`❌ ${test.name}: FAILED - ${result.error}`, 'error');
      }
    }
  }

  async findPackageFile() {
    try {
      const files = await fs.readdir(rootDir);
      return files.find(f => f.endsWith('.tgz') && f.includes('unjucks'));
    } catch {
      return null;
    }
  }

  async generateValidationReport() {
    const passed = this.testResults.filter(r => r.passed).length;
    const total = this.testResults.length;
    const percentage = Math.round((passed / total) * 100);
    
    console.log('\n' + '='.repeat(80));
    console.log(chalk.cyan.bold('📋 PRODUCTION VALIDATION REPORT'));
    console.log('='.repeat(80));
    
    console.log(chalk.yellow.bold(`\n🎯 Test Results: ${passed}/${total} (${percentage}%)`));
    
    // Group results by category
    const categories = {
      'Global Installation': this.testResults.filter(r => 
        ['Global Binary Available', 'Version Command', 'Help Command', 'List Command'].includes(r.name)
      ),
      'Package Integrity': this.testResults.filter(r => 
        ['Package File Exists', 'Package Contents Valid', 'No Sensitive Files'].includes(r.name)
      ),
      'Fresh Installation': this.testResults.filter(r => 
        ['Fresh Install from Tarball', 'Node Modules Structure', 'Local Binary Execution'].includes(r.name)
      )
    };
    
    for (const [category, results] of Object.entries(categories)) {
      if (results.length === 0) continue;
      
      console.log(chalk.yellow.bold(`\n${category}:`));
      for (const result of results) {
        const icon = result.passed ? '✅' : '❌';
        const color = result.passed ? chalk.green : chalk.red;
        console.log(color(`   ${icon} ${result.name}`));
        if (!result.passed && result.error) {
          console.log(chalk.red(`      Error: ${result.error}`));
        }
      }
    }
    
    // Overall assessment
    console.log(chalk.yellow.bold('\n🏆 Production Readiness:'));
    if (percentage >= 90) {
      console.log(chalk.green.bold('   ✅ EXCELLENT - Ready for production deployment!'));
    } else if (percentage >= 80) {
      console.log(chalk.yellow.bold('   ⚠️  GOOD - Minor issues should be addressed'));
    } else if (percentage >= 70) {
      console.log(chalk.orange.bold('   ⚠️  ACCEPTABLE - Several issues need attention'));
    } else {
      console.log(chalk.red.bold('   ❌ NEEDS WORK - Critical issues must be resolved'));
    }
    
    console.log('\n' + '='.repeat(80));
    
    return percentage >= 80;
  }

  async cleanup() {
    if (this.tempDir) {
      try {
        await fs.rm(this.tempDir, { recursive: true, force: true });
        this.log(`Cleaned up temp workspace: ${this.tempDir}`, 'info');
      } catch (error) {
        this.log(`Warning: Could not cleanup ${this.tempDir}: ${error.message}`, 'warning');
      }
    }
  }

  async runFullValidation() {
    this.log('🚀 Starting production validation...', 'info');
    
    try {
      await this.testPackageIntegrity();
      await this.testGlobalInstallation();
      await this.testFreshInstallation();
      
      const isValid = await this.generateValidationReport();
      await this.cleanup();
      
      return isValid;
    } catch (error) {
      this.log(`Validation failed: ${error.message}`, 'error');
      await this.cleanup();
      return false;
    }
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new ProductionValidator();
  
  validator.runFullValidation()
    .then(isValid => {
      process.exit(isValid ? 0 : 1);
    })
    .catch(error => {
      console.error(chalk.red(`Fatal validation error: ${error.message}`));
      process.exit(1);
    });
}

export { ProductionValidator };