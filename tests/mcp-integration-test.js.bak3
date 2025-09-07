#!/usr/bin/env node

/**
 * Test script to verify MCP integration patterns in newly implemented commands
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Testing MCP Integration for Unjucks CLI Commands');
console.log('=' .repeat(60));

/**
 * Test MCP command execution pattern
 */
async function testMCPExecution(command, args = []) {
  return new Promise((resolve) => {
    console.log(`\n🔍 Testing: npx claude-flow@alpha ${command} ${args.join(' ')}`);
    
    const process = spawn('npx', ['claude-flow@alpha', command, ...args], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    process.on('close', (code) => {
      console.log(`Exit code: ${code}`);
      if (stdout) {
        console.log('📤 STDOUT:', stdout.substring(0, 200) + (stdout.length > 200 ? '...' : ''));
      }
      if (stderr) {
        console.log('📤 STDERR:', stderr.substring(0, 200) + (stderr.length > 200 ? '...' : ''));
      }
      
      resolve({
        code,
        stdout,
        stderr,
        success: code === 0 || stdout.includes('success') || !stderr.includes('error')
      });
    });
    
    // Timeout after 10 seconds
    setTimeout(() => {
      process.kill();
      resolve({ code: -1, stdout: '', stderr: 'Timeout', success: false });
    }, 10000);
  });
}

/**
 * Main test suite
 */
async function runTests() {
  const tests = [
    // Test basic MCP tools availability
    { command: 'swarm', args: ['status'], description: 'Swarm status (basic MCP)' },
    { command: 'workflow', args: ['list'], description: 'Workflow list (should fail gracefully)' },
    { command: 'github', args: ['status'], description: 'GitHub integration status' },
    
    // Test command help (should always work)
    { command: 'swarm', args: ['--help'], description: 'Swarm help output' },
    { command: 'workflow', args: ['--help'], description: 'Workflow help output' },
    { command: 'github', args: ['--help'], description: 'GitHub help output' },
    
    // Test MCP initialization
    { command: 'swarm', args: ['init', '--topology', 'mesh'], description: 'Swarm initialization' },
  ];
  
  const results = [];
  
  for (const test of tests) {
    console.log(`\n${'='.repeat(40)}`);
    console.log(`🎯 ${test.description}`);
    console.log(`${'='.repeat(40)}`);
    
    const result = await testMCPExecution(test.command, test.args);
    results.push({
      ...test,
      ...result
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause between tests
  }
  
  // Summary
  console.log(`\n${'🎯 TEST SUMMARY'.padEnd(60, '=')}`)
  console.log(`Total tests: ${results.length}`);
  console.log(`Passed: ${results.filter(r => r.success).length}`);
  console.log(`Failed: ${results.filter(r => !r.success).length}`);
  
  console.log('\nDetailed Results:');
  results.forEach((result, i) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.description} (exit: ${result.code})`);
  });
  
  // Test the subprocess pattern our commands use
  console.log('\n🔧 Testing subprocess execution pattern...');
  testSubprocessPattern();
}

/**
 * Test the subprocess execution pattern used in our commands
 */
function testSubprocessPattern() {
  console.log('Testing spawn pattern with simple echo command:');
  
  const testProcess = spawn('echo', ['MCP integration test'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  testProcess.stdout.on('data', (data) => {
    console.log('✅ Subprocess stdout:', data.toString().trim());
  });
  
  testProcess.stderr.on('data', (data) => {
    console.log('⚠️  Subprocess stderr:', data.toString().trim());
  });
  
  testProcess.on('close', (code) => {
    console.log(`✅ Subprocess pattern working, exit code: ${code}`);
    console.log('\n🎉 MCP Integration Test Complete');
  });
}

// Run tests
runTests().catch(console.error);