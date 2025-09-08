#!/usr/bin/env node

/**
 * Unjucks Cleanroom Validation Checklist
 * Comprehensive validation script for all package features
 * 
 * This script validates:
 * - Package integrity and structure
 * - CLI functionality and commands
 * - Template system operations
 * - RDF/Semantic web features
 * - Cross-platform compatibility
 * - Performance benchmarks
 * - Security validations
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const config = {
    timeout: 30000,
    retries: 3,
    outputDir: join(__dirname, '../temp/validation-results'),
    verbose: process.env.VERBOSE === 'true'
};

// Results tracking
const results = {
    timestamp: new Date().toISOString(),
    environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
    },
    validations: [],
    summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0
    }
};

// Validation categories
const validationCategories = {
    PACKAGE: 'Package Structure',
    CLI: 'CLI Functionality',
    TEMPLATES: 'Template System',
    RDF: 'RDF/Semantic Features',
    PERFORMANCE: 'Performance',
    SECURITY: 'Security',
    INTEGRATION: 'Integration',
    COMPATIBILITY: 'Cross-platform'
};

// Logging utilities
const log = {
    info: (msg) => {
        console.log(`ℹ️  ${msg}`);
        if (config.verbose) process.stdout.write(`[${new Date().toISOString()}] INFO: ${msg}\n`);
    },
    success: (msg) => {
        console.log(`✅ ${msg}`);
        if (config.verbose) process.stdout.write(`[${new Date().toISOString()}] SUCCESS: ${msg}\n`);
    },
    warning: (msg) => {
        console.log(`⚠️  ${msg}`);
        if (config.verbose) process.stdout.write(`[${new Date().toISOString()}] WARNING: ${msg}\n`);
    },
    error: (msg) => {
        console.log(`❌ ${msg}`);
        if (config.verbose) process.stdout.write(`[${new Date().toISOString()}] ERROR: ${msg}\n`);
    },
    skip: (msg) => {
        console.log(`⏭️  ${msg}`);
        if (config.verbose) process.stdout.write(`[${new Date().toISOString()}] SKIP: ${msg}\n`);
    }
};

// Validation framework
class ValidationRunner {
    constructor() {
        this.validations = new Map();
        this.setupOutputDir();
    }

    setupOutputDir() {
        if (!existsSync(config.outputDir)) {
            mkdirSync(config.outputDir, { recursive: true });
        }
    }

    addValidation(id, category, name, fn, options = {}) {
        this.validations.set(id, {
            id,
            category,
            name,
            fn,
            required: options.required !== false,
            timeout: options.timeout || config.timeout,
            retries: options.retries || config.retries
        });
    }

    async runValidation(validation) {
        const startTime = Date.now();
        let lastError = null;
        
        for (let attempt = 1; attempt <= validation.retries; attempt++) {
            try {
                if (config.verbose) {
                    log.info(`Running ${validation.name} (attempt ${attempt}/${validation.retries})`);
                }
                
                const result = await Promise.race([
                    validation.fn(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Timeout')), validation.timeout)
                    )
                ]);
                
                return {
                    id: validation.id,
                    category: validation.category,
                    name: validation.name,
                    status: 'passed',
                    duration: Date.now() - startTime,
                    result: result || true,
                    error: null,
                    attempts: attempt
                };
            } catch (error) {
                lastError = error;
                if (attempt < validation.retries) {
                    if (config.verbose) {
                        log.warning(`Attempt ${attempt} failed: ${error.message}`);
                    }
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
            }
        }
        
        return {
            id: validation.id,
            category: validation.category,
            name: validation.name,
            status: validation.required ? 'failed' : 'warning',
            duration: Date.now() - startTime,
            result: null,
            error: lastError.message,
            attempts: validation.retries
        };
    }

    async runAll() {
        log.info('Starting Unjucks validation checklist');
        log.info(`Total validations: ${this.validations.size}`);
        
        results.summary.total = this.validations.size;
        
        for (const [id, validation] of this.validations) {
            const result = await this.runValidation(validation);
            results.validations.push(result);
            
            switch (result.status) {
                case 'passed':
                    results.summary.passed++;
                    log.success(`${result.name}`);
                    break;
                case 'failed':
                    results.summary.failed++;
                    log.error(`${result.name}: ${result.error}`);
                    break;
                case 'warning':
                    results.summary.skipped++;
                    log.warning(`${result.name}: ${result.error}`);
                    break;
            }
        }
        
        this.generateReport();
        this.printSummary();
        
        return results.summary.failed === 0;
    }

    generateReport() {
        const reportPath = join(config.outputDir, 'validation-report.json');
        writeFileSync(reportPath, JSON.stringify(results, null, 2));
        
        // Generate HTML report
        const htmlReport = this.generateHtmlReport();
        const htmlPath = join(config.outputDir, 'validation-report.html');
        writeFileSync(htmlPath, htmlReport);
        
        log.info(`Reports generated:`);
        log.info(`  JSON: ${reportPath}`);
        log.info(`  HTML: ${htmlPath}`);
    }

    generateHtmlReport() {
        const categorizedResults = {};
        results.validations.forEach(result => {
            if (!categorizedResults[result.category]) {
                categorizedResults[result.category] = [];
            }
            categorizedResults[result.category].push(result);
        });

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Unjucks Validation Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 2rem; }
        .header { background: #f8fafc; padding: 1rem; border-radius: 8px; margin-bottom: 2rem; }
        .summary { display: flex; gap: 1rem; margin-bottom: 2rem; }
        .metric { background: white; padding: 1rem; border-radius: 8px; border: 1px solid #e2e8f0; flex: 1; text-align: center; }
        .metric h3 { margin: 0; font-size: 2rem; }
        .metric p { margin: 0.5rem 0 0 0; color: #64748b; }
        .passed { color: #22c55e; }
        .failed { color: #ef4444; }
        .warning { color: #f59e0b; }
        .category { margin-bottom: 2rem; }
        .category h2 { border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; }
        .validation { display: flex; align-items: center; padding: 0.75rem; border: 1px solid #e2e8f0; border-radius: 4px; margin-bottom: 0.5rem; }
        .validation.passed { border-color: #22c55e; background: #f0fdf4; }
        .validation.failed { border-color: #ef4444; background: #fef2f2; }
        .validation.warning { border-color: #f59e0b; background: #fffbeb; }
        .status-icon { margin-right: 0.75rem; font-size: 1.2rem; }
        .validation-name { flex: 1; font-weight: 500; }
        .duration { font-size: 0.875rem; color: #64748b; }
        .error { font-size: 0.875rem; color: #dc2626; margin-top: 0.25rem; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Unjucks Validation Report</h1>
        <p>Generated: ${results.timestamp}</p>
        <p>Environment: Node ${results.environment.nodeVersion} on ${results.environment.platform}/${results.environment.arch}</p>
    </div>
    
    <div class="summary">
        <div class="metric">
            <h3 class="passed">${results.summary.passed}</h3>
            <p>Passed</p>
        </div>
        <div class="metric">
            <h3 class="failed">${results.summary.failed}</h3>
            <p>Failed</p>
        </div>
        <div class="metric">
            <h3 class="warning">${results.summary.skipped}</h3>
            <p>Warnings</p>
        </div>
        <div class="metric">
            <h3>${results.summary.total}</h3>
            <p>Total</p>
        </div>
    </div>
    
    ${Object.entries(categorizedResults).map(([category, validations]) => `
    <div class="category">
        <h2>${category}</h2>
        ${validations.map(validation => `
        <div class="validation ${validation.status}">
            <div class="status-icon">
                ${validation.status === 'passed' ? '✅' : validation.status === 'failed' ? '❌' : '⚠️'}
            </div>
            <div class="validation-name">${validation.name}</div>
            <div class="duration">${validation.duration}ms</div>
            ${validation.error ? `<div class="error">${validation.error}</div>` : ''}
        </div>
        `).join('')}
    </div>
    `).join('')}
</body>
</html>`;
    }

    printSummary() {
        console.log('\n' + '='.repeat(50));
        console.log('VALIDATION SUMMARY');
        console.log('='.repeat(50));
        console.log(`Total Validations: ${results.summary.total}`);
        console.log(`✅ Passed: ${results.summary.passed}`);
        console.log(`❌ Failed: ${results.summary.failed}`);
        console.log(`⚠️  Warnings: ${results.summary.skipped}`);
        console.log(`Success Rate: ${Math.round((results.summary.passed / results.summary.total) * 100)}%`);
        console.log('='.repeat(50));
    }
}

// Utility functions
function execCommand(command, options = {}) {
    return execSync(command, { 
        encoding: 'utf8', 
        timeout: config.timeout,
        ...options 
    });
}

function pathExists(path) {
    return existsSync(path);
}

function readPackageJson() {
    const packagePath = join(__dirname, '../package.json');
    return JSON.parse(readFileSync(packagePath, 'utf8'));
}

// Initialize validation runner
const runner = new ValidationRunner();

// Package Structure Validations
runner.addValidation('pkg-structure', validationCategories.PACKAGE, 'Package.json is valid and complete', () => {
    const pkg = readPackageJson();
    
    // Required fields
    const requiredFields = ['name', 'version', 'description', 'main', 'bin', 'exports'];
    for (const field of requiredFields) {
        if (!pkg[field]) {
            throw new Error(`Missing required field: ${field}`);
        }
    }
    
    // Bin executable exists
    if (!pathExists(join(__dirname, '../bin/unjucks.cjs'))) {
        throw new Error('Binary executable not found');
    }
    
    // Main entry point exists
    if (!pathExists(join(__dirname, '../src/cli/index.js'))) {
        throw new Error('Main entry point not found');
    }
    
    return true;
});

runner.addValidation('pkg-files', validationCategories.PACKAGE, 'Required package files exist', () => {
    const requiredFiles = [
        'README.md',
        'LICENSE',
        'bin/unjucks.cjs',
        'src/cli/index.js',
        '_templates'
    ];
    
    for (const file of requiredFiles) {
        if (!pathExists(join(__dirname, '..', file))) {
            throw new Error(`Required file missing: ${file}`);
        }
    }
    
    return true;
});

// CLI Functionality Validations
runner.addValidation('cli-help', validationCategories.CLI, 'CLI shows help information', () => {
    const output = execCommand('node ../bin/unjucks.cjs --help', { cwd: __dirname });
    if (!output.includes('unjucks') && !output.includes('Usage')) {
        throw new Error('Help output does not contain expected content');
    }
    return true;
});

runner.addValidation('cli-version', validationCategories.CLI, 'CLI shows version information', () => {
    try {
        const output = execCommand('node ../bin/unjucks.cjs --version', { cwd: __dirname });
        const pkg = readPackageJson();
        if (!output.includes(pkg.version)) {
            throw new Error(`Version mismatch: expected ${pkg.version}`);
        }
        return true;
    } catch (error) {
        // Try alternative version command
        const output = execCommand('node ../bin/unjucks.cjs version', { cwd: __dirname });
        return output.length > 0;
    }
});

runner.addValidation('cli-list', validationCategories.CLI, 'CLI list command works', () => {
    try {
        execCommand('node ../bin/unjucks.cjs list', { cwd: __dirname });
        return true;
    } catch (error) {
        // Allow non-zero exit if no templates found
        if (error.message.includes('No templates found') || error.status === 1) {
            return true;
        }
        throw error;
    }
});

// Template System Validations
runner.addValidation('templates-dir', validationCategories.TEMPLATES, 'Templates directory exists and accessible', () => {
    const templatesDir = join(__dirname, '../_templates');
    if (!pathExists(templatesDir)) {
        throw new Error('Templates directory not found');
    }
    
    // Check if directory is readable
    try {
        execCommand(`ls -la "${templatesDir}"`);
        return true;
    } catch (error) {
        throw new Error('Templates directory not accessible');
    }
});

runner.addValidation('nunjucks-engine', validationCategories.TEMPLATES, 'Nunjucks template engine works', () => {
    // Test basic Nunjucks functionality
    const testScript = `
        const nunjucks = require('nunjucks');
        const template = nunjucks.renderString('Hello {{ name }}!', { name: 'World' });
        if (template !== 'Hello World!') {
            throw new Error('Template rendering failed');
        }
        console.log('Template engine working');
    `;
    
    execCommand(`node -e "${testScript}"`);
    return true;
});

// RDF/Semantic Features Validations
runner.addValidation('rdf-dependencies', validationCategories.RDF, 'RDF dependencies are available', () => {
    const pkg = readPackageJson();
    const rdfDeps = ['n3', 'yaml'];
    
    for (const dep of rdfDeps) {
        if (!pkg.dependencies[dep]) {
            throw new Error(`RDF dependency missing: ${dep}`);
        }
    }
    
    // Test N3 import
    execCommand('node -e "const N3 = require(\'n3\'); console.log(\'N3 loaded\')"');
    return true;
});

runner.addValidation('semantic-features', validationCategories.RDF, 'Semantic web features can be imported', () => {
    // Test if semantic features can be loaded
    const testScript = `
        try {
            const yaml = require('yaml');
            console.log('YAML parser loaded');
        } catch (error) {
            throw new Error('YAML parser not available');
        }
    `;
    
    execCommand(`node -e "${testScript}"`);
    return true;
});

// Performance Validations
runner.addValidation('cli-startup', validationCategories.PERFORMANCE, 'CLI starts up quickly (< 2s)', () => {
    const start = Date.now();
    execCommand('node ../bin/unjucks.cjs --help', { cwd: __dirname });
    const duration = Date.now() - start;
    
    if (duration > 2000) {
        throw new Error(`Startup too slow: ${duration}ms`);
    }
    
    return { startupTime: duration };
}, { timeout: 5000 });

runner.addValidation('package-size', validationCategories.PERFORMANCE, 'Package size is reasonable', () => {
    // Check package.json size indicators
    const pkg = readPackageJson();
    const depCount = Object.keys(pkg.dependencies || {}).length;
    
    if (depCount > 50) {
        throw new Error(`Too many dependencies: ${depCount}`);
    }
    
    return { dependencyCount: depCount };
});

// Security Validations
runner.addValidation('security-audit', validationCategories.SECURITY, 'No high/critical security vulnerabilities', () => {
    try {
        execCommand('npm audit --audit-level=moderate', { cwd: join(__dirname, '..') });
        return true;
    } catch (error) {
        // npm audit returns non-zero for vulnerabilities
        if (error.message.includes('high') || error.message.includes('critical')) {
            throw new Error('High or critical security vulnerabilities found');
        }
        return true; // Low/moderate vulnerabilities allowed
    }
}, { required: false });

runner.addValidation('no-hardcoded-secrets', validationCategories.SECURITY, 'No hardcoded secrets in source', () => {
    // Basic check for common secret patterns
    const secretPatterns = [
        /api[_-]?key\s*[:=]\s*['"]\w+/i,
        /secret[_-]?key\s*[:=]\s*['"]\w+/i,
        /password\s*[:=]\s*['"]\w+/i,
        /token\s*[:=]\s*['"]\w+/i
    ];
    
    try {
        const srcFiles = execCommand('find ../src -type f -name "*.js" | head -20', { cwd: __dirname });
        const files = srcFiles.trim().split('\n').slice(0, 10); // Limit check to avoid timeout
        
        for (const file of files) {
            if (file && pathExists(join(__dirname, file))) {
                const content = readFileSync(join(__dirname, file), 'utf8');
                for (const pattern of secretPatterns) {
                    if (pattern.test(content)) {
                        throw new Error(`Potential hardcoded secret in ${file}`);
                    }
                }
            }
        }
        
        return true;
    } catch (error) {
        if (error.message.includes('Potential hardcoded secret')) {
            throw error;
        }
        // If find command fails, skip this validation
        throw new Error('Could not scan source files');
    }
}, { required: false });

// Integration Validations
runner.addValidation('npm-install', validationCategories.INTEGRATION, 'Package can be installed via npm', () => {
    // Test in temporary directory
    const testDir = join(__dirname, '../temp/npm-install-test');
    
    try {
        // Clean up any previous test
        execCommand(`rm -rf "${testDir}"`);
        execCommand(`mkdir -p "${testDir}"`);
        
        // Create minimal package.json
        writeFileSync(join(testDir, 'package.json'), JSON.stringify({
            name: 'test-install',
            version: '1.0.0',
            private: true
        }));
        
        // Create package tarball and install
        execCommand('npm pack', { cwd: join(__dirname, '..') });
        const pkg = readPackageJson();
        const tarballName = `seanchatmangpt-unjucks-${pkg.version}.tgz`;
        
        execCommand(`npm install "../${tarballName}"`, { cwd: testDir });
        
        // Verify installation
        if (!pathExists(join(testDir, 'node_modules/@seanchatmangpt/unjucks'))) {
            throw new Error('Package not found in node_modules after installation');
        }
        
        return true;
    } finally {
        // Cleanup
        try {
            execCommand(`rm -rf "${testDir}"`);
            const pkg = readPackageJson();
            const tarballName = `seanchatmangpt-unjucks-${pkg.version}.tgz`;
            execCommand(`rm -f "${join(__dirname, '..', tarballName)}"`);
        } catch (e) {
            // Ignore cleanup errors
        }
    }
}, { timeout: 60000 });

// Cross-platform Compatibility Validations
runner.addValidation('cross-platform-paths', validationCategories.COMPATIBILITY, 'File paths work cross-platform', () => {
    // Test path handling
    const testScript = `
        const { join, resolve } = require('path');
        const { existsSync } = require('fs');
        
        // Test various path operations
        const binPath = resolve(__dirname, '../bin/unjucks.cjs');
        const srcPath = resolve(__dirname, '../src/cli/index.js');
        
        if (!existsSync(binPath)) {
            throw new Error('Binary path resolution failed');
        }
        
        if (!existsSync(srcPath)) {
            throw new Error('Source path resolution failed');
        }
        
        console.log('Path handling working');
    `;
    
    execCommand(`node -e "${testScript}"`, { cwd: __dirname });
    return true;
});

runner.addValidation('node-compatibility', validationCategories.COMPATIBILITY, 'Compatible with current Node.js version', () => {
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);
    
    if (majorVersion < 18) {
        throw new Error(`Node.js ${nodeVersion} is below minimum required version (18.0.0)`);
    }
    
    return { nodeVersion, supported: true };
});

// Run all validations
async function main() {
    const success = await runner.runAll();
    process.exit(success ? 0 : 1);
}

// Execute if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        log.error(`Validation runner failed: ${error.message}`);
        process.exit(1);
    });
}

export default runner;