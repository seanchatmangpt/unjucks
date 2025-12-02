/**
 * Canonical Byte Output Test
 * 
 * Verifies that the single DeterministicRenderer produces canonical bytes
 * for all supported formats including Office/LaTeX
 */

import { DeterministicRenderer } from '../kgen/packages/kgen-templates/src/renderer/deterministic.js';
import { createHash } from 'crypto';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';

const OUTPUT_DIR = './tests/output';

// Ensure output directory exists
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Test canonical output for different formats
 */
async function testCanonicalOutput() {
  console.log('🧪 Testing canonical byte output for all formats...\n');

  const renderer = new DeterministicRenderer({
    staticBuildTime: '2024-01-01T00:00:00.000Z',
    enableCaching: false,
    strictMode: true
  });

  // Test data with deterministic values
  const testContext = {
    title: 'Test Document',
    content: 'This is deterministic test content',
    items: ['Item 1', 'Item 2', 'Item 3'],
    author: 'KGEN Templates',
    timestamp: '2024-01-01T00:00:00.000Z'
  };

  const formats = [
    {
      name: 'Plain Text',
      template: `---
to: "{{title | replace(' ', '-') | lower}}.txt"
---
# {{title}}

Author: {{author}}
Generated: {{timestamp}}

Content:
{{content}}

Items:
{% for item in items %}
- {{item}}
{% endfor %}`,
      expectedExtensions: ['.txt']
    },
    {
      name: 'Word Document',
      template: `---
to: "{{title | replace(' ', '-') | lower}}.docx"
---
# {{title}}

Author: {{author}}
Generated: {{timestamp}}

Content:
{{content}}

Items:
{% for item in items %}
- {{item}}
{% endfor %}`,
      expectedExtensions: ['.docx']
    },
    {
      name: 'Excel Spreadsheet',
      template: `---
to: "{{title | replace(' ', '-') | lower}}.xlsx"
---
Title,Value
Author,{{author}}
Generated,{{timestamp}}
Content,{{content}}
{% for item in items %}
Item,{{item}}
{% endfor %}`,
      expectedExtensions: ['.xlsx']
    },
    {
      name: 'LaTeX Document',
      template: `---
to: "{{title | replace(' ', '-') | lower}}.tex"
---
\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}
\\usepackage{graphicx}

\\title{{{title}}}
\\author{{{author}}}
\\date{{{timestamp}}}

\\begin{document}

\\maketitle

\\section{Content}
{{content}}

\\section{Items}
\\begin{itemize}
{% for item in items %}
\\item {{item}}
{% endfor %}
\\end{itemize}

\\end{document}`,
      expectedExtensions: ['.tex', '.latex']
    }
  ];

  const results = [];

  for (const format of formats) {
    console.log(`🔍 Testing ${format.name}...`);
    
    try {
      // Create temporary template file
      const templatePath = resolve(OUTPUT_DIR, `test-template-${format.name.replace(' ', '-').toLowerCase()}.njk`);
      writeFileSync(templatePath, format.template);

      // First render
      const result1 = await renderer.render(templatePath, testContext);
      if (!result1.success) {
        throw new Error(`First render failed: ${result1.error}`);
      }

      // Second render (should be identical)
      const result2 = await renderer.render(templatePath, testContext);
      if (!result2.success) {
        throw new Error(`Second render failed: ${result2.error}`);
      }

      // Calculate hashes
      const hash1 = createHash('sha256').update(result1.content).digest('hex');
      const hash2 = createHash('sha256').update(result2.content).digest('hex');

      const isDeterministic = hash1 === hash2;
      const contentSize = result1.content.length;

      // Save output for inspection
      const outputPath = resolve(OUTPUT_DIR, `canonical-output-${format.name.replace(' ', '-').toLowerCase()}`);
      writeFileSync(outputPath, result1.content);

      results.push({
        format: format.name,
        deterministic: isDeterministic,
        contentHash: hash1,
        contentSize,
        outputPath,
        renderTime: result1.metadata.renderTime
      });

      if (isDeterministic) {
        console.log(`✅ ${format.name}: Deterministic (${contentSize} bytes, hash: ${hash1.substring(0, 16)}...)`);
      } else {
        console.log(`❌ ${format.name}: Non-deterministic! Hash mismatch!`);
        console.log(`   First:  ${hash1}`);
        console.log(`   Second: ${hash2}`);
      }

    } catch (error) {
      console.log(`❌ ${format.name}: Error - ${error.message}`);
      results.push({
        format: format.name,
        deterministic: false,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * Test injection functionality
 */
async function testInjectionCanonical() {
  console.log('\n🧪 Testing injection determinism...\n');

  const renderer = new DeterministicRenderer({
    staticBuildTime: '2024-01-01T00:00:00.000Z',
    enableCaching: false,
    strictMode: true
  });

  // Create base file for injection
  const baseFile = resolve(OUTPUT_DIR, 'injection-target.js');
  const baseContent = `// Base JavaScript file
export function example() {
  return 'Hello World';
}

// End of base file`;

  writeFileSync(baseFile, baseContent);

  // Injection template
  const injectionTemplate = `---
to: "${baseFile}"
inject: true
after: "// End of base file"
---

// Injected deterministic content
export function injected() {
  return '{{message}}';
}`;

  const templatePath = resolve(OUTPUT_DIR, 'injection-template.njk');
  writeFileSync(templatePath, injectionTemplate);

  const testContext = { message: 'Deterministic injection' };

  try {
    // First injection
    const result1 = await renderer.renderToFile(templatePath, testContext);
    if (!result1.success) {
      throw new Error(`First injection failed: ${result1.error}`);
    }

    // Read result and calculate hash
    const injectedContent1 = require('fs').readFileSync(baseFile, 'utf8');
    const hash1 = createHash('sha256').update(injectedContent1).digest('hex');

    // Reset base file
    writeFileSync(baseFile, baseContent);

    // Second injection
    const result2 = await renderer.renderToFile(templatePath, testContext);
    if (!result2.success) {
      throw new Error(`Second injection failed: ${result2.error}`);
    }

    // Read result and calculate hash
    const injectedContent2 = require('fs').readFileSync(baseFile, 'utf8');
    const hash2 = createHash('sha256').update(injectedContent2).digest('hex');

    const isDeterministic = hash1 === hash2;

    if (isDeterministic) {
      console.log(`✅ Injection: Deterministic (hash: ${hash1.substring(0, 16)}...)`);
    } else {
      console.log(`❌ Injection: Non-deterministic! Hash mismatch!`);
      console.log(`   First:  ${hash1}`);
      console.log(`   Second: ${hash2}`);
    }

    return {
      deterministic: isDeterministic,
      contentHash: hash1,
      outputPath: baseFile
    };

  } catch (error) {
    console.log(`❌ Injection: Error - ${error.message}`);
    return {
      deterministic: false,
      error: error.message
    };
  }
}

/**
 * Test health check functionality
 */
async function testHealthCheck() {
  console.log('\n🧪 Testing renderer health check...\n');

  const renderer = new DeterministicRenderer({
    staticBuildTime: '2024-01-01T00:00:00.000Z',
    enableCaching: false,
    strictMode: true
  });

  try {
    const health = await renderer.healthCheck();
    
    if (health.status === 'healthy' && health.deterministic && health.renderTest) {
      console.log('✅ Health Check: Passed');
      console.log(`   Status: ${health.status}`);
      console.log(`   Deterministic: ${health.deterministic}`);
      console.log(`   Render Test: ${health.renderTest}`);
      return { passed: true, health };
    } else {
      console.log('❌ Health Check: Failed');
      console.log(`   Status: ${health.status}`);
      console.log(`   Error: ${health.error || 'Unknown'}`);
      return { passed: false, health };
    }
  } catch (error) {
    console.log(`❌ Health Check: Error - ${error.message}`);
    return { passed: false, error: error.message };
  }
}

/**
 * Main test runner
 */
async function runTests() {
  const startTime = Date.now();
  
  console.log('🚀 KGEN Canonical Output Test Suite\n');
  console.log('Testing single DeterministicRenderer entry point...\n');

  try {
    // Run all tests
    const outputResults = await testCanonicalOutput();
    const injectionResult = await testInjectionCanonical();
    const healthResult = await testHealthCheck();

    // Summary
    console.log('\n📊 Test Summary:');
    console.log('================');

    const deterministicCount = outputResults.filter(r => r.deterministic).length;
    const totalFormats = outputResults.length;
    
    console.log(`Format Tests: ${deterministicCount}/${totalFormats} deterministic`);
    console.log(`Injection Test: ${injectionResult.deterministic ? 'PASS' : 'FAIL'}`);
    console.log(`Health Check: ${healthResult.passed ? 'PASS' : 'FAIL'}`);

    const allPassed = deterministicCount === totalFormats && 
                     injectionResult.deterministic && 
                     healthResult.passed;

    console.log(`\nOverall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    console.log(`Test Duration: ${Date.now() - startTime}ms`);

    // Output detailed results
    console.log('\n📝 Detailed Results:');
    console.log('====================');
    
    outputResults.forEach(result => {
      console.log(`${result.format}: ${result.deterministic ? '✅' : '❌'} ${result.contentHash?.substring(0, 16) || 'N/A'}...`);
      if (result.error) console.log(`  Error: ${result.error}`);
    });

    return {
      success: allPassed,
      results: {
        formats: outputResults,
        injection: injectionResult,
        health: healthResult
      }
    };

  } catch (error) {
    console.error('❌ Test suite failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().then(result => {
    process.exit(result.success ? 0 : 1);
  });
}

export { runTests, testCanonicalOutput, testInjectionCanonical, testHealthCheck };