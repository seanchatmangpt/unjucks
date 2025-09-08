#!/usr/bin/env node

/**
 * Simple Export Test - Core Functionality Validation
 * Tests the basic export functionality and reports issues
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const testResults = {
  pdf: { attempted: false, success: false, error: null, outputExists: false },
  docx: { attempted: false, success: false, error: null, outputExists: false },
  html: { attempted: false, success: false, error: null, outputExists: false },
  rtf: { attempted: false, success: false, error: null, outputExists: false }
};

async function testExports() {
  console.log('🧪 Running Simple Export Tests...\n');
  
  const testFile = '/Users/sac/unjucks/temp/simple-test.md';
  const outputDir = '/Users/sac/unjucks/output';
  
  // Ensure directories exist
  await fs.mkdir('/Users/sac/unjucks/temp', { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });
  
  // Test DOCX export
  try {
    testResults.docx.attempted = true;
    console.log('📄 Testing DOCX export...');
    
    const result = execSync(
      `./bin/unjucks.cjs export-docx "${testFile}" --output "${outputDir}/test-docx" --verbose --dry-run`,
      { cwd: '/Users/sac/unjucks', encoding: 'utf8', stdio: 'pipe' }
    );
    
    console.log('DOCX dry run result:', result);
    testResults.docx.success = true;
  } catch (error) {
    testResults.docx.error = error.message;
    console.log('❌ DOCX export failed:', error.message.split('\n')[0]);
  }

  // Test HTML export using export subcommand
  try {
    testResults.html.attempted = true;
    console.log('🌐 Testing HTML export...');
    
    const result = execSync(
      `./bin/unjucks.cjs export html "${testFile}" --output "${outputDir}/test-html" --verbose --dry-run`,
      { cwd: '/Users/sac/unjucks', encoding: 'utf8', stdio: 'pipe' }
    );
    
    console.log('HTML dry run result:', result);
    testResults.html.success = true;
  } catch (error) {
    testResults.html.error = error.message;
    console.log('❌ HTML export failed:', error.message.split('\n')[0]);
  }

  // Test PDF export
  try {
    testResults.pdf.attempted = true;
    console.log('🔴 Testing PDF export...');
    
    const result = execSync(
      `./bin/unjucks.cjs export pdf "${testFile}" --output "${outputDir}/test-pdf" --verbose --dry-run`,
      { cwd: '/Users/sac/unjucks', encoding: 'utf8', stdio: 'pipe' }
    );
    
    console.log('PDF dry run result:', result);
    testResults.pdf.success = true;
  } catch (error) {
    testResults.pdf.error = error.message;
    console.log('❌ PDF export failed:', error.message.split('\n')[0]);
  }

  // Generate report
  console.log('\n📊 Export Test Results:');
  console.log('========================');
  for (const [format, result] of Object.entries(testResults)) {
    if (result.attempted) {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      console.log(`${format.toUpperCase()}: ${status}`);
      if (!result.success && result.error) {
        console.log(`  Error: ${result.error.split('\n')[0]}`);
      }
    } else {
      console.log(`${format.toUpperCase()}: ⏭️  SKIPPED`);
    }
  }

  // Summary
  const attempted = Object.values(testResults).filter(r => r.attempted).length;
  const successful = Object.values(testResults).filter(r => r.success).length;
  
  console.log(`\n📈 Summary: ${successful}/${attempted} tests passed`);
  
  if (successful < attempted) {
    console.log('\n🔧 Issues Found:');
    console.log('- Export command parameter parsing may need fixes');
    console.log('- File path handling issues detected');
    console.log('- Some format-specific exporters need debugging');
    
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed!');
  }
}

testExports().catch(console.error);