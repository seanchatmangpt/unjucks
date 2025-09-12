/**
 * Clean Room Semantic Web Validation Master Test Suite
 * Comprehensive validation of all semantic web capabilities
 */

import { TurtleGenerationTester } from './rdf-turtle/turtle-generation-test.js';
import { SPARQLGenerationTester } from './sparql/sparql-generation-test.js';
import { EnterpriseScenariosTester } from './enterprise/enterprise-scenarios-test.js';
import fs from 'fs/promises';
import path from 'path';

export class SemanticWebValidationMaster {
  constructor() {
    this.results = {
      startTime: this.getDeterministicDate(),
      testSuites: {},
      overallStats: {
        totalTests: 0,
        totalPassed: 0,
        totalFailed: 0,
        overallSuccessRate: 0
      },
      baselineComparison: {
        expectedRate: 71.0,
        actualRate: 0,
        meetsBaseline: false,
        improvement: 0
      },
      recommendations: []
    };
  }

  async runComprehensiveValidation() {
    console.log('🚀 Starting Comprehensive Semantic Web Validation');
    console.log('📊 Testing against 71% baseline success rate...\n');

    // Run RDF/Turtle Generation Tests
    console.log('1️⃣ RDF/Turtle Generation Tests');
    const turtleTester = new TurtleGenerationTester();
    const turtleResults = await turtleTester.runAllTests();
    this.results.testSuites.rdfTurtle = turtleResults;

    // Run SPARQL Integration Tests
    console.log('\n2️⃣ SPARQL Integration Tests');
    const sparqlTester = new SPARQLGenerationTester();
    const sparqlResults = await sparqlTester.runAllTests();
    this.results.testSuites.sparql = sparqlResults;

    // Run Enterprise Scenarios Tests
    console.log('\n3️⃣ Enterprise Scenarios Tests');
    const enterpriseTester = new EnterpriseScenariosTester();
    const enterpriseResults = await enterpriseTester.runAllTests();
    this.results.testSuites.enterprise = enterpriseResults;

    // Calculate overall statistics
    this.calculateOverallStats();
    
    // Generate recommendations
    this.generateRecommendations();

    // Generate final report
    const report = this.generateFinalReport();
    
    // Save results to file
    await this.saveResults(report);

    return report;
  }

  calculateOverallStats() {
    const suites = Object.values(this.results.testSuites);
    
    this.results.overallStats = suites.reduce((acc, suite) => ({
      totalTests: acc.totalTests + suite.summary.totalTests,
      totalPassed: acc.totalPassed + suite.summary.passed,
      totalFailed: acc.totalFailed + suite.summary.failed
    }), { totalTests: 0, totalPassed: 0, totalFailed: 0 });

    this.results.overallStats.overallSuccessRate = 
      (this.results.overallStats.totalPassed / this.results.overallStats.totalTests) * 100;

    // Baseline comparison
    this.results.baselineComparison.actualRate = this.results.overallStats.overallSuccessRate;
    this.results.baselineComparison.meetsBaseline = 
      this.results.overallStats.overallSuccessRate >= this.results.baselineComparison.expectedRate;
    this.results.baselineComparison.improvement = 
      this.results.overallStats.overallSuccessRate - this.results.baselineComparison.expectedRate;
  }

  generateRecommendations() {
    const { testSuites, overallStats, baselineComparison } = this.results;

    // Overall performance recommendations
    if (baselineComparison.actualRate < baselineComparison.expectedRate) {
      this.results.recommendations.push({
        priority: 'HIGH',
        category: 'Overall Performance',
        issue: `Success rate ${baselineComparison.actualRate.toFixed(1)}% is below baseline ${baselineComparison.expectedRate}%`,
        recommendation: 'Focus on improving failing test areas identified below'
      });
    }

    // RDF/Turtle specific recommendations
    if (testSuites.rdfTurtle.summary.failed > 0) {
      this.results.recommendations.push({
        priority: 'HIGH',
        category: 'RDF/Turtle Generation',
        issue: `${testSuites.rdfTurtle.summary.failed} RDF/Turtle tests failed`,
        recommendation: 'Review N3.js integration and vocabulary mapping implementations'
      });
    }

    // SPARQL specific recommendations
    if (testSuites.sparql.summary.failed > 0) {
      const sparqlFailures = testSuites.sparql.details.filter(d => d.status === 'FAIL');
      if (sparqlFailures.some(f => f.test.includes('Prefix'))) {
        this.results.recommendations.push({
          priority: 'MEDIUM',
          category: 'SPARQL Integration',
          issue: 'SPARQL prefix generation issues detected',
          recommendation: 'Improve prefix mapping and generation logic as noted in semantic web report'
        });
      }
    }

    // Enterprise scenarios recommendations
    if (testSuites.enterprise.summary.failed > 0) {
      this.results.recommendations.push({
        priority: 'HIGH',
        category: 'Enterprise Readiness',
        issue: `${testSuites.enterprise.summary.failed} enterprise compliance tests failed`,
        recommendation: 'Strengthen Fortune 500 compliance implementations (FIBO, FHIR, GS1, PCI DSS)'
      });
    }

    // Performance recommendations
    if (baselineComparison.actualRate >= 80) {
      this.results.recommendations.push({
        priority: 'LOW',
        category: 'Optimization',
        issue: 'High performance achieved',
        recommendation: 'Consider expanding test coverage or implementing advanced semantic reasoning'
      });
    }
  }

  generateFinalReport() {
    const { overallStats, baselineComparison, testSuites, recommendations } = this.results;
    const endTime = this.getDeterministicDate();
    const duration = endTime - this.results.startTime;

    return {
      metadata: {
        testSuite: 'Semantic Web Validation Master',
        version: '1.0.0',
        timestamp: endTime.toISOString(),
        duration: `${(duration / 1000).toFixed(2)}s`,
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch
        }
      },

      executiveSummary: {
        overallVerdict: baselineComparison.meetsBaseline ? '✅ BASELINE_MET' : '❌ BELOW_BASELINE',
        successRate: `${overallStats.overallSuccessRate.toFixed(1)}%`,
        baselineComparison: `${baselineComparison.improvement >= 0 ? '+' : ''}${baselineComparison.improvement.toFixed(1)}%`,
        totalTests: overallStats.totalTests,
        criticalIssues: recommendations.filter(r => r.priority === 'HIGH').length,
        keyFindings: this.generateKeyFindings()
      },

      detailedResults: {
        rdfTurtle: {
          ...testSuites.rdfTurtle,
          focus: 'Schema.org, FOAF, SKOS, Dublin Core vocabulary support'
        },
        sparql: {
          ...testSuites.sparql,
          focus: 'Query generation, prefix handling, execution performance'
        },
        enterprise: {
          ...testSuites.enterprise,
          focus: 'Fortune 500 compliance scenarios (Financial, Healthcare, Manufacturing, Retail)'
        }
      },

      recommendations: recommendations.sort((a, b) => {
        const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }),

      complianceMatrix: this.generateComplianceMatrix(),

      nextSteps: this.generateNextSteps()
    };
  }

  generateKeyFindings() {
    const findings = [];
    const { testSuites, overallStats, baselineComparison } = this.results;

    // Overall performance finding
    if (baselineComparison.meetsBaseline) {
      findings.push(`✅ Semantic web capabilities meet ${baselineComparison.expectedRate}% baseline requirement`);
    } else {
      findings.push(`❌ Performance gap: ${Math.abs(baselineComparison.improvement).toFixed(1)}% below baseline`);
    }

    // RDF/Turtle findings
    const rdfRate = parseFloat(testSuites.rdfTurtle.summary.successRate);
    if (rdfRate >= 90) {
      findings.push('✅ Excellent RDF/Turtle generation capabilities across all major vocabularies');
    } else if (rdfRate >= 75) {
      findings.push('🟡 Good RDF/Turtle generation with room for improvement');
    } else {
      findings.push('❌ RDF/Turtle generation needs significant improvement');
    }

    // SPARQL findings
    const sparqlRate = parseFloat(testSuites.sparql.summary.successRate);
    if (sparqlRate >= 75) {
      findings.push('✅ Strong SPARQL integration and query generation');
    } else {
      findings.push('❌ SPARQL integration requires attention, especially prefix generation');
    }

    // Enterprise findings
    const enterpriseRate = parseFloat(testSuites.enterprise.summary.successRate);
    if (enterpriseRate >= 80) {
      findings.push('✅ Enterprise-ready with Fortune 500 compliance capabilities');
    } else {
      findings.push('🟡 Enterprise scenarios need strengthening for production readiness');
    }

    return findings;
  }

  generateComplianceMatrix() {
    return {
      vocabularies: {
        'Schema.org': testSuites.rdfTurtle.details.some(d => d.test.includes('Schema.org') && d.status === 'PASS') ? '✅' : '❌',
        'FOAF': testSuites.rdfTurtle.details.some(d => d.test.includes('FOAF') && d.status === 'PASS') ? '✅' : '❌',
        'SKOS': testSuites.rdfTurtle.details.some(d => d.test.includes('SKOS') && d.status === 'PASS') ? '✅' : '❌',
        'Dublin Core': testSuites.rdfTurtle.details.some(d => d.test.includes('Dublin Core') && d.status === 'PASS') ? '✅' : '❌'
      },
      enterprise: {
        'Financial (FIBO/Basel III/SOX)': testSuites.enterprise.details.some(d => d.test.includes('Financial') && d.status === 'PASS') ? '✅' : '❌',
        'Healthcare (FHIR/HIPAA)': testSuites.enterprise.details.some(d => d.test.includes('Healthcare') && d.status === 'PASS') ? '✅' : '❌',
        'Manufacturing (GS1/ISO)': testSuites.enterprise.details.some(d => d.test.includes('Manufacturing') && d.status === 'PASS') ? '✅' : '❌',
        'Retail (PCI DSS/GDPR/CCPA)': testSuites.enterprise.details.some(d => d.test.includes('Retail') && d.status === 'PASS') ? '✅' : '❌'
      },
      technical: {
        'SPARQL Generation': parseFloat(testSuites.sparql.summary.successRate) >= 75 ? '✅' : '❌',
        'RDF Parsing': testSuites.rdfTurtle.summary.passed > 0 ? '✅' : '❌',
        'Prefix Management': testSuites.sparql.details.some(d => d.test.includes('Prefix') && d.status === 'PASS') ? '✅' : '🟡',
        'Enterprise Integration': parseFloat(testSuites.enterprise.summary.successRate) >= 75 ? '✅' : '❌'
      }
    };
  }

  generateNextSteps() {
    const steps = [];
    const { baselineComparison, recommendations } = this.results;

    if (baselineComparison.meetsBaseline) {
      steps.push('✅ Baseline requirements met - proceed with production deployment');
      steps.push('🔄 Consider expanding test coverage for edge cases');
      steps.push('📈 Implement performance monitoring in production');
    } else {
      steps.push('⚠️ Address high-priority recommendations before production');
      steps.push('🔧 Focus on failing test areas for immediate improvement');
      steps.push('📊 Re-run validation after fixes to confirm baseline compliance');
    }

    // Add specific technical steps based on failures
    const highPriorityRecs = recommendations.filter(r => r.priority === 'HIGH');
    if (highPriorityRecs.length > 0) {
      steps.push(`🎯 Priority focus areas: ${highPriorityRecs.map(r => r.category).join(', ')}`);
    }

    steps.push('📋 Schedule regular semantic validation runs for continuous compliance');
    
    return steps;
  }

  async saveResults(report) {
    const reportPath = path.join(process.cwd(), 'tests/semantic-web-cleanroom/reports');
    await fs.mkdir(reportPath, { recursive: true });
    
    const filename = `semantic-validation-report-${this.getDeterministicDate().toISOString().split('T')[0]}.json`;
    const filepath = path.join(reportPath, filename);
    
    await fs.writeFile(filepath, JSON.stringify(report, null, 2));
    console.log(`\n💾 Detailed report saved to: ${filepath}`);
    
    return filepath;
  }
}

// Run master validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🧪 Clean Room Semantic Web Validation');
  console.log('🎯 Validating RDF/Turtle, SPARQL, vocabularies, and enterprise scenarios');
  console.log('📊 Testing against reported 71% baseline success rate\n');

  const master = new SemanticWebValidationMaster();
  const report = await master.runComprehensiveValidation();

  console.log('\n' + '='.repeat(80));
  console.log('📋 FINAL VALIDATION REPORT');
  console.log('='.repeat(80));
  
  console.log(`\n🎯 Overall Verdict: ${report.executiveSummary.overallVerdict}`);
  console.log(`📊 Success Rate: ${report.executiveSummary.successRate} (baseline: 71.0%)`);
  console.log(`📈 Baseline Comparison: ${report.executiveSummary.baselineComparison}`);
  console.log(`🧪 Total Tests: ${report.executiveSummary.totalTests}`);
  console.log(`⚠️  Critical Issues: ${report.executiveSummary.criticalIssues}`);

  console.log('\n📋 Key Findings:');
  report.executiveSummary.keyFindings.forEach(finding => {
    console.log(`  ${finding}`);
  });

  console.log('\n🚀 Next Steps:');
  report.nextSteps.forEach(step => {
    console.log(`  ${step}`);
  });

  if (report.recommendations.length > 0) {
    console.log('\n⚠️  Recommendations:');
    report.recommendations.slice(0, 3).forEach(rec => {
      console.log(`  [${rec.priority}] ${rec.category}: ${rec.recommendation}`);
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log('Validation complete! Check detailed report file for full results.');
  console.log('='.repeat(80));
}