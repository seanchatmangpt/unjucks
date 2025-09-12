#!/usr/bin/env node

/**
 * PDF Quality Checker for LaTeX CI Validation
 * Validates PDF structure, metadata, and content quality
 */

import { promises as fs } from 'fs';
import path from 'path';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { glob } from 'glob';
import consola from 'consola';
import chalk from 'chalk';

const execAsync = promisify(exec);

class PDFQualityChecker {
    constructor(options = {}) {
        this.options = {
            pdfDir: options.pdfDir || 'test-workspace/output',
            verbose: options.verbose || false,
            checkTools: options.checkTools !== false, // Default true
            ...options
        };
        
        this.results = {
            total: 0,
            passed: 0,
            failed: 0,
            warnings: 0,
            checks: []
        };
        
        this.availableTools = {
            qpdf: false,
            pdfinfo: false,
            pdftotext: false,
            pdftk: false
        };
    }

    /**
     * Check availability of PDF validation tools
     */
    async checkToolAvailability() {
        if (!this.options.checkTools) {
            consola.info('Skipping tool availability check');
            return;
        }

        consola.info('Checking PDF validation tools availability...');
        
        const tools = Object.keys(this.availableTools);
        
        for (const tool of tools) {
            try {
                await execAsync(`which ${tool}`);
                this.availableTools[tool] = true;
                consola.success(`✓ ${tool} is available`);
            } catch (error) {
                this.availableTools[tool] = false;
                consola.warn(`⚠ ${tool} is not available`);
            }
        }
        
        const availableCount = Object.values(this.availableTools).filter(Boolean).length;
        
        if (availableCount === 0) {
            consola.warn('No PDF validation tools available. Install with:');
            console.log('  Ubuntu/Debian: sudo apt-get install qpdf poppler-utils pdftk');
            console.log('  macOS: brew install qpdf poppler pdftk-java');
        } else {
            consola.info(`${availableCount} PDF validation tools available`);
        }
    }

    /**
     * Find all PDF files to validate
     */
    async findPDFs() {
        const patterns = [
            path.join(this.options.pdfDir, '**/*.pdf'),
            'artifacts/**/*.pdf',
            'test-workspace/**/*.pdf',
            'legal-test/**/*.pdf',
            'academic-test/**/*.pdf'
        ];
        
        let allPDFs = [];
        
        for (const pattern of patterns) {
            try {
                const pdfs = await glob(pattern);
                allPDFs = allPDFs.concat(pdfs);
            } catch (error) {
                if (this.options.verbose) {
                    consola.debug(`Pattern ${pattern} failed: ${error.message}`);
                }
            }
        }
        
        // Remove duplicates
        const uniquePDFs = [...new Set(allPDFs)];
        
        consola.info(`Found ${uniquePDFs.length} PDF files to validate`);
        return uniquePDFs;
    }

    /**
     * Basic file validation
     */
    async validateBasicFile(pdfPath) {
        const issues = [];
        
        try {
            const stats = await fs.stat(pdfPath);
            
            // Check file size
            if (stats.size === 0) {
                issues.push({
                    type: 'error',
                    message: 'PDF file is empty (0 bytes)',
                    severity: 'high'
                });
            } else if (stats.size < 1024) {
                issues.push({
                    type: 'warning',
                    message: `PDF file is very small (${stats.size} bytes)`,
                    severity: 'medium'
                });
            }
            
            // Check if file is readable
            await fs.access(pdfPath, fs.constants.R_OK);
            
            // Basic PDF header check
            const buffer = await fs.readFile(pdfPath);
            const header = buffer.toString('ascii', 0, 8);
            
            if (!header.startsWith('%PDF-')) {
                issues.push({
                    type: 'error',
                    message: 'File does not have valid PDF header',
                    severity: 'high'
                });
            }
            
            // Check for EOF marker
            const tail = buffer.toString('ascii', Math.max(0, buffer.length - 100));
            if (!tail.includes('%%EOF')) {
                issues.push({
                    type: 'warning',
                    message: 'PDF may be truncated (no %%EOF marker found)',
                    severity: 'medium'
                });
            }
            
        } catch (error) {
            issues.push({
                type: 'error',
                message: `File access error: ${error.message}`,
                severity: 'high'
            });
        }
        
        return issues;
    }

    /**
     * Validate PDF structure using qpdf
     */
    async validatePDFStructure(pdfPath) {
        if (!this.availableTools.qpdf) {
            return [{
                type: 'info',
                message: 'qpdf not available, skipping structure validation',
                severity: 'low'
            }];
        }
        
        const issues = [];
        
        try {
            await execAsync(`qpdf --check "${pdfPath}"`);
            issues.push({
                type: 'success',
                message: 'PDF structure is valid',
                severity: 'low'
            });
        } catch (error) {
            issues.push({
                type: 'error',
                message: `PDF structure validation failed: ${error.message}`,
                severity: 'high'
            });
        }
        
        return issues;
    }

    /**
     * Extract and validate PDF metadata
     */
    async validatePDFMetadata(pdfPath) {
        if (!this.availableTools.pdfinfo) {
            return [{
                type: 'info',
                message: 'pdfinfo not available, skipping metadata validation',
                severity: 'low'
            }];
        }
        
        const issues = [];
        
        try {
            const { stdout } = await execAsync(`pdfinfo "${pdfPath}"`);
            const metadata = this.parsePDFInfo(stdout);
            
            // Check essential metadata
            if (!metadata.Pages || metadata.Pages === '0') {
                issues.push({
                    type: 'error',
                    message: 'PDF has no pages',
                    severity: 'high'
                });
            } else {
                const pages = parseInt(metadata.Pages);
                if (pages > 0) {
                    issues.push({
                        type: 'success',
                        message: `PDF has ${pages} page(s)`,
                        severity: 'low'
                    });
                }
            }
            
            // Check for creator/producer info
            if (!metadata.Creator && !metadata.Producer) {
                issues.push({
                    type: 'warning',
                    message: 'PDF missing creator/producer metadata',
                    severity: 'low'
                });
            } else {
                if (metadata.Creator) {
                    issues.push({
                        type: 'info',
                        message: `Creator: ${metadata.Creator}`,
                        severity: 'low'
                    });
                }
                if (metadata.Producer) {
                    issues.push({
                        type: 'info',
                        message: `Producer: ${metadata.Producer}`,
                        severity: 'low'
                    });
                }
            }
            
            // Check file size
            if (metadata['File size']) {
                issues.push({
                    type: 'info',
                    message: `File size: ${metadata['File size']}`,
                    severity: 'low'
                });
            }
            
        } catch (error) {
            issues.push({
                type: 'warning',
                message: `Metadata extraction failed: ${error.message}`,
                severity: 'medium'
            });
        }
        
        return issues;
    }

    /**
     * Validate PDF content
     */
    async validatePDFContent(pdfPath) {
        if (!this.availableTools.pdftotext) {
            return [{
                type: 'info',
                message: 'pdftotext not available, skipping content validation',
                severity: 'low'
            }];
        }
        
        const issues = [];
        
        try {
            const { stdout } = await execAsync(`pdftotext "${pdfPath}" -`);
            const text = stdout.trim();
            
            if (!text || text.length === 0) {
                issues.push({
                    type: 'warning',
                    message: 'PDF contains no extractable text',
                    severity: 'medium'
                });
            } else {
                const wordCount = text.split(/\s+/).length;
                issues.push({
                    type: 'success',
                    message: `PDF contains ${wordCount} words of text`,
                    severity: 'low'
                });
                
                // Check for expected content in different document types
                const filename = path.basename(pdfPath, '.pdf').toLowerCase();
                
                if (filename.includes('legal') || filename.includes('brief')) {
                    if (text.includes('plaintiff') || text.includes('defendant') || text.includes('court')) {
                        issues.push({
                            type: 'success',
                            message: 'Legal document contains expected legal terminology',
                            severity: 'low'
                        });
                    } else {
                        issues.push({
                            type: 'warning',
                            message: 'Legal document missing expected legal terminology',
                            severity: 'medium'
                        });
                    }
                }
                
                if (filename.includes('contract')) {
                    if (text.includes('agreement') || text.includes('party') || text.includes('terms')) {
                        issues.push({
                            type: 'success',
                            message: 'Contract contains expected contract terminology',
                            severity: 'low'
                        });
                    }
                }
                
                if (filename.includes('paper') || filename.includes('academic')) {
                    if (text.includes('abstract') || text.includes('introduction') || text.includes('conclusion')) {
                        issues.push({
                            type: 'success',
                            message: 'Academic paper contains expected structure',
                            severity: 'low'
                        });
                    }
                }
            }
            
        } catch (error) {
            issues.push({
                type: 'warning',
                message: `Content extraction failed: ${error.message}`,
                severity: 'medium'
            });
        }
        
        return issues;
    }

    /**
     * Parse pdfinfo output into object
     */
    parsePDFInfo(stdout) {
        const metadata = {};
        const lines = stdout.split('\n');
        
        for (const line of lines) {
            const colonIndex = line.indexOf(':');
            if (colonIndex !== -1) {
                const key = line.substring(0, colonIndex).trim();
                const value = line.substring(colonIndex + 1).trim();
                metadata[key] = value;
            }
        }
        
        return metadata;
    }

    /**
     * Validate a single PDF file
     */
    async validatePDF(pdfPath) {
        const relativePath = path.relative(process.cwd(), pdfPath);
        consola.info(`Validating: ${chalk.blue(relativePath)}`);
        
        const validation = {
            file: relativePath,
            path: pdfPath,
            passed: true,
            issues: [],
            errors: [],
            warnings: [],
            info: []
        };
        
        try {
            // Run all validation checks
            const checks = [
                this.validateBasicFile(pdfPath),
                this.validatePDFStructure(pdfPath),
                this.validatePDFMetadata(pdfPath),
                this.validatePDFContent(pdfPath)
            ];
            
            const results = await Promise.all(checks);
            
            // Flatten and categorize issues
            for (const checkResults of results) {
                for (const issue of checkResults) {
                    validation.issues.push(issue);
                    
                    switch (issue.type) {
                        case 'error':
                            validation.errors.push(issue.message);
                            if (issue.severity === 'high') {
                                validation.passed = false;
                            }
                            break;
                        case 'warning':
                            validation.warnings.push(issue.message);
                            break;
                        case 'info':
                        case 'success':
                            validation.info.push(issue.message);
                            break;
                    }
                }
            }
            
            // Update results
            this.results.total++;
            if (validation.passed) {
                this.results.passed++;
                consola.success(`✓ ${relativePath}`);
            } else {
                this.results.failed++;
                consola.error(`❌ ${relativePath}`);
                
                if (this.options.verbose) {
                    validation.errors.forEach(error => 
                        consola.error(`  ${chalk.red('Error:')} ${error}`)
                    );
                }
            }
            
            if (validation.warnings.length > 0) {
                this.results.warnings += validation.warnings.length;
                
                if (this.options.verbose) {
                    validation.warnings.forEach(warning => 
                        consola.warn(`  ${chalk.yellow('Warning:')} ${warning}`)
                    );
                }
            }
            
            if (this.options.verbose && validation.info.length > 0) {
                validation.info.forEach(info => 
                    consola.info(`  ${chalk.blue('Info:')} ${info}`)
                );
            }
            
        } catch (error) {
            validation.passed = false;
            validation.errors.push(error.message);
            this.results.failed++;
            consola.error(`❌ ${relativePath}: ${error.message}`);
        }
        
        return validation;
    }

    /**
     * Generate quality report
     */
    generateReport(validations) {
        const report = {
            summary: {
                timestamp: this.getDeterministicDate().toISOString(),
                total: this.results.total,
                passed: this.results.passed,
                failed: this.results.failed,
                warnings: this.results.warnings,
                passRate: ((this.results.passed / this.results.total) * 100).toFixed(1),
                toolsAvailable: this.availableTools
            },
            validations: validations.map(v => ({
                file: v.file,
                passed: v.passed,
                errorCount: v.errors.length,
                warningCount: v.warnings.length,
                errors: v.errors,
                warnings: v.warnings,
                info: v.info
            }))
        };
        
        return report;
    }

    /**
     * Run complete PDF quality validation
     */
    async validate() {
        consola.info('Starting PDF quality validation...');
        
        await this.checkToolAvailability();
        
        const pdfs = await this.findPDFs();
        
        if (pdfs.length === 0) {
            consola.warn('No PDF files found for validation');
            return { success: true, report: null };
        }
        
        const validations = [];
        
        for (const pdf of pdfs) {
            const validation = await this.validatePDF(pdf);
            validations.push(validation);
        }
        
        // Generate report
        const report = this.generateReport(validations);
        
        if (this.options.reportFile) {
            await fs.writeFile(
                this.options.reportFile,
                JSON.stringify(report, null, 2)
            );
            consola.info(`PDF quality report saved: ${this.options.reportFile}`);
        }
        
        // Print summary
        consola.info('\n' + chalk.bold('PDF Quality Validation Summary:'));
        console.log(`  Total PDFs: ${this.results.total}`);
        console.log(`  ${chalk.green('Passed:')} ${this.results.passed}`);
        console.log(`  ${chalk.red('Failed:')} ${this.results.failed}`);
        console.log(`  ${chalk.yellow('Warnings:')} ${this.results.warnings}`);
        console.log(`  Pass rate: ${report.summary.passRate}%`);
        
        const success = this.results.failed === 0;
        
        if (success) {
            consola.success('All PDFs passed quality validation!');
        } else {
            consola.error(`${this.results.failed} PDF(s) failed quality validation`);
        }
        
        return { success, report };
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    const options = {
        verbose: args.includes('--verbose') || args.includes('-v'),
        checkTools: !args.includes('--no-tools'),
        reportFile: args.includes('--report') ? 'pdf-quality-report.json' : null
    };
    
    // Parse custom options
    const pdfDirIndex = args.indexOf('--pdf-dir');
    if (pdfDirIndex !== -1 && args[pdfDirIndex + 1]) {
        options.pdfDir = args[pdfDirIndex + 1];
    }
    
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
PDF Quality Checker

Usage: node pdf-quality-checker.js [options]

Options:
  --verbose, -v         Enable verbose output
  --report              Generate JSON quality report
  --pdf-dir <dir>       PDF directory to validate (default: test-workspace/output)
  --no-tools            Skip tool availability check
  --help, -h            Show this help message

Examples:
  node pdf-quality-checker.js --verbose --report
  node pdf-quality-checker.js --pdf-dir artifacts --no-tools
        `);
        process.exit(0);
    }
    
    try {
        const checker = new PDFQualityChecker(options);
        const result = await checker.validate();
        
        process.exit(result.success ? 0 : 1);
    } catch (error) {
        consola.error('PDF quality validation failed:', error);
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export default PDFQualityChecker;