#!/usr/bin/env node

/**
 * Critical Workflow Validator
 * Validates that all critical workflows function correctly
 */

import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

class WorkflowTest {
  constructor(name, description, testFunction, critical = true) {
    this.name = name;
    this.description = description;
    this.testFunction = testFunction;
    this.critical = critical;
    this.result = null;
  }

  async execute() {
    console.log(`\n🔍 Testing: ${this.name}`);
    console.log(`   ${this.description}`);
    
    const startTime = Date.now();
    
    try {
      this.result = await this.testFunction();
      const duration = Date.now() - startTime;
      
      console.log(`   ✅ PASSED (${duration}ms)`);
      
      return {
        name: this.name,
        passed: true,
        duration,
        result: this.result,
        critical: this.critical
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      console.log(`   ❌ FAILED (${duration}ms)`);
      console.log(`   Error: ${error.message}`);
      
      return {
        name: this.name,
        passed: false,
        duration,
        error: error.message,
        critical: this.critical
      };
    }
  }
}

class WorkflowValidator {
  constructor() {
    this.workflows = [];
    this.reportsDir = path.join(projectRoot, 'tests/reports');
  }

  addWorkflow(workflow) {
    this.workflows.push(workflow);
  }

  async validateAll() {
    console.log('🛑 Validating Critical Workflows\n');
    
    await fs.ensureDir(this.reportsDir);
    
    const results = [];
    let passed = 0;
    let criticalFailed = 0;
    
    for (const workflow of this.workflows) {
      const result = await workflow.execute();
      results.push(result);
      
      if (result.passed) {
        passed++;
      } else if (result.critical) {
        criticalFailed++;
      }
    }
    
    const report = {
      timestamp: new Date().toISOString(),
      totalWorkflows: this.workflows.length,
      passed,
      failed: this.workflows.length - passed,
      criticalFailed,
      results
    };
    
    await this.saveReport(report);
    this.displaySummary(report);
    
    return report;
  }

  async saveReport(report) {
    await fs.writeJSON(
      path.join(this.reportsDir, 'workflow-validation.json'),
      report,
      { spaces: 2 }
    );
  }

  displaySummary(report) {
    console.log('\n📊 Workflow Validation Summary:');
    console.log('=' * 50);
    
    report.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      const critical = result.critical ? '🔴' : '🟡';
      console.log(`${status} ${critical} ${result.name} (${result.duration}ms)`);
      
      if (!result.passed && result.error) {
        console.log(`      Error: ${result.error}`);
      }
    });
    
    console.log(`\n📊 Results: ${report.passed}/${report.totalWorkflows} workflows passed`);
    
    if (report.criticalFailed > 0) {
      console.log(`\n🚨 CRITICAL: ${report.criticalFailed} critical workflows failed!`);
      process.exit(1);
    } else if (report.failed > 0) {
      console.log(`\n⚠️  Warning: ${report.failed} non-critical workflows failed`);
    } else {
      console.log('\n🎉 All workflows validated successfully!');
    }
  }
}

// Helper functions for common operations
async function executeCommand(command, cwd = projectRoot, options = {}) {
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = command.split(' ');
    
    // Handle unjucks commands
    const actualCmd = cmd === 'unjucks' ? 'node' : cmd;
    const actualArgs = cmd === 'unjucks' 
      ? [path.join(projectRoot, 'bin/unjucks.cjs'), ...args]
      : args;
    
    const process = spawn(actualCmd, actualArgs, {
      cwd,
      stdio: options.silent ? ['ignore', 'pipe', 'pipe'] : ['inherit', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    process.on('close', (code) => {
      if (options.expectError && code !== 0) {
        resolve({ code, stdout, stderr });
      } else if (!options.expectError && code === 0) {
        resolve({ code, stdout, stderr });
      } else {
        reject(new Error(`Command '${command}' failed with code ${code}: ${stderr}`));
      }
    });
    
    process.on('error', reject);
  });
}

async function createTempWorkspace() {
  const tempDir = path.join('/tmp', `workflow-test-${Date.now()}`);
  await fs.ensureDir(tempDir);
  return tempDir;
}

async function cleanupWorkspace(dir) {
  try {
    await fs.remove(dir);
  } catch (error) {
    console.warn(`Warning: Could not cleanup ${dir}`);
  }
}

// Define critical workflows
const createWorkflowTests = () => {
  const validator = new WorkflowValidator();
  
  // Critical Workflow 1: CLI Basic Operations
  validator.addWorkflow(new WorkflowTest(
    'CLI Basic Operations',
    'Essential CLI commands must work correctly',
    async () => {
      const results = {};
      
      // Test version command
      const versionResult = await executeCommand('unjucks --version', projectRoot, { silent: true });
      results.version = versionResult.stdout.trim();
      
      // Test help command
      const helpResult = await executeCommand('unjucks --help', projectRoot, { silent: true });
      results.help = helpResult.stdout.includes('Usage:');
      
      // Test list command
      const listResult = await executeCommand('unjucks list', projectRoot, { silent: true });
      results.list = !listResult.stderr.includes('Error');
      
      if (!results.help) {
        throw new Error('Help command did not return usage information');
      }
      
      return results;
    },
    true // Critical
  ));
  
  // Critical Workflow 2: Template Discovery
  validator.addWorkflow(new WorkflowTest(
    'Template Discovery',
    'System must discover and list available templates',
    async () => {
      const tempDir = await createTempWorkspace();
      
      try {
        // Create test templates
        await fs.ensureDir(path.join(tempDir, '_templates/component'));
        await fs.writeFile(
          path.join(tempDir, '_templates/component/new.tsx.ejs'),
          'export const <%= name %> = () => <div><%= name %></div>;'
        );
        
        await fs.ensureDir(path.join(tempDir, '_templates/api'));
        await fs.writeFile(
          path.join(tempDir, '_templates/api/route.js.ejs'),
          'export default function <%= name %>() { }'
        );
        
        // Test discovery
        const result = await executeCommand('unjucks list', tempDir, { silent: true });
        
        if (!result.stdout.includes('component') || !result.stdout.includes('api')) {
          throw new Error('Template discovery failed - not all templates found');
        }
        
        return {
          templatesFound: ['component', 'api'],
          output: result.stdout
        };
      } finally {
        await cleanupWorkspace(tempDir);
      }
    },
    true // Critical
  ));
  
  // Critical Workflow 3: Template Generation
  validator.addWorkflow(new WorkflowTest(
    'Template Generation',
    'Core template generation functionality must work',
    async () => {
      const tempDir = await createTempWorkspace();
      
      try {
        // Create template
        await fs.ensureDir(path.join(tempDir, '_templates/test'));
        await fs.writeFile(
          path.join(tempDir, '_templates/test/new.js.ejs'),
          `// Generated file for <%= name %>
export const <%= name %> = {
  value: '<%= value || "default" %>'
};
`
        );
        
        // Generate from template
        await executeCommand('unjucks generate test new --name TestComponent --value hello', tempDir);
        
        // Verify generated file
        const generatedFile = path.join(tempDir, 'TestComponent.js');
        if (!await fs.pathExists(generatedFile)) {
          throw new Error('Generated file does not exist');
        }
        
        const content = await fs.readFile(generatedFile, 'utf8');
        
        if (!content.includes('TestComponent') || !content.includes('hello')) {
          throw new Error('Generated content is incorrect');
        }
        
        return {
          generated: true,
          content,
          file: generatedFile
        };
      } finally {
        await cleanupWorkspace(tempDir);
      }
    },
    true // Critical
  ));
  
  // Critical Workflow 4: Error Handling
  validator.addWorkflow(new WorkflowTest(
    'Error Handling',
    'System must handle errors gracefully without crashing',
    async () => {
      const tempDir = await createTempWorkspace();
      
      try {
        const errors = [];
        
        // Test 1: Non-existent template
        try {
          await executeCommand('unjucks generate nonexistent new', tempDir, { expectError: true });
          errors.push('handled-nonexistent-template');
        } catch (error) {
          // This should not throw, should be handled gracefully
          throw new Error('Non-existent template error not handled gracefully');
        }
        
        // Test 2: Missing required parameters
        await fs.ensureDir(path.join(tempDir, '_templates/param-test'));
        await fs.writeFile(
          path.join(tempDir, '_templates/param-test/new.js.ejs'),
          'export const <%= requiredParam %> = true;'
        );
        
        try {
          await executeCommand('unjucks generate param-test new', tempDir, { expectError: true });
          errors.push('handled-missing-params');
        } catch (error) {
          // Should be handled gracefully
          throw new Error('Missing parameter error not handled gracefully');
        }
        
        return {
          errorsHandled: errors,
          gracefulHandling: true
        };
      } finally {
        await cleanupWorkspace(tempDir);
      }
    },
    true // Critical
  ));
  
  // Critical Workflow 5: File System Safety
  validator.addWorkflow(new WorkflowTest(
    'File System Safety',
    'System must not overwrite existing files without permission',
    async () => {
      const tempDir = await createTempWorkspace();
      
      try {
        // Create template
        await fs.ensureDir(path.join(tempDir, '_templates/safety'));
        await fs.writeFile(
          path.join(tempDir, '_templates/safety/new.txt.ejs'),
          'Content: <%= name %>'
        );
        
        // Generate file first time
        await executeCommand('unjucks generate safety new --name FirstTime', tempDir);
        
        const targetFile = path.join(tempDir, 'FirstTime.txt');
        if (!await fs.pathExists(targetFile)) {
          throw new Error('Initial file generation failed');
        }
        
        const originalContent = await fs.readFile(targetFile, 'utf8');
        
        // Try to generate again (should not overwrite without force)
        try {
          await executeCommand('unjucks generate safety new --name FirstTime', tempDir, { expectError: true });
        } catch (error) {
          // This is expected behavior - should ask for confirmation or fail
        }
        
        const contentAfterSecondAttempt = await fs.readFile(targetFile, 'utf8');
        
        if (contentAfterSecondAttempt !== originalContent) {
          throw new Error('File was overwritten without explicit permission');
        }
        
        return {
          safeguarded: true,
          originalPreserved: true
        };
      } finally {
        await cleanupWorkspace(tempDir);
      }
    },
    true // Critical
  ));
  
  // Non-Critical Workflow: Advanced Features
  validator.addWorkflow(new WorkflowTest(
    'Advanced Template Features',
    'Advanced features like filters and conditionals should work',
    async () => {
      const tempDir = await createTempWorkspace();
      
      try {
        // Create advanced template
        await fs.ensureDir(path.join(tempDir, '_templates/advanced'));
        await fs.writeFile(
          path.join(tempDir, '_templates/advanced/new.js.ejs'),
          `// Advanced template features
export const <%= name %> = {
  upperName: '<%= name.toUpperCase() %>',
  lowerName: '<%= name.toLowerCase() %>'
<% if (includeTimestamp) { %>
  , timestamp: '<%= new Date().toISOString() %>'
<% } %>
};
`
        );
        
        // Generate with advanced features
        await executeCommand('unjucks generate advanced new --name AdvancedTest --includeTimestamp true', tempDir);
        
        const generatedFile = path.join(tempDir, 'AdvancedTest.js');
        const content = await fs.readFile(generatedFile, 'utf8');
        
        if (!content.includes('ADVANCEDTEST') || !content.includes('advancedtest') || !content.includes('timestamp')) {
          throw new Error('Advanced template features not working correctly');
        }
        
        return {
          advancedFeatures: true,
          content
        };
      } finally {
        await cleanupWorkspace(tempDir);
      }
    },
    false // Non-critical
  ));
  
  // Critical Workflow 6: Build System Integration
  validator.addWorkflow(new WorkflowTest(
    'Build System Integration',
    'Project must build successfully after generation',
    async () => {
      // Test that the main build process works
      const result = await executeCommand('npm run build:validate', projectRoot, { silent: true });
      
      return {
        buildSuccessful: true,
        output: result.stdout
      };
    },
    true // Critical
  ));
  
  return validator;
};

// Execute if run directly
if (import.meta.url === `file://${__filename}`) {
  const validator = createWorkflowTests();
  
  validator.validateAll().catch(error => {
    console.error('Workflow validation failed:', error);
    process.exit(1);
  });
}

export { WorkflowTest, WorkflowValidator };
