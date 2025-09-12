#!/usr/bin/env node

/**
 * Standalone Metrics System Test
 * Tests all three metrics commands independently
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

// Colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

const log = (color, message) => console.log(`${colors[color]}${message}${colors.reset}`);

async function testMetricsSystem() {
  log('blue', '🧪 KGEN Metrics System Test\n');

  const tests = [
    {
      name: 'Metrics Export (no data)',
      command: 'node bin/kgen.js metrics export --format json',
      expectSuccess: true,
      checkOutput: (output) => {
        const parsed = JSON.parse(output);
        return parsed.success === true;
      }
    },
    {
      name: 'Metrics Report (performance)',
      command: 'node bin/kgen.js metrics report --type performance --timeRange 1h',
      expectSuccess: true,
      checkOutput: (output) => {
        const parsed = JSON.parse(output);
        return parsed.success === true && parsed.data.report;
      }
    },
    {
      name: 'Metrics Baseline (quick)',
      command: 'node bin/kgen.js metrics baseline --samples 2 --warmup 1 --operation graph',
      expectSuccess: true,
      timeout: 15000,
      checkOutput: (output) => {
        const parsed = JSON.parse(output);
        return parsed.success === true && parsed.data.baseline;
      }
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    process.stdout.write(`Testing: ${test.name}... `);
    
    try {
      const result = execSync(test.command, {
        encoding: 'utf8',
        timeout: test.timeout || 10000,
        stdio: 'pipe'
      });

      // Extract JSON from output (might have multiple JSON objects)
      const lines = result.split('\n').filter(line => line.trim());
      let testPassed = false;

      for (const line of lines) {
        try {
          if (line.startsWith('{')) {
            const parsed = JSON.parse(line);
            if (test.checkOutput && test.checkOutput(line)) {
              testPassed = true;
              break;
            } else if (!test.checkOutput && parsed.success) {
              testPassed = true;
              break;
            }
          }
        } catch (e) {
          // Continue checking other lines
        }
      }

      if (testPassed === test.expectSuccess) {
        log('green', '✅ PASS');
        passed++;
      } else {
        log('red', '❌ FAIL (unexpected result)');
        failed++;
      }

    } catch (error) {
      if (test.expectSuccess) {
        log('red', `❌ FAIL (${error.message.split('\n')[0]})`);
        failed++;
      } else {
        log('green', '✅ PASS (expected failure)');
        passed++;
      }
    }
  }

  // Test file system state
  console.log('\n📁 File System Checks:');
  
  const stateDir = '.kgen/state';
  const exportsDir = 'exports';
  
  if (existsSync(stateDir)) {
    log('green', `✅ State directory exists: ${stateDir}`);
    
    if (existsSync(join(stateDir, 'baseline.json'))) {
      try {
        const baseline = JSON.parse(readFileSync(join(stateDir, 'baseline.json'), 'utf8'));
        log('green', `✅ Baseline file valid (${baseline.baselines ? Object.keys(baseline.baselines).length : 0} operations)`);
      } catch (e) {
        log('red', '❌ Baseline file corrupted');
      }
    } else {
      log('yellow', '⚠️ No baseline file found');
    }
  } else {
    log('yellow', '⚠️ State directory missing');
  }

  if (existsSync(exportsDir)) {
    const exports = execSync(`ls -la ${exportsDir} | wc -l`, { encoding: 'utf8' }).trim();
    log('green', `✅ Exports directory exists (${exports} items)`);
  } else {
    log('yellow', '⚠️ Exports directory missing');
  }

  // Summary
  console.log('\n📊 Test Summary:');
  log('green', `✅ Passed: ${passed}`);
  log('red', `❌ Failed: ${failed}`);
  log('blue', `📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

  if (failed === 0) {
    log('green', '\n🎉 All metrics functionality working correctly!');
    return true;
  } else {
    log('red', '\n💥 Some metrics functionality needs attention.');
    return false;
  }
}

// Run tests
testMetricsSystem().catch(console.error);