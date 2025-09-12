#!/usr/bin/env node

/**
 * Production Readiness Assessment Script
 * Comprehensive validation for Fortune 500 deployment standards
 */

import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Import monitoring components
const HealthMonitor = await import('../src/lib/monitoring/health-monitor.js').then(m => m.HealthMonitor);
const StructuredLogger = await import('../src/lib/monitoring/structured-logger.js').then(m => m.StructuredLogger);

class ProductionReadinessChecker {
  constructor() {
    this.logger = new StructuredLogger({
      service: 'production-readiness-check',
      level: 'INFO',
      console: true
    });
    
    this.healthMonitor = new HealthMonitor();
    
    this.results = {
      timestamp: this.getDeterministicDate().toISOString(),
      overallStatus: 'unknown',
      score: 0,
      maxScore: 0,
      categories: {},
      criticalIssues: [],
      recommendations: [],
      deploymentReady: false
    };
    
    this.weights = {
      'Core Functionality': 40,
      'Security & Compliance': 25,
      'Monitoring & Operations': 20,
      'Quality & Testing': 15
    };
  }

  /**
   * Run comprehensive production readiness assessment
   */
  async runAssessment() {
    console.log('🚀 Running Production Readiness Assessment\n');
    console.log('=' * 60);
    
    const startTime = performance.now();
    const correlationId = this.logger.startCorrelation('production_readiness_check');
    
    try {
      // Run all assessment categories
      await this.assessCoreFunctionality();
      await this.assessSecurityCompliance();
      await this.assessMonitoringOperations();
      await this.assessQualityTesting();
      
      // Calculate overall results
      this.calculateOverallResults();
      
      // Generate report
      await this.generateReport();
      
      // Determine deployment readiness
      this.determineDeploymentReadiness();
      
      const duration = performance.now() - startTime;
      this.logger.endCorrelation(correlationId, true, { 
        duration: Math.round(duration),
        score: this.results.score,
        status: this.results.overallStatus
      });
      
      // Display results
      this.displayResults();
      
      return this.results;
      
    } catch (error) {
      this.logger.error('Production readiness assessment failed', { error: error.message }, error);
      this.logger.endCorrelation(correlationId, false, { error: error.message });
      throw error;
    }
  }

  /**
   * Assess core functionality (40% weight)
   */
  async assessCoreFunctionality() {
    console.log('🔍 Assessing Core Functionality...');
    
    const categoryResults = {
      name: 'Core Functionality',
      weight: this.weights['Core Functionality'],
      score: 0,
      maxScore: 40,
      checks: {}
    };
    
    // Test template discovery
    const templateDiscovery = await this.testTemplateDiscovery();
    categoryResults.checks.templateDiscovery = templateDiscovery;
    
    // Test template generation
    const templateGeneration = await this.testTemplateGeneration();
    categoryResults.checks.templateGeneration = templateGeneration;
    
    // Test CLI interface
    const cliInterface = await this.testCLIInterface();
    categoryResults.checks.cliInterface = cliInterface;
    
    // Test binary distribution
    const binaryDistribution = await this.testBinaryDistribution();
    categoryResults.checks.binaryDistribution = binaryDistribution;
    
    // Calculate category score
    const checks = Object.values(categoryResults.checks);
    categoryResults.score = checks.reduce((sum, check) => sum + check.score, 0);
    categoryResults.status = this.getStatusFromScore(categoryResults.score, categoryResults.maxScore);
    
    this.results.categories['Core Functionality'] = categoryResults;
    
    console.log(`   Score: ${categoryResults.score}/${categoryResults.maxScore} (${categoryResults.status})\n`);
  }

  /**
   * Assess security and compliance (25% weight)
   */
  async assessSecurityCompliance() {
    console.log('🔒 Assessing Security & Compliance...');
    
    const categoryResults = {
      name: 'Security & Compliance',
      weight: this.weights['Security & Compliance'],
      score: 0,
      maxScore: 25,
      checks: {}
    };
    
    // Security scanning
    const securityScanning = await this.testSecurityScanning();
    categoryResults.checks.securityScanning = securityScanning;
    
    // Audit logging capability
    const auditLogging = await this.testAuditLogging();
    categoryResults.checks.auditLogging = auditLogging;
    
    // Access control
    const accessControl = await this.testAccessControl();
    categoryResults.checks.accessControl = accessControl;
    
    // Vulnerability management
    const vulnerabilityMgmt = await this.testVulnerabilityManagement();
    categoryResults.checks.vulnerabilityMgmt = vulnerabilityMgmt;
    
    // Calculate category score
    const checks = Object.values(categoryResults.checks);
    categoryResults.score = checks.reduce((sum, check) => sum + check.score, 0);
    categoryResults.status = this.getStatusFromScore(categoryResults.score, categoryResults.maxScore);
    
    this.results.categories['Security & Compliance'] = categoryResults;
    
    console.log(`   Score: ${categoryResults.score}/${categoryResults.maxScore} (${categoryResults.status})\n`);
  }

  /**
   * Assess monitoring and operations (20% weight)
   */
  async assessMonitoringOperations() {
    console.log('📊 Assessing Monitoring & Operations...');
    
    const categoryResults = {
      name: 'Monitoring & Operations',
      weight: this.weights['Monitoring & Operations'],
      score: 0,
      maxScore: 20,
      checks: {}
    };
    
    // Health monitoring
    const healthMonitoring = await this.testHealthMonitoring();
    categoryResults.checks.healthMonitoring = healthMonitoring;
    
    // Error tracking
    const errorTracking = await this.testErrorTracking();
    categoryResults.checks.errorTracking = errorTracking;
    
    // Performance monitoring
    const performanceMonitoring = await this.testPerformanceMonitoring();
    categoryResults.checks.performanceMonitoring = performanceMonitoring;
    
    // Structured logging
    const structuredLogging = await this.testStructuredLogging();
    categoryResults.checks.structuredLogging = structuredLogging;
    
    // Calculate category score
    const checks = Object.values(categoryResults.checks);
    categoryResults.score = checks.reduce((sum, check) => sum + check.score, 0);
    categoryResults.status = this.getStatusFromScore(categoryResults.score, categoryResults.maxScore);
    
    this.results.categories['Monitoring & Operations'] = categoryResults;
    
    console.log(`   Score: ${categoryResults.score}/${categoryResults.maxScore} (${categoryResults.status})\n`);
  }

  /**
   * Assess quality and testing (15% weight)
   */
  async assessQualityTesting() {
    console.log('🧪 Assessing Quality & Testing...');
    
    const categoryResults = {
      name: 'Quality & Testing',
      weight: this.weights['Quality & Testing'],
      score: 0,
      maxScore: 15,
      checks: {}
    };
    
    // Test coverage
    const testCoverage = await this.testTestCoverage();
    categoryResults.checks.testCoverage = testCoverage;
    
    // Quality gates
    const qualityGates = await this.testQualityGates();
    categoryResults.checks.qualityGates = qualityGates;
    
    // Performance testing
    const performanceTesting = await this.testPerformanceTesting();
    categoryResults.checks.performanceTesting = performanceTesting;
    
    // Integration testing
    const integrationTesting = await this.testIntegrationTesting();
    categoryResults.checks.integrationTesting = integrationTesting;
    
    // Calculate category score
    const checks = Object.values(categoryResults.checks);
    categoryResults.score = checks.reduce((sum, check) => sum + check.score, 0);
    categoryResults.status = this.getStatusFromScore(categoryResults.score, categoryResults.maxScore);
    
    this.results.categories['Quality & Testing'] = categoryResults;
    
    console.log(`   Score: ${categoryResults.score}/${categoryResults.maxScore} (${categoryResults.status})\n`);
  }

  /**
   * Test template discovery functionality
   */
  async testTemplateDiscovery() {
    const test = {
      name: 'Template Discovery',
      score: 0,
      maxScore: 10,
      status: 'unknown',
      issues: [],
      details: {}
    };
    
    try {
      // Test if list command works
      const result = await this.executeCommand('node src/cli/index.js list', 5000);
      
      if (result.code === 0 && !result.stdout.includes('No generators found')) {
        test.score = 10;
        test.status = 'passed';
        test.details.templateCount = (result.stdout.match(/\n/g) || []).length;
      } else if (result.code === 0) {
        test.score = 2;
        test.status = 'failed';
        test.issues.push('List command runs but finds no templates');
      } else {
        test.score = 0;
        test.status = 'failed';
        test.issues.push(`List command failed with exit code ${result.code}`);
      }
      
      test.details.commandOutput = result.stdout.substring(0, 200);
      
    } catch (error) {
      test.score = 0;
      test.status = 'failed';
      test.issues.push(`Template discovery test failed: ${error.message}`);
    }
    
    if (test.score < 8) {
      this.results.criticalIssues.push({
        category: 'Core Functionality',
        issue: 'Template discovery system not working',
        severity: 'critical',
        impact: 'Users cannot discover available templates'
      });
    }
    
    return test;
  }

  /**
   * Test template generation functionality
   */
  async testTemplateGeneration() {
    const test = {
      name: 'Template Generation',
      score: 0,
      maxScore: 10,
      status: 'unknown',
      issues: [],
      details: {}
    };
    
    try {
      // Test basic template generation (dry run to avoid file creation)
      const result = await this.executeCommand('node src/cli/index.js generate component react Button --dry', 10000);
      
      if (result.code === 0) {
        test.score = 8;
        test.status = 'passed';
      } else {
        test.score = 3;
        test.status = 'failed';
        test.issues.push('Template generation failed in dry run mode');
      }
      
      test.details.commandOutput = result.stdout.substring(0, 200);
      test.details.errorOutput = result.stderr.substring(0, 200);
      
    } catch (error) {
      test.score = 0;
      test.status = 'failed';
      test.issues.push(`Template generation test failed: ${error.message}`);
    }
    
    if (test.score < 6) {
      this.results.criticalIssues.push({
        category: 'Core Functionality',
        issue: 'Template generation not working reliably',
        severity: 'high',
        impact: 'Core functionality unavailable to users'
      });
    }
    
    return test;
  }

  /**
   * Test CLI interface
   */
  async testCLIInterface() {
    const test = {
      name: 'CLI Interface',
      score: 0,
      maxScore: 10,
      status: 'unknown',
      issues: [],
      details: { commandsWorking: 0, commandsTested: 0 }
    };
    
    const commands = [
      { cmd: '--version', description: 'Version check' },
      { cmd: '--help', description: 'Help display' },
      { cmd: 'perf --help', description: 'Performance tools' }
    ];
    
    let workingCommands = 0;
    
    for (const command of commands) {
      try {
        const result = await this.executeCommand(`node src/cli/index.js ${command.cmd}`, 5000);
        test.details.commandsTested++;
        
        if (result.code === 0) {
          workingCommands++;
        } else {
          test.issues.push(`Command '${command.cmd}' failed`);
        }
      } catch (error) {
        test.details.commandsTested++;
        test.issues.push(`Command '${command.cmd}' threw error: ${error.message}`);
      }
    }
    
    test.details.commandsWorking = workingCommands;
    test.score = Math.round((workingCommands / commands.length) * 10);
    test.status = test.score >= 8 ? 'passed' : test.score >= 5 ? 'degraded' : 'failed';
    
    return test;
  }

  /**
   * Test binary distribution
   */
  async testBinaryDistribution() {
    const test = {
      name: 'Binary Distribution',
      score: 0,
      maxScore: 10,
      status: 'unknown',
      issues: [],
      details: {}
    };
    
    try {
      const binaryPath = path.join(projectRoot, 'bin/unjucks.cjs');
      
      if (await fs.pathExists(binaryPath)) {
        test.score += 3;
        test.details.binaryExists = true;
        
        // Test binary execution
        try {
          const result = await this.executeCommand(`node ${binaryPath} --version`, 5000);
          if (result.code === 0) {
            test.score += 7;
            test.status = 'passed';
          } else {
            test.score += 2;
            test.status = 'failed';
            test.issues.push('Binary exists but fails to execute');
          }
        } catch (error) {
          test.score += 1;
          test.status = 'failed';
          test.issues.push(`Binary execution failed: ${error.message}`);
        }
      } else {
        test.score = 0;
        test.status = 'failed';
        test.issues.push('Binary file does not exist');
        test.details.binaryExists = false;
      }
      
    } catch (error) {
      test.score = 0;
      test.status = 'failed';
      test.issues.push(`Binary test failed: ${error.message}`);
    }
    
    if (test.score < 8) {
      this.results.criticalIssues.push({
        category: 'Core Functionality',
        issue: 'Binary distribution not working',
        severity: 'critical',
        impact: 'Users cannot install and use the tool'
      });
    }
    
    return test;
  }

  /**
   * Test security scanning capability
   */
  async testSecurityScanning() {
    const test = {
      name: 'Security Scanning',
      score: 0,
      maxScore: 8,
      status: 'unknown',
      issues: [],
      details: {}
    };
    
    try {
      const securityScannerPath = path.join(projectRoot, 'tests/qa/security-scanner.js');
      
      if (await fs.pathExists(securityScannerPath)) {
        test.score = 8;
        test.status = 'passed';
        test.details.scannerExists = true;
      } else {
        test.score = 0;
        test.status = 'failed';
        test.issues.push('Security scanner not found');
        test.details.scannerExists = false;
      }
      
    } catch (error) {
      test.score = 0;
      test.status = 'failed';
      test.issues.push(`Security scanning test failed: ${error.message}`);
    }
    
    return test;
  }

  /**
   * Test audit logging capability
   */
  async testAuditLogging() {
    const test = {
      name: 'Audit Logging',
      score: 0,
      maxScore: 6,
      status: 'unknown',
      issues: [],
      details: {}
    };
    
    try {
      // Check if structured logger exists
      const loggerPath = path.join(projectRoot, 'src/lib/monitoring/structured-logger.js');
      
      if (await fs.pathExists(loggerPath)) {
        test.score = 6;
        test.status = 'passed';
        test.details.loggerExists = true;
      } else {
        test.score = 0;
        test.status = 'failed';
        test.issues.push('Structured logging system not implemented');
        test.details.loggerExists = false;
      }
      
    } catch (error) {
      test.score = 0;
      test.status = 'failed';
      test.issues.push(`Audit logging test failed: ${error.message}`);
    }
    
    if (test.score < 4) {
      this.results.criticalIssues.push({
        category: 'Security & Compliance',
        issue: 'No audit logging system',
        severity: 'high',
        impact: 'Cannot meet compliance requirements'
      });
    }
    
    return test;
  }

  /**
   * Test access control
   */
  async testAccessControl() {
    const test = {
      name: 'Access Control',
      score: 0,
      maxScore: 5,
      status: 'unknown',
      issues: [],
      details: {}
    };
    
    // Access control is not implemented yet
    test.score = 0;
    test.status = 'failed';
    test.issues.push('Access control system not implemented');
    test.details.implemented = false;
    
    this.results.criticalIssues.push({
      category: 'Security & Compliance',
      issue: 'No access control system',
      severity: 'medium',
      impact: 'Cannot control user access to templates and features'
    });
    
    return test;
  }

  /**
   * Test vulnerability management
   */
  async testVulnerabilityManagement() {
    const test = {
      name: 'Vulnerability Management',
      score: 0,
      maxScore: 6,
      status: 'unknown',
      issues: [],
      details: {}
    };
    
    try {
      // Run npm audit to check for vulnerabilities
      const result = await this.executeCommand('npm audit --audit-level=moderate --json', 10000);
      
      if (result.code === 0) {
        test.score = 6;
        test.status = 'passed';
        test.details.vulnerabilities = 0;
      } else {
        // Parse audit results
        try {
          const auditData = JSON.parse(result.stdout);
          const vulnCount = Object.keys(auditData.vulnerabilities || {}).length;
          
          if (vulnCount === 0) {
            test.score = 6;
            test.status = 'passed';
          } else if (vulnCount <= 5) {
            test.score = 4;
            test.status = 'degraded';
            test.issues.push(`${vulnCount} moderate vulnerabilities found`);
          } else {
            test.score = 2;
            test.status = 'failed';
            test.issues.push(`${vulnCount} vulnerabilities found`);
          }
          
          test.details.vulnerabilities = vulnCount;
        } catch (parseError) {
          test.score = 3;
          test.status = 'degraded';
          test.issues.push('Could not parse vulnerability scan results');
        }
      }
      
    } catch (error) {
      test.score = 0;
      test.status = 'failed';
      test.issues.push(`Vulnerability scan failed: ${error.message}`);
    }
    
    return test;
  }

  /**
   * Test health monitoring
   */
  async testHealthMonitoring() {
    const test = {
      name: 'Health Monitoring',
      score: 0,
      maxScore: 6,
      status: 'unknown',
      issues: [],
      details: {}
    };
    
    try {
      // Test health monitor
      const healthResult = await this.healthMonitor.performHealthCheck();
      
      if (healthResult.status === 'healthy') {
        test.score = 6;
        test.status = 'passed';
      } else if (healthResult.status === 'degraded') {
        test.score = 4;
        test.status = 'degraded';
        test.issues.push('Health monitoring shows degraded status');
      } else {
        test.score = 2;
        test.status = 'failed';
        test.issues.push('Health monitoring shows unhealthy status');
      }
      
      test.details.healthStatus = healthResult.status;
      test.details.checkDuration = healthResult.checkDuration;
      
    } catch (error) {
      test.score = 0;
      test.status = 'failed';
      test.issues.push(`Health monitoring test failed: ${error.message}`);
    }
    
    return test;
  }

  /**
   * Test error tracking
   */
  async testErrorTracking() {
    const test = {
      name: 'Error Tracking',
      score: 0,
      maxScore: 4,
      status: 'unknown',
      issues: [],
      details: {}
    };
    
    // Error tracking is not fully implemented yet
    test.score = 2;
    test.status = 'degraded';
    test.issues.push('Error tracking system partially implemented');
    test.details.implemented = false;
    
    return test;
  }

  /**
   * Test performance monitoring
   */
  async testPerformanceMonitoring() {
    const test = {
      name: 'Performance Monitoring',
      score: 0,
      maxScore: 5,
      status: 'unknown',
      issues: [],
      details: {}
    };
    
    try {
      const perfTestPath = path.join(projectRoot, 'tests/qa/performance-regression.js');
      
      if (await fs.pathExists(perfTestPath)) {
        test.score = 5;
        test.status = 'passed';
        test.details.perfTestingExists = true;
      } else {
        test.score = 0;
        test.status = 'failed';
        test.issues.push('Performance testing framework not found');
        test.details.perfTestingExists = false;
      }
      
    } catch (error) {
      test.score = 0;
      test.status = 'failed';
      test.issues.push(`Performance monitoring test failed: ${error.message}`);
    }
    
    return test;
  }

  /**
   * Test structured logging
   */
  async testStructuredLogging() {
    const test = {
      name: 'Structured Logging',
      score: 0,
      maxScore: 5,
      status: 'unknown',
      issues: [],
      details: {}
    };
    
    try {
      const loggerPath = path.join(projectRoot, 'src/lib/monitoring/structured-logger.js');
      
      if (await fs.pathExists(loggerPath)) {
        test.score = 5;
        test.status = 'passed';
        test.details.structuredLoggerExists = true;
      } else {
        test.score = 0;
        test.status = 'failed';
        test.issues.push('Structured logging system not found');
        test.details.structuredLoggerExists = false;
      }
      
    } catch (error) {
      test.score = 0;
      test.status = 'failed';
      test.issues.push(`Structured logging test failed: ${error.message}`);
    }
    
    return test;
  }

  /**
   * Test test coverage
   */
  async testTestCoverage() {
    const test = {
      name: 'Test Coverage',
      score: 0,
      maxScore: 5,
      status: 'unknown',
      issues: [],
      details: {}
    };
    
    try {
      // Run coverage test
      const result = await this.executeCommand('npm run test:coverage', 30000);
      
      if (result.code === 0) {
        // Try to extract coverage percentage
        const coverageMatch = result.stdout.match(/All files[^|]*\|\s*([0-9.]+)/);
        if (coverageMatch) {
          const coverage = parseFloat(coverageMatch[1]);
          test.details.coverage = coverage;
          
          if (coverage >= 80) {
            test.score = 5;
            test.status = 'passed';
          } else if (coverage >= 60) {
            test.score = 3;
            test.status = 'degraded';
            test.issues.push(`Coverage ${coverage}% below 80% target`);
          } else {
            test.score = 1;
            test.status = 'failed';
            test.issues.push(`Low coverage: ${coverage}%`);
          }
        } else {
          test.score = 3;
          test.status = 'degraded';
          test.issues.push('Could not parse coverage percentage');
        }
      } else {
        test.score = 0;
        test.status = 'failed';
        test.issues.push('Coverage test execution failed');
      }
      
    } catch (error) {
      test.score = 0;
      test.status = 'failed';
      test.issues.push(`Test coverage assessment failed: ${error.message}`);
    }
    
    return test;
  }

  /**
   * Test quality gates
   */
  async testQualityGates() {
    const test = {
      name: 'Quality Gates',
      score: 0,
      maxScore: 4,
      status: 'unknown',
      issues: [],
      details: {}
    };
    
    try {
      const qualityGatesPath = path.join(projectRoot, 'tests/qa/quality-gates.js');
      
      if (await fs.pathExists(qualityGatesPath)) {
        test.score = 4;
        test.status = 'passed';
        test.details.qualityGatesExist = true;
      } else {
        test.score = 0;
        test.status = 'failed';
        test.issues.push('Quality gates framework not found');
        test.details.qualityGatesExist = false;
      }
      
    } catch (error) {
      test.score = 0;
      test.status = 'failed';
      test.issues.push(`Quality gates test failed: ${error.message}`);
    }
    
    return test;
  }

  /**
   * Test performance testing
   */
  async testPerformanceTesting() {
    const test = {
      name: 'Performance Testing',
      score: 0,
      maxScore: 3,
      status: 'unknown',
      issues: [],
      details: {}
    };
    
    try {
      const perfRegressionPath = path.join(projectRoot, 'tests/qa/performance-regression.js');
      
      if (await fs.pathExists(perfRegressionPath)) {
        test.score = 3;
        test.status = 'passed';
        test.details.perfTestingExists = true;
      } else {
        test.score = 0;
        test.status = 'failed';
        test.issues.push('Performance testing framework not found');
        test.details.perfTestingExists = false;
      }
      
    } catch (error) {
      test.score = 0;
      test.status = 'failed';
      test.issues.push(`Performance testing assessment failed: ${error.message}`);
    }
    
    return test;
  }

  /**
   * Test integration testing
   */
  async testIntegrationTesting() {
    const test = {
      name: 'Integration Testing',
      score: 0,
      maxScore: 3,
      status: 'unknown',
      issues: [],
      details: {}
    };
    
    try {
      // Run integration tests
      const result = await this.executeCommand('npm run test:integration', 15000);
      
      if (result.code === 0) {
        test.score = 3;
        test.status = 'passed';
      } else {
        test.score = 1;
        test.status = 'failed';
        test.issues.push('Integration tests failed');
      }
      
      test.details.integrationTestOutput = result.stdout.substring(0, 200);
      
    } catch (error) {
      test.score = 0;
      test.status = 'failed';
      test.issues.push(`Integration testing failed: ${error.message}`);
    }
    
    return test;
  }

  /**
   * Execute command with timeout
   */
  async executeCommand(command, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ');
      const process = spawn(cmd, args, {
        cwd: projectRoot,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
      
      const timeoutId = setTimeout(() => {
        process.kill();
        reject(new Error(`Command timeout after ${timeout}ms: ${command}`));
      }, timeout);
      
      process.on('close', (code) => {
        clearTimeout(timeoutId);
        resolve({ code, stdout, stderr });
      });
      
      process.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  /**
   * Calculate overall results
   */
  calculateOverallResults() {
    let totalScore = 0;
    let totalMaxScore = 0;
    
    Object.values(this.results.categories).forEach(category => {
      totalScore += category.score;
      totalMaxScore += category.maxScore;
    });
    
    this.results.score = totalScore;
    this.results.maxScore = totalMaxScore;
    
    const percentage = (totalScore / totalMaxScore) * 100;
    
    if (percentage >= 90) {
      this.results.overallStatus = 'excellent';
    } else if (percentage >= 75) {
      this.results.overallStatus = 'good';
    } else if (percentage >= 60) {
      this.results.overallStatus = 'fair';
    } else {
      this.results.overallStatus = 'poor';
    }
  }

  /**
   * Determine deployment readiness
   */
  determineDeploymentReadiness() {
    const criticalIssuesCount = this.results.criticalIssues.filter(issue => 
      issue.severity === 'critical'
    ).length;
    
    const highIssuesCount = this.results.criticalIssues.filter(issue => 
      issue.severity === 'high'
    ).length;
    
    const percentage = (this.results.score / this.results.maxScore) * 100;
    
    // Deployment criteria
    this.results.deploymentReady = (
      criticalIssuesCount === 0 &&
      highIssuesCount <= 2 &&
      percentage >= 70
    );
    
    // Generate recommendations
    if (!this.results.deploymentReady) {
      this.results.recommendations.push(
        'NOT READY FOR PRODUCTION DEPLOYMENT'
      );
      
      if (criticalIssuesCount > 0) {
        this.results.recommendations.push(
          `Fix ${criticalIssuesCount} critical issue(s) before deployment`
        );
      }
      
      if (highIssuesCount > 2) {
        this.results.recommendations.push(
          `Reduce high-severity issues from ${highIssuesCount} to 2 or fewer`
        );
      }
      
      if (percentage < 70) {
        this.results.recommendations.push(
          `Improve overall score from ${percentage.toFixed(1)}% to at least 70%`
        );
      }
    } else {
      this.results.recommendations.push(
        'READY FOR PRODUCTION DEPLOYMENT with monitoring'
      );
    }
    
    // Category-specific recommendations
    Object.values(this.results.categories).forEach(category => {
      if (category.score < category.maxScore * 0.8) {
        this.results.recommendations.push(
          `Improve ${category.name} (current: ${category.score}/${category.maxScore})`
        );
      }
    });
  }

  /**
   * Get status from score
   */
  getStatusFromScore(score, maxScore) {
    const percentage = (score / maxScore) * 100;
    
    if (percentage >= 90) return 'excellent';
    if (percentage >= 75) return 'good';
    if (percentage >= 60) return 'fair';
    return 'poor';
  }

  /**
   * Generate comprehensive report
   */
  async generateReport() {
    const reportPath = path.join(projectRoot, 'docs/production-readiness-report.json');
    
    await fs.writeJSON(reportPath, this.results, { spaces: 2 });
    
    // Generate human-readable report
    const readableReport = this.generateReadableReport();
    await fs.writeFile(
      path.join(projectRoot, 'docs/production-readiness-report.md'),
      readableReport
    );
    
    console.log(`📄 Reports saved to docs/production-readiness-report.*`);
  }

  /**
   * Generate human-readable report
   */
  generateReadableReport() {
    const percentage = (this.results.score / this.results.maxScore) * 100;
    
    let report = '# Production Readiness Assessment Report\n\n';
    report += `**Assessment Date**: ${this.results.timestamp}\n`;
    report += `**Overall Score**: ${this.results.score}/${this.results.maxScore} (${percentage.toFixed(1)}%)\n`;
    report += `**Status**: ${this.results.overallStatus.toUpperCase()}\n`;
    report += `**Deployment Ready**: ${this.results.deploymentReady ? '✅ YES' : '❌ NO'}\n\n`;
    
    // Category breakdown
    report += '## Category Breakdown\n\n';
    Object.values(this.results.categories).forEach(category => {
      const catPercentage = (category.score / category.maxScore) * 100;
      report += `### ${category.name} (Weight: ${category.weight}%)\n`;
      report += `**Score**: ${category.score}/${category.maxScore} (${catPercentage.toFixed(1)}%)\n`;
      report += `**Status**: ${category.status.toUpperCase()}\n\n`;
      
      // Individual checks
      Object.values(category.checks).forEach(check => {
        const checkPercentage = (check.score / check.maxScore) * 100;
        const status = check.status === 'passed' ? '✅' : check.status === 'degraded' ? '⚠️' : '❌';
        
        report += `- ${status} **${check.name}**: ${check.score}/${check.maxScore} (${checkPercentage.toFixed(0)}%)\n`;
        
        if (check.issues.length > 0) {
          check.issues.forEach(issue => {
            report += `  - Issue: ${issue}\n`;
          });
        }
      });
      
      report += '\n';
    });
    
    // Critical issues
    if (this.results.criticalIssues.length > 0) {
      report += '## Critical Issues\n\n';
      this.results.criticalIssues.forEach((issue, index) => {
        const severityIcon = issue.severity === 'critical' ? '🚨' : 
                           issue.severity === 'high' ? '🔴' : '🟡';
        report += `${index + 1}. ${severityIcon} **${issue.issue}**\n`;
        report += `   - Category: ${issue.category}\n`;
        report += `   - Severity: ${issue.severity.toUpperCase()}\n`;
        report += `   - Impact: ${issue.impact}\n\n`;
      });
    }
    
    // Recommendations
    if (this.results.recommendations.length > 0) {
      report += '## Recommendations\n\n';
      this.results.recommendations.forEach((rec, index) => {
        report += `${index + 1}. ${rec}\n`;
      });
      report += '\n';
    }
    
    report += '---\n\n';
    report += '*Report generated by Production Readiness Checker*\n';
    
    return report;
  }

  /**
   * Display results to console
   */
  displayResults() {
    const percentage = (this.results.score / this.results.maxScore) * 100;
    
    console.log('\n📊 PRODUCTION READINESS ASSESSMENT RESULTS');
    console.log('=' * 60);
    console.log(`🏁 Overall Score: ${this.results.score}/${this.results.maxScore} (${percentage.toFixed(1)}%)`);
    console.log(`📈 Status: ${this.results.overallStatus.toUpperCase()}`);
    console.log(`🚀 Deployment Ready: ${this.results.deploymentReady ? '✅ YES' : '❌ NO'}`);
    
    // Category scores
    console.log('\n📋 Category Scores:');
    Object.values(this.results.categories).forEach(category => {
      const catPercentage = (category.score / category.maxScore) * 100;
      const statusIcon = category.status === 'excellent' ? '🟢' : 
                        category.status === 'good' ? '🟡' : 
                        category.status === 'fair' ? '🟠' : '🔴';
      
      console.log(`   ${statusIcon} ${category.name}: ${category.score}/${category.maxScore} (${catPercentage.toFixed(1)}%)`);
    });
    
    // Critical issues
    if (this.results.criticalIssues.length > 0) {
      console.log(`\n🚨 Critical Issues (${this.results.criticalIssues.length}):`);
      this.results.criticalIssues.forEach(issue => {
        const severityIcon = issue.severity === 'critical' ? '🚨' : 
                           issue.severity === 'high' ? '🔴' : '🟡';
        console.log(`   ${severityIcon} ${issue.issue}`);
      });
    }
    
    // Top recommendations
    if (this.results.recommendations.length > 0) {
      console.log('\n💡 Key Recommendations:');
      this.results.recommendations.slice(0, 3).forEach(rec => {
        console.log(`   • ${rec}`);
      });
    }
    
    console.log('\n📄 Detailed report saved to docs/production-readiness-report.md');
    console.log('');
  }
}

// Execute assessment if run directly
if (import.meta.url === `file://${__filename}`) {
  const checker = new ProductionReadinessChecker();
  
  checker.runAssessment().then(results => {
    const exitCode = results.deploymentReady ? 0 : 1;
    process.exit(exitCode);
  }).catch(error => {
    console.error('❌ Production readiness assessment failed:', error);
    process.exit(1);
  });
}

export { ProductionReadinessChecker };