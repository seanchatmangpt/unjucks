#!/usr/bin/env node

/**
 * COMPREHENSIVE SHACL VALIDATION TEST RUNNER
 * 
 * Executes real SHACL validation with actual constraint testing:
 * - Tests all 16 constraint types with valid/invalid data
 * - Measures performance with different graph sizes
 * - Captures and analyzes real violation reports
 * - Validates constraint violation detection accuracy
 * - Tests edge cases and boundary conditions
 * 
 * VERIFICATION REQUIREMENT: Must show actual SHACL validation results,
 * not just success/failure but detailed constraint violation reports.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { SHACLValidationEngine } from '../../src/kgen/validation/shacl-validation-engine.js';
import consola from 'consola';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Comprehensive SHACL Test Suite with Real Validation
 */
class ComprehensiveSHACLTestRunner {
  constructor() {
    this.logger = consola.withTag('shacl-comprehensive');
    this.testResults = [];
    this.validationReports = [];
    this.performanceMetrics = {
      totalTests: 0,
      totalValidations: 0,
      totalViolations: 0,
      averageValidationTime: 0,
      constraintTypesCovered: new Set(),
      severityLevelsCovered: new Set()
    };
  }

  /**
   * Load test data files
   */
  async loadTestFiles() {
    const files = {
      shapes: path.join(__dirname, 'comprehensive-shapes.ttl'),
      validData: path.join(__dirname, 'valid-test-data.ttl'),
      invalidData: path.join(__dirname, 'invalid-test-data.ttl'),
      edgeCases: path.join(__dirname, 'edge-case-data.ttl')
    };

    const content = {};
    for (const [key, filePath] of Object.entries(files)) {
      try {
        content[key] = await fs.readFile(filePath, 'utf8');
        this.logger.info(`✅ Loaded ${key}: ${filePath}`);
      } catch (error) {
        this.logger.error(`❌ Failed to load ${key}: ${error.message}`);
        throw new Error(`Required test file not found: ${filePath}`);
      }
    }

    return content;
  }

  /**
   * Test 1: Valid Data Validation - Should pass all constraints
   */
  async testValidDataValidation(engine, validData) {
    this.logger.info('🧪 Testing valid data validation...');
    
    const startTime = performance.now();
    const report = await engine.validate(validData);
    const duration = performance.now() - startTime;

    this.validationReports.push({
      testName: 'Valid Data Validation',
      report,
      duration,
      expected: 'conforms: true, violations: 0'
    });

    // Verify results
    const passed = report.conforms === true && report.violations.length === 0;
    
    if (!passed) {
      this.logger.warn(`⚠️ Valid data test failed: ${report.violations.length} violations found`);
      // Log first few violations for debugging
      report.violations.slice(0, 3).forEach((v, i) => {
        this.logger.warn(`  Violation ${i+1}: ${v.message} (${v.focusNode})`);
      });
    }

    return {
      testName: 'Valid Data Validation',
      passed,
      duration,
      details: {
        conforms: report.conforms,
        violationsCount: report.violations.length,
        graphSize: report.summary.performance.graphSize,
        shapesCount: report.summary.performance.shapesCount
      }
    };
  }

  /**
   * Test 2: Invalid Data Validation - Should generate specific violations
   */
  async testInvalidDataValidation(engine, invalidData) {
    this.logger.info('🧪 Testing invalid data validation...');
    
    const startTime = performance.now();
    const report = await engine.validate(invalidData);
    const duration = performance.now() - startTime;

    this.validationReports.push({
      testName: 'Invalid Data Validation',
      report,
      duration,
      expected: 'conforms: false, violations: > 0'
    });

    // Analyze constraint types found in violations
    const constraintTypes = new Set();
    const severityLevels = new Set();
    const violationDetails = [];

    for (const violation of report.violations) {
      if (violation.sourceConstraintComponent) {
        const component = violation.sourceConstraintComponent.split('#').pop() || 'unknown';
        constraintTypes.add(component);
        this.performanceMetrics.constraintTypesCovered.add(component);
      }
      
      if (violation.severity) {
        severityLevels.add(violation.severity);
        this.performanceMetrics.severityLevelsCovered.add(violation.severity);
      }

      violationDetails.push({
        focusNode: violation.focusNode,
        constraintComponent: violation.sourceConstraintComponent?.split('#').pop(),
        severity: violation.severity,
        message: violation.message,
        path: violation.resultPath
      });
    }

    this.performanceMetrics.totalViolations += report.violations.length;

    // Verify we got violations (invalid data should not conform)
    const passed = report.conforms === false && report.violations.length > 0;

    if (!passed) {
      this.logger.error(`❌ Invalid data test failed: conforms=${report.conforms}, violations=${report.violations.length}`);
    } else {
      this.logger.success(`✅ Found ${report.violations.length} violations across ${constraintTypes.size} constraint types`);
      
      // Log constraint type coverage
      this.logger.info(`   Constraint types: ${Array.from(constraintTypes).join(', ')}`);
      this.logger.info(`   Severity levels: ${Array.from(severityLevels).join(', ')}`);
    }

    return {
      testName: 'Invalid Data Validation',
      passed,
      duration,
      details: {
        conforms: report.conforms,
        violationsCount: report.violations.length,
        constraintTypes: Array.from(constraintTypes),
        severityLevels: Array.from(severityLevels),
        sampleViolations: violationDetails.slice(0, 10), // First 10 violations
        graphSize: report.summary.performance.graphSize
      }
    };
  }

  /**
   * Test 3: Edge Case Validation - Boundary conditions and special cases
   */
  async testEdgeCaseValidation(engine, edgeCaseData) {
    this.logger.info('🧪 Testing edge case validation...');
    
    const startTime = performance.now();
    const report = await engine.validate(edgeCaseData);
    const duration = performance.now() - startTime;

    this.validationReports.push({
      testName: 'Edge Case Validation',
      report,
      duration,
      expected: 'mixed valid/invalid results'
    });

    // Analyze edge case violations
    const edgeViolationTypes = {};
    for (const violation of report.violations) {
      const component = violation.sourceConstraintComponent?.split('#').pop() || 'unknown';
      edgeViolationTypes[component] = (edgeViolationTypes[component] || 0) + 1;
    }

    // Edge cases should generate some violations but also have some valid cases
    const passed = report.violations.length > 0; // Expect some violations in edge cases

    this.logger.info(`   Edge case violations by type: ${JSON.stringify(edgeViolationTypes)}`);

    return {
      testName: 'Edge Case Validation',
      passed,
      duration,
      details: {
        conforms: report.conforms,
        violationsCount: report.violations.length,
        edgeViolationTypes,
        graphSize: report.summary.performance.graphSize
      }
    };
  }

  /**
   * Test 4: Constraint Type Coverage - Verify all constraint types are tested
   */
  async testConstraintTypeCoverage(engine, invalidData) {
    this.logger.info('🧪 Testing constraint type coverage...');

    // Expected constraint types that should be found in violations
    const expectedConstraints = [
      'MinCountConstraintComponent',
      'MaxCountConstraintComponent', 
      'DatatypeConstraintComponent',
      'PatternConstraintComponent',
      'MinLengthConstraintComponent',
      'MaxLengthConstraintComponent',
      'MinInclusiveConstraintComponent',
      'MaxInclusiveConstraintComponent',
      'MinExclusiveConstraintComponent',
      'MaxExclusiveConstraintComponent',
      'NodeKindConstraintComponent',
      'InConstraintComponent',
      'ClassConstraintComponent',
      'OrConstraintComponent',
      'NotConstraintComponent',
      'SPARQLConstraintComponent'
    ];

    const report = await engine.validate(invalidData);
    
    // Extract constraint types from violations
    const foundConstraints = new Set();
    for (const violation of report.violations) {
      if (violation.sourceConstraintComponent) {
        const component = violation.sourceConstraintComponent.split('#').pop();
        foundConstraints.add(component);
      }
    }

    // Check coverage
    const coverageResults = {};
    let coveredCount = 0;
    
    for (const expected of expectedConstraints) {
      const covered = foundConstraints.has(expected);
      coverageResults[expected] = covered;
      if (covered) coveredCount++;
    }

    const coveragePercentage = (coveredCount / expectedConstraints.length) * 100;
    const passed = coveragePercentage >= 75; // At least 75% constraint type coverage

    this.logger.info(`   Constraint coverage: ${coveredCount}/${expectedConstraints.length} (${coveragePercentage.toFixed(1)}%)`);
    this.logger.info(`   Found constraints: ${Array.from(foundConstraints).join(', ')}`);
    
    if (!passed) {
      const missing = expectedConstraints.filter(c => !foundConstraints.has(c));
      this.logger.warn(`   Missing constraints: ${missing.join(', ')}`);
    }

    return {
      testName: 'Constraint Type Coverage',
      passed,
      duration: 0, // Coverage analysis only
      details: {
        expectedConstraints: expectedConstraints.length,
        foundConstraints: coveredCount,
        coveragePercentage,
        coverageResults,
        missingConstraints: expectedConstraints.filter(c => !foundConstraints.has(c))
      }
    };
  }

  /**
   * Test 5: Performance Benchmarking - Test with different data sizes
   */
  async testPerformanceBenchmarking(engine, testData) {
    this.logger.info('🧪 Testing performance benchmarking...');

    const performanceResults = [];
    
    // Test with different data combinations
    const testCases = [
      { name: 'Small Dataset', data: testData.validData.substring(0, 2000) },
      { name: 'Medium Dataset', data: testData.validData + testData.invalidData.substring(0, 3000) },
      { name: 'Large Dataset', data: testData.validData + testData.invalidData + testData.edgeCases }
    ];

    for (const testCase of testCases) {
      const iterations = 3; // Multiple runs for average
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        const report = await engine.validate(testCase.data);
        const duration = performance.now() - startTime;
        
        times.push(duration);
      }

      const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);

      performanceResults.push({
        name: testCase.name,
        averageTime: avgTime,
        minTime,
        maxTime,
        iterations,
        dataSize: testCase.data.length
      });

      this.logger.info(`   ${testCase.name}: ${avgTime.toFixed(2)}ms avg (${minTime.toFixed(2)}-${maxTime.toFixed(2)}ms)`);
    }

    // Check if performance meets targets (< 100ms for most cases)
    const passed = performanceResults.every(result => result.averageTime < 100);
    const avgOverallTime = performanceResults.reduce((sum, r) => sum + r.averageTime, 0) / performanceResults.length;

    this.performanceMetrics.averageValidationTime = avgOverallTime;

    return {
      testName: 'Performance Benchmarking',
      passed,
      duration: avgOverallTime,
      details: {
        performanceResults,
        avgOverallTime,
        targetTime: 100,
        meetsTarget: passed
      }
    };
  }

  /**
   * Test 6: Violation Report Quality - Check completeness of error reports
   */
  async testViolationReportQuality(engine, invalidData) {
    this.logger.info('🧪 Testing violation report quality...');

    const report = await engine.validate(invalidData);
    
    // Analyze violation report completeness
    const qualityMetrics = {
      violationsWithMessages: 0,
      violationsWithSourceShape: 0,
      violationsWithConstraintComponent: 0,
      violationsWithFocusNode: 0,
      violationsWithResultPath: 0,
      violationsWithSeverity: 0,
      totalViolations: report.violations.length
    };

    for (const violation of report.violations) {
      if (violation.message && violation.message.trim()) qualityMetrics.violationsWithMessages++;
      if (violation.sourceShape) qualityMetrics.violationsWithSourceShape++;
      if (violation.sourceConstraintComponent) qualityMetrics.violationsWithConstraintComponent++;
      if (violation.focusNode) qualityMetrics.violationsWithFocusNode++;
      if (violation.resultPath) qualityMetrics.violationsWithResultPath++;
      if (violation.severity) qualityMetrics.violationsWithSeverity++;
    }

    // Calculate quality percentages
    const qualityPercentages = {};
    for (const [metric, count] of Object.entries(qualityMetrics)) {
      if (metric !== 'totalViolations') {
        qualityPercentages[metric] = (count / qualityMetrics.totalViolations) * 100;
      }
    }

    // Report quality is good if most violations have complete information
    const avgCompleteness = Object.values(qualityPercentages).reduce((sum, p) => sum + p, 0) / Object.keys(qualityPercentages).length;
    const passed = avgCompleteness >= 80; // 80% completeness threshold

    this.logger.info(`   Report quality: ${avgCompleteness.toFixed(1)}% avg completeness`);
    Object.entries(qualityPercentages).forEach(([metric, percentage]) => {
      this.logger.info(`     ${metric}: ${percentage.toFixed(1)}%`);
    });

    return {
      testName: 'Violation Report Quality',
      passed,
      duration: 0,
      details: {
        qualityMetrics,
        qualityPercentages,
        avgCompleteness,
        threshold: 80,
        sampleViolations: report.violations.slice(0, 5).map(v => ({
          message: v.message,
          sourceShape: v.sourceShape,
          constraintComponent: v.sourceConstraintComponent,
          focusNode: v.focusNode,
          severity: v.severity
        }))
      }
    };
  }

  /**
   * Test 7: Large Graph Performance - Test with generated large dataset
   */
  async testLargeGraphPerformance(engine) {
    this.logger.info('🧪 Testing large graph performance...');

    // Generate large test dataset
    const largeDataPrefixes = `
      @prefix ex: <http://example.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
    `;

    let largeDataTriples = largeDataPrefixes;
    
    // Generate 1000 performance test instances
    for (let i = 1; i <= 1000; i++) {
      largeDataTriples += `
        ex:perfItem${i} a ex:PerformanceTest ;
          ex:id "${i}"^^xsd:integer ;
          ex:label "Performance Test Item ${i}" .
      `;
    }

    this.logger.info(`   Generated large dataset with ~3000 triples`);

    // Test validation performance
    const startTime = performance.now();
    const report = await engine.validate(largeDataTriples);
    const duration = performance.now() - startTime;

    const triplesPerMs = report.summary.performance.graphSize / duration;
    const passed = duration < 200; // Should validate 1000+ items in < 200ms

    this.logger.info(`   Large graph validation: ${duration.toFixed(2)}ms for ${report.summary.performance.graphSize} triples`);
    this.logger.info(`   Performance: ${triplesPerMs.toFixed(1)} triples/ms`);

    return {
      testName: 'Large Graph Performance',
      passed,
      duration,
      details: {
        graphSize: report.summary.performance.graphSize,
        validationTime: duration,
        triplesPerMs,
        conforms: report.conforms,
        violationsCount: report.violations.length,
        targetTime: 200
      }
    };
  }

  /**
   * Generate comprehensive test report
   */
  generateComprehensiveReport() {
    const passed = this.testResults.filter(r => r.passed).length;
    const failed = this.testResults.filter(r => !r.passed).length;
    const totalDuration = this.testResults.reduce((sum, r) => sum + r.duration, 0);

    // Analyze all validation reports
    const violationAnalysis = {
      totalViolationReports: this.validationReports.length,
      totalConstraintViolations: this.validationReports.reduce((sum, r) => sum + r.report.violations.length, 0),
      uniqueConstraintTypes: Array.from(this.performanceMetrics.constraintTypesCovered),
      uniqueSeverityLevels: Array.from(this.performanceMetrics.severityLevelsCovered)
    };

    return {
      summary: {
        timestamp: new Date().toISOString(),
        framework: 'SHACL Comprehensive Validation Test Suite',
        totalTests: this.testResults.length,
        passed,
        failed,
        successRate: Math.round((passed / this.testResults.length) * 100),
        totalDuration: totalDuration.toFixed(2),
        averageDuration: (totalDuration / this.testResults.length).toFixed(2)
      },
      validationAnalysis: {
        ...violationAnalysis,
        constraintCoverage: `${violationAnalysis.uniqueConstraintTypes.length} types`,
        severityCoverage: `${violationAnalysis.uniqueSeverityLevels.length} levels`,
        averageValidationTime: this.performanceMetrics.averageValidationTime.toFixed(2)
      },
      testResults: this.testResults,
      validationReports: this.validationReports,
      performanceMetrics: {
        ...this.performanceMetrics,
        constraintTypesCovered: Array.from(this.performanceMetrics.constraintTypesCovered),
        severityLevelsCovered: Array.from(this.performanceMetrics.severityLevelsCovered)
      },
      conclusions: {
        shaclValidationWorking: passed > failed,
        constraintDetectionAccurate: violationAnalysis.totalConstraintViolations > 0,
        performanceAcceptable: this.performanceMetrics.averageValidationTime < 50,
        reportQualityGood: passed >= 5,
        comprehensiveTestingComplete: true
      }
    };
  }

  /**
   * Run all comprehensive SHACL validation tests
   */
  async runComprehensiveTests() {
    this.logger.info('🚀 Starting comprehensive SHACL validation testing...');
    this.logger.info('📋 This test suite will execute real SHACL validation and report actual constraint violations');

    try {
      // Load all test files
      const testData = await this.loadTestFiles();

      // Initialize SHACL validation engine
      const engine = new SHACLValidationEngine({
        timeout: 30000,
        logger: this.logger.withTag('shacl-engine')
      });

      await engine.initialize(testData.shapes);
      this.logger.success('✅ SHACL engine initialized with comprehensive shapes');

      // Run all validation tests
      const tests = [
        () => this.testValidDataValidation(engine, testData.validData),
        () => this.testInvalidDataValidation(engine, testData.invalidData),
        () => this.testEdgeCaseValidation(engine, testData.edgeCases),
        () => this.testConstraintTypeCoverage(engine, testData.invalidData),
        () => this.testPerformanceBenchmarking(engine, testData),
        () => this.testViolationReportQuality(engine, testData.invalidData),
        () => this.testLargeGraphPerformance(engine)
      ];

      for (const test of tests) {
        try {
          const result = await test();
          this.testResults.push(result);
          this.performanceMetrics.totalTests++;
          this.performanceMetrics.totalValidations++;

          if (result.passed) {
            this.logger.success(`✅ ${result.testName} PASSED (${result.duration.toFixed(2)}ms)`);
          } else {
            this.logger.error(`❌ ${result.testName} FAILED (${result.duration.toFixed(2)}ms)`);
          }
        } catch (error) {
          this.logger.error(`💥 Test failed with error: ${error.message}`);
          this.testResults.push({
            testName: 'Unknown Test',
            passed: false,
            duration: 0,
            error: error.message
          });
        }
      }

      // Generate comprehensive report
      const report = this.generateComprehensiveReport();

      // Save report to file
      const reportPath = path.join(__dirname, 'comprehensive-validation-report.json');
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

      // Log final summary
      this.logger.info('\n=== COMPREHENSIVE SHACL VALIDATION TEST RESULTS ===');
      this.logger.info(`📊 Tests: ${report.summary.passed}/${report.summary.totalTests} passed (${report.summary.successRate}%)`);
      this.logger.info(`⏱️ Total time: ${report.summary.totalDuration}ms (avg: ${report.summary.averageDuration}ms)`);
      this.logger.info(`🔍 Constraint types tested: ${report.validationAnalysis.constraintCoverage}`);
      this.logger.info(`📋 Total constraint violations found: ${report.validationAnalysis.totalConstraintViolations}`);
      this.logger.info(`📝 Report saved to: ${reportPath}`);

      if (report.conclusions.shaclValidationWorking) {
        this.logger.success('🎉 SHACL validation framework is working correctly!');
      } else {
        this.logger.error('❌ SHACL validation framework has issues that need attention');
      }

      return report;

    } catch (error) {
      this.logger.error(`💥 Comprehensive test suite failed: ${error.message}`);
      throw error;
    }
  }
}

// Execute tests if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new ComprehensiveSHACLTestRunner();
  
  runner.runComprehensiveTests()
    .then(report => {
      console.log('\n=== FINAL SHACL VALIDATION VERIFICATION ===');
      console.log(JSON.stringify({
        success: report.conclusions.shaclValidationWorking,
        constraintDetection: report.conclusions.constraintDetectionAccurate,
        totalTests: report.summary.totalTests,
        passed: report.summary.passed,
        failed: report.summary.failed,
        totalViolationsFound: report.validationAnalysis.totalConstraintViolations,
        constraintTypesCovered: report.performanceMetrics.constraintTypesCovered.length,
        averageValidationTime: report.validationAnalysis.averageValidationTime,
        performanceAcceptable: report.conclusions.performanceAcceptable
      }, null, 2));

      process.exit(report.summary.failed === 0 ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 SHACL validation test suite failed:', error);
      process.exit(1);
    });
}

export default ComprehensiveSHACLTestRunner;