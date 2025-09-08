#!/usr/bin/env node

import { PerfectTemplateEngine } from '../src/lib/template-engine-perfect.js';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

async function quickTest() {
  console.log(chalk.blue('🧪 Quick Legal Template Test'));
  
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
    const templatePath = path.resolve('templates/latex/legal/brief/legal-brief.tex.njk');
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
      
      // Save to test output
      await fs.ensureDir('./tests/output');
      await fs.writeFile('./tests/output/quick-test-brief.tex', result.content, 'utf-8');
      console.log(chalk.green('💾 Saved to ./tests/output/quick-test-brief.tex'));
      
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