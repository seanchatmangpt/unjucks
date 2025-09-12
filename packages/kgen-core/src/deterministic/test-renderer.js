/**
 * KGEN Core Deterministic Renderer Test Suite - Pure JavaScript
 * 
 * Comprehensive tests for the deterministic template system:
 * - Deterministic rendering verification
 * - Custom filters testing
 * - Frontmatter parsing
 * - Template loading
 * - String template rendering
 */

import { DeterministicRenderer } from './renderer.js';
import { FrontmatterParser } from './frontmatter.js';
import { TemplateLoader } from './template-loader.js';

class RendererTester {
  constructor() {
    this.testResults = [];
    this.passed = 0;
    this.failed = 0;
  }
  
  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🧪 Starting KGEN Deterministic Renderer Tests...\n');
    
    // Test modules independently
    await this.testDeterministicRendering();
    await this.testCustomFilters();
    await this.testFrontmatterParsing();
    await this.testTemplateLoader();
    await this.testStringTemplates();
    await this.testIntegration();
    
    this.printResults();
    return this.failed === 0;
  }
  
  /**
   * Test deterministic rendering
   */
  async testDeterministicRendering() {
    console.log('📊 Testing Deterministic Rendering...');
    
    const renderer = new DeterministicRenderer({
      debug: false,
      validateDeterminism: true
    });
    
    // Test 1: Basic deterministic rendering
    await this.test('Basic deterministic rendering', async () => {
      const template = 'Hello {{ name }}! Build: {{ BUILD_TIME }}';
      const context = { name: 'World' };
      
      const result1 = await renderer.renderString(template, context);
      const result2 = await renderer.renderString(template, context);
      
      if (result1.contentHash !== result2.contentHash) {
        throw new Error('Non-deterministic rendering detected');
      }
      
      if (!result1.content.includes('Hello World!')) {
        throw new Error('Template not rendered correctly');
      }
      
      return 'Basic rendering is deterministic';
    });
    
    // Test 2: Object key sorting
    await this.test('Object key sorting', async () => {
      const template = '{{ data | canonical }}';
      const context = { 
        data: { 
          zebra: 1, 
          apple: 2, 
          beta: 3 
        } 
      };
      
      const result = await renderer.renderString(template, context);
      const parsed = JSON.parse(result.content.trim());
      const keys = Object.keys(parsed);
      
      if (JSON.stringify(keys) !== JSON.stringify(['apple', 'beta', 'zebra'])) {
        throw new Error('Keys not sorted deterministically');
      }
      
      return 'Object keys are sorted deterministically';
    });
    
    // Test 3: Deterministic IDs
    await this.test('Deterministic UUIDs', async () => {
      const template = '{{ uuid("test") }}';
      
      const result1 = await renderer.renderString(template, {});
      const result2 = await renderer.renderString(template, {});
      
      if (result1.content !== result2.content) {
        throw new Error('UUIDs are not deterministic');
      }
      
      if (!/^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(result1.content.trim())) {
        throw new Error('UUID format is invalid');
      }
      
      return 'UUIDs are deterministic and well-formed';
    });
    
    console.log('✅ Deterministic rendering tests completed\n');
  }
  
  /**
   * Test custom filters
   */
  async testCustomFilters() {
    console.log('🔧 Testing Custom Filters...');
    
    const renderer = new DeterministicRenderer();
    
    // Test case conversion filters
    await this.test('Case conversion filters', async () => {
      const tests = [
        { filter: 'kebabCase', input: 'Hello World Test', expected: 'hello-world-test' },
        { filter: 'pascalCase', input: 'hello world test', expected: 'HelloWorldTest' },
        { filter: 'camelCase', input: 'hello world test', expected: 'helloWorldTest' },
        { filter: 'snakeCase', input: 'Hello World Test', expected: 'hello_world_test' }
      ];
      
      for (const testCase of tests) {
        const template = `{{ "${testCase.input}" | ${testCase.filter} }}`;
        const result = await renderer.renderString(template, {});
        const output = result.content.trim();
        
        if (output !== testCase.expected) {
          throw new Error(`${testCase.filter}: expected "${testCase.expected}", got "${output}"`);
        }
      }
      
      return 'All case conversion filters work correctly';
    });
    
    // Test hash filter
    await this.test('Hash filter', async () => {
      const template = '{{ "test input" | hash(8) }}';
      const result = await renderer.renderString(template, {});
      const hash = result.content.trim();
      
      if (hash.length !== 8) {
        throw new Error(`Hash length should be 8, got ${hash.length}`);
      }
      
      if (!/^[a-f0-9]{8}$/.test(hash)) {
        throw new Error('Hash should be hexadecimal');
      }
      
      return 'Hash filter works correctly';
    });
    
    // Test array sorting
    await this.test('Array sort filter', async () => {
      const template = '{{ items | sort | join(",") }}';
      const context = { items: ['zebra', 'apple', 'beta'] };
      
      const result = await renderer.renderString(template, context);
      const sorted = result.content.trim();
      
      if (sorted !== 'apple,beta,zebra') {
        throw new Error(`Expected "apple,beta,zebra", got "${sorted}"`);
      }
      
      return 'Array sort filter works correctly';
    });
    
    console.log('✅ Custom filters tests completed\n');
  }
  
  /**
   * Test frontmatter parsing
   */
  async testFrontmatterParsing() {
    console.log('📄 Testing Frontmatter Parsing...');
    
    const parser = new FrontmatterParser();
    
    // Test YAML frontmatter
    await this.test('YAML frontmatter parsing', async () => {
      const content = `---
name: test-template
version: 1.0.0
to: "{{ name }}.txt"
inject: true
---
Hello {{ name }}!`;
      
      const result = parser.parse(content);
      
      if (!result.metadata.hasFrontmatter) {
        throw new Error('Frontmatter not detected');
      }
      
      if (result.data.name !== 'test-template') {
        throw new Error('YAML parsing failed');
      }
      
      if (result.data.inject !== true) {
        throw new Error('Boolean parsing failed');
      }
      
      if (!result.content.includes('Hello {{ name }}!')) {
        throw new Error('Template content extraction failed');
      }
      
      return 'YAML frontmatter parsing works correctly';
    });
    
    // Test JSON frontmatter
    await this.test('JSON frontmatter parsing', async () => {
      const content = `{{{
{
  "name": "json-template",
  "version": "2.0.0",
  "config": {
    "minify": true
  }
}
}}}
JSON template: {{ name }}`;
      
      const result = parser.parse(content);
      
      if (!result.metadata.hasFrontmatter) {
        throw new Error('JSON frontmatter not detected');
      }
      
      if (result.data.name !== 'json-template') {
        throw new Error('JSON parsing failed');
      }
      
      if (result.metadata.format !== 'json') {
        throw new Error('Format detection failed');
      }
      
      return 'JSON frontmatter parsing works correctly';
    });
    
    // Test validation
    await this.test('Frontmatter validation', async () => {
      const data = {
        name: 'valid-template',
        to: 'output.txt',
        inject: true,
        lineAt: 5,
        chmod: '755'
      };
      
      const validation = parser.validate(data);
      
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }
      
      if (!validation.config.inject) {
        throw new Error('Configuration extraction failed');
      }
      
      return 'Frontmatter validation works correctly';
    });
    
    console.log('✅ Frontmatter parsing tests completed\n');
  }
  
  /**
   * Test template loader
   */
  async testTemplateLoader() {
    console.log('📁 Testing Template Loader...');
    
    const loader = new TemplateLoader({
      searchPaths: ['./test-templates'],
      debug: false
    });
    
    // Test string template loading
    await this.test('String template loading', async () => {
      const content = `---
name: string-test
category: test
---
String template: {{ message }}`;
      
      const template = loader.loadTemplateFromString(content, 'test-string');
      
      if (template.id !== 'test-string') {
        throw new Error('Template ID not set correctly');
      }
      
      if (!template.content.includes('String template')) {
        throw new Error('Template content not extracted');
      }
      
      if (template.frontmatter.category !== 'test') {
        throw new Error('Frontmatter not parsed');
      }
      
      return 'String template loading works correctly';
    });
    
    // Test template listing (mock)
    await this.test('Template metadata extraction', async () => {
      const template = loader.loadTemplateFromString(`---
name: meta-test  
description: Test template for metadata
version: 1.2.3
tags: [test, metadata]
---
Template body`, 'meta-test');
      
      if (template.name !== 'meta-test') {
        throw new Error('Name not extracted');
      }
      
      if (template.version !== '1.2.3') {
        throw new Error('Version not extracted');
      }
      
      if (!Array.isArray(template.tags) || template.tags[0] !== 'test') {
        throw new Error('Tags not extracted');
      }
      
      return 'Template metadata extraction works correctly';
    });
    
    console.log('✅ Template loader tests completed\n');
  }
  
  /**
   * Test string templates
   */
  async testStringTemplates() {
    console.log('📝 Testing String Templates...');
    
    const renderer = new DeterministicRenderer();
    
    // Test string rendering
    await this.test('String template rendering', async () => {
      const template = 'Hello {{ name | pascalCase }}! Random: {{ random("seed1") }}';
      const context = { name: 'john doe' };
      
      const result = await renderer.renderString(template, context);
      
      if (!result.content.includes('Hello JohnDoe!')) {
        throw new Error('String template not rendered correctly');
      }
      
      if (!result.deterministic) {
        throw new Error('String template should be deterministic');
      }
      
      return 'String template rendering works correctly';
    });
    
    // Test frontmatter in string templates
    await this.test('String template with frontmatter', async () => {
      const template = `---
title: Test Page
minify: true
---
# {{ title }}
Content goes here.`;
      
      const result = await renderer.renderString(template, {});
      
      if (!result.content.includes('# Test Page')) {
        throw new Error('Frontmatter variables not applied');
      }
      
      if (result.frontmatter.minify !== true) {
        throw new Error('Frontmatter not parsed from string template');
      }
      
      return 'String templates with frontmatter work correctly';
    });
    
    console.log('✅ String templates tests completed\n');
  }
  
  /**
   * Test integration scenarios
   */
  async testIntegration() {
    console.log('🔗 Testing Integration Scenarios...');
    
    const renderer = new DeterministicRenderer({
      validateDeterminism: true,
      debug: false
    });
    
    // Test complex template with all features
    await this.test('Complex template integration', async () => {
      const template = `---
name: complex-test
version: 1.0.0  
category: integration
to: "generated/{{ name | kebabCase }}.md"
---
# {{ name | pascalCase }} v{{ version }}

**Category:** {{ category }}
**Generated:** {{ BUILD_TIME }}  
**Hash:** {{ content | hash(8) }}

## Data Processing
{{ data | canonical }}

## Sorted Items
{% for item in items | sort %}
- {{ item | pascalCase }}
{% endfor %}

## UUID: {{ uuid("namespace", name) }}
`;
      
      const context = {
        content: 'test content',
        data: { zebra: 1, apple: 2, beta: 3 },
        items: ['gamma', 'alpha', 'beta']
      };
      
      const result = await renderer.renderString(template, context);
      
      // Verify frontmatter processing
      if (result.frontmatter.name !== 'complex-test') {
        throw new Error('Frontmatter not processed');
      }
      
      // Verify template rendering
      if (!result.content.includes('# ComplexTest v1.0.0')) {
        throw new Error('Template not rendered correctly');
      }
      
      // Verify filter application
      if (!result.content.includes('"apple": 2')) {
        throw new Error('Canonical filter not applied');
      }
      
      // Verify deterministic UUID
      const uuidMatch = result.content.match(/UUID: ([a-f0-9-]+)/);
      if (!uuidMatch || !/^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(uuidMatch[1])) {
        throw new Error('UUID not generated correctly');
      }
      
      return 'Complex template integration works correctly';
    });
    
    // Test deterministic rendering with iterations
    await this.test('Multi-iteration determinism', async () => {
      const template = `{{ data | canonical }}{{ uuid("test") }}{{ random("seed") }}`;
      const context = { data: { c: 3, a: 1, b: 2 } };
      
      const hashes = new Set();
      const iterations = 10;
      
      for (let i = 0; i < iterations; i++) {
        renderer.clearCache(); // Force fresh render
        const result = await renderer.renderString(template, context);
        hashes.add(result.contentHash);
      }
      
      if (hashes.size !== 1) {
        throw new Error(`Expected 1 unique hash, got ${hashes.size}`);
      }
      
      return `${iterations} iterations produced identical output`;
    });
    
    console.log('✅ Integration tests completed\n');
  }
  
  /**
   * Test helper function
   */
  async test(name, testFn) {
    try {
      const result = await testFn();
      console.log(`  ✅ ${name}: ${result}`);
      this.testResults.push({ name, status: 'passed', result });
      this.passed++;
    } catch (error) {
      console.log(`  ❌ ${name}: ${error.message}`);
      this.testResults.push({ name, status: 'failed', error: error.message });
      this.failed++;
    }
  }
  
  /**
   * Print test results summary
   */
  printResults() {
    console.log('═'.repeat(60));
    console.log(`🧪 Test Results: ${this.passed} passed, ${this.failed} failed`);
    console.log('═'.repeat(60));
    
    if (this.failed === 0) {
      console.log('🎉 All tests passed! KGEN Deterministic Renderer is working correctly.');
    } else {
      console.log('❌ Some tests failed. Check the output above for details.');
      console.log('\nFailed tests:');
      for (const result of this.testResults) {
        if (result.status === 'failed') {
          console.log(`  - ${result.name}: ${result.error}`);
        }
      }
    }
    
    console.log('═'.repeat(60));
  }
}

// Export for use as module or run directly
// Export for use as module or run directly
  const tester = new RendererTester();
  tester.runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export { RendererTester };