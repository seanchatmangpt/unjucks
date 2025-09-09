#!/usr/bin/env node

/**
 * LaTeX Template Validator
 * Comprehensive validation for LaTeX templates in unjucks project
 */

import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';
import nunjucks from 'nunjucks';
import consola from 'consola';
import chalk from 'chalk';

class LaTeXTemplateValidator {
    constructor(options = {}) {
        this.options = {
            templateDir: options.templateDir || 'templates/latex',
            verbose: options.verbose || false,
            outputDir: options.outputDir || 'temp/validation',
            ...options
        };
        
        this.results = {
            total: 0,
            passed: 0,
            failed: 0,
            warnings: 0,
            errors: []
        };
        
        // Configure nunjucks environment
        this.nunjucks = new nunjucks.Environment(
            new nunjucks.FileSystemLoader('templates', {
                throwOnUndefined: false,
                trimBlocks: true,
                lstripBlocks: true
            })
        );
    }

    /**
     * Find all LaTeX template files
     */
    async findTemplates() {
        const pattern = path.join(this.options.templateDir, '**/*.tex.njk');
        const templates = await glob(pattern);
        
        consola.info(`Found ${templates.length} LaTeX templates`);
        return templates;
    }

    /**
     * Generate test data for template rendering
     */
    generateTestData(templatePath) {
        const baseData = {
            title: 'Test Document Title',
            author: 'Test Author',
            date: new Date().toLocaleDateString(),
            content: 'This is test content for template validation.',
            email: 'test@example.com'
        };

        // Template-specific test data
        if (templatePath.includes('legal/brief')) {
            return {
                ...baseData,
                plaintiffName: 'Test Plaintiff Corporation',
                defendantName: 'Test Defendant LLC',
                caseNumber: '2024-CV-12345',
                courtName: 'Superior Court of Test County',
                attorney: 'Test Attorney',
                attorneyBar: 'Bar #12345',
                attorneyFirm: 'Test Law Firm LLP',
                attorneyAddress: '123 Legal Street, Law City, LC 12345',
                attorneyPhone: '(555) 123-4567',
                caption: 'Test Caption for Legal Brief',
                content: 'This legal brief demonstrates the template validation system for comprehensive LaTeX document generation.',
                reliefSought: 'Plaintiff seeks validation of template system and compliance with legal formatting requirements.',
                signature: true,
                exhibits: ['Exhibit A: Template Specification', 'Exhibit B: Validation Results']
            };
        }

        if (templatePath.includes('legal/contract')) {
            return {
                ...baseData,
                contractTitle: 'Software Development Services Agreement',
                partyA: 'Technology Solutions Inc.',
                partyAAddress: '123 Tech Street, Silicon Valley, CA 94000',
                partyB: 'Development Contractor LLC',
                partyBAddress: '456 Code Avenue, Dev City, DC 12345',
                effectiveDate: '2024-01-01',
                terms: 'Complete development of software solutions according to specifications and requirements outlined in Exhibit A.',
                compensation: '$100,000 upon completion',
                duration: '6 months from effective date',
                terminationClause: 'Either party may terminate with 30 days written notice.',
                governingLaw: 'State of California',
                signatures: true,
                witnesses: true
            };
        }

        if (templatePath.includes('arxiv/paper') || templatePath.includes('academic')) {
            return {
                ...baseData,
                title: 'Automated LaTeX Template Validation in Modern Document Generation Systems',
                author: 'Research Validation Team',
                institution: 'Test Research Institute',
                department: 'Computer Science Department',
                abstract: 'This paper presents a comprehensive framework for validating LaTeX templates in automated document generation systems. We demonstrate novel approaches to ensuring template reliability and output quality across multiple compilation engines.',
                keywords: 'LaTeX, template validation, document generation, automation, quality assurance',
                content: `
\\section{Introduction}
This document demonstrates the template validation system for academic papers and research publications.

\\section{Methodology}
Our validation approach encompasses multiple dimensions of template quality including syntax validation, compilation testing, and output verification.

\\subsection{Template Analysis}
We analyze templates for structural integrity and LaTeX compliance.

\\subsection{Multi-Engine Testing}
Templates are tested across pdflatex, xelatex, and lualatex engines.

\\section{Results}
The validation framework successfully identifies template issues and ensures reliable document generation.

\\section{Conclusion}
Comprehensive template validation is essential for robust document generation systems.
                `,
                bibliography: true,
                appendix: true,
                acknowledgments: 'We thank the open source community for their contributions to LaTeX template development.'
            };
        }

        if (templatePath.includes('arxiv/preprint')) {
            return {
                ...baseData,
                title: 'Novel Approaches to LaTeX Template Automation and Validation',
                author: 'Preprint Validation Team',
                abstract: 'This preprint demonstrates advanced techniques for automated LaTeX template validation and quality assurance in document generation pipelines.',
                keywords: 'preprint, LaTeX, automation, validation, document generation',
                arxivId: 'cs.SE/2024.001',
                subjects: 'Computer Science - Software Engineering',
                content: 'This preprint validates the template system for academic preprint generation.'
            };
        }

        return baseData;
    }

    /**
     * Validate template syntax and structure
     */
    async validateTemplateSyntax(templatePath) {
        const issues = [];
        const content = await fs.readFile(templatePath, 'utf8');

        // Check for common LaTeX syntax issues
        const checks = [
            {
                pattern: /\\documentclass/,
                required: true,
                message: 'Missing \\documentclass declaration'
            },
            {
                pattern: /\\begin{document}/,
                required: true,
                message: 'Missing \\begin{document}'
            },
            {
                pattern: /\\end{document}/,
                required: true,
                message: 'Missing \\end{document}'
            },
            {
                pattern: /\{\{\s*\w+\s*\}\}/,
                required: true,
                message: 'No template variables found (may not be a dynamic template)'
            },
            {
                pattern: /\\[a-zA-Z]+\{[^}]*\{[^}]*\}[^}]*\}/,
                required: false,
                message: 'Potentially nested braces that could cause issues'
            }
        ];

        for (const check of checks) {
            const found = check.pattern.test(content);
            
            if (check.required && !found) {
                issues.push({
                    type: 'error',
                    message: check.message,
                    severity: 'high'
                });
            } else if (!check.required && found) {
                issues.push({
                    type: 'warning',
                    message: check.message,
                    severity: 'medium'
                });
            }
        }

        // Check for balanced braces
        const openBraces = (content.match(/\{/g) || []).length;
        const closeBraces = (content.match(/\}/g) || []).length;
        
        if (openBraces !== closeBraces) {
            issues.push({
                type: 'error',
                message: `Unbalanced braces: ${openBraces} open, ${closeBraces} close`,
                severity: 'high'
            });
        }

        // Check for potentially dangerous commands
        const dangerousCommands = [
            '\\write18',
            '\\immediate\\write18',
            '\\input{|',
            '\\openin',
            '\\openout'
        ];

        for (const cmd of dangerousCommands) {
            if (content.includes(cmd)) {
                issues.push({
                    type: 'warning',
                    message: `Potentially dangerous command: ${cmd}`,
                    severity: 'high'
                });
            }
        }

        return issues;
    }

    /**
     * Test template rendering with nunjucks
     */
    async testTemplateRendering(templatePath) {
        try {
            const relativePath = path.relative('templates', templatePath);
            const testData = this.generateTestData(templatePath);
            
            const rendered = this.nunjucks.render(relativePath, testData);
            
            // Verify rendered content
            if (!rendered || rendered.length < 100) {
                throw new Error('Rendered template is too short or empty');
            }

            // Check for unresolved template variables
            const unresolvedVars = rendered.match(/\{\{\s*\w+\s*\}\}/g);
            if (unresolvedVars) {
                throw new Error(`Unresolved template variables: ${unresolvedVars.join(', ')}`);
            }

            return {
                success: true,
                rendered,
                size: rendered.length
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                rendered: null
            };
        }
    }

    /**
     * Validate a single template
     */
    async validateTemplate(templatePath) {
        const templateName = path.relative(this.options.templateDir, templatePath);
        consola.info(`Validating: ${chalk.blue(templateName)}`);

        const validation = {
            template: templateName,
            path: templatePath,
            syntaxIssues: [],
            renderingResult: null,
            passed: false,
            errors: [],
            warnings: []
        };

        try {
            // Syntax validation
            validation.syntaxIssues = await this.validateTemplateSyntax(templatePath);
            
            // Rendering test
            validation.renderingResult = await this.testTemplateRendering(templatePath);

            // Determine if validation passed
            const criticalErrors = validation.syntaxIssues.filter(issue => 
                issue.type === 'error' && issue.severity === 'high'
            );

            validation.passed = criticalErrors.length === 0 && validation.renderingResult.success;
            
            // Collect errors and warnings
            validation.errors = validation.syntaxIssues
                .filter(issue => issue.type === 'error')
                .map(issue => issue.message);
            
            validation.warnings = validation.syntaxIssues
                .filter(issue => issue.type === 'warning')
                .map(issue => issue.message);

            if (!validation.renderingResult.success) {
                validation.errors.push(`Rendering failed: ${validation.renderingResult.error}`);
            }

            // Update results
            this.results.total++;
            if (validation.passed) {
                this.results.passed++;
                consola.success(`✓ ${templateName}`);
            } else {
                this.results.failed++;
                consola.error(`❌ ${templateName}`);
                
                if (this.options.verbose) {
                    validation.errors.forEach(error => 
                        consola.error(`  ${chalk.red('Error:')} ${error}`)
                    );
                    validation.warnings.forEach(warning => 
                        consola.warn(`  ${chalk.yellow('Warning:')} ${warning}`)
                    );
                }
            }

            if (validation.warnings.length > 0) {
                this.results.warnings += validation.warnings.length;
            }

        } catch (error) {
            validation.passed = false;
            validation.errors.push(error.message);
            this.results.failed++;
            consola.error(`❌ ${templateName}: ${error.message}`);
        }

        return validation;
    }

    /**
     * Save rendered templates for manual inspection
     */
    async saveRenderedTemplates(validations) {
        await fs.mkdir(this.options.outputDir, { recursive: true });

        for (const validation of validations) {
            if (validation.renderingResult && validation.renderingResult.success) {
                const outputFile = path.join(
                    this.options.outputDir,
                    validation.template.replace('.njk', '')
                );
                
                await fs.mkdir(path.dirname(outputFile), { recursive: true });
                await fs.writeFile(outputFile, validation.renderingResult.rendered);
                
                if (this.options.verbose) {
                    consola.info(`Saved rendered template: ${outputFile}`);
                }
            }
        }
    }

    /**
     * Generate validation report
     */
    generateReport(validations) {
        const report = {
            summary: {
                timestamp: new Date().toISOString(),
                total: this.results.total,
                passed: this.results.passed,
                failed: this.results.failed,
                warnings: this.results.warnings,
                passRate: ((this.results.passed / this.results.total) * 100).toFixed(1)
            },
            validations: validations.map(v => ({
                template: v.template,
                passed: v.passed,
                errorCount: v.errors.length,
                warningCount: v.warnings.length,
                errors: v.errors,
                warnings: v.warnings
            }))
        };

        return report;
    }

    /**
     * Run complete validation suite
     */
    async validate() {
        consola.info('Starting LaTeX template validation...');

        const templates = await this.findTemplates();
        
        if (templates.length === 0) {
            consola.warn('No LaTeX templates found');
            return { success: true, report: null };
        }

        const validations = [];
        
        for (const template of templates) {
            const validation = await this.validateTemplate(template);
            validations.push(validation);
        }

        // Save rendered templates if requested
        if (this.options.saveRendered) {
            await this.saveRenderedTemplates(validations);
        }

        // Generate and save report
        const report = this.generateReport(validations);
        
        if (this.options.reportFile) {
            await fs.writeFile(
                this.options.reportFile,
                JSON.stringify(report, null, 2)
            );
            consola.info(`Validation report saved: ${this.options.reportFile}`);
        }

        // Print summary
        consola.info('\n' + chalk.bold('Validation Summary:'));
        console.log(`  Total templates: ${this.results.total}`);
        console.log(`  ${chalk.green('Passed:')} ${this.results.passed}`);
        console.log(`  ${chalk.red('Failed:')} ${this.results.failed}`);
        console.log(`  ${chalk.yellow('Warnings:')} ${this.results.warnings}`);
        console.log(`  Pass rate: ${report.summary.passRate}%`);

        const success = this.results.failed === 0;
        
        if (success) {
            consola.success('All LaTeX templates validated successfully!');
        } else {
            consola.error(`${this.results.failed} template(s) failed validation`);
        }

        return { success, report };
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    const options = {
        verbose: args.includes('--verbose') || args.includes('-v'),
        saveRendered: args.includes('--save-rendered'),
        reportFile: args.includes('--report') ? 'validation-report.json' : null
    };

    // Parse custom options
    const templateDirIndex = args.indexOf('--template-dir');
    if (templateDirIndex !== -1 && args[templateDirIndex + 1]) {
        options.templateDir = args[templateDirIndex + 1];
    }

    const outputDirIndex = args.indexOf('--output-dir');
    if (outputDirIndex !== -1 && args[outputDirIndex + 1]) {
        options.outputDir = args[outputDirIndex + 1];
    }

    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
LaTeX Template Validator

Usage: node latex-template-validator.js [options]

Options:
  --verbose, -v          Enable verbose output
  --save-rendered        Save rendered templates to output directory
  --report              Generate JSON validation report
  --template-dir <dir>   Template directory (default: templates/latex)
  --output-dir <dir>     Output directory (default: temp/validation)
  --help, -h            Show this help message

Examples:
  node latex-template-validator.js --verbose --report
  node latex-template-validator.js --template-dir custom/templates --save-rendered
        `);
        process.exit(0);
    }

    try {
        const validator = new LaTeXTemplateValidator(options);
        const result = await validator.validate();
        
        process.exit(result.success ? 0 : 1);
    } catch (error) {
        consola.error('Validation failed:', error);
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export default LaTeXTemplateValidator;