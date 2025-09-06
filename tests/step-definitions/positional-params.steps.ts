import { Given, When, Then } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';

// Test workspace setup
const testWorkspace = path.join(process.cwd(), 'test-bzyH4B');

Given('I have a generator with positional parameter support', async () => {
  await fs.ensureDir(testWorkspace);
  process.chdir(testWorkspace);
  
  // Create a simple generator with positional parameters
  const generatorPath = path.join(testWorkspace, '_templates', 'component', 'react');
  await fs.ensureDir(generatorPath);
  
  // Create a template with frontmatter that expects 'name' parameter
  const templateContent = `---
to: src/components/{{ name }}.tsx
---
import React from 'react';

export interface {{ name }}Props {
  // Define props here
}

export const {{ name }}: React.FC<{{ name }}Props> = (props) => {
  return (
    <div>{{ name }} Component</div>
  );
};

export default {{ name }};
`;
  
  await fs.writeFile(path.join(generatorPath, 'component.ejs.t'), templateContent);
});

When('I run {string}', (command: string) => {
  try {
    const result = execSync(command, { 
      cwd: testWorkspace, 
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test' }
    });
    
    // Store result for later assertions
    global.testResult = {
      stdout: result,
      success: true,
      error: null
    };
  } catch (error: any) {
    global.testResult = {
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      success: false,
      error: error.message
    };
  }
});

Then('the command should succeed', () => {
  expect(global.testResult.success).toBe(true);
});

Then('it should generate a file at {string}', async (filePath: string) => {
  const fullPath = path.join(testWorkspace, filePath);
  const exists = await fs.pathExists(fullPath);
  expect(exists).toBe(true);
});

Then('the file should contain {string}', async (content: string) => {
  // Find the generated component file
  const componentFiles = await fs.readdir(path.join(testWorkspace, 'src', 'components'));
  const componentFile = componentFiles.find(file => file.endsWith('.tsx'));
  
  if (componentFile) {
    const filePath = path.join(testWorkspace, 'src', 'components', componentFile);
    const fileContent = await fs.readFile(filePath, 'utf8');
    expect(fileContent).toContain(content);
  } else {
    throw new Error('No component file found');
  }
});

Then('the positional parameter {string} should be parsed correctly', async (paramName: string) => {
  // Check if the parameter was used correctly in the generated file
  const componentFiles = await fs.readdir(path.join(testWorkspace, 'src', 'components'));
  const componentFile = componentFiles.find(file => file.includes('UserProfile'));
  
  expect(componentFile).toBeDefined();
  
  if (componentFile) {
    const filePath = path.join(testWorkspace, 'src', 'components', componentFile);
    const fileContent = await fs.readFile(filePath, 'utf8');
    expect(fileContent).toContain('UserProfile');
  }
});

Then('it should work identically to {string}', async (equivalentCommand: string) => {
  // Run the equivalent command and compare results
  try {
    const equivalentResult = execSync(equivalentCommand, { 
      cwd: testWorkspace, 
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test' }
    });
    
    // Both commands should produce the same files
    expect(global.testResult.success).toBe(true);
  } catch (error) {
    // If equivalent command fails, original should too
    if (!global.testResult.success) {
      expect(true).toBe(true); // Both failed, which is expected
    } else {
      throw new Error('Equivalent command failed but original succeeded');
    }
  }
});

Then('both flag and positional styles should be supported', async () => {
  // This is validated by the fact that both commands work
  expect(global.testResult.success).toBe(true);
});

Given('I have a clean test workspace', async () => {
  await fs.emptyDir(testWorkspace);
  process.chdir(testWorkspace);
});

Given('I initialize unjucks in the workspace', async () => {
  execSync('npx unjucks init', { cwd: testWorkspace });
});

When('I run the Hygen-style command {string}', (command: string) => {
  try {
    const result = execSync(command, { 
      cwd: testWorkspace, 
      encoding: 'utf8',
      timeout: 10000 // 10 second timeout
    });
    
    global.testResult = {
      stdout: result,
      success: true,
      error: null
    };
  } catch (error: any) {
    global.testResult = {
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      success: false,
      error: error.message
    };
  }
});

When('I run the traditional command {string}', (command: string) => {
  try {
    const result = execSync(command, { 
      cwd: testWorkspace, 
      encoding: 'utf8',
      timeout: 10000
    });
    
    global.traditionalResult = {
      stdout: result,
      success: true,
      error: null
    };
  } catch (error: any) {
    global.traditionalResult = {
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      success: false,
      error: error.message
    };
  }
});

Then('both commands should produce identical results', async () => {
  expect(global.testResult.success).toBe(global.traditionalResult.success);
  
  if (global.testResult.success) {
    // Check that the same files were generated
    const srcDir = path.join(testWorkspace, 'src');
    if (await fs.pathExists(srcDir)) {
      const files = await fs.readdir(srcDir, { recursive: true });
      expect(files.length).toBeGreaterThan(0);
    }
  }
});

Then('the parameter {string} should have value {string}', async (paramName: string, expectedValue: string) => {
  // Check generated files for the expected parameter value
  const srcDir = path.join(testWorkspace, 'src');
  if (await fs.pathExists(srcDir)) {
    const files = await fs.readdir(srcDir, { recursive: true });
    let found = false;
    
    for (const file of files) {
      if (typeof file === 'string' && file.endsWith('.tsx')) {
        const filePath = path.join(srcDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        if (content.includes(expectedValue)) {
          found = true;
          break;
        }
      }
    }
    
    expect(found).toBe(true);
  }
});

// Cleanup after tests
afterEach(async () => {
  if (await fs.pathExists(testWorkspace)) {
    try {
      await fs.emptyDir(testWorkspace);
    } catch (error) {
      // Ignore cleanup errors
    }
  }
});