#!/usr/bin/env node
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

class FinalPerformanceAnalyzer {
  constructor() {
    this.resultsDir = 'tests/performance/results';
    this.analysisResults = {
      analysisDate: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      testSummary: {},
      performanceGrades: {},
      recommendations: [],
      complianceStatus: 'UNKNOWN'
    };
  }

  loadTestResults(filename) {
    const filePath = join(this.resultsDir, filename);
    if (existsSync(filePath)) {
      try {
        return JSON.parse(readFileSync(filePath, 'utf-8'));
      } catch (error) {
        console.warn(`⚠️  Could not parse ${filename}:`, error.message);
        return null;
      }
    }
    console.warn(`⚠️  Results file not found: ${filename}`);
    return null;
  }

  analyzeCLIPerformance(benchmarkResults) {
    if (!benchmarkResults || !benchmarkResults.summary) {
      return { grade: 'N/A', metrics: {}, status: 'NO_DATA' };
    }

    const summary = benchmarkResults.summary;
    const metrics = {
      averageStartupTime: summary.averageStartupTime,
      successRate: summary.overallSuccessRate,
      fastestCommand: summary.fastestCommand?.averageTime || 0,
      slowestCommand: summary.slowestCommand?.averageTime || 0
    };

    // Grading criteria
    const startupGrade = metrics.averageStartupTime < 2000 ? 'A+' :
                        metrics.averageStartupTime < 5000 ? 'A' :
                        metrics.averageStartupTime < 10000 ? 'B' : 'C';
    
    const reliabilityGrade = metrics.successRate >= 99 ? 'A+' :
                            metrics.successRate >= 95 ? 'A' :
                            metrics.successRate >= 90 ? 'B' : 'C';

    // Overall CLI grade
    const gradePoints = {
      'A+': 4.0, 'A': 3.7, 'B+': 3.3, 'B': 3.0, 'C+': 2.3, 'C': 2.0
    };
    
    const avgGrade = (gradePoints[startupGrade] + gradePoints[reliabilityGrade]) / 2;
    const overallGrade = avgGrade >= 3.85 ? 'A+' :
                        avgGrade >= 3.5 ? 'A' :
                        avgGrade >= 3.15 ? 'B+' :
                        avgGrade >= 2.85 ? 'B' : 'C';

    return {
      grade: overallGrade,
      metrics,
      subGrades: { startup: startupGrade, reliability: reliabilityGrade },
      status: 'ANALYZED'
    };
  }

  analyzeScalabilityPerformance(scalabilityResults) {
    if (!scalabilityResults || !scalabilityResults.summary) {
      return { grade: 'N/A', metrics: {}, status: 'NO_DATA' };
    }

    const summary = scalabilityResults.summary;
    const metrics = {
      averageSuccessRate: summary.averageSuccessRate,
      averageThroughput: summary.averageThroughput,
      totalOperations: summary.totalOperations,
      memoryEfficiency: summary.memoryEfficiency
    };

    // Scalability grading
    const throughputGrade = metrics.averageThroughput >= 50 ? 'A+' :
                           metrics.averageThroughput >= 20 ? 'A' :
                           metrics.averageThroughput >= 10 ? 'B+' :
                           metrics.averageThroughput >= 5 ? 'B' : 'C';

    const reliabilityGrade = metrics.averageSuccessRate >= 99 ? 'A+' :
                            metrics.averageSuccessRate >= 95 ? 'A' :
                            metrics.averageSuccessRate >= 90 ? 'B+' :
                            metrics.averageSuccessRate >= 85 ? 'B' : 'C';

    const memoryGrade = metrics.memoryEfficiency ? 'A+' : 'B';

    // Calculate overall scalability grade
    const gradePoints = {
      'A+': 4.0, 'A': 3.7, 'B+': 3.3, 'B': 3.0, 'C+': 2.3, 'C': 2.0
    };
    
    const avgGrade = (gradePoints[throughputGrade] + gradePoints[reliabilityGrade] + gradePoints[memoryGrade]) / 3;
    const overallGrade = avgGrade >= 3.85 ? 'A+' :
                        avgGrade >= 3.5 ? 'A' :
                        avgGrade >= 3.15 ? 'B+' :
                        avgGrade >= 2.85 ? 'B' : 'C';

    return {
      grade: overallGrade,
      metrics,
      subGrades: { throughput: throughputGrade, reliability: reliabilityGrade, memory: memoryGrade },
      status: 'ANALYZED'
    };
  }

  generateEnterpriseReadinessAssessment() {
    const cliAnalysis = this.analysisResults.cli;
    const scalabilityAnalysis = this.analysisResults.scalability;

    if (!cliAnalysis || !scalabilityAnalysis) {
      return {
        readinessLevel: 'UNKNOWN',
        grade: 'INCOMPLETE',
        recommendations: ['Complete all performance tests before assessment']
      };
    }

    // Enterprise readiness criteria
    const criteria = {
      startup: cliAnalysis.metrics.averageStartupTime < 5000,
      reliability: cliAnalysis.metrics.successRate >= 95,
      scalability: scalabilityAnalysis.metrics.averageThroughput >= 10,
      throughput: scalabilityAnalysis.metrics.averageSuccessRate >= 90
    };

    const passedCriteria = Object.values(criteria).filter(Boolean).length;
    const totalCriteria = Object.keys(criteria).length;
    
    let readinessLevel, grade;
    
    if (passedCriteria === totalCriteria) {
      readinessLevel = 'ENTERPRISE_READY';
      grade = 'A+';
    } else if (passedCriteria >= 3) {
      readinessLevel = 'PRODUCTION_READY';
      grade = 'A';
    } else if (passedCriteria >= 2) {
      readinessLevel = 'DEVELOPMENT_READY';
      grade = 'B';
    } else {
      readinessLevel = 'NEEDS_OPTIMIZATION';
      grade = 'C';
    }

    const recommendations = [];
    if (!criteria.startup) {
      recommendations.push('Optimize CLI startup time - consider lazy loading and module optimization');
    }
    if (!criteria.reliability) {
      recommendations.push('Improve command reliability - investigate and fix error patterns');
    }
    if (!criteria.scalability) {
      recommendations.push('Enhance scalability - implement parallel processing and resource optimization');
    }
    if (!criteria.throughput) {
      recommendations.push('Increase throughput - optimize template processing pipeline');
    }

    return {
      readinessLevel,
      grade,
      criteria,
      passedCriteria,
      totalCriteria,
      recommendations
    };
  }

  generateComprehensiveReport() {
    const report = {
      ...this.analysisResults,
      enterpriseReadiness: this.generateEnterpriseReadinessAssessment(),
      performanceSummary: {
        cli: this.analysisResults.cli,
        scalability: this.analysisResults.scalability
      }
    };

    // Generate final recommendations
    const allRecommendations = [
      ...this.analysisResults.recommendations,
      ...report.enterpriseReadiness.recommendations
    ];

    report.finalRecommendations = [...new Set(allRecommendations)]; // Remove duplicates

    // Determine overall compliance status
    report.complianceStatus = report.enterpriseReadiness.readinessLevel === 'ENTERPRISE_READY' ? 
                             'COMPLIANT' : 
                             report.enterpriseReadiness.readinessLevel === 'PRODUCTION_READY' ? 
                             'MOSTLY_COMPLIANT' : 'NON_COMPLIANT';

    return report;
  }

  printDetailedReport(report) {
    console.log('\n🎯 FINAL PERFORMANCE ANALYSIS REPORT');
    console.log('═'.repeat(80));
    console.log(`Analysis Date: ${report.analysisDate}`);
    console.log(`Node.js Version: ${report.nodeVersion}`);
    console.log(`Platform: ${report.platform} (${report.arch})`);
    
    console.log('\n📊 CLI PERFORMANCE ANALYSIS:');
    if (report.cli && report.cli.status === 'ANALYZED') {
      console.log(`  Overall Grade: ${report.cli.grade}`);
      console.log(`  Startup Performance: ${report.cli.subGrades.startup} (${report.cli.metrics.averageStartupTime.toFixed(2)}ms avg)`);
      console.log(`  Reliability: ${report.cli.subGrades.reliability} (${report.cli.metrics.successRate.toFixed(1)}% success rate)`);
      console.log(`  Fastest Command: ${report.cli.metrics.fastestCommand.toFixed(2)}ms`);
      console.log(`  Slowest Command: ${report.cli.metrics.slowestCommand.toFixed(2)}ms`);
    } else {
      console.log('  ⚠️  CLI performance data not available');
    }

    console.log('\n📈 SCALABILITY PERFORMANCE ANALYSIS:');
    if (report.scalability && report.scalability.status === 'ANALYZED') {
      console.log(`  Overall Grade: ${report.scalability.grade}`);
      console.log(`  Throughput: ${report.scalability.subGrades.throughput} (${report.scalability.metrics.averageThroughput.toFixed(2)} ops/sec)`);
      console.log(`  Reliability: ${report.scalability.subGrades.reliability} (${report.scalability.metrics.averageSuccessRate.toFixed(1)}% success rate)`);
      console.log(`  Memory Efficiency: ${report.scalability.subGrades.memory}`);
      console.log(`  Total Operations Tested: ${report.scalability.metrics.totalOperations.toLocaleString()}`);
    } else {
      console.log('  ⚠️  Scalability performance data not available');
    }

    console.log('\n🏢 ENTERPRISE READINESS ASSESSMENT:');
    console.log(`  Readiness Level: ${report.enterpriseReadiness.readinessLevel}`);
    console.log(`  Enterprise Grade: ${report.enterpriseReadiness.grade}`);
    console.log(`  Criteria Passed: ${report.enterpriseReadiness.passedCriteria}/${report.enterpriseReadiness.totalCriteria}`);
    
    console.log('\n  ✅ Criteria Assessment:');
    Object.entries(report.enterpriseReadiness.criteria).forEach(([criterion, passed]) => {
      console.log(`    ${passed ? '✅' : '❌'} ${criterion.toUpperCase()}: ${passed ? 'PASS' : 'FAIL'}`);
    });

    console.log(`\n🎖️  OVERALL COMPLIANCE STATUS: ${report.complianceStatus}`);

    if (report.finalRecommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      report.finalRecommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    }

    console.log('\n🏆 FINAL PERFORMANCE VERDICT:');
    const verdict = report.enterpriseReadiness.readinessLevel === 'ENTERPRISE_READY' ? 
                   '🥇 EXCELLENT - Enterprise Ready' :
                   report.enterpriseReadiness.readinessLevel === 'PRODUCTION_READY' ? 
                   '🥈 GOOD - Production Ready' :
                   report.enterpriseReadiness.readinessLevel === 'DEVELOPMENT_READY' ? 
                   '🥉 FAIR - Development Ready' :
                   '⚠️  NEEDS IMPROVEMENT';
    
    console.log(`  ${verdict}`);
    console.log(`  Enterprise Grade: ${report.enterpriseReadiness.grade}`);
    
    console.log('═'.repeat(80));
  }

  async run() {
    console.log('🔍 Starting Final Performance Analysis...\n');

    // Load test results
    const benchmarkResults = this.loadTestResults('benchmark-results.json');
    const scalabilityResults = this.loadTestResults('scalability-results.json');

    // Analyze results
    this.analysisResults.cli = this.analyzeCLIPerformance(benchmarkResults);
    this.analysisResults.scalability = this.analyzeScalabilityPerformance(scalabilityResults);

    // Generate comprehensive report
    const finalReport = this.generateComprehensiveReport();

    // Save analysis results
    const analysisFile = join(this.resultsDir, 'final-analysis.json');
    writeFileSync(analysisFile, JSON.stringify(finalReport, null, 2));

    // Print detailed report
    this.printDetailedReport(finalReport);

    console.log(`\n💾 Final analysis saved to: ${analysisFile}\n`);

    return finalReport;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const analyzer = new FinalPerformanceAnalyzer();
  analyzer.run().catch(error => {
    console.error('❌ Final analysis failed:', error);
    process.exit(1);
  });
}

export default FinalPerformanceAnalyzer;