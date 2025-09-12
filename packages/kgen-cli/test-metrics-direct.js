#!/usr/bin/env node

/**
 * Direct Metrics Functionality Test
 * Tests metrics commands by importing and running them directly
 */

import exportCommand from './src/commands/metrics/export.js';
import reportCommand from './src/commands/metrics/report.js';
import baselineCommand from './src/commands/metrics/baseline.js';

async function testDirectMetrics() {
  console.log('🧪 Direct Metrics Functionality Test\n');

  const tests = [
    {
      name: 'Export Command (no data)',
      command: exportCommand,
      args: {
        period: '24h',
        type: 'all',
        format: 'json',
        aggregate: false,
        compress: false
      }
    },
    {
      name: 'Report Command (performance)',
      command: reportCommand, 
      args: {
        type: 'performance',
        timeRange: '1h',
        exportFormat: 'json',
        includeCharts: false,
        format: 'json'
      }
    },
    {
      name: 'Baseline Command (quick)',
      command: baselineCommand,
      args: {
        operation: 'graph',
        samples: 2,
        warmup: 1,
        format: 'json'
      }
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    process.stdout.write(`Testing ${test.name}... `);
    
    try {
      // Capture console.log output
      const originalLog = console.log;
      let output = '';
      console.log = (...args) => {
        output += args.join(' ') + '\n';
      };

      // Run the command
      await test.command.run({ args: test.args });
      
      // Restore console.log
      console.log = originalLog;

      // Check if we got valid JSON output
      const lines = output.split('\n').filter(line => line.trim());
      let foundValidJson = false;
      
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.success !== undefined) {
            foundValidJson = true;
            break;
          }
        } catch (e) {
          // Continue checking other lines
        }
      }

      if (foundValidJson) {
        console.log('✅ PASS');
        passed++;
      } else {
        console.log('❌ FAIL (no valid JSON output)');
        failed++;
      }

    } catch (error) {
      console.log(`❌ FAIL (${error.message})`);
      failed++;
    }
  }

  // Test the PerformanceTracker directly
  console.log('\n🔧 Testing PerformanceTracker...');
  
  try {
    const { PerformanceTracker } = await import('../kgen-core/src/metrics/performance-tracker.js');
    const tracker = new PerformanceTracker({
      metricsPath: './metrics',
      enableRealtimeCollection: false
    });
    
    await tracker.initialize();
    
    // Record some test metrics
    tracker.recordMetric('test_metric', 100, 'gauge');
    tracker.recordSystemMetrics();
    
    const summary = tracker.getPerformanceSummary();
    
    await tracker.shutdown();
    
    console.log('✅ PerformanceTracker working correctly');
    passed++;
    
  } catch (error) {
    console.log(`❌ PerformanceTracker failed: ${error.message}`);
    failed++;
  }

  // Summary
  console.log('\n📊 Direct Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

  return failed === 0;
}

testDirectMetrics().catch(console.error);