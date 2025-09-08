import fs from 'fs-extra';
import path from 'path';
import { PerfectTemplateEngine } from '../../src/lib/template-engine-perfect.js';
import matter from 'gray-matter';
import chalk from 'chalk';

/**
 * Legal Document Test Helper
 * Provides utilities for testing legal document generation
 */
export class LegalTestHelper {
  constructor() {
    this.templateEngine = new PerfectTemplateEngine({
      templatesDir: 'templates',
      autoescape: false,
      throwOnUndefined: false,
      enableCaching: false
    });
    
    this.outputDir = './tests/output/legal';
  }

  /**
   * Sample legal brief data for testing
   */
  getSampleLegalBriefData() {
    return {
      briefTitle: 'Motion for Summary Judgment',
      briefType: 'motion',
      courtName: 'United States District Court for the Northern District of California',
      caseNumber: '3:23-cv-12345-ABC',
      plaintiff: 'ACME Corporation',
      defendant: 'Beta Industries, Inc.',
      attorney: {
        name: 'Jane Smith',
        barNumber: 'CA Bar No. 123456',
        firm: 'Smith & Associates LLP',
        address: '123 Legal Street',
        city: 'San Francisco',
        state: 'CA',
        zip: '94105',
        phone: '(415) 555-0123',
        email: 'jane.smith@smithlaw.com',
        represents: 'Plaintiff'
      },
      jurisdiction: 'federal',
      pageLimit: 25,
      includeTableOfContents: true,
      includeTableOfAuthorities: true,
      includeCertificateOfService: true,
      briefingSchedule: {
        dueDate: 'March 15, 2024'
      },
      serviceDate: 'March 1, 2024',
      serviceLocation: 'San Francisco, California',
      documentType: 'Motion for Summary Judgment',
      serviceList: [
        {
          name: 'John Doe',
          firm: 'Doe Defense LLC',
          address: '456 Defense Ave',
          city: 'San Francisco',
          state: 'CA',
          zip: '94102',
          email: 'john.doe@doedefense.com',
          method: 'ecf'
        },
        {
          name: 'Mary Johnson',
          firm: 'Johnson Law Group',
          address: '789 Law Blvd',
          city: 'Oakland',
          state: 'CA',
          zip: '94607',
          email: 'mary@johnsonlaw.com',
          method: 'email'
        }
      ],
      introduction: 'This motion for summary judgment demonstrates that no genuine issue of material fact exists and that Plaintiff is entitled to judgment as a matter of law.',
      statementOfFacts: 'The undisputed facts establish that Defendant breached the contract dated January 1, 2023, by failing to deliver goods as specified.',
      legalStandard: 'Summary judgment is appropriate when there is no genuine dispute as to any material fact and the movant is entitled to judgment as a matter of law. Fed. R. Civ. P. 56(a).',
      argumentHeading1: 'Defendant Materially Breached the Contract',
      argument1: 'The evidence clearly shows that Defendant failed to perform its contractual obligations by not delivering conforming goods within the specified timeframe.',
      subargument1_1: 'The Contract Required Delivery by February 1, 2023',
      subargument1_1_text: 'The contract unambiguously states that delivery must occur by February 1, 2023. (Exhibit A § 3.1.)',
      subargument1_2: 'Defendant Failed to Meet the Delivery Deadline',
      subargument1_2_text: 'The record establishes that Defendant did not deliver any goods until February 15, 2023, two weeks after the contractual deadline.',
      argumentHeading2: 'Plaintiff Suffered Damages as a Result of the Breach',
      argument2: 'Plaintiff incurred substantial damages directly resulting from Defendant\'s breach, including lost profits and cover costs.',
      subargument2_1: 'Lost Profits Are Recoverable Under California Law',
      subargument2_1_text: 'California Commercial Code § 2712 permits recovery of consequential damages, including lost profits, that were reasonably foreseeable at the time of contract formation.',
      subargument2_2: 'The Amount of Damages Is Undisputed',
      subargument2_2_text: 'Plaintiff\'s expert testimony, which Defendant has not challenged, establishes damages in the amount of $500,000.',
      conclusion: 'For the foregoing reasons, this Court should grant Plaintiff\'s Motion for Summary Judgment and award damages in the amount of $500,000, plus costs and reasonable attorneys\' fees.'
    };
  }

  /**
   * Generate a complete legal brief and save to file
   */
  async generateLegalBrief(data = null, outputFileName = 'test-legal-brief.tex') {
    const briefData = data || this.getSampleLegalBriefData();
    const templatePath = 'latex/legal/brief/legal-brief.tex.njk';
    
    try {
      console.log(chalk.blue('📄 Generating legal brief...'));
      
      // Ensure output directory exists
      await fs.ensureDir(this.outputDir);
      
      // Generate the document
      const result = await this.templateEngine.renderTemplate(templatePath, briefData);
      
      // Save to file
      const outputPath = path.join(this.outputDir, outputFileName);
      await fs.writeFile(outputPath, result, 'utf-8');
      
      console.log(chalk.green(`✅ Legal brief generated: ${outputPath}`));
      
      return {
        success: true,
        outputPath,
        content: result,
        size: result.length
      };
    } catch (error) {
      console.error(chalk.red('❌ Error generating legal brief:'), error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate legal document formatting
   */
  validateLegalFormatting(content) {
    const validations = [];
    
    // Check LaTeX document structure
    validations.push({
      test: 'LaTeX document class',
      passed: content.includes('\\documentclass[12pt,letterpaper]{article}'),
      required: true
    });
    
    // Check margins
    validations.push({
      test: 'Legal margins (1 inch)',
      passed: content.includes('\\usepackage[margin=1in]{geometry}'),
      required: true
    });
    
    // Check double spacing
    validations.push({
      test: 'Double spacing',
      passed: content.includes('\\doublespacing'),
      required: true
    });
    
    // Check page formatting
    validations.push({
      test: 'Page headers/footers',
      passed: content.includes('\\fancyhdr') && content.includes('\\fancyfoot[C]{\\thepage}'),
      required: true
    });
    
    // Check citation support
    validations.push({
      test: 'Bluebook citations',
      passed: content.includes('\\casecite') && content.includes('\\statutecite'),
      required: true
    });
    
    // Check signature block
    validations.push({
      test: 'Signature block',
      passed: content.includes('Respectfully submitted,') && content.includes('\\rule{3in}{0.5pt}'),
      required: true
    });
    
    return validations;
  }

  /**
   * Test certificate of service generation
   */
  async testCertificateOfService() {
    const serviceData = this.getSampleLegalBriefData();
    const templatePath = 'latex/legal/components/certificate-of-service.tex';
    
    try {
      const result = await this.templateEngine.renderTemplate(templatePath, serviceData);
      
      const validations = [
        {
          test: 'Certificate of Service header',
          passed: result.includes('CERTIFICATE OF SERVICE')
        },
        {
          test: 'Service method checkboxes',
          passed: result.includes('$\\square$')
        },
        {
          test: 'Penalty of perjury clause',
          passed: result.includes('declare under penalty of perjury')
        },
        {
          test: 'Attorney signature block',
          passed: result.includes('\\rule{3in}{0.5pt}')
        }
      ];
      
      return {
        success: true,
        content: result,
        validations
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Test Bluebook citation formatting
   */
  async testBluebookCitations() {
    const componentsPath = 'latex/legal/components/bluebook-citations.tex';
    
    try {
      const content = await fs.readFile(path.resolve('templates', componentsPath), 'utf-8');
      
      const citationTests = [
        {
          test: 'Case citations',
          passed: content.includes('\\newcommand{\\casecite}')
        },
        {
          test: 'Statute citations',
          passed: content.includes('\\newcommand{\\statutecite}')
        },
        {
          test: 'Constitutional citations',
          passed: content.includes('\\newcommand{\\constitution}')
        },
        {
          test: 'Federal Rules citations',
          passed: content.includes('\\newcommand{\\frcp}') && content.includes('\\newcommand{\\fre}')
        },
        {
          test: 'Signal words',
          passed: content.includes('\\newcommand{\\see}') && content.includes('\\newcommand{\\cf}')
        },
        {
          test: 'Id. and Supra citations',
          passed: content.includes('\\newcommand{\\id}') && content.includes('\\newcommand{\\supra}')
        }
      ];
      
      return {
        success: true,
        validations: citationTests
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Comprehensive legal document workflow test
   */
  async runComprehensiveTest() {
    console.log(chalk.blue.bold('🏛️  Legal Document Generation Test Suite'));
    console.log(chalk.gray('Testing complete legal document workflow...\n'));
    
    const results = {
      briefGeneration: null,
      certificateOfService: null,
      bluebookCitations: null,
      formatValidation: null
    };

    // Test 1: Generate legal brief
    console.log(chalk.yellow('1. Testing legal brief generation...'));
    results.briefGeneration = await this.generateLegalBrief();
    
    if (results.briefGeneration.success) {
      console.log(chalk.green(`   ✅ Brief generated (${results.briefGeneration.size} characters)`));
      
      // Test 2: Validate formatting
      console.log(chalk.yellow('2. Validating legal formatting...'));
      const validations = this.validateLegalFormatting(results.briefGeneration.content);
      results.formatValidation = validations;
      
      const passed = validations.filter(v => v.passed).length;
      const total = validations.length;
      console.log(chalk.green(`   ✅ Format validation: ${passed}/${total} checks passed`));
      
      validations.forEach(v => {
        const icon = v.passed ? '✅' : '❌';
        const color = v.passed ? chalk.green : chalk.red;
        console.log(`     ${icon} ${color(v.test)}`);
      });
    } else {
      console.log(chalk.red(`   ❌ Brief generation failed: ${results.briefGeneration.error}`));
    }

    // Test 3: Certificate of Service
    console.log(chalk.yellow('3. Testing certificate of service...'));
    results.certificateOfService = await this.testCertificateOfService();
    
    if (results.certificateOfService.success) {
      const passed = results.certificateOfService.validations.filter(v => v.passed).length;
      const total = results.certificateOfService.validations.length;
      console.log(chalk.green(`   ✅ Certificate validation: ${passed}/${total} checks passed`));
    } else {
      console.log(chalk.red(`   ❌ Certificate test failed: ${results.certificateOfService.error}`));
    }

    // Test 4: Bluebook Citations
    console.log(chalk.yellow('4. Testing Bluebook citations...'));
    results.bluebookCitations = await this.testBluebookCitations();
    
    if (results.bluebookCitations.success) {
      const passed = results.bluebookCitations.validations.filter(v => v.passed).length;
      const total = results.bluebookCitations.validations.length;
      console.log(chalk.green(`   ✅ Citation validation: ${passed}/${total} checks passed`));
    } else {
      console.log(chalk.red(`   ❌ Citation test failed: ${results.bluebookCitations.error}`));
    }

    // Summary
    console.log(chalk.blue.bold('\n📊 Test Summary:'));
    const overallSuccess = results.briefGeneration?.success && 
                          results.certificateOfService?.success && 
                          results.bluebookCitations?.success;
    
    if (overallSuccess) {
      console.log(chalk.green('🎉 All legal document tests passed!'));
    } else {
      console.log(chalk.red('⚠️  Some tests failed. Review results above.'));
    }

    return results;
  }
}

// Export for use in other test files
export default LegalTestHelper;