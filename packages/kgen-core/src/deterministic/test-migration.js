#!/usr/bin/env node

/**
 * KGEN Core Deterministic System Migration Test
 * 
 * Validates the migrated deterministic system with comprehensive testing:
 * - 10-iteration SHA-256 hash validation (as requested)
 * - System health checks
 * - Migration verification
 * - Performance benchmarks
 */

import { 
  createKgenDeterministicSystem,
  verifyMigration,
  systemHealthCheck,
  getDeterministicTimestamp,
  deterministicRandom,
  canonicalStringify
} from './index.js';

const TEST_TEMPLATE = `Hello {{ name }}!

Today is {{ BUILD_TIME }}.
Your ID is: {{ uuid('user', name) }}.
Random number: {{ random('seed') }}.

{{ canonical({ data: context, sorted: true }) }}`;

const TEST_CONTEXT = {
  name: 'KGEN Test User',
  context: {
    version: '1.0.0',
    system: 'kgen-core',
    deterministic: true
  }
};

/**
 * Run comprehensive migration validation tests
 */
async function runMigrationTests() {
  console.log('🧪 KGEN Core Deterministic System Migration Validation');
  console.log('=' .repeat(60));
  console.log();
  
  const results = {
    timestamp: new Date().toISOString(),
    system: process.version + ' on ' + process.platform,
    tests: {},
    overall: { passed: 0, failed: 0 }
  };
  
  try {
    // Test 1: System Health Check
    console.log('📋 Running system health check...');
    const healthCheck = await systemHealthCheck();
    results.tests.healthCheck = healthCheck;
    
    if (healthCheck.overall.healthy) {
      console.log('✅ System health: HEALTHY');
      results.overall.passed++;
    } else {
      console.log('❌ System health: ISSUES DETECTED');
      console.log('   Issues:', healthCheck.overall.issues.join(', '));
      results.overall.failed++;
    }
    console.log();
    
    // Test 2: Migration Verification
    console.log('🔄 Running migration verification...');
    const migrationCheck = await verifyMigration();
    results.tests.migration = migrationCheck;
    
    if (migrationCheck.overall.success) {
      console.log('✅ Migration verification: PASSED');
      results.overall.passed++;
    } else {
      console.log('❌ Migration verification: FAILED');
      console.log('   Issues:', migrationCheck.overall.issues?.join(', ') || migrationCheck.overall.error);
      results.overall.failed++;
    }
    console.log();
    
    // Test 3: 10-Iteration SHA-256 Hash Validation (Main Request)
    console.log('🔒 Running 10-iteration SHA-256 hash validation...');
    const system = createKgenDeterministicSystem();
    
    // Create a simple test to validate inline rendering
    const hashes = new Set();
    const renderTimes = [];
    
    for (let i = 0; i < 10; i++) {\n      const startTime = performance.now();\n      \n      // Render template using the deterministic environment\n      const rendered = system.renderer.environment.renderString(TEST_TEMPLATE, {\n        ...TEST_CONTEXT,\n        BUILD_TIME: getDeterministicTimestamp(),\n        uuid: (namespace, input) => deterministicRandom.uuid(namespace, input),\n        random: (seed) => deterministicRandom.random(seed),\n        canonical: (obj) => canonicalStringify(obj)\n      });\n      \n      const endTime = performance.now();\n      const hash = require('crypto').createHash('sha256').update(rendered).digest('hex');\n      \n      hashes.add(hash);\n      renderTimes.push(endTime - startTime);\n      \n      console.log(`   Iteration ${i + 1}: ${hash.substring(0, 16)}... (${(endTime - startTime).toFixed(2)}ms)`);\n    }\n    \n    const isDeterministic = hashes.size === 1;\n    const avgTime = renderTimes.reduce((sum, time) => sum + time, 0) / renderTimes.length;\n    \n    results.tests.tenIterationValidation = {\n      success: isDeterministic,\n      iterations: 10,\n      uniqueHashes: hashes.size,\n      contentHash: isDeterministic ? Array.from(hashes)[0] : null,\n      averageRenderTime: avgTime,\n      allRenderTimes: renderTimes\n    };\n    \n    if (isDeterministic) {\n      console.log(`✅ 10-iteration validation: DETERMINISTIC`);\n      console.log(`   SHA-256 Hash: ${Array.from(hashes)[0]}`);\n      console.log(`   Average render time: ${avgTime.toFixed(2)}ms`);\n      results.overall.passed++;\n    } else {\n      console.log(`❌ 10-iteration validation: NON-DETERMINISTIC`);\n      console.log(`   Found ${hashes.size} different hashes`);\n      results.overall.failed++;\n    }\n    console.log();\n    \n    // Test 4: Extended Validation (100 iterations for thoroughness)\n    console.log('🔬 Running extended validation (100 iterations)...');\n    \n    const extendedHashes = new Set();\n    const extendedTimes = [];\n    \n    for (let i = 0; i < 100; i++) {\n      const startTime = performance.now();\n      \n      system.renderer.clearCache();\n      const rendered = system.renderer.environment.renderString(TEST_TEMPLATE, {\n        ...TEST_CONTEXT,\n        BUILD_TIME: getDeterministicTimestamp(),\n        uuid: (namespace, input) => deterministicRandom.uuid(namespace, input),\n        random: (seed) => deterministicRandom.random(seed),\n        canonical: (obj) => canonicalStringify(obj)\n      });\n      \n      const endTime = performance.now();\n      const hash = require('crypto').createHash('sha256').update(rendered).digest('hex');\n      \n      extendedHashes.add(hash);\n      extendedTimes.push(endTime - startTime);\n      \n      if ((i + 1) % 25 === 0) {\n        console.log(`   Progress: ${i + 1}/100 iterations completed`);\n      }\n    }\n    \n    const extendedDeterministic = extendedHashes.size === 1;\n    const extendedAvgTime = extendedTimes.reduce((sum, time) => sum + time, 0) / extendedTimes.length;\n    \n    results.tests.hundredIterationValidation = {\n      success: extendedDeterministic,\n      iterations: 100,\n      uniqueHashes: extendedHashes.size,\n      contentHash: extendedDeterministic ? Array.from(extendedHashes)[0] : null,\n      averageRenderTime: extendedAvgTime,\n      minTime: Math.min(...extendedTimes),\n      maxTime: Math.max(...extendedTimes)\n    };\n    \n    if (extendedDeterministic) {\n      console.log(`✅ 100-iteration validation: DETERMINISTIC`);\n      console.log(`   SHA-256 Hash: ${Array.from(extendedHashes)[0]}`);\n      console.log(`   Average render time: ${extendedAvgTime.toFixed(2)}ms`);\n      console.log(`   Min/Max times: ${Math.min(...extendedTimes).toFixed(2)}ms / ${Math.max(...extendedTimes).toFixed(2)}ms`);\n      results.overall.passed++;\n    } else {\n      console.log(`❌ 100-iteration validation: NON-DETERMINISTIC`);\n      console.log(`   Found ${extendedHashes.size} different hashes`);\n      results.overall.failed++;\n    }\n    console.log();\n    \n    // Test 5: Component Validation\n    console.log('🧩 Running component validation...');\n    \n    const componentTests = {\n      timestamp: {\n        test: () => {\n          const ts1 = getDeterministicTimestamp();\n          const ts2 = getDeterministicTimestamp();\n          return ts1 === ts2;\n        },\n        name: 'Deterministic Timestamp'\n      },\n      random: {\n        test: () => {\n          const r1 = deterministicRandom.random('test');\n          const r2 = deterministicRandom.random('test');\n          return r1 === r2 && r1 >= 0 && r1 <= 1;\n        },\n        name: 'Deterministic Random'\n      },\n      uuid: {\n        test: () => {\n          const u1 = deterministicRandom.uuid('test', 'content');\n          const u2 = deterministicRandom.uuid('test', 'content');\n          return u1 === u2 && u1.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[45][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);\n        },\n        name: 'Deterministic UUID'\n      },\n      canonical: {\n        test: () => {\n          const obj1 = { b: 2, a: 1, c: { z: 26, y: 25 } };\n          const obj2 = { c: { y: 25, z: 26 }, a: 1, b: 2 };\n          return canonicalStringify(obj1) === canonicalStringify(obj2);\n        },\n        name: 'Canonical Serialization'\n      }\n    };\n    \n    let componentsPassed = 0;\n    const componentResults = {};\n    \n    for (const [key, component] of Object.entries(componentTests)) {\n      try {\n        const passed = component.test();\n        componentResults[key] = { passed, name: component.name };\n        \n        if (passed) {\n          console.log(`   ✅ ${component.name}: PASSED`);\n          componentsPassed++;\n        } else {\n          console.log(`   ❌ ${component.name}: FAILED`);\n        }\n      } catch (error) {\n        componentResults[key] = { passed: false, name: component.name, error: error.message };\n        console.log(`   ❌ ${component.name}: ERROR - ${error.message}`);\n      }\n    }\n    \n    results.tests.components = componentResults;\n    \n    if (componentsPassed === Object.keys(componentTests).length) {\n      console.log(`✅ Component validation: ALL PASSED (${componentsPassed}/${Object.keys(componentTests).length})`);\n      results.overall.passed++;\n    } else {\n      console.log(`❌ Component validation: PARTIAL FAILURE (${componentsPassed}/${Object.keys(componentTests).length} passed)`);\n      results.overall.failed++;\n    }\n    \n    console.log();\n    \n  } catch (error) {\n    console.error('❌ Test execution error:', error.message);\n    results.error = error.message;\n    results.overall.failed++;\n  }\n  \n  // Final Results\n  console.log('📊 MIGRATION VALIDATION RESULTS');\n  console.log('=' .repeat(60));\n  console.log(`Total Tests: ${results.overall.passed + results.overall.failed}`);\n  console.log(`Passed: ${results.overall.passed}`);\n  console.log(`Failed: ${results.overall.failed}`);\n  \n  const success = results.overall.failed === 0;\n  if (success) {\n    console.log();\n    console.log('🎉 MIGRATION VALIDATION: SUCCESS');\n    console.log('✅ All tests passed - deterministic system migration complete!');\n    console.log();\n    console.log('Key Results:');\n    if (results.tests.tenIterationValidation?.success) {\n      console.log(`   • 10-iteration validation: DETERMINISTIC (${results.tests.tenIterationValidation.contentHash?.substring(0, 16)}...)`);\n    }\n    if (results.tests.hundredIterationValidation?.success) {\n      console.log(`   • 100-iteration validation: DETERMINISTIC (${results.tests.hundredIterationValidation.contentHash?.substring(0, 16)}...)`);\n    }\n  } else {\n    console.log();\n    console.log('❌ MIGRATION VALIDATION: FAILED');\n    console.log(`   ${results.overall.failed} tests failed - system needs attention`);\n  }\n  \n  console.log();\n  \n  // Save results\n  try {\n    const fs = await import('fs/promises');\n    await fs.writeFile(\n      '/Users/sac/unjucks/packages/kgen-core/src/deterministic/migration-test-results.json',\n      JSON.stringify(results, null, 2)\n    );\n    console.log('📁 Test results saved to: migration-test-results.json');\n  } catch (saveError) {\n    console.warn('⚠️  Could not save test results:', saveError.message);\n  }\n  \n  return success;\n}\n\n// Run tests if called directly\nif (import.meta.url === `file://${process.argv[1]}`) {\n  runMigrationTests()\n    .then(success => {\n      process.exit(success ? 0 : 1);\n    })\n    .catch(error => {\n      console.error('Fatal test error:', error);\n      process.exit(1);\n    });\n}\n\nexport default runMigrationTests;"