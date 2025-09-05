/**
 * Manual CLI validation test - runs independently without complex test framework setup
 * This ensures the CLI is working and ready for BDD testing
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as path from 'node:path';

const execAsync = promisify(exec);
const cliPath = path.join(process.cwd(), 'dist/cli.mjs');

async function runTest(name: string, testFn: () => Promise<void>) {
  try {
    await testFn();
    console.log(`✅ ${name}`);
    return true;
  } catch (error) {
    console.error(`❌ ${name}: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Running CLI Smoke Tests...\n');
  
  const results = [];
  
  // Test 1: CLI file exists
  results.push(await runTest('CLI file exists', async () => {
    const fs = await import('fs');
    if (!fs.existsSync(cliPath)) {
      throw new Error(`CLI file not found at ${cliPath}`);
    }
  }));
  
  // Test 2: Version command
  results.push(await runTest('Version command works', async () => {
    const { stdout, stderr } = await execAsync(`node "${cliPath}" --version`);
    if (stderr) throw new Error(`Stderr: ${stderr}`);
    if (stdout.trim() !== '0.0.0') throw new Error(`Unexpected version: ${stdout.trim()}`);
  }));
  
  // Test 3: Help command
  results.push(await runTest('Help command works', async () => {
    const { stdout, stderr } = await execAsync(`node "${cliPath}" --help`);
    if (stderr) throw new Error(`Stderr: ${stderr}`);
    if (!stdout.includes('A Hygen-style CLI generator')) throw new Error('Help text missing');
    if (!stdout.includes('generate')) throw new Error('Generate command not listed');
  }));
  
  // Test 4: List command
  results.push(await runTest('List command works', async () => {
    const { stdout } = await execAsync(`node "${cliPath}" list`);
    // Should complete without crashing - output content doesn't matter for this test
    if (typeof stdout !== 'string') throw new Error('No stdout');
  }));
  
  // Test 5: Generate help
  results.push(await runTest('Generate help works', async () => {
    try {
      const { stdout } = await execAsync(`node "${cliPath}" generate --help`);
      if (!stdout.includes('generate')) throw new Error('Generate help missing');
    } catch (error: any) {
      // Might exit with non-zero but should still show help in stdout
      if (!error.stdout || !error.stdout.includes('generate')) {
        throw new Error('Generate help not working');
      }
    }
  }));
  
  const passed = results.filter(Boolean).length;
  const total = results.length;
  
  console.log(`\n📊 Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All CLI smoke tests passed! The CLI is ready for BDD testing.');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed. CLI needs attention before BDD testing.');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('💥 Test runner failed:', error);
  process.exit(1);
});