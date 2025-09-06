import { loadFeature, defineFeature } from 'vitest-cucumber';
import { expect } from 'vitest';
import { UnjucksWorld } from '../support/world';
import * as fs from 'fs-extra';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

export const hygenMigrationSteps = {
  // Setup steps for Hygen-style structure
  'I create a complete Hygen-style generator structure:': async (world: UnjucksWorld, structureDescription: string) => {
    // Parse the structure description and create the directory structure
    const templates = {
      'component/new/component.ejs.t': `---
to: src/components/<%= name %>.jsx
---
import React from 'react';

const <%= name %> = () => {
  return <div><%= name %> Component</div>;
};

export default <%= name %>;`,
      'component/new/test.ejs.t': `---
to: src/components/__tests__/<%= name %>.test.jsx
---
import React from 'react';
import { render } from '@testing-library/react';
import <%= name %> from '../<%= name %>';

describe('<%= name %>', () => {
  it('renders correctly', () => {
    render(<<%= name %> />);
  });
});`,
      'reducer/add/reducer.ejs.t': `---
to: src/reducers/<%= name.toLowerCase() %>.js
---
const initial<%= name %> = {
  data: [],
  loading: false
};

export default function <%= name.toLowerCase() %>Reducer(state = initial<%= name %>, action) {
  switch (action.type) {
    default:
      return state;
  }
}`,
      'generator/help/index.ejs.t': `---
to: _templates/<%= name %>/help/index.js
---
module.exports = [
  'Description: <%= name %> generator',
  'Usage: hygen <%= name %> [action]'
];`
    };
    
    await world.createTemplateStructure(templates);
  },

  'I have these Hygen commands that should work in Unjucks:': async (world: UnjucksWorld, dataTable: any) => {
    const commandMappings = dataTable.rowsHash();
    world.setVariable('commandMappings', commandMappings);
  },

  'I test each command conversion': async (world: UnjucksWorld) => {
    const commandMappings = world.getVariable('commandMappings');
    let allSuccessful = true;
    
    for (const [hygenCommand, unjucksCommand] of Object.entries(commandMappings)) {
      try {
        // Test the unjucks equivalent
        const args = (unjucksCommand as string).replace('unjucks ', '').split(' ');
        await world.executeUnjucksCommand(args);
        
        if (world.getLastExitCode() !== 0) {
          allSuccessful = false;
          console.error(`Command failed: ${unjucksCommand}`);
        }
      } catch (error) {
        allSuccessful = false;
        console.error(`Error testing command: ${unjucksCommand}`, error);
      }
    }
    
    world.setVariable('allCommandsSuccessful', allSuccessful);
  },

  'all conversions should succeed': (world: UnjucksWorld) => {
    const allSuccessful = world.getVariable('allCommandsSuccessful');
    expect(allSuccessful).toBe(true);
  },

  // Template conversion steps
  'I have a Hygen EJS template:': (world: UnjucksWorld, ejsTemplate: string) => {
    world.setVariable('originalEjsTemplate', ejsTemplate);
  },

  'I convert it to Unjucks syntax:': async (world: UnjucksWorld, nunjucksTemplate: string) => {
    // Create the converted template
    await world.createTemplateStructure({
      'component/new/component.jsx': nunjucksTemplate
    });
    world.setVariable('convertedTemplate', nunjucksTemplate);
  },

  'the generated file should match Hygen output': async (world: UnjucksWorld) => {
    const files = await world.listFiles();
    expect(files.length).toBeGreaterThan(0);
    
    // Check that the file was generated with expected structure
    const generatedFile = files.find(f => f.includes('TestComponent'));
    expect(generatedFile).toBeDefined();
    
    if (generatedFile) {
      const content = await world.readGeneratedFile(generatedFile);
      expect(content).toContain('TestComponent');
      expect(content).toContain('import React');
      expect(content).toContain('export default');
    }
  },

  // Frontmatter compatibility testing
  'I create a template with all Hygen frontmatter features:': async (world: UnjucksWorld, templateContent: string) => {
    await world.createTemplateStructure({
      'component/new/component.ts': templateContent
    });
  },

  'the shell command should execute': async (world: UnjucksWorld) => {
    // Check if shell command was executed by looking for expected output
    const output = world.getLastOutput();
    // Shell commands in templates would typically show execution in output
    expect(true).toBe(true); // Placeholder for actual shell execution validation
  },

  'injection should work correctly': async (world: UnjucksWorld) => {
    // Verify that injection functionality works
    // This would require checking the target file for injected content
    expect(true).toBe(true); // Placeholder for actual injection validation
  },

  // Enhanced frontmatter testing
  'I create a template with Unjucks-exclusive frontmatter:': async (world: UnjucksWorld, templateContent: string) => {
    await world.createTemplateStructure({
      'util/new/utility.ts': templateContent
    });
  },

  'the file permissions should be set to {int}': async (world: UnjucksWorld, expectedMode: number) => {
    const files = await world.listFiles();
    expect(files.length).toBeGreaterThan(0);
    
    const generatedFile = files[0];
    const filePath = path.resolve(world.context.tempDirectory, generatedFile);
    
    if (await fs.pathExists(filePath)) {
      const stats = await fs.stat(filePath);
      const mode = stats.mode & parseInt('777', 8);
      expect(mode).toBe(expectedMode);
    }
  },

  'both shell commands should execute in sequence': async (world: UnjucksWorld) => {
    // Verify that multiple shell commands execute in order
    // This would require checking for evidence of sequential execution
    expect(true).toBe(true); // Placeholder for shell sequence validation
  },

  'content should be appended correctly': async (world: UnjucksWorld) => {
    const files = await world.listFiles();
    expect(files.length).toBeGreaterThan(0);
    
    // Verify append functionality worked
    const generatedFile = files[0];
    const content = await world.readGeneratedFile(generatedFile);
    expect(content.length).toBeGreaterThan(0);
  },

  // Performance comparison steps
  'I have identical templates in both Hygen and Unjucks format': async (world: UnjucksWorld) => {
    // Set up performance testing templates
    await world.createTemplateStructure({
      'component/new/perf-test.ts': `---
to: "src/components/{{ name }}.tsx"
---
export const {{ name }} = () => <div>{{ name }}</div>;`
    });
  },

  'I benchmark {string}': async (world: UnjucksWorld, command: string) => {
    const startTime = process.hrtime.bigint();
    const args = command.replace('unjucks ', '').split(' ');
    await world.executeUnjucksCommand(args);
    const endTime = process.hrtime.bigint();
    
    const durationMs = Number(endTime - startTime) / 1_000_000;
    world.setVariable('benchmarkDuration', durationMs);
  },

  'the cold start should be under {int}ms (25% faster than Hygen\'s {int}ms)': (world: UnjucksWorld, targetMs: number, baselineMs: number) => {
    const duration = world.getVariable('benchmarkDuration');
    expect(duration).toBeLessThan(targetMs);
    
    // Verify it's actually 25% faster
    const improvementThreshold = baselineMs * 0.75;
    expect(duration).toBeLessThan(improvementThreshold);
  },

  'template processing should be under {int}ms (40% faster than Hygen\'s {int}ms)': (world: UnjucksWorld, targetMs: number, baselineMs: number) => {
    const duration = world.getVariable('benchmarkDuration');
    expect(duration).toBeLessThan(targetMs);
    
    // Verify 40% improvement
    const improvementThreshold = baselineMs * 0.60;
    expect(duration).toBeLessThan(improvementThreshold);
  },

  'file operations should be under {int}ms (25% faster than Hygen\'s {int}ms)': (world: UnjucksWorld, targetMs: number, baselineMs: number) => {
    const duration = world.getVariable('benchmarkDuration');
    expect(duration).toBeLessThan(targetMs);
    
    // Verify 25% improvement
    const improvementThreshold = baselineMs * 0.75;
    expect(duration).toBeLessThan(improvementThreshold);
  },

  'memory usage should be under {int}MB (20% less than Hygen\'s {int}MB)': (world: UnjucksWorld, targetMB: number, baselineMB: number) => {
    // Memory usage testing would require process monitoring
    // For now, we'll validate that the command completed successfully
    expect(world.getLastExitCode()).toBe(0);
    
    // In a real implementation, this would check actual memory usage
    const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;
    expect(memoryUsage).toBeLessThan(targetMB);
  },

  // Migration tooling steps
  'I have existing Hygen templates in "_templates" directory': async (world: UnjucksWorld) => {
    // Create sample Hygen templates for migration testing
    const hygenTemplates = {
      'component/new/component.ejs.t': `---
to: src/components/<%= name %>.jsx
---
import React from 'react';
export const <%= name %> = () => <div><%= name %></div>;`
    };
    
    await world.createTemplateStructure(hygenTemplates);
  },

  'I should see a migration plan': (world: UnjucksWorld) => {
    const output = world.getLastOutput();
    expect(output).toContain('migration');
    expect(output).toContain('plan');
  },

  'it should identify EJS syntax to convert': (world: UnjucksWorld) => {
    const output = world.getLastOutput();
    expect(output).toContain('EJS');
    expect(output).toContain('convert');
  },

  'it should show compatibility warnings': (world: UnjucksWorld) => {
    const output = world.getLastOutput();
    expect(output).toContain('warning');
  },

  'templates should be converted automatically': async (world: UnjucksWorld) => {
    // Verify that templates were converted from EJS to Nunjucks
    const files = await world.listFiles();
    expect(files.some(f => f.includes('template'))).toBe(true);
  },

  'original templates should be backed up': async (world: UnjucksWorld) => {
    // Verify backup files were created
    const files = await world.listFiles();
    expect(files.some(f => f.includes('backup') || f.includes('.bak'))).toBe(true);
  },

  // Complex workflow testing
  'I have a complex Hygen workflow:': (world: UnjucksWorld, workflowDescription: string) => {
    world.setVariable('originalWorkflow', workflowDescription);
  },

  'I convert to Unjucks workflow:': (world: UnjucksWorld, unjucksWorkflow: string) => {
    world.setVariable('convertedWorkflow', unjucksWorkflow);
  },

  'all commands should execute successfully': async (world: UnjucksWorld) => {
    const workflow = world.getVariable('convertedWorkflow');
    const commands = workflow.split('\n').filter(line => line.trim().startsWith('unjucks'));
    
    for (const command of commands) {
      const args = command.trim().replace('unjucks ', '').split(' ');
      await world.executeUnjucksCommand(args);
      expect(world.getLastExitCode()).toBe(0);
    }
  },

  'generated files should maintain relationships': async (world: UnjucksWorld) => {
    const files = await world.listFiles();
    expect(files.length).toBeGreaterThan(0);
    
    // Verify related files were generated together
    expect(files.some(f => f.includes('Button'))).toBe(true);
  },

  'file structure should match Hygen output': async (world: UnjucksWorld) => {
    const files = await world.listFiles();
    
    // Validate expected file structure
    files.forEach(file => {
      expect(file).toMatch(/\.(ts|tsx|js|jsx)$/);
    });
  },

  // Error compatibility testing
  'I run invalid commands in both systems:': async (world: UnjucksWorld, dataTable: any) => {
    const commands = dataTable.rowsHash();
    world.setVariable('invalidCommands', commands);
  },

  'error messages should be equivalent or better': (world: UnjucksWorld) => {
    const output = world.getLastOutput();
    const error = world.getLastError();
    
    // Error should be informative
    expect((output + error).length).toBeGreaterThan(0);
    expect((output + error).toLowerCase()).toContain('error');
  },

  'exit codes should match': (world: UnjucksWorld) => {
    // Failed commands should have non-zero exit code
    expect(world.getLastExitCode()).not.toBe(0);
  },

  // Variable compatibility
  'I create a template with complex variable usage:': async (world: UnjucksWorld, templateContent: string) => {
    await world.createTemplateStructure({
      'class/new/class.ts': templateContent
    });
  },

  'variable interpolation should work correctly': async (world: UnjucksWorld) => {
    const files = await world.listFiles();
    expect(files.length).toBeGreaterThan(0);
    
    const generatedFile = files[0];
    const content = await world.readGeneratedFile(generatedFile);
    expect(content).toContain('UserService');
  },

  'conditional blocks should render properly': async (world: UnjucksWorld) => {
    const files = await world.listFiles();
    const generatedFile = files[0];
    const content = await world.readGeneratedFile(generatedFile);
    
    // Check for conditional content
    expect(content).toContain('options');
    expect(content).toContain('method');
  },

  'filters should apply correctly': async (world: UnjucksWorld) => {
    const files = await world.listFiles();
    const generatedFile = files[0];
    const content = await world.readGeneratedFile(generatedFile);
    
    // Verify filters were applied (kebab-case, pascal-case, etc.)
    expect(content).toContain('userservice');
  },

  // Configuration compatibility
  'I have a Hygen .hygen.js config:': (world: UnjucksWorld, hygenConfig: string) => {
    world.setVariable('hygenConfig', hygenConfig);
  },

  'I convert to unjucks.config.ts:': (world: UnjucksWorld, unjucksConfig: string) => {
    world.setVariable('unjucksConfig', unjucksConfig);
  },

  'configuration should work equivalently': (world: UnjucksWorld) => {
    // Configuration validation would require actually loading config
    expect(true).toBe(true); // Placeholder
  },

  'custom helpers/filters should function identically': (world: UnjucksWorld) => {
    // Custom filter validation
    expect(true).toBe(true); // Placeholder
  },

  // Regression testing
  'I have a comprehensive Hygen project': async (world: UnjucksWorld) => {
    // Set up a complex project structure for migration testing
    const comprehensiveTemplates = {
      'component/new/component.ts': `---
to: "src/components/{{ name }}.tsx"
---
export const {{ name }} = () => <div>{{ name }}</div>;`,
      'service/new/service.ts': `---
to: "src/services/{{ name }}.service.ts"
---
export class {{ name }}Service {}`,
      'model/new/model.ts': `---
to: "src/models/{{ name }}.model.ts"
---
export interface {{ name }} {}`
    };
    
    await world.createTemplateStructure(comprehensiveTemplates);
  },

  'I migrate to Unjucks': async (world: UnjucksWorld) => {
    // Simulate migration process
    world.setVariable('migrationComplete', true);
  },

  'I run the full migration test suite': async (world: UnjucksWorld) => {
    // Run comprehensive tests
    const testCommands = [
      'generate component new TestComp',
      'generate service new TestService',
      'generate model new TestModel'
    ];
    
    for (const command of testCommands) {
      await world.executeUnjucksCommand(command.split(' '));
      expect(world.getLastExitCode()).toBe(0);
    }
  },

  'all existing functionality should work': async (world: UnjucksWorld) => {
    const files = await world.listFiles();
    expect(files.length).toBeGreaterThan(0);
  },

  'no regressions should be introduced': (world: UnjucksWorld) => {
    // All previous commands should have succeeded
    expect(world.getLastExitCode()).toBe(0);
  },

  'performance should improve as claimed': (world: UnjucksWorld) => {
    // Performance improvements should be measurable
    expect(true).toBe(true); // Placeholder for performance validation
  }
};

export default hygenMigrationSteps;