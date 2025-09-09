#!/usr/bin/env node

/**
 * Docker Validation Report Generator
 * Aggregates results from all Docker-based validation tests
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const config = {
    inputDir: process.argv.includes('--input') ? process.argv[process.argv.indexOf('--input') + 1] : './validation-artifacts',
    outputDir: process.argv.includes('--output') ? process.argv[process.argv.indexOf('--output') + 1] : './consolidated-report',
    timestamp: new Date().toISOString()
};

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

class DockerValidationReporter {
    constructor() {
        this.results = {
            timestamp: config.timestamp,
            summary: {
                totalTests: 0,
                passedTests: 0,
                failedTests: 0,
                warningTests: 0,
                securityScore: 0,
                performanceScore: 0,
                overallScore: 0
            },
            security: {},
            performance: {},
            multiArch: {},
            production: {},
            coordination: {},
            matrices: []
        };
    }

    async generateReport() {
        log('🐳 Starting Docker Validation Report Generation', 'cyan');
        
        try {
            await this.ensureDirectories();
            await this.collectResults();
            await this.analyzeResults();
            await this.generateReports();
            
            log('✅ Docker validation report generated successfully!', 'green');
            log(`📁 Reports available in: ${config.outputDir}`, 'blue');
            
        } catch (error) {
            log(`❌ Error generating report: ${error.message}`, 'red');
            process.exit(1);
        }
    }

    async ensureDirectories() {
        await fs.ensureDir(config.outputDir);
        await fs.ensureDir(path.join(config.outputDir, 'assets'));
        await fs.ensureDir(path.join(config.outputDir, 'data'));
    }

    async collectResults() {
        log('📊 Collecting validation results...', 'blue');

        // Collect security scan results
        await this.collectSecurityResults();
        
        // Collect performance test results
        await this.collectPerformanceResults();
        
        // Collect multi-architecture results
        await this.collectMultiArchResults();
        
        // Collect production simulation results
        await this.collectProductionResults();
        
        // Collect coordination results
        await this.collectCoordinationResults();
        
        // Collect matrix test results
        await this.collectMatrixResults();
    }

    async collectSecurityResults() {
        const securityPatterns = [
            '**/security-scan-*/**',
            '**/security-reports/**',
            '**/trivy-results.sarif',
            '**/snyk-results.json'
        ];

        this.results.security = {
            scanCompleted: false,
            vulnerabilities: {
                critical: 0,
                high: 0,
                medium: 0,
                low: 0
            },
            scanners: [],
            score: 0
        };

        for (const pattern of securityPatterns) {
            const files = await this.findFiles(pattern);
            
            for (const file of files) {
                try {
                    if (file.endsWith('.json')) {
                        const data = await fs.readJson(file);
                        this.processSec urityData(data, file);
                    } else if (file.endsWith('.sarif')) {
                        const data = await fs.readJson(file);
                        this.processSarifData(data);
                    }
                } catch (error) {
                    log(`⚠️  Could not process security file: ${file}`, 'yellow');
                }
            }
        }

        this.results.security.scanCompleted = this.results.security.scanners.length > 0;
        this.calculateSecurityScore();
    }

    async collectPerformanceResults() {
        const performancePatterns = [
            '**/performance-*/**',
            '**/performance-reports/**',
            '**/performance-logs/**'
        ];

        this.results.performance = {
            benchmarksCompleted: false,
            resourceConstraints: [],
            benchmarks: {
                cpu: null,
                memory: null,
                io: null,
                startup: null
            },
            stressTests: {
                memoryStress: false,
                cpuStress: false
            },
            score: 0
        };

        for (const pattern of performancePatterns) {
            const files = await this.findFiles(pattern);
            
            for (const file of files) {
                try {
                    if (file.includes('performance-summary.json')) {
                        const data = await fs.readJson(file);
                        this.processPerformanceData(data);
                    } else if (file.includes('cpu-benchmark.json')) {
                        const data = await fs.readJson(file);
                        this.results.performance.benchmarks.cpu = data;
                    } else if (file.includes('memory-benchmark.json')) {
                        const data = await fs.readJson(file);
                        this.results.performance.benchmarks.memory = data;
                    }
                } catch (error) {
                    log(`⚠️  Could not process performance file: ${file}`, 'yellow');
                }
            }
        }

        this.calculatePerformanceScore();
    }

    async collectMultiArchResults() {
        const archPatterns = [
            '**/digests-*/**',
            '**/multi-arch-*/**'
        ];

        this.results.multiArch = {
            architectures: [],
            buildSuccessful: false,
            digestsGenerated: false
        };

        // Check for architecture digests
        const digestFiles = await this.findFiles('**/digests-*/**');
        for (const file of digestFiles) {
            const archMatch = file.match(/digests-(\w+)/);
            if (archMatch) {
                this.results.multiArch.architectures.push(archMatch[1]);
            }
        }

        this.results.multiArch.buildSuccessful = this.results.multiArch.architectures.length > 0;
        this.results.multiArch.digestsGenerated = digestFiles.length > 0;
    }

    async collectProductionResults() {
        const productionPatterns = [
            '**/production-simulation/**',
            '**/production-reports/**'
        ];

        this.results.production = {
            simulationCompleted: false,
            services: {
                app: false,
                database: false,
                cache: false,
                loadBalancer: false
            },
            loadTests: {
                completed: false,
                metrics: null
            },
            healthChecks: {
                passed: false,
                checks: []
            }
        };

        for (const pattern of productionPatterns) {
            const files = await this.findFiles(pattern);
            
            for (const file of files) {
                if (file.includes('app.log')) {
                    this.results.production.services.app = true;
                } else if (file.includes('nginx.log')) {
                    this.results.production.services.loadBalancer = true;
                } else if (file.includes('health.json')) {
                    try {
                        const healthData = await fs.readJson(file);
                        this.results.production.healthChecks.passed = healthData.Status === 'healthy';
                    } catch (error) {
                        // Ignore health check parsing errors
                    }
                }
            }
        }

        this.results.production.simulationCompleted = Object.values(this.results.production.services).some(v => v);
    }

    async collectCoordinationResults() {
        const coordinationPatterns = [
            '**/coordination-validation/**',
            '**/coordination-reports/**'
        ];

        this.results.coordination = {
            systemInitialized: false,
            hooksEnabled: false,
            swarmActive: false,
            networkConfigured: false
        };

        for (const pattern of coordinationPatterns) {
            const files = await this.findFiles(pattern);
            
            for (const file of files) {
                try {
                    if (file.includes('coordination-state.json')) {
                        const data = await fs.readJson(file);
                        this.results.coordination.systemInitialized = data.status === 'active';
                        this.results.coordination.hooksEnabled = data.hooks?.pre_task === 'enabled';
                        this.results.coordination.swarmActive = !!data.swarm_id;
                        this.results.coordination.networkConfigured = !!data.coordination_network;
                    }
                } catch (error) {
                    log(`⚠️  Could not process coordination file: ${file}`, 'yellow');
                }
            }
        }
    }

    async collectMatrixResults() {
        const matrixPatterns = [
            '**/test-matrix-*/**',
            '**/matrix-*/**'
        ];

        for (const pattern of matrixPatterns) {
            const files = await this.findFiles(pattern);
            
            for (const file of files) {
                const matrixMatch = file.match(/matrix-(\w+)-node(\d+)/);
                if (matrixMatch) {
                    this.results.matrices.push({
                        baseImage: matrixMatch[1],
                        nodeVersion: matrixMatch[2],
                        testsCompleted: true,
                        path: file
                    });
                }
            }
        }
    }

    async findFiles(pattern) {
        const glob = await import('glob');
        try {
            return glob.globSync(path.join(config.inputDir, pattern));
        } catch (error) {
            return [];
        }
    }

    processSecurityData(data, filePath) {
        if (data.metadata?.vulnerabilities) {
            // npm audit format
            const vulns = data.metadata.vulnerabilities;
            this.results.security.vulnerabilities.critical += vulns.critical || 0;
            this.results.security.vulnerabilities.high += vulns.high || 0;
            this.results.security.vulnerabilities.medium += vulns.moderate || 0;
            this.results.security.vulnerabilities.low += vulns.low || 0;
            this.results.security.scanners.push('npm-audit');
        } else if (data.vulnerabilities) {
            // Snyk format
            this.results.security.scanners.push('snyk');
        }
    }

    processSarifData(data) {
        if (data.runs) {
            for (const run of data.runs) {
                if (run.results) {
                    for (const result of run.results) {
                        const level = result.level || 'medium';
                        if (this.results.security.vulnerabilities[level] !== undefined) {
                            this.results.security.vulnerabilities[level]++;
                        }
                    }
                }
            }
            this.results.security.scanners.push('trivy');
        }
    }

    processPerformanceData(data) {
        if (data.benchmarks) {
            this.results.performance.benchmarks = { ...this.results.performance.benchmarks, ...data.benchmarks };
        }
        if (data.system_info) {
            this.results.performance.systemInfo = data.system_info;
        }
        this.results.performance.benchmarksCompleted = true;
    }

    calculateSecurityScore() {
        const vulns = this.results.security.vulnerabilities;
        const totalVulns = vulns.critical + vulns.high + vulns.medium + vulns.low;
        
        if (totalVulns === 0) {
            this.results.security.score = 100;
        } else {
            // Weighted scoring: critical = 40 points, high = 20, medium = 10, low = 5
            const weightedScore = (vulns.critical * 40) + (vulns.high * 20) + (vulns.medium * 10) + (vulns.low * 5);
            this.results.security.score = Math.max(0, 100 - weightedScore);
        }
    }

    calculatePerformanceScore() {
        let score = 100;
        
        // Deduct points for missing benchmarks
        if (!this.results.performance.benchmarks.cpu) score -= 20;
        if (!this.results.performance.benchmarks.memory) score -= 20;
        if (!this.results.performance.benchmarks.io) score -= 20;
        
        // Deduct points for poor performance (if data available)
        if (this.results.performance.benchmarks.cpu?.duration_ms > 5000) score -= 20;
        if (this.results.performance.benchmarks.memory?.memory_usage?.heapUsed > 100) score -= 20;
        
        this.results.performance.score = Math.max(0, score);
    }

    analyzeResults() {
        log('🔍 Analyzing validation results...', 'blue');

        // Calculate summary metrics
        this.results.summary.totalTests = this.countTotalTests();
        this.results.summary.passedTests = this.countPassedTests();
        this.results.summary.failedTests = this.countFailedTests();
        this.results.summary.warningTests = this.countWarningTests();
        
        this.results.summary.securityScore = this.results.security.score;
        this.results.summary.performanceScore = this.results.performance.score;
        
        // Calculate overall score
        this.results.summary.overallScore = this.calculateOverallScore();
    }

    countTotalTests() {
        let total = 0;
        
        // Security tests
        if (this.results.security.scanCompleted) total += 3; // 3 security scanners
        
        // Performance tests
        if (this.results.performance.benchmarksCompleted) total += 4; // CPU, memory, I/O, startup
        
        // Multi-arch tests
        total += this.results.multiArch.architectures.length;
        
        // Production tests
        total += Object.keys(this.results.production.services).length;
        
        // Matrix tests
        total += this.results.matrices.length;
        
        // Coordination tests
        total += Object.keys(this.results.coordination).length;
        
        return total;
    }

    countPassedTests() {
        let passed = 0;
        
        // Security
        if (this.results.security.score >= 80) passed += this.results.security.scanners.length;
        
        // Performance
        if (this.results.performance.score >= 80) passed += Object.values(this.results.performance.benchmarks).filter(b => b !== null).length;
        
        // Multi-arch
        passed += this.results.multiArch.architectures.length;
        
        // Production
        passed += Object.values(this.results.production.services).filter(s => s).length;
        
        // Matrix
        passed += this.results.matrices.filter(m => m.testsCompleted).length;
        
        // Coordination
        passed += Object.values(this.results.coordination).filter(c => c).length;
        
        return passed;
    }

    countFailedTests() {
        return this.results.summary.totalTests - this.results.summary.passedTests - this.results.summary.warningTests;
    }

    countWarningTests() {
        let warnings = 0;
        
        // Security warnings (medium/low vulnerabilities)
        if (this.results.security.vulnerabilities.medium > 0 || this.results.security.vulnerabilities.low > 0) {
            warnings++;
        }
        
        // Performance warnings
        if (this.results.performance.score >= 60 && this.results.performance.score < 80) {
            warnings++;
        }
        
        return warnings;
    }

    calculateOverallScore() {
        const weights = {
            security: 0.3,
            performance: 0.25,
            multiArch: 0.15,
            production: 0.15,
            coordination: 0.1,
            matrix: 0.05
        };

        let weightedScore = 0;

        // Security score
        weightedScore += this.results.security.score * weights.security;

        // Performance score
        weightedScore += this.results.performance.score * weights.performance;

        // Multi-arch score (binary: 100 if successful, 0 if not)
        const multiArchScore = this.results.multiArch.buildSuccessful ? 100 : 0;
        weightedScore += multiArchScore * weights.multiArch;

        // Production score
        const productionScore = this.results.production.simulationCompleted ? 100 : 0;
        weightedScore += productionScore * weights.production;

        // Coordination score
        const coordActiveCount = Object.values(this.results.coordination).filter(c => c).length;
        const coordScore = (coordActiveCount / Object.keys(this.results.coordination).length) * 100;
        weightedScore += coordScore * weights.coordination;

        // Matrix score
        const matrixScore = this.results.matrices.length > 0 ? 100 : 0;
        weightedScore += matrixScore * weights.matrix;

        return Math.round(weightedScore);
    }

    async generateReports() {
        log('📝 Generating validation reports...', 'blue');

        // Generate JSON report
        await this.generateJsonReport();
        
        // Generate HTML report
        await this.generateHtmlReport();
        
        // Generate Markdown summary
        await this.generateMarkdownSummary();
        
        // Generate CSV data
        await this.generateCsvData();
    }

    async generateJsonReport() {
        const jsonPath = path.join(config.outputDir, 'docker-validation-results.json');
        await fs.writeJson(jsonPath, this.results, { spaces: 2 });
        log(`✅ JSON report: ${jsonPath}`, 'green');
    }

    async generateHtmlReport() {
        const htmlContent = this.createHtmlReport();
        const htmlPath = path.join(config.outputDir, 'docker-validation-report.html');
        await fs.writeFile(htmlPath, htmlContent);
        log(`✅ HTML report: ${htmlPath}`, 'green');
    }

    async generateMarkdownSummary() {
        const markdownContent = this.createMarkdownSummary();
        const markdownPath = path.join(config.outputDir, 'summary.md');
        await fs.writeFile(markdownPath, markdownContent);
        log(`✅ Markdown summary: ${markdownPath}`, 'green');
    }

    async generateCsvData() {
        const csvContent = this.createCsvData();
        const csvPath = path.join(config.outputDir, 'validation-metrics.csv');
        await fs.writeFile(csvPath, csvContent);
        log(`✅ CSV data: ${csvPath}`, 'green');
    }

    createHtmlReport() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Docker Validation Report - Unjucks</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: #2563eb; color: white; padding: 30px; border-radius: 8px; margin-bottom: 30px; }
        .score-card { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .score-value { font-size: 48px; font-weight: bold; color: #059669; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .metric { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .status-success { color: #059669; }
        .status-warning { color: #d97706; }
        .status-error { color: #dc2626; }
        .progress-bar { background: #e5e7eb; height: 10px; border-radius: 5px; overflow: hidden; }
        .progress-fill { background: #059669; height: 100%; transition: width 0.3s ease; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        th { background: #f9fafb; font-weight: 600; }
        .timestamp { color: #6b7280; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🐳 Docker Validation Report</h1>
            <p>Comprehensive testing and validation results for Unjucks Docker infrastructure</p>
            <p class="timestamp">Generated: ${this.results.timestamp}</p>
        </div>

        <div class="score-card">
            <h2>Overall Validation Score</h2>
            <div class="score-value">${this.results.summary.overallScore}/100</div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${this.results.summary.overallScore}%"></div>
            </div>
            <p>Tests Passed: ${this.results.summary.passedTests}/${this.results.summary.totalTests}</p>
        </div>

        <div class="grid">
            <div class="metric">
                <h3>🔒 Security Validation</h3>
                <div class="score-value status-${this.results.security.score >= 80 ? 'success' : this.results.security.score >= 60 ? 'warning' : 'error'}">${this.results.security.score}/100</div>
                <table>
                    <tr><th>Severity</th><th>Count</th></tr>
                    <tr><td>Critical</td><td class="status-error">${this.results.security.vulnerabilities.critical}</td></tr>
                    <tr><td>High</td><td class="status-warning">${this.results.security.vulnerabilities.high}</td></tr>
                    <tr><td>Medium</td><td>${this.results.security.vulnerabilities.medium}</td></tr>
                    <tr><td>Low</td><td>${this.results.security.vulnerabilities.low}</td></tr>
                </table>
                <p>Scanners: ${this.results.security.scanners.join(', ')}</p>
            </div>

            <div class="metric">
                <h3>⚡ Performance Testing</h3>
                <div class="score-value status-${this.results.performance.score >= 80 ? 'success' : this.results.performance.score >= 60 ? 'warning' : 'error'}">${this.results.performance.score}/100</div>
                <table>
                    <tr><th>Benchmark</th><th>Status</th></tr>
                    <tr><td>CPU</td><td class="status-${this.results.performance.benchmarks.cpu ? 'success' : 'error'}">${this.results.performance.benchmarks.cpu ? '✅' : '❌'}</td></tr>
                    <tr><td>Memory</td><td class="status-${this.results.performance.benchmarks.memory ? 'success' : 'error'}">${this.results.performance.benchmarks.memory ? '✅' : '❌'}</td></tr>
                    <tr><td>I/O</td><td class="status-${this.results.performance.benchmarks.io ? 'success' : 'error'}">${this.results.performance.benchmarks.io ? '✅' : '❌'}</td></tr>
                    <tr><td>Startup</td><td class="status-${this.results.performance.benchmarks.startup ? 'success' : 'error'}">${this.results.performance.benchmarks.startup ? '✅' : '❌'}</td></tr>
                </table>
            </div>

            <div class="metric">
                <h3>🏗️ Multi-Architecture</h3>
                <div class="score-value status-${this.results.multiArch.buildSuccessful ? 'success' : 'error'}">${this.results.multiArch.buildSuccessful ? '✅' : '❌'}</div>
                <p>Architectures: ${this.results.multiArch.architectures.join(', ')}</p>
                <p>Digests Generated: ${this.results.multiArch.digestsGenerated ? '✅' : '❌'}</p>
            </div>

            <div class="metric">
                <h3>🚀 Production Simulation</h3>
                <div class="score-value status-${this.results.production.simulationCompleted ? 'success' : 'error'}">${this.results.production.simulationCompleted ? '✅' : '❌'}</div>
                <table>
                    <tr><th>Service</th><th>Status</th></tr>
                    <tr><td>Application</td><td class="status-${this.results.production.services.app ? 'success' : 'error'}">${this.results.production.services.app ? '✅' : '❌'}</td></tr>
                    <tr><td>Database</td><td class="status-${this.results.production.services.database ? 'success' : 'error'}">${this.results.production.services.database ? '✅' : '❌'}</td></tr>
                    <tr><td>Cache</td><td class="status-${this.results.production.services.cache ? 'success' : 'error'}">${this.results.production.services.cache ? '✅' : '❌'}</td></tr>
                    <tr><td>Load Balancer</td><td class="status-${this.results.production.services.loadBalancer ? 'success' : 'error'}">${this.results.production.services.loadBalancer ? '✅' : '❌'}</td></tr>
                </table>
            </div>

            <div class="metric">
                <h3>🤝 Coordination System</h3>
                <div class="score-value status-${this.results.coordination.systemInitialized ? 'success' : 'error'}">${this.results.coordination.systemInitialized ? '✅' : '❌'}</div>
                <table>
                    <tr><th>Component</th><th>Status</th></tr>
                    <tr><td>System Initialized</td><td class="status-${this.results.coordination.systemInitialized ? 'success' : 'error'}">${this.results.coordination.systemInitialized ? '✅' : '❌'}</td></tr>
                    <tr><td>Hooks Enabled</td><td class="status-${this.results.coordination.hooksEnabled ? 'success' : 'error'}">${this.results.coordination.hooksEnabled ? '✅' : '❌'}</td></tr>
                    <tr><td>Swarm Active</td><td class="status-${this.results.coordination.swarmActive ? 'success' : 'error'}">${this.results.coordination.swarmActive ? '✅' : '❌'}</td></tr>
                    <tr><td>Network Configured</td><td class="status-${this.results.coordination.networkConfigured ? 'success' : 'error'}">${this.results.coordination.networkConfigured ? '✅' : '❌'}</td></tr>
                </table>
            </div>

            <div class="metric">
                <h3>📊 Test Matrix</h3>
                <div class="score-value">${this.results.matrices.length}</div>
                <p>Matrix Configurations Tested</p>
                ${this.results.matrices.map(m => `<p>${m.baseImage} + Node.js ${m.nodeVersion}: ${m.testsCompleted ? '✅' : '❌'}</p>`).join('')}
            </div>
        </div>
    </div>
</body>
</html>`;
    }

    createMarkdownSummary() {
        return `# Docker Validation Summary

**Generated:** ${this.results.timestamp}

## Overall Score: ${this.results.summary.overallScore}/100

### Test Results
- **Total Tests:** ${this.results.summary.totalTests}
- **Passed:** ${this.results.summary.passedTests}
- **Failed:** ${this.results.summary.failedTests}
- **Warnings:** ${this.results.summary.warningTests}

### Validation Categories

#### 🔒 Security (Score: ${this.results.security.score}/100)
- **Scanners Used:** ${this.results.security.scanners.join(', ')}
- **Critical Vulnerabilities:** ${this.results.security.vulnerabilities.critical}
- **High Vulnerabilities:** ${this.results.security.vulnerabilities.high}
- **Medium Vulnerabilities:** ${this.results.security.vulnerabilities.medium}
- **Low Vulnerabilities:** ${this.results.security.vulnerabilities.low}

#### ⚡ Performance (Score: ${this.results.performance.score}/100)
- **Benchmarks Completed:** ${this.results.performance.benchmarksCompleted ? '✅' : '❌'}
- **CPU Benchmark:** ${this.results.performance.benchmarks.cpu ? '✅' : '❌'}
- **Memory Benchmark:** ${this.results.performance.benchmarks.memory ? '✅' : '❌'}
- **I/O Benchmark:** ${this.results.performance.benchmarks.io ? '✅' : '❌'}

#### 🏗️ Multi-Architecture
- **Build Successful:** ${this.results.multiArch.buildSuccessful ? '✅' : '❌'}
- **Architectures:** ${this.results.multiArch.architectures.join(', ')}
- **Digests Generated:** ${this.results.multiArch.digestsGenerated ? '✅' : '❌'}

#### 🚀 Production Simulation
- **Simulation Completed:** ${this.results.production.simulationCompleted ? '✅' : '❌'}
- **Application Service:** ${this.results.production.services.app ? '✅' : '❌'}
- **Database Service:** ${this.results.production.services.database ? '✅' : '❌'}
- **Cache Service:** ${this.results.production.services.cache ? '✅' : '❌'}
- **Load Balancer:** ${this.results.production.services.loadBalancer ? '✅' : '❌'}

#### 🤝 Coordination System
- **System Initialized:** ${this.results.coordination.systemInitialized ? '✅' : '❌'}
- **Hooks Enabled:** ${this.results.coordination.hooksEnabled ? '✅' : '❌'}
- **Swarm Active:** ${this.results.coordination.swarmActive ? '✅' : '❌'}
- **Network Configured:** ${this.results.coordination.networkConfigured ? '✅' : '❌'}

#### 📊 Test Matrix
- **Configurations Tested:** ${this.results.matrices.length}
${this.results.matrices.map(m => `- ${m.baseImage} + Node.js ${m.nodeVersion}: ${m.testsCompleted ? '✅' : '❌'}`).join('\n')}

---

${this.results.summary.overallScore >= 90 ? '🎉 **Excellent!** All Docker validation tests passed with high scores.' :
  this.results.summary.overallScore >= 80 ? '✅ **Good!** Docker validation passed with minor issues.' :
  this.results.summary.overallScore >= 70 ? '⚠️ **Warning!** Docker validation has some issues that should be addressed.' :
  '❌ **Failed!** Docker validation has critical issues that must be fixed.'}`;
    }

    createCsvData() {
        const rows = [
            ['Category', 'Score', 'Status', 'Details'],
            ['Security', this.results.security.score, this.results.security.score >= 80 ? 'PASS' : 'FAIL', `${this.results.security.scanners.length} scanners`],
            ['Performance', this.results.performance.score, this.results.performance.score >= 80 ? 'PASS' : 'FAIL', `${Object.values(this.results.performance.benchmarks).filter(b => b !== null).length} benchmarks`],
            ['Multi-Architecture', this.results.multiArch.buildSuccessful ? 100 : 0, this.results.multiArch.buildSuccessful ? 'PASS' : 'FAIL', this.results.multiArch.architectures.join(';')],
            ['Production', this.results.production.simulationCompleted ? 100 : 0, this.results.production.simulationCompleted ? 'PASS' : 'FAIL', Object.values(this.results.production.services).filter(s => s).length + ' services'],
            ['Coordination', this.results.coordination.systemInitialized ? 100 : 0, this.results.coordination.systemInitialized ? 'PASS' : 'FAIL', Object.values(this.results.coordination).filter(c => c).length + ' components'],
            ['Matrix Tests', this.results.matrices.length > 0 ? 100 : 0, this.results.matrices.length > 0 ? 'PASS' : 'FAIL', this.results.matrices.length + ' configurations'],
            ['Overall', this.results.summary.overallScore, this.results.summary.overallScore >= 80 ? 'PASS' : 'FAIL', `${this.results.summary.passedTests}/${this.results.summary.totalTests} tests passed`]
        ];

        return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    }
}

// Main execution
async function main() {
    const reporter = new DockerValidationReporter();
    await reporter.generateReport();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });
}

export default DockerValidationReporter;