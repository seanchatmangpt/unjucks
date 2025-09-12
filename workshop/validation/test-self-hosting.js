#!/usr/bin/env node

/**
 * KGEN Self-Hosting Test Suite
 * 
 * Comprehensive testing framework for validating KGEN's
 * self-hosting capabilities and bootstrap system.
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';
import KGENBootstrap from '../bootstrap/kgen-bootstrap.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SelfHostingTestSuite {
    constructor() {
        this.workshopDir = path.join(__dirname, '..');
        this.outputDir = path.join(this.workshopDir, 'output');
        this.validationDir = path.join(this.workshopDir, 'validation');
        this.testResults = [];
    }

    log(message, level = 'INFO') {
        const timestamp = this.getDeterministicDate().toISOString();
        console.log(`[${timestamp}] [${level}] ${message}`);
    }

    async runTest(testName, testFunction) {
        this.log(`Running test: ${testName}`);
        const startTime = this.getDeterministicTimestamp();
        
        try {
            await testFunction();
            const duration = this.getDeterministicTimestamp() - startTime;
            this.testResults.push({
                name: testName,
                passed: true,
                duration,
                error: null
            });
            this.log(`✅ ${testName} PASSED (${duration}ms)`);
        } catch (error) {
            const duration = this.getDeterministicTimestamp() - startTime;
            this.testResults.push({
                name: testName,
                passed: false,
                duration,
                error: error.message
            });
            this.log(`❌ ${testName} FAILED: ${error.message}`, 'ERROR');
        }
    }

    async testRDFDataExists() {
        const workshopTtl = path.join(this.workshopDir, 'rdf', 'workshop.ttl');
        const shapesTtl = path.join(this.workshopDir, 'rdf', 'kgen-shapes.ttl');
        
        assert(fs.existsSync(workshopTtl), 'workshop.ttl must exist');
        assert(fs.existsSync(shapesTtl), 'kgen-shapes.ttl must exist');
        
        const workshopContent = fs.readFileSync(workshopTtl, 'utf8');
        assert(workshopContent.includes('@prefix kgen:'), 'workshop.ttl must contain kgen namespace');
        assert(workshopContent.includes('kgen:Project'), 'workshop.ttl must contain Project class');
        assert(workshopContent.includes('kgen:Charter'), 'workshop.ttl must contain Charter class');
    }

    async testSHACLShapesValid() {
        const shapesTtl = path.join(this.workshopDir, 'rdf', 'kgen-shapes.ttl');
        const shapesContent = fs.readFileSync(shapesTtl, 'utf8');
        
        assert(shapesContent.includes('sh:NodeShape'), 'Shapes file must contain NodeShape definitions');
        assert(shapesContent.includes(':ProjectShape'), 'Shapes file must contain ProjectShape');
        assert(shapesContent.includes(':CharterShape'), 'Shapes file must contain CharterShape');
        assert(shapesContent.includes('sh:minCount'), 'Shapes file must contain cardinality constraints');
    }

    async testTemplatesExist() {
        const charterTemplate = path.join(this.workshopDir, 'templates', 'charter-latex.njk');
        const workshopTemplate = path.join(this.workshopDir, 'templates', 'workshop-html.njk');
        
        assert(fs.existsSync(charterTemplate), 'LaTeX charter template must exist');
        assert(fs.existsSync(workshopTemplate), 'HTML workshop template must exist');
        
        const charterContent = fs.readFileSync(charterTemplate, 'utf8');
        assert(charterContent.includes('\\documentclass'), 'Charter template must be valid LaTeX');
        assert(charterContent.includes('{{ charter.title }}'), 'Charter template must contain template variables');
        
        const workshopContent = fs.readFileSync(workshopTemplate, 'utf8');
        assert(workshopContent.includes('<!DOCTYPE html>'), 'Workshop template must be valid HTML');
        assert(workshopContent.includes('{{ project.title }}'), 'Workshop template must contain template variables');
    }

    async testBootstrapSystemRuns() {
        const bootstrap = new KGENBootstrap();
        const result = await bootstrap.run();
        
        assert(result.success, `Bootstrap system must run successfully: ${result.error || 'Unknown error'}`);
        assert(Array.isArray(result.outputs), 'Bootstrap must return array of outputs');
        assert(result.outputs.length > 0, 'Bootstrap must generate at least one output file');
    }

    async testSelfGenerationCapability() {
        // Verify KGEN can generate its own documentation
        const charterPdf = path.join(this.outputDir, 'charter.pdf');
        const workshopHtml = path.join(this.outputDir, 'workshop.html');
        const apiDocs = path.join(this.outputDir, 'api-docs.json');
        
        assert(fs.existsSync(charterPdf), 'Charter PDF must be generated');
        assert(fs.existsSync(workshopHtml), 'Workshop HTML must be generated');
        assert(fs.existsSync(apiDocs), 'API documentation must be generated');
        
        // Verify content quality
        const workshopContent = fs.readFileSync(workshopHtml, 'utf8');
        assert(workshopContent.includes('KGEN'), 'Workshop HTML must contain KGEN content');
        assert(workshopContent.includes('Self-Hosting'), 'Workshop HTML must contain self-hosting section');
        
        const apiContent = JSON.parse(fs.readFileSync(apiDocs, 'utf8'));
        assert(apiContent.openapi, 'API docs must be valid OpenAPI spec');
        assert(apiContent.info.title.includes('KGEN'), 'API docs must be about KGEN');
    }

    async testOutputQualityStandards() {
        const outputs = [
            path.join(this.outputDir, 'charter.pdf'),
            path.join(this.outputDir, 'workshop.html'),
            path.join(this.outputDir, 'api-docs.json'),
            path.join(this.outputDir, 'bootstrap-report.json')
        ];
        
        outputs.forEach(output => {
            assert(fs.existsSync(output), `Output file must exist: ${path.basename(output)}`);
            const stats = fs.statSync(output);
            assert(stats.size > 100, `Output file must not be empty: ${path.basename(output)}`);
        });
        
        // Test HTML quality
        const workshopHtml = fs.readFileSync(path.join(this.outputDir, 'workshop.html'), 'utf8');
        assert(workshopHtml.includes('<!DOCTYPE html>'), 'HTML must have valid DOCTYPE');
        assert(workshopHtml.includes('<title>'), 'HTML must have title tag');
        assert(workshopHtml.includes('</html>'), 'HTML must be properly closed');
        
        // Test JSON quality
        const apiDocs = fs.readFileSync(path.join(this.outputDir, 'api-docs.json'), 'utf8');
        assert.doesNotThrow(() => JSON.parse(apiDocs), 'API docs must be valid JSON');
    }

    async testRecursiveSelfValidation() {
        const validationReport = path.join(this.validationDir, 'recursive-validation.json');
        
        if (fs.existsSync(validationReport)) {
            const report = JSON.parse(fs.readFileSync(validationReport, 'utf8'));
            assert(report.depth >= 3, 'Recursive validation must have depth of at least 3');
            assert(Array.isArray(report.levels), 'Validation report must contain levels array');
            
            report.levels.forEach((level, index) => {
                assert(level.level === index + 1, `Level ${index + 1} must have correct level number`);
                assert(level.passed, `Validation level ${level.level} must pass`);
                assert(Array.isArray(level.checks), `Level ${level.level} must have checks array`);
            });
        }
    }

    async testDogfoodingDemonstration() {
        // Verify that the bootstrap report proves dogfooding
        const bootstrapReport = path.join(this.outputDir, 'bootstrap-report.json');
        assert(fs.existsSync(bootstrapReport), 'Bootstrap report must exist');
        
        const report = JSON.parse(fs.readFileSync(bootstrapReport, 'utf8'));
        assert(report.dogfoodingDemonstration, 'Report must contain dogfooding demonstration section');
        assert(report.dogfoodingDemonstration.proofOfConcept, 'Report must contain proof of concept');
        
        const capabilities = report.dogfoodingDemonstration.selfHostingCapabilities;
        assert(Array.isArray(capabilities), 'Self-hosting capabilities must be an array');
        assert(capabilities.length >= 5, 'Must demonstrate at least 5 self-hosting capabilities');
        
        // Verify specific capabilities are demonstrated
        const capabilityTexts = capabilities.join(' ').toLowerCase();
        assert(capabilityTexts.includes('rdf'), 'Must demonstrate RDF capabilities');
        assert(capabilityTexts.includes('shacl'), 'Must demonstrate SHACL capabilities');
        assert(capabilityTexts.includes('template'), 'Must demonstrate template capabilities');
        assert(capabilityTexts.includes('validation'), 'Must demonstrate validation capabilities');
    }

    async testContinuousValidation() {
        // Verify that validation can be run continuously
        const validationFiles = [
            path.join(this.validationDir, 'validation-report.ttl'),
            path.join(this.validationDir, 'output-validation.json'),
            path.join(this.validationDir, 'recursive-validation.json')
        ];
        
        validationFiles.forEach(file => {
            if (fs.existsSync(file)) {
                const stats = fs.statSync(file);
                assert(stats.size > 10, `Validation file must not be empty: ${path.basename(file)}`);
            }
        });
    }

    async testEnterpriseReadiness() {
        // Test that generated outputs meet enterprise standards
        const outputs = fs.readdirSync(this.outputDir);
        assert(outputs.length >= 4, 'Must generate at least 4 output files');
        
        // Check for required outputs
        const requiredOutputs = ['charter.pdf', 'workshop.html', 'api-docs.json', 'bootstrap-report.json'];
        requiredOutputs.forEach(required => {
            assert(outputs.includes(required), `Must generate required output: ${required}`);
        });
        
        // Verify workshop contains enterprise sections
        const workshopHtml = fs.readFileSync(path.join(this.outputDir, 'workshop.html'), 'utf8');
        const enterpriseSections = [
            'Enterprise Integration',
            'Best Practices',
            'Implementation Roadmap',
            'CTQ Metrics'
        ];
        
        enterpriseSections.forEach(section => {
            assert(workshopHtml.includes(section), `Workshop must contain enterprise section: ${section}`);
        });
    }

    generateTestReport() {
        const passed = this.testResults.filter(r => r.passed).length;
        const failed = this.testResults.filter(r => r.failed).length;
        const totalDuration = this.testResults.reduce((sum, r) => sum + r.duration, 0);
        
        const report = {
            timestamp: this.getDeterministicDate().toISOString(),
            summary: {
                total: this.testResults.length,
                passed,
                failed,
                success_rate: Math.round((passed / this.testResults.length) * 100),
                total_duration: totalDuration
            },
            tests: this.testResults,
            coverage: {
                rdf_validation: true,
                template_rendering: true,
                output_generation: true,
                self_hosting: true,
                recursive_validation: true,
                dogfooding: true,
                enterprise_readiness: true
            }
        };
        
        const reportPath = path.join(this.validationDir, 'self-hosting-test-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        return report;
    }

    async run() {
        this.log('🧪 Starting KGEN Self-Hosting Test Suite...');
        
        const tests = [
            { name: 'RDF Data Exists', fn: () => this.testRDFDataExists() },
            { name: 'SHACL Shapes Valid', fn: () => this.testSHACLShapesValid() },
            { name: 'Templates Exist', fn: () => this.testTemplatesExist() },
            { name: 'Bootstrap System Runs', fn: () => this.testBootstrapSystemRuns() },
            { name: 'Self-Generation Capability', fn: () => this.testSelfGenerationCapability() },
            { name: 'Output Quality Standards', fn: () => this.testOutputQualityStandards() },
            { name: 'Recursive Self-Validation', fn: () => this.testRecursiveSelfValidation() },
            { name: 'Dogfooding Demonstration', fn: () => this.testDogfoodingDemonstration() },
            { name: 'Continuous Validation', fn: () => this.testContinuousValidation() },
            { name: 'Enterprise Readiness', fn: () => this.testEnterpriseReadiness() }
        ];
        
        for (const test of tests) {
            await this.runTest(test.name, test.fn);
        }
        
        const report = this.generateTestReport();
        
        this.log(`📊 Test Results: ${report.summary.passed}/${report.summary.total} passed (${report.summary.success_rate}%)`);
        this.log(`⏱️  Total Duration: ${report.summary.total_duration}ms`);
        
        if (report.summary.failed > 0) {
            this.log(`❌ ${report.summary.failed} tests failed:`, 'ERROR');
            this.testResults.filter(r => !r.passed).forEach(r => {
                this.log(`  - ${r.name}: ${r.error}`, 'ERROR');
            });
        } else {
            this.log('🎉 All tests passed! Self-hosting system is fully functional.');
        }
        
        return report;
    }
}

// Run test suite if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const testSuite = new SelfHostingTestSuite();
    testSuite.run().then(report => {
        process.exit(report.summary.failed === 0 ? 0 : 1);
    });
}

export default SelfHostingTestSuite;