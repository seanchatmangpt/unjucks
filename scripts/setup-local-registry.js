#!/usr/bin/env node

/**
 * Setup Local NPM Registry for Testing
 * Sets up verdaccio local registry and publishes package for testing
 */

import { spawn, exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

class LocalRegistry {
  constructor() {
    this.registryUrl = 'http://localhost:4873';
    this.registryProcess = null;
  }

  log(message, type = 'info') {
    const colors = {
      info: chalk.blue,
      success: chalk.green,
      warning: chalk.yellow,
      error: chalk.red
    };
    console.log(colors[type](`[REGISTRY] ${message}`));
  }

  async startVerdaccio() {
    return new Promise((resolve, reject) => {
      this.log('Starting Verdaccio local registry...', 'info');
      
      // Use npx to run verdaccio with the config
      const configPath = path.resolve(rootDir, 'config/verdaccio.yaml');
      this.registryProcess = spawn('npx', ['verdaccio', '--config', configPath], {
        stdio: 'pipe'
      });

      this.registryProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(output);
        if (output.includes('http address')) {
          this.log('Verdaccio started successfully!', 'success');
          resolve();
        }
      });

      this.registryProcess.stderr.on('data', (data) => {
        console.error(data.toString());
      });

      this.registryProcess.on('error', reject);

      // Wait 3 seconds for startup
      setTimeout(resolve, 3000);
    });
  }

  async configureNpmRegistry() {
    return new Promise((resolve, reject) => {
      this.log('Configuring npm registry...', 'info');
      
      exec(`npm set registry ${this.registryUrl}`, (error, stdout, stderr) => {
        if (error) {
          this.log(`Failed to configure npm registry: ${error.message}`, 'error');
          reject(error);
          return;
        }
        
        this.log('NPM registry configured for local testing', 'success');
        resolve();
      });
    });
  }

  async createUser() {
    return new Promise((resolve, reject) => {
      this.log('Creating test user...', 'info');
      
      const addUser = spawn('npm', ['adduser', '--registry', this.registryUrl], {
        stdio: 'inherit'
      });

      addUser.on('close', (code) => {
        if (code === 0) {
          this.log('Test user created successfully', 'success');
          resolve();
        } else {
          // Don't fail if user already exists
          this.log('User creation completed (may already exist)', 'warning');
          resolve();
        }
      });

      addUser.on('error', (error) => {
        this.log('User creation completed (interactive mode)', 'warning');
        resolve(); // Don't fail the process
      });

      // Auto-timeout after 10 seconds
      setTimeout(() => {
        addUser.kill();
        resolve();
      }, 10000);
    });
  }

  async publishPackage() {
    return new Promise((resolve, reject) => {
      this.log('Publishing package to local registry...', 'info');
      
      exec(`npm publish --registry ${this.registryUrl}`, { cwd: rootDir }, (error, stdout, stderr) => {
        if (error) {
          if (error.message.includes('You cannot publish over the previously published versions')) {
            this.log('Package already published to local registry', 'warning');
            resolve();
          } else {
            this.log(`Failed to publish package: ${error.message}`, 'error');
            reject(error);
          }
          return;
        }
        
        this.log('Package published successfully to local registry!', 'success');
        console.log(stdout);
        resolve();
      });
    });
  }

  async testInstallation() {
    return new Promise((resolve, reject) => {
      this.log('Testing package installation...', 'info');
      
      const testDir = path.resolve(rootDir, 'temp-test-install');
      
      // Create test directory
      exec(`mkdir -p ${testDir} && cd ${testDir} && npm init -y`, (error) => {
        if (error) {
          reject(error);
          return;
        }

        // Try to install the package
        exec(`cd ${testDir} && npm install @seanchatmangpt/unjucks --registry ${this.registryUrl}`, (error, stdout, stderr) => {
          if (error) {
            this.log(`Installation test failed: ${error.message}`, 'error');
            reject(error);
            return;
          }
          
          this.log('Package installation test successful!', 'success');
          
          // Cleanup
          exec(`rm -rf ${testDir}`, () => {
            resolve();
          });
        });
      });
    });
  }

  async restoreNpmRegistry() {
    return new Promise((resolve) => {
      this.log('Restoring original npm registry...', 'info');
      
      exec('npm config delete registry', (error) => {
        if (error) {
          this.log('Failed to restore npm registry (this is usually okay)', 'warning');
        } else {
          this.log('NPM registry restored to default', 'success');
        }
        resolve();
      });
    });
  }

  async stop() {
    if (this.registryProcess) {
      this.log('Stopping Verdaccio...', 'info');
      this.registryProcess.kill();
    }
    await this.restoreNpmRegistry();
  }

  async runFullTest() {
    try {
      await this.startVerdaccio();
      await this.configureNpmRegistry();
      await this.createUser();
      await this.publishPackage();
      await this.testInstallation();
      
      this.log('🎉 Local registry testing completed successfully!', 'success');
      this.log(`Registry available at: ${this.registryUrl}`, 'info');
      this.log('Run "npm config delete registry" to restore default npm registry', 'warning');
      
      return true;
    } catch (error) {
      this.log(`❌ Local registry test failed: ${error.message}`, 'error');
      return false;
    }
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const registry = new LocalRegistry();
  
  // Handle cleanup on exit
  process.on('SIGINT', async () => {
    await registry.stop();
    process.exit(0);
  });

  registry.runFullTest()
    .then(success => {
      if (!success) {
        process.exit(1);
      }
      // Keep process alive to maintain registry
      console.log(chalk.cyan('Registry is running. Press Ctrl+C to stop.'));
    })
    .catch(error => {
      console.error(chalk.red(`Fatal error: ${error.message}`));
      process.exit(1);
    });
}

export { LocalRegistry };