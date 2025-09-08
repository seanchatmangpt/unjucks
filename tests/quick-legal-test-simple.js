#!/usr/bin/env node

import { PerfectTemplateEngine } from '../src/lib/template-engine-perfect.js';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

async function quickTest() {
  console.log(chalk.blue('🧪 Quick Legal Template Test (Simple Version)'));
  
  const templateEngine = new PerfectTemplateEngine({
    templatesDir: 'templates',
    autoescape: false,
    throwOnUndefined: false,
    enableCaching: false
  });

  // Test data
  const testData = {
    briefTitle: 'Test Motion',
    briefType: 'motion',
    courtName: 'Test Court',
    caseNumber: '123-456',
    plaintiff: 'Test Plaintiff',
    defendant: 'Test Defendant',
    attorney: {
      name: 'Test Attorney',
      firm: 'Test Firm',
      address: '123 Test St',
      city: 'Test City',
      state: 'TS',
      zip: '12345',
      phone: '555-0123',
      email: 'test@test.com',
      represents: 'Plaintiff'
    },
    jurisdiction: 'federal',
    pageLimit: 25,
    includeTableOfContents: true,
    includeTableOfAuthorities: true
  };

  try {
    // Check if template exists
    const templatePath = path.resolve('templates/latex/legal/brief/legal-brief-simple.tex.njk');
    console.log(`Looking for template at: ${templatePath}`);
    
    const exists = await fs.pathExists(templatePath);
    console.log(`Template exists: ${exists}`);
    
    if (!exists) {
      console.log(chalk.red('❌ Template file not found'));
      return;
    }

    // Try to render template
    console.log(chalk.yellow('🔄 Rendering template...'));
    const result = await templateEngine.renderTemplate(templatePath, testData);
    
    if (result.success) {
      console.log(chalk.green('✅ Template rendered successfully!'));
      console.log(chalk.gray(`Content length: ${result.content.length} characters`));
      
      // Validate legal formatting
      console.log(chalk.blue('🔍 Validating legal formatting...'));
      const validations = [
        {
          test: 'LaTeX document class',
          passed: result.content.includes('\\documentclass[12pt,letterpaper]{article}')
        },
        {
          test: 'Legal margins',
          passed: result.content.includes('\\usepackage[margin=1in]{geometry}')
        },
        {
          test: 'Double spacing',
          passed: result.content.includes('\\doublespacing')
        },
        {
          test: 'Bluebook citations',
          passed: result.content.includes('\\casecite') && result.content.includes('\\statutecite')
        },
        {
          test: 'Court case caption',
          passed: result.content.includes('Test Plaintiff') && result.content.includes('Test Defendant')
        },
        {
          test: 'Attorney information',
          passed: result.content.includes('Test Attorney') && result.content.includes('Test Firm')
        },
        {
          test: 'Signature block',
          passed: result.content.includes('Respectfully submitted,') && result.content.includes('\\rule{3in}{0.5pt}')
        }
      ];
      
      const passed = validations.filter(v => v.passed).length;
      const total = validations.length;
      console.log(chalk.green(`✅ Validation: ${passed}/${total} checks passed`));
      
      validations.forEach(v => {
        const icon = v.passed ? '✅' : '❌';
        const color = v.passed ? chalk.green : chalk.red;
        console.log(`  ${icon} ${color(v.test)}`);
      });
      
      // Save to test output
      await fs.ensureDir('./tests/output');
      await fs.writeFile('./tests/output/legal-brief-test.tex', result.content, 'utf-8');
      console.log(chalk.green('💾 Saved to ./tests/output/legal-brief-test.tex'));
      
      // Show preview
      console.log(chalk.blue('\n📝 Preview (first 300 chars):'));
      console.log(chalk.dim(result.content.substring(0, 300) + '...'));
      
    } else {
      console.log(chalk.red('❌ Template rendering failed:'));
      console.error(result.error);
    }

  } catch (error) {
    console.error(chalk.red('❌ Test failed:'), error);
  }
}

quickTest().catch(console.error);