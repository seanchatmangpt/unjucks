#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== COMPREHENSIVE TEMPLATE GENERATION TEST SUITE ===');
console.log('Started at:', new Date().toISOString());

const testResults = {
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
  results: [],
  startTime: new Date(),
};

function runTest(testName, command, description) {
  testResults.totalTests++;
  console.log(`\n🧪 Running: ${testName}`);
  console.log(`📝 Description: ${description}`);
  
  try {
    const result = execSync(command, { 
      cwd: __dirname, 
      encoding: 'utf8',
      timeout: 30000 
    });
    
    testResults.passedTests++;
    testResults.results.push({
      name: testName,
      status: 'PASS',
      description,
      command,
      output: result.substring(0, 500) + (result.length > 500 ? '...' : ''),
      duration: new Date() - testResults.startTime
    });
    
    console.log('✅ PASSED');
    return true;
  } catch (error) {
    testResults.failedTests++;
    testResults.results.push({
      name: testName,
      status: 'FAIL',
      description,
      command,
      error: error.message.substring(0, 500),
      duration: new Date() - testResults.startTime
    });
    
    console.log('❌ FAILED:', error.message.substring(0, 200));
    return false;
  }
}

// Test 1: Basic React Component
runTest(
  'Basic React Component',
  '../../bin/unjucks.cjs component UserProfile --to ./react',
  'Generate a basic React component with default settings'
);

// Test 2: React Component with Props
runTest(
  'React Component with Props', 
  '../../bin/unjucks.cjs component ProductCard --props "title,price,image" --to ./react',
  'Generate React component with specified props'
);

// Test 3: API Route Generation
runTest(
  'Express API Route',
  '../../bin/unjucks.cjs api users --methods "GET,POST,PUT,DELETE" --to ./express',
  'Generate Express API routes with CRUD operations'
);

// Test 4: Database Model
runTest(
  'Sequelize Model',
  '../../bin/unjucks.cjs model User --fields "name:string,email:string,age:number" --to ./sequelize',
  'Generate Sequelize model with fields'
);

// Test 5: CLI Command
runTest(
  'CLI Command Generation',
  '../../bin/unjucks.cjs cli deploy --args "environment,region" --to ./cli',
  'Generate CLI command template'
);

// Test 6: Service Layer
runTest(
  'Service Generation',
  '../../bin/unjucks.cjs service UserService --methods "create,read,update,delete" --to ./services',
  'Generate service layer with CRUD methods'
);

// Test 7: Database Schema
runTest(
  'Database Schema',
  '../../bin/unjucks.cjs database UserSchema --tables "users,profiles,permissions" --to ./database',
  'Generate database schema with multiple tables'
);

// Test 8: Performance Test Template
runTest(
  'Performance Benchmark',
  '../../bin/unjucks.cjs benchmark APITest --endpoints "users,posts,comments" --to ./benchmarks',
  'Generate performance benchmark template'
);

// Generate final report
const endTime = new Date();
const duration = endTime - testResults.startTime;

const report = {
  ...testResults,
  endTime,
  totalDuration: duration,
  successRate: ((testResults.passedTests / testResults.totalTests) * 100).toFixed(2)
};

console.log('\n=== FINAL TEST RESULTS ===');
console.log(`Total Tests: ${report.totalTests}`);
console.log(`Passed: ${report.passedTests}`);
console.log(`Failed: ${report.failedTests}`);
console.log(`Success Rate: ${report.successRate}%`);
console.log(`Total Duration: ${duration}ms`);

// Save detailed results
fs.writeFileSync('./comprehensive-test-results.json', JSON.stringify(report, null, 2));
console.log('\n📊 Detailed results saved to comprehensive-test-results.json');

// Create summary for memory storage
const memorySummary = {
  testSuite: 'Template Generation Comprehensive Test',
  timestamp: new Date().toISOString(),
  totalTests: report.totalTests,
  passedTests: report.passedTests,
  failedTests: report.failedTests,
  successRate: report.successRate + '%',
  duration: duration + 'ms',
  key_findings: [
    `${report.passedTests}/${report.totalTests} templates generated successfully`,
    `Success rate: ${report.successRate}%`,
    'React components: ' + (report.results.filter(r => r.name.includes('React')).length > 0 ? 'TESTED' : 'MISSING'),
    'API routes: ' + (report.results.filter(r => r.name.includes('API')).length > 0 ? 'TESTED' : 'MISSING'),
    'Database models: ' + (report.results.filter(r => r.name.includes('Model')).length > 0 ? 'TESTED' : 'MISSING')
  ],
  recommendations: report.failedTests > 0 ? 
    ['Investigate failed template generations', 'Check template syntax and dependencies'] :
    ['All templates generated successfully', 'Template system is robust']
};

console.log('\n🧠 Memory Summary Created');
console.log(JSON.stringify(memorySummary, null, 2));

process.exit(report.failedTests > 0 ? 1 : 0);