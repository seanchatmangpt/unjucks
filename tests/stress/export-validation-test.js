/**
 * Export System Validation Test
 * Tests to determine what export functionality actually works
 */
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { exportCommand } from '../../src/commands/export.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDir = path.join(__dirname, '../temp/validation-export');

// Create test class to access ExportEngine functionality
class ExportTester {
  constructor() {
    this.results = {};
  }

  async testExportFunction(inputFile, format, options = {}) {
    try {
      const context = {
        args: {
          input: inputFile,
          format: format,
          output: options.output,
          ...options
        }
      };
      
      const result = await exportCommand.run(context);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async runValidationTests() {
    await fs.ensureDir(testDir);
    
    // Create test markdown file
    const testMdContent = `---
title: Export Validation Test
author: Export System Tester
date: 2025-09-08
---

# Export Validation Test

This document tests various export formats to determine what actually works.

## Features Test

- **Bold text**
- *Italic text*
- \`inline code\`
- [Link](https://example.com)

## Code Block

\`\`\`javascript
function testFunction() {
  console.log("Testing export functionality");
  return "Export test";
}
\`\`\`

## Table

| Format | Status | Notes |
|--------|--------|-------|
| PDF    | ?      | Testing |
| DOCX   | ?      | Testing |
| HTML   | ?      | Testing |

## Conclusion

This document will help determine which export formats actually work.
`;

    const inputFile = path.join(testDir, 'validation-test.md');
    await fs.writeFile(inputFile, testMdContent);

    console.log('🧪 Export System Validation Tests Starting...\n');

    // Test 1: Basic export formats
    const formats = ['pdf', 'docx', 'html', 'md', 'txt', 'rtf', 'tex'];
    
    for (const format of formats) {
      const outputFile = path.join(testDir, `test.${format}`);
      console.log(`Testing ${format.toUpperCase()} export...`);
      
      const startTime = Date.now();
      const result = await this.testExportFunction(inputFile, format, { output: outputFile });
      const duration = Date.now() - startTime;
      
      const status = result.success ? '✅ SUCCESS' : '❌ FAILED';
      console.log(`  ${status} (${duration}ms)`);
      
      if (!result.success && result.error) {
        console.log(`  Error: ${result.error}`);
      }
      
      if (result.success && result.outputPath) {
        try {
          const outputExists = await fs.pathExists(result.outputPath);
          if (outputExists) {
            const stats = await fs.stat(result.outputPath);
            console.log(`  Output size: ${stats.size} bytes`);
          } else {
            console.log(`  ⚠️  Output file not found at: ${result.outputPath}`);
          }
        } catch (e) {
          console.log(`  ⚠️  Could not verify output file: ${e.message}`);
        }
      }
      
      this.results[format] = {
        success: result.success,
        error: result.error,
        duration,
        outputExists: result.success && result.outputPath ? await fs.pathExists(result.outputPath) : false
      };
      
      console.log('');
    }

    // Test 2: Template functionality
    console.log('Testing template functionality...');
    
    const htmlTemplates = ['modern', 'classic', 'minimal'];
    for (const template of htmlTemplates) {
      const outputFile = path.join(testDir, `template-${template}.html`);
      console.log(`  Testing HTML template: ${template}`);
      
      const result = await this.testExportFunction(inputFile, 'html', { 
        output: outputFile, 
        template 
      });
      
      const status = result.success ? '✅' : '❌';
      console.log(`    ${status} ${template} template`);
    }
    console.log('');

    // Test 3: Preset functionality
    console.log('Testing preset functionality...');
    
    try {
      const presetsResult = await exportCommand.subCommands.presets.run({ args: {} });
      if (presetsResult.success && presetsResult.presets) {
        console.log(`  ✅ Found ${presetsResult.presets.length} presets:`);
        presetsResult.presets.forEach(preset => {
          console.log(`    - ${preset.name}: ${preset.format} (${preset.template})`);
        });
      } else {
        console.log('  ❌ Could not load presets');
      }
    } catch (error) {
      console.log(`  ❌ Preset test error: ${error.message}`);
    }
    console.log('');

    // Test 4: CLI Integration
    console.log('Testing CLI integration...');
    
    const cliTests = [
      'Command structure exists',
      'Subcommands are defined',
      'Help functionality works',
      'Arguments are properly defined'
    ];

    try {
      // Test command structure
      const hasStructure = exportCommand && exportCommand.meta && exportCommand.run;
      console.log(`  ${hasStructure ? '✅' : '❌'} Command structure exists`);

      // Test subcommands
      const subCommands = exportCommand.subCommands || {};
      const expectedSubs = ['pdf', 'docx', 'html', 'convert', 'templates', 'presets'];
      const hasSubs = expectedSubs.every(sub => subCommands[sub]);
      console.log(`  ${hasSubs ? '✅' : '❌'} Subcommands are defined`);

      // Test help
      const helpResult = await exportCommand.run({ args: {} });
      const helpWorks = helpResult && helpResult.success && helpResult.help;
      console.log(`  ${helpWorks ? '✅' : '❌'} Help functionality works`);

      // Test arguments
      const hasArgs = exportCommand.args && Object.keys(exportCommand.args).length > 0;
      console.log(`  ${hasArgs ? '✅' : '❌'} Arguments are properly defined`);

    } catch (error) {
      console.log(`  ❌ CLI integration error: ${error.message}`);
    }
    console.log('');

    // Test 5: Dependency check
    console.log('Testing dependencies...');
    
    const dependencies = [
      'puppeteer-core',
      'pdfkit', 
      'docx',
      'officegen',
      'nunjucks',
      'gray-matter',
      'chalk',
      'fs-extra'
    ];

    for (const dep of dependencies) {
      try {
        await import(dep);
        console.log(`  ✅ ${dep} available`);
      } catch (error) {
        console.log(`  ❌ ${dep} not available: ${error.message}`);
      }
    }
    console.log('');

    // Test 6: XSS vulnerability check
    console.log('Testing XSS handling...');
    
    const xssContent = `# XSS Test

<script>alert('XSS')</script>

<img src="x" onerror="alert('XSS')">

Normal content.
`;

    const xssFile = path.join(testDir, 'xss-test.md');
    const xssOutput = path.join(testDir, 'xss-test.html');
    
    await fs.writeFile(xssFile, xssContent);
    
    const xssResult = await this.testExportFunction(xssFile, 'html', { output: xssOutput });
    
    if (xssResult.success) {
      try {
        const htmlContent = await fs.readFile(xssOutput, 'utf8');
        const hasRawScript = htmlContent.includes('<script>alert(') && !htmlContent.includes('&lt;script&gt;');
        const hasRawOnerror = htmlContent.includes('onerror="alert') && !htmlContent.includes('onerror=&quot;');
        
        console.log(`  ${hasRawScript ? '⚠️  VULNERABILITY' : '✅'} Script tag handling`);
        console.log(`  ${hasRawOnerror ? '⚠️  VULNERABILITY' : '✅'} Event handler sanitization`);
        
        if (hasRawScript || hasRawOnerror) {
          console.log('  ⚠️  SECURITY WARNING: XSS vulnerabilities detected in HTML export!');
        }
      } catch (error) {
        console.log(`  ❌ Could not analyze XSS test: ${error.message}`);
      }
    } else {
      console.log('  ❌ XSS test failed to run');
    }
    console.log('');

    // Test 7: Large file handling
    console.log('Testing large file handling...');
    
    const largeContent = `# Large File Test

${'This line is repeated many times to test large file handling.\n'.repeat(1000)}

## Large Table

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
${Array.from({ length: 100 }, (_, i) => `| Row ${i} Cell 1 | Row ${i} Cell 2 | Row ${i} Cell 3 |`).join('\n')}
`;

    const largeFile = path.join(testDir, 'large-test.md');
    const largeOutput = path.join(testDir, 'large-test.html');
    
    await fs.writeFile(largeFile, largeContent);
    
    const largeStartTime = Date.now();
    const largeResult = await this.testExportFunction(largeFile, 'html', { output: largeOutput });
    const largeDuration = Date.now() - largeStartTime;
    
    console.log(`  ${largeResult.success ? '✅' : '❌'} Large file export (${largeDuration}ms)`);
    console.log('');

    this.printSummary();
  }

  printSummary() {
    console.log('📊 EXPORT SYSTEM VALIDATION SUMMARY');
    console.log('=====================================\n');

    const workingFormats = Object.entries(this.results)
      .filter(([format, result]) => result.success && result.outputExists)
      .map(([format]) => format);

    const failedFormats = Object.entries(this.results)
      .filter(([format, result]) => !result.success)
      .map(([format, result]) => ({ format, error: result.error }));

    const partialFormats = Object.entries(this.results)
      .filter(([format, result]) => result.success && !result.outputExists)
      .map(([format]) => format);

    console.log('✅ WORKING FORMATS:');
    if (workingFormats.length > 0) {
      workingFormats.forEach(format => {
        const result = this.results[format];
        console.log(`  - ${format.toUpperCase()} (${result.duration}ms)`);
      });
    } else {
      console.log('  None - All export formats failed');
    }
    console.log('');

    if (partialFormats.length > 0) {
      console.log('⚠️  PARTIAL SUCCESS (command succeeds but no output file):');
      partialFormats.forEach(format => {
        console.log(`  - ${format.toUpperCase()}`);
      });
      console.log('');
    }

    if (failedFormats.length > 0) {
      console.log('❌ FAILED FORMATS:');
      failedFormats.forEach(({ format, error }) => {
        console.log(`  - ${format.toUpperCase()}: ${error || 'Unknown error'}`);
      });
      console.log('');
    }

    console.log('🔍 RECOMMENDATIONS:');
    if (workingFormats.includes('html')) {
      console.log('  ✅ HTML export works - use as primary format');
    }
    if (workingFormats.includes('pdf')) {
      console.log('  ✅ PDF export works - good for documents');
    } else {
      console.log('  ⚠️  PDF export failed - may need LaTeX or Puppeteer');
    }
    if (workingFormats.includes('docx')) {
      console.log('  ✅ DOCX export works - good for Word compatibility');
    } else {
      console.log('  ⚠️  DOCX export failed - may need proper dependencies');
    }
    
    if (workingFormats.length === 0) {
      console.log('  🚨 CRITICAL: No export formats are working!');
      console.log('  📋 Check dependencies and implementation');
    }

    console.log('\n📈 PERFORMANCE ANALYSIS:');
    const avgDurations = Object.entries(this.results)
      .filter(([, result]) => result.success)
      .map(([format, result]) => ({ format, duration: result.duration }))
      .sort((a, b) => a.duration - b.duration);

    if (avgDurations.length > 0) {
      console.log('  Fastest to slowest (working formats):');
      avgDurations.forEach(({ format, duration }) => {
        console.log(`    ${format.toUpperCase()}: ${duration}ms`);
      });
    }
  }
}

// Run the validation tests
async function main() {
  const tester = new ExportTester();
  try {
    await tester.runValidationTests();
  } catch (error) {
    console.error('💥 Validation test failed:', error.message);
    console.error(error.stack);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { ExportTester };