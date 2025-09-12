#!/usr/bin/env node

/**
 * End-to-End User Journey Tests
 * Tests complete user workflows from start to finish
 */

import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

class UserJourney {
  constructor(name, description, steps) {
    this.name = name;
    this.description = description;
    this.steps = steps;
    this.sessionId = uuidv4();
    this.workingDir = path.join('/tmp', `e2e-${this.sessionId}`);
    this.results = [];
    this.context = {};
  }

  async execute() {
    console.log(`\n🚀 Starting User Journey: ${this.name}`);
    console.log(`   ${this.description}`);
    console.log(`   Working Directory: ${this.workingDir}`);
    
    try {
      await this.setup();
      
      for (let i = 0; i < this.steps.length; i++) {
        const step = this.steps[i];
        console.log(`\n🔄 Step ${i + 1}: ${step.description}`);
        
        const stepResult = await this.executeStep(step, i + 1);
        this.results.push(stepResult);
        
        if (!stepResult.success) {
          console.log(`   ❌ Step ${i + 1} failed: ${stepResult.error}`);
          return this.generateResult(false, `Step ${i + 1} failed`);
        }
        
        console.log(`   ✅ Step ${i + 1} completed`);
        
        // Merge step context
        if (stepResult.context) {
          this.context = { ...this.context, ...stepResult.context };
        }
      }
      
      console.log(`\n🎉 Journey completed successfully: ${this.name}`);
      return this.generateResult(true);
      
    } catch (error) {
      console.log(`\n💥 Journey failed: ${error.message}`);
      return this.generateResult(false, error.message);
    } finally {
      await this.cleanup();
    }
  }

  async setup() {
    await fs.ensureDir(this.workingDir);
    
    // Copy any required test fixtures
    const fixturesDir = path.join(projectRoot, 'tests/fixtures');
    if (await fs.pathExists(fixturesDir)) {
      await fs.copy(fixturesDir, path.join(this.workingDir, 'fixtures'));
    }
  }

  async executeStep(step, stepNumber) {
    const startTime = this.getDeterministicTimestamp();
    
    try {
      let result;
      
      switch (step.type) {
        case 'command':
          result = await this.executeCommand(step);
          break;
        case 'file-check':
          result = await this.checkFile(step);
          break;
        case 'file-create':
          result = await this.createFile(step);
          break;
        case 'validation':
          result = await this.validate(step);
          break;
        case 'wait':
          result = await this.wait(step);
          break;
        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }
      
      return {
        step: stepNumber,
        description: step.description,
        type: step.type,
        success: true,
        duration: this.getDeterministicTimestamp() - startTime,
        result,
        context: step.saveContext ? result : null
      };
      
    } catch (error) {
      return {
        step: stepNumber,
        description: step.description,
        type: step.type,
        success: false,
        duration: this.getDeterministicTimestamp() - startTime,
        error: error.message
      };
    }
  }

  async executeCommand(step) {
    const command = this.interpolateCommand(step.command);
    console.log(`     Command: ${command}`);
    
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ');
      
      // Special handling for unjucks commands
      const actualCmd = cmd === 'unjucks' ? 'node' : cmd;
      const actualArgs = cmd === 'unjucks' 
        ? [path.join(projectRoot, 'bin/unjucks.cjs'), ...args]
        : args;
      
      const process = spawn(actualCmd, actualArgs, {
        cwd: step.cwd || this.workingDir,
        stdio: ['pipe', 'pipe', 'pipe']
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
        const result = { code, stdout, stderr, command };
        
        if (step.expectError && code !== 0) {
          resolve(result);
        } else if (!step.expectError && code === 0) {
          resolve(result);
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });
      
      process.on('error', reject);
      
      // Send input if specified
      if (step.input) {
        process.stdin.write(step.input);
        process.stdin.end();
      }
    });
  }

  async checkFile(step) {
    const filePath = this.interpolatePath(step.path);
    console.log(`     Checking file: ${filePath}`);
    
    const exists = await fs.pathExists(filePath);
    
    if (step.shouldExist && !exists) {
      throw new Error(`File should exist: ${filePath}`);
    }
    
    if (step.shouldNotExist && exists) {
      throw new Error(`File should not exist: ${filePath}`);
    }
    
    let content = null;
    if (exists && step.contentContains) {
      content = await fs.readFile(filePath, 'utf8');
      
      for (const expectedContent of step.contentContains) {
        if (!content.includes(expectedContent)) {
          throw new Error(`File ${filePath} should contain: ${expectedContent}`);
        }
      }
    }
    
    return { exists, content, path: filePath };
  }

  async createFile(step) {
    const filePath = this.interpolatePath(step.path);
    const content = this.interpolateContent(step.content);
    
    console.log(`     Creating file: ${filePath}`);
    
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, content);
    
    return { path: filePath, content };
  }

  async validate(step) {
    console.log(`     Validating: ${step.validation}`);
    
    switch (step.validation) {
      case 'directory-structure':
        return await this.validateDirectoryStructure(step.expected);
      case 'file-count':
        return await this.validateFileCount(step.pattern, step.expectedCount);
      case 'no-errors':
        return await this.validateNoErrors();
      default:
        throw new Error(`Unknown validation: ${step.validation}`);
    }
  }

  async validateDirectoryStructure(expectedStructure) {
    const missing = [];
    
    for (const expectedPath of expectedStructure) {
      const fullPath = path.join(this.workingDir, expectedPath);
      if (!await fs.pathExists(fullPath)) {
        missing.push(expectedPath);
      }
    }
    
    if (missing.length > 0) {
      throw new Error(`Missing expected files/directories: ${missing.join(', ')}`);
    }
    
    return { validated: expectedStructure, missing: [] };
  }

  async validateFileCount(pattern, expectedCount) {
    const { glob } = await import('glob');
    const files = await glob(pattern, { cwd: this.workingDir });
    
    if (files.length !== expectedCount) {
      throw new Error(`Expected ${expectedCount} files matching ${pattern}, found ${files.length}`);
    }
    
    return { pattern, expectedCount, actualCount: files.length, files };
  }

  async validateNoErrors() {
    // Check for common error indicators in generated files
    const { glob } = await import('glob');
    const files = await glob('**/*.{js,ts,tsx,vue}', { cwd: this.workingDir });
    
    const errors = [];
    
    for (const file of files) {
      const content = await fs.readFile(path.join(this.workingDir, file), 'utf8');
      
      // Check for common template errors
      if (content.includes('undefined') && content.includes('<%')) {
        errors.push(`${file}: Contains undefined template variables`);
      }
      
      if (content.includes('<%=') || content.includes('<%-')) {
        errors.push(`${file}: Contains unprocessed template syntax`);
      }
    }
    
    if (errors.length > 0) {
      throw new Error(`Generated files contain errors: ${errors.join(', ')}`);
    }
    
    return { checkedFiles: files.length, errors: [] };
  }

  async wait(step) {
    const ms = step.duration || 1000;
    console.log(`     Waiting ${ms}ms...`);
    
    await new Promise(resolve => setTimeout(resolve, ms));
    return { waited: ms };
  }

  interpolateCommand(command) {
    return command.replace(/\{\{(.*?)\}\}/g, (match, key) => {
      return this.context[key.trim()] || match;
    });
  }

  interpolatePath(path) {
    const interpolated = path.replace(/\{\{(.*?)\}\}/g, (match, key) => {
      return this.context[key.trim()] || match;
    });
    
    return path.isAbsolute(interpolated) ? interpolated : path.join(this.workingDir, interpolated);
  }

  interpolateContent(content) {
    return content.replace(/\{\{(.*?)\}\}/g, (match, key) => {
      return this.context[key.trim()] || match;
    });
  }

  generateResult(success, error = null) {
    return {
      journey: this.name,
      success,
      error,
      sessionId: this.sessionId,
      workingDir: this.workingDir,
      stepsCompleted: this.results.filter(r => r.success).length,
      totalSteps: this.steps.length,
      duration: this.results.reduce((sum, r) => sum + r.duration, 0),
      steps: this.results
    };
  }

  async cleanup() {
    try {
      await fs.remove(this.workingDir);
    } catch (error) {
      console.warn(`Warning: Could not cleanup ${this.workingDir}: ${error.message}`);
    }
  }
}

class E2ETestRunner {
  constructor() {
    this.journeys = [];
    this.reportsDir = path.join(projectRoot, 'tests/reports');
  }

  addJourney(journey) {
    this.journeys.push(journey);
  }

  async runAllJourneys() {
    console.log('🌍 Running End-to-End User Journey Tests\n');
    
    await fs.ensureDir(this.reportsDir);
    
    const results = [];
    let passed = 0;
    
    for (const journey of this.journeys) {
      const result = await journey.execute();
      results.push(result);
      
      if (result.success) {
        passed++;
      }
    }
    
    const report = {
      timestamp: this.getDeterministicDate().toISOString(),
      totalJourneys: this.journeys.length,
      passed,
      failed: this.journeys.length - passed,
      results
    };
    
    await this.saveReport(report);
    this.displaySummary(report);
    
    return report;
  }

  async saveReport(report) {
    await fs.writeJSON(
      path.join(this.reportsDir, 'e2e-report.json'),
      report,
      { spaces: 2 }
    );
  }

  displaySummary(report) {
    console.log('\n📊 End-to-End Test Summary:');
    console.log('=' * 40);
    
    report.results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const steps = `${result.stepsCompleted}/${result.totalSteps}`;
      console.log(`${status} ${result.journey} (${steps} steps, ${result.duration}ms)`);
      
      if (!result.success && result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
    
    console.log(`\n📊 Results: ${report.passed}/${report.totalJourneys} journeys passed`);
    
    if (report.failed > 0) {
      console.log('\n💥 Some end-to-end tests failed!');
      process.exit(1);
    } else {
      console.log('\n🎉 All end-to-end tests passed!');
    }
  }
}

// Define user journeys
const createUserJourneys = () => {
  const runner = new E2ETestRunner();
  
  // Journey 1: New User Setup and First Template Generation
  runner.addJourney(new UserJourney(
    'New User First Template Generation',
    'Complete workflow of a new user generating their first template',
    [
      {
        type: 'command',
        description: 'Check unjucks version',
        command: 'unjucks --version'
      },
      {
        type: 'command',
        description: 'Get help information',
        command: 'unjucks --help'
      },
      {
        type: 'command',
        description: 'List available templates',
        command: 'unjucks list'
      },
      {
        type: 'file-create',
        description: 'Create a simple template',
        path: '_templates/component/new.tsx.ejs',
        content: `import React from 'react';

export const <%= name %> = () => {
  return (
    <div className="<%= name.toLowerCase() %>-component">
      <h1><%= name %> Component</h1>
    </div>
  );
};

export default <%= name %>;
`
      },
      {
        type: 'command',
        description: 'Generate component using template',
        command: 'unjucks generate component new --name MyComponent'
      },
      {
        type: 'file-check',
        description: 'Verify generated component exists',
        path: 'MyComponent.tsx',
        shouldExist: true,
        contentContains: ['export const MyComponent', 'MyComponent Component']
      },
      {
        type: 'validation',
        description: 'Ensure no template errors in generated files',
        validation: 'no-errors'
      }
    ]
  ));
  
  // Journey 2: Advanced Template with Multiple Files
  runner.addJourney(new UserJourney(
    'Multi-File Template Generation',
    'Generate a complex template that creates multiple related files',
    [
      {
        type: 'file-create',
        description: 'Create component template',
        path: '_templates/feature/component.tsx.ejs',
        content: `import React from 'react';
import { use<%= name %> } from './use<%= name %>';

export const <%= name %> = () => {
  const { data, loading } = use<%= name %>();
  
  if (loading) return <div>Loading...</div>;
  
  return <div><%= name %> Feature</div>;
};
`
      },
      {
        type: 'file-create',
        description: 'Create hook template',
        path: '_templates/feature/hook.ts.ejs',
        content: `import { useState, useEffect } from 'react';

export const use<%= name %> = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Fetch <%= name.toLowerCase() %> data
    setLoading(false);
  }, []);
  
  return { data, loading };
};
`
      },
      {
        type: 'file-create',
        description: 'Create test template',
        path: '_templates/feature/test.spec.tsx.ejs',
        content: `import { render, screen } from '@testing-library/react';
import { <%= name %> } from './<%= name %>';

describe('<%= name %>', () => {
  it('renders without crashing', () => {
    render(<<%= name %> />);
    expect(screen.getByText('<%= name %> Feature')).toBeInTheDocument();
  });
});
`
      },
      {
        type: 'command',
        description: 'Generate complete feature',
        command: 'unjucks generate feature --name UserProfile'
      },
      {
        type: 'validation',
        description: 'Verify all files were created',
        validation: 'file-count',
        pattern: 'UserProfile*',
        expectedCount: 3
      },
      {
        type: 'file-check',
        description: 'Verify component file',
        path: 'UserProfile.tsx',
        shouldExist: true,
        contentContains: ['useUserProfile', 'UserProfile Feature']
      },
      {
        type: 'file-check',
        description: 'Verify hook file',
        path: 'useUserProfile.ts',
        shouldExist: true,
        contentContains: ['export const useUserProfile']
      },
      {
        type: 'file-check',
        description: 'Verify test file',
        path: 'UserProfile.spec.tsx',
        shouldExist: true,
        contentContains: ['describe(\'UserProfile\'']
      }
    ]
  ));
  
  // Journey 3: Error Handling and Recovery
  runner.addJourney(new UserJourney(
    'Error Handling and Recovery',
    'Test how the system handles errors and recovers gracefully',
    [
      {
        type: 'command',
        description: 'Try to generate non-existent template',
        command: 'unjucks generate nonexistent new',
        expectError: true
      },
      {
        type: 'command',
        description: 'Try invalid command syntax',
        command: 'unjucks invalid-command',
        expectError: true
      },
      {
        type: 'file-create',
        description: 'Create template with syntax error',
        path: '_templates/broken/new.js.ejs',
        content: 'This is <%= broken syntax %><%'
      },
      {
        type: 'command',
        description: 'Try to use broken template',
        command: 'unjucks generate broken new --name Test',
        expectError: true
      },
      {
        type: 'validation',
        description: 'Ensure working directory is clean after errors',
        validation: 'file-count',
        pattern: 'Test*',
        expectedCount: 0
      }
    ]
  ));
  
  return runner;
};

// Execute if run directly
if (import.meta.url === `file://${__filename}`) {
  const runner = createUserJourneys();
  
  runner.runAllJourneys().catch(error => {
    console.error('E2E testing failed:', error);
    process.exit(1);
  });
}

export { UserJourney, E2ETestRunner };
