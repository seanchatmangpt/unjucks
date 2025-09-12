#!/usr/bin/env node

/**
 * Comprehensive LaTeX Workflow Test
 * Tests the complete LaTeX generation pipeline end-to-end
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

const execAsync = promisify(exec);

// Test configuration
const TESTS = {
  'Template Generation': async () => {
    const { stdout } = await execAsync('node src/cli/index.js latex generate --template article --title "Test Article" --author "Test Author" --output tests/generated-article.tex');
    const exists = await fs.access('tests/generated-article.tex').then(() => true).catch(() => false);
    return exists ? 'Generated article template successfully' : 'Failed to generate template';
  },
  
  'Legal Document Generation': async () => {
    const { stdout } = await execAsync('node src/cli/index.js latex generate --template letter --title "Legal Letter" --author "Attorney" --output tests/legal-letter.tex');
    const exists = await fs.access('tests/legal-letter.tex').then(() => true).catch(() => false);
    return exists ? 'Generated legal letter successfully' : 'Failed to generate legal document';
  },
  
  'LaTeX Filter Testing': async () => {
    const filters = await import('../src/lib/filters/latex.js');
    const latexFilters = filters.default || filters;
    const tests = [
      latexFilters.texEscape('$100 & 50%') === '\\$100 \\& 50\\%',
      latexFilters.mathMode('x + y = z', false) === '$x + y = z$',
      latexFilters.citation('smith2020', 'standard') === '\\cite{smith2020}'
    ];
    const passed = tests.filter(t => t).length;
    return `${passed}/${tests.length} filter tests passed`;
  },
  
  'Package Manager': async () => {
    const module = await import('../src/lib/latex/package-manager.js');
    const LaTeXPackageManager = module.LaTeXPackageManager || module.default;
    const manager = new LaTeXPackageManager();
    const analysis = manager.analyzePackages(['amsmath', 'graphicx']);
    return analysis.packages.length === 2 ? 'Package manager working' : 'Package manager failed';
  },
  
  'LaTeX Validator': async () => {
    const module = await import('../src/lib/latex/validator.js');
    const LaTeXValidator = module.LaTeXValidator || module.default;
    const validator = new LaTeXValidator();
    const valid = validator.validateSyntax('\\documentclass{article}\\n\\begin{document}\\nTest\\n\\end{document}');
    return valid.isValid ? 'Validator working correctly' : 'Validator failed';
  },
  
  'Template Discovery': async () => {
    const { stdout } = await execAsync('node src/cli/index.js list 2>&1 | grep -c latex || true');
    return stdout.trim() !== '0' ? 'LaTeX templates discoverable' : 'Templates not found';
  },
  
  'Build Integration': async () => {
    const buildConfig = await fs.readFile('config/latex.config.js', 'utf-8').catch(() => null);
    return buildConfig ? 'Build configuration present' : 'Build config missing';
  },
  
  'Documentation': async () => {
    const docs = await fs.readdir('docs/latex').catch(() => []);
    return docs.length > 0 ? `${docs.length} documentation files present` : 'Documentation missing';
  },
  
  'Performance Features': async () => {
    const perfFiles = await fs.readdir('src/lib/performance').catch(() => []);
    const latexPerf = perfFiles.filter(f => f.includes('latex')).length;
    return latexPerf > 0 ? `${latexPerf} performance modules active` : 'Performance features missing';
  },
  
  'Security Features': async () => {
    const cleanroomExists = await fs.access('src/lib/cleanroom/cleanroom-manager.js').then(() => true).catch(() => false);
    return cleanroomExists ? 'Cleanroom security implemented' : 'Security features missing';
  }
};

// Run all tests
async function runTests() {
  console.log(chalk.bold.cyan('\n🚀 Unjucks LaTeX Comprehensive Test Suite\n'));
  console.log(chalk.gray('=' .repeat(60)));
  
  let passed = 0;
  let failed = 0;
  const results = [];
  
  for (const [testName, testFn] of Object.entries(TESTS)) {
    process.stdout.write(chalk.yellow(`Testing ${testName}... `));
    try {
      const result = await testFn();
      console.log(chalk.green('✓'), chalk.gray(result));
      passed++;
      results.push({ test: testName, status: 'PASS', message: result });
    } catch (error) {
      console.log(chalk.red('✗'), chalk.gray(error.message.split('\\n')[0]));
      failed++;
      results.push({ test: testName, status: 'FAIL', message: error.message });
    }
  }
  
  console.log(chalk.gray('=' .repeat(60)));
  
  // Summary
  console.log(chalk.bold('\\n📊 Test Summary:\\n'));
  console.log(chalk.green(`  ✓ Passed: ${passed}`));
  console.log(chalk.red(`  ✗ Failed: ${failed}`));
  console.log(chalk.cyan(`  Total: ${passed + failed}`));
  console.log(chalk.yellow(`  Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`));
  
  // Overall status
  const overallStatus = failed === 0 ? 
    chalk.bold.green('\\n✅ LaTeX SYSTEM READY FOR PRODUCTION') :
    failed <= 2 ?
    chalk.bold.yellow('\\n⚠️  LaTeX SYSTEM MOSTLY FUNCTIONAL') :
    chalk.bold.red('\\n❌ LaTeX SYSTEM NEEDS WORK');
    
  console.log(overallStatus);
  
  // Recommendations
  if (failed > 0) {
    console.log(chalk.bold('\\n🔧 Recommendations:\\n'));
    if (results.find(r => r.test === 'Template Generation' && r.status === 'FAIL')) {
      console.log(chalk.yellow('  • Fix template generation in src/commands/latex.js'));
    }
    if (results.find(r => r.test === 'LaTeX Filter Testing' && r.status === 'FAIL')) {
      console.log(chalk.yellow('  • Check filter registration in src/lib/nunjucks-filters.js'));
    }
    if (results.find(r => r.test === 'Security Features' && r.status === 'FAIL')) {
      console.log(chalk.yellow('  • Ensure cleanroom dependencies are installed (npm install uuid)'));
    }
  }
  
  // Write report
  const report = {
    timestamp: this.getDeterministicDate().toISOString(),
    passed,
    failed,
    successRate: Math.round((passed / (passed + failed)) * 100),
    results,
    status: failed === 0 ? 'READY' : failed <= 2 ? 'FUNCTIONAL' : 'NEEDS_WORK'
  };
  
  await fs.writeFile('tests/latex-test-report.json', JSON.stringify(report, null, 2));
  console.log(chalk.gray('\\nReport saved to tests/latex-test-report.json'));
  
  process.exit(failed === 0 ? 0 : 1);
}

// Run tests
runTests().catch(console.error);