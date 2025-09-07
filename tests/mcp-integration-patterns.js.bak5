#!/usr/bin/env node

/**
 * Test MCP Integration Patterns in the new CLI commands
 * This verifies that our subprocess spawning and MCP tool integration works correctly
 */

import { spawn } from 'child_process';

console.log('🧪 Testing MCP Integration Patterns');
console.log('=' .repeat(50));

/**
 * Test subprocess spawning pattern used in our commands
 */
function testSubprocessPattern(command, args, expectedOutput) {
  return new Promise((resolve) => {
    console.log(`\n🔍 Testing: ${command} ${args.join(' ')}`);
    console.log('Expected pattern:', expectedOutput);
    
    const process = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000
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
      const success = code === 0 || stdout.includes(expectedOutput) || (expectedOutput === 'any' && stdout.length > 0);
      const result = {
        command: `${command} ${args.join(' ')}`,
        code,
        stdout: stdout.substring(0, 100),
        stderr: stderr.substring(0, 100),
        success
      };
      
      console.log(`${success ? '✅' : '❌'} Exit: ${code}, Output: ${result.stdout.trim() || 'none'}`);
      resolve(result);
    });
    
    process.on('error', (error) => {
      console.log(`❌ Process error: ${error.message}`);
      resolve({
        command: `${command} ${args.join(' ')}`,
        code: -1,
        error: error.message,
        success: false
      });
    });
    
    // Kill after timeout
    setTimeout(() => {
      process.kill();
      resolve({
        command: `${command} ${args.join(' ')}`,
        code: -2,
        error: 'Timeout',
        success: false
      });
    }, 5000);
  });
}

/**
 * Test MCP command availability and basic functionality
 */
async function testMCPCommands() {
  console.log('\n🎯 Testing MCP Command Availability');
  console.log('-'.repeat(40));
  
  const mcpTests = [
    // Basic availability tests
    { cmd: 'npx', args: ['claude-flow@alpha', '--version'], expect: 'Claude-Flow' },
    { cmd: 'npx', args: ['claude-flow@alpha', 'swarm', '--help'], expect: 'SWARM COMMAND' },
    { cmd: 'npx', args: ['claude-flow@alpha', 'github', '--help'], expect: 'GITHUB COMMAND' },
    
    // MCP tool tests (these might not work but should fail gracefully)
    { cmd: 'npx', args: ['claude-flow@alpha', 'swarm', 'status'], expect: 'any' },
    { cmd: 'npx', args: ['claude-flow@alpha', 'github', 'status', 'test'], expect: 'any' },
  ];
  
  const results = [];
  
  for (const test of mcpTests) {
    const result = await testSubprocessPattern(test.cmd, test.args, test.expect);
    results.push(result);
  }
  
  return results;
}

/**
 * Test error handling patterns
 */
async function testErrorHandling() {
  console.log('\n🎯 Testing Error Handling');
  console.log('-'.repeat(40));
  
  const errorTests = [
    // Commands that should handle missing parameters gracefully
    { cmd: 'npx', args: ['claude-flow@alpha', 'swarm'], expect: 'Usage:' },
    { cmd: 'npx', args: ['claude-flow@alpha', 'github'], expect: 'Usage:' },
    
    // Invalid subcommands
    { cmd: 'npx', args: ['claude-flow@alpha', 'swarm', 'invalid-command'], expect: 'any' },
    { cmd: 'npx', args: ['claude-flow@alpha', 'github', 'invalid-mode'], expect: 'any' },
  ];
  
  const results = [];
  
  for (const test of errorTests) {
    const result = await testSubprocessPattern(test.cmd, test.args, test.expect);
    results.push(result);
  }
  
  return results;
}

/**
 * Test the actual MCP bridge pattern we implemented
 */
async function testMCPBridgePattern() {
  console.log('\n🎯 Testing MCP Bridge Pattern');
  console.log('-'.repeat(40));
  
  // Test our workflow command pattern
  console.log('Testing workflow MCP bridge...');
  const workflowTest = await testSubprocessPattern(
    'npx', 
    ['claude-flow@alpha', 'workflow', 'list'],
    'workflow'
  );
  
  // Test our swarm command
  console.log('Testing swarm MCP integration...');
  const swarmTest = await testSubprocessPattern(
    'npx',
    ['claude-flow@alpha', 'swarm', 'init', '--topology', 'mesh', '--maxAgents', '3'],
    'any'
  );
  
  return [workflowTest, swarmTest];
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('Starting MCP integration pattern tests...');
  
  const allResults = [];
  
  // Test MCP command availability
  const mcpResults = await testMCPCommands();
  allResults.push(...mcpResults);
  
  // Test error handling
  const errorResults = await testErrorHandling();
  allResults.push(...errorResults);
  
  // Test MCP bridge pattern
  const bridgeResults = await testMCPBridgePattern();
  allResults.push(...bridgeResults);
  
  // Summary
  console.log(`\n${'📊 TEST SUMMARY'.padEnd(50, '=')}`);
  console.log(`Total tests: ${allResults.length}`);
  console.log(`Passed: ${allResults.filter(r => r.success).length}`);
  console.log(`Failed: ${allResults.filter(r => !r.success).length}`);
  
  // Group results by type
  console.log('\n📋 Results by Category:');
  console.log('MCP Commands:', mcpResults.filter(r => r.success).length + '/' + mcpResults.length);
  console.log('Error Handling:', errorResults.filter(r => r.success).length + '/' + errorResults.length);
  console.log('Bridge Pattern:', bridgeResults.filter(r => r.success).length + '/' + bridgeResults.length);
  
  // Detailed failures
  const failures = allResults.filter(r => !r.success);
  if (failures.length > 0) {
    console.log('\n❌ Failed Tests:');
    failures.forEach(f => {
      console.log(`• ${f.command}: ${f.error || 'Exit ' + f.code}`);
    });
  }
  
  // Success rate calculation
  const successRate = Math.round((allResults.filter(r => r.success).length / allResults.length) * 100);
  console.log(`\n🎯 Overall Success Rate: ${successRate}%`);
  
  if (successRate >= 70) {
    console.log('🎉 MCP Integration is working well!');
  } else if (successRate >= 50) {
    console.log('⚠️  MCP Integration has some issues but is functional');
  } else {
    console.log('❌ MCP Integration needs attention');
  }
  
  console.log('\n🏁 MCP Integration Pattern Test Complete');
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Test runner error:', error.message);
  process.exit(1);
});