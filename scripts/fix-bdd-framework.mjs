#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';

const WORKING_PATTERN = `import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { createTestContext } from '../support/test-context.js';
import type { CLIResult } from '../support/TestHelper.js';

// Load the feature file
const feature = await loadFeature('./features/FEATURE_NAME.feature');

describeFeature(feature, ({ Scenario }) => {
  Scenario('SCENARIO_NAME', ({ Given, When, Then, And }) => {
    let testResult: CLIResult;
    
    Given('I have a basic setup', async () => {
      console.log('[TEST] Setting up test...');
    });

    When('I run a test command', async () => {
      const context = createTestContext();
      const result = await context.helper.executeCommand('node dist/cli.mjs list');
      testResult = result;
    });

    Then('the command should work correctly', () => {
      expect(testResult?.exitCode).toBe(0);
    });
  });
});`;

console.log('🔄 Fixing BDD framework integration issues...');

// Find all problematic test files
const testFiles = glob.sync('tests/features/**/*.feature.spec.ts');

let fixedCount = 0;
let errorCount = 0;

for (const filePath of testFiles) {
  try {
    console.log(`📝 Processing: ${filePath}`);
    let content = readFileSync(filePath, 'utf8');
    let wasFixed = false;

    // Fix import statements
    if (content.includes("from 'vitest-cucumber'")) {
      content = content.replace("from 'vitest-cucumber'", "from '@amiceli/vitest-cucumber'");
      wasFixed = true;
    }
    
    if (content.includes("from \"vitest-cucumber\"")) {
      content = content.replace("from \"vitest-cucumber\"", "from '@amiceli/vitest-cucumber'");
      wasFixed = true;
    }

    // Fix defineFeature to describeFeature
    if (content.includes('defineFeature')) {
      content = content.replace(/defineFeature/g, 'describeFeature');
      wasFixed = true;
    }

    // Fix function parameter pattern
    if (content.includes('(test) => {')) {
      content = content.replace('(test) => {', '({ Scenario }) => {');
      wasFixed = true;
    }

    // Fix test() calls to Scenario()
    content = content.replace(/test\('([^']+)', \(\{ ([^}]+) \}\) => \{/g, 
      "Scenario('$1', ({ Given, When, Then, And }) => {\n    let testResult: CLIResult;");

    // Fix step function naming
    content = content.replace(/given\(/g, 'Given(');
    content = content.replace(/when\(/g, 'When(');
    content = replace(/then\(/g, 'Then(');
    content = content.replace(/and\(/g, 'And(');

    // Add proper imports if missing
    if (!content.includes("import type { CLIResult }")) {
      content = content.replace(
        "import { expect } from 'vitest';",
        "import { expect } from 'vitest';\nimport { createTestContext } from '../support/test-context.js';\nimport type { CLIResult } from '../support/TestHelper.js';"
      );
    }

    // Fix loadFeature path to use await and proper path
    if (content.includes("loadFeature('tests/features/")) {
      content = content.replace(
        /loadFeature\('tests\/features\/([^']+)'\)/g,
        "await loadFeature('./features/$1')"
      );
      // Add const before feature =
      if (!content.includes('const feature = await')) {
        content = content.replace(
          /const feature = loadFeature/g,
          'const feature = await loadFeature'
        );
      }
    }

    if (wasFixed) {
      writeFileSync(filePath, content);
      fixedCount++;
      console.log(`✅ Fixed: ${filePath}`);
    } else {
      console.log(`⏭️  No changes needed: ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    errorCount++;
  }
}

console.log(`\n🎯 BDD Framework Fix Summary:`);
console.log(`   ✅ Fixed files: ${fixedCount}`);
console.log(`   ❌ Errors: ${errorCount}`);
console.log(`   📁 Total processed: ${testFiles.length}`);

if (errorCount === 0) {
  console.log('🚀 All BDD framework issues have been resolved!');
} else {
  console.log('⚠️  Some files still have issues. Check the error messages above.');
}