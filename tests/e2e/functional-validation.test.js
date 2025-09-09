#!/usr/bin/env node
/**
 * Functional Validation E2E Tests for Unjucks
 * Tests core functionality with actual CLI commands
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const TESTS = {
  timeout: 30000,
  tempDir: path.join(os.tmpdir(), 'unjucks-functional-test-' + Date.now()),
  cliPath: path.resolve(__dirname, '../../bin/unjucks.cjs'),
  projectRoot: path.resolve(__dirname, '../..')
};

// Test results
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: [],
  errors: []
};

/**
 * Execute CLI command
 */
async function execCLI(args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [TESTS.cliPath, ...args], {
      cwd: options.cwd || TESTS.tempDir,
      stdio: 'pipe',
      timeout: TESTS.timeout
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({
        success: code === 0,
        code,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      });
    });

    proc.on('error', reject);

    setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error('Command timeout'));
    }, TESTS.timeout);
  });
}

/**
 * Test helper
 */
function test(name, fn) {
  results.total++;
  
  return fn().then(() => {
    results.passed++;
    results.tests.push({ name, status: 'PASSED' });
    console.log(`✅ ${name}`);
  }).catch(error => {
    results.failed++;
    results.tests.push({ name, status: 'FAILED', error: error.message });
    results.errors.push({ test: name, error: error.message });
    console.log(`❌ ${name}: ${error.message}`);
  });
}

/**
 * Setup test environment
 */
async function setup() {
  await fs.rm(TESTS.tempDir, { recursive: true, force: true });
  await fs.mkdir(TESTS.tempDir, { recursive: true });
  console.log(`📁 Test directory: ${TESTS.tempDir}`);
}

/**
 * Cleanup test environment
 */
async function cleanup() {
  await fs.rm(TESTS.tempDir, { recursive: true, force: true });
}

/**
 * FUNCTIONAL TESTS
 */

console.log('🧪 Starting Functional Validation Tests\n');

await setup();

// Test 1: CLI Version
await test('CLI Version Command', async () => {
  const result = await execCLI(['--version']);
  if (!result.success) throw new Error('Version command failed');
  if (!result.stdout.match(/\d+\.\d+\.\d+/)) throw new Error('No version number in output');
});

// Test 2: CLI Help
await test('CLI Help Command', async () => {
  const result = await execCLI(['--help']);
  if (!result.success) throw new Error('Help command failed');
  if (!result.stdout.includes('generator')) throw new Error('Help missing generator description');
});

// Test 3: List Command
await test('List Available Templates', async () => {
  // Copy templates from project
  const projectTemplates = path.join(TESTS.projectRoot, '_templates');
  const testTemplates = path.join(TESTS.tempDir, '_templates');
  
  try {
    await fs.cp(projectTemplates, testTemplates, { recursive: true });
  } catch {
    // Create minimal template if copy fails
    await fs.mkdir(path.join(testTemplates, 'test', 'simple'), { recursive: true });
    await fs.writeFile(
      path.join(testTemplates, 'test', 'simple', 'index.ejs.t'),
      '---\nto: test.txt\n---\nTest content'
    );
  }

  const result = await execCLI(['list']);
  if (!result.success) throw new Error(`List command failed: ${result.stderr}`);
});

// Test 4: Basic Template Generation
await test('Basic Template Generation', async () => {
  // Create simple template
  const templateDir = path.join(TESTS.tempDir, '_templates', 'basic', 'file');
  await fs.mkdir(templateDir, { recursive: true });
  
  const template = `---
to: generated/<%= name %>.txt
---
Hello <%= name %>!
Generated at: <%= new Date().toISOString() %>
`;
  
  await fs.writeFile(path.join(templateDir, 'index.ejs.t'), template);

  // Generate file
  const result = await execCLI(['generate', 'basic', 'file', '--name', 'TestFile']);
  if (!result.success) throw new Error(`Generate failed: ${result.stderr || result.stdout}`);

  // Verify file exists
  const generatedFile = path.join(TESTS.tempDir, 'generated', 'TestFile.txt');
  try {
    const content = await fs.readFile(generatedFile, 'utf8');
    if (!content.includes('Hello TestFile!')) throw new Error('Generated content incorrect');
  } catch {
    throw new Error('Generated file not found');
  }
});

// Test 5: Multiple File Generation
await test('Multiple File Generation', async () => {
  // Create template with multiple files
  const templateDir = path.join(TESTS.tempDir, '_templates', 'multi', 'component');
  await fs.mkdir(templateDir, { recursive: true });

  // Component file
  const componentTemplate = `---
to: src/components/<%= name %>.js
---
export const <%= name %> = () => {
  return '<%= name %> component';
};
`;

  // Test file
  const testTemplate = `---
to: src/components/<%= name %>.test.js
---
import { <%= name %> } from './<%= name %>';

test('<%= name %> renders', () => {
  expect(<%= name %>()).toBeTruthy();
});
`;

  await fs.writeFile(path.join(templateDir, 'component.ejs.t'), componentTemplate);
  await fs.writeFile(path.join(templateDir, 'test.ejs.t'), testTemplate);

  // Generate files
  const result = await execCLI(['generate', 'multi', 'component', '--name', 'Button']);
  if (!result.success) throw new Error(`Multi-file generation failed: ${result.stderr}`);

  // Verify both files exist
  const componentFile = path.join(TESTS.tempDir, 'src/components/Button.js');
  const testFile = path.join(TESTS.tempDir, 'src/components/Button.test.js');

  try {
    await fs.access(componentFile);
    await fs.access(testFile);
  } catch {
    throw new Error('Generated files not found');
  }

  // Verify content
  const componentContent = await fs.readFile(componentFile, 'utf8');
  const testContent = await fs.readFile(testFile, 'utf8');

  if (!componentContent.includes('Button component')) throw new Error('Component content incorrect');
  if (!testContent.includes('Button renders')) throw new Error('Test content incorrect');
});

// Test 6: Template with Variables
await test('Template Variable Interpolation', async () => {
  // Create template with various variable types
  const templateDir = path.join(TESTS.tempDir, '_templates', 'vars', 'demo');
  await fs.mkdir(templateDir, { recursive: true });

  const template = `---
to: output/<%= name %>-<%= type %>.md
---
# <%= title || name %>

Type: <%= type %>
Created: <%= new Date().getFullYear() %>
Active: <%= active || 'false' %>

<% if (description) { -%>
Description: <%= description %>
<% } -%>

<% if (tags) { -%>
Tags: <%= tags %>
<% } -%>
`;

  await fs.writeFile(path.join(templateDir, 'index.ejs.t'), template);

  // Generate with variables
  const result = await execCLI([
    'generate', 'vars', 'demo',
    '--name', 'test-project',
    '--type', 'library',
    '--title', 'Test Project Library',
    '--description', 'A test library project',
    '--tags', 'testing,library,nodejs',
    '--active', 'true'
  ]);

  if (!result.success) throw new Error(`Variable interpolation failed: ${result.stderr}`);

  // Verify content
  const outputFile = path.join(TESTS.tempDir, 'output', 'test-project-library.md');
  const content = await fs.readFile(outputFile, 'utf8');

  if (!content.includes('# Test Project Library')) throw new Error('Title interpolation failed');
  if (!content.includes('Type: library')) throw new Error('Type interpolation failed');
  if (!content.includes('Description: A test library project')) throw new Error('Description interpolation failed');
  if (!content.includes('Tags: testing,library,nodejs')) throw new Error('Tags interpolation failed');
  if (!content.includes('Active: true')) throw new Error('Active interpolation failed');
});

// Test 7: Error Handling
await test('Error Handling for Invalid Template', async () => {
  // Test non-existent generator
  const result = await execCLI(['generate', 'nonexistent', 'template']);
  if (result.success) throw new Error('Should fail for non-existent generator');
  
  // Verify error message is informative
  const output = result.stderr || result.stdout;
  if (!output.includes('not found') && !output.includes('does not exist')) {
    throw new Error('Error message not informative enough');
  }
});

// Test 8: Hygen-style Positional Arguments
await test('Hygen-style Positional Arguments', async () => {
  // Create simple template
  const templateDir = path.join(TESTS.tempDir, '_templates', 'pos', 'test');
  await fs.mkdir(templateDir, { recursive: true });

  const template = `---
to: positional/<%= name %>.js
---
// Generated with positional args
export const <%= name %> = 'positional-test';
`;

  await fs.writeFile(path.join(templateDir, 'index.ejs.t'), template);

  // Use positional syntax
  const result = await execCLI(['pos', 'test', '--name', 'PositionalTest']);
  if (!result.success) throw new Error(`Positional args failed: ${result.stderr}`);

  // Verify file
  const outputFile = path.join(TESTS.tempDir, 'positional', 'PositionalTest.js');
  try {
    const content = await fs.readFile(outputFile, 'utf8');
    if (!content.includes('PositionalTest')) throw new Error('Positional content incorrect');
  } catch {
    throw new Error('Positional output file not found');
  }
});

// Test 9: Directory Structure Creation
await test('Deep Directory Structure Creation', async () => {
  const templateDir = path.join(TESTS.tempDir, '_templates', 'deep', 'structure');
  await fs.mkdir(templateDir, { recursive: true });

  const template = `---
to: very/deep/nested/directory/structure/<%= name %>.js
---
// Deep nested file
export const <%= name %> = 'deep-structure-test';
`;

  await fs.writeFile(path.join(templateDir, 'index.ejs.t'), template);

  const result = await execCLI(['generate', 'deep', 'structure', '--name', 'DeepFile']);
  if (!result.success) throw new Error(`Deep structure failed: ${result.stderr}`);

  const deepFile = path.join(TESTS.tempDir, 'very/deep/nested/directory/structure/DeepFile.js');
  try {
    await fs.access(deepFile);
  } catch {
    throw new Error('Deep nested file not created');
  }
});

// Test 10: Performance Test
await test('Performance - Generate 10 Files', async () => {
  const templateDir = path.join(TESTS.tempDir, '_templates', 'perf', 'file');
  await fs.mkdir(templateDir, { recursive: true });

  const template = `---
to: perf/file-<%= index %>.js
---
// Performance test file <%= index %>
export const file<%= index %> = <%= index %>;
`;

  await fs.writeFile(path.join(templateDir, 'index.ejs.t'), template);

  const startTime = Date.now();
  
  // Generate 10 files sequentially
  for (let i = 1; i <= 10; i++) {
    const result = await execCLI(['generate', 'perf', 'file', '--index', i.toString()]);
    if (!result.success) throw new Error(`Performance test failed at file ${i}: ${result.stderr}`);
  }

  const duration = Date.now() - startTime;
  
  // Verify all files exist
  for (let i = 1; i <= 10; i++) {
    const file = path.join(TESTS.tempDir, 'perf', `file-${i}.js`);
    try {
      await fs.access(file);
    } catch {
      throw new Error(`Performance test file ${i} not found`);
    }
  }

  console.log(`   📊 Generated 10 files in ${duration}ms`);
  if (duration > 30000) throw new Error(`Performance too slow: ${duration}ms`);
});

// Generate final report
console.log('\n' + '='.repeat(50));
console.log('📊 FUNCTIONAL VALIDATION RESULTS');
console.log('='.repeat(50));
console.log(`Total Tests: ${results.total}`);
console.log(`✅ Passed: ${results.passed}`);
console.log(`❌ Failed: ${results.failed}`);
console.log(`📈 Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);

if (results.failed > 0) {
  console.log('\n❌ FAILED TESTS:');
  results.errors.forEach(error => {
    console.log(`  • ${error.test}: ${error.error}`);
  });
}

// Store results in memory format
const memoryResults = {
  testSuite: 'Functional Validation Tests',
  summary: {
    total: results.total,
    passed: results.passed,
    failed: results.failed,
    successRate: (results.passed / results.total) * 100
  },
  tests: results.tests,
  timestamp: new Date().toISOString(),
  status: results.failed === 0 ? 'ALL_PASSED' : 'SOME_FAILED'
};

// Save results
const reportsDir = path.join(__dirname, '../reports');
await fs.mkdir(reportsDir, { recursive: true });

const resultsFile = path.join(reportsDir, 'functional-validation.json');
await fs.writeFile(resultsFile, JSON.stringify({
  key: 'gaps/e2e/results',
  value: memoryResults,
  rawResults: results,
  timestamp: new Date().toISOString()
}, null, 2));

console.log(`\n📄 Results saved: ${resultsFile}`);

await cleanup();

// Exit with appropriate code
process.exit(results.failed > 0 ? 1 : 0);