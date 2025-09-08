#!/usr/bin/env node

import { PerfectTemplateEngine } from '../src/lib/template-engine-perfect.js';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

async function quickTest() {
  console.log(chalk.blue('🧪 Minimal Legal Template Test'));
  
  const templateEngine = new PerfectTemplateEngine({
    templatesDir: 'templates',
    autoescape: false,
    throwOnUndefined: false,
    enableCaching: false
  });

  const testData = {
    briefTitle: 'Test Motion',
    briefType: 'motion',
    courtName: 'Test Court',
    caseNumber: '123-456',
    attorney: {
      name: 'Test Attorney',
      firm: 'Test Firm'
    }
  };

  try {
    const templatePath = path.resolve('templates/latex/legal/brief/minimal-test.tex.njk');
    console.log(`Testing template: ${templatePath}`);
    
    const result = await templateEngine.renderTemplate(templatePath, testData);
    
    if (result.success) {
      console.log(chalk.green('✅ Minimal template works!'));
      console.log(chalk.gray(`Content: ${result.content.length} chars`));
      
      await fs.ensureDir('./tests/output');
      await fs.writeFile('./tests/output/minimal-test.tex', result.content, 'utf-8');
      
      console.log(chalk.blue('\n📝 Generated content:'));
      console.log(result.content);
      
    } else {
      console.log(chalk.red('❌ Minimal template failed:'));
      console.error(result.error);
    }

  } catch (error) {
    console.error(chalk.red('❌ Test failed:'), error);
  }
}

quickTest().catch(console.error);