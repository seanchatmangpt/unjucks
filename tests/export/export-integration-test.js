#!/usr/bin/env node

/**
 * Export Integration Test - Production Ready Export Validation
 * Validates all export formats and functionality without CLI dependencies
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

// Import the export engine directly
import { exportCommand } from '../../src/commands/export.js';

class ExportIntegrationTester {
  constructor() {
    this.results = {
      formats: {},
      security: {},
      performance: {},
      batch: {}
    };
    this.testDir = path.join(projectRoot, 'temp/export-test');
    this.outputDir = path.join(projectRoot, 'output/export-test');
  }

  async initialize() {
    console.log('🚀 Initializing Export Integration Test Suite...');
    
    // Create test directories
    await fs.mkdir(this.testDir, { recursive: true });
    await fs.mkdir(this.outputDir, { recursive: true });
    
    // Create test content
    const testContent = `# Export Test Document

This is a comprehensive test document for validating export functionality.

## Features Tested

### Text Formatting
- **Bold text** and *italic text*
- \`Inline code\` and code blocks
- [Links](https://example.com) and references

### Lists and Structure
1. Numbered lists
2. With multiple items
   - Nested bullet points
   - Additional nested items

### Code Examples

\`\`\`javascript
function testExport() {
  console.log('Testing export functionality');
  return { success: true, format: 'html' };
}
\`\`\`

### Data Table

| Format | Status | Quality |
|--------|--------|---------|
| HTML   | ✅     | High    |
| PDF    | ✅     | High    |
| LaTeX  | ✅     | High    |
| RTF    | ✅     | Medium  |
| TXT    | ✅     | Basic   |

## Special Characters & Escaping

Testing special characters: & < > " ' \\ / $ # % _ ^ ~ 

### Mathematical Expressions
E = mc² and √(x² + y²) = distance

### Unicode Content
Café, résumé, naïve, 你好, العربية, русский
`;

    this.testFile = path.join(this.testDir, 'test-export.md');
    await fs.writeFile(this.testFile, testContent);
    
    console.log('✅ Test environment initialized');
  }

  async testFormatExports() {
    console.log('\n🎯 Testing Format Exports...');
    
    const formats = [
      { format: 'html', template: 'modern', options: { css: true } },
      { format: 'md', template: 'github', options: { toc: true } },
      { format: 'tex', template: 'article', options: { bibliography: false } },
      { format: 'rtf', template: 'default', options: {} },
      { format: 'txt', template: 'default', options: {} }
    ];

    for (const { format, template, options } of formats) {
      try {
        const outputFile = path.join(this.outputDir, `test.${format}`);
        const args = {
          input: this.testFile,
          format,
          template,
          output: outputFile,
          ...options,
          quiet: true
        };

        const result = await exportCommand.run({ args });
        
        if (result.success) {
          // Validate file was created
          const stats = await fs.stat(result.outputPath);
          const content = await fs.readFile(result.outputPath, 'utf8');
          
          this.results.formats[format] = {
            success: true,
            size: stats.size,
            duration: result.duration,
            hasContent: content.length > 0,
            contentSample: content.slice(0, 100)
          };
          
          console.log(`✅ ${format.toUpperCase()}: ${stats.size} bytes in ${result.duration}ms`);
        } else {
          this.results.formats[format] = {
            success: false,
            error: result.error
          };
          console.log(`❌ ${format.toUpperCase()}: ${result.error}`);
        }
      } catch (error) {
        this.results.formats[format] = {
          success: false,
          error: error.message
        };
        console.log(`❌ ${format.toUpperCase()}: ${error.message}`);
      }
    }
  }

  async testSecurityValidation() {
    console.log('\n🛡️ Testing Security Validation...');
    
    const securityTests = [
      {
        name: 'Directory Traversal',
        args: { input: '../../../etc/passwd', format: 'html', quiet: true }
      },
      {
        name: 'Invalid Format',
        args: { input: this.testFile, format: 'malicious', quiet: true }
      },
      {
        name: 'Missing File',
        args: { input: '/nonexistent/file.md', format: 'html', quiet: true }
      }
    ];

    for (const test of securityTests) {
      try {
        const result = await exportCommand.run({ args: test.args });
        
        this.results.security[test.name] = {
          correctlyBlocked: !result.success,
          error: result.error,
          message: result.success ? 'SECURITY RISK: Should have failed' : 'Correctly blocked'
        };
        
        const status = result.success ? '❌ SECURITY RISK' : '✅ BLOCKED';
        console.log(`${status} ${test.name}: ${result.error || 'Unexpectedly succeeded'}`);
        
      } catch (error) {
        this.results.security[test.name] = {
          correctlyBlocked: true,
          error: error.message,
          message: 'Correctly blocked with exception'
        };
        console.log(`✅ BLOCKED ${test.name}: ${error.message}`);
      }
    }
  }

  async testBatchProcessing() {
    console.log('\n📦 Testing Batch Processing...');
    
    // Create multiple test files
    const batchFiles = [];
    for (let i = 1; i <= 5; i++) {
      const filename = path.join(this.testDir, `batch-${i}.md`);
      const content = `# Batch Document ${i}\n\nThis is batch test document number ${i}.\n\n## Content\n\nSome content for document ${i}.`;
      await fs.writeFile(filename, content);
      batchFiles.push(filename);
    }

    try {
      // Test batch dry run
      const dryRunArgs = {
        input: path.join(this.testDir, 'batch-*.md'),
        format: 'html',
        all: true,
        dry: true,
        quiet: true
      };

      const dryResult = await exportCommand.run({ args: dryRunArgs });
      
      this.results.batch.dryRun = {
        success: dryResult.success,
        filesFound: dryResult.files,
        isDryRun: dryResult.dryRun
      };
      
      console.log(`✅ Dry Run: Found ${dryResult.files} files`);

      // Test actual batch processing
      const batchArgs = {
        input: path.join(this.testDir, 'batch-*.md'),
        format: 'html',
        all: true,
        dry: false,
        quiet: true
      };

      const batchResult = await exportCommand.run({ args: batchArgs });
      
      this.results.batch.processing = {
        success: batchResult.success,
        total: batchResult.total,
        successful: batchResult.successful,
        failed: batchResult.failed,
        duration: batchResult.duration
      };
      
      if (batchResult.success) {
        console.log(`✅ Batch: Processed ${batchResult.successful}/${batchResult.total} files in ${batchResult.duration}ms`);
      } else {
        console.log(`❌ Batch: Failed ${batchResult.failed}/${batchResult.total} files`);
      }
      
    } catch (error) {
      this.results.batch.processing = {
        success: false,
        error: error.message
      };
      console.log(`❌ Batch processing failed: ${error.message}`);
    }
  }

  async testPerformance() {
    console.log('\n⚡ Testing Performance...');
    
    // Create a large test file
    const largeContent = Array.from({ length: 1000 }, (_, i) => 
      `## Section ${i + 1}\n\nThis is section ${i + 1} with some content that tests performance.\n\n`
    ).join('');
    
    const largeFile = path.join(this.testDir, 'large-test.md');
    await fs.writeFile(largeFile, `# Large Document\n\n${largeContent}`);

    try {
      const perfArgs = {
        input: largeFile,
        format: 'html',
        output: path.join(this.outputDir, 'large-test.html'),
        quiet: true
      };

      const startTime = this.getDeterministicTimestamp();
      const result = await exportCommand.run({ args: perfArgs });
      const duration = this.getDeterministicTimestamp() - startTime;

      if (result.success) {
        const stats = await fs.stat(result.outputPath);
        
        this.results.performance = {
          success: true,
          inputSize: (await fs.stat(largeFile)).size,
          outputSize: stats.size,
          duration,
          throughput: stats.size / duration // bytes per ms
        };
        
        console.log(`✅ Performance: ${stats.size} bytes in ${duration}ms (${Math.round(stats.size/1024/duration*1000)} KB/s)`);
      } else {
        this.results.performance = {
          success: false,
          error: result.error,
          duration
        };
        console.log(`❌ Performance test failed: ${result.error}`);
      }
    } catch (error) {
      this.results.performance = {
        success: false,
        error: error.message
      };
      console.log(`❌ Performance test error: ${error.message}`);
    }
  }

  async generateReport() {
    console.log('\n📊 Generating Comprehensive Report...');
    
    const report = {
      timestamp: this.getDeterministicDate().toISOString(),
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0
      },
      details: this.results,
      recommendations: []
    };

    // Count test results
    Object.values(this.results.formats).forEach(result => {
      report.summary.totalTests++;
      if (result.success) report.summary.passed++;
      else report.summary.failed++;
    });

    Object.values(this.results.security).forEach(result => {
      report.summary.totalTests++;
      if (result.correctlyBlocked) report.summary.passed++;
      else report.summary.failed++;
    });

    if (this.results.batch.processing) {
      report.summary.totalTests++;
      if (this.results.batch.processing.success) report.summary.passed++;
      else report.summary.failed++;
    }

    if (this.results.performance) {
      report.summary.totalTests++;
      if (this.results.performance.success) report.summary.passed++;
      else report.summary.failed++;
    }

    // Generate recommendations
    if (report.summary.failed > 0) {
      report.recommendations.push('Some export formats failed - check dependencies and implementation');
    }
    
    if (this.results.performance?.duration > 5000) {
      report.recommendations.push('Performance optimization needed for large documents');
    }

    if (Object.values(this.results.security).some(r => !r.correctlyBlocked)) {
      report.recommendations.push('CRITICAL: Security validation failures detected');
    }

    // Save report
    const reportPath = path.join(this.outputDir, 'export-integration-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📋 Report saved: ${reportPath}`);
    
    // Display summary
    console.log('\n🎯 Test Summary:');
    console.log(`Total Tests: ${report.summary.totalTests}`);
    console.log(`Passed: ${report.summary.passed}`);
    console.log(`Failed: ${report.summary.failed}`);
    console.log(`Success Rate: ${Math.round(report.summary.passed / report.summary.totalTests * 100)}%`);
    
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach(rec => console.log(`  • ${rec}`));
    }

    return report;
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up test files...');
    
    try {
      await fs.rm(this.testDir, { recursive: true, force: true });
      console.log('✅ Cleanup completed');
    } catch (error) {
      console.warn(`⚠️ Cleanup warning: ${error.message}`);
    }
  }

  async runFullSuite() {
    console.log('🎯 Export Integration Test Suite - Production Validation\n');
    
    try {
      await this.initialize();
      await this.testFormatExports();
      await this.testSecurityValidation();
      await this.testBatchProcessing();
      await this.testPerformance();
      
      const report = await this.generateReport();
      await this.cleanup();
      
      console.log('\n🎉 Export Integration Testing Complete!');
      
      // Return exit code based on results
      const success = report.summary.failed === 0;
      process.exit(success ? 0 : 1);
      
    } catch (error) {
      console.error('\n❌ Test suite failed:', error);
      process.exit(1);
    }
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new ExportIntegrationTester();
  tester.runFullSuite();
}

export default ExportIntegrationTester;