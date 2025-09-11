/**
 * Comprehensive examples for Word Document Processor
 * 
 * This file demonstrates all the features and capabilities of the WordProcessor
 * including basic usage, advanced templating, batch processing, and error handling.
 * 
 * @module examples/office/word-processor-examples
 * @requires docxtemplater - npm install docxtemplater pizzip
 * @requires docxtemplater-image-module-free - npm install docxtemplater-image-module-free
 */

import { WordProcessor, createWordProcessor } from '../../src/office/processors/word-processor.js';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Example 1: Basic Word document processing with simple variables
 */
async function basicWordProcessing() {
  console.log('\n=== Basic Word Processing Example ===');
  
  try {
    // Create processor instance
    const processor = new WordProcessor({
      enableImages: true,
      enableLoops: true,
      logger: console
    });
    
    // Sample data for template
    const templateData = {
      customerName: 'John Doe',
      companyName: 'Acme Corporation',
      invoiceNumber: 'INV-2024-001',
      date: new Date(),
      items: [
        { description: 'Web Development', quantity: 40, rate: 125, amount: 5000 },
        { description: 'Consulting', quantity: 10, rate: 150, amount: 1500 }
      ],
      subtotal: 6500,
      tax: 585,
      total: 7085
    };
    
    // Process the document (template would contain variables like {{customerName}})
    const result = await processor.processDocument(
      './templates/invoice-template.docx',  // Template path
      templateData,                          // Data for replacement
      {
        outputPath: './output/invoice-001.docx',  // Output path
        preserveFormatting: true
      }
    );
    
    if (result.success) {
      console.log(`✅ Document processed successfully`);
      console.log(`📄 Output: ${result.outputPath || 'buffer'}`);
      console.log(`📊 Variables replaced: ${result.metadata.variablesProcessed}`);
      console.log(`⏱️  Processing time: ${result.processingTime}ms`);
    } else {
      console.log(`❌ Processing failed: ${result.error.message}`);
    }
    
  } catch (error) {
    console.error('Basic processing failed:', error.message);
    console.log('💡 Make sure to install: npm install docxtemplater pizzip');
  }
}

/**
 * Example 2: Advanced templating with loops, conditions, and nested data
 */
async function advancedTemplating() {
  console.log('\n=== Advanced Templating Example ===');
  
  try {
    const processor = new WordProcessor({
      enableLoops: true,
      delimiters: { start: '{{', end: '}}' }
    });
    
    // Complex nested data structure
    const reportData = {
      reportTitle: 'Q4 2024 Performance Report',
      company: {
        name: 'Tech Solutions Inc.',
        address: {
          street: '123 Business Ave',
          city: 'San Francisco',
          state: 'CA',
          zip: '94105'
        }
      },
      author: {
        name: 'Alice Johnson',
        title: 'Senior Analyst',
        department: 'Business Intelligence'
      },
      // Data for loops
      departments: [
        {
          name: 'Sales',
          performance: 'Excellent',
          metrics: {
            revenue: 2500000,
            growth: 15.5,
            customerSatisfaction: 4.7
          },
          employees: [
            { name: 'Bob Smith', role: 'Sales Manager', performance: 'Outstanding' },
            { name: 'Carol Davis', role: 'Account Executive', performance: 'Good' }
          ]
        },
        {
          name: 'Engineering',
          performance: 'Good',
          metrics: {
            projectsCompleted: 12,
            bugFixRate: 98.5,
            codeQuality: 'A'
          },
          employees: [
            { name: 'Dave Wilson', role: 'Tech Lead', performance: 'Excellent' },
            { name: 'Eve Brown', role: 'Developer', performance: 'Good' }
          ]
        }
      ],
      // Conditional data
      hasIssues: true,
      criticalIssues: [
        'Server maintenance required',
        'Customer complaint resolution needed'
      ],
      recommendations: [
        'Increase customer service training',
        'Implement automated testing',
        'Review security protocols'
      ]
    };
    
    // Template would contain advanced syntax like:
    // {{company.name}} - {{reportTitle}}
    // {{#each departments}}
    //   Department: {{name}}
    //   Performance: {{performance}}
    //   {{#each employees}}
    //     - {{name}}: {{role}} ({{performance}})
    //   {{/each}}
    // {{/each}}
    // {{#if hasIssues}}
    //   Critical Issues:
    //   {{#each criticalIssues}}
    //   - {{this}}
    //   {{/each}}
    // {{/if}}
    
    const result = await processor.processDocument(
      './templates/performance-report-template.docx',
      reportData,
      {
        outputPath: './output/performance-report-q4.docx'
      }
    );
    
    if (result.success) {
      console.log('✅ Advanced template processed successfully');
      console.log('🔄 Loops and conditions rendered');
    } else {
      console.log(`❌ Processing failed: ${result.error?.message || 'Unknown error'}`);
    }
    
  } catch (error) {
    console.error('Advanced templating failed:', error.message);
  }
}

/**
 * Example 3: Image processing and replacement
 */
async function imageProcessing() {
  console.log('\n=== Image Processing Example ===');
  
  try {
    const processor = new WordProcessor({
      enableImages: true,
      logger: console
    });
    
    const documentData = {
      companyName: 'Innovation Labs',
      projectName: 'Mobile App Development',
      clientName: 'StartupXYZ'
    };
    
    // Define images to be inserted
    const imageOptions = {
      images: {
        companyLogo: './assets/company-logo.png',        // Company logo
        projectScreenshot: './assets/app-screenshot.jpg', // Project screenshot
        clientLogo: './assets/client-logo.svg'            // Client logo (if exists)
      }
    };
    
    // Template would contain image placeholders like {{%companyLogo}}
    const result = await processor.processDocument(
      './templates/project-proposal-template.docx',
      documentData,
      {
        ...imageOptions,
        outputPath: './output/project-proposal-with-images.docx'
      }
    );
    
    if (result.success) {
      console.log('✅ Images processed and inserted');
      console.log(`🖼️  Images processed: ${result.metadata.imagesProcessed}`);
    } else {
      console.log(`❌ Image processing failed: ${result.error?.message}`);
    }
    
  } catch (error) {
    console.error('Image processing failed:', error.message);
    console.log('💡 Make sure to install: npm install docxtemplater-image-module-free');
  }
}

/**
 * Example 4: Content injection at bookmarks
 */
async function bookmarkInjection() {
  console.log('\n=== Bookmark Injection Example ===');
  
  try {
    const processor = new WordProcessor();
    
    const contractData = {
      contractNumber: 'CTR-2024-150',
      clientName: 'Global Enterprises',
      serviceDescription: 'Custom software development and maintenance'
    };
    
    // Define injection points for bookmarks in the document
    const injectionPoints = [
      {
        bookmark: 'TERMS_SECTION',
        content: `
          <h3>Terms and Conditions</h3>
          <p>1. Payment terms: Net 30 days</p>
          <p>2. Delivery timeline: 90 business days</p>
          <p>3. Warranty period: 12 months</p>
        `,
        position: 'replace'
      },
      {
        bookmark: 'SIGNATURE_BLOCK',
        content: `
          <table>
            <tr>
              <td>Client Signature: ___________________</td>
              <td>Date: ___________</td>
            </tr>
            <tr>
              <td>Contractor Signature: ___________________</td>
              <td>Date: ___________</td>
            </tr>
          </table>
        `,
        position: 'replace'
      }
    ];
    
    const result = await processor.processDocument(
      './templates/contract-template.docx',
      contractData,
      {
        injectionPoints,
        outputPath: './output/completed-contract.docx'
      }
    );
    
    if (result.success) {
      console.log('✅ Content injected at bookmarks');
      console.log('🔖 Bookmark sections populated');
    } else {
      console.log(`❌ Bookmark injection failed: ${result.error?.message}`);
    }
    
  } catch (error) {
    console.error('Bookmark injection failed:', error.message);
  }
}

/**
 * Example 5: Batch processing multiple documents
 */
async function batchProcessing() {
  console.log('\n=== Batch Processing Example ===');
  
  try {
    const processor = new WordProcessor({
      logger: {
        info: (msg) => console.log(`[BATCH] ${msg}`),
        warn: (msg) => console.warn(`[BATCH] ${msg}`),
        error: (msg) => console.error(`[BATCH] ${msg}`),
        debug: () => {} // Suppress debug logs for cleaner output
      }
    });
    
    // Define multiple documents to process
    const batchTemplates = [
      {
        template: './templates/invoice-template.docx',
        data: {
          customerName: 'ABC Company',
          invoiceNumber: 'INV-001',
          amount: 1500,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
        },
        options: {
          outputPath: './output/batch/invoice-abc-001.docx'
        }
      },
      {
        template: './templates/invoice-template.docx',
        data: {
          customerName: 'XYZ Corporation',
          invoiceNumber: 'INV-002',
          amount: 2750,
          dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) // 15 days from now
        },
        options: {
          outputPath: './output/batch/invoice-xyz-002.docx'
        }
      },
      {
        template: './templates/quote-template.docx',
        data: {
          customerName: '123 Industries',
          quoteNumber: 'QUO-001',
          validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days validity
          items: [
            { service: 'Web Design', hours: 40, rate: 100 },
            { service: 'Development', hours: 80, rate: 125 }
          ]
        },
        options: {
          outputPath: './output/batch/quote-123-001.docx'
        }
      }
    ];
    
    // Global data applied to all documents
    const globalData = {
      companyName: 'Professional Services LLC',
      companyAddress: '456 Business Park Dr, Suite 100',
      phone: '(555) 123-4567',
      email: 'contact@proservices.com',
      website: 'www.proservices.com'
    };
    
    // Progress tracking
    let progressCount = 0;
    const progressCallback = (progress) => {
      progressCount++;
      console.log(`📄 Processed ${progress.completed}/${progress.total}: ${progress.result.success ? '✅' : '❌'}`);
    };
    
    // Execute batch processing
    const batchResult = await processor.batchProcess(
      batchTemplates,
      globalData,
      {
        concurrency: 2,              // Process 2 documents at a time
        continueOnError: true,       // Don't stop if one fails
        progressCallback
      }
    );
    
    console.log('\n📊 Batch Processing Results:');
    console.log(`Total processed: ${batchResult.totalProcessed}`);
    console.log(`Successful: ${batchResult.successCount}`);
    console.log(`Errors: ${batchResult.errorCount}`);
    
    if (batchResult.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      batchResult.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error.template}: ${error.error}`);
      });
    }
    
  } catch (error) {
    console.error('Batch processing failed:', error.message);
  }
}

/**
 * Example 6: Variable extraction and template validation
 */
async function templateValidation() {
  console.log('\n=== Template Validation Example ===');
  
  try {
    const processor = new WordProcessor();
    
    // Extract variables from a template
    console.log('🔍 Extracting variables from template...');
    const variables = await processor.extractVariables('./templates/invoice-template.docx');
    
    console.log(`Found ${variables.length} variables:`);
    variables.forEach(variable => {
      console.log(`  - ${variable.name} (${variable.type}, ${variable.syntax})`);
    });
    
    // Validate template with sample data
    console.log('\n✅ Validating template...');
    const sampleData = {
      customerName: 'Test Customer',
      invoiceNumber: 'TEST-001',
      // Intentionally missing some variables for validation
    };
    
    const validation = await processor.validateTemplate(
      './templates/invoice-template.docx',
      sampleData
    );
    
    console.log(`Template valid: ${validation.isValid}`);
    
    if (validation.errors.length > 0) {
      console.log('❌ Errors:');
      validation.errors.forEach(error => console.log(`  - ${error.message}`));
    }
    
    if (validation.warnings.length > 0) {
      console.log('⚠️  Warnings:');
      validation.warnings.forEach(warning => console.log(`  - ${warning.message}`));
    }
    
    if (validation.missingVariables.length > 0) {
      console.log('🔍 Missing variables in data:');
      validation.missingVariables.forEach(varName => console.log(`  - ${varName}`));
    }
    
    if (validation.unusedVariables.length > 0) {
      console.log('🗑️  Unused variables in data:');
      validation.unusedVariables.forEach(varName => console.log(`  - ${varName}`));
    }
    
  } catch (error) {
    console.error('Template validation failed:', error.message);
  }
}

/**
 * Example 7: Error handling and recovery
 */
async function errorHandlingExamples() {
  console.log('\n=== Error Handling Examples ===');
  
  // Example 7a: Graceful error handling (non-strict mode)
  console.log('\n🛡️  Testing graceful error handling...');
  try {
    const processor = new WordProcessor({ 
      strictMode: false,
      logger: console
    });
    
    // Try to process non-existent template
    const result = await processor.processDocument(
      './templates/non-existent-template.docx',
      { test: 'data' }
    );
    
    if (!result.success) {
      console.log(`❌ Graceful failure: ${result.error.message}`);
      console.log(`📊 Error type: ${result.error.type}`);
    }
    
  } catch (error) {
    console.log(`🚫 Unexpected error: ${error.message}`);
  }
  
  // Example 7b: Strict mode error handling
  console.log('\n⚡ Testing strict mode error handling...');
  try {
    const strictProcessor = new WordProcessor({ 
      strictMode: true,
      logger: console
    });
    
    await strictProcessor.processDocument(
      './templates/invalid-template.docx',
      { test: 'data' }
    );
    
  } catch (error) {
    console.log(`🚫 Strict mode error (expected): ${error.message}`);
  }
  
  // Example 7c: Dependency validation
  console.log('\n🔧 Checking dependencies...');
  const processor = new WordProcessor();
  const status = processor.getDependencyStatus();
  
  console.log('📦 Dependency Status:');
  console.log(`  DocxTemplater: ${status.docxtemplater ? '✅' : '❌'}`);
  console.log(`  PizZip: ${status.pizzip ? '✅' : '❌'}`);
  console.log(`  Image Module: ${status.imageModule ? '✅' : '❌'}`);
  console.log(`  Loop Module: ${status.loopModule ? '✅' : '❌'}`);
  console.log(`  Fallback Mode: ${status.fallbackMode ? '⚠️  Yes' : '✅ No'}`);
  
  if (status.fallbackMode) {
    console.log('\n💡 To enable full functionality, install:');
    console.log('   npm install docxtemplater pizzip');
    console.log('   npm install docxtemplater-image-module-free');
    console.log('   npm install docxtemplater-loop-module');
  }
}

/**
 * Example 8: Performance monitoring and caching
 */
async function performanceExample() {
  console.log('\n=== Performance Monitoring Example ===');
  
  try {
    const processor = new WordProcessor({
      logger: {
        info: (msg) => console.log(`[PERF] ${msg}`),
        warn: () => {},
        error: () => {},
        debug: () => {}
      }
    });
    
    console.log('📊 Initial stats:', processor.getStats());
    
    // Simulate multiple processing operations
    const testData = { name: 'Performance Test', date: new Date() };
    
    console.log('\n🏃 Running performance test...');
    const startTime = Date.now();
    
    // Process same template multiple times to test caching
    for (let i = 0; i < 3; i++) {
      try {
        await processor.processDocument(
          Buffer.from('Test template content {{name}} - {{date}}'),
          { ...testData, iteration: i + 1 }
        );
        console.log(`  Iteration ${i + 1} completed`);
      } catch (error) {
        console.log(`  Iteration ${i + 1} failed (expected without dependencies)`);
      }
    }
    
    const totalTime = Date.now() - startTime;
    const finalStats = processor.getStats();
    
    console.log('\n📈 Final Performance Stats:');
    console.log(`  Total time: ${totalTime}ms`);
    console.log(`  Documents processed: ${finalStats.documentsProcessed}`);
    console.log(`  Variables replaced: ${finalStats.variablesReplaced}`);
    console.log(`  Cache size: ${finalStats.cacheSize}`);
    console.log(`  Errors: ${finalStats.errorsEncountered}`);
    
    if (finalStats.documentsProcessed > 0) {
      console.log(`  Average time per document: ${finalStats.processingTime / finalStats.documentsProcessed}ms`);
    }
    
  } catch (error) {
    console.error('Performance test failed:', error.message);
  }
}

/**
 * Run all examples
 */
async function runAllExamples() {
  console.log('🚀 Starting Word Processor Examples');
  console.log('=====================================');
  
  // Create output directories
  try {
    await fs.mkdir('./output', { recursive: true });
    await fs.mkdir('./output/batch', { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
  
  // Run examples in sequence
  await basicWordProcessing();
  await advancedTemplating();
  await imageProcessing();
  await bookmarkInjection();
  await batchProcessing();
  await templateValidation();
  await errorHandlingExamples();
  await performanceExample();
  
  console.log('\n✨ All examples completed!');
  console.log('\n📚 For production use, make sure to install:');
  console.log('   npm install docxtemplater pizzip');
  console.log('   npm install docxtemplater-image-module-free (for images)');
  console.log('   npm install docxtemplater-loop-module (for advanced loops)');
}

// Export examples for individual use
export {
  basicWordProcessing,
  advancedTemplating,
  imageProcessing,
  bookmarkInjection,
  batchProcessing,
  templateValidation,
  errorHandlingExamples,
  performanceExample,
  runAllExamples
};

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples().catch(console.error);
}