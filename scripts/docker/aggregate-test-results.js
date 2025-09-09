#!/usr/bin/env node

/**
 * Test Results Aggregator for Docker Testing Environment
 * Collects and consolidates test results from multiple test runs
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
    testResultsDir: '/test-results',
    reportsDir: '/reports',
    outputFile: 'docker-test-summary.json',
    htmlReportFile: 'docker-test-report.html',
    formats: ['json', 'html', 'markdown'],
    testTypes: ['unit', 'integration', 'security', 'performance', 'minimal']
};

// Claude Flow coordination hooks
async function claudeFlowHooks(action, data = {}) {
    try {
        // Log coordination activities
        console.log(`🔗 Claude Flow Hook: ${action}`, data);
    } catch (error) {
        console.warn('Claude Flow hook failed:', error.message);
    }
}

class TestResultsAggregator {
    constructor() {
        this.results = {
            summary: {
                totalTests: 0,
                passedTests: 0,
                failedTests: 0,
                skippedTests: 0,
                duration: 0,
                timestamp: new Date().toISOString(),
                environment: 'docker'
            },
            testSuites: [],
            coverage: null,
            performance: null,
            security: null,
            errors: []
        };
    }

    async initialize() {
        console.log('🚀 Initializing test results aggregator...');
        await claudeFlowHooks('pre-task', { description: 'Aggregating Docker test results' });
        
        try {
            await fs.access(CONFIG.testResultsDir);
            console.log('✅ Test results directory found');
        } catch (error) {
            console.warn('⚠️ Test results directory not found, creating...');
            await fs.mkdir(CONFIG.testResultsDir, { recursive: true });
        }

        try {
            await fs.access(CONFIG.reportsDir);
            console.log('✅ Reports directory found');
        } catch (error) {
            console.warn('⚠️ Reports directory not found, creating...');
            await fs.mkdir(CONFIG.reportsDir, { recursive: true });
        }
    }

    async collectTestResults() {
        console.log('📊 Collecting test results from all test runs...');
        
        try {
            const files = await fs.readdir(CONFIG.testResultsDir);
            console.log(`Found ${files.length} files in test results directory`);

            for (const file of files) {
                if (file.endsWith('.json') || file.endsWith('.xml') || file.endsWith('.log')) {
                    await this.processTestFile(path.join(CONFIG.testResultsDir, file));
                }
            }

            console.log(`✅ Processed ${this.results.testSuites.length} test suites`);
        } catch (error) {
            console.error('❌ Error collecting test results:', error);
            this.results.errors.push({
                type: 'collection_error',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    async processTestFile(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const fileName = path.basename(filePath);
            
            console.log(`📋 Processing test file: ${fileName}`);

            // Determine file type and parse accordingly
            if (fileName.includes('vitest') || fileName.includes('test-results')) {
                await this.parseVitestResults(content, fileName);
            } else if (fileName.includes('coverage')) {
                await this.parseCoverageResults(content, fileName);
            } else if (fileName.includes('performance') || fileName.includes('benchmark')) {
                await this.parsePerformanceResults(content, fileName);
            } else if (fileName.includes('security')) {
                await this.parseSecurityResults(content, fileName);
            } else if (fileName.endsWith('.log')) {
                await this.parseLogFile(content, fileName);
            }

            await claudeFlowHooks('post-edit', { 
                file: fileName, 
                'memory-key': `swarm/docker/test-file-${fileName}` 
            });

        } catch (error) {
            console.warn(`⚠️ Failed to process file ${filePath}:`, error.message);
            this.results.errors.push({
                type: 'file_processing_error',
                file: filePath,
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    async parseVitestResults(content, fileName) {
        try {
            // Try to parse as JSON first
            let data;
            try {
                data = JSON.parse(content);
            } catch {
                // If not JSON, parse as text output
                data = this.parseVitestTextOutput(content);
            }

            if (data.testResults || data.tests) {
                const testSuite = {
                    name: fileName,
                    type: this.detectTestType(fileName),
                    tests: data.testResults || data.tests || [],
                    summary: data.summary || this.calculateSummary(data.testResults || data.tests || []),
                    timestamp: new Date().toISOString()
                };

                this.results.testSuites.push(testSuite);
                this.updateOverallSummary(testSuite.summary);
            }
        } catch (error) {
            console.warn(`Failed to parse Vitest results from ${fileName}:`, error.message);
        }
    }

    parseVitestTextOutput(content) {
        const lines = content.split('\n');
        const tests = [];
        const summary = { passed: 0, failed: 0, skipped: 0, total: 0 };

        for (const line of lines) {
            if (line.includes('✓') || line.includes('PASS')) {
                tests.push({ status: 'passed', name: line.trim() });
                summary.passed++;
            } else if (line.includes('✗') || line.includes('FAIL')) {
                tests.push({ status: 'failed', name: line.trim() });
                summary.failed++;
            } else if (line.includes('⏸') || line.includes('SKIP')) {
                tests.push({ status: 'skipped', name: line.trim() });
                summary.skipped++;
            }
        }

        summary.total = summary.passed + summary.failed + summary.skipped;
        return { testResults: tests, summary };
    }

    async parseCoverageResults(content, fileName) {
        try {
            const data = JSON.parse(content);
            this.results.coverage = {
                ...data,
                fileName,
                timestamp: new Date().toISOString()
            };
            console.log('📊 Coverage data aggregated');
        } catch (error) {
            console.warn(`Failed to parse coverage results from ${fileName}:`, error.message);
        }
    }

    async parsePerformanceResults(content, fileName) {
        try {
            const data = JSON.parse(content);
            this.results.performance = {
                ...data,
                fileName,
                timestamp: new Date().toISOString()
            };
            console.log('⚡ Performance data aggregated');
        } catch (error) {
            console.warn(`Failed to parse performance results from ${fileName}:`, error.message);
        }
    }

    async parseSecurityResults(content, fileName) {
        try {
            const data = JSON.parse(content);
            this.results.security = {
                ...data,
                fileName,
                timestamp: new Date().toISOString()
            };
            console.log('🔒 Security data aggregated');
        } catch (error) {
            console.warn(`Failed to parse security results from ${fileName}:`, error.message);
        }
    }

    async parseLogFile(content, fileName) {
        const lines = content.split('\n');
        const logAnalysis = {
            fileName,
            totalLines: lines.length,
            errorLines: lines.filter(line => line.includes('ERROR') || line.includes('error')).length,
            warningLines: lines.filter(line => line.includes('WARN') || line.includes('warning')).length,
            timestamp: new Date().toISOString()
        };

        // Add to errors if significant issues found
        if (logAnalysis.errorLines > 0) {
            this.results.errors.push({
                type: 'log_errors',
                file: fileName,
                errorCount: logAnalysis.errorLines,
                timestamp: new Date().toISOString()
            });
        }

        console.log(`📝 Log analysis for ${fileName}: ${logAnalysis.errorLines} errors, ${logAnalysis.warningLines} warnings`);
    }

    detectTestType(fileName) {
        for (const type of CONFIG.testTypes) {
            if (fileName.toLowerCase().includes(type)) {
                return type;
            }
        }
        return 'unknown';
    }

    calculateSummary(tests) {
        return tests.reduce((summary, test) => {
            summary.total++;
            if (test.status === 'passed' || test.status === 'pass') {
                summary.passed++;
            } else if (test.status === 'failed' || test.status === 'fail') {
                summary.failed++;
            } else if (test.status === 'skipped' || test.status === 'skip') {
                summary.skipped++;
            }
            return summary;
        }, { passed: 0, failed: 0, skipped: 0, total: 0 });
    }

    updateOverallSummary(suiteSummary) {
        this.results.summary.totalTests += suiteSummary.total || 0;
        this.results.summary.passedTests += suiteSummary.passed || 0;
        this.results.summary.failedTests += suiteSummary.failed || 0;
        this.results.summary.skippedTests += suiteSummary.skipped || 0;
    }

    async generateReports() {
        console.log('📝 Generating test reports...');

        // Calculate success rate
        const successRate = this.results.summary.totalTests > 0 
            ? (this.results.summary.passedTests / this.results.summary.totalTests * 100).toFixed(2)
            : 0;

        this.results.summary.successRate = successRate;

        try {
            // Generate JSON report
            await this.generateJsonReport();
            
            // Generate HTML report
            await this.generateHtmlReport();
            
            // Generate Markdown report
            await this.generateMarkdownReport();

            console.log('✅ All reports generated successfully');
        } catch (error) {
            console.error('❌ Error generating reports:', error);
            this.results.errors.push({
                type: 'report_generation_error',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    async generateJsonReport() {
        const jsonOutput = JSON.stringify(this.results, null, 2);
        await fs.writeFile(path.join(CONFIG.reportsDir, CONFIG.outputFile), jsonOutput);
        console.log(`📄 JSON report saved: ${CONFIG.outputFile}`);
    }

    async generateHtmlReport() {
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Unjucks Docker Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 2px solid #007acc; padding-bottom: 20px; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; border-left: 4px solid #007acc; }
        .metric h3 { margin: 0 0 10px 0; color: #333; }
        .metric .value { font-size: 2em; font-weight: bold; color: #007acc; }
        .success { border-left-color: #28a745; }
        .success .value { color: #28a745; }
        .failure { border-left-color: #dc3545; }
        .failure .value { color: #dc3545; }
        .warning { border-left-color: #ffc107; }
        .warning .value { color: #ffc107; }
        .test-suites { margin-top: 30px; }
        .test-suite { margin-bottom: 25px; padding: 20px; border: 1px solid #dee2e6; border-radius: 8px; }
        .test-suite h3 { margin-top: 0; color: #007acc; }
        .error-section { background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 8px; margin-top: 20px; }
        .timestamp { text-align: center; color: #6c757d; margin-top: 30px; font-style: italic; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🐳 Unjucks Docker Test Report</h1>
            <p>Comprehensive test results from Docker testing environment</p>
        </div>
        
        <div class="summary">
            <div class="metric success">
                <h3>Total Tests</h3>
                <div class="value">${this.results.summary.totalTests}</div>
            </div>
            <div class="metric success">
                <h3>Passed</h3>
                <div class="value">${this.results.summary.passedTests}</div>
            </div>
            <div class="metric failure">
                <h3>Failed</h3>
                <div class="value">${this.results.summary.failedTests}</div>
            </div>
            <div class="metric warning">
                <h3>Skipped</h3>
                <div class="value">${this.results.summary.skippedTests}</div>
            </div>
            <div class="metric">
                <h3>Success Rate</h3>
                <div class="value">${this.results.summary.successRate}%</div>
            </div>
        </div>
        
        <div class="test-suites">
            <h2>Test Suites</h2>
            ${this.results.testSuites.map(suite => `
                <div class="test-suite">
                    <h3>${suite.name} (${suite.type})</h3>
                    <p><strong>Tests:</strong> ${suite.summary.total} | 
                       <strong>Passed:</strong> ${suite.summary.passed} | 
                       <strong>Failed:</strong> ${suite.summary.failed} | 
                       <strong>Skipped:</strong> ${suite.summary.skipped}</p>
                </div>
            `).join('')}
        </div>
        
        ${this.results.errors.length > 0 ? `
            <div class="error-section">
                <h3>⚠️ Issues Detected</h3>
                ${this.results.errors.map(error => `
                    <p><strong>${error.type}:</strong> ${error.message}</p>
                `).join('')}
            </div>
        ` : ''}
        
        <div class="timestamp">
            Generated on ${this.results.summary.timestamp}
        </div>
    </div>
</body>
</html>`;

        await fs.writeFile(path.join(CONFIG.reportsDir, CONFIG.htmlReportFile), html);
        console.log(`📄 HTML report saved: ${CONFIG.htmlReportFile}`);
    }

    async generateMarkdownReport() {
        const markdown = `# 🐳 Unjucks Docker Test Report

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | ${this.results.summary.totalTests} |
| Passed | ${this.results.summary.passedTests} |
| Failed | ${this.results.summary.failedTests} |
| Skipped | ${this.results.summary.skippedTests} |
| Success Rate | ${this.results.summary.successRate}% |

## Test Suites

${this.results.testSuites.map(suite => `
### ${suite.name} (${suite.type})

- **Total:** ${suite.summary.total}
- **Passed:** ${suite.summary.passed}
- **Failed:** ${suite.summary.failed}
- **Skipped:** ${suite.summary.skipped}
`).join('')}

${this.results.errors.length > 0 ? `
## ⚠️ Issues Detected

${this.results.errors.map(error => `
- **${error.type}:** ${error.message}
`).join('')}
` : ''}

---
*Generated on ${this.results.summary.timestamp}*
`;

        await fs.writeFile(path.join(CONFIG.reportsDir, 'docker-test-report.md'), markdown);
        console.log('📄 Markdown report saved: docker-test-report.md');
    }

    async run() {
        try {
            await this.initialize();
            await this.collectTestResults();
            await this.generateReports();
            
            await claudeFlowHooks('post-task', { 
                'task-id': 'docker-test-aggregation',
                results: this.results.summary
            });

            console.log('🎉 Test results aggregation completed successfully!');
            console.log(`📊 Summary: ${this.results.summary.passedTests}/${this.results.summary.totalTests} tests passed (${this.results.summary.successRate}%)`);
            
            // Exit with error code if tests failed
            if (this.results.summary.failedTests > 0) {
                console.error('❌ Some tests failed!');
                process.exit(1);
            }
            
        } catch (error) {
            console.error('❌ Fatal error in test aggregation:', error);
            await claudeFlowHooks('error', { error: error.message });
            process.exit(1);
        }
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const aggregator = new TestResultsAggregator();
    aggregator.run();
}

export default TestResultsAggregator;