/**
 * LaTeX Document Processing Test
 * Test actual document generation with real templates
 */

import { promises as fs } from 'fs';
import path from 'path';
import { LaTeXOfficeProcessor } from '../packages/kgen-core/src/office/latex-office-processor.js';

async function runDocumentProcessingTest() {
  console.log('🚀 Starting LaTeX Document Processing Test...\n');

  let tempDir;
  let processor;

  try {
    // Setup test environment
    tempDir = path.join(process.cwd(), 'temp', 'latex-doc-test');
    await fs.mkdir(tempDir, { recursive: true });

    // Initialize the LaTeX Office processor
    console.log('📋 Initializing LaTeX Office processor...');
    processor = new LaTeXOfficeProcessor({
      templatesDir: './templates/latex',
      outputDir: tempDir,
      compileToPdf: false,
      debug: false
    });

    await processor.initialize();
    console.log('✅ Processor initialized\n');

    // Test 1: Process simple report
    console.log('📋 Test 1: Processing simple LaTeX report...');
    
    const reportData = {
      title: 'Integration Test Report',
      author: 'LaTeX Integration Test Suite',
      date: '\\today',
      abstract: 'This is a test abstract for verifying LaTeX document generation.',
      executiveSummary: 'The LaTeX integration system successfully processes templates with dynamic content.',
      sections: [
        {
          title: 'Test Results',
          content: 'All integration tests have passed successfully.'
        },
        {
          title: 'Performance',
          content: 'The system processes documents efficiently with proper error handling.'
        }
      ],
      data: [
        { metric: 'Success Rate', value: '100%' },
        { metric: 'Processing Time', value: '< 1 second' }
      ],
      dataCaption: 'Test Metrics',
      conclusion: 'The LaTeX integration is fully functional and ready for production use.'
    };

    const reportPath = path.join(tempDir, 'integration-test-report.tex');
    const reportResult = await processor.process('./templates/latex/documents/simple-report.tex', reportData, reportPath);

    if (reportResult.success && reportResult.latexContent) {
      console.log('✅ Simple report processed successfully');
      console.log(`   Content length: ${reportResult.latexContent.length} characters`);
      console.log(`   Contains title: ${reportResult.latexContent.includes('Integration Test Report')}`);
      console.log(`   Contains data: ${reportResult.latexContent.includes('Success Rate')}`);
      
      // Verify file was created
      const fileExists = await fs.access(reportPath).then(() => true).catch(() => false);
      console.log(`   File created: ${fileExists}\n`);
      
      if (!fileExists) {
        throw new Error('Report file was not created');
      }
    } else {
      throw new Error(`Report processing failed: ${reportResult.validation?.errors || 'Unknown error'}`);
    }

    // Test 2: Generate standalone table
    console.log('📋 Test 2: Generating standalone LaTeX table...');
    
    const tableData = [
      { Component: 'LaTeX Compiler', Status: 'Working', Version: '3.14159' },
      { Component: 'Template Renderer', Status: 'Working', Version: '2.1.0' },
      { Component: 'Document Processor', Status: 'Working', Version: '1.5.2' }
    ];

    const tableResult = await processor.generateTable(tableData, {
      title: 'System Components Status',
      author: 'Integration Test',
      tableType: 'longtable'
    });

    if (tableResult.success && tableResult.latexContent) {
      console.log('✅ Standalone table generated successfully');
      console.log(`   Content length: ${tableResult.latexContent.length} characters`);
      console.log(`   Contains longtable: ${tableResult.latexContent.includes('longtable')}`);
      console.log(`   Row count: ${tableResult.metadata?.rowCount}`);
      console.log(`   Column count: ${tableResult.metadata?.columnCount}\n`);
      
      if (tableResult.metadata?.rowCount !== 3) {
        throw new Error(`Expected 3 rows, got ${tableResult.metadata?.rowCount}`);
      }
    } else {
      throw new Error('Table generation failed');
    }

    // Test 3: Generate standalone presentation
    console.log('📋 Test 3: Generating standalone LaTeX presentation...');
    
    const slidesData = [
      {
        section: 'Introduction',
        title: 'LaTeX Integration Test',
        content: 'Testing the complete LaTeX document generation system.',
        items: ['Template processing', 'Dynamic content', 'PDF compilation support']
      },
      {
        title: 'Test Results',
        content: 'All integration tests completed successfully.',
        items: ['Documents: ✓', 'Tables: ✓', 'Presentations: ✓']
      }
    ];

    const presentationResult = await processor.generatePresentation(slidesData, {
      title: 'Integration Test Presentation',
      subtitle: 'LaTeX System Verification',
      author: 'Test Suite',
      theme: 'Madrid'
    });

    if (presentationResult.success && presentationResult.latexContent) {
      console.log('✅ Standalone presentation generated successfully');
      console.log(`   Content length: ${presentationResult.latexContent.length} characters`);
      console.log(`   Contains beamer: ${presentationResult.latexContent.includes('beamer')}`);
      console.log(`   Slide count: ${presentationResult.metadata?.slideCount}`);
      console.log(`   Theme: ${presentationResult.metadata?.theme}\n`);
      
      if (presentationResult.metadata?.slideCount !== 2) {
        throw new Error(`Expected 2 slides, got ${presentationResult.metadata?.slideCount}`);
      }
    } else {
      throw new Error('Presentation generation failed');
    }

    console.log('🎉 All document processing tests passed! The LaTeX integration is fully functional.\n');

    // Show some generated content samples
    console.log('📄 Sample LaTeX Content:');
    console.log('Report excerpt:', reportResult.latexContent.substring(0, 200) + '...');
    console.log('Table excerpt:', tableResult.latexContent.substring(0, 200) + '...');
    console.log('Presentation excerpt:', presentationResult.latexContent.substring(0, 200) + '...');

    return true;

  } catch (error) {
    console.error('💥 Document processing test failed:', error.message);
    return false;
  } finally {
    // Cleanup
    if (processor) {
      await processor.cleanup();
    }

    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        console.warn('⚠️ Failed to cleanup temp directory:', error.message);
      }
    }
  }
}

// Run the test
runDocumentProcessingTest()
  .then(success => {
    console.log(success ? '\n✨ All tests completed successfully!' : '\n💥 Tests failed!');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  });