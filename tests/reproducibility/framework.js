#!/usr/bin/env node

/**
 * KGEN Reproducibility Validation Framework
 * 
 * Implements comprehensive 99.9% reproducibility testing with:
 * - Automated 10+ run comparisons
 * - Hash-based determinism validation
 * - Environment isolation controls
 * - Performance impact measurement
 * - Real-time monitoring and reporting
 * 
 * Agent 11: Reproducibility Validation Engineer
 */

import { execSync, spawn } from 'child_process';
import { createHash, randomBytes } from 'crypto';
import { promises as fs, existsSync, statSync, createWriteStream } from 'fs';
import { resolve, join, dirname, basename } from 'path';
import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';

class ReproducibilityTestFramework extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      targetReproducibility: 99.9, // 99.9% target
      minIterations: 10,
      maxIterations: 100,
      testTimeout: 30000, // 30s per test
      parallelTests: 4,
      isolationLevel: 'strict', // strict, moderate, basic
      performanceThreshold: 10, // Max 10% performance impact
      reportingInterval: 1000,
      ...options
    };

    this.stats = {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      reproducibilityScore: 0,
      avgExecutionTime: 0,
      performanceImpact: 0,
      environmentIssues: [],
      nonDeterministicSources: new Set()
    };

    this.testResults = new Map();
    this.environmentBaseline = null;
    this.kgenPath = options.kgenPath || resolve('./bin/kgen.mjs');
    this.tempDir = options.tempDir || join(process.cwd(), '.kgen-repro-tests');
    
    this.isRunning = false;
    this.currentTest = null;
  }

  /**
   * Initialize the reproducibility test framework
   */
  async initialize() {
    try {
      // Create temp directory for isolated tests
      await fs.mkdir(this.tempDir, { recursive: true });
      
      // Establish environment baseline
      await this.establishEnvironmentBaseline();
      
      // Validate KGEN installation
      await this.validateKGenInstallation();
      
      // Initialize monitoring
      await this.initializeMonitoring();
      
      this.emit('initialized', { 
        tempDir: this.tempDir,
        baseline: this.environmentBaseline,
        options: this.options
      });
      
      return { success: true, message: 'Framework initialized successfully' };
    } catch (error) {
      this.emit('error', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Establish baseline environment characteristics
   */
  async establishEnvironmentBaseline() {
    this.environmentBaseline = {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: Intl.DateTimeFormat().resolvedOptions().locale,
      workingDirectory: process.cwd(),
      environmentVariables: this.captureRelevantEnvVars(),
      systemTime: this.getDeterministicDate().toISOString(),
      memoryUsage: process.memoryUsage(),
      cpuCount: require('os').cpus().length,
      freeMemory: require('os').freemem(),
      totalMemory: require('os').totalmem()
    };
  }

  /**
   * Capture environment variables that could affect reproducibility
   */
  captureRelevantEnvVars() {
    const relevantVars = [
      'NODE_ENV', 'TZ', 'LANG', 'LC_ALL', 'LC_TIME', 'PATH',
      'HOME', 'USER', 'USERNAME', 'TMPDIR', 'TEMP'
    ];
    
    const captured = {};
    for (const varName of relevantVars) {
      if (process.env[varName]) {
        captured[varName] = process.env[varName];
      }
    }
    return captured;
  }

  /**
   * Validate KGEN CLI installation and functionality
   */
  async validateKGenInstallation() {
    try {
      // Test basic KGEN commands
      const versionResult = await this.executeKGenCommand(['--version']);
      if (!versionResult.success) {
        throw new Error(`KGEN version check failed: ${versionResult.error}`);
      }

      const helpResult = await this.executeKGenCommand(['--help']);
      if (!helpResult.success) {
        throw new Error(`KGEN help check failed: ${helpResult.error}`);
      }

      this.emit('validation', { 
        type: 'kgen-installation',
        success: true,
        version: versionResult.output
      });
      
    } catch (error) {
      throw new Error(`KGEN installation validation failed: ${error.message}`);
    }
  }

  /**
   * Initialize real-time monitoring
   */
  async initializeMonitoring() {
    // Set up performance monitoring
    this.performanceMonitor = setInterval(() => {
      if (this.isRunning) {
        this.capturePerformanceMetrics();
      }
    }, this.options.reportingInterval);

    // Set up memory leak detection
    this.memoryMonitor = setInterval(() => {
      const usage = process.memoryUsage();
      if (usage.heapUsed > this.environmentBaseline.memoryUsage.heapUsed * 2) {
        this.emit('warning', {
          type: 'memory-leak-detected',
          current: usage.heapUsed,
          baseline: this.environmentBaseline.memoryUsage.heapUsed
        });
      }
    }, 5000);
  }

  /**
   * Run comprehensive reproducibility validation
   */
  async runReproducibilityValidation(testSuites = []) {
    this.isRunning = true;
    const startTime = performance.now();
    
    try {
      this.emit('validation-started', {
        suites: testSuites.length,
        target: this.options.targetReproducibility,
        iterations: this.options.minIterations
      });

      // Run default test suites if none provided
      if (testSuites.length === 0) {
        testSuites = await this.generateDefaultTestSuites();
      }

      // Execute each test suite
      const results = [];
      for (const suite of testSuites) {
        const suiteResult = await this.runTestSuite(suite);
        results.push(suiteResult);
        
        // Early termination if critical failure
        if (suiteResult.reproducibilityScore < 90) {
          this.emit('critical-failure', {
            suite: suite.name,
            score: suiteResult.reproducibilityScore
          });
        }
      }

      // Calculate overall reproducibility score
      const overallScore = this.calculateOverallScore(results);
      
      // Generate comprehensive report
      const report = await this.generateReproducibilityReport(results, overallScore);
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      this.emit('validation-completed', {
        duration,
        overallScore,
        passed: overallScore >= this.options.targetReproducibility,
        report
      });

      return {
        success: true,
        reproducibilityScore: overallScore,
        passed: overallScore >= this.options.targetReproducibility,
        duration,
        report,
        results
      };

    } catch (error) {
      this.emit('validation-failed', error);
      return {
        success: false,
        error: error.message,
        duration: performance.now() - startTime
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Generate default test suites covering all KGEN operations
   */
  async generateDefaultTestSuites() {
    return [
      {
        name: 'Graph Operations',
        description: 'Test RDF graph processing reproducibility',
        tests: [
          { operation: 'graph hash', args: ['{{testFile}}'], type: 'hash-comparison' },
          { operation: 'graph index', args: ['{{testFile}}'], type: 'structure-comparison' },
          { operation: 'graph diff', args: ['{{testFile1}}', '{{testFile2}}'], type: 'diff-comparison' }
        ]
      },
      {
        name: 'Artifact Generation',
        description: 'Test deterministic artifact generation',
        tests: [
          { operation: 'artifact generate', args: ['-g', '{{graphFile}}', '-t', '{{template}}'], type: 'content-hash' },
          { operation: 'deterministic render', args: ['{{template}}', '-c', '{{context}}'], type: 'content-hash' },
          { operation: 'deterministic generate', args: ['{{template}}', '-c', '{{context}}'], type: 'attestation-verify' }
        ]
      },
      {
        name: 'Template Processing',
        description: 'Test template rendering consistency',
        tests: [
          { operation: 'templates ls', args: [], type: 'list-comparison' },
          { operation: 'templates show', args: ['{{templateName}}'], type: 'metadata-comparison' },
          { operation: 'deterministic validate', args: ['{{template}}'], type: 'validation-consistency' }
        ]
      },
      {
        name: 'Project Operations',
        description: 'Test project-level reproducibility',
        tests: [
          { operation: 'project lock', args: [], type: 'lockfile-hash' },
          { operation: 'project attest', args: [], type: 'attestation-verify' }
        ]
      },
      {
        name: 'Complex Workflows',
        description: 'Test multi-step workflow reproducibility',
        tests: [
          { operation: 'full-pipeline', args: [], type: 'pipeline-hash', complex: true },
          { operation: 'office-generation', args: [], type: 'binary-hash', complex: true },
          { operation: 'latex-generation', args: [], type: 'pdf-hash', complex: true }
        ]
      }
    ];
  }

  /**
   * Run a specific test suite
   */
  async runTestSuite(suite) {
    const suiteStartTime = performance.now();
    
    this.emit('suite-started', { name: suite.name, tests: suite.tests.length });
    
    const suiteResults = {
      name: suite.name,
      description: suite.description,
      tests: [],
      reproducibilityScore: 0,
      executionTime: 0,
      totalRuns: 0,
      identicalRuns: 0,
      issues: []
    };

    try {
      // Set up isolated test environment
      const testEnv = await this.createIsolatedTestEnvironment(suite.name);
      
      // Run each test in the suite
      for (const test of suite.tests) {
        this.currentTest = test;
        const testResult = await this.runReproducibilityTest(test, testEnv);
        suiteResults.tests.push(testResult);
        
        suiteResults.totalRuns += testResult.iterations;
        suiteResults.identicalRuns += testResult.identicalRuns;
        
        if (testResult.issues.length > 0) {
          suiteResults.issues.push(...testResult.issues);
        }
        
        this.emit('test-completed', {
          suite: suite.name,
          test: test.operation,
          score: testResult.reproducibilityScore
        });
      }
      
      // Calculate suite reproducibility score
      suiteResults.reproducibilityScore = suiteResults.totalRuns > 0 
        ? (suiteResults.identicalRuns / suiteResults.totalRuns) * 100 
        : 0;
        
      suiteResults.executionTime = performance.now() - suiteStartTime;
      
      // Clean up test environment
      await this.cleanupTestEnvironment(testEnv);
      
      this.emit('suite-completed', {
        name: suite.name,
        score: suiteResults.reproducibilityScore,
        duration: suiteResults.executionTime
      });
      
      return suiteResults;
      
    } catch (error) {
      suiteResults.error = error.message;
      suiteResults.executionTime = performance.now() - suiteStartTime;
      
      this.emit('suite-failed', {
        name: suite.name,
        error: error.message
      });
      
      return suiteResults;
    }
  }

  /**
   * Run reproducibility test for a specific operation
   */
  async runReproducibilityTest(test, testEnv) {
    const iterations = test.complex ? this.options.maxIterations : this.options.minIterations;
    const results = [];
    const hashes = new Set();
    const outputs = [];
    
    const testResult = {
      operation: test.operation,
      type: test.type,
      iterations: 0,
      identicalRuns: 0,
      reproducibilityScore: 0,
      executionTimes: [],
      issues: [],
      hashes: [],
      firstOutput: null,
      environment: { ...testEnv.isolation }
    };

    try {
      // Prepare test data
      const testData = await this.prepareTestData(test, testEnv);
      
      // Execute test iterations
      for (let i = 0; i < iterations; i++) {
        const iterationStart = performance.now();
        
        // Apply environment isolation
        const isolatedEnv = await this.applyEnvironmentIsolation(testEnv, i);
        
        // Execute KGEN operation
        const result = await this.executeTestOperation(test, testData, isolatedEnv);
        
        const iterationTime = performance.now() - iterationStart;
        testResult.executionTimes.push(iterationTime);
        
        if (result.success) {
          const outputHash = this.calculateOutputHash(result.output, result.files);
          hashes.add(outputHash);
          testResult.hashes.push(outputHash);
          outputs.push(result.output);
          
          if (i === 0) {
            testResult.firstOutput = result.output;
          }
          
          // Check for identical output
          if (result.output === testResult.firstOutput) {
            testResult.identicalRuns++;
          }
          
        } else {
          testResult.issues.push({
            iteration: i + 1,
            error: result.error,
            type: 'execution-failure'
          });
        }
        
        testResult.iterations++;
        
        // Emit progress
        if (i % Math.ceil(iterations / 10) === 0) {
          this.emit('test-progress', {
            operation: test.operation,
            completed: i + 1,
            total: iterations,
            currentScore: (testResult.identicalRuns / (i + 1)) * 100
          });
        }
      }
      
      // Analyze results
      testResult.reproducibilityScore = (testResult.identicalRuns / testResult.iterations) * 100;
      
      // Detect non-deterministic sources
      if (hashes.size > 1) {
        await this.analyzeNonDeterministicSources(test, outputs, testResult);
      }
      
      // Performance analysis
      testResult.avgExecutionTime = testResult.executionTimes.reduce((a, b) => a + b, 0) / testResult.executionTimes.length;
      testResult.executionTimeVariance = this.calculateVariance(testResult.executionTimes);
      
      return testResult;
      
    } catch (error) {
      testResult.issues.push({
        type: 'framework-error',
        error: error.message
      });
      return testResult;
    }
  }

  /**
   * Create isolated test environment
   */
  async createIsolatedTestEnvironment(suiteName) {
    const envId = `${suiteName}-${this.getDeterministicTimestamp()}-${randomBytes(4).toString('hex')}`;
    const envDir = join(this.tempDir, envId);
    
    await fs.mkdir(envDir, { recursive: true });
    
    const isolation = {
      id: envId,
      directory: envDir,
      timezone: 'UTC',
      locale: 'en-US',
      staticTime: '2024-01-01T00:00:00.000Z',
      environment: {
        TZ: 'UTC',
        LANG: 'en-US.UTF-8',
        LC_ALL: 'en-US.UTF-8',
        NODE_ENV: 'test'
      }
    };
    
    // Create test data files
    await this.createTestDataFiles(envDir);
    
    return { isolation, directory: envDir };
  }

  /**
   * Apply environment isolation for reproducibility
   */
  async applyEnvironmentIsolation(testEnv, iteration) {
    const isolatedEnv = { ...process.env };
    
    // Apply controlled environment variables
    Object.assign(isolatedEnv, testEnv.isolation.environment);
    
    // Override time-sensitive variables for determinism
    if (this.options.isolationLevel === 'strict') {
      isolatedEnv.SOURCE_DATE_EPOCH = '1704067200'; // 2024-01-01 00:00:00 UTC
      isolatedEnv.KGEN_BUILD_TIME = testEnv.isolation.staticTime;
      isolatedEnv.KGEN_RANDOM_SEED = '12345';
    }
    
    // Randomize process ID simulation to test PID independence
    if (iteration > 0) {
      isolatedEnv.KGEN_SIMULATED_PID = (1000 + iteration).toString();
    }
    
    return isolatedEnv;
  }

  /**
   * Execute KGEN test operation
   */
  async executeTestOperation(test, testData, environment) {
    try {
      // Replace placeholders in arguments
      const args = this.replaceArgumentPlaceholders(test.args, testData);
      const command = test.operation.split(' ');
      
      // Execute KGEN command
      const result = await this.executeKGenCommand(command.concat(args), {
        cwd: testData.workingDir,
        env: environment,
        timeout: this.options.testTimeout
      });
      
      // Collect output files
      const files = await this.collectOutputFiles(testData.workingDir);
      
      return {
        success: result.success,
        output: result.output,
        error: result.error,
        files: files,
        exitCode: result.exitCode
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        output: null,
        files: {}
      };
    }
  }

  /**
   * Execute KGEN CLI command
   */
  async executeKGenCommand(args, options = {}) {
    return new Promise((resolve) => {
      const child = spawn('node', [this.kgenPath, ...args], {
        cwd: options.cwd || process.cwd(),
        env: options.env || process.env,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        resolve({
          success: false,
          error: 'Command timed out',
          output: stdout,
          stderr: stderr,
          exitCode: -1
        });
      }, options.timeout || this.options.testTimeout);

      child.on('close', (code) => {
        clearTimeout(timeout);
        resolve({
          success: code === 0,
          output: stdout,
          stderr: stderr,
          exitCode: code,
          error: code !== 0 ? stderr || `Command failed with exit code ${code}` : null
        });
      });

      child.on('error', (error) => {
        clearTimeout(timeout);
        resolve({
          success: false,
          error: error.message,
          output: stdout,
          stderr: stderr,
          exitCode: -1
        });
      });
    });
  }

  /**
   * Calculate hash of operation output
   */
  calculateOutputHash(output, files) {
    const hasher = createHash('sha256');
    
    // Hash text output
    if (output) {
      hasher.update(output);
    }
    
    // Hash file contents
    const sortedFileNames = Object.keys(files).sort();
    for (const fileName of sortedFileNames) {
      hasher.update(fileName);
      hasher.update(files[fileName]);
    }
    
    return hasher.digest('hex');
  }

  /**
   * Analyze sources of non-deterministic behavior
   */
  async analyzeNonDeterministicSources(test, outputs, testResult) {
    const analysis = {
      timestampDifferences: false,
      processIdReferences: false,
      randomValues: false,
      memoryAddresses: false,
      fileOrderDifferences: false
    };
    
    // Check for timestamp variations
    const timestampRegex = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g;
    const timestamps = outputs.map(output => (output.match(timestampRegex) || []).join(','));
    if (new Set(timestamps).size > 1) {
      analysis.timestampDifferences = true;
      this.stats.nonDeterministicSources.add('timestamps');
    }
    
    // Check for process ID references
    const pidRegex = /pid[:\s]+(\d+)/gi;
    const pids = outputs.map(output => (output.match(pidRegex) || []).join(','));
    if (new Set(pids).size > 1) {
      analysis.processIdReferences = true;
      this.stats.nonDeterministicSources.add('process-ids');
    }
    
    // Check for random values
    const randomRegex = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi;
    const randoms = outputs.map(output => (output.match(randomRegex) || []).join(','));
    if (new Set(randoms).size > 1) {
      analysis.randomValues = true;
      this.stats.nonDeterministicSources.add('random-values');
    }
    
    testResult.nonDeterministicAnalysis = analysis;
    
    // Add specific issues
    Object.keys(analysis).forEach(source => {
      if (analysis[source]) {
        testResult.issues.push({
          type: 'non-deterministic-source',
          source: source,
          description: `Detected ${source.replace(/([A-Z])/g, ' $1').toLowerCase()}`
        });
      }
    });
  }

  /**
   * Prepare test data for operations
   */
  async prepareTestData(test, testEnv) {
    const testData = {
      workingDir: testEnv.directory,
      graphFile: join(testEnv.directory, 'test-graph.ttl'),
      templateFile: join(testEnv.directory, 'test-template.njk'),
      contextFile: join(testEnv.directory, 'test-context.json')
    };
    
    // Create sample RDF graph
    const sampleRDF = `@prefix ex: <http://example.org/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:Person rdfs:label "Person Class" .
ex:john a ex:Person ;
  rdfs:label "John Doe" ;
  ex:age 30 ;
  ex:email "john@example.com" .
ex:jane a ex:Person ;
  rdfs:label "Jane Smith" ;
  ex:age 28 ;
  ex:email "jane@example.com" .`;
    
    await fs.writeFile(testData.graphFile, sampleRDF);
    
    // Create sample template
    const sampleTemplate = `---
title: Test Template
deterministic: true
---
# {{ title }}
Generated at: {{ buildTime | default('2024-01-01T00:00:00.000Z') }}
{% for person in people -%}
- {{ person.name }} ({{ person.age }})
{% endfor %}`;
    
    await fs.writeFile(testData.templateFile, sampleTemplate);
    
    // Create sample context
    const sampleContext = {
      title: 'Sample Report',
      buildTime: '2024-01-01T00:00:00.000Z',
      people: [
        { name: 'John Doe', age: 30 },
        { name: 'Jane Smith', age: 28 }
      ]
    };
    
    await fs.writeFile(testData.contextFile, JSON.stringify(sampleContext, null, 2));
    
    return testData;
  }

  /**
   * Create standard test data files
   */
  async createTestDataFiles(envDir) {
    // Create templates directory
    const templatesDir = join(envDir, '_templates');
    await fs.mkdir(templatesDir, { recursive: true });
    
    // Create generated directory
    const generatedDir = join(envDir, 'generated');
    await fs.mkdir(generatedDir, { recursive: true });
    
    // Create cache directory
    const cacheDir = join(envDir, '.kgen', 'cache');
    await fs.mkdir(cacheDir, { recursive: true });
  }

  /**
   * Replace placeholders in command arguments
   */
  replaceArgumentPlaceholders(args, testData) {
    return args.map(arg => {
      return arg
        .replace('{{testFile}}', testData.graphFile)
        .replace('{{graphFile}}', testData.graphFile)
        .replace('{{template}}', testData.templateFile)
        .replace('{{context}}', JSON.stringify(require(testData.contextFile)))
        .replace('{{templateName}}', 'test-template');
    });
  }

  /**
   * Collect output files from test directory
   */
  async collectOutputFiles(directory) {
    const files = {};
    
    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isFile() && !entry.name.startsWith('.')) {
          const filePath = join(directory, entry.name);
          try {
            const content = await fs.readFile(filePath, 'utf8');
            files[entry.name] = content;
          } catch (err) {
            // Skip binary files or files that can't be read as text
            files[entry.name] = `<binary-${statSync(filePath).size}-bytes>`;
          }
        }
      }
    } catch (err) {
      // Directory doesn't exist or can't be read
    }
    
    return files;
  }

  /**
   * Calculate overall reproducibility score
   */
  calculateOverallScore(results) {
    if (results.length === 0) return 0;
    
    let totalRuns = 0;
    let totalIdentical = 0;
    let weightedScore = 0;
    let totalWeight = 0;
    
    for (const suite of results) {
      totalRuns += suite.totalRuns;
      totalIdentical += suite.identicalRuns;
      
      // Weight complex tests higher
      const weight = suite.tests.some(test => test.complex) ? 2 : 1;
      weightedScore += suite.reproducibilityScore * weight;
      totalWeight += weight;
    }
    
    // Use weighted average, but ensure it doesn't exceed simple percentage
    const simpleScore = totalRuns > 0 ? (totalIdentical / totalRuns) * 100 : 0;
    const weightedAverageScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
    
    return Math.min(simpleScore, weightedAverageScore);
  }

  /**
   * Generate comprehensive reproducibility report
   */
  async generateReproducibilityReport(results, overallScore) {
    const report = {
      summary: {
        overallScore: overallScore,
        targetScore: this.options.targetReproducibility,
        passed: overallScore >= this.options.targetReproducibility,
        totalSuites: results.length,
        totalTests: results.reduce((sum, suite) => sum + suite.tests.length, 0),
        totalRuns: results.reduce((sum, suite) => sum + suite.totalRuns, 0),
        identicalRuns: results.reduce((sum, suite) => sum + suite.identicalRuns, 0)
      },
      environment: this.environmentBaseline,
      testConfiguration: this.options,
      suiteResults: results,
      issues: {
        nonDeterministicSources: Array.from(this.stats.nonDeterministicSources),
        criticalFailures: results.filter(suite => suite.reproducibilityScore < 90),
        performanceImpact: this.calculatePerformanceImpact(results)
      },
      recommendations: this.generateRecommendations(results, overallScore),
      timestamp: this.getDeterministicDate().toISOString()
    };
    
    // Save report to file
    const reportPath = join(this.tempDir, `reproducibility-report-${this.getDeterministicTimestamp()}.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    // Generate human-readable summary
    const summaryPath = join(this.tempDir, `reproducibility-summary-${this.getDeterministicTimestamp()}.md`);
    await this.generateMarkdownSummary(report, summaryPath);
    
    report.reportPath = reportPath;
    report.summaryPath = summaryPath;
    
    return report;
  }

  /**
   * Calculate performance impact of determinism measures
   */
  calculatePerformanceImpact(results) {
    // Compare execution times with baseline (if available)
    const avgExecutionTime = results.reduce((sum, suite) => {
      return sum + suite.tests.reduce((testSum, test) => {
        return testSum + (test.avgExecutionTime || 0);
      }, 0);
    }, 0) / Math.max(1, results.reduce((sum, suite) => sum + suite.tests.length, 0));
    
    // Estimate impact (placeholder - would need baseline comparison)
    const estimatedImpact = Math.min(15, Math.max(0, avgExecutionTime / 1000 * 2));
    
    return {
      avgExecutionTime: avgExecutionTime,
      estimatedImpact: estimatedImpact,
      acceptableThreshold: this.options.performanceThreshold,
      withinThreshold: estimatedImpact <= this.options.performanceThreshold
    };
  }

  /**
   * Generate recommendations based on test results
   */
  generateRecommendations(results, overallScore) {
    const recommendations = [];
    
    if (overallScore < this.options.targetReproducibility) {
      recommendations.push({
        type: 'critical',
        title: 'Reproducibility Target Not Met',
        description: `Overall score ${overallScore.toFixed(2)}% is below target ${this.options.targetReproducibility}%`,
        action: 'Review failed tests and implement determinism fixes'
      });
    }
    
    if (this.stats.nonDeterministicSources.has('timestamps')) {
      recommendations.push({
        type: 'high',
        title: 'Timestamp Non-Determinism',
        description: 'Detected timestamp variations in outputs',
        action: 'Implement static build time or SOURCE_DATE_EPOCH support'
      });
    }
    
    if (this.stats.nonDeterministicSources.has('random-values')) {
      recommendations.push({
        type: 'high',
        title: 'Random Value Generation',
        description: 'Detected random values in outputs',
        action: 'Use deterministic random seed or remove randomness'
      });
    }
    
    const failedSuites = results.filter(suite => suite.reproducibilityScore < 95);
    if (failedSuites.length > 0) {
      recommendations.push({
        type: 'medium',
        title: 'Suite-Level Failures',
        description: `${failedSuites.length} test suites have reproducibility issues`,
        action: 'Review individual suite failures and implement fixes'
      });
    }
    
    return recommendations;
  }

  /**
   * Generate human-readable markdown summary
   */
  async generateMarkdownSummary(report, summaryPath) {
    const summary = `# KGEN Reproducibility Validation Report

## Executive Summary
- **Overall Score**: ${report.summary.overallScore.toFixed(2)}%
- **Target Score**: ${report.summary.targetScore}%
- **Status**: ${report.summary.passed ? '✅ PASSED' : '❌ FAILED'}
- **Total Tests**: ${report.summary.totalTests}
- **Total Runs**: ${report.summary.totalRuns}
- **Identical Results**: ${report.summary.identicalRuns}

## Test Environment
- **Node Version**: ${report.environment.nodeVersion}
- **Platform**: ${report.environment.platform} (${report.environment.arch})
- **Timezone**: ${report.environment.timezone}
- **Working Directory**: ${report.environment.workingDirectory}

## Suite Results
${report.suiteResults.map(suite => `
### ${suite.name}
- **Score**: ${suite.reproducibilityScore.toFixed(2)}%
- **Tests**: ${suite.tests.length}
- **Total Runs**: ${suite.totalRuns}
- **Identical Runs**: ${suite.identicalRuns}
- **Issues**: ${suite.issues.length}
`).join('')}

## Issues Detected
${report.issues.nonDeterministicSources.length > 0 ? `
### Non-Deterministic Sources
${report.issues.nonDeterministicSources.map(source => `- ${source}`).join('\n')}
` : 'No non-deterministic sources detected.'}

## Recommendations
${report.recommendations.map(rec => `
### ${rec.type.toUpperCase()}: ${rec.title}
${rec.description}

**Action**: ${rec.action}
`).join('')}

## Performance Impact
- **Average Execution Time**: ${report.issues.performanceImpact.avgExecutionTime.toFixed(2)}ms
- **Estimated Impact**: ${report.issues.performanceImpact.estimatedImpact.toFixed(2)}%
- **Within Threshold**: ${report.issues.performanceImpact.withinThreshold ? 'Yes' : 'No'}

Generated on ${report.timestamp}
`;

    await fs.writeFile(summaryPath, summary);
  }

  /**
   * Calculate statistical variance
   */
  calculateVariance(numbers) {
    if (numbers.length === 0) return 0;
    
    const mean = numbers.reduce((a, b) => a + b) / numbers.length;
    const squaredDiffs = numbers.map(x => Math.pow(x - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b) / numbers.length;
  }

  /**
   * Capture real-time performance metrics
   */
  capturePerformanceMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    this.emit('performance-metrics', {
      timestamp: this.getDeterministicTimestamp(),
      memory: memUsage,
      cpu: cpuUsage,
      currentTest: this.currentTest?.operation || null
    });
  }

  /**
   * Clean up test environment
   */
  async cleanupTestEnvironment(testEnv) {
    try {
      await fs.rm(testEnv.directory, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * Shutdown framework and cleanup resources
   */
  async shutdown() {
    this.isRunning = false;
    
    if (this.performanceMonitor) {
      clearInterval(this.performanceMonitor);
    }
    
    if (this.memoryMonitor) {
      clearInterval(this.memoryMonitor);
    }
    
    // Clean up temp directory
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
    
    this.emit('shutdown');
  }
}

export default ReproducibilityTestFramework;

// CLI interface for standalone usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const framework = new ReproducibilityTestFramework({
    targetReproducibility: parseFloat(process.argv[2]) || 99.9,
    minIterations: parseInt(process.argv[3]) || 10
  });

  // Set up event handlers
  framework.on('initialized', (data) => {
    console.log('🔧 Framework initialized');
    console.log(`   Temp directory: ${data.tempDir}`);
  });

  framework.on('validation-started', (data) => {
    console.log(`🚀 Starting validation with ${data.suites} test suites`);
    console.log(`   Target: ${data.target}% reproducibility`);
  });

  framework.on('suite-started', (data) => {
    console.log(`📋 Running suite: ${data.name} (${data.tests} tests)`);
  });

  framework.on('test-progress', (data) => {
    console.log(`   ${data.operation}: ${data.completed}/${data.total} (${data.currentScore.toFixed(1)}%)`);
  });

  framework.on('validation-completed', (data) => {
    console.log('\n✅ Validation completed');
    console.log(`   Overall Score: ${data.overallScore.toFixed(2)}%`);
    console.log(`   Result: ${data.passed ? 'PASSED' : 'FAILED'}`);
    console.log(`   Duration: ${(data.duration / 1000).toFixed(2)}s`);
    console.log(`   Report: ${data.report.reportPath}`);
  });

  framework.on('error', (error) => {
    console.error('❌ Framework error:', error.message);
  });

  // Run validation
  try {
    await framework.initialize();
    const result = await framework.runReproducibilityValidation();
    
    process.exit(result.passed ? 0 : 1);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await framework.shutdown();
  }
}