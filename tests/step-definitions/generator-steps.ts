import { loadFeature, defineFeature } from 'vitest-cucumber';
import { expect } from 'vitest';
import { UnjucksWorld } from '../support/world';
import * as path from 'node:path';

export const generatorStepDefinitions = {
  // Generator discovery and listing steps
  'I have a generator directory structure': async (world: UnjucksWorld) => {
    if (!world.context.tempDirectory) {
      await world.createTempDirectory();
    }
    await world.helper.createDirectory('_templates');
  },

  'I list all available generators': async (world: UnjucksWorld) => {
    await world.executeUnjucksCommand(['list']);
  },

  'I should see the generator {string} in the output': (world: UnjucksWorld, generatorName: string) => {
    const output = world.getLastOutput();
    expect(output).toContain(generatorName);
  },

  'I should see {int} generators listed': (world: UnjucksWorld, expectedCount: number) => {
    const output = world.getLastOutput();
    // Count generator names in the output
    const generatorMatches = output.match(/^\s*\w+[\w-]*\s*$/gm) || [];
    expect(generatorMatches.length).toBe(expectedCount);
  },

  'the output should contain no generators': (world: UnjucksWorld) => {
    const output = world.getLastOutput();
    expect(output).toMatch(/no generators found|no available generators|empty/i);
  },

  // Generator structure validation steps
  'I have a valid generator {string} with structure:': async (world: UnjucksWorld, generatorName: string, dataTable: any) => {
    const templates: Record<string, string> = {};
    
    for (const row of dataTable.hashes()) {
      const templatePath = `${generatorName}/${row.file}`;
      const frontmatter = row.frontmatter || '';
      const body = row.body || row.content || '';
      
      const templateContent = frontmatter ? `---\n${frontmatter}\n---\n${body}` : body;
      templates[templatePath] = templateContent;
    }
    
    await world.createTemplateStructure(templates);
    world.setTemplateVariables({ currentGenerator: generatorName });
  },

  'I validate the generator structure for {string}': async (world: UnjucksWorld, generatorName: string) => {
    await world.executeUnjucksCommand(['validate', generatorName]);
  },

  'the generator structure should be valid': (world: UnjucksWorld) => {
    const result = world.getLastCommandResult();
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/valid|success|ok/i);
  },

  'the generator structure should be invalid': (world: UnjucksWorld) => {
    const result = world.getLastCommandResult();
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr || result.stdout).toMatch(/invalid|error|fail/i);
  },

  // Generator execution steps
  'I generate from {string}': async (world: UnjucksWorld, generatorName: string) => {
    await world.executeUnjucksCommand(['generate', generatorName]);
  },

  'I generate from {string} with variables:': async (world: UnjucksWorld, generatorName: string, dataTable: any) => {
    const variables = dataTable.rowsHash();
    world.setTemplateVariables(variables);
    
    const args = ['generate', generatorName];
    for (const [key, value] of Object.entries(variables)) {
      args.push(`--${key}`, String(value));
    }
    
    await world.executeUnjucksCommand(args);
  },

  'I generate from {string} in dry run mode': async (world: UnjucksWorld, generatorName: string) => {
    await world.executeUnjucksCommand(['generate', generatorName, '--dry-run']);
  },

  'I generate from {string} with force flag': async (world: UnjucksWorld, generatorName: string) => {
    await world.executeUnjucksCommand(['generate', generatorName, '--force']);
  },

  // Generator inspection steps
  'I inspect the generator {string}': async (world: UnjucksWorld, generatorName: string) => {
    await world.executeUnjucksCommand(['inspect', generatorName]);
  },

  'I get help for generator {string}': async (world: UnjucksWorld, generatorName: string) => {
    await world.executeUnjucksCommand(['help', generatorName]);
  },

  'the help should show available variables': (world: UnjucksWorld) => {
    const output = world.getLastOutput();
    expect(output).toMatch(/variables|options|parameters/i);
  },

  'the help should show variable {string} with type {string}': (world: UnjucksWorld, variableName: string, variableType: string) => {
    const output = world.getLastOutput();
    expect(output).toContain(variableName);
    expect(output).toContain(variableType);
  },

  'the help should show variable {string} with description {string}': (world: UnjucksWorld, variableName: string, description: string) => {
    const output = world.getLastOutput();
    expect(output).toContain(variableName);
    expect(output).toContain(description);
  },

  // Generator metadata and configuration steps
  'the generator {string} should have metadata:': async (world: UnjucksWorld, generatorName: string, dataTable: any) => {
    await world.executeUnjucksCommand(['inspect', generatorName]);
    const output = world.getLastOutput();
    
    for (const row of dataTable.hashes()) {
      const key = row.key || row.property;
      const value = row.value;
      
      expect(output).toContain(key);
      if (value) {
        expect(output).toContain(value);
      }
    }
  },

  'the generator {string} should require variable {string}': async (world: UnjucksWorld, generatorName: string, variableName: string) => {
    await world.executeUnjucksCommand(['inspect', generatorName]);
    const output = world.getLastOutput();
    
    // Check that the variable is marked as required
    expect(output).toMatch(new RegExp(`${variableName}.*required|required.*${variableName}`, 'i'));
  },

  'the generator {string} should have optional variable {string}': async (world: UnjucksWorld, generatorName: string, variableName: string) => {
    await world.executeUnjucksCommand(['inspect', generatorName]);
    const output = world.getLastOutput();
    
    // Check that the variable exists but is not marked as required
    expect(output).toContain(variableName);
    expect(output).not.toMatch(new RegExp(`${variableName}.*required|required.*${variableName}`, 'i'));
  },

  // Template processing within generators
  'the generator should process all templates': (world: UnjucksWorld) => {
    const result = world.getLastCommandResult();
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/processed|generated|created/i);
  },

  'the generator should process {int} templates': (world: UnjucksWorld, expectedCount: number) => {
    const result = world.getLastCommandResult();
    const output = result.stdout;
    
    // Count template processing messages
    const processedCount = (output.match(/processed|generated|created.*template/gi) || []).length;
    expect(processedCount).toBe(expectedCount);
  },

  'the generator should skip templates based on conditions': (world: UnjucksWorld) => {
    const result = world.getLastCommandResult();
    expect(result.stdout).toMatch(/skip|condition|conditional/i);
  },

  // Generator error handling steps
  'the generator should fail with missing required variable {string}': (world: UnjucksWorld, variableName: string) => {
    const result = world.getLastCommandResult();
    expect(result.exitCode).not.toBe(0);
    
    const errorOutput = result.stderr || result.stdout;
    expect(errorOutput).toContain(variableName);
    expect(errorOutput).toMatch(/required|missing/i);
  },

  'the generator should fail with invalid template syntax': (world: UnjucksWorld) => {
    const result = world.getLastCommandResult();
    expect(result.exitCode).not.toBe(0);
    
    const errorOutput = result.stderr || result.stdout;
    expect(errorOutput).toMatch(/syntax|template.*error|parse.*error/i);
  },

  'the generator should fail gracefully': (world: UnjucksWorld) => {
    const result = world.getLastCommandResult();
    expect(result.exitCode).not.toBe(0);
    
    // Error should be informative, not a stack trace
    const errorOutput = result.stderr || result.stdout;
    expect(errorOutput).not.toMatch(/at.*\(.+:\d+:\d+\)/); // No stack trace
    expect(errorOutput.length).toBeGreaterThan(0); // Has error message
  },

  // Generator output validation steps
  'the generator should create files in the correct location': async (world: UnjucksWorld) => {
    const generatedFiles = world.context.generatedFiles;
    expect(generatedFiles.length).toBeGreaterThan(0);
    
    // Verify files were created in expected locations based on frontmatter
    for (const filePath of generatedFiles) {
      const exists = await world.fileExists(filePath);
      expect(exists).toBe(true);
    }
  },

  'the generator should respect the output directory': async (world: UnjucksWorld) => {
    const variables = world.getTemplateVariables();
    const outputDir = variables.outputDir || variables.dest;
    
    if (outputDir) {
      const generatedFiles = world.context.generatedFiles;
      for (const filePath of generatedFiles) {
        expect(filePath.startsWith(outputDir)).toBe(true);
      }
    }
  },

  'the generator should create backup files when overwriting': async (world: UnjucksWorld) => {
    const files = await world.listFiles();
    const backupFiles = files.filter(file => file.includes('.backup') || file.includes('.bak'));
    expect(backupFiles.length).toBeGreaterThan(0);
  },

  'the generator should not create backup files in dry run mode': async (world: UnjucksWorld) => {
    const files = await world.listFiles();
    const backupFiles = files.filter(file => file.includes('.backup') || file.includes('.bak'));
    expect(backupFiles.length).toBe(0);
  },

  // Generator configuration and customization
  'I configure the generator {string} with:': async (world: UnjucksWorld, generatorName: string, dataTable: any) => {
    const config = dataTable.rowsHash();
    world.setTemplateVariables({ [`${generatorName}_config`]: config });
    
    // Store configuration for later use
    for (const [key, value] of Object.entries(config)) {
      world.setVariable(`config_${key}`, value);
    }
  },

  'the generator configuration should be applied': (world: UnjucksWorld) => {
    const result = world.getLastCommandResult();
    expect(result.exitCode).toBe(0);
    
    // Check that configuration was used in generation
    const output = result.stdout;
    expect(output).toMatch(/config|configured|settings/i);
  },

  // Generator performance and optimization
  'the generator should complete within reasonable time': (world: UnjucksWorld) => {
    const result = world.getLastCommandResult();
    const duration = result.duration || 0;
    expect(duration).toBeLessThan(30000); // Less than 30 seconds for reasonable performance
  },

  'the generator should handle large template sets efficiently': (world: UnjucksWorld) => {
    const result = world.getLastCommandResult();
    expect(result.exitCode).toBe(0);
    
    // Should complete without timeout or memory issues
    const output = result.stdout + result.stderr;
    expect(output).not.toMatch(/timeout|memory|out of memory/i);
  },

  // Generator versioning and compatibility
  'the generator should be compatible with the current version': (world: UnjucksWorld) => {
    const result = world.getLastCommandResult();
    expect(result.exitCode).toBe(0);
    
    // Should not show compatibility warnings
    const output = result.stdout + result.stderr;
    expect(output).not.toMatch(/version.*incompatible|incompatible.*version/i);
  },

  'the generator should show deprecation warnings for outdated features': (world: UnjucksWorld) => {
    const result = world.getLastCommandResult();
    const output = result.stdout + result.stderr;
    
    // May show deprecation warnings but should still work
    if (output.includes('deprecat')) {
      expect(output).toMatch(/deprecat.*warning|warning.*deprecat/i);
      expect(result.exitCode).toBe(0); // Still successful despite warnings
    }
  },

  // Generator testing and validation
  'I test the generator {string} with test data:': async (world: UnjucksWorld, generatorName: string, dataTable: any) => {
    const testCases = dataTable.hashes();
    
    for (const testCase of testCases) {
      const variables = { ...testCase };
      delete variables.expected; // Remove expected from variables
      
      world.setTemplateVariables(variables);
      
      const args = ['generate', generatorName];
      for (const [key, value] of Object.entries(variables)) {
        args.push(`--${key}`, String(value));
      }
      
      await world.executeUnjucksCommand(args);
      
      // Store test results for later validation
      const testResult = {
        variables,
        result: world.getLastCommandResult(),
        expected: testCase.expected
      };
      
      world.setVariable('lastTestResult', testResult);
    }
  },

  'all test cases should pass': (world: UnjucksWorld) => {
    const testResult = world.getVariable('lastTestResult') as any;
    
    if (testResult) {
      expect(testResult.result.exitCode).toBe(0);
      
      if (testResult.expected) {
        const output = testResult.result.stdout;
        expect(output).toContain(testResult.expected);
      }
    }
  },

  'the generator should handle edge cases gracefully': (world: UnjucksWorld) => {
    const result = world.getLastCommandResult();
    
    // Should either succeed or fail gracefully without crashes
    expect([0, 1]).toContain(result.exitCode);
    
    if (result.exitCode !== 0) {
      const errorOutput = result.stderr || result.stdout;
      expect(errorOutput).not.toMatch(/unhandled.*error|crash|segfault/i);
    }
  },

  // Generator cleanup and maintenance
  'I clean up generator artifacts': async (world: UnjucksWorld) => {
    // Clean up generated files
    await world.helper.executeCommand('rm -rf ./_templates/*/generated 2>/dev/null || true');
    await world.helper.executeCommand('rm -rf ./generated 2>/dev/null || true');
    await world.helper.executeCommand('rm -rf ./*.backup 2>/dev/null || true');
    
    world.context.generatedFiles = [];
  },

  'the generator workspace should be clean': async (world: UnjucksWorld) => {
    const files = await world.listFiles();
    
    // Should not have temporary or backup files
    const tempFiles = files.filter(file => 
      file.includes('.tmp') || 
      file.includes('.temp') || 
      file.includes('~') ||
      file.startsWith('.')
    );
    
    expect(tempFiles.length).toBe(0);
  }
};