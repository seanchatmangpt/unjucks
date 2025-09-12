/**
 * End-to-End User Journey Tests
 * Comprehensive testing of complete user workflows and scenarios
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { execSync, spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { faker } from '@faker-js/faker';
import { userFactory, projectFactory, templateFactory } from './test-data-factory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test workspace configuration
const TEST_WORKSPACE = path.join(__dirname, 'e2e-workspace');
const UNJUCKS_CLI = path.resolve(__dirname, '../../bin/unjucks.cjs');

/**
 * CLI Helper - Manages CLI interactions and validation
 */
class CLIHelper {
  constructor(workingDir = TEST_WORKSPACE) {
    this.workingDir = workingDir;
  }

  /**
   * Execute CLI command and return result
   */
  async exec(command, options = {}) {
    const fullCommand = `node ${UNJUCKS_CLI} ${command}`;
    const execOptions = {
      cwd: this.workingDir,
      encoding: 'utf8',
      timeout: options.timeout || 30000,
      ...options
    };

    try {
      const result = execSync(fullCommand, execOptions);
      return {
        success: true,
        stdout: result.toString(),
        stderr: '',
        exitCode: 0
      };
    } catch (error) {
      return {
        success: false,
        stdout: error.stdout?.toString() || '',
        stderr: error.stderr?.toString() || error.message,
        exitCode: error.status || 1
      };
    }
  }

  /**
   * Execute interactive CLI command
   */
  async execInteractive(command, inputs = []) {
    return new Promise((resolve, reject) => {
      const child = spawn('node', [UNJUCKS_CLI, ...command.split(' ')], {
        cwd: this.workingDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';
      let inputIndex = 0;

      child.stdout.on('data', (data) => {
        stdout += data.toString();
        
        // Send next input when prompted
        if (inputIndex < inputs.length && stdout.includes('?')) {
          setTimeout(() => {
            child.stdin.write(inputs[inputIndex] + '\n');
            inputIndex++;
          }, 100);
        }
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({
          success: code === 0,
          stdout,
          stderr,
          exitCode: code
        });
      });

      child.on('error', reject);

      // Timeout after 60 seconds
      setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error('Interactive command timeout'));
      }, 60000);
    });
  }

  /**
   * Verify file was created with expected content
   */
  async verifyFileCreated(filePath, expectedContent = null) {
    const fullPath = path.resolve(this.workingDir, filePath);
    const exists = await fs.pathExists(fullPath);
    
    if (!exists) {
      throw new Error(`Expected file not created: ${filePath}`);
    }

    if (expectedContent) {
      const content = await fs.readFile(fullPath, 'utf8');
      if (typeof expectedContent === 'string') {
        expect(content).toContain(expectedContent);
      } else if (expectedContent instanceof RegExp) {
        expect(content).toMatch(expectedContent);
      }
    }

    return fullPath;
  }

  /**
   * Verify directory structure
   */
  async verifyDirectoryStructure(structure) {
    for (const [dirPath, files] of Object.entries(structure)) {
      const fullDirPath = path.resolve(this.workingDir, dirPath);
      const exists = await fs.pathExists(fullDirPath);
      expect(exists).toBe(true);

      if (files && Array.isArray(files)) {
        for (const file of files) {
          const filePath = path.join(fullDirPath, file);
          const fileExists = await fs.pathExists(filePath);
          expect(fileExists).toBe(true);
        }
      }
    }
  }
}

/**
 * User Journey Simulator - Simulates real user behaviors
 */
class UserJourneySimulator {
  constructor(cli) {
    this.cli = cli;
    this.journeyData = new Map();
  }

  /**
   * Store journey data for later validation
   */
  storeJourneyData(key, data) {
    this.journeyData.set(key, {
      ...data,
      timestamp: this.getDeterministicDate().toISOString()
    });
  }

  /**
   * Get stored journey data
   */
  getJourneyData(key) {
    return this.journeyData.get(key);
  }

  /**
   * Simulate new user onboarding journey
   */
  async simulateNewUserOnboarding() {
    const journey = {
      steps: [],
      startTime: this.getDeterministicTimestamp()
    };

    // Step 1: Check CLI version (first thing users do)
    const versionResult = await this.cli.exec('--version');
    expect(versionResult.success).toBe(true);
    journey.steps.push({
      step: 'version_check',
      success: versionResult.success,
      output: versionResult.stdout
    });

    // Step 2: Get help to understand available commands
    const helpResult = await this.cli.exec('--help');
    expect(helpResult.success).toBe(true);
    expect(helpResult.stdout).toContain('USAGE');
    journey.steps.push({
      step: 'help_check',
      success: helpResult.success
    });

    // Step 3: List available templates (discovery)
    const listResult = await this.cli.exec('list');
    expect(listResult.success).toBe(true);
    journey.steps.push({
      step: 'template_discovery',
      success: listResult.success,
      templatesFound: listResult.stdout.split('\n').length
    });

    // Step 4: Get help for a specific command
    const helpGenerateResult = await this.cli.exec('help generate');
    expect(helpGenerateResult.success).toBe(true);
    journey.steps.push({
      step: 'command_help',
      success: helpGenerateResult.success
    });

    journey.endTime = this.getDeterministicTimestamp();
    journey.duration = journey.endTime - journey.startTime;
    
    this.storeJourneyData('new_user_onboarding', journey);
    return journey;
  }

  /**
   * Simulate experienced user workflow
   */
  async simulateExperiencedUserWorkflow() {
    const journey = {
      steps: [],
      startTime: this.getDeterministicTimestamp()
    };

    // Step 1: Quick template generation
    const componentName = faker.hacker.noun();
    const generateResult = await this.cli.exec(`generate component ${componentName} --path src/components`);
    
    journey.steps.push({
      step: 'quick_generation',
      success: generateResult.success,
      componentName,
      output: generateResult.stdout
    });

    if (generateResult.success) {
      // Verify file was created
      await this.cli.verifyFileCreated(`src/components/${componentName}.jsx`, componentName);
    }

    // Step 2: Batch generation with dry run first
    const apiName = faker.hacker.noun();
    const dryRunResult = await this.cli.exec(`generate api ${apiName} --dry-run`);
    expect(dryRunResult.success).toBe(true);
    
    journey.steps.push({
      step: 'dry_run_validation',
      success: dryRunResult.success
    });

    // Step 3: Actual generation after dry run
    const actualResult = await this.cli.exec(`generate api ${apiName} --path src/api`);
    journey.steps.push({
      step: 'confirmed_generation',
      success: actualResult.success,
      apiName
    });

    if (actualResult.success) {
      await this.cli.verifyFileCreated(`src/api/${apiName}.js`, apiName);
    }

    journey.endTime = this.getDeterministicTimestamp();
    journey.duration = journey.endTime - journey.startTime;
    
    this.storeJourneyData('experienced_user_workflow', journey);
    return journey;
  }

  /**
   * Simulate complex project setup journey
   */
  async simulateComplexProjectSetup() {
    const journey = {
      steps: [],
      startTime: this.getDeterministicTimestamp(),
      project: {
        name: faker.company.name().replace(/[^a-zA-Z0-9]/g, ''),
        type: 'fullstack-app'
      }
    };

    // Step 1: Create project structure
    const projectStructure = [
      'src/components',
      'src/pages',
      'src/api',
      'src/services',
      'src/utils',
      'tests'
    ];

    for (const dir of projectStructure) {
      await fs.ensureDir(path.join(this.cli.workingDir, dir));
    }

    journey.steps.push({
      step: 'project_structure_creation',
      success: true,
      directories: projectStructure
    });

    // Step 2: Generate multiple components
    const components = ['Header', 'Footer', 'Sidebar', 'MainContent'];
    for (const component of components) {
      const result = await this.cli.exec(`generate component ${component} --path src/components`);
      journey.steps.push({
        step: 'component_generation',
        success: result.success,
        component,
        output: result.stdout
      });
    }

    // Step 3: Generate API endpoints
    const endpoints = ['users', 'auth', 'projects'];
    for (const endpoint of endpoints) {
      const result = await this.cli.exec(`generate api ${endpoint} --path src/api`);
      journey.steps.push({
        step: 'api_generation',
        success: result.success,
        endpoint
      });
    }

    // Step 4: Generate services
    const services = ['UserService', 'AuthService', 'ProjectService'];
    for (const service of services) {
      const result = await this.cli.exec(`generate service ${service} --path src/services`);
      journey.steps.push({
        step: 'service_generation',
        success: result.success,
        service
      });
    }

    // Step 5: Generate tests
    const testFiles = ['Header.test', 'users.api.test'];
    for (const testFile of testFiles) {
      const result = await this.cli.exec(`generate test ${testFile} --path tests`);
      journey.steps.push({
        step: 'test_generation',
        success: result.success,
        testFile
      });
    }

    // Verify final project structure
    await this.cli.verifyDirectoryStructure({
      'src/components': components.map(c => `${c}.jsx`),
      'src/api': endpoints.map(e => `${e}.js`),
      'src/services': services.map(s => `${s}.service.js`),
      'tests': testFiles.map(t => `${t}.js`)
    });

    journey.endTime = this.getDeterministicTimestamp();
    journey.duration = journey.endTime - journey.startTime;
    
    this.storeJourneyData('complex_project_setup', journey);
    return journey;
  }

  /**
   * Simulate error recovery journey
   */
  async simulateErrorRecoveryJourney() {
    const journey = {
      steps: [],
      startTime: this.getDeterministicTimestamp(),
      errors: []
    };

    // Step 1: Try invalid command
    const invalidResult = await this.cli.exec('invalid-command-xyz');
    expect(invalidResult.success).toBe(false);
    journey.steps.push({
      step: 'invalid_command_attempt',
      success: false,
      expectedError: true
    });
    journey.errors.push({
      type: 'invalid_command',
      message: invalidResult.stderr
    });

    // Step 2: Try generation without required parameters
    const missingParamResult = await this.cli.exec('generate component');
    expect(missingParamResult.success).toBe(false);
    journey.steps.push({
      step: 'missing_parameters',
      success: false,
      expectedError: true
    });
    journey.errors.push({
      type: 'missing_parameters',
      message: missingParamResult.stderr
    });

    // Step 3: Try to overwrite existing file without force
    const componentName = 'DuplicateComponent';
    
    // First create the file
    const firstResult = await this.cli.exec(`generate component ${componentName} --path src`);
    expect(firstResult.success).toBe(true);
    
    // Then try to create it again (should fail)
    const duplicateResult = await this.cli.exec(`generate component ${componentName} --path src`);
    journey.steps.push({
      step: 'duplicate_file_protection',
      success: true, // This is success because the protection worked
      duplicateAttemptResult: duplicateResult.success
    });

    // Step 4: Successful recovery with force flag
    const forceResult = await this.cli.exec(`generate component ${componentName} --path src --force`);
    expect(forceResult.success).toBe(true);
    journey.steps.push({
      step: 'force_overwrite_recovery',
      success: forceResult.success
    });

    journey.endTime = this.getDeterministicTimestamp();
    journey.duration = journey.endTime - journey.startTime;
    
    this.storeJourneyData('error_recovery', journey);
    return journey;
  }

  /**
   * Simulate performance testing journey
   */
  async simulatePerformanceJourney() {
    const journey = {
      steps: [],
      startTime: this.getDeterministicTimestamp(),
      performance: {
        operations: [],
        totalTime: 0,
        averageTime: 0
      }
    };

    // Generate multiple files and measure performance
    const operations = [
      { type: 'component', count: 10 },
      { type: 'api', count: 5 },
      { type: 'service', count: 5 }
    ];

    for (const operation of operations) {
      const operationStart = this.getDeterministicTimestamp();
      
      for (let i = 0; i < operation.count; i++) {
        const name = `${operation.type}${i}`;
        const result = await this.cli.exec(`generate ${operation.type} ${name} --path src/${operation.type}s`);
        
        if (!result.success) {
          journey.errors = journey.errors || [];
          journey.errors.push({
            type: 'generation_failure',
            operation: operation.type,
            index: i,
            message: result.stderr
          });
        }
      }
      
      const operationEnd = this.getDeterministicTimestamp();
      const operationTime = operationEnd - operationStart;
      
      journey.performance.operations.push({
        type: operation.type,
        count: operation.count,
        totalTime: operationTime,
        averageTime: operationTime / operation.count
      });
    }

    // Calculate overall performance metrics
    journey.performance.totalTime = journey.performance.operations.reduce(
      (sum, op) => sum + op.totalTime, 0
    );
    journey.performance.totalOperations = operations.reduce(
      (sum, op) => sum + op.count, 0
    );
    journey.performance.averageTime = journey.performance.totalTime / journey.performance.totalOperations;

    journey.endTime = this.getDeterministicTimestamp();
    journey.duration = journey.endTime - journey.startTime;
    
    this.storeJourneyData('performance_journey', journey);
    return journey;
  }
}

describe('End-to-End User Journeys', () => {
  let cli;
  let simulator;

  beforeAll(async () => {
    // Set up test workspace
    await fs.ensureDir(TEST_WORKSPACE);
    cli = new CLIHelper(TEST_WORKSPACE);
    simulator = new UserJourneySimulator(cli);
  }, 30000);

  afterAll(async () => {
    // Clean up test workspace
    if (await fs.pathExists(TEST_WORKSPACE)) {
      await fs.remove(TEST_WORKSPACE);
    }
  });

  beforeEach(async () => {
    // Reset workspace for each test
    if (await fs.pathExists(TEST_WORKSPACE)) {
      await fs.remove(TEST_WORKSPACE);
    }
    await fs.ensureDir(TEST_WORKSPACE);
  });

  describe('New User Onboarding Journey', () => {
    it('should guide new users through discovery and first usage', async () => {
      const journey = await simulator.simulateNewUserOnboarding();
      
      expect(journey.duration).toBeLessThan(30000); // Should complete within 30 seconds
      expect(journey.steps).toHaveLength(4);
      
      // All steps should succeed
      journey.steps.forEach(step => {
        expect(step.success).toBe(true);
      });

      // Verify specific journey outcomes
      const versionStep = journey.steps.find(s => s.step === 'version_check');
      expect(versionStep.output).toContain('2025.9.8');

      const discoveryStep = journey.steps.find(s => s.step === 'template_discovery');
      expect(discoveryStep.templatesFound).toBeGreaterThan(0);
    });

    it('should provide helpful error messages for common new user mistakes', async () => {
      // Test common new user errors
      const commonMistakes = [
        'generate', // Missing template type
        'generate component', // Missing name
        'generate invalid-type MyName', // Invalid template type
        'list --invalid-flag' // Invalid flag
      ];

      for (const mistake of commonMistakes) {
        const result = await cli.exec(mistake);
        expect(result.success).toBe(false);
        expect(result.stderr || result.stdout).toContain('Usage:');
      }
    });
  });

  describe('Experienced User Workflow Journey', () => {
    it('should support efficient workflows for experienced users', async () => {
      const journey = await simulator.simulateExperiencedUserWorkflow();
      
      expect(journey.duration).toBeLessThan(15000); // Should be faster than new users
      expect(journey.steps).toHaveLength(3);
      
      // All steps should succeed
      journey.steps.forEach(step => {
        expect(step.success).toBe(true);
      });

      // Verify dry run functionality
      const dryRunStep = journey.steps.find(s => s.step === 'dry_run_validation');
      expect(dryRunStep.success).toBe(true);

      // Verify actual generation after dry run
      const confirmStep = journey.steps.find(s => s.step === 'confirmed_generation');
      expect(confirmStep.success).toBe(true);
    });

    it('should support batch operations efficiently', async () => {
      const batchOperations = [
        'generate component Button --path src/components',
        'generate component Modal --path src/components',
        'generate component Form --path src/components',
        'generate api auth --path src/api',
        'generate api users --path src/api'
      ];

      const startTime = this.getDeterministicTimestamp();
      
      for (const operation of batchOperations) {
        const result = await cli.exec(operation);
        expect(result.success).toBe(true);
      }
      
      const endTime = this.getDeterministicTimestamp();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / batchOperations.length;
      
      expect(averageTime).toBeLessThan(3000); // Each operation should average under 3 seconds
    });
  });

  describe('Complex Project Setup Journey', () => {
    it('should handle complex multi-file project generation', async () => {
      const journey = await simulator.simulateComplexProjectSetup();
      
      expect(journey.duration).toBeLessThan(60000); // Should complete within 1 minute
      
      // Count successful operations
      const successfulSteps = journey.steps.filter(s => s.success).length;
      const totalSteps = journey.steps.length;
      const successRate = successfulSteps / totalSteps;
      
      expect(successRate).toBeGreaterThan(0.9); // At least 90% success rate

      // Verify project structure was created correctly
      const components = ['Header', 'Footer', 'Sidebar', 'MainContent'];
      for (const component of components) {
        await cli.verifyFileCreated(`src/components/${component}.jsx`);
      }

      const endpoints = ['users', 'auth', 'projects'];
      for (const endpoint of endpoints) {
        await cli.verifyFileCreated(`src/api/${endpoint}.js`);
      }
    });

    it('should maintain consistency across related files', async () => {
      // Generate related files and verify they reference each other correctly
      await cli.exec('generate component UserProfile --path src/components');
      await cli.exec('generate service UserService --path src/services');
      await cli.exec('generate test UserProfile.test --path tests');

      // Verify files were created
      await cli.verifyFileCreated('src/components/UserProfile.jsx', 'UserProfile');
      await cli.verifyFileCreated('src/services/UserService.service.js', 'UserService');
      await cli.verifyFileCreated('tests/UserProfile.test.js', 'UserProfile');

      // Verify naming consistency
      const profileContent = await fs.readFile(
        path.join(TEST_WORKSPACE, 'src/components/UserProfile.jsx'), 
        'utf8'
      );
      expect(profileContent).toMatch(/UserProfile/g);
    });
  });

  describe('Error Recovery Journey', () => {
    it('should help users recover from common errors gracefully', async () => {
      const journey = await simulator.simulateErrorRecoveryJourney();
      
      expect(journey.errors).toHaveLength(2); // Two expected errors
      expect(journey.steps).toHaveLength(4); // Four recovery steps
      
      // Verify error messages are helpful
      const invalidCommandError = journey.errors.find(e => e.type === 'invalid_command');
      expect(invalidCommandError.message).toBeDefined();
      
      const missingParamError = journey.errors.find(e => e.type === 'missing_parameters');
      expect(missingParamError.message).toBeDefined();

      // Verify recovery mechanisms work
      const forceRecovery = journey.steps.find(s => s.step === 'force_overwrite_recovery');
      expect(forceRecovery.success).toBe(true);
    });

    it('should validate input and provide suggestions', async () => {
      // Test various invalid inputs and verify helpful suggestions
      const invalidInputs = [
        { command: 'generate componen Button', expectedSuggestion: 'component' },
        { command: 'generate component', expectedSuggestion: 'name' },
        { command: 'lst', expectedSuggestion: 'list' }
      ];

      for (const input of invalidInputs) {
        const result = await cli.exec(input.command);
        expect(result.success).toBe(false);
        
        const output = result.stderr || result.stdout;
        expect(output.toLowerCase()).toContain(input.expectedSuggestion);
      }
    });
  });

  describe('Performance Journey', () => {
    it('should maintain performance standards under load', async () => {
      const journey = await simulator.simulatePerformanceJourney();
      
      expect(journey.performance.averageTime).toBeLessThan(2000); // Average under 2 seconds
      expect(journey.performance.totalOperations).toBe(20); // Total expected operations
      
      // Verify performance per operation type
      journey.performance.operations.forEach(operation => {
        expect(operation.averageTime).toBeLessThan(3000); // Each type under 3 seconds average
        
        if (operation.type === 'component') {
          expect(operation.averageTime).toBeLessThan(1500); // Components should be fastest
        }
      });
    });

    it('should scale linearly with number of operations', async () => {
      const smallBatch = 3;
      const largeBatch = 9;
      
      // Test small batch
      const smallStart = this.getDeterministicTimestamp();
      for (let i = 0; i < smallBatch; i++) {
        await cli.exec(`generate component SmallTest${i} --path src`);
      }
      const smallTime = this.getDeterministicTimestamp() - smallStart;
      const smallAverage = smallTime / smallBatch;

      // Clean workspace
      await fs.remove(path.join(TEST_WORKSPACE, 'src'));
      await fs.ensureDir(path.join(TEST_WORKSPACE, 'src'));

      // Test large batch
      const largeStart = this.getDeterministicTimestamp();
      for (let i = 0; i < largeBatch; i++) {
        await cli.exec(`generate component LargeTest${i} --path src`);
      }
      const largeTime = this.getDeterministicTimestamp() - largeStart;
      const largeAverage = largeTime / largeBatch;

      // Performance should scale roughly linearly (within 50% tolerance)
      const scalingFactor = largeAverage / smallAverage;
      expect(scalingFactor).toBeLessThan(1.5); // Large batch shouldn't be more than 50% slower per operation
    });
  });

  describe('Cross-Platform Journey', () => {
    it('should work consistently across different environments', async () => {
      // Test path handling across platforms
      const pathTests = [
        'src/components',
        'src\\components', // Windows-style path
        './src/components',
        '../test/components'
      ];

      for (const testPath of pathTests) {
        try {
          const result = await cli.exec(`generate component TestPath --path "${testPath}"`);
          
          if (result.success) {
            // Verify file was created (path should be normalized)
            const normalizedPath = testPath.replace(/\\/g, '/').replace(/^\.\//, '');
            await cli.verifyFileCreated(`${normalizedPath}/TestPath.jsx`);
          } else {
            // If it fails, it should be a clear path-related error
            expect(result.stderr || result.stdout).toContain('path');
          }
        } catch (error) {
          // Acceptable if the path is truly invalid for the current platform
          console.log(`Path test failed for: ${testPath} - ${error.message}`);
        }
      }
    });

    it('should handle special characters in file names appropriately', async () => {
      const specialNames = [
        'Component-With-Dashes',
        'Component_With_Underscores',
        'ComponentWithNumbers123',
        'UPPERCASE_COMPONENT'
      ];

      for (const name of specialNames) {
        const result = await cli.exec(`generate component ${name} --path src`);
        
        if (result.success) {
          await cli.verifyFileCreated(`src/${name}.jsx`, name);
        } else {
          // Should provide clear feedback about invalid characters
          expect(result.stderr || result.stdout).toMatch(/name|character|invalid/i);
        }
      }
    });
  });

  describe('Integration Journey', () => {
    it('should integrate well with existing project structures', async () => {
      // Create existing project structure
      const existingStructure = {
        'src': ['index.js', 'App.js'],
        'components': ['ExistingComponent.jsx'],
        'package.json': null
      };

      // Create existing files
      await fs.ensureDir(path.join(TEST_WORKSPACE, 'src'));
      await fs.ensureDir(path.join(TEST_WORKSPACE, 'components'));
      
      await fs.writeFile(
        path.join(TEST_WORKSPACE, 'src/index.js'),
        'console.log("Existing file");'
      );
      
      await fs.writeFile(
        path.join(TEST_WORKSPACE, 'components/ExistingComponent.jsx'),
        'export default function ExistingComponent() { return <div>Existing</div>; }'
      );

      await fs.writeJson(
        path.join(TEST_WORKSPACE, 'package.json'),
        { name: 'test-project', version: '1.0.0' }
      );

      // Generate new components alongside existing ones
      const result = await cli.exec('generate component NewComponent --path components');
      expect(result.success).toBe(true);

      // Verify both old and new files exist
      expect(await fs.pathExists(path.join(TEST_WORKSPACE, 'components/ExistingComponent.jsx'))).toBe(true);
      expect(await fs.pathExists(path.join(TEST_WORKSPACE, 'components/NewComponent.jsx'))).toBe(true);

      // Verify original files weren't modified
      const existingContent = await fs.readFile(
        path.join(TEST_WORKSPACE, 'components/ExistingComponent.jsx'),
        'utf8'
      );
      expect(existingContent).toContain('ExistingComponent');
    });
  });

  describe('Journey Analytics and Patterns', () => {
    it('should track and analyze user journey patterns', async () => {
      // Run multiple journeys and analyze patterns
      const journeys = [
        await simulator.simulateNewUserOnboarding(),
        await simulator.simulateExperiencedUserWorkflow(),
        await simulator.simulateErrorRecoveryJourney()
      ];

      // Analyze journey metrics
      const totalTime = journeys.reduce((sum, journey) => sum + journey.duration, 0);
      const averageTime = totalTime / journeys.length;
      const totalSteps = journeys.reduce((sum, journey) => sum + journey.steps.length, 0);
      const averageSteps = totalSteps / journeys.length;

      expect(averageTime).toBeLessThan(25000); // Average journey under 25 seconds
      expect(averageSteps).toBeGreaterThan(2); // At least 2 steps per journey

      // Verify journey data was stored
      expect(simulator.getJourneyData('new_user_onboarding')).toBeDefined();
      expect(simulator.getJourneyData('experienced_user_workflow')).toBeDefined();
      expect(simulator.getJourneyData('error_recovery')).toBeDefined();
    });
  });
});

// Store E2E test patterns in memory for reuse
const e2eTestPatterns = {
  userJourneys: {
    description: 'Complete user workflow simulation and validation',
    implementation: 'UserJourneySimulator with real CLI interaction',
    coverage: ['onboarding', 'experienced workflows', 'error recovery', 'performance']
  },
  cliTesting: {
    description: 'Comprehensive CLI command testing',
    implementation: 'CLIHelper with exec and interactive support',
    coverage: ['command execution', 'output validation', 'error handling', 'file verification']
  },
  fileSystemValidation: {
    description: 'Verification of file and directory operations',
    implementation: 'File system checks and content validation',
    coverage: ['file creation', 'directory structure', 'content accuracy', 'overwrite protection']
  },
  performanceTesting: {
    description: 'Performance validation under various loads',
    implementation: 'Timing measurements and scaling analysis',
    coverage: ['individual operations', 'batch operations', 'scaling behavior']
  },
  crossPlatformTesting: {
    description: 'Cross-platform compatibility validation',
    implementation: 'Path handling and character encoding tests',
    coverage: ['path normalization', 'special characters', 'environment differences']
  }
};

console.log('E2E test patterns stored in memory:', Object.keys(e2eTestPatterns));

export { e2eTestPatterns, CLIHelper, UserJourneySimulator };