/**
 * Deterministic Rendering Test CLI Command
 * 
 * Validates that templates produce byte-identical outputs across multiple renders
 */

import { defineCommand } from 'citty';
import { consola } from 'consola';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { HardenedDeterministicRenderer } from '../kgen/deterministic/hardened-renderer.js';

export default defineCommand({
  meta: {
    name: 'deterministic-test',
    description: 'Test template rendering for deterministic output'
  },
  
  args: {
    template: {
      type: 'string',
      description: 'Template file to test',
      required: true
    },
    context: {
      type: 'string',
      description: 'JSON context file or inline JSON',
      default: '{}'
    },
    iterations: {
      type: 'string',
      description: 'Number of test iterations',
      default: '100'
    },
    'templates-dir': {
      type: 'string',
      description: 'Templates directory',
      default: '_templates'
    },
    output: {
      type: 'string',
      description: 'Output report file'
    },
    benchmark: {
      type: 'boolean',
      description: 'Run performance benchmark',
      default: false
    },
    'show-content': {
      type: 'boolean',
      description: 'Show rendered content in output',
      default: false
    },
    'validate-hash': {
      type: 'boolean',
      description: 'Validate content hashes match actual content',
      default: true
    }
  },

  async run({ args }) {
    const startTime = Date.now();

    try {
      consola.start(`Testing deterministic rendering for template: ${args.template}`);

      // Parse context
      let context = {};
      try {
        if (args.context.startsWith('{') || args.context.startsWith('[')) {
          context = JSON.parse(args.context);
        } else {
          // Try to read as file
          const contextFile = path.resolve(args.context);
          const contextContent = await fs.readFile(contextFile, 'utf8');
          context = JSON.parse(contextContent);
        }
      } catch (error) {
        consola.warn(`Could not parse context: ${error.message}. Using empty context.`);
        context = {};
      }

      const iterations = parseInt(args.iterations, 10);
      if (isNaN(iterations) || iterations <= 0) {
        throw new Error('Iterations must be a positive number');
      }

      // Initialize deterministic renderer
      const renderer = new HardenedDeterministicRenderer({
        templatesDir: args['templates-dir'],
        deterministicSeed: 'cli-test-seed',
        staticBuildTime: '2024-01-01T00:00:00.000Z',
        strictMode: true,
        validateDeterminism: true
      });

      // Test deterministic rendering
      consola.info(`Running ${iterations} iterations...`);
      const testResult = await renderer.testDeterministicRendering(
        args.template,
        context,
        iterations
      );

      // Run benchmark if requested
      let benchmarkResult = null;
      if (args.benchmark) {
        consola.info('Running performance benchmark...');
        benchmarkResult = await renderer.benchmarkDeterministicRendering(
          args.template,
          context,
          Math.min(iterations, 50) // Limit benchmark iterations
        );
      }

      // Validate hash integrity if requested
      let hashValidation = null;
      if (args['validate-hash'] && testResult.deterministic) {
        consola.info('Validating content hash integrity...');
        hashValidation = await validateHashIntegrity(renderer, args.template, context);
      }

      // Generate report
      const report = generateReport(
        testResult,
        benchmarkResult,
        hashValidation,
        {
          template: args.template,
          context: args.context,
          iterations,
          showContent: args['show-content'],
          templatesDir: args['templates-dir'],
          startTime,
          endTime: Date.now()
        }
      );

      // Output results
      if (args.output) {
        await fs.writeFile(args.output, JSON.stringify(report, null, 2));
        consola.success(`Report saved to: ${args.output}`);
      }

      // Console output
      displayResults(testResult, benchmarkResult, hashValidation);

      // Exit with appropriate code
      if (testResult.deterministic) {
        consola.success(`✅ Template rendering is deterministic across ${iterations} iterations`);
        process.exit(0);
      } else {
        consola.error(`❌ Template rendering is NOT deterministic - found ${testResult.uniqueHashes} different outputs`);
        process.exit(1);
      }

    } catch (error) {
      consola.error(`Deterministic test failed: ${error.message}`);
      process.exit(1);
    }
  }
});

/**
 * Validate that content hashes match actual content
 */
async function validateHashIntegrity(renderer, templatePath, context, samples = 5) {
  const results = [];

  for (let i = 0; i < samples; i++) {
    renderer.clearCache(); // Force fresh render
    const result = await renderer.render(templatePath, context);

    // Compute hash of actual content
    const actualHash = crypto.createHash('sha256')
      .update(result.content, 'utf8')
      .digest('hex');

    const valid = result.contentHash === actualHash;
    
    results.push({
      iteration: i + 1,
      reportedHash: result.contentHash,
      actualHash,
      valid,
      contentLength: result.content.length
    });

    if (!valid) {
      break; // Stop on first validation failure
    }
  }

  const allValid = results.every(r => r.valid);

  return {
    valid: allValid,
    samples,
    validatedSamples: results.filter(r => r.valid).length,
    invalidSamples: results.filter(r => !r.valid).length,
    results: allValid ? results.slice(0, 2) : results // Show all if invalid
  };
}

/**
 * Generate comprehensive test report
 */
function generateReport(testResult, benchmarkResult, hashValidation, metadata) {
  const report = {
    metadata: {
      ...metadata,
      duration: metadata.endTime - metadata.startTime,
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    },
    
    determinismTest: {
      ...testResult,
      summary: {
        passed: testResult.deterministic,
        iterations: testResult.iterations,
        uniqueOutputs: testResult.uniqueHashes,
        status: testResult.deterministic ? 'DETERMINISTIC' : 'NON_DETERMINISTIC'
      }
    },
    
    performance: benchmarkResult ? {
      ...benchmarkResult,
      summary: {
        averageTimeMs: benchmarkResult.performance.averageTime,
        minTimeMs: benchmarkResult.performance.minTime,
        maxTimeMs: benchmarkResult.performance.maxTime,
        varianceMs: benchmarkResult.performance.variance,
        totalTimeMs: benchmarkResult.performance.totalTime
      }
    } : null,
    
    hashValidation: hashValidation ? {
      ...hashValidation,
      summary: {
        passed: hashValidation.valid,
        validatedSamples: hashValidation.validatedSamples,
        totalSamples: hashValidation.samples,
        integrityRate: hashValidation.validatedSamples / hashValidation.samples
      }
    } : null,
    
    verdict: {
      deterministic: testResult.deterministic,
      performant: benchmarkResult ? benchmarkResult.performance.averageTime < 50 : null,
      integrityValid: hashValidation ? hashValidation.valid : null,
      overallStatus: testResult.deterministic ? 'PASSED' : 'FAILED'
    }
  };

  return report;
}

/**
 * Display results in console
 */
function displayResults(testResult, benchmarkResult, hashValidation) {
  console.log('\n' + '='.repeat(80));
  console.log('DETERMINISTIC RENDERING TEST RESULTS');
  console.log('='.repeat(80));

  // Determinism results
  console.log('\n📋 DETERMINISM TEST:');
  console.log(`   Template: ${testResult.templatePath}`);
  console.log(`   Iterations: ${testResult.iterations}`);
  console.log(`   Unique outputs: ${testResult.uniqueHashes}`);
  console.log(`   Status: ${testResult.deterministic ? '✅ DETERMINISTIC' : '❌ NON-DETERMINISTIC'}`);

  if (testResult.deterministic) {
    console.log(`   Content hash: ${testResult.contentHash}`);
  } else {
    console.log('   ⚠️  Multiple different outputs detected!');
    console.log(`   First few results:`);
    testResult.results.slice(0, 5).forEach(result => {
      console.log(`     Iteration ${result.iteration}: ${result.contentHash} (${result.contentLength} bytes)`);
    });
  }

  // Performance results
  if (benchmarkResult) {
    console.log('\n⚡ PERFORMANCE BENCHMARK:');
    console.log(`   Iterations: ${benchmarkResult.iterations}`);
    console.log(`   Average time: ${benchmarkResult.performance.averageTime.toFixed(2)}ms`);
    console.log(`   Min time: ${benchmarkResult.performance.minTime.toFixed(2)}ms`);
    console.log(`   Max time: ${benchmarkResult.performance.maxTime.toFixed(2)}ms`);
    console.log(`   Total time: ${benchmarkResult.performance.totalTime.toFixed(2)}ms`);
    console.log(`   Variance: ${benchmarkResult.performance.variance.toFixed(2)}ms²`);
  }

  // Hash validation results
  if (hashValidation) {
    console.log('\n🔍 HASH VALIDATION:');
    console.log(`   Samples tested: ${hashValidation.samples}`);
    console.log(`   Valid samples: ${hashValidation.validatedSamples}`);
    console.log(`   Invalid samples: ${hashValidation.invalidSamples}`);
    console.log(`   Integrity rate: ${((hashValidation.validatedSamples / hashValidation.samples) * 100).toFixed(1)}%`);
    console.log(`   Status: ${hashValidation.valid ? '✅ VALID' : '❌ INVALID'}`);
  }

  console.log('\n' + '='.repeat(80));
  
  if (testResult.deterministic) {
    console.log('🎉 SUCCESS: Template rendering is fully deterministic!');
  } else {
    console.log('💥 FAILURE: Template rendering is NOT deterministic!');
    console.log('   This indicates the presence of non-deterministic elements.');
    console.log('   Review template for: timestamps, random values, or system-dependent data.');
  }
  
  console.log('='.repeat(80) + '\n');
}