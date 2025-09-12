/**
 * TEMPLATE STRESS TESTING SUITE
 * Comprehensive performance and stress testing for optimized template system
 * Tests large templates, complex operations, and performance limits
 */

const fs = require('fs').promises;
const path = require('path');
const { performance } = require('perf_hooks');
const { OptimizedTemplateEngine } = require('./optimized-template-engine');
const { AdvancedFrontmatterProcessor } = require('./advanced-frontmatter-processor');

class TemplateStressTester {
  constructor(options = {}) {
    this.testDir = options.testDir || path.join(__dirname, '../test-templates');
    this.engine = new OptimizedTemplateEngine({
      templateDir: this.testDir,
      enableCaching: true,
      enableInheritance: true,
      enableMacros: true,
      enablePerformanceProfiler: true
    });
    
    this.frontmatterProcessor = new AdvancedFrontmatterProcessor({
      enableCaching: true
    });
    
    this.results = {
      stress: {},
      performance: {},
      compliance: {},
      errors: []
    };
  }

  /**
   * Run all stress tests
   */
  async runAllTests() {
    console.log('🚀 Starting template stress testing suite...\n');
    
    const startTime = performance.now();
    
    try {
      // Ensure test directory exists
      await this.ensureTestDirectory();
      
      // Generate test templates
      await this.generateTestTemplates();
      
      // Run stress tests
      await this.testLargeTemplatePerformance();
      await this.testComplexTemplateOperations();
      await this.testConcurrentRendering();
      await this.testMemoryUsage();
      await this.testCachePerformance();
      await this.testVariableExtractionLimits();
      await this.testFrontmatterComplexity();
      await this.testPerformanceCompliance();
      
      // Generate final report
      const duration = performance.now() - startTime;
      await this.generateStressTestReport(duration);
      
      return this.results;
      
    } catch (error) {
      this.results.errors.push({
        test: 'suite_execution',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Ensure test directory exists
   */
  async ensureTestDirectory() {
    try {
      await fs.access(this.testDir);
    } catch {
      await fs.mkdir(this.testDir, { recursive: true });
    }
  }

  /**
   * Generate test templates of various sizes and complexity
   */
  async generateTestTemplates() {
    console.log('📝 Generating test templates...');
    
    const templates = [
      { name: 'large-simple', size: 'large', complexity: 'simple' },
      { name: 'large-complex', size: 'large', complexity: 'complex' },
      { name: 'huge-simple', size: 'huge', complexity: 'simple' },
      { name: 'complex-nested', size: 'medium', complexity: 'nested' },
      { name: 'macro-intensive', size: 'medium', complexity: 'macros' },
      { name: 'variable-heavy', size: 'medium', complexity: 'variables' }
    ];
    
    for (const template of templates) {
      await this.generateTestTemplate(template);
    }
  }

  /**
   * Generate individual test template
   */
  async generateTestTemplate({ name, size, complexity }) {
    const templatePath = path.join(this.testDir, `${name}.njk`);
    
    let content = this.generateFrontmatter(complexity);
    content += this.generateTemplateBody(size, complexity);
    
    await fs.writeFile(templatePath, content);
  }

  /**
   * Generate frontmatter based on complexity
   */
  generateFrontmatter(complexity) {
    const frontmatters = {
      simple: `---
title: Test Template
author: Stress Tester
date: 2024-01-01
---\n\n`,
      
      complex: `---
metadata:
  title: Complex Test Template
  description: A template with complex frontmatter for testing
  tags: [performance, testing, templates]
  settings:
    cache: true
    optimize: true
    parallel: false
configuration:
  rendering:
    mode: strict
    timeout: 30000
  validation:
    required_fields: [title, content, data]
    schema_version: "1.0"
data:
  users:
    - name: John Doe
      email: john@example.com
      roles: [admin, user]
    - name: Jane Smith  
      email: jane@example.com
      roles: [user]
  settings:
    theme: dark
    language: en
    timezone: UTC
---\n\n`,
      
      nested: `+++
[metadata]
title = "Nested Test Template"
version = "1.0"

[data]
count = 1000
items = ["item1", "item2", "item3"]

[data.nested]
deep = true
level = 3

[performance]
target = 10
compliance = 95
+++\n\n`,
      
      macros: `---
macros:
  - name: renderUser
    params: [user, index]
    template: "{{ index }}: {{ user.name }} ({{ user.email }})"
  - name: formatDate
    params: [date, format]
    template: "{{ date | dateFormat(format) }}"
includes: [header, footer, sidebar]
---\n\n`,
      
      variables: `---
variables:
  strings: [name, title, description, content, author, version]
  numbers: [count, index, total, max, min, avg]
  booleans: [active, enabled, visible, cached, optimized]
  objects: [user, config, metadata, settings]
  arrays: [items, users, tags, categories, sections]
---\n\n`
    };
    
    return frontmatters[complexity] || frontmatters.simple;
  }

  /**
   * Generate template body based on size and complexity
   */
  generateTemplateBody(size, complexity) {
    const sizes = {
      small: 100,    // ~100 lines
      medium: 500,   // ~500 lines
      large: 2000,   // ~2000 lines
      huge: 10000    // ~10000 lines
    };
    
    const lineCount = sizes[size] || sizes.medium;
    const lines = [];
    
    // Header
    lines.push('<h1>{{ title | default("Test Template") }}</h1>');
    lines.push('<p>Generated on {{ currentDateTime }}</p>');
    lines.push('');
    
    if (complexity === 'simple') {
      // Simple repetitive content
      for (let i = 0; i < lineCount - 10; i++) {
        lines.push(`<p>Line ${i + 1}: {{ content_${i % 10} | default("Default content") }}</p>`);
      }
    } else if (complexity === 'complex') {
      // Complex nested operations
      lines.push('{% for section in sections | default([]) %}');
      lines.push('  <section id="{{ section.id | kebabCase }}">');
      lines.push('    <h2>{{ section.title | capitalize }}</h2>');
      lines.push('    {% if section.items %}');
      lines.push('      <ul>');
      lines.push('      {% for item in section.items %}');
      lines.push('        {% if item.visible | default(true) %}');
      lines.push('        <li class="{{ loop.index % 2 == 0 ? "even" : "odd" }}">');
      lines.push('          {{ item.name | title }} - {{ item.value | default("N/A") }}');
      lines.push('          {% if item.metadata %}');
      lines.push('            <small>({{ item.metadata | jsonify }})</small>');
      lines.push('          {% endif %}');
      lines.push('        </li>');
      lines.push('        {% endif %}');
      lines.push('      {% endfor %}');
      lines.push('      </ul>');
      lines.push('    {% else %}');
      lines.push('      <p>No items available</p>');
      lines.push('    {% endif %}');
      lines.push('  </section>');
      lines.push('{% endfor %}');
      
      // Fill remaining lines with complex operations
      const remaining = lineCount - lines.length - 10;
      for (let i = 0; i < remaining; i++) {
        const ops = [
          `{{ variable_${i % 50} | filter1 | filter2 | default("fallback") }}`,
          `{% if condition_${i % 20} %}Content {{ i }}{% else %}Alt {{ i }}{% endif %}`,
          `{{ data.nested.array[${i % 10}] | transform | validate | render }}`,
          `{% for item in dataset_${i % 5} %}{{ item.prop }}{% endfor %}`
        ];
        lines.push(`<div>${ops[i % 4]}</div>`);
      }
    } else if (complexity === 'nested') {
      // Deeply nested loops and conditions
      let depth = 0;
      const maxDepth = 5;
      
      for (let i = 0; i < lineCount / 10; i++) {
        if (depth < maxDepth && Math.random() > 0.3) {
          lines.push(`${'  '.repeat(depth)}{% for item_${depth} in collection_${i % 10} %}`);
          lines.push(`${'  '.repeat(depth + 1)}{% if item_${depth}.active %}`);
          depth += 2;
        } else if (depth > 0 && Math.random() > 0.5) {
          lines.push(`${'  '.repeat(depth - 1)}{% endif %}`);
          lines.push(`${'  '.repeat(depth - 2)}{% endfor %}`);
          depth -= 2;
        } else {
          lines.push(`${'  '.repeat(depth)}<p>{{ item_${depth / 2 | 0}.value_${i % 20} }}</p>`);
        }
      }
      
      // Close all remaining blocks
      while (depth > 0) {
        lines.push(`${'  '.repeat(depth - 1)}{% endif %}`);
        lines.push(`${'  '.repeat(depth - 2)}{% endfor %}`);
        depth -= 2;
      }
    } else if (complexity === 'macros') {
      // Macro-intensive template
      lines.push('{% macro renderCard(item, index, class) %}');
      lines.push('<div class="{{ class | default("card") }} card-{{ index }}">');
      lines.push('  <h3>{{ item.title | title }}</h3>');
      lines.push('  <p>{{ item.description | truncate(100) }}</p>');
      lines.push('  {% if item.metadata %}');
      lines.push('    {{ renderMetadata(item.metadata) }}');
      lines.push('  {% endif %}');
      lines.push('</div>');
      lines.push('{% endmacro %}');
      lines.push('');
      lines.push('{% macro renderMetadata(meta) %}');
      lines.push('<dl class="metadata">');
      lines.push('{% for key, value in meta %}');
      lines.push('  <dt>{{ key | title }}</dt>');
      lines.push('  <dd>{{ value | escape }}</dd>');
      lines.push('{% endfor %}');
      lines.push('</dl>');
      lines.push('{% endmacro %}');
      lines.push('');
      
      for (let i = 0; i < (lineCount - 20) / 3; i++) {
        lines.push(`{{ renderCard(items[${i % 100}], ${i}, "item-" + ${i % 5}) }}`);
        lines.push(`{{ renderMetadata(metadata_${i % 10}) }}`);
        lines.push('');
      }
    } else if (complexity === 'variables') {
      // Variable-heavy template
      const variableTypes = ['string', 'number', 'boolean', 'array', 'object'];
      
      for (let i = 0; i < lineCount; i++) {
        const type = variableTypes[i % variableTypes.length];
        const varName = `var_${type}_${i}`;
        
        if (type === 'array') {
          lines.push(`{% for item in ${varName} | default([]) %}`);
          lines.push(`  <span>{{ loop.index }}: {{ item.value_${i % 10} }}</span>`);
          lines.push(`{% endfor %}`);
        } else if (type === 'object') {
          lines.push(`{% if ${varName} %}`);
          lines.push(`  {{ ${varName}.prop_${i % 20} | filter_${i % 5} | default("empty") }}`);
          lines.push(`{% endif %}`);
        } else {
          lines.push(`{{ ${varName} | transform_${i % 15} | validate | render }}`);
        }
      }
    }
    
    // Footer
    lines.push('');
    lines.push('<footer>');
    lines.push('  <p>Template rendered at: {{ currentDateTime }}</p>');
    lines.push('  <p>Total variables: {{ variables | length | default(0) }}</p>');
    lines.push('</footer>');
    
    return lines.join('\n');
  }

  /**
   * Test large template performance
   */
  async testLargeTemplatePerformance() {
    console.log('📊 Testing large template performance...');
    
    const testData = {
      title: 'Large Template Performance Test',
      sections: Array.from({ length: 100 }, (_, i) => ({
        id: `section-${i}`,
        title: `Section ${i + 1}`,
        items: Array.from({ length: 50 }, (_, j) => ({
          name: `Item ${j + 1}`,
          value: Math.random() * 1000,
          visible: Math.random() > 0.1,
          metadata: { index: j, random: Math.random() }
        }))
      }))
    };

    const tests = [
      { template: 'large-simple', data: testData },
      { template: 'large-complex', data: testData },
      { template: 'huge-simple', data: testData }
    ];

    this.results.stress.largeTemplates = {};

    for (const test of tests) {
      try {
        const iterations = test.template === 'huge-simple' ? 3 : 10;
        const times = [];

        for (let i = 0; i < iterations; i++) {
          const startTime = performance.now();
          await this.engine.render(test.template, test.data);
          const duration = performance.now() - startTime;
          times.push(duration);
        }

        this.results.stress.largeTemplates[test.template] = {
          iterations,
          avgTime: times.reduce((a, b) => a + b, 0) / times.length,
          maxTime: Math.max(...times),
          minTime: Math.min(...times),
          times,
          compliance: times.filter(t => t <= 10).length / times.length,
          status: times.every(t => t <= 50) ? 'PASS' : 'FAIL'
        };

      } catch (error) {
        this.results.errors.push({
          test: `large_template_${test.template}`,
          error: error.message
        });
      }
    }
  }

  /**
   * Test complex template operations
   */
  async testComplexTemplateOperations() {
    console.log('🔧 Testing complex template operations...');

    const complexData = {
      title: 'Complex Operations Test',
      users: Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `User ${i}`,
        email: `user${i}@example.com`,
        active: Math.random() > 0.2,
        roles: ['user', 'viewer'].concat(Math.random() > 0.8 ? ['admin'] : []),
        metadata: { joinDate: new Date(), score: Math.random() * 100 }
      })),
      settings: { theme: 'dark', language: 'en', version: '2.0' }
    };

    const tests = [
      'complex-nested',
      'macro-intensive', 
      'variable-heavy'
    ];

    this.results.stress.complexOperations = {};

    for (const template of tests) {
      try {
        const times = [];
        const iterations = 5;

        for (let i = 0; i < iterations; i++) {
          const startTime = performance.now();
          await this.engine.render(template, complexData);
          const duration = performance.now() - startTime;
          times.push(duration);
        }

        this.results.stress.complexOperations[template] = {
          iterations,
          avgTime: times.reduce((a, b) => a + b, 0) / times.length,
          maxTime: Math.max(...times),
          times,
          compliance: times.filter(t => t <= 25).length / times.length,
          status: times.every(t => t <= 100) ? 'PASS' : 'FAIL'
        };

      } catch (error) {
        this.results.errors.push({
          test: `complex_operations_${template}`,
          error: error.message
        });
      }
    }
  }

  /**
   * Test concurrent rendering performance
   */
  async testConcurrentRendering() {
    console.log('⚡ Testing concurrent rendering...');

    const testData = {
      title: 'Concurrent Test',
      items: Array.from({ length: 100 }, (_, i) => ({ id: i, value: `Item ${i}` }))
    };

    const concurrencyLevels = [1, 5, 10, 20, 50];
    this.results.stress.concurrency = {};

    for (const level of concurrencyLevels) {
      try {
        const startTime = performance.now();
        
        const promises = Array.from({ length: level }, (_, i) => 
          this.engine.render('large-simple', { ...testData, id: i })
        );

        await Promise.all(promises);
        const totalTime = performance.now() - startTime;
        const avgTimePerRender = totalTime / level;

        this.results.stress.concurrency[`level_${level}`] = {
          concurrentRequests: level,
          totalTime,
          avgTimePerRender,
          status: avgTimePerRender <= 10 ? 'PASS' : 'FAIL'
        };

      } catch (error) {
        this.results.errors.push({
          test: `concurrent_rendering_${level}`,
          error: error.message
        });
      }
    }
  }

  /**
   * Test memory usage under load
   */
  async testMemoryUsage() {
    console.log('💾 Testing memory usage...');

    const initialMemory = process.memoryUsage();
    const memorySnapshots = [initialMemory];

    // Generate large dataset
    const largeData = {
      massiveArray: Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        data: `Data entry ${i}`.repeat(100),
        nested: {
          level1: { level2: { level3: `Deep data ${i}` } }
        }
      }))
    };

    try {
      // Render multiple templates with large data
      for (let i = 0; i < 50; i++) {
        await this.engine.render('large-complex', largeData);
        
        if (i % 10 === 0) {
          memorySnapshots.push(process.memoryUsage());
        }
      }

      const finalMemory = process.memoryUsage();
      memorySnapshots.push(finalMemory);

      this.results.stress.memory = {
        initial: initialMemory,
        final: finalMemory,
        snapshots: memorySnapshots,
        peakHeapUsed: Math.max(...memorySnapshots.map(s => s.heapUsed)),
        memoryGrowth: finalMemory.heapUsed - initialMemory.heapUsed,
        status: (finalMemory.heapUsed - initialMemory.heapUsed) < 100 * 1024 * 1024 ? 'PASS' : 'FAIL' // 100MB limit
      };

    } catch (error) {
      this.results.errors.push({
        test: 'memory_usage',
        error: error.message
      });
    }
  }

  /**
   * Test cache performance
   */
  async testCachePerformance() {
    console.log('🏆 Testing cache performance...');

    const testData = { title: 'Cache Test', items: Array.from({ length: 1000 }, (_, i) => ({ id: i })) };
    
    try {
      // Clear cache and warm up
      this.engine.clearCaches();
      
      // First render (cold cache)
      const coldStart = performance.now();
      await this.engine.render('large-simple', testData);
      const coldTime = performance.now() - coldStart;
      
      // Subsequent renders (warm cache)
      const warmTimes = [];
      for (let i = 0; i < 10; i++) {
        const warmStart = performance.now();
        await this.engine.render('large-simple', testData);
        warmTimes.push(performance.now() - warmStart);
      }
      
      const avgWarmTime = warmTimes.reduce((a, b) => a + b, 0) / warmTimes.length;
      const speedup = coldTime / avgWarmTime;
      const cacheStats = this.engine.getPerformanceMetrics().cacheStats;
      
      this.results.stress.cache = {
        coldRenderTime: coldTime,
        avgWarmRenderTime: avgWarmTime,
        speedupFactor: speedup,
        cacheHitRate: cacheStats.hitRate,
        cacheSize: cacheStats.size,
        status: speedup >= 2 && cacheStats.hitRate >= 0.8 ? 'PASS' : 'FAIL'
      };
      
    } catch (error) {
      this.results.errors.push({
        test: 'cache_performance',
        error: error.message
      });
    }
  }

  /**
   * Test variable extraction limits
   */
  async testVariableExtractionLimits() {
    console.log('🔍 Testing variable extraction limits...');

    try {
      // Create template with many variables
      const manyVariablesTemplate = Array.from({ length: 5000 }, (_, i) => 
        `{{ variable_${i} | filter_${i % 10} | default("default_${i}") }}`
      ).join('\n');

      const extractionTimes = [];
      
      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();
        const variables = this.engine.extractVariables(manyVariablesTemplate, 'stress-test');
        const duration = performance.now() - startTime;
        extractionTimes.push(duration);
      }

      const avgTime = extractionTimes.reduce((a, b) => a + b, 0) / extractionTimes.length;

      this.results.stress.variableExtraction = {
        variableCount: 5000,
        extractionTimes,
        avgTime,
        maxTime: Math.max(...extractionTimes),
        compliance: extractionTimes.filter(t => t <= 5).length / extractionTimes.length,
        status: avgTime <= 5 ? 'PASS' : 'FAIL'
      };

    } catch (error) {
      this.results.errors.push({
        test: 'variable_extraction_limits',
        error: error.message
      });
    }
  }

  /**
   * Test frontmatter complexity limits
   */
  async testFrontmatterComplexity() {
    console.log('📋 Testing frontmatter complexity...');

    const complexFrontmatters = {
      yaml: `---
${Array.from({ length: 1000 }, (_, i) => `field_${i}: "Value ${i}"`).join('\n')}
nested:
  level1:
    level2:
      level3:
        deep_field: "Deep value"
arrays:
  - item1
  - item2
  - item3
${Array.from({ length: 100 }, (_, i) => `  - item${i + 4}`).join('\n')}
---\nTemplate content`,

      toml: `+++
${Array.from({ length: 500 }, (_, i) => `field_${i} = "Value ${i}"`).join('\n')}
[nested]
deep = true
[nested.level2]
deeper = "value"
array = [${Array.from({ length: 100 }, (_, i) => `"item${i}"`).join(', ')}]
+++\nTemplate content`,

      json: `{
  ${Array.from({ length: 500 }, (_, i) => `"field_${i}": "Value ${i}"`).join(',\n  ')},
  "nested": {
    "array": [${Array.from({ length: 100 }, (_, i) => `"item${i}"`).join(', ')}]
  }
}\nTemplate content`
    };

    this.results.stress.frontmatter = {};

    for (const [format, content] of Object.entries(complexFrontmatters)) {
      try {
        const parseTimes = [];
        
        for (let i = 0; i < 10; i++) {
          const startTime = performance.now();
          const result = this.frontmatterProcessor.parseFrontmatter(content, `stress-${format}`);
          const duration = performance.now() - startTime;
          parseTimes.push(duration);
        }

        const avgTime = parseTimes.reduce((a, b) => a + b, 0) / parseTimes.length;

        this.results.stress.frontmatter[format] = {
          parseTimes,
          avgTime,
          maxTime: Math.max(...parseTimes),
          compliance: parseTimes.filter(t => t <= 5).length / parseTimes.length,
          status: avgTime <= 5 ? 'PASS' : 'FAIL'
        };

      } catch (error) {
        this.results.errors.push({
          test: `frontmatter_complexity_${format}`,
          error: error.message
        });
      }
    }
  }

  /**
   * Test overall performance compliance
   */
  async testPerformanceCompliance() {
    console.log('✅ Testing performance compliance...');

    const engineMetrics = this.engine.getPerformanceMetrics();
    const frontmatterMetrics = this.frontmatterProcessor.getPerformanceMetrics();

    this.results.performance = {
      template: {
        rendering: engineMetrics.performance.rendering,
        variableExtraction: engineMetrics.performance.variableExtraction,
        validation: engineMetrics.performance.validation,
        caching: engineMetrics.cacheStats
      },
      frontmatter: frontmatterMetrics,
      overall: {
        renderingCompliance: engineMetrics.performance.rendering.compliance * 100,
        variableExtractionCompliance: engineMetrics.performance.variableExtraction.compliance * 100,
        frontmatterCompliance: frontmatterMetrics.parsing.compliance * 100,
        cacheHitRate: engineMetrics.cacheStats.hitRate * 100
      }
    };

    // Calculate compliance scores
    const compliance = this.results.performance.overall;
    const overallScore = (
      compliance.renderingCompliance +
      compliance.variableExtractionCompliance + 
      compliance.frontmatterCompliance +
      compliance.cacheHitRate
    ) / 4;

    this.results.compliance = {
      overall: overallScore,
      rendering: compliance.renderingCompliance >= 90,
      variableExtraction: compliance.variableExtractionCompliance >= 95,
      frontmatter: compliance.frontmatterCompliance >= 95,
      caching: compliance.cacheHitRate >= 80,
      status: overallScore >= 90 ? 'PASS' : 'FAIL'
    };
  }

  /**
   * Generate comprehensive stress test report
   */
  async generateStressTestReport(totalDuration) {
    console.log('\n📊 Generating stress test report...');

    const report = {
      summary: {
        timestamp: new Date().toISOString(),
        totalDuration: Math.round(totalDuration),
        status: this.calculateOverallStatus(),
        compliance: this.results.compliance,
        errorCount: this.results.errors.length
      },
      performance: this.results.performance,
      stress: this.results.stress,
      errors: this.results.errors,
      recommendations: this.generateRecommendations()
    };

    // Write detailed report
    const reportPath = path.join(this.testDir, 'stress-test-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    // Generate summary
    this.printSummary(report);

    return report;
  }

  /**
   * Calculate overall test status
   */
  calculateOverallStatus() {
    const stressResults = Object.values(this.results.stress).flat();
    const failedTests = stressResults.filter(result => result.status === 'FAIL').length;
    const totalTests = stressResults.length;
    
    if (failedTests === 0) return 'EXCELLENT';
    if (failedTests <= totalTests * 0.1) return 'GOOD';
    if (failedTests <= totalTests * 0.25) return 'ACCEPTABLE';
    return 'NEEDS_IMPROVEMENT';
  }

  /**
   * Generate optimization recommendations
   */
  generateRecommendations() {
    const recommendations = [];

    if (this.results.compliance?.rendering === false) {
      recommendations.push({
        category: 'performance',
        priority: 'high',
        issue: 'Template rendering performance below 90% compliance',
        suggestion: 'Optimize template complexity and enable more aggressive caching'
      });
    }

    if (this.results.compliance?.caching === false) {
      recommendations.push({
        category: 'caching',
        priority: 'medium',
        issue: 'Cache hit rate below 80%',
        suggestion: 'Increase cache size and TTL, review cache key generation'
      });
    }

    if (this.results.errors.length > 0) {
      recommendations.push({
        category: 'stability',
        priority: 'high', 
        issue: `${this.results.errors.length} errors occurred during testing`,
        suggestion: 'Review error log and improve error handling'
      });
    }

    return recommendations;
  }

  /**
   * Print test summary to console
   */
  printSummary(report) {
    console.log('\n' + '='.repeat(80));
    console.log('🎯 ALPHA-7 TEMPLATE STRESS TEST RESULTS');
    console.log('='.repeat(80));
    console.log(`\n📈 Overall Status: ${report.summary.status}`);
    console.log(`⏱️  Total Duration: ${report.summary.totalDuration}ms`);
    console.log(`❌ Errors: ${report.summary.errorCount}`);

    if (report.summary.compliance) {
      console.log('\n🏆 PERFORMANCE COMPLIANCE:');
      console.log(`   Overall Score: ${report.summary.compliance.overall.toFixed(1)}%`);
      console.log(`   Rendering: ${report.summary.compliance.rendering ? '✅' : '❌'} (${report.performance.overall.renderingCompliance.toFixed(1)}%)`);
      console.log(`   Variable Extraction: ${report.summary.compliance.variableExtraction ? '✅' : '❌'} (${report.performance.overall.variableExtractionCompliance.toFixed(1)}%)`);
      console.log(`   Frontmatter: ${report.summary.compliance.frontmatter ? '✅' : '❌'} (${report.performance.overall.frontmatterCompliance.toFixed(1)}%)`);
      console.log(`   Caching: ${report.summary.compliance.caching ? '✅' : '❌'} (${report.performance.overall.cacheHitRate.toFixed(1)}%)`);
    }

    console.log('\n📊 STRESS TEST BENCHMARKS:');
    if (this.results.stress.largeTemplates) {
      console.log('   Large Templates:');
      for (const [template, result] of Object.entries(this.results.stress.largeTemplates)) {
        console.log(`     ${template}: ${result.avgTime.toFixed(2)}ms avg (${result.status})`);
      }
    }

    if (this.results.stress.concurrency) {
      console.log('   Concurrent Rendering:');
      for (const [level, result] of Object.entries(this.results.stress.concurrency)) {
        console.log(`     ${level}: ${result.avgTimePerRender.toFixed(2)}ms avg (${result.status})`);
      }
    }

    if (report.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      for (const rec of report.recommendations) {
        console.log(`   ${rec.priority.toUpperCase()}: ${rec.suggestion}`);
      }
    }

    console.log('\n' + '='.repeat(80));
  }
}

module.exports = { TemplateStressTester };