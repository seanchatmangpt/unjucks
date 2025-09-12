/**
 * Deterministic Processing Performance Tests
 * 
 * Tests performance targets and reproducibility for the
 * deterministic Office/LaTeX processing system.
 * 
 * @module deterministic-processing-test
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DeterministicProcessor } from '../src/office/deterministic-processor.js';
import { OPCNormalizer } from '../src/office/normalization/opc-normalizer.js';
import { LaTeXNormalizer } from '../src/office/normalization/latex-normalizer.js';
import { TemplateLinter } from '../src/office/normalization/template-linter.js';
import { SemanticDiffer } from '../src/office/normalization/semantic-differ.js';
import { CASIntegration } from '../src/office/integration/cas-integration.js';
import { GitIntegration } from '../src/office/integration/git-integration.js';
import fs from 'fs/promises';
import path from 'path';
import { performance } from 'perf_hooks';

describe('Deterministic Processing Performance', () => {
  let processor;
  let testDir;
  let opcNormalizer;
  let latexNormalizer;
  let templateLinter;
  let semanticDiffer;
  let casIntegration;
  let gitIntegration;

  beforeEach(async () => {
    // Create test directory
    testDir = `/tmp/kgen-test-${this.getDeterministicTimestamp()}-${Math.random().toString(36).substr(2, 9)}`;
    await fs.mkdir(testDir, { recursive: true });

    // Initialize processors with performance tracking
    processor = new DeterministicProcessor({
      enableOPCNormalization: true,
      enableLaTeXNormalization: true,
      enableTemplateLinting: true,
      enableSemanticDiffing: true,
      performanceTracking: true
    });

    opcNormalizer = new OPCNormalizer();
    latexNormalizer = new LaTeXNormalizer();
    templateLinter = new TemplateLinter();
    semanticDiffer = new SemanticDiffer();
    
    casIntegration = new CASIntegration({
      casDirectory: `${testDir}/.cas`
    });
    
    gitIntegration = new GitIntegration({
      repoPath: testDir
    });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Office Normalization Performance', () => {
    it('should normalize Office documents within 30ms target', async () => {
      // Create test Office document (minimal DOCX structure)
      const testDocx = await createTestDocx();
      
      const startTime = performance.now();
      const normalized = await opcNormalizer.normalizeOfficeDocument(testDocx);
      const endTime = performance.now();
      
      const processingTime = endTime - startTime;
      
      expect(processingTime).toBeLessThan(30); // 30ms target
      expect(normalized).toBeInstanceOf(Buffer);
      expect(normalized.length).toBeGreaterThan(0);
      
      console.log(`Office normalization completed in ${processingTime.toFixed(2)}ms`);
    });

    it('should achieve consistent normalization times', async () => {
      const testDocx = await createTestDocx();
      const times = [];
      const runs = 10;
      
      for (let i = 0; i < runs; i++) {
        const startTime = performance.now();
        await opcNormalizer.normalizeOfficeDocument(testDocx);
        const endTime = performance.now();
        times.push(endTime - startTime);
      }
      
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      const variance = maxTime - minTime;
      
      expect(avgTime).toBeLessThan(30);
      expect(variance).toBeLessThan(20); // Consistent performance
      
      console.log(`Average normalization time: ${avgTime.toFixed(2)}ms (${minTime.toFixed(2)}ms - ${maxTime.toFixed(2)}ms)`);
    });
  });

  describe('LaTeX Normalization Performance', () => {
    it('should normalize LaTeX documents within 50ms target', async () => {
      const testLatex = createTestLatexContent();
      
      const startTime = performance.now();
      const normalized = latexNormalizer.normalizeLaTeX(testLatex);
      const endTime = performance.now();
      
      const processingTime = endTime - startTime;
      
      expect(processingTime).toBeLessThan(50); // 50ms target
      expect(typeof normalized).toBe('string');
      expect(normalized.length).toBeGreaterThan(0);
      
      console.log(`LaTeX normalization completed in ${processingTime.toFixed(2)}ms`);
    });

    it('should achieve deterministic LaTeX output', async () => {
      const testLatex = createTestLatexContent();
      const normalizedVersions = [];
      
      // Generate multiple normalized versions
      for (let i = 0; i < 5; i++) {
        const normalized = latexNormalizer.normalizeLaTeX(testLatex);
        normalizedVersions.push(normalized);
      }
      
      // All versions should be identical
      const firstVersion = normalizedVersions[0];
      for (let i = 1; i < normalizedVersions.length; i++) {
        expect(normalizedVersions[i]).toBe(firstVersion);
      }
      
      console.log('LaTeX normalization is deterministic across multiple runs');
    });
  });

  describe('Template Linting Performance', () => {
    it('should complete template linting efficiently', async () => {
      const testTemplate = createTestTemplate();
      
      const startTime = performance.now();
      const lintResult = templateLinter.lintTemplate(testTemplate);
      const endTime = performance.now();
      
      const processingTime = endTime - startTime;
      
      expect(processingTime).toBeLessThan(10); // Fast linting
      expect(lintResult).toHaveProperty('valid');
      expect(lintResult).toHaveProperty('issues');
      
      console.log(`Template linting completed in ${processingTime.toFixed(2)}ms`);
    });

    it('should detect non-deterministic patterns correctly', async () => {
      const nonDeterministicTemplate = `
        Hello {{ userName }},
        Today's date is {{ now() }}.
        Random ID: {{ Math.random() }}
        Process ID: {{ process.pid }}
      `;
      
      const startTime = performance.now();
      const lintResult = templateLinter.lintTemplate(nonDeterministicTemplate);
      const endTime = performance.now();
      
      expect(lintResult.valid).toBe(false);
      expect(lintResult.errors.length).toBeGreaterThan(0);
      
      // Should detect at least these patterns
      const errorTypes = lintResult.errors.map(e => e.type);
      expect(errorTypes).toContain('datetime');
      expect(errorTypes).toContain('math-random');
      expect(errorTypes).toContain('system');
      
      console.log(`Detected ${lintResult.errors.length} non-deterministic patterns in ${(endTime - startTime).toFixed(2)}ms`);
    });
  });

  describe('Reproducibility Testing', () => {
    it('should achieve 99.9% reproducibility target', async () => {
      const templateContent = createDeterministicTemplate();
      const context = {
        title: 'Test Document',
        date: '2024-01-01',
        author: 'Test Author'
      };
      
      // Create temporary template file
      const templatePath = `${testDir}/test-template.txt`;
      await fs.writeFile(templatePath, templateContent);
      
      const hashes = [];
      const runs = 100; // Test with 100 runs for statistical significance
      
      for (let i = 0; i < runs; i++) {
        const outputPath = `${testDir}/output-${i}.txt`;
        
        const result = await processor.processTemplate(
          templatePath,
          context,
          outputPath
        );
        
        expect(result.success).toBe(true);
        expect(result.deterministic).toBe(true);
        
        if (result.contentHash) {
          hashes.push(result.contentHash);
        }
      }
      
      // Calculate reproducibility rate
      const uniqueHashes = new Set(hashes).size;
      const reproducibilityRate = ((runs - uniqueHashes + 1) / runs) * 100;
      
      expect(reproducibilityRate).toBeGreaterThanOrEqual(99.9);
      
      console.log(`Reproducibility rate: ${reproducibilityRate.toFixed(3)}% (${uniqueHashes} unique hashes out of ${runs} runs)`);
    });

    it('should maintain performance under load', async () => {
      const templateContent = createDeterministicTemplate();
      const context = { title: 'Load Test', date: '2024-01-01' };
      
      const templatePath = `${testDir}/load-template.txt`;
      await fs.writeFile(templatePath, templateContent);
      
      const concurrentRuns = 10;
      const promises = [];
      
      const startTime = performance.now();
      
      for (let i = 0; i < concurrentRuns; i++) {
        const outputPath = `${testDir}/concurrent-${i}.txt`;
        promises.push(
          processor.processTemplate(templatePath, context, outputPath)
        );
      }
      
      const results = await Promise.all(promises);
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      const avgTimePerRun = totalTime / concurrentRuns;
      
      // All should succeed
      results.forEach((result, i) => {
        expect(result.success).toBe(true);
        expect(result.deterministic).toBe(true);
      });
      
      // Performance should not degrade significantly
      expect(avgTimePerRun).toBeLessThan(200); // 200ms per run average
      
      console.log(`Concurrent processing: ${concurrentRuns} runs in ${totalTime.toFixed(2)}ms (avg: ${avgTimePerRun.toFixed(2)}ms per run)`);
    });
  });

  describe('CAS Integration Performance', () => {
    it('should store and retrieve documents efficiently', async () => {
      const testContent = Buffer.from('Test document content for CAS storage');
      
      // Store document
      const storeStartTime = performance.now();
      const storeResult = await casIntegration.storeDocument(testContent, {
        type: 'test-document',
        source: 'performance-test'
      });
      const storeEndTime = performance.now();
      
      expect(storeResult.hash).toBeDefined();
      expect(storeResult.existed).toBe(false);
      
      // Retrieve document
      const retrieveStartTime = performance.now();
      const retrieveResult = await casIntegration.retrieveDocument(storeResult.hash);
      const retrieveEndTime = performance.now();
      
      expect(retrieveResult.content).toEqual(testContent);
      
      const storeTime = storeEndTime - storeStartTime;
      const retrieveTime = retrieveEndTime - retrieveStartTime;
      
      expect(storeTime).toBeLessThan(20); // Fast storage
      expect(retrieveTime).toBeLessThan(10); // Fast retrieval
      
      console.log(`CAS store: ${storeTime.toFixed(2)}ms, retrieve: ${retrieveTime.toFixed(2)}ms`);
    });

    it('should demonstrate deduplication efficiency', async () => {
      const testContent = Buffer.from('Identical content for deduplication test');
      
      // First storage
      const firstResult = await casIntegration.storeDocument(testContent);
      expect(firstResult.existed).toBe(false);
      
      // Second storage (should be deduplicated)
      const startTime = performance.now();
      const secondResult = await casIntegration.storeDocument(testContent);
      const endTime = performance.now();
      
      expect(secondResult.existed).toBe(true);
      expect(secondResult.hash).toBe(firstResult.hash);
      
      const deduplicationTime = endTime - startTime;
      expect(deduplicationTime).toBeLessThan(5); // Very fast deduplication
      
      console.log(`Deduplication check completed in ${deduplicationTime.toFixed(2)}ms`);
    });
  });

  describe('Overall System Performance', () => {
    it('should meet end-to-end performance targets', async () => {
      const templateContent = createComplexTemplate();
      const context = createComplexContext();
      
      const templatePath = `${testDir}/complex-template.txt`;
      await fs.writeFile(templatePath, templateContent);
      
      const startTime = performance.now();
      
      const result = await processor.processTemplate(
        templatePath,
        context,
        `${testDir}/complex-output.txt`
      );
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      expect(result.success).toBe(true);
      expect(result.deterministic).toBe(true);
      expect(result.reproducible).toBe(true);
      
      // Overall performance target
      expect(totalTime).toBeLessThan(150); // 150ms p95 target
      
      const metrics = processor.getMetrics();
      expect(metrics.averageNormalizationTime).toBeLessThan(30);
      
      console.log(`End-to-end processing completed in ${totalTime.toFixed(2)}ms`);
      console.log(`Metrics:`, metrics);
    });

    it('should handle memory efficiently', async () => {
      const initialMemory = process.memoryUsage();
      
      // Process multiple documents
      const runs = 50;
      const promises = [];
      
      for (let i = 0; i < runs; i++) {
        const templateContent = createTestTemplate();
        const templatePath = `${testDir}/memory-test-${i}.txt`;
        
        promises.push(
          (async () => {
            await fs.writeFile(templatePath, templateContent);
            return processor.processTemplate(
              templatePath,
              { index: i, data: `test-data-${i}` },
              `${testDir}/memory-output-${i}.txt`
            );
          })()
        );
      }
      
      await Promise.all(promises);
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
      
      console.log(`Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB for ${runs} documents`);
    });
  });

  // Helper functions
  async function createTestDocx() {
    // Create minimal DOCX structure for testing
    const fflate = await import('fflate');
    
    const files = {
      '[Content_Types].xml': new TextEncoder().encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`),
      '_rels/.rels': new TextEncoder().encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`),
      'word/document.xml': new TextEncoder().encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>Test document content</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`)
    };
    
    return Buffer.from(fflate.zipSync(files));
  }

  function createTestLatexContent() {
    return `
\\documentclass{article}
\\usepackage{amsmath}
\\usepackage{graphicx}
\\title{Test Document}
\\author{Test Author}
\\date{\\today}

\\begin{document}
\\maketitle

\\section{Introduction}
This is a test document for LaTeX normalization.

\\subsection{Mathematics}
Here is an equation:
\\begin{equation}
E = mc^2
\\end{equation}

\\section{Conclusion}
This concludes our test document.

\\end{document}
    `;
  }

  function createTestTemplate() {
    return `
Hello {{ userName }},

This is a deterministic template.
Date: {{ buildDate }}
Version: {{ version }}

Best regards,
{{ signature }}
    `;
  }

  function createDeterministicTemplate() {
    return `
# {{ title }}

**Author:** {{ author }}  
**Date:** {{ date }}

## Content

This is a deterministic template that should produce
identical output every time it is processed with the
same input data.

## Variables

- Title: {{ title }}
- Author: {{ author }}
- Date: {{ date }}
    `;
  }

  function createComplexTemplate() {
    return `
# Complex Template: {{ title }}

{% for item in items %}
## Item {{ loop.index }}: {{ item.name }}

**Description:** {{ item.description }}  
**Price:** ${{ item.price | number(2) }}  
**Category:** {{ item.category }}

{% if item.features %}
### Features:
{% for feature in item.features %}
- {{ feature }}
{% endfor %}
{% endif %}

---

{% endfor %}

## Summary

Total items: {{ items | length }}  
Generated on: {{ buildDate }}  
Version: {{ version }}
    `;
  }

  function createComplexContext() {
    return {
      title: 'Product Catalog',
      buildDate: '2024-01-01T00:00:00Z',
      version: '1.0.0',
      items: [
        {
          name: 'Product A',
          description: 'High-quality product A',
          price: 99.99,
          category: 'Electronics',
          features: ['Feature 1', 'Feature 2', 'Feature 3']
        },
        {
          name: 'Product B',
          description: 'Reliable product B',
          price: 149.99,
          category: 'Hardware',
          features: ['Feature X', 'Feature Y']
        },
        {
          name: 'Product C',
          description: 'Premium product C',
          price: 249.99,
          category: 'Software'
        }
      ]
    };
  }
});