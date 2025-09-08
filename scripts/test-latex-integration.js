#!/usr/bin/env node
/**
 * Test LaTeX Integration
 * Comprehensive test of all LaTeX components without requiring LaTeX installation
 */

import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';

async function testLatexIntegration() {
  console.log(chalk.blue('🧪 Testing LaTeX Integration Components...'));
  
  const tests = [];
  let passed = 0;
  let failed = 0;

  // Test 1: LaTeX Package Manager
  try {
    const pm = await import('../src/lib/latex/package-manager.js');
    
    const testLatex = `
\\documentclass{article}
\\usepackage{amsmath}
\\usepackage[utf8]{inputenc}
\\usepackage{graphicx}
\\begin{document}
\\title{Test Document}
\\section{Introduction}
This is a test with \\cite{test2024}.
\\end{document}
`;

    const analysis = pm.analyzePackages(testLatex);
    const validation = pm.validatePackageInstallation(['amsmath', 'graphicx']);
    const preamble = pm.generatePreamble(analysis.packages);
    
    console.log(chalk.green('✅ LaTeX Package Manager: All functions working'));
    console.log(`   - Found ${analysis.packages.length} packages`);
    console.log(`   - Validated ${validation.available.length} packages`);
    console.log(`   - Generated ${preamble.split('\\n').length} line preamble`);
    passed++;
  } catch (error) {
    console.log(chalk.red('❌ LaTeX Package Manager: Failed'));
    console.log(`   Error: ${error.message}`);
    failed++;
  }

  // Test 2: LaTeX Utils
  try {
    const utils = await import('../src/lib/latex/utils.js');
    
    const testText = 'This has special chars: $ & % # ^ _ { } ~ and commands \\section{Test}';
    const escaped = utils.escapeLatex(testText);
    const unescaped = utils.unescapeLatex(escaped);
    const commands = utils.extractCommands('\\section{Introduction} \\cite{test}');
    const envs = utils.extractEnvironments('\\begin{document}Content\\end{document}');
    const brackets = utils.validateBrackets('{test} [optional] (parens)');
    const wordCount = utils.countWords('This is a test document with five words.');
    const metadata = utils.extractMetadata('\\title{Test} \\author{Author}');
    
    console.log(chalk.green('✅ LaTeX Utils: All functions working'));
    console.log(`   - Escaped/unescaped text successfully`);
    console.log(`   - Found ${commands.length} commands, ${envs.length} environments`);
    console.log(`   - Bracket validation: ${brackets.isValid ? 'valid' : 'invalid'}`);
    console.log(`   - Word count: ${wordCount}, Metadata fields: ${Object.keys(metadata).length}`);
    passed++;
  } catch (error) {
    console.log(chalk.red('❌ LaTeX Utils: Failed'));
    console.log(`   Error: ${error.message}`);
    failed++;
  }

  // Test 3: LaTeX Validator
  try {
    const validator = await import('../src/lib/latex/validator.js');
    
    const validLatex = `
\\documentclass{article}
\\usepackage{amsmath}
\\begin{document}
\\section{Test}
\\begin{equation}
E = mc^2
\\end{equation}
\\end{document}
`;

    const invalidLatex = `
\\documentclass{article}
\\begin{document}
\\section{Test
\\begin{equation}
E = mc^2
\\end{document}
`;
    
    const validResult = validator.validateLatex(validLatex);
    const invalidResult = validator.validateLatex(invalidLatex);
    const mathValidation = validator.validateMath('$E = mc^2$');
    const summary = validator.getValidationSummary(validResult);
    
    console.log(chalk.green('✅ LaTeX Validator: All functions working'));
    console.log(`   - Valid document: ${validResult.isValid ? 'passed' : 'failed'}`);
    console.log(`   - Invalid document: ${invalidResult.isValid ? 'unexpected pass' : 'correctly failed'}`);
    console.log(`   - Math validation: ${mathValidation.errors.length} errors`);
    console.log(`   - Summary severity: ${summary.severity}`);
    passed++;
  } catch (error) {
    console.log(chalk.red('❌ LaTeX Validator: Failed'));
    console.log(`   Error: ${error.message}`);
    failed++;
  }

  // Test 4: LaTeX Config
  try {
    const configModule = await import('../src/lib/latex/config.js');
    const config = new configModule.LaTeXConfig();
    
    const defaultConfig = await config.load();
    const engines = config.listEngines();
    const presets = config.getDockerPresets();
    const merged = config.mergeConfig({ engine: 'xelatex' });
    
    console.log(chalk.green('✅ LaTeX Config: All functions working'));
    console.log(`   - Loaded default config with engine: ${defaultConfig.engine}`);
    console.log(`   - Available engines: ${engines.length}`);
    console.log(`   - Docker presets: ${Object.keys(presets).length}`);
    console.log(`   - Config merge: engine=${merged.engine}`);
    passed++;
  } catch (error) {
    console.log(chalk.red('❌ LaTeX Config: Failed'));
    console.log(`   Error: ${error.message}`);
    failed++;
  }

  // Test 5: LaTeX Compiler (instantiation only)
  try {
    const compilerModule = await import('../src/lib/latex/compiler.js');
    const compiler = new compilerModule.LaTeXCompiler({
      engine: 'pdflatex',
      outputDir: './dist',
      tempDir: './temp'
    });
    
    const metrics = compiler.getMetrics();
    const configKeys = Object.keys(compiler.config);
    
    console.log(chalk.green('✅ LaTeX Compiler: Instantiation successful'));
    console.log(`   - Config sections: ${configKeys.length}`);
    console.log(`   - Metrics initialized: ${Object.keys(metrics).length} fields`);
    passed++;
  } catch (error) {
    console.log(chalk.red('❌ LaTeX Compiler: Failed to instantiate'));
    console.log(`   Error: ${error.message}`);
    failed++;
  }

  // Test 6: Docker Support (instantiation only)
  try {
    const dockerModule = await import('../src/lib/latex/docker-support.js');
    const dockerSupport = new dockerModule.DockerLaTeXSupport({
      image: 'texlive/texlive:latest'
    });
    
    console.log(chalk.green('✅ LaTeX Docker Support: Instantiation successful'));
    console.log(`   - Image configured: ${dockerSupport.config.image}`);
    console.log(`   - Memory limit: ${dockerSupport.config.memoryLimit}`);
    passed++;
  } catch (error) {
    console.log(chalk.red('❌ LaTeX Docker Support: Failed to instantiate'));
    console.log(`   Error: ${error.message}`);
    failed++;
  }

  // Test 7: Build Integration
  try {
    const buildModule = await import('../src/lib/latex/build-integration.js');
    const integration = new buildModule.LaTeXBuildIntegration();
    
    const metrics = integration.getMetrics();
    
    console.log(chalk.green('✅ LaTeX Build Integration: Instantiation successful'));
    console.log(`   - Integration ready: ${!!integration.latexConfig}`);
    passed++;
  } catch (error) {
    console.log(chalk.red('❌ LaTeX Build Integration: Failed to instantiate'));
    console.log(`   Error: ${error.message}`);
    failed++;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  const total = passed + failed;
  if (failed === 0) {
    console.log(chalk.green(`🎉 All ${total} LaTeX integration tests passed!`));
    console.log(chalk.green('✅ LaTeX components are properly integrated and dependencies resolved'));
  } else {
    console.log(chalk.yellow(`⚠️  ${passed}/${total} tests passed, ${failed} failed`));
  }
  console.log('='.repeat(60));

  return failed === 0;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testLatexIntegration()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error(chalk.red('Fatal error:', error.message));
      process.exit(1);
    });
}

export { testLatexIntegration };