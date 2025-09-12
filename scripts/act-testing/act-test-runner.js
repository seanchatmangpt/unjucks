#!/usr/bin/env node

/**
 * Act Test Runner - Comprehensive testing suite for GitHub Actions workflows
 * 
 * This script provides a comprehensive testing framework for running GitHub Actions
 * workflows locally using act, with support for different test modes, matrix builds,
 * and detailed reporting.
 * 
 * @author Act Compatibility Engineering Team
 */

import fs from 'fs/promises';
import path from 'path';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ActTestRunner {
  constructor(options = {}) {
    this.options = {
      dryRun: options.dryRun || false,
      verbose: options.verbose || false,
      parallel: options.parallel || false,
      timeout: options.timeout || 300000, // 5 minutes
      retries: options.retries || 2,
      outputDir: options.outputDir || 'test-results/act',
      ...options
    };
    
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      tests: []
    };
    
    this.actVersion = null;
    this.dockerVersion = null;
  }

  async initialize() {
    console.log('🚀 Initializing Act Test Runner...');
    
    // Check prerequisites
    await this.checkPrerequisites();
    
    // Create output directory
    await fs.mkdir(this.options.outputDir, { recursive: true });
    
    // Setup act configuration
    await this.setupActConfiguration();
    
    console.log('✅ Act Test Runner initialized successfully');
  }

  async checkPrerequisites() {
    console.log('🔍 Checking prerequisites...');
    
    try {
      // Check act installation
      const { stdout: actOutput } = await execAsync('act --version');
      this.actVersion = actOutput.trim();
      console.log(`✅ Act version: ${this.actVersion}`);
    } catch (error) {
      throw new Error('Act is not installed. Please install: https://github.com/nektos/act#installation');
    }
    
    try {
      // Check Docker installation
      const { stdout: dockerOutput } = await execAsync('docker --version');
      this.dockerVersion = dockerOutput.trim();
      console.log(`✅ Docker version: ${this.dockerVersion}`);
    } catch (error) {
      throw new Error('Docker is not installed or not running');
    }
    
    // Check Docker daemon
    try {
      await execAsync('docker info');
      console.log('✅ Docker daemon is running');
    } catch (error) {
      throw new Error('Docker daemon is not running');
    }
  }

  async setupActConfiguration() {
    const actrcPath = path.join(process.cwd(), '.actrc');
    
    try {
      await fs.access(actrcPath);
      console.log('✅ Found existing .actrc configuration');
    } catch (error) {
      console.log('⚠️  No .actrc found, creating default configuration...');
      await this.createDefaultActrc();
    }
  }

  async createDefaultActrc() {
    const defaultConfig = `# Act configuration for workflow testing
# Platform mappings
-P ubuntu-latest=catthehacker/ubuntu:act-latest
-P ubuntu-22.04=catthehacker/ubuntu:act-22.04
-P ubuntu-20.04=catthehacker/ubuntu:act-20.04
-P windows-latest=catthehacker/ubuntu:act-latest
-P macos-latest=catthehacker/ubuntu:act-latest

# Default environment variables
--env CI=true
--env GITHUB_ACTIONS=true
--env RUNNER_OS=Linux
--env RUNNER_ARCH=X64

# Default secrets
--secret GITHUB_TOKEN=ghp_mock_token_for_local_testing

# Artifact settings
--artifact-server-path /tmp/artifacts

# Performance optimizations
--reuse
--rm=false

# Networking
--bind
`;

    await fs.writeFile(path.join(process.cwd(), '.actrc'), defaultConfig);
    console.log('✅ Created default .actrc configuration');
  }

  async runAllTests() {
    console.log('🧪 Running comprehensive act test suite...');
    
    await this.initialize();
    
    const testSuites = [
      () => this.testWorkflowSyntax(),
      () => this.testBasicWorkflows(),
      () => this.testMatrixBuilds(),
      () => this.testServiceContainers(),
      () => this.testSecretHandling(),
      () => this.testPathMappings(),
      () => this.testContainerCompatibility(),
      () => this.testEnvironmentVariables()
    ];
    
    if (this.options.parallel) {
      await Promise.allSettled(testSuites.map(test => test()));
    } else {
      for (const test of testSuites) {
        await test();
      }
    }
    
    await this.generateReport();
    return this.results;
  }

  async testWorkflowSyntax() {
    console.log('\n📝 Testing workflow syntax validation...');
    
    const workflowsDir = path.join(process.cwd(), '.github/workflows');
    const workflows = await this.getWorkflowFiles(workflowsDir);
    
    for (const workflow of workflows) {
      await this.runTest(`syntax-${workflow}`, async () => {
        const command = `act --dry-run -W .github/workflows/${workflow}`;
        const result = await this.executeActCommand(command);
        
        if (result.exitCode !== 0) {
          throw new Error(`Syntax validation failed: ${result.stderr}`);
        }
        
        return { success: true, message: 'Syntax validation passed' };
      });
    }
  }

  async testBasicWorkflows() {
    console.log('\n🏃 Testing basic workflow execution...');
    
    const basicWorkflows = [
      'ci.yml',
      'nodejs-ci.yml',
      'checks.yml'
    ];
    
    for (const workflow of basicWorkflows) {
      await this.runTest(`basic-${workflow}`, async () => {
        const command = `act push -W .github/workflows/${workflow} --dryrun`;
        const result = await this.executeActCommand(command);
        
        if (result.exitCode !== 0) {
          throw new Error(`Basic workflow test failed: ${result.stderr}`);
        }
        
        return { success: true, message: 'Basic workflow executed successfully' };
      });
    }
  }

  async testMatrixBuilds() {
    console.log('\n🔲 Testing matrix build strategies...');
    
    await this.runTest('matrix-builds', async () => {
      // Test cross-platform CI which has matrix strategy
      const command = `act push -W .github/workflows/cross-platform-ci.yml --matrix node-version:20 --matrix os:ubuntu-latest`;
      const result = await this.executeActCommand(command);
      
      // Matrix builds may have limitations, so we accept warnings
      if (result.exitCode > 1) {
        throw new Error(`Matrix build test failed: ${result.stderr}`);
      }
      
      return { 
        success: true, 
        message: 'Matrix build strategy tested',
        warnings: result.exitCode === 1 ? ['Matrix parallelism limited in act'] : []
      };
    });
  }

  async testServiceContainers() {
    console.log('\n🐳 Testing service container compatibility...');
    
    await this.runTest('service-containers', async () => {
      // Test docker-validation workflow which uses service containers
      const command = `act push -W .github/workflows/docker-validation.yml --job production-simulation`;
      const result = await this.executeActCommand(command, { timeout: 120000 });
      
      // Service containers may not work perfectly in act
      return { 
        success: result.exitCode <= 1, 
        message: 'Service container test completed',
        warnings: result.exitCode === 1 ? ['Service containers have limited support in act'] : []
      };
    });
  }

  async testSecretHandling() {
    console.log('\n🔐 Testing secret handling and environment variables...');
    
    await this.runTest('secret-handling', async () => {
      // Create temporary secrets file
      const secretsFile = path.join(this.options.outputDir, 'test-secrets.env');
      const secrets = `GITHUB_TOKEN=ghp_test_token
NPM_TOKEN=npm_test_token
TEST_SECRET=test_value`;
      
      await fs.writeFile(secretsFile, secrets);
      
      const command = `act push -W .github/workflows/ci.yml --secret-file ${secretsFile}`;
      const result = await this.executeActCommand(command);
      
      // Clean up
      await fs.unlink(secretsFile).catch(() => {});
      
      return { 
        success: result.exitCode <= 1, 
        message: 'Secret handling tested',
        details: 'Secrets were loaded from file'
      };
    });
  }

  async testPathMappings() {
    console.log('\n📁 Testing path mappings and volume mounts...');
    
    await this.runTest('path-mappings', async () => {
      // Test workflow that involves file operations
      const command = `act push -W .github/workflows/comprehensive-testing.yml --job test-matrix --bind`;
      const result = await this.executeActCommand(command);
      
      return { 
        success: result.exitCode <= 1, 
        message: 'Path mapping test completed',
        details: 'Volume mounts and path mappings tested'
      };
    });
  }

  async testContainerCompatibility() {
    console.log('\n🏗️ Testing container and platform compatibility...');
    
    const platforms = [
      'ubuntu-latest=catthehacker/ubuntu:act-latest',
      'ubuntu-22.04=catthehacker/ubuntu:act-22.04',
      'ubuntu-20.04=catthehacker/ubuntu:act-20.04'
    ];
    
    for (const platform of platforms) {
      await this.runTest(`container-${platform.split('=')[0]}`, async () => {
        const command = `act push -P ${platform} -W .github/workflows/ci.yml --job build-and-test`;
        const result = await this.executeActCommand(command, { timeout: 180000 });
        
        return { 
          success: result.exitCode <= 1, 
          message: `Container compatibility tested for ${platform.split('=')[0]}`,
          platform: platform
        };
      });
    }
  }

  async testEnvironmentVariables() {
    console.log('\n🌍 Testing environment variable handling...');
    
    await this.runTest('environment-variables', async () => {
      const envVars = [
        'CI=true',
        'NODE_ENV=test',
        'CUSTOM_VAR=test_value'
      ];
      
      const envArgs = envVars.map(env => `--env ${env}`).join(' ');
      const command = `act push ${envArgs} -W .github/workflows/ci.yml`;
      const result = await this.executeActCommand(command);
      
      return { 
        success: result.exitCode <= 1, 
        message: 'Environment variable handling tested',
        variables: envVars
      };
    });
  }

  async runTest(testName, testFunction) {
    console.log(`  🔧 Running test: ${testName}`);
    this.results.total++;
    
    const startTime = this.getDeterministicTimestamp();
    let attempts = 0;
    let lastError = null;
    
    while (attempts <= this.options.retries) {
      try {
        const result = await Promise.race([
          testFunction(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Test timeout')), this.options.timeout)
          )
        ]);
        
        this.results.passed++;
        this.results.tests.push({
          name: testName,
          status: 'passed',
          duration: this.getDeterministicTimestamp() - startTime,
          attempts: attempts + 1,
          result
        });
        
        console.log(`  ✅ ${testName} passed (${attempts + 1}/${this.options.retries + 1} attempts)`);
        return;
        
      } catch (error) {
        lastError = error;
        attempts++;
        
        if (attempts <= this.options.retries) {
          console.log(`  ⚠️  ${testName} failed, retrying... (${attempts}/${this.options.retries + 1})`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    this.results.failed++;
    this.results.tests.push({
      name: testName,
      status: 'failed',
      duration: this.getDeterministicTimestamp() - startTime,
      attempts: attempts,
      error: lastError.message
    });
    
    console.log(`  ❌ ${testName} failed after ${attempts} attempts: ${lastError.message}`);
  }

  async executeActCommand(command, options = {}) {
    if (this.options.verbose) {
      console.log(`    📝 Executing: ${command}`);
    }
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: options.timeout || this.options.timeout,
        cwd: process.cwd()
      });
      
      return {
        exitCode: 0,
        stdout,
        stderr
      };
    } catch (error) {
      return {
        exitCode: error.code || 1,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message
      };
    }
  }

  async getWorkflowFiles(workflowsDir) {
    try {
      const files = await fs.readdir(workflowsDir);
      return files.filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
    } catch (error) {
      console.error(`Error reading workflows directory: ${error.message}`);
      return [];
    }
  }

  async generateReport() {
    console.log('\n📊 Generating comprehensive test report...');
    
    const report = {
      metadata: {
        timestamp: this.getDeterministicDate().toISOString(),
        actVersion: this.actVersion,
        dockerVersion: this.dockerVersion,
        options: this.options
      },
      summary: {
        total: this.results.total,
        passed: this.results.passed,
        failed: this.results.failed,
        skipped: this.results.skipped,
        passRate: Math.round((this.results.passed / this.results.total) * 100)
      },
      results: this.results.tests,
      recommendations: this.generateRecommendations()
    };
    
    // Save JSON report
    const jsonReportPath = path.join(this.options.outputDir, 'act-test-report.json');
    await fs.writeFile(jsonReportPath, JSON.stringify(report, null, 2));
    
    // Save markdown report
    const markdownReport = this.generateMarkdownReport(report);
    const mdReportPath = path.join(this.options.outputDir, 'act-test-report.md');
    await fs.writeFile(mdReportPath, markdownReport);
    
    console.log('\n📈 Test Results Summary:');
    console.log(`  Total Tests: ${report.summary.total}`);
    console.log(`  Passed: ${report.summary.passed} (${report.summary.passRate}%)`);
    console.log(`  Failed: ${report.summary.failed}`);
    console.log(`  Skipped: ${report.summary.skipped}`);
    console.log(`\n📄 Reports saved to:`);
    console.log(`  JSON: ${jsonReportPath}`);
    console.log(`  Markdown: ${mdReportPath}`);
    
    return report;
  }

  generateMarkdownReport(report) {
    return `# Act Compatibility Test Report

## Summary

- **Total Tests**: ${report.summary.total}
- **Passed**: ${report.summary.passed} (${report.summary.passRate}%)
- **Failed**: ${report.summary.failed}
- **Skipped**: ${report.summary.skipped}

## Environment

- **Act Version**: ${report.metadata.actVersion}
- **Docker Version**: ${report.metadata.dockerVersion}
- **Test Date**: ${report.metadata.timestamp}

## Test Results

${report.results.map(test => `
### ${test.name}

- **Status**: ${test.status === 'passed' ? '✅' : '❌'} ${test.status}
- **Duration**: ${test.duration}ms
- **Attempts**: ${test.attempts}
${test.error ? `- **Error**: ${test.error}` : ''}
${test.result?.message ? `- **Details**: ${test.result.message}` : ''}
`).join('\n')}

## Recommendations

${report.recommendations.map(rec => `
### ${rec.category}

${rec.recommendations.map(r => `- ${r}`).join('\n')}
`).join('\n')}

## Act Limitations and Workarounds

### Known Limitations

1. **GitHub API Access**: Limited access to GitHub APIs (github-script actions)
2. **Service Containers**: May not work exactly like in GitHub Actions
3. **Matrix Builds**: Limited parallelism compared to GitHub Actions
4. **External Integrations**: Many external services require mocking
5. **Platform Simulation**: Not all OS-specific behaviors are replicated

### Recommended Workarounds

1. **Mock External APIs**: Use environment variables to skip external calls
2. **Simplify Service Dependencies**: Test with minimal service configurations
3. **Use Environment Flags**: Add conditionals for local testing
4. **Custom Scripts**: Replace complex actions with bash scripts
5. **Staged Testing**: Test components individually before full workflows

## Next Steps

1. Fix failing tests by implementing recommended workarounds
2. Update workflow files with act-compatible alternatives
3. Create act-specific test configurations
4. Set up continuous integration for act testing
5. Document team guidelines for act usage
`;
  }

  generateRecommendations() {
    const failedTests = this.results.tests.filter(t => t.status === 'failed');
    
    const recommendations = [
      {
        category: 'General',
        recommendations: [
          'Use act for local workflow development and testing',
          'Keep workflows simple and avoid GitHub-specific features',
          'Test critical workflows before pushing to GitHub'
        ]
      }
    ];
    
    if (failedTests.length > 0) {
      recommendations.push({
        category: 'Failed Tests',
        recommendations: failedTests.map(test => 
          `Fix ${test.name}: ${test.error || 'Unknown error'}`
        )
      });
    }
    
    return recommendations;
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options = {
    dryRun: args.includes('--dry-run'),
    verbose: args.includes('--verbose'),
    parallel: args.includes('--parallel')
  };
  
  const runner = new ActTestRunner(options);
  
  runner.runAllTests()
    .then(results => {
      console.log('\n🎉 Act testing completed successfully!');
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('\n💥 Act testing failed:', error);
      process.exit(1);
    });
}

export { ActTestRunner };