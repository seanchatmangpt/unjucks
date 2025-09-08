#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';

const CLI_TEST_FILES = [
  'tests/cli/backward-compatibility.test.js',
  'tests/cli/command-combinations.test.js', 
  'tests/cli/error-handling.test.js',
  'tests/cli/file-operations.test.js',
  'tests/cli/full-workflows.test.js',
  'tests/cli/help-system.test.js',
  'tests/cli/performance-edge-cases.test.js',
  'tests/cli/semantic-commands.test.js'
];

const STANDARD_IMPORTS = `import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLI_PATH = path.resolve(__dirname, '../../bin/unjucks.cjs');`;

const STANDARD_RUN_CLI = `async function runCLI(args = [], cwd) {
  return new Promise((resolve) => {
    const child = spawn('node', [CLI_PATH, ...args], {
      cwd: cwd || process.cwd(),
      env: { ...process.env, NODE_ENV: 'test' },
      timeout: 30000
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (exitCode) => {
      resolve({ stdout, stderr, exitCode: exitCode || 0 });
    });

    child.on('error', (error) => {
      resolve({ stdout, stderr: error.message, exitCode: 1 });
    });
  });
}`;

async function fixTestFile(filePath) {
  try {
    let content = await fs.readFile(filePath, 'utf8');
    
    // Fix imports section - replace everything from first import to CLI_PATH definition
    const importRegex = /import.*?from.*?;\s*(?:\n.*?import.*?from.*?;)*\s*(?:\n.*?const.*?promisify.*?;)?\s*(?:\n.*?const CLI_PATH.*?;)/s;
    if (importRegex.test(content)) {
      content = content.replace(importRegex, STANDARD_IMPORTS);
    }
    
    // Fix runCLI function
    const runCliRegex = /async function runCLI\(.*?\n\s*\}\s*\n?\s*\}/s;
    if (runCliRegex.test(content)) {
      content = content.replace(runCliRegex, STANDARD_RUN_CLI);
    }
    
    // Fix common syntax patterns
    content = content
      // Fix arrow function syntax in beforeEach
      .replace(/let\s+([^,]+)\s+=>\s*\{/g, 'let $1, originalCwd;\n\n  beforeEach(async () => {')
      // Fix arrow function syntax in afterEach  
      .replace(/afterEach\(async \(\) => \{ ([^}]+);/g, 'afterEach(async () => {\n    $1;')
      // Fix recursive directory options
      .replace(/\{ recursive \}/g, '{ recursive: true }')
      // Fix async function declarations
      .replace(/async function ([^(]+)\(\) \{/g, 'async function $1() {\n    ')
      // Fix parameter syntax
      .replace(/\(args = \[\], cwd\?\)/g, '(args = [], cwd)')
      // Fix incomplete try-catch blocks
      .replace(/\} catch \(error\) \{ return \{\s*stdout \};\s*\}/g, '} catch (error) {\n      return { stdout: "", stderr: error.message, exitCode: 1 };\n    }')
      // Fix missing closing brackets
      .replace(/expect\(.*?\)\.toContain\(.*?\) \}\);/g, (match) => {
        if (!match.includes('expect(result.exitCode).toBe(0);')) {
          return match.replace('});', '\n      expect(result.exitCode).toBe(0);\n    });');
        }
        return match;
      });

    await fs.writeFile(filePath, content);
    console.log(`✅ Fixed ${filePath}`);
  } catch (error) {
    console.error(`❌ Failed to fix ${filePath}:`, error.message);
  }
}

async function main() {
  console.log('🔧 Fixing CLI test files...\n');
  
  for (const file of CLI_TEST_FILES) {
    await fixTestFile(file);
  }
  
  console.log('\n✅ All CLI test files have been fixed!');
}

main().catch(console.error);