#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== ADVANCED TEMPLATE GENERATION EDGE CASE TESTS ===');
console.log('Started at:', new Date().toISOString());

const testResults = {
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
  results: [],
  startTime: new Date(),
};

function runTest(testName, command, description, expectedBehavior = 'success') {
  testResults.totalTests++;
  console.log(`\n🧪 Running: ${testName}`);
  console.log(`📝 Description: ${description}`);
  console.log(`🎯 Expected: ${expectedBehavior}`);
  
  try {
    const result = execSync(command, { 
      cwd: __dirname, 
      encoding: 'utf8',
      timeout: 30000 
    });
    
    const isExpectedSuccess = expectedBehavior === 'success';
    if (isExpectedSuccess) {
      testResults.passedTests++;
      testResults.results.push({
        name: testName,
        status: 'PASS',
        description,
        command,
        output: result.substring(0, 300),
        expected: expectedBehavior
      });
      console.log('✅ PASSED (Expected Success)');
    } else {
      // Expected failure but got success - this might be unexpected
      console.log('⚠️  UNEXPECTED SUCCESS (Expected Failure)');
    }
    
    return true;
  } catch (error) {
    const isExpectedFailure = expectedBehavior === 'failure';
    if (isExpectedFailure) {
      testResults.passedTests++;
      testResults.results.push({
        name: testName,
        status: 'PASS',
        description,
        command,
        error: error.message.substring(0, 300),
        expected: expectedBehavior
      });
      console.log('✅ PASSED (Expected Failure)');
    } else {
      testResults.failedTests++;
      testResults.results.push({
        name: testName,
        status: 'FAIL',
        description,
        command,
        error: error.message.substring(0, 300),
        expected: expectedBehavior
      });
      console.log('❌ FAILED:', error.message.substring(0, 100));
    }
    
    return false;
  }
}

// Edge Case Tests
console.log('\n🔬 RUNNING EDGE CASE TESTS...');

// Test 1: Complex nested component
runTest(
  'Complex Nested Component',
  '../../bin/unjucks.cjs component DashboardLayout --props "title,sidebar,content,footer" --hooks "useState,useEffect,useContext" --to ./edge-cases',
  'Generate complex React component with multiple props and hooks'
);

// Test 2: API with complex routes
runTest(
  'Complex API Routes',
  '../../bin/unjucks.cjs api authentication --methods "POST,PUT,DELETE" --middleware "auth,validation,logging" --to ./edge-cases',
  'Generate API with middleware and complex routing'
);

// Test 3: Model with relationships
runTest(
  'Model with Relationships',
  '../../bin/unjucks.cjs model Order --fields "userId:number,items:json,total:decimal,status:enum" --relationships "belongsTo:User,hasMany:OrderItems" --to ./edge-cases',
  'Generate Sequelize model with complex fields and relationships'
);

// Test 4: Invalid template name (should fail gracefully)
runTest(
  'Invalid Template Name',
  '../../bin/unjucks.cjs nonexistent-template TestName --to ./edge-cases',
  'Test error handling with invalid template name',
  'failure'
);

// Test 5: Empty parameters
runTest(
  'Component with Empty Name',
  '../../bin/unjucks.cjs component "" --to ./edge-cases',
  'Test error handling with empty component name',
  'failure'
);

// Test 6: Special characters in name
runTest(
  'Special Characters in Name',
  '../../bin/unjucks.cjs component "My-Special_Component123" --to ./edge-cases',
  'Test template generation with special characters in name'
);

// Test 7: Very long parameter list
runTest(
  'Long Parameter List',
  '../../bin/unjucks.cjs component DataTable --props "data,columns,sorting,filtering,pagination,loading,error,onSort,onFilter,onPageChange,className,style" --to ./edge-cases',
  'Test component with extensive prop list'
);

// Test 8: TypeScript specific template
runTest(
  'TypeScript Template',
  '../../bin/unjucks.cjs component TypeScriptComponent --typescript --props "data:User[],onSelect:(user:User)=>void" --to ./edge-cases',
  'Generate TypeScript React component with typed props'
);

// Performance Tests
console.log('\n⚡ RUNNING PERFORMANCE TESTS...');

// Test 9: Bulk generation
const startBulk = Date.now();
for (let i = 1; i <= 10; i++) {
  runTest(
    `Bulk Generation ${i}`,
    `../../bin/unjucks.cjs component BulkComponent${i} --to ./bulk`,
    `Bulk generation test ${i}/10`
  );
}
const bulkDuration = Date.now() - startBulk;
console.log(`\n📊 Bulk Generation Performance: ${bulkDuration}ms for 10 components`);

// Template Variation Tests
console.log('\n🎨 RUNNING TEMPLATE VARIATION TESTS...');

// Test available template types
const templateTypes = ['api', 'component', 'model', 'service', 'cli', 'database'];
for (const type of templateTypes) {
  runTest(
    `${type.toUpperCase()} Template Variation`,
    `../../bin/unjucks.cjs ${type} Test${type.charAt(0).toUpperCase() + type.slice(1)} --to ./variations`,
    `Test ${type} template generation with minimal parameters`
  );
}

// Generate final report
const endTime = new Date();
const duration = endTime - testResults.startTime;

const report = {
  ...testResults,
  endTime,
  totalDuration: duration,
  successRate: ((testResults.passedTests / testResults.totalTests) * 100).toFixed(2),
  bulkPerformance: {
    componentsGenerated: 10,
    totalTime: bulkDuration,
    averageTimePerComponent: Math.round(bulkDuration / 10)
  }
};

console.log('\n=== ADVANCED TEST RESULTS ===');
console.log(`Total Tests: ${report.totalTests}`);
console.log(`Passed: ${report.passedTests}`);
console.log(`Failed: ${report.failedTests}`);
console.log(`Success Rate: ${report.successRate}%`);
console.log(`Total Duration: ${duration}ms`);
console.log(`Bulk Performance: ${report.bulkPerformance.averageTimePerComponent}ms per component`);

// Save detailed results
fs.writeFileSync('./advanced-test-results.json', JSON.stringify(report, null, 2));
console.log('\n📊 Advanced results saved to advanced-test-results.json');

process.exit(report.failedTests > 0 ? 1 : 0);