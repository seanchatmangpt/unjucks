/**
 * Minimal LaTeX Integration Test
 * Test just the core functionality without complex dependencies
 */

import { LaTeXOfficeProcessor } from '../packages/kgen-core/src/office/latex-office-processor.js';
import { DocumentType } from '../packages/kgen-core/src/office/core/types.js';

async function runMinimalTest() {
  console.log('🚀 Starting Minimal LaTeX Integration Test...\n');

  try {
    // Test 1: Create processor
    console.log('📋 Test 1: Creating LaTeX Office processor...');
    
    const processor = new LaTeXOfficeProcessor({
      templatesDir: './templates/latex',
      outputDir: './temp/latex-minimal-test',
      compileToPdf: false,
      debug: false
    });
    
    console.log('✅ LaTeX Office processor created successfully\n');

    // Test 2: Initialize processor
    console.log('📋 Test 2: Initializing processor...');
    
    await processor.initialize();
    
    console.log('✅ LaTeX Office processor initialized successfully\n');

    // Test 3: Check supported types
    console.log('📋 Test 3: Checking supported types...');
    
    const supportedTypes = processor.getSupportedTypes();
    console.log(`   Supported types (${supportedTypes.length}): ${supportedTypes.join(', ')}`);
    
    const requiredTypes = [DocumentType.LATEX, DocumentType.LATEX_TABLE, DocumentType.LATEX_PRESENTATION];
    const hasRequiredTypes = requiredTypes.every(type => supportedTypes.includes(type));
    
    if (hasRequiredTypes) {
      console.log('✅ All required LaTeX types are supported\n');
    } else {
      console.log('❌ Missing some required LaTeX types\n');
      return false;
    }

    // Test 4: Get statistics
    console.log('📋 Test 4: Getting processor statistics...');
    
    const stats = processor.getStatistics();
    console.log(`   Total processors: ${stats.totalProcessors}`);
    console.log(`   LaTeX integration stats available: ${stats.latexIntegrationStats ? 'Yes' : 'No'}`);
    
    if (stats.totalProcessors >= 3) {
      console.log('✅ Statistics look good\n');
    } else {
      console.log('❌ Statistics seem incomplete\n');
      return false;
    }

    // Cleanup
    await processor.cleanup();
    console.log('✅ Cleanup completed\n');

    console.log('🎉 All minimal tests passed! LaTeX integration is working.');
    return true;

  } catch (error) {
    console.error('💥 Test failed with error:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

// Run the test
runMinimalTest()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  });