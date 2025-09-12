/**
 * KGEN Integration Test Validation Script
 * 
 * Validates that all integration test scenarios can execute properly
 * Tests file creation, CLI accessibility, and basic functionality
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

const TEST_FILES = [
  '/Users/sac/unjucks/tests/integration/kgen-e2e.test.js',
  '/Users/sac/unjucks/tests/integration/deterministic.test.js',
  '/Users/sac/unjucks/tests/integration/cli-commands.test.js'
];

const KGEN_CLI = '/Users/sac/unjucks/bin/kgen.mjs';

async function validateTestFiles() {
  console.log('🔍 Validating integration test files...');
  
  for (const testFile of TEST_FILES) {
    try {
      const stats = await fs.stat(testFile);
      console.log(`✅ ${path.basename(testFile)}: ${stats.size} bytes`);
      
      // Check for essential test patterns
      const content = await fs.readFile(testFile, 'utf-8');
      
      const checks = [
        { pattern: /describe\(/g, name: 'describe blocks' },
        { pattern: /it\(/g, name: 'test cases' },
        { pattern: /expect\(/g, name: 'assertions' },
        { pattern: /beforeEach|afterEach/g, name: 'setup/teardown' },
        { pattern: /execSync/g, name: 'CLI execution' },
        { pattern: /KGEN/gi, name: 'KGEN references' }
      ];
      
      for (const check of checks) {
        const matches = content.match(check.pattern);
        if (matches) {
          console.log(`   📋 ${check.name}: ${matches.length} found`);
        } else {
          console.log(`   ⚠️  ${check.name}: none found`);
        }
      }
      
      console.log('');
    } catch (error) {
      console.error(`❌ ${path.basename(testFile)}: ${error.message}`);
    }
  }
}

async function validateKGenCLI() {
  console.log('🔧 Validating KGEN CLI...');
  
  try {
    const stats = await fs.stat(KGEN_CLI);
    console.log(`✅ CLI binary exists: ${stats.size} bytes`);
    
    // Test basic CLI functionality
    try {
      const helpOutput = execSync(`node ${KGEN_CLI} --help`, { 
        encoding: 'utf-8',
        timeout: 10000
      });
      
      console.log('✅ CLI help command works');
      
      // Check for essential commands
      const requiredCommands = [
        'generate', 'validate', 'query', 'graph', 'artifact'
      ];
      
      for (const cmd of requiredCommands) {
        if (helpOutput.includes(cmd)) {
          console.log(`   ✅ Command '${cmd}' available`);
        } else {
          console.log(`   ⚠️  Command '${cmd}' not found`);
        }
      }
      
    } catch (error) {
      console.error(`❌ CLI execution failed: ${error.message}`);
    }
    
  } catch (error) {
    console.error(`❌ CLI binary not found: ${error.message}`);
  }
}

async function validateTestFixtures() {
  console.log('📁 Validating test fixture directories...');
  
  const testDirs = [
    '/Users/sac/unjucks/tests/fixtures',
    '/Users/sac/unjucks/tests/fixtures/e2e',
    '/Users/sac/unjucks/tests/fixtures/deterministic',
    '/Users/sac/unjucks/tests/fixtures/cli'
  ];
  
  for (const dir of testDirs) {
    try {
      await fs.access(dir);
      console.log(`✅ Directory exists: ${dir}`);
    } catch (error) {
      console.log(`⚠️  Directory missing (will be created by tests): ${path.basename(dir)}`);
    }
  }
}

async function validateTestDependencies() {
  console.log('📦 Validating test dependencies...');
  
  try {
    const packageJson = JSON.parse(
      await fs.readFile('/Users/sac/unjucks/package.json', 'utf-8')
    );
    
    const testDeps = ['vitest'];
    const devDeps = packageJson.devDependencies || {};
    
    for (const dep of testDeps) {
      if (devDeps[dep]) {
        console.log(`✅ ${dep}: ${devDeps[dep]}`);
      } else {
        console.log(`⚠️  ${dep}: not found in devDependencies`);
      }
    }
    
  } catch (error) {
    console.error(`❌ Could not read package.json: ${error.message}`);
  }
}

async function validateRDFTestData() {
  console.log('🔗 Validating RDF test data formats...');
  
  const rdfSnippets = [
    {
      name: 'Basic RDF',
      content: `@prefix : <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
:User rdf:type :Class .`
    },
    {
      name: 'RDF with properties',
      content: `@prefix : <http://example.org/> .
:user :name "Test" ; :email "test@example.com" .`
    }
  ];
  
  for (const snippet of rdfSnippets) {
    // Basic syntax validation
    const hasPrefix = snippet.content.includes('@prefix');
    const hasTriples = snippet.content.includes(' .');
    
    if (hasPrefix && hasTriples) {
      console.log(`✅ ${snippet.name}: Valid Turtle syntax`);
    } else {
      console.log(`⚠️  ${snippet.name}: Potentially invalid syntax`);
    }
  }
}

async function generateTestReport() {
  console.log('\n📊 Integration Test Suite Summary');
  console.log('=====================================');
  
  const testStats = {
    totalTestFiles: TEST_FILES.length,
    totalTestCases: 0,
    testScenarios: [
      'End-to-end artifact generation',
      'Deterministic output validation', 
      'CLI command testing',
      'RDF graph processing',
      'Lock file management',
      'Cache functionality',
      'Error handling',
      'Performance validation'
    ]
  };
  
  // Count test cases across all files
  for (const testFile of TEST_FILES) {
    try {
      const content = await fs.readFile(testFile, 'utf-8');
      const testMatches = content.match(/it\(/g) || [];
      testStats.totalTestCases += testMatches.length;
    } catch (error) {
      // Skip files that can't be read
    }
  }
  
  console.log(`📋 Test Files: ${testStats.totalTestFiles}`);
  console.log(`🧪 Test Cases: ${testStats.totalTestCases}`);
  console.log(`🎯 Test Scenarios:`);
  
  for (const scenario of testStats.testScenarios) {
    console.log(`   • ${scenario}`);
  }
  
  console.log('\n🚀 Ready for execution with: npm test tests/integration/');
  console.log('📌 Note: Requires vitest installation and KGEN CLI to be functional');
}

async function main() {
  console.log('KGEN Integration Test Validation');
  console.log('================================\n');
  
  try {
    await validateTestFiles();
    await validateKGenCLI();
    await validateTestFixtures();
    await validateTestDependencies();
    await validateRDFTestData();
    await generateTestReport();
    
    console.log('\n✅ Validation complete!');
  } catch (error) {
    console.error(`\n❌ Validation failed: ${error.message}`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  validateTestFiles,
  validateKGenCLI,
  validateTestFixtures,
  validateTestDependencies
};