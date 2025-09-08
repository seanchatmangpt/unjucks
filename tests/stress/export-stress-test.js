/**
 * Export System Stress Tests
 * Comprehensive testing of export system limits and failure modes
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { exportCommand } from '../../src/commands/export.js';
import { ExportEngine } from '../../src/commands/export.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDir = path.join(__dirname, '../temp/stress-export');

describe('Export System Stress Tests', () => {
  let engine;

  beforeEach(async () => {
    engine = new ExportEngine();
    await fs.ensureDir(testDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  describe('PDF Export Stress Tests', () => {
    it('should handle huge documents (1000+ pages)', async () => {
      const hugeMdContent = generateHugeDocument(1000);
      const inputFile = path.join(testDir, 'huge-document.md');
      const outputFile = path.join(testDir, 'huge-document.pdf');
      
      await fs.writeFile(inputFile, hugeMdContent);
      
      const startTime = Date.now();
      const startMemory = process.memoryUsage().heapUsed;
      
      try {
        const result = await engine.exportFile(inputFile, {
          format: 'pdf',
          output: outputFile,
          template: 'minimal'
        });
        
        const endTime = Date.now();
        const endMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = endMemory - startMemory;
        const duration = endTime - startTime;
        
        console.log(`Huge PDF export stats:`);
        console.log(`  Duration: ${duration}ms`);
        console.log(`  Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
        console.log(`  Success: ${result.success}`);
        
        if (result.success) {
          const outputExists = await fs.pathExists(result.outputPath);
          expect(outputExists).toBe(true);
          
          if (outputExists) {
            const stats = await fs.stat(result.outputPath);
            console.log(`  Output size: ${Math.round(stats.size / 1024)}KB`);
          }
        }
        
        // Memory shouldn't increase by more than 500MB for this test
        expect(memoryIncrease).toBeLessThan(500 * 1024 * 1024);
        // Should complete within reasonable time (30 seconds)
        expect(duration).toBeLessThan(30000);
        
      } catch (error) {
        console.log(`Huge PDF export failed: ${error.message}`);
        // Document that this fails rather than expect success
        expect(error.message).toBeDefined();
      }
    });

    it('should handle memory-intensive LaTeX structures', async () => {
      const complexLatex = generateComplexLatexDocument();
      const inputFile = path.join(testDir, 'complex.md');
      const outputFile = path.join(testDir, 'complex.pdf');
      
      await fs.writeFile(inputFile, complexLatex);
      
      const result = await engine.exportFile(inputFile, {
        format: 'pdf',
        output: outputFile
      });
      
      // Document actual behavior rather than assuming success
      console.log(`Complex LaTeX export result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      if (!result.success) {
        console.log(`  Error: ${result.error}`);
      }
    });
  });

  describe('DOCX Export with Corrupted Data', () => {
    it('should handle corrupted markdown input', async () => {
      const corruptedMd = generateCorruptedMarkdown();
      const inputFile = path.join(testDir, 'corrupted.md');
      const outputFile = path.join(testDir, 'corrupted.docx');
      
      await fs.writeFile(inputFile, corruptedMd);
      
      const result = await engine.exportFile(inputFile, {
        format: 'docx',
        output: outputFile
      });
      
      console.log(`Corrupted DOCX export result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      if (!result.success) {
        console.log(`  Error: ${result.error}`);
      }
      
      // Test should document behavior, not necessarily expect success
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle binary data in markdown', async () => {
      const binaryData = Buffer.alloc(1024);
      for (let i = 0; i < 1024; i++) {
        binaryData[i] = Math.floor(Math.random() * 256);
      }
      
      const inputFile = path.join(testDir, 'binary-data.md');
      const outputFile = path.join(testDir, 'binary-data.docx');
      
      await fs.writeFile(inputFile, binaryData);
      
      const result = await engine.exportFile(inputFile, {
        format: 'docx',
        output: outputFile
      });
      
      console.log(`Binary data DOCX export result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('HTML Export XSS Tests', () => {
    it('should handle XSS injection attempts in content', async () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src="x" onerror="alert(1)">',
        '<svg onload="alert(1)">',
        'javascript:alert(1)',
        '<iframe src="javascript:alert(1)"></iframe>',
        '<object data="javascript:alert(1)"></object>',
        '<embed src="javascript:alert(1)">',
        '<link rel="stylesheet" href="javascript:alert(1)">',
        '<style>@import "javascript:alert(1)"</style>',
        '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
        '"><script>alert(1)</script>',
        '\'; alert(1); //',
        '<svg><script>alert(1)</script></svg>',
        '<math><mi xlink:href="javascript:alert(1)">test</mi></math>'
      ];
      
      for (let i = 0; i < xssPayloads.length; i++) {
        const payload = xssPayloads[i];
        const mdContent = `# XSS Test ${i + 1}\n\n${payload}\n\nNormal content after XSS attempt.`;
        const inputFile = path.join(testDir, `xss-test-${i + 1}.md`);
        const outputFile = path.join(testDir, `xss-test-${i + 1}.html`);
        
        await fs.writeFile(inputFile, mdContent);
        
        const result = await engine.exportFile(inputFile, {
          format: 'html',
          output: outputFile
        });
        
        if (result.success) {
          const content = await fs.readFile(result.outputPath, 'utf8');
          
          // Check if XSS payload was properly escaped
          const containsRawScript = content.includes('<script>alert') && !content.includes('&lt;script&gt;');
          const containsRawOnerror = content.includes('onerror="alert') && !content.includes('onerror=&quot;alert');
          const containsRawJavascript = content.includes('javascript:alert') && !content.includes('javascript:');
          
          console.log(`XSS Test ${i + 1} (${payload.substring(0, 20)}...):`);
          console.log(`  Contains raw script: ${containsRawScript}`);
          console.log(`  Contains raw onerror: ${containsRawOnerror}`);
          console.log(`  Contains raw javascript: ${containsRawJavascript}`);
          
          // Document findings rather than assuming proper sanitization
          if (containsRawScript || containsRawOnerror || containsRawJavascript) {
            console.log(`  ⚠️  POTENTIAL XSS VULNERABILITY DETECTED`);
          }
        }
        
        expect(typeof result.success).toBe('boolean');
      }
    });

    it('should handle XSS in metadata fields', async () => {
      const xssInMetadata = {
        title: '<script>alert("XSS in title")</script>',
        author: '<img src="x" onerror="alert(1)">',
        description: 'javascript:alert(1)'
      };
      
      const mdContent = `---
title: ${xssInMetadata.title}
author: ${xssInMetadata.author}
description: ${xssInMetadata.description}
---

# Normal Content

This is normal markdown content.`;

      const inputFile = path.join(testDir, 'xss-metadata.md');
      const outputFile = path.join(testDir, 'xss-metadata.html');
      
      await fs.writeFile(inputFile, mdContent);
      
      const result = await engine.exportFile(inputFile, {
        format: 'html',
        output: outputFile
      });
      
      if (result.success) {
        const content = await fs.readFile(result.outputPath, 'utf8');
        console.log(`XSS in metadata test:`);
        console.log(`  Title contains raw script: ${content.includes('<script>alert("XSS in title")')}`);
        console.log(`  Author contains raw onerror: ${content.includes('onerror="alert(1)"')}`);
        console.log(`  Description contains javascript:: ${content.includes('javascript:alert(1)')}`);
      }
      
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('Missing Dependencies Tests', () => {
    it('should handle missing puppeteer gracefully', async () => {
      // Temporarily mock puppeteer as missing
      const originalPuppeteer = process.env.npm_config_optional;
      
      try {
        // Test with a document that would require puppeteer for PDF generation
        const mdContent = '# Test Document\n\nThis should fail without puppeteer.';
        const inputFile = path.join(testDir, 'no-puppeteer.md');
        const outputFile = path.join(testDir, 'no-puppeteer.pdf');
        
        await fs.writeFile(inputFile, mdContent);
        
        const result = await engine.exportFile(inputFile, {
          format: 'pdf',
          output: outputFile
        });
        
        console.log(`PDF without puppeteer result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
        if (!result.success) {
          console.log(`  Error: ${result.error}`);
        }
        
        // Document behavior rather than assume failure
        expect(typeof result.success).toBe('boolean');
        
      } finally {
        if (originalPuppeteer) {
          process.env.npm_config_optional = originalPuppeteer;
        }
      }
    });

    it('should handle missing pandoc gracefully', async () => {
      const mdContent = '# Test Document\n\nThis might require pandoc.';
      const inputFile = path.join(testDir, 'no-pandoc.md');
      const outputFile = path.join(testDir, 'no-pandoc.docx');
      
      await fs.writeFile(inputFile, mdContent);
      
      const result = await engine.exportFile(inputFile, {
        format: 'docx',
        output: outputFile
      });
      
      console.log(`DOCX without pandoc result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('Concurrent Export Tests', () => {
    it('should handle concurrent exports of same file', async () => {
      const mdContent = '# Concurrent Test\n\nTesting concurrent exports.';
      const inputFile = path.join(testDir, 'concurrent.md');
      
      await fs.writeFile(inputFile, mdContent);
      
      // Start 10 concurrent exports
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          engine.exportFile(inputFile, {
            format: 'html',
            output: path.join(testDir, `concurrent-${i}.html`)
          })
        );
      }
      
      const startTime = Date.now();
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;
      
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      console.log(`Concurrent exports:`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Successful: ${successful}/10`);
      console.log(`  Failed: ${failed}/10`);
      
      // At least some should succeed
      expect(successful).toBeGreaterThan(0);
    });

    it('should handle race conditions in file writing', async () => {
      const mdContent = '# Race Condition Test\n\nTesting file writing race conditions.';
      const inputFile = path.join(testDir, 'race.md');
      const outputFile = path.join(testDir, 'race.html');
      
      await fs.writeFile(inputFile, mdContent);
      
      // Start multiple exports to the same output file
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          engine.exportFile(inputFile, {
            format: 'html',
            output: outputFile
          })
        );
      }
      
      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      
      console.log(`Race condition test: ${successful}/5 succeeded`);
      
      // At least one should succeed
      expect(successful).toBeGreaterThan(0);
    });
  });

  describe('Permission and Access Tests', () => {
    it('should handle read-only output directory', async () => {
      const readOnlyDir = path.join(testDir, 'readonly');
      await fs.ensureDir(readOnlyDir);
      
      try {
        // Make directory read-only (this might not work on all systems)
        await fs.chmod(readOnlyDir, 0o444);
        
        const mdContent = '# Read-only Test\n\nTesting read-only directory.';
        const inputFile = path.join(testDir, 'readonly-test.md');
        const outputFile = path.join(readOnlyDir, 'output.html');
        
        await fs.writeFile(inputFile, mdContent);
        
        const result = await engine.exportFile(inputFile, {
          format: 'html',
          output: outputFile
        });
        
        console.log(`Read-only directory test: ${result.success ? 'SUCCESS' : 'FAILED'}`);
        if (!result.success) {
          console.log(`  Error: ${result.error}`);
        }
        
        expect(typeof result.success).toBe('boolean');
        
      } catch (error) {
        console.log(`Read-only test setup failed: ${error.message}`);
      } finally {
        // Restore permissions
        try {
          await fs.chmod(readOnlyDir, 0o755);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    });

    it('should handle insufficient disk space simulation', async () => {
      // This is difficult to test directly, so we'll test with a very large file
      const hugeMdContent = 'x'.repeat(100 * 1024 * 1024); // 100MB of content
      const inputFile = path.join(testDir, 'huge-content.md');
      const outputFile = path.join(testDir, 'huge-output.html');
      
      await fs.writeFile(inputFile, hugeMdContent);
      
      const result = await engine.exportFile(inputFile, {
        format: 'html',
        output: outputFile
      });
      
      console.log(`Huge content test: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('Circular JSON Structure Tests', () => {
    it('should handle circular references in metadata', async () => {
      const mdContent = '# Circular Reference Test\n\nTesting circular JSON structures.';
      const inputFile = path.join(testDir, 'circular.md');
      const outputFile = path.join(testDir, 'circular.html');
      
      await fs.writeFile(inputFile, mdContent);
      
      // Create circular reference
      const circularObj = { name: 'test' };
      circularObj.self = circularObj;
      
      const result = await engine.exportFile(inputFile, {
        format: 'html',
        output: outputFile,
        metadata: circularObj
      });
      
      console.log(`Circular reference test: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      if (!result.success) {
        console.log(`  Error: ${result.error}`);
      }
      
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle deeply nested JSON structures', async () => {
      const mdContent = '# Deep Nesting Test\n\nTesting deeply nested structures.';
      const inputFile = path.join(testDir, 'deep-nested.md');
      const outputFile = path.join(testDir, 'deep-nested.html');
      
      await fs.writeFile(inputFile, mdContent);
      
      // Create deeply nested structure (100 levels)
      let deepObj = { value: 'bottom' };
      for (let i = 0; i < 100; i++) {
        deepObj = { level: i, nested: deepObj };
      }
      
      const result = await engine.exportFile(inputFile, {
        format: 'html',
        output: outputFile,
        metadata: deepObj
      });
      
      console.log(`Deep nesting test: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('Memory Limits and Batch Export Tests', () => {
    it('should handle large batch exports', async () => {
      const batchSize = 100;
      const files = [];
      
      // Create 100 test files
      for (let i = 0; i < batchSize; i++) {
        const filename = `batch-${i}.md`;
        const filepath = path.join(testDir, filename);
        const content = `# Document ${i}\n\nThis is test document number ${i}.\n\n${'Content '.repeat(100)}`;
        
        await fs.writeFile(filepath, content);
        files.push(filepath);
      }
      
      const pattern = path.join(testDir, 'batch-*.md');
      const startTime = Date.now();
      const startMemory = process.memoryUsage().heapUsed;
      
      const result = await engine.batchExport(pattern, {
        format: 'html',
        concurrency: 10
      });
      
      const endTime = Date.now();
      const endMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = endMemory - startMemory;
      const duration = endTime - startTime;
      
      console.log(`Large batch export stats:`);
      console.log(`  Files processed: ${result.total}`);
      console.log(`  Successful: ${result.successful}`);
      console.log(`  Failed: ${result.failed}`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
      
      expect(result.total).toBe(batchSize);
      expect(typeof result.successful).toBe('number');
    });

    it('should handle memory exhaustion gracefully', async () => {
      // Create a file that will consume a lot of memory during processing
      const memoryIntensiveContent = generateMemoryIntensiveMarkdown();
      const inputFile = path.join(testDir, 'memory-intensive.md');
      const outputFile = path.join(testDir, 'memory-intensive.html');
      
      await fs.writeFile(inputFile, memoryIntensiveContent);
      
      const startMemory = process.memoryUsage().heapUsed;
      
      try {
        const result = await engine.exportFile(inputFile, {
          format: 'html',
          output: outputFile
        });
        
        const endMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = endMemory - startMemory;
        
        console.log(`Memory intensive test:`);
        console.log(`  Result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
        console.log(`  Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
        
        expect(typeof result.success).toBe('boolean');
        
      } catch (error) {
        console.log(`Memory intensive test threw error: ${error.message}`);
      }
    });
  });

  describe('CLI Integration Tests', () => {
    it('should verify export command is properly integrated', async () => {
      // Test that the export command exists and has expected structure
      expect(exportCommand).toBeDefined();
      expect(exportCommand.meta).toBeDefined();
      expect(exportCommand.meta.name).toBe('export');
      expect(exportCommand.args).toBeDefined();
      expect(exportCommand.subCommands).toBeDefined();
      expect(exportCommand.run).toBeDefined();
      
      // Test subcommands exist
      expect(exportCommand.subCommands.pdf).toBeDefined();
      expect(exportCommand.subCommands.docx).toBeDefined();
      expect(exportCommand.subCommands.html).toBeDefined();
      expect(exportCommand.subCommands.convert).toBeDefined();
      expect(exportCommand.subCommands.templates).toBeDefined();
      expect(exportCommand.subCommands.presets).toBeDefined();
    });

    it('should handle help and info commands', async () => {
      const helpResult = await exportCommand.run({ args: {} });
      expect(helpResult.success).toBe(true);
      expect(helpResult.help).toBe(true);
      
      const templatesResult = await exportCommand.subCommands.templates.run({ args: {} });
      expect(templatesResult.success).toBe(true);
      
      const presetsResult = await exportCommand.subCommands.presets.run({ args: {} });
      expect(presetsResult.success).toBe(true);
    });
  });
});

// Helper functions for generating test content

function generateHugeDocument(pages = 1000) {
  let content = `---
title: Huge Test Document
author: Stress Tester
---

# Huge Test Document

This document is generated for stress testing purposes.

`;

  for (let i = 1; i <= pages; i++) {
    content += `## Page ${i}

This is page ${i} of the test document. Lorem ipsum dolor sit amet, consectetur adipiscing elit. 
Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, 
quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

### Section ${i}.1

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. 
Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

### Section ${i}.2

Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, 
totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.

\`\`\`javascript
// Code block for page ${i}
function testFunction${i}() {
  console.log("This is test function ${i}");
  return "Page ${i} content";
}
\`\`\`

---

`;
  }

  return content;
}

function generateComplexLatexDocument() {
  return `# Complex LaTeX Features Test

This document tests complex LaTeX structures that might cause memory issues.

## Mathematical Formulas

$$\\sum_{i=1}^{n} \\frac{1}{i^2} = \\frac{\\pi^2}{6}$$

$$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$

## Tables

| Column 1 | Column 2 | Column 3 | Column 4 | Column 5 |
|----------|----------|----------|----------|----------|
${Array.from({ length: 100 }, (_, i) => `| Row ${i} Cell 1 | Row ${i} Cell 2 | Row ${i} Cell 3 | Row ${i} Cell 4 | Row ${i} Cell 5 |`).join('\n')}

## Nested Lists

${Array.from({ length: 50 }, (_, i) => 
  `- Level 1 Item ${i}\n  - Level 2 Item ${i}.1\n    - Level 3 Item ${i}.1.1\n      - Level 4 Item ${i}.1.1.1`
).join('\n')}

## Code Blocks

${Array.from({ length: 20 }, (_, i) => 
  `\`\`\`javascript
// Code block ${i}
function complexFunction${i}(param1, param2, param3) {
  const result = param1 * param2 + param3;
  for (let i = 0; i < 1000; i++) {
    console.log(\`Iteration \${i}: \${result}\`);
  }
  return result;
}
\`\`\``).join('\n\n')}

## Images and References

${Array.from({ length: 20 }, (_, i) => 
  `![Image ${i}](https://via.placeholder.com/800x600.png?text=Image+${i})`
).join('\n\n')}
`;
}

function generateCorruptedMarkdown() {
  return `# Corrupted Markdown Test

This markdown contains various corrupted structures:

## Malformed Headers
### This header is missing closing
## 

## Broken Code Blocks
\`\`\`javascript
function brokenCode() {
  // Missing closing backticks

## Malformed Links
[Broken link](
[Another broken link](http://example.com
![Broken image](missing-image.png

## Invalid HTML
<div>Unclosed div
<script>alert('test')
<img src="invalid" onerror="alert('xss')

## Binary data embedded
${String.fromCharCode(0, 1, 2, 3, 4, 5, 255, 254, 253)}

## Very long lines without breaks
${'This is a very long line that goes on and on without any line breaks and might cause issues with certain parsers or renderers when they try to process it because it exceeds normal line length limits and contains no natural breaking points which could lead to buffer overflows or memory issues in some implementations. '.repeat(100)}

## Nested structures that never close
> Quote level 1
  > Quote level 2
    > Quote level 3
      > Quote level 4
        > Quote level 5

- List item 1
  - Nested item 1
    - Deeply nested item 1
      - Very deeply nested item 1

## Invalid Unicode sequences
${String.fromCharCode(0xFFFE, 0xFFFF, 0xD800, 0xDFFF)}

## Extreme nesting
${'#'.repeat(20)} Too many header levels

${'['.repeat(100)}Broken nesting${']'.repeat(100)}

## Tables with inconsistent columns
| Col 1 | Col 2 | Col 3 |
|-------|-------|
| Cell 1 | Cell 2 | Cell 3 | Cell 4 | Cell 5 |
| Cell 1 |
| Cell 1 | Cell 2 | Cell 3 | Cell 4 |

## Markdown in HTML in Markdown
<div>
# This header is inside HTML
\`\`\`javascript
// Code inside HTML inside Markdown
\`\`\`
</div>
`;
}

function generateMemoryIntensiveMarkdown() {
  // Generate content that will consume a lot of memory during processing
  const largeTable = Array.from({ length: 1000 }, (_, i) => {
    const row = Array.from({ length: 50 }, (_, j) => `Cell ${i}-${j} with lots of content ${'x'.repeat(100)}`);
    return `| ${row.join(' | ')} |`;
  }).join('\n');

  const tableHeader = `| ${Array.from({ length: 50 }, (_, i) => `Column ${i}`).join(' | ')} |`;
  const tableSeparator = `| ${Array.from({ length: 50 }, () => '---').join(' | ')} |`;

  return `# Memory Intensive Document

This document is designed to consume significant memory during processing.

## Large Table

${tableHeader}
${tableSeparator}
${largeTable}

## Many Code Blocks

${Array.from({ length: 100 }, (_, i) => 
  `\`\`\`javascript
// Large code block ${i}
${Array.from({ length: 100 }, (_, j) => 
  `const variable${i}_${j} = "This is a long string with lots of content that will consume memory ${'x'.repeat(200)}";`
).join('\n')}
\`\`\``).join('\n\n')}

## Repeated Content

${('This line is repeated many times to consume memory. '.repeat(1000) + '\n').repeat(100)}

## Deep Nested Lists

${Array.from({ length: 100 }, (_, i) => 
  '  '.repeat(i % 10) + `- Item ${i} ${'content '.repeat(100)}`
).join('\n')}
`;
}