const { Given, When, Then, Before, After } = require('@cucumber/cucumber');
const { expect } = require('chai');
const fs = require('fs').promises;
const path = require('path');

// Import test fixtures and contexts
const driftFixtures = require('../fixtures/drift/baseline_states.js');
const { testContext } = require('./drift_detection_steps.js');
const { advancedContext } = require('./advanced_drift_steps.js');
const { gitCicdContext } = require('./git_cicd_integration_steps.js');

// Comprehensive validation context
class DriftValidationContext {
  constructor() {
    this.reset();
  }

  reset() {
    this.validationResults = {
      accuracy: {},
      performance: {},
      integration: {},
      scalability: {}
    };
    this.benchmarkData = [];
    this.testSuiteResults = [];
    this.performanceMetrics = {
      executionTimes: [],
      memoryUsage: [],
      throughput: []
    };
    this.accuracyMetrics = {
      truePositives: 0,
      falsePositives: 0,
      trueNegatives: 0,
      falseNegatives: 0
    };
  }

  // Accuracy calculation methods
  calculatePrecision() {
    const { truePositives, falsePositives } = this.accuracyMetrics;
    return truePositives + falsePositives > 0 
      ? truePositives / (truePositives + falsePositives) 
      : 0;
  }

  calculateRecall() {
    const { truePositives, falseNegatives } = this.accuracyMetrics;
    return truePositives + falseNegatives > 0 
      ? truePositives / (truePositives + falseNegatives) 
      : 0;
  }

  calculateF1Score() {
    const precision = this.calculatePrecision();
    const recall = this.calculateRecall();
    return precision + recall > 0 
      ? 2 * (precision * recall) / (precision + recall) 
      : 0;
  }

  calculateAccuracy() {
    const { truePositives, trueNegatives, falsePositives, falseNegatives } = this.accuracyMetrics;
    const total = truePositives + trueNegatives + falsePositives + falseNegatives;
    return total > 0 
      ? (truePositives + trueNegatives) / total 
      : 0;
  }

  // Performance measurement methods
  measureExecutionTime(fn) {
    const startTime = performance.now();
    const result = fn();
    const endTime = performance.now();
    
    const executionTime = endTime - startTime;
    this.performanceMetrics.executionTimes.push(executionTime);
    
    return { result, executionTime };
  }

  async measureAsyncExecutionTime(asyncFn) {
    const startTime = performance.now();
    const result = await asyncFn();
    const endTime = performance.now();
    
    const executionTime = endTime - startTime;
    this.performanceMetrics.executionTimes.push(executionTime);
    
    return { result, executionTime };
  }

  calculateAverageExecutionTime() {
    const times = this.performanceMetrics.executionTimes;
    return times.length > 0 
      ? times.reduce((sum, time) => sum + time, 0) / times.length 
      : 0;
  }

  calculateThroughput(itemsProcessed, timeMs) {
    const throughput = timeMs > 0 ? (itemsProcessed / timeMs) * 1000 : 0; // items per second
    this.performanceMetrics.throughput.push(throughput);
    return throughput;
  }

  // Integration testing methods
  runIntegrationTest(testName, testFn) {
    const startTime = performance.now();
    let result;
    let error = null;

    try {
      result = testFn();
    } catch (err) {
      error = err;
      result = null;
    }

    const endTime = performance.now();
    const testResult = {
      name: testName,
      success: error === null,
      error,
      result,
      executionTime: endTime - startTime,
      timestamp: new Date().toISOString()
    };

    this.testSuiteResults.push(testResult);
    return testResult;
  }

  // Validation orchestration methods
  async validateDriftAccuracy() {
    // Test with known semantic changes
    const semanticTestCases = [
      {
        name: 'Type signature change',
        baseline: driftFixtures.getFixture('user-service-baseline'),
        current: driftFixtures.getFixture('user-service-breaking'),
        expectedDrift: true,
        expectedSeverity: 'HIGH'
      },
      {
        name: 'Cosmetic formatting only',
        baseline: driftFixtures.getFixture('user-service-baseline'),
        current: driftFixtures.getFixture('user-service-cosmetic'),
        expectedDrift: false,
        expectedSeverity: 'LOW'
      },
      {
        name: 'API endpoint removal',
        baseline: driftFixtures.getFixture('api-routes-baseline'),
        current: driftFixtures.getFixture('api-routes-breaking'),
        expectedDrift: true,
        expectedSeverity: 'CRITICAL'
      }
    ];

    for (const testCase of semanticTestCases) {
      const detected = await this.simulateDriftDetection(testCase.baseline, testCase.current);
      
      if (testCase.expectedDrift && detected.drift) {
        this.accuracyMetrics.truePositives++;
      } else if (!testCase.expectedDrift && !detected.drift) {
        this.accuracyMetrics.trueNegatives++;
      } else if (!testCase.expectedDrift && detected.drift) {
        this.accuracyMetrics.falsePositives++;
      } else {
        this.accuracyMetrics.falseNegatives++;
      }

      this.validationResults.accuracy[testCase.name] = {
        expected: testCase.expectedDrift,
        detected: detected.drift,
        severity: detected.severity,
        correct: (testCase.expectedDrift && detected.drift) || (!testCase.expectedDrift && !detected.drift)
      };
    }

    return {
      accuracy: this.calculateAccuracy(),
      precision: this.calculatePrecision(),
      recall: this.calculateRecall(),
      f1Score: this.calculateF1Score()
    };
  }

  async simulateDriftDetection(baseline, current) {
    // Simple drift simulation based on content comparison
    const contentDiff = driftFixtures.calculateDifference(baseline, current);
    
    if (!contentDiff || contentDiff.hashMatch) {
      return { drift: false, severity: 'LOW' };
    }

    // Analyze change patterns
    const hasTypeChanges = baseline.content.match(/:\s*(string|number|boolean)/g) !== 
                          current.content.match(/:\s*(string|number|boolean)/g);
    
    const hasFunctionChanges = baseline.content.match(/function\s+\w+/g) !== 
                              current.content.match(/function\s+\w+/g);
    
    const hasInterfaceChanges = baseline.content.match(/interface\s+\w+/g) !== 
                               current.content.match(/interface\s+\w+/g);

    let severity = 'LOW';
    if (hasInterfaceChanges || contentDiff.contentDifference.linesRemoved > 5) {
      severity = 'CRITICAL';
    } else if (hasTypeChanges || hasFunctionChanges) {
      severity = 'HIGH';
    } else if (contentDiff.contentDifference.totalChanges > 10) {
      severity = 'MEDIUM';
    }

    return {
      drift: severity !== 'LOW' || contentDiff.contentDifference.totalChanges > 1,
      severity,
      changes: contentDiff.contentDifference
    };
  }

  async validatePerformance() {
    const performanceTests = [
      {
        name: 'Single file analysis',
        test: () => this.simulateSingleFileAnalysis(),
        target: 100 // ms
      },
      {
        name: 'Batch processing (50 files)',
        test: () => this.simulateBatchAnalysis(50),
        target: 5000 // ms
      },
      {
        name: 'Large changeset (200 files)',
        test: () => this.simulateBatchAnalysis(200),
        target: 15000 // ms
      }
    ];

    for (const test of performanceTests) {
      const { result, executionTime } = await this.measureAsyncExecutionTime(test.test);
      
      this.validationResults.performance[test.name] = {
        executionTime,
        target: test.target,
        passed: executionTime <= test.target,
        result
      };
    }

    return this.validationResults.performance;
  }

  async simulateSingleFileAnalysis() {
    const baseline = driftFixtures.getFixture('user-service-baseline');
    const current = driftFixtures.getFixture('user-service-breaking');
    
    return await this.simulateDriftDetection(baseline, current);
  }

  async simulateBatchAnalysis(fileCount) {
    const batchFixtures = driftFixtures.getBatchFixtures();
    const filesToAnalyze = batchFixtures.slice(0, fileCount * 2); // baseline + modified pairs
    
    const results = [];
    for (let i = 0; i < filesToAnalyze.length; i += 2) {
      const baseline = filesToAnalyze[i][1];
      const current = filesToAnalyze[i + 1] ? filesToAnalyze[i + 1][1] : baseline;
      
      const driftResult = await this.simulateDriftDetection(baseline, current);
      results.push(driftResult);
    }

    return {
      filesAnalyzed: fileCount,
      driftDetected: results.filter(r => r.drift).length,
      averageSeverity: this.calculateAverageSeverity(results)
    };
  }

  calculateAverageSeverity(results) {
    const severityValues = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
    const values = results.map(r => severityValues[r.severity] || 1);
    const average = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    if (average >= 3.5) return 'CRITICAL';
    if (average >= 2.5) return 'HIGH';
    if (average >= 1.5) return 'MEDIUM';
    return 'LOW';
  }

  async validateIntegration() {
    const integrationTests = [
      {
        name: 'Git integration',
        test: () => this.testGitIntegration()
      },
      {
        name: 'CI/CD integration',
        test: () => this.testCICDIntegration()
      },
      {
        name: 'Baseline management',
        test: () => this.testBaselineManagement()
      },
      {
        name: 'Report generation',
        test: () => this.testReportGeneration()
      }
    ];

    for (const test of integrationTests) {
      this.runIntegrationTest(test.name, test.test);
    }

    this.validationResults.integration = {
      totalTests: integrationTests.length,
      passedTests: this.testSuiteResults.filter(r => r.success).length,
      failedTests: this.testSuiteResults.filter(r => !r.success).length,
      successRate: this.testSuiteResults.filter(r => r.success).length / integrationTests.length
    };

    return this.validationResults.integration;
  }

  testGitIntegration() {
    // Validate git context is available
    expect(gitCicdContext.gitRepo).to.exist;
    expect(gitCicdContext.gitRepo.commits).to.have.length.greaterThan(0);
    
    // Test git diff simulation
    const diff = gitCicdContext.simulateGitDiff();
    expect(diff.files).to.be.an('array');
    
    return { gitIntegration: 'validated' };
  }

  testCICDIntegration() {
    // Validate CI/CD context
    expect(gitCicdContext.ciConfig).to.exist;
    
    // Create test workflow
    const workflow = gitCicdContext.createWorkflow('test-workflow', ['push'], [
      { name: 'test-job', steps: ['drift-detection'] }
    ]);
    
    expect(workflow.jobs[0].steps).to.include('drift-detection');
    
    return { cicdIntegration: 'validated' };
  }

  testBaselineManagement() {
    // Validate baseline fixtures
    expect(driftFixtures.getAllFixtures().length).to.be.greaterThan(0);
    
    const baseline = driftFixtures.getFixture('user-service-baseline');
    expect(baseline).to.exist;
    expect(baseline.hash).to.exist;
    expect(baseline.content).to.exist;
    
    return { baselineManagement: 'validated' };
  }

  testReportGeneration() {
    // Validate report structure
    const mockDriftResult = {
      filesAnalyzed: 10,
      driftDetected: 3,
      severityBreakdown: { LOW: 1, MEDIUM: 1, HIGH: 1, CRITICAL: 0 }
    };

    const report = this.generateValidationReport(mockDriftResult);
    expect(report).to.have.property('summary');
    expect(report).to.have.property('details');
    expect(report).to.have.property('recommendations');
    
    return { reportGeneration: 'validated' };
  }

  generateValidationReport(driftResult) {
    return {
      summary: {
        timestamp: new Date().toISOString(),
        totalFiles: driftResult.filesAnalyzed,
        filesWithDrift: driftResult.driftDetected,
        driftPercentage: (driftResult.driftDetected / driftResult.filesAnalyzed) * 100
      },
      details: {
        accuracyMetrics: {
          precision: this.calculatePrecision(),
          recall: this.calculateRecall(),
          f1Score: this.calculateF1Score(),
          accuracy: this.calculateAccuracy()
        },
        performanceMetrics: {
          averageExecutionTime: this.calculateAverageExecutionTime(),
          totalTestsRun: this.testSuiteResults.length,
          averageThroughput: this.performanceMetrics.throughput.length > 0 
            ? this.performanceMetrics.throughput.reduce((sum, t) => sum + t, 0) / this.performanceMetrics.throughput.length
            : 0
        }
      },
      recommendations: [
        {
          category: 'Performance',
          suggestion: 'Consider caching for improved throughput on large changesets'
        },
        {
          category: 'Accuracy',
          suggestion: 'Fine-tune semantic analysis thresholds for better precision'
        }
      ]
    };
  }
}

const validationContext = new DriftValidationContext();

// Validation Steps
Given('I have comprehensive drift detection test suite', async function () {
  validationContext.reset();
  
  // Verify all test contexts are available
  expect(testContext).to.exist;
  expect(advancedContext).to.exist;
  expect(gitCicdContext).to.exist;
  expect(driftFixtures).to.exist;
  
  // Verify test fixtures are loaded
  const fixtures = driftFixtures.getAllFixtures();
  expect(fixtures.length).to.be.greaterThan(10);
});

When('I run accuracy validation tests', async function () {
  const accuracyResults = await validationContext.validateDriftAccuracy();
  validationContext.accuracyResults = accuracyResults;
  
  expect(accuracyResults.accuracy).to.be.a('number');
  expect(accuracyResults.precision).to.be.a('number');
  expect(accuracyResults.recall).to.be.a('number');
  expect(accuracyResults.f1Score).to.be.a('number');
});

When('I run performance validation tests', async function () {
  const performanceResults = await validationContext.validatePerformance();
  validationContext.performanceResults = performanceResults;
  
  expect(Object.keys(performanceResults)).to.have.length.greaterThan(0);
});

When('I run integration validation tests', async function () {
  const integrationResults = await validationContext.validateIntegration();
  validationContext.integrationResults = integrationResults;
  
  expect(integrationResults.totalTests).to.be.greaterThan(0);
});

Then('drift detection accuracy should be >= {int}%', function (targetPercentage) {
  const target = targetPercentage / 100;
  expect(validationContext.accuracyResults.accuracy).to.be.at.least(target);
});

Then('precision should be >= {int}%', function (targetPercentage) {
  const target = targetPercentage / 100;
  expect(validationContext.accuracyResults.precision).to.be.at.least(target);
});

Then('recall should be >= {int}%', function (targetPercentage) {
  const target = targetPercentage / 100;
  expect(validationContext.accuracyResults.recall).to.be.at.least(target);
});

Then('F1 score should be >= {float}', function (targetScore) {
  expect(validationContext.accuracyResults.f1Score).to.be.at.least(targetScore);
});

Then('single file analysis should complete within {int}ms', function (maxMs) {
  const singleFileResult = validationContext.performanceResults['Single file analysis'];
  expect(singleFileResult.executionTime).to.be.at.most(maxMs);
});

Then('batch processing should scale linearly', function () {
  const batchResults = Object.values(validationContext.performanceResults)
    .filter(r => r.result && r.result.filesAnalyzed);
  
  expect(batchResults.length).to.be.at.least(2);
  
  // Verify execution time scales reasonably with file count
  const timePerFile = batchResults.map(r => r.executionTime / r.result.filesAnalyzed);
  const avgTimePerFile = timePerFile.reduce((sum, t) => sum + t, 0) / timePerFile.length;
  
  // Verify all measurements are within 50% of average (reasonable scaling)
  timePerFile.forEach(t => {
    expect(t).to.be.at.most(avgTimePerFile * 1.5);
    expect(t).to.be.at.least(avgTimePerFile * 0.5);
  });
});

Then('all integration tests should pass', function () {
  expect(validationContext.integrationResults.successRate).to.equal(1.0);
});

Then('generate comprehensive validation report', function () {
  const report = validationContext.generateValidationReport({
    filesAnalyzed: 100,
    driftDetected: 15,
    severityBreakdown: { LOW: 5, MEDIUM: 5, HIGH: 4, CRITICAL: 1 }
  });

  validationContext.finalReport = report;
  
  expect(report.summary).to.exist;
  expect(report.details).to.exist;
  expect(report.details.accuracyMetrics).to.exist;
  expect(report.details.performanceMetrics).to.exist;
  expect(report.recommendations).to.be.an('array');
});

// Cleanup
Before(function () {
  validationContext.reset();
});

After(function () {
  // Log final results for debugging if needed
  if (validationContext.finalReport) {
    console.log('\n📊 Drift Detection Validation Summary:');
    console.log(`Accuracy: ${(validationContext.accuracyResults?.accuracy * 100).toFixed(1)}%`);
    console.log(`Precision: ${(validationContext.accuracyResults?.precision * 100).toFixed(1)}%`);
    console.log(`Recall: ${(validationContext.accuracyResults?.recall * 100).toFixed(1)}%`);
    console.log(`F1 Score: ${validationContext.accuracyResults?.f1Score.toFixed(3)}`);
    console.log(`Integration Tests: ${validationContext.integrationResults?.successRate * 100}% passed`);
  }
});

module.exports = {
  DriftValidationContext,
  validationContext
};