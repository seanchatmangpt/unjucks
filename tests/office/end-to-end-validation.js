#!/usr/bin/env node

/**
 * End-to-End Validation Script for Integrated Office Document Processing
 * 
 * This script validates the complete doc:// URI + OPC canonical integration:
 * 1. Creates test documents
 * 2. Processes them deterministically
 * 3. Stores in content-addressed storage
 * 4. Resolves doc:// URIs back to content
 * 5. Validates reproducibility and canonicalization
 * 
 * Usage: node end-to-end-validation.js
 * 
 * @version 1.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { IntegratedOfficeProcessor } from '../../packages/kgen-core/src/office/integrated-office-processor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VALIDATION_DIR = path.join(__dirname, '.validation-test');

// ANSI color codes for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(level, message, details = null) {
  const timestamp = this.getDeterministicDate().toISOString();
  let color = colors.reset;
  
  switch (level) {
    case 'SUCCESS': color = colors.green; break;
    case 'ERROR': color = colors.red; break;
    case 'WARNING': color = colors.yellow; break;
    case 'INFO': color = colors.blue; break;
    case 'TEST': color = colors.cyan; break;
  }
  
  console.log(`${color}[${level}]${colors.reset} ${colors.bold}${timestamp}${colors.reset} ${message}`);
  
  if (details) {
    console.log(`       ${JSON.stringify(details, null, 2)}`);
  }
}

async function cleanup() {
  try {
    await fs.rm(VALIDATION_DIR, { recursive: true, force: true });
    log('INFO', 'Cleaned up validation directory');
  } catch (error) {
    // Ignore cleanup errors
  }
}

async function setup() {
  await cleanup();
  await fs.mkdir(VALIDATION_DIR, { recursive: true });
  log('INFO', 'Created validation directory');
  
  // Create test data directory
  const testDataDir = path.join(VALIDATION_DIR, 'test-data');
  await fs.mkdir(testDataDir, { recursive: true });
  
  return { testDataDir };
}

async function createTestDocuments(testDataDir) {
  log('TEST', 'Creating test documents...');
  
  // Create a simple text template
  const simpleTemplate = path.join(testDataDir, 'simple-template.txt');
  await fs.writeFile(simpleTemplate, `
Document: {{title}}
Author: {{author}}
Generated: {{timestamp}}
Content: {{content}}
Footer: End of document
`.trim());

  // Create a mock Office document (ZIP structure)
  const mockOfficeDoc = path.join(testDataDir, 'mock-office.docx');
  const zipContent = Buffer.concat([
    Buffer.from([0x50, 0x4B, 0x03, 0x04]), // ZIP signature
    Buffer.from('fake-office-content-for-testing'),
    Buffer.from([0x50, 0x4B, 0x05, 0x06, 0x00, 0x00, 0x00, 0x00]) // ZIP end
  ]);
  await fs.writeFile(mockOfficeDoc, zipContent);

  log('SUCCESS', 'Test documents created', {
    simpleTemplate,
    mockOfficeDoc
  });

  return { simpleTemplate, mockOfficeDoc };
}

async function testBasicProcessing(processor, testDocs) {
  log('TEST', 'Testing basic document processing...');

  const context = {
    title: 'End-to-End Test Document',
    author: 'Validation Script',
    timestamp: new Date('2024-01-01T00:00:00.000Z').toISOString(),
    content: 'This is a test of deterministic document processing with doc:// URI integration.'
  };

  try {
    // Process template to doc:// URI
    const result = await processor.processToDocURI(testDocs.simpleTemplate, context);
    
    if (!result.success) {
      throw new Error(`Processing failed: ${result.error}`);
    }

    log('SUCCESS', 'Document processed successfully', {
      docURI: result.docURI,
      contentHash: result.contentHash,
      deterministic: result.deterministic,
      reproducible: result.reproducible
    });

    return result;
    
  } catch (error) {
    log('ERROR', 'Basic processing test failed', { error: error.message });
    throw error;
  }
}

async function testReproducibility(processor, testDocs) {
  log('TEST', 'Testing reproducibility...');

  const context = {
    title: 'Reproducibility Test',
    author: 'Test User',
    timestamp: '2024-01-01T12:00:00.000Z', // Fixed timestamp for reproducibility
    content: 'Content for reproducibility testing'
  };

  try {
    // Process the same template multiple times
    const results = await Promise.all([
      processor.processToDocURI(testDocs.simpleTemplate, context),
      processor.processToDocURI(testDocs.simpleTemplate, context),
      processor.processToDocURI(testDocs.simpleTemplate, context)
    ]);

    // Check that all results are successful
    const allSuccessful = results.every(r => r.success);
    if (!allSuccessful) {
      throw new Error('Some processing attempts failed');
    }

    // Check that all doc:// URIs are identical
    const docURIs = results.map(r => r.docURI);
    const uniqueURIs = new Set(docURIs);
    
    if (uniqueURIs.size !== 1) {
      throw new Error(`Expected 1 unique URI, got ${uniqueURIs.size}`);
    }

    // Check that all content hashes are identical
    const contentHashes = results.map(r => r.contentHash);
    const uniqueHashes = new Set(contentHashes);
    
    if (uniqueHashes.size !== 1) {
      throw new Error(`Expected 1 unique hash, got ${uniqueHashes.size}`);
    }

    log('SUCCESS', 'Reproducibility test passed', {
      processedCount: results.length,
      uniqueURIs: uniqueURIs.size,
      uniqueHashes: uniqueHashes.size,
      docURI: docURIs[0]
    });

    return docURIs[0];
    
  } catch (error) {
    log('ERROR', 'Reproducibility test failed', { error: error.message });
    throw error;
  }
}

async function testURIResolution(processor, docURI) {
  log('TEST', 'Testing doc:// URI resolution...');

  try {
    const outputPath = path.join(VALIDATION_DIR, 'resolved-document.txt');
    
    // Resolve doc:// URI back to file
    const result = await processor.resolveToFile(docURI, outputPath);
    
    if (!result.success) {
      throw new Error(`Resolution failed: ${result.error}`);
    }

    // Verify file was created
    const stats = await fs.stat(outputPath);
    if (!stats.isFile()) {
      throw new Error('Resolved file is not a regular file');
    }

    // Read and verify content
    const content = await fs.readFile(outputPath, 'utf8');
    if (content.length === 0) {
      throw new Error('Resolved file is empty');
    }

    // Verify content contains expected elements
    const expectedElements = ['End-to-End Test Document', 'Validation Script'];
    const missingElements = expectedElements.filter(elem => !content.includes(elem));
    
    if (missingElements.length > 0) {
      log('WARNING', 'Some expected elements not found in resolved content', {
        missing: missingElements,
        contentPreview: content.substring(0, 200)
      });
    }

    log('SUCCESS', 'URI resolution test passed', {
      docURI,
      outputPath,
      fileSize: stats.size,
      contentLength: content.length
    });

    return { outputPath, content, stats };
    
  } catch (error) {
    log('ERROR', 'URI resolution test failed', { error: error.message });
    throw error;
  }
}

async function testCanonnicalization(processor, testDocs) {
  log('TEST', 'Testing document canonicalization...');

  try {
    const fileURI = `file://${testDocs.mockOfficeDoc}`;
    
    // Canonicalize the file URI
    const result = await processor.canonicalizeDocument(fileURI);
    
    if (!result.success) {
      throw new Error(`Canonicalization failed: ${result.error}`);
    }

    // Verify we got a doc:// URI
    if (!result.docURI || !result.docURI.startsWith('doc://')) {
      throw new Error(`Expected doc:// URI, got: ${result.docURI}`);
    }

    // Verify canonicalization properties
    if (!result.canonical) {
      throw new Error('Result should be marked as canonical');
    }

    log('SUCCESS', 'Canonicalization test passed', {
      sourceUri: result.sourceUri,
      docURI: result.docURI,
      contentHash: result.contentHash,
      alreadyCanonical: result.alreadyCanonical
    });

    return result;
    
  } catch (error) {
    log('ERROR', 'Canonicalization test failed', { error: error.message });
    throw error;
  }
}

async function testBatchProcessing(processor, testDocs) {
  log('TEST', 'Testing batch processing...');

  const templates = [
    {
      templatePath: testDocs.simpleTemplate,
      context: {
        title: 'Batch Document 1',
        author: 'Batch Test',
        timestamp: '2024-01-01T00:00:00.000Z',
        content: 'First batch document'
      }
    },
    {
      templatePath: testDocs.simpleTemplate,
      context: {
        title: 'Batch Document 2',
        author: 'Batch Test',
        timestamp: '2024-01-01T00:00:00.000Z',
        content: 'Second batch document'
      }
    },
    {
      templatePath: testDocs.simpleTemplate,
      context: {
        title: 'Batch Document 3',
        author: 'Batch Test',
        timestamp: '2024-01-01T00:00:00.000Z',
        content: 'Third batch document'
      }
    }
  ];

  try {
    const result = await processor.batchProcess(templates, {
      outputType: 'docuri',
      concurrency: 2
    });

    if (!result.success) {
      throw new Error(`Batch processing failed with ${result.errors.length} errors`);
    }

    // Verify all templates were processed
    if (result.totalTemplates !== 3) {
      throw new Error(`Expected 3 templates, processed ${result.totalTemplates}`);
    }

    if (result.successfullyProcessed !== 3) {
      throw new Error(`Expected 3 successful, got ${result.successfullyProcessed}`);
    }

    // Verify all results have unique doc:// URIs
    const docURIs = result.results.map(r => r.docURI);
    const uniqueURIs = new Set(docURIs);
    
    if (uniqueURIs.size !== 3) {
      throw new Error(`Expected 3 unique URIs, got ${uniqueURIs.size}`);
    }

    log('SUCCESS', 'Batch processing test passed', {
      totalTemplates: result.totalTemplates,
      successfullyProcessed: result.successfullyProcessed,
      uniqueURIs: uniqueURIs.size,
      reproducibilityRate: result.reproducibilityRate
    });

    return result;
    
  } catch (error) {
    log('ERROR', 'Batch processing test failed', { error: error.message });
    throw error;
  }
}

async function testSystemStatus(processor) {
  log('TEST', 'Testing system status and configuration...');

  try {
    // Get system status
    const status = processor.getSystemStatus();
    
    // Validate configuration
    const validation = processor.validateConfiguration();
    
    if (!validation.valid) {
      throw new Error(`Configuration validation failed: ${validation.issues.join(', ')}`);
    }

    log('SUCCESS', 'System status test passed', {
      deterministic: status.deterministic.processedDocuments,
      cacheEnabled: status.docResolver.enabled,
      casEnabled: status.cas,
      normalizationEnabled: status.normalization,
      validationIssues: validation.issues.length,
      validationWarnings: validation.warnings.length
    });

    return { status, validation };
    
  } catch (error) {
    log('ERROR', 'System status test failed', { error: error.message });
    throw error;
  }
}

async function runValidation() {
  const startTime = this.getDeterministicTimestamp();
  log('INFO', 'Starting end-to-end validation...');

  try {
    // Setup
    const { testDataDir } = await setup();
    const testDocs = await createTestDocuments(testDataDir);

    // Initialize processor
    const processor = new IntegratedOfficeProcessor({
      casDirectory: path.join(VALIDATION_DIR, 'cas'),
      enableDeterministic: true,
      enableNormalization: true,
      enableContentAddressing: true,
      enableCache: true,
      defaultHashAlgorithm: 'sha256'
    });

    log('INFO', 'Processor initialized');

    // Run test suite
    const tests = [
      () => testBasicProcessing(processor, testDocs),
      () => testReproducibility(processor, testDocs),
      async () => {
        const basicResult = await testBasicProcessing(processor, testDocs);
        return testURIResolution(processor, basicResult.docURI);
      },
      () => testCanonnicalization(processor, testDocs),
      () => testBatchProcessing(processor, testDocs),
      () => testSystemStatus(processor)
    ];

    const testNames = [
      'Basic Processing',
      'Reproducibility',
      'URI Resolution',
      'Canonicalization',
      'Batch Processing',
      'System Status'
    ];

    const results = [];
    
    for (let i = 0; i < tests.length; i++) {
      try {
        log('INFO', `Running ${testNames[i]} test...`);
        const result = await tests[i]();
        results.push({ test: testNames[i], success: true, result });
      } catch (error) {
        results.push({ test: testNames[i], success: false, error: error.message });
        log('ERROR', `${testNames[i]} test failed`, { error: error.message });
      }
    }

    // Summary
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    const duration = this.getDeterministicTimestamp() - startTime;

    log('INFO', `Validation completed in ${duration}ms`);
    
    if (successCount === totalCount) {
      log('SUCCESS', `All ${totalCount} tests passed! 🎉`);
      console.log('\n' + colors.green + colors.bold + '✓ END-TO-END VALIDATION PASSED' + colors.reset);
      console.log(colors.green + `  All ${totalCount} integration tests successful` + colors.reset);
      console.log(colors.blue + `  Duration: ${duration}ms` + colors.reset);
    } else {
      log('ERROR', `${totalCount - successCount} of ${totalCount} tests failed`);
      console.log('\n' + colors.red + colors.bold + '✗ END-TO-END VALIDATION FAILED' + colors.reset);
      console.log(colors.red + `  ${successCount}/${totalCount} tests passed` + colors.reset);
      
      // Show failed tests
      const failedTests = results.filter(r => !r.success);
      failedTests.forEach(test => {
        console.log(colors.red + `  • ${test.test}: ${test.error}` + colors.reset);
      });
      
      process.exit(1);
    }

    return results;

  } catch (error) {
    log('ERROR', 'Validation failed with unexpected error', { error: error.message });
    console.log('\n' + colors.red + colors.bold + '✗ VALIDATION CRASHED' + colors.reset);
    console.log(colors.red + `  ${error.message}` + colors.reset);
    process.exit(1);
    
  } finally {
    // Cleanup
    await cleanup();
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  log('ERROR', 'Unhandled rejection', { reason, promise });
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  log('ERROR', 'Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

// Run validation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runValidation().catch(error => {
    log('ERROR', 'Validation script failed', { error: error.message });
    process.exit(1);
  });
}

export { runValidation };