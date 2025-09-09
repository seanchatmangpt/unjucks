#!/usr/bin/env node

/**
 * Validate Caching Effectiveness
 * Ensures caching mechanisms are working optimally
 */

import fs from 'fs/promises';
import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// Import unjucks to test caching directly
import unjucks from '../../src/index.js';

class CacheValidator {
  constructor(options = {}) {
    this.options = {
      cacheHitThreshold: 85, // Minimum cache hit rate percentage
      cacheMissPenaltyMax: 2.0, // Maximum acceptable penalty for cache misses
      testIterations: 1000,
      templateTypes: ['simple', 'complex', 'nested'],
      outputFile: null,
      ...options
    };

    this.results = {
      timestamp: new Date().toISOString(),
      cacheAnalysis: {},
      performance: {},
      validation: {
        passed: false,
        issues: [],
        recommendations: []
      }
    };
  }

  async setupTestEnvironment() {
    const testDir = path.join(process.cwd(), 'tests', 'fixtures', 'cache-validation');
    await fs.mkdir(testDir, { recursive: true });

    const templates = {
      simple: {
        template: 'Hello {{ name }}! Your score is {{ score | number(2) }}.',
        data: { name: 'CacheTest', score: 95.67 }
      },
      
      complex: {
        template: `
<div class="cache-test">
  <h1>{{ title | title }}</h1>
  {% if users.length > 0 %}
    <ul>
    {% for user in users %}
      <li>{{ user.name | title }} - {{ user.email | lower }}</li>
    {% endfor %}
    </ul>
  {% endif %}
  <p>Generated: {{ timestamp | dateFormat("YYYY-MM-DD HH:mm:ss") }}</p>
</div>`,
        data: {
          title: 'cache validation test',
          timestamp: new Date(),
          users: Array.from({ length: 20 }, (_, i) => ({
            name: `User ${i + 1}`,
            email: `user${i + 1}@example.com`
          }))
        }
      },
      
      nested: {
        template: `
{% for section in sections %}
## {{ section.title }}
{% for item in section.items %}
  - {{ item.name }}: {{ item.value | number(2) }}
  {% for detail in item.details %}
    - {{ detail.key }}: {{ detail.value }}
  {% endfor %}
{% endfor %}
{% endfor %}`,
        data: {
          sections: Array.from({ length: 5 }, (_, sectionIndex) => ({
            title: `Section ${sectionIndex + 1}`,
            items: Array.from({ length: 10 }, (_, itemIndex) => ({
              name: `Item ${itemIndex + 1}`,
              value: Math.random() * 100,
              details: Array.from({ length: 3 }, (_, detailIndex) => ({
                key: `Detail ${detailIndex + 1}`,
                value: `Value ${detailIndex + 1}`
              }))
            }))
          }))
        }
      }
    };

    for (const [type, { template, data }] of Object.entries(templates)) {
      await fs.writeFile(path.join(testDir, `${type}.njk`), template);
      await fs.writeFile(path.join(testDir, `${type}-data.json`), JSON.stringify(data, null, 2));
    }

    return testDir;
  }

  async measureCachePerformance(templatePath, data, iterations) {
    const timings = {
      cold: [], // First render (no cache)
      warm: [], // Subsequent renders (with cache)
      withData: [], // Different data, same template
      modified: [] // Modified template (cache invalidation)
    };

    // Cold cache test (first render)
    const coldStart = process.hrtime.bigint();
    await unjucks.renderString(await fs.readFile(templatePath, 'utf8'), data);
    const coldEnd = process.hrtime.bigint();
    timings.cold.push(Number(coldEnd - coldStart) / 1000000); // Convert to ms

    // Warm cache test (same template, same data)
    for (let i = 0; i < iterations; i++) {
      const warmStart = process.hrtime.bigint();
      await unjucks.renderString(await fs.readFile(templatePath, 'utf8'), data);
      const warmEnd = process.hrtime.bigint();
      timings.warm.push(Number(warmEnd - warmStart) / 1000000);
    }

    // Different data test (template cached, data varies)
    for (let i = 0; i < Math.floor(iterations / 2); i++) {
      const variedData = { ...data, iteration: i, timestamp: new Date() };
      const dataStart = process.hrtime.bigint();
      await unjucks.renderString(await fs.readFile(templatePath, 'utf8'), variedData);
      const dataEnd = process.hrtime.bigint();
      timings.withData.push(Number(dataEnd - dataStart) / 1000000);
    }

    return timings;
  }

  async runCacheValidation() {
    console.log('Running cache validation tests...');
    const testDir = await this.setupTestEnvironment();

    for (const templateType of this.options.templateTypes) {
      console.log(`Testing ${templateType} template caching...`);
      
      const templatePath = path.join(testDir, `${templateType}.njk`);
      const dataPath = path.join(testDir, `${templateType}-data.json`);
      const data = JSON.parse(await fs.readFile(dataPath, 'utf8'));

      const timings = await this.measureCachePerformance(templatePath, data, this.options.testIterations);
      
      const analysis = this.analyzeCachePerformance(timings, templateType);
      this.results.cacheAnalysis[templateType] = analysis;
    }

    this.results.performance = this.aggregatePerformanceResults();
    this.validateCacheEffectiveness();

    return this.results;
  }

  analyzeCachePerformance(timings, templateType) {
    const analysis = {
      templateType,
      coldTime: timings.cold[0],
      warmTimes: {
        average: timings.warm.reduce((a, b) => a + b, 0) / timings.warm.length,
        min: Math.min(...timings.warm),
        max: Math.max(...timings.warm),
        median: this.calculateMedian(timings.warm),
        p95: timings.warm.sort((a, b) => a - b)[Math.floor(timings.warm.length * 0.95)]
      },
      dataVariationTimes: {
        average: timings.withData.reduce((a, b) => a + b, 0) / timings.withData.length,
        min: Math.min(...timings.withData),
        max: Math.max(...timings.withData)
      }
    };

    // Calculate cache effectiveness metrics
    analysis.cacheSpeedup = analysis.coldTime / analysis.warmTimes.average;
    analysis.cacheHitRatio = this.estimateCacheHitRatio(analysis);
    analysis.cacheMissPenalty = analysis.dataVariationTimes.average / analysis.warmTimes.average;
    
    // Performance consistency
    analysis.consistency = {
      coefficientOfVariation: this.calculateCV(timings.warm),
      warmCacheStability: (analysis.warmTimes.max - analysis.warmTimes.min) / analysis.warmTimes.average
    };

    return analysis;
  }

  estimateCacheHitRatio(analysis) {
    // Estimate cache hit ratio based on the speedup achieved
    // If we see significant speedup, cache is likely working well
    
    const speedup = analysis.cacheSpeedup;
    
    if (speedup >= 10) return 95;   // Excellent caching
    if (speedup >= 5) return 85;    // Good caching
    if (speedup >= 3) return 70;    // Moderate caching
    if (speedup >= 2) return 50;    // Basic caching
    return 25;                      // Poor/no caching
  }

  calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  }

  calculateCV(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    return stdDev / mean;
  }

  aggregatePerformanceResults() {
    const analyses = Object.values(this.results.cacheAnalysis);
    
    if (analyses.length === 0) return {};

    return {
      averageCacheSpeedup: analyses.reduce((sum, a) => sum + a.cacheSpeedup, 0) / analyses.length,
      averageCacheHitRatio: analyses.reduce((sum, a) => sum + a.cacheHitRatio, 0) / analyses.length,
      averageCacheMissPenalty: analyses.reduce((sum, a) => sum + a.cacheMissPenalty, 0) / analyses.length,
      consistencyScore: analyses.reduce((sum, a) => sum + (1 - a.consistency.coefficientOfVariation), 0) / analyses.length,
      
      // Template-specific performance
      templatePerformance: analyses.map(a => ({
        type: a.templateType,
        speedup: a.cacheSpeedup,
        hitRatio: a.cacheHitRatio,
        consistency: a.consistency.coefficientOfVariation
      }))
    };
  }

  validateCacheEffectiveness() {
    const perf = this.results.performance;
    const issues = [];
    const recommendations = [];

    // Check cache hit ratio
    if (perf.averageCacheHitRatio < this.options.cacheHitThreshold) {
      issues.push({
        type: 'low_cache_hit_ratio',
        severity: 'high',
        message: `Average cache hit ratio (${perf.averageCacheHitRatio.toFixed(1)}%) below threshold (${this.options.cacheHitThreshold}%)`,
        impact: 'Performance degradation due to frequent cache misses'
      });

      recommendations.push({
        type: 'cache_tuning',
        priority: 'high',
        title: 'Improve Cache Hit Ratio',
        actions: [
          'Review cache size limits and adjust if needed',
          'Analyze cache eviction policies and patterns',
          'Consider implementing more aggressive caching strategies',
          'Check for cache invalidation logic that might be too sensitive'
        ]
      });
    }

    // Check cache miss penalty
    if (perf.averageCacheMissPenalty > this.options.cacheMissPenaltyMax) {
      issues.push({
        type: 'high_cache_miss_penalty',
        severity: 'medium',
        message: `Cache miss penalty (${perf.averageCacheMissPenalty.toFixed(2)}x) exceeds threshold (${this.options.cacheMissPenaltyMax}x)`,
        impact: 'High cost for cache misses reducing overall performance'
      });

      recommendations.push({
        type: 'cache_optimization',
        priority: 'medium',
        title: 'Reduce Cache Miss Penalty',
        actions: [
          'Optimize template compilation and parsing performance',
          'Implement partial template caching for complex templates',
          'Consider pre-warming cache for frequently used templates',
          'Review template complexity and simplify where possible'
        ]
      });
    }

    // Check cache speedup effectiveness
    if (perf.averageCacheSpeedup < 3.0) {
      issues.push({
        type: 'low_cache_speedup',
        severity: 'medium',
        message: `Average cache speedup (${perf.averageCacheSpeedup.toFixed(2)}x) indicates suboptimal caching`,
        impact: 'Cache not providing expected performance benefits'
      });

      recommendations.push({
        type: 'cache_strategy',
        priority: 'medium',
        title: 'Improve Cache Strategy',
        actions: [
          'Review what components are being cached',
          'Implement more granular caching levels',
          'Cache parsed templates separately from rendered output',
          'Consider implementing multi-level caching architecture'
        ]
      });
    }

    // Check performance consistency
    if (perf.consistencyScore < 0.8) {
      issues.push({
        type: 'inconsistent_performance',
        severity: 'low',
        message: `Performance consistency score (${(perf.consistencyScore * 100).toFixed(1)}%) indicates variable cache performance`,
        impact: 'Unpredictable performance characteristics'
      });

      recommendations.push({
        type: 'consistency',
        priority: 'low',
        title: 'Improve Performance Consistency',
        actions: [
          'Implement cache warming strategies',
          'Review garbage collection impact on cache performance',
          'Consider using more deterministic caching algorithms',
          'Monitor and address cache fragmentation'
        ]
      });
    }

    // Overall validation
    const passed = issues.filter(i => i.severity === 'high').length === 0;

    this.results.validation = {
      passed,
      issues,
      recommendations,
      summary: {
        cacheHitRatio: perf.averageCacheHitRatio,
        cacheSpeedup: perf.averageCacheSpeedup,
        cacheMissPenalty: perf.averageCacheMissPenalty,
        consistencyScore: perf.consistencyScore,
        criticalIssues: issues.filter(i => i.severity === 'high').length,
        totalIssues: issues.length
      }
    };
  }

  async saveValidationResults() {
    if (this.options.outputFile) {
      await fs.writeFile(this.options.outputFile, JSON.stringify(this.results, null, 2));
      console.log(`Cache validation results saved to: ${this.options.outputFile}`);
    }
  }

  printValidationSummary() {
    const validation = this.results.validation;
    const perf = this.results.performance;

    console.log('\n=== Cache Validation Summary ===');
    console.log(`Validation: ${validation.passed ? 'PASSED' : 'FAILED'}`);
    console.log(`Cache Hit Ratio: ${perf.averageCacheHitRatio.toFixed(1)}% (threshold: ${this.options.cacheHitThreshold}%)`);
    console.log(`Cache Speedup: ${perf.averageCacheSpeedup.toFixed(2)}x`);
    console.log(`Cache Miss Penalty: ${perf.averageCacheMissPenalty.toFixed(2)}x (max: ${this.options.cacheMissPenaltyMax}x)`);
    console.log(`Performance Consistency: ${(perf.consistencyScore * 100).toFixed(1)}%`);

    if (validation.issues.length > 0) {
      console.log('\n=== Issues Detected ===');
      validation.issues.forEach((issue, index) => {
        console.log(`${index + 1}. [${issue.severity.toUpperCase()}] ${issue.message}`);
        console.log(`   Impact: ${issue.impact}`);
      });
    }

    if (validation.recommendations.length > 0) {
      console.log('\n=== Recommendations ===');
      validation.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. [${rec.priority.toUpperCase()}] ${rec.title}`);
        rec.actions.forEach(action => {
          console.log(`   • ${action}`);
        });
        console.log('');
      });
    }

    console.log('\n=== Template-Specific Performance ===');
    perf.templatePerformance.forEach(template => {
      console.log(`${template.type}: ${template.speedup.toFixed(2)}x speedup, ${template.hitRatio.toFixed(1)}% hit ratio`);
    });
  }
}

// CLI Interface
async function main() {
  const argv = yargs(hideBin(process.argv))
    .option('cache-hit-threshold', {
      type: 'number',
      default: 85,
      describe: 'Minimum acceptable cache hit rate percentage'
    })
    .option('cache-miss-penalty-max', {
      type: 'number',
      default: 2.0,
      describe: 'Maximum acceptable cache miss penalty multiplier'
    })
    .option('test-iterations', {
      type: 'number',
      default: 1000,
      describe: 'Number of test iterations for cache performance'
    })
    .option('output', {
      alias: 'o',
      type: 'string',
      describe: 'Output file for validation results'
    })
    .help()
    .argv;

  try {
    const validator = new CacheValidator({
      cacheHitThreshold: argv.cacheHitThreshold,
      cacheMissPenaltyMax: argv.cacheMissPenaltyMax,
      testIterations: argv.testIterations,
      outputFile: argv.output
    });

    await validator.runCacheValidation();
    await validator.saveValidationResults();
    validator.printValidationSummary();

    // Exit with error if validation failed
    if (!validator.results.validation.passed) {
      console.error('\nCache validation failed - exiting with error');
      process.exit(1);
    }

  } catch (error) {
    console.error('Cache validation failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { CacheValidator };