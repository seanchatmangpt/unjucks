#!/usr/bin/env node

/**
 * Comprehensive Export System Test Suite
 * Tests all export formats and identifies issues
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const testDir = path.join(rootDir, 'temp');
const outputDir = path.join(rootDir, 'output');

// Test data
const testMarkdown = `# Test Document

This is a comprehensive test of export functionality.

## Features Tested

### Text Formatting
- **Bold text**
- *Italic text*
- \`Inline code\`

### Lists
1. Numbered item
2. Another item

- Bullet point
- Another bullet

### Code Block
\`\`\`javascript
console.log('Hello, World!');
\`\`\`

### Links and Images
[Test Link](https://example.com)
![Test Image](https://via.placeholder.com/150)

### Table
| Column 1 | Column 2 |
|----------|----------|
| Data 1   | Data 2   |
| Data 3   | Data 4   |
`;

class ExportSystemTester {
  constructor() {
    this.results = {};
    this.testFiles = {};
    this.cliPath = path.join(rootDir, 'bin/unjucks.cjs');
  }

  async initialize() {
    console.log('🚀 Initializing Export System Test Suite...');
    
    // Create directories
    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });
    
    // Create test files
    this.testFiles.markdown = path.join(testDir, 'test-export.md');
    await fs.writeFile(this.testFiles.markdown, testMarkdown);
    
    console.log('✅ Test environment initialized');
  }

  async testExportCommand() {
    console.log('\n📋 Testing Export Command Structure...');
    
    try {
      const helpOutput = execSync(`${this.cliPath} export --help`, { encoding: 'utf8' });
      console.log('✅ Export command help accessible');
      
      // Test subcommands
      const subcommands = ['pdf', 'docx', 'html', 'templates', 'presets'];
      for (const cmd of subcommands) {
        try {
          execSync(`${this.cliPath} export ${cmd} --help`, { encoding: 'utf8', stdio: 'pipe' });
          console.log(`✅ Export ${cmd} command accessible`);
        } catch (error) {
          console.log(`❌ Export ${cmd} command failed: ${error.message}`);
        }
      }
      
    } catch (error) {
      console.log(`❌ Export command structure test failed: ${error.message}`);
    }
  }

  async testPdfExport() {
    console.log('\n🔴 Testing PDF Export...');
    
    try {
      // Test with markdown file
      const outputPath = path.join(outputDir, 'test-pdf-export');
      const result = execSync(
        `${this.cliPath} export pdf "${this.testFiles.markdown}" --output "${outputPath}" --verbose`,
        { encoding: 'utf8' }
      );
      
      console.log('PDF Export Result:', result);
      
      // Check if file was created
      const possibleFiles = [
        `${outputPath}.pdf`,
        `${outputPath}.tex`
      ];
      
      let fileCreated = false;
      for (const file of possibleFiles) {
        try {
          await fs.access(file);
          const stats = await fs.stat(file);
          console.log(`✅ PDF export created file: ${file} (${stats.size} bytes)`);
          fileCreated = true;
          break;
        } catch (e) {
          // File doesn't exist, try next
        }
      }
      
      if (!fileCreated) {
        console.log('❌ PDF export did not create output file');
      }
      
    } catch (error) {
      console.log(`❌ PDF export failed: ${error.message}`);
    }
  }

  async testDocxExport() {
    console.log('\n📄 Testing DOCX Export...');
    
    try {
      // Test direct command
      const outputPath = path.join(outputDir, 'test-docx-export');
      const result = execSync(
        `${this.cliPath} export-docx "${this.testFiles.markdown}" --output "${outputPath}" --verbose`,
        { encoding: 'utf8' }
      );
      
      console.log('DOCX Export Result:', result);
      
      // Check if file was created
      const outputFile = `${outputPath}.docx`;
      try {
        await fs.access(outputFile);
        const stats = await fs.stat(outputFile);
        console.log(`✅ DOCX export created file: ${outputFile} (${stats.size} bytes)`);
        
        // Validate it's actually a DOCX file (should start with PK for ZIP format)
        const buffer = await fs.readFile(outputFile);
        if (buffer[0] === 0x50 && buffer[1] === 0x4B) {
          console.log('✅ DOCX file format validation passed');
        } else {
          console.log('⚠️ DOCX file format may be invalid');
        }
        
      } catch (e) {
        console.log(`❌ DOCX export did not create output file: ${outputFile}`);
      }
      
    } catch (error) {
      console.log(`❌ DOCX export failed: ${error.message}`);
    }
  }

  async testHtmlExport() {
    console.log('\n🌐 Testing HTML Export...');
    
    try {
      // Test via export subcommand
      const outputPath = path.join(outputDir, 'test-html-export');
      const result = execSync(
        `${this.cliPath} export html "${this.testFiles.markdown}" --output "${outputPath}" --verbose`,
        { encoding: 'utf8' }
      );
      
      console.log('HTML Export Result:', result);
      
      // Check if file was created
      const outputFile = `${outputPath}.html`;
      try {
        await fs.access(outputFile);
        const stats = await fs.stat(outputFile);
        console.log(`✅ HTML export created file: ${outputFile} (${stats.size} bytes)`);
        
        // Validate HTML content
        const htmlContent = await fs.readFile(outputFile, 'utf8');
        if (htmlContent.includes('<!DOCTYPE html>') && htmlContent.includes('<html>')) {
          console.log('✅ HTML file structure validation passed');
          
          // Check for CSS
          if (htmlContent.includes('<style>') || htmlContent.includes('.css')) {
            console.log('✅ HTML includes styling');
          } else {
            console.log('⚠️ HTML missing CSS styling');
          }
          
          // Check for content conversion
          if (htmlContent.includes('<h1>') && htmlContent.includes('<strong>')) {
            console.log('✅ Markdown to HTML conversion working');
          } else {
            console.log('⚠️ Markdown conversion may be incomplete');
          }
          
        } else {
          console.log('❌ HTML file structure validation failed');
        }
        
      } catch (e) {
        console.log(`❌ HTML export did not create output file: ${outputFile}`);
      }
      
    } catch (error) {
      console.log(`❌ HTML export failed: ${error.message}`);
    }
  }

  async testRtfExport() {
    console.log('\n📝 Testing RTF Export...');
    
    try {
      // Test via general export command
      const outputPath = path.join(outputDir, 'test-rtf-export.rtf');
      const result = execSync(
        `${this.cliPath} export "${this.testFiles.markdown}" --format rtf --output "${outputPath}" --verbose`,
        { encoding: 'utf8' }
      );
      
      console.log('RTF Export Result:', result);
      
      // Check if file was created
      try {
        await fs.access(outputPath);
        const stats = await fs.stat(outputPath);
        console.log(`✅ RTF export created file: ${outputPath} (${stats.size} bytes)`);
        
        // Validate RTF content
        const rtfContent = await fs.readFile(outputPath, 'utf8');
        if (rtfContent.startsWith('{\\rtf1')) {
          console.log('✅ RTF file format validation passed');
        } else {
          console.log('❌ RTF file format validation failed');
        }
        
      } catch (e) {
        console.log(`❌ RTF export did not create output file: ${outputPath}`);
      }
      
    } catch (error) {
      console.log(`❌ RTF export failed: ${error.message}`);
    }
  }

  async testBatchExport() {
    console.log('\n📦 Testing Batch Export...');
    
    try {
      // Create multiple test files
      const testFiles = [];
      for (let i = 1; i <= 3; i++) {
        const filename = path.join(testDir, `batch-test-${i}.md`);
        await fs.writeFile(filename, `# Document ${i}\n\nThis is test document ${i}.\n\n## Content\n\nSome content here.`);
        testFiles.push(filename);
      }
      
      // Test batch export
      const pattern = path.join(testDir, 'batch-test-*.md');
      const result = execSync(
        `${this.cliPath} export "${pattern}" --format html --all --output-dir "${outputDir}" --verbose`,
        { encoding: 'utf8' }
      );
      
      console.log('Batch Export Result:', result);
      
      // Check if files were created
      let successCount = 0;
      for (let i = 1; i <= 3; i++) {
        const outputFile = path.join(outputDir, `batch-test-${i}.html`);
        try {
          await fs.access(outputFile);
          successCount++;
          console.log(`✅ Batch export created: batch-test-${i}.html`);
        } catch (e) {
          console.log(`❌ Batch export failed for: batch-test-${i}.html`);
        }
      }
      
      if (successCount === 3) {
        console.log('✅ Batch export fully successful');
      } else {
        console.log(`⚠️ Batch export partially successful (${successCount}/3)`);
      }
      
    } catch (error) {
      console.log(`❌ Batch export failed: ${error.message}`);
    }
  }

  async testDependencies() {
    console.log('\n🔧 Testing Export Dependencies...');
    
    // Check for optional dependencies
    const dependencies = [
      { name: 'pandoc', cmd: 'pandoc --version', purpose: 'LaTeX/HTML to DOCX conversion' },
      { name: 'pdflatex', cmd: 'pdflatex --version', purpose: 'LaTeX to PDF compilation' },
      { name: 'xelatex', cmd: 'xelatex --version', purpose: 'Advanced LaTeX to PDF compilation' }
    ];
    
    for (const dep of dependencies) {
      try {
        execSync(dep.cmd, { stdio: 'pipe' });
        console.log(`✅ ${dep.name} available - ${dep.purpose}`);
      } catch (error) {
        console.log(`❌ ${dep.name} not available - ${dep.purpose}`);
      }
    }
    
    // Check Node.js packages
    const packages = ['docx', 'pdfkit', 'puppeteer-core', 'officegen'];
    for (const pkg of packages) {
      try {
        execSync(`node -e "require('${pkg}')"`, { stdio: 'pipe' });
        console.log(`✅ ${pkg} package available`);
      } catch (error) {
        console.log(`❌ ${pkg} package not available`);
      }
    }
  }

  async generateReport() {
    console.log('\n📊 Generating Comprehensive Export System Report...');
    
    const report = {
      timestamp: this.getDeterministicDate().toISOString(),
      testResults: this.results,
      recommendations: []
    };
    
    // Add recommendations based on test results
    if (this.results.pdfFailed) {
      report.recommendations.push('Install LaTeX distribution (TeX Live/MiKTeX) for PDF export');
    }
    if (this.results.docxIssues) {
      report.recommendations.push('Install pandoc for better DOCX conversion quality');
    }
    if (this.results.dependencyIssues) {
      report.recommendations.push('Install optional dependencies: npm install docx pdfkit puppeteer-core');
    }
    
    const reportPath = path.join(outputDir, 'export-system-test-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📋 Full test report saved to: ${reportPath}`);
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up test files...');
    
    try {
      // Remove temporary test files
      const tempFiles = await fs.readdir(testDir);
      for (const file of tempFiles) {
        if (file.startsWith('test-') || file.startsWith('batch-test-')) {
          await fs.unlink(path.join(testDir, file));
        }
      }
      console.log('✅ Test cleanup completed');
    } catch (error) {
      console.warn(`⚠️ Cleanup warning: ${error.message}`);
    }
  }

  async runAllTests() {
    console.log('🎯 Export System Quality Assurance Test Suite\n');
    console.log('Testing all export formats and functionality...\n');
    
    await this.initialize();
    
    await this.testExportCommand();
    await this.testPdfExport();
    await this.testDocxExport();
    await this.testHtmlExport();
    await this.testRtfExport();
    await this.testBatchExport();
    await this.testDependencies();
    
    await this.generateReport();
    await this.cleanup();
    
    console.log('\n🎉 Export System Testing Complete!');
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new ExportSystemTester();
  tester.runAllTests().catch(console.error);
}

export default ExportSystemTester;