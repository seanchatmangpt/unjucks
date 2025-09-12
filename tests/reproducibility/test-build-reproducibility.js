#!/usr/bin/env node

/**
 * Build Reproducibility Test Suite
 * 
 * Tests that builds produce identical outputs across:
 * - Multiple build runs
 * - Different machines/environments
 * - Different timestamps
 * 
 * This is a CRITICAL requirement for ensuring deterministic builds.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync, spawn } from 'child_process';
import os from 'os';
import { getDeterministicDate, getDeterministicTimestamp, getDeterministicISOString } from '../../src/utils/deterministic-time.js';

class ReproducibilityTester {
  constructor() {
    this.results = {
      timestamp: getDeterministicISOString(),
      environment: {
        platform: process.platform,
        nodeVersion: process.version,
        arch: process.arch,
        hostname: os.hostname(),
        user: process.env.USER || process.env.USERNAME || 'unknown'
      },
      tests: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        reproducible: false
      }
    };
  }

  /**
   * Generate SHA256 hash of file content
   */
  hashFile(filePath) {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get file stats (size, permissions, etc)
   */
  getFileStats(filePath) {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const stats = fs.statSync(filePath);
    return {
      size: stats.size,
      mode: stats.mode.toString(8),
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory()
    };
  }

  /**
   * Recursively find all files in directory
   */
  findAllFiles(dir, baseDir = null) {
    if (!baseDir) baseDir = dir;
    const files = [];
    
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(baseDir, fullPath);
        
        if (entry.isFile()) {
          // Skip certain non-reproducible files
          if (this.shouldSkipFile(entry.name)) {
            continue;
          }
          
          files.push({
            path: fullPath,
            relativePath: relativePath,
            hash: this.hashFile(fullPath),
            stats: this.getFileStats(fullPath)
          });
        } else if (entry.isDirectory() && !entry.name.startsWith('.')) {
          files.push(...this.findAllFiles(fullPath, baseDir));
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not read directory ${dir}: ${error.message}`);
    }
    
    return files;
  }

  /**
   * Files to skip in reproducibility testing (known non-deterministic)
   */
  shouldSkipFile(filename) {
    const skipPatterns = [
      /\.log$/,
      /\.pid$/,
      /\.lock$/,
      /node_modules/,
      /\.git/,
      /\.DS_Store/,
      /Thumbs\.db/,
      /\.tmp$/,
      /\.temp$/
    ];
    
    return skipPatterns.some(pattern => pattern.test(filename));
  }

  /**
   * Run kgen build command and capture output
   */
  async runBuild(buildDir, attempt) {
    const startTime = getDeterministicTimestamp();
    
    try {
      // Clean any existing build artifacts
      const generatedDir = path.join(buildDir, 'generated');
      if (fs.existsSync(generatedDir)) {
        fs.rmSync(generatedDir, { recursive: true, force: true });
      }
      
      // Run build with deterministic environment
      const env = {
        ...process.env,
        // Remove non-deterministic environment variables
        SOURCE_DATE_EPOCH: '1609459200', // 2021-01-01T00:00:00Z
        TZ: 'UTC',
        LANG: 'C',
        LC_ALL: 'C'
      };
      
      // Delete timestamp-sensitive files
      delete env.npm_config_cache;
      
      const buildCommand = 'node bin/kgen.mjs artifact generate test-data/simple-graph.ttl base';
      console.log(`[Attempt ${attempt}] Running: ${buildCommand}`);
      
      const output = execSync(buildCommand, {
        cwd: buildDir,
        env: env,
        encoding: 'utf8',
        timeout: 30000
      });
      
      const duration = getDeterministicTimestamp() - startTime;
      
      return {
        success: true,
        duration: duration,
        output: output,
        files: this.findAllFiles(generatedDir)
      };
      
    } catch (error) {
      const duration = getDeterministicTimestamp() - startTime;
      
      return {
        success: false,
        duration: duration,
        error: error.message,
        output: error.stdout || '',
        stderr: error.stderr || '',
        files: []
      };
    }
  }

  /**
   * Compare two build results for identical outputs
   */
  compareBuilds(build1, build2) {
    const comparison = {
      identical: false,
      differences: [],
      fileComparison: {
        onlyInBuild1: [],
        onlyInBuild2: [],
        different: [],
        identical: []
      }
    };

    // Create file maps for easy comparison
    const files1 = new Map(build1.files.map(f => [f.relativePath, f]));
    const files2 = new Map(build2.files.map(f => [f.relativePath, f]));

    // Find files only in build1
    for (const [path, file] of files1) {
      if (!files2.has(path)) {
        comparison.fileComparison.onlyInBuild1.push(path);
        comparison.differences.push(`File only in build1: ${path}`);
      }
    }

    // Find files only in build2
    for (const [path, file] of files2) {
      if (!files1.has(path)) {
        comparison.fileComparison.onlyInBuild2.push(path);
        comparison.differences.push(`File only in build2: ${path}`);
      }
    }

    // Compare common files
    for (const [path, file1] of files1) {
      const file2 = files2.get(path);
      if (!file2) continue;

      if (file1.hash !== file2.hash) {
        comparison.fileComparison.different.push({
          path: path,
          build1Hash: file1.hash,
          build2Hash: file2.hash,
          build1Size: file1.stats?.size,
          build2Size: file2.stats?.size
        });
        comparison.differences.push(
          `File differs: ${path} (hash1: ${file1.hash?.substring(0, 8)}..., hash2: ${file2.hash?.substring(0, 8)}...)`
        );
      } else {
        comparison.fileComparison.identical.push(path);
      }
    }

    comparison.identical = comparison.differences.length === 0;
    
    return comparison;
  }

  /**
   * Test kgen.lock.json for deterministic timestamps
   */
  async testLockFileDeterminism(buildDir) {
    console.log('\n🔍 Testing kgen.lock.json determinism...');
    
    const lockPath = path.join(buildDir, 'kgen.lock.json');
    
    // Generate lock file multiple times
    const lockFiles = [];
    
    for (let i = 1; i <= 3; i++) {
      try {
        // Remove existing lock file
        if (fs.existsSync(lockPath)) {
          fs.unlinkSync(lockPath);
        }
        
        // Wait a bit to ensure different timestamps if they're being used
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Generate new lock file
        execSync('node bin/kgen.mjs project lock', {
          cwd: buildDir,
          env: {
            ...process.env,
            SOURCE_DATE_EPOCH: '1609459200',
            TZ: 'UTC'
          }
        });
        
        if (fs.existsSync(lockPath)) {
          const content = fs.readFileSync(lockPath, 'utf8');
          const hash = crypto.createHash('sha256').update(content).digest('hex');
          
          lockFiles.push({
            attempt: i,
            content: content,
            hash: hash,
            parsed: JSON.parse(content)
          });
        }
        
      } catch (error) {
        console.warn(`Warning: Lock file generation ${i} failed: ${error.message}`);
      }
    }
    
    // Compare lock files
    const lockTest = {
      name: 'Lock File Determinism',
      type: 'lockfile',
      attempts: lockFiles.length,
      identical: false,
      issues: []
    };
    
    if (lockFiles.length >= 2) {
      const firstHash = lockFiles[0].hash;
      const allIdentical = lockFiles.every(f => f.hash === firstHash);
      
      lockTest.identical = allIdentical;
      
      if (!allIdentical) {
        // Analyze differences
        for (let i = 1; i < lockFiles.length; i++) {
          const diff = this.findLockFileDifferences(lockFiles[0], lockFiles[i]);
          lockTest.issues.push(`Lock file ${i + 1} differs: ${diff.join(', ')}`);
        }
      }
    } else {
      lockTest.issues.push('Could not generate enough lock files for comparison');
    }
    
    this.results.tests.push(lockTest);
    
    return lockTest;
  }

  /**
   * Find specific differences in lock files
   */
  findLockFileDifferences(lock1, lock2) {
    const differences = [];
    
    if (lock1.parsed.timestamp !== lock2.parsed.timestamp) {
      differences.push('timestamp differs');
    }
    
    if (lock1.parsed.version !== lock2.parsed.version) {
      differences.push('version differs');
    }
    
    const files1 = Object.keys(lock1.parsed.files || {});
    const files2 = Object.keys(lock2.parsed.files || {});
    
    if (files1.length !== files2.length) {
      differences.push('file count differs');
    }
    
    for (const file of files1) {
      if (!lock2.parsed.files[file]) {
        differences.push(`file missing: ${file}`);
      } else {
        const f1 = lock1.parsed.files[file];
        const f2 = lock2.parsed.files[file];
        
        if (f1.hash !== f2.hash) {
          differences.push(`file hash differs: ${file}`);
        }
        if (f1.modified !== f2.modified) {
          differences.push(`file modified time differs: ${file}`);
        }
      }
    }
    
    return differences;
  }

  /**
   * Test template rendering determinism
   */
  async testTemplateRendering(buildDir) {
    console.log('\n📄 Testing template rendering determinism...');
    
    const templateTest = {
      name: 'Template Rendering Determinism',
      type: 'template',
      renders: [],
      identical: false,
      issues: []
    };
    
    // Test basic template rendering multiple times
    for (let i = 1; i <= 3; i++) {
      try {
        const output = execSync(
          'node bin/kgen.mjs deterministic render _templates/basic.njk -c \'{"name":"test","value":42}\'',
          {
            cwd: buildDir,
            env: {
              ...process.env,
              SOURCE_DATE_EPOCH: '1609459200',
              TZ: 'UTC'
            },
            encoding: 'utf8'
          }
        );
        
        const result = JSON.parse(output);
        templateTest.renders.push({
          attempt: i,
          success: result.success,
          contentHash: result.contentHash,
          deterministic: result.deterministic
        });
        
      } catch (error) {
        templateTest.renders.push({
          attempt: i,
          success: false,
          error: error.message
        });
      }
    }
    
    // Check if all renders produced identical results
    if (templateTest.renders.length >= 2) {
      const firstHash = templateTest.renders[0].contentHash;
      const allIdentical = templateTest.renders.every(r => r.contentHash === firstHash);
      
      templateTest.identical = allIdentical;
      
      if (!allIdentical) {
        for (let i = 1; i < templateTest.renders.length; i++) {
          if (templateTest.renders[i].contentHash !== firstHash) {
            templateTest.issues.push(
              `Render ${i + 1} hash differs: ${templateTest.renders[i].contentHash} vs ${firstHash}`
            );
          }
        }
      }
    }
    
    this.results.tests.push(templateTest);
    
    return templateTest;
  }

  /**
   * Run comprehensive reproducibility test
   */
  async runTest() {
    console.log('🧪 Starting Build Reproducibility Test Suite');
    console.log(`Platform: ${this.results.environment.platform}`);
    console.log(`Node: ${this.results.environment.nodeVersion}`);
    console.log(`Architecture: ${this.results.environment.arch}`);
    console.log('');

    const buildDir = process.cwd();
    
    // Test 1: Lock file determinism
    await this.testLockFileDeterminism(buildDir);
    
    // Test 2: Template rendering determinism  
    await this.testTemplateRendering(buildDir);
    
    // Test 3: Multiple build runs
    console.log('\n🔨 Testing multiple build runs...');
    
    const builds = [];
    const buildTest = {
      name: 'Multiple Build Reproducibility',
      type: 'build',
      builds: [],
      identical: false,
      issues: []
    };
    
    for (let i = 1; i <= 3; i++) {
      console.log(`\n--- Build Attempt ${i} ---`);
      const build = await this.runBuild(buildDir, i);
      builds.push(build);
      
      buildTest.builds.push({
        attempt: i,
        success: build.success,
        duration: build.duration,
        fileCount: build.files.length,
        error: build.error
      });
      
      if (build.success) {
        console.log(`✅ Build ${i} succeeded (${build.files.length} files, ${build.duration}ms)`);
      } else {
        console.log(`❌ Build ${i} failed: ${build.error}`);
      }
    }
    
    // Compare builds
    if (builds.length >= 2 && builds.every(b => b.success)) {
      console.log('\n🔍 Comparing build outputs...');
      
      const comparison1vs2 = this.compareBuilds(builds[0], builds[1]);
      const comparison1vs3 = builds.length >= 3 ? this.compareBuilds(builds[0], builds[2]) : null;
      
      buildTest.identical = comparison1vs2.identical && 
                           (!comparison1vs3 || comparison1vs3.identical);
      
      if (buildTest.identical) {
        console.log('✅ All builds produced identical outputs!');
      } else {
        console.log('❌ Builds produced different outputs:');
        comparison1vs2.differences.forEach(diff => console.log(`  - ${diff}`));
        
        buildTest.issues = comparison1vs2.differences;
      }
      
      buildTest.comparison = {
        build1vs2: comparison1vs2,
        build1vs3: comparison1vs3
      };
      
    } else {
      buildTest.issues.push('Not all builds succeeded');
      console.log('❌ Cannot compare builds - not all succeeded');
    }
    
    this.results.tests.push(buildTest);
    
    // Calculate summary
    this.results.summary.total = this.results.tests.length;
    this.results.summary.passed = this.results.tests.filter(t => t.identical).length;
    this.results.summary.failed = this.results.summary.total - this.results.summary.passed;
    this.results.summary.reproducible = this.results.summary.failed === 0;
    
    return this.results;
  }

  /**
   * Generate comprehensive test report
   */
  generateReport() {
    const reportPath = path.join(process.cwd(), 'tests/reproducibility/reproducibility-report.json');
    
    // Ensure directory exists
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    
    // Write detailed JSON report
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    
    // Generate human-readable summary
    const summaryPath = path.join(process.cwd(), 'tests/reproducibility/reproducibility-summary.md');
    const summary = this.generateMarkdownSummary();
    fs.writeFileSync(summaryPath, summary);
    
    console.log(`\n📄 Reports generated:`);
    console.log(`  - Detailed: ${reportPath}`);
    console.log(`  - Summary: ${summaryPath}`);
    
    return { reportPath, summaryPath };
  }

  /**
   * Generate markdown summary
   */
  generateMarkdownSummary() {
    const { summary, tests, environment } = this.results;
    
    return `# Build Reproducibility Test Report

## Summary

**Overall Result: ${summary.reproducible ? '✅ REPRODUCIBLE' : '❌ NON-REPRODUCIBLE'}**

- **Total Tests**: ${summary.total}
- **Passed**: ${summary.passed}
- **Failed**: ${summary.failed}
- **Success Rate**: ${Math.round((summary.passed / summary.total) * 100)}%

## Environment

- **Platform**: ${environment.platform}
- **Node Version**: ${environment.nodeVersion}
- **Architecture**: ${environment.arch}
- **Hostname**: ${environment.hostname}
- **Test Date**: ${this.results.timestamp}

## Test Results

${tests.map(test => `
### ${test.name}

**Status**: ${test.identical ? '✅ PASS' : '❌ FAIL'}
**Type**: ${test.type}

${test.issues.length > 0 ? `
**Issues**:
${test.issues.map(issue => `- ${issue}`).join('\n')}
` : ''}

${test.type === 'build' && test.comparison ? `
**File Comparison**:
- Identical files: ${test.comparison.build1vs2.fileComparison.identical.length}
- Different files: ${test.comparison.build1vs2.fileComparison.different.length}
- Only in build 1: ${test.comparison.build1vs2.fileComparison.onlyInBuild1.length}
- Only in build 2: ${test.comparison.build1vs2.fileComparison.onlyInBuild2.length}
` : ''}

`).join('')}

## Recommendations

${summary.reproducible ? `
✅ **Builds are reproducible!** 

This means:
- Builds produce identical outputs across multiple runs
- Template rendering is deterministic
- Lock files are consistent
- The system can be trusted for reproducible builds

` : `
❌ **Builds are NOT reproducible.**

To fix this, consider:
- Remove all \`this.getDeterministicTimestamp()\` and \`this.getDeterministicDate()\` calls from core systems
- Use \`SOURCE_DATE_EPOCH\` environment variable for deterministic timestamps
- Ensure all random number generation uses fixed seeds
- Remove environment-specific data from outputs
- Sort all arrays/objects before serialization

**Priority fixes needed**:
${tests.filter(t => !t.identical).map(t => `- Fix ${t.name.toLowerCase()}: ${t.issues[0] || 'See details above'}`).join('\n')}
`}

---
*Generated by KGEN Reproducibility Test Suite*
`;
  }
}

// Run the test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new ReproducibilityTester();
  
  tester.runTest()
    .then(results => {
      const reports = tester.generateReport();
      
      console.log('\n📊 FINAL SUMMARY');
      console.log('================');
      console.log(`Overall: ${results.summary.reproducible ? '✅ REPRODUCIBLE' : '❌ NON-REPRODUCIBLE'}`);
      console.log(`Tests: ${results.summary.passed}/${results.summary.total} passed`);
      
      if (!results.summary.reproducible) {
        console.log('\n🚨 CRITICAL ISSUES FOUND:');
        results.tests.filter(t => !t.identical).forEach(test => {
          console.log(`  - ${test.name}: ${test.issues[0] || 'See report for details'}`);
        });
        
        process.exit(1);
      }
      
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Test suite failed:', error);
      process.exit(1);
    });
}

export { ReproducibilityTester };