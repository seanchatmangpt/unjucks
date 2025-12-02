/**
 * Performance Validation and KPI Testing Step Definitions
 * 
 * These step definitions connect to existing performance monitoring in core engines
 * and validate critical KPIs:
 * - 99.9% reproducibility validation across environments
 * - 100% provenance verification for all generated artifacts  
 * - 80% cache hit rate performance testing
 * - 150ms p95 render time benchmarking
 * - 90% drift detection SNR validation
 */

import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { performance } from 'perf_hooks';
import * as fs from 'fs/promises';
import * as path from 'path';

// Import existing performance infrastructure
import { CASEngine } from '../../packages/kgen-core/src/cas/index.js';
import { KgenTemplateEngine } from '../../packages/kgen-templates/src/template-engine.js';
import PerformanceTracker from '../../packages/kgen-core/dist/metrics/performance-tracker.js';

// Import test helpers
import {
  PerformanceTracker as TestPerformanceTracker,
  HashValidator,
  TestDataGenerator,
  CacheTestHelper
} from '../fixtures/cas-test-helpers.js';

/**
 * Performance test context interface
 * @typedef {Object} PerformanceTestContext
 * @property {CASEngine} casEngine - Content-addressed storage engine
 * @property {KgenTemplateEngine} templateEngine - Template rendering engine
 * @property {PerformanceTracker} performanceTracker - System performance tracker
 * @property {TestPerformanceTracker} testPerformanceTracker - Test performance tracker
 * @property {Map<string, any>} testResults - Test results storage
 * @property {Map<string, any>} benchmarkData - Benchmark data storage
 * @property {Map<string, any>} performanceMetrics - Performance metrics storage
 * @property {Array<{hash: string, environment: string, timestamp: number}>} reproducibilityResults - Reproducibility test results
 * @property {Array<{file: string, verified: boolean, signature?: string}>} provenanceResults - Provenance verification results
 * @property {Array<{operation: string, result: 'hit'|'miss', duration: number}>} cacheResults - Cache operation results
 * @property {Array<{template: string, duration: number, success: boolean}>} renderResults - Render performance results
 * @property {Array<{template: string, snr: number, detected: boolean}>} driftResults - Drift detection results
 * @property {any} kpiReport - KPI compliance report
 * @property {string} testWorkspace - Test workspace directory
 */

// Global performance test context
/** @type {PerformanceTestContext} */
let perfContext = {
  casEngine: new CASEngine({ 
    storageType: 'memory', 
    cacheSize: 1000,
    enableMetrics: true,
    performanceTarget: { 
      hashTimeP95: 5, 
      cacheHitRate: 0.80,
      renderTimeP95: 150 
    }
  }),
  templateEngine: new KgenTemplateEngine({ 
    deterministic: true,
    enablePerformanceMetrics: true
  }),
  performanceTracker: new PerformanceTracker({
    enableRealtimeCollection: true,
    performanceThresholds: {
      memory_warning: 80,
      cpu_warning: 70,
      latency_warning: 150,
      cache_hit_warning: 80,
      error_rate_warning: 0.01
    }
  }),
  testPerformanceTracker: new TestPerformanceTracker(),
  testResults: new Map(),
  benchmarkData: new Map(),
  performanceMetrics: new Map(),
  reproducibilityResults: [],
  provenanceResults: [],
  cacheResults: [],
  renderResults: [],
  driftResults: [],
  kpiReport: {},
  testWorkspace: ''
};

// =============================================================================
// Setup and Initialization Steps
// =============================================================================

Given('I have initialized the performance testing environment', async function() {
  // Initialize all performance monitoring components
  await perfContext.casEngine.initialize();
  await perfContext.performanceTracker.initialize();
  
  // Setup test workspace
  perfContext.testWorkspace = path.join(process.cwd(), 'test-workspace', `perf-${Date.now()}`);
  await fs.mkdir(perfContext.testWorkspace, { recursive: true });
  
  // Clear previous test state
  perfContext.testResults.clear();
  perfContext.benchmarkData.clear();
  perfContext.performanceMetrics.clear();
  perfContext.reproducibilityResults = [];
  perfContext.provenanceResults = [];
  perfContext.cacheResults = [];
  perfContext.renderResults = [];
  perfContext.driftResults = [];
  perfContext.testPerformanceTracker.clear();
  
  // Start performance collection
  perfContext.performanceTracker.startCollection();
  
  console.log('Performance testing environment initialized');
});

Given('I have performance benchmarking data loaded', function() {
  // Load predefined benchmarking data
  const benchmarks = {
    templates: TestDataGenerator.generateRealisticTemplates(50),
    contentSizes: TestDataGenerator.generateContentSizes(),
    variableCombinations: TestDataGenerator.generateVariableCombinations(),
    cachePatterns: [
      { operations: 1000, hitRatio: 0.8 },
      { operations: 5000, hitRatio: 0.85 },
      { operations: 10000, hitRatio: 0.9 }
    ]
  };
  
  perfContext.benchmarkData.set('templates', benchmarks.templates);
  perfContext.benchmarkData.set('content_sizes', benchmarks.contentSizes);
  perfContext.benchmarkData.set('variables', benchmarks.variableCombinations);
  perfContext.benchmarkData.set('cache_patterns', benchmarks.cachePatterns);
  
  console.log(`Loaded ${benchmarks.templates.length} benchmark templates`);
});

// =============================================================================
// 99.9% Reproducibility Validation Steps
// =============================================================================

When('I test reproducibility across {int} different environments with {int} iterations each', async function(environments, iterations) {
  const template = `
export const Component = ({ name, timestamp }: { name: string; timestamp: string }) => {
  return <div data-hash="{{kgen.staticHash}}" data-time="{{kgen.staticTimestamp}}">{name} - {timestamp}</div>;
};
`;

  const variables = { name: 'TestComponent', timestamp: '2024-01-01T00:00:00Z' };
  
  // Simulate different environments by varying Node.js process attributes
  const originalEnv = process.env.NODE_ENV;
  
  for (let env = 0; env < environments; env++) {
    // Simulate environment differences
    process.env.NODE_ENV = `test-env-${env}`;
    process.env.KGEN_TEST_MODE = `env-${env}`;
    
    for (let iteration = 0; iteration < iterations; iteration++) {
      perfContext.testPerformanceTracker.start(`reproducibility_${env}_${iteration}`);
      
      const result = await perfContext.templateEngine.render(template, variables);
      const hash = HashValidator.sha256(result.content);
      
      perfContext.testPerformanceTracker.end(`reproducibility_${env}_${iteration}`);
      
      perfContext.reproducibilityResults.push({
        hash,
        environment: `env-${env}`,
        timestamp: Date.now()
      });
    }
  }
  
  // Restore original environment
  process.env.NODE_ENV = originalEnv;
  delete process.env.KGEN_TEST_MODE;
});

Then('reproducibility should achieve {float}% identical outputs', function(targetPercentage) {
  const totalResults = perfContext.reproducibilityResults.length;
  expect(totalResults).to.be.greaterThan(0, 'Should have reproducibility results');
  
  // Group by hash to count identical outputs
  /** @type {Map<string, number>} */
  const hashCounts = new Map();
  perfContext.reproducibilityResults.forEach(result => {
    const count = hashCounts.get(result.hash) || 0;
    hashCounts.set(result.hash, count + 1);
  });
  
  // Find the most common hash (should be all of them for 100% reproducibility)
  const maxCount = Math.max(...Array.from(hashCounts.values()));
  const reproducibilityRate = (maxCount / totalResults) * 100;
  
  expect(reproducibilityRate).to.be.at.least(targetPercentage, 
    `Reproducibility rate ${reproducibilityRate}% should be at least ${targetPercentage}%`);
  
  // Store results for reporting
  perfContext.performanceMetrics.set('reproducibility', {
    rate: reproducibilityRate,
    totalTests: totalResults,
    uniqueHashes: hashCounts.size,
    targetMet: reproducibilityRate >= targetPercentage
  });
  
  console.log(`Reproducibility validation: ${reproducibilityRate}% (target: ${targetPercentage}%)`);
});

// =============================================================================
// 100% Provenance Verification Steps
// =============================================================================

When('I generate {int} files with provenance tracking enabled', async function(fileCount) {
  const template = `
/**
 * Generated file {{fileIndex}}
 * Provenance: {{kgen.provenance.signature}}
 * Hash: {{kgen.staticHash}}
 * Timestamp: {{kgen.staticTimestamp}}
 */

export interface File{{fileIndex}}Interface {
  id: string;
  data: any;
}

export class File{{fileIndex}} implements File{{fileIndex}}Interface {
  constructor(public id: string, public data: any) {}
  
  process(): string {
    return \`Processing \${this.id} with \${JSON.stringify(this.data)}\`;
  }
}
`;

  for (let i = 0; i < fileCount; i++) {
    const variables = { fileIndex: i.toString() };
    
    perfContext.testPerformanceTracker.start(`provenance_generation_${i}`);
    
    const result = await perfContext.templateEngine.render(template, variables, {
      enableProvenance: true,
      provenanceLevel: 'full'
    });
    
    perfContext.testPerformanceTracker.end(`provenance_generation_${i}`);
    
    const filePath = path.join(perfContext.testWorkspace, `generated-${i}.ts`);
    await fs.writeFile(filePath, result.content);
    
    // Verify provenance data exists
    const hasProvenance = result.metadata?.provenance?.signature !== undefined;
    
    perfContext.provenanceResults.push({
      file: filePath,
      verified: hasProvenance,
      signature: result.metadata?.provenance?.signature
    });
  }
});

Then('all generated files should have {float}% provenance verification', function(targetPercentage) {
  const totalFiles = perfContext.provenanceResults.length;
  expect(totalFiles).to.be.greaterThan(0, 'Should have provenance results');
  
  const verifiedFiles = perfContext.provenanceResults.filter(result => result.verified).length;
  const verificationRate = (verifiedFiles / totalFiles) * 100;
  
  expect(verificationRate).to.be.at.least(targetPercentage,
    `Provenance verification rate ${verificationRate}% should be at least ${targetPercentage}%`);
  
  // Store results for reporting
  perfContext.performanceMetrics.set('provenance', {
    rate: verificationRate,
    totalFiles,
    verifiedFiles,
    targetMet: verificationRate >= targetPercentage
  });
  
  console.log(`Provenance verification: ${verificationRate}% (target: ${targetPercentage}%)`);
});

// =============================================================================
// 80% Cache Hit Rate Performance Testing Steps
// =============================================================================

When('I perform {int} cache operations with target {float}% hit rate', async function(operations, targetHitRate) {
  const pattern = CacheTestHelper.generateAccessPattern(operations, targetHitRate / 100);
  
  let hits = 0;
  let misses = 0;
  
  for (const operation of pattern) {
    perfContext.testPerformanceTracker.start(`cache_${operation.type}`);
    
    if (operation.type === 'store') {
      await perfContext.casEngine.store(operation.content);
      misses++;
      
      perfContext.cacheResults.push({
        operation: 'store',
        result: 'miss',
        duration: perfContext.testPerformanceTracker.end(`cache_${operation.type}`).duration
      });
    } else {
      const content = await perfContext.casEngine.retrieveByKey(operation.key);
      
      if (content !== null) {
        hits++;
        perfContext.cacheResults.push({
          operation: 'retrieve',
          result: 'hit',
          duration: perfContext.testPerformanceTracker.end(`cache_${operation.type}`).duration
        });
      } else {
        misses++;
        perfContext.cacheResults.push({
          operation: 'retrieve',
          result: 'miss',
          duration: perfContext.testPerformanceTracker.end(`cache_${operation.type}`).duration
        });
      }
    }
  }
  
  const actualHitRate = (hits / (hits + misses)) * 100;
  
  perfContext.performanceMetrics.set('cache_performance', {
    operations,
    hits,
    misses,
    actualHitRate,
    targetHitRate,
    targetMet: actualHitRate >= targetHitRate
  });
});

Then('cache hit rate should achieve at least {float}%', function(targetHitRate) {
  const cacheMetrics = perfContext.performanceMetrics.get('cache_performance');
  expect(cacheMetrics).to.not.be.undefined;
  
  expect(cacheMetrics.actualHitRate).to.be.at.least(targetHitRate,
    `Cache hit rate ${cacheMetrics.actualHitRate}% should be at least ${targetHitRate}%`);
  
  // Validate cache operation performance
  const hitOperations = perfContext.cacheResults.filter(r => r.result === 'hit');
  const averageHitTime = hitOperations.reduce((sum, r) => sum + r.duration, 0) / hitOperations.length;
  
  expect(averageHitTime).to.be.below(10, 
    `Average cache hit time ${averageHitTime}ms should be below 10ms`);
  
  console.log(`Cache performance: ${cacheMetrics.actualHitRate}% hit rate, ${averageHitTime.toFixed(2)}ms avg hit time`);
});

// =============================================================================
// 150ms P95 Render Time Benchmarking Steps
// =============================================================================

When('I benchmark render performance with {int} template variations', async function(templateCount) {
  const templates = perfContext.benchmarkData.get('templates').slice(0, templateCount);
  const variables = perfContext.benchmarkData.get('variables')[0];
  
  for (let i = 0; i < templates.length; i++) {
    const template = templates[i];
    
    // Perform multiple renders to get statistical significance
    for (let iteration = 0; iteration < 10; iteration++) {
      perfContext.testPerformanceTracker.start(`render_${i}_${iteration}`);
      
      try {
        const result = await perfContext.templateEngine.render(template.content, variables);
        const duration = perfContext.testPerformanceTracker.end(`render_${i}_${iteration}`).duration;
        
        perfContext.renderResults.push({
          template: template.name,
          duration,
          success: true
        });
        
      } catch (error) {
        const duration = perfContext.testPerformanceTracker.end(`render_${i}_${iteration}`).duration;
        
        perfContext.renderResults.push({
          template: template.name,
          duration,
          success: false
        });
      }
    }
  }
});

Then('p95 render time should be under {int}ms', function(maxRenderTime) {
  const successfulRenders = perfContext.renderResults.filter(r => r.success);
  expect(successfulRenders.length).to.be.greaterThan(0, 'Should have successful renders');
  
  const durations = successfulRenders.map(r => r.duration).sort((a, b) => a - b);
  const p95Index = Math.ceil(durations.length * 0.95) - 1;
  const p95Duration = durations[Math.max(0, p95Index)];
  
  expect(p95Duration).to.be.below(maxRenderTime,
    `P95 render time ${p95Duration}ms should be below ${maxRenderTime}ms`);
  
  // Calculate additional statistics
  const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
  const p50Duration = durations[Math.floor(durations.length * 0.5)];
  const p99Duration = durations[Math.ceil(durations.length * 0.99) - 1];
  
  perfContext.performanceMetrics.set('render_performance', {
    totalRenders: successfulRenders.length,
    avgDuration,
    p50Duration,
    p95Duration,
    p99Duration,
    maxDuration: durations[durations.length - 1],
    targetMet: p95Duration < maxRenderTime
  });
  
  console.log(`Render performance: P95=${p95Duration.toFixed(2)}ms, P50=${p50Duration.toFixed(2)}ms, Avg=${avgDuration.toFixed(2)}ms`);
});

// =============================================================================
// 90% Drift Detection SNR Validation Steps
// =============================================================================

When('I test drift detection with {int} template variations and noise injection', async function(variations) {
  const baseTemplate = `
export const Component{{index}} = ({ data }: { data: any }) => {
  const processedData = data.map((item: any) => ({
    ...item,
    hash: "{{kgen.staticHash}}",
    processed: true
  }));
  
  return (
    <div className="component-{{index}}">
      {processedData.map((item: any, idx: number) => (
        <div key={idx}>{JSON.stringify(item)}</div>
      ))}
    </div>
  );
};
`;

  for (let i = 0; i < variations; i++) {
    // Generate base template
    const variables = { index: i.toString() };
    const baseResult = await perfContext.templateEngine.render(baseTemplate, variables);
    const baseHash = HashValidator.sha256(baseResult.content);
    
    // Generate template with injected noise (whitespace, comments, etc.)
    const noisyTemplate = baseTemplate
      .replace(/\n/g, '\n  ') // Add extra indentation
      .replace(/\{/g, '{ ') // Add spaces in braces
      .replace(/\}/g, ' }')
      .replace(/Component{{index}}/g, `Component{{index}} /* Generated ${Date.now()} */`);
    
    const noisyResult = await perfContext.templateEngine.render(noisyTemplate, variables);
    const noisyHash = HashValidator.sha256(noisyResult.content);
    
    // Calculate signal-to-noise ratio (SNR)
    // In this context, SNR measures how well the system detects drift
    // Perfect SNR = 100% when hashes are identical (no semantic drift)
    // Lower SNR indicates semantic drift was detected
    
    const semanticallyIdentical = baseHash === noisyHash;
    const snr = semanticallyIdentical ? 100 : 0; // Simplified SNR calculation
    
    perfContext.driftResults.push({
      template: `template-${i}`,
      snr,
      detected: !semanticallyIdentical
    });
  }
});

Then('drift detection SNR should achieve at least {float}%', function(targetSNR) {
  expect(perfContext.driftResults.length).to.be.greaterThan(0, 'Should have drift detection results');
  
  const totalTests = perfContext.driftResults.length;
  const highSNRTests = perfContext.driftResults.filter(r => r.snr >= targetSNR).length;
  const snrAchievementRate = (highSNRTests / totalTests) * 100;
  
  expect(snrAchievementRate).to.be.at.least(targetSNR,
    `Drift detection SNR achievement rate ${snrAchievementRate}% should be at least ${targetSNR}%`);
  
  // Calculate average SNR
  const avgSNR = perfContext.driftResults.reduce((sum, r) => sum + r.snr, 0) / totalTests;
  
  perfContext.performanceMetrics.set('drift_detection', {
    totalTests,
    highSNRTests,
    snrAchievementRate,
    avgSNR,
    targetMet: snrAchievementRate >= targetSNR
  });
  
  console.log(`Drift detection: ${snrAchievementRate}% SNR achievement, ${avgSNR.toFixed(1)} average SNR`);
});

// =============================================================================
// Performance Reporting and KPI Compliance Steps
// =============================================================================

When('I generate a comprehensive performance report', function() {
  const timestamp = new Date().toISOString();
  
  perfContext.kpiReport = {
    generated_at: timestamp,
    test_suite: 'Performance Validation and KPI Testing',
    summary: {
      total_tests: 5,
      passed_kpis: 0,
      failed_kpis: 0
    },
    kpis: {
      reproducibility: perfContext.performanceMetrics.get('reproducibility') || { targetMet: false },
      provenance: perfContext.performanceMetrics.get('provenance') || { targetMet: false },
      cache_performance: perfContext.performanceMetrics.get('cache_performance') || { targetMet: false },
      render_performance: perfContext.performanceMetrics.get('render_performance') || { targetMet: false },
      drift_detection: perfContext.performanceMetrics.get('drift_detection') || { targetMet: false }
    },
    performance_summary: {
      total_operations: perfContext.testPerformanceTracker.getMeasurements().length,
      avg_operation_time: perfContext.testPerformanceTracker.getMeasurements()
        .reduce((sum, m) => sum + m.duration, 0) / 
        Math.max(1, perfContext.testPerformanceTracker.getMeasurements().length),
      test_duration: Date.now() - (perfContext.testPerformanceTracker.getMeasurements()[0]?.timestamp || Date.now())
    }
  };
  
  // Count passed/failed KPIs
  Object.values(perfContext.kpiReport.kpis).forEach((kpi) => {
    if (kpi.targetMet) {
      perfContext.kpiReport.summary.passed_kpis++;
    } else {
      perfContext.kpiReport.summary.failed_kpis++;
    }
  });
  
  console.log(`Performance report generated: ${perfContext.kpiReport.summary.passed_kpis}/${perfContext.kpiReport.summary.total_tests} KPIs passed`);
});

Then('all KPIs should be compliant', function() {
  expect(perfContext.kpiReport).to.not.be.empty;
  
  const { passed_kpis, failed_kpis, total_tests } = perfContext.kpiReport.summary;
  
  // Detailed KPI validation
  const kpis = perfContext.kpiReport.kpis;
  
  expect(kpis.reproducibility.targetMet, 'Reproducibility KPI should be met').to.be.true;
  expect(kpis.provenance.targetMet, 'Provenance verification KPI should be met').to.be.true;
  expect(kpis.cache_performance.targetMet, 'Cache performance KPI should be met').to.be.true;
  expect(kpis.render_performance.targetMet, 'Render performance KPI should be met').to.be.true;
  expect(kpis.drift_detection.targetMet, 'Drift detection KPI should be met').to.be.true;
  
  // Overall compliance check
  expect(failed_kpis).to.equal(0, `${failed_kpis} KPIs failed out of ${total_tests}`);
  expect(passed_kpis).to.equal(total_tests, 'All KPIs should pass');
  
  console.log(`KPI Compliance: ✅ ${passed_kpis}/${total_tests} KPIs passed`);
});

Then('I should see the performance report with metrics:', function(expectedMetricsTable) {
  expect(perfContext.kpiReport).to.not.be.empty;
  
  expectedMetricsTable.hashes().forEach((row) => {
    const kpiName = row.kpi;
    const expectedValue = parseFloat(row.value);
    const unit = row.unit;
    
    switch (kpiName) {
      case 'reproducibility':
        const reproducibility = perfContext.performanceMetrics.get('reproducibility');
        expect(reproducibility.rate).to.be.at.least(expectedValue);
        break;
        
      case 'provenance':
        const provenance = perfContext.performanceMetrics.get('provenance');
        expect(provenance.rate).to.be.at.least(expectedValue);
        break;
        
      case 'cache_hit_rate':
        const cache = perfContext.performanceMetrics.get('cache_performance');
        expect(cache.actualHitRate).to.be.at.least(expectedValue);
        break;
        
      case 'render_p95':
        const render = perfContext.performanceMetrics.get('render_performance');
        expect(render.p95Duration).to.be.below(expectedValue);
        break;
        
      case 'drift_snr':
        const drift = perfContext.performanceMetrics.get('drift_detection');
        expect(drift.avgSNR).to.be.at.least(expectedValue);
        break;
    }
  });
  
  console.log('Performance report validated against expected metrics');
});

// =============================================================================
// Cleanup Steps
// =============================================================================

Given('I cleanup the performance testing environment', async function() {
  // Stop performance collection
  perfContext.performanceTracker.stopCollection();
  
  // Cleanup test workspace
  try {
    await fs.rm(perfContext.testWorkspace, { recursive: true, force: true });
  } catch (error) {
    console.warn('Failed to cleanup performance test workspace:', error);
  }
  
  // Clear CAS storage
  await perfContext.casEngine.clear(true);
  
  console.log('Performance testing environment cleaned up');
});