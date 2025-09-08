/**
 * Concurrent Export Stress Test
 * Tests concurrent exports and race conditions
 */
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { exportCommand } from '../../src/commands/export.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDir = path.join(__dirname, '../temp/concurrent-export');

async function testConcurrentExports() {
  await fs.ensureDir(testDir);
  
  const testContent = `# Concurrent Export Test ${Date.now()}

This document tests concurrent export operations.

## Content
${'Test line with content to make file larger.\n'.repeat(100)}
`;

  const inputFile = path.join(testDir, 'concurrent-test.md');
  await fs.writeFile(inputFile, testContent);

  console.log('🔄 Testing Concurrent Exports...\n');

  // Test 1: Same file, different outputs
  console.log('Test 1: Same input, different outputs (10 concurrent)');
  const promises1 = [];
  const startTime1 = Date.now();
  
  for (let i = 0; i < 10; i++) {
    promises1.push(
      exportCommand.run({
        args: {
          input: inputFile,
          format: 'html',
          output: path.join(testDir, `concurrent-${i}.html`),
          quiet: true
        }
      })
    );
  }
  
  const results1 = await Promise.allSettled(promises1);
  const duration1 = Date.now() - startTime1;
  
  const successful1 = results1.filter(r => r.status === 'fulfilled' && r.value.success).length;
  const failed1 = results1.filter(r => r.status === 'rejected' || !r.value.success).length;
  
  console.log(`  Duration: ${duration1}ms`);
  console.log(`  Successful: ${successful1}/10`);
  console.log(`  Failed: ${failed1}/10`);
  
  // Test 2: Same file, same output (race condition)
  console.log('\nTest 2: Same input, same output (race condition test)');
  const sameOutputFile = path.join(testDir, 'race-condition.html');
  const promises2 = [];
  const startTime2 = Date.now();
  
  for (let i = 0; i < 5; i++) {
    promises2.push(
      exportCommand.run({
        args: {
          input: inputFile,
          format: 'html',
          output: sameOutputFile,
          quiet: true
        }
      })
    );
  }
  
  const results2 = await Promise.allSettled(promises2);
  const duration2 = Date.now() - startTime2;
  
  const successful2 = results2.filter(r => r.status === 'fulfilled' && r.value.success).length;
  const failed2 = results2.filter(r => r.status === 'rejected' || !r.value.success).length;
  
  console.log(`  Duration: ${duration2}ms`);
  console.log(`  Successful: ${successful2}/5`);
  console.log(`  Failed: ${failed2}/5`);
  
  const outputExists = await fs.pathExists(sameOutputFile);
  console.log(`  Final output exists: ${outputExists ? '✅' : '❌'}`);
  
  // Test 3: Batch concurrent exports
  console.log('\nTest 3: Batch concurrent exports (different formats)');
  const formats = ['html', 'txt', 'md', 'rtf'];
  const promises3 = [];
  const startTime3 = Date.now();
  
  for (let i = 0; i < 20; i++) {
    const format = formats[i % formats.length];
    promises3.push(
      exportCommand.run({
        args: {
          input: inputFile,
          format: format,
          output: path.join(testDir, `batch-${i}.${format}`),
          quiet: true
        }
      })
    );
  }
  
  const results3 = await Promise.allSettled(promises3);
  const duration3 = Date.now() - startTime3;
  
  const successful3 = results3.filter(r => r.status === 'fulfilled' && r.value.success).length;
  const failed3 = results3.filter(r => r.status === 'rejected' || !r.value.success).length;
  
  console.log(`  Duration: ${duration3}ms`);
  console.log(`  Successful: ${successful3}/20`);
  console.log(`  Failed: ${failed3}/20`);
  console.log(`  Average per export: ${Math.round(duration3/20)}ms`);
  
  console.log('\n📊 Concurrent Export Summary:');
  console.log('===============================');
  console.log(`✅ Different outputs: ${successful1}/10 succeeded`);
  console.log(`⚠️  Same output (race): ${successful2}/5 succeeded`);
  console.log(`🚀 Batch mixed formats: ${successful3}/20 succeeded`);
  
  if (successful2 > 1) {
    console.log('⚠️  Multiple processes writing to same file succeeded - potential race condition issues');
  }
  
  if (successful1 === 10 && successful3 >= 18) {
    console.log('✅ Concurrent export handling appears robust');
  } else {
    console.log('❌ Concurrent export handling has issues');
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testConcurrentExports().catch(console.error);
}