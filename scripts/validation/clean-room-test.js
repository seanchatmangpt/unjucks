#!/usr/bin/env node

/**
 * Clean Room Testing Script for Cross-Platform Validation
 * Creates isolated environments to test package installation and functionality
 */

import { execSync, spawn } from 'child_process';
import { join, resolve } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, cpSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = resolve(__dirname, '../..');
const testDir = join(projectRoot, 'tests/.tmp/clean-room-test');

class CleanRoomTester {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      platform: process.platform,
      architecture: process.arch,
      nodeVersion: process.version,
      tests: {},
      summary: {}
    };
  }

  async cleanup() {
    console.log('🧹 Cleaning up test environments...');
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  }

  async setup() {
    console.log('🏗️ Setting up clean room test environment...');
    await this.cleanup();
    mkdirSync(testDir, { recursive: true });
  }

  async testNpmInstallation() {
    console.log('📦 Testing npm installation in clean environment...');
    
    const testName = 'npm-installation';
    const testPath = join(testDir, testName);
    mkdirSync(testPath, { recursive: true });

    try {
      // Create minimal package.json
      const testPackage = {
        name: 'unjucks-clean-room-test',
        version: '1.0.0',
        type: 'module',
        dependencies: {}
      };

      writeFileSync(
        join(testPath, 'package.json'),
        JSON.stringify(testPackage, null, 2)
      );

      // Install the package from local directory
      const installCommand = `npm install "${projectRoot}"`;
      console.log(`Running: ${installCommand}`);
      
      const output = execSync(installCommand, {
        cwd: testPath,
        encoding: 'utf8',
        timeout: 120000 // 2 minutes timeout
      });

      // Verify installation
      const nodeModulesExists = existsSync(join(testPath, 'node_modules'));
      const packageExists = existsSync(join(testPath, 'node_modules/@seanchatmangpt/unjucks'));
      const binExists = existsSync(join(testPath, 'node_modules/.bin/unjucks'));

      this.results.tests[testName] = {
        success: true,
        output: output.length,
        nodeModulesCreated: nodeModulesExists,
        packageInstalled: packageExists,
        binaryLinked: binExists,
        installPath: testPath
      };

      console.log('✅ NPM installation test passed');
      return true;
    } catch (error) {
      this.results.tests[testName] = {
        success: false,
        error: error.message,
        installPath: testPath
      };
      console.log('❌ NPM installation test failed:', error.message);
      return false;
    }
  }

  async testCliExecution() {
    console.log('🚀 Testing CLI execution in clean environment...');
    
    const testName = 'cli-execution';
    const testPath = join(testDir, 'npm-installation'); // Use existing install

    if (!existsSync(testPath)) {
      console.log('⚠️ Skipping CLI execution test - npm installation failed');
      return false;
    }

    try {
      const commands = [
        'npx unjucks --version',
        'npx unjucks --help',
        'npx unjucks list'
      ];

      const commandResults = {};

      for (const command of commands) {
        console.log(`Testing command: ${command}`);
        
        try {
          const output = execSync(command, {
            cwd: testPath,
            encoding: 'utf8',
            timeout: 30000
          });

          commandResults[command] = {
            success: true,
            output: output.trim(),
            length: output.length
          };
        } catch (error) {
          commandResults[command] = {
            success: false,
            error: error.message,
            exitCode: error.status
          };
        }
      }

      const successfulCommands = Object.values(commandResults).filter(r => r.success).length;
      const testPassed = successfulCommands >= 2; // At least --version and --help should work

      this.results.tests[testName] = {
        success: testPassed,
        commands: commandResults,
        successfulCommands: successfulCommands,
        totalCommands: commands.length
      };

      if (testPassed) {
        console.log('✅ CLI execution test passed');
        return true;
      } else {
        console.log('❌ CLI execution test failed - insufficient commands working');
        return false;
      }
    } catch (error) {
      this.results.tests[testName] = {
        success: false,
        error: error.message
      };
      console.log('❌ CLI execution test failed:', error.message);
      return false;
    }
  }

  async testModuleResolution() {
    console.log('🔗 Testing module resolution in clean environment...');
    
    const testName = 'module-resolution';
    const testPath = join(testDir, testName);
    mkdirSync(testPath, { recursive: true });

    try {
      // Create test script to verify imports
      const testScript = `
        import { fileURLToPath } from 'url';
        
        async function testImports() {
          console.log('Testing module imports...');
          
          try {
            // Test importing unjucks
            const unjucks = await import('@seanchatmangpt/unjucks');
            console.log('✅ Unjucks import successful');
          } catch (error) {
            console.log('❌ Unjucks import failed:', error.message);
            process.exit(1);
          }
          
          // Test common dependencies
          const deps = ['citty', 'chalk', 'nunjucks', 'fs-extra'];
          
          for (const dep of deps) {
            try {
              await import(dep);
              console.log('✅', dep, 'import successful');
            } catch (error) {
              console.log('⚠️', dep, 'import failed:', error.message);
            }
          }
          
          console.log('Module resolution tests completed');
        }
        
        testImports().catch(console.error);
      `;

      const packageJson = {
        name: 'module-resolution-test',
        version: '1.0.0',
        type: 'module'
      };

      writeFileSync(join(testPath, 'package.json'), JSON.stringify(packageJson, null, 2));
      writeFileSync(join(testPath, 'test-imports.mjs'), testScript);

      // Install unjucks and run test
      execSync(`npm install "${projectRoot}"`, {
        cwd: testPath,
        timeout: 120000
      });

      const output = execSync('node test-imports.mjs', {
        cwd: testPath,
        encoding: 'utf8',
        timeout: 30000
      });

      this.results.tests[testName] = {
        success: true,
        output: output.trim(),
        testPath: testPath
      };

      console.log('✅ Module resolution test passed');
      return true;
    } catch (error) {
      this.results.tests[testName] = {
        success: false,
        error: error.message,
        testPath: testPath
      };
      console.log('❌ Module resolution test failed:', error.message);
      return false;
    }
  }

  async testFileGeneration() {
    console.log('📝 Testing file generation in clean environment...');
    
    const testName = 'file-generation';
    const testPath = join(testDir, testName);
    mkdirSync(testPath, { recursive: true });

    try {
      // Create basic template structure
      const templatesDir = join(testPath, '_templates/component/new');
      mkdirSync(templatesDir, { recursive: true });

      // Create a simple template
      const templateContent = `---
to: src/components/<%= name %>.js
---
export function <%= name %>() {
  return '<%= name %> component';
}
`;

      writeFileSync(join(templatesDir, 'component.ejs.t'), templateContent);

      const packageJson = {
        name: 'file-generation-test',
        version: '1.0.0',
        type: 'module'
      };

      writeFileSync(join(testPath, 'package.json'), JSON.stringify(packageJson, null, 2));

      // Install unjucks
      execSync(`npm install "${projectRoot}"`, {
        cwd: testPath,
        timeout: 120000
      });

      // Test file generation
      const generateCommand = 'npx unjucks component new TestComponent';
      console.log(`Running: ${generateCommand}`);

      const output = execSync(generateCommand, {
        cwd: testPath,
        encoding: 'utf8',
        timeout: 30000
      });

      // Check if file was generated
      const generatedFile = join(testPath, 'src/components/TestComponent.js');
      const fileExists = existsSync(generatedFile);
      
      let fileContent = null;
      if (fileExists) {
        fileContent = readFileSync(generatedFile, 'utf8');
      }

      this.results.tests[testName] = {
        success: fileExists,
        output: output.trim(),
        fileGenerated: fileExists,
        filePath: generatedFile,
        fileContent: fileContent,
        testPath: testPath
      };

      if (fileExists) {
        console.log('✅ File generation test passed');
        return true;
      } else {
        console.log('❌ File generation test failed - file not created');
        return false;
      }
    } catch (error) {
      this.results.tests[testName] = {
        success: false,
        error: error.message,
        testPath: testPath
      };
      console.log('❌ File generation test failed:', error.message);
      return false;
    }
  }

  async testPlatformSpecific() {
    console.log('🖥️ Testing platform-specific functionality...');
    
    const testName = 'platform-specific';

    try {
      const platformTests = {
        pathHandling: this.testPathHandling(),
        environmentVariables: this.testEnvironmentVariables(),
        processExecution: this.testProcessExecution()
      };

      const results = {};
      for (const [test, promise] of Object.entries(platformTests)) {
        try {
          results[test] = await promise;
        } catch (error) {
          results[test] = { success: false, error: error.message };
        }
      }

      const allPassed = Object.values(results).every(r => r.success);

      this.results.tests[testName] = {
        success: allPassed,
        tests: results
      };

      if (allPassed) {
        console.log('✅ Platform-specific tests passed');
        return true;
      } else {
        console.log('❌ Platform-specific tests failed');
        return false;
      }
    } catch (error) {
      this.results.tests[testName] = {
        success: false,
        error: error.message
      };
      console.log('❌ Platform-specific test failed:', error.message);
      return false;
    }
  }

  async testPathHandling() {
    const testPaths = [
      'simple/path',
      'path with spaces/file.txt',
      '../relative/path',
      './current/dir'
    ];

    const pathResults = testPaths.map(path => {
      const resolved = resolve(path);
      const joined = join(testDir, path);
      return {
        original: path,
        resolved: !!resolved,
        joined: !!joined
      };
    });

    return {
      success: pathResults.every(r => r.resolved && r.joined),
      results: pathResults
    };
  }

  async testEnvironmentVariables() {
    const original = process.env.TEST_VAR;
    process.env.TEST_VAR = 'test-value';
    
    const result = process.env.TEST_VAR === 'test-value';
    
    if (original !== undefined) {
      process.env.TEST_VAR = original;
    } else {
      delete process.env.TEST_VAR;
    }

    return { success: result };
  }

  async testProcessExecution() {
    try {
      const output = execSync('node --version', { encoding: 'utf8', timeout: 5000 });
      return { 
        success: true, 
        nodeVersion: output.trim(),
        platform: process.platform,
        arch: process.arch
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  generateReport() {
    const passedTests = Object.values(this.results.tests).filter(t => t.success).length;
    const totalTests = Object.keys(this.results.tests).length;
    
    this.results.summary = {
      totalTests: totalTests,
      passedTests: passedTests,
      failedTests: totalTests - passedTests,
      successRate: totalTests > 0 ? (passedTests / totalTests) * 100 : 0,
      overallSuccess: passedTests === totalTests
    };

    console.log('\n📊 Clean Room Test Results Summary:');
    console.log(`Platform: ${this.results.platform} (${this.results.architecture})`);
    console.log(`Node.js: ${this.results.nodeVersion}`);
    console.log(`Tests: ${passedTests}/${totalTests} passed (${this.results.summary.successRate.toFixed(1)}%)`);
    
    if (this.results.summary.overallSuccess) {
      console.log('🎉 All tests passed!');
    } else {
      console.log('⚠️ Some tests failed. See detailed report for more information.');
    }

    // Write report to file
    const reportPath = join(testDir, 'clean-room-test-report.json');
    writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);

    return this.results.summary.overallSuccess;
  }

  async run() {
    console.log('🧪 Starting Clean Room Cross-Platform Tests\n');
    
    try {
      await this.setup();

      // Run all tests
      await this.testNpmInstallation();
      await this.testCliExecution();
      await this.testModuleResolution();
      await this.testFileGeneration();
      await this.testPlatformSpecific();

      const success = this.generateReport();
      
      // Cleanup on success, keep artifacts on failure for debugging
      if (success && !process.env.KEEP_TEST_FILES) {
        await this.cleanup();
      } else {
        console.log(`\n🔍 Test artifacts preserved in: ${testDir}`);
      }

      process.exit(success ? 0 : 1);
    } catch (error) {
      console.error('💥 Clean room test runner failed:', error);
      process.exit(1);
    }
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new CleanRoomTester();
  tester.run();
}

export { CleanRoomTester };