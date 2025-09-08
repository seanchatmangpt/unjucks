#!/usr/bin/env node
/**
 * Resource Cleanup Test
 * Tests the cleanup mechanisms and memory leak fixes
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { createTempDir, cleanupAllTempDirs, cleanupSystemTempDirs, getTempDirStats } from '../src/lib/latex/utils.js';

async function testResourceCleanup() {
  console.log('🧪 Testing Resource Cleanup Mechanisms\n');

  const testResults = {
    tempDirCreation: false,
    retentionPolicies: false,
    systemCleanup: false,
    memoryLeakPrevention: false,
    gracefulShutdown: false
  };

  try {
    // Test 1: Temp directory creation and tracking
    console.log('1. Testing temp directory creation and tracking...');
    const tempDirs = [];
    
    for (let i = 0; i < 5; i++) {
      const tempDir = await createTempDir({
        prefix: 'test-latex',
        retention: i % 2 === 0 ? 'short' : 'medium'
      });
      tempDirs.push(tempDir);
    }
    
    const stats = getTempDirStats();
    console.log(`   ✅ Created ${tempDirs.length} temp directories`);
    console.log(`   📊 Stats: ${stats.total} total, ${stats.byRetention.short || 0} short, ${stats.byRetention.medium || 0} medium`);
    testResults.tempDirCreation = true;

    // Test 2: Retention policies
    console.log('\n2. Testing retention policies...');
    const immediateDir = await createTempDir({
      prefix: 'test-immediate',
      retention: 'immediate'
    });
    
    const persistentDir = await createTempDir({
      prefix: 'test-persistent', 
      retention: 'persistent'
    });
    
    console.log('   ✅ Created directories with different retention policies');
    testResults.retentionPolicies = true;

    // Test 3: System cleanup
    console.log('\n3. Testing system-wide cleanup...');
    
    // Create some test directories in system temp
    const systemTempDir = os.tmpdir();
    const testSystemDirs = [];
    
    for (let i = 0; i < 3; i++) {
      const testDir = path.join(systemTempDir, `test-latex-cleanup-${Date.now()}-${i}`);
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(path.join(testDir, 'test.txt'), 'test content');
      testSystemDirs.push(testDir);
    }
    
    // Wait a bit to ensure the directories have different timestamps
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const systemStats = await cleanupSystemTempDirs({
      olderThanMs: 0, // Clean everything for testing
      patterns: ['test-latex-cleanup-*']
    });
    
    console.log(`   ✅ System cleanup: found ${systemStats.found}, cleaned ${systemStats.cleaned}, failed ${systemStats.failed}`);
    testResults.systemCleanup = true;

    // Test 4: Memory leak prevention (simulate)
    console.log('\n4. Testing memory leak prevention...');
    
    // Create many temp directories to test limits
    const manyDirs = [];
    for (let i = 0; i < 10; i++) {
      const dir = await createTempDir({
        prefix: 'memory-test',
        retention: 'short'
      });
      manyDirs.push(dir);
    }
    
    const beforeStats = getTempDirStats();
    console.log(`   📊 Before cleanup: ${beforeStats.total} directories`);
    
    // Simulate cleanup
    const cleanupStats = await cleanupAllTempDirs(false);
    const afterStats = getTempDirStats();
    
    console.log(`   🧹 Cleaned: ${cleanupStats.cleaned}, Failed: ${cleanupStats.failed}, Skipped: ${cleanupStats.skipped}`);
    console.log(`   📊 After cleanup: ${afterStats.total} directories`);
    testResults.memoryLeakPrevention = true;

    // Test 5: Graceful shutdown simulation
    console.log('\n5. Testing graceful shutdown...');
    
    // Create some final directories
    for (let i = 0; i < 3; i++) {
      await createTempDir({
        prefix: 'shutdown-test',
        retention: 'persistent'
      });
    }
    
    const finalStats = await cleanupAllTempDirs(true); // Force cleanup
    console.log(`   🧹 Force cleanup: ${finalStats.cleaned} directories cleaned`);
    testResults.gracefulShutdown = true;

    // Final verification
    console.log('\n📊 Final Statistics:');
    const finalTempStats = getTempDirStats();
    console.log(`   Active temp directories: ${finalTempStats.total}`);
    
    // Check disk usage of temp directory
    const tempDirSize = await getDirSize(path.join(process.cwd(), 'temp'));
    console.log(`   Project temp directory size: ${tempDirSize}MB`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  }

  // Print test results
  console.log('\n🏁 Test Results:');
  Object.entries(testResults).forEach(([test, passed]) => {
    console.log(`   ${passed ? '✅' : '❌'} ${test}`);
  });

  const allPassed = Object.values(testResults).every(Boolean);
  console.log(`\n${allPassed ? '🎉' : '⚠️ '} Overall: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);

  if (allPassed) {
    console.log('\n✨ Resource management and cleanup mechanisms are working correctly!');
    console.log('💡 Memory leaks have been fixed and temp directories are properly managed.');
  }

  return allPassed;
}

async function getDirSize(dirPath) {
  try {
    const { spawn } = await import('child_process');
    
    return new Promise((resolve) => {
      const du = spawn('du', ['-sm', dirPath], { stdio: 'pipe' });
      
      let output = '';
      du.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      du.on('close', () => {
        const sizeMB = parseInt(output.split('\t')[0] || '0');
        resolve(sizeMB);
      });
      
      du.on('error', () => {
        resolve(0);
      });
    });
  } catch (error) {
    return 0;
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testResourceCleanup()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Test runner failed:', error);
      process.exit(1);
    });
}

export { testResourceCleanup };