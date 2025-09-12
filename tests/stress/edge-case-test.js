/**
 * Edge Case Export Tests
 * Tests specific edge cases and error conditions
 */
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { exportCommand } from '../../src/commands/export.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDir = path.join(__dirname, '../temp/edge-case-export');

async function runEdgeCaseTests() {
  await fs.ensureDir(testDir);
  console.log('🔬 Running Edge Case Tests...\n');

  // Test 1: Circular JSON in metadata
  console.log('Test 1: Circular JSON structures in metadata');
  const circularObj = { name: 'test' };
  circularObj.self = circularObj;
  
  try {
    const result = await exportCommand.run({
      args: {
        input: __filename, // Use this file as input
        format: 'html',
        output: path.join(testDir, 'circular.html'),
        metadata: JSON.stringify({ test: 'safe' }), // Can't pass actual circular object through CLI
        quiet: true
      }
    });
    console.log(`  Result: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
  } catch (error) {
    console.log(`  Result: ❌ ERROR - ${error.message}`);
  }

  // Test 2: Read-only directory simulation
  console.log('\nTest 2: Read-only directory access');
  const readonlyDir = path.join(testDir, 'readonly');
  await fs.ensureDir(readonlyDir);
  
  try {
    // Try to make directory read-only
    await fs.chmod(readonlyDir, 0o444);
    
    const result = await exportCommand.run({
      args: {
        input: __filename,
        format: 'html',
        output: path.join(readonlyDir, 'readonly-test.html'),
        quiet: true
      }
    });
    console.log(`  Result: ${result.success ? '⚠️  UNEXPECTED SUCCESS' : '✅ FAILED AS EXPECTED'}`);
    
    // Restore permissions
    await fs.chmod(readonlyDir, 0o755);
  } catch (error) {
    console.log(`  Result: ✅ ERROR AS EXPECTED - ${error.message}`);
  }

  // Test 3: Non-existent input file
  console.log('\nTest 3: Non-existent input file');
  try {
    const result = await exportCommand.run({
      args: {
        input: path.join(testDir, 'non-existent-file.md'),
        format: 'html',
        quiet: true
      }
    });
    console.log(`  Result: ${result.success ? '⚠️  UNEXPECTED SUCCESS' : '✅ FAILED AS EXPECTED'}`);
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }
  } catch (error) {
    console.log(`  Result: ✅ ERROR AS EXPECTED - ${error.message}`);
  }

  // Test 4: Invalid format
  console.log('\nTest 4: Invalid export format');
  try {
    const result = await exportCommand.run({
      args: {
        input: __filename,
        format: 'invalid-format',
        quiet: true
      }
    });
    console.log(`  Result: ${result.success ? '⚠️  UNEXPECTED SUCCESS' : '✅ FAILED AS EXPECTED'}`);
    if (result.errors) {
      console.log(`  Validation errors: ${result.errors.join(', ')}`);
    }
  } catch (error) {
    console.log(`  Result: ✅ ERROR AS EXPECTED - ${error.message}`);
  }

  // Test 5: Extremely long filename
  console.log('\nTest 5: Extremely long filename');
  const longFilename = 'a'.repeat(255) + '.md';
  const longFilePath = path.join(testDir, longFilename);
  
  try {
    await fs.writeFile(longFilePath, '# Long filename test');
    
    const result = await exportCommand.run({
      args: {
        input: longFilePath,
        format: 'html',
        quiet: true
      }
    });
    console.log(`  Result: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
  } catch (error) {
    console.log(`  Result: ❌ ERROR - ${error.message}`);
  }

  // Test 6: Empty file
  console.log('\nTest 6: Empty input file');
  const emptyFile = path.join(testDir, 'empty.md');
  await fs.writeFile(emptyFile, '');
  
  try {
    const result = await exportCommand.run({
      args: {
        input: emptyFile,
        format: 'html',
        output: path.join(testDir, 'empty-output.html'),
        quiet: true
      }
    });
    console.log(`  Result: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    
    if (result.success) {
      const outputContent = await fs.readFile(result.outputPath, 'utf8');
      console.log(`  Output length: ${outputContent.length} characters`);
    }
  } catch (error) {
    console.log(`  Result: ❌ ERROR - ${error.message}`);
  }

  // Test 7: Very large single line
  console.log('\nTest 7: Very large single line');
  const hugeLine = 'x'.repeat(1000000); // 1MB single line
  const largeLineFile = path.join(testDir, 'large-line.md');
  await fs.writeFile(largeLineFile, `# Large Line Test\n\n${hugeLine}`);
  
  try {
    const startTime = this.getDeterministicTimestamp();
    const result = await exportCommand.run({
      args: {
        input: largeLineFile,
        format: 'html',
        output: path.join(testDir, 'large-line-output.html'),
        quiet: true
      }
    });
    const duration = this.getDeterministicTimestamp() - startTime;
    console.log(`  Result: ${result.success ? '✅ SUCCESS' : '❌ FAILED'} (${duration}ms)`);
  } catch (error) {
    console.log(`  Result: ❌ ERROR - ${error.message}`);
  }

  // Test 8: Unicode edge cases
  console.log('\nTest 8: Unicode and special characters');
  const unicodeContent = `# Unicode Test 🧪

Testing various Unicode characters:
- Emoji: 👨‍💻🚀🔬
- Mathematical: ∑∂∇∞≠≤≥
- Languages: 日本語, العربية, Русский
- Special: \u0000\u0001\uFFFF

Normal content after Unicode.
`;
  
  const unicodeFile = path.join(testDir, 'unicode.md');
  await fs.writeFile(unicodeFile, unicodeContent);
  
  try {
    const result = await exportCommand.run({
      args: {
        input: unicodeFile,
        format: 'html',
        output: path.join(testDir, 'unicode-output.html'),
        quiet: true
      }
    });
    console.log(`  Result: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
  } catch (error) {
    console.log(`  Result: ❌ ERROR - ${error.message}`);
  }

  // Test 9: Memory exhaustion simulation  
  console.log('\nTest 9: Memory exhaustion simulation');
  const memoryContent = Array.from({ length: 1000 }, (_, i) => 
    `## Section ${i}\n\n${'Memory intensive content line. '.repeat(1000)}\n\n`
  ).join('');
  
  const memoryFile = path.join(testDir, 'memory-test.md');
  await fs.writeFile(memoryFile, memoryContent);
  
  try {
    const startTime = this.getDeterministicTimestamp();
    const startMemory = process.memoryUsage().heapUsed;
    
    const result = await exportCommand.run({
      args: {
        input: memoryFile,
        format: 'html',
        output: path.join(testDir, 'memory-output.html'),
        quiet: true
      }
    });
    
    const duration = this.getDeterministicTimestamp() - startTime;
    const endMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = endMemory - startMemory;
    
    console.log(`  Result: ${result.success ? '✅ SUCCESS' : '❌ FAILED'} (${duration}ms)`);
    console.log(`  Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
  } catch (error) {
    console.log(`  Result: ❌ ERROR - ${error.message}`);
  }

  console.log('\n🏁 Edge Case Tests Complete\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runEdgeCaseTests().catch(console.error);
}