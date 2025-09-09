#!/usr/bin/env node

import fs from 'fs/promises';

const files = [
  'tests/cli/command-combinations.test.js',
  'tests/cli/full-workflows.test.js'
];

async function fixFile(filePath) {
  try {
    let content = await fs.readFile(filePath, 'utf8');
    
    // Fix duplicate closing braces and other syntax issues
    content = content
      // Remove duplicate function definitions
      .replace(/\}\s*\n\s*async function runCLI.*?\n\s*\}\s*\n\}/s, '}')
      // Fix duplicate beforeEach declarations
      .replace(/beforeEach\(async \(\),? originalCwd;\s*\n\s*beforeEach\(async \(\) => \{/, 'beforeEach(async () => {')
      // Fix broken variable declarations
      .replace(/let tempDir;[\s\n]*let originalCwd;\s*\n\s*beforeEach/, 'let tempDir, originalCwd;\n\n  beforeEach')
      // Fix incomplete afterEach blocks
      .replace(/afterEach\(async \(\) => \{\s*\n\s*process\.chdir\(originalCwd\);/, 'afterEach(async () => {\n    process.chdir(originalCwd);')
      // Fix malformed template strings
      .replace(/to\)\s*;?\s*\n/g, "to: {{name}}.txt\n---\nContent here\n")
      // Fix incomplete expect statements
      .replace(/expect\([^)]+\)\.toContain\([^)]+\) \}\);/g, (match) => {
        return match.replace(' });', ';\n      expect(result.exitCode).toBe(0);\n    });');
      })
      // Fix broken template content
      .replace(/\n\s*\}\s*=\s*\{\s*id\s*\}\s*=\s*\{\s*id\s*\};?\s*/g, '\n')
      // Remove broken template fragments
      .replace(/{{[^}]*\s*expect\([^}]*\}\}/g, '{{name}}')
      // Fix malformed function declarations
      .replace(/async function ([^(]+)\(\) \{/g, 'async function $1() {')
      // Fix broken describe blocks
      .replace(/describe\([^{]+\{\s*it\(/g, (match) => {
        return match.replace('{', '() => {\n    it(');
      });

    await fs.writeFile(filePath, content);
    console.log(`✅ Fixed syntax in ${filePath}`);
  } catch (error) {
    console.error(`❌ Failed to fix ${filePath}:`, error.message);
  }
}

async function main() {
  console.log('🔧 Fixing remaining syntax issues...\n');
  
  for (const file of files) {
    await fixFile(file);
  }
  
  console.log('\n✅ Syntax fixes applied!');
}

main().catch(console.error);