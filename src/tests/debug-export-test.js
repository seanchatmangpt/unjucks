#!/usr/bin/env node

/**
 * Debug Export Issues - Detailed Analysis
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

async function debugExportIssue() {
  console.log('🔍 Debugging Export Issues...\n');
  
  const testFile = '/Users/sac/unjucks/temp/simple-test.md';
  
  // Check file accessibility
  console.log('📁 File System Check:');
  try {
    const stats = await fs.stat(testFile);
    console.log(`✅ File exists: ${testFile}`);
    console.log(`📏 File size: ${stats.size} bytes`);
    
    const content = await fs.readFile(testFile, 'utf8');
    console.log(`📝 Content length: ${content.length} characters`);
    console.log('📄 First 100 chars:', JSON.stringify(content.substring(0, 100)));
    
    // Test file reading from the CLI command's perspective
    console.log('\n🔧 CLI Path Testing:');
    
    // Test absolute path
    console.log('Testing with absolute path...');
    try {
      const result = execSync(`./bin/unjucks.cjs export-docx "${testFile}" --output "/Users/sac/unjucks/output/debug-test" --verbose --dry-run`, { 
        cwd: '/Users/sac/unjucks',
        encoding: 'utf8',
        stdio: 'pipe'
      });
      console.log('✅ Absolute path result:', result.split('\n').slice(0, 5).join('\n'));
    } catch (error) {
      console.log('❌ Absolute path failed:', error.message.split('\n')[0]);
    }
    
    // Test relative path
    console.log('\nTesting with relative path...');
    try {
      const result = execSync(`./bin/unjucks.cjs export-docx temp/simple-test.md --output output/debug-test --verbose --dry-run`, { 
        cwd: '/Users/sac/unjucks',
        encoding: 'utf8',
        stdio: 'pipe'
      });
      console.log('✅ Relative path result:', result.split('\n').slice(0, 5).join('\n'));
    } catch (error) {
      console.log('❌ Relative path failed:', error.message.split('\n')[0]);
    }
    
  } catch (error) {
    console.log(`❌ File access error: ${error.message}`);
  }
  
  // Check directory structure
  console.log('\n📂 Directory Structure:');
  const currentDir = process.cwd();
  console.log(`Current working directory: ${currentDir}`);
  
  try {
    const tempFiles = await fs.readdir('/Users/sac/unjucks/temp');
    console.log('temp/ files:', tempFiles.filter(f => f.endsWith('.md')));
  } catch (error) {
    console.log('❌ Could not read temp directory:', error.message);
  }
}

debugExportIssue().catch(console.error);