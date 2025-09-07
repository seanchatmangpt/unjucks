#!/usr/bin/env node

/**
 * Test script to verify the CLI command structure and help outputs
 * This tests our newly implemented commands without requiring full TypeScript compilation
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const srcDir = join(__dirname, '..', 'src');

console.log('🧪 Testing CLI Command Structure');
console.log('=' .repeat(50));

/**
 * Test command file structure
 */
async function testCommandStructure(commandName) {
  try {
    const filePath = join(srcDir, 'commands', `${commandName}.ts`);
    const content = await readFile(filePath, 'utf-8');
    
    console.log(`\n📁 Testing ${commandName}.ts`);
    console.log('-'.repeat(30));
    
    // Check for essential patterns
    const checks = {
      'Has defineCommand import': content.includes('import { defineCommand'),
      'Has citty command structure': content.includes('defineCommand({'),
      'Has meta description': content.includes('meta:') && content.includes('description:'),
      'Has run function': content.includes('run(') || content.includes('async run('),
      'Has MCP integration': content.includes('claude-flow') || content.includes('npx'),
      'Has error handling': content.includes('catch') || content.includes('error'),
      'Has chalk coloring': content.includes('chalk.'),
      'Has subCommands': content.includes('subCommands:')
    };
    
    let passedChecks = 0;
    for (const [check, passed] of Object.entries(checks)) {
      const status = passed ? '✅' : '❌';
      console.log(`${status} ${check}`);
      if (passed) passedChecks++;
    }
    
    // Extract command description from meta
    const metaMatch = content.match(/description:\s*["']([^"']+)["']/);
    const description = metaMatch ? metaMatch[1] : 'No description found';
    console.log(`📝 Description: ${description}`);
    
    // Count subcommands
    const subCommandsMatch = content.match(/subCommands:\s*{([^}]*)}/s);
    if (subCommandsMatch) {
      const subCommandCount = (subCommandsMatch[1].match(/\w+:/g) || []).length;
      console.log(`🔧 Subcommands: ${subCommandCount}`);
    }
    
    // Extract MCP tool patterns
    const mcpMatches = content.match(/mcp__[\w-]+__[\w-]+/g);
    if (mcpMatches) {
      const uniqueMcpTools = [...new Set(mcpMatches)];
      console.log(`🔗 MCP Tools: ${uniqueMcpTools.length} (${uniqueMcpTools.slice(0, 3).join(', ')}${uniqueMcpTools.length > 3 ? '...' : ''})`);
    }
    
    console.log(`📊 Structure Score: ${passedChecks}/${Object.keys(checks).length}`);
    
    return {
      name: commandName,
      score: passedChecks,
      maxScore: Object.keys(checks).length,
      description,
      mcpToolCount: mcpMatches ? [...new Set(mcpMatches)].length : 0
    };
    
  } catch (error) {
    console.log(`❌ Error reading ${commandName}.ts: ${error.message}`);
    return { name: commandName, score: 0, maxScore: 8, error: error.message };
  }
}

/**
 * Test CLI registration
 */
async function testCLIRegistration() {
  try {
    console.log(`\n📁 Testing cli.ts registration`);
    console.log('-'.repeat(30));
    
    const cliPath = join(srcDir, 'cli.ts');
    const cliContent = await readFile(cliPath, 'utf-8');
    
    const commands = ['swarm', 'workflow', 'github', 'knowledge'];
    const registrationResults = {};
    
    for (const cmd of commands) {
      const imported = cliContent.includes(`${cmd}Command`);
      const registered = cliContent.includes(`${cmd}: ${cmd}Command`);
      const inHelp = cliContent.includes(cmd) && cliContent.includes('chalk.gray');
      
      registrationResults[cmd] = {
        imported,
        registered, 
        inHelp,
        status: imported && registered ? '✅' : '❌'
      };
      
      console.log(`${registrationResults[cmd].status} ${cmd}: imported(${imported}) registered(${registered}) help(${inHelp})`);
    }
    
    return registrationResults;
    
  } catch (error) {
    console.log(`❌ Error reading cli.ts: ${error.message}`);
    return { error: error.message };
  }
}

/**
 * Main test runner
 */
async function runTests() {
  const commandsToTest = ['swarm', 'workflow', 'github', 'knowledge'];
  const results = [];
  
  console.log('🎯 Testing Command Structure...');
  
  for (const cmd of commandsToTest) {
    const result = await testCommandStructure(cmd);
    results.push(result);
  }
  
  console.log('\n🎯 Testing CLI Registration...');
  const registrationResult = await testCLIRegistration();
  
  // Summary
  console.log(`\n${'📊 SUMMARY'.padEnd(50, '=')}`);
  console.log(`Commands tested: ${results.length}`);
  
  const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
  console.log(`Average structure score: ${avgScore.toFixed(1)}/8`);
  
  const totalMcpTools = results.reduce((sum, r) => sum + (r.mcpToolCount || 0), 0);
  console.log(`Total MCP tools integrated: ${totalMcpTools}`);
  
  console.log('\n📋 Command Details:');
  results.forEach(result => {
    const percentage = Math.round((result.score / result.maxScore) * 100);
    console.log(`• ${result.name}: ${percentage}% complete, ${result.mcpToolCount || 0} MCP tools`);
    if (result.description && result.description !== 'No description found') {
      console.log(`  └─ ${result.description.substring(0, 60)}${result.description.length > 60 ? '...' : ''}`);
    }
  });
  
  console.log('\n🎉 CLI Command Structure Test Complete');
}

// Run tests
runTests().catch(console.error);