/**
 * Simple LaTeX Integration Verification Test
 * 
 * This test verifies that the LaTeX integration system works correctly
 * without requiring Jest or other test frameworks.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { LaTeXOfficeProcessor } from '../packages/kgen-core/src/office/latex-office-processor.js';
import { DocumentType } from '../packages/kgen-core/src/office/core/types.js';

async function runTest() {
  console.log('🚀 Starting LaTeX Integration Verification Tests...\n');
  
  let passed = 0;
  let failed = 0;
  let tempDir;

  try {
    // Setup test environment
    tempDir = path.join(process.cwd(), 'temp', 'latex-test-verification');
    await fs.mkdir(tempDir, { recursive: true });

    // Initialize the LaTeX Office processor
    console.log('📋 Initializing LaTeX Office processor...');
    const processor = new LaTeXOfficeProcessor({
      templatesDir: './templates/latex',
      outputDir: tempDir,
      compileToPdf: false, // Skip PDF compilation in tests
      debug: true
    });

    await processor.initialize();
    console.log('✅ LaTeX Office processor initialized successfully\n');

    // Test 1: Check processor statistics
    console.log('🧪 Test 1: Processor Statistics');
    try {
      const stats = processor.getStatistics();
      console.log(`   Total processors: ${stats.totalProcessors}`);
      console.log(`   Supported types: ${stats.supportedTypes.join(', ')}`);
      
      if (stats.totalProcessors >= 3 && 
          stats.supportedTypes.includes(DocumentType.LATEX) &&
          stats.supportedTypes.includes(DocumentType.LATEX_TABLE) &&
          stats.supportedTypes.includes(DocumentType.LATEX_PRESENTATION)) {
        console.log('✅ Test 1 PASSED: Statistics look correct\n');
        passed++;
      } else {
        console.log('❌ Test 1 FAILED: Statistics incomplete\n');
        failed++;
      }
    } catch (error) {
      console.log(`❌ Test 1 FAILED: ${error.message}\n`);
      failed++;
    }

    // Test 2: Check supported types
    console.log('🧪 Test 2: Supported Types');
    try {
      const supportedTypes = processor.getSupportedTypes();
      console.log(`   Supported types: ${supportedTypes.join(', ')}`);
      
      const requiredTypes = [
        DocumentType.LATEX,
        DocumentType.LATEX_TABLE, 
        DocumentType.LATEX_PRESENTATION,
        DocumentType.WORD,
        DocumentType.EXCEL,
        DocumentType.POWERPOINT
      ];
      
      const hasAllTypes = requiredTypes.every(type => supportedTypes.includes(type));
      
      if (hasAllTypes) {
        console.log('✅ Test 2 PASSED: All required types supported\n');
        passed++;
      } else {
        console.log('❌ Test 2 FAILED: Missing required types\n');
        failed++;
      }
    } catch (error) {
      console.log(`❌ Test 2 FAILED: ${error.message}\n`);
      failed++;
    }

    // Test 3: Check template discovery
    console.log('🧪 Test 3: Template Discovery');
    try {
      const discovery = await processor.discoverTemplates('./templates/latex');
      console.log(`   Templates found: ${discovery.templates.length}`);
      console.log(`   Types found: ${JSON.stringify(discovery.stats.typeDistribution)}`);
      
      if (discovery.templates.length > 0 && discovery.stats.templatesFound > 0) {
        console.log('✅ Test 3 PASSED: Templates discovered successfully\n');
        passed++;
      } else {
        console.log('❌ Test 3 FAILED: No templates discovered\n');
        failed++;
      }
    } catch (error) {
      console.log(`❌ Test 3 FAILED: ${error.message}\n`);
      failed++;
    }

    // Test 4: Check processor for type retrieval
    console.log('🧪 Test 4: Processor Retrieval');
    try {
      const docProcessor = processor.getProcessorForType(DocumentType.LATEX);
      const tableProcessor = processor.getProcessorForType(DocumentType.LATEX_TABLE);
      const presentationProcessor = processor.getProcessorForType(DocumentType.LATEX_PRESENTATION);
      
      if (docProcessor && tableProcessor && presentationProcessor) {
        console.log('✅ Test 4 PASSED: All processors can be retrieved\n');
        passed++;
      } else {
        console.log('❌ Test 4 FAILED: Could not retrieve all processors\n');
        failed++;
      }
    } catch (error) {
      console.log(`❌ Test 4 FAILED: ${error.message}\n`);
      failed++;
    }

    // Test 5: Check template paths exist
    console.log('🧪 Test 5: Template Files Exist');
    try {
      const templatePaths = [
        './templates/latex/documents/simple-report.tex',
        './templates/latex/tables/data-table.tex',
        './templates/latex/presentations/business-presentation.tex'
      ];
      
      let allExist = true;
      for (const templatePath of templatePaths) {
        try {
          await fs.access(templatePath);
          console.log(`   ✓ ${templatePath} exists`);
        } catch (error) {
          console.log(`   ✗ ${templatePath} does not exist`);
          allExist = false;
        }
      }
      
      if (allExist) {
        console.log('✅ Test 5 PASSED: All template files exist\n');
        passed++;
      } else {
        console.log('❌ Test 5 FAILED: Some template files missing\n');
        failed++;
      }
    } catch (error) {
      console.log(`❌ Test 5 FAILED: ${error.message}\n`);
      failed++;
    }

    // Cleanup
    await processor.cleanup();

  } catch (error) {
    console.error('💥 Test setup failed:', error.message);
    failed++;
  }

  // Cleanup temp directory
  if (tempDir) {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('⚠️ Failed to cleanup temp directory:', error.message);
    }
  }

  // Summary
  console.log('\n📊 Test Summary:');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📋 Total: ${passed + failed}`);

  if (failed === 0) {
    console.log('\n🎉 All LaTeX integration tests passed! The system is working correctly.');
    process.exit(0);
  } else {
    console.log('\n💥 Some tests failed. The integration needs fixes.');
    process.exit(1);
  }
}

// Run the tests
runTest().catch(error => {
  console.error('💥 Test runner failed:', error);
  process.exit(1);
});