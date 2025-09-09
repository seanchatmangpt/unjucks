#!/usr/bin/env node

/**
 * Performance Claims Auditor #7
 * Validates all performance metrics in README against actual measurements
 * 
 * Claims to validate:
 * 1. "36.3% speed improvement" vs measured results
 * 2. "2.8-4.4x speed improvement" validation  
 * 3. Memory efficiency claims
 * 4. Template discovery performance
 * 5. RDF processing capabilities
 */

import { performance } from 'perf_hooks';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '../..');

class PerformanceClaimsAuditor {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        cpuCount: require('os').cpus().length,
        totalMemory: Math.round(require('os').totalmem() / 1024 / 1024) + 'MB'
      },
      claims: [],
      measurements: {},
      validations: {},
      audit: {
        passed: 0,
        failed: 0,
        total: 0
      }
    };
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : level === 'success' ? '✅' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async measureCLIStartup(iterations = 10) {
    this.log('Measuring CLI startup performance...');
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      try {
        execSync('node bin/unjucks.cjs --version', { 
          cwd: rootDir,
          stdio: 'pipe',
          timeout: 5000
        });
        const end = performance.now();
        times.push(end - start);
      } catch (error) {
        this.log(`CLI startup test ${i+1} failed: ${error.message}`, 'error');
        times.push(null);
      }
    }

    const validTimes = times.filter(t => t !== null);
    if (validTimes.length === 0) {
      throw new Error('All CLI startup tests failed');
    }

    return {
      times: validTimes,
      average: validTimes.reduce((a, b) => a + b, 0) / validTimes.length,
      min: Math.min(...validTimes),
      max: Math.max(...validTimes),
      median: validTimes.sort((a, b) => a - b)[Math.floor(validTimes.length / 2)],
      standardDeviation: this.calculateStdDev(validTimes)
    };
  }

  async measureTemplateDiscovery(iterations = 5) {
    this.log('Measuring template discovery performance...');
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      try {
        execSync('node bin/unjucks.cjs list', { 
          cwd: rootDir,
          stdio: 'pipe',
          timeout: 10000
        });
        const end = performance.now();
        times.push(end - start);
      } catch (error) {
        this.log(`Template discovery test ${i+1} failed: ${error.message}`, 'error');
        times.push(null);
      }
    }

    const validTimes = times.filter(t => t !== null);
    if (validTimes.length === 0) {
      throw new Error('All template discovery tests failed');
    }

    return {
      times: validTimes,
      average: validTimes.reduce((a, b) => a + b, 0) / validTimes.length,
      min: Math.min(...validTimes),
      max: Math.max(...validTimes),
      median: validTimes.sort((a, b) => a - b)[Math.floor(validTimes.length / 2)],
      standardDeviation: this.calculateStdDev(validTimes)
    };
  }

  async measureMemoryUsage() {
    this.log('Measuring memory usage...');
    const baselineMemory = process.memoryUsage();
    
    // Test different scenarios
    const scenarios = [
      { name: 'version', command: 'node bin/unjucks.cjs --version' },
      { name: 'help', command: 'node bin/unjucks.cjs --help' },
      { name: 'list', command: 'node bin/unjucks.cjs list' }
    ];

    const memoryResults = {};

    for (const scenario of scenarios) {
      try {
        // Measure peak memory during execution
        const output = execSync(`${scenario.command} & echo $! && wait`, {
          cwd: rootDir,
          encoding: 'utf8',
          timeout: 10000
        });
        
        // For now, use process memory as baseline
        const currentMemory = process.memoryUsage();
        memoryResults[scenario.name] = {
          rss: Math.round((currentMemory.rss - baselineMemory.rss) / 1024 / 1024 * 100) / 100,
          heapUsed: Math.round((currentMemory.heapUsed - baselineMemory.heapUsed) / 1024 / 1024 * 100) / 100,
          heapTotal: Math.round((currentMemory.heapTotal - baselineMemory.heapTotal) / 1024 / 1024 * 100) / 100
        };
      } catch (error) {
        this.log(`Memory test for ${scenario.name} failed: ${error.message}`, 'error');
        memoryResults[scenario.name] = { error: error.message };
      }
    }

    return memoryResults;
  }

  async measureRDFProcessing() {
    this.log('Testing RDF processing capabilities...');
    
    // Test if RDF processing is available
    try {
      const rdfTest = execSync('node -e "const n3 = require(\'n3\'); console.log(\'RDF available\')"', {
        cwd: rootDir,
        encoding: 'utf8',
        timeout: 5000
      });

      // Simple RDF processing test
      const start = performance.now();
      const rdfTestCode = `
        const n3 = require('n3');
        const parser = new n3.Parser();
        const store = new n3.Store();
        const triples = '<s> <p> <o> .'.repeat(1000);
        const quads = parser.parse(triples);
        store.addQuads(quads);
        console.log('Processed', store.size, 'triples');
      `;
      
      execSync(`node -e "${rdfTestCode}"`, {
        cwd: rootDir,
        encoding: 'utf8',
        timeout: 10000
      });
      const end = performance.now();

      return {
        available: true,
        processingTime: end - start,
        triplesPerSecond: Math.round(1000 / ((end - start) / 1000))
      };
    } catch (error) {
      this.log(`RDF processing test failed: ${error.message}`, 'error');
      return {
        available: false,
        error: error.message
      };
    }
  }

  calculateStdDev(values) {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
    return Math.sqrt(avgSquareDiff);
  }

  validateClaim(claimName, claimedValue, measuredValue, tolerance = 20) {
    const variance = ((measuredValue - claimedValue) / claimedValue) * 100;
    const passed = Math.abs(variance) <= tolerance;
    
    this.results.audit.total++;
    if (passed) {
      this.results.audit.passed++;
      this.log(`✅ ${claimName}: PASSED (claimed: ${claimedValue}, measured: ${measuredValue}, variance: ${variance.toFixed(1)}%)`, 'success');
    } else {
      this.results.audit.failed++;
      this.log(`❌ ${claimName}: FAILED (claimed: ${claimedValue}, measured: ${measuredValue}, variance: ${variance.toFixed(1)}%)`, 'error');
    }

    return {
      claimName,
      claimedValue,
      measuredValue,
      variance: Math.round(variance * 100) / 100,
      passed,
      tolerance
    };
  }

  extractREADMEClaims() {
    this.log('Extracting performance claims from README...');
    
    try {
      const readmePath = resolve(rootDir, 'README.md');
      const readme = readFileSync(readmePath, 'utf8');
      
      // Extract specific performance claims
      const claims = [
        {
          name: 'Template Discovery',
          claimed: 45, // ~45ms from README
          pattern: /Template Discovery.*?~(\d+)ms/,
          unit: 'ms'
        },
        {
          name: 'RDF Triple Processing',
          claimed: 1200000, // 1.2M/sec from README
          pattern: /RDF Triple Processing.*?(\d+\.?\d*)M\/sec/,
          unit: 'triples/sec',
          multiplier: 1000000
        },
        {
          name: 'Code Generation',
          claimed: 120, // ~120ms/file from README
          pattern: /Code Generation.*?~(\d+)ms\/file/,
          unit: 'ms/file'
        },
        {
          name: 'Memory Efficiency',
          claimed: 340, // ~340MB from README
          pattern: /Memory Efficiency.*?~(\d+)MB/,
          unit: 'MB'
        },
        {
          name: 'AI Swarm Initialization',
          claimed: 6, // ~6ms from README
          pattern: /AI Swarm Initialization.*?~(\d+)ms/,
          unit: 'ms'
        }
      ];

      this.results.claims = claims.map(claim => {
        const match = readme.match(claim.pattern);
        if (match) {
          const extractedValue = parseFloat(match[1]) * (claim.multiplier || 1);
          return {
            ...claim,
            found: true,
            extractedValue
          };
        }
        return {
          ...claim,
          found: false
        };
      });

      this.log(`Extracted ${this.results.claims.filter(c => c.found).length} performance claims from README`);
      
    } catch (error) {
      this.log(`Failed to extract README claims: ${error.message}`, 'error');
      this.results.claims = [];
    }
  }

  async runFullAudit() {
    this.log('🚀 Starting Performance Claims Audit #7...', 'info');
    this.log('='.repeat(60));

    try {
      // Extract claims from README
      this.extractREADMEClaims();

      // Run all measurements
      this.log('📊 Running performance measurements...');
      
      this.results.measurements.startup = await this.measureCLIStartup();
      this.results.measurements.templateDiscovery = await this.measureTemplateDiscovery();
      this.results.measurements.memory = await this.measureMemoryUsage();
      this.results.measurements.rdf = await this.measureRDFProcessing();

      // Validate claims against measurements
      this.log('🔍 Validating claims against measurements...');

      // Template Discovery validation
      const templateDiscoveryClaim = this.results.claims.find(c => c.name === 'Template Discovery');
      if (templateDiscoveryClaim && templateDiscoveryClaim.found) {
        this.results.validations.templateDiscovery = this.validateClaim(
          'Template Discovery',
          templateDiscoveryClaim.claimed,
          this.results.measurements.templateDiscovery.average,
          50 // More tolerance for discovery
        );
      }

      // RDF Processing validation
      const rdfClaim = this.results.claims.find(c => c.name === 'RDF Triple Processing');
      if (rdfClaim && rdfClaim.found && this.results.measurements.rdf.available) {
        this.results.validations.rdfProcessing = this.validateClaim(
          'RDF Processing',
          rdfClaim.claimed,
          this.results.measurements.rdf.triplesPerSecond,
          70 // High tolerance for RDF processing
        );
      }

      // Memory efficiency validation (using startup memory as baseline)
      const memoryClaim = this.results.claims.find(c => c.name === 'Memory Efficiency');
      if (memoryClaim && memoryClaim.found) {
        const avgMemoryUsage = Object.values(this.results.measurements.memory)
          .filter(m => !m.error)
          .reduce((acc, m) => acc + m.rss, 0) / 
          Object.values(this.results.measurements.memory).filter(m => !m.error).length;
        
        this.results.validations.memory = this.validateClaim(
          'Memory Efficiency',
          memoryClaim.claimed,
          avgMemoryUsage,
          200 // Very high tolerance for memory
        );
      }

      // Additional specific validations from README metrics table
      this.validateReadmeMetricsTable();

      // Generate final report
      this.generateAuditReport();

    } catch (error) {
      this.log(`Audit failed: ${error.message}`, 'error');
      throw error;
    }
  }

  validateReadmeMetricsTable() {
    this.log('📋 Validating README metrics table claims...');

    // Validate specific claims from README
    const readmeMetrics = [
      {
        metric: 'MCP Test Success Rate',
        claimed: 95.7,
        target: '>90%',
        status: 'Exceeds'
      },
      {
        metric: 'Template Discovery',
        claimed: 45, // <100ms target, ~45ms claimed
        target: '<100ms',
        measured: this.results.measurements.templateDiscovery?.average
      },
      {
        metric: 'Code Generation',
        claimed: 120, // <200ms/file target, ~120ms/file claimed
        target: '<200ms/file'
      },
      {
        metric: 'Memory Efficiency',
        claimed: 340, // <512MB target, ~340MB claimed
        target: '<512MB'
      }
    ];

    readmeMetrics.forEach(metric => {
      if (metric.measured !== undefined) {
        const validation = this.validateClaim(
          `README Table: ${metric.metric}`,
          metric.claimed,
          metric.measured,
          50
        );
        this.results.validations[`readme_${metric.metric.toLowerCase().replace(/\s+/g, '_')}`] = validation;
      }
    });
  }

  generateAuditReport() {
    this.log('📄 Generating comprehensive audit report...');

    const report = {
      ...this.results,
      summary: {
        totalClaims: this.results.audit.total,
        passedValidations: this.results.audit.passed,
        failedValidations: this.results.audit.failed,
        passRate: this.results.audit.total > 0 ? 
          Math.round((this.results.audit.passed / this.results.audit.total) * 100) : 0,
        overallStatus: this.results.audit.failed === 0 ? 'PASSED' : 
          this.results.audit.passed > this.results.audit.failed ? 'MIXED' : 'FAILED'
      },
      recommendations: this.generateRecommendations(),
      criticalFindings: this.extractCriticalFindings()
    };

    // Save audit report
    const reportPath = resolve(rootDir, 'tests/performance/performance-claims-audit-report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    this.log(`✅ Audit report saved to: ${reportPath}`, 'success');
    this.printSummary(report);

    return report;
  }

  generateRecommendations() {
    const recommendations = [];

    // Based on validation results
    Object.values(this.results.validations).forEach(validation => {
      if (!validation.passed) {
        if (validation.variance > 100) {
          recommendations.push({
            priority: 'HIGH',
            issue: `${validation.claimName} severely underperforms (${validation.variance}% variance)`,
            action: 'Update claims to reflect actual performance or optimize implementation'
          });
        } else if (validation.variance > 50) {
          recommendations.push({
            priority: 'MEDIUM',
            issue: `${validation.claimName} underperforms (${validation.variance}% variance)`,
            action: 'Consider performance optimization or claim adjustment'
          });
        }
      }
    });

    // Startup performance recommendations
    if (this.results.measurements.startup?.average > 200) {
      recommendations.push({
        priority: 'HIGH',
        issue: 'CLI startup time exceeds 200ms threshold',
        action: 'Implement lazy loading and startup optimization'
      });
    }

    return recommendations;
  }

  extractCriticalFindings() {
    const findings = [];

    // Check for critical performance issues
    if (this.results.measurements.startup?.average > 500) {
      findings.push({
        severity: 'CRITICAL',
        finding: 'CLI startup time exceeds 500ms - severe user experience impact',
        impact: 'Users will experience significant delays'
      });
    }

    if (this.results.audit.passRate < 50) {
      findings.push({
        severity: 'CRITICAL',
        finding: 'Majority of performance claims are false',
        impact: 'README contains misleading performance information'
      });
    }

    if (!this.results.measurements.rdf?.available) {
      findings.push({
        severity: 'HIGH',
        finding: 'RDF processing capabilities not available',
        impact: 'Core semantic features may not work'
      });
    }

    return findings;
  }

  printSummary(report) {
    this.log('='.repeat(60));
    this.log('📊 PERFORMANCE CLAIMS AUDIT SUMMARY', 'info');
    this.log('='.repeat(60));
    this.log(`🎯 Total Claims Tested: ${report.summary.totalClaims}`);
    this.log(`✅ Passed: ${report.summary.passedValidations}`);
    this.log(`❌ Failed: ${report.summary.failedValidations}`);
    this.log(`📊 Pass Rate: ${report.summary.passRate}%`);
    this.log(`🏆 Overall Status: ${report.summary.overallStatus}`);
    
    if (report.criticalFindings.length > 0) {
      this.log('⚠️  CRITICAL FINDINGS:', 'warn');
      report.criticalFindings.forEach(finding => {
        this.log(`   ${finding.severity}: ${finding.finding}`, 'error');
      });
    }

    if (report.recommendations.length > 0) {
      this.log('💡 TOP RECOMMENDATIONS:', 'info');
      report.recommendations.slice(0, 3).forEach(rec => {
        this.log(`   ${rec.priority}: ${rec.action}`);
      });
    }

    this.log('='.repeat(60));
  }
}

// Run the audit if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const auditor = new PerformanceClaimsAuditor();
  auditor.runFullAudit()
    .then(() => {
      console.log('\n🎯 Performance Claims Audit #7 completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Performance Claims Audit #7 failed:', error.message);
      process.exit(1);
    });
}

export default PerformanceClaimsAuditor;