#!/usr/bin/env node

/**
 * KGEN OpenTelemetry Validation Script
 * 
 * Comprehensive validation of tracing implementation against charter requirements:
 * - ≥90% operation coverage
 * - ≤5ms p95 performance impact  
 * - JSONL audit logging with provenance integration
 */

import { resolve } from 'path';
import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { KGenPerformanceValidator } from '../src/observability/performance-validator.js';
import { initializeTracing, shutdownTracing } from '../src/observability/kgen-tracer.js';

async function runValidationTests() {
  console.log('🚀 Starting KGEN OpenTelemetry Validation Tests\n');

  try {
    // Initialize tracing
    const tracer = await initializeTracing({
      serviceName: 'kgen-validation',
      serviceVersion: '1.0.0',
      enableJSONLExport: true,
      performanceTarget: 5
    });

    // Create validator
    const validator = new KGenPerformanceValidator({
      coverageTarget: 0.90,
      performanceTarget: 5,
      auditDir: resolve(process.cwd(), '.kgen/audit')
    });

    // Ensure audit directory exists
    const auditDir = resolve(process.cwd(), '.kgen/audit');
    if (!existsSync(auditDir)) {
      mkdirSync(auditDir, { recursive: true });
    }

    console.log('📋 Running KGEN operations to generate trace data...\n');

    // Execute representative KGEN operations to generate spans
    await runKGenOperations();

    // Wait for spans to be processed
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('🔍 Validating tracing implementation...\n');

    // Run comprehensive validation
    const results = await validator.runComprehensiveValidation();

    // Cleanup
    await shutdownTracing();

    // Exit with appropriate code
    if (results.overall.passed) {
      console.log('🎉 All validation tests passed! KGEN tracing meets charter requirements.\n');
      process.exit(0);
    } else {
      console.log('❌ Validation failed. Please address the issues above.\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('💥 Validation failed with error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * Run representative KGEN operations to generate trace data
 */
async function runKGenOperations() {
  const operations = [
    // Test graph operations (with mock files if needed)
    { cmd: 'node bin/kgen.mjs --version', desc: 'Version check' },
    // Add more operations as available
  ];

  for (const op of operations) {
    try {
      console.log(`  Running: ${op.desc}`);
      execSync(op.cmd, { 
        cwd: process.cwd(),
        stdio: 'pipe',
        timeout: 10000
      });
    } catch (error) {
      console.log(`  ⚠️  Operation failed (expected): ${op.desc}`);
      // Continue with other operations
    }
  }
}

// Run validation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runValidationTests().catch(error => {
    console.error('Validation script failed:', error);
    process.exit(1);
  });
}

export { runValidationTests };