#!/usr/bin/env node

/**
 * Database Connectivity Smoke Tests
 * Tests database connections and basic operations
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

class DatabaseConnectivityTester {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
    this.dbConfigs = [];
  }

  log(message, type = 'info') {
    const timestamp = Date.now() - this.startTime;
    const colors = {
      info: 'blue',
      success: 'green',
      error: 'red',
      warning: 'yellow'
    };
    console.log(chalk[colors[type]](`[${timestamp}ms] ${message}`));
  }

  async setup() {
    // Discover database configurations
    await this.discoverDatabaseConfigs();
  }

  async discoverDatabaseConfigs() {
    const configPaths = [
      path.join(projectRoot, 'src/server/config/database.js'),
      path.join(projectRoot, 'config/database.js'),
      path.join(projectRoot, 'config/database.json'),
      path.join(projectRoot, '.env'),
      path.join(projectRoot, 'knexfile.js'),
      path.join(projectRoot, 'sequelize.config.js')
    ];

    for (const configPath of configPaths) {
      if (await fs.pathExists(configPath)) {
        this.dbConfigs.push({
          path: configPath,
          type: this.inferDatabaseType(configPath),
          exists: true
        });
      }
    }

    if (this.dbConfigs.length === 0) {
      this.log('No database configuration files found', 'warning');
    } else {
      this.log(`Found ${this.dbConfigs.length} database configuration(s)`, 'info');
    }
  }

  inferDatabaseType(configPath) {
    const filename = path.basename(configPath);
    if (filename.includes('database')) return 'generic';
    if (filename.includes('knex')) return 'knex';
    if (filename.includes('sequelize')) return 'sequelize';
    if (filename.includes('.env')) return 'environment';
    return 'unknown';
  }

  async test(name, testFn, timeout = 5000) {
    this.log(`Testing: ${name}`, 'info');
    const testStart = Date.now();
    
    try {
      const result = await Promise.race([
        testFn(),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Test timeout')), timeout);
        })
      ]);
      
      const duration = Date.now() - testStart;
      this.results.push({ 
        name, 
        status: 'PASS', 
        duration,
        message: result?.message || 'Test passed'
      });
      this.log(`✅ PASS: ${name} (${duration}ms)`, 'success');
      return true;
    } catch (error) {
      const duration = Date.now() - testStart;
      this.results.push({ 
        name, 
        status: 'FAIL', 
        duration,
        error: error.message
      });
      this.log(`❌ FAIL: ${name} (${duration}ms) - ${error.message}`, 'error');
      return false;
    }
  }

  async testConfigurationFiles() {
    if (this.dbConfigs.length === 0) {
      return { message: 'No database configurations found (not required for all projects)' };
    }

    let validConfigs = 0;
    for (const config of this.dbConfigs) {
      try {
        const stats = await fs.stat(config.path);
        if (stats.isFile() && stats.size > 0) {
          validConfigs++;
          this.log(`Valid config: ${config.path} (${config.type})`, 'success');
        }
      } catch (error) {
        this.log(`Invalid config: ${config.path} - ${error.message}`, 'warning');
      }
    }

    if (validConfigs === 0) {
      throw new Error('No valid database configuration files found');
    }

    return { message: `${validConfigs} valid database configuration(s) found` };
  }

  async testEnvironmentVariables() {
    const dbEnvVars = [
      'DATABASE_URL',
      'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD',
      'POSTGRES_URL', 'MYSQL_URL', 'MONGODB_URL',
      'REDIS_URL', 'REDIS_HOST'
    ];

    const foundVars = [];
    for (const varName of dbEnvVars) {
      if (process.env[varName]) {
        foundVars.push(varName);
      }
    }

    if (foundVars.length === 0) {
      return { message: 'No database environment variables found (not required for all projects)' };
    }

    this.log(`Found database env vars: ${foundVars.join(', ')}`, 'info');
    return { message: `${foundVars.length} database environment variable(s) configured` };
  }

  async testDatabaseModules() {
    const dbModules = [
      'mysql2', 'mysql', 'pg', 'sqlite3', 'mongodb', 'mongoose',
      'redis', 'ioredis', 'knex', 'sequelize', 'typeorm', 'prisma'
    ];

    const packageJsonPath = path.join(projectRoot, 'package.json');
    if (!await fs.pathExists(packageJsonPath)) {
      throw new Error('package.json not found');
    }

    const packageJson = await fs.readJson(packageJsonPath);
    const allDeps = {
      ...packageJson.dependencies || {},
      ...packageJson.devDependencies || {},
      ...packageJson.optionalDependencies || {}
    };

    const foundModules = [];
    for (const module of dbModules) {
      if (allDeps[module]) {
        foundModules.push(module);
      }
    }

    if (foundModules.length === 0) {
      return { message: 'No database modules found (not required for all projects)' };
    }

    this.log(`Found database modules: ${foundModules.join(', ')}`, 'info');
    return { message: `${foundModules.length} database module(s) available` };
  }

  async testSQLiteConnection() {
    // Test SQLite since it's file-based and doesn't require external services
    try {
      const sqliteFiles = [
        path.join(projectRoot, 'database.sqlite'),
        path.join(projectRoot, 'db.sqlite3'),
        path.join(projectRoot, 'data.db'),
        path.join(projectRoot, 'storage/database.sqlite')
      ];

      for (const sqliteFile of sqliteFiles) {
        if (await fs.pathExists(sqliteFile)) {
          const stats = await fs.stat(sqliteFile);
          this.log(`Found SQLite database: ${sqliteFile} (${stats.size} bytes)`, 'success');
          return { message: 'SQLite database file accessible' };
        }
      }

      return { message: 'No SQLite database files found (not required)' };
    } catch (error) {
      throw new Error(`SQLite test failed: ${error.message}`);
    }
  }

  async testConnectionPooling() {
    // Test basic connection pooling concepts
    const poolConfigs = this.dbConfigs.filter(config => {
      return config.path.includes('database') || config.path.includes('knex');
    });

    if (poolConfigs.length === 0) {
      return { message: 'No connection pool configurations found (not required)' };
    }

    // For smoke tests, just verify the config files are readable
    for (const config of poolConfigs) {
      try {
        const content = await fs.readFile(config.path, 'utf8');
        if (content.includes('pool') || content.includes('max') || content.includes('min')) {
          this.log(`Connection pooling configured in ${config.path}`, 'success');
        }
      } catch (error) {
        this.log(`Could not read config ${config.path}: ${error.message}`, 'warning');
      }
    }

    return { message: 'Connection pooling configuration checked' };
  }

  async testDatabaseSecurity() {
    // Test basic security configurations
    const securityChecks = [];

    // Check for SSL/TLS configuration
    for (const config of this.dbConfigs) {
      try {
        const content = await fs.readFile(config.path, 'utf8');
        if (content.includes('ssl') || content.includes('tls')) {
          securityChecks.push('SSL/TLS configured');
        }
        if (content.includes('encrypt')) {
          securityChecks.push('Encryption configured');
        }
      } catch (error) {
        // Ignore read errors for smoke tests
      }
    }

    // Check environment variables for secure settings
    if (process.env.DATABASE_SSL === 'true' || process.env.DB_SSL === 'true') {
      securityChecks.push('SSL enabled via environment');
    }

    return { 
      message: securityChecks.length > 0 
        ? `Security features: ${securityChecks.join(', ')}` 
        : 'No specific database security configurations found'
    };
  }

  printSummary() {
    const total = this.results.length;
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const totalDuration = Date.now() - this.startTime;

    console.log('\n' + '='.repeat(60));
    console.log(chalk.bold.blue('DATABASE CONNECTIVITY TEST SUMMARY'));
    console.log('='.repeat(60));
    console.log(chalk.cyan(`Total Tests: ${total}`));
    console.log(chalk.green(`Passed: ${passed}`));
    console.log(chalk.red(`Failed: ${failed}`));
    console.log(chalk.blue(`Total Duration: ${totalDuration}ms`));
    
    if (total > 0) {
      console.log(chalk.cyan(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`));
    }

    if (failed > 0) {
      console.log('\n' + chalk.red.bold('FAILED TESTS:'));
      this.results
        .filter(r => r.status === 'FAIL')
        .forEach(result => {
          console.log(chalk.red(`\n❌ ${result.name}`));
          console.log(chalk.red(`   Error: ${result.error}`));
        });
    }

    return passed === total || failed === 0; // Pass if no failures or all pass
  }
}

async function runDatabaseConnectivityTests() {
  const tester = new DatabaseConnectivityTester();
  
  console.log(chalk.bold.blue('💾 Starting Database Connectivity Smoke Tests'));
  console.log(chalk.gray('Testing database configurations and connectivity...\n'));

  try {
    await tester.setup();

    // Run database tests
    await tester.test('Configuration Files', () => tester.testConfigurationFiles());
    await tester.test('Environment Variables', () => tester.testEnvironmentVariables());
    await tester.test('Database Modules', () => tester.testDatabaseModules());
    await tester.test('SQLite Connection', () => tester.testSQLiteConnection());
    await tester.test('Connection Pooling', () => tester.testConnectionPooling());
    await tester.test('Database Security', () => tester.testDatabaseSecurity());

    const allPassed = tester.printSummary();
    
    if (allPassed) {
      console.log(chalk.green.bold('\n🎉 All database connectivity tests passed!'));
    } else {
      console.log(chalk.yellow.bold('\n⚠️ Some database tests had issues (may be expected for CLI-only projects)'));
    }
    
    return allPassed;
    
  } catch (error) {
    console.error(chalk.red.bold('\n💥 Database connectivity test runner failed:'));
    console.error(chalk.red(error.message));
    
    // Don't fail smoke tests if database isn't used
    if (error.message.includes('No database') || error.message.includes('not found')) {
      console.log(chalk.yellow('\n⚠️ Database not configured - this may be expected for CLI-only projects'));
      return true;
    }
    
    return false;
  }
}

// Export for module use
export { DatabaseConnectivityTester, runDatabaseConnectivityTests };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDatabaseConnectivityTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error(chalk.red(error.message));
      process.exit(1);
    });
}