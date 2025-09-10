#!/usr/bin/env node
/**
 * Simple validation script for the Output Engine
 * Tests core functionality without complex test framework dependencies
 */

import { OutputEngine, OUTPUT_FORMATS } from '../src/core/output-engine.js';
import { LaTeXValidator } from '../src/utils/latex-validator.js';
import { memoryStore } from '../src/utils/memory-store.js';
import { promises as fs } from 'fs';
import { join } from 'path';

const testContent = `
# Test Document

This is a test document for validating the output engine.

## Features

- Multi-format output
- PDF generation
- HTML with CSS
- JSON-LD structured data
- LaTeX compilation
- Batch processing

## Sample Content

**Bold text** and *italic text* for formatting.

### Code Example

\`\`\`javascript
const outputEngine = new OutputEngine();
await outputEngine.generateMultiFormat(content);
\`\`\`

### Contact Information

name: John Doe
email: john@example.com
phone: (555) 123-4567
`;

const testMetadata = {
  title: 'Test Document',
  author: 'Output Engine Validator',
  date: new Date().toISOString(),
  description: 'Validation test for multi-format output engine'
};

async function validateOutputEngine() {
  console.log('🧪 Output Engine Validation');
  console.log('============================\n');

  const engine = new OutputEngine({
    outputDir: './test-output',
    tempDir: './test-temp'
  });

  const results = {
    capabilities: null,
    latex: null,
    formats: {},
    memory: null,
    errors: []
  };

  try {
    // Test 1: Check capabilities
    console.log('1. Checking output capabilities...');
    results.capabilities = await engine.getCapabilities();
    console.log('   ✅ Capabilities retrieved');
    console.log('   📄 Supported formats:', results.capabilities.formats.join(', '));
    console.log('   🛠️  Available tools:', Object.entries(results.capabilities.tools)
      .map(([tool, available]) => `${tool}: ${available ? '✅' : '❌'}`)
      .join(', '));

    // Test 2: Validate LaTeX
    console.log('\n2. Validating LaTeX installation...');
    const latexValidator = new LaTeXValidator();
    results.latex = await latexValidator.validateInstallation();
    console.log(`   LaTeX installed: ${results.latex.installed ? '✅' : '❌'}`);
    if (results.latex.installed) {
      console.log(`   Version: ${results.latex.version}`);
      console.log(`   Basic compilation: ${results.latex.compilation.minimal ? '✅' : '❌'}`);
      console.log(`   Package support: ${results.latex.compilation.withPackages ? '✅' : '❌'}`);
    }

    // Test 3: Generate HTML
    console.log('\n3. Testing HTML generation...');
    try {
      const htmlResult = await engine.generateHTML(testContent, {
        filename: 'test-html',
        cssStyle: 'screen',
        metadata: testMetadata
      });
      results.formats.html = htmlResult;
      console.log('   ✅ HTML generation successful');
      console.log(`   📄 File: ${htmlResult.file}`);
    } catch (error) {
      results.errors.push(`HTML generation failed: ${error.message}`);
      console.log('   ❌ HTML generation failed:', error.message);
    }

    // Test 4: Generate JSON-LD
    console.log('\n4. Testing JSON-LD generation...');
    try {
      const jsonResult = await engine.generateJSONLD(testContent, {
        filename: 'test-jsonld',
        template: 'person',
        metadata: testMetadata
      });
      results.formats.jsonld = jsonResult;
      console.log('   ✅ JSON-LD generation successful');
      console.log(`   📄 File: ${jsonResult.file}`);
      console.log('   🔗 Schema type:', jsonResult.data['@type']);
    } catch (error) {
      results.errors.push(`JSON-LD generation failed: ${error.message}`);
      console.log('   ❌ JSON-LD generation failed:', error.message);
    }

    // Test 5: Generate Markdown
    console.log('\n5. Testing Markdown generation...');
    try {
      const mdResult = await engine.generateMarkdown(testContent, {
        filename: 'test-markdown',
        metadata: testMetadata
      });
      results.formats.markdown = mdResult;
      console.log('   ✅ Markdown generation successful');
      console.log(`   📄 File: ${mdResult.file}`);
    } catch (error) {
      results.errors.push(`Markdown generation failed: ${error.message}`);
      console.log('   ❌ Markdown generation failed:', error.message);
    }

    // Test 6: Test multi-format generation
    console.log('\n6. Testing multi-format generation...');
    try {
      const multiResult = await engine.generateMultiFormat(testContent, {
        formats: [OUTPUT_FORMATS.HTML, OUTPUT_FORMATS.JSONLD, OUTPUT_FORMATS.MARKDOWN],
        filename: 'test-multi',
        template: 'article',
        metadata: testMetadata
      });
      results.formats.multi = multiResult;
      console.log('   ✅ Multi-format generation successful');
      console.log(`   📊 Generated ${Object.keys(multiResult.results).length} formats`);
      console.log(`   ⏱️  Duration: ${multiResult.performance?.duration || 'N/A'}ms`);
    } catch (error) {
      results.errors.push(`Multi-format generation failed: ${error.message}`);
      console.log('   ❌ Multi-format generation failed:', error.message);
    }

    // Test 7: Store capabilities in memory
    console.log('\n7. Testing memory store...');
    try {
      await memoryStore.storeOutputCapabilities();
      const storedCapabilities = memoryStore.getOutputCapabilities();
      results.memory = storedCapabilities;
      console.log('   ✅ Capabilities stored in memory');
      console.log('   🗄️  Memory key: hive/output/formats');
      console.log(`   📅 Timestamp: ${storedCapabilities?.timestamp}`);
    } catch (error) {
      results.errors.push(`Memory store failed: ${error.message}`);
      console.log('   ❌ Memory store failed:', error.message);
    }

    // Test 8: PDF generation (optional)
    if (results.latex?.installed) {
      console.log('\n8. Testing PDF generation...');
      try {
        const pdfResult = await engine.generatePDF(testContent, {
          filename: 'test-pdf',
          template: 'article',
          metadata: testMetadata
        });
        results.formats.pdf = pdfResult;
        console.log('   ✅ PDF generation successful');
        console.log(`   📄 File: ${pdfResult.file}`);
        console.log(`   🔧 Method: ${pdfResult.method}`);
      } catch (error) {
        results.errors.push(`PDF generation failed: ${error.message}`);
        console.log('   ❌ PDF generation failed:', error.message);
      }
    } else {
      console.log('\n8. Skipping PDF generation (LaTeX not available)');
    }

  } catch (error) {
    console.error('\n❌ Validation failed:', error.message);
    results.errors.push(`Validation failed: ${error.message}`);
  }

  // Summary
  console.log('\n📊 Validation Summary');
  console.log('====================');
  console.log(`Total tests: 8`);
  console.log(`Successful: ${8 - results.errors.length}`);
  console.log(`Failed: ${results.errors.length}`);
  
  if (results.errors.length > 0) {
    console.log('\n❌ Errors:');
    results.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`);
    });
  }

  // Check output files
  console.log('\n📁 Generated Files:');
  try {
    const outputDir = './test-output';
    const files = await fs.readdir(outputDir).catch(() => []);
    if (files.length > 0) {
      for (const file of files) {
        const stats = await fs.stat(join(outputDir, file));
        const sizeKB = (stats.size / 1024).toFixed(2);
        console.log(`   📄 ${file} (${sizeKB} KB)`);
      }
    } else {
      console.log('   (No files generated)');
    }
  } catch (error) {
    console.log('   (Could not read output directory)');
  }

  const successRate = ((8 - results.errors.length) / 8 * 100).toFixed(1);
  console.log(`\n🎯 Success Rate: ${successRate}%`);
  
  if (successRate >= 75) {
    console.log('\n✅ Output Engine validation PASSED');
    return true;
  } else {
    console.log('\n❌ Output Engine validation FAILED');
    return false;
  }
}

// Run validation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateOutputEngine()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('Validation script failed:', error);
      process.exit(1);
    });
}

export { validateOutputEngine };
