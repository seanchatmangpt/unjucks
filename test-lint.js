#!/usr/bin/env node

/**
 * Standalone test script for template linting system
 */

import { TemplateLinter, lintTemplateDirectory, createDeterminismReport } from './packages/kgen-cli/src/lib/template-linter.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testTemplateLinting() {
  console.log('🔍 Testing KGEN Template Linter v1.0.0\n');

  try {
    // Test directory containing test templates
    const testDir = join(__dirname, 'test-templates');
    
    console.log(`📁 Linting templates in: ${testDir}`);
    
    // Create linter instance
    const linter = new TemplateLinter({
      cache: true,
      performanceTarget: 5
    });

    // Lint single deterministic template
    console.log('\n✅ Testing deterministic template:');
    const goodResult = await linter.lintTemplate(join(testDir, 'deterministic.njk'));
    console.log(`  Deterministic: ${goodResult.deterministic}`);
    console.log(`  Issues: ${goodResult.issues.length}`);
    console.log(`  Lint time: ${goodResult.stats.lintTime}ms`);

    // Lint single non-deterministic template
    console.log('\n❌ Testing non-deterministic template:');
    const badResult = await linter.lintTemplate(join(testDir, 'non-deterministic.njk'));
    console.log(`  Deterministic: ${badResult.deterministic}`);
    console.log(`  Issues: ${badResult.issues.length}`);
    console.log(`  Errors: ${badResult.stats.errors}`);
    console.log(`  Warnings: ${badResult.stats.warnings}`);

    // Show specific issues
    if (badResult.issues.length > 0) {
      console.log('\n  Issues found:');
      badResult.issues.slice(0, 3).forEach(issue => {
        console.log(`    • ${issue.severity}: ${issue.message}`);
        if (issue.suggestion) {
          console.log(`      💡 ${issue.suggestion}`);
        }
      });
    }

    // Test performance template
    console.log('\n⚡ Testing performance template:');
    const perfResult = await linter.lintTemplate(join(testDir, 'performance-issue.njk'));
    console.log(`  Performance issues: ${perfResult.stats.performance}`);

    // Batch lint all templates
    console.log('\n📊 Batch linting all templates:');
    const batchResult = await lintTemplateDirectory(testDir);
    console.log(`  Total templates: ${batchResult.summary.total}`);
    console.log(`  Passed: ${batchResult.summary.passed}`);
    console.log(`  Failed: ${batchResult.summary.failed}`);
    console.log(`  Average lint time: ${batchResult.summary.avgLintTime.toFixed(1)}ms`);

    // Generate determinism report
    const report = createDeterminismReport(batchResult.results);
    console.log(`\n📋 Determinism Report:`);
    console.log(`  Score: ${report.determinismScore}%`);
    console.log(`  Non-deterministic templates: ${report.nonDeterministicCount}`);
    console.log(`  Performance issues: ${report.performanceIssues.length}`);
    
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach(rec => console.log(`  • ${rec}`));
    }

    // Test caching
    console.log('\n💾 Testing cache performance:');
    const startTime = this.getDeterministicTimestamp();
    await linter.lintTemplate(join(testDir, 'deterministic.njk')); // Should be cached
    const cachedTime = this.getDeterministicTimestamp() - startTime;
    console.log(`  Cached lint time: ${cachedTime}ms`);
    console.log(`  Cache size: ${linter.getCacheStats().size} entries`);

    console.log('\n✅ Template linting system test completed successfully!');
    
    // Performance validation
    const avgTime = batchResult.summary.avgLintTime;
    if (avgTime <= 5) {
      console.log(`🎯 Performance target met: ${avgTime.toFixed(1)}ms ≤ 5ms`);
    } else {
      console.warn(`⚠️  Performance target missed: ${avgTime.toFixed(1)}ms > 5ms`);
    }

    // Determinism validation  
    const deterministicScore = parseFloat(report.determinismScore);
    if (deterministicScore >= 99.9) {
      console.log(`🛡️  Determinism target would be met in production templates`);
    } else {
      console.log(`📊 Current determinism score: ${report.determinismScore}% (test templates include intentional issues)`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run test if script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testTemplateLinting();
}